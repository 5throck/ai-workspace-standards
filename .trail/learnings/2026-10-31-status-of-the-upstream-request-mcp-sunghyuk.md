---
title: Status of the upstream-request MCP initiative (L3 projects file L1/L2 root-cause tickets)
author: SungHyuk
date: 2026-10-31
id: l-83bd173b
scope: repo
status: active
touches:
  - docs/designs/2026-10-01-upstream-request-mcp-design.md
  - agents/pm.md
  - scripts/helpers/mcp-config-edit.ts
---

## Decided
Goal: L3 project agent teams report L1/L2 root causes to the ai_workspace PM through a global stdio MCP server `ai-workspace-upstream` instead of silently patching locally. Design: `docs/designs/2026-10-01-upstream-request-mcp-design.md` (Appendix A holds the decisions and recorded dissent); meeting transcript `memory/meeting-2026-10-01-upstream-request-mcp.md`.

**Merged 2026-10-01:** PR-A design (#1283), PR-B server/schema/ticket.ts rendering/installer/PM triage rules (#1286), follow-up tickets T-20261001-016 (ticket.ts commands to set `upstream.triage`/`upstream.resolution`) and T-20261001-017 (untested races, installer real-write path, Windows registration, log retention) via #1287.

**Also merged 2026-10-01:** PR-C #1288 (templates `agents/pm.md` 1.3.0 reporting duty + `pending` fallback + contract pin), PR-D #1289 (installer 2.0.1 for all eight surfaces, `scripts/helpers/mcp-config-edit.ts`, CONSTITUTION §11.0, ADR-0097, design Appendix B), PR-E #1290 (templates `docs/context.md` Supported Surfaces). All three PRs are done.
…

## Watch out
before touching this feature, read the design doc's Appendix A. The haiku implementer gave inaccurate completion reports twice; verify test coverage and security-sensitive fixes yourself rather than trusting a subagent summary.

_From Claude Code's memory of this repo, last updated Oct 1._
