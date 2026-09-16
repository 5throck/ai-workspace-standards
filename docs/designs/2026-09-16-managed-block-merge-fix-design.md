---
schemaVersion: 1.0.0
spec-id: managed-block-merge-fix
---

# Managed-Block Merge Fix — 2026-09-16

## 1. Overview

Lands urgent ticket T-20260916-012: `mergeWorkspaceManaged()` in
`scripts/upgrade-project.ts` destroyed keyed WORKSPACE-MANAGED blocks
during fleet upgrades. The merge core is extracted into a new pure lib,
`scripts/lib/managed-block-merge.ts`, and the two compounding defects in
its unlabeled-blocks reconciliation phase are fixed:

1. the reconcile count compared ALL project pattern occurrences (keyed
   blocks included) against a template count of UNLABELED blocks only, and
2. the reconcile/positional slice offsets were captured before the keyed
   replacements mutated the content.

## 2. Problem

Real damage observed during the 2026-09-16 Projects/co-develop upgrade:

- the project `.gitignore` lost its entire WORKSPACE-MANAGED secrets
  block (`.env` / `*.pem` ignore patterns). The upgrade's own security
  bootstrap gate FAILED on the missing patterns — the only reason the
  corruption was caught at all;
- the project `AGENTS.md` lost its 43-line
  `WORKSPACE-MANAGED: graft repo context graph` block.

Dry-run log shape for both files: a normal
`MERGED WORKSPACE-MANAGED:<key> ...` line, followed by
`WARNING: ... unlabeled block count mismatch (project has 1, template
has 0)` and then `RECONCILED WORKSPACE-MANAGED blocks` — the reconcile
replaced the first-to-last occurrence span with
`unlabeledTplBlocks.map(...).join('\n\n')` where the template had ZERO
unlabeled blocks, i.e. an empty string. Every keyed block in the file was
deleted. Both files are reproducible fixtures: `AGENTS.md` is still
modified (43 lines deleted) in the co-develop working tree.

## 3. Root cause (two compounding defects)

In the per-pattern loop of the pre-fix `mergeWorkspaceManaged()`:

- **Defect 1 — over-counting.** `projOccurrences` collected every match
  of the pattern regex — keyed WORKSPACE-MANAGED / VARIANT-INJECT blocks
  (open markers with a `: key` suffix) INCLUDED — while
  `unlabeledTplBlocks` counted only the TEMPLATE's key-less blocks. When
  a project file's only managed blocks were keyed and the template had
  zero unlabeled blocks, `projOccurrences.length (1) !==
  unlabeledTplBlocks.length (0)` fired the reconcile branch, which sliced
  `updated` from the first to the last stored occurrence (the keyed
  blocks) and spliced in the empty join.
- **Defect 2 — stale offsets.** `projOccurrences` offsets were captured
  BEFORE the keyed-block replacements mutated `updated`. A keyed merge or
  insert changes content length, shifting every later offset; even a
  legitimate reconcile or equal-count positional replacement then sliced
  stale positions.

## 4. The fix: extraction + semantic corrections

### 4.1 New pure lib `scripts/lib/managed-block-merge.ts` (L0-only)

It serves only the L0-only upgrader, so it ships as layer L0 (same
convention as `lib/upgrade-policy.ts`). Import-safe, no I/O at import
time, scratch-string unit-testable. API:

```ts
mergeManagedBlocks(projectContent, templateContent, commonContent: string | null,
                   rel: string, dryRun: boolean)
  → { content: string; merged: boolean; log: string[] }
```

Moved with it: `MANAGED_PATTERNS`, `ManagedBlock`, `findManagedBlocks`,
`buildBlockKeyMap`, `findInsertionPosition`, plus the new
`buildMergedTemplateBlocks()` exposing the variant ∪ common per-key
union (the wrapper needs it for the INFO no-markers skip check before it
touches the filesystem).

Semantic corrections inside the per-pattern loop:

- keyed and UNLABELED project occurrences are tracked separately;
- the unlabeled append / reconcile / positional branches compare and
  slice ONLY unlabeled project occurrences (Defect 1);
- unlabeled occurrences are re-scanned from `updated` AFTER the keyed
  replacements (fresh offsets — Defect 2), since keyed merge/insert
  changes length;
