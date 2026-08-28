# Project CLAUDE.md/GEMINI.md Managed-Block Marker Drift Detection

**Status**: implemented
**Date**: 2026-08-28
**Source**: manual (incident follow-up)

## Problem

`upgrade-project.ts` merges template updates into each project's `CLAUDE.md`/`GEMINI.md` by
resyncing content wrapped in `<!-- COMMON-CLAUDE:START/END -->` / `<!-- COMMON-GEMINI:START/END -->`
marker comments. In 2026-08, `Projects/co-price` and `Projects/co-abap` both had these files
hand-rewritten (once during an earlier session, and again by an AI-assisted correction pass in
this session) without preserving the marker comments around the copied common sections. The
result: `upgrade-project.ts` silently had nothing to merge into for those files from that point
forward, and the files drifted out of sync with `templates/common/{CLAUDE,GEMINI}.md` with no
warning anywhere in the toolchain. The same investigation also found three other projects
(`co-architect`, `co-deck`, `co-game`) missing a single `COMMON-GEMINI` block (`Pre-Edit Quality
Gate`) that had apparently never been added since it was introduced in the template.

## Decision

Add a WARN-only, local-only check to `scripts/audit.ts` (`checkProjectDocMarkerDrift`, v2.26.0):
for each `Projects/co-*` directory present on the local machine (guarded by
`fs.existsSync('Projects')` — `Projects/` is gitignored and absent in CI), compare the count of
`COMMON-CLAUDE:START` / `COMMON-GEMINI:START` markers in that project's `CLAUDE.md`/`GEMINI.md`
against the count in `templates/common/CLAUDE.md`/`GEMINI.md`. WARN when a project has fewer
markers than the template baseline, with a remediation hint pointing at `upgrade-project.ts` and
manual marker re-wrapping.

This mirrors the existing `checkVariantScriptDrift()` heuristic pattern already in `audit.ts`
(WARN-only, first-pass heuristic, no attempt at semantic diffing — just presence/count).

## Also changed

- `docs/project-upgrade-guide.md`: corrected the MERGE-files section, which claimed the
  COMMON-CLAUDE/COMMON-GEMINI mechanism was "non-functional" — it has been active since
  upgrade-project.ts v1.3.0. Added this failure mode to §6 (Known Limitations) and §7
  (Troubleshooting).
- `scripts/project-to-variant.ts` (v1.2.1): corrected the promotion checklist's CLAUDE.md/GEMINI.md
  line, which told operators to "update variant context" even though most `templates/co-*`
  variants ship neither file by design (they're scaffolded from `templates/common/` at
  project-creation time, not carried in the variant template).
- `scripts/lifecycle-sync-audit.ts` (v1.5.0): registered `audit:upgrade-project` in
  `INTENTIONAL_CROSS_REFS` — the new WARN hint in `audit.ts` mentions the L0-only
  `upgrade-project.ts` script by name, guarded by the same `existsSync('Projects')` check as the
  function itself.

## Out of scope

- `project-to-variant.ts` does not gain automated marker validation for the rare variant that
  does ship a `templates/co-*/CLAUDE.md` or `GEMINI.md` — the checklist wording was corrected but
  the check remains manual for that path.
- No CI enforcement: the check only runs when `Projects/` exists locally, so it cannot be a hard
  gate in the `ai-workspace-standards` repo's own CI.
