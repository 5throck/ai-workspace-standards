# Design: Sequential PR Merge-Before-Next-Branch Policy

**Date**: 2026-07-11
**Status**: Approved
**Spec ID**: 2026-07-11-sequential-pr-merge-policy
**Scope**: CONSTITUTION.md, docs/constitution/03-pr-workflow.md, AGENTS.md

---

## 1. Problem Statement

During this session, 6 PR branches (#394-#399) were all created from the same starting `main` commit without merging any of them first. Because `dev-sync.ts` touches shared pipeline files on every commit (`CHANGELOG.md` `[Unreleased]` section, `memory/YYYY-MM-DD.md`, `docs/VERSION_MANIFEST.md`, `scripts/README.md`, `templates/common/scripts/README.md`) regardless of which workstream a PR belongs to, every one of those branches ended up editing the same lines relative to the same stale merge-base — producing textual merge conflicts on every single PR when merge was finally attempted. Sequential *merge order* could not resolve this, because the conflicts were baked in at *branch creation time*: each branch's diff was computed against a `main` that never advanced.

Root cause: no governance rule required confirming a prior PR was merged (or explicitly declared merge-order-independent with a stated reason) before branching for the next task.

## 2. Decision Summary

Add a **Sequential Branch Dependency Rule** to `docs/constitution/03-pr-workflow.md` (with a one-line summary added to `CONSTITUTION.md` §3): before creating a new PR branch from `main`, any previously-created-but-unmerged PR branch must either be merged first, or the new branch must carry an explicit, written justification for why it is safe to fan out in parallel (e.g., genuinely disjoint file scope with no shared pipeline-generated files touched).

## 3. Files to Change

| File | Action |
|------|--------|
| `docs/constitution/03-pr-workflow.md` | Add new §3.3 "Sequential Branch Dependency Rule" |
| `CONSTITUTION.md` §3 | Add one clause referencing the new rule |
| `AGENTS.md` §5.1 (Standard Execution Plan Template) | Add a note under "Key points" cross-referencing the rule, since multi-row execution plans are exactly where this matters |

## 4. Trade-offs Considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| No rule change; rely on judgment each session | Zero maintenance | Same failure recurs — this session is direct proof | Rejected |
| Hard rule: always merge before branching again, no exceptions | Simple, unambiguous | Overly rigid — some genuinely independent single-file changes don't need this | Rejected |
| Merge-first-or-justify rule | Handles the common case (shared pipeline files) while allowing genuinely independent work to proceed in parallel with a documented reason | Requires the agent/PM to actually check file overlap before branching, not just assume | **Selected** |

## 5. Platform Impact

None — this is a workflow documentation change with no code or template propagation impact. `CONSTITUTION.md` remains L0-only per its own non-propagation rule.

## 6. Acceptance Criteria

- [ ] `docs/constitution/03-pr-workflow.md` states the rule with the specific shared-file list that triggers it (CHANGELOG.md, memory/*.md, docs/VERSION_MANIFEST.md, scripts/README.md, templates/common/scripts/README.md) and the justification-required exception.
- [ ] `CONSTITUTION.md` §3 references it in one sentence.
- [ ] `AGENTS.md` §5.1 cross-references it for multi-row execution plans.
