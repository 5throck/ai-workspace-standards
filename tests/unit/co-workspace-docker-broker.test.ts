/**
 * T-20260930-027 step 2: integration tests of the RAW docker broker (src/docker-broker.ts)
 * against a fake daemon on a unix socket (tests/helpers/fake-docker-daemon.ts). The broker is
 * driven with raw TCP clients replaying the docker CLI 29.8.1 request sequence (design A1/A2);
 * the create body is the real CLI capture in tests/fixtures/docker-cli/create-request.json.
 * No real Docker daemon is used.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadBrokerConfig, parseRequestHead, startBroker, type BrokerConfig, type BrokerHandle } from "../../services/co-workspace/src/docker-broker";
import { loadPolicyConfig, validateCreate } from "../../services/co-workspace/src/docker-broker-policy";
import { dockerFrame, startFakeDockerDaemon, type FakeDaemon, type FakeDaemonOptions } from "../helpers/fake-docker-daemon";

const posixOnly = process.platform === "win32";
const T = 15_000;
const FIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request.json"), "utf8"));
const VFIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request-volume.json"), "utf8"));
const NAME = new URLSearchParams(FIXTURE.query).get("name") as string;
const VNAME = new URLSearchParams(VFIXTURE.query).get("name") as string;
const ID = "c".repeat(64);
const UA = FIXTURE.headers["user-agent"] as string;

interface Env {
  root: string;
  data: string;
  fake: FakeDaemon;
  broker: BrokerHandle;
  cfg: BrokerConfig;
  logs: string[];
}

let cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const f of cleanups.reverse()) await f();
  cleanups = [];
});

function setup(opts: { fake?: FakeDaemonOptions; cfg?: Partial<BrokerConfig>; socketPath?: string } = {}): Env {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "cows-brk-")));
  const data = `${root}/data`;
  mkdirSync(`${data}/storage/default/demo/project`, { recursive: true });
  mkdirSync(`${data}/storage/default/demo/hermes-home`, { recursive: true });
  const fake = startFakeDockerDaemon({ createId: ID, ...opts.fake });
  const logs: string[] = [];
  const cfg: BrokerConfig = {
    ...loadBrokerConfig({ CO_WORKSPACE_DATA_DIR_HOST: data, CO_WORKSPACE_BROKER_SOCKET: opts.socketPath ?? fake.socketPath }),
    port: 0,
    hostname: "127.0.0.1",
    log: (l) => logs.push(l),
    ...opts.cfg,
  };
  const broker = startBroker(cfg);
  cleanups.push(async () => {
    await broker.stop();
    await fake.stop();
    rmSync(root, { recursive: true, force: true });
  });
  return { root, data, fake, broker, cfg, logs };
}

function createBody(data: string): string {
  return (FIXTURE.body as string).split("<DATA>").join(data);
}

function req(method: string, target: string, headers: Record<string, string> = {}, body = ""): string {
  const h: Record<string, string> = { Host: "api.moby.localhost", "User-Agent": UA, ...headers };
  if (body && h["Content-Length"] === undefined) h["Content-Length"] = String(Buffer.byteLength(body));
  return `${method} ${target} HTTP/1.1\r\n${Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n${body}`;
}

interface Client {
  write(s: string | Uint8Array): void;
  shutdown(): void;
  received(): Buffer;
  closed: Promise<void>;
  isClosed(): boolean;
  waitFor(pred: (b: Buffer) => boolean, ms?: number): Promise<void>;
  end(): void;
}

async function connect(port: number): Promise<Client> {
  let buf = Buffer.alloc(0);
  let isClosed = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((r) => (resolveClosed = r));
  const waiters: Array<() => void> = [];
  const sock = await Bun.connect({
    hostname: "127.0.0.1",
    port,
    allowHalfOpen: true,
    socket: {
      data(_s, chunk) {
        buf = Buffer.concat([buf, chunk]);
        waiters.splice(0).forEach((f) => f());
      },
      end(s) {
        s.end();
      },
      close() {
        isClosed = true;
        resolveClosed();
        waiters.splice(0).forEach((f) => f());
      },
      error() {},
    },
  });
  return {
    write: (s) => void sock.write(s),
    shutdown: () => sock.shutdown(),
    received: () => buf,
    closed,
    isClosed: () => isClosed,
    end: () => sock.end(),
    async waitFor(pred, ms = 5000) {
      const deadline = Date.now() + ms;
      while (!pred(buf)) {
        if (isClosed || Date.now() > deadline) throw new Error(`waitFor timed out; got: ${buf.toString("latin1").slice(0, 300)}`);
        await new Promise<void>((r) => {
          waiters.push(r);
          setTimeout(r, 50);
        });
      }
    },
  };
}

/** One request, read until the broker closes the connection. */
async function exchange(port: number, raw: string): Promise<string> {
  const c = await connect(port);
  c.write(raw);
  await c.closed;
  return c.received().toString("latin1");
}

