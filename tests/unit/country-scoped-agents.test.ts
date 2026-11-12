/**
 * Unit tests for scripts/lib/country-scoped-agents.ts — the pure planning behind pruning
 * country-scoped common agents (public-data-analyst) from non-KR scaffolds (design
 * 2026-11-12-common-agents-for-common-skills, Q4). No filesystem access.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from "bun:test";
import {
  COUNTRY_SCOPED_AGENTS,
  agentPrunePaths,
  agentsToPrune,
  isPrunedForCountry,
  scrubAgentReferenceLines,
} from "../../scripts/lib/country-scoped-agents.ts";

const REGISTRY = { "public-data-analyst": "KR" };

describe("COUNTRY_SCOPED_AGENTS", () => {
  test("registers public-data-analyst as KR-scoped", () => {
    expect(COUNTRY_SCOPED_AGENTS).toEqual(REGISTRY);
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
