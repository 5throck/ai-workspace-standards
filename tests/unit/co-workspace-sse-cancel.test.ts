/**
 * T-20260929-008 (H3 + H4): a client disconnect on any streaming surface kills the running
 * turn (no orphaned Hermes holding the chat lock), never surfaces an unhandled rejection, and
 * the provisioning-progress interval is always cleared. Fake Hermes emits one text event, then
 * sleeps so the test can cancel mid-turn.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState, openaiChatResponse } from "../../services/co-workspace/src/server";

function tempDir(): string {
  return join(tmpdir(), `co-workspace-sse-${crypto.randomUUID().slice(0, 8)}`);
}

const FAKE_SCAFFOLD = `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
mkdirSync(\`Projects/\${name}/docs\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
writeFileSync(\`Projects/\${name}/package.json\`, "{}\\n");
`;

// Sleeps only when the prompt contains SLOW; otherwise finishes immediately.
const FAKE_HERMES = `const prompt = await Bun.stdin.text();
const argv = process.argv.join(" ");
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-1","timestamp":1}');
console.log('{"type":"text","text":"partial","timestamp":2}');
if ((prompt + argv).includes("SLOW")) await Bun.sleep(60000);
console.log('{"type":"result","session_id":"sess-1","exit_code":0,"text":"partial","tokens":{"input":1,"output":1,"total":2},"duration_ms":5,"timestamp":3}');
`;

const dataDir = tempDir();
const workspaceDir = tempDir();
const seedHome = tempDir();
const binDir = tempDir();
mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
mkdirSync(seedHome, { recursive: true });
mkdirSync(binDir, { recursive: true });
writeFileSync(join(workspaceDir, "scripts", "new-project.ts"), FAKE_SCAFFOLD);
const hermesBin = join(binDir, "fake-hermes.ts");
writeFileSync(hermesBin, FAKE_HERMES);
writeFileSync(join(seedHome, "auth.json"), '{"seeded":true}');

const cfg = loadConfig({
  CO_WORKSPACE_HOST: "127.0.0.1",
  CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  CO_WORKSPACE_DATA_DIR: dataDir,
  CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
  CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
  // Anonymous chat flows exercise cancel semantics, not auth — opt into the
  // 2026-10-02 gate design's provisioning knob so the gate stays out of the way.
  CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
  HERMES_BIN: hermesBin,
  HERMES_BIN_PREFIX: "bun",
  CO_WORKSPACE_HERMES_SEED_HOME: seedHome,
});
const state = createState(cfg);
const server = createServer(state);
const base = `http://127.0.0.1:${server.port}`;

const rejections: unknown[] = [];
const onRejection = (e: unknown) => rejections.push(e);
process.on("unhandledRejection", onRejection);
afterAll(() => {
  process.off("unhandledRejection", onRejection);
  server.stop(true);
});

async function waitFor(desc: string, probe: () => boolean | Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await Bun.sleep(30);
  }
  throw new Error(`timeout waiting for: ${desc}`);
}

async function readyTenant(): Promise<string> {
  const res = await fetch(`${base}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ variant: "co-consult", description: "cancel test" }),
  });
  const { tenantId } = await res.json();
  await waitFor("tenant ready", async () => (await (await fetch(`${base}/tenants/${tenantId}`)).json()).status === "ready");
  return tenantId;
}

/** Start a SLOW streaming request, read until the first chunk, cancel the body, then assert
 * the turn was killed, the lock freed, and nothing rejected. Only one turn is ever active. */
async function cancelMidTurn(req: () => Promise<Response>): Promise<void> {
  const res = await req();
  const reader = res.body!.getReader();
  await waitFor("turn spawned", () => state.activeProcs.size === 1);
  const tenantId = [...state.activeProcs.keys()][0];
  await reader.read(); // at least one frame
  await reader.cancel();
  await waitFor("process killed + entry removed", () => !state.activeProcs.has(tenantId));
  await waitFor("chat lock freed", () => !state.chatLocks.has(tenantId));
  await Bun.sleep(100);
  expect(rejections).toEqual([]);
}

// provisioning a tenant + spawning bun can exceed the 5s default on a loaded machine
const T = 30_000;
const json = { "content-type": "application/json" };

describe("SSE client disconnect cancels the turn (H3)", () => {
  test("native chat", async () => {
    const tenantId = await readyTenant();
    await cancelMidTurn(
      () => fetch(`${base}/tenants/${tenantId}/chat`, { method: "POST", headers: json, body: JSON.stringify({ message: "SLOW" }) })
    );
    // a following request is not blocked behind the killed turn
    const next = await fetch(`${base}/tenants/${tenantId}/chat`, { method: "POST", headers: json, body: JSON.stringify({ message: "quick" }) });
    const text = await next.text();
    expect(text).toContain('"type":"done"');
  }, T);

  test("OpenAI chat/completions", async () => {
    await cancelMidTurn(
      () => fetch(`${base}/v1/chat/completions`, { method: "POST", headers: json, body: JSON.stringify({ model: "co-develop", stream: true, user: "u1", messages: [{ role: "user", content: "SLOW" }] }) })
    );
  }, T);

  test("Anthropic messages", async () => {
    await cancelMidTurn(
      () => fetch(`${base}/v1/messages`, { method: "POST", headers: json, body: JSON.stringify({ model: "co-consult", max_tokens: 64, stream: true, messages: [{ role: "user", content: "SLOW" }] }) })
    );
  }, T);

  test("Gemini streamGenerateContent", async () => {
    // co-consult tenant already exists for the anonymous principal (Anthropic test) — reuse it.
    await cancelMidTurn(
      () => fetch(`${base}/v1beta/models/co-consult:streamGenerateContent?alt=sse`, { method: "POST", headers: json, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "SLOW" }] }] }) })
    );
  }, T);

  test("normal (uncancelled) OpenAI stream output is unchanged", async () => {
    const res = await fetch(`${base}/v1/chat/completions`, { method: "POST", headers: json, body: JSON.stringify({ model: "co-develop", stream: true, messages: [{ role: "user", content: "hi" }] }) });
    const text = await res.text();
    expect(text).toContain('"delta":{"role":"assistant"}');
    expect(text).toContain('"content":"partial"');
    expect(text).toContain('"finish_reason":"stop"');
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
    expect(rejections).toEqual([]);
  }, T);
});

describe("provisioning progress interval (H4)", () => {
  test("interval is cleared when provisioning rejects", async () => {
    const realSet = globalThis.setInterval;
    const realClear = globalThis.clearInterval;
    const live = new Set<unknown>();
    globalThis.setInterval = ((fn: any, ms?: number, ...a: any[]) => {
      const t = realSet(fn, ms, ...a);
      live.add(t);
      return t;
    }) as typeof setInterval;
    globalThis.clearInterval = ((t: any) => {
      live.delete(t);
      return realClear(t);
    }) as typeof clearInterval;
    try {
      const tenantId = await readyTenant();
      const rec = state.registry.get(tenantId)!;
      const failing = new Promise<void>((_, reject) => setTimeout(() => reject(new Error("provision boom")), 50));
      const res = await openaiChatResponse(state, rec, "hi", true, failing);
      const text = await res.text();
      expect(text).toContain("provision boom");
      expect(live.size).toBe(0);
      expect(rejections).toEqual([]);
    } finally {
      globalThis.setInterval = realSet;
      globalThis.clearInterval = realClear;
    }
  }, T);
});
