# Design: Promotion skill-asset parity — whole-dir skill materialization (T-20260923-005)

- **Spec ID**: `2026-09-23-promotion-skill-asset-parity-design`
- **Status**: implemented
- **Owner**: pm (triage), automation-engineer (implementation)
- **Ticket**: T-20260923-005
- **Date**: 2026-09-23

## Background

`generateSkillDirectories()` (helpers/generate-variant.ts, called via
`generateVariant()` by both `project-to-variant.ts` and
`l3-to-variant-pipeline.ts`) materializes skill directories into a promoted
variant template. Three defects:

1. **Grouping filter drops non-Markdown assets** — `endsWith('.md')` excludes
   `report.html`, `.json`, `.svg` skill assets (explain-me's runtime template
   class) from BOTH the top-level `skills/<name>/` copy and the platform
   mirrors.
2. **Mirror copies collapse to SKILL.md** — every grouped file whose
   targetPath contains `.claude/skills/<name>/` (etc.) is written to
   `<mirror>/skills/<name>/SKILL.md`. An L3 project whose mirrors carry
   sub-files (the fleet norm since multi-file skills: 37-file handbook) has
   each sub-file overwrite SKILL.md — last-writer-wins content corruption,
   order-dependent.
3. **Top-level skills/<name>/ carries SKILL.md only** — references/ subdirs
   are dropped; the copy-remaining loop skips `skills/` assuming this function
   handled it (docstring, v1.2.0).

Fleet mirrors are whole-dir complete today only because `sync-skills`
`defaultCopyDir` re-materializes them from L1 after the fact — a promotion
into a fresh variant template has no such follow-up.

## Decisions

- **D1 — union-and-normalize copy model.** For each skill name, group ALL
  keepInVariant files under `skills/<name>/` (no `.md` filter). For each
  grouped file compute `relPath` = the path segment after
  `skills/<skillName>/`. The canonical content for a relPath is the source's
  top-level `skills/<name>/<relPath>` copy when present, else any mirror
  copy. Write every relPath to: the top-level `skills/<name>/` AND all four
  platform mirrors — preserving subpaths (`references/GUIDE.md` stays
  `references/GUIDE.md`; never renamed to SKILL.md).
- **D2 — byte-preserving copy.** New generic copies use `copyFileSync` (via
  the module's fs namespace) so non-UTF8-safe assets are safe; existing
  `copyFileUTF8` call sites remain for text-only paths.
- **D3 — mirrors converge to whole-dir.** A source with partial mirrors is
  completed from the union (backfill), matching the fleet norm; a source with
  NO mirror entry for a relPath gets it from the canonical top-level source
  (preserves the existing backfill behavior, extended to subpaths).
- **D4 — version.** helpers/generate-variant.ts 1.16.0 → 1.17.0; registry
  rows (L0, L1) in lockstep.

## Requirements

1. A promotion manifest containing a multi-file skill (SKILL.md +
   references/*.md + a non-md asset) materializes every file into the
   top-level `skills/<name>/` AND all four platform mirrors, preserving
   subpaths.
2. Mirror sub-file content never overwrites SKILL.md.
3. Single-file skills behave exactly as before (v1.16.0 Windows-backslash
   regression test stays green).
4. bun test, typecheck, validate-templates, check-upgrade-coverage --strict
   pass.

## Accessibility

Backend/scripting change only — no user-facing UI. Exempt per ADR-0065 with
this explicit statement.

## Preview verification

Not applicable — no rendered UI surface. Exempt per ADR-0070.

## Validation plan

Extend `tests/unit/generate-variant-pipeline-fixes.test.ts`: a multi-file
skill (SKILL.md + references/GUIDE.md + assets/logo.svg + partial mirrors)
must materialize 3 files × 5 roots with subpaths preserved and SKILL.md
content intact; plus a mirror-sub-file corruption regression (mirror
references file must NOT clobber SKILL.md).
