# Canonical Architecture-Map Refresh — Design

- **Spec id**: `2026-11-21-canonical-archmap-refresh-design` (derived from the file stem by `scripts/spec-register.ts`, matching the registry convention of e.g. `2026-10-02-workspace-architecture-diagram-design`)
- **Date**: 2026-11-21
- **Status**: implemented — ratified at Design Gate approval (DEC-20261121-01); registered `--status implemented` immediately before `/sync` (ADR-0074)
- **Scope**: L0 workspace root only. The canonical assets and the drift checker live only at the root; nothing propagates to templates or variants.
- **Related**: DEC-20261121-01 (gate-moment ruling); handbook PRs 5throck/intro-to-ai-harness #87 (head `24f833f`, merge `80d2c18`) and 5throck/multi-agent-harness-handbook #184 (head `9399e44`, merge `a4b7de6`), branch `edu-sync/2026-11-21b` in both repos; specs `2026-11-07-handbook-archmap-drift-check-design`, `2026-11-07-education-archmap-remediation-plan`, `2026-11-07-fleet-membership-ssot-design`; DEC-20261107-01 (fleet depiction); ADR-0105 (unified 03:00 batch runner)

## 1. Problem

The workspace architecture map has one canonical source:
`docs/architecture/workspace-architecture{,.en,.es,.ja}.svg` (last changed
2026-11-07, commit `84d080504`). Two gitignored handbook clones under
`Handbooks/` embed copies of it, and `scripts/check-handbook-archmap-drift.ts`
(spec `2026-11-07-handbook-archmap-drift-check-design`) compares the copies
against the canonical files.

