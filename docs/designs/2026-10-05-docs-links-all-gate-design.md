# Design: Gate validate-docs-links.ts --all (Deep Docs Link Enforcement)

- **Spec id**: `2026-10-05-docs-links-all-gate-design`
- **Date**: 2026-10-05
- **Status**: Implemented
- **Ticket**: T-20261004-024
- **Related**: `scripts/validate-docs-links.ts` 1.4.0, `scripts/audit.ts` 2.48.2, `.github/workflows/test.yml`, T-20260912-018 (CI link gate)

## Problem

`bun scripts/validate-docs-links.ts --all` scanned 535 markdown files and found
59 broken relative links (the ticket said 62; three had been fixed since
filing). The rot was concentrated in historical content: `docs/designs/
agents-md-final-structure.md` (27 links), `docs/adr/0039` (5),
`docs/designs/l2-to-variant-conversion-pipeline.md` (4), and single links in
eleven more files. Because of that rot, `--all` was never gated — the default
scan (docs/ root + templates/common/docs) ran in dev-sync and CI, while every
docs/ subdirectory was unchecked.

## Root-cause classes

1. **One-level-too-deep relative hrefs** — links from `docs/adr/**` and
   `docs/designs/**` written with `../../` where the target sits one level up
   (`../constitution/…`, `../governance/…`).
2. **Repo-root-relative authoring style** — hrefs like `agents/pm.md`,
   `docs/VERSION_MANIFEST.md`, `/CONSTITUTION.md` (leading slash) that resolve
   only from the workspace root; the validator resolves relative to the file.
3. **Moved targets** — `memory/*.md` daily logs and meeting transcripts later
   moved to `memory/archive/` (or purged); `scripts/merge-frontmatter.ts` →
   `scripts/helpers/`; `templates/VERSION_REGISTRY.json` → `docs/templates/`;
   `docs/platform-parity-rules.md` → `docs/governance/`.
4. **Renumbered/renamed ADRs** — the L0/L1/L2 hierarchy ADR moved
   0033→0039; ADR-0048's slug was cross-linked with 0047's; ADR-0033's title
   changed.
5. **Gone targets with no successor** — purged memory logs (2026-07-10,
   2026-09-09, three meeting notes) and archived-out ticket YAMLs
   (T-20260912-028/029 — the store is gitignored, so a link can never resolve
   for other clones).

## Decisions

1. **Repair, don't allowlist.** Every one of the 59 links was fixed to a real
   existing target, so `--all` exits 0 with NO ignore mechanism and NO frozen
   non-zero baseline. The ticket's "frozen baseline count that must not grow"
   degenerates to the strongest form: the gate itself (0 tolerated). A baseline
   counter would have required new validator surface and grandfathered rot.
2. **Meaning-preserving link repair only.** Historical documents keep their
   claims; only hrefs (and, where the referenced ADR was renumbered, the ADR
   number in the visible text) were corrected. Dead targets with no successor
   (purged memory logs, archived tickets) were demoted from links to inline
   code text with a "(since purged/archived)" note — the reference survives,
   the dead href does not.
3. **Enforcement wired at both existing enforcement points** rather than a new
   path-filtered trigger:
   - `scripts/audit.ts` 2.48.2: the docs relative-link gate now runs the
     validator in BOTH scopes (default + `--all`), workspace-root only,
     existsSync-guarded. This covers every /sync, every pre-commit battery,
     CI's Workspace-audit step, and the nightly tickets run.
   - `.github/workflows/test.yml` "Validate docs links" step: appends
     `bun scripts/validate-docs-links.ts --all` (Ubuntu-only matrix leg,
     unchanged). Every commit is covered — a superset of the ticket's
     "commits touching docs/** renames".
4. **No validator code change.** `validate-docs-links.ts` stays at 1.4.0; the
   gate flip is wiring, not scanner logic.

## Test plan

- `bun scripts/validate-docs-links.ts --all` → exit 0 (was 59 broken in 535
  files). Default scope unchanged → exit 0.
- `bun scripts/audit.ts --spec-check --lifecycle-only` → the new "Docs link
  gate: deep scan (--all)" check PASSes.
- `bun test tests/unit/ci-workflow-merge.test.ts tests/unit/ci-template-bun-pin.test.ts`
  (CI workflow shape pins) → 29 tests pass.
- Full unit suite green.

## Non-goals

- No backtick-link-text blind-spot fix in the validator (links whose visible
  TEXT is inside inline code are skipped by the scanner — found while repairing
  `agents-md-final-structure.md`; repaired anyway since the surrounding prose
  was fixed, but the scanner blind spot itself needs its own ticket).
- No linkcheck for http(s) URLs (out of the validator's contract by design).
