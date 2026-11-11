#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-cv02.test.ts — CV-02 same-version-content-change (DEC-20261111-01 PR-D)

import { describe, expect, test } from "bun:test";
import { extractCv02Version, findSameVersionContentChanges } from "../../scripts/validate-templates.ts";

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
