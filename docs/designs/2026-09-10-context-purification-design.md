# Design: Context Purification — Promotion-Time Extraction (W1) + Upgrade-Time Commonization (W2)

**Date**: 2026-09-10
**Status**: Draft (Row 0 Design Gate document; facts verified 2026-09-10 by a 3-agent fleet survey plus direct code reads; load-bearing line citations re-confirmed by architect the same day)
**Source**: PM-dispatched architect task
**Spec ID**: 2026-09-10-context-purification-design
**Related**: [ADR-0050](../adr/) Part 3 (Context Commonization Review, WARN-first playbook), [ADR-0065](../adr/0065-accessibility-standard.md), ADR-0066/0063 (procedures), [2026-09-10-marker-engine-remediation-design.md](2026-09-10-marker-engine-remediation-design.md), `scripts/l3-to-variant-pipeline.ts`, `scripts/helpers/generate-variant.ts`, `scripts/upgrade-project.ts`, `scripts/helpers/context-sections.ts`, `scripts/promote-context-section.ts`, `skills/context-commonization-review`

---

## Background

**The convention.** `docs/context.md` in live projects is 100% template-owned boilerplate (IMMUTABLE, per the `templates/common/docs/context.md` header). All project-specific content belongs in `docs/<variant>.context.md`. Two complementary mechanisms enforce this: **W1 purification at variant promotion** (project-only sections in a promoted project's `docs/context.md` must land in the generated variant's `<variant>.context.md` instead of being silently dropped) and **W2 commonization at upgrade** (near-duplicate sections in `<variant>.context.md` are removed after `upgrade-project` refreshes `docs/context.md`).

**W1 — today's loss point.** The promotion pipeline already excludes the project's `docs/context.md` from the promoted template: `SKIP_IN_COPY` contains `'docs/context.md'` with the comment "the stale immutable context leaks into the promoted variant template" (`scripts/helpers/generate-variant.ts:1577-1591`), and smoke Test 5b asserts its absence from the output (`scripts/test-l3-to-variant-promotion.ts:287-289`). WS-07 (`checkNoVariantLocalContextMd`, `scripts/validate-templates.ts:2867-2877`) hard-fails if `templates/<variant>/docs/context.md` exists. Consequence: any project-only content in a promoted project's `docs/context.md` is **silently lost today**. The purification seam sits one step later in the same copy loop: the L3 source's `<variant>.context.md` overwrites the generated skeleton and `ensureVariantInjectMarkers` re-wraps the 8 slots (`scripts/helpers/generate-variant.ts:1615-1622`). Pipeline Phase 4.6 appends the pm.md-derived PM section via `writeContextMd` (pipeline :1048-1079); a new **Phase 4.7** (after :1079) is the fail-closed reporting/gate location.

**Reusable parsing.** `scripts/helpers/context-sections.ts` (75 lines) exports `splitIntoSections`, `normalizeHeading`, `computeLineOverlapSimilarity` (line-overlap, `|∩|/min`), `getContentLines`; `scripts/helpers/markers.ts:114` exports `findMarkerZones`. Two verified gaps shape the new helper: (1) `splitIntoSections`'s heading regex (`/^#{2,3}\s+/`, context-sections.ts:43) is **not fence-aware** — the fleet files contain `##`-style headings inside ``` fences (e.g. Session Log Format examples) that must not count as section boundaries; (2) the module header declares it "used by both audit.ts's cross-variant context commonization detector and promote-context-section.ts's promotion executor" — the new `extractProjectOnlySections` belongs in this same module so the three consumers never drift.

