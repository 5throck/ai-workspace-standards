---
status: "Accepted"
---

# ADR-0048: Variant PM Architecture — AGENTS.md as Workflow SSOT

**Status**: Accepted
**Date**: 2026-06-23
**Author**: pm
**Related ADRs**: 0039 (L0→L1→L2 Hierarchy and Extends), 0047 (Variant PM Extends Redundant Body Cleanup)

## Executive Summary

### Problem
co-deck was the only variant whose `pm.md` contained domain-specific orchestration logic (11-Stage Pipeline, Gate Protocol, Rework Rules, Stage 0 configuration, T-Stage Pipeline, Dispatch Protocol). The other 5 variants inherited the generic common PM with zero domain-specific behavior. This created structural inconsistency and violated the SSOT principle — workflow information was split across two files (AGENTS.md + pm.md) for one variant but only in AGENTS.md for the rest.

### Decision
Make AGENTS.md the Single Source of Truth (SSOT) for all variant workflow orchestration. Migrate domain-specific orchestration logic from co-deck `pm.md` into co-deck `AGENTS.md`, then convert co-deck `pm.md` to frontmatter-only (matching the pattern used by all other variants).

### Impact
- All 6 variants now follow the same `pm.md` pattern: frontmatter-only with `extends: ../../common/agents/pm.md`
- AGENTS.md becomes the authoritative location for variant-specific workflow orchestration
- PM agent reads one file (AGENTS.md) for complete orchestration context instead of two

## Background

### Current State (Pre-ADR-0048)

| Variant | AGENTS.md Workflow | pm.md Content | Pattern |
|---------|-------------------|---------------|---------|
| co-deck | ✅ 11-Stage pipeline, gate policy, phase summary, agent roster | ✅ 163-line domain-specific PM — **duplicates** AGENTS.md pipeline + adds Stage 0 config, rework rules, T-Stage, dispatch protocol | **Inconsistent** — two-file workflow |
| co-security | ✅ Agent roster, dispatch triggers, phase gates | ✅ Frontmatter-only (inherits common) | **Consistent** — one-file workflow |
| co-develop | ✅ Agent roster (with TODO placeholders) | ✅ Frontmatter-only (inherits common) | **Consistent** — one-file workflow |
| co-consult | ✅ 10-agent roster, dispatch triggers, phase gates | ✅ Frontmatter-only (inherits common) | **Consistent** — one-file workflow |
| co-work | ✅ 6-agent roster, dispatch triggers, phase gates | ✅ Frontmatter-only (inherits common) | **Consistent** — one-file workflow |
| co-design | ✅ 7-agent roster, dispatch triggers, phase gates | ✅ Frontmatter-only (inherits common) | **Consistent** — one-file workflow |

### What co-deck pm.md Contained (to be migrated)

| Section | Content | Destination in AGENTS.md |
|---------|---------|--------------------------|
| 11-Stage Pipeline | Pipeline diagram + mandatory/optional gate classification | Section 4.2 (replace common Phase 0-6 template) |
| Gate Protocol | Gate 1.5/2/3/4/5 specific behaviors | Section 3.1.2 (merge into existing "Co-deck Specific Exceptions") |
| Project State | `project_state.json` structure + update rules | New subsection in §4.2 |
| Rework Rules | 5-step rework protocol (impact analysis, version-first, minimum scope) | New subsection in §4.2 |
| Stage 0 (New Project Start) | 6-step mandatory onboarding (theme, style, source_verification, dividers, layout_overrides) | New subsection in §4.2 |
| T-Stage Pipeline | Theme/style authoring workflow (Style 3-step, Theme 5-step) | New subsection in §4.2 |
| Dispatch Protocol | Domain-specific dispatch ordering + relaxed prompts + double-hop | Section 3.1.2 (merge into existing exceptions) |
| Constraints | Theme × Style compatibility, Stage 1.5 auto-dispatch, TypeScript-first | Section 3.1.2 (merge into existing exceptions) |

### Information Duplication Analysis

Before migration, co-deck had workflow information in **both** AGENTS.md and pm.md:

| Information | AGENTS.md Location | pm.md Location | SSOT? |
|------------|-------------------|----------------|-------|
| Pipeline stages | §4.1.5 Phase Summary | §11-Stage Pipeline | ❌ Duplicate |
| Gate policy | §3.1.2 (Co-deck Specific Exceptions, partial) | §Gate Protocol | ❌ Split across files |
| Agent roster | §3.1.5 Dispatch Triggers | — (inherited from common) | ✅ AGENTS.md only |
| Phase-to-agent mapping | §3.5 Phase Gate | — (inherited from common) | ✅ AGENTS.md only |
| Project state rules | — (absent) | §Project State | ❌ pm.md only |
| Rework rules | — (absent) | §Rework Rules | ❌ pm.md only |
| Stage 0 config | — (absent) | §New Project Start | ❌ pm.md only |
| T-Stage pipeline | — (absent) | §T-Stage Pipeline | ❌ pm.md only |
| Domain dispatch rules | §3.1.2 (partial) | §Dispatch Protocol + §Constraints | ❌ Split across files |

