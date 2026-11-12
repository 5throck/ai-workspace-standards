#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-skill-records.test.ts — SLR check (U-20261112-005 PR-1).
// In-memory trees only; the enforce flag is passed as an argument, never read from the config file.

import { describe, expect, test } from "bun:test";
import {
  GENERATED_MARKER,
  evaluateSlr,
  groupSlrFindings,
  mapTree,
  parseEnforcementFlag,
  planTemplateRecords,
  slrIssues,
} from "../../scripts/generate-skill-lifecycle-records.ts";

const skill = (name: string, owner = "pm", status = "active") => `---\nname: ${name}\nstatus: ${status}\nowner: ${owner}\nlast_reviewed: 2026-08-01\ndescription: d\n---\nbody\n`;
const L0_RECORD = "# a\n\n## Metadata\n- **Skill**: a\n- **Created**: 2026-08-01\n\n## Description\nDoes a.\n\n## Phase History\n| Date | From | To | Reason | Approver |\n|--|--|--|--|--|\n| 2026-08-01 | - | production | Init | pm |\n\n## Acceptance Criteria\n- [x] ok\n";

const BASE: Record<string, string> = {
  "agents/pm.md": "# pm\n",
  "templates/common/agents/pm.md": "# pm\n",
  "templates/common/agents/lifecycle-manager.md": "# lm\n",
  "templates/co-a/agents/worker.md": "# worker\n",
  "templates/co-a/agents/domains/deep/specialist.md": "# s\n",
  "docs/lifecycle/skills/a.md": L0_RECORD,
  "templates/common/skills/a/SKILL.md": skill("a"),
  "templates/co-a/skills/own/SKILL.md": skill("own", "worker"),
};

/** The fixture plus every generated record, i.e. a fully published state. */
function published(extra: Record<string, string> = {}): Record<string, string> {
  const plan = planTemplateRecords(mapTree({ ...BASE, ...extra }), {});
  const out: Record<string, string> = { ...BASE, ...extra };
  for (const r of plan.records) out[r.path] = r.content;
  return out;
}

const rules = (files: Record<string, string>, map = {}) => evaluateSlr(mapTree(files), map).findings.map((f) => f.rule);

