import { describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hermesSpawnArgv, runHermesTurn, turnContainerName, type HermesSpawnOptions } from "../../services/co-workspace/src/hermes";
import { reapOrphanedTurns } from "../../services/co-workspace/src/reaper";

const base: HermesSpawnOptions = {
  hermesBin: "hermes",
  projectDir: "/data/p",
  hermesHome: "/data/h",
  message: "hi",
  sessionName: "gw-x",
  runBudgetSeconds: 300,
  maxTurns: 100,
};
const IMAGE = "co-workspace-runtime:latest";
const posix = { skip: process.platform === "win32" };

function fakeDir(): string {
  const d = join(tmpdir(), `gw-reap-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(d, { recursive: true });
  return d;
}
function fakeBin(dir: string, name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, `#!/bin/sh\n${body}\n`);
  chmodSync(p, 0o755);
  return p;
}
// Log path is baked into the script: Bun.spawn does not reliably see process.env mutations.
const logCmd = (log: string) => `echo "$@" >> "${log}"`;

describe("turn container argv (pure)", () => {
  test("argv[0] honors container.dockerBin, defaults to docker", () => {
    expect(hermesSpawnArgv({ ...base, container: { image: IMAGE, dockerBin: "/x/podman" } })[0]).toBe("/x/podman");
    expect(hermesSpawnArgv({ ...base, container: { image: IMAGE } })[0]).toBe("docker");
  });

  test("argv carries --init, --name and labels before the image", () => {
    const argv = hermesSpawnArgv({
      ...base,
      container: { image: IMAGE, name: "n1", tenantId: "gw/x y", instance: "inst" },
    });
    expect(argv.slice(1, 4)).toEqual(["run", "--rm", "--interactive"]);
    const img = argv.indexOf(IMAGE);
    expect(argv.indexOf("--init")).toBeGreaterThan(0);
    expect(argv.indexOf("--init")).toBeLessThan(img);
    expect(argv[argv.indexOf("--name") + 1]).toBe("n1");
    expect(argv.indexOf("--name")).toBeLessThan(img);
    const labels = argv.flatMap((a, i) => (a === "--label" ? [argv[i + 1]] : []));
    expect(labels).toEqual(["co-workspace.turn=1", "co-workspace.tenant=gw-x-y", "co-workspace.instance=inst"]);
    expect(argv.lastIndexOf("--label")).toBeLessThan(img);
  });

  test("turnContainerName sanitizes, stays <= 63 chars, and is unique", () => {
    const a = turnContainerName("weird tenant/id;$(x)" + "z".repeat(80));
    expect(a).toMatch(/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/);
    expect(a.length).toBeLessThanOrEqual(63);
    expect(turnContainerName("t")).not.toBe(turnContainerName("t"));
  });
});

describe("reapOrphanedTurns (fake docker)", () => {
  const cfgFor = (bin: string) => ({ dockerBin: bin, instanceId: "inst-a" });

  test.skipIf(posix.skip)("removes labeled containers by exact IDs", () => {
    const dir = fakeDir();
    const log = join(dir, "log");
    try {
      const bin = fakeBin(dir, "docker", `${logCmd(log)}
if [ "$1" = ps ]; then
  case "$*" in *label=co-workspace.turn=1*label=co-workspace.instance=inst-a*) echo aaaaaaaaaaaa; echo bbbbbbbbbbbb;; esac
fi`);
      expect(reapOrphanedTurns(cfgFor(bin))).toEqual({ found: 2, killed: 2 });
      expect(readFileSync(log, "utf8")).toContain("rm -f aaaaaaaaaaaa bbbbbbbbbbbb");
      expect(reapOrphanedTurns({ dockerBin: bin, instanceId: "other" })).toEqual({ found: 0, killed: 0 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(posix.skip)("drops non-hex ps lines", () => {
    const dir = fakeDir();
    const log = join(dir, "log");
    try {
      const bin = fakeBin(dir, "docker", `${logCmd(log)}
if [ "$1" = ps ]; then echo 'evil;rm'; echo cccccccccccc; fi`);
      expect(reapOrphanedTurns(cfgFor(bin))).toEqual({ found: 1, killed: 1 });
      expect(readFileSync(log, "utf8")).not.toContain("evil");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(posix.skip)("ps failure returns error without throwing", () => {
    const dir = fakeDir();
    try {
      const bin = fakeBin(dir, "docker", "echo boom >&2; exit 1");
      const r = reapOrphanedTurns(cfgFor(bin));
      expect(r.error).toBeTruthy();
      expect(r.found).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test.skipIf(posix.skip)("timeout returns error without throwing", () => {
    const dir = fakeDir();
    try {
      const bin = fakeBin(dir, "docker", "sleep 5");
      const r = reapOrphanedTurns(cfgFor(bin), { timeoutMs: 500 });
      expect(r.error).toBeTruthy();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("nonexistent docker binary returns error without throwing", () => {
    const r = reapOrphanedTurns(cfgFor(join(tmpdir(), "no-such-docker-" + crypto.randomUUID())));
    expect(r.error).toBeTruthy();
    expect(r.found).toBe(0);
  });
});

describe("kill wrapper", () => {
  test.skipIf(posix.skip)("killing the onSpawn proc also runs `docker kill <name>`", async () => {
    const dir = fakeDir();
    const log = join(dir, "log");
    try {
      const bin = fakeBin(dir, "docker", `${logCmd(log)}
# exec: the shell becomes sleep, so SIGTERM ends it (and closes stdout) immediately instead of
# leaving a sleep child that keeps the pipe open for the full duration.
if [ "$1" = run ]; then exec sleep 5; fi`);
      let handle: { kill: (c?: number) => void } | undefined;
      const p = runHermesTurn({
        ...base,
        env: { PATH: process.env.PATH },
        container: { image: IMAGE, dockerBin: bin, name: "x" },
        onSpawn: (proc) => {
          handle = proc;
        },
      }).catch(() => undefined);
      while (!handle) await Bun.sleep(10);
      handle.kill();
      let seen = false;
      for (let i = 0; i < 40 && !seen; i++) {
        await Bun.sleep(50);
        seen = existsSync(log) && readFileSync(log, "utf8").includes("kill x");
      }
      expect(seen).toBe(true);
      await p;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 15_000);
});
