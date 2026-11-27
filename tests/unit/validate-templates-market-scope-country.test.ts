#!/usr/bin/env bun
// @version 1.0.1
// v1.0.1 (2026-11-27, T-20261127-007): co-deck humanize seed pin assertion
//          v1.0.0/4860b0ec → v1.0.2/051fa7a — follows the compat-gated seed
//          pin move (upstream v1.0.1 relocated the rule engine into engine/;
//          the adapter adaptation is the same wave). v1.0.0:
// validate-templates-market-scope-country.test.ts — B-10 pure-helper pins + the
// clean-tree zero-rows row (spec docs/designs/2026-11-21-humanize-seed-country-profiles-design.md
// §6.1/§6.2, T-20261121-002).
//
// Pins:
//   1. collectMarketScopeCountryIssues (scripts/validate-templates.ts) — the
//      market_scope(deps) ↔ country_config(variant) advisory consistency rule:
//      a "KR"-scoped dep without KR in country_config.supported yields exactly one
//      issue naming the dep id; KR declared → no issue; NO deps → no issue.
//   2. THE DOCTRINE PIN — a "ko-language"-only dep yields NO issue in either
//      direction of the country≠language distinction (ADR-0057 §5): carrying a
//      Korean-language lint never forces KR onto the carrying variant, and the
//      one-way ruling means KR declaration without KR-scoped deps is never an
//      issue here. Do not "fix" the exemption without a design cycle.
//   3. Unknown market_scope values are skipped by THIS check (verify V10 owns
//      their warning — T-20261121-001 §5.2; one warning per unknown value).
//   4. Clean-tree row — against the repo as changed, every template seed's deps
//      satisfy the rule: zero issues for every variant (the check would WARN on
//      the real tree if a seed ever grows a KR-scoped dep without a matching
//      country_config declaration).

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { collectMarketScopeCountryIssues } from "../../scripts/validate-templates.ts";
import { parseExternalDepsManifest } from "../../scripts/lib/external-deps.ts";

const ROOT = join(import.meta.dir, "..", "..");

const dep = (id: string, market_scope?: string[]) => ({ id, market_scope });

describe("collectMarketScopeCountryIssues (design Part C)", () => {
  test("KR-scoped dep + supported [] → exactly one issue naming the dep id", () => {
    const issues = collectMarketScopeCountryIssues([dep("kordoc", ["KR"])], [], "co-test");
    expect(issues).toHaveLength(1);
    expect(issues[0]!.depId).toBe("kordoc");
    expect(issues[0]!.message).toContain("templates/co-test/external-deps.json 'kordoc'");
    expect(issues[0]!.message).toContain("market_scope includes 'KR'");
    expect(issues[0]!.message).toContain("country_config.supported does not declare KR");
  });

  test("KR-scoped dep + supported ['KR'] → no issue", () => {
    expect(collectMarketScopeCountryIssues([dep("kordoc", ["KR"])], ["KR"], "co-test")).toEqual([]);
  });

  test("DOCTRINE PIN — ko-language-only dep → no issue (language never implies country, ADR-0057 §5)", () => {
    expect(collectMarketScopeCountryIssues([dep("humanize", ["ko-language"])], [], "co-test")).toEqual([]);
    expect(collectMarketScopeCountryIssues([dep("humanize", ["ko-language"])], ["KR"], "co-test")).toEqual([]);
    expect(collectMarketScopeCountryIssues([dep("humanize", ["ko-language"])], ["US"], "co-test")).toEqual([]);
  });

  test("mixed scopes — ko-language + KR on one dep still requires KR (the KR member governs)", () => {
    const issues = collectMarketScopeCountryIssues([dep("mixed", ["ko-language", "KR"])], [], "co-test");
    expect(issues).toHaveLength(1);
    expect(collectMarketScopeCountryIssues([dep("mixed", ["ko-language", "KR"])], ["KR"], "co-test")).toEqual([]);
  });

  test("unknown market_scope values are skipped by this check (V10 owns them)", () => {
    expect(collectMarketScopeCountryIssues([dep("exotic", ["eu-market"])], [], "co-test")).toEqual([]);
    expect(collectMarketScopeCountryIssues([dep("exotic", ["ko-language", "eu-market"])], [], "co-test")).toEqual([]);
  });

  test("multiple offending deps → one issue each", () => {
    const issues = collectMarketScopeCountryIssues(
      [dep("kordoc", ["KR"]), dep("rhwp", ["KR"]), dep("humanize", ["ko-language"])],
      [],
      "co-test",
    );
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.depId).sort()).toEqual(["kordoc", "rhwp"]);
  });

  test("no deps → no issue", () => {
    expect(collectMarketScopeCountryIssues([], [], "co-test")).toEqual([]);
    expect(collectMarketScopeCountryIssues([], ["KR"], "co-test")).toEqual([]);
  });

  test("undefined supported (malformed variant.json) behaves as empty — B-04/B-05 own the FAIL", () => {
    const issues = collectMarketScopeCountryIssues([dep("kordoc", ["KR"])], undefined, "co-test");
    expect(issues).toHaveLength(1);
  });
});

