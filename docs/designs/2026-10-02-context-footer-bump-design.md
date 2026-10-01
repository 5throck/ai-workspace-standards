# Design: docs/context.md footer bump 2.13 → 2.14 (Supported Surfaces delivery)

- **Spec ID**: 2026-10-02-context-footer-bump
- **Date**: 2026-10-02
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-021 rollout)

## Problem

The Supported Surfaces — Mandatory Coverage section was added to
templates/common/docs/context.md while the file sat at version 2.13 — no
footer bump. The TEMPLATE TREE SYNC pass is version-based: project copies at
2.13 were "not behind", so no project ever received the section.

## Decision

Bump the footer to 2.14 with a note naming the cause. The version-based sync
then overwrites project copies (the immutable-context sanctioned channel),
verified live across all 13 co-* projects during the T-20261001-021 fleet
rollout (Supported Surfaces present 13/13). No content change beyond the footer.

## Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- 13/13 Projects/co-*/docs/context.md carry "Supported Surfaces" post-rollout.
- \`bun scripts/audit.ts\` — pipeline gate battery (this run).
