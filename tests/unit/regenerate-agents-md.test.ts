#!/usr/bin/env bun
// @version 1.1.0
// regenerate-agents-md.test.ts — U-20261111-003 regression (tier, role, in-place mode)
// v1.1.0 (2026-11-28, T-20261127-010): common-agent roster merge (scan + merge rules)

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildVariantRoster,
  cleanDescription,
  injectBlocks,
  parseSimpleFrontmatter,
  presentVariantMarkers,
  resolveRole,
  resolveTier,
  scanCommonAgentNames,
  scanVariantTreeAgentFiles,
  selectBase,
} from "../../scripts/regenerate-agents-md.ts";

describe("resolveTier (U-20261111-003 defect 1)", () => {
  test("flat `tier: low` is honored instead of defaulting to medium", () => {
    const fm = parseSimpleFrontmatter("---\nname: html-build\ntier: low\n---\nbody");
    expect(resolveTier(fm)).toBe("low");
  });

  test("nested tier.claude wins over the flat key", () => {
    const fm = parseSimpleFrontmatter("---\nname: x\ntier:\n  claude: high # claude-opus\n---\n");
    expect(resolveTier(fm)).toBe("high");
  });

  test("defaults to medium when no tier is declared", () => {
    expect(resolveTier(parseSimpleFrontmatter("---\nname: x\n---\n"))).toBe("medium");
  });
});

describe("resolveRole (U-20261111-003 defect 2)", () => {
  test("a single-token role falls back to the cleaned description", () => {
    const fm = parseSimpleFrontmatter(
      "---\nname: i18n-specialist\ndescription: 'Owns locale configuration. Use when: \"locale config\"'\nrole: specialist\n---\n",
    );
    expect(resolveRole(fm, "i18n-specialist")).toBe("Owns locale configuration");
  });

  test("a descriptive role is kept verbatim", () => {
    const fm = parseSimpleFrontmatter("---\nrole: HTML slide builder and image integration specialist\n---\n");
    expect(resolveRole(fm, "html-build")).toBe("HTML slide builder and image integration specialist");
  });

  test("falls back to the agent name when nothing else exists", () => {
    expect(resolveRole({}, "version")).toBe("version");
  });

  test("cleanDescription strips quotes and the Use when trailer", () => {
    expect(cleanDescription(`"Does X. Use when: a, b"`)).toBe("Does X");
  });
});

describe("selectBase / injectBlocks (U-20261111-003 defect 3)", () => {
  const template = "# T\n<!-- VARIANT-AGENTS-START -->\nold\n<!-- VARIANT-AGENTS-END -->\n";
  const existing = "# Variant\nstatic intro\n<!-- VARIANT-AGENTS-START -->\nstale\n<!-- VARIANT-AGENTS-END -->\nstatic tail\n";

  test("an existing marked file is updated in place and keeps static content", () => {
    const base = selectBase(existing, template, false);
    expect(base).toBe(existing);
    const out = injectBlocks(base, { "VARIANT-AGENTS": "fresh" });
    expect(out).toContain("static intro");
    expect(out).toContain("static tail");
    expect(out).toContain("fresh");
    expect(out).not.toContain("stale");
  });

  test("--from-template forces the L1 template base", () => {
    expect(selectBase(existing, template, true)).toBe(template);
  });

  test("a file without markers (or no file) rebuilds from the template", () => {
    expect(selectBase("# no markers\n", template, false)).toBe(template);
    expect(selectBase(null, template, false)).toBe(template);
  });

  test("presentVariantMarkers lists only complete START/END pairs", () => {
    expect(presentVariantMarkers(existing)).toEqual(["VARIANT-AGENTS"]);
    expect(presentVariantMarkers("<!-- VARIANT-AGENTS-START -->")).toEqual([]);
  });
});

describe("scanCommonAgentNames (T-20261127-010)", () => {
  function fixtureDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "regen-agents-test-"));
    mkdirSync(dir, { recursive: true });
    for (const f of ["pm.md", "_COMMON.md", "automation-engineer.md", "design-system-lead.md", "contract-gate-engineer.md", "public-data-analyst.md", "README.txt"]) {
      writeFileSync(join(dir, f), "---\nname: x\n---\n");
    }
    return dir;
  }

  test("lists every agent file except pm.md and _-prefixed partials, sorted", () => {
    const names = scanCommonAgentNames(fixtureDir());
    expect(names).toEqual(["automation-engineer", "contract-gate-engineer", "design-system-lead", "public-data-analyst"]);
  });

  test("a missing directory yields an empty list (not a throw)", () => {
    expect(scanCommonAgentNames(join(tmpdir(), "does-not-exist-regen-agents"))).toEqual([]);
  });
});

