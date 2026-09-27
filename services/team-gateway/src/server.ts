/**
 * Team Gateway HTTP server (ADR-0092). One bun process serving:
 *   - native REST:   POST /sessions, GET /tenants[/:id], POST /tenants/:id/chat (raw SSE)
 *   - OpenAI wire:   GET /v1/models, POST /v1/chat/completions (SSE chunks or JSON)
 *   - dev aid:       GET / (single-file demo chat page)
 * Phase 0 posture (D6): loopback bind by default, no auth, single process, per-tenant
 * HERMES_HOME isolation, per-tenant chat serialization.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { GatewayConfig, loadConfig, SERVICE_ROOT } from "./config";
import { scaffoldProject } from "./scaffold";
import { publicTenant, seedHermesHome, TenantRecord, TenantRegistry } from "./tenant";
import { HermesEvent, HermesTurnResult, runHermesTurn } from "./hermes";
import {
  anthropicEvent,
  anthropicStream,
  countTokensPayload,
  estimateTokens,
  messagePayload,
  messageId,
  parseAnthropicRequest,
} from "./anthropic";
import {
  chunkData,
  completionId,
  completionPayload,
  completionUsage,
  doneData,
  modelsPayload,
  parseChatRequest,
} from "./openai";
import { moveDir } from "./util";

export interface GatewayState {
  cfg: GatewayConfig;
  registry: TenantRegistry;
  provisioning: Map<string, Promise<void>>;
  chatLocks: Map<string, Promise<unknown>>;
}

export function createState(cfg: GatewayConfig = loadConfig()): GatewayState {
  mkdirSync(cfg.dataDir, { recursive: true });
  return {
    cfg,
    registry: new TenantRegistry(cfg.dataDir),
    provisioning: new Map(),
    chatLocks: new Map(),
  };
}

/** Scaffold, relocate, seed the tenant Hermes home; persists terminal status either way. */
export async function provisionTenant(state: GatewayState, rec: TenantRecord): Promise<void> {
  try {
    const scaffolded = await scaffoldProject({
      workspaceDir: state.cfg.workspaceDir,
      variant: rec.variant,
      projectName: rec.tenantId,
      description: rec.description,
      templateVersion: state.cfg.templateVersion,
      timeoutMs: state.cfg.scaffoldTimeoutMs,
    });
    moveDir(scaffolded.sourceDir, rec.projectDir);
    seedHermesHome(rec, state.cfg.hermesSeedHome, state.cfg.hermesModel);
    rec.status = "ready";
  } catch (err) {
    rec.status = "failed";
    rec.error = String((err as Error)?.message ?? err);
  }
  state.registry.upsert(rec);
}

function startProvisioning(state: GatewayState, rec: TenantRecord): Promise<void> {
  const promise = provisionTenant(state, rec).finally(() => {
    state.provisioning.delete(rec.tenantId);
  });
  state.provisioning.set(rec.tenantId, promise);
  return promise;
}

/** Wait for an in-flight provisioning, or reject with a helpful status. */
async function ensureReady(state: GatewayState, rec: TenantRecord): Promise<TenantRecord> {
  const inflight = state.provisioning.get(rec.tenantId);
  if (inflight) await inflight;
  const current = state.registry.get(rec.tenantId) ?? rec;
  if (current.status === "ready") return current;
  if (current.status === "failed") {
    throw new Error(`tenant ${current.tenantId} failed provisioning: ${current.error ?? "unknown"}`);
  }
  throw new Error(`tenant ${current.tenantId} is ${current.status}`);
}

export function tenantKeyFor(variant: string, user: string): string {
  return `${variant}::${user}`;
}

/** OpenAI-surface lazy tenant: find by key, or create and start provisioning. */
export function getOrStartTenant(
  state: GatewayState,
  variant: string,
  user: string,
): { rec: TenantRecord; promise?: Promise<void> } {
  const key = tenantKeyFor(variant, user);
  const existing = state.registry.findByKey(key);
  if (existing) return { rec: existing };
  const rec = state.registry.create({
    dataDir: state.cfg.dataDir,
    variant,
    key,
    description: `lazy tenant for ${key}`,
  });
  return { rec, promise: startProvisioning(state, rec) };
}

async function waitForTenant(state: GatewayState, tenantId: string): Promise<TenantRecord> {
  const rec = state.registry.get(tenantId);
  if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
  return ensureReady(state, rec);
}

/** Serialized per tenant: one Hermes session writer per HERMES_HOME (state.db is a per-home
 * SQLite WAL; concurrent writers across processes are unsafe). */
