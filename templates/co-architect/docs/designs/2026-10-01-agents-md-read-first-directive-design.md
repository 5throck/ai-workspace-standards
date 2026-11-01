# Design: Mandatory read-AGENTS.md pointer in platform instruction files

- - **Spec ID**: 2026-10-01-agents-md-read-first-directive
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (user-requested fleet change)

## Problem

The platform instruction files (CLAUDE.md, GEMINI.md, CODEX.md) in existing
projects carried no explicit directive to read AGENTS.md before work; the
template top-area pointer table never reaches upgraded projects because it
sits outside the managed blocks the section merge delivers.

## Decision

Insert a compact read-first callout inside the FIRST COMMON-PLATFORM managed
block of templates/common CLAUDE.md, GEMINI.md, and CODEX.md, then re-run
upgrade-project across the fleet so the positional block merge delivers it.
HERMES.md already carries the directive at its header (ADR-0093) and is
unchanged.

## Accessibility

Non-UI documentation change — no accessibility impact (explicit statement per
ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (explicit statement
per ADR-0070).

## Verification

- Callout present in this project's three platform instruction files.
- `bun scripts/verify-scripts.ts --verify` — clean.
- `bun scripts/audit.ts` — pipeline gate battery (this run).
