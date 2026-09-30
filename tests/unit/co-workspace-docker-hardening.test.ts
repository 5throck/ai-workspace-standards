import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as fs from "node:fs";
import { chownTree } from "../../services/co-workspace/src/tenant";

const DOCKER = "services/co-workspace/docker";
const read = (f: string) => readFileSync(join(DOCKER, f), "utf-8").replace(/\r\n/g, "\n");
const noComments = (s: string) => s.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

/** Text of one top-level compose service block. */
function serviceBlock(yml: string, name: string): string {
  const lines = noComments(yml).split("\n");
  const start = lines.findIndex((l) => l === `  ${name}:`);
  expect(start).toBeGreaterThan(-1);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {0,2}\S/.test(lines[i]!)) { end = i; break; }
  }
  return lines.slice(start, end).join("\n");
}

describe("Dockerfile hardening", () => {
  const lines = read("Dockerfile").split("\n");
  test("final USER is uid 10000 after the last RUN", () => {
    const users = lines.map((l, i) => [l, i] as const).filter(([l]) => /^USER\s/.test(l));
    const last = users[users.length - 1]!;
    expect(last[0]).toMatch(/^USER\s+10000(:10000)?$/);
    const lastRun = Math.max(...lines.map((l, i) => (/^RUN\s/.test(l) ? i : -1)));
    expect(last[1]).toBeGreaterThan(lastRun);
  });
  test("HOME=/home/gw", () => {
    expect(read("Dockerfile")).toMatch(/HOME=\/home\/gw/);
  });
});

describe("base compose", () => {
  const base = noComments(read("docker-compose.yml"));
  test("non-root, caps dropped", () => {
    expect(base).toMatch(/^\s+user:\s/m);
    expect(base).toMatch(/cap_drop:\s*\[ALL\]/);
    expect(base).toContain("no-new-privileges:true");
  });
  test("no raw socket and no seed-home mount", () => {
    expect(base).not.toContain("docker.sock");
    expect(base).not.toContain("/seed-home");
    expect(base).not.toContain(":?set CO_WORKSPACE_HERMES_SEED_HOME");
  });
});

describe("isolation override", () => {
  const iso = noComments(read("docker-compose.isolation.yml"));
  const broker = serviceBlock(read("docker-compose.isolation.yml"), "docker-broker");
  const gw = serviceBlock(read("docker-compose.isolation.yml"), "co-workspace");
  test("socket only in the broker block, read-only", () => {
    // host path + container path on the mount line, plus the CO_WORKSPACE_BROKER_SOCKET value.
    expect(iso.match(/docker\.sock/g)?.length).toBe(3);
    expect(broker).toMatch(/\/var\/run\/docker\.sock:\/var\/run\/docker\.sock:ro/);
    expect(gw).not.toContain("docker.sock");
  });
  test("broker is the create-body-validating broker, not the endpoint-only proxy", () => {
    // T-20260930-008: the tecnativa/docker-socket-proxy is replaced by our broker
    // (src/docker-broker.ts) — the endpoint filter cannot see the create body.
    expect(broker).toMatch(/command:\s*\["bun",\s*"src\/docker-broker\.ts"\]/);
    expect(iso).not.toContain("tecnativa");
    // T-20260930-027: scoping is by name regex + instance label (no name-prefix env); the
    // broker gets a read-only view of the data dir for the bind lstat walk.
    expect(broker).not.toMatch(/CO_WORKSPACE_BROKER_NAME_PREFIX/);
    expect(broker).toMatch(/CO_WORKSPACE_INSTANCE_ID/);
    expect(broker).toMatch(/\$\{CO_WORKSPACE_DATA_DIR_HOST[^}]*\}:\$\{CO_WORKSPACE_DATA_DIR_HOST\}:ro/);
    // Policy inputs mirror the gateway's own config — both sides must agree.
    expect(broker).toMatch(/CO_WORKSPACE_RUNTIME_IMAGE/);
    expect(broker).toMatch(/CO_WORKSPACE_DATA_DIR_HOST/);
  });
  test("broker runs root (socket DAC) with every capability dropped and a read-only fs", () => {
    expect(broker).toMatch(/user:\s*"0:0"/);
    expect(broker).toMatch(/cap_drop:\s*\[ALL\]/);
    expect(broker).toMatch(/no-new-privileges/);
    expect(broker).toMatch(/read_only:\s*true/);
  });
  test("gateway reaches the broker over DOCKER_HOST", () => {
    expect(gw).toContain("DOCKER_HOST: tcp://docker-broker:2375");
  });
  test("broker publishes nothing; dockerapi is internal", () => {
    expect(broker).not.toContain("ports:");
    expect(iso).toMatch(/networks:\n {2}dockerapi:\n {4}internal: true/);
  });
});

describe("seed override", () => {
  test("mounts the seed home read-only", () => {
    expect(noComments(read("docker-compose.seed.yml"))).toContain(":/seed-home:ro");
  });
});

describe("chownTree guard", () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

  test("non-root: does not throw and does not chown", () => {
    const d = mkdtempSync(join(tmpdir(), "chown-"));
    dirs.push(d);
    mkdirSync(join(d, "sub"));
    writeFileSync(join(d, "sub", "f"), "x");
    const orig = process.getuid;
    const spy = spyOn(fs, "chownSync");
    (process as { getuid?: () => number }).getuid = () => 1000;
    try {
      expect(() => chownTree(d, 10000, 10000)).not.toThrow();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      (process as { getuid?: () => number }).getuid = orig;
      spy.mockRestore();
    }
    expect(existsSync(d)).toBe(true);
  });
});
