# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Exclusion of unnecessary governance scripts from L2 scaffolding
**Participants**: architect, automation-engineer, auditor
**Rounds**: 1
**Language**: English
**Status**: Complete

---

## Transcript

**PM (Facilitator)**:
Welcome back, team. Our next agenda item follows logically from our previous discussions on boundary enforcement. The user correctly pointed out that during the scaffolding of a new project (L2), many unnecessary scripts are still being copied over. A quick look reveals that scripts like `publish-to-template.ts`, `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, and others are being copied from `templates/common/scripts/` into the new project. Architect, how should we restructure our script classifications to prevent this?

**architect**:
The root cause is a misclassification in our `SCRIPTS.md` registry. Currently, many scripts are marked as `common`, meaning they are actively synced by `publish-to-template.ts` into the `templates/common/scripts/` directory. Since the `new-project` scripts simply perform a wholesale copy of `templates/common/scripts/` to instantiate the new L2 project, all these `common` scripts end up in the leaf projects.
The architectural fix is straightforward: scripts that only govern the template repository itself (L0/L1) must be reclassified as `L0-only` in `SCRIPTS.md`. By doing so, `publish-to-template.ts` will stop copying them to `templates/common/scripts/`, and consequently, they will never reach the L2 generated projects. Only universally applicable pipeline scripts (like `dev-sync.ts`, `audit.ts`, `sync-md.ts`, etc.) should remain as `common`.

**automation-engineer**:
I completely agree. The solution is extremely clean because we already added the `L0-only` exclusion logic to `publish-to-template.ts` earlier today. We don't even need to modify the scaffolding scripts for this part.
What we need to do is:
1. Update `scripts/SCRIPTS.md` to reclassify governance scripts from `common` to `L0-only`. This includes scripts like `publish-to-template.ts`, `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, `generate-version-manifest.ts`, `list-template-versions.ts`, `qa-gate.ts`, and other template-specific or registry-specific validators.
2. Clean up `templates/common/scripts/` by deleting these files so they no longer propagate.

**auditor**: (Synthesis)
I have reviewed the architectural diagnosis and the proposed remediation.

**Points of Agreement**:
- Unnecessary governance scripts are leaking into L2 projects because they are misclassified as `common` rather than `L0-only`.
- Reclassifying them in `SCRIPTS.md` leverages our existing sync logic to elegantly prevent them from entering `templates/common/scripts/`, and thus, L2 projects.

**Open Disagreements**:
- None. This is the optimal structural solution.

**Next Action Items**:
1. Review and update `scripts/SCRIPTS.md` to change the layer column from `common` to `L0-only` for all scripts that strictly serve workspace root governance. (Owner: automation-engineer)
2. Remove the orphaned scripts from `templates/common/scripts/`. (Owner: automation-engineer)
3. Run `bun scripts/publish-to-template.ts` to verify the cleanup. (Owner: lifecycle-manager)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Reclassify root scripts to `L0-only` in `SCRIPTS.md` | 4 - Execution |
| A-02 | automation-engineer | Low | Delete reclassified scripts from `templates/common/scripts/` | 4 - Execution |
| A-03 | lifecycle-manager | Medium | Sync templates and verify cleanup | 5 - Lifecycle |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | L2 projects only receive runtime/ops scripts | Scaffold a project and verify `scripts/` contents |
| 2 | `SCRIPTS.md` layer definitions are strictly enforced | Run `bun scripts/validate-templates.ts` |