async function runChat(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  onEvent?: (evt: HermesEvent) => void,
): Promise<HermesTurnResult> {
  const prev = state.chatLocks.get(rec.tenantId) ?? Promise.resolve();
  const task = prev
    .catch(() => undefined)
    .then(() =>
      runHermesTurn(
        {
          hermesBin: state.cfg.hermesBin,
          projectDir: rec.projectDir,
          hermesHome: rec.hermesHome,
          message,
          sessionName: `gw-${rec.tenantId}`,
          runBudgetSeconds: state.cfg.runBudgetSeconds,
          maxTurns: state.cfg.maxTurns,
          extraArgs: state.cfg.hermesExtraArgs,
        },
        onEvent,
      ),
    );
  state.chatLocks.set(rec.tenantId, task.catch(() => undefined));
  const result = await task;
  if (result.sessionId) {
    const current = state.registry.get(rec.tenantId) ?? rec;
    current.sessions += 1;
    state.registry.upsert(current);
  }
  return result;
}

function usageSummary(result: HermesTurnResult | undefined) {
  const t = (result?.tokens ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const any = n(t.input) ?? n(t.output) ?? n(t.total);
  return any === undefined && !result?.sessionId
    ? null
    : {
        inputTokens: n(t.input),
        outputTokens: n(t.output),
        totalTokens: n(t.total),
      };
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache",
  connection: "keep-alive",
};

function sseData(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "request body must be valid JSON");
  }
}

/** Native chat → raw Hermes events (SSE) + a terminal done event. */
function nativeChatResponse(state: GatewayState, rec: TenantRecord, message: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await runChat(state, rec, message, (evt) =>
          controller.enqueue(sseData(evt)),
        );
        controller.enqueue(
          sseData({
            type: "done",
            sessionId: result.sessionId ?? null,
            exitCode: result.exitCode,
            finalText: result.finalText,
            usage: usageSummary(result),
          }),
        );
      } catch (err) {
        controller.enqueue(sseData({ type: "error", error: String((err as Error)?.message ?? err) }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: SSE_HEADERS });
}

/** OpenAI chat completions: stream=true → role chunk, content chunks, finish chunk, [DONE];
 * stream=false → single completion JSON. */