## Decision

### SSOT Principle: AGENTS.md Owns Workflow Orchestration

AGENTS.md is the authoritative reference for how the PM orchestrates variant-specific workflows. It already serves this role for agent registries, dispatch triggers, and phase gates. This ADR extends that role to include the complete orchestration logic.

**pm.md is an agent identity file**, not a workflow document. Its purpose is:
- YAML frontmatter: name, tier, model, variant identifier, extends chain
- Agent role description (inherited from L1→L0 common base)

**Domain-specific workflow orchestration belongs in AGENTS.md** because:
1. AGENTS.md is already the SSOT for agent registries and dispatch triggers
2. PM reads AGENTS.md for all variant-specific context — having workflow logic there eliminates cross-file references
3. All 5 non-co-deck variants already follow this pattern (workflow info in AGENTS.md only)

### Architecture After Migration

```
AGENTS.md (SSOT for all variant workflow orchestration)
├── §3.1.2 Variant-specific PM behavior (gate policy, dispatch rules, constraints)
├── §3.1.5 Dispatch Triggers (agent roster)
├── §3.5 Phase Gate (deliverable type → agent mapping)
├── §4.1.5 Phase Summary (pipeline overview)
├── §4.2 Domain Workflow (replaces common Phase 0-6 template)
│   ├── Pipeline definition + gates
│   ├── Project state management
│   ├── Rework rules
│   ├── New project start procedure
│   └── Variant-specific pipelines (e.g., T-Stage for co-deck)
└── §4.3 Role Boundary Matrix

pm.md (agent identity, frontmatter-only extends)
├── extends: ../../common/agents/pm.md
├── variant: co-deck
└── (no body — inherits common PM role description via L2→L1→L0 chain)
```

### Scope Limitations

This ADR applies **only to co-deck** — the only variant with domain-specific content in pm.md.

For the other 5 variants (co-security, co-develop, co-consult, co-work, co-design):
- Their pm.md files are already frontmatter-only (ADR-0047 completed)
- Their AGENTS.md files already contain variant-specific agent registries
- When a variant is activated for active development, domain-specific workflow orchestration should be added to its AGENTS.md §4.2, NOT to its pm.md

**co-develop note**: Has 12 `<!-- TODO -->` placeholders in AGENTS.md (Phase Gate + Role Boundary sections). These should be filled when co-develop is activated — separate from this ADR.

## Consequences

### Positive
- **Structural consistency**: All 6 variants now follow the same pm.md pattern (frontmatter-only extends)
- **Single reference**: PM reads AGENTS.md for complete orchestration context — no cross-file lookup needed
- **No duplication**: Workflow information exists in exactly one location per variant
- **Easier maintenance**: Adding workflow changes requires editing only AGENTS.md

### Negative
- **AGENTS.md size increase**: co-deck AGENTS.md grows by ~40 lines (accepting domain orchestration from pm.md)
- **Convention change**: PM agents must be trained to read AGENTS.md §4.2 for workflow details instead of pm.md §4+

### Risks
- **Mitigated**: validate-pm-extends.ts and audit.ts verify structural integrity post-migration
- **Mitigated**: AGENTS.md content is already loaded into PM context window by convention

## Implementation

1. Migrate co-deck pm.md domain orchestration sections into co-deck AGENTS.md §4.2 (replacing common Phase 0-6 template) and §3.1.2 (extending existing exceptions)
2. Convert co-deck pm.md to frontmatter-only with `extends: ../../common/agents/pm.md`
3. Run `bun scripts/validate-pm-extends.ts` to verify extends chain integrity
4. Run `bun scripts/audit.ts` to verify full workspace validation passes

### Target State: Variant pm.md Matrix

| Variant | pm.md Lines | Pattern |
|---------|-------------|---------|
| co-deck | 7 | Frontmatter-only (inherit) ✅ |
| co-security | 7 | Frontmatter-only (inherit) ✅ |
| co-develop | 7 | Frontmatter-only (inherit) ✅ |
| co-consult | 7 | Frontmatter-only (inherit) ✅ |
| co-work | 7 | Frontmatter-only (inherit) ✅ |
| co-design | 7 | Frontmatter-only (inherit) ✅ |

**All 6 variants now follow an identical 7-line minimal frontmatter pattern.** Domain-specific workflow orchestration lives exclusively in each variant's `AGENTS.md §4.2`.
