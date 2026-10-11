---
name: model-migration
status: active
scope: workspace
l2_propagate: false
description: >
  Changes a registry model ID across the workspace in one guided pass: edit the
  SSOT (docs/workspace-schema.json models.*), sweep the sanctioned prose surfaces
  with sync-model-registry.ts, and verify. Use when: a model is bumped or renamed
  ("change model", "model bump"), a tier mapping moves to a new model ID, or a
  model migration needs to reach every sanctioned surface.
owner: lifecycle-manager
version: 1.0.0
last_reviewed: 2026-10-11
prerequisites: []
metadata:
  type: process
  triggers:
    - model-migration
    - change model
    - model bump
    - "`모델 변경`"
---

## Context

Registry model IDs are registered ONLY in `docs/workspace-schema.json` (`models.<platform>.<tier>`) and narrated ONLY in the CLAUDE.md §6 prose and the AGENTS.md §3.6 tier-model-mapping managed block. Literal model IDs are forbidden in skills — skill-lifecycle-audit Check MM fails any skill tree containing a versioned model-ID literal, so skill documents carry registry pointers (`docs/workspace-schema.json → models.claude.high`) or tier aliases (`opus` / `sonnet` / `haiku`) instead. Historical records (CHANGELOG.md, docs/adr/**, docs/designs/**, docs/lifecycle/**, registry history columns) deliberately keep the IDs that were current when they were written — the sweep never touches them.

## Execution Steps

1. Edit `docs/workspace-schema.json` — set `models.<platform>.<tier>` to the new registry ID. Caution: the sweep in step 2 refuses to run when `--from` is no longer registered anywhere under `models.*` (stale-sweep guard), so if your edit removes the old ID's last registration, run step 2 before saving this one.
2. Run `bun scripts/sync-model-registry.ts --from <old-id> --to <new-id>`. It validates `--to` against the schema, sweeps the curated sanctioned prose surfaces (instruction twins, AGENTS.md rosters, constitution, common and variant docs, and the `tests/unit/managed-block-parity.test.ts` tier-list expectation), prints a per-file replaced-count table, and FAILS if any skills tree still contains a model-ID literal (Check MM pattern set).
3. Verify: `bun scripts/validate-model-registry.ts` (agent frontmatter + tier prose vs registry) and `bun test tests/unit/managed-block-parity.test.ts` (managed-block tier-list parity). Both must pass before anything is committed.
4. Record the change per ADR-0074: design doc at `docs/designs/<spec-id>-design.md`, then `bun scripts/spec-register.ts --file <design-doc> --source manual --status implemented`, plus a CHANGELOG.md entry naming the old and new IDs.
5. Run `/sync` — the L0→L1 propagation publishes the edited twins, rosters, and registry to `templates/common`, and the platform mirrors follow.

## Related

- `scripts/sync-model-registry.ts` — the sweep tool (curated `SURFACES` list lives there)
- `scripts/validate-model-registry.ts` — post-sweep verification
- `scripts/lib/model-literal-patterns.ts` — shared model-ID detection patterns
- skill-lifecycle-audit Check MM — the skills-tree literal ban that keeps this migration necessary
- `docs/workspace-schema.json` — the registry SSOT (`models.*`)
