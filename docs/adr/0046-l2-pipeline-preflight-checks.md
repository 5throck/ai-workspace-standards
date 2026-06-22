# ADR 0046: L2-to-Variant Pipeline Pre-flight Checks (Phase 1.6 + Phase 3.5)

**Status**: Accepted
**Date**: 2026-06-22
**Decision Type**: Pipeline Governance / Architecture
**Applies To**: `scripts/l2-to-variant-pipeline.ts` v1.8.2+
**Related ADR**: [ADR-0042](0042-l2-variant-pipeline-wave15-golden-reference.md) (Wave 1.5 — Golden Reference + Phase 4.5 BLOCKING)
**PR**: https://github.com/5throck/ai-workspace-standards/pull/309

---

## Context

### Problem Statement

The L2-to-variant pipeline (`l2-to-variant-pipeline.ts`) previously had one BLOCKING gate: **Phase 4.5** (Golden Reference Gap Check), which validated generated output AFTER `generate-variant.ts` had already run. This meant:

1. **pm.md structural issues** (missing `extends:` pattern, 200-line overruns, duplicate sections from L0) were invisible until the generated variant was already on disk.
2. **AGENTS.md missing VARIANT-\*-START/END markers** caused `injectVariantPlaceholders()` to silently no-op — generate-variant.ts would run successfully but the output AGENTS.md would be unpopulated. Phase 4.5 BLOCKING only catches this after the fact.

The root cause of the latter was confirmed during audit: co-consult, co-work, co-security, and co-design AGENTS.md were generated before the §-numbered L1 structure was introduced. They contained no `<!-- VARIANT-AGENTS-START -->` anchors, so four rounds of pipeline execution had silently produced no agent data in those files.

### Decision Drivers

1. **Fail early, not late**: Source must be in a generatable state before generation begins. Half-generated files are worse than a pre-flight error.
2. **Role clarity**: pm.md diagnosis (source) and pm.md completion (generated file) must be separate pipeline phases with distinct scope.
3. **Double defense for critical paths**: AGENTS.md marker absence is a silent functional failure — both pre-flight (Stage 1) and post-generation (Stage 2, Phase 4.5) must guard against it.
4. **Automation-friendly**: Auto-fix paths must be opt-in (explicit flag), default-safe, and must not modify source files without git backup.

---

## Decision

Add two new pipeline phases to `l2-to-variant-pipeline.ts`:

### Phase 1.6 — pm.md Pre-flight Diagnosis (Non-blocking)

- **Position**: After Phase 1.5 (agent/skill frontmatter normalization), before Phase 2 (L0/L1 reconciliation)
- **Severity**: Non-blocking (warn). pm.md issues are human-reviewable; a thick pm.md still functions.
- **Checks**: `extends:` pattern presence, line count > 200 (proxy for L0 duplication), duplicate section headers vs L1 common pm.md
- **Auto-fix** (`config.autoFixPmMd: true`): Outputs guidance text only. Source file modification requires explicit `--auto-fix` + git backup.
- **Role**: Source diagnosis ONLY. Does NOT modify generated variant files (that is Phase 4.6's role).

### Phase 3.5 — AGENTS.md §-Structure Check (BLOCKING)

- **Position**: After Phase 3 (dependency validation), before Phase 4 (variant generation)
- **Severity**: BLOCKING. Missing VARIANT-\* markers cause silent functional failure — `injectVariantPlaceholders()` no-ops, leaving AGENTS.md empty.
- **Checks**: 6 VARIANT-\*-START markers present, `## §1:` and `## §3:` section headers present
- **Auto-fix** (`config.autoFixAgentsMd: true`): Calls `regenerate-agents-md.ts --variant <name>` via subprocess. Only activates when variant path is under `templates/`.
- **Double-defense**: Phase 4.5 BLOCKING is retained as second guard against `--skip-normalize` bypass and external structural edits.

### Phase 4.6 Role Redefinition

Phase 4.6 comment updated from "source diagnosis" to "GENERATED VARIANT PM.MD COMPLETION + CONTEXT.MD GENERATION". Phase 1.6 now owns source diagnosis; Phase 4.6 owns generation completion.

---

## Phase Placement Rationale

| Phase | Stage | Role | Blocking? |
|-------|-------|------|-----------|
| 1.6 | 1 (Scan & Prepare) | pm.md source diagnosis | No (warn) |
| 3.5 | 1 (Scan & Prepare) | AGENTS.md structure validation | Yes (halt) |
| 4.5 | 2 (Generate & Validate) | Post-generation gap check (double-defense) | Yes (halt) |
| 4.6 | 2 (Generate & Validate) | Generated pm.md completion | N/A (write phase) |

pm.md is diagnosed early (Phase 1.6) because pm.md issues are visible at the start of Stage 1 and are recoverable with human review. AGENTS.md is checked late in Stage 1 (Phase 3.5) because AGENTS.md is the anchor file for pipeline injection — validating it as the last Stage 1 gate makes it the clearest "ready to generate" signal.

---

## Meeting Basis

This ADR documents decisions reached in the L2→Variant Migration Pipeline meeting (2026-06-22):
- Transcript: `memory/meeting-2026-06-22-l2-variant-migration-pipeline.md`
- Action items implemented: A-01 (Phase 1.6), A-02 (Phase 3.5), A-03 (Phase 4.6 comment), A-04 (SCRIPTS.md + ADR)

---

## Consequences

### Positive

- Pipeline fails clearly with a diagnosable error instead of producing silently broken variants.
- pm.md structural debt is surfaced before it propagates into generated files.
- AGENTS.md drift (from external edits or pre-§-structure generation) is caught before generation.
- `regenerate-agents-md.ts` is integrated as a first-class auto-fix tool in the pipeline.

### Negative / Trade-offs

- Pipeline adds two new checks per run — negligible overhead for file reads (< 100ms each).
- Phase 3.5 BLOCKING means pipelines that worked before (when AGENTS.md had no markers) now fail. Mitigation: `--auto-fix-agents-md` flag provides one-click resolution.
- Phase 1.6 duplicate section detection requires reading L1 common pm.md on every run — acceptable I/O cost.

### Open Questions (Unresolved from Meeting)

1. **Phase 1.6 false positive risk**: Intentional L2 overrides of L1 sections may be flagged as duplicates. Current heuristic: exact section header match. A `# OVERRIDE-OK` annotation could suppress false positives — not yet implemented.
2. **`regenerate-agents-md.ts` integration depth**: Currently called as a subprocess. Future option: import as a module. Decision deferred pending stability.

---

## Implementation

- **Script**: `scripts/l2-to-variant-pipeline.ts` v1.8.2
- **Supporting script**: `scripts/regenerate-agents-md.ts` v1.0.0 (L0-only)
- **Config flags added**: `PipelineConfig.autoFixPmMd`, `PipelineConfig.autoFixAgentsMd`
- **Affected audits**: `scripts/audit.ts` + `templates/common/scripts/audit.ts` — VARIANT-\* marker presence now FAIL (not warn) for all co-* variants
