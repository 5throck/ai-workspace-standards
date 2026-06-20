---
adr: "0032"
title: "Layer Governance Framework for Scripts and Skills"
date: 2026-06-06
status: "Accepted"
deciders: ["architect", "lifecycle-manager", "automation-engineer"]
---

# ADR-0032: Layer Governance Framework for Scripts and Skills

**Status**: Accepted
**Date**: 2026-06-06
**Deciders**: architect, lifecycle-manager, automation-engineer
**Related**: ADR-0031 (L1–L2 Fork Model), ADR-0001 (Scripts Type Column)

---

## 1. Context

### Background

The workspace uses a 3-tier layer model (L0 → L1 → L2) to separate workspace-root concerns from shared template infrastructure and variant-specific customizations. However, prior to this ADR, the governing rules for which scripts and skills belong at which layer were informal and inconsistent.

`SCRIPTS.md` used `L0-only` and `common` as Layer values with no formal definition. This ambiguity caused the following six structural defects, all discovered during the full project review leading to PR #231:

### Six Structural Defects

**Defect 1 — Undefined Layer semantics.**
`SCRIPTS.md` used `L0-only` and `common` without a written specification of what each meant structurally or operationally. There was no decision tree to classify new entries.

**Defect 2 — Dual-mode scripts misclassified as L0-only.**
`audit.ts`, `dev-sync.ts`, `dispatch-parallel.ts`, `dispatch-serial.ts`, and `qa-gate.ts` each contain built-in L0/L2 context detection (`detectProjectContext()`). They are designed to run meaningfully inside an L2 project directory. Despite this, all were classified `L0-only`, which caused them to be excluded from `templates/common/scripts/` and absent from scaffolded L2 projects.

**Defect 3 — Pipeline internals incorrectly placed in templates/common/.**
`helpers/*.ts` files are internal dependencies imported only by L0 pipeline scripts (e.g., `publish-to-template.ts`, `create-l2-scaffold.ts`). They have no standalone meaning inside an L2 project. Despite this, they were copied into `templates/common/scripts/helpers/` and subsequently scaffolded into every L2 project, creating unnecessary noise and a potential attack surface.

**Defect 4 — 37 identical duplicates in templates/co-\*/ scripts/.**
Because `templates/common/scripts/` did not contain the correct set of L0+L1 scripts, maintainers manually duplicated scripts into each `templates/co-*/scripts/` directory. This created 37 identical files across variants. When L0 scripts were updated, the duplicates were not updated, producing four confirmed regression bugs where old script versions in `templates/co-*/` overwrote newer versions during overlay operations.

**Defect 5 — No SKILLS.md equivalent registry.**
`SCRIPTS.md` provides a machine-readable registry for scripts, but no equivalent registry existed for skills. Skills existed only as individual `SKILL.md` files scattered across `skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`, and variant directories. Tools such as `publish-to-template.ts` and `skill-lifecycle-audit.ts` had no single source of truth to read from and instead used fragile filesystem scans.

**Defect 6 — Dual conflicting exclusion mechanisms in new-project.sh.**
`new-project.sh` had two separate hardcoded exclusion lists for controlling which files were copied from `templates/common/` during project creation. These lists were maintained independently, drifted from `SCRIPTS.md`, and were not checked during audits, resulting in undocumented and unverified exclusion behavior.

---

## 2. Decision — Layer 3-Tier Model

The workspace formally adopts the following three-layer classification for all scripts and skills.

### Layer Definitions

```
L0          — Workspace root only.
              NOT copied to templates/common/.
              NOT scaffolded into L2 projects.
              Scripts that manipulate templates/, SCRIPTS.md, or other L2 project
              directories. Also internal pipeline dependencies (helpers/*.ts).

L0+L1       — Exists at workspace root AND in templates/common/.
              Scaffolded identically into ALL L2 projects.
              NOT variant-specific — the same file applies to every variant.
              templates/co-*/ does NOT contain these files (they come from common/).

L0+L1+L2   — Exists at workspace root AND in templates/common/ (base version).
              templates/co-*/ contains a variant-specific override.
              Scaffold applies templates/common/ first, then templates/co-*/ overlay.
              Use only when the variant genuinely needs a different version.
```