describe("SLR rules", () => {
  test("clean published tree has no findings", () => {
    expect(evaluateSlr(mapTree(published()), {}).findings).toEqual([]);
  });

  test("coverage: an active common skill without a record", () => {
    const files = { ...published(), "templates/common/skills/added/SKILL.md": skill("added") };
    const r = evaluateSlr(mapTree(files), {}).findings.filter((f) => f.rule === "coverage");
    expect(r.map((f) => f.variant)).toEqual(["common"]);
    expect(r[0].message).toContain("added");
  });

  test("coverage: a non-active skill is not required to have a record", () => {
    const files = { ...published(), "templates/common/skills/exp/SKILL.md": skill("exp", "pm", "experimental") };
    expect(rules(files)).not.toContain("coverage");
  });

  test("coverage: a variant skill is covered by a same-named common record", () => {
    const files = { ...published(), "templates/co-a/skills/a/SKILL.md": skill("a", "worker") };
    expect(rules(files)).toEqual([]);
  });

  test("parity: a hand-edited generated record fails with the file name", () => {
    const files = published();
    const p = "templates/co-a/docs/lifecycle/skills/own.md";
    files[p] = files[p] + "tampered\n";
    const f = evaluateSlr(mapTree(files), {}).findings.filter((x) => x.rule === "parity");
    expect(f.map((x) => x.path)).toEqual([p]);
  });

  test("parity: a record that lost the marker is hand-owned and not compared", () => {
    const files = published();
    const p = "templates/co-a/docs/lifecycle/skills/own.md";
    files[p] = files[p].replace(GENERATED_MARKER + "\n", "");
    expect(rules(files)).toEqual([]);
  });

  test("leak: a seeded ADR reference in a record directory", () => {
    const files = published({ "templates/common/docs/lifecycle/skills/hand.md": "# hand\nSee ADR-0103 for context.\n" });
    const f = evaluateSlr(mapTree(files), {}).findings.filter((x) => x.rule === "leak");
    expect(f.map((x) => x.path)).toEqual(["templates/common/docs/lifecycle/skills/hand.md"]);
  });

  test("owner: unmapped skill is reported; a map entry resolves it", () => {
    const noOwner = { "templates/co-a/skills/ownerless/SKILL.md": "---\nname: ownerless\nstatus: active\n---\n" };
    const files = { ...BASE, ...noOwner };
    const f = evaluateSlr(mapTree(files), {}).findings.filter((x) => x.rule === "owner");
    expect(f.map((x) => x.path)).toEqual(["templates/co-a/skills/ownerless/SKILL.md"]);
    const mapped = evaluateSlr(mapTree(published(noOwner)), { "co-a/ownerless": "worker" }).findings;
    expect(mapped.filter((x) => x.rule === "owner" || x.rule === "owner-agent")).toEqual([]);
  });

  test("owner-agent: a common skill owned by a variant-only agent is reported (strict common roster)", () => {
    const files = published({ "templates/common/skills/k/SKILL.md": skill("k", "worker") });
    const f = evaluateSlr(mapTree(files), {}).findings.filter((x) => x.rule === "owner-agent");
    expect(f.map((x) => x.variant)).toEqual(["common"]);
    expect(f[0].message).toContain("common roster");
  });

  test("owner-agent: unknown agent is reported; nested variant agents and workspace roster resolve", () => {
    const files = published({
      "templates/co-a/skills/ghost/SKILL.md": skill("ghost", "nobody"),
      "templates/co-a/skills/deep/SKILL.md": skill("deep", "specialist"),
      "templates/co-a/skills/lm/SKILL.md": skill("lm", "lifecycle-manager"),
    });
    const f = evaluateSlr(mapTree(files), {}).findings.filter((x) => x.rule === "owner-agent");
    expect(f.map((x) => x.message)).toEqual([expect.stringContaining('"nobody"')]);
  });
});

describe("enforce flag (passed as an argument)", () => {
  const files = { ...BASE }; // nothing published: coverage gaps in common and co-a
  const findings = evaluateSlr(mapTree(files), {}).findings;

  test("findings exist", () => {
    expect(findings.length).toBeGreaterThan(0);
  });
  test("enforce:false yields warnings only (exit 0 semantics)", () => {
    const issues = slrIssues(findings, false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.level === "warning")).toBe(true);
  });
  test("enforce:true yields errors (exit 1 semantics)", () => {
    const issues = slrIssues(findings, true);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.level === "error")).toBe(true);
    expect(issues[0].fix).toContain("generate-skill-lifecycle-records.ts");
  });
  test("clean tree yields no issues in either mode", () => {
    const clean = evaluateSlr(mapTree(published()), {}).findings;
    expect(slrIssues(clean, true)).toEqual([]);
    expect(slrIssues(clean, false)).toEqual([]);
  });
  test("one line per (rule, variant) with a count", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ rule: "coverage" as const, variant: "co-x", path: `p/s${i}.md`, name: `s${i}`, message: `m${i}` }));
    const g = groupSlrFindings(many);
    expect(g).toHaveLength(1);
    expect(g[0].count).toBe(9);
    expect(g[0].message).toContain("+3 more");
  });
  test("flag file parsing: absent and malformed-safe defaults", () => {
    expect(parseEnforcementFlag(null)).toEqual({ enforce: false });
    expect(parseEnforcementFlag('{ "enforce": false }')).toEqual({ enforce: false });
    expect(parseEnforcementFlag('{ "enforce": true }')).toEqual({ enforce: true });
    expect(parseEnforcementFlag('{ "enforce": "true" }')).toEqual({ enforce: false });
  });
});
