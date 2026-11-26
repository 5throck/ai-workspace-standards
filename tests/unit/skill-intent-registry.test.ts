// skill-intent-registry.test.ts — S3 of design
// docs/designs/2026-11-26-skill-drift-structural-fixes-design.md §4.3/§9: the
// docs/skill-intent.json registry (fleet-membership house shape), its fail-closed
// validation, and the classifyConvergence intent map (converged-intent bucket,
// partial-coverage annotation, marker ≠ intent rule). No real registry file is
// written by these tests; the seeded file's shape is validated read-only.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import {
  SKILL_INTENT_KINDS,
  buildIntentMap,
  classifyConvergence,
  loadSkillIntent,
  validateSkillIntentPayload,
} from "../../scripts/skill-graph-fleet-report.ts";
import type { SkillIntentEntry, SkillIntentRegistry } from "../../scripts/skill-graph-fleet-report.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const row = (over: Partial<SkillIntentEntry>): SkillIntentEntry => ({
  capability: "i18n-audit",
  project: "co-price",
  kind: "adjudicated-keep",
  reason: "adjudicated intentional",
  decided: "2026-11-23",
  decision_ref: "T-20261123-005",
  ...over,
});

/** Fixture capability maps: co-a/co-b carry the majority hash, co-c a minority. */
function fixtureCaps(): Map<string, Map<string, Set<string | null>>> {
  return new Map([
    [
      "co-a",
      new Map([
        ["review", new Set(["h1"])],
        ["linter", new Set(["h1"])],
        ["solo", new Set(["h1", "h2"])], // minority = co-c only via h2
      ]),
    ],
    [
      "co-b",
      new Map([
        ["review", new Set(["h1"])],
        ["linter", new Set(["h2"])], // minority member #2 (partial-coverage case)
      ]),
    ],
    [
      "co-c",
      new Map([
        ["review", new Set(["h9"])],
        ["linter", new Set(["h9"])],
        ["solo", new Set(["h2"])],
      ]),
    ],
  ]);
}

