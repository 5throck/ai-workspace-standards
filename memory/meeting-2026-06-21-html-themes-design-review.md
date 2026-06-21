# Meeting Transcript
**Date**: 2026-06-21
**Topic**: Review html-themes per-theme style design doc — surface improvements/supplements needed
**Participants**: architect, automation-engineer, docs-writer, auditor (synthesizer)
**Rounds**: 2
**Language**: Korean (transcript archived in English)
**Status**: Complete
**SUPERSEDED (2026-06-21)**: The visual-heavy deletion in A-03 is WITHDRAWN. Implementation-time verification showed visual-heavy is scroll-**partial** / slideshow-incompatible (not "incompatible with both") and has active `renderSlide()` logic (injects `--slide-bg-image` for `data-style === 'visual-heavy'` in `agents/html-build.md`) plus 10+ structural selectors in `styles/visual-heavy/style.css`. It is RETAINED in the shared pool. See ADR-0045 (corrigendum) and the revised design doc. The transcript body below is preserved as a historical record.
**Source document under review**: `memory/meeting-2026-06-21-html-themes-per-theme-style-design.md`

---

## Pre-Meeting Evidence (gathered by PM)

PM verified the actual codebase state in `templates/co-deck/` before the meeting and found a severe divergence between the design doc's "Status: Approved — implementation in progress" and reality:

1. **Old `styles/` root still exists** (`templates/co-deck/docs/html-themes/styles/`) with `academic/`, `classic/`, `minimal/`, `visual-heavy/` (each with `style.css` + `pdf_color_spec.json`) plus a flat `base.css`. The design doc (line 67) declares this directory "fully deleted" — it is not.
2. **New structure is incomplete**: `themes/scroll/styles/` contains only `base.css` (no `classic/`, `minimal/`, `academic/` subdirs). `themes/slideshow/` has **no `styles/` directory at all**.
3. **`gen-slides-pdf.ts:728`** still resolves the OLD path: `docs/html-themes/styles/${style}/pdf_color_spec.json` (doc line 83 required changing it).
4. **`themes/scroll/theme.json:37`** still has `"css_base": "docs/html-themes/styles/base.css"` (doc line 85 required updating).
5. **`validate-theme-styles.ts`** (full read) validates the OLD flat structure: `stylesDir = docs/html-themes/styles` (line 16) and a single shared `styles/base.css` (line 95). Doc line 84 required "full rewrite for per-theme path logic" — not done. The validator currently PASSES against the old structure, producing **false confidence**.
6. **Git commit `91d7d4a`** message "feat(co-deck): restructure html-themes" misrepresents a half-migration as complete.

---

## Transcript

### Round 1

**architect**: The core problem is structural: the design doc describes only the **target state**, not the **transition sequence**. Line 67 declares the old `styles/` root "fully deleted," yet old and new coexist on disk (old `styles/` intact with all 4 styles including `visual-heavy`; new `themes/scroll/styles/` has only `base.css`; `themes/slideshow/` has no `styles/` dir). More importantly, there is **no ADR** for this decision — per-theme vs per-style ownership separation is a significant architectural decision requiring an ADR. The "Clarification History" (lines 96–98) shows the design was reversed once; that rationale belongs in an ADR. Question to automation-engineer: at the line level, do the code paths currently point at the new or the old structure? That is the starting point for sequencing the migration.

**automation-engineer**: The code has **not changed at all** — three locations all still use the old paths:
1. `gen-slides-pdf.ts:728` — `resolve(workspaceRoot, \`docs/html-themes/styles/${style}/pdf_color_spec.json\`)`. Doc line 83 required `themes/${theme}/styles/${style}/...`; code is unchanged.
2. `themes/scroll/theme.json:37` — `"css_base": "docs/html-themes/styles/base.css"`. Doc line 85 required the new path; unchanged.
3. `validate-theme-styles.ts` in full — **this is the most dangerous item**. The script validates `stylesDir = docs/html-themes/styles` (line 16) and a single shared `styles/base.css` (line 95). It validates the OLD structure, so it PASSES today while the migration is broken — false confidence. Doc line 84 required a full rewrite; it did not happen.
   Additionally, commit `91d7d4a` ("restructure html-themes") records a half-migration as complete, so the git history itself is misleading. Question to docs-writer: the design doc's Status reads "Approved — implementation in progress," yet no code line has changed. Is that Status value itself harmful, and how should the document correct it?