### Structural Rules

| Directory | Permitted Layer | Notes |
|-----------|----------------|-------|
| `scripts/` (root) | L0, L0+L1, L0+L1+L2 | Canonical source for all scripts |
| `templates/common/scripts/` | L0+L1, L0+L1+L2 (base) | L0 scripts must NOT appear here |
| `templates/co-*/scripts/` | L0+L1+L2 (variant override) only | Currently empty — no scripts have variant-specific versions |
| `skills/` (root) | L0, L0+L1, L0+L1+L2 | Canonical source for all skills |
| `templates/common/skills/` | L0+L1, L0+L1+L2 (base) | L0 skills must NOT appear here |
| `templates/co-*/skills/` | L0+L1+L2 (variant override) only | Used for variant-domain-specific skills |

**Invariant**: A file with Layer `L0+L1` must exist identically in both `scripts/` and `templates/common/scripts/`. Any divergence is a defect caught by `validate-templates.ts`.

**Invariant**: A file with Layer `L0` must NOT appear in `templates/common/` or any `templates/co-*/` directory.

---

## 3. Decision Tree

Use the following decision tree to classify any new script or skill before adding it to SCRIPTS.md or SKILLS.md.

```
Q1. Does this file directly manipulate templates/ directories, SCRIPTS.md,
    or other workspace-layer governance artifacts?
    YES → L0

Q2. Is this file an internal dependency (imported module) of an L0-only script,
    rather than a standalone executable?
    YES → L0

Q3. Does this file have meaningful standalone behavior when run INSIDE
    an L2 project directory?
    NO  → L0
    YES → continue to Q4

Q4. Is the behavior identical across all variants (no variant-specific version needed)?
    YES → L0+L1
    NO  → L0+L1+L2
```

**Notes on Q3**: "Meaningful standalone behavior" means the script or skill operates correctly on L2 project content without requiring access to workspace-root files. Context-detection code (e.g., `detectProjectContext()`) that enables this is a positive signal for L0+L1.

**Notes on Q4**: The bar for L0+L1+L2 is a genuine variant-specific behavioral difference, not cosmetic variation. When in doubt, prefer L0+L1 and promote to L0+L1+L2 if a concrete variant need arises.

---

## 4. Layer Governance Process

### Enforcement Points

1. **New SCRIPTS.md entry**: lifecycle-manager reviews and approves the Layer value before merge. PRs that add a script without a Layer value are blocked at the pre-commit hook.

2. **New SKILLS.md entry**: lifecycle-manager reviews and approves the Layer value before merge. PRs that add a skill without a Layer value are blocked at the pre-commit hook.

3. **Layer reclassification**: Requires architect sign-off in addition to lifecycle-manager. The change must be accompanied by a migration plan (moving or removing files from the affected directories).

4. **validate-templates.ts** runs in CI and locally via `bun scripts/audit.ts`. It enforces:
   - All files in `templates/common/scripts/` have Layer `L0+L1` or `L0+L1+L2` in SCRIPTS.md.
   - No files in `templates/common/scripts/` have Layer `L0` in SCRIPTS.md.
   - All files in `templates/co-*/scripts/` have Layer `L0+L1+L2` in SCRIPTS.md.

### Required SCRIPTS.md Fields

Every entry in `SCRIPTS.md` MUST include all of the following columns. Missing any field blocks the PR:

| Field | Description |
|-------|-------------|
| `script` | Filename (relative to `scripts/`) |
| `version` | Semver (must match `@version` in file header) |
| `status` | `active` / `deprecated` / `removed` |
| `layer` | `L0` / `L0+L1` / `L0+L1+L2` |
| `owner` | Responsible agent role |
| `last_reviewed` | ISO date |
| `notes` | Brief description |

---

## 5. SKILLS.md Design

### Location

`skills/SKILLS.md` — workspace root, adjacent to the `skills/` directory.

### Schema

```
| skill | version | status | layer | owner | last_reviewed | removal-date | notes |
```

