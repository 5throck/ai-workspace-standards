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
  validateMounts,
  type PolicyConfig,
} from "../../services/co-workspace/src/docker-broker-policy";

const DATA = "/srv/co-data";
const VOL = "cow-data-vol";
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request.json"), "utf8"));
const VFIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request-volume.json"), "utf8"));
const NAME = new URLSearchParams(FIXTURE.query).get("name") as string;
const VNAME = new URLSearchParams(VFIXTURE.query).get("name") as string;
const CFG: PolicyConfig = { ...loadPolicyConfig({}), dataDirHost: DATA };
const VCFG: PolicyConfig = { ...loadPolicyConfig({}), dataVolume: VOL };

function fixtureText(): string {
  return (FIXTURE.body as string).split("<DATA>").join(DATA);
}
function volumeFixtureText(): string {
  return (VFIXTURE.body as string).split("<VOL>").join(VOL);
}
function volumeFixtureBody(): any {
  return JSON.parse(volumeFixtureText());
}
function vrun(mut: (b: any) => void, name = VNAME): ReturnType<typeof validateCreate> {
  const b = volumeFixtureBody();
  mut(b);
  return validateCreate(JSON.stringify(b), VCFG, name);
}
function expectReject(res: ReturnType<typeof validateCreate>, reason: string) {
  expect(res.ok).toBe(false);
  if (!res.ok) expect(res.reason).toContain(reason);
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

// =============================================================================================
// T-20260930-038: opt-in volume-subpath mode (design 2026-09-30, section 4.1 / section 8)
// =============================================================================================

describe("validateCreate: volume-mode fixture (T-20260930-038)", () => {
  test("captured volume fixture is accepted; canonical rebuild keeps only validated fields", () => {
    const res = validateCreate(volumeFixtureText(), VCFG, VNAME);
    if (!res.ok) throw new Error(res.reason);
    // The canonical rebuild drops the CLI's Consistency/NoCopy/Labels/DriverConfig defaults.
    const hc = res.canonical.HostConfig as any;
    expect(hc.Binds).toBe(null);
    expect(hc.Mounts).toEqual([
      { Type: "volume", Source: VOL, Target: "/work/project", VolumeOptions: { Subpath: "storage/default/demo/project" } },
      { Type: "volume", Source: VOL, Target: "/work/hermes-home", VolumeOptions: { Subpath: "storage/default/demo/hermes-home" } },
    ]);
    expect(Object.keys(hc.Mounts[0]).sort()).toEqual(["Source", "Target", "Type", "VolumeOptions"]);
    expect(Object.keys(hc.Mounts[0].VolumeOptions)).toEqual(["Subpath"]);
    expect(res.facts.principal).toBe("default");
    expect(res.facts.project).toBe("demo");
    expect(res.facts.binds).toEqual([]);
    expect(res.facts.mounts).toEqual(hc.Mounts);
  });
  test("bind-mode fixture is REJECTED in volume mode (mixed shapes across modes)", () => {
    expectReject(validateCreate(fixtureText(), VCFG, NAME), "not allowed");
  });
  test("volume fixture is rejected in bind mode (Mounts forbidden)", () => {
    expectReject(validateCreate(volumeFixtureText(), CFG, VNAME), "forbidden key HostConfig.Mounts");
  });
  test("loadPolicyConfig rejects an invalid volume name (fail closed)", () => {
    expect(() => loadPolicyConfig({ CO_WORKSPACE_DATA_VOLUME: "-bad name" })).toThrow("invalid CO_WORKSPACE_DATA_VOLUME");
    expect(loadPolicyConfig({ CO_WORKSPACE_DATA_VOLUME: VOL }).dataVolume).toBe(VOL);
  });
  test("validateMounts direct: canonical order is project-first regardless of client order", () => {
    const b = volumeFixtureBody();
    const mounts = b.HostConfig.Mounts.slice().reverse();
    const r = validateMounts(mounts, VCFG, "hermes-home");
    expect(r.mounts[0].Target).toBe("/work/project");
    expect(r.principal).toBe("default");
    expect(r.project).toBe("demo");
  });
});

describe("validateCreate: volume-mode attack table (design section 8)", () => {
  test("subpath .. escape", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "../escape"; }), "mount Subpath not allowed");
  });
  test("subpath absolute", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "/abs"; }), "mount Subpath not allowed");
  });
  test("subpath empty", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = ""; }), "mount Subpath not allowed");
  });
  test("subpath symlink-ish traversal inside the path (a/../b)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/default/../demo/project"; }), "mount Subpath not allowed");
  });
  test("subpath wrong leaf (not project|hermes-home)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/default/demo/other"; }), "mount Subpath not allowed");
  });
  test("subpath principal segment traversal (storage/../n/project)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/../demo/project"; }), "mount Subpath not allowed");
  });
  test("subpath missing leaf shape (storage/<P>/<N> without the leaf)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/default/demo"; }), "mount Subpath not allowed");
  });
  test("wrong Source volume", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].Source = "other-volume"; }), "mount Source not allowed");
  });
  test("non-volume Type (bind / tmpfs)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].Type = "bind"; }), "mount Type must be volume");
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].Type = "tmpfs"; }), "mount Type must be volume");
  });
  test("third mount entry", () => {
    expectReject(vrun((b) => {
      b.HostConfig.Mounts.push({ Type: "volume", Source: VOL, Target: "/work/project", VolumeOptions: { Subpath: "storage/default/demo/project" } });
    }), "exactly 2 entries");
  });
  test("missing hermes-home mount (single entry)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts = b.HostConfig.Mounts.slice(0, 1); }), "exactly 2 entries");
  });
  test("duplicate target", () => {
    expectReject(vrun((b) => {
      b.HostConfig.Mounts[1].Target = "/work/project";
      b.HostConfig.Mounts[1].VolumeOptions.Subpath = "storage/default/demo/project";
    }), "duplicate mount target");
  });
  test("mixed Binds+Mounts is denied outright", () => {
    expectReject(vrun((b) => { b.HostConfig.Binds = ["/etc:/work/project"]; }), "not allowed in volume mode");
  });
  test("Binds-only in volume mode (Mounts absent)", () => {
    expectReject(vrun((b) => { delete b.HostConfig.Mounts; }), "exactly 2 entries");
  });
  test("extra VolumeOptions keys (Labels / DriverConfig)", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.Labels = { a: "b" }; }), "unknown key HostConfig.Mounts[].VolumeOptions.Labels");
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].VolumeOptions.DriverConfig = {}; }), "unknown key HostConfig.Mounts[].VolumeOptions.DriverConfig");
  });
  test("ReadOnly mount", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].ReadOnly = true; }), "mount ReadOnly must be false");
  });
  test("top-level mount key Consistency present", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].Consistency = "default"; }), "unknown key HostConfig.Mounts[].Consistency");
  });
  test("wrong principal/name mismatch across mounts", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[1].VolumeOptions.Subpath = "storage/other/demo/hermes-home"; }), "same principal and name");
  });
  test("wrong Target", () => {
    expectReject(vrun((b) => { b.HostConfig.Mounts[0].Target = "/work/other"; }), "mount Target not allowed");
  });
});