describe("validateSkillIntentPayload (S3 schema, fail-closed)", () => {
  test("a well-formed payload passes and rows are normalized", () => {
    const res = validateSkillIntentPayload({
      version: 1,
      entries: [row({})],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.registry.entries).toHaveLength(1);
  });

  test("an unknown kind is rejected naming the row", () => {
    const res = validateSkillIntentPayload({ version: 1, entries: [row({ kind: "vibes" as never })] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.detail).toContain("i18n-audit@co-price");
  });

  test("a malformed decision_ref is rejected (only DEC/T/UR id forms)", () => {
    for (const bad of ["PR #1799", "b90c28e50", "DEC-2026-01", "T-202611", "UR-"]) {
      const res = validateSkillIntentPayload({ version: 1, entries: [row({ decision_ref: bad })] });
      expect(res.ok).toBe(false);
    }
    for (const good of ["DEC-20261126-01", "T-20261123-005", "UR-2"]) {
      const res = validateSkillIntentPayload({ version: 1, entries: [row({ decision_ref: good })] });
      expect(res.ok).toBe(true);
    }
  });

  test("a non-fleet-shaped project id, empty reason, bad date and duplicate pair are each rejected", () => {
    expect(validateSkillIntentPayload({ version: 1, entries: [row({ project: "gw-abc" })] }).ok).toBe(false);
    expect(validateSkillIntentPayload({ version: 1, entries: [row({ reason: "  " })] }).ok).toBe(false);
    expect(validateSkillIntentPayload({ version: 1, entries: [row({ decided: "2026-02-31" })] }).ok).toBe(false);
    const dup = validateSkillIntentPayload({ version: 1, entries: [row({}), row({})] });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.detail).toContain("duplicate");
    expect(validateSkillIntentPayload({ version: 2, entries: [] }).ok).toBe(false);
  });

  test("all five kinds are legal", () => {
    for (const kind of SKILL_INTENT_KINDS) {
      expect(validateSkillIntentPayload({ version: 1, entries: [row({ kind })] }).ok).toBe(true);
    }
  });
});

describe("buildIntentMap (S3 existence validation, fail-closed)", () => {
  test("a non-fleet-member project throws naming the row", () => {
    const registry: SkillIntentRegistry = { version: 1, entries: [row({ project: "co-nothing" })] };
    expect(() => buildIntentMap(registry, fixtureCaps())).toThrow(/co-nothing/);
  });

  test("a capability absent from the named project's graph throws naming the row", () => {
    const registry: SkillIntentRegistry = { version: 1, entries: [row({ capability: "ghost-skill", project: "co-a" })] };
    expect(() => buildIntentMap(registry, fixtureCaps())).toThrow(/ghost-skill@co-a/);
  });

  test("a valid registry builds the capability@project map", () => {
    const registry: SkillIntentRegistry = { version: 1, entries: [row({ capability: "review", project: "co-c" })] };
    const map = buildIntentMap(registry, fixtureCaps());
    expect(map.has("review@co-c")).toBe(true);
  });
});

describe("classifyConvergence intent map (S3 classification)", () => {
  test("a capability whose every minority member is covered reports converged-intent", () => {
    const intent = new Map([["review@co-c", row({ capability: "review", project: "co-c" })]]);
    const res = classifyConvergence(fixtureCaps(), 3, intent);
    expect(res.convergedIntent).toEqual([{ capability: "review", covered: ["co-c"] }]);
    expect(res.convergenceWithDivergence.find((d) => d.capability === "review")).toBeUndefined();
  });

  test("a partially covered capability stays divergent annotated with the covered projects", () => {
    // linter: majority h1 = [co-a], minority h2 = [co-b, co-c]; cover only co-c.
    const intent = new Map([["linter@co-c", row({ capability: "linter", project: "co-c" })]]);
    const res = classifyConvergence(fixtureCaps(), 3, intent);
    expect(res.convergedIntent).toHaveLength(0);
    const d = res.convergenceWithDivergence.find((x) => x.capability === "linter");
    expect(d).toBeDefined();
    expect(d!.intentCovered).toEqual(["co-c"]);
  });

  test("no intent map: every divergent pair surfaces (marker-only pairs keep reporting)", () => {
    const res = classifyConvergence(fixtureCaps(), 3);
    expect(res.convergedIntent).toHaveLength(0);
    // A LOCAL-PATCH marker alone is NOT intent: without a registry row the pair
    // (here review@co-c) still surfaces in convergenceWithDivergence (design §4.3).
    expect(res.convergenceWithDivergence.map((d) => d.capability)).toContain("review");
  });

  test("majority selection is deterministic on a 3-way tie (lexicographically smallest hash wins)", () => {
    // hz / hy / hx each carry one project — a genuine tie; hx (lex smallest) is the
    // majority group, so minority = [co-a (hz), co-b (hy)].
    const caps: Map<string, Map<string, Set<string | null>>> = new Map([
      ["co-a", new Map([["cap", new Set(["hz"])]])],
      ["co-b", new Map([["cap", new Set(["hy"])]])],
      ["co-c", new Map([["cap", new Set(["hx"])]])],
    ]);
    const intent = new Map([
      ["cap@co-a", row({ capability: "cap", project: "co-a" })],
      ["cap@co-b", row({ capability: "cap", project: "co-b" })],
    ]);
    const res = classifyConvergence(caps, 3, intent);
    expect(res.convergedIntent).toEqual([{ capability: "cap", covered: ["co-a", "co-b"] }]);
  });

  test("a registry row naming a MAJORITY member is inert — uncovered minority still diverges", () => {
    const caps: Map<string, Map<string, Set<string | null>>> = new Map([
      ["co-a", new Map([["cap", new Set(["hb"])]])],
      ["co-b", new Map([["cap", new Set(["hb"])]])],
      ["co-c", new Map([["cap", new Set(["ha"])]])],
    ]);
    const intent = new Map([["cap@co-a", row({ capability: "cap", project: "co-a" })]]);
    const res = classifyConvergence(caps, 3, intent);
    // majority hb = [co-a, co-c]... no: hb=2 (co-a, co-b), ha=1 (co-c) → minority
    // [co-c] uncovered; the co-a row is majority-side and changes nothing.
    expect(res.convergedIntent).toHaveLength(0);
    const d = res.convergenceWithDivergence.find((x) => x.capability === "cap");
    expect(d).toBeDefined();
    expect(d!.intentCovered).toBeUndefined();
  });

  test("full coverage of BOTH minority members reports converged-intent with the sorted pair", () => {
    const intent = new Map([
      ["linter@co-b", row({ capability: "linter", project: "co-b" })],
      ["linter@co-c", row({ capability: "linter", project: "co-c" })],
    ]);
    const res = classifyConvergence(fixtureCaps(), 3, intent);
    expect(res.convergedIntent).toEqual([{ capability: "linter", covered: ["co-b", "co-c"] }]);
  });
});

describe("the seeded docs/skill-intent.json registry (read-only shape pin)", () => {
  test("loads, validates, and its buildIntentMap accepts the current project graphs", () => {
    const load = loadSkillIntent(REPO_ROOT);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(load.registry.entries.length).toBeGreaterThanOrEqual(7);
    // The real project graphs must satisfy every seeded row (the fleet-report run
    // hard-fails otherwise); co-* members map to Projects/<name> graphs on disk.
    // Projects/ is gitignored — absent on CI, where the schema-load assertion
    // above is the whole contract and the graph-existence acceptance runs locally.
    const { readFileSync, existsSync } = require("node:fs") as typeof import("node:fs");
    const projectCaps = new Map<string, Map<string, Set<string | null>>>();
    for (const p of ["co-abap", "co-design", "co-price", "co-safety", "co-work"]) {
      const path = join(REPO_ROOT, "Projects", p, "docs", "skill-graph.json");
      if (!existsSync(path)) continue;
      const graph = JSON.parse(readFileSync(path, "utf8")) as {
        nodes?: Array<{ type: string; capability?: string; id?: string }>;
      };
      const caps = new Set<string>();
      for (const n of graph.nodes ?? []) {
        if (n.type !== "skill") continue;
        const cap = typeof n.capability === "string" && n.capability ? n.capability : (n.id ?? "").split("/").pop() ?? "";
        if (cap) caps.add(cap);
      }
      projectCaps.set(p, new Map([...caps].map((c) => [c, new Set(["fixture"])] as [string, Set<string | null>])));
    }
    if (projectCaps.size === 0) {
      return; // CI shape: no local fleet state at all — the schema assertions above are the contract
    }
    // Local (or partial) shape: every seeded row whose project graph exists must
    // pass existence validation; rows for absent graphs are not checkable here.
    const available = {
      version: 1 as const,
      entries: load.registry.entries.filter((e) => projectCaps.has(e.project)),
    };
    const map = buildIntentMap(available, projectCaps);
    expect(map.size).toBe(available.entries.length);
    expect(available.entries.length).toBe(load.registry.entries.length); // full local fleet → all 7 validated
  });
});