**Legacy-stub classification (tuning target).** The only non-template heading in the entire 11-project fleet is `## Procedures` — a 2-line stub ("Structured workflows live in `procedures/<name>/schema.yaml` (ADR-0066/0063)... validate-procedures.ts... skill graph derives procedure/output_type nodes") present in 6 variant context files (co-abap:305 — verified by direct read of `templates/co-abap/docs/co-abap.context.md` — plus co-architect:348, co-consult:350, co-deck:350, co-price:350, co-safety:354 per survey). It is superseded by the common template's `## Lifecycle Management → ### Procedure Graph` (`templates/common/docs/context.md:425-431`), which carries the same three load-bearing facts plus the authoring skeleton, coverage check, and spec links. **User decision on record**: Procedures is a common concern already applied commonly, so dropping the stub IS the correct handling. Classification rule: a candidate section (normalized heading absent from the common template's heading set) with high `computeLineOverlapSimilarity` against some common section is "superseded boilerplate" → DROPPED (logged); everything else is project-only → migrated. The threshold must be tuned against the 6 real Procedures sections — they must classify as dropped, not migrated.

**W2 — the upgrade asymmetry.** `upgrade-project`'s VARIANT_DOCS_SYNC (`scripts/upgrade-project.ts:850-912`) overwrites `docs/context.md` from the template by `*context.md version: X.Y*` footer comparison; `<variant>.context.md` is only touched by DOCS_MERGE managed-block merge (template blocks ↔ project blocks positional; project content outside blocks silently survives). Near-duplicate sections therefore accumulate in variant context files (survey: `## Computational Integrity` in co-develop/co-game/co-security ≈ constitution §8.13; `### Hybrid Scripting` ≈ §8.8) and become redundant the moment a v2.6 refresh lands. Fix: a new **CONTEXT_COMMONIZATION** pass (→ v1.20.0), inserted AFTER VARIANT_DOCS_SYNC so it compares against the just-refreshed `docs/context.md`: for each top-level section of `docs/<variant>.context.md`, line-overlap similarity vs every common section — ≥ threshold (default 0.8, tune against real fleet files) → REMOVE; mixed/partial overlap → NEVER auto-removed, reported for the manual Context Commonization Review (ADR-0050 Part 3 WARN-first playbook; `scripts/promote-context-section.ts` is that playbook's executor). Exclusions: COMMON-CONTEXT zones (engine-managed, marker-inject domain targets), VARIANT-INJECT blocks (the `guidelines` slot is REQUIRED — audit.ts flags absence), the version footer. Everything logged; `--dry-run` honored; opt-out flag `--skip-context-commonization`.

**Delivery.** Bumping the `templates/common/docs/context.md` footer 2.5 → 2.6 (new Schema Governance zone: "DB schema changes require an ADR before merge") triggers VARIANT_DOCS_SYNC delivery to all 11 projects. The fleet survey showed all 11 `docs/context.md` files are heading-set identical to the template except the superseded Procedures stubs, so the overwrite is safe (stubs drop, richer Procedure Graph arrives). Per-project changes stay **UNCOMMITTED** in each project's own git repo (each has `.git`; pre-upgrade stash = rollback). `co-newbiz` has no variant template and self-declares `commonOnlySync: true` in `variant.json` (`scripts/upgrade-project.ts:238-250`, verified); `co-architect` to be verified at run time.

**Confirmation layer.** `PROMOTION_CHECKLIST-template.md` exists in two copies (`templates/common/docs/_templates/` and `docs/templates/`, both verified): Criteria 1 (Folder Structure Compliance, :19) gains a "context purification verified" bullet; Criteria 6 (Documentation Completeness, :117) a secondary item. `.agents/skills/promote-variant/SKILL.md`: Step 1 (:48) gains a purification assertion, Step 3's expected-output list (:86) gains purification lines; Step 3 also carries a **pre-existing CLI drift** — documented flags `--source/--variant/--variantType` (:91-93) do not match the pipeline's actual parser `--l3-path/--name/--type/--description` (pipeline :1284-1315, verified) — corrected here while we are in the file.

---

## Goals / Non-Goals

### Goals

- G1 (W1) — `extractProjectOnlySections(projectContextMd, commonContextMd)` helper in `context-sections.ts` (fence-aware, zone-excluding, superseded-classifying) + purification hook at the generate-variant seam + Phase 4.7 fail-closed gate.
- G2 (W2) — CONTEXT_COMMONIZATION pass in `upgrade-project.ts` with mixed-section preservation, exclusions, logging, `--dry-run`, and `--skip-context-commonization`.
- G3 — Confirmation layer: both PROMOTION_CHECKLIST copies + promote-variant SKILL.md edits, including the Step 3 CLI-drift correction.
- G4 — Delivery: footer 2.5 → 2.6 + post-merge fleet batch with per-project changes left uncommitted.
- G5 — Tests: promotion-pipeline integration case + unit suites for the W1 helper and W2 pass rules.

