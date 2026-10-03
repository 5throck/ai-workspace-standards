/** Unit tests for the Team Gateway Antigravity runtime adapter (agy headless print mode).
 * Event shapes captured live from `agy -p --output-format stream-json` (2026-09-27). */

import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agyArgs, parseAgyLine } from "../../services/co-workspace/src/antigravity";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState } from "../../services/co-workspace/src/server";

describe("parseAgyLine — agy stream-json normalization", () => {
  test("init event normalizes to system/init with the conversation id", () => {
    const evt = parseAgyLine(
      '{"event":"init","conversation_id":"conv-1","init":{"cwd":"/x","tools":[],"permission_mode":"request-review"}}',
    );
    expect(evt?.type).toBe("system");
    expect((evt as any).session_id).toBe("conv-1");
  });

  test("agent_response deltas normalize to text events; other steps are passthrough", () => {
    const delta = parseAgyLine(
      '{"event":"step_update","step_update":{"step_index":1,"state":"ACTIVE","step_type":"agent_response","text_delta":"OK"}}',
    );
    expect(delta).toEqual({ type: "text", text: "OK", raw: expect.any(Object) });
    const userStep = parseAgyLine(
      '{"event":"step_update","step_update":{"step_index":0,"state":"DONE","step_type":"user_input"}}',
    );
    expect(userStep?.type).toBe("agy_step");
  });

  test("result event maps status/usage onto the shared shape", () => {
    const evt = parseAgyLine(
      '{"event":"result","result":{"conversation_id":"conv-1","status":"SUCCESS","response":"OK\\n","num_turns":1,"usage":{"input_tokens":13,"output_tokens":2,"total_tokens":15}}}',
    );
    expect(evt?.type).toBe("result");
    expect((evt as any).session_id).toBe("conv-1");
    expect((evt as any).exit_code).toBe(0);
    expect((evt as any).tokens).toEqual({ input: 13, output: 2, total: 15 });
  });

  test("non-JSON lines surface as raw without aborting", () => {
    expect(parseAgyLine("not json")).toEqual({ type: "raw", line: "not json" });
    expect(parseAgyLine("")).toBeNull();
  });
});

describe("agyArgs — headless invocation and explicit continuity", () => {
  const base = {
    agyBin: "agy",
    projectDir: "/data/tenants/gw-a/project",
    message: "hi",
    printTimeoutSeconds: 300,
  };

  test("builds the print-mode command with stream-json and ceilings", () => {
    const args = agyArgs(base);
    expect(args.slice(0, 3)).toEqual(["agy", "-p", "hi"]);
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args[args.indexOf("--print-timeout") + 1]).toBe("300s");
    expect(args).not.toContain("--conversation");
  });

  test("conversation id adds --conversation for explicit continuity", () => {
    const args = agyArgs({ ...base, conversationId: "conv-9" });
    expect(args[args.indexOf("--conversation") + 1]).toBe("conv-9");
  });
});

describe("gateway server — antigravity runtime end to end (fake agy binary)", () => {
  const dataDir = join(tmpdir(), `gw-agy-${crypto.randomUUID().slice(0, 8)}`);
  const workspaceDir = join(tmpdir(), `gw-agy-ws-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake\\n");
`,
  );
  const binDir = join(tmpdir(), `gw-agy-bin-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(binDir, { recursive: true });
  const agyBin = join(binDir, "fake-agy.ts");
  writeFileSync(
    agyBin,
    // T-20260929-001: portable fake binary — bun runs the .ts directly on every OS
    // (Windows Bun.spawn cannot exec shebang scripts); prefix support mirrors hermes.
    `import { appendFileSync } from "node:fs";
const argv = process.argv.slice(2);
if (process.env.HERMES_FAKE_LOG) appendFileSync(process.env.HERMES_FAKE_LOG, argv.join(" ") + "\\n");
await Bun.stdin.text();
console.log('{"event":"init","conversation_id":"conv-agy","init":{"cwd":"."}}')
console.log('{"event":"step_update","step_update":{"step_index":1,"state":"ACTIVE","step_type":"agent_response","text_delta":"Hello from fake agy"}}')
console.log('{"event":"result","result":{"conversation_id":"conv-agy","status":"SUCCESS","response":"Hello from fake agy","num_turns":1,"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}}')
`,
  );
  chmodSync(agyBin, 0o755);

  process.env.HERMES_FAKE_LOG = join(dataDir, "agy-args.log");
  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
    CO_WORKSPACE_VARIANTS: "co-consult",
    CO_WORKSPACE_RUNTIME: "antigravity",
    // Anonymous /sessions provisioning flow — opt into the 2026-10-02 gate design's knob.
    CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
    CO_WORKSPACE_TENANT_MAX_TURNS: "100",
    CO_WORKSPACE_TENANT_MAX_TOKENS: "100000",
    CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "200000",
    CO_WORKSPACE_ANTIGRAVITY_BIN: agyBin,
    CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX: "bun", // T-20260929-001: portable fake runs via bun
    HERMES_FAKE_LOG: join(dataDir, "agy-args.log"),
  });
  const server = createServer(createState(cfg));
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  test("native chat runs the antigravity runtime and records the conversation", async () => {
    const provision = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    const { tenantId } = await provision.json();
    const deadline = Date.now() + 10_000;
    let status = "provisioning";
    while (Date.now() < deadline) {
      status = (await (await fetch(`${base}/tenants/${tenantId}`)).json()).status;
      if (status !== "provisioning") break;
      await Bun.sleep(50);
    }
    expect(status).toBe("ready");

    const res = await fetch(`${base}/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello" }),
    });
    // SSE comments (": …" progress frames, T-20260930-010) are not data events.
    const events = (await res.text())
      .split("\n\n")
      .filter((f) => f.startsWith("data: "))
      .map((f) => JSON.parse(f.replace(/^data: /, "")));
    const done = events.find((e) => e.type === "done");
    expect(done.finalText).toBe("Hello from fake agy");
    expect(done.usage.totalTokens).toBe(8);
    const detail = (await (await fetch(`${base}/tenants/${tenantId}`)).json()) as any;
    expect(detail.sessions).toBe(1);
    expect(readFileSync(join(dataDir, "agy-args.log"), "utf8").trim().split("\n")).toHaveLength(1);
  });

  test("second turn resumes the same conversation explicitly", async () => {
    const tenants = (await (await fetch(`${base}/tenants`)).json()).tenants;
    const tenantId = tenants[0].tenantId;
    // Drain the stream: the turn is only guaranteed complete once the body ends.
    const res = await fetch(`${base}/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "again" }),
    });
    await res.text();
    const log = readFileSync(join(dataDir, "agy-args.log"), "utf8").trim().split("\n");
    expect(log).toHaveLength(2);
    expect(log[1]).toContain("--conversation");
    expect(log[1]).toContain("conv-agy");
  });
});