const statusOf = (resp: string) => Number(resp.slice(9, 12));
const bodyOf = (resp: string) => resp.slice(resp.indexOf("\r\n\r\n") + 4);

async function doCreate(e: Env, body = createBody(e.data), name = NAME): Promise<string> {
  return exchange(
    e.broker.port,
    req("POST", `/v1.56/containers/create?name=${name}`, { "Content-Type": "application/json" }, body),
  );
}

describe("parseRequestHead", () => {
  test("strict parsing", () => {
    expect(parseRequestHead("GET /_ping HTTP/1.1\r\nHost: x").ok).toBe(true);
    expect(parseRequestHead("GET /_ping HTTP/1.0\r\nHost: x").ok).toBe(false);
    expect(parseRequestHead("GET /_ping HTTP/1.1\r\nHost: x\r\n y").ok).toBe(false);
    expect(parseRequestHead("GET /_ping HTTP/1.1\r\nHo st: x").ok).toBe(false);
    expect(parseRequestHead("GET /_ping HTTP/1.1\r\nHost: x\ny: z").ok).toBe(false);
    expect(parseRequestHead("POST /x HTTP/1.1\r\nContent-Length: 1\r\ncontent-length: 1").ok).toBe(false);
    expect(parseRequestHead("POST /x HTTP/1.1\r\nContent-Length: +1").ok).toBe(false);
    expect(parseRequestHead("POST /x HTTP/1.1\r\nTransfer-Encoding: chunked").ok).toBe(false);
  });
});

