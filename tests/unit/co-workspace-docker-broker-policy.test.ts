/**
 * T-20260930-027 step 1: pure docker broker policy (design B.2 / B.5). The create fixture is a
 * REAL docker CLI 29.8.1 capture of the gateway's hermesSpawnArgv request.
 */

import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkRoute,
  filterContainerList,
  isValidRef,
  loadPolicyConfig,
  parseDockerMemory,
  scanJson,
  semanticEqual,
  validateBindsOnDisk,
  validateCreate,
  type PolicyConfig,
} from "../../services/co-workspace/src/docker-broker-policy";

const DATA = "/srv/co-data";
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request.json"), "utf8"));
const NAME = new URLSearchParams(FIXTURE.query).get("name") as string;
const CFG: PolicyConfig = { ...loadPolicyConfig({}), dataDirHost: DATA };

function fixtureText(): string {
  return (FIXTURE.body as string).split("<DATA>").join(DATA);
}
function fixtureBody(): any {
  return JSON.parse(fixtureText());
}
function run(mut: (b: any) => void, name = NAME) {
  const b = fixtureBody();
  mut(b);
  return validateCreate(JSON.stringify(b), CFG, name);
}
function expectReject(res: ReturnType<typeof validateCreate>, reason: string) {
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reason).toContain(reason);
}

describe("loadPolicyConfig / parseDockerMemory", () => {
  test("defaults mirror the gateway config", () => {
    const c = loadPolicyConfig({});
    expect(c).toEqual({
      runtimeImage: "co-workspace-runtime:latest",
      dataDirHost: undefined,
      instanceId: "default",
      hermesBin: "hermes",
      memoryCapBytes: 2 * 1024 ** 3,
      cpuCap: 2,
      pidsCap: 256,
    });
  });
  test("docker memory units", () => {
    expect(parseDockerMemory("2g")).toBe(2147483648);
    expect(parseDockerMemory("512m")).toBe(536870912);
    expect(parseDockerMemory("1024")).toBe(1024);
    expect(parseDockerMemory("1k")).toBe(1024);
    expect(Number.isNaN(parseDockerMemory("lots"))).toBe(true);
  });
});

