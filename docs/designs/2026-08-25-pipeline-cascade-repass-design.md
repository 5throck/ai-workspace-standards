# Pipeline cascade re-pass design (dev-sync step 4.62)

## Problem

The `/sync` pipeline has a cascade lag bug observed on 2026-08-25:

1. Step 4.5 runs `bun scripts/propagate-to-templates.ts --apply` to publish L0→L1 (copies root `.claude/.gemini/.agents/skills` → `templates/common/.claude|...` via the claude-skills/gemini-skills/agents-skills propagation domains).
2. Step 4.6 runs `bun scripts/sync-skills.ts` to distribute SSOT `skills/` → root platform dirs `.claude/.gemini/.agents/skills`.
3. The lag: when a source skill changes, 4.5 compares **stale** platform copies (because 4.6 hasn't run yet), determines they're "in sync", and copies nothing. Then 4.6 updates the platform dirs, leaving template platform copies stale until the **next** sync.

**Observed incident**: sync SKILL.md version 1.2.1 landed in PR #694, but three template copies (`templates/common/.claude/skills/sync/SKILL.md`, `.gemini/skills/sync/SKILL.md`, `.agents/skills/sync/SKILL.md`) remained stale until a manual second `propagate-to-templates.ts --apply` pass.

## Root Cause

Cross-script ordering in the skills→platform→template chain:

- Source chain: `skills/sync/SKILL.md` → step 4.6 `sync-skills.ts` → root platform dirs (`.claude/.gemini/.agents/skills`) → step 4.5 `propagate-to-templates.ts --apply` → template platform copies (`templates/common/.claude|...`).
- Execution order: step 4.5 runs **before** step 4.6.
- Effect: step 4.5 propagates from platform dirs that haven't been updated by step 4.6 yet in the same sync.

## Decision

Add a new step 4.62 **after** step 4.6 that unconditionally re-runs `propagate-to-templates.ts --apply`. This second pass heals template platform copies changed by step 4.6 within the same sync.

**Why unconditional**: The `applyDiffs()` function in propagate-to-templates.ts labels in-sync mirrors as `scrubbed` when their raw source mentions CONSTITUTION.md, and these scrubbed rewrites are counted in the `copied` total. A converged second pass may still print `Done. N file(s) copied.` with N≥1 (scrubbed rewrites), so the copied counter is **not** a convergence signal. The terminal output distinguishes:
- `Nothing to apply — all files in sync.` (when `outOfSync==0 && needsScrubInSync==0`)
- `Done. N file(s) copied.` (when any copies occurred, including scrubbed rewrites)

**Gating**: Mirror step 4.5's gating exactly:
- Workspace-root guard (`isWorkspaceRoot` = `templates/common` exists + `scripts/propagation-map.json` exists).
- L0-fatal / L1-warn split (fatal only when `CONSTITUTION.md` present, else non-fatal).
- propagate-to-templates.ts is L0-only (no propagation domain covers scripts), so the gating is necessary for L1 contexts.

**Full re-pass**: No `--domain` flag (single-valued). The invocation is byte-identical to step 4.5's:
```bash
bun scripts/propagate-to-templates.ts --apply
```

## Rejected Alternatives

### Reorder step 4.6 before 4.5
- **Rejected**: Step renumbering churn across just-landed docs (SKILL.md pipeline table, AGENTS.md, sync skill itself, VERSION_MANIFEST.md auto-numbering).
- **Why not**: The ordering is cross-step; 4.5 is a generic L0→L1 publish step that should precede the more specific 4.6 skill sync.

### Fixpoint inside propagate-to-templates.ts
- **Rejected**: Impossible — propagate-to-templates.ts sources never change mid-run. The lag is across **scripts**, not within a single script.
- **Why not**: propagate reads from the filesystem; it has no mechanism to "wait" for sync-skills.ts to finish and re-read.

### Conditional gating based on copied counter
- **Rejected**: The copied counter counts idempotent scrub rewrites, so "0 copied" is not a converged signal.
- **Why not**: See "Why unconditional" above — a converged tree may still print `Done. N file(s) copied.` with N≥1.

## Idempotence & Safety

- **Directional transforms**: propagate-to-templates.ts applies diffs in one direction (root → templates). A second pass converges and copies nothing (except byte-identical scrub rewrites).
- **Scrub rewrites byte-identical**: When `applyDiffs()` labels a mirror `scrubbed`, it rewrites the target with the same content it already had (minus the CONSTITUTION.md reference that the L1 scrub transform removed). The file is byte-identical before and after.
- **Check X coverage**: propagate-to-templates.ts is an L0-only script with no platform propagation domain. The existing `scripts/lifecycle-sync-audit.ts` whitelist entry for `dev-sync:propagate-to-templates` (INTENTIONAL_CROSS_REFS) already covers this second reference — both are presence-based checks, not file-content checks.

## Verification

Results recorded 2026-08-25 (PR #697 landing):

1. **Unit tests**: `tests/unit/dev-sync-pipeline-order.test.ts` 3/3 + `tests/propagate-to-templates.test.ts` 5/5 — 8/8 pass (32 expect calls).
2. **Integration test**: convergence test passed — consecutive `--apply` passes, pass 2 exit 0 with zero per-file `copied` lines.
3. **Verify-scripts**: 161 registered, 0 hard warnings (dev-sync 1.7.6 counted on both SCRIPTS.md tiers).
4. **Lifecycle-sync-audit**: all-pass, no new Check X findings (the second `propagate-to-templates.ts` reference in the dev-sync L1 mirror is covered by the existing presence-based whitelist entry; 8 warnings all pre-existing).
5. **Audit**: `bun scripts/audit.ts` all-pass.
6. **Landing sync (dogfood)**: the PR #697 landing `/sync` executed the new code from the working tree — the three template platform copies that entered the sync at 1.2.1 (`templates/common/.claude|.gemini|.agents/skills/sync/SKILL.md`) were healed to 1.2.2 **in the same commit**, proving the cascade closed in one sync.
7. **PR diff**: 8/8 sync SKILL.md copies present in PR #697 (1 source + 3 root platform via step 4.6 + 4 template: `templates/common/skills` via 4.5, 3 platform copies via 4.62); post-merge `propagate --dry-run` reports 0 drift.

## References

- ADR-0055 Stage 2 spec-relevance enforcement
- ADR-0062 marker propagation engine design (propagate-to-templates.ts domains)
- docs/designs/2026-08-24-marker-propagation-engine-design.md
- scripts/propagate-to-templates.ts (applyDiffs ~line 688-693)
- scripts/sync-skills.ts
- scripts/dev-sync.ts (step 4.5, 4.6, 4.62)
