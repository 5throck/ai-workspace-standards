---
status: "Accepted"
---

# ADR-0047: Variant PM Extends Redundant Body Cleanup

**Status**: Accepted
**Date**: 2026-06-23
**Author**: pm
**Related ADRs**: 0039 (L0→L1→L2 Hierarchy and Extends), 0043 (L1 Agent Layer Hybrid Override)

## Executive Summary

### Problem
`templates/co-work/agents/pm.md` and `templates/co-design/agents/pm.md` contain full copies (198 lines each) of the `templates/common/agents/pm.md` body (197 lines), with only the `variant` frontmatter field differing. This redundant body defeats the extends inheritance mechanism defined in ADR-0039.

### Decision
Remove the redundant body from both files, leaving only YAML frontmatter (matching the pattern used by co-security, co-develop, and co-consult). The L2→L1→L0 extends chain will correctly inherit the common body automatically.

### Impact
- Eliminates ~380 lines of duplicated content across 2 files
- Restores proper extends inheritance — L1/L0 body changes now propagate to co-work and co-design
- Aligns all 5 non-co-deck variants to the same frontmatter-only extends pattern

## Background

### Current State

Per ADR-0039, the L0→L1→L2 extends chain is:

```
L2 (templates/co-*/agents/pm.md)
  ↓ extends: ../../common/agents/pm.md
L1 (templates/common/agents/pm.md)
  ↓ extends: ../../../agents/pm.md
L0 (agents/pm.md)
```

The `merge-frontmatter.ts` merge engine uses a **child body takes priority** rule: if an L2 file has body content, it completely replaces the resolved L1→L0 body. An empty L2 body falls through to the parent chain.

| Variant | pm.md Lines | Pattern | Body Differs from Common? |
|---------|-------------|---------|--------------------------|
| co-deck | 162 | Proper override (domain-specific body) | Yes — 11-stage lecture pipeline |
| co-security | 7 | Frontmatter-only (inherit) | No body — inherits via chain |
| co-develop | 7 | Frontmatter-only (inherit) | No body — inherits via chain |
| co-consult | 7 | Frontmatter-only (inherit) | No body — inherits via chain |
| **co-work** | **198** | **Full redundant copy** | **No — byte-for-byte identical to common** |
| **co-design** | **198** | **Full redundant copy** | **No — byte-for-byte identical to common** |

### Root Cause

During the Phase 1 extends migration (ADR-0039, `extends-pattern.md`), all 5 non-co-deck variants received `extends:` frontmatter. However, the body content was not removed from co-work and co-design, leaving them in a hybrid state:
- Frontmatter declares `extends: ../../common/agents/pm.md` (inheritance intent)
- Body contains full copy of common/pm.md (blocks inheritance due to child-priority rule)

co-security, co-develop, and co-consult were correctly migrated to frontmatter-only (7 lines). co-work and co-design were missed.

## Decision

Remove all body content (lines 21–198) from:
- `templates/co-work/agents/pm.md`
- `templates/co-design/agents/pm.md`

Retain only YAML frontmatter with the `variant` field as the sole differentiator, matching the pattern of co-security/co-develop/co-consult.

### Target File Structure

```yaml
---
extends: ../../common/agents/pm.md
name: pm
version: "1.0.0"
last_updated: "2026-06-23"
status: active
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
model: inherit
color: yellow
description: >-
  Orchestrates multi-agent workflows. Enforces quality gates.
  Use when: "Managing workflow", "Coordinating multi-phase tasks", "PM orchestration needed"
examples:
  - user: Start a new feature implementation
    assistant: I'll orchestrate Phase 0 (Team Assembly) and Phase 2 (Design approval)
formal_name: Project Manager (PM) Agent
variant: co-work
---
```

## Consequences

### Positive
- **No Duplication**: ADR-0039 "No Duplication" principle restored for all non-co-deck variants
- **Automatic Propagation**: Future changes to L1/common/pm.md or L0/agents/pm.md automatically flow to co-work and co-design via the extends chain
- **Consistency**: All 5 non-co-deck variants now follow the same pattern (frontmatter-only inherit)
- **Reduced Maintenance**: ~380 lines of duplicated content eliminated

### Negative
- None. The body content was byte-for-byte identical to common/pm.md, so removal has zero functional impact.

### Risks
- **Mitigated by validation**: `bun scripts/validate-pm-extends.ts` verifies extends chain integrity post-change
- **Mitigated by audit**: `bun scripts/audit.ts` runs full workspace validation including template parity checks

## Implementation

1. Remove body (lines 21–198) from co-work/agents/pm.md and co-design/agents/pm.md
2. Update `last_updated` to current date in both frontmatters
3. Run `bun scripts/validate-pm-extends.ts` to verify extends chain integrity
4. Run `bun scripts/audit.ts` to verify full workspace validation passes
5. Update `docs/architecture/extends-pattern.md` Phase 2 migration checklist

### Validation

After implementation, the variant pm.md matrix should be:

| Variant | pm.md Lines | Pattern |
|---------|-------------|---------|
| co-deck | ~162 | Proper override (domain-specific body) |
| co-security | ~7 | Frontmatter-only (inherit) |
| co-develop | ~7 | Frontmatter-only (inherit) |
| co-consult | ~7 | Frontmatter-only (inherit) |
| co-work | ~19 | Frontmatter-only (inherit) ✅ |
| co-design | ~19 | Frontmatter-only (inherit) ✅ |
