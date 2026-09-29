/**
 * Team Gateway HTTP server (ADR-0092). One bun process serving:
 *   - native REST:   POST /sessions, GET /tenants[/:id], POST /tenants/:id/chat (raw SSE)
 *   - OpenAI wire:   GET /v1/models, POST /v1/chat/completions (SSE chunks or JSON)
 *   - dev aid:       GET / (single-file demo chat page)
 * Phase 0 posture (D6): loopback bind by default, no auth, single process, per-tenant
 * HERMES_HOME isolation, per-tenant chat serialization.
 */

import { chownSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { dockerProbe, GatewayConfig, loadConfig, readKeysFile, resolveLlmProviderKey, resolveLlmProviderName, SERVICE_ROOT } from "./config";
import { credentialValid, presentedCredential, principalFor, requestAuthorized } from "./auth";
import { scaffoldProject } from "./scaffold";
import { chownTree, publicTenant, recordProgress, recordTurnUsage, seedHermesHome, sweepTenantStragglers, tenantConfigYaml, TenantRecord } from "./tenant";
import { TenantRegistry } from "./registry-db";
import { listTenantFiles, readTenantFile, TurnStore } from "./tenant-files";
import {
  UserStore,
  sessionTokenFromCookie,
  sessionCookieHeader,
  clearCookieHeader,
} from "./users";
import { googleConfigured, authorizeUrl, makePkce, exchangeCode, fetchProfile } from "./google-sso";
import { AuditLog, RateLimiter, csrfRequired, sweepOutbox } from "./hardening";
import { randomBytes } from "node:crypto";
import { HermesEvent, HermesTurnResult, runHermesTurn } from "./hermes";
import { runAntigravityTurn } from "./antigravity";
import { runClaudeTurn } from "./claude";
import { runCodexTurn } from "./codex";
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
  estimateTokens as geminiEstimateTokens,
  generateContentPayload,
  geminiError,
  geminiStream,
  parseGeminiRequest,
} from "./gemini";
import {
  chunkData,
  completionId,
  completionPayload,
  completionUsage,
  doneData,
  modelsPayload,
  parseChatRequest,
} from "./openai";
import { dirSize, genId, moveDir } from "./util";

export interface GatewayState {
  cfg: GatewayConfig;
  registry: TenantRegistry;
  turns: TurnStore;
  users: UserStore;
  audit: AuditLog;
  loginLimiter: RateLimiter;
  signupLimiter: RateLimiter;
  sessionLimiter: RateLimiter;
  provisioning: Map<string, Promise<void>>;
  chatLocks: Map<string, Promise<unknown>>;
  /** QA-07: live child processes per tenant, killable via POST /tenants/:id/cancel. */
  activeProcs: Map<string, { kill: (code?: number) => void }>;
}

export function createState(cfg: GatewayConfig = loadConfig()): GatewayState {
  mkdirSync(cfg.dataDir, { recursive: true });
  return {
    cfg,
    turns: new TurnStore(cfg.dataDir),
    users: new UserStore(cfg.dataDir),
    audit: new AuditLog(cfg.dataDir),
    loginLimiter: new RateLimiter(10, 15 * 60 * 1000),
    signupLimiter: new RateLimiter(5, 3600 * 1000),
    sessionLimiter: new RateLimiter(10, 3600 * 1000),
    registry: new TenantRegistry(cfg.dataDir),
    provisioning: new Map(),
    chatLocks: new Map(),
    activeProcs: new Map(),
  };
}

