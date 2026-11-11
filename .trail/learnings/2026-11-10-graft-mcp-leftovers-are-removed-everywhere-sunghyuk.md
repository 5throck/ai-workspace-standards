---
title: "Graft MCP leftovers are removed everywhere, templates included, but in a separate PR from root and projects"
author: SungHyuk
date: 2026-11-10
branch: main
cost: { minutes: 7, tokens: 37277 }
id: l-e32e6bae
scope: repo
status: active
src: agent
touches:
  - scripts/validate-templates.ts
  - docs/self-managed-surfaces.json
  - AGENTS.md
  - agents/pm.md
---

## Decided
Remove every leftover graft MCP registration and replace it with trail: workspace root, Projects/co-*, and the templates plus their validator. Root/Projects and templates land as separate PRs because the workspace boundary policy forbids mixing them in one task.

## Tried and ruled out
- Root and Projects only: leaves templates re-delivering graft to every upgraded project.
- Fixing only the entries that fail at startup: leaves stale permissions and opencode/gemini/agents entries behind.

## Watch out
Tool-owned legacy mirrors (skills/graft dirs, graft-hooks helpers) are deliberately left alone. User-level ~/.claude settings still list graft and must be cleaned by the user.

In the code: .claude/settings.local.json, Projects/co-*/{.mcp.json,opencode.json,.agents/mcp.json}, templates/*, scripts/validate-templates.ts (checkGraftMcpSurfaces), docs/self-managed-surfaces.json.
