/** T-20260929-004: lazy-tenant routes key on the authenticated principal, never the body user. */

import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState, tenantKeyFor } from "../../services/co-workspace/src/server";

const id = () => crypto.randomUUID().slice(0, 8);
const dataDir = join(tmpdir(), `co-workspace-iso-${id()}`);
const workspaceDir = join(tmpdir(), `co-workspace-iso-ws-${id()}`);
const binDir = join(tmpdir(), `co-workspace-iso-bin-${id()}`);
mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
mkdirSync(binDir, { recursive: true });
writeFileSync(
  join(workspaceDir, "scripts", "new-project.ts"),
  `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake tenant\\n");
`,
);
const hermesBin = join(binDir, "fake-hermes.ts");
writeFileSync(
  hermesBin,
  `await Bun.stdin.text();
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-i","timestamp":1}');
console.log('{"type":"text","text":"hi","timestamp":2}');
console.log('{"type":"result","session_id":"sess-i","exit_code":0,"text":"hi","tokens":{"input":1,"output":1,"total":2},"duration_ms":5,"timestamp":3}');
`,
);
chmodSync(hermesBin, 0o755);

const cfg = loadConfig({
  CO_WORKSPACE_HOST: "127.0.0.1",
  CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  CO_WORKSPACE_DATA_DIR: dataDir,
  CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
  CO_WORKSPACE_VARIANTS: "co-consult",
  HERMES_BIN: hermesBin,
  HERMES_BIN_PREFIX: "bun",
});
const state = createState(cfg);
const server = createServer(state);
const base = `http://127.0.0.1:${server.port}`;
// Authenticated principals via web sessions (cookie); the principal is the session user's principal.
const alice = state.users.createUser({ email: "alice@test.local", name: "alice", password: "alicepass123", role: "user" })!;
const bob = state.users.createUser({ email: "bob@test.local", name: "bob", password: "bobpass12345", role: "user" })!;
const cookies = {
  alice: `gw_session=${state.users.createSession(alice.id)}`,
  bob: `gw_session=${state.users.createSession(bob.id)}`,
};
afterAll(() => server.stop(true));

type Route = { name: string; url: string; body: (user: string) => unknown };
const routes: Route[] = [
  {
    name: "openai",
    url: `${base}/v1/chat/completions`,
    body: (user) => ({ model: "co-consult", user, messages: [{ role: "user", content: "hi" }] }),
  },
  {
    name: "anthropic",
    url: `${base}/v1/messages`,
    body: (user) => ({
      model: "co-consult",
      max_tokens: 8,
      metadata: { user_id: user },
      messages: [{ role: "user", content: "hi" }],
    }),
  },
  {
    name: "gemini",
    url: `${base}/v1beta/models/co-consult:generateContent`,
    body: (user) => ({ user, contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
  },
];

async function call(route: Route, key: "alice" | "bob", user: string): Promise<Response> {
  return fetch(route.url, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies[key] },
    body: JSON.stringify(route.body(user)),
  });
}

describe("lazy-tenant routes resolve the tenant from the authenticated principal", () => {
  for (const route of routes) {
    test(`${route.name}: body user cannot reach another principal's tenant`, async () => {
      const a = await call(route, "alice", "alice");
      expect(a.status).toBe(200);
      await a.text();
      const aliceRec = state.registry.findByKey(tenantKeyFor("co-consult", alice.principal));
      expect(aliceRec?.ownerPrincipal).toBe(alice.principal);
      const before = aliceRec!.sessions ?? 0;

      // Bob claims to be alice in the body: must not run in alice's tenant.
      const b = await call(route, "bob", "alice");
      expect([200, 403]).toContain(b.status);
      await b.text();
      const after = state.registry.findByKey(tenantKeyFor("co-consult", alice.principal))!;
      expect(after.tenantId).toBe(aliceRec!.tenantId);
      expect(after.sessions ?? 0).toBe(before);
      const bobRec = state.registry.findByKey(tenantKeyFor("co-consult", bob.principal));
      expect(bobRec).toBeDefined();
      expect(bobRec!.tenantId).not.toBe(aliceRec!.tenantId);
      expect(bobRec!.ownerPrincipal).toBe(bob.principal);
    });
  }

  test("same principal reuses one tenant across routes and /sessions", async () => {
    for (const route of routes) {
      const res = await call(route, "alice", "ignored-body-user");
      expect(res.status).toBe(200);
      await res.text();
    }
    const owned = state.registry.list().filter((t) => t.ownerPrincipal === alice.principal && t.variant === "co-consult");
    expect(owned).toHaveLength(1);

    const sess = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: cookies.alice },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    expect(sess.status).toBe(200);
    expect((await sess.json()).tenantId).toBe(owned[0].tenantId);
  });
});
