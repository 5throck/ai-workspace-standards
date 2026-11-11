#!/usr/bin/env bun
// @version 1.0.0
// regenerate-agents-md.test.ts — U-20261111-003 regression (tier, role, in-place mode)

import { describe, expect, test } from "bun:test";
import {
  cleanDescription,
  injectBlocks,
  parseSimpleFrontmatter,
  presentVariantMarkers,
  resolveRole,
  resolveTier,
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