**docs-writer**: automation-engineer is exactly right — **the Status field is the largest current harm**. "Implementation in progress" reads as "someone is working on this, don't touch it," but nothing has actually started and a commit even makes it look done. A future implementer (or agent) reading only this doc would be misled. Status must reflect reality (e.g., "Blocked — half-migrated, see action items"). Beyond that, the design doc has **three narrative gaps**:
1. **No Migration Steps section** — there is a target-structure diagram (lines 33–65) but no description of how to move old→new (move vs copy, sequencing, per-step verification). This is the same transition-sequence gap architect identified and the root cause of the half-migration.
2. **No Acceptance Criteria** — "when is the migration considered complete" is undefined, which is exactly how the false PASS automation-engineer flagged could slip through.
3. **visual-heavy contradiction** — line 27 declares it "excluded — incompatible with both themes," but `styles/visual-heavy/` still exists on disk, and `themes/scroll/theme.json:18–22` lists it under `incompatible_styles` with a reason. The policy — delete vs keep-but-denylist — is unspecified.
   Question to architect: is visual-heavy physically deleted or preserved-but-denied? And with both `themes/scroll/styles/base.css` and the old `styles/base.css` present, which is canonical, and is the duplication intended?

### Round 2

**architect**: I agree with all three of docs-writer's gaps and will converge the discussion with direct answers.
- **visual-heavy policy**: physically delete. If it is incompatible with both themes it has no reason to exist, and its presence invites someone to reconnect it. Deletion happens in step A-03, but the **ADR must record why** so re-introduction has no justification.
- **base.css duplication**: not intended. The old flat `styles/base.css` is migration residue; the canonical is `themes/<name>/styles/base.css` (per-theme). The old one is deleted in A-03. This raises a **larger structural question**: if each theme owns its own `styles/<style>/pdf_color_spec.json`, then `scroll/classic` and `slideshow/classic` would duplicate the color spec. If identical, it is pure duplication; if different, that is intended but the doc never states the policy. I will decide this in the ADR (A-04). Provisional: duplication permitted at template-early-stage, stated explicitly in the ADR.
- **Proposed migration sequence** (the missing core supplement):
  1. Rewrite the validator for per-theme paths **first** (A-01) — establish the gate that validates the new structure.
  2. Migrate per-style subdirs + build out slideshow (A-02).
  3. Atomically flip code paths + `css_base` (inside A-02) — from here the system runs on the new structure.
  4. Delete old `styles/` + visual-heavy; update `variant.json`/`preview` (A-03).
  5. ADR + doc correction (A-04, A-05).
  Order matters: if we delete the old `styles/` while the validator still checks the old structure, we lose all signal. We must flip the validator to the new structure first and keep the old structure alive until that new validator PASSES — weaponizing the "false PASS" risk in reverse.

**automation-engineer**: I agree with the sequence and add two implementation points.
1. **How to make the atomic flip in A-02 safe**: `gen-slides-pdf.ts:728` and `theme.json`'s `css_base` must change in the same commit. If only one changes, the script reads the new path but `themes/scroll/styles/classic/` does not yet exist, so the `existsSync(...) ? ... : {}` fallback on line 730 silently injects an empty spec — a **silent failure** (wrong result: empty layout) rather than a loud error. That is why architect's "subdirs first, code flip after" order is technically mandatory. I also propose replacing the empty fallback with an explicit throw as part of A-01.
2. **Cross-platform check**: all paths are forward-slash strings (`docs/html-themes/...`), so Windows/Unix safe. But the validator's `workspaceRoot` resolution (`resolve(dirname(import.meta.path), '../..')`, line 14) depends on script location; the per-theme rewrite must not break that relative resolution. Handled inside A-01.
   Question to docs-writer: doc line 86 says to remove `base_css`/`styles_dir` from `variant.json`'s `theme_manifest`, but does not name who consumes those fields. If code reads them, that code must change simultaneously — the doc must add a consumer-impact note.

**docs-writer**: automation-engineer's silent-failure point is decisive — the `gen-slides-pdf.ts:730` `existsSync ? ... : {}` pattern is a hole that quietly injects empty specs during migration, and the doc does not address it at all. Add "explicit error on missing spec" to Acceptance Criteria. On the `variant.json` consumer point, automation-engineer is correct — I wrote "remove fields" without tracing readers; A-05 will add a consumer-trace item. My final doc-correction deliverable (A-05): (1) Status → reflect reality + ADR link; (2) new Migration Steps section using architect's 5-step order; (3) new Acceptance Criteria — per-theme validator PASS, silent fallback removed, validator still PASS after old `styles/` removal, validator rejects visual-heavy re-introduction; (4) full sync of `THEMES.md` + `co-deck.context.md` Layer 2 table / File Organization Policy to new paths; (5) defer visual-heavy + duplication policy to the ADR, link only in the doc.

---

## Synthesis (auditor)

**Root cause**: A design doc that has only a target state (no transition, validation, or record) combined with a misleading commit message hid a half-migration.

