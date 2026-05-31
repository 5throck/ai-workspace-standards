# Meeting Transcript
**Date**: 2026-05-31
**Topic**: lifecycle-sync-audit.ts Check B Defect Analysis and Check X Design (2nd Meeting)
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Series**: Second template script missing meeting (resolves open question from meeting-2026-05-31-template-script-missing.md)

---

## Unresolved Question from 1st Meeting

Whether `lifecycle-sync-audit.ts` Check B checks file existence or only version numbers — suspected to check version numbers only.

## Pre-Meeting Evidence

`lifecycle-sync-audit.ts` line 260:
```typescript
if (!templateRegistry.has(filename)) continue;  // silent skip
```
Check B iterates root SCRIPTS.md entries and silently skips any script not present in templates/common SCRIPTS.md — regardless of whether the script should be there. Confirmed: Check B only validates version consistency for scripts that appear in BOTH registries. L1 scripts registered in root but absent from templates/common are silently ignored.

---

## Transcript

**[Architect]**: (Round 1)

Code confirmed: Check B line 260 `continue` silently skips scripts missing from templateRegistry. This conflates two valid cases: (1) L0-only scripts — correct to skip; (2) L1/common scripts — should ERROR if missing. Two layers to fix: Check B itself (add layer-aware branching), and Check X (new, for L0-only reference detection). Both belong in lifecycle-sync-audit.ts. Asked auditor how to fix the `continue` logic.

**[Auditor]**: (Round 1)

Fix: read layer column from SCRIPTS.md and branch on it. L0-only → continue (legitimate skip). L1/common → if !templateRegistry.has(filename), push ERROR. This exactly catches verify-readme-sync.ts case. Asked automation-engineer about effort to extend parseScriptsMdRegistry() to return layer information.

**[Automation Engineer]**: (Round 1)

parseScriptsMdRegistry() extension is straightforward — change return type from Map<string,string> to Map<string, {version, layer}>. SCRIPTS.md table already has the layer column. Check X scan patterns for L0-only reference detection: `bun (run )?scripts/<name>(\.ts)?`, `import .* from ['"].*<name>['"]`, `require\(['"].*<name>['"]\)` across all templates/common/scripts/*.ts files. A-02 (SCRIPTS.md reclassification) is a hard prerequisite for A-03 — without defined layer values, the parser branch logic has nothing to read. Asked lifecycle-manager about A-02 scope and complexity.

**[Lifecycle Manager]**: (Round 1)

A-02 scope: 3 "intentional" entries (audit.ts, dev-sync.ts, sync-md.ts) need reclassification, plus all other scripts with L0/L1/blank values need migration to new enum. Auto-classification approach: check each SCRIPTS.md entry against templates/common/scripts/ — if file exists → `common`, if not → `L0-only`. Exception: L1-only scripts (should be in templates/common but not in workspace root) must be identified manually. A-02 must run after A-01 (hotfix) so verify-readme-sync.ts is present before reclassification.

**[Architect]**: (Round 2)

Finalized execution order: A-01 (hotfix, no dependency) → A-02 (requires A-01) → A-03 (requires A-02). A-04 can run in parallel with A-02/A-03. A-05 absorbed into A-03 — Check B file existence check and Check X are in the same modification scope. Decision confirmed by all.

**[Automation Engineer]**: (Round 2)

A-03 implementation scope finalized: (1) parseScriptsMdRegistry() → returns {version, layer}; (2) Check B: L0-only skip preserved, L1/common absent from templates/common SCRIPTS.md → ERROR; (3) Check B addition: L1/common absent from templates/common as actual file → ERROR; (4) Check X new: grep L0-only script names in templates/common/scripts/*.ts, reference found → ERROR. All in one PR. SCRIPTS.md version bumps + new entries included.

---

## Resolved Answer

**Check B is confirmed to check version numbers only, not file existence.** The `continue` at line 260 silently skips scripts missing from templateRegistry without regard to whether they should be present. This is a structural defect, now with a clear fix.

## Execution Order

```
A-01 (hotfix) ──→ A-02 (layer reclassification) ──→ A-03 (Check B fix + Check X)
     └──────────────────────────────────────────────→ A-04 (smoke test, parallel)
```

**A-05 absorbed into A-03** — no longer a separate item.

## Final Action Items (Both Meetings Combined)

| # | Owner | Tier | Deliverable | Prerequisite |
|---|-------|------|-------------|-------------|
| A-01 | automation-engineer | High | Copy `sync-md.ts` + `verify-readme-sync.ts` to `templates/common/scripts/`; add version entries to both SCRIPTS.md files | None (immediate) |
| A-02 | lifecycle-manager | Medium | Reclassify SCRIPTS.md layer column: remove `intentional`, replace all values with `common`/`L0-only`/`L1-only`; add column definition header | After A-01 |
| A-03 | automation-engineer | Medium | `lifecycle-sync-audit.ts`: extend parseScriptsMdRegistry + Check B layer branching + Check B file existence check + Check X (L0-only reference scan) | After A-02 |
| A-04 | automation-engineer | Low | `test-new-project.ts` smoke test: verify dev-sync.ts runs successfully in new project | After A-01 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | New project `/sync` completes without error | Create new project, run dev-sync.ts |
| C-02 | Check B: L1/common script missing from templates/common → ERROR | Remove verify-readme-sync.ts, run audit |
| C-03 | Check X: L0-only script referenced in templates/common file → ERROR | Intentional violation test |
| C-04 | SCRIPTS.md `intentional` column fully removed, replaced with new layer values | grep `intentional` returns no table entries |
| C-05 | `bun scripts/audit.ts` passes | Run audit |
