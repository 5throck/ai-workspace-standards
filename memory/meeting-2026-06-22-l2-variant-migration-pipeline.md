# Meeting Transcript
**Date**: 2026-06-22
**Topic**: L2→Variant Migration Pipeline: pm.md and AGENTS.md Structure Organization Timing and Methodology
**Participants**: automation-engineer, auditor (PM as facilitator)
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Automation Engineer]**: (Round 1)

Looking at the current pipeline from an implementation perspective, the role separation between the two stages is unclear in several places. Phase 4 (`generate-variant.ts`) generates both pm.md and AGENTS.md simultaneously, then Phase 4.5 catches missing VARIANT-* markers as BLOCKING, and Phase 4.6 post-processes pm.md. The sequence is: generate (4) → validate (4.5) → pm post-processing (4.6), which is logically inverted. **The source L2 files need to be structured correctly before generation** to guarantee generation quality.

The biggest problem I see is that Stage 1 lacks a "structural preparation (normalization)" step. Currently Phase 1.5 only handles agent/skill frontmatter normalization. **The 200-line limit check for pm.md and the VARIANT-* marker existence check for AGENTS.md should be performed as PRE-FLIGHT CHECKs in Stage 1 (Phase 1.5 or a new Phase 1.6)** so that Stage 2 generation runs cleanly.

My concrete proposed sequence: After Phase 1.5 agent frontmatter normalization, add a **Phase 1.6 (NEW)** that checks pm.md line count + analyzes AGENTS.md structure (VARIANT-* markers, §-section existence), controlled by an `--auto-normalize` flag. If auto-fix is enabled, call `regenerate-agents-md.ts` logic inline; if disabled, halt with a clear error message.

Question to Auditor: Now that we've made Phase 4.5 BLOCKING, if we add a pre-flight in Stage 1, should the Stage 2 BLOCKING be maintained as double defense, or can it be lightened if Stage 1 resolves it?

**[Auditor]**: (Round 1)

I agree with Automation Engineer's analysis. The principle of "clean up source before generation" is key. The current structure — dirty input → generate → blocking — risks leaving half-generated files if generation fails midway.

From a structural consistency perspective, pm.md and AGENTS.md have different roles, so **their cleanup timing should also differ**:

**pm.md** is an agent behavior guide document. At L2, it should only contain variant-specific workflow peculiarities, delegating common content via `extends: ../../common/agents/pm.md`. The 200-line limit is a proxy check for whether this delegation structure works correctly. Therefore, pm.md cleanup should happen **at the beginning of Stage 1 (before Phase 1.5)** — if the `extends:` pattern is absent or the file exceeds 200 lines, there's a risk of L0 duplication bugs, so this is where we should require human confirmation or propose auto-slimming.

**AGENTS.md** is the anchor file for pipeline injection. Without VARIANT-*-START/END markers, `generate-variant.ts`'s `injectVariantPlaceholders()` does nothing. This is more critical than pm.md — a thick pm.md still functions, but missing AGENTS.md markers completely nullifies the §-structure injection across the entire pipeline. Therefore, AGENTS.md structure validation should be placed **at the end of Stage 1 (Phase 3 or a new Phase 3.5)**, serving as the final gate before entering Stage 2.

I propose splitting Automation Engineer's suggested Phase 1.6 into two: **Phase 1.6 = pm.md structure check/slimming**, **Phase 3.5 = AGENTS.md §-structure check/regeneration**. The Stage 2 Phase 4.5 BLOCKING should be maintained as "double defense" — because Stage 1 can be bypassed with `--skip-normalize`, and external direct edits to AGENTS.md can break the structure.

---

### Round 2

**[Automation Engineer]**: (Round 2)

I strongly agree with Auditor's role-based timing separation proposal. The distinction that pm.md is handled at the start of Stage 1 and AGENTS.md at the end is logically clear.

Additional implementation points: For **Phase 1.6 (pm.md slimming)**, the hardest part is automatically determining "what to remove." As we experienced during the co-deck pm.md work, content inherited from L0/L1 (Permission Denial Protocol, Consensus-Driven Facilitation) that's duplicated at L2 causes 200-line overruns. This duplication detection logic is more complex than a simple line count check — **reading the L1 common pm.md's section header list and flagging identical sections in L2 as "redundant"** is the practical approach.

**Phase 3.5 (AGENTS.md §-structure check)** is cleanest by directly calling `regenerate-agents-md.ts`. The script already exists and supports `--dry-run` preview mode. Pipeline control via `--auto-fix-agents-md` flag.

One boundary to respect: Both Phase 1.6 and 3.5 are **write operations**. If the pipeline directly modifies source files, git state changes unexpectedly. The default should be conservative — read-only analysis unless `--auto-fix` is explicitly specified, and git stash or backup must precede any modification.

Auditor, the current role of Phase 4.6 (pm.md post-processing) likely overlaps with Phase 1.6 in some ways — how should these two phases' roles be separated?

