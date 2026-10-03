/**
 * T-20260930-010 + T-20260930-011: perceived-latency SSE quick win and per-stage turn
 * timing. Fake Hermes emits system → tool_use → tool_result → text → result so the test
 * can assert the immediate ": thinking…" frame, the tool/system progress comments on a
 * surface that forwards only text (OpenAI), and the [turn-timing] stage log lines.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openaiChatResponse, createState } from "../../services/co-workspace/src/server";
import { loadConfig } from "../../services/co-workspace/src/config";
import { turnProgressComment } from "../../services/co-workspace/src/sse";
import { TurnTiming, turnLogKey } from "../../services/co-workspace/src/timing";

function tempDir(): string {
  return join(tmpdir(), `co-workspace-latency-${crypto.randomUUID().slice(0, 8)}`);
}

const FAKE_SCAFFOLD = `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
mkdirSync(\`Projects/\${name}/docs\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
writeFileSync(\`Projects/\${name}/package.json\`, "{}\\n");
`;

// Emits one of every progress-worthy event class before the text answer.
const FAKE_HERMES = `const prompt = await Bun.stdin.text();
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-1","timestamp":1}');
console.log('{"type":"tool_use","name":"read_file","tool_call_id":"t1","timestamp":2}');
console.log('{"type":"tool_result","name":"read_file","output":"ok","duration_ms":12,"is_error":false,"timestamp":3}');
console.log('{"type":"text","text":"answer","timestamp":4}');
console.log('{"type":"result","session_id":"sess-1","exit_code":0,"text":"answer","tokens":{"input":11,"output":7,"total":18,"cached_tokens":4},"duration_ms":9,"timestamp":5}');
`;

const dataDir = tempDir();
const workspaceDir = tempDir();
const seedHome = tempDir();
const binDir = tempDir();
mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
mkdirSync(seedHome, { recursive: true });
mkdirSync(binDir, { recursive: true });
writeFileSync(join(workspaceDir, "scripts", "new-project.ts"), FAKE_SCAFFOLD);
writeFileSync(join(binDir, "fake-hermes.ts"), FAKE_HERMES);
writeFileSync(join(seedHome, "auth.json"), '{"seeded":true}');

const cfg = loadConfig({
  CO_WORKSPACE_HOST: "127.0.0.1",
  CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  CO_WORKSPACE_DATA_DIR: dataDir,
  CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
  CO_WORKSPACE_VARIANTS: "co-consult",
  // Anonymous provisioning progress timing is the subject here — opt into the
  // 2026-10-02 gate design's knob so the gate stays out of the way.
  CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
  CO_WORKSPACE_TENANT_MAX_TURNS: "100",
  CO_WORKSPACE_TENANT_MAX_TOKENS: "100000",
  CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "200000",
  HERMES_BIN: join(binDir, "fake-hermes.ts"),
  HERMES_BIN_PREFIX: "bun",
  CO_WORKSPACE_HERMES_SEED_HOME: seedHome,
});
const state = createState(cfg);

async function waitFor(desc: string, probe: () => boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (probe()) return;
    await Bun.sleep(30);
  }
  throw new Error(`timeout waiting for: ${desc}`);
}

afterAll(() => {
  // nothing to stop — the response builders run without the listener server
});

describe("perceived-latency SSE quick win (T-20260930-010)", () => {
  test("turnProgressComment maps tool/system events, ignores text/result", () => {
    expect(turnProgressComment({ type: "tool_use", name: "read_file" })).toBe(": tool: read_file…\n\n");
    expect(turnProgressComment({ type: "tool_result", name: "read_file", duration_ms: 12 })).toBe(
      ": tool: read_file done (12ms)\n\n",
    );
    expect(turnProgressComment({ type: "tool_result", name: "web" })).toBe(": tool: web done\n\n");
    expect(turnProgressComment({ type: "system", subtype: "init" })).toBe(": turn: runtime ready\n\n");
    expect(turnProgressComment({ type: "text", text: "hi" })).toBeNull();
    expect(turnProgressComment({ type: "result", exit_code: 0 })).toBeNull();
    expect(turnProgressComment({ type: "tool_use" })).toBeNull();
  });

  test("OpenAI stream opens with : thinking and surfaces tool progress as comments", async () => {
    // Provision a tenant through the state API directly (same path as POST /sessions).
    const rec = state.registry.create({
      dataDir: cfg.dataDir,
      variant: "co-consult",
      key: `co-consult:test-${crypto.randomUUID().slice(0, 6)}`,
      ownerPrincipal: "anonymous",
    });
    state.audit.record("anonymous", "tenant.create", rec.tenantId, "co-consult");
    const { startProvisioning } = await import("../../services/co-workspace/src/lifecycle");
    startProvisioning(state, state.registry.get(rec.tenantId)!);
    await waitFor("tenant ready", () => state.registry.get(rec.tenantId)?.status === "ready");
    const tenant = state.registry.get(rec.tenantId)!;

    const body = await openaiChatResponse(state, tenant, "hello", true);
    // The timing log runs alongside the stream; capture it to assert the full stage
    // set and the cache-field pass-through land on one joined turn key.
    const timingLines: string[] = [];
    const origLog = console.log;
    console.log = (line: string) => timingLines.push(String(line));
    let text: string;
    try {
      text = await body.text();
    } finally {
      console.log = origLog;
    }
    const frames = text.split("\n\n").filter(Boolean);
    expect(frames[0]).toBe(": thinking…");
    expect(text).toContain(": turn: runtime ready");
    expect(text).toContain(": tool: read_file…");
    expect(text).toContain(": tool: read_file done (12ms)");
    // role chunk still precedes the first content chunk; stream still terminates properly
    const roleIdx = text.indexOf('"role":"assistant"');
    const contentIdx = text.indexOf('"content":"answer"');
    expect(roleIdx).toBeGreaterThan(-1);
    expect(contentIdx).toBeGreaterThan(roleIdx);
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
    // T-20260930-011: chat + hermes stages share the deterministic turn key, and the
    // provider cache field survives into the turn_done summary line.
    const stages = timingLines
      .filter((l) => l.startsWith("[turn-timing] "))
      .map((l) => JSON.parse(l.slice("[turn-timing] ".length)));
    const keys = new Set(stages.map((s) => s.turn));
    expect(keys.size).toBe(1);
    expect(keys.has(turnLogKey(tenant.tenantId))).toBe(true);
    const stageNames = stages.map((s) => s.stage);
    // t0 fires at stream start, before the console spy is installed — not observable here.
    for (const expected of ["t_lock", "t_stamp", "t_spawn", "t_first_byte", "t_system", "t_first_text", "t_result", "t_exit", "turn_summary", "turn_done"]) {
      expect(stageNames).toContain(expected);
    }
    expect(JSON.stringify(stages)).toContain('"cached_tokens":4');
  }, 20_000);
});

describe("per-stage turn timing (T-20260930-011)", () => {
  test("TurnTiming emits structured stage lines and turnLogKey is deterministic", () => {
    expect(turnLogKey("gw-abc_1")).toBe("co-workspace-turn-gw-abc_1");
    expect(turnLogKey("gw-a/b@c")).toBe("co-workspace-turn-gw-a-b-c");
    const seen: string[] = [];
    const orig = console.log;
    console.log = (line: string) => seen.push(String(line));
    try {
      const t = new TurnTiming("co-workspace-turn-test");
      t.mark("t0", { tenant: "t" });
      t.mark("t_first_text");
    } finally {
      console.log = orig;
    }
    expect(seen).toHaveLength(2);
    const first = JSON.parse(seen[0].replace("[turn-timing] ", ""));
    expect(first.turn).toBe("co-workspace-turn-test");
    expect(first.stage).toBe("t0");
    expect(first.ms_total).toBeTypeOf("number");
    const second = JSON.parse(seen[1].replace("[turn-timing] ", ""));
    expect(second.stage).toBe("t_first_text");
    expect(second.ms_stage).toBeTypeOf("number");
  });
});
