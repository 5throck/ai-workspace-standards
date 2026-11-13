/**
 * lc-scaffold-warning-count.test.ts — T-20261112-009 verification harness.
 *
 * The gap: "Check LC warning count for delivered skills in a scaffold is
 * unverified" — new-project.ts only scaffolds inside the workspace root, so no
 * existing test ran Check LC against a fresh scaffold-shaped tree. This test
 * builds a minimal scaffold fixture (delivered skills, some WITH the
 * template-delivered lifecycle record, one WITHOUT) and runs
 * scripts/skill-lifecycle-audit.ts --json with cwd pinned to the fixture
 * (ROOT = cwd(), so the audit scans the fixture; IS_WORKSPACE_ROOT is false
 * there — the L0-only checks gate off, LC runs per U-20261028-011).
 *
 * The pin: a delivered skill WITH its template-delivered lifecycle record
 * produces ZERO LC warnings; a delivered active skill WITHOUT a record
 * produces EXACTLY ONE LC warning naming it. That is the SLR design's
 * contract ("delivered skills must arrive with a lifecycle record so Check LC
 * stays silent in projects" — docs/designs/2026-11-12-skill-lifecycle-record-delivery-design.md).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const AUDIT = join(REPO_ROOT, "scripts", "skill-lifecycle-audit.ts");
const tmpDirs: string[] = [];

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function skillMd(name: string): string {
  return `---
name: ${name}
description: Fixture skill ${name}.
version: 1.0.0
last_reviewed: 2026-11-14
status: active
owner: automation-engineer
scope: common
---

# ${name}

Fixture body.
`;
}

function recordMd(name: string, version = "1.0.0"): string {
  return `# ${name} Skill Lifecycle

## Metadata

- **Skill**: ${name}
- **Status**: active
- **Version**: ${version}
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-14 (fixture record)

## Created

Fixture.

## Phase History

Fixture.

## Acceptance Criteria

Fixture.

## Metadata

- **Version**: ${version}
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-14 (fixture record)
`;
}

function buildScaffold(opts: { withRecord: string[]; withoutRecord: string[] }): string {
  const tmp = mkdtempSync(join(tmpdir(), "lc-scaffold-"));
  tmpDirs.push(tmp);
  for (const name of opts.withRecord) {
    mkdirSync(join(tmp, "skills", name), { recursive: true });
    writeFileSync(join(tmp, "skills", name, "SKILL.md"), skillMd(name));
    mkdirSync(join(tmp, "docs", "lifecycle", "skills"), { recursive: true });
    writeFileSync(join(tmp, "docs", "lifecycle", "skills", `${name}.md`), recordMd(name));
  }
  for (const name of opts.withoutRecord) {
    mkdirSync(join(tmp, "skills", name), { recursive: true });
    writeFileSync(join(tmp, "skills", name, "SKILL.md"), skillMd(name));
  }
  return tmp;
}

function runAudit(fixture: string): { warnings: Array<{ file: string; message: string }>; errors: Array<{ file: string; message: string }> } {
  const p = spawnSync("bun", [AUDIT, "--json"], { cwd: fixture, encoding: "utf-8", timeout: 120000 });
  if (!p.stdout) throw new Error(`audit produced no stdout: ${p.stderr?.slice(0, 400)}`);
  const d = JSON.parse(p.stdout) as { warnings: Array<{ file: string; message: string }>; errors: Array<{ file: string; message: string }> };
  return { warnings: d.warnings ?? [], errors: d.errors ?? [] };
}

const lcWarnings = (r: { warnings: Array<{ file: string; message: string }> }) =>
  r.warnings.filter((w) => w.message.includes("No lifecycle record"));

describe("Check LC warning count for delivered skills in a scaffold (T-20261112-009 harness)", () => {
  test("delivered skills WITH template-delivered records: LC stays silent", () => {
    const fixture = buildScaffold({ withRecord: ["alpha", "beta"], withoutRecord: [] });
    const r = runAudit(fixture);
    const lc = lcWarnings(r);
    expect(lc.map((w) => `${w.file}: ${w.message}`)).toEqual([]);
  });

  test("a delivered active skill WITHOUT its record: exactly one LC warning naming it", () => {
    const fixture = buildScaffold({ withRecord: ["alpha"], withoutRecord: ["gamma"] });
    const r = runAudit(fixture);
    const lc = lcWarnings(r);
    expect(lc).toHaveLength(1);
    expect(lc[0].file).toBe("skills/gamma/SKILL.md");
    expect(lc[0].message).toContain("docs/lifecycle/skills/gamma.md");
  });

  test("MV arm: a record whose Metadata Version drifts from the SKILL.md is an ERROR, not a silent pass", () => {
    const fixture = buildScaffold({ withRecord: ["alpha"], withoutRecord: [] });
    const recPath = join(fixture, "docs", "lifecycle", "skills", "alpha.md");
    writeFileSync(recPath, recordMd("alpha", "0.9.0"));
    const r = runAudit(fixture);
    expect(r.errors.some((e) => e.message.includes("Lifecycle record version drift for alpha"))).toBe(true);
  });
});
