/** Unit tests for Team Gateway Phase 2 hardening: auth, quotas, isolation adapter
 * (design 2026-09-27-team-gateway-phase2-hardening). */

import { afterAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { credentialValid, isAuthEnabled, presentedCredential, requestAuthorized } from "../../services/team-gateway/src/auth";
import { dockerProbe, loadConfig } from "../../services/team-gateway/src/config";
import { hermesArgs, hermesSpawnArgv, type HermesSpawnOptions } from "../../services/team-gateway/src/hermes";
import { createServer, createState } from "../../services/team-gateway/src/server";

const cfgAuth = { apiKeys: ["sk-one", "sk-two"] };
const req = (headers: Record<string, string>) => new Request("http://x/v1/models", { headers });

describe("auth — header styles, constant-time path, exemptions", () => {
  test("accepts Bearer, x-api-key, and x-goog-api-key headers", () => {
    expect(presentedCredential(req({ authorization: "Bearer sk-one" }))).toBe("sk-one");
    expect(presentedCredential(req({ "x-api-key": "sk-one" }))).toBe("sk-one");
    expect(presentedCredential(req({ "x-goog-api-key": "sk-one" }))).toBe("sk-one");
    expect(presentedCredential(req({}))).toBeNull();
  });

  test("credentialValid matches exactly and rejects junk", () => {
    expect(credentialValid(cfgAuth, "sk-one")).toBe(true);
    expect(credentialValid(cfgAuth, "sk-two")).toBe(true);
    expect(credentialValid(cfgAuth, "sk")).toBe(false);
    expect(credentialValid(cfgAuth, "")).toBe(false);
    expect(credentialValid(cfgAuth, null)).toBe(false);
  });

  test("route gate: exempt GETs pass keyless; everything else requires a key", () => {
    const keyless = req({});
    const keyed = req({ authorization: "Bearer sk-one" });
    expect(requestAuthorized(cfgAuth, keyless, "GET /")).toBe(true);
    expect(requestAuthorized(cfgAuth, keyless, "GET /health")).toBe(true);
    expect(requestAuthorized(cfgAuth, keyless, "GET /v1/models")).toBe(false);
    expect(requestAuthorized(cfgAuth, keyless, "POST /v1/chat/completions")).toBe(false);
    expect(requestAuthorized(cfgAuth, keyed, "POST /v1/chat/completions")).toBe(true);
  });

  test("auth disabled when no keys configured", () => {
    expect(isAuthEnabled({ apiKeys: [] })).toBe(false);
    expect(requestAuthorized({ apiKeys: [] }, req({}), "POST /v1/models")).toBe(true);
  });
});

describe("hermes spawn adapter — toolsets and container isolation", () => {
  const base: HermesSpawnOptions = {
    hermesBin: "hermes",
    projectDir: "/data/tenants/gw-x/project",
    hermesHome: "/data/tenants/gw-x/hermes-home",
    message: "hi",
    sessionName: "gw-x",
    runBudgetSeconds: 300,
    maxTurns: 100,
  };

  test("toolsets pass through as -t on the inner command", () => {
    const args = hermesArgs({ ...base, toolsets: "fs,web" });
    expect(args[args.indexOf("-t") + 1]).toBe("fs,web");
    expect(hermesArgs(base)).not.toContain("-t");
  });

  test("process mode: spawn argv is the inner command", () => {
    const argv = hermesSpawnArgv(base);
    expect(argv[0]).toBe("hermes");
    expect(argv).toContain("--in");
    expect(argv).not.toContain("docker");
  });

  test("docker mode: ephemeral sibling container mounts only the tenant dirs", () => {
    const argv = hermesSpawnArgv({ ...base, container: { image: "team-gateway-runtime:latest" } });
    expect(argv.slice(0, 4)).toEqual(["docker", "run", "--rm", "--interactive"]);
    expect(argv).toContain("--entrypoint");
    expect(argv[argv.indexOf("--entrypoint") + 1]).toBe("hermes");
    expect(argv).toContain("--workdir");
    expect(argv).toContain("/work/project");
    const vIdx = argv.indexOf("-v");
    expect(argv[vIdx + 1]).toBe("/data/tenants/gw-x/project:/work/project");
    const vIdx2 = argv.indexOf("-v", vIdx + 1);
    expect(argv[vIdx2 + 1]).toBe("/data/tenants/gw-x/hermes-home:/work/hermes-home");
    expect(argv).toContain("-e");
    expect(argv.filter((a) => a === "-v")).toHaveLength(2); // exactly two mounts, nothing else
    expect(argv).toContain("team-gateway-runtime:latest");
    // inner command keeps its contract, with the in-container project path
    expect(argv).toContain("--continue");
    expect(argv[argv.indexOf("--in") + 1]).toBe("/work/project");
  });

  test("docker probe verdicts on a fake docker binary", () => {
    const dir = join(tmpdir(), `gw-probe-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dir, { recursive: true });
    const okBin = join(dir, "docker-ok");
    writeFileSync(okBin, "#!/bin/sh\necho 29.8.0\n");
    chmodSync(okBin, 0o755);
    expect(dockerProbe(okBin)).toEqual({ ok: true, version: "29.8.0" });
    const failBin = join(dir, "docker-fail");
    writeFileSync(failBin, "#!/bin/sh\necho Cannot connect >&2\nexit 1\n");
    chmodSync(failBin, 0o755);
    const fail = dockerProbe(failBin);
    expect(fail.ok).toBe(false);
    expect(fail.error).toContain("Cannot connect");
  });
});

describe("config — Phase 2 tiers", () => {
  test("auth/quotas/isolation parse with fail-fast on empty key config", () => {
    const cfg = loadConfig({
      TEAM_GATEWAY_API_KEYS: "k1, k2",
      TEAM_GATEWAY_TENANT_MAX_TURNS: "50",
      TEAM_GATEWAY_TENANT_MAX_TOKENS: "0",
      TEAM_GATEWAY_HERMES_TOOLSETS: "fs,web",
      TEAM_GATEWAY_ISOLATION: "docker",
      TEAM_GATEWAY_RUNTIME_IMAGE: "tgr:1",
    });
    expect(cfg.apiKeys).toEqual(["k1", "k2"]);
    expect(cfg.tenantMaxTurns).toBe(50);
    expect(cfg.tenantMaxTokens).toBe(0);
    expect(cfg.hermesToolsets).toBe("fs,web");
    expect(cfg.isolation).toBe("docker");
    expect(cfg.runtimeImage).toBe("tgr:1");
    expect(() => loadConfig({ TEAM_GATEWAY_API_KEYS: " , " })).toThrow();
  });

  test("defaults keep Phase 0 mode: no auth, no quotas, process isolation", () => {
    const cfg = loadConfig({});
    expect(cfg.apiKeys).toEqual([]);
    expect(cfg.tenantMaxTurns).toBe(0);
    expect(cfg.tenantMaxTokens).toBe(0);
    expect(cfg.isolation).toBe("process");
    expect(cfg.hermesToolsets).toBeUndefined();
  });
});

describe("server — auth and quota enforcement", () => {
  const dataDir = join(tmpdir(), `gw-p2-${crypto.randomUUID().slice(0, 8)}`);
  const workspaceDir = join(tmpdir(), `gw-p2-ws-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}/.hermes/skills\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake\\n");
`,
  );
  const binDir = join(tmpdir(), `gw-p2-bin-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(binDir, { recursive: true });
  const hermesBin = join(binDir, "fake-hermes.sh");
  writeFileSync(
    hermesBin,
    `#!/bin/sh
cat > /dev/null
echo '{"type":"system","subtype":"init","model":"m","session_id":"s1","timestamp":1}'
echo '{"type":"text","text":"pong","timestamp":2}'
echo '{"type":"result","session_id":"s1","exit_code":0,"text":"pong","tokens":{"input":10,"output":5,"total":15},"duration_ms":3,"timestamp":3}'
`,
  );
  chmodSync(hermesBin, 0o755);

  const cfg = loadConfig({
    TEAM_GATEWAY_HOST: "127.0.0.1",
    TEAM_GATEWAY_PORT: String(20000 + Math.floor(Math.random() * 20000)),
    TEAM_GATEWAY_DATA_DIR: dataDir,
    TEAM_GATEWAY_WORKSPACE_DIR: workspaceDir,
    HERMES_BIN: hermesBin,
    TEAM_GATEWAY_API_KEYS: "sk-test",
    TEAM_GATEWAY_TENANT_MAX_TURNS: "2",
  });
  const server = createServer(createState(cfg));
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  test("auth: exempt health passes keyless; protected routes 401 keyless, 200 keyed", async () => {
    expect((await fetch(`${base}/health`)).status).toBe(200);
    const noKey = await fetch(`${base}/v1/models`);
    expect(noKey.status).toBe(401);
    const badKey = await fetch(`${base}/v1/models`, { headers: { "x-api-key": "wrong" } });
    expect(badKey.status).toBe(401);
    const good = await fetch(`${base}/v1/models`, { headers: { authorization: "Bearer sk-test" } });
    expect(good.status).toBe(200);
    const body = (await good.json()) as any;
    expect(body.data.map((m: any) => m.id)).toEqual(["co-consult"]);
  });

  test("quota: third turn on a tenant capped at 2 returns 429 before streaming", async () => {
    const provision = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer sk-test" },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    const { tenantId } = await provision.json();
    const deadline = Date.now() + 10_000;
    let status = "provisioning";
    while (Date.now() < deadline) {
      const detail = await (await fetch(`${base}/tenants/${tenantId}`, {
        headers: { authorization: "Bearer sk-test" },
      })).json();
      status = detail.status;
      if (status !== "provisioning") break;
      await Bun.sleep(50);
    }
    expect(status).toBe("ready");

    const chat = async () => {
      const res = await fetch(`${base}/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer sk-test" },
        body: JSON.stringify({ message: "hi" }),
      });
      await res.text(); // consume the stream: the turn (and its quota accounting) completes
      return res;
    };
    expect((await chat()).status).toBe(200);
    expect((await chat()).status).toBe(200);
    const third = await chat();
    expect(third.status).toBe(429);
    const detail = (await (await fetch(`${base}/tenants/${tenantId}`, {
      headers: { authorization: "Bearer sk-test" },
    })).json()) as any;
    expect(detail.sessions).toBe(2);
    expect(detail.usage.inputTokens).toBe(20);
  });
});
