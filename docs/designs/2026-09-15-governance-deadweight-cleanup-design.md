---
schemaVersion: 1.0.0
spec-id: governance-deadweight-cleanup
---

# Governance Deadweight Cleanup — sync-agent-status disposal + .githooks parity gate

## 1. Overview

Resolves the two deferred owner decisions from the 2026-09-15 agent metadata
sweep: (1) disposes of `scripts/sync-agent-status.ts`, a no-op tool whose
target format no longer exists, and (2) re-enables computed parity checking
for the hand-maintained `.githooks/` ↔ `templates/common/.githooks/` mirror
pair as Check G in `lifecycle-sync-audit.ts`.

## 2. Background

- `sync-agent-status.ts` (v1.0.1) rewrites `status:` fields in AGENTS.md
  roster rows. The roster tables have carried no status column since the
  roster format evolved, so the tool has no target lines (zero `status:`
  matches in AGENTS.md), is wired to no hook/CI/package.json script, and its
  concern is covered where it is real: `agent-lifecycle-audit.ts` (deprecated
  agents referenced as skill owners, archive-state consistency, orphans) and
  Check F(e) (frontmatter status ↔ lifecycle record phase). Keeping a
  registered script whose documented behavior is impossible invites
  false confidence.
- The `.githooks` parity check was suppressed in `audit.ts` (S-03, "Git Bash
  assumed on Windows") and no replacement exists — while the five hook
  wrappers are hand-maintained mirrors. Live drift was found during this
  investigation:
  - `pre-rebase`: the L1 template carries a `REBASE_BYPASS_SECRET_SCAN=1`
    escape hatch and an older scan loop that L0 does not have — a
    security-posture divergence left over from before the 2026-09-12
    regex-fallback convergence (T-20260912-021), which was applied to both
    sides on top of the already-divergent base.
  - `commit-msg`: L1 reworded the L0 echo "CONSTITUTION.md mandates..." to
    the platform-neutral "Workspace policy requires..." (correct instinct —
    projects have no CONSTITUTION.md), and L0 later gained two comment lines
    L1 lacks.

## 3. Decision

1. **Dispose of `sync-agent-status.ts`** (root + L1 mirror), remove its two
   SCRIPTS.md registry rows and purpose sections (L0 + L1), drop its entry
   from `scripts/fix-script-versions.ts`, and correct the four doc sites
   that still instruct running it: CONSTITUTION.md §9 On-Demand
   Synchronization, `docs/constitution/09-operations-workflow.md` (2 spots),
   `docs/governance/LIFECYCLE_GOVERNANCE.md` (sync-tool claim; also fixes the
   stale "templates/common/ does not host agents directly" line in the same
   section). Historical CHANGELOG/memory entries are left untouched.
2. **Check G — .githooks mirror parity** (lifecycle-sync-audit.ts
   1.11.0 → 1.12.0): for every entry in either directory, require presence
   on both sides and CRLF-normalized byte equality between
   `.githooks/<name>` and `templates/common/.githooks/<name>`. Error-level,
   detection-only, workspace-root-only. No scrub and no tolerance list in v1
   — after the remediation below there are no intentional divergences; a
   future one should use the intentional-duplicate marker mechanism instead
   of a hidden allowlist.
3. **Remediate the two live drifts** (required for Check G to pass):
   - `pre-rebase`: copy L0 → L1 (removes the bypass escape hatch from the
     project template — security-tightening; projects inherit the same
     secret-scan posture as the root).
   - `commit-msg`: unify both sides on the platform-neutral wording
     ("Workspace policy requires...") plus L0's two explanatory comment
     lines — L0 gives up the CONSTITUTION.md citation in an informational
     echo (the enforcement lives in `scripts/hooks/language-guard.ts`), and
     the template keeps its no-CONSTITUTION-references property.
4. **audit.ts S-03** comment updated to point at Check G instead of the
   suppression note (comment + patch version bump only).

## 4. Requirements / Acceptance

1. `grep -r sync-agent-status` (excluding memory/, CHANGELOG history, and
   generated README) returns no actionable instruction to run the tool.
2. With mirrors aligned, Check G passes; perturbing one template hook
   produces an error naming the file; reverting clears it.
3. `bun scripts/audit.ts` passes end-to-end with Check A/B registry parity
   intact (SCRIPTS.md ×2, L1 mirrors).

## 5. Non-goals

- Extending propagation-map.json with a `.githooks` domain (would make the
  mirrors pipeline-generated; worth considering if drift recurs — Check G
  will catch it either way).
- Changes to `sync-skill-status.ts` (alive: the skills registry carries a
  Status column).
- Backfilling project copies of the hooks (LOCKED by upgrade-policy;
  projects update via their own pipelines).

## 6. Accessibility & Preview

Backend governance tooling with no user-facing UI. ADR-0065/ADR-0070 not
applicable.
