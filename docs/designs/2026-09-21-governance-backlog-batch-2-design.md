# Governance Backlog Batch — Design

- **Spec ID**: 2026-09-21-governance-backlog-batch-2-design
- **Date**: 2026-09-21
- **Source**: tickets T-20260921-007..019 (2026-09-21 project review + PM tier drift follow-ups)
- **Status**: implemented
- **Companion ADR**: docs/adr/0085-delivery-semantics-locale-platform-drift.md (decisions for T-008/-015/-017)

## 1. Scope

Implement the entire open governance backlog (13 tickets) from the 2026-09-21
project review. Design-gated decisions (locale axis, platform profiles,
equal-version drift) are resolved in ADR-0085 rather than deferred.

## 2. Changes by ticket

- **T-007** `upgrade-project.ts`: `contractCommonSkills` loader
  (`docs/templates/common-contract.json` `common_skills` keys); contract skills
  bypass the frozen variant.json allowlist at both add-if-missing gate points
  with an explicit hint line; new CONTRACT PARITY report (missing/undeclared
  counts + per-skill lines; dry-run notes pre-upgrade state).
- **T-009** `generate-variant.ts` 1.16.0 materializes `.agents/.codex` skill
  mirrors + backfill; `l3-to-variant-pipeline.ts` 1.20.0 country-scope matcher
  covers `.codex/skills/`; `scan-l3-project.ts` 1.4.0 scans `.agents/.codex`
  skills/configs and AGENTS.md/CODEX.md/README_ko.md/SECURITY.md root files;
  `validate-templates.ts` gains `checkVariantMirrorParity` (warn: mirror entries
  that are flagged `mirror:false`/`security-gate:true` in their owning tree, or
  one-sided; mirrorable variant skills missing from a mirror). Healed the fleet:
  104 stale flagged mirror entries removed (co-safety `.claude/.gemini` 60→8);
  `sync-skills.ts --all-variants` distributed common skills into variant mirrors.
  `check-upgrade-coverage.ts` matches the placeholder allowlist against
  mirror-stripped relpaths (explain-me runtime templates).
- **T-010** `upgrade-project.ts` 1.40.0 CORE-SCRIPT FORK arm (version-forked
  `dev-sync.ts`/`audit.ts` restored to canonical); `reconcile-with-l0-l1.ts`
  1.2.0 provenance-aware via `scripts-snapshot.json` (scaffold-version match ⇒
  warn + upgrade instruction instead of hard Integrity Violation).
- **T-013** `propagate-to-templates.ts` `applyDiffs`: per-file failure isolation,
  FAILED lines, applied/failed summary, exit code 1.
- **T-014** `new-project.ts`: `{{COUNTRY}}` display resolution honors
  `country_config.profiles_dir`; loud warn when the profiles directory is missing.
- **T-016** `upgrade-project.ts`: post-upgrade sync-skills timeout 30s→120s;
  SIGTERM timeout reported as explicit partial-sync warning.
- **T-018** `.github/workflows/nightly-scaffold-e2e.yml`: nightly
  `test-new-project.ts --all-variants` + post-run validate-templates.
- **T-011/T-012** Language-policy text (COMMON-AGENTS block: 16-code list with
  `en` as source language; suffix-zone bullet) aligned with the schema
  (`i18n.translation_zone_patterns` three forms) and the COMMON-CLAUDE/GEMINI
  wording; propagated L0→L1→L2.
- **T-008/-015/-017** ADR-0085 decisions; DRIFT outputs carry policy verbs.
- **T-019** drift data remediated earlier this session (38 PM rows); standing
  validator re-filed as T-20260921-020.

## 3. Acceptance criteria

1. `review-baseline.ts` 6/6 green; `check-upgrade-coverage.ts --strict` clean.
2. `test-runner.ts scripts` suite passes (incl. promotion E2E with the widened
   scan categories).
3. ADR-0085 passes `verify-adr-governance.ts --strict` (CONSTITUTION.md §5.5
   File Upgrade Classification + docs/constitution/07-new-project.md references).
4. Tickets T-20260921-007..019 in `done` with result summaries.

## 4. Accessibility & Preview Verification

Backend/scripts and CLI-workflow documentation only — no user-facing web/app UI.
Accessibility (ADR-0065) and Preview Verification (ADR-0070) are **exempt**.

## 5. Risks

- Widening `SCAN_CATEGORIES` changes promotion classification for `.agents`/
  `.codex` surfaces — accepted per ADR-0085 D2 (mirrors are shared surface) and
  covered by the promotion E2E.
- Removing 104 mirror entries is irreversible via sync (sync never prunes);
  entries remain recoverable from git history and the owning variant skills/ tree.