describe("docker CLI sequence (A1) through the raw broker", () => {
  test.skipIf(posixOnly)(
    "ping, create (canonical body), attach with half-close, wait, start",
    async () => {
      const e = setup();
      const port = e.broker.port;
      for (let i = 0; i < 2; i++) {
        const r = await exchange(port, req("HEAD", "/_ping"));
        expect(statusOf(r)).toBe(200);
        expect(r).toContain("Api-Version: 1.56");
      }

      const body = createBody(e.data);
      const created = await doCreate(e, body);
      expect(statusOf(created)).toBe(201);
      expect(JSON.parse(bodyOf(created)).Id).toBe(ID);
      const up = e.fake.requests.find((r) => r.path.endsWith("/containers/create"))!;
      expect(up.path).toBe("/v1.56/containers/create");
      expect(up.target).toBe(`/v1.56/containers/create?name=${NAME}`);
      const v = validateCreate(body, { ...e.cfg.policy }, NAME);
      expect(v.ok).toBe(true);
      if (v.ok) expect(up.body).toBe(v.canonicalText);
      expect(up.headers.host).toBe("docker");
      expect(up.headers["content-length"]).toBe(String(Buffer.byteLength(up.body)));

      // attach on a separate connection
      const a = await connect(port);
      a.write(req("POST", `/v1.56/containers/${ID}/attach?stderr=1&stdin=1&stdout=1&stream=1`, {
        "Content-Type": "text/plain",
        "Content-Length": "0",
        Connection: "Upgrade",
        Upgrade: "tcp",
      }));
      await a.waitFor((b) => b.includes("\r\n\r\n"));
      expect(a.received().toString("latin1")).toStartWith("HTTP/1.1 101");
      a.write("hello stdin");
      a.shutdown();
      await a.closed;
      const out = a.received();
      expect(out.includes(dockerFrame(1, "echo:hello stdin"))).toBe(true);
      expect(out.includes(dockerFrame(2, "err-line\n"))).toBe(true);
      expect(e.fake.attachStdin).toEqual(["hello stdin"]);
      const attachReq = e.fake.requests.find((r) => r.path.endsWith("/attach"))!;
      expect(attachReq.path).toBe(`/v1.56/containers/${ID}/attach`);
      expect(attachReq.headers.upgrade).toBe("tcp");

      const w = await exchange(port, req("POST", `/v1.56/containers/${ID}/wait?condition=removed`, { "Content-Length": "0" }));
      expect(statusOf(w)).toBe(200);
      expect(JSON.parse(bodyOf(w))).toEqual({ StatusCode: 0 });
      const s = await exchange(port, req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      expect(statusOf(s)).toBe(204);
      expect(e.fake.requests.some((r) => r.path === `/v1.56/containers/${ID}/start`)).toBe(true);
      // logs never carry bodies or env values
      expect(e.logs.join("\n")).not.toContain("test-key");
      expect(e.logs.length).toBeGreaterThanOrEqual(6);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "large attach output (2 MiB) is forwarded whole — backpressure probe (T-009)",
    async () => {
      const e = setup({ fake: { attachOutputBytes: 2 * 1024 * 1024 } });
      expect(statusOf(await doCreate(e))).toBe(201);
      const a = await connect(e.broker.port);
      a.write(req("POST", `/v1.56/containers/${ID}/attach?stderr=1&stdin=1&stdout=1&stream=1`, {
        "Content-Type": "text/plain",
        "Content-Length": "0",
        Connection: "Upgrade",
        Upgrade: "tcp",
      }));
      await a.waitFor((b) => b.includes("\r\n\r\n"));
      a.write("go");
      a.shutdown();
      await a.closed;
      const out = a.received();
      // Locate the stdout frame by its header (stream 1, declared length = the full 2 MiB):
      // the frame is intact only if the broker forwarded the pump's partial writes verbatim.
      const hdr = Buffer.alloc(8);
      hdr[0] = 1;
      hdr.writeUInt32BE(2 * 1024 * 1024, 4);
      const at = out.indexOf(hdr);
      expect(at).toBeGreaterThan(0);
      // The full 2 MiB payload arrives after the header...
      expect(out.subarray(at + 8, at + 12).toString()).toBe("xxxx");
      expect(out.length).toBe(at + 8 + 2 * 1024 * 1024 + 8 + Buffer.byteLength("err-line\n"));
      // ...followed by the stderr frame...
      expect(out.indexOf(dockerFrame(2, "err-line\n"))).toBe(at + 8 + 2 * 1024 * 1024);
      // ...and the connection closes cleanly after the payload (no truncation, no hang).
      expect(a.isClosed()).toBe(true);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "kill by name and DELETE by short id resolve to the full id; version passes",
    async () => {
      const e = setup();
      expect(statusOf(await doCreate(e))).toBe(201);
      const k = await exchange(e.broker.port, req("POST", `/v1.56/containers/${NAME}/kill`, { "Content-Length": "0" }));
      expect(statusOf(k)).toBe(204);
      expect(e.fake.requests.some((r) => r.path === `/v1.56/containers/${ID}/kill`)).toBe(true);
      const d = await exchange(e.broker.port, req("DELETE", `/v1.56/containers/${ID.slice(0, 12)}?force=1`));
      expect(statusOf(d)).toBe(204);
      expect(e.fake.requests.some((r) => r.method === "DELETE" && r.target === `/v1.56/containers/${ID}?force=1`)).toBe(true);
      const ver = await exchange(e.broker.port, req("GET", "/v1.56/version"));
      expect(statusOf(ver)).toBe(200);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "foreign and unlabelled containers are 403 and only the internal inspect reaches the daemon",
    async () => {
      const e = setup();
      const foreign = "b".repeat(64);
      const unlabelled = "d".repeat(64);
      e.fake.containers.set(foreign, { Id: foreign, Name: "/postgres", Labels: { "co-workspace.instance": "default" }, Binds: null });
      e.fake.containers.set(unlabelled, { Id: unlabelled, Name: "/co-workspace-turn-x-12345678", Labels: {}, Binds: null });
      for (const id of [foreign, unlabelled]) {
        for (const r of [
          req("POST", `/v1.56/containers/${id}/kill`, { "Content-Length": "0" }),
          req("DELETE", `/v1.56/containers/${id.slice(0, 12)}?force=1`),
          req("POST", `/v1.56/containers/${id}/start`, { "Content-Length": "0" }),
        ]) {
          const resp = await exchange(e.broker.port, r);
          expect(statusOf(resp)).toBe(403);
          expect(JSON.parse(bodyOf(resp)).message).toContain("docker broker:");
          expect(bodyOf(resp)).not.toContain("SECRET");
        }
      }
      expect(e.fake.requests.every((r) => r.method === "GET" && r.path.endsWith("/json"))).toBe(true);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "GET /containers/json is filtered; inspect and resize are 403",
    async () => {
      const e = setup({
        fake: {
          list: [
            { Id: "1", Names: [`/${NAME}`], Labels: { "co-workspace.instance": "default" } },
            { Id: "2", Names: ["/postgres"], Labels: {} },
            { Id: "3", Names: [`/${NAME}`], Labels: { "co-workspace.instance": "other" } },
          ],
        },
      });
      const filters = encodeURIComponent(JSON.stringify({ label: { "co-workspace.instance=default": true } }));
      const l = await exchange(e.broker.port, req("GET", `/v1.56/containers/json?all=1&filters=${filters}`));
      expect(statusOf(l)).toBe(200);
      expect(JSON.parse(bodyOf(l)).map((c: { Id: string }) => c.Id)).toEqual(["1"]);
      const n = e.fake.requests.length;
      expect(statusOf(await exchange(e.broker.port, req("GET", `/v1.56/containers/${ID}/json`)))).toBe(403);
      expect(statusOf(await exchange(e.broker.port, req("POST", `/v1.56/containers/${ID}/resize?h=1&w=1`, { "Content-Length": "0" })))).toBe(403);
      expect(e.fake.requests.length).toBe(n);
    },
    T,
  );
});

describe("attacks through the socket", () => {
  const attacks: Array<[string, (b: any, data: string) => void]> = [
    ["Privileged", (b) => (b.HostConfig.Privileged = true)],
    ["CapAdd", (b) => (b.HostConfig.CapAdd = ["SYS_ADMIN"])],
    ["HostConfig.User", (b) => (b.HostConfig.User = "0:0")],
    ["top-level User", (b) => (b.User = "0:0")],
    ["bind /etc", (b) => (b.HostConfig.Binds[0] = "/etc:/work/project")],
    ["bind ..", (b, d) => (b.HostConfig.Binds[0] = `${d}/../..:/work/project`)],
    ["Mounts", (b) => (b.HostConfig.Mounts = [{ Type: "bind", Source: "/", Target: "/h" }])],
    ["PidMode", (b) => (b.HostConfig.PidMode = "host")],
    ["image", (b) => (b.Image = "alpine:latest")],
    ["forged instance label", (b) => (b.Labels["co-workspace.instance"] = "other")],
  ];
  for (const [label, mut] of attacks) {
    test.skipIf(posixOnly)(
      `create attack: ${label} -> 403, daemon receives nothing`,
      async () => {
        const e = setup();
        const b = JSON.parse(createBody(e.data));
        mut(b, e.data);
        const r = await doCreate(e, JSON.stringify(b));
        expect(statusOf(r)).toBe(403);
        expect(e.fake.requests.length).toBe(0);
      },
      T,
    );
  }

  test.skipIf(posixOnly)(
    "framing attacks: TE chunked, CL+TE, duplicate CL, oversize body, %2F ref",
    async () => {
      const e = setup();
      const body = createBody(e.data);
      const target = `/v1.56/containers/create?name=${NAME}`;
      const chunked = `${Buffer.byteLength(body).toString(16)}\r\n${body}\r\n0\r\n\r\n`;
      expect(statusOf(await exchange(e.broker.port, req("POST", target, { "Transfer-Encoding": "chunked" }, chunked)))).toBe(400);
      expect(
        statusOf(
          await exchange(e.broker.port, req("POST", target, { "Content-Length": String(Buffer.byteLength(body)), "Transfer-Encoding": "chunked" }, body)),
        ),
      ).toBe(400);
      const dup = `POST ${target} HTTP/1.1\r\nHost: x\r\nContent-Length: ${Buffer.byteLength(body)}\r\nContent-Length: 0\r\n\r\n${body}`;
      expect(statusOf(await exchange(e.broker.port, dup))).toBe(400);
      const c = await connect(e.broker.port);
      c.write(`POST ${target} HTTP/1.1\r\nHost: x\r\nContent-Length: ${65 * 1024}\r\n\r\n`);
      await c.closed;
      expect(statusOf(c.received().toString("latin1"))).toBe(413);
      const pct = await exchange(e.broker.port, req("POST", `/v1.56/containers/co-workspace-turn-a%2F..-12345678/kill`, { "Content-Length": "0" }));
      expect([400, 403]).toContain(statusOf(pct));
      expect(e.fake.requests.length).toBe(0);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "pipelined second request in one write is never forwarded and the connection closes",
    async () => {
      const e = setup();
      const r = await exchange(e.broker.port, req("GET", "/v1.56/version") + req("POST", "/v1.56/containers/abcdefabcdef/kill", { "Content-Length": "0" }));
      expect(r).not.toContain("HTTP/1.1 2");
      await Bun.sleep(50);
      expect(e.fake.requests.length).toBe(0);
      expect(e.logs.some((l) => l.includes("pipelined"))).toBe(true);
      // a create body followed by extra bytes is likewise dropped
      const body = createBody(e.data);
      const r2 = await exchange(e.broker.port, req("POST", `/v1.56/containers/create?name=${NAME}`, { "Content-Type": "application/json" }, body) + "GET /v1.56/info HTTP/1.1\r\n\r\n");
      expect(r2).toBe("");
      await Bun.sleep(50);
      expect(e.fake.requests.length).toBe(0);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "tenant dir swapped for a symlink after create is caught by the start re-check",
    async () => {
      const e = setup();
      expect(statusOf(await doCreate(e))).toBe(201);
      rmSync(`${e.data}/storage/default/demo/project`, { recursive: true });
      symlinkSync("/", `${e.data}/storage/default/demo/project`);
      const s = await exchange(e.broker.port, req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      expect(statusOf(s)).toBe(403);
      expect(bodyOf(s)).toContain("symlink");
      expect(e.fake.requests.some((r) => r.path.endsWith("/start"))).toBe(false);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "a tenant dir that is already a symlink at create time is denied and never forwarded",
    async () => {
      const e = setup();
      rmSync(`${e.data}/storage/default/demo/project`, { recursive: true });
      symlinkSync("/", `${e.data}/storage/default/demo/project`);
      const s = await doCreate(e);
      expect(statusOf(s)).toBe(403);
      expect(bodyOf(s)).toContain("symlink");
      expect(e.fake.requests.some((r) => r.path.endsWith("/containers/create"))).toBe(false);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "bytes sent while a request is in flight are never forwarded and close the connection",
    async () => {
      const e = setup({
        fake: { override: (r) => (r.path.endsWith("/wait") ? { status: "200 OK", hold: true } : undefined) },
      });
      expect(statusOf(await doCreate(e))).toBe(201);
      const c = await connect(e.broker.port);
      c.write(req("POST", `/v1.56/containers/${ID}/wait?condition=removed`, { "Content-Length": "0" }));
      // wait until the broker has forwarded the wait upstream (the request is now in flight)
      const deadline = Date.now() + 5000;
      while (!e.fake.requests.some((r) => r.path.endsWith("/wait")) && Date.now() < deadline) await Bun.sleep(20);
      expect(e.fake.requests.some((r) => r.path.endsWith("/wait"))).toBe(true);
      // a second request pipelined on the same connection while the first is still running
      c.write(req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      await Promise.race([c.closed, Bun.sleep(3000)]);
      expect(c.isClosed()).toBe(true);
      expect(e.fake.requests.some((r) => r.path.endsWith("/start"))).toBe(false);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "start is denied when the daemon reports binds different from the ones recorded at create",
    async () => {
      const e = setup();
      expect(statusOf(await doCreate(e))).toBe(201);
      e.fake.containers.get(ID)!.Binds = ["/:/work/project"];
      const s = await exchange(e.broker.port, req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      expect(statusOf(s)).toBe(403);
      expect(e.fake.requests.some((r) => r.path.endsWith("/start"))).toBe(false);
    },
    T,
  );
});

// =============================================================================================
// T-20260930-038: volume-subpath mode through the raw broker (design 2026-09-30, sections 4-5)
// =============================================================================================

const VOLDATA = "cow-vol-test";

function volumeBody(vol: string): string {
  return (VFIXTURE.body as string).split("<VOL>").join(vol);
}

/** Volume-mode env: same harness as setup(), with CO_WORKSPACE_DATA_VOLUME set. */
function setupVolume(opts: { cfg?: Partial<BrokerConfig>; fake?: FakeDaemonOptions } = {}): Env {
  return setup({
    fake: opts.fake,
    cfg: { ...opts.cfg, policy: { ...loadPolicyConfig({}), dataVolume: VOLDATA } },
  });
}

async function doVolCreate(e: Env, body = volumeBody(VOLDATA), name = VNAME): Promise<string> {
  return exchange(
    e.broker.port,
    req("POST", `/v1.56/containers/create?name=${VNAME}`, { "Content-Type": "application/json" }, body),
  );
}

describe("volume mode through the raw broker (T-20260930-038)", () => {
  test.skipIf(posixOnly)(
    "create is accepted, canonical mounts forwarded, start re-check passes on identical Mounts",
    async () => {
      const e = setupVolume();
      const port = e.broker.port;
      const created = await doVolCreate(e);
      expect(statusOf(created)).toBe(201);
      const v = validateCreate(volumeBody(VOLDATA), e.cfg.policy, VNAME);
      expect(v.ok).toBe(true);
      const up = e.fake.requests.find((r) => r.path.endsWith("/containers/create"))!;
      expect(up.body).toBe(v.canonicalText);
      const canonicalMounts = JSON.parse(up.body).HostConfig.Mounts;
      expect(canonicalMounts).toEqual([
        { Type: "volume", Source: VOLDATA, Target: "/work/project", VolumeOptions: { Subpath: "storage/default/demo/project" } },
        { Type: "volume", Source: VOLDATA, Target: "/work/hermes-home", VolumeOptions: { Subpath: "storage/default/demo/hermes-home" } },
      ]);
      const s = await exchange(port, req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      expect(statusOf(s)).toBe(204);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "start is denied when a Subpath in the daemon-reported Mounts changed since create",
    async () => {
      const e = setupVolume();
      expect(statusOf(await doVolCreate(e))).toBe(201);
      e.fake.containers.get(ID)!.Mounts![0].VolumeOptions.Subpath = "../escape";
      const s = await exchange(e.broker.port, req("POST", `/v1.56/containers/${ID}/start`, { "Content-Length": "0" }));
      expect(statusOf(s)).toBe(403);
      expect(bodyOf(s)).toContain("mounts changed since create");
      expect(e.fake.requests.some((r) => r.path.endsWith("/start"))).toBe(false);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "volume-mode create attacks -> 403 and the daemon receives nothing",
    async () => {
      const e = setupVolume();
      for (const [label, mut] of [
        ["subpath .. escape", (b: any) => (b.HostConfig.Mounts[0].VolumeOptions.Subpath = "../escape")],
        ["subpath absolute", (b: any) => (b.HostConfig.Mounts[0].VolumeOptions.Subpath = "/abs")],
        ["subpath a/../b traversal", (b: any) => (b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/default/../demo/project")],
        ["subpath missing leaf", (b: any) => (b.HostConfig.Mounts[0].VolumeOptions.Subpath = "storage/default/demo")],
        ["wrong Source volume", (b: any) => (b.HostConfig.Mounts[0].Source = "other-volume")],
        ["non-volume Type", (b: any) => (b.HostConfig.Mounts[0].Type = "bind")],
        ["third mount entry", (b: any) => b.HostConfig.Mounts.push(b.HostConfig.Mounts[0])],
        ["mixed Binds+Mounts", (b: any) => (b.HostConfig.Binds = ["/etc:/work/project"])],
        ["Binds-only in volume mode", (b: any) => delete b.HostConfig.Mounts],
        ["extra VolumeOptions key", (b: any) => (b.HostConfig.Mounts[0].VolumeOptions.Labels = { a: "b" })],
        ["ReadOnly mount", (b: any) => (b.HostConfig.Mounts[0].ReadOnly = true)],
        ["duplicate target", (b: any) => {
          b.HostConfig.Mounts[1].Target = "/work/project";
          b.HostConfig.Mounts[1].VolumeOptions.Subpath = "storage/default/demo/project";
        }],
        ["wrong Target", (b: any) => (b.HostConfig.Mounts[0].Target = "/work/other")],
        ["principal/name mismatch", (b: any) => (b.HostConfig.Mounts[1].VolumeOptions.Subpath = "storage/other/demo/hermes-home")],
      ] as Array<[string, (b: any) => void]>) {
        const body = JSON.parse(volumeBody(VOLDATA));
        mut(body);
        const r = await doVolCreate(e, JSON.stringify(body));
        expect(statusOf(r)).toBe(403);
        expect(e.fake.requests.length).toBe(0);
        void label;
      }
    },
    T,
  );

  test.skipIf(posixOnly)(
    "bind-mode broker denies /coworkspace/volume before anything reaches the daemon",
    async () => {
      const e = setup();
      const r = await exchange(
        e.broker.port,
        req("POST", "/coworkspace/volume", { "Content-Type": "application/json" }, JSON.stringify({ op: "init", subpath: "storage/default/demo" })),
      );
      expect(statusOf(r)).toBe(403);
      expect(e.fake.requests.length).toBe(0);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "volume mode: init helper runs (reserved name, broker-built body) and attacks are rejected",
    async () => {
      const e = setupVolume();
      const port = e.broker.port;
      const ctrl = (body: string, headers: Record<string, string> = {}) =>
        exchange(port, req("POST", "/coworkspace/volume", { "Content-Type": "application/json", ...headers }, body));

      expect(statusOf(await ctrl("not json"))).toBe(400);
      expect(statusOf(await ctrl(JSON.stringify({ op: "exec", subpath: "storage/default/demo" })))).toBe(400);
      for (const bad of ["../escape", "/abs", "storage/default/demo/project", "storage/../x/demo"]) {
        expect(statusOf(await ctrl(JSON.stringify({ op: "init", subpath: bad })))).toBe(400);
      }
      expect(e.fake.requests.length).toBe(0);

      const ok = await ctrl(JSON.stringify({ op: "init", subpath: "storage/default/demo" }));
      expect(statusOf(ok)).toBe(204);
      const helper = e.fake.requests.find((r) => r.target.startsWith("/containers/create?name=co-workspace-vol-control-"))!;
      expect(helper).toBeDefined();
      const hbody = JSON.parse(helper.body);
      expect(hbody.Cmd).toEqual([
        "sh", "-c",
        "mkdir -p /v/storage/default/demo/project /v/storage/default/demo/hermes-home && chown -R 10000:10000 /v/storage/default/demo && chmod 700 /v/storage/default/demo",
      ]);
      expect(hbody.HostConfig.Mounts).toEqual([
        { Type: "volume", Source: VOLDATA, Target: "/v" },
      ]);
      // helper start + wait + forced delete happened
      expect(e.fake.requests.some((r) => /^\/containers\/[^/]+\/start$/.test(r.path))).toBe(true);
      expect(e.fake.requests.some((r) => r.path.endsWith("/wait"))).toBe(true);
      expect(e.fake.requests.some((r) => r.method === "DELETE")).toBe(true);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "volume-mode boot probe passthrough: GET /volumes/<dataVolume> is relayed, others denied",
    async () => {
      const e = setupVolume();
      const get = (t: string) => exchange(e.broker.port, req("GET", t, { "Content-Length": "0" }));
      // The fake daemon 404s unknown routes: a 404 here proves the broker RELAYED the request.
      expect(statusOf(await get(`/v1.56/volumes/${VOLDATA}`))).toBe(404);
      expect(e.fake.requests.some((r) => r.path === "/v1.56/volumes/cow-vol-test")).toBe(true);
      const denied1 = await get(`/v1.56/volumes/other`);
      expect(statusOf(denied1)).toBe(403);
      const denied2 = await get(`/v1.56/volumes`);
      expect(statusOf(denied2)).toBe(403);
      expect(e.fake.requests.some((r) => r.path.includes("/volumes/other") || r.path === "/v1.56/volumes")).toBe(false);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "volume control token: mismatch is 403 (defense in depth), correct token passes",
    async () => {
      const e = setupVolume({ cfg: { brokerToken: "s3cret" } });
      const ctrl = (headers: Record<string, string>) =>
        exchange(
          e.broker.port,
          req("POST", "/coworkspace/volume", { "Content-Type": "application/json", ...headers }, JSON.stringify({ op: "rm", subpath: "storage/default/demo" })),
        );
      expect(statusOf(await ctrl({}))).toBe(403);
      expect(statusOf(await ctrl({ "X-Co-Workspace-Token": "wrong" }))).toBe(403);
      expect(e.fake.requests.length).toBe(0);
      expect(statusOf(await ctrl({ "X-Co-Workspace-Token": "s3cret" }))).toBe(204);
    },
    T,
  );
});

describe("limits and failures", () => {
  test.skipIf(posixOnly)(
    "upstream down -> 502",
    async () => {
      const e = setup({ socketPath: "/nonexistent/docker.sock" });
      expect(statusOf(await exchange(e.broker.port, req("HEAD", "/_ping")))).toBe(502);
      expect(statusOf(await doCreate(e))).toBe(502);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "connection limit -> 503",
    async () => {
      const e = setup({ cfg: { maxConn: 2 } });
      const a = await connect(e.broker.port);
      const b = await connect(e.broker.port);
      await Bun.sleep(50);
      const c = await connect(e.broker.port);
      await c.closed;
      expect(statusOf(c.received().toString("latin1"))).toBe(503);
      a.end();
      b.end();
      await Promise.all([a.closed, b.closed]);
      await Bun.sleep(50);
      expect(statusOf(await exchange(e.broker.port, req("HEAD", "/_ping")))).toBe(200);
    },
    T,
  );

  test.skipIf(posixOnly)(
    "slow head -> 408 and close",
    async () => {
      const e = setup({ cfg: { headTimeoutMs: 200 } });
      const c = await connect(e.broker.port);
      c.write("GET /_ping HTTP/1.1\r\nHo");
      await c.closed;
      expect(statusOf(c.received().toString("latin1"))).toBe(408);
      expect(e.fake.requests.length).toBe(0);
    },
    T,
  );
});
