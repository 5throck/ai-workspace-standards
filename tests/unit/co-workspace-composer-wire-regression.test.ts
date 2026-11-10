/**
 * Composer/wire regression (design docs/designs/2026-11-09-gw-shared-teams-design.md §11-§12,
 * D-S9/D-S10, verification table row 4):
 *  - UI pins: the New-team kind choice + group picker, the shared badge, the author tags and
 *    the strong shared-delete confirm (member set + ack) exist in the served page.
 *  - Wire regression: /v1/chat/completions and /v1/messages still resolve PERSONAL teams only,
 *    parsed.req.user is still ignored, no wire surface can target a shared team, and a shared
 *    row reached through a (hand-seeded) key collision is refused with a clear error.
 * Fixtures: mkdtemp absolute tmpdir roots, fake scaffold + fake hermes under the fixture
 * workspace (never the repo root — T-20261104-003), stores closed before rmSync.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { handleRequest, runChat } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";
import { resolveLazyTenant, sharedTeamKeyFor } from "../../services/co-workspace/src/lifecycle";

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

afterAll(() => {
  for (const handle of CLOSEABLE) {
    try {
      handle.close();
    } catch {
      /* best effort */
    }
  }
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function scratch(name: string): string {
  const dir = join(tmpdir(), `gw-st-wire-${name}-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  ROOTS.push(dir);
  return dir;
}

const FAKE_HERMES = `const prompt = await Bun.stdin.text();
console.log('{"type":"system","subtype":"init","model":"fake-model","session_id":"sess-1","timestamp":1}');
if (prompt.includes("SLOW") || process.argv.join(" ").includes("SLOW")) await Bun.sleep(400);
console.log('{"type":"result","session_id":"sess-1","exit_code":0,"text":"wire ok","tokens":{"input":1,"output":1,"total":2},"duration_ms":5,"timestamp":3}');
`;

function wireState(name: string): GatewayState {
  const workspaceDir = scratch(`${name}-ws`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  mkdirSync(join(workspaceDir, "Projects"), { recursive: true });
  // The fake scaffold embeds the ABSOLUTE fixture root (T-20261104-003: a relative
  // Projects/ would resolve against the child's inherited cwd and pollute the repo root).
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const projectsRoot = ${JSON.stringify(join(workspaceDir, "Projects"))};
const name = process.argv[2];
mkdirSync(projectsRoot + "/" + name + "/.hermes/skills", { recursive: true });
writeFileSync(projectsRoot + "/" + name + "/AGENTS.md", "# fake tenant\\n");
`,
  );
  const binDir = scratch(`${name}-bin`);
  const hermesBin = join(binDir, "fake-hermes.ts");
  writeFileSync(hermesBin, FAKE_HERMES);
  const keyFile = join(scratch(`${name}-keys`), "keys.txt");
  writeFileSync(keyFile, "wsk-alice-secret:alice\n");
  const state = createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch(`${name}-data`),
      CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
      CO_WORKSPACE_VARIANTS: "co-consult",
      CO_WORKSPACE_API_KEYS: "wsk-other-secret",
      CO_WORKSPACE_API_KEYS_FILE: keyFile,
      HERMES_BIN: hermesBin,
      HERMES_BIN_PREFIX: "bun",
    }),
  );
  for (const store of [state.registry, state.turns, state.users, state.audit]) CLOSEABLE.push(store);
  return state;
}

function keyedRequest(path: string, body: unknown, key = "wsk-alice-secret"): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

