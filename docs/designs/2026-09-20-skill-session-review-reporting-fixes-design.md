# Design: skill-session-review reporting fixes (Q3 2026 review findings)

- **Spec ID**: 2026-09-20-skill-session-review-reporting-fixes
- **Date**: 2026-09-20
- **Status**: implemented
- **Origin**: Q3 2026 skill review (§10) — two 🟢 findings batched for the next release cycle (`memory/2026-09-20.md` § Skill Review Q3 2026)
- **Amends**: docs/designs/2026-09-06-skill-session-review-design.md (reporting behavior only; evidence schema unchanged)
- **ADR refs**: ADR-0074 (Universal Design Gate), ADR-0036 (TypeScript automation scripts)

## Problem

Two defects in `scripts/skill-session-review.ts` v1.0.0 reporting, both observed live during the 2026-09-20 Q3 review:

1. **Misleading zero-record message** — `renderMarkdown` prints
   `No skill usage evidence found in memory/<date>.md (## Skills Used absent or empty)`
   whenever `records.size === 0`, even when evidence entries WERE parsed and simply
   classified into zero symptoms. Result: 11 identical "no evidence" blocks
   accumulated in `memory/skill-review/2026-09-20.md` on a day with 6 real evidence
   entries, sending future triagers hunting for a parsing bug that does not exist.
2. **Evidence double-count** — `parseSkillsUsed` collects section bodies via
   `sectionRe` (lazy capture ending at `\n---\n`) and additionally via `tailMatch`
   (last section to EOF). The dedupe guard `!bodies.includes(tailMatch[1])` never
   fires for the final section because the two strings differ (the tail extends past
   the `---` separator). The same `## Skills Used` section is therefore parsed twice:
   the 2026-09-20 log reported `Evidence entries: 6` for 3 real entries.

## Requirements

- R1: When evidence entries exist but no symptom records classify, the generated
  block and console output must say so explicitly (evidence count included), and
  must not claim the section is "absent or empty".
- R2: A `## Skills Used` section must be parsed exactly once per sync run
  (`Evidence entries` must equal the real entry count).
- R3: No change to the evidence schema, symptom classifier, YAML block format, or
  CLI surface (`--date`, `--json`, `--dry-run` all unchanged).

## Design

- **F1 (message)**: in `renderMarkdown`, branch on `evidence.length`:
  - `evidence.length === 0` → keep the existing "No skill usage evidence found
    (`## Skills Used` absent or empty)" line.
  - `evidence.length > 0 && records.size === 0` → print
    `N evidence entries found in memory/<date>.md; none classified as symptoms (no actionable observations matched classifier heuristics).`
  The console path already distinguishes the two ("Evidence entries: N … No
  symptoms to record") and is left unchanged.
- **F2 (dedupe)**: replace the identity dedupe with a prefix check —
  `if (tailMatch && !bodies.some((b) => tailMatch[1].startsWith(b))) bodies.push(tailMatch[1]);`
  When the tail body is the final `sectionRe` body extended to EOF it starts with
  that body and is dropped; a genuinely different tail (no trailing `---`, e.g.
  section at EOF) still lands because `startsWith` holds only for the identical
  prefix. A tail that matches no section body is still appended.

## Acceptance Criteria

- AC1: Memory log with a filled `## Skills Used` section and zero classifiable
  observations → dry-run reports `Evidence entries: N` (not `2N`); generated block
  contains the "none classified as symptoms" line, not "absent or empty".
- AC2: Memory log with no `## Skills Used` section → unchanged legacy message.
- AC3: Memory log whose final section runs to EOF without `---` → entry count equals
  the real entry count (tail appended, not duplicated).
- AC4: `bun scripts/typecheck.ts` stays at the zero-error baseline; existing
  pipeline behavior (`--json` shape) unchanged except the intended message fields.

## Accessibility

Not applicable — CLI-only tooling change; no user-facing UI, no content rendering
beyond plain-text console/file output already covered by the workspace language rules.

## Preview Verification

Not applicable — non-UI change; verified by dry-run execution against the real
2026-09-20 memory log (AC1 evidence recorded in the session memory log).

## Trade-offs

- The prefix dedupe assumes the tail match always corresponds to the file's final
  section; this holds because `tailMatch` anchors on the LAST `## Skills Used`
  occurrence (regex `.exec` finds the first, but `parseSkillsUsed` compares against
  all collected bodies — a mid-file section extended to EOF is impossible since
  later sections follow it). Confirmed against the 2026-09-06..09-20 logs.
- Message text is English-only per the workspace language policy.