### Non-Goals

- NG1 — **No upgrade-project migration pass**: promotion owns separation (see D1 rationale). W2 only removes near-duplicates; it never migrates content anywhere.
- NG2 — **No auto-surgery on mixed/partial-overlap sections**: they are reported for the manual Context Commonization Review, never auto-edited.
- NG3 — **No commits in project repos**: post-batch per-project changes stay uncommitted; commits are each project owner's call.
- NG4 — Pre-existing project-side defects stay out of scope (e.g. co-abap's duplicated 963-line context file).

---

## Decision

**Why promotion-time purification + upgrade-time commonization rather than an upgrade-project migration pass:** the promotion pipeline is where project content is *lost* — `SKIP_IN_COPY` discards `docs/context.md` and WS-07 makes a variant-owned copy illegal, so purification must sit exactly at that loss point (D1), where the L3 source is still available for reading. At upgrade time the L3 source no longer exists, so `upgrade-project` could never migrate retroactively; what it *can* do — and what the fleet actually needs, since the survey found zero true project-only content in live projects — is remove sections that have become redundant after a common refresh (D2). Separation belongs to promotion; hygiene belongs to upgrade.

### D1 — W1: `extractProjectOnlySections` + seam hook + Phase 4.7 gate

- **Helper** in `scripts/helpers/context-sections.ts`: `extractProjectOnlySections(projectContextMd, commonContextMd)` → `{ migrated: ContextSection[], dropped: { section, reason }[] }`. Fence-aware (track ``` and ~~~ spans before classifying heading lines — closes the verified :43 gap), excludes content inside COMMON-* zones and VARIANT-INJECT blocks via `findMarkerZones` (`helpers/markers.ts:114`), compares normalized heading sets against the common template, then classifies each candidate by `computeLineOverlapSimilarity` against every common section: ≥ tuned threshold → superseded/dropped; below → project-only/migrated.
- **Hook** in `scripts/helpers/generate-variant.ts` at the :1615-1622 seam: after `ensureVariantInjectMarkers` re-wraps, append migrated sections to the final `docs/<variant>.context.md` **before its version footer, `---`-separated**; return the ledger (migrated/dropped) in the generation summary.
- **Phase 4.7** in `scripts/l3-to-variant-pipeline.ts` (after :1079): fail-closed gate over the ledger — every extracted section must appear either merged (heading present in the output file) or dropped-with-logged-superseded-reason; anything else fails the pipeline. Because the gate reads the file *after* Phase 4.6's `writeContextMd` append, any ordering interaction between the hook and the PM-section append surfaces here rather than silently.

### D2 — W2: CONTEXT_COMMONIZATION pass in `upgrade-project.ts` (→ v1.20.0)

New pass inserted immediately after VARIANT_DOCS_SYNC (:850-912), comparing `docs/<variant>.context.md` top-level sections against the just-refreshed `docs/context.md`. Rules: similarity ≥ threshold (default **0.8**, tuned on real fleet files) → remove section + log; mixed/partial overlap → never auto-removed, emitted as a Context Commonization Review report item (ADR-0050 Part 3). Exclusions: COMMON-CONTEXT zones, VARIANT-INJECT blocks (`guidelines` slot required by audit), version footer. All actions logged; `--dry-run` honored; `--skip-context-commonization` opt-out.

### D3 — Confirmation layer

1. Both `PROMOTION_CHECKLIST-template.md` copies: Criteria 1 gains a "context purification verified" bullet (assert promoted output has no `docs/context.md` and that project-only sections landed in `<variant>.context.md`); Criteria 6 gains a secondary documentation-completeness item for the same. The two copies must stay byte-identical.
2. `skills/promote-variant/SKILL.md` (SSOT; `.claude`/`.gemini`/`.agents` copies refresh via `sync-skills.ts` during `/sync` — the `.agents` copy is currently identical, verified): Step 1 gains a purification assertion; Step 3's expected-output list gains purification lines; Step 3's flags corrected to the real parser contract `--l3-path/--name/--type/--description` (pipeline :1284-1315).

### D4 — Delivery: footer 2.5 → 2.6 + post-merge fleet batch

Add the Schema Governance zone to `templates/common/docs/context.md` and bump the footer to 2.6 — this alone drives VARIANT_DOCS_SYNC delivery to all 11 projects. Safe because every fleet `docs/context.md` is heading-set identical to the template except the superseded stubs (user decision on record: dropping them is correct). After the PR merges, batch `upgrade-project` across all 11 projects; per-project changes stay **uncommitted** (pre-upgrade stash = rollback). `co-newbiz` runs via its `commonOnlySync: true` self-declaration (upgrade-project:238-250); `co-architect`'s missing variant template is verified at run time (it must self-declare like co-newbiz or the batch flags it).

### D5 — Version bumps + registry rows

`upgrade-project` 1.19.2 → 1.20.0; `l3-to-variant-pipeline.ts`, `helpers/generate-variant.ts`, `helpers/context-sections.ts` minor bumps; SCRIPTS.md rows updated in `scripts/SCRIPTS.md` **and** the L1 mirror `templates/common/scripts/SCRIPTS.md` (verified present).

### D6 — Verification gates

1. Unit suite (`bun scripts/test-runner.ts unit`) incl. new W1/W2 unit tests.
2. `bun scripts/test-l3-to-variant-promotion.ts` green incl. the new purification case.
3. `bun scripts/validate-templates.ts` (WS-07 and friends).
4. `bun scripts/lifecycle-sync-audit.ts` + `bun scripts/audit.ts`.
5. **One dry-run fleet pre-check** (`upgrade-project --dry-run` on a single real project) to validate threshold behavior and the W2 report before the full 11-project batch.

---

## Proposed Changes

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `scripts/helpers/context-sections.ts` | Modify | D1: add fence-aware `extractProjectOnlySections` (zone exclusion via `findMarkerZones`, heading-set diff, superseded classification) + ledger type |
| 2 | `scripts/helpers/generate-variant.ts` | Modify | D1: purification hook at :1615-1622 seam; merged sections before version footer, `---`-separated; ledger in summary |
| 3 | `scripts/l3-to-variant-pipeline.ts` | Modify | D1: Phase 4.7 fail-closed gate after :1079 consuming the ledger |
| 4 | `scripts/upgrade-project.ts` | Modify | D2: CONTEXT_COMMONIZATION pass after VARIANT_DOCS_SYNC; `--skip-context-commonization`; version 1.19.2 → 1.20.0 |
| 5 | `templates/common/docs/context.md` | Modify | D4: Schema Governance zone + footer 2.5 → 2.6 |
| 6 | `templates/common/docs/_templates/PROMOTION_CHECKLIST-template.md` | Modify | D3: Criteria 1 bullet + Criteria 6 secondary item |
| 7 | `docs/templates/PROMOTION_CHECKLIST-template.md` | Modify | D3: mirror of row 6 (keep copies identical) |
| 8 | `skills/promote-variant/SKILL.md` | Modify | D3: Step 1 assertion, Step 3 purification outputs + CLI-drift fix (`--l3-path/--name/--type/--description`) |
| 9 | `scripts/test-l3-to-variant-promotion.ts` | Modify | D6: new case extending Tests 5a/5b/5c (:264-296) — inject a project-only section AND a Procedures-like stub into the fixture's `docs/context.md`; assert the section appears in promoted `docs/co-e2etest.context.md`, the stub does not, `docs/context.md` absent |
| 10 | `tests/unit/context-purification.test.ts` | Create | D6: W1 unit tests (fence-awareness, zone exclusion, superseded classification incl. the 6 real stubs as fixtures) + W2 rules (high-overlap removal, mixed preservation + report, managed-region exclusions, footer preservation) |
| 11 | `scripts/SCRIPTS.md` + `templates/common/scripts/SCRIPTS.md` | Modify | D5: registry rows for the bumped scripts (L0 + L1 mirror) |

Execution order: **Sequential**, single PR (see Trade-offs). Rows 1-3 (W1), row 4 (W2), and rows 5-8 (delivery/confirmation) are logically independent but share the D6 gate sequence and the §3.3 branch rule.

Verification checklist (D6, in order):
- [ ] Unit suite green, incl. new `tests/unit/context-purification.test.ts`
- [ ] `scripts/test-l3-to-variant-promotion.ts` green incl. new purification case
- [ ] `validate-templates.ts` passes (WS-07 confirms no variant carries `docs/context.md`)
- [ ] `lifecycle-sync-audit` + `audit.ts` pass
- [ ] Single-project `--dry-run` pre-check reviewed: W2 removals = expected near-duplicates, Procedures stubs classified dropped, mixed sections reported not touched
- [ ] Post-merge batch: 11/11 projects upgraded; all repos left with uncommitted changes only

---

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | No `.claude/` files authored; the `.claude/skills/promote-variant` copy auto-refreshes from the SSOT via `sync-skills.ts` |
| Antigravity | changes required | `.agents/skills/promote-variant/SKILL.md` — refreshed from the SSOT edit (row 8) via `sync-skills.ts`; verified currently identical to `skills/promote-variant/SKILL.md` |
| templates/common | changes required | `templates/common/docs/context.md` (row 5), `templates/common/docs/_templates/PROMOTION_CHECKLIST-template.md` (row 6), `templates/common/scripts/SCRIPTS.md` (row 11) — exactly 3 template files, at the high-risk boundary, not above it |

---

## Trade-offs

- **Single PR, sequential**: per CONSTITUTION §3.3, `dev-sync.ts` touches shared pipeline files on every commit, so parallel branches conflict by default; W1/W2/delivery also share the D6 gate sequence.
- **Similarity thresholds are heuristics tuned on real fleet data**: the W1 superseded threshold and the W2 default 0.8 are tuned against the 6 real Procedures sections (must classify dropped) and the fleet's near-duplicates (Computational Integrity, Hybrid Scripting — must classify removed). **Tuned values are recorded in the PR description before merge.** Risk of a false drop is mitigated by drop-logging, the Phase 4.7 fail-closed gate, and tests pinned to the real stubs.
- **W2 is destructive-but-guarded**: it deletes sections from variant context files. Guards: managed-region exclusions, mixed-never-auto-remove, `--dry-run`, opt-out flag, full logging, and uncommitted-first delivery (project stash = rollback).
- **W1 grows promoted `<variant>.context.md` files**: migrated project-only content is appended before the version footer. Accepted — it is exactly the content the convention says belongs there, and the fleet survey says it will rarely be non-empty.
- **Purification only helps future promotions** (NG1): acceptable because live projects carry no true project-only content today — only the superseded stubs, which W2/D4's refresh removes.

---

## Accessibility

**Explicit exemption per ADR-0065** (backend/non-UI exemption, stated as required): this is engine-and-documentation work with no user-facing UI, CLI interaction surface beyond existing flags, or generated-document presentation change. No keyboard, screen-reader, contrast, motion, or target-size impact. Standard Markdown review is the only applicable verification.

---

## Known Limitations

- **No retroactive separation** for projects promoted before this change (NG1) — by design; the fleet has nothing to migrate.
- **Fence-tracking scope**: the fence-aware parser handles ``` and ~~~ fences; exotic constructs (indented code blocks containing `##` lines) are not tracked. No fleet file contains such a construct (survey).
- **W2 report items have no automatic follow-up**: mixed sections rely on the human-run Context Commonization Review (ADR-0050 Part 3 + `promote-context-section.ts`); this design intentionally adds no new automation there (NG2).

---

## Open Questions

- None blocking implementation. For the record: `co-architect`'s exact upgrade path (missing variant template → must self-declare `commonOnlySync` like co-newbiz or be flagged) is verified at batch run time per D4, not a design question.