describe("wire regression: personal teams only (D-S9)", () => {
  test("/v1/chat/completions ignores body.user and resolves the CALLER's personal team", async () => {
    const state = wireState("openai");
    state.registry.create({ variant: "co-consult", key: sharedTeamKeyFor("co-consult", "team-a"), ownerPrincipal: "group:team-a", teamKind: "shared", ownerGroup: "team-a" });
    const res = await handleRequest(state, keyedRequest("/v1/chat/completions", {
      model: "co-consult",
      messages: [{ role: "user", content: "hi" }],
      user: "group:team-a", // the body user is intentionally ignored (compat.ts contract)
    }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    expect(body.choices[0].message.content).toBe("wire ok");
    // The turn ran in ALICE'S personal team (key co-consult::alice) — never the shared team.
    const personal = state.registry.list().find((r) => r.key === "co-consult::alice");
    expect(personal).toBeTruthy();
    expect(personal?.teamKind ?? "personal").toBe("personal");
    expect(state.turns.list(personal!.tenantId)[0]?.actingPrincipal).toBe("alice");
    const shared = state.registry.findByKey(sharedTeamKeyFor("co-consult", "team-a"))!;
    expect(state.turns.list(shared.tenantId)).toEqual([]);
  });

  test("/v1/messages behaves identically (personal only, body metadata.user_id ignored)", async () => {
    const state = wireState("anthropic");
    state.registry.create({ variant: "co-consult", key: sharedTeamKeyFor("co-consult", "team-a"), ownerPrincipal: "group:team-a", teamKind: "shared", ownerGroup: "team-a" });
    const res = await handleRequest(state, keyedRequest("/v1/messages", {
      model: "co-consult",
      max_tokens: 64,
      messages: [{ role: "user", content: "hi" }],
      metadata: { user_id: "group:team-a" },
    }));
    expect(res.status).toBe(200);
    const personal = state.registry.list().find((r) => r.key === "co-consult::alice");
    expect(personal).toBeTruthy();
    const shared = state.registry.findByKey(sharedTeamKeyFor("co-consult", "team-a"))!;
    expect(state.turns.list(shared.tenantId)).toEqual([]);
  });

  test("a shared row reached through a key collision is refused with a clear error (defensive guard)", () => {
    const state = wireState("guard");
    // Hand-seeded COLLISION: a shared-team record under alice's personal key — impossible
    // through the API (the group: prefix cannot appear in a principal) but the guard must
    // turn it into a refusal, not a silent chat into a group's team.
    state.registry.create({ variant: "co-consult", key: "co-consult::alice", ownerPrincipal: "group:team-a", teamKind: "shared", ownerGroup: "team-a" });
    const req = new Request("http://127.0.0.1/x", { headers: { authorization: "Bearer wsk-alice-secret" } });
    let message = "";
    try {
      resolveLazyTenant(state, req, "co-consult");
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("shared teams are web-console targets only");
    expect(state.audit.query({ action: "tenant.access.denied" }).entries.some((e) => e.detail.includes("shared team on a wire surface"))).toBe(true);
  });

  test("resolveLazyTenant never returns a shared team for a clean caller", () => {
    const state = wireState("clean");
    state.registry.create({ variant: "co-consult", key: "co-consult::alice", ownerPrincipal: "alice" });
    const req = new Request("http://127.0.0.1/x", { headers: { authorization: "Bearer wsk-alice-secret" } });
    const { rec } = resolveLazyTenant(state, req, "co-consult");
    expect(rec.key).toBe("co-consult::alice");
    expect(rec.teamKind ?? "personal").toBe("personal");
  });
});

describe("shared-team chatLock serialization (D-S3) — two members' turns never run in parallel", () => {
  test("member B's turn queues behind member A's running turn and both record their acting principal", async () => {
    const state = wireState("serialize");
    const shared = state.registry.create({
      variant: "co-consult",
      key: sharedTeamKeyFor("co-consult", "team-a"),
      ownerPrincipal: "group:team-a",
      teamKind: "shared",
      ownerGroup: "team-a",
    });
    mkdirSync(shared.projectDir, { recursive: true }); // the turn spawns with cwd = projectDir
    mkdirSync(shared.hermesHome, { recursive: true });
    const started = Date.now();
    // A's turn holds the per-tenant chatLock (SLOW ≈ 400ms); B's turn is issued while A runs.
    const a = runChat(state, shared, "SLOW turn from alice", undefined, undefined, "alice");
    await new Promise((r) => setTimeout(r, 80)); // A has the lock and is mid-turn
    const b = runChat(state, shared, "turn from bob", undefined, undefined, "bob");
    const [resultA, resultB] = await Promise.all([a, b]);
    expect(resultA.exitCode).toBe(0);
    expect(resultB.exitCode).toBe(0);
    // Serialized: the wall clock covers A's hold PLUS B's full run (no overlap).
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
    const rows = state.turns.list(shared.tenantId); // list() is seq DESC
    expect(rows.map((r) => [r.seq, r.actingPrincipal])).toEqual([
      [2, "bob"],
      [1, "alice"],
    ]);
    // One shared Hermes thread: both turns ran in the SAME tenant home (the point of D-S3).
    expect(state.registry.get(shared.tenantId)?.hermesHome).toBe(shared.hermesHome);
  }, 20_000);
});

describe("UI pins (D-S10) — served page carries the shared-team surfaces", () => {
  const serviceRoot = join(import.meta.dir, "..", "..", "services", "co-workspace");
  const index = () => readFileSync(join(serviceRoot, "web", "index.html"), "utf8");
  const adminJs = () => readFileSync(join(serviceRoot, "web", "admin.js"), "utf8");

  test("New-team modal: kind choice (Personal default / Shared) + group picker from memberships", () => {
    const html = index();
    expect(html).toContain('id="nt-kind-personal"');
    expect(html).toContain('id="nt-kind-shared"');
    expect(html).toContain('id="nt-group"');
    expect(html).toContain('"/auth/me/groups"'); // the picker feed
    expect(html).toContain("group: groupSel.value"); // the shared create payload
  });

  test("sidebar badge: shared · <group name> next to the team name", () => {
    expect(index()).toContain('class="sharedTag"');
    expect(index()).toContain("shared · ");
  });

  test("author tags: turns render actingPrincipal; NULL renders as legacy", () => {
    const html = index();
    expect(html).toContain("turn.actingPrincipal"); // replay bubbles + history meta
    expect(html).toContain('?? "legacy"'); // no fabricated attribution
  });

  test("strong shared-delete confirm: owner group + member set + explicit ack", () => {
    const html = index();
    expect(html).toContain("confirmSharedDelete");
    expect(html).toContain("I understand every member loses access");
    expect(html).toContain("every member loses access");
  });

  test("admin console team list may show the shared kind", () => {
    expect(adminJs()).toContain('badge("shared")');
  });
});
