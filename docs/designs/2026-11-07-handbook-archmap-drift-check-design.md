# Handbook Architecture-Map Drift Check — Design

- **Spec id**: `2026-11-07-handbook-archmap-drift-check-design`
- **Date**: 2026-11-07
- **Status**: implemented
- **Script**: `scripts/check-handbook-archmap-drift.ts` (layer L0, workspace root only)
- **Related**: T-20261107-002 (architecture map amendment), T-20261107-003 / T-20261107-004 (handbook edu-sync), handbook PRs 5throck/intro-to-ai-harness #78 and 5throck/multi-agent-harness-handbook #176 (the manual re-sync)

## 1. Problem

The workspace architecture map has one canonical source:
`docs/architecture/workspace-architecture{,.en,.es,.ja}.svg`. Two handbook
repositories embed copies of it. On 2026-11-07 the canonical map changed
(hub-and-spoke service-topology band, then the `.trail/` directory label).
Neither handbook followed, and both live sites showed a stale map until a
manual re-sync. No check compared the copies with the canonical files, so
nothing reported the drift. This design adds a recurrence guard.

## 2. The two copy forms

Each handbook directory under `Handbooks/` holds both forms, for four locales.

| Form | Path (per handbook) | Compared as |
|------|---------------------|-------------|
| (a) Asset file | `docs/assets/img/workspace-architecture{,.en,.es,.ja}.svg` | Whole file, byte-for-byte |
| (b) Inline map | `docs/appendix/<page>{,_en,_es,_ja}.html` | Map body only |

Appendix pages: `G_Workspace_Architecture` in `intro-to-ai-harness`,
`E_Workspace_Architecture` in `multi-agent-harness-handbook`.

Locale mapping: no suffix = Korean = `workspace-architecture.svg`; `.en`/`_en`
= English; `.es`/`_es` = Spanish; `.ja`/`_ja` = Japanese.

The inline copy keeps the page's own root `<svg ...>` open tag (`width="100%"`,
`role`, `aria-label`, `lang`, `font-family`), which legitimately differs from
the canonical root tag. Only the **body** is canonical content.

## 3. Comparison rule

- **Asset copy**: sha256 of the handbook file equals sha256 of the canonical
  locale file. No normalization.
- **Inline copy**: the page body equals the canonical body after
  normalization.
  - *Canonical body*: the lines strictly between the canonical root `<svg`
    open line (an optional leading `<?xml ...?>` line is skipped) and the last
    line, which must be `</svg>`.
  - *Page body*: the lines strictly between the first line that opens an
    `<svg` element with a `viewBox` attribute and the first later line whose
    trimmed text starts with `</svg>` (in practice `</svg></div>`).
  - *Normalization* (both sides, nothing else): (1) `\r\n` and `\r` become
    `\n`; (2) trailing spaces and tabs at the end of each line are removed;
    (3) trailing empty lines at the end of the body are removed. Leading
    whitespace, attribute order, and every other byte are compared as-is.
- The root open tag is never compared, so root-tag attribute differences alone
  do not produce DRIFT.

Each copy prints one line: `PASS`, `DRIFT` (content differs), or `DRIFT`
with a reason (copy file missing, or no inline map found in the page).

## 4. Where it runs

- **Standalone**: `bun scripts/check-handbook-archmap-drift.ts [--json]
  [--root <dir>] [--handbooks <dir>]`. `--root` sets the workspace root that
  holds `docs/architecture/` (default: the script's parent directory);
  `--handbooks` overrides the handbook parent directory (default
  `<root>/Handbooks`). The override lets a worktree, which has no `Handbooks/`,
  check the sibling clones of the main checkout read-only.
- **Daily review battery**: a row in `scripts/review-baseline.ts` (battery
  #10), which the 01:30 daily runner calls. A DRIFT fails the row, so the
  drift appears in the daily report.

Exit codes: `0` = all PASS or SKIP; `1` = one or more DRIFT; `2` = usage error
or missing canonical file (setup error — the canonical files are tracked in
this repository, so their absence is a repository fault, not handbook drift).

## 5. Skip behavior

`Handbooks/` and the handbook directories are gitignored sibling clones. They
exist only in a developer's main checkout, not in worktrees and not in GitHub
CI. When `Handbooks/` is absent, the check prints one `SKIP` line and exits 0.
When one handbook directory is absent, it prints `SKIP` for that handbook and
checks the others. Absence never fails the check.

## 6. Non-goals

- No auto-fix. The check reports; a person (or a dispatched specialist)
  re-syncs the handbook repositories through their own PRs.
- No check of captions, lead text, or "What's new" notes around the map.
- No check of the handbook build output or the deployed sites.
- No CI job in this repository (CI has no handbook clones; it would always
  SKIP).
- No L1 mirror: the script is layer L0 (workspace root only) because only the
  workspace root has handbook clones.
