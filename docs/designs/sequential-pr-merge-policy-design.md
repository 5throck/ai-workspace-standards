# Design: Sequential PR Merge-Before-Next-Branch Policy

**Date**: 2026-07-11
**Status**: Approved
**Spec ID**: 2026-07-11-sequential-pr-merge-policy
**Scope**: CONSTITUTION.md, docs/constitution/03-pr-workflow.md, AGENTS.md, CLAUDE.md, GEMINI.md, templates/common/CLAUDE.md, templates/common/GEMINI.md

---

## 1. Problem Statement

During this session, 6 PR branches (#394-#399) were all created from the same starting `main` commit without merging any of them first. Because `dev-sync.ts` touches shared pipeline files on every commit (`CHANGELOG.md` `[Unreleased]` section, `memory/YYYY-MM-DD.md`, `docs/VERSION_MANIFEST.md`, `scripts/README.md`, `templates/common/scripts/README.md`) regardless of which workstream a PR belongs to, every one of those branches ended up editing the same lines relative to the same stale merge-base — producing textual merge conflicts on every single PR when merge was finally attempted. Sequential *merge order* could not resolve this, because the conflicts were baked in at *branch creation time*: each branch's diff was computed against a `main` that never advanced.

Root cause: no governance rule required confirming a prior PR was merged (or explicitly declared merge-order-independent with a stated reason) before branching for the next task.

## 2. Decision Summary

Add a **Sequential Branch Dependency Rule** to `docs/constitution/03-pr-workflow.md` (with a one-line summary added to `CONSTITUTION.md` §3 and a cross-reference from `AGENTS.md` §5.1): before creating a new PR branch from `main`, any previously-created-but-unmerged PR branch must either be merged first, or the new branch must carry an explicit, written justification for why it is safe to fan out in parallel (e.g., genuinely disjoint file scope with no shared pipeline-generated files touched).

**Extended to templates**: the same rule is added to `CLAUDE.md`/`GEMINI.md`'s "Commit Protection" sections (root), which propagate via `propagate:governance` to `templates/common/CLAUDE.md`/`GEMINI.md` — so projects scaffolded via `new-project.ts` inherit this discipline from creation, not just the workspace root.

## 3. Files to Change

| File | Action |
|------|--------|
| `docs/constitution/03-pr-workflow.md` | Add new §3.3 "Sequential Branch Dependency Rule" |
| `CONSTITUTION.md` §3 | Add one clause referencing the new rule |
| `AGENTS.md` §5.1 (Standard Execution Plan Template) | Add a note under "Key points" cross-referencing the rule |
| `CLAUDE.md`, `GEMINI.md` | Add a rule paragraph directly after the existing "Commit Protection (SYNC_ACTIVE)" note |
| `templates/common/CLAUDE.md`, `templates/common/GEMINI.md` | Propagated automatically via `bun run propagate:governance` (no manual edits) |

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| No rule change; rely on judgment each session | Zero maintenance | Same failure recurs — this session is direct proof | Rejected |
| Hard rule: always merge before branching again, no exceptions | Simple, unambiguous | Overly rigid — some genuinely independent single-file changes don't need this | Rejected |
| Merge-first-or-justify rule | Handles the common case (shared pipeline files) while allowing genuinely independent work to proceed in parallel with a documented reason | Requires the agent/PM to actually check file overlap before branching, not just assume | **Selected** |
| Workspace-root-only rule | Simpler propagation | New projects would repeat the exact same mistake with no guardrail | Rejected — user explicitly requested template propagation |

## 5. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|-----------------|
| Claude Code | Yes — `CLAUDE.md` rule added, propagates to `templates/common/CLAUDE.md` | `CLAUDE.md`, `templates/common/CLAUDE.md` |
| Antigravity (GEMINI.md) | Yes — `GEMINI.md` rule added, propagates to `templates/common/GEMINI.md` | `GEMINI.md`, `templates/common/GEMINI.md` |
| templates/common | Yes — via the standard `governance-l1` propagation mechanism, no manual template edits | `templates/common/CLAUDE.md`, `templates/common/GEMINI.md`, `templates/common/AGENTS.md` |

`CONSTITUTION.md` remains L0-only per its own non-propagation rule — the plain-text "CONSTITUTION.md" references in `CLAUDE.md`/`GEMINI.md` are auto-transformed to "context.md" during propagation by the existing `scrubConstitutionRefs()` mechanism in `propagate-to-templates.ts`.

## 6. Acceptance Criteria

- [x] `docs/constitution/03-pr-workflow.md` states the rule with the specific shared-file list that triggers it and the justification-required exception.
- [x] `CONSTITUTION.md` §3 references it in one sentence.
- [x] `AGENTS.md` §5.1 cross-references it for multi-row execution plans.
- [x] `CLAUDE.md`/`GEMINI.md` carry the rule and it propagates cleanly to `templates/common/` (verified via `bun run propagate:governance` + `bun scripts/audit.ts`).

## 7. Related Finding (not part of this design's original scope, fixed opportunistically)

While verifying `main`'s state before this work, `tests/unit/ssrf-safe-fetch.test.ts` (the M15 regression suite) was found missing despite `scripts/lib/ssrf.ts`'s `safeFetch()`/`fetchPinned()`/`SSRFBlockedError` already being merged via PR #399 — the test file was never actually included in that commit. Recreated in the same PR as this design's implementation, since it was discovered during the same audit pass.
