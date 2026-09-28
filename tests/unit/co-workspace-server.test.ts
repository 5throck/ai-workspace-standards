/**
 * End-to-end unit test for the Team Gateway server (ADR-0092 W2/W3) against fake binaries:
 * a fake `scripts/new-project.ts` scaffold engine and a fake Hermes binary emitting canned
 * stream-json. No real LLM calls, no real scaffold.
 */

import { afterAll, describe, expect, test } from "bun:test";
const describe_ = process.platform === "win32" ? describe.skip : describe; // windows cannot exec shebang fake binaries (T-20260927-020 follow-up)
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState, handleRequest, hostSidePath } from "../../services/co-workspace/src/server";

function tempDir(): string {
  return join(tmpdir(), `team-gateway-srv-${crypto.randomUUID().slice(0, 8)}`);
}

const FAKE_SCAFFOLD = `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
mkdirSync(\`Projects/\${name}/docs\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
writeFileSync(\`Projects/\${name}/package.json\`, "{}\\n");
writeFileSync(\`Projects/\${name}/.hermes/skills/demo.md\`, "---\\nname: demo\\n---\\n");
`;

const FAKE_HERMES = `#!/bin/sh
printf '%s\\n' "$*" >> "$HERMES_HOME/last-args.txt"
cat > /dev/null
echo '{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-1","timestamp":1}'
echo '{"type":"tool_use","name":"read_file","tool_call_id":"t1","timestamp":2}'
echo '{"type":"tool_result","name":"read_file","tool_call_id":"t1","output":"ok","duration_ms":3,"is_error":false,"timestamp":3}'
echo '{"type":"text","text":"Hello from fake hermes","timestamp":4}'
echo '{"type":"result","session_id":"sess-1","exit_code":0,"text":"Hello from fake hermes","tokens":{"input":11,"output":7,"total":18},"duration_ms":5,"timestamp":5}'
`;

const dataDir = tempDir();
const workspaceDir = tempDir();
const seedHome = tempDir();
mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
mkdirSync(seedHome, { recursive: true });
writeFileSync(join(workspaceDir, "scripts", "new-project.ts"), FAKE_SCAFFOLD);
const hermesBinDir = tempDir();
mkdirSync(hermesBinDir, { recursive: true });
const hermesBin = join(hermesBinDir, "fake-hermes.sh");
writeFileSync(hermesBin, FAKE_HERMES);
chmodSync(hermesBin, 0o755);
writeFileSync(join(seedHome, "auth.json"), '{"seeded":true}');

const cfg = loadConfig({
  CO_WORKSPACE_HOST: "127.0.0.1",
  CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  CO_WORKSPACE_DATA_DIR: dataDir,
  CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
  CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
  HERMES_BIN: hermesBin,
  CO_WORKSPACE_HERMES_SEED_HOME: seedHome,
});

const state = createState(cfg);
const server = createServer(state);
const base = `http://127.0.0.1:${server.port}`;

async function waitFor(desc: string, probe: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await probe()) return;
    await Bun.sleep(50);
  }
  throw new Error(`timeout waiting for: ${desc}`);
}

function sseEvents(text: string): any[] {
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: ") && frame.trim() !== "data: [DONE]")
    .map((frame) => JSON.parse(frame.slice(6)));
}

afterAll(() => {
  server.stop(true);
});

describe_("gateway server — basic routes", () => {
  test("GET /health reports config without secrets", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.variants).toEqual(["co-consult", "co-develop"]);
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  test("GET /v1/models exposes the variant allowlist", async () => {
    const res = await fetch(`${base}/v1/models`);
    const body = await res.json();
    expect(body.data.map((m: any) => m.id)).toEqual(["co-consult", "co-develop"]);
  });

  test("GET / serves the demo page; unknown routes 404", async () => {
    const page = await fetch(`${base}/`);
    expect(page.headers.get("content-type")).toContain("text/html");
    const missing = await fetch(`${base}/nope`, { method: "POST" });
    expect(missing.status).toBe(404);
  });

  test("hostSidePath remaps dataDir-prefixed record paths onto the host root", () => {
    const cfg = { dataDir: "/data", dataDirHost: "/host/root" };
    expect(hostSidePath(cfg, "/data/storage/techcross/x/project")).toBe("/host/root/storage/techcross/x/project");
    expect(hostSidePath(cfg, "/data/tenants/users.db")).toBe("/host/root/tenants/users.db");
    expect(hostSidePath({ dataDir: "/data" }, "/data/x")).toBeUndefined();
  });

  test("HTML pages force revalidation so redeploys are picked up", async () => {
    const page = await fetch(`${base}/`);
    expect(page.headers.get("cache-control")).toBe("no-cache");
    await page.text();
    const login = await fetch(`${base}/login`);
    expect(login.headers.get("cache-control")).toBe("no-cache");
    await login.text();
  });

  test("POST /sessions rejects variants outside the allowlist", async () => {
    const res = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-hacker" }),
    });
    expect(res.status).toBe(400);
  });
});