On 2026-11-21 both handbooks landed an edu-sync (branch
`edu-sync/2026-11-21b`, PRs #87 and #184) that corrected the map content in
the handbooks. The canonical assets did not follow. The drift direction is
therefore **reversed**: the copies are ahead of the canonical source. The
checker run of 2026-11-21 reports `0 pass, 16 drift, 0 skip` (exit 1), so the
daily review battery (battery #10 in `scripts/review-baseline.ts`) fails every
run.

Two defects are live in the canonical assets:

1. **Stale claims.** The canonical map still says what the handbooks fixed:
   - Batch cadence `05:30` (2 occurrences) instead of the unified `03:00 KST`
     cadence mandated by ADR-0105 (accepted 2026-11-12).
   - Tenant-loop wording: tenants depicted outside the backport/upgrade/upstream
     loops with the upgrade path unconfirmed (ko: `...루프 밖 — 업그레이드...`),
     while the handbooks now depict enrollment-based participation
     (ko: `...등록제(admin 승인·enrollment)...`).
   - Roster: no `co-utility` chip (the handbooks show the co-utility beta chip);
     dead project chips still present; the handbooks depict the 10-member fleet
     derived from `docs/fleet-membership.json` (11 `Projects/co-*` directories
     minus the excluded `co-abap-plugin`, per DEC-20261107-01's mechanical rule).
   - Additions note frozen at `2026-11-07 · templates/VERSION 0.28.0`; the
     handbooks carry the dated `2026-11-21 · templates/VERSION 0.30.0` note.
2. **`.ja` font-family baseline drift.** The canonical `.ja` root `<svg>` tag
   carries the Korean stack (`'Apple SD Gothic Neo','Malgun Gothic','Noto
   Sans KR',Helvetica,Arial,sans-serif`) instead of the Meiryo ja stack that
   the handbook feat(ja) standard requires (handbook CHANGELOG: "Japanese
   pages and the Japanese architecture SVG now default to Meiryo
   (`:root:lang(ja)` font stack)"). The two `.ja` **asset** checks were already
   DRIFT before this edu-sync; the inline form never compares root tags, so
   only the asset form sees it.

There is no SVG generator script — the canonical assets are maintained by
direct edit/copy (a repo-wide grep finds the filenames referenced only by the
checker, `scripts/review-baseline.ts`, `scripts/SCRIPTS.md`, records, and the
checker's unit test).

## 2. Adoption approach

Adopt the verified post-edit handbook SVGs as the new canonical, one byte-copy
per language:

1. **Identity gate (precondition).** For each locale, verify the two handbook
   copies are byte-identical to each other (md5). Verified 2026-11-21 — all
   four locales match across the two repos (table in §8). If a future re-run
   diverges, stop and reconcile the handbooks first; never pick a side.
2. **Byte-copy.** Copy, per locale, `Handbooks/intro-to-ai-harness/docs/assets/img/workspace-architecture{,.en,.es,.ja}.svg`
   over `docs/architecture/workspace-architecture{,.en,.es,.ja}.svg`,
   preserving filenames and exact bytes (binary copy; no editor re-save, no
   line-ending conversion, no BOM). Byte equality is not cosmetic: the
   checker's asset form compares sha256 of the whole file with no
   normalization.
3. **Nothing else changes.** The canonical files' only code consumers are the
   drift checker (standalone) and review-baseline battery #10 (§3). No
   workspace-root document restates the map's live claims (§4), so no
   additional edits are needed or allowed.
4. **Predicted outcome.** After the copy, the checker must report
   `16 pass, 0 drift, 0 skip`, exit 0. This was predicted without modifying
   any file: a 2026-11-21 simulation using the checker's own exported
   functions confirmed that all 8 handbook inline bodies equal their own
   handbook asset bodies per locale — so once the assets equal canonical, all
   16 checks pass. The copy simultaneously resolves the 16-check role-reversal
   drift **and** the 2 pre-existing `.ja` font-family baseline drifts (which
   are 2 of the 16).

## 3. Drift-checker contract

Contract of `scripts/check-handbook-archmap-drift.ts` (v1.0.0), as verified by
reading the source and running it:

- **Matrix**: 4 locales (ko = no suffix, en = `.en`/`_en`, es = `.es`/`_es`,
  ja = `.ja`/`_ja`) x 2 handbooks (`intro-to-ai-harness` → appendix page
  `G_Workspace_Architecture`, `multi-agent-harness-handbook` →
  `E_Workspace_Architecture`) x 2 copy forms = 16 checks per run.
- **Asset form** (`docs/assets/img/workspace-architecture*.svg`): whole-file
  sha256 equality with the canonical locale file. No normalization of any kind.
- **Inline form** (`docs/appendix/<page>{,_en,_es,_ja}.html`): only the map
  **body** is compared — the lines strictly between the page's first line that
  opens an `<svg` element with a `viewBox` attribute and the first later line
  whose trimmed text starts with `</svg>`. The page's own root-tag attributes
  (`width`/`role`/`aria-label`/`lang`/`font-family`) are never compared. The
  canonical body is the lines strictly between the canonical root `<svg>` open
  line (an optional leading `<?xml ...?>` line is skipped) and the final
  `</svg>` line.
- **Normalization** (both sides, nothing else): `\r\n` and `\r` become `\n`;
  per-line trailing spaces/tabs are removed; trailing empty lines are removed.
  Leading whitespace, attribute order, and every other byte compare as-is.
- **Exit codes**: `0` = all PASS or SKIP; `1` = one or more DRIFT; `2` = usage
  error or a missing/malformed canonical file (repository fault, not drift).
- **SKIP**: `Handbooks/` (or one handbook dir) absent → SKIP, never a failure —
  the clones are gitignored; GitHub CI and git worktrees do not have them.
- **Consumers**: (a) the standalone CLI; (b) `scripts/review-baseline.ts`
  battery #10 (daily 01:30 runner) — exit 1 fails the row and surfaces in the
  daily report; (c) `tests/unit/check-handbook-archmap-drift.test.ts`, which
  pins the pure functions on temp-dir fixtures and never reads the real
  canonical files. No CI job, no template, and no other script reads
  `docs/architecture/workspace-architecture*` (repo-wide grep, 2026-11-21).
  Adopting new canonical bytes therefore has no hidden consumer.

## 4. Documents that reference the map — records, not live content

A repo-wide grep for `workspace-architecture` (2026-11-21) finds, besides the
code above: the design docs `2026-10-02-workspace-architecture-diagram-design.md`,
`2026-11-07-education-archmap-remediation-plan.md`,
`2026-11-07-handbook-archmap-drift-check-design.md`,
`2026-11-07-fleet-membership-ssot-design.md`; `docs/decisions/DEC-20261107-01.md`;
`docs/specs/registry.json` and `docs/specs/entries/2026-10-02-workspace-architecture-diagram-design.json`;
`CHANGELOG.md`; `memory/meeting-2026-11-08-coworkspace-gap-review.md`;
`tickets/governance/T-20261107-002.yaml`; `scripts/SCRIPTS.md`. All are
records or catalog entries **about** the map file; none restates the map's
live claims. Records are never edited to match new state — none of these
requires updating. The only new documents are this design and DEC-20261121-01.

## 5. Non-goals

- No rework of the SVG tooling: no generator script, no build pipeline for the
  map, no redraw. The assets stay direct-edit/byte-copy.
- No handbook-side changes: PRs #87/#184 already landed; this design touches
  the workspace root only.
- No edits to historical records (designs, DECs, CHANGELOG, memory, tickets)
  that mention the map.
- No CI wiring change: CI has no `Handbooks/` and would always SKIP — the
  2026-11-07 design's decision stands.
- No extension of the checker's scope (captions, lead text, "What's new"
  notes remain out of scope, as before).

## 6. Risks

| Risk | Assessment | Mitigation |
|------|-----------|------------|
| Byte-identity failure at copy time | An editor re-save that alters bytes (CRLF, BOM, reordered attributes) fails the asset sha256 checks silently-as-drift | Binary `cp` only; §8 checklist requires the post-copy canonical md5 to equal the handbook md5 exactly |
| Hidden canonical consumer | Some consumer reads the canonical SVGs that the grep missed | Consumers verified by repo-wide grep to be checker + battery + fixture-only unit test; §8 re-runs the grep at landing time |
| Inline pages diverge from assets | Inline check passes only because body == asset body was verified | Simulation confirmed 8/8; the §8 checker run (16/0) is the binding gate, not the prediction |
| Role reversal recurs | A future handbook-side fix re-creates "copies ahead of canonical" | Direction restored here is canonical→handbooks (SSOT); any future reverse flow must replay to canonical through a design like this one; the checker keeps surfacing it daily |
| Fleet churn | The next membership change re-stales the roster chips | By design there is no auto-refresh; `docs/fleet-membership.json` stays the SSOT the map must be refreshed against (DEC-20261107-01 rule) |

## 7. Rollout

All rows execute through the PM Gateway; the PM never edits files directly.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Design Gate approval of this design (this document + DEC-20261121-01) | pm | — | — | 2026-11-21-canonical-archmap-refresh-design |
| 1 | Register spec BEFORE `/sync` (ADR-0074): `bun scripts/spec-register.ts --file docs/designs/2026-11-21-canonical-archmap-refresh-design.md --source manual --status implemented` | architect | High | fable | same |
| 2 | Branch `pr/20261121-canonical-archmap-refresh` from `main`; run the §8 identity gate; byte-copy the four SVGs; run the checker (must be 16 pass / 0 drift / 0 skip, exit 0); run the §8 checklist | architect | High | fable | same |
| 3 | `/sync` — audit (`--spec-check`), lifecycle, commit, push, PR | automation-engineer | Medium | sonnet | — |
| 4 | Landing verification (read-only): committed file set, PR URL, checker re-run on the branch | pm | Medium | inherit | — |

Merge happens only on the user's explicit request. After merge, `main`'s
checker stays 16/0 and the daily battery #10 goes green.

## 8. Verification checklist

Identity gate — md5 verified 2026-11-21; both handbook copies byte-identical
per locale. The handbook hashes are the **target** hashes for the canonical
files after the copy:

| Locale | Handbook pair md5 (= post-copy canonical md5) | Current canonical md5 (replaced) |
|--------|-----------------------------------------------|----------------------------------|
| ko | `0440c8dfc05a4afaa3eaad555516ab00` | `d00872758c6629b725398f2ede171cc7` |
| en | `53950ee5e68e309907c672525d4f066c` | `88b4b5ce357d978100a75f0e968d1ccd` |
| es | `3468345da8e68483b90e93840db0fd48` | `9c75d22050364385c9c0e4205a63475c` |
| ja | `de1c2529a003f3c51d301a2ca4f1d03f` | `b007b5a9ac8d8e76aa3b86f20149fafe` |

- [ ] Identity gate re-run at landing time: md5 equal per locale across the two handbook repos (values above; any mismatch = stop)
- [ ] Post-copy: `md5sum docs/architecture/workspace-architecture{,.en,.es,.ja}.svg` equals the handbook hashes exactly
- [ ] `bun scripts/check-handbook-archmap-drift.ts` → `16 pass, 0 drift, 0 skip`, exit 0
- [ ] Root font: `docs/architecture/workspace-architecture.ja.svg` root `<svg>` `font-family` contains `Meiryo`
- [ ] Content: canonical ko contains `03:00` (2 occurrences) and no `05:30`; contains `co-utility`; tenant wording shows enrollment participation
- [ ] Consumer grep unchanged: no new `workspace-architecture` reader outside checker/battery/test/records
- [ ] `git status`: only the four SVGs (plus pipeline-owned files from `/sync`) changed
- [ ] DEC-20261121-01 present and linked; spec registered in `docs/specs/registry.json` before `/sync`
