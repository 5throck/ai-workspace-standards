# Design: Propagate issue-#1048 portable graft helpers into templates/common

- **Spec ID**: 2026-09-26-graft-helper-1048-propagation
- **Date**: 2026-09-26
- **Author**: PM (via cross-platform audit follow-up)
- **Status**: implemented

## Context

graft's own session-start hook rewrites the tracked helper files (`.claude/helpers/graft-hooks.cjs`,
`graft-statusline.cjs`) and bakes a machine-local `BAKED` constant while doing so. The workspace
root fixed this as issue #1048: the machine override moved to the UNTRACKED sibling
`graft.local.json`, demoted to last in the resolution chain, and the tracked files carry only
dynamic resolution. However, the fix was never propagated to `templates/common` — the L0→L1
publish (`propagate-to-templates.ts`) covers only the four script domains
(`scripts`, `scripts-helpers`, `scripts-hooks`, `scripts-lib`), so `.claude/helpers` is a
manually-synced template asset.

Observed 2026-09-26: `templates/common/.claude/helpers/` still carries the pre-#1048 re-baked
layout, and all 7 sibling fleet checkouts (`Projects/co-abap-plugin`, `co-architect`,
`co-consult`, `co-deck`, `co-develop`, `co-newbiz`, `co-safety`) received it via their upgrades.
On machines whose node install moved, the baked path is dead and graft hooks/statusline silently
no-op. co-abap re-applied the L0 helpers locally the same day (its PR carries upstream-fix-list
§9 pointing here).

## Requirements

- R1: `templates/common/.claude/helpers/` must contain the issue-#1048 portable helpers, byte-identical to the L0 root copies.
- R2: `templates/common/.gitignore` must carry the `.claude/helpers/graft.local.json` rule so the untracked override stays untracked in scaffolded projects.
- R3: No new logic; the L0 files are the single source of truth.

## Decision

- **D1**: Replace `templates/common/.claude/helpers/graft-hooks.cjs` + `graft-statusline.cjs` verbatim with the L0 root copies.
- **D2**: Append the graft.local.json ignore rule to `templates/common/.gitignore`.
- **D3**: No propagation automation added. Extending `propagate-to-templates.ts` to a `.claude/helpers` domain is out of scope; recurrence risk (graft's rewrite behavior) stays documented in the L0 file comments.

## Consequences

- The next `upgrade-project` run in every co-* project delivers the portable helpers and the ignore rule; projects currently carrying the baked constant heal on their next sync without manual edits.
- Fleet checkouts are separate repositories and heal at their own upgrade cadence — no fleet-wide rollout action required.
- Execution note: adding the gitignore rule to `templates/common` surfaced one MERGE_MANAGED parity error in `templates/co-price/.gitignore` (its managed block lacked the new lines, and the parity check is two-directional). Reconciled by mirroring the common managed block into co-price per the validator's fix guidance; `validate-templates.ts` → 0 errors after.

## Verification

- `grep BAKED templates/common/.claude/helpers/*.cjs` → 0 matches; byte-compare against L0 helpers → identical.
- `git check-ignore templates/common/.claude/helpers/graft.local.json` → ignored after D2.
- Workspace audit / typecheck / test gates at root, then fleet healing observed at each project's next upgrade.
