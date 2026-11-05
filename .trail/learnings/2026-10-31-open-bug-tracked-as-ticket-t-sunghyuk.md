---
title: "Open bug tracked as ticket T-20260929-015 (PR #1240) - /sync step 4.51 runs…"
author: SungHyuk
date: 2026-10-31
id: l-97f7c11c
scope: repo
status: active
touches:
  - scripts/dev-sync.ts
  - scripts/propagate-to-templates.ts
  - scripts/ticket.ts
  - templates/common/AGENTS.md
  - templates/common/agents/pm.md
---

## Decided
`scripts/dev-sync.ts` step 4.51 runs `bun scripts/propagate-to-templates.ts --governance-l1` with no `--apply`. Without `--apply` that script is a dry run and exits 0, so edits to root CLAUDE/GEMINI/AGENTS/CODEX/HERMES.md (including the `COMMON-AGENTS` zone) are not deployed to `templates/common` during `/sync`. Found 2026-09-29 during the PM tier-floor series (PRs #1233-#1239). Not fixed. Tracked as manual ticket `T-20260929-015` (tickets/governance/, priority normal, backlog), landed by PR #1240. Check `bun scripts/ticket.ts list` for its current status before assuming it is still open.

**Why:** the zone reaches variants only via `--governance-l1 --apply` (root to `templates/common/AGENTS.md`) followed by `--docs --apply` (zone into the 13 variants). `validate-templates.ts` only checks common-to-variant parity, not root-to-common, so nothing fails.

## Watch out
while the ticket is open, after editing a shared zone in a root instruction file, run both commands by hand, check `git diff --stat -- templates`, then stage the result. `templates/common/agents/pm.md` is always skipped by these scripts (it uses `extends:`), so edit it by hand in a templates-only PR. Related: pr-merge-and-sync-workflow.

_From Claude Code's memory of this repo, last updated Sep 29._