describe("scanJson", () => {
  test("accepts valid JSON", () => {
    expect(scanJson('{"a":[1,{"b":null}],"c":"\\u0041"}').ok).toBe(true);
  });
  test("rejects duplicate keys at nested levels", () => {
    const r = scanJson('{"a":{"x":1,"x":2}}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("duplicate key a.x");
  });
  test("rejects escaped-duplicate keys", () => {
    expect(scanJson('{"Image":"a","\\u0049mage":"b"}').ok).toBe(false);
  });
  test("rejects excessive depth", () => {
    const r = scanJson("[".repeat(100) + "]".repeat(100));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("too deep");
  });
  test("rejects trailing data", () => {
    expect(scanJson('{"a":1} {"b":2}').ok).toBe(false);
  });
});

describe("validateCreate: real docker CLI fixture", () => {
  test("fixture is accepted and the canonical rebuild semantically equals the input", () => {
    const res = validateCreate(fixtureText(), CFG, NAME);
    if (!res.ok) throw new Error(res.reason);
    expect(semanticEqual(res.canonical, fixtureBody())).toBe(true);
    expect(semanticEqual(JSON.parse(res.canonicalText), fixtureBody())).toBe(true);
    expect(res.canonical.Labels).toEqual({
      "co-workspace.instance": "default",
      "co-workspace.tenant": "gw-abc123",
      "co-workspace.turn": "1",
    });
    expect(res.facts.principal).toBe("default");
    expect(res.facts.project).toBe("demo");
    expect(res.facts.bindSources).toEqual([`${DATA}/storage/default/demo/project`, `${DATA}/storage/default/demo/hermes-home`]);
  });
  test("fixture route is allowed as a buffered create", () => {
    const r = checkRoute(FIXTURE.method, FIXTURE.path + FIXTURE.query, CFG, FIXTURE.headers);
    expect(r.allowed && r.op === "create" && r.mode === "buffered" && r.versionPrefix === "/v1.56").toBe(true);
  });
  test("rejected when the data dir is not configured", () => {
    expectReject(validateCreate(fixtureText(), { ...CFG, dataDirHost: undefined }, NAME), "data dir host not configured");
  });
});

describe("validateCreate: attack table (design B.5)", () => {
  const text = () => fixtureText();
  test("lower-case hostconfig alongside HostConfig -> duplicate key", () => {
    const t = text().replace('"HostConfig":{', '"hostconfig":{},"HostConfig":{');
    expectReject(validateCreate(t, CFG, NAME), "duplicate key");
  });
  test("lower-case hostconfig alone -> unknown key", () => {
    expectReject(run((b) => { b.hostconfig = b.HostConfig; delete b.HostConfig; }), "unknown key hostconfig");
  });
  test("HostConfig.privileged (case variant) -> duplicate key", () => {
    const t = text().replace('"Privileged":false', '"Privileged":false,"privileged":true');
    expectReject(validateCreate(t, CFG, NAME), "duplicate key HostConfig.privileged");
  });
  test("duplicate Image", () => {
    const t = text().replace('"Image":', '"Image":"evil:latest","Image":');
    expectReject(validateCreate(t, CFG, NAME), "duplicate key Image");
  });
  test("duplicate HostConfig", () => {
    const t = text().replace('"HostConfig":{', '"HostConfig":{"Privileged":true},"HostConfig":{');
    expectReject(validateCreate(t, CFG, NAME), "duplicate key HostConfig");
  });
  test("CapAdd SYS_ADMIN", () => {
    expectReject(run((b) => { b.HostConfig.CapAdd = ["SYS_ADMIN"]; }), "HostConfig.CapAdd must be empty");
  });
  test("SecurityOpt with seccomp=unconfined extra", () => {
    expectReject(run((b) => { b.HostConfig.SecurityOpt = ["no-new-privileges", "seccomp=unconfined"]; }), "HostConfig.SecurityOpt");
  });
  test("SecurityOpt missing", () => {
    expectReject(run((b) => { delete b.HostConfig.SecurityOpt; }), "HostConfig.SecurityOpt");
  });
  test("top-level User 0:0", () => {
    expectReject(run((b) => { b.User = "0:0"; }), 'User must be "10000:10000"');
  });
  test("HostConfig.User present", () => {
    expectReject(run((b) => { b.HostConfig.User = "10000:10000"; }), "forbidden key HostConfig.User");
  });
  test("PidMode container:x", () => {
    expectReject(run((b) => { b.HostConfig.PidMode = "container:x"; }), "HostConfig.PidMode must be empty");
  });
  test("NetworkMode container:x", () => {
    expectReject(run((b) => { b.HostConfig.NetworkMode = "container:x"; }), "HostConfig.NetworkMode not allowed");
  });
  test("IpcMode host", () => {
    expectReject(run((b) => { b.HostConfig.IpcMode = "host"; }), "HostConfig.IpcMode must be empty");
  });
  test("UsernsMode host", () => {
    expectReject(run((b) => { b.HostConfig.UsernsMode = "host"; }), "HostConfig.UsernsMode must be empty");
  });
  test("VolumesFrom", () => {
    expectReject(run((b) => { b.HostConfig.VolumesFrom = ["other"]; }), "HostConfig.VolumesFrom must be empty");
  });
  test("Mounts", () => {
    expectReject(run((b) => { b.HostConfig.Mounts = [{ Type: "bind", Source: "/", Target: "/host" }]; }), "forbidden key HostConfig.Mounts");
  });
  test("Sysctls", () => {
    expectReject(run((b) => { b.HostConfig.Sysctls = { "kernel.x": "1" }; }), "forbidden key HostConfig.Sysctls");
  });
  test("Runtime", () => {
    expectReject(run((b) => { b.HostConfig.Runtime = "runc-evil"; }), "forbidden key HostConfig.Runtime");
  });
  test("PortBindings", () => {
    expectReject(run((b) => { b.HostConfig.PortBindings = { "22/tcp": [{ HostPort: "2222" }] }; }), "HostConfig.PortBindings must be empty");
  });
  test("Privileged true", () => {
    expectReject(run((b) => { b.HostConfig.Privileged = true; }), "HostConfig.Privileged must be false");
  });
  test("Memory above cap", () => {
    expectReject(run((b) => { b.HostConfig.Memory = 2147483648 + 1; }), "HostConfig.Memory");
  });
  test("NanoCpus missing", () => {
    expectReject(run((b) => { delete b.HostConfig.NanoCpus; }), "HostConfig.NanoCpus");
  });
  test("NanoCpus above cap", () => {
    expectReject(run((b) => { b.HostConfig.NanoCpus = 3e9; }), "HostConfig.NanoCpus");
  });
  test("PidsLimit above cap", () => {
    expectReject(run((b) => { b.HostConfig.PidsLimit = 100000; }), "HostConfig.PidsLimit");
  });
  test("Image tag mismatch", () => {
    expectReject(run((b) => { b.Image = "co-workspace-runtime:evil"; }), "Image not allowed");
  });
  test("Image repo-only", () => {
    expectReject(run((b) => { b.Image = "co-workspace-runtime"; }), "Image not allowed");
  });
  test("Env with CO_WORKSPACE_API_KEYS", () => {
    expectReject(run((b) => { b.Env.push("CO_WORKSPACE_API_KEYS=x"); }), "Env CO_WORKSPACE_API_KEYS not allowed");
  });
  test("Env with two provider keys", () => {
    expectReject(run((b) => { b.Env.push("ANTHROPIC_API_KEY=x"); }), "more than one provider key");
  });
  test("Env with HERMES_SHARED_AUTH_DIR", () => {
    expectReject(run((b) => { b.Env.push("HERMES_SHARED_AUTH_DIR=/work/shared-auth"); }), "Env HERMES_SHARED_AUTH_DIR not allowed");
  });
  test("forged label tenant (does not match name)", () => {
    expectReject(run((b) => { b.Labels["co-workspace.tenant"] = "victim"; }), "does not match container name");
  });
  test("forged label instance", () => {
    expectReject(run((b) => { b.Labels["co-workspace.instance"] = "other"; }), "label co-workspace.instance mismatch");
  });
  test("forged label turn / extra label", () => {
    expectReject(run((b) => { b.Labels["co-workspace.turn"] = "0"; }), "label co-workspace.turn must be 1");
    expectReject(run((b) => { b.Labels.extra = "1"; }), "unknown key Labels.extra");
  });
  test("bind source <DATA>/../..", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = `${DATA}/../..:/work/project`; }), "bind not allowed");
  });
  test("bind source with .. segments inside storage", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = `${DATA}/storage/../demo/project:/work/project`; }), "segment not allowed");
  });
  test("bind source <DATA>//storage", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = `${DATA}//storage/default/demo/project:/work/project`; }), "bind not allowed");
  });
  test("relative bind source", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = "storage/default/demo/project:/work/project"; }), "bind not allowed");
  });
  test("bind source /etc", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = "/etc:/work/project"; }), "bind not allowed");
  });
  test("bind target /work/other", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = `${DATA}/storage/default/demo/project:/work/other`; }), "bind not allowed");
  });
  test("bind option :shared", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] += ":shared"; }), "bind not allowed");
  });
  test("bind option :ro with extra", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] += ":ro,rshared"; }), "bind not allowed");
  });
  test("bind option :rw is allowed", () => {
    const res = run((b) => { b.HostConfig.Binds[0] += ":rw"; });
    expect(res.ok).toBe(true);
  });
  test("third bind", () => {
    expectReject(run((b) => { b.HostConfig.Binds.push(`${DATA}/storage/default/demo/project:/work/project`); }), "exactly 2 entries");
  });
  test("mismatched principal/name across binds", () => {
    expectReject(run((b) => { b.HostConfig.Binds[1] = `${DATA}/storage/other/demo/hermes-home:/work/hermes-home`; }), "same principal and name");
    expectReject(run((b) => { b.HostConfig.Binds[1] = `${DATA}/storage/default/victim/hermes-home:/work/hermes-home`; }), "same principal and name");
  });
  test("bind source/target suffix mismatch", () => {
    expectReject(run((b) => { b.HostConfig.Binds[0] = `${DATA}/storage/default/demo/hermes-home:/work/project`; }), "source/target mismatch");
  });
  test("unknown key at top level", () => {
    expectReject(run((b) => { b.ExposedPorts = {}; }), "unknown key ExposedPorts");
  });
  test("unknown key in HostConfig", () => {
    expectReject(run((b) => { b.HostConfig.CgroupnsModeX = ""; }), "unknown key HostConfig.CgroupnsModeX");
  });
  test("unknown key in NetworkingConfig", () => {
    expectReject(run((b) => { b.NetworkingConfig.Extra = 1; }), "unknown key NetworkingConfig.Extra");
    expectReject(run((b) => { b.NetworkingConfig.EndpointsConfig.default.Foo = 1; }), "unknown key NetworkingConfig.EndpointsConfig.default.Foo");
  });
  test("NetworkingConfig endpoint with a non-zero value", () => {
    expectReject(run((b) => { b.NetworkingConfig.EndpointsConfig.default.IPAddress = "10.0.0.5"; }), "must be zero");
  });
  test("oversize body (65 KiB)", () => {
    expectReject(run((b) => { b.Cmd.push("x".repeat(65 * 1024)); }), "body too large");
  });
  test("invalid JSON", () => {
    expectReject(validateCreate("{not json", CFG, NAME), "invalid JSON");
  });
  test("non-fleet container name", () => {
    expectReject(validateCreate(fixtureText(), CFG, "evil"), "container name not allowed");
  });
  test("Entrypoint override", () => {
    expectReject(run((b) => { b.Entrypoint = ["/bin/sh"]; }), "Entrypoint not allowed");
  });
  test("WorkingDir override", () => {
    expectReject(run((b) => { b.WorkingDir = "/"; }), "WorkingDir");
  });
  test("Tty true", () => {
    expectReject(run((b) => { b.Tty = true; }), "Tty must be false");
  });
});

