# Design: LF-enforcement `.gitattributes` block promotion (co-deck variant → L1 common)

- **Spec ID**: 2026-09-20-gitattributes-lf-enforcement
- **Date**: 2026-09-20
- **Status**: implemented
- **Source**: manual (project-resync Step 2 selective backport, 5-surface method)

## Problem

Projects delivered from `templates/common/` carried `* text=auto` without an
explicit `eol=lf` for web/doc files. On Windows checkouts (`core.autocrlf=true`),
git smudges `docs/VERSION_MANIFEST.md` to CRLF. The manifest drift gate
(`generate-version-manifest.ts --check`) compares the on-disk file against the
LF in-memory regeneration byte-wise, so every line "differs" and the pre-push
audit fails with `20+ differing line(s)` — blocking every push made after a
post-merge `checkout main + pull`.

Observed fleet-wide on 2026-09-20: 6 of 8 `Projects/co-*` repos failed the
pre-push gate this way with a zero-content git diff.

Measurement (md5 + diff):

- `Projects/co-deck/.gitattributes` = `templates/common/.gitattributes` + an
  8-line LF-enforcement block (strict superset — richer, not divergent).
- The other 7 projects are byte-identical to `templates/common/.gitattributes`.
- `templates/co-deck/.gitattributes` already carries the same block.
- Root L0 `.gitattributes` already carries `*.md text eol=lf`.

## Decision

Promote co-deck's block into `templates/common/.gitattributes`, generalized
(the `co-deck:` comment prefix is dropped — it becomes fleet policy):

```gitattributes
*.html text eol=lf
*.css text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
```

Placement: directly after the `*.sh text eol=lf` row, before the union-merge
section — matching co-deck's file layout.

`templates/co-deck/.gitattributes` keeps its identical copy: variant files
replace common on delivery, so the duplicate is idempotent, not a conflict.

## Alternatives rejected

- **Per-repo local git config** (`core.autocrlf=false`, `core.eol=lf`): fixes
  one machine only; also `* text=auto` overrides `core.autocrlf` in the
  attribute chain, so config alone leaves the phantom-M state. (Applied this
  cycle purely as a stopgap to unblock pushes; redundant once the template
  lands via upgrade.)
- **EOL-normalizing the drift comparator** (`generate-version-manifest.ts`):
  treats one symptom; any other LF-expecting tool would still trip on CRLF
  smudge. The attribute-level fix removes the cause.

## Accessibility

Non-UI infrastructure change — no accessibility impact (explicit statement per
ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (explicit statement
per ADR-0070).

## Verification

- `bun scripts/validate-templates.ts` — 0 errors (2 pre-existing warnings).
- `bun test` — 791/791 pass. (First full-suite run showed one mtime-ordering
  flake in `overlay-snapshot-rollback`; it passed in isolation with this change
  applied and on the full-suite rerun — unrelated.)
- Fleet effect: the other 7 projects receive the block via this cycle's Step 4
  `upgrade-project` delivery.
