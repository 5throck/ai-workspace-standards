#!/usr/bin/env bun
// @version 1.1.0
// generate-skill-lifecycle-records.test.ts — skill lifecycle record generator (U-20261112-005 PR-1).
// Pure in-process: every case runs on an in-memory file map (the CLI case uses two tiny tmp dirs);
// no real tree walk, no spawn.
// v1.1.0 (2026-11-22, U-20261122-008): variant-notes preservation cases — extraction (well-formed
//          / absent / empty / malformed), injection position, byte-identical round-trip, verbatim
//          guarantee (internal-ref lines and Hangul survive), and CLI --check/--write parity on a
//          tmp tree through the single main() choke point.

import { describe, expect, test } from "bun:test";
import {
  GENERATED_MARKER,
  checkPlan,
  deriveRecord,
  extractVariantNotes,
  injectVariantNotes,
  isGeneratedRecord,
  main,
  mapTree,
  parseOwnerMap,
  parseSkillFrontmatter,
  planProjectRecords,
  planTemplateRecords,
  projectRecord,
  resolveOwner,
  sanitizeText,
} from "../../scripts/generate-skill-lifecycle-records.ts";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { L0_INTERNAL_REF_PATTERN, L0_REF_PATTERN } from "../../scripts/helpers/l0-ref-policy.ts";

const fm = (extra: Record<string, string> = {}): Record<string, unknown> => ({ owner: "pm", status: "active", description: "A skill.", ...extra });

const GATEGUARD = `# Gateguard Skill — Lifecycle Record

## Metadata
- **Skill**: gateguard
- **Status**: active
- **Version**: 1.0.2
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Pre-edit fact-forcing quality gate. Part of the 3-layer enforcement model.

## Changelog
- **1.0.2** (2026-09-21): patch bump

## Dependencies
- Bun runtime
- \`scripts/hooks/gateguard-fact-force.ts\` — Hook layer implementation
- \`scripts/not-in-common.ts\` — missing from common

## Phase History

| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at \`skills/gateguard/SKILL.md\`
- [x] Scope: common

## Notes
- Owner: pm
- Specified in CONSTITUTION.md section 11.2
`;

const SYNC = `# Sync Skill — Lifecycle Record

## Metadata
- **Skill**: sync
- **Version**: 1.9.0
- **Owner**: pm
- **Created**: 2026-07-08

## Description
Full pipeline.

## Dependencies
- \`scripts/dev-sync.ts\` — main pipeline
- ADR-0074 spec-check design

## Phase History

| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-07-08 | - | production | Extracted (docs/designs/2026-07-08-sync-design.md) from inline command. Second sentence stays. | pm |

## Acceptance Criteria

- [x] Pipeline tests pass
- [x] Spec check per ADR-0078 done. Idempotent update verified.
- [x] Tracked as T-20260912-010
`;

const DELEGATE = `# Delegate-To-Hub Skill — Lifecycle Record

## Metadata
- **Skill**: delegate-to-hub
- **Created**: 2026-11-02

## Description
Spoke-side filing procedure (design: workspace root
\`docs/designs/2026-11-01-hub-consolidation-design.md\`; ADR-0103 authorizes the channel). A spoke PM files a ticket.
Enforces gates at filing time.

## Dependencies
- Design: \`docs/designs/2026-11-01-hub-consolidation-design.md\` (§3.5)
- ADR-0103 (\`docs/adr/0103-x.md\`) — the N2 exception
- \`verify-authorization\` skill — hub-side gate

## Phase History
- Production (2026-11-02): created with ADR-0103 contract; backfilled (T-20261103-004).

## Acceptance Criteria
- Registry row present in \`skills/SKILLS.md\`
`;

const CI_TRIAGE = `# Ci-Triage Skill Lifecycle

## Metadata
- **Skill**: ci-triage
- **Status**: active
- **Version**: 0.2.0
- **Created**: 2026-09-08
- **Last Updated**: 2026-10-04

## Description
Failure triage loop. Pilot from the review (design: docs/designs/2026-09-08-ci-triage-skill-design.md).

## Phase History
| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-09-08 | - | production | Pilot created | pm |

## Acceptance Criteria

### Active Phase
- [x] Design doc present (docs/designs/2026-09-08-ci-triage-skill-design.md)
- [x] Frontmatter valid

## Metadata
- **Current Phase**: production
- **Version**: 0.2.0
- **Owner**: pm
`;