describe("scanVariantTreeAgentFiles (T-20261127-010)", () => {
  function treeFixtureDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "regen-agents-tree-"));
    mkdirSync(join(dir, "domains", "functional", "msds"), { recursive: true });
    mkdirSync(join(dir, "_shared"), { recursive: true });
    writeFileSync(join(dir, "design.md"), "---\nname: design\n---\n");
    writeFileSync(join(dir, "pm.md"), "---\nname: pm\n---\n");
    writeFileSync(join(dir, "README.md"), "# docs\n");
    writeFileSync(join(dir, "domains", "functional", "msds", "msds-agent.md"), "---\nname: msds-agent\n---\n");
    writeFileSync(join(dir, "_shared", "audit-agent.md"), "---\nname: audit-agent\n---\n");
    return dir;
  }

  test("recursive scan keeps nested relpaths, drops pm.md and README*, sorted", () => {
    expect(scanVariantTreeAgentFiles(treeFixtureDir())).toEqual([
      "_shared/audit-agent",
      "design",
      "domains/functional/msds/msds-agent",
    ]);
  });
});

describe("buildVariantRoster (T-20261127-010)", () => {
  test("variant + common agents both make the roster; variant order first, common appended sorted", () => {
    const roster = buildVariantRoster(
      ["html-build", "design", "research"],
      ["html-build", "design", "research"],
      ["automation-engineer", "contract-gate-engineer", "design-system-lead", "public-data-analyst"],
    );
    expect(roster.map((e) => e.rel)).toEqual([
      "html-build",
      "design",
      "research",
      "automation-engineer",
      "contract-gate-engineer",
      "design-system-lead",
      "public-data-analyst",
    ]);
    expect(roster.every((e) => e.source === "variant" || e.source === "common")).toBe(true);
  });

  test("a common agent the variant itself ships dedupes to the variant entry (overlay-wins)", () => {
    const roster = buildVariantRoster(["design", "i18n-specialist"], ["design", "i18n-specialist"], [
      "automation-engineer",
      "i18n-specialist",
    ]);
    expect(roster.map((e) => e.rel)).toEqual(["design", "i18n-specialist", "automation-engineer"]);
    expect(roster.filter((e) => e.name === "i18n-specialist")).toHaveLength(1);
  });

  test("nested tree agents not declared in variant.json join the roster with their relpath (AGENTS.md index contract)", () => {
    const roster = buildVariantRoster(
      ["safety-governance-manager", "safety-workflow-manager", "i18n-specialist"],
      ["_shared/audit-agent", "domains/functional/msds/msds-agent", "i18n-specialist",
        "safety-governance-manager", "safety-workflow-manager"],
      ["automation-engineer"],
    );
    expect(roster.map((e) => e.rel)).toEqual([
      "safety-governance-manager",
      "safety-workflow-manager",
      "i18n-specialist",
      "_shared/audit-agent",
      "domains/functional/msds/msds-agent",
      "automation-engineer",
    ]);
    const nested = roster.find((e) => e.rel === "domains/functional/msds/msds-agent");
    expect(nested).toEqual({ name: "msds-agent", rel: "domains/functional/msds/msds-agent", source: "variant" });
  });

  test("a nested basename colliding with a common agent keeps the variant copy only", () => {
    const roster = buildVariantRoster([], ["_shared/i18n-specialist"], ["i18n-specialist", "pm"]);
    expect(roster).toEqual([{ name: "i18n-specialist", rel: "_shared/i18n-specialist", source: "variant" }]);
  });

  test("pm never enters the roster from any side (roster convention)", () => {
    const roster = buildVariantRoster(["pm", "design"], ["pm", "design"], ["pm", "automation-engineer"]);
    expect(roster.map((e) => e.name)).toEqual(["design", "automation-engineer"]);
  });

  test("pure function — same inputs, same output (stable ordering)", () => {
    const a = buildVariantRoster(["b", "a"], ["b", "a"], ["z", "y"]);
    const b = buildVariantRoster(["b", "a"], ["b", "a"], ["z", "y"]);
    expect(a).toEqual(b);
  });
});
