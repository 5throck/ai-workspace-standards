/**
 * T-20260930-008: the create-body-validating Docker socket broker. Pure policy tests
 * (route allowlist, create-body rules, fleet-name scoping, list filtering) plus an
 * end-to-end pass through a live broker instance against a fake upstream HTTP server.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  createBrokerHandler,
  filterContainerList,
  isAllowedRequest,
  isOwnContainerName,
  validateCreateBody,
} from "../../services/co-workspace/src/docker-broker";

const CFG = { runtimeImage: "co-workspace-runtime:latest", dataDirHost: "/host/data" };

function validCreateBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    Image: "co-workspace-runtime:latest",
    HostConfig: {
      Privileged: false,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      User: "10000:10000",
      Binds: ["/host/data/storage/u/p:/work/project"],
      Memory: 536870912,
      PidsLimit: 128,
    },
    ...overrides,
  };
}

describe("broker route allowlist (isAllowedRequest)", () => {
  test("version probe and container list are allowed", () => {
    expect(isAllowedRequest("GET", "/version", "co-workspace-turn-").allowed).toBe(true);
    expect(isAllowedRequest("GET", "/containers/json", "co-workspace-turn-").allowed).toBe(true);
  });

  test("create requires a fleet-prefixed name", () => {
    expect(isAllowedRequest("POST", "/containers/create?name=co-workspace-turn-x-1", "co-workspace-turn-").allowed).toBe(true);
    expect(isAllowedRequest("POST", "/containers/create?name=evil", "co-workspace-turn-").allowed).toBe(false);
    expect(isAllowedRequest("POST", "/containers/create", "co-workspace-turn-").allowed).toBe(false);
  });

  test("container ops resolve only inside the fleet prefix", () => {
    for (const [method, action] of [["POST", "/start"], ["POST", "/wait"], ["POST", "/kill"], ["POST", "/attach"], ["GET", "/json"], ["DELETE", ""]] as const) {
      const ok = isAllowedRequest(method, `/containers/co-workspace-turn-x${action}`, "co-workspace-turn-");
      expect(ok.allowed).toBe(true);
      const foreign = isAllowedRequest(method, `/containers/other-project${action}`, "co-workspace-turn-");
      expect(foreign.allowed).toBe(false);
    }
  });

  test("everything outside the verified endpoint set is 403", () => {
    for (const [method, path] of [
      ["POST", "/containers/co-workspace-turn-x/exec"],
      ["POST", "/images/create"],
      ["GET", "/images/json"],
      ["GET", "/info"],
      ["POST", "/volumes/create"],
      ["POST", "/networks/create"],
      ["POST", "/build"],
      ["GET", "/swarm"],
      ["GET", "/containers/json?all=1", ], // still allowed shape — checked above; here: exec path variety
      ["PUT", "/containers/co-workspace-turn-x/start"],
    ] as const) {
      if (path === "/containers/json?all=1") continue;
      expect(isAllowedRequest(method, path, "co-workspace-turn-").allowed).toBe(false);
    }
  });
});

describe("create-body validation (validateCreateBody)", () => {
  test("a policy-conformant turn container passes", () => {
    expect(validateCreateBody(validCreateBody(), CFG).ok).toBe(true);
  });

  test("rejections", () => {
    expect(validateCreateBody(validCreateBody({ Image: "ubuntu:latest" }), CFG).reason).toContain("allowlisted runtime");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Privileged: true } }), CFG).reason).toContain("Privileged");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, CapDrop: ["SETPCAP"] } }), CFG).reason).toContain("CapDrop");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, SecurityOpt: [] } }), CFG).reason).toContain("no-new-privileges");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, User: "0:0" } }), CFG).reason).toContain("10000:10000");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, PidMode: "host" } }), CFG).reason).toContain("PidMode");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, NetworkMode: "host" } }), CFG).reason).toContain("NetworkMode");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Devices: [{ PathOnHost: "/dev/dri" }] } }), CFG).reason).toContain("Devices");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Memory: 0 } }), CFG).reason).toContain("Memory");
    expect(validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, PidsLimit: 0 } }), CFG).reason).toContain("PidsLimit");
    expect(
      validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Binds: ["/etc:/host-etc:ro"] } }), CFG).reason,
    ).toContain("outside the data dir");
    expect(
      validateCreateBody(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Mounts: [{ Type: "volume", Source: "db" }] } }), CFG).reason,
    ).toContain("Volume mounts");
  });

  test("missing data-dir host config fails closed", () => {
    const r = validateCreateBody(validCreateBody(), { runtimeImage: "co-workspace-runtime:latest", dataDirHost: undefined });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("misconfigured");
  });
});

describe("fleet scoping helpers", () => {
  test("isOwnContainerName strips the Docker leading slash", () => {
    expect(isOwnContainerName("/co-workspace-turn-ab-1234", "co-workspace-turn-")).toBe(true);
    expect(isOwnContainerName("co-workspace-turn-ab-1234", "co-workspace-turn-")).toBe(true);
    expect(isOwnContainerName("/other-runtime", "co-workspace-turn-")).toBe(false);
  });

  test("filterContainerList drops foreign containers", () => {
    const list = [
      { Id: "a", Names: ["/co-workspace-turn-ab-1"] },
      { Id: "b", Names: ["/prometheus"] },
      { Id: "c", Names: ["/co-workspace-turn-cd-2"] },
    ];
    const out = filterContainerList(list, "co-workspace-turn-") as Array<{ Id: string }>;
    expect(out.map((c) => c.Id)).toEqual(["a", "c"]);
  });
});

describe("broker end-to-end against a fake upstream", () => {
  let brokerBase = "";
  let seen: Array<{ method: string; path: string; body?: string }> = [];

  beforeAll(async () => {
    const upstream = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);
        seen.push({ method: req.method, path: url.pathname + url.search, body: req.method === "POST" ? await req.text() : undefined });
        if (url.pathname === "/containers/json") {
          return Response.json([
            { Id: "aaa", Names: ["/co-workspace-turn-ab-1"] },
            { Id: "bbb", Names: ["/sidecar"] },
          ]);
        }
        return new Response(JSON.stringify({ Id: "upstream-ok" }), { status: 201 });
      },
    });
    // The REAL production handler, pointed at the fake upstream.
    const broker = Bun.serve({
      port: 0,
      idleTimeout: 0,
      fetch: createBrokerHandler({
        port: 0,
        socket: "/var/run/docker.sock",
        upstream: `http://127.0.0.1:${upstream.port}`,
        namePrefix: "co-workspace-turn-",
        runtimeImage: "co-workspace-runtime:latest",
        dataDirHost: "/host/data",
      }),
    });
    brokerBase = `http://127.0.0.1:${broker.port}`;
    (globalThis as unknown as { __brokerStop?: () => void }).__brokerStop = () => { broker.stop(true); upstream.stop(true); };
  }, 15_000);

  afterAll(() => {
    (globalThis as unknown as { __brokerStop?: () => void }).__brokerStop?.();
  });

  test("403 outside the allowlist; valid create forwards the body; list is fleet-filtered", async () => {
    const denied = await fetch(`${brokerBase}/info`);
    expect(denied.status).toBe(403);
    expect((await denied.json()).error).toContain("allowlist");

    const exec = await fetch(`${brokerBase}/containers/co-workspace-turn-x/exec`, { method: "POST" });
    expect(exec.status).toBe(403);

    seen = [];
    const created = await fetch(`${brokerBase}/containers/create?name=co-workspace-turn-ab-1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validCreateBody()),
    });
    expect(created.status).toBe(201);
    expect(seen.some((s) => s.path === "/containers/create?name=co-workspace-turn-ab-1" && s.body?.includes('"CapDrop":["ALL"]'))).toBe(true);

    const privileged = await fetch(`${brokerBase}/containers/create?name=co-workspace-turn-ab-1`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validCreateBody({ HostConfig: { ...validCreateBody().HostConfig as object, Privileged: true } })),
    });
    expect(privileged.status).toBe(403);

    const foreignCreate = await fetch(`${brokerBase}/containers/create?name=sidecar`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(validCreateBody()),
    });
    expect(foreignCreate.status).toBe(403);

    const list = await fetch(`${brokerBase}/containers/json`);
    const names = (await list.json() as Array<{ Names: string[] }>).flatMap((c) => c.Names);
    expect(names).toEqual(["/co-workspace-turn-ab-1"]);
  }, 20_000);
});
