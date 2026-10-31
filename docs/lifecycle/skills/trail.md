# Trail Skill — Lifecycle Record

## Metadata
- **Skill**: trail
- **Status**: active
- **Version**: 1.1.0

> Note: the trail CLI (ex-graft) refreshes `skills/trail/SKILL.md` on every release; when the frontmatter version moves, this record moves with it.
- **Created**: 2026-09 (installed with the graft repo-context-graph tooling)
- **Renamed**: 2026-10-31 — `skills/graft/` → `skills/trail/`, vendor rename 0.28 (`@trailhq/trail-code`); design 2026-10-31-graft-trail-migration, U-20261031-009. graft-era alias note carried in SKILL.md.
- **Last Updated**: 2026-10-31

## Description
Usage guide for the trail repo-context-graph MCP/CLI (`trail ask`, `trail map`,
`trail skeleton`, `trail callers`, `trail grep`; graft-era binaries spell the
same commands `graft …`) — token-budgeted codebase orientation and exact
file:line spans. Indexed data lives in the tool's index directory (`graft/`
pre-migration, `.trail/cache/` after `trail init`); the index is rebuilt with
`trail build` (deterministic, no API key).

## Custody (self-managed tool — T-20261002-001)
trail self-installs and rewrites its platform-mirror SKILL.md copies and helper
shelves; custody over those paths was transferred to the tool and they are
untracked (docs/self-managed-surfaces.json — both path generations listed during
the fleet transition). The `skills/trail/` SSOT copy stays tracked as the
documented workspace skill — the tool refreshes it on release, so this record
intentionally does NOT carry a workspace version: version drift between this
file and the tool-owned SKILL.md is expected and exempted from Check E of
lifecycle-sync-audit (tool-owned mirrors).

## Dependencies
- trail CLI/MCP (self-installed; graft-era binaries run via `graft mcp`)
- None workspace-side

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-31 | active | active (renamed graft → trail) | Vendor rename 0.28 (`@trailhq/trail-code`) — SSOT path, frontmatter name, and doctrine moved to trail-era naming with a graft-era alias note (design 2026-10-31-graft-trail-migration, U-20261031-009) | pm |
| 2026-10-02 | - | active | Lifecycle record created retroactively; the skill was tool-delivered with the graft adoption (ADR tracked in docs/self-managed-surfaces.json) | pm |

## Acceptance Criteria

### Active Phase
- SKILL.md frontmatter parses and carries the tool's current name/description
- `trail map` runs in the workspace root without error (graft-era binaries: `graft map`)
