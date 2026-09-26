# Design: Docs Current-State Sync — README/Guides Audit Fixes (T-20260927-011)

- **Date**: 2026-09-27
- **Status**: Implemented
- **Scope**: L0 docs only (README family, docs/getting-started.md, docs/index.md, CONSTITUTION.md §11 prose, CHANGELOG). No scripts, no templates, no lifecycle changes.

## Context

A docs-vs-repository audit on 2026-09-27 found the top-level onboarding documents lagging the actual workspace state. Findings, dispositioned:

1. **P1 — `/new-project` slash command does not exist.** All four READMEs direct users to it. No command file exists on any surface (`.claude/.gemini/.agents/.codex` each carry the same 7 commands: changelog, commit-push-pr, gateguard, memlog, new-task, project-review, sync — matching VERSION_MANIFEST "Commands: 7").
2. **P1 — README_es.md / README_ja.md stale (last synced 2026-09-12).** They predate the Codex platform rows (ADR-0077), the Hermes Agent additions (ADR-0088), the ADR-0090 thin-dispatcher phrasing, and the `--version 0.6.0` examples.
3. **P2 — KR country-profile variant set drifted.** Six variants now declare `country_config.supported: ["KR"]` + `docs/countries/KR.md` (co-consult and co-export since 2026-09-04; co-price since the 2026-09-26 ADR-0091 template-layer alignment). The three README annotation spots (repository structure tree, Multi-Agent Workflow list, Template Variants table) still name only {co-news, co-hr, co-safety}.
4. **P2 — README "CONSTITUTION.md §7" platform pointer wrong.** CONSTITUTION §7 is "New Project Initialization"; the "7 surfaces on 5 platform directories" statement lives in §11 (Governance Enforcement Layers, Manual Annotations).
5. **P2 — docs/getting-started.md defects.** `check-env-full.sh` reference points to a non-existent file; "Or use the automated install script" leftovers duplicate the same install commands and contradict the removed `install-bun.sh`/`install-bun.ps1`; footer `Last Updated: 2026-09-27`; session-start examples name only Claude/Gemini.
6. **P2 — docs/index.md stale.** "ADRs 0001 through 0079" (actual: 0091); the Constitution Sections list omits `06.7-procedure-lifecycle.md`.
7. **P3 — CONSTITUTION.md §11 tense.** The Codex and Hermes platform-extension sentences describe landing work as future ("land through the implementation waves") although both have landed (`.codex/`, `CODEX.md`, `.hermes/` are in the tree and README lists both platforms as supported).

## Decisions

- D1: Remove the `/new-project` shortcut line from all four READMEs (retire the claim; do not substitute a different command, because none replaces it).
- D2: Update the KR variant set in the three annotation spots in all four READMEs, and add one explicit declarant-list sentence to the Built-in Country Profiles section so future drift is checkable against `variant.json`.
- D3: Fix the platform pointer to §11 in README.md and README_ko.md.
- D4: Repair getting-started.md defects in place (remove dangling reference and duplicates, refresh footer, name all supported platforms in the session-start hint).
- D5: Fix docs/index.md ADR range and add the 06.7 section entry.
- D6: Rewrite the two CONSTITUTION §11 sentences to landed state ("was designed and Accepted … have landed"), preserving the ADR/design references.
- D7: Refresh README_es.md / README_ja.md to the 2026-09-27 README.md revision (translate the delta; add `translated_from_hash` + `sync_version: 3` frontmatter to match the README_ko.md sync mechanism).
- D8: Recompute README.md `content_hash` and repoint README_ko/es/ja `translated_from_hash` after the body edits (verify-readme-sync contract).

## Non-goals

- No changes to scaffold/upgrade behavior, `country_config` schema, or ADR-0091 project-layer enforcement (upgrade delivery for `region-profiles/**` remains T-20260927-010).
- No new content sections in the READMEs beyond the declarant-list sentence.

## Verification

- `bun scripts/audit.ts` exits 0 (sync step 4.9 gate).
- `bun scripts/verify-readme-sync.ts --pre-commit` passes for the root pair.
- `grep -c "new-project \"" README*.md` returns 0.
- `grep -c "KR country profile included" README.md` reflects the six-variant set (tree/table/workflow rows + list sentence).
- No English prose introduced into README_ko/es/ja beyond filenames, paths, and code.
