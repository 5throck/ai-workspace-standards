/**
 * T-20261125-003 — dry-run fidelity for delivery tombstones.
 *
 * Ticket: `--dry-run` did not report the TOMBSTONE refusal the real run enforces,
 * and `--tombstone` / `--clear-tombstone` were apply-mode only, so a dry-run could
 * not even preview the flag. Two independent claims are pinned here:
 *
 *  1. FIDELITY — a dry-run on a project whose manifest records a delivered file the
 *     project deleted emits the same TOMBSTONED row (severity ERROR, same table,
 *     same resolution text) and writes nothing. (Already true at HEAD; the ticket's
 *     co-deck observation no longer reproduces — see the evidence report.)
 *  2. PREVIEW — `--tombstone` under `--dry-run` is a read-only preview: it reports
 *     the would-be TOMBSTONED_SKIP, names an unmatched glob as a WARN, and persists
 *     nothing. Apply mode keeps the write.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { describe, test, expect, afterAll } from "bun:test";

import { baselineKeyFor } from "../../scripts/lib/upgrade-policy.ts";
import { gitCleanEnv } from "../../scripts/lib/git-env.ts";
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from "../helpers/fixture-git.ts";

const workspaceRoot = resolve(import.meta.dir, "..", "..");
const upgradeScript = join(workspaceRoot, "scripts", "upgrade-project.ts");
const VARIANT = "co-develop";

/** Delivered by the TEMPLATE TREE SYNC SYNC-absent branch — the tombstone vector. */
const REL = "docs/governance/agents/workflows.md";
const TEMPLATE_TEXT = readFileSync(join(workspaceRoot, "templates", "common", REL), "utf8");
const PRIOR_DELIVERED = `${TEMPLATE_TEXT.trimEnd()}\n<!-- prior delivery fixture (T-20261125-003) -->\n`;

const MANIFEST = join(".claude", "last-upgrade-delivery.json");
const created: string[] = [];

function makeProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), "upgrade-dry-run-tombstone-"));
  created.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync("git", ["init", "-q"], { cwd: tmp, env: gitCleanEnv(), stdio: ["ignore", "pipe", "pipe"] });
  assertFixtureGitIdentity(tmp);
  spawnSync("git", ["-C", tmp, "config", "user.email", "test@example.com"], { env: gitCleanEnv(), stdio: "ignore" });
  spawnSync("git", ["-C", tmp, "config", "user.name", "Test"], { env: gitCleanEnv(), stdio: "ignore" });
  mkdirSync(join(tmp, ".claude"), { recursive: true });
  writeFileSync(join(tmp, ".claude", "template-version.txt"), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  // Prior delivery recorded, project copy absent, NO tombstone entry yet.
  writeFileSync(
    join(tmp, MANIFEST),
    JSON.stringify(
      {
        schemaVersion: 2,
        timestamp: "fixture",
        project: "fixture",
        templateVersion: "0.0.0",
        templateSha: "",
        baseSha: "",
        files: [REL],
        baselines: { [REL]: { hash: baselineKeyFor(REL, PRIOR_DELIVERED), templateVersion: "0.0.0" } },
        decisions: [],
      },
      null,
      2,
    ) + "\n",
  );
  spawnSync("git", ["-C", tmp, "add", "-A"], { env: gitCleanEnv(), stdio: "ignore" });
  spawnSync("git", ["-C", tmp, "commit", "-q", "-m", "chore: prior delivery recorded"], {
    env: gitCleanEnv(),
    stdio: "ignore",
  });
  return tmp;
}

function run(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync("bun", [upgradeScript, tmp, "--variant", VARIANT, "--yes", ...extraArgs], {
    encoding: "utf-8",
    timeout: 600000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status ?? -1, out: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
}

afterAll(() => {
  for (const tmp of created) rmSync(tmp, { recursive: true, force: true });
});

describe("upgrade-project.ts dry-run tombstone fidelity (T-20261125-003)", () => {
  test("dry-run emits the TOMBSTONED row (ERROR), the resolution text, and writes nothing", () => {
    const tmp = makeProject();
    const seeded = readFileSync(join(tmp, MANIFEST), "utf8");
    const { status, out } = run(tmp, ["--dry-run"]);

    expect(status).toBe(1);
    // Same finding, same severity, same table as the apply run.
    expect(out).toContain(`TOMBSTONE (SKIP): ${REL}`);
    expect(out).toContain("delivery refused (severity ERROR)");
    expect(out).toContain(`confirm with --tombstone ${REL}`);
    expect(out).toContain("DELIVERY CONFLICTS");
    expect(out).toContain("Tombstoned paths — how to proceed");
    // Read-only: the manifest is byte-identical and the deleted path stays absent.
    expect(readFileSync(join(tmp, MANIFEST), "utf8")).toBe(seeded);
    expect(existsSync(join(tmp, REL))).toBe(false);
  }, 600000);

  test("--tombstone under --dry-run previews the grant and persists nothing", () => {
    const tmp = makeProject();
    const seeded = readFileSync(join(tmp, MANIFEST), "utf8");
    const { status, out } = run(tmp, ["--dry-run", "--tombstone", REL]);

    expect(out).not.toContain("apply-mode only");
    expect(out).toContain("previewed read-only");
    expect(out).toContain(`TOMBSTONE (would be recorded): ${REL}`);
    expect(out).toContain("dry-run writes nothing");
    expect(out).toContain(`TOMBSTONE GRANT (preview): 1 path(s) would be recorded by --tombstone ${REL}`);
    // The tombstone was the only ERROR → the preview exits 0, but writes nothing.
    expect(status).toBe(0);
    expect(readFileSync(join(tmp, MANIFEST), "utf8")).toBe(seeded);
    expect(existsSync(join(tmp, REL))).toBe(false);
  }, 600000);

  test("a --tombstone glob that matches nothing is named as a WARN and the refusal stands", () => {
    const tmp = makeProject();
    const { status, out } = run(tmp, ["--dry-run", "--tombstone", "docs/never-shipped/**"]);

    expect(out).toContain(
      "TOMBSTONE GRANT (preview): --tombstone docs/never-shipped/** matched NO tombstone candidate",
    );
    // The real path is still an unresolved ERROR — a wrong glob changes nothing.
    expect(out).toContain(`TOMBSTONE (SKIP): ${REL}`);
    expect(status).toBe(1);
  }, 600000);

  test("apply still refuses without the flag", () => {
    const tmp = makeProject();
    const { status, out } = run(tmp);

    expect(status).toBe(1);
    expect(out).toContain(`TOMBSTONE (SKIP): ${REL}`);
    expect(existsSync(join(tmp, REL))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(tmp, MANIFEST), "utf8"));
    expect(manifest.tombstones?.[REL]).toBeUndefined();
  }, 600000);

  test("apply with --tombstone records the entry, skips the delivery, and exits 0", () => {
    const tmp = makeProject();
    const { status, out } = run(tmp, ["--tombstone", REL]);

    expect(status).toBe(0);
    expect(out).toContain(`TOMBSTONE (recorded): ${REL}`);
    expect(existsSync(join(tmp, REL))).toBe(false);
    const manifest = JSON.parse(readFileSync(join(tmp, MANIFEST), "utf8"));
    expect(manifest.tombstones?.[REL]).toBeDefined();
    expect(manifest.tombstones[REL].hash).toBe(baselineKeyFor(REL, PRIOR_DELIVERED));
  }, 600000);
});