describe("checkRoute", () => {
  const ID = "a".repeat(64);
  const allowedCases: Array<[string, string, Record<string, string>?]> = [
    ["HEAD", "/_ping"],
    ["GET", "/_ping"],
    ["GET", "/version"],
    ["GET", "/containers/json?all=1"],
    ["POST", `/containers/create?name=${NAME}`],
    ["POST", `/containers/${ID}/attach?stderr=1&stdin=1&stdout=1&stream=1`, { upgrade: "tcp" }],
    ["POST", `/containers/${ID}/start`],
    ["POST", `/containers/${ID}/wait?condition=removed`],
    ["POST", `/containers/${NAME}/kill`],
    ["DELETE", "/containers/abcdef012345?force=1"],
  ];
  for (const [method, target, headers] of allowedCases) {
    test(`allowed unversioned ${method} ${target}`, () => {
      const r = checkRoute(method, target, CFG, headers);
      expect(r.allowed).toBe(true);
      if (r.allowed) expect(r.versionPrefix).toBe("");
    });
    test(`allowed versioned ${method} /v1.56${target}`, () => {
      const r = checkRoute(method, `/v1.56${target}`, CFG, headers);
      expect(r.allowed).toBe(true);
      if (r.allowed) {
        expect(r.versionPrefix).toBe("/v1.56");
        expect(r.norm.startsWith("/v1")).toBe(false);
      }
    });
  }
  test("modes", () => {
    const m = (meth: string, t: string, h?: Record<string, string>) => {
      const r = checkRoute(meth, t, CFG, h);
      return r.allowed ? r.mode : "denied";
    };
    expect(m("GET", "/containers/json")).toBe("buffered");
    expect(m("POST", `/containers/${ID}/attach?stream=1&stdin=1&stdout=1&stderr=1`, { upgrade: "tcp" })).toBe("upgrade");
    expect(m("POST", `/containers/${ID}/start`)).toBe("piped");
  });
  test("%2F in a ref is rejected", () => {
    expect(checkRoute("POST", "/containers/..%2F..%2Fx/start").allowed).toBe(false);
  });
  test("%-encoded filters query on GET /containers/json is accepted", () => {
    const q = encodeURIComponent(JSON.stringify({ label: ["co-workspace.turn=1", "co-workspace.instance=default"] }));
    const r = checkRoute("GET", `/v1.56/containers/json?all=1&filters=${q}`);
    expect(r.allowed).toBe(true);
  });
  test("non-JSON filters rejected", () => {
    expect(checkRoute("GET", "/containers/json?filters=notjson").allowed).toBe(false);
  });
  test("HEAD /version rejected", () => {
    expect(checkRoute("HEAD", "/version").allowed).toBe(false);
  });
  test("GET on /start rejected", () => {
    expect(checkRoute("GET", `/containers/${ID}/start`).allowed).toBe(false);
  });
  test("/resize rejected", () => {
    expect(checkRoute("POST", `/containers/${ID}/resize?h=10&w=10`).allowed).toBe(false);
  });
  test("inspect GET /containers/{id}/json rejected", () => {
    expect(checkRoute("GET", `/containers/${ID}/json`).allowed).toBe(false);
  });
  test("unknown query key rejected", () => {
    const r = checkRoute("POST", `/containers/${ID}/start?detachKeys=x`);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toContain("query key not allowed");
  });
  test("duplicate query key rejected", () => {
    const r = checkRoute("POST", `/containers/create?name=${NAME}&name=evil`);
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toContain("duplicate query key");
  });
  test("ref neither NAME_RE nor hex rejected", () => {
    expect(isValidRef("postgres")).toBe(false);
    expect(isValidRef("abc")).toBe(false);
    expect(isValidRef("ABCDEF012345")).toBe(false);
    expect(checkRoute("POST", "/containers/postgres/kill").allowed).toBe(false);
  });
  test("kill signal allowlist", () => {
    expect(checkRoute("POST", `/containers/${ID}/kill?signal=SIGKILL`).allowed).toBe(true);
    expect(checkRoute("POST", `/containers/${ID}/kill?signal=15`).allowed).toBe(true);
    expect(checkRoute("POST", `/containers/${ID}/kill?signal=SIGHUP`).allowed).toBe(false);
  });
  test("wait condition allowlist", () => {
    expect(checkRoute("POST", `/containers/${ID}/wait?condition=next-exit`).allowed).toBe(true);
    expect(checkRoute("POST", `/containers/${ID}/wait?condition=evil`).allowed).toBe(false);
  });
  test("attach requires the exact 4 flags and Upgrade: tcp", () => {
    const base = `/containers/${ID}/attach`;
    expect(checkRoute("POST", `${base}?stream=1&stdin=1&stdout=1&stderr=1`, CFG, {}).allowed).toBe(false);
    expect(checkRoute("POST", `${base}?stream=1&stdin=1&stdout=1`, CFG, { upgrade: "tcp" }).allowed).toBe(false);
    expect(checkRoute("POST", `${base}?stream=1&stdin=1&stdout=1&stderr=0`, CFG, { upgrade: "tcp" }).allowed).toBe(false);
    expect(checkRoute("POST", `${base}?stream=1&stdin=1&stdout=1&stderr=1&logs=1`, CFG, { upgrade: "tcp" }).allowed).toBe(false);
  });
  test("path traversal and malformed paths rejected", () => {
    expect(checkRoute("GET", "/v1.56//_ping").allowed).toBe(false);
    expect(checkRoute("GET", "/./_ping").allowed).toBe(false);
    expect(checkRoute("GET", "/containers/../version").allowed).toBe(false);
    expect(checkRoute("GET", "/v1.56/v1.56/_ping").allowed).toBe(false);
  });
  test("create name must match NAME_RE", () => {
    expect(checkRoute("POST", "/containers/create?name=evil").allowed).toBe(false);
    expect(checkRoute("POST", "/containers/create").allowed).toBe(false);
  });
});

