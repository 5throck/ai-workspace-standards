# COMMON-HERMES Managed-Block Marker Design (Hermes.md MERGE Delivery Activation)

- **Date**: 2026-09-27
- **Status**: Implemented (2026-09-27 — pattern + tests delivered; fleet re-upgrade is the rollout)
- **Owner**: Automation Engineer
- **Spec id**: `2026-09-27-hermes-merge-marker-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related ADRs**: ADR-0093 (Hermes.md at L0/L1/L2), ADR-0074 (Universal Design Gate)
- **Related specs**: `2026-09-25-codex-merge-claim-routing-design` (the COMMON-CODEX twin of this change, T-20260924-010 D1)

---

## 1. Summary

Add the `COMMON-HERMES` pattern to `MANAGED_PATTERNS` in `scripts/lib/managed-block-merge.ts` (v1.2.0 → v1.3.0). ADR-0093 shipped `Hermes.md` to L0 and L1 (`templates/common/Hermes.md` + every `templates/co-*/Hermes.md`) with `COMMON-HERMES:START/END` zones, but existing L2 projects never receive the file: the MERGE pass claims it (`MERGE_MANAGED_FILES` already lists `Hermes.md`, upgrade-policy v1.18.0) and then skips it with `INFO: Template has no managed markers — skipping Hermes.md` because the pattern table lacks the entry. The pattern is the last missing piece; the engine is pattern-generic and needs no change. This is byte-for-byte the COMMON-CODEX precedent (T-20260924-010 D1) applied to the Hermes member of the instruction-file family.

## 2. Background

Observed during the 2026-09-27 post-v0.7.0 fleet upgrade of all 12 `Projects/co-*` projects: every project's upgrade log contains

```
MERGE: Hermes.md
  INFO: Template has no managed markers — skipping Hermes.md
```

Site inventory (verified on `main` at the time of the fleet upgrade):

| # | Site | State before this design |
|---|------|--------------------------|
| 1 | `scripts/lib/managed-block-merge.ts` (`MANAGED_PATTERNS`) | Eight patterns: WORKSPACE-MANAGED, COMMON-CLAUDE, COMMON-GEMINI, COMMON-CODEX, VARIANT-INJECT, COMMON-AGENTS, COMMON-CONTEXT, DYNAMIC_SKILLS. No COMMON-HERMES. |
| 2 | `scripts/lib/upgrade-policy.ts` (`MERGE_MANAGED_FILES`) | Already lists `Hermes.md` — the claim half is live. |
| 3 | `templates/common/Hermes.md:24/:76` and every `templates/co-*/Hermes.md` | `<!-- COMMON-HERMES:START -->` … `<!-- COMMON-HERMES:END -->` — one zone per file. |
| 4 | Project side | `Hermes.md` absent in all 12 L2 projects (they were last upgraded before ADR-0093 landed; the post-ADR upgrade could not deliver it). |

Consequence for the merge path in `scripts/upgrade-project.ts` `mergeWorkspaceManaged()`: `buildMergedTemplateBlocks(tplContent, commonContent)` returns an empty block list → early return with the INFO skip → the `!existsSync(projectFile)` create branch (which copies the template file for a not-yet-existing project copy) is never reached.

## 3. Decisions

- **D1 — Pattern addition (the fix)**: `{ open: /<!-- COMMON-HERMES:START -->/, close: '<!-- COMMON-HERMES:END -->', label: 'COMMON-HERMES' }`, placed after its COMMON-CODEX platform twin. COMMON-HERMES zones are key-less: they take the existing positional path with byte-identical semantics to COMMON-CLAUDE/GEMINI/CODEX. No engine change.
- **D2 — Delivery shape for absent project copies**: unchanged, by design. Once the pattern exists, a template with one COMMON-HERMES zone produces a non-empty merged block list; for a project without `Hermes.md` the existing create branch (`INFO: Project file does not exist, will create with template content` → `copyFileSync(templateFile, projectFile)`) delivers the full template file. The marker lines ride along inside the file, same as CLAUDE.md/GEMINI.md/CODEX.md first delivery.
- **D3 — Docs parity**: the `upgrade-project` skill's "Supported Managed Block Markers" table gains both the missing COMMON-CODEX row and the new COMMON-HERMES row; `scripts/SCRIPTS.md` carries the v1.3.0 entry.
- **D4 — Version**: `managed-block-merge.ts` 1.2.0 → 1.3.0 (header history comment follows the v1.2.0 precedent).

## 4. What is intentionally NOT in scope

- No change to the merge engine, keyed-block semantics, or reconcile spans.
- No L1 propagation of the lib: `scripts/lib/managed-block-merge.ts` is L0-only (it serves only the L0-only upgrader; confirmed absent from `templates/common/scripts/lib/`).
- No re-stamp of `templates/VERSION` (stays 0.7.0; the fleet re-upgrade delivers template-tree content, and the next auto-release folds the version bump).

## 5. Test Plan

- `tests/unit/managed-block-merge.test.ts`: new `COMMON-HERMES zone (Hermes.md delivery)` describe block mirroring the COMMON-CODEX cases — positional merge with byte-identical outside prose, zone append for a project copy lacking the zone (the pre-fix INFO-skip shape), and count-mismatch reconcile with snapshot.
- `bun test tests/unit/managed-block-merge.test.ts` green.
- Root `bun scripts/audit.ts` green (Check A version parity, typecheck baseline).
- Rollout verification: `bun scripts/upgrade-project.ts <project> --dry-run` on one variant project and one common-only project (co-consult, co-architect) shows `MERGE: Hermes.md` → create/deliver instead of the INFO skip; then the full 12-project apply, assert `Hermes.md` present in every project.

## 6. Rollout

1. Merge this change at L0.
2. Re-run `bun scripts/upgrade-project.ts Projects/<p>` for all 12 `co-*` projects.
3. `/sync` each project (PR) and merge.
