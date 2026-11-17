#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-cv02.test.ts — CV-02 same-version-content-change (DEC-20261111-01 PR-D)

import { describe, expect, test } from "bun:test";
import {
  cv02CommonTwinPath,
  extractCv02Version,
  findSameVersionContentChanges,
  partitionCv02Converged,
} from "../../scripts/validate-templates.ts";

const ts = (v: string, body: string) => `// @version ${v}\n${body}\n`;
const skill = (v: string, body: string) => `---\nname: x\nversion: ${v}\n---\n${body}\n`;

describe("extractCv02Version", () => {
  test("ts, skill, agent and inline doc forms", () => {
    expect(extractCv02Version("templates/common/scripts/a.ts", ts("1.2.3", "x"))).toBe("1.2.3");
    expect(extractCv02Version("templates/common/skills/s/SKILL.md", skill("2.0.0", "x"))).toBe("2.0.0");
    expect(extractCv02Version("templates/common/agents/pm.md", skill("1.0.1", "x"))).toBe("1.0.1");
    expect(extractCv02Version("templates/common/docs/guide.md", "body\n*guide.md version: 1.4*\n")).toBe("1.4");
  });
  test("unversioned or unsupported files yield undefined", () => {
    expect(extractCv02Version("templates/common/docs/plain.md", "no version")).toBeUndefined();
    expect(extractCv02Version("templates/common/x.json", "{}")).toBeUndefined();
  });
});

describe("findSameVersionContentChanges", () => {
  test("flags changed content with equal version", () => {
    const r = findSameVersionContentChanges([
      { path: "templates/common/scripts/a.ts", base: ts("1.0.0", "a"), head: ts("1.0.0", "b") },
    ]);
    expect(r).toEqual([{ path: "templates/common/scripts/a.ts", version: "1.0.0" }]);
  });
  test("passes when version bumped", () => {
    expect(
      findSameVersionContentChanges([
        { path: "templates/co-x/.claude/skills/s/SKILL.md", base: skill("1.0.0", "a"), head: skill("1.0.1", "b") },
      ]),
    ).toEqual([]);
  });
  test("passes identical bytes and unversioned files", () => {
    expect(
      findSameVersionContentChanges([
        { path: "templates/common/scripts/a.ts", base: ts("1.0.0", "a"), head: ts("1.0.0", "a") },
        { path: "templates/common/docs/plain.md", base: "a", head: "b" },
      ]),
    ).toEqual([]);
  });
  test("flags inline doc footer with unchanged version", () => {
    const r = findSameVersionContentChanges([
      { path: "templates/common/docs/guide.md", base: "a\n*guide.md version: 1.4*\n", head: "b\n*guide.md version: 1.4*\n" },
    ]);
    expect(r).toHaveLength(1);
  });
});

describe("CV-02 end to end", () => {
  test("clean repo vs HEAD reports no CV-02 error", () => {
    const p = Bun.spawnSync(["bun", "scripts/validate-templates.ts", "--json"], {
      cwd: import.meta.dir + "/../..",
      env: { ...process.env, CV02_BASE: "HEAD" },
    });
    expect(p.stdout.toString()).not.toContain("same-version-content-change");
  });
});

// v1.84.0 (DEC-20261117-07): convergence-to-common exemption. A variant copy re-synced to
// its common source no longer trips CV-02 — "equal version ⇒ same content" is TRUE again.
describe("CV-02 convergence exemption", () => {
  const convergedPath = "templates/co-x/.claude/skills/s/SKILL.md";
  const change = { path: convergedPath, version: "1.0.0" };

  test("cv02CommonTwinPath maps variant copies to templates/common", () => {
    expect(cv02CommonTwinPath(convergedPath)).toBe("templates/common/.claude/skills/s/SKILL.md");
    expect(cv02CommonTwinPath("templates/co-design/skills/s/SKILL.md")).toBe("templates/common/skills/s/SKILL.md");
    // common's own files have no twin (no exemption path exists for them)
    expect(cv02CommonTwinPath("templates/common/skills/s/SKILL.md")).toBeNull();
  });

  test("converged copy (head == common) at constant version is exempt, not failing", () => {
    const r = partitionCv02Converged([
      { change, head: skill("1.0.0", "a"), common: skill("1.0.0", "a") },
    ]);
    expect(r.converged).toEqual([change]);
    expect(r.failing).toEqual([]);
  });

  test("divergent head at constant version still fails", () => {
    const r = partitionCv02Converged([
      { change, head: skill("1.0.0", "variant-edit"), common: skill("1.0.0", "a") },
    ]);
    expect(r.failing).toEqual([change]);
    expect(r.converged).toEqual([]);
  });

  test("no common twin still fails", () => {
    const r = partitionCv02Converged([{ change, head: skill("1.0.0", "a"), common: null }]);
    expect(r.failing).toEqual([change]);
    expect(r.converged).toEqual([]);
  });

  test("added/deleted/renamed stay out of scope (findSameVersionContentChanges universe)", () => {
    // The check collects only --diff-filter=M paths; unchanged bytes on a modified path are
    // not candidates, and the partition never invents candidates of its own.
    expect(
      findSameVersionContentChanges([{ path: convergedPath, base: skill("1.0.0", "a"), head: skill("1.0.0", "a") }]),
    ).toEqual([]);
    expect(partitionCv02Converged([])).toEqual({ failing: [], converged: [] });
  });
});