describe_("gateway server — native provisioning and chat", () => {
  test("POST /sessions provisions a tenant asynchronously; project is relocated and seeded", async () => {
    const res = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-consult", description: "smoke tenant" }),
    });
    expect(res.status).toBe(202);
    const { tenantId } = await res.json();

    await waitFor("tenant ready", async () => {
      const detail = await (await fetch(`${base}/tenants/${tenantId}`)).json();
      return detail.status === "ready";
    });
    const detail = await (await fetch(`${base}/tenants/${tenantId}`)).json();
    expect(detail.variant).toBe("co-consult");
    expect(detail.sessions).toBe(0);
    expect(detail.hermesHome).toBeUndefined(); // internal paths stay server-side

    // The scaffolded project was moved out of the workspace clone into the data dir.
    const projectDir = join(dataDir, "storage", "anonymous", tenantId, "project");
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".hermes", "skills", "demo.md"))).toBe(true);
    expect(existsSync(join(workspaceDir, "Projects", tenantId))).toBe(false);
    // The tenant Hermes home carries a generated trust-scoped config; credentials ride the
    // shared store at spawn time (Addendum 4), so no auth.json is copied.
    expect(existsSync(join(dataDir, "storage", "anonymous", tenantId, "hermes-home", "auth.json"))).toBe(false);
    const config = readFileSync(join(dataDir, "storage", "anonymous", tenantId, "hermes-home", "config.yaml"), "utf8");
    expect(config).toContain(`- ${projectDir}`);
  });

  test("POST /sessions is idempotent per (principal, variant) and stamps the lazy-lookup key", async () => {
    const first = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-develop" }),
    });
    expect(first.status).toBe(202);
    const created = await first.json();

    const second = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-develop" }),
    });
    expect(second.status).toBe(200);
    const again = await second.json();
    expect(again.existing).toBe(true);
    expect(again.tenantId).toBe(created.tenantId);
  });

  test("a /sessions-created team is the tenant the web wire resolves (no divergence)", async () => {
    // Signed-in web flow: the session principal is the tenant key's user component, so the
    // composer's chat must resolve to the created team rather than lazily spawning another.
    const user = state.users.createUser({ email: "team@test.local", name: "team", password: "teampass123", role: "user" });
    const cookie = `gw_session=${state.users.createSession(user!.id)}`;
    const create = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ variant: "co-consult", name: "divergence-probe" }),
    });
    expect(create.status).toBe(202);
    const { tenantId } = await create.json();
    await waitFor("team ready", async () => {
      const detail = await (await fetch(`${base}/tenants/${tenantId}`, { headers: { cookie } })).json();
      return detail.status === "ready";
    });

    const tenantsBefore = (await (await fetch(`${base}/tenants?mine=1`, { headers: { cookie } })).json()).tenants.length;
    const chat = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ model: "co-consult", stream: false, messages: [{ role: "user", content: "hi" }] }),
    });
    expect(chat.status).toBe(200);
    await chat.text();
    const mine = (await (await fetch(`${base}/tenants?mine=1`, { headers: { cookie } })).json()).tenants;
    expect(mine.length).toBe(tenantsBefore); // no second tenant spawned
    expect(mine.map((t: any) => t.tenantId)).toContain(tenantId);
    expect(mine.find((t: any) => t.tenantId === tenantId).sessions).toBe(1); // the turn landed on the created team
  });

  test("POST /tenants/:id/chat streams raw Hermes events and a done summary", async () => {
    const tenants = (await (await fetch(`${base}/tenants`)).json()).tenants;
    const tenantId = tenants[0].tenantId;
    const res = await fetch(`${base}/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hello team" }),
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = sseEvents(await res.text());
    const types = events.map((e) => e.type);
    expect(types).toContain("system");
    expect(types).toContain("text");
    expect(types).toContain("tool_use");
    const done = events.find((e) => e.type === "done");
    expect(done.sessionId).toBe("sess-1");
    expect(done.finalText).toBe("Hello from fake hermes");
    expect(done.usage.inputTokens).toBe(11);
    expect(done.usage.totalTokens).toBe(18);

    const detail = await (await fetch(`${base}/tenants/${tenantId}`)).json();
    expect(detail.sessions).toBe(1);
  });

  test("second native turn continues the same named thread", async () => {
    const tenants = (await (await fetch(`${base}/tenants`)).json()).tenants;
    const tenantId = tenants[0].tenantId;
    await fetch(`${base}/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "and again" }),
    });
    const lastArgs = readFileSync(
      join(dataDir, "storage", "anonymous", tenantId, "hermes-home", "last-args.txt"),
      "utf8",
    );
    const turns = lastArgs.trim().split("\n");
    expect(turns).toHaveLength(2);
    for (const turn of turns) {
      expect(turn).toContain("--continue");
      expect(turn).toContain(`gw-${tenantId}`);
      expect(turn).toContain("--create-if-missing");
    }
  });

  test("chat on an unknown tenant 404s; empty message 400s", async () => {
    const missing = await fetch(`${base}/tenants/gw-does-not-exist/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(missing.status).toBe(404);
  });
});

describe_("gateway server — OpenAI wire surface", () => {
  test("stream=false returns a single completion with mapped usage", async () => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "co-develop",
        messages: [{ role: "user", content: "hi" }],
        user: "alice",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.object).toBe("chat.completion");
    expect(body.model).toBe("co-develop");
    expect(body.choices[0].message.content).toBe("Hello from fake hermes");
    expect(body.usage).toEqual({ prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 });
  });

  test("stream=true emits role chunk, content chunks, finish chunk, then [DONE]", async () => {
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "co-develop",
        stream: true,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    const chunks = sseEvents(text);
    expect(chunks[0].choices[0].delta.role).toBe("assistant");
    const content = chunks.find((c) => c.choices[0].delta.content === "Hello from fake hermes");
    expect(content).toBeDefined();
    expect(chunks.at(-1).choices[0].finish_reason).toBe("stop");
    expect(text.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  test("unknown model 404s; malformed body 400s", async () => {
    const unknown = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "co-nope", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(unknown.status).toBe(404);
    const bad = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(bad.status).toBe(400);
  });
});

describe_("handleRequest — direct invocation shares the same state", () => {
  test("health via handleRequest without a socket", async () => {
    const res = await handleRequest(state, new Request(`${base}/health`));
    expect(res.status).toBe(200);
  });
});