**Points of Agreement**:
- No code line has changed (`gen-slides-pdf.ts:728`, `theme.json:37`, full `validate-theme-styles.ts` all old-path/old-structure).
- `validate-theme-styles.ts` currently validates the OLD structure → false PASS → most urgent harm.
- `gen-slides-pdf.ts:730` `existsSync ? ... : {}` silent fallback is an empty-spec injection hole during migration.
- Status field's "implementation in progress" misrepresents reality.
- No ADR exists for the design decisions (per-theme ownership, visual-heavy removal, duplicate color-spec policy).
- Migration order = validator-first (A-01) → build+flip (A-02) → cleanup (A-03); order is technically mandatory.

**Open Questions / Unresolved**:
1. scroll/slideshow `pdf_color_spec.json` **duplication policy** — provisional agreement "duplication permitted," but ADR (A-04) must finalize.
2. `variant.json` `theme_manifest.base_css`/`styles_dir` **consumer trace** — affected code not yet identified before removal.

**Platform Parity Check (MANDATORY)**: No action item affects `CLAUDE.md`, `GEMINI.md`, `agents/*.md`, `.claude/`, or `.gemini/`. A-01–A-03 and A-05 are `templates/co-deck/` internal assets (scripts, theme.json, docs); although co-deck supplies both Claude and Gemini, these are content/structure changes — not platform-config — so **no separate parity counterpart is triggered** (Platform = Both, justified). A-04 (ADR) is written at workspace root → Platform = L0-only. No governance violation.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Rewrite `validate-theme-styles.ts` for per-theme path logic (`themes/<name>/styles/<style>/`) + establish new-structure validation gate; throw on missing spec (remove silent fallback) | Both (co-deck) | 1st — prerequisite gate for everything |
| A-02 | automation-engineer | Low | Migrate per-style subdirs into `themes/{scroll,slideshow}/styles/` + create slideshow `base.css`; then atomically flip `gen-slides-pdf.ts:728` and both `theme.json` `css_base` | Both (co-deck) | 2nd — after A-01 PASS; slideshow part depends on A-04 |
| A-03 | automation-engineer | Low | Physically delete old `html-themes/styles/` root + visual-heavy; remove `variant.json` `theme_manifest` `base_css`/`styles_dir` (after consumer trace); update `preview.html` THEME_STYLES dropdown | Both (co-deck) | 3rd — after A-02 verified |

> **⚠️ SUPERSEDED (2026-06-21)**: The "delete visual-heavy" portion of A-03 is WITHDRAWN. visual-heavy is retained in the shared pool (scroll-partial / slideshow-incompatible), not deleted. Only the old `html-themes/styles/` root cleanup + `variant.json`/`preview` updates remain in A-03. See ADR-0045 corrigendum and the revised design doc Revision History entry #4.
| A-04 | architect | High | Author ADR (`docs/adr/NNNN-html-themes-per-theme-style.md`): per-theme ownership rationale, scroll/slideshow color-spec duplication policy, visual-heavy removal reason | L0-only | blocks slideshow part of A-02 — run in parallel with A-01 |
| A-05 | docs-writer | Medium | Correct design doc — reality-fix Status, add Migration Steps + Acceptance Criteria sections, add variant.json consumer-impact note; sync `THEMES.md` + `co-deck.context.md` Layer 2 table to new paths | Both (co-deck docs) | after A-02 |

**Dependency**: A-04 (duplication policy) blocks the slideshow portion of A-02. Recommended start: A-01 and A-04 in parallel → A-01 PASS → A-02 (scroll first; slideshow after A-04 finalized) → A-03 → A-05.

## Acceptance Criteria (for the migration as a whole)

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | per-theme validator passes against the new structure | `bun scripts/co-deck/validate-theme-styles.ts` exits 0 with new paths |
| AC-2 | missing spec raises an explicit error, not silent `{}` fallback | `gen-slides-pdf.ts` throws when a resolved spec path is absent |
| AC-3 | old `styles/` root fully removed; validator still PASS | directory gone; validator exit 0 |
| AC-4 | visual-heavy re-introduction is rejected by the validator | adding `visual-heavy` to a theme's `compatible_styles` fails validation |

> **⚠️ SUPERSEDED (2026-06-21)**: AC-4 is WITHDRAWN. visual-heavy is retained (scroll-partial / slideshow-incompatible), so the validator must NOT reject it. The replacement criterion is: validator must classify visual-heavy as scroll-partial / slideshow-incompatible per the compatibility matrix, not reject its existence.
| AC-5 | commit message accurately describes state (no false "restructure complete") | commit body references the ADR and the actual scope |
