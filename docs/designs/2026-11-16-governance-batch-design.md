# Design: governance ticket batch 2026-11-16 (T-20261114-004/-008/-009/-010, U-20261114-010/-012 doctrine)

User instruction (translate: "process all the tickets") — process the full open-ticket board.
This batch lands every implementable ticket; the rest receive precise triage
states (see §R5).

## R1 — T-20261114-008: Windows CI budgets

test-runner.ts v1.16.0: co-workspace-{migrations,shared-team-quarantine,
admin-console-r2,admin-page} join FILE_TIME_BUDGETS at the co-workspace family
budget (suite 300s / test 45s) with run-ID evidence comments — first-time
entries per the v1.6.0 convention. Registry row + lifecycle record updated.

## R2 — T-20261114-004: settings JSON_MERGE guard extension

- Arm (a) — hook-dedupe.ts v1.2.0 `dropMissingPathCommandEntries`: the
  pre-merge filter extends from hooks to command-bearing top-level keys
  (statusLine, subagentStatusLine, any {command} shape); the whole key is
  dropped when its command references a path absent from the project.
- Arm (b) — upgrade-policy.ts v1.45.0 `classifyPermissionWidenings`: template
  allow entries widening a stricter project posture are classified
  (bare-wildcard over a scoped tool, wildcard for an unlisted tool), stripped
  from the merged payload by default, and recorded as GUARD rows + a
  WARN-severity MERGE decision. Non-wildcard additions always merge; project
  entries are never removed.
- Arm (c) — the wildcard sweep finished: co-abap/co-deck/co-safety lose
  `WebFetch(*)`, `Bash(curl -sI *)`, `Bash(node dist/cli.js:*)` (9-10 → 6-7
  allows; co-architect/co-hr/co-work were already cleaned by #2035-#2037).
- upgrade-project.ts v1.107.0 wires both guards; unit pins in
  tests/unit/t004-settings-guard.test.ts.

## R3 — T-20261114-009: settings drift (validator + fleet fix)

- Fleet fix: agent-model-gate (PreToolUse/Agent) inserted into the 14 variant
  settings missing it; pm-dispatch-gate normalized to matcher Agent and
  delete-guard to Bash across all 15 (was empty matchers — every Read/Grep
  paid a bun spawn and the wiring contradicted the design doc).
- `Bash(trail:*)` joins common's allow list (decision: the trail hooks
  propagate via MANAGED_SUBSTRINGS, the permission belongs with them).
- sync-variant-settings.ts v1.5.0: MANAGED_SUBSTRINGS gains agent-model-gate.
- Validator: hook-dedupe.ts v1.3.0 arm (c) — analyzeClaudeHookDrift derives
  the governance set from the template side (scripts/hooks/<name>.ts) and
  reports missing + matcherMismatch; lifecycle-sync-audit Check I reports them
  at ERROR level. Variant-side drift is caught by sync-variant-settings
  --check (verified: seeded drift fails the check). Multi-entry hooks
  (post-write-lifecycle-check at two events) pass when the expected wiring is
  one of the local wirings.
- Acceptance not machine-verified here: the "scaffold smoke test shows an
  Agent call without a model alias triggers the ask" rides the next
  simulate-pipeline run (noted in the ticket).

## R4 — T-20261114-010: lifecycle-record seeding guard

upgrade-project.ts v1.108.0: the WORKSPACE seed branch consults
assetGate.agents for docs/lifecycle/agents/<name>.md — a record for an agent
the variant.json registry withholds is skipped with an INFO decision row
instead of seeded dangling. Already-seeded orphans are NOT auto-deleted; the
cleanup rides the T-20261112-008 wave (the ticket's own recommendation).

## R5 — U-20261114-010/-012 (co-deck) + remaining triage

- U-20261114-010 → done: snapshot.ts v1.1.0 — input resolution absolute →
  CWD → workspace (repo-level files snapshot correctly), full-failure
  rollback (no _versions dir, no VERSIONS.md entry), loud --desc truncation
  warning (VERSIONS.md keeps full text); validate-image-manifest accepts
  --project as a --workspace alias (DX unification).
- U-20261114-012 → waiting (partial): html-build SKILL v1.7.2 gains the
  Patch-Layer Convergence Doctrine (fixed-point rule, never-condition-the-
  clear-branch prohibition, idempotency pin pointer — the injector idempotency
  pin already exists at tests/inject-video-players.test.ts:84); the zen patch
  layer promotion path remains (needs its own design).
- U-20261114-009 → waiting (partial): item (2) content doctrine lands —
  storyline v1.3.1 Step 1.5 Content Doctrine + zen theme.json
  content_rules.bullet_doctrine; items (3) Humanize integration and (4)
  generator hygiene remain (project-side/engine integration, own sessions).
- U-20261114-011 → waiting: manifest chapters[] capability still open.
- T-20261114-005/-006/-007/-012 → waiting with design-scoping notes: each is
  a design-class engine/core change (upgrade-project disposition semantics,
  dev-sync commit-message plumbing, dev-sync scoped-staging contract, a new
  shadow-drift validator) that must not be rushed without its own design
  review; filed notes carry the observed failure evidence.
- T-20261102-002 (not_before 2027-01-31), T-20261110-008 (co-deck project
  repo CI), T-20261112-008 (freeze-lift wave) stay waiting — externally
  gated, by design.

## Acceptance

- audit --spec-check / validate-templates / verify-scripts / lifecycle-sync-audit
  / bun test all green.
- The four T-008 budget rows accepted by the test-runner unit gate.
- The seeded-drift acceptance for the settings validator demonstrated live.
- snapshot.ts smoke: full-failure rollback + repo-relative resolution + desc
  truncation warning verified live.
