---
schemaVersion: 1.0.0
spec-id: 2026-09-18-delivery-pipeline-hardening-design
---

# Delivery Pipeline Hardening — 2026-09-18

## 1. Overview

Codifies the four delivery-pipeline failure classes observed while landing
ADR-0080 (PRs #954/#955) and fixes their remediation directions. Full
decision record: ADR-0081. Implementation is deferred to
T-20260918-001..004 — this design pins scope and acceptance criteria so the
tickets can land independently.

| # | Failure class | Blocked | Ticket |
|---|---------------|---------|--------|
| P1 | VERSION_MANIFEST date-column off-by-one-commit lag (full-history CI) | PR #954 CI; local pre-push audit | T-20260918-001 |
| P2 | Main-integration dead-end for open PR branches | PR #954 merge (branch rebuild + force-with-lease) | T-20260918-002 |
| P3 | Absolute line-number pin on intentional-duplicate marker | PR #955 CI (3 OSes) | T-20260918-003 |
| P4 | Fleet policy backport gap (Fork Model) | standing gap, re-confirmed 2026-09-18 | T-20260918-004 |

## 2. Problem (evidence)

1. **P1 — date lag.** `generate-version-manifest.ts` `getGitTimestamp()`
   reads `git log -1` (committed history). dev-sync generates the manifest at
   step 4.7, commits at step 6 — so the committed manifest carries the
   pre-PR date for every file the PR touches. CI merge previews regenerate
   with the PR commit as last toucher → date columns drift by one commit
   whenever the previous toucher predates the PR's day. PR #954 first CI
   run: `✗ VERSION_MANIFEST drift: 1 differing line(s)`; recovery required
   the extra `chore(manifest): refresh Last Modified dates` commit
   (`eb6901ab`), and the local pre-push audit failed again mid-recovery until
   it landed. Date masking today covers shallow checkouts only
   (T-20260916-013); full-history comparisons compare date cells literally.
2. **P2 — integration dead-end.** origin/main gained #951–#953 while PR #954
   was open; five shared pipeline files conflicted (the §3.3 surface:
   CHANGELOG.md, memory/MEMORY.md, docs/VERSION_MANIFEST.md, agents/pm.md,
   docs/lifecycle/agents/pm.md). Concluding the merge locally is blocked on
   both sides: `git commit` → pre-commit hook (SYNC_ACTIVE required,
   dev-sync only); dev-sync → MERGE_HEAD fail-closed gate. Recovery was a
   manual rebuild: resolve → `git reset --hard origin/main` → replay the
   resolved tree from a temp copy → re-run dev-sync → `push --force-with-lease`.
3. **P3 — position pin.** `tests/unit/intentional-duplicate-parser.test.ts`
   asserts the §3 marker in `templates/common/docs/context.md` sits at an
   absolute line (421). PR #955 inserted ten documentation lines into the
   COMMON-CONTEXT block above it (now 429) → `FAIL` across ubuntu/macos/
   windows. The shift was pure documentation addition; marker identity
   (file/section/source/hash) never changed.
4. **P4 — backport gap.** ADR-0080 content reached L0 and L1 managed blocks;
   the `Projects/co-*` fleet (8 git repos as inventoried 2026-09-19; earlier
   counts of 11 predate fleet reductions) inherits managed-block content only
   via scaffold or the manual `project-resync` runbook (last: 2026-09-16, 12
   hand-written upgrade PRs). No standing obligation ties policy-class L1
   changes to a fleet sweep.

## 3. Decisions

### 3.1 P1 — mask "Last Modified" columns in full-history mode too (T-001)

`generate-version-manifest.ts --check` switches to
`diffManifests(..., { ignoreDateColumns: true })` unconditionally (drop the
shallow-only branch; keep the informational log line when masking). Structural
columns (name, file, tier, model, version, location, triggers, owner, status,
commands) remain literal. The published manifest keeps printing dates — they
stay useful for humans, just no longer gate-bearing.

Acceptance: a manifest whose only diff vs regen is date cells passes `--check`
regardless of checkout depth or day boundary; a version/path/trigger diff
still fails. Unit coverage: comparator fixture with a date-only diff.

Rejected: post-commit regen + `git commit --amend` inside dev-sync (extra
churn commit on every PR; widens the §3.3 conflict surface; amending under
the hook context is fragile).

### 3.2 P2 — early main-drift warning + sanctioned `--conclude-merge` (T-002)

- **Pre-flight drift check** (new early step): fetch origin/main; if
  `origin/main` is ahead of the branch's merge-base, print the diverged
  shared pipeline files (the §3.3 list) and a loud warning. Optional
  `--require-current-main` escalates the warning to an abort.
- **`--conclude-merge`**: with `.git/MERGE_HEAD` present and zero unresolved
  conflicts, run the identical gate battery (spec-check, typecheck, audit)
  over the resolved tree and create the merge commit through the normal
  SYNC_ACTIVE context contract. The MERGE_HEAD gate stays fail-closed for
  the default path.
- CONSTITUTION §3.3 stays the primary rule; the workflow docs gain a
  "conflicted-PR recovery" note pointing at `--conclude-merge`.

Acceptance: a scripted fixture repo exercises (i) drift warning firing on a
stale branch, (ii) conclude-merge producing a two-parent commit whose tree
passes the full battery, (iii) MERGE_HEAD gate still blocking the default
path.

Rejected: allowing bare `git commit` for merge commits (re-opens the bypass
the SYNC_ACTIVE gate closed); auto-rebase of PR branches (rewrites pushed
history silently).

### 3.3 P3 — pin marker identity, not position (T-003)

The parity test keeps: exactly 2 markers repo-wide, one per known file,
`section/source/hash/text` fidelity. It drops: the absolute `line` fields for
both files (context.md — re-pinned 421→429 this week; variant.context.template.md:
151). A lightweight sanity stays (marker line after the file's first heading).
Acceptance: inserting arbitrary documentation lines anywhere above a marker
keeps the suite green; deleting a marker or mutating source/hash still fails.

### 3.4 P4 — standing fleet-backport policy (T-004)

Policy-class L1 changes = edits inside COMMON-CONTEXT, COMMON-AGENTS, or the
pm.md WORKSPACE-MANAGED block. From ADR-0081, such changes open a fleet
backport ticket (`project-resync` / `upgrade-project` sweep across
`Projects/co-*`) in the same PR's Notes, to land within one release cycle.
First instance: backport ADR-0080 content (T-20260918-004). Longer term
(separate design, not this one): evaluate widening `upgrade-project`'s
managed-zone sync to cover COMMON-CONTEXT content directly.

## 4. Ticket wiring

| Ticket | Scope | Priority |
|--------|-------|----------|
| T-20260918-001 | manifest `--check` masks date columns unconditionally + fixture test | normal |
| T-20260918-002 | dev-sync pre-flight main-drift warning + `--conclude-merge` | normal |
| T-20260918-003 | de-position the intentional-duplicate parity pin | low |
| T-20260918-004 | fleet backport of ADR-0080 content across Projects/co-* | normal |

## 5. Validation

Docs-only landing: validate-templates (0 errors expected), lifecycle-sync
audit, skill-graph drift check, spec-check (this design + registry entry).

## 6. Files Changed

`docs/adr/0081-delivery-pipeline-hardening.md` (new), this design doc,
`docs/specs/registry.json`, `docs/templates/known-issues.json`
(ISSUE-009..012), `tickets/governance/T-20260918-001..004.yaml` (new),
`CHANGELOG.md`, `memory/2026-09-18.md` (pipeline append).
