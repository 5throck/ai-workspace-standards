# Design: Template 0.9.0 fleet rollout (T-20261001-021)

- - **Spec ID**: 2026-10-02-fleet-rollout-090
- **Date**: 2026-10-02
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-021; ADR-0097 follow-up delivery)

## Problem

templates/common/agents/pm.md 1.3.0 (Upstream Reporting Duty) and
docs/context.md Supported Surfaces were merged at L0/L1 but reached projects
only through a template release + upgrade-project. Release template-v0.9.0
landed 2026-10-02.

## Decision

Ran the workspace upgrade-project per project (ADR-0073 Amendment 1).
Verification: agents/pm.md carries the Upstream Reporting Duty section;
docs/context.md (footer 2.14) carries Supported Surfaces — Mandatory Coverage;
no project kept a stale pm.md override. The user runs
`bun scripts/install-upstream-mcp.ts` per hosting machine (out of agent scope).

## Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- `bun scripts/verify-scripts.ts --verify` — clean.
- `bun scripts/audit.ts` — pipeline gate battery (this run).
