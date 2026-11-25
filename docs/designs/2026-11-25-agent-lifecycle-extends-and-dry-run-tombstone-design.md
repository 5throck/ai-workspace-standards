# Design: agent lifecycle extends-resolution + dry-run tombstone preview

- **Spec id**: 2026-11-25-agent-lifecycle-extends-and-dry-run-tombstone
- **Date**: 2026-11-25
- **Tickets**: T-20261125-002, T-20261125-003 (remedy carrier for T-20261126-002)
- **Status**: implemented (this document; landed with the fix commits)

## 1. Problem statements

### 1.1 T-20261125-002 — the `lifecycle` gap

`scripts/validate-agents.ts` (then 1.4.1) checked every `agents/*.md` for
`lifecycle.phase` / `lifecycle.governance` standalone. ADR-0033 extends stubs —
every variant's `templates/*/agents/pm.md` and `templates/*/agents/i18n-specialist.md` —
carry no `lifecycle` block, so any standalone scan of a template tree reported
`pm: Missing frontmatter fields: lifecycle.phase, lifecycle.governance`
(reproduced against pristine HEAD copies of `templates/co-security/agents/`).
Root CI never saw it: the script scans `<cwd>/agents` only and never visits
`templates/`. Delivered project copies pass — the scaffold resolves the chain and
writes self-contained bodies (`Projects/co-security/agents/pm.md` v1.0.0 carries its
own block; the HEAD validator exits 0 there).

### 1.2 T-20261125-003 — dry-run tombstone fidelity

Reported: a co-deck `--dry-run` showed no tombstone row while the apply run refused
on `.mcp.json`, and `--tombstone` / `--clear-tombstone` were refused under
`--dry-run` outright. Verified at HEAD: the dry-run row already fires
(`tombstoneSkip()` runs unconditionally in every absent-copy branch; only the
manifest write is apply-gated) — the fidelity half did not reproduce. The real gap
was the flag refusal: a reviewer holding the dry-run's
`confirm with --tombstone <path>` line could not verify a grant glob without
spending an apply run.

## 2. Decisions

### D1 — resolution, not duplication (T-002)

`validate-agents.ts` 1.4.2 resolves the `extends:` chain before the lifecycle check:
`frontmatterFieldPaths()` (dotted-path set from frontmatter, block-scalar aware,
list-item safe) + `resolveFrontmatterFields()` (chain walk, depth-capped at 5,
cycle-safe via a visited set). A base absent from the current checkout contributes
nothing and the failure message names the unresolvable target — a project-cwd stub
still fails, with a reason.

Rejected alternative: adding `lifecycle:` blocks to the stubs. `audit.ts`
`checkPmConsistency` enforces `lifecycle:` as an L0-only field for L1/L2 pm.md
(`variantsAllowingLifecycle = {co-safety}` — the documented exception for variants
whose nested agent trees are full definitions); the attempted block addition failed
the audit (`L1 pm.md: contains L0-only field "lifecycle:"`) and was reverted. The
stub-as-delta doctrine stands; inheritance is the fix.

`agentBodyCompleteness` now skips extends stubs without depending on the L0-only
schema validator being importable (in a delivered project `validators/` is absent,
so stubs were failed for stub quality while L0 skipped them — the same tier
asymmetry class).

Fleet carrier: frontmatter-only version bumps on all 16
`templates/{common,co-*}/agents/pm.md` (common 1.4.4 → 1.4.5, variants patch+1,
`last_updated` 2026-11-25) plus the `common-contract.json` parity bump (C-CM-03a).
These give the next upgrade wave a concrete version-gated reason to deliver pm.md
everywhere, clearing the T-20261126-002 stale rows (four wall-exception merges each
verify with exactly one stale row: `agents/pm.md` behind template).

### D2 — previewable tombstone grants; persistence stays apply-only (T-003)

`upgrade-project.ts` 1.121.0: under `--dry-run` the flags are accepted as a
READ-ONLY PREVIEW. `tombstoneSkip()` reports the would-be outcome
(`🪦 TOMBSTONE (would be recorded): <rel>`, naming the matching grant) and writes
nothing — the manifest write stays inside the apply-only block, so a preview cannot
persist an entry or a clearing. New grant-coverage WARN: a `--tombstone` glob that
matched no candidate, and a `--clear-tombstone` glob matching no recorded
tombstone/baseline, are named before the summary (that typo class previously cost a
full apply run and refused again with no diagnostic).

The flags KEEP their apply-only persistence semantics: recording/clearing intent is
a manifest mutation, not previewable state; only the refusal became a preview.

## 3. Acceptance criteria

- AC1: standalone scan of any `templates/*/` checkout passes Part 1 (chain-resolved
  lifecycle) — the exact surface that failed.
- AC2: a project-cwd stub with an unresolvable `extends` still fails, naming the
  target (no silent pass).
- AC3: `bun scripts/audit.ts` passes — the L0-only pm.md doctrine intact
  (co-safety sole exception, pinned by test).
- AC4: dry-run emits the TOMBSTONED row (ERROR) with resolution text and persists
  nothing (byte-identical manifest).
- AC5: `--dry-run --tombstone <matching-glob>` previews the grant, exits 0 when the
  tombstone was the only ERROR, persists nothing.
- AC6: an unmatched grant glob WARNs by name; the refusal stands (exit 1).
- AC7: apply unchanged — refuses without the flag; with `--tombstone` records the
  entry (hash, templateVersion, recordedAt, reason) and exits 0.

## 4. Tests

- `tests/unit/agent-lifecycle-extends-inheritance.test.ts` (10 cases): parser forms,
  chain inheritance, two-level chain, project-cwd unresolvable target, cycle
  termination, template-wide resolution sweep, doctrine pin (stubs stay
  lifecycle-free except co-safety).
- `tests/unit/upgrade-dry-run-tombstone.test.ts` (5 engine runs): AC4–AC7 on
  fixture projects with seeded prior-delivery manifests.
- `tests/unit/upgrade-decision-log.test.ts`: the old refusal expectation flipped to
  the preview contract (ordered before the mutating-grant rider on the shared
  fixture dir).

## 5. Evidence

`docs/reports/2026-11-25-machinery-batch-evidence.md` § "Follow-ups:
T-20261125-002 and T-20261125-003" — commands, exits, canaries (co-deck tombstone
row present; co-safety/co-architect none), and the reproduction record for both
tickets' original claims.