describe("checkRoute: /coworkspace/volume control route (T-20260930-038)", () => {
  test("403 in bind mode, unconditionally", () => {
    for (const c of [CFG, { ...CFG, dataVolume: undefined }]) {
      const r = checkRoute("POST", "/coworkspace/volume", c, {});
      expect(r.allowed).toBe(false);
      if (!r.allowed) expect(r.reason).toContain("volume control route requires volume mode");
    }
  });
  test("volume mode: GET on the control route is denied", () => {
    const ok = checkRoute("GET", "/coworkspace/volume", VCFG, {});
    expect(ok.allowed).toBe(false);
  });
  test("volume mode: POST allowed (op volume), unknown query key denied", () => {
    const ok = checkRoute("POST", "/coworkspace/volume", VCFG, {});
    expect(ok.allowed && ok.op === "volume" && ok.mode === "buffered").toBe(true);
    expect(checkRoute("POST", "/coworkspace/volume?extra=1", VCFG, {}).allowed).toBe(false);
  });
  test("volume mode: only the boot data volume may be inspected, GET only", () => {
    const ok = checkRoute("GET", `/volumes/${VOL}`, VCFG, {});
    expect(ok.allowed && ok.op === "volinspect" && ok.mode === "piped").toBe(true);
    expect(checkRoute("GET", "/volumes/other-volume", VCFG, {}).allowed).toBe(false);
    expect(checkRoute("GET", "/volumes", VCFG, {}).allowed).toBe(false);
    expect(checkRoute("POST", `/volumes/${VOL}`, VCFG, {}).allowed).toBe(false);
    expect(checkRoute("GET", `/volumes/${VOL}`, CFG, {}).allowed).toBe(false);
    expect(checkRoute("GET", `/volumes/${VOL}?extra=1`, VCFG, {}).allowed).toBe(false);
  });
});