| Column | Description |
|--------|-------------|
| `skill` | Directory name under `skills/` (e.g., `meeting-facilitation`) |
| `version` | Semver (must match `version` field in `SKILL.md` frontmatter) |
| `status` | `active` / `beta` / `deprecated` / `removed` |
| `layer` | `L0` / `L0+L1` / `L0+L1+L2` |
| `owner` | Responsible agent role |
| `last_reviewed` | ISO date |
| `removal-date` | ISO date or `-` |
| `notes` | Brief description |

### Layer Values for Skills

| Layer | Meaning |
|-------|---------|
| `L0` | Workspace-root skill only. Not templated or scaffolded. |
| `L0+L1` | Scaffolded identically into all L2 projects. |
| `L0+L1+L2` | Variant-specific override exists in `templates/co-*/skills/`. |

### SSOT Role

`skills/SKILLS.md` is the single source of truth for skill lifecycle management. The following tools read it exclusively rather than performing filesystem scans:

- `publish-to-template.ts` — uses SKILLS.md to determine which skills to copy to `templates/common/skills/`.
- `verify-skills.ts` — uses SKILLS.md as the authoritative list for completeness checks.
- `skill-lifecycle-audit.ts` — uses SKILLS.md to detect version drift, missing SKILL.md files, and unregistered skills.

### SKILL.md `scope` Field

Each `SKILL.md` file MUST include a `scope` field in its frontmatter that declares the human-readable layer. Valid values: `workspace-only`, `all-variants`, `variant-specific`.

`skill-lifecycle-audit.ts` performs a drift check between the `scope` field in `SKILL.md` and the `layer` value in `SKILLS.md`. A mismatch is reported as a warning and becomes a blocking error on the next audit after the grace period.

| SKILLS.md `layer` | SKILL.md `scope` (expected) |
|-------------------|---------------------------|
| `L0` | `workspace-only` |
| `L0+L1` | `all-variants` |
| `L0+L1+L2` | `variant-specific` |

---

## 6. Tooling — layer-filter.ts

### Problem

`publish-to-template.ts`, `create-l2-scaffold.ts`, and `validate-templates.ts` each implemented their own copy/exclusion logic independently. `new-project.sh` maintained two separate hardcoded exclusion lists. This caused the defects described in the Context section.

### Solution

A single shared filter engine: `scripts/helpers/layer-filter.ts`.

**Responsibilities**:

1. Parse `scripts/SCRIPTS.md` and `skills/SKILLS.md`.
2. Expose typed query functions:
   - `getScriptsByLayer(layer: Layer): ScriptEntry[]`
   - `getSkillsByLayer(layer: Layer): SkillEntry[]`
   - `isL0Only(filename: string): boolean`
   - `shouldExcludeFromScaffold(filepath: string): boolean`
3. Return results as arrays that callers use to build include/exclude lists.

**Integration**:

| Tool | Current behavior | After integration |
|------|-----------------|------------------|
| `publish-to-template.ts` | Hardcoded include list | Reads SCRIPTS.md via layer-filter.ts |
| `create-l2-scaffold.ts` | Hardcoded exclude list | Reads SCRIPTS.md via layer-filter.ts |
| `validate-templates.ts` | Pattern-based checks | Reads SCRIPTS.md + SKILLS.md via layer-filter.ts |
| `new-project.sh` | Two independent exclusion lists | Delegates to `bun scripts/helpers/layer-filter.ts --query excludeFromScaffold` |

**Layer**: `layer-filter.ts` itself is classified `L0` (it is an internal dependency of L0-only pipeline scripts and is never run inside an L2 project).

---

## 7. Classification Examples

The following table shows the correct Layer classification for representative scripts and skills.

