import { describe, test, expect } from "bun:test";
import { compareVariantNames } from "../../scripts/generate-skill-graph.ts";

/**
 * Regression coverage for the readdirSync-order non-determinism fixed in
 * generate-skill-graph.ts: `discoverNodes()` and the procedure-derivation
 * loop pick an alphabetically-first-variant-as-deterministic-canonical-
 * representative whenever the same skill/agent/output_type id exists in more
 * than one variant. That pick is only stable if variant directory names are
 * sorted with a comparator that is independent of both the filesystem's
 * (unspecified, OS-dependent) readdir order and of locale/ICU version.
 */
describe("compareVariantNames (variant discovery ordering)", () => {
  test("sorts a known set into plain ascending lexical order", () => {
    const names = ["co-price", "co-abap", "co-game", "co-develop", "co-consult"];
    expect([...names].sort(compareVariantNames)).toEqual([
      "co-abap",
      "co-consult",
      "co-develop",
      "co-game",
      "co-price",
    ]);
  });

  test("result is independent of the input (readdir) order", () => {
    const names = ["co-price", "co-abap", "co-game", "co-develop", "co-consult"];
    const canonical = [...names].sort(compareVariantNames);

    // Simulate several distinct filesystem readdir orderings (arbitrary
    // permutations) and assert every one sorts back to the same canonical
    // order — this is the property the bug fix depends on.
    const permutations = [
      [...names].reverse(),
      ["co-consult", "co-price", "co-abap", "co-game", "co-develop"],
      ["co-game", "co-develop", "co-price", "co-consult", "co-abap"],
      ["co-develop", "co-game", "co-abap", "co-consult", "co-price"],
    ];

    for (const permutation of permutations) {
      expect([...permutation].sort(compareVariantNames)).toEqual(canonical);
    }
  });

  test("does not depend on locale/ICU collation (plain code-unit order, not localeCompare)", () => {
    // localeCompare can treat these specially under some locales/ICU
    // versions (case/diacritic-insensitive collation); the plain `<`/`>`
    // comparator must not.
    expect(compareVariantNames("co-abap", "co-Abap")).toBe(1); // lowercase 'a' > uppercase 'A' in code-unit order
    expect(compareVariantNames("co-abap", "co-abap")).toBe(0);
    expect(compareVariantNames("co-abap", "co-price")).toBe(-1);
    expect(compareVariantNames("co-price", "co-abap")).toBe(1);
  });

  test("first-wins dedup over a duplicate id yields the same canonical owner regardless of visiting order", () => {
    // Mirrors the Map-based first-wins pattern in discoverNodes(): a shared
    // id ("designer") exists in both co-game and co-develop; whichever
    // variant is visited first under sorted order must win, no matter what
    // order the (simulated) filesystem handed back.
    const duplicateOwners = ["co-game", "co-develop"];

    function resolveOwner(visitOrder: string[]): string {
      const owners = new Map<string, string>();
      for (const variant of [...visitOrder].sort(compareVariantNames)) {
        if (duplicateOwners.includes(variant) && !owners.has("designer")) {
          owners.set("designer", variant);
        }
      }
      return owners.get("designer")!;
    }

    const shuffledVisitOrders = [
      ["co-game", "co-develop"],
      ["co-develop", "co-game"],
      ["co-develop", "co-price", "co-game", "co-abap"],
      ["co-price", "co-game", "co-abap", "co-develop"],
    ];

    const results = shuffledVisitOrders.map(resolveOwner);
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("co-develop"); // alphabetically first of {co-game, co-develop}
  });
});