const MEETING = `# Meeting-Facilitation Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|----|--------|----------|
| 2026-05-29 | - | production | Initial skill | lifecycle-manager |
| 2026-11-10 | production | production | Updated to v1.5.0 (ADR-0196) | lifecycle-manager |

## Acceptance Criteria

- [x] Purpose defined

## Dependencies

- pm (facilitator agent)

## Metadata

- **Current Phase**: production
- **Version**: 1.5.0
`;

const exists = (set: string[]) => (rel: string) => set.includes(rel);
const base = { ownerMap: {}, commonPathExists: exists(["scripts/hooks/gateguard-fact-force.ts", "scripts/dev-sync.ts"]) };

function project(skill: string, l0Record: string, frontmatter: Record<string, unknown> = fm()) {
  const r = projectRecord({ skill, l0Record, frontmatter, ...base });
  if (!r.ok) throw new Error(r.reason);
  return r.content;
}

describe("projection (five real record shapes)", () => {
  test("gateguard: CONSTITUTION line removed, version-free, unresolved dependency path dropped", () => {
    const out = project("gateguard", GATEGUARD);
    expect(out.startsWith(GENERATED_MARKER + "\n")).toBe(true);
    expect(out).not.toMatch(/CONSTITUTION/);
    expect(out).not.toMatch(/\*\*Version\*\*|Last Updated|Changelog|## Notes/);
    expect(out).toContain("- **Created**: 2026-08-16");
    expect(out).toContain("`scripts/hooks/gateguard-fact-force.ts`");
    expect(out).not.toContain("not-in-common");
    expect(out).toContain("| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |");
    expect(out).toContain("## Acceptance Criteria");
  });

  test("sync: ADR/ticket/design references removed, Dependencies kept, other sentences kept", () => {
    const out = project("sync", SYNC);
    expect(out).toContain("`scripts/dev-sync.ts`");
    expect(out).not.toMatch(/ADR-|T-2026|docs\/designs/);
    expect(out).toContain("Second sentence stays.");
    expect(out).toContain("Idempotent update verified.");
    expect(out).toContain("- [x] Pipeline tests pass");
  });

  test("delegate-to-hub: docs/adr and design lines dropped, list-form Phase History reduced", () => {
    const out = project("delegate-to-hub", DELEGATE);
    expect(out).not.toMatch(/ADR-|docs\/adr|docs\/designs|T-2026/);
    expect(out).toContain("`verify-authorization` skill");
    expect(out).toContain("A spoke PM files a ticket.");
    expect(out).toContain("| 2026-11-02 | - | production | Initial production record | pm |");
  });

  test("ci-triage: two Metadata blocks reduce to one without Version, so Check MV sees no pair", () => {
    const out = project("ci-triage", CI_TRIAGE);
    expect(out.match(/^## Metadata$/gm)?.length).toBe(1);
    expect(out).not.toMatch(/\*\*Version\*\*/);
    expect(out).not.toMatch(/docs\/designs/);
    expect(out).toContain("Failure triage loop.");
  });

  test("meeting-facilitation: Created section, description from frontmatter, only the creation row kept", () => {
    const out = project("meeting-facilitation", MEETING, fm({ description: "Facilitates meetings." }));
    expect(out).toContain("- **Created**: 2026-05-29");
    expect(out).toContain("Facilitates meetings.");
    expect(out).toContain("| 2026-05-29 | - | production | Initial skill | lifecycle-manager |");
    expect(out).not.toMatch(/2026-11-10|ADR-0196/);
  });

  test("no projected line carries an L0-internal reference", () => {
    for (const [n, t] of [["gateguard", GATEGUARD], ["sync", SYNC], ["delegate-to-hub", DELEGATE], ["ci-triage", CI_TRIAGE], ["meeting-facilitation", MEETING]] as const) {
      for (const line of project(n, t).split("\n").slice(1)) {
        expect(L0_INTERNAL_REF_PATTERN.test(line) || L0_REF_PATTERN.test(line)).toBe(false);
      }
    }
  });

  test("projection is deterministic", () => {
    expect(project("sync", SYNC)).toBe(project("sync", SYNC));
  });
});

describe("sanitizeText", () => {
  test("rejoins an affected paragraph so no half sentence survives", () => {
    expect(sanitizeText("Keep this one. See (design: docs/designs/x.md\nfor ADR-0001). Keep that.")).toBe("Keep this one. Keep that.");
  });
  test("a clean paragraph keeps its line breaks", () => {
    expect(sanitizeText("line one\nline two")).toBe("line one\nline two");
  });
  test("a list item with only an internal reference is dropped", () => {
    expect(sanitizeText("- ADR-0001 says so\n- fine")).toBe("- fine");
  });
});

describe("owner resolution (D5)", () => {
  test("frontmatter owner wins over the map", () => {
    expect(resolveOwner({ variant: "co-x", skill: "s", frontmatter: { owner: "a" }, ownerMap: { "co-x/s": "b" } })).toEqual({ ok: true, owner: "a", source: "frontmatter" });
  });
  test("map: exact key before wildcard", () => {
    const m = { "*/s": "wild", "co-x/s": "exact" };
    expect(resolveOwner({ variant: "co-x", skill: "s", frontmatter: {}, ownerMap: m })).toEqual({ ok: true, owner: "exact", source: "map" });
    expect(resolveOwner({ variant: "co-y", skill: "s", frontmatter: {}, ownerMap: m })).toEqual({ ok: true, owner: "wild", source: "map" });
  });
  test("unmapped skill fails, no default owner", () => {
    expect(resolveOwner({ variant: "co-x", skill: "s", frontmatter: { owner: " " }, ownerMap: {} }).ok).toBe(false);
    expect(deriveRecord({ skill: "s", variant: "co-x", frontmatter: {}, ownerMap: {} }).ok).toBe(false);
  });
  test("owner map parsing: empty file and invalid shapes", () => {
    expect(parseOwnerMap("{}")).toEqual({});
    expect(parseOwnerMap(null)).toEqual({});
    expect(() => parseOwnerMap("[]")).toThrow();
    expect(() => parseOwnerMap('{"a/b": 3}')).toThrow();
  });
});

describe("derivation", () => {
  test("record from frontmatter carries marker, owner, created and standard criteria", () => {
    const r = deriveRecord({ skill: "x", variant: "co-x", frontmatter: fm({ last_reviewed: "2026-08-23", description: "Does X.\nAnd Y." }), ownerMap: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isGeneratedRecord(r.content)).toBe(true);
    expect(r.content).toContain("- **Owner**: pm");
    expect(r.content).toContain("- **Created**: 2026-08-23");
    expect(r.content).toContain("Does X. And Y.");
    expect(r.content).toContain("## Phase History");
    expect(r.content).toContain("## Acceptance Criteria");
    expect(r.content).not.toMatch(/\*\*Version\*\*/);
  });
  test("mapped owner is used when frontmatter has none", () => {
    const r = deriveRecord({ skill: "x", variant: "co-x", frontmatter: { description: "d" }, ownerMap: { "co-x/x": "mapped" } });
    expect(r.ok && r.content.includes("- **Owner**: mapped")).toBe(true);
  });
  test("frontmatter parsing keeps dates as strings", () => {
    expect(parseSkillFrontmatter("---\nname: a\nlast_reviewed: 2026-08-23\n---\nbody")?.last_reviewed).toBe("2026-08-23");
    expect(parseSkillFrontmatter("no frontmatter")).toBeNull();
  });
});

const SKILL = (o: string) => `---\nname: s\nstatus: active\nowner: ${o}\nlast_reviewed: 2026-08-01\ndescription: d\n---\nbody\n`;
const FIXTURE: Record<string, string> = {
  "docs/lifecycle/skills/alpha.md": GATEGUARD,
  "templates/common/skills/alpha/SKILL.md": SKILL("pm"),
  "templates/common/skills/beta/SKILL.md": SKILL("pm"),
  "templates/common/docs/lifecycle/skills/beta.md": "# hand authored\n",
  "templates/co-a/skills/own/SKILL.md": SKILL("worker"),
  "templates/co-a/skills/alpha/SKILL.md": SKILL("worker"), // same name as common: covered by the common record
  "templates/co-a/skills/hand/SKILL.md": SKILL("worker"),
  "templates/co-a/docs/lifecycle/skills/hand.md": "# hand authored\n",
};
const DIRS = ["templates/common/docs/lifecycle/skills", "templates/co-a/docs/lifecycle/skills"];

describe("planning", () => {
  test("common projection, variant derivation, shared names skipped, unmarked files left alone", () => {
    const plan = planTemplateRecords(mapTree(FIXTURE), {});
    expect(plan.records.map((r) => `${r.group}:${r.skill}:${r.kind}`)).toEqual(["common:alpha:projected", "co-a:own:derived"]);
    expect(plan.handAuthored.map((h) => `${h.group}:${h.skill}`).sort()).toEqual(["co-a:hand", "common:beta"]);
    expect(plan.problems).toEqual([]);
  });

  test("an unmapped skill is a problem, not a guessed owner", () => {
    const t = mapTree({ ...FIXTURE, "templates/co-a/skills/ownerless/SKILL.md": "---\nname: ownerless\nstatus: active\n---\n" });
    expect(planTemplateRecords(t, {}).problems.map((p) => p.skill)).toEqual(["ownerless"]);
  });
});

describe("--check semantics (idempotence and parity)", () => {
  test("missing before write, clean after write, stale and orphan after a hand edit", () => {
    const t0 = mapTree(FIXTURE);
    const plan = planTemplateRecords(t0, {});
    expect(checkPlan(t0, plan, DIRS).map((f) => f.kind)).toEqual(["missing", "missing"]);

    const written: Record<string, string> = {};
    for (const r of plan.records) written[r.path] = r.content;
    const t1 = mapTree({ ...FIXTURE, ...written });
    expect(checkPlan(t1, planTemplateRecords(t1, {}), DIRS)).toEqual([]);

    const alphaPath = "templates/common/docs/lifecycle/skills/alpha.md";
    const t2 = mapTree({ ...FIXTURE, ...written, [alphaPath]: written[alphaPath] + "hand edit\n", "templates/co-a/docs/lifecycle/skills/gone.md": GENERATED_MARKER + "\n# gone\n" });
    const kinds = checkPlan(t2, planTemplateRecords(t2, {}), DIRS).map((f) => `${f.kind}:${f.skill}`);
    expect(kinds).toContain("stale:alpha");
    expect(kinds).toContain("orphan:gone");
    expect(kinds).not.toContain("missing:own");
  });

  test("a file without the marker is never planned or reported", () => {
    const t = mapTree(FIXTURE);
    const plan = planTemplateRecords(t, {});
    expect(plan.records.some((r) => r.skill === "beta" || r.skill === "hand")).toBe(false);
    expect(checkPlan(t, plan, DIRS).some((f) => f.skill === "beta" || f.skill === "hand")).toBe(false);
  });
});

describe("--project mode", () => {
  const proj = mapTree({
    "skills/local-a/SKILL.md": "---\nname: local-a\nstatus: active\nowner: pm\nlast_reviewed: 2026-01-02\ndescription: d\n---\n",
    "skills/local-x/SKILL.md": "---\nname: local-x\nstatus: experimental\nowner: pm\ndescription: d\n---\n",
    "skills/old/SKILL.md": "---\nname: old\nstatus: deprecated\nowner: pm\n---\n",
    "skills/common-one/SKILL.md": "---\nname: common-one\nstatus: active\nowner: pm\n---\n",
    "skills/has-record/SKILL.md": "---\nname: has-record\nstatus: active\nowner: pm\n---\n",
    "docs/lifecycle/skills/has-record.md": "# mine\n",
  });
  test("derives only local active/experimental skills without a hand record, under docs/lifecycle/skills", () => {
    const plan = planProjectRecords({ projectTree: proj, commonSkillNames: new Set(["common-one"]), ownerMap: {} });
    expect(plan.records.map((r) => r.path)).toEqual(["docs/lifecycle/skills/local-a.md", "docs/lifecycle/skills/local-x.md"]);
    expect(plan.handAuthored.map((h) => h.skill)).toEqual(["has-record"]);
  });

  test("CLI --project --write touches only the given project directory", () => {
    const root = mkdtempSync(join(tmpdir(), "slr-root-"));
    const projectDir = mkdtempSync(join(tmpdir(), "slr-proj-"));
    try {
      mkdirSync(join(root, "templates/common/skills/c"), { recursive: true });
      writeFileSync(join(root, "templates/common/skills/c/SKILL.md"), "---\nname: c\nstatus: active\nowner: pm\n---\n");
      mkdirSync(join(projectDir, "skills/mine"), { recursive: true });
      writeFileSync(join(projectDir, "skills/mine/SKILL.md"), "---\nname: mine\nstatus: active\nowner: pm\nlast_reviewed: 2026-03-04\ndescription: d\n---\n");
      const orig = console.log;
      console.log = () => {};
      try {
        expect(main(["--project", projectDir, "--write"], root)).toBe(0);
        expect(main(["--project", projectDir, "--check"], root)).toBe(0);
      } finally {
        console.log = orig;
      }
      expect(readFileSync(join(projectDir, "docs/lifecycle/skills/mine.md"), "utf-8").startsWith(GENERATED_MARKER)).toBe(true);
      expect(existsSync(join(root, "docs"))).toBe(false);
      expect(existsSync(join(root, "templates/common/docs"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("Korean handling (Language Policy)", () => {
  test("wrapHangulInCode wraps hangul runs, leaves code spans and ASCII alone, and is idempotent", async () => {
    const { wrapHangulInCode } = await import("../../scripts/generate-skill-lifecycle-records.ts");
    const once = wrapHangulInCode('stock master (종목기본정보) and `한국거래소` flow (활용신청 → 개발/운영계정)');
    expect(once).toBe("stock master (`종목기본정보`) and `한국거래소` flow (`활용신청` → `개발`/`운영계정`)");
    expect(wrapHangulInCode(once)).toBe(once);
    expect(wrapHangulInCode("plain ascii")).toBe("plain ascii");
  });

  test("a derived record with Korean in the description carries no bare hangul", () => {
    const r = deriveRecord({
      skill: "k",
      variant: "co-x",
      frontmatter: { name: "k", status: "active", owner: "pm", description: 'Say "만들어줘" to start' },
      ownerMap: {},
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const bare = r.content.replace(/`[^`]*`/g, "");
      expect(/[\uAC00-\uD7A3]/.test(bare)).toBe(false);
      expect(r.content).toContain("`만들어줘`");
    }
  });
});

describe("variant-notes preservation (U-20261122-008)", () => {
  const START = "<!-- variant-notes:start -->";
  const END = "<!-- variant-notes:end -->";
  const NOTE_LINE = "Variant delivery note (2026-11-22): NOT DELIVERED to co-security — country-scoped-pruned.";
  const BLOCK = [START, NOTE_LINE, END].join("\n");

  test("well-formed block: the exact marker-to-marker slice, no warnings", () => {
    const doc = [GENERATED_MARKER, "", "# k-dart Skill Lifecycle", "", BLOCK, "", "## Metadata", ""].join("\n");
    const { block, warnings } = extractVariantNotes(doc);
    expect(warnings).toEqual([]);
    expect(block).toBe(BLOCK);
  });

  test("absent block: null, no warnings (zero-diff no-op for unannotated records)", () => {
    const doc = [GENERATED_MARKER, "", "# k-dart Skill Lifecycle", "", "## Metadata", ""].join("\n");
    expect(extractVariantNotes(doc)).toEqual({ block: null, warnings: [] });
  });

  test("empty block (start immediately followed by end): treated as absent, no warning", () => {
    const doc = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", START, END, "", "## Metadata", ""].join("\n");
    expect(extractVariantNotes(doc)).toEqual({ block: null, warnings: [] });
  });

  test("malformed: unclosed start, stray end, and double block each WARN and drop — never throw", () => {
    const unclosed = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", START, NOTE_LINE, "", "## Metadata", ""].join("\n");
    expect(extractVariantNotes(unclosed)).toEqual({
      block: null,
      warnings: ["start marker without an end marker (unclosed at EOF)"],
    });

    const stray = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", END, "", "## Metadata", ""].join("\n");
    expect(extractVariantNotes(stray)).toEqual({
      block: null,
      warnings: ["1 end marker(s) without a start marker"],
    });

    // double block: FIRST well-formed pair wins, extras warned about
    const double = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", BLOCK, "", BLOCK, "", "## Metadata", ""].join("\n");
    const dbl = extractVariantNotes(double);
    expect(dbl.block).toBe(BLOCK);
    expect(dbl.warnings).toEqual(["1 extra start marker(s) beyond the first block", "1 stray end marker(s) outside the first block"]);

    // nesting: start, start, end
    const nested = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", START, START, "inner", END, "", "## Metadata", ""].join("\n");
    const nest = extractVariantNotes(nested);
    expect(nest.block).toBe([START, START, "inner", END].join("\n"));
    expect(nest.warnings).toEqual(["1 extra start marker(s) beyond the first block"]);
  });

  test("injectVariantNotes places the block between the H1 and ## Metadata; unexpected shape is left alone", () => {
    const doc = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", "## Metadata", "", "- x", ""].join("\n");
    const out = injectVariantNotes(doc, BLOCK);
    expect(out).toBe([GENERATED_MARKER, "", "# t Skill Lifecycle", "", BLOCK, "", "## Metadata", "", "- x", ""].join("\n"));
    expect(injectVariantNotes("no h1 here", BLOCK)).toBe("no h1 here");
  });

  test("round-trip is byte-identical (extract -> inject -> extract)", () => {
    const doc = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", "## Metadata", ""].join("\n");
    const once = injectVariantNotes(doc, BLOCK);
    const { block } = extractVariantNotes(once);
    expect(block).toBe(BLOCK);
    expect(injectVariantNotes(doc, block as string)).toBe(once);
  });

  test("verbatim guarantee: internal-ref lines and Hangul inside the block survive untouched", () => {
    const hostile = [START, "- cites ADR-0103 and docs/designs/2026-01-01-x-design.md", "- 한국거래소 flow (종목기본정보)", END].join("\n");
    const doc = [GENERATED_MARKER, "", "# t Skill Lifecycle", "", "## Metadata", ""].join("\n");
    const out = injectVariantNotes(doc, hostile);
    // finalizeClean would have filtered the ADR line and code-wrapped the Hangul;
    // preservation bypasses it, so both lines are byte-identical.
    expect(out).toContain("- cites ADR-0103 and docs/designs/2026-01-01-x-design.md");
    expect(out).toContain("- 한국거래소 flow (종목기본정보)");
    expect(out).not.toContain("`한국거래소`");
  });

  test("CLI --check parity and --write preservation on a real tmp tree (the single main() choke point)", () => {
    const root = mkdtempSync(join(tmpdir(), "slr-notes-"));
    try {
      mkdirSync(join(root, "templates/common/skills/alpha"), { recursive: true });
      writeFileSync(
        join(root, "templates/common/skills/alpha/SKILL.md"),
        "---\nname: alpha\nstatus: active\nowner: pm\n---\n",
        "utf-8",
      );
      const recordPath = join(root, "templates/common/docs/lifecycle/skills/alpha.md");
      const silence = () => {
        const origLog = console.log;
        const origErr = console.error;
        console.log = () => {};
        console.error = () => {};
        return () => {
          console.log = origLog;
          console.error = origErr;
        };
      };
      let restore = silence();
      try {
        expect(main(["--write"], root)).toBe(0);
      } finally {
        restore();
      }
      const clean = readFileSync(recordPath, "utf-8");
      expect(isGeneratedRecord(clean)).toBe(true);
      expect(clean).not.toContain(START);

      // The one-time hand migration: the annotation lands at the seam, wrapped in markers.
      const annotated = injectVariantNotes(clean, BLOCK);
      writeFileSync(recordPath, annotated, "utf-8");
      restore = silence();
      try {
        expect(main(["--check"], root)).toBe(0); // parity exact for annotated records
        expect(main(["--write"], root)).toBe(0); // byte-identical skip, nothing rewritten
      } finally {
        restore();
      }
      expect(readFileSync(recordPath, "utf-8")).toBe(annotated);

      // A malformed block is WARNed, dropped, and deterministically rewritten without residue.
      writeFileSync(recordPath, injectVariantNotes(clean, `${START}\n${NOTE_LINE}\n`), "utf-8");
      let warnText = "";
      const origErr = console.error;
      console.error = (s?: unknown) => {
        warnText += String(s ?? "");
      };
      const origLog = console.log;
      console.log = () => {};
      try {
        expect(main(["--write"], root)).toBe(0); // exit code unchanged by the WARN
      } finally {
        console.error = origErr;
        console.log = origLog;
      }
      expect(warnText).toContain("[WARN]");
      expect(warnText).toContain("variant-notes block start marker without an end marker");
      const rewritten = readFileSync(recordPath, "utf-8");
      expect(rewritten).toBe(clean); // block dropped: regenerated content, no marker residue
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