describe("clean-tree zero-B-10 rows (design §6.2)", () => {
  const templatesDir = join(ROOT, "templates");
  const variants = readdirSync(templatesDir).filter((e) => e.startsWith("co-") && existsSync(join(templatesDir, e, "variant.json")));

  test("every variant's seed satisfies the B-10 rule on the repo as changed", () => {
    const rows: string[] = [];
    for (const v of variants) {
      const seedPath = join(templatesDir, v, "external-deps.json");
      if (!existsSync(seedPath)) continue;
      const seed = parseExternalDepsManifest(readFileSync(seedPath, "utf-8"), `templates/${v}/external-deps.json`);
      const raw = JSON.parse(readFileSync(join(templatesDir, v, "variant.json"), "utf-8")) as {
        country_config?: { supported?: string[] };
      };
      for (const issue of collectMarketScopeCountryIssues(seed.dependencies, raw.country_config?.supported, v)) {
        rows.push(`${v}: ${issue.message}`);
      }
    }
    expect(rows).toEqual([]);
  });

  test("co-deck carries only the ko-language humanize lint (no KR-scoped dep) and declares KR", () => {
    const seed = parseExternalDepsManifest(
      readFileSync(join(templatesDir, "co-deck", "external-deps.json"), "utf-8"),
      "templates/co-deck/external-deps.json",
    );
    expect(seed.dependencies.map((d) => d.id).sort()).toEqual(["humanize", "quickdl"]);
    const humanize = seed.dependencies.find((d) => d.id === "humanize")!;
    expect(humanize.market_scope).toEqual(["ko-language"]);
    expect(humanize.pin).toBe("v1.0.2");
    expect(humanize.commit).toBe("051fa7a5944bd328c3853aec02e598237dd459a3");
    expect(humanize.adapter).toBe("scripts/co-deck/humanize-adapter.ts");
    expect(humanize.compatibility_test).toBe("bun scripts/co-deck/humanize-adapter.ts selftest");
    const raw = JSON.parse(readFileSync(join(templatesDir, "co-deck", "variant.json"), "utf-8")) as {
      country_config?: { supported?: string[]; default?: string | null };
      version?: string;
    };
    expect(raw.country_config?.supported).toEqual(["KR"]);
    expect(raw.country_config?.default).toBeNull();
    expect(raw.version).toBe("0.3.0");
  });

  test("co-work declares KR with default null (region-neutral default is inviolable)", () => {
    const raw = JSON.parse(readFileSync(join(templatesDir, "co-work", "variant.json"), "utf-8")) as {
      country_config?: { supported?: string[]; default?: string | null };
      version?: string;
    };
    expect(raw.country_config?.supported).toEqual(["KR"]);
    expect(raw.country_config?.default).toBeNull();
    expect(raw.version).toBe("1.2.0");
  });

  test("both KR profiles carry the SAME last_verified (B-05 cross-variant divergence rule)", () => {
    const dates = ["co-deck", "co-work"].map((v) => {
      const md = readFileSync(join(templatesDir, v, "docs", "countries", "KR.md"), "utf-8");
      return /^last_verified:\s*(\d{4}-\d{2}-\d{2})$/m.exec(md)?.[1];
    });
    expect(dates).toEqual(["2026-11-21", "2026-11-21"]);
  });
});