describe("filterContainerList", () => {
  const own = { Id: "1", Names: [`/${NAME}`], Labels: { "co-workspace.instance": "default" } };
  test("keeps only fleet + instance containers", () => {
    const list = [
      own,
      { Id: "2", Names: ["/postgres"], Labels: { "co-workspace.instance": "default" } },
      { Id: "3", Names: [`/${NAME}`], Labels: { "co-workspace.instance": "other" } },
      { Id: "4", Names: [`/${NAME}`], Labels: {} },
    ];
    expect(filterContainerList(list, CFG)).toEqual([own]);
  });
  test("malformed entries are dropped without throwing", () => {
    const list = [null, 1, "x", {}, { Names: "nope", Labels: {} }, { Names: [1], Labels: { "co-workspace.instance": "default" } }, { Names: [`/${NAME}`], Labels: null }, own];
    expect(filterContainerList(list, CFG)).toEqual([own]);
    expect(filterContainerList({ not: "array" }, CFG)).toEqual([]);
  });
});

describe("validateBindsOnDisk (real temp dirs)", () => {
  function mkTree(): { data: string; root: string; binds: string[] } {
    const root = realpathSync(mkdtempSync(join(tmpdir(), "cows-broker-")));
    const data = `${root}/data`;
    mkdirSync(`${data}/storage/p/n/project`, { recursive: true });
    mkdirSync(`${data}/storage/p/n/hermes-home`, { recursive: true });
    return {
      root,
      data,
      binds: [`${data}/storage/p/n/project:/work/project`, `${data}/storage/p/n/hermes-home:/work/hermes-home`],
    };
  }
  const posixOnly = process.platform === "win32";

  test.skipIf(posixOnly)("a normal tree passes", () => {
    const t = mkTree();
    try {
      expect(validateBindsOnDisk(t.binds, t.data)).toEqual({ ok: true });
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  test("injected fs ops: normal tree passes, error fails closed", () => {
    const dir = { isDirectory: () => true, isSymbolicLink: () => false };
    const binds = ["/d/storage/p/n/project:/work/project"];
    expect(validateBindsOnDisk(binds, "/d", { lstatSync: () => dir, realpathSync: (p) => p })).toEqual({ ok: true });
    const r = validateBindsOnDisk(binds, "/d", {
      lstatSync: () => {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      },
      realpathSync: (p) => p,
    });
    expect(r).toEqual({ ok: false, reason: "bind source check failed (EACCES)" });
  });
  test("injected fs ops: realpath differing from the leaf fails closed", () => {
    const dir = { isDirectory: () => true, isSymbolicLink: () => false };
    const binds = ["/d/storage/p/n/project:/work/project"];
    const r = validateBindsOnDisk(binds, "/d", { lstatSync: () => dir, realpathSync: () => "/etc" });
    expect(r).toEqual({ ok: false, reason: "bind source realpath mismatch" });
  });
  test("loadPolicyConfig reads HERMES_BIN (same var as the gateway), not CO_WORKSPACE_HERMES_BIN", () => {
    expect(loadPolicyConfig({ HERMES_BIN: "hermes2" }).hermesBin).toBe("hermes2");
    expect(loadPolicyConfig({ CO_WORKSPACE_HERMES_BIN: "x" }).hermesBin).toBe("hermes");
  });
  test.skipIf(posixOnly)("symlinked leaf fails", () => {
    const t = mkTree();
    try {
      rmSync(`${t.data}/storage/p/n/project`, { recursive: true });
      symlinkSync("/", `${t.data}/storage/p/n/project`);
      const r = validateBindsOnDisk(t.binds, t.data);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("symlink");
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  test.skipIf(posixOnly)("symlinked storage/p (to another tenant) fails", () => {
    const t = mkTree();
    try {
      mkdirSync(`${t.data}/storage/victim/n/project`, { recursive: true });
      mkdirSync(`${t.data}/storage/victim/n/hermes-home`, { recursive: true });
      rmSync(`${t.data}/storage/p`, { recursive: true });
      symlinkSync(`${t.data}/storage/victim`, `${t.data}/storage/p`);
      const r = validateBindsOnDisk(t.binds, t.data);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("symlink");
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  test.skipIf(posixOnly)("symlinked DATA component fails", () => {
    const t = mkTree();
    try {
      const link = `${t.root}/data-link`;
      symlinkSync(t.data, link);
      const binds = t.binds.map((b) => b.replace(t.data, link));
      const r = validateBindsOnDisk(binds, link);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toContain("symlink");
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  test.skipIf(posixOnly)("missing dir fails closed", () => {
    const t = mkTree();
    try {
      rmSync(`${t.data}/storage/p/n/hermes-home`, { recursive: true });
      const r = validateBindsOnDisk(t.binds, t.data);
      expect(r).toEqual({ ok: false, reason: "bind source check failed (ENOENT)" });
    } finally {
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
  test.skipIf(posixOnly || isRoot)("unreadable dir fails closed", () => {
    const t = mkTree();
    try {
      chmodSync(`${t.data}/storage/p`, 0o000);
      const r = validateBindsOnDisk(t.binds, t.data);
      expect(r).toEqual({ ok: false, reason: "bind source check failed (EACCES)" });
    } finally {
      chmodSync(`${t.data}/storage/p`, 0o755);
      rmSync(t.root, { recursive: true, force: true });
    }
  });
  test("bind outside the data dir fails", () => {
    expect(validateBindsOnDisk(["/etc:/work/project"], "/d").ok).toBe(false);
    expect(validateBindsOnDisk(["/d/storage/../x:/work/project"], "/d").ok).toBe(false);
    expect(validateBindsOnDisk([], undefined).ok).toBe(false);
  });
});