describe("validateCreate: claude/codex runtime profiles (2026-10-03 sibling-turns design)", () => {
  function claudeBody(): any {
    const b = fixtureBody();
    b.Entrypoint = ["claude"];
    b.Env = ["CLAUDE_CONFIG_DIR=/work/claude-home", "ANTHROPIC_API_KEY=sk-test"];
    b.HostConfig.Binds = [
      `${DATA}/storage/default/demo/project:/work/project`,
      `${DATA}/storage/default/demo/claude-home:/work/claude-home`,
    ];
    return b;
  }
  function codexBody(): any {
    const b = fixtureBody();
    b.Entrypoint = ["codex"];
    b.Env = ["CODEX_HOME=/work/codex-home", "OPENAI_API_KEY=sk-test"];
    b.HostConfig.Binds = [
      `${DATA}/storage/default/demo/project:/work/project`,
      `${DATA}/storage/default/demo/codex-home:/work/codex-home`,
    ];
    return b;
  }
  test("claude body accepted (entrypoint, env, project+claude-home binds)", () => {
    const res = validateCreate(JSON.stringify(claudeBody()), CFG, NAME);
    if (!res.ok) throw new Error(res.reason);
    expect(res.canonical.Entrypoint).toEqual(["claude"]);
    expect(res.canonical.Env).toEqual(["CLAUDE_CONFIG_DIR=/work/claude-home", "ANTHROPIC_API_KEY=sk-test"]);
    expect(res.facts.bindSources).toEqual([`${DATA}/storage/default/demo/project`, `${DATA}/storage/default/demo/claude-home`]);
  });
  test("codex body accepted", () => {
    const res = validateCreate(JSON.stringify(codexBody()), CFG, NAME);
    if (!res.ok) throw new Error(res.reason);
    expect(res.canonical.Entrypoint).toEqual(["codex"]);
  });
  test("claude + ANTHROPIC_BASE_URL (valid https) accepted; non-https/garbage rejected", () => {
    const ok = claudeBody();
    ok.Env.push("ANTHROPIC_BASE_URL=https://proxy.example.com/v1");
    const res = validateCreate(JSON.stringify(ok), CFG, NAME);
    if (!res.ok) throw new Error(res.reason);
    expect(res.canonical.Env).toContain("ANTHROPIC_BASE_URL=https://proxy.example.com/v1");
    for (const bad of ["http://proxy.example.com", "https://with space", "https://quote\"x", "javascript:alert(1)"]) {
      const b = claudeBody();
      b.Env.push(`ANTHROPIC_BASE_URL=${bad}`);
      expectReject(validateCreate(JSON.stringify(b), CFG, NAME), "ANTHROPIC_BASE_URL");
    }
  });
  test("agy entrypoint rejected (login-only runtime, not in the image)", () => {
    const b = claudeBody();
    b.Entrypoint = ["agy"];
    b.Env = ["SOME_ENV=1"];
    expectReject(validateCreate(JSON.stringify(b), CFG, NAME), "Entrypoint not allowed");
  });
  test("claude container must NOT receive the hermes home (home leaf pinned to the entrypoint)", () => {
    const b = claudeBody();
    b.HostConfig.Binds = [
      `${DATA}/storage/default/demo/project:/work/project`,
      `${DATA}/storage/default/demo/hermes-home:/work/hermes-home`,
    ];
    expectReject(validateCreate(JSON.stringify(b), CFG, NAME), "bind not allowed");
  });
  test("claude env missing CLAUDE_CONFIG_DIR rejected; hermes env on a claude body rejected", () => {
    const b = claudeBody();
    b.Env = ["ANTHROPIC_API_KEY=sk-test"];
    expectReject(validateCreate(JSON.stringify(b), CFG, NAME), "CLAUDE_CONFIG_DIR");
    const b2 = claudeBody();
    b2.Env = ["HERMES_HOME=/work/hermes-home", "HERMES_ACCEPT_HOOKS=1"];
    expectReject(validateCreate(JSON.stringify(b2), CFG, NAME), "not allowed");
  });
  test("codex volume-mode body accepted (subpaths project + codex-home); hermes-home subpath rejected", () => {
    const b = volumeFixtureBody();
    b.Entrypoint = ["codex"];
    b.Env = ["CODEX_HOME=/work/codex-home", "OPENAI_API_KEY=sk-test"];
    const mounts = b.HostConfig.Mounts as any[];
    mounts[1].Target = "/work/codex-home";
    mounts[1].VolumeOptions.Subpath = (mounts[1].VolumeOptions.Subpath as string).replace("hermes-home", "codex-home");
    const res = validateCreate(JSON.stringify(b), VCFG, VNAME);
    if (!res.ok) throw new Error(res.reason);
    expect(res.canonical.HostConfig.Mounts[1].Target).toBe("/work/codex-home");
    const bad = volumeFixtureBody();
    bad.Entrypoint = ["codex"];
    bad.Env = ["CODEX_HOME=/work/codex-home"];
    expectReject(validateCreate(JSON.stringify(bad), VCFG, VNAME), "mount Target not allowed");
  });
  test("two provider keys still rejected on a non-hermes body", () => {
    const b = claudeBody();
    b.Env = ["CLAUDE_CONFIG_DIR=/work/claude-home", "ANTHROPIC_API_KEY=k", "OPENAI_API_KEY=k"];
    expectReject(validateCreate(JSON.stringify(b), CFG, NAME), "more than one provider key");
  });
});