async function openaiChatResponse(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  stream: boolean,
): Promise<Response> {
  if (!stream) {
    const result = await runChat(state, rec, message);
    return jsonResponse(
      completionPayload(
        completionId(),
        rec.variant,
        Math.floor(Date.now() / 1000),
        result.finalText,
        completionUsage(result.result?.tokens),
      ),
    );
  }
  const id = completionId();
  const created = Math.floor(Date.now() / 1000);
  const model = rec.variant;
  let sentRole = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        const result = await runChat(state, rec, message, (evt) => {
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          if (!sentRole) {
            sentRole = true;
            controller.enqueue(enc.encode(chunkData(id, model, created, { role: "assistant" }, null)));
          }
          controller.enqueue(enc.encode(chunkData(id, model, created, { content: evt.text }, null)));
        });
        controller.enqueue(enc.encode(chunkData(id, model, created, {}, "stop")));
        controller.enqueue(enc.encode(doneData()));
      } catch (err) {
        controller.enqueue(
          enc.encode(
            `data: ${JSON.stringify({ error: { message: String((err as Error)?.message ?? err) } })}\n\n`,
          ),
        );
        controller.enqueue(enc.encode(doneData()));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

/** Anthropic Messages surface: stream=true → message_start / content_block_* / message_delta /
 * message_stop SSE frames; stream=false → single message envelope. */
async function anthropicChatResponse(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  stream: boolean,
): Promise<Response> {
  if (!stream) {
    const result = await runChat(state, rec, message);
    const tokens = (result.tokens ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    return jsonResponse(
      messagePayload(messageId(), rec.variant, result.finalText, {
        input_tokens: n(tokens.input),
        output_tokens: n(tokens.output),
      }),
    );
  }
  const id = messageId();
  const model = rec.variant;
  const frames = anthropicStream(id, model);
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let startedContent = false;
        const enqueue = (frameset: Uint8Array[]) => frameset.forEach((f) => controller.enqueue(f));
        enqueue(frames.messageStart());
        const result = await runChat(state, rec, message, (evt) => {
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          if (!startedContent) {
            startedContent = true;
            enqueue(frames.contentStart());
          }
          enqueue(frames.contentDelta(evt.text));
        });
        if (startedContent) enqueue(frames.contentStop());
        const tokens = (result.tokens ?? {}) as Record<string, unknown>;
        const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        enqueue(frames.messageStop(n(tokens.input), n(tokens.output)));
      } catch (err) {
        controller.enqueue(
          anthropicEvent("error", {
            type: "error",
            error: { type: "api_error", message: String((err as Error)?.message ?? err) },
          }),
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

const DEMO_PAGE_PATH = resolve(SERVICE_ROOT, "web", "index.html");

function demoPage(): Response {
  if (existsSync(DEMO_PAGE_PATH)) {
    return new Response(readFileSync(DEMO_PAGE_PATH, "utf8"), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return new Response("<!doctype html><title>team-gateway</title><p>demo page not built</p>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleRequest(state: GatewayState, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    if (req.method === "GET" && path === "/") return demoPage();

    if (req.method === "GET" && path === "/health") {
      return jsonResponse({
        ok: true,
        service: "team-gateway",
        variants: state.cfg.variants,
        templateVersion: state.cfg.templateVersion ?? "head",
        dataDir: state.cfg.dataDir,
        hermesBin: state.cfg.hermesBin,
        tenants: state.registry.list().length,
      });
    }

    if (req.method === "GET" && path === "/v1/models") {
      return jsonResponse(modelsPayload(state.cfg.variants));
    }

    if (req.method === "POST" && path === "/sessions") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const variant = typeof body.variant === "string" ? body.variant.trim() : "";
      if (!variant) throw new HttpError(400, "variant is required");
      if (!state.cfg.variants.includes(variant)) {
        throw new HttpError(400, `variant ${variant} is not in the allowlist: ${state.cfg.variants.join(", ")}`);
      }
      const rec = state.registry.create({
        dataDir: state.cfg.dataDir,
        variant,
        description: typeof body.description === "string" ? body.description : undefined,
      });
      startProvisioning(state, rec);
      return jsonResponse({ tenantId: rec.tenantId, status: rec.status }, 202);
    }

    if (req.method === "GET" && path === "/tenants") {
      return jsonResponse({ tenants: state.registry.list().map(publicTenant) });
    }

    const tenantDetail = path.match(/^\/tenants\/([^/]+)$/);
    if (req.method === "GET" && tenantDetail) {
      const rec = state.registry.get(decodeURIComponent(tenantDetail[1]));
      if (!rec) throw new HttpError(404, `tenant ${tenantDetail[1]} not found`);
      return jsonResponse(publicTenant(rec));
    }

    const tenantChat = path.match(/^\/tenants\/([^/]+)\/chat$/);
    if (req.method === "POST" && tenantChat) {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const message = typeof body.message === "string" ? body.message : "";
      if (!message.trim()) throw new HttpError(400, "message is required");
      const rec = await waitForTenant(state, decodeURIComponent(tenantChat[1]));
      return nativeChatResponse(state, rec, message);
    }

    if (req.method === "POST" && path === "/v1/chat/completions") {
      const parsed = parseChatRequest(await readJsonBody(req));
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      if (!state.cfg.variants.includes(parsed.req.model)) {
        throw new HttpError(404, `unknown model: ${parsed.req.model}`);
      }
      const { rec, promise } = getOrStartTenant(state, parsed.req.model, parsed.req.user);
      if (promise) await promise;
      const ready = await ensureReady(state, rec);
      return await openaiChatResponse(state, ready, parsed.req.message, parsed.req.stream);
    }

    if (req.method === "POST" && path === "/v1/messages") {
      const parsed = parseAnthropicRequest(await readJsonBody(req));
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      if (!state.cfg.variants.includes(parsed.req.model)) {
        throw new HttpError(404, `unknown model: ${parsed.req.model}`);
      }
      const { rec, promise } = getOrStartTenant(state, parsed.req.model, parsed.req.user);
      if (promise) await promise;
      const ready = await ensureReady(state, rec);
      return await anthropicChatResponse(state, ready, parsed.req.message, parsed.req.stream);
    }

    if (req.method === "POST" && path === "/v1/messages/count_tokens") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const estimate = estimateTokens(JSON.stringify(body.messages ?? ""));
      return jsonResponse(countTokensPayload(estimate));
    }

    throw new HttpError(404, `no route: ${req.method} ${path}`);
  } catch (err) {
    if (err instanceof HttpError) return jsonResponse({ error: err.message }, err.status);
    return jsonResponse({ error: String((err as Error)?.message ?? err) }, 500);
  }
}

export function createServer(state: GatewayState) {
  return Bun.serve({
    port: state.cfg.port,
    hostname: state.cfg.host,
    idleTimeout: 255,
    fetch: (req) => handleRequest(state, req),
  });
}

if (import.meta.main) {
  const state = createState();
  const server = createServer(state);
  console.log(`[team-gateway] listening on http://${state.cfg.host}:${server.port}`);
  console.log(`[team-gateway] variants: ${state.cfg.variants.join(", ")}`);
  console.log(`[team-gateway] data dir: ${state.cfg.dataDir}`);
  console.log(`[team-gateway] workspace: ${state.cfg.workspaceDir}`);
}
