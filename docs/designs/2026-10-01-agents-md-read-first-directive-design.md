# Design: Mandatory read-AGENTS.md pointer in platform instruction files (delivery path)

- **Spec ID**: 2026-10-01-agents-md-read-first-directive
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (user-requested fleet change; completes U-20261001-001 delivery)

## Problem

The U-20261001-001 fix added the "AGENTS.md is the SSOT registry — read it
first" directive to the governance pointer tables of CLAUDE.md/GEMINI.md/
CODEX.md (root + templates/common). But the pointer table sits OUTSIDE the
COMMON-* managed blocks, so the section-based upgrade merge never carries it
into existing projects — verified: only 1 of 13 co-* projects had it. The
project-side instruction files therefore carried no explicit read-first
directive.

## Decision

Place the directive inside the delivery channel that the upgrade merge
actually syncs: a compact callout at the top of the FIRST COMMON-PLATFORM
managed block. Source of truth is the ROOT file (propagate-to-templates
--governance-l1 regenerates templates/common from root, so a template-only
edit would be clobbered); templates/common/CLAUDE.md, GEMINI.md, CODEX.md
were regenerated via the transform and verified "already in sync"
(transform-stable, idempotent). HERMES.md already carries the directive at
its header (ADR-0093) — unchanged. Fleet delivery to the 13 co-* projects
happened the same day via upgrade-project re-runs + per-project dev-sync
PRs (39/39 files verified).

## Accessibility

Non-UI documentation change — no accessibility impact (explicit statement per
ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (explicit statement
per ADR-0070).

## Verification

- Callout present in 39/39 project instruction files (13 projects x 3 files).
- `propagate-to-templates.ts --governance-l1` reports all four instruction
  files "already in sync" (idempotent).
- `bun scripts/audit.ts` — pipeline gate battery (this run).