- when the reconcile replaces an unlabeled span, the replacement is the
  unlabeled template blocks joined `'\n\n'`; a template with ZERO
  unlabeled blocks while the project has unlabeled ones still removes
  them — that is the designed stale-block cleanup for truly unlabeled
  classes — but it can now never touch keyed blocks.

### 4.2 Behavior preservation

- All log lines (MERGED / INSERTED / APPENDED / RECONCILED / WARNING /
  INFO / CREATED) are preserved verbatim in `log`; the wrapper prints
  them unchanged. Tests and humans grep them.
- The COMMON-* patterns (COMMON-CLAUDE/GEMINI, COMMON-AGENTS/CONTEXT,
  DYNAMIC_SKILLS) are always unlabeled (key `''`): their counts were
  never polluted, and no keyed phase ever mutates the content inside
  their iteration — so their behavior is byte-identical to the
  pre-extraction code.
- `mergeWorkspaceManaged()` in `upgrade-project.ts` becomes a thin
  filesystem wrapper: read template (+ common when under
  `templates/`), INFO-skip when the union is empty, CREATED path when
  the project file is missing, otherwise call the lib, print its log,
  and write `content` back when `!dryRun && merged`. Dry-run behavior
  (log emitted, no write) is unchanged.

### 4.3 Known pre-existing limitation (out of scope, documented)

The open-marker regex `<!-- WORKSPACE-MANAGED(?::[^\-]*?)? -->` cannot
match keys containing a hyphen (`[^\-]`), so hyphenated keys such as
`tier-model-mapping` are invisible to the merge path today — identical
in the pre-fix code. Changing pattern semantics is a separate decision
with its own spec.

## 5. Version bumps (minor — behavioral fix + new module)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/upgrade-project.ts` | 1.30.0 → 1.31.0 | `@version` + header changelog; L0 + L1 SCRIPTS.md rows |
| `scripts/lib/managed-block-merge.ts` | new 1.0.0 | `@version`; L0 + L1 SCRIPTS.md rows (L0-only layer, mirroring the `new-project.ts`/`upgrade-project.ts` row convention) |
| `tests/unit/managed-block-merge.test.ts` | new 1.0.0 | `@version` header |

No L0+L1 file content changes (both scripts stay L0-only), so
`propagate-to-templates` is not required; both hand-maintained SCRIPTS.md
registry rows are updated in lockstep anyway.

## 6. Test plan

`tests/unit/managed-block-merge.test.ts` (new; scratch content strings
only — no fs, no real `templates/`):

- (a) keyed block merge by key;
- (b) THE BUG: project with only a keyed WORKSPACE-MANAGED block +
  template with the same keyed block and zero unlabeled → the keyed
  content survives and no RECONCILED/WARNING is logged;
- (c) stale-offset scenario: template keyed block of DIFFERENT length
  than the project's + an unlabeled project block after it + count
  mismatch → the reconcile operates on fresh offsets (PROSE-MID /
  PROSE-TAIL sentinels survive; exact joined replacement asserted);
- (d) unlabeled append when the project has none;
- (e) unlabeled count-mismatch reconcile removes only the unlabeled span
  (zero-unlabeled template; keyed block and surrounding prose intact);
- (f) equal-count positional replacement after a length-changing keyed
  merge (exact output pinned);
- (g) COMMON-AGENTS zone parity: START/END pair preserved, exactly one
  pair, inner content swapped;
- (h) project file with zero managed blocks + template keyed block →
  INSERTED;
- (i) per-key union variant ∪ common at merge time;
- extraction pins: `findManagedBlocks` key extraction, COMMON blocks
  always key-less, union dedupe (variant wins), dryRun purity (content
  identical to apply mode, logs tagged), INFO-skip shape.

## 7. Accessibility

Backend/CLI-only work (a merge-core extraction in an upgrade script, a
pure lib, and unit tests). No user-facing UI is produced. Exempt from
ADR-0065 WCAG scope; the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed
validation battery (unit suite, validate-templates, typecheck, audit,
scripts suite, lifecycle-sync-audit, review-baseline) plus the live
dry-run on the real corrupted fixture (Projects/co-develop `.gitignore`
/ `AGENTS.md`).
