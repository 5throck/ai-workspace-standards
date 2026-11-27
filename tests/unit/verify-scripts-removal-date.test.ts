// Removal-date column overload WARN (Check 5c — verify-scripts v1.16.0,
// U-20261127-005, port of co-newbiz F-23 / DEC-20261122-02). The removal-date
// registry cell is typed (`—` or YYYY-MM-DD); the L0 registry still carries
// legacy prose cells outside this landing's cited rows, so the live run is
// expected to WARN until the wholesale cleanup wave. This pins the pure
// checker against synthetic registry rows.
import { describe, expect, test } from "bun:test";
import { findOverloadedRemovalDates, type RegistryEntry } from "../../scripts/verify-scripts";

function row(overrides: Partial<RegistryEntry>): RegistryEntry {
  return {
    script: "example.ts",
    source: "L0",
    version: "1.0.0",
    status: "active",
    removalDate: "—",
    securityAdvisory: "—",
    layer: "L0+L1",
    pair: "—",
    ...overrides,
  };
}

describe("findOverloadedRemovalDates (Check 5c, U-20261127-005)", () => {
  test("a non-deprecated row with prose in the removal-date cell is flagged", () => {
    const warnings = findOverloadedRemovalDates([
      row({ script: "skill-session-review.ts", removalDate: "`--date`, `--json`, `--dry-run`" }),
    ]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("skill-session-review.ts");
    expect(warnings[0]).toContain("REMOVAL-DATE OVERLOAD");
    expect(warnings[0]).toContain("Guide section");
  });

  test("every legitimate cell shape passes: dash, empty, and a real date", () => {
    expect(
      findOverloadedRemovalDates([
        row({ removalDate: "—" }),
        row({ removalDate: "" }),
        row({ removalDate: "2026-11-22" }),
      ]),
    ).toEqual([]);
  });

  test("date-like near-misses are flagged (not a YYYY-MM-DD date)", () => {
    expect(findOverloadedRemovalDates([row({ removalDate: "2026-1-2" })])).toHaveLength(1);
    expect(findOverloadedRemovalDates([row({ removalDate: "never" })])).toHaveLength(1);
    // Contract is shape-level (the finding's wording: "neither `—` nor a
    // YYYY-MM-DD date") — a pattern-shaped but semantically invalid date
    // (2026-13-45) passes here and stays Check 4/5's concern on deprecated
    // rows, exactly as `2026-11-22` does.
    expect(findOverloadedRemovalDates([row({ removalDate: "2026-13-45" })])).toEqual([]);
  });

  test("deprecated rows are exempt — Checks 4/5 own their date semantics", () => {
    expect(findOverloadedRemovalDates([row({ status: "deprecated", removalDate: "`--date` flag list" })])).toEqual([]);
  });

  test("mixed registry reports only the offending rows, in order", () => {
    const warnings = findOverloadedRemovalDates([
      row({ script: "clean-a.ts" }),
      row({ script: "dirty-b.ts", removalDate: "v1.4.0: discovers all agents/*.md" }),
      row({ script: "clean-c.ts", removalDate: "2027-01-01" }),
      row({ script: "dirty-d.ts", removalDate: "`--dir <path>`, `--all-variants`" }),
    ]);
    expect(warnings.map((w) => (w.match(/`([^`]+)`/) ?? [])[1])).toEqual(["dirty-b.ts", "dirty-d.ts"]);
  });
});