**[Auditor]**: (Round 2)

The Phase 1.6 / 4.6 role overlap Automation Engineer identified is the key problem. Phase 4.6 is currently named "pm.md processing and context.md generation" — looking at the pipeline code, it handles the `extends:` pattern in pm.md and injects variant-specific sections.

The role separation should be:

- **Phase 1.6 (Pre-flight: pm.md structure diagnosis)** — read-only. Analyzes whether pm.md uses the correct `extends:` pattern, has duplicate sections, or exceeds 200 lines, and **outputs a report only**. If `--auto-fix` flag is present, performs duplicate section removal and slimming at this stage. This phase is diagnostics on the L2 source file.

- **Phase 4.6 (Generation: pm.md post-processing)** — write. Interprets the `extends:` pattern to inject L1 content inline or by reference, and fills variant-specific sections (`<!-- VARIANT-SECTION: ... -->` markers) with variant data. This phase is completion work on the generated variant file.

Summary: **Phase 1.6 is "source diagnosis + optional correction"**, **Phase 4.6 is "generation completion"**. These two phases differ in input (L2 source vs. generated variant) and purpose (diagnosis vs. completion), so they are not redundant.

Recommended migration checklist:

```
Stage 1 (Scan & Prepare):
  Phase 1   — L2 project scan
  Phase 1.5 — agent/skill frontmatter normalization
  Phase 1.6 — pm.md structure diagnosis [NEW: 200-line check, extends pattern, duplicate section detection]
  Phase 2   — L0/L1 reconciliation
  Phase 3   — dependency validation
  Phase 3.5 — AGENTS.md §-structure check + VARIANT-* marker validation [NEW]

Stage 2 (Generate & Validate):
  Phase 4   — variant generation
  Phase 4.5 — structural gap check (BLOCKING — maintain double defense)
  Phase 4.6 — pm.md post-processing + context.md generation
  Phase 5   — beta lifecycle initialization
  Phase 6   — platform parity validation
  Phase 7   — workspace integration
```

In this structure, Stage 1 guarantees "the source is in a generatable state," and Stage 2 guarantees "generation completed correctly." Processing pm.md at the beginning of Stage 1 and AGENTS.md at the end is the natural flow.

---

## Synthesis

**Points of Agreement**:
1. pm.md and AGENTS.md require different cleanup timing — pm.md at Stage 1 start (Phase 1.6), AGENTS.md at Stage 1 end (Phase 3.5)
2. Phase 1.6 (pm.md pre-flight diagnosis) should be new — read-only default, file modification only with `--auto-fix`; duplicate section detection via L1 section header comparison
3. Phase 3.5 (AGENTS.md §-structure check) should be new — calls `regenerate-agents-md.ts` controlled by `--auto-fix-agents-md` flag
4. Phase 4.5 BLOCKING should be maintained as double defense against `--skip-normalize` bypass and external structural corruption
5. Phase 4.6 role redefined as "generated variant pm.md completion work" separated from source diagnosis (1.6)
6. Git backup required before any auto-fix source modification

**Open Disagreements / Unresolved Questions**:
- Precision of Phase 1.6 "duplicate section auto-detection" logic — strategy needed to prevent false positives (flagging intentional L2 overrides as duplicates)
- Decision needed: keep `regenerate-agents-md.ts` as standalone script or integrate as pipeline helper

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Add Phase 1.6 to `l2-to-variant-pipeline.ts` — pm.md structure diagnosis (read-only default, `--auto-fix` option) | L0-only | Phase 4 |
| A-02 | automation-engineer | Low | Add Phase 3.5 to `l2-to-variant-pipeline.ts` — AGENTS.md §-structure check + `regenerate-agents-md.ts` integrated call | L0-only | Phase 4 |
| A-03 | automation-engineer | Medium | Redefine Phase 4.6 role documentation — update comments/docstring from "source diagnosis" to "generation completion" | L0-only | Phase 4 |
| A-04 | auditor | Medium | Reflect Phase 1.6/3.5 additions in `scripts/SCRIPTS.md` and document in `docs/adr/` migration guide | L0-only | Phase 5 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Phase 1.6 exits with error (not BLOCKING) when pm.md exceeds 200 lines without --auto-fix | Run pipeline on co-deck with pm.md artificially inflated to 210 lines |
| 2 | Phase 3.5 runs regenerate-agents-md.ts in dry-run mode by default | Run pipeline on a misaligned variant; confirm AGENTS.md unchanged without --auto-fix-agents-md |
| 3 | Phase 4.5 BLOCKING still fires even if Phase 3.5 ran | Simulate Phase 3.5 bypass; confirm Phase 4.5 catches the structural gap |
| 4 | Phase 4.6 does not modify source L2 pm.md, only generated variant pm.md | Verify source L2 pm.md git status unchanged after Phase 4.6 |
