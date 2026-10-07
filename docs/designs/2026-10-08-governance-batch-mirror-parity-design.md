# 2026-10-08 Governance Batch — mirror-parity hardening, suffix-locale declarations, prune truths, scaffold hygiene — Design

- **Date**: 2026-10-08
- **Status**: implemented
- **Spec id**: `2026-10-08-governance-batch-mirror-parity-design`
- **Tickets**: T-20261007-015 (urgent), T-20261007-003, T-20261007-001, T-20261006-004, T-20261006-003, T-20261006-009, T-20261006-007, T-20261007-024, T-20261006-002, T-20261006-010; T-20261007-005 verified already-resolved
- **Owner**: automation-engineer scope, implemented by the 03:00 governance-ticket runner
- **Related**: `scripts/validate-templates.ts`, `scripts/verify-skills.ts`, `scripts/audit.ts`, `scripts/validate-md-language.ts` (+L1), `scripts/upgrade-project.ts`, `scripts/new-project.ts`, `templates/common/scripts/SCRIPTS.md`, `skills/promote-variant/SKILL.md`, `docs/designs/2026-09-25-daily-fleet-review-resync-design.md` (R44)

## R1 — Problem

Eleven mechanical tickets from the 2026-10-07/08 review waves:

1. **T-20261007-015 (urgent)**: co-deck's `.hermes` html-build mirror was stale
   (1.5.0 vs 1.6.0) and no validator covered the class — the variant-mirror-parity
   check's inVariant arm hit `continue` without any version comparison, and
   VA07_MIRROR_DIRS omitted `.hermes`. Sub-item (a) (the byte-copy) was already
   fixed live by the co-deck session ("live instance correct" per the ticket);
   verified identical at 1.6.0 before this batch touched validators only.
2. **T-20261007-003**: verify-skills `--check`'s clean path was unreachable —
   the generated content embeds a `Generated: <now>` stamp, so a raw
   byte-compare drift-failed every file forever and the gate rewrote the stamp
   on every run.
3. **T-20261007-001**: audit.ts's designLint.enabled branch was the last
   Pass-shaped silent skip.
4. **T-20261006-004 + T-20261006-003**: `_ko`-suffixed files were silently
   excluded as locale files, so Korean content needed no declaration and drift
   was undetectable; co-learning's three `_ko` docs lacked the sanctioned
   declaration pattern.
5. **T-20261006-009**: upgrade-project's PRUNE REMOVED agents/ category omitted
   the workspace-root agents/ SSOT — root-delivered agents got a factually
   wrong "project-owned" KEEP basis.
6. **T-20261006-007**: templates/common/scripts/SCRIPTS.md still carried the
   stale duplicated tail the root shed on 10-05 (d36e679f) — contradictory
   version rows inherited by scaffolds.
7. **T-20261007-024**: undescribed scaffolds ship TODO(project-overview)
   placeholders silently (co-hr/co-news class); co-news's context.md carried a
   stale "Auto-generated scaffold stub" banner over real content.
8. **T-20261006-002**: the 01:30 runner spec (R44) named audit.ts +
   verify-scripts.ts "inside each variant" — L2 template dirs carry no
   scripts/ tree; the real battery is validate-variant-claims +
   validate-variant-readiness from the root.
9. **T-20261006-010**: the VARIANT-SCOPE SKILL PRUNE's registry-curated
   deletions and their ordering before the L3-preservation walk were
   undocumented.
10. **T-20261007-005**: the co-export anchor link was reported broken — verified
    RESOLVED on current main (validate-docs-links --all exits 0 across the
    tree; the heading and slug match). No change needed.

## R2 — Decision