/** Scaffold, relocate, seed the tenant Hermes home; persists terminal status either way. */
export async function provisionTenant(state: GatewayState, rec: TenantRecord): Promise<void> {
  try {
    recordProgress(rec, "scaffolding", `scaffolding ${rec.variant} team…`);
    state.registry.upsert(rec);
    const scaffolded = await scaffoldProject({
      workspaceDir: state.cfg.workspaceDir,
      variant: rec.variant,
      projectName: rec.tenantId,
      description: rec.description,
      templateVersion: state.cfg.templateVersion,
      timeoutMs: state.cfg.scaffoldTimeoutMs,
    });
    recordProgress(rec, "relocating", "moving to tenant storage…");
    state.registry.upsert(rec);
    moveDir(scaffolded.sourceDir, rec.projectDir);
    recordProgress(rec, "seeding", "seeding hermes home…");
    state.registry.upsert(rec);
    seedHermesHome(
      rec,
      state.cfg.hermesSeedHome,
      state.cfg.hermesModel,
      resolveLlmProviderKey(state.cfg)
        ? {
            name: resolveLlmProviderName(state.cfg),
            baseUrl: state.cfg.llmBaseUrl,
            apiKey: state.cfg.llmApiKey,
          }
        : undefined,
    );
    if (state.cfg.isolation === "docker") {
      // The isolated turn runs as the hermes image's UID 10000 — the tenant tree must be
      // owned by it (the scaffold subprocess wrote everything as root).
      chownTree(rec.hermesHome, 10000, 10000);
      chownTree(rec.projectDir, 10000, 10000);
    }
    rec.status = "ready";
    recordProgress(rec, "ready", "session ready");
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

/** P7: sanitize a user-supplied project name to what the scaffold engine accepts. */
export function sanitizeProjectName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return cleaned;
}

/** Wave B3/SEC-13: bootstrap the admin account at startup (idempotent). */
export function bootstrapAdminFromEnv(state: GatewayState): void {
  const email = process.env.CO_WORKSPACE_ADMIN_EMAIL;
  if (!email) return;
  const admin = state.users.bootstrapAdmin(email);
  if (admin) console.log(`[co-workspace] admin bootstrapped: ${admin.principal} (${email})`);
}

/** SEC-01: resolve the caller's trusted principal — session first, then key label. */
export function callerPrincipal(state: GatewayState, req: Request): string | null {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  if (sessionUser) return sessionUser.principal;
  const cred = presentedCredential(req);
  if (cred && credentialValid(state.cfg, cred)) return principalFor(state.cfg, cred);
  return null;
}

export function isAdminCaller(state: GatewayState, req: Request): boolean {
  const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
  return sessionUser?.role === "admin";
}

/** SEC-01: tenant access requires owner match, admin role, or the Phase 0 open mode
 * (no keys, no login requirement, anonymous-owned tenant). */
export function requireTenantAccess(state: GatewayState, req: Request, rec: TenantRecord): void {
  if (isAdminCaller(state, req)) return;
  const openMode = state.cfg.apiKeys.length === 0 && !state.cfg.loginRequired;
  if (openMode && (rec.ownerPrincipal ?? "anonymous") === "anonymous") return;
  const caller = callerPrincipal(state, req);
  if (caller && rec.ownerPrincipal && rec.ownerPrincipal === caller) return;
  throw new HttpError(403, `tenant ${rec.tenantId} is owned by ${rec.ownerPrincipal ?? "anonymous"}`);
}

/** SEC-05 remnant: aggregate token usage across ALL tenants owned by a principal. */
export function principalTokenUsage(state: GatewayState, principal: string): { input: number; output: number } {
  let input = 0;
  let output = 0;
  for (const t of state.registry.list()) {
    if ((t.ownerPrincipal ?? "anonymous") !== principal) continue;
    input += t.inputTokens;
    output += t.outputTokens;
  }
  return { input, output };
}

/** Per-principal lifetime token budget across tenants (0 = off). */
export function assertPrincipalQuota(state: GatewayState, principal: string): void {
  const max = state.cfg.principalMaxTokens;
  if (max <= 0) return;
  const usage = principalTokenUsage(state, principal);
  const used = usage.input + usage.output;
  if (used >= max) {
    throw new HttpError(429, `principal token budget exhausted (${used}/${max} tokens across all tenants)`);
  }
}

export function tenantKeyFor(variant: string, user: string): string {
  return `${variant}::${user}`;
}

// R5: walking every tenant's file tree per panel-open is O(total files); a 60s TTL keeps
// the admin panel instant at many tenants (freshness tradeoff is fine for stats).
const diskSizeCache = new Map<string, { bytes: number; at: number }>();
async function cachedDirSize(tenantId: string, projectDir: string, hermesHome: string): Promise<number> {
  const hit = diskSizeCache.get(tenantId);
  if (hit && Date.now() - hit.at < 60_000) return hit.bytes;
  const bytes = (await dirSize(projectDir)) + (await dirSize(hermesHome));
  diskSizeCache.set(tenantId, { bytes, at: Date.now() });
  return bytes;
}

/** Host-side equivalent of a container path under <dataDir> (docker isolation mounts must
 * resolve on the host — CO_WORKSPACE_DATA_DIR_HOST). Undefined when dataDirHost is unset. */
export function hostSidePath(cfg: GatewayConfig, absPath: string): string | undefined {
  if (!cfg.dataDirHost) return undefined;
  const rel = absPath.slice(cfg.dataDir.length);
  return join(cfg.dataDirHost, rel);
}

/** OpenAI-surface lazy tenant: find by key, or create and start provisioning. */
export function getOrStartTenant(
  state: GatewayState,
  variant: string,
  user: string,
  ownerPrincipal?: string,
): { rec: TenantRecord; promise?: Promise<void> } {
  const key = tenantKeyFor(variant, user);
  const existing = state.registry.findByKey(key);
  if (existing) return { rec: existing };
  const rec = state.registry.create({
    dataDir: state.cfg.dataDir,
    variant,
    key,
    ownerPrincipal,
    description: `lazy tenant for ${key}`,
  });
  return { rec, promise: startProvisioning(state, rec) };
}

async function waitForTenant(state: GatewayState, tenantId: string): Promise<TenantRecord> {
  const rec = state.registry.get(tenantId);
  if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
  return ensureReady(state, rec);
}

/** Usage inside the configured quota window: `daily` reads today's UTC-day bucket, `lifetime`
 * reads the cumulative counters (design docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md). */
export function windowUsage(
  cfg: GatewayConfig,
  rec: TenantRecord,
  dayKey = new Date().toISOString().slice(0, 10),
): { turns: number; tokens: number } {
  if (cfg.quotaWindow === "daily") {
    const bucket = rec.daily?.[dayKey];
    return {
      turns: bucket?.turns ?? 0,
      tokens: (bucket?.inputTokens ?? 0) + (bucket?.outputTokens ?? 0),
    };
  }
  return { turns: rec.sessions, tokens: rec.inputTokens + rec.outputTokens };
}

/** Phase 2 quotas (D2): enforced BEFORE any stream opens, so a rejected turn costs nothing. */
export function assertQuota(
  cfg: GatewayConfig,
  rec: TenantRecord,
  dayKey = new Date().toISOString().slice(0, 10),
): void {
  const usage = windowUsage(cfg, rec, dayKey);
  if (cfg.tenantMaxTurns > 0 && usage.turns >= cfg.tenantMaxTurns) {
    throw new HttpError(429, `tenant turn quota exhausted (${usage.turns}/${cfg.tenantMaxTurns} turns, window: ${cfg.quotaWindow})`);
  }
  if (cfg.tenantMaxTokens > 0 && usage.tokens >= cfg.tenantMaxTokens) {
    throw new HttpError(429, `tenant token quota exhausted (${usage.tokens}/${cfg.tenantMaxTokens} tokens, window: ${cfg.quotaWindow})`);
  }
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
    .then(() => {
      // Keep the tenant home's credentials current: the containerized hermes (older release
      // lineage) resolves OAuth from its OWN home's auth.json and cannot consult the shared
      // store, so each turn re-copies the operator's CURRENT auth.json (Addendum 4 note).
      // Provider-key mode (design 2026-09-29-co-workspace-provider-key-config) skips this —
      // static provider keys need no OAuth tokens, and copying them was the refresh-token-
      // reuse revocation class (Nous invalid_grant, 2026-09-29).
      const seedAuth = resolveLlmProviderKey(state.cfg)
        ? undefined
        : state.cfg.hermesSeedHome
          ? join(state.cfg.hermesSeedHome, "auth.json")
          : undefined;
      if (seedAuth && existsSync(seedAuth)) {
        copyFileSync(seedAuth, join(rec.hermesHome, "auth.json"));
        if (state.cfg.isolation === "docker") chownSync(join(rec.hermesHome, "auth.json"), 10000, 10000);
      }
      // Re-stamp the tenant config.yaml every turn: provider/base-url/model changes apply
      // to EXISTING tenants on their next turn (no re-provisioning needed). In legacy mode
      // (no provider key) the stamp carries NO provider lines — stamping `provider: custom`
      // unconditionally would break the OAuth/shared-store tenants.
      const providerKey = resolveLlmProviderKey(state.cfg);
      writeFileSync(
        join(rec.hermesHome, "config.yaml"),
        tenantConfigYaml(
          rec.projectDir,
          state.cfg.hermesModel,
          providerKey
            ? {
                providerName: resolveLlmProviderName(state.cfg),
                providerBaseUrl: state.cfg.llmBaseUrl,
                providerApiKey: state.cfg.llmApiKey,
              }
            : undefined,
        ),
      );
      if (state.cfg.runtime === "antigravity") {
        return runAntigravityTurn(
          {
            agyBin: state.cfg.antigravityBin,
            binPrefix: state.cfg.antigravityBinPrefix,
            projectDir: rec.projectDir,
            message,
            conversationId: rec.conversationId,
            printTimeoutSeconds: state.cfg.runBudgetSeconds,
            extraArgs: state.cfg.hermesExtraArgs,
          },
          onEvent,
        );
      }
      if (state.cfg.runtime === "claude") {
        return runClaudeTurn(
          {
            claudeBin: state.cfg.claudeBin,
            projectDir: rec.projectDir,
            message,
            sessionId: rec.conversationId,
            extraArgs: state.cfg.hermesExtraArgs,
          },
          onEvent,
        );
      }
      if (state.cfg.runtime === "codex") {
        return runCodexTurn(
          {
            codexBin: state.cfg.codexBin,
            projectDir: rec.projectDir,
            message,
            threadId: rec.conversationId,
            extraArgs: state.cfg.hermesExtraArgs,
          },
          onEvent,
        );
      }
      return runHermesTurn(
        {
          hermesBin: state.cfg.hermesBin,
          binPrefix: state.cfg.hermesBinPrefix,
          providerKeyEnv: resolveLlmProviderKey(state.cfg) ?? undefined,
          projectDir: rec.projectDir,
          hermesHome: rec.hermesHome,
          message,
          sessionName: `gw-${rec.tenantId}`,
          runBudgetSeconds: state.cfg.runBudgetSeconds,
          maxTurns: state.cfg.maxTurns,
          extraArgs: state.cfg.hermesExtraArgs,
          toolsets: state.cfg.hermesToolsets,
          // Docker isolation: the tenant home is re-seeded with the CURRENT seed auth.json
          // every turn, so the shared-store bind adds nothing — and empirically flips hermes
          // onto the shared Nous store, failing the turn (exit 111, observed 2026-09-28).
          // Process-mode tenants keep the shared store (single HOME, refreshes stay valid).
          sharedAuthDir: state.cfg.isolation === "docker" ? undefined : resolveAuthDir(state.cfg),
          onSpawn: (proc) => state.activeProcs.set(rec.tenantId, proc),
          container:
            state.cfg.isolation === "docker"
              ? {
                  image: state.cfg.runtimeImage,
                  // Host-side equivalents of the tenant's container paths: record paths live
                  // under <dataDir>/…, remap the prefix onto dataDirHost. (The old
                  // `tenants/<id>/…` hardcode mounted empty dirs — per-user storage moved
                  // tenant files under storage/<principal>/<project>.)
                  hostProjectDir: hostSidePath(state.cfg, rec.projectDir),
                  hostHermesHome: hostSidePath(state.cfg, rec.hermesHome),
                  hostAuthDir: state.cfg.hermesAuthDirHost
                    ?? (state.cfg.dataDirHost
                      ? join(state.cfg.dataDirHost, "shared-auth")
                      : undefined),
                  memory: state.cfg.containerMemory,
                  cpus: state.cfg.containerCpus,
                  pidsLimit: state.cfg.containerPidsLimit,
                }
              : undefined,
        },
        onEvent,
      );
    });
  state.chatLocks.set(rec.tenantId, task.catch(() => undefined));
  const result = await task;
  if (result.sessionId) {
    const current = state.registry.get(rec.tenantId) ?? rec;
    if (state.cfg.runtime !== "hermes") current.conversationId = result.sessionId;
    // Auto-title (ChatGPT pattern): a session with no user-provided name takes its title
    // from the first message that drove a completed turn.
    if (!current.name && message.trim()) {
      current.name = message.replace(/\s+/g, " ").trim().slice(0, 48) || current.tenantId;
    }
    const tokens = (result.tokens ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    recordTurnUsage(current, new Date().toISOString().slice(0, 10), {
      input: n(tokens.input),
      output: n(tokens.output),
    });
    state.activeProcs.delete(rec.tenantId);
    state.registry.upsert(current);
    state.turns.record(rec.tenantId, {
      sessionId: result.sessionId,
      exitCode: result.exitCode,
      finalText: result.finalText,
      inputTokens: n(tokens.input),
      outputTokens: n(tokens.output),
    });
  }
  return result;
}

/** Shared credential store for tenant sessions (ADR-0092 Addendum 4): defaults to the seed
 * home's `shared/` dir — the operator's own Nous token store, refreshed in place. */
export function resolveAuthDir(cfg: GatewayConfig): string | undefined {
  return cfg.hermesAuthDir ?? (cfg.hermesSeedHome ? join(cfg.hermesSeedHome, "shared") : undefined);
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

/** P2-11 (QA fair): keep SSE connections alive through silent tool phases — a comment ping
 * every 15s, cleared when the stream ends. */
function startHeartbeat(controller: ReadableStreamDefaultController<Uint8Array>): () => void {
  const ping = new TextEncoder().encode(": ping\n\n");
  const timer = setInterval(() => {
    try {
      controller.enqueue(ping);
    } catch {
      clearInterval(timer);
    }
  }, 15_000);
  return () => clearInterval(timer);
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
        // R7 UX: while the team is still provisioning, stream its progress stages as `: …`
        // comment frames (wire-legal SSE comments) so the wait is visible in the client.
        let current = state.registry.get(rec.tenantId) ?? rec;
        if (current.status === "provisioning") {
          const deadline = Date.now() + state.cfg.scaffoldTimeoutMs + 5_000;
          while (Date.now() < deadline) {
            current = state.registry.get(rec.tenantId) ?? current;
            const last = current.progress?.[current.progress.length - 1];
            controller.enqueue(
              new TextEncoder().encode(
                `: provisioning: ${last ? `[${last.stage}] ${last.label}` : current.status + "…"}\n\n`,
              ),
            );
            if (current.status !== "provisioning") break;
            await Bun.sleep(1000);
          }
          if (current.status === "failed") {
            throw new Error(`team provisioning failed: ${current.error ?? "unknown"}`);
          }
          if (current.status === "provisioning") {
            throw new Error("team provisioning timed out — try again shortly");
          }
        }
        assertQuota(state.cfg, current);
        assertPrincipalQuota(state, current.ownerPrincipal ?? "anonymous");
        const result = await runChat(state, current, message, (evt) =>
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
  provisioning?: Promise<void>,
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
        // P8: while a lazy tenant is provisioning, stream progress as SSE comments
        // (`: …` lines are wire-legal and ignored by OpenAI clients, visible to humans).
        if (provisioning) {
          const emitTrail = () => {
            for (const p of state.registry.get(rec.tenantId)?.progress ?? []) {
              controller.enqueue(enc.encode(`: provisioning: [${p.stage}] ${p.label}\n`));
            }
          };
          emitTrail();
          let ticks = 0;
          const timer = setInterval(() => {
            ticks += 1;
            const cur = state.registry.get(rec.tenantId) ?? rec;
            if (cur.progress?.length) {
              const last = cur.progress[cur.progress.length - 1];
              controller.enqueue(enc.encode(`: provisioning: [${last.stage}] ${last.label}\n`));
            } else {
              controller.enqueue(enc.encode(`: provisioning: ${cur.status}…\n`));
            }
            if (ticks > 900) clearInterval(timer);
          }, 1000);
          await provisioning;
          clearInterval(timer);
          controller.enqueue(enc.encode(": provisioning: ready\n\n"));
        }
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

/** Gemini wire (Antigravity/Gemini ecosystem): stream=true → per-delta candidate chunks then a
 * terminal chunk with finishReason STOP + usageMetadata; stream=false → single generateContent
 * envelope. */
async function geminiChatResponse(
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
      generateContentPayload(result.finalText, {
        promptTokenCount: n(tokens.input),
        candidatesTokenCount: n(tokens.output),
        totalTokenCount: n(tokens.total),
      }),
    );
  }
  const frames = geminiStream();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const stopPing = startHeartbeat(controller);
      try {
        const result = await runChat(state, rec, message, (evt) => {
          if (evt.type !== "text" || typeof evt.text !== "string") return;
          frames.delta(evt.text).forEach((f) => controller.enqueue(f));
        });
        const tokens = (result.tokens ?? {}) as Record<string, unknown>;
        const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
        frames.end(n(tokens.input), n(tokens.output)).forEach((f) => controller.enqueue(f));
      } catch (err) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify(geminiError(500, String((err as Error)?.message ?? err)))}\n\n`,
          ),
        );
      } finally {
        stopPing();
        controller.close();
      }
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

const DEMO_PAGE_PATH = resolve(SERVICE_ROOT, "web", "index.html");

/** The single-file app ships without versioned asset URLs — `no-cache` forces revalidation
 * on every load, otherwise browsers heuristically cache the page across redeploys and run
 * stale code for days (the "nothing changed" report of 2026-09-27/28). */
function htmlHeaders(): Record<string, string> {
  return { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" };
}

const variantStatusCache = new Map<string, string>();
/** P1: variant lifecycle status for catalog metadata (default "stable" when unreadable). */
export function variantStatus(cfg: GatewayConfig, variant: string): string {
  const cached = variantStatusCache.get(variant);
  if (cached) return cached;
  try {
    const v = JSON.parse(readFileSync(join(cfg.workspaceDir, "templates", variant, "variant.json"), "utf8")) as {
      status?: string;
    };
    const status = v.status ?? "stable";
    variantStatusCache.set(variant, status);
    return status;
  } catch {
    return "stable";
  }
}

function demoPage(): Response {
  if (existsSync(DEMO_PAGE_PATH)) {
    return new Response(readFileSync(DEMO_PAGE_PATH, "utf8"), {
      headers: htmlHeaders(),
    });
  }
  return new Response("<!doctype html><title>co-workspace</title><p>demo page not built</p>", {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export async function handleRequest(state: GatewayState, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  try {
    const sessionUser = state.users.resolveSession(sessionTokenFromCookie(req));
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    // SEC-09: keyless-mode CSRF guard — mutating routes need the custom header (a cross-site
    // form cannot set it without a preflight; the server sends no CORS headers).
    const hasCredential = Boolean(sessionUser) || Boolean(presentedCredential(req));
    if (
      csrfRequired(state.cfg, hasCredential) &&
      req.method !== "GET" &&
      req.headers.get("x-requested-with") !== "co-workspace"
    ) {
      throw new HttpError(403, "missing x-requested-with header (CSRF guard)");
    }
    // Phase 2 auth gate + Wave B: a route passes with a valid API key OR a signed-in session
    // (cookie). Exemptions stay limited to `GET /` and `GET /health`.
    // /auth/* is the self-service auth surface (login/logout/signup/verify/me): it must stay
    // reachable without an API key even when keys are configured, or sign-in itself is
    // impossible. The routes authenticate themselves; the loginRequired gate below still
    // exempts them from session demands.
    const authRoute = path.startsWith("/auth/");
    const authorized =
      authRoute ||
      requestAuthorized(state.cfg, req, `${req.method} ${path}`) ||
      (state.cfg.apiKeys.length > 0 && Boolean(sessionUser));
    if (!authorized) {
      throw new HttpError(401, "missing or invalid API key");
    }
    // Wave B gate: when login is required, the web UI demands a session; the API demands a
    // key (Bearer) or a valid session. Exempt: /login page, /auth/*, /health.
    if (state.cfg.loginRequired) {
      const exempt =
        path === "/login" ||
        path.startsWith("/auth/") ||
        path === "/health";
      if (!exempt && !sessionUser) {
        if (path === "/" || req.method === "GET") {
          return new Response(null, { status: 302, headers: { location: "/login" } });
        }
        throw new HttpError(401, "sign-in required");
      }
    }
    if (req.method === "GET" && path === "/") return demoPage();

    if (req.method === "GET" && path === "/login") {
      const loginPath = resolve(SERVICE_ROOT, "web", "login.html");
      if (existsSync(loginPath)) {
        return new Response(readFileSync(loginPath, "utf8"), {
          headers: htmlHeaders(),
        });
      }
      throw new HttpError(404, "login page not found");
    }

    // T-20260928-012: the demo app's pure helpers module (imported by the
    // index.html module script). Same no-cache posture as the HTML pages.
    if (req.method === "GET" && path === "/app-helpers.js") {
      const helpersPath = resolve(SERVICE_ROOT, "web", "app-helpers.js");
      if (existsSync(helpersPath)) {
        return new Response(readFileSync(helpersPath, "utf8"), {
          headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" },
        });
      }
      throw new HttpError(404, "app helpers not found");
    }

    if (req.method === "GET" && path === "/health") {
      return jsonResponse({
        ok: true,
        service: "co-workspace",
        authEnabled: state.cfg.apiKeys.length > 0,
        googleSso: googleConfigured(),
        loginRequired: state.cfg.loginRequired,
        isolation: state.cfg.isolation,
        runtime: state.cfg.runtime,
        variants: state.cfg.variants,
        templateVersion: state.cfg.templateVersion ?? "head",
        tenants: state.registry.list().length,
      });
    }

    if (req.method === "GET" && path === "/v1/models") {
      const runtimeMeta: Record<string, { runtime: string; provider: string }> = {
        hermes: { runtime: "hermes", provider: "operator-configured" },
        antigravity: { runtime: "antigravity", provider: "Google (via agy)" },
        claude: { runtime: "claude", provider: "Anthropic (via Claude Code)" },
        codex: { runtime: "codex", provider: "OpenAI (via Codex CLI)" },
      };
      const rm = runtimeMeta[state.cfg.runtime] ?? { runtime: state.cfg.runtime, provider: "operator-configured" };
      const meta: Record<string, { status?: string; runtime?: string; provider?: string }> = {};
      for (const v of state.cfg.variants) {
        meta[v] = { status: variantStatus(state.cfg, v), ...rm };
      }
      return jsonResponse(modelsPayload(state.cfg.variants, meta));
    }

    if (req.method === "POST" && path === "/sessions") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const variant = typeof body.variant === "string" ? body.variant.trim() : "";
      if (!variant) throw new HttpError(400, "variant is required");
      if (!state.cfg.variants.includes(variant)) {
        throw new HttpError(400, `variant ${variant} is not in the allowlist: ${state.cfg.variants.join(", ")}`);
      }
      let name = typeof body.name === "string" ? sanitizeProjectName(body.name) : "";
      if (name) {
        if (state.registry.list().some((r) => r.name === name)) name = `${name}-${genId("").slice(0, 6)}`;
      }
      const owner = callerPrincipal(state, req) ?? "anonymous";
      // One active team per (principal, variant): creation is keyed and idempotent, so a
      // /sessions-created team is visible to the lazy key lookup instead of diverging.
      const key = tenantKeyFor(variant, owner);
      const existing = state.registry.findByKey(key);
      if (existing) {
        return jsonResponse({ tenantId: existing.tenantId, name: existing.name, status: existing.status, existing: true });
      }
      if (
        state.cfg.tenantMaxPerPrincipal > 0 &&
        state.registry.list().filter((r) => (r.ownerPrincipal ?? "anonymous") === owner).length >=
          state.cfg.tenantMaxPerPrincipal
      ) {
        throw new HttpError(429, `tenant cap reached (${state.cfg.tenantMaxPerPrincipal} per principal)`);
      }
      const rec = state.registry.create({
        dataDir: state.cfg.dataDir,
        variant,
        key,
        name: name || undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        ownerPrincipal: owner,
      });
      state.audit.record(owner, "tenant.create", rec.tenantId, variant);
      startProvisioning(state, rec);
      return jsonResponse({ tenantId: rec.tenantId, name: rec.name, status: rec.status }, 202);
    }

    if (req.method === "GET" && path === "/tenants") {
      // T-20260928-007: cross-user tenant metadata (owner, names, usage, provisioning
      // error strings) is not world-readable — admins see all, others see their own.
      // `?mine=1` remains accepted for backwards compat (same as the default for
      // non-admin callers).
      let list = state.registry.list();
      if (!isAdminCaller(state, req)) {
        const principal = callerPrincipal(state, req) ?? "anonymous";
        list = list.filter((r) => (r.ownerPrincipal ?? "anonymous") === principal);
      }
      return jsonResponse({ tenants: list.map(publicTenant) });
    }

    const tenantDetail = path.match(/^\/tenants\/([^/]+)$/);
    if (req.method === "GET" && tenantDetail) {
      const rec = state.registry.get(decodeURIComponent(tenantDetail[1]));
      if (!rec) throw new HttpError(404, `tenant ${tenantDetail[1]} not found`);
      requireTenantAccess(state, req, rec);
      return jsonResponse(publicTenant(rec));
    }

    const tenantDelete = path.match(/^\/tenants\/([^/]+)$/);
    if (req.method === "DELETE" && tenantDelete) {
      const tenantId = decodeURIComponent(tenantDelete[1]);
      const rec = state.registry.get(tenantId);
      if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
      requireTenantAccess(state, req, rec);
      const inflight = state.provisioning.get(tenantId);
      if (inflight) await inflight.catch(() => undefined);
      const chatLock = state.chatLocks.get(tenantId);
      if (chatLock) await chatLock.catch(() => undefined);
      state.chatLocks.delete(tenantId);
      state.turns.deleteTenant(tenantId);
      const deleted = state.registry.delete(tenantId);
      if (deleted) {
        // T-20260928-003 (defense-in-depth): a tampered/legacy record must never point any
        // rmSync below outside the tenant storage root — validate BEFORE removing anything.
        // (The projectDir rmSync alone could otherwise wipe <storage> itself when a forged
        // record points projectDir at the storage root.)
        const tenantFolder = resolve(deleted.projectDir, "..");
        const storageRoot = resolve(state.cfg.dataDir, "storage");
        if (!tenantFolder.startsWith(storageRoot + sep) || !resolve(deleted.hermesHome).startsWith(tenantFolder + sep)) {
          throw new HttpError(500, `refusing to delete: tenant folder ${tenantFolder} escapes ${storageRoot}`);
        }
        rmSync(deleted.projectDir, { recursive: true, force: true });
        rmSync(deleted.hermesHome, { recursive: true, force: true });
        // Remove the tenant's storage folder (<storage>/<principal>/<name>) — it only ever
        // contains the two dirs above, so this clears the empty shell left behind.
        rmSync(tenantFolder, { recursive: true, force: true });
        // User-reported 2026-09-29: legacy layout bugs left malformed siblings (e.g.
        // <tenantId>project) next to the canonical folder — the folder rm never matched
        // them and deleted tenants kept straggling data on disk.
        sweepTenantStragglers(dirname(tenantFolder), tenantId, basename(tenantFolder));
        state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.delete", tenantId, deleted.variant);
      }
      return jsonResponse({ deleted: tenantId, name: deleted?.name ?? null });
    }

    const tenantChat = path.match(/^\/tenants\/([^/]+)\/chat$/);
    if (req.method === "POST" && tenantChat) {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const message = typeof body.message === "string" ? body.message : "";
      if (!message.trim()) throw new HttpError(400, "message is required");
      const rec = state.registry.get(decodeURIComponent(tenantChat[1]));
      if (!rec) throw new HttpError(404, `tenant ${tenantChat[1]} not found`);
      requireTenantAccess(state, req, rec);
      // Quota trips stay a plain 429 before streaming for ready tenants (contract of the
      // 429-before-streaming tests); a provisioning team is checked once it turns ready,
      // inside the stream where the progress frames are already flowing.
      if (rec.status !== "provisioning") {
        assertQuota(state.cfg, rec);
        assertPrincipalQuota(state, rec.ownerPrincipal ?? "anonymous");
      }
      // The stream starts immediately: provisioning progress is streamed as `: …` comment
      // frames while the team prepares, instead of the response blocking until ready.
      return nativeChatResponse(state, rec, message);
    }

    if (req.method === "POST" && path === "/v1/chat/completions") {
      const parsed = parseChatRequest(await readJsonBody(req));
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      if (!state.cfg.variants.includes(parsed.req.model)) {
        throw new HttpError(404, `unknown model: ${parsed.req.model}`);
      }
      const principal = callerPrincipal(state, req) ?? parsed.req.user;
      const { rec, promise } = getOrStartTenant(state, parsed.req.model, principal);
      if (!rec.ownerPrincipal) {
        rec.ownerPrincipal = principalFor(state.cfg, presentedCredential(req));
        state.registry.upsert(rec);
      }
      const ready = await ensureReady(state, rec);
      assertQuota(state.cfg, ready);
      assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
      return await openaiChatResponse(state, ready, parsed.req.message, parsed.req.stream, promise ?? undefined);
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
      assertQuota(state.cfg, ready);
      assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
      return await anthropicChatResponse(state, ready, parsed.req.message, parsed.req.stream);
    }

    // Phase 2 key rotation: re-read the key file and re-union with the process-immutable env
    // keys — rotation without restart, and a reload can never silently disable auth.
    // SEC-03: admin-only.
    if (req.method === "POST" && path === "/admin/reload") {
      if (!isAdminCaller(state, req)) throw new HttpError(403, "admin only");
      const fileKeys = readKeysFile(state.cfg.apiKeysFile);
      const next = [...new Set([...state.cfg.apiKeysEnv, ...fileKeys])];
      if (next.length === 0 && state.cfg.apiKeys.length > 0) {
        throw new HttpError(400, "reload would disable auth (empty key pool) — rejected");
      }
      state.cfg.apiKeys = next;
      state.audit.record("admin", "keys.reload", undefined, `keyCount=${next.length}`);
      return jsonResponse({ reloaded: true, keyCount: next.length });
    }

    if (req.method === "POST" && path === "/v1/messages/count_tokens") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const estimate = estimateTokens(JSON.stringify(body.messages ?? ""));
      return jsonResponse(countTokensPayload(estimate));
    }

    // Wave A (P11): tenant files listing / content, and turn history.
    const filesRoute = path.match(/^\/tenants\/([^/]+)\/files(?:\/(.*))?$/);
    if (req.method === "GET" && filesRoute) {
      const rec = state.registry.get(decodeURIComponent(filesRoute[1]));
      if (!rec) throw new HttpError(404, `tenant ${filesRoute[1]} not found`);
      const rel = filesRoute[2] ? decodeURIComponent(filesRoute[2]) : "";
      requireTenantAccess(state, req, rec);
      const entries = listTenantFiles(rec.projectDir, rel);
      if (entries === null) throw new HttpError(404, "path not found or not allowed");
      return jsonResponse({ path: rel, entries });
    }

    const fileRoute = path.match(/^\/tenants\/([^/]+)\/file\/(.+)$/);
    if (req.method === "GET" && fileRoute) {
      const rec = state.registry.get(decodeURIComponent(fileRoute[1]));
      if (!rec) throw new HttpError(404, `tenant ${fileRoute[1]} not found`);
      const rel = decodeURIComponent(fileRoute[2]);
      requireTenantAccess(state, req, rec);
      const content = readTenantFile(rec.projectDir, rel);
      if (content === null) throw new HttpError(404, "file not found or not allowed");
      if ("tooLarge" in content) throw new HttpError(413, "file exceeds the 256KB preview cap");
      return jsonResponse({ path: rel, content: content.content });
    }

    const historyRoute = path.match(/^\/tenants\/([^/]+)\/history$/);
    if (req.method === "GET" && historyRoute) {
      const tenantId = decodeURIComponent(historyRoute[1]);
      const rec = state.registry.get(tenantId);
      if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
      requireTenantAccess(state, req, rec);
      return jsonResponse({ turns: state.turns.list(tenantId) });
    }

    // ── Wave B1: local accounts (PII-safe flow: login ID + email verification) ──
    if (req.method === "POST" && path === "/auth/signup") {
      if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many signup attempts — try later");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : loginId;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "valid email is required");
      if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");
      const result = await state.users.createPendingAccount({ loginId, email, password, name });
      if (!result.ok) {
        const messages: Record<string, string> = {
          login_taken: "this login ID is already taken",
          email_taken: "an account with this email already exists",
          invalid_login: "login ID must be 3-32 chars: a-z, 0-9, hyphen",
        };
        throw new HttpError(409, messages[result.reason] ?? "signup failed");
      }
      // Dev mailer: the verification mail is written to the outbox dir (ops forwards or reads
      // it); a real SMTP integration is operator-side. Token never appears in API responses.
      const outbox = join(state.cfg.dataDir, "mail-outbox");
      mkdirSync(outbox, { recursive: true });
      const verifyUrl = `${url.origin}/auth/verify?token=${result.verificationToken}`;
      writeFileSync(
        join(outbox, `${Date.now()}-${loginId}.txt`),
        `To: ${email}\nSubject: co-workspace account verification\n\nVerify your account (${loginId}):\n${verifyUrl}\n\nOr enter this key in the app: ${result.verificationToken}\n`,
      );
      return jsonResponse({
        ok: true,
        message: "verification mail sent — enter the key from the mail to activate the account",
      });
    }

    if (req.method === "POST" && path === "/auth/verify") {
      if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const loginId = state.users.verifyEmail(token);
      if (!loginId) throw new HttpError(400, "invalid or expired verification key");
      return jsonResponse({ ok: true, loginId, message: "account activated — sign in with your ID" });
    }

    if (req.method === "POST" && path === "/auth/email/change") {
      if (!state.sessionLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
      const user = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!user) throw new HttpError(401, "not signed in");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const result = state.users.createEmailChange(user.id, email);
      if (!result.ok) {
        const messages: Record<string, string> = {
          email_taken: "an account with this email already exists",
          unchanged: "this is already the email on your account",
          invalid_email: "valid email is required",
        };
        throw new HttpError(result.reason === "email_taken" ? 409 : 400, messages[result.reason]);
      }
      // Dev mailer (same as signup): the confirmation mail is written to the outbox dir.
      const outbox = join(state.cfg.dataDir, "mail-outbox");
      mkdirSync(outbox, { recursive: true });
      writeFileSync(
        join(outbox, `${Date.now()}-${user.principal}-email-change.txt`),
        `To: ${email}\nSubject: co-workspace email change\n\nConfirm the new email for ${user.principal}.\nEnter this key in the app: ${result.token}\n`,
      );
      return jsonResponse({ ok: true, message: "verification mail sent — enter the key from the mail to confirm the new email" });
    }

    if (req.method === "POST" && path === "/auth/email/verify") {
      const user = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!user) throw new HttpError(401, "not signed in");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const token = typeof body.token === "string" ? body.token.trim() : "";
      const result = state.users.verifyEmailChange(token);
      if (!result.ok) {
        throw new HttpError(result.reason === "email_taken" ? 409 : 400, result.reason === "email_taken" ? "an account with this email already exists" : "invalid or expired verification key");
      }
      state.audit.record(user.principal, "user.email-change");
      return jsonResponse({ ok: true, message: "email updated" });
    }

    if (req.method === "POST" && path === "/auth/resend") {
      if (!state.signupLimiter.allow(clientIp)) throw new HttpError(429, "too many attempts — try later");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const loginId = typeof body.loginId === "string" ? body.loginId.trim() : "";
      const reissued = state.users.reissueVerification(loginId);
      // Uniform response: a 404-vs-ok difference would let callers enumerate which login
      // IDs have pending verifications (and spam the outbox for existing ones).
      if (!reissued) return jsonResponse({ ok: true, message: "if the account is pending, a verification mail was sent" });
      const outbox = join(state.cfg.dataDir, "mail-outbox");
      mkdirSync(outbox, { recursive: true });
      writeFileSync(
        join(outbox, `${Date.now()}-${loginId}.txt`),
        `To: ${reissued.email}\nSubject: co-workspace account verification\n\nKey: ${reissued.token}\n`,
      );
      return jsonResponse({ ok: true, message: "verification mail re-sent" });
    }

    if (req.method === "POST" && path === "/auth/login") {
      if (!state.loginLimiter.allow(clientIp)) throw new HttpError(429, "too many login attempts — try later");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const loginId = typeof body.loginId === "string" ? body.loginId.trim() : typeof body.email === "string" ? body.email.split("@")[0] : "";
      const password = typeof body.password === "string" ? body.password : "";
      const user = await state.users.verifyLoginById(loginId, password);
      if (!user) {
        state.audit.record(loginId || clientIp, "login.failed");
        throw new HttpError(401, "invalid ID or password (or account not yet verified)");
      }
      if (state.users.tempPasswordExpired(user)) {
        state.audit.record(user.principal, "login.failed");
        throw new HttpError(403, "temporary password expired — ask your administrator for a new one");
      }
      state.audit.record(user.principal, "login.success");
      const token = state.users.createSession(user.id);
      return new Response(JSON.stringify({ user: { loginId: user.principal, name: user.name, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) } }), {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": sessionCookieHeader(token, state.cfg.cookieSecure ?? false) },
      });
    }

    if (req.method === "POST" && path === "/auth/logout") {
      state.users.destroySession(sessionTokenFromCookie(req));
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": clearCookieHeader() },
      });
    }

    if (req.method === "GET" && path === "/auth/me") {
      const user = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!user) throw new HttpError(401, "not signed in");
      const usage = principalTokenUsage(state, user.principal);
      return jsonResponse({
        user: { loginId: user.principal, name: user.name, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) },
        usage: { inputTokens: usage.input, outputTokens: usage.output, totalTokens: usage.input + usage.output },
        budget: state.cfg.principalMaxTokens > 0 ? { maxTokens: state.cfg.principalMaxTokens } : null,
      });
    }

    if (req.method === "PATCH" && path === "/auth/me") {
      const user = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!user) throw new HttpError(401, "not signed in");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const password = typeof body.password === "string" ? body.password : "";
      if (!password) throw new HttpError(400, "password is required");
      if (password.length < 8) throw new HttpError(400, "password must be at least 8 characters");
      if (user.mustChangePassword) {
        // R1 forced rotation: the temp credential was verified at sign-in; completing it
        // rotates sessions — the client signs in again with the new password.
        const updated = state.users.completeTempPasswordChange(user.id, password);
        if (!updated) throw new HttpError(404, "user not found");
        state.audit.record(updated.principal, "user.password.rotation");
        return jsonResponse({ ok: true, message: "password updated — sign in with your new password" });
      }
      // R3: a normal password change must present the current credential.
      const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
      if (!currentPassword || !(await Bun.password.verify(currentPassword, user.passwordHash ?? ""))) {
        throw new HttpError(403, "current password is incorrect");
      }
      const updated = state.users.changePassword(user.id, password, sessionTokenFromCookie(req));
      if (!updated) throw new HttpError(404, "user not found");
      state.audit.record(updated.principal, "user.password.change");
      return jsonResponse({ user: { loginId: updated.principal, name: updated.name, role: updated.role } });
    }

    // ── Wave B2: Google SSO ──
    if (req.method === "GET" && path === "/auth/google/login") {
      if (!googleConfigured()) throw new HttpError(501, "Google SSO not configured (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI)");
      const state = randomBytes(16).toString("hex");
      const { verifier, challenge } = makePkce();
      const url = authorizeUrl(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_REDIRECT_URI!, state, challenge);
      const flags = `HttpOnly; Path=/; SameSite=Lax; Max-Age=600`;
      return new Response(null, {
        status: 302,
        headers: {
          location: url,
          "set-cookie": [
            `gw_oauth_state=${state}; ${flags}`,
            `gw_oauth_verifier=${verifier}; ${flags}`,
          ].join(", "),
        },
      });
    }

    if (req.method === "GET" && path === "/auth/google/callback") {
      if (!googleConfigured()) throw new HttpError(501, "Google SSO not configured");
      const url = new URL(req.url);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const cookie = req.headers.get("cookie") ?? "";
      const expectedState = cookie.match(/gw_oauth_state=([^;]+)/)?.[1];
      const verifier = cookie.match(/gw_oauth_verifier=([^;]+)/)?.[1];
      if (!code || !returnedState || !expectedState || returnedState !== expectedState || !verifier) {
        throw new HttpError(400, "invalid OAuth state");
      }
      const accessToken = await exchangeCode(code, process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, process.env.GOOGLE_REDIRECT_URI!, verifier);
      const profile = await fetchProfile(accessToken);
      if (!profile.emailVerified) throw new HttpError(401, "Google email not verified");
      let user = state.users.findByGoogleSub(profile.sub) ?? state.users.findByEmail(profile.email);
      if (!user) {
        user = state.users.createUser({
          email: profile.email,
          name: profile.name,
          password: null,
          googleSub: profile.sub,
        });
        if (!user) throw new HttpError(500, "account creation failed");
      } else if (!user.googleSub) {
        state.users.linkGoogleSub(user.id, profile.sub);
      }
      const token = state.users.createSession(user.id);
      return new Response(null, {
        status: 302,
        headers: {
          location: "/",
          "set-cookie": [
            sessionCookieHeader(token, state.cfg.cookieSecure ?? false),
            "gw_oauth_state=; HttpOnly; Path=/; Max-Age=0",
            "gw_oauth_verifier=; HttpOnly; Path=/; Max-Age=0",
          ].join(", "),
        },
      });
    }

    // ── Wave B3: admin ──
    if (req.method === "GET" && path === "/admin/stats") {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      const tenants = state.registry.list();
      const turnCounts = state.turns.countsByTenant();
      const perUser = new Map<string, { principal: string; tenantCount: number; diskBytes: number; turns: number }>();
      for (const t of tenants) {
        const principal = t.ownerPrincipal ?? "anonymous";
        const entry = perUser.get(principal) ?? { principal, tenantCount: 0, diskBytes: 0, turns: 0 };
        entry.tenantCount += 1;
        entry.diskBytes += await cachedDirSize(t.tenantId, t.projectDir, t.hermesHome);
        entry.turns += turnCounts.get(t.tenantId) ?? 0;
        perUser.set(principal, entry);
      }
      const byVariant = new Map<string, number>();
      const byStatus = new Map<string, number>();
      for (const t of tenants) {
        byVariant.set(t.variant, (byVariant.get(t.variant) ?? 0) + 1);
        byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
      }
      const users = state.users.listUsers();
      const totals = state.turns.aggregate();
      return jsonResponse({
        users: { active: users.filter((u) => !u.deletedAt).length, deleted: users.filter((u) => u.deletedAt).length },
        tenants: Object.fromEntries(byStatus),
        diskBytes: [...perUser.values()].reduce((a, b) => a + b.diskBytes, 0),
        turns: { total: totals.totalTurns, inputTokens: totals.totalInputTokens, outputTokens: totals.totalOutputTokens },
        tenantsPerVariant: [...byVariant.entries()].map(([variant, count]) => ({ variant, count })),
        tenantsPerStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
        perUser: [...perUser.values()].sort((a, b) => b.diskBytes - a.diskBytes),
      });
    }

    if (req.method === "GET" && path === "/admin/users") {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      return jsonResponse({ users: state.users.listUsers().map((u) => ({
        id: u.id, loginId: u.principal, name: u.name, role: u.role,
        status: u.deletedAt ? "deleted" : state.users.isVerified(u.id) ? "active" : "pending",
        createdAt: u.createdAt,
      })) });
    }

    const resetRoute = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
    if (req.method === "POST" && resetRoute) {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      const target = state.users.findById(decodeURIComponent(resetRoute[1]));
      if (!target) throw new HttpError(404, "user not found");
      const tempPassword = state.users.createTempPassword(target.id);
      state.audit.record(caller.principal, "user.reset-password", target.principal);
      return jsonResponse({ tempPassword, note: "one-time temp password, 15-minute expiry; forced change at first sign-in" });
    }

    const renameRoute = path.match(/^\/admin\/users\/([^/]+)\/name$/);
    if (req.method === "PATCH" && renameRoute) {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      const target = state.users.findById(decodeURIComponent(renameRoute[1]));
      if (!target) throw new HttpError(404, "user not found");
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name || name.length > 80) throw new HttpError(400, "name must be 1-80 characters");
      const updated = state.users.renameUser(target.id, name);
      state.audit.record(caller.principal, "user.rename", target.principal, name);
      return jsonResponse({ user: { loginId: updated!.principal, name: updated!.name, role: updated!.role } });
    }

    const deleteRoute = path.match(/^\/admin\/users\/([^/]+)$/);
    if (req.method === "DELETE" && deleteRoute) {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      const targetId = decodeURIComponent(deleteRoute[1]);
      const target = state.users.findById(targetId);
      if (!target) throw new HttpError(404, "user not found");
      if (target.id === caller.id) throw new HttpError(400, "cannot delete yourself");
      const disposition = new URL(req.url).searchParams.get("tenants") === "delete" ? "delete" : "archive";
      let handled = 0;
      for (const t of state.registry.list()) {
        if ((t.ownerPrincipal ?? "anonymous") !== target.principal) continue;
        if (disposition === "delete") {
          const deleted = state.registry.delete(t.tenantId);
          if (deleted) {
            rmSync(deleted.projectDir, { recursive: true, force: true });
            rmSync(deleted.hermesHome, { recursive: true, force: true });
            // Same straggler sweep as the tenant DELETE route — the user-delete path
            // previously left the parent shell and any malformed siblings behind.
            const folder = resolve(deleted.projectDir, "..");
            const storageRoot = resolve(state.cfg.dataDir, "storage");
            if (folder.startsWith(storageRoot + sep)) {
              rmSync(folder, { recursive: true, force: true });
              sweepTenantStragglers(dirname(folder), deleted.tenantId, basename(folder));
            }
          }
        } else {
          t.status = "archived";
          state.registry.upsert(t);
        }
        handled += 1;
      }
      state.users.softDeleteUser(targetId);
      state.audit.record(caller.principal, "user.delete", target.principal, `disposition=${disposition} tenants=${handled}`);
      return jsonResponse({ deletedUser: target.principal, disposition, tenantsHandled: handled });
    }

    // QA-07: cancel a running turn (kills the child process; the turn settles as partial).
    const cancelRoute = path.match(/^\/tenants\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelRoute) {
      const tenantId = decodeURIComponent(cancelRoute[1]);
      const rec = state.registry.get(tenantId);
      if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
      requireTenantAccess(state, req, rec);
      const proc = state.activeProcs.get(tenantId);
      if (!proc) return jsonResponse({ cancelled: false, reason: "no active turn" });
      proc.kill(137);
      state.audit.record(callerPrincipal(state, req) ?? "anonymous", "turn.cancel", tenantId);
      return jsonResponse({ cancelled: true });
    }

    if (req.method === "GET" && path === "/admin/audit") {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      return jsonResponse({ entries: state.audit.list(200) });
    }

    // QA-12: admin outbox viewer — remote signups cannot read a server-local file.
    if (req.method === "GET" && path === "/admin/mail-outbox") {
      const caller = state.users.resolveSession(sessionTokenFromCookie(req));
      if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
      const dir = join(state.cfg.dataDir, "mail-outbox");
      const files: Array<{ file: string; content: string }> = [];
      if (existsSync(dir)) {
        for (const name of readdirSync(dir).sort().reverse().slice(0, 20)) {
          try {
            files.push({ file: name, content: readFileSync(join(dir, name), "utf8") });
          } catch {
            /* raced */
          }
        }
      }
      return jsonResponse({ outbox: files });
    }

    // Gemini wire (Antigravity/Gemini ecosystem). Model id travels in the URL path.
    const geminiCount = path.match(/^\/v1beta\/models\/[^/:]+:countTokens$/);
    if (req.method === "POST" && geminiCount) {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      return jsonResponse({ totalTokens: geminiEstimateTokens(JSON.stringify(body.contents ?? "")) });
    }

    const geminiModels = path.match(/^\/v1beta\/models$/);
    if (req.method === "GET" && geminiModels) {
      return jsonResponse({
        models: state.cfg.variants.map((v) => ({
          name: `models/${v}`,
          displayName: v,
          supportedGenerationMethods: ["generateContent", "streamGenerateContent", "countTokens"],
        })),
      });
    }

    const geminiAction = path.match(/^\/v1beta\/models\/([^/:]+):(generateContent|streamGenerateContent)$/);
    if (req.method === "POST" && geminiAction) {
      const model = decodeURIComponent(geminiAction[1]);
      if (!state.cfg.variants.includes(model)) {
        throw new HttpError(404, `unknown model: ${model}`);
      }
      const parsed = parseGeminiRequest(await readJsonBody(req));
      if (!parsed.ok) throw new HttpError(400, parsed.error);
      const { rec, promise } = getOrStartTenant(state, model, parsed.req.user);
      if (promise) await promise;
      const ready = await ensureReady(state, rec);
      assertQuota(state.cfg, ready);
      assertPrincipalQuota(state, ready.ownerPrincipal ?? "anonymous");
      return await geminiChatResponse(state, ready, parsed.req.message, geminiAction[2] === "streamGenerateContent");
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
  bootstrapAdminFromEnv(state);
  // SEC-14: expire verification mails older than 24h at startup.
  const swept = sweepOutbox(state.cfg.dataDir);
  if (swept) console.log(`[co-workspace] outbox sweep: ${swept} expired file(s) removed`);
  // P2-5: a restart orphans in-flight "provisioning" records (the promise map is memory-only).
  for (const t of state.registry.list()) {
    if (t.status === "provisioning") {
      t.status = "failed";
      t.error = "interrupted by server restart — create a new session";
      state.registry.upsert(t);
    }
  }
  if (state.cfg.isolation === "docker") {
    const probe = dockerProbe(state.cfg.dockerBin);
    if (!probe.ok) {
      console.error(`[co-workspace] docker isolation unusable: ${probe.error ?? "probe failed"}`);
      process.exit(1);
    }
    if (state.cfg.isolation === "docker" && state.cfg.runtime !== "hermes") {
      console.error(`[co-workspace] docker isolation requires runtime hermes (got ${state.cfg.runtime})`);
      process.exit(1);
    }
    console.log(`[co-workspace] docker isolation: server ${probe.version}`);
  }
  const server = createServer(state);
  console.log(`[co-workspace] listening on http://${state.cfg.host}:${server.port}`);
  console.log(`[co-workspace] variants: ${state.cfg.variants.join(", ")}`);
  console.log(`[co-workspace] data dir: ${state.cfg.dataDir}`);
  console.log(`[co-workspace] workspace: ${state.cfg.workspaceDir}`);
}
