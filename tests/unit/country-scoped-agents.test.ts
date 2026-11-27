/**
 * Unit tests for scripts/lib/country-scoped-agents.ts — the pure planning behind pruning
 * country-scoped common agents (public-data-analyst) from non-KR scaffolds (design
 * 2026-11-12-common-agents-for-common-skills, Q4). No filesystem access.
 *
 * @version 1.1.0
 * v1.1.0 (2026-11-28, T-20261127-010 follow-up): scrubAgentDetailBlocks pin —
 *         details-section + backticked-row scrub for the regenerated roster's
 *         non-link forms.
 */
import { describe, expect, test } from "bun:test";
import {
  loadCountryScopedAgents,
  agentPrunePaths,
  agentsToPrune,
  isPrunedForCountry,
  scrubAgentReferenceLines,
  scrubAgentDetailBlocks,
} from "../../scripts/lib/country-scoped-agents.ts";

const REGISTRY = { "public-data-analyst": "KR" };

describe("loadCountryScopedAgents (v1.1.0 — schema-backed registry, T-20261112-005)", () => {
  test("default (repo-root schema) registers public-data-analyst as KR-scoped", () => {
    expect(loadCountryScopedAgents()).toEqual(REGISTRY);
  });
  test("schema without an agents key yields an empty registry (vacuously clean)", () => {
    const { writeFileSync, mkdtempSync } = require("node:fs");
    const { tmpdir } = require("node:os");
    const { join } = require("node:path");
    const dir = mkdtempSync(join(tmpdir(), "csa-"));
    const p = join(dir, "schema.json");
    writeFileSync(p, JSON.stringify({ country_scoped_assets: { skills: { "k-law": "KR" } } }));
    expect(loadCountryScopedAgents(p)).toEqual({});
  });
  test("malformed schema JSON throws (fail-closed)", () => {
    const { writeFileSync, mkdtempSync } = require("node:fs");
    const { tmpdir } = require("node:os");
    const { join } = require("node:path");
    const dir = mkdtempSync(join(tmpdir(), "csa-"));
    const p = join(dir, "schema.json");
    writeFileSync(p, "{ not json");
    expect(() => loadCountryScopedAgents(p)).toThrow();
  });
});

describe("isPrunedForCountry", () => {
  test("region-neutral targets prune every scoped asset", () => {
    expect(isPrunedForCountry("none", "KR")).toBe(true);
    expect(isPrunedForCountry("", "KR")).toBe(true);
  });
  test("matching country keeps, other country prunes", () => {
    expect(isPrunedForCountry("KR", "KR")).toBe(false);
    expect(isPrunedForCountry("US", "KR")).toBe(true);
  });
});

describe("agentsToPrune", () => {
  test("non-KR and region-neutral scaffolds prune public-data-analyst", () => {
    expect(agentsToPrune(REGISTRY, "US")).toEqual([{ name: "public-data-analyst", scopedCountry: "KR" }]);
    expect(agentsToPrune(REGISTRY, "none")).toHaveLength(1);
  });
  test("KR scaffold keeps it; empty registry prunes nothing", () => {
    expect(agentsToPrune(REGISTRY, "KR")).toEqual([]);
    expect(agentsToPrune({}, "US")).toEqual([]);
  });
});

describe("agentPrunePaths", () => {
  test("covers the agent SSOT, the Claude mirror and the lifecycle record", () => {
    expect(agentPrunePaths("public-data-analyst")).toEqual([
      "agents/public-data-analyst.md",
      ".claude/agents/public-data-analyst.md",
      "docs/lifecycle/agents/public-data-analyst.md",
    ]);
  });
});

describe("scrubAgentReferenceLines", () => {
  const md = [
    "| **PM** | [`agents/pm.md`](agents/pm.md) | Medium |",
    "| **Public Data Analyst** | [`agents/public-data-analyst.md`](agents/public-data-analyst.md) | Medium |",
    "| **I18N Specialist** | [`agents/i18n-specialist.md`](agents/i18n-specialist.md) | Medium |",
  ].join("\n");
  test("drops only the pruned agent's roster row", () => {
    const { output, removed } = scrubAgentReferenceLines(md, ["public-data-analyst"]);
    expect(removed).toBe(1);
    expect(output).toContain("agents/pm.md");
    expect(output).toContain("agents/i18n-specialist.md");
    expect(output).not.toContain("public-data-analyst");
  });
  test("no pruned names leaves the text untouched", () => {
    expect(scrubAgentReferenceLines(md, [])).toEqual({ output: md, removed: 0 });
  });
});

describe("scrubAgentDetailBlocks (T-20261127-010 follow-up)", () => {
  const md = [
    "<!-- VARIANT-AGENT-DETAILS-START -->",
    "### design",
    "",
    "| Field | Value |",
    "|-------|-------|",
    "| **File** | [`agents/design.md`](agents/design.md) |",
    "| **Tier** | medium |",
    "",
    "### public-data-analyst",
    "",
    "| Field | Value |",
    "|-------|-------|",
    "| **File** | [`agents/public-data-analyst.md`](agents/public-data-analyst.md) |",
    "| **Tier** | medium |",
    "| **Role** | KR public-data gateway maintenance |",
    "",
    "### i18n-specialist",
    "",
    "| Field | Value |",
    "|-------|-------|",
    "| **Tier** | medium |",
    "<!-- VARIANT-AGENT-DETAILS-END -->",
    "",
    "<!-- VARIANT-PHASE-GATE-START -->",
    "| Deliverable | Phase | Agent | Tier |",
    "|-------------|-------|-------|------|",
    "| slide deck | Phase — | `public-data-analyst` | Medium | |",
    "| lecture deck | Phase 5 | `html-build` | Low | |",
    "<!-- VARIANT-PHASE-GATE-END -->",
  ].join("\n");

  test("removes the pruned agent's details section and backticked rows, keeps the rest", () => {
    const { output, removed } = scrubAgentDetailBlocks(md, ["public-data-analyst"]);
    expect(output).toContain("### design");
    expect(output).toContain("### i18n-specialist");
    expect(output).toContain("| **Tier** | medium |"); // design + i18n rows survive
    expect(output).not.toContain("public-data-analyst");
    expect(output).toContain("`html-build`");
    // heading + blank + 2 table-header rows + 3 field rows + trailing blank +
    // 1 phase-gate row
    expect(removed).toBe(9);
  });

  test("section removal stops at the next heading and at VARIANT markers", () => {
    const { output } = scrubAgentDetailBlocks(md, ["public-data-analyst"]);
    expect(output).toContain("### i18n-specialist");
    expect(output).toContain("VARIANT-PHASE-GATE-START");
  });

  test("no pruned names leaves the text untouched", () => {
    expect(scrubAgentDetailBlocks(md, [])).toEqual({ output: md, removed: 0 });
  });
});