1. **validate-templates 1.52.0**: (i) variant-mirror-parity gains the inVariant
   stale-copy arm — a variant-owned mirror SKILL.md semver-older than its
   skills/ SSOT FAILs with a byte-copy remediation (semverOlder already in
   scope; unparseable versions stay VA-07's domain); (ii) VA07_MIRROR_DIRS
   gains `.hermes` (per-variant existence-guarded by the existing loop); (iii)
   the platform-mirror-freshness pass message says five. Verified: the extended
   battery passes on the current tree (the live co-deck fix means zero
   findings).
2. **verify-skills 1.5.2**: the `Generated:` stamp line is normalized out of
   BOTH sides of the `--check` comparison; an exact-stub file whose body
   matches the current generation exits 0 WITHOUT rewriting (a stamp-only
   rewrite would churn forever — that was the unreachable clean path); a stale
   body still regenerates; curated drift still exits 1. Clean-path subprocess
   test added. CHANGELOG "read-only" wording corrected.
3. **audit.ts 2.51.1**: the designLint.enabled branch joins the Skip verdict —
   all three design-lint self-skip branches read `[SKIP]`.
4. **validate-md-language 1.15.0**: suffix-style locale files inside the
   official perimeter must declare `lang: <locale>` (any legal value) — the
   gate sits after the official-document filter (runtime/service data stays
   out of scope) and before isExcludedPath (whose suffix arm would swallow
   them); the base locale (`en`) is never a translation marker. Remediation in
   the same pass: 51 template docs stamped `lang: ko` + `lang_reason:
   source-material` (the README_ko precedent); co-learning's three `_ko` docs
   carry the full `sync_version`/`translated_from_hash` pattern with real
   git-hash values (T-20261006-003).
5. **upgrade-project 1.67.0**: the PRUNE REMOVED agents/ category consults the
   workspace-root agents/ SSOT (mirroring skills/ v1.35.0); the
   registry-curated deletion exemption is documented in the v1.64.0 header
   block (the owner-curated registry IS the ADR-0080 record) and the pass
   ordering is pinned by `tests/unit/upgrade-prune-order.test.ts` (source-order
   assertion — the passes are source-ordered by design).
6. **new-project 1.34.0**: WARN + post-scaffold checklist item when
   `--description`/`--type` are omitted. `templates/co-news/docs/co-news.context.md`
   loses the stale stub banner.
7. **promote-variant SKILL.md + R44**: Step 6.5 rewritten to the five-mirror
   `PLATFORM_MIRROR_DIRS` SSOT (loop-diff + sync-skills healing + VA-07 note);
   the checklist's 2-mirror rows replaced with one 5-mirror row; R44 amended to
   the real per-variant battery (validate-variant-claims --template +
   validate-variant-readiness --variant, root-invoked) with the Module-not-found
   history. The user-side 01:30 scheduler prompt needs the same text (repo has
   no canonical copy — flagged in the run report).
8. **L1 SCRIPTS.md tail dedup (T-20261006-007)**: truncated the duplicated
   stale body (963 → 545 lines) and synced the footer to the root's; the
   mirror span re-verified (140 rows).

## R3 — Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| 015: also content-compare mirror copies (not just version) | The ticket asks version-compare (semverOlder exists for exactly this); content drift between equal versions is a different (and noisier) class. |
| 015: make the inVariant stale-copy arm a WARN | The class silently survived every gate for a week; VA-07's identical finding is already fail-promoted (T-20260925-006). |
| 003: drop the timestamp from the generated index | Changes the written format for every consumer; normalization achieves stable comparison with zero format change. |
| 004: gate ALL suffix files regardless of perimeter | Pulled in 216 findings including gitignored runtime state under services/co-workspace/data — outside the validator's official-document design; the official filter is the scope. |
| 004: mass-stamp with `lang_reason: translation` | Not in ALLOWED_LANG_REASONS; the README_ko precedent uses `source-material`. |
| 010: extract the passes into testable functions | A 3,300-line orchestration script refactor is not mechanical-batch scope; the source-order pin documents the invariant cheaply and fails loudly if violated. |
| 005: "fix" the anchor | Verified already resolved on main (validator exit 0, slug matches the heading) — the ticket's premise predates a template wave; recording the verification is the whole remaining work. |

## R4 — Verification

- validate-templates: 0 errors across 8 stable variants with the new
  inVariant arm + .hermes VA-07 live.
- verify-skills curated-index suite: 6/6 incl. the new clean-path subprocess
  test (stamp preserved, no rewrite, exit 0).
- validate-md-language: 0 violations over 2130 official files with the
  declaration gate live (51 stamps + 3 co-learning patterns landed).
- upgrade-prune-order: 2/2 (ordering pin + header documentation).
- Full gates at landing: audit.ts, validate-templates.ts, verify-scripts.ts
  --verify, bun test.
