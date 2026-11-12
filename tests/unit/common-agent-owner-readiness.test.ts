#!/usr/bin/env bun
// @version 1.0.0
// common-agent-owner-readiness.test.ts — CA-1 of the common-agents sequence
// (docs/designs/2026-11-12-common-agents-for-common-skills-design.md, section 7).
// Pure in-process: in-memory trees plus one tiny tmp dir for agentExists. No spawns, no template walks.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateSlr, mapTree, slrIssues } from "../../scripts/generate-skill-lifecycle-records.ts";
import { agentExists } from "../../scripts/skill-lifecycle-audit.ts";

const skill = (name: string, owner: string) =>
  `---\nname: ${name}\nstatus: active\nowner: ${owner}\nlast_reviewed: 2026-08-01\ndescription: d\n---\nbody\n`;

describe("agentExists resolves the common roster", () => {
  const root = mkdtempSync(join(tmpdir(), "ca1-agent-exists-"));
  mkdirSync(join(root, "templates", "common", "agents"), { recursive: true });
  writeFileSync(join(root, "templates", "common", "agents", "public-data-analyst.md"), "# a\n");
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const registry = { agents: [], skills: [] };

  test("an agent that only exists in templates/common/agents resolves", () => {
    expect(agentExists("public-data-analyst", registry, root)).toBe(true);
  });
  test("an unknown agent does not resolve", () => {
    expect(agentExists("nobody", registry, root)).toBe(false);
  });
});

describe("strict common owner check behind the enforce flag", () => {
  const files: Record<string, string> = {
    "agents/architect.md": "# root only\n",
    "templates/common/agents/pm.md": "# pm\n",
    "templates/common/agents/public-data-analyst.md": "# pda\n",
    "templates/co-a/agents/financial-analyst.md": "# variant only\n",
    "templates/common/skills/ok-pm/SKILL.md": skill("ok-pm", "pm"),
    "templates/common/skills/ok-common/SKILL.md": skill("ok-common", "public-data-analyst"),
    "templates/common/skills/bad-variant/SKILL.md": skill("bad-variant", "financial-analyst"),
    "templates/common/skills/bad-root/SKILL.md": skill("bad-root", "architect"),
    "templates/common/skills/bad-unknown/SKILL.md": skill("bad-unknown", "nobody"),
  };
  const ownerFindings = evaluateSlr(mapTree(files), {}).findings.filter((f) => f.rule === "owner-agent");

  test("common-roster owners resolve; variant-only, L0-only and unknown owners are findings", () => {
    expect(ownerFindings.map((f) => f.name).sort()).toEqual(["bad-root", "bad-unknown", "bad-variant"]);
    expect(ownerFindings.every((f) => f.variant === "common")).toBe(true);
  });
  test("enforce:false reports warnings only", () => {
    const issues = slrIssues(ownerFindings, false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.level === "warning")).toBe(true);
  });
  test("enforce:true reports errors", () => {
    const issues = slrIssues(ownerFindings, true);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.level === "error")).toBe(true);
  });
  test("variant-own skills still resolve against variant, common and workspace rosters", () => {
    const own = evaluateSlr(
      mapTree({
        ...files,
        "templates/co-a/skills/mine/SKILL.md": skill("mine", "financial-analyst"),
        "templates/co-a/skills/mine2/SKILL.md": skill("mine2", "architect"),
        "templates/co-a/skills/mine3/SKILL.md": skill("mine3", "public-data-analyst"),
      }),
      {},
    ).findings.filter((f) => f.rule === "owner-agent" && f.variant === "co-a");
    expect(own).toEqual([]);
  });
});