| Artifact | Layer | Rationale |
|----------|-------|-----------|
| `scripts/audit.ts` | `L0+L1` | Dual-mode: detects L0 vs L2 context via `detectProjectContext()`. Designed and documented for use inside L2 project directories. Identical behavior across all variants. |
| `scripts/dev-sync.ts` | `L0+L1` | Dual-mode: runs sync pipeline in either L0 or L2 context. Identical behavior across all variants. |
| `scripts/dispatch-parallel.ts` | `L0+L1` | Dual-mode: dispatches parallel agents, context-aware. Identical behavior across all variants. |
| `scripts/dispatch-serial.ts` | `L0+L1` | Dual-mode: dispatches serial agents, context-aware. Identical behavior across all variants. |
| `scripts/qa-gate.ts` | `L0+L1` | Dual-mode: quality gate runner, context-aware. Identical behavior across all variants. |
| `scripts/helpers/layer-filter.ts` | `L0` | Internal pipeline dependency. Imported by publish-to-template.ts, create-l2-scaffold.ts, validate-templates.ts. Has no standalone meaning inside an L2 project. |
| `scripts/helpers/generate-variant.ts` | `L0` | Internal dependency of L0 pipeline. Generates variant files — a task only meaningful at workspace root. |
| `scripts/helpers/reconcile-with-l0-l1.ts` | `L0` | Internal dependency. Reconciles L2 with L0/L1 — requires workspace-root access. |
| `scripts/create-l2-scaffold.ts` | `L0` | Creates L2 project directories. By definition, only runs at workspace root. Running it inside an L2 would be circular. |
| `scripts/publish-to-template.ts` | `L0` | Publishes from workspace root to templates/. Requires workspace-root access. |
| `scripts/l2-to-variant-pipeline.ts` | `L0` | Promotes L2 to official variant. Requires workspace-root access. |
| `agents/pm.md` (per variant) | `L0+L1+L2` | Each variant has a customized PM agent with domain-specific instructions. The base is in templates/common/agents/, and each templates/co-*/agents/ contains a variant override. |
| `skills/co-consult/` (domain skills) | `L0+L1+L2` | co-consult-specific domain skills. Not applicable to other variants. Variant override exists in templates/co-consult/skills/. |
| `skills/meeting-facilitation/` | `L0+L1` | General-purpose skill applicable to all variants without modification. |

---

## 8. Consequences

### Positive

- **Single source of truth**: SCRIPTS.md and SKILLS.md become the authoritative registries. No more filesystem scans or hardcoded lists that drift from reality.
- **Automated enforcement**: `layer-filter.ts` centralizes all layer-based include/exclude logic. All tools use the same rules, eliminating the inconsistency defects.
- **No more regression bugs**: With `templates/co-*/scripts/` empty (all L0+L1 scripts living in `templates/common/scripts/`), overlay operations cannot overwrite newer versions with older duplicates.
- **Audit visibility**: `validate-templates.ts` can now make precise assertions about which files should and should not be present in each directory, catching misplacements automatically.
- **Clear onboarding**: The decision tree in §3 provides a deterministic classification path for all new contributors.

### Negative / Trade-offs

- **Migration effort**: Existing SCRIPTS.md entries require Layer value backfill. Existing `templates/co-*/scripts/` duplicates must be removed. This is scoped to Phase 2 (tooling) and Phase 3 (registry), described below.
- **SKILLS.md bootstrap**: `skills/SKILLS.md` does not yet exist and must be created, populated with all existing skills, and integrated into all three tools before full enforcement is active.
- **layer-filter.ts implementation**: The shared engine must be implemented before `new-project.sh` can delegate to it. Until then, `new-project.sh` retains its existing exclusion lists with a deprecation notice.

### Migration Phases

**Phase 1 (complete — PR #231)**: Remove the 37 `templates/co-*/scripts/` duplicates. This eliminates the regression bug risk immediately without requiring the full framework.

**Phase 2 — Tooling** (required before full enforcement):
- Implement `scripts/helpers/layer-filter.ts`.
- Integrate into `publish-to-template.ts`, `create-l2-scaffold.ts`, `validate-templates.ts`.
- Update `new-project.sh` to delegate exclusion to `layer-filter.ts`.

**Phase 3 — Registry** (required before full enforcement):
- Backfill Layer values for all existing SCRIPTS.md entries.
- Create `skills/SKILLS.md` and populate with all existing skills.
- Add `scope` field to all existing `SKILL.md` files.
- Enable blocking enforcement in pre-commit hook for missing Layer values.

**Full enforcement active**: After Phase 2 and Phase 3 are both complete. Until then, missing Layer values are reported as warnings by `audit.ts` rather than blocking errors.
