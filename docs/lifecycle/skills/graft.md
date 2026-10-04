# Graft Skill — Lifecycle Record

## Metadata
- **Skill**: graft
- **Status**: active
- **Version**: 1.0.0

> Note: the graft CLI refreshes `skills/graft/SKILL.md` on every release; when the frontmatter version moves, this record moves with it.
- **Created**: 2026-09 (installed with the graft repo-context-graph tooling)
- **Last Updated**: 2026-10-04

## Description
Usage guide for the graft repo-context-graph MCP/CLI (`graft ask`, `graft map`,
`graft skeleton`, `graft callers`, `graft grep`) — token-budgeted codebase
orientation and exact file:line spans. Indexed data lives in `graft/`; the index
is rebuilt with `graft build` (deterministic, no API key).

## Custody (self-managed tool — T-20261002-001)
graft self-installs and rewrites its platform-mirror SKILL.md copies and helper
shelves; custody over those paths was transferred to the tool and they are
untracked (docs/self-managed-surfaces.json). The `skills/graft/` SSOT copy stays
tracked as the documented workspace skill — the tool refreshes it on release, so
this record intentionally does NOT carry a workspace version: version drift
between this file and the tool-owned SKILL.md is expected and exempted from
Check E of lifecycle-sync-audit (tool-owned mirrors).

## Dependencies
- graft CLI/MCP (self-installed, runs via `graft mcp`)
- None workspace-side

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-02 | - | active | Lifecycle record created retroactively; the skill was tool-delivered with the graft adoption (ADR tracked in docs/self-managed-surfaces.json) | pm |

## Acceptance Criteria

### Active Phase
- SKILL.md frontmatter parses and carries the tool's current name/description
- `graft map` runs in the workspace root without error
