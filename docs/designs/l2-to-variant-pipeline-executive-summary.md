# L2-to-Variant Pipeline - Executive Summary

> **Architect**: High-level overview for PM decision-making
> **Status**: Design Complete - Pending Approval
> **Full Design**: See `l2-to-variant-conversion-pipeline.md`

---

## What This Does

Converts a user-created L2 project (under workspace root) into a new template variant that can be used for all future projects via `/new-project`.

**Example**: User creates a data engineering project with custom agents → Pipeline converts it → `templates/co-data/` → Future projects can use `--variant co-data`

---

## Core Architecture

### Three-Phase Pipeline

```
L2 Project (User Input)
    │
    ▼
Phase 1: Scan & Classify
    • Analyze all files in L2 project
    • Compare with L0 (workspace root) and L1 (templates/common/)
    • Classify: new / modified / identical
    │
    ▼
Phase 2: Reconcile
    • Version comparison (keep newest)
    • Anti-swelling check (≥50% override → move to common)
    • Decide: keep-in-variant / move-to-common / discard
    │
    ▼
Phase 3: Generate
    • Create templates/<new-variant>/
    • Generate variant.json
    • Copy variant-specific files
    • Validate platform parity (.claude ↔ .gemini)
```

### Key Design Principles

1. **SSOT Compliance**: Never duplicate L0/L1 content in variants
2. **Version-Aware**: Keep newest version across all layers
3. **Anti-Swelling**: If ≥50% variants override same file, it belongs in common
4. **Platform Parity**: Strict .claude ↔ .gemini validation

---

## Implementation Spec

### New Script

**File**: `scripts/l2-to-variant-pipeline.ts`

**Usage**:
```bash
bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name>
bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name> --dry-run
bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name> --force
```

**Core Functions**:
- `scanL2Project()`: Recursive scan, hash computation, classification
- `reconcileWithL0L1()`: Version compare, anti-swelling, conflict resolution
- `generateVariant()`: Create variant.json, copy files, validate parity

### Required Updates

| File | Change | Effort |
|------|--------|--------|
| `README.md` | Add variant row | Low |
| `scripts/new-project.sh` | Add variant to selection prompt | Low |
| `scripts/new-project.ps1` | Add variant to selection prompt | Low |
| `scripts/helpers/inject-skills.ts` | Add variant to skill injection | Medium |
| `docs/templates/VERSION_REGISTRY.json` | Add variant entry | Low |
| `scripts/validate-templates.ts` | Add N-01 new variant check | Medium |
| `skills/project-review/SKILL.md` | Add L1 template consistency check | Medium |

---

## Key Decisions (Made)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Version resolution | Semver compare (keep newest) | Respects SSOT - L0/L1 may have fixes |
| Anti-swelling threshold | 50% | Conservative - avoid premature common moves |
| Platform parity | Strict (block on violation) | Prevent technical debt |
| Conflict handling | Fail + prompt user | Safety first - user must decide |

---

## Open Questions (For PM)

1. **Backpropagation**: When anti-swelling triggers "move-to-common", should pipeline:
   - Automatically update `templates/common/`?
   - Require lifecycle-manager review?
   - **Recommendation**: Require lifecycle-manager review (create ADR, separate PR)

2. **Variant Naming**: Should we:
   - Enforce `co-*` pattern (co-data, co-ml)?
   - Allow arbitrary names?
   - **Recommendation**: Enforce `co-*` but allow `custom-*` for user-specific

3. **Version Conflicts**: When same version but different content:
   - Keep L2 (assume user intent)?
   - Fail with conflict?
   - **Recommendation**: Fail with error + prompt to increment version

4. **L0-Only Files**: Should pipeline:
   - Silently discard L0-only files (validate-templates.ts)?
   - Warn but continue?
   - **Recommendation**: Warn but continue (don't block)

---

## Implementation Phases

### Phase 0: Prerequisites (PM + Architect) - 1 day
- User provides L2 project path
- Architect reviews structure
- Architect approves/rejects conversion

### Phase 1-3: Core Pipeline (Automation Engineer) - 3-5 days
- Phase 1: File scanning & classification (1 day)
- Phase 2: Reconciliation engine (2 days)
- Phase 3: Generation engine (2 days)
- Unit tests for all phases

### Phase 4: Integration (PM + Docs Writer) - 2 days
- Update README.md, new-project scripts, VERSION_REGISTRY.json
- Update validate-templates.ts
- Update project-review skill
- Integration tests

### Phase 5: Validation (PM + Auditor) - 1 day
- Run validate-templates.ts on new variant
- Test project creation with new variant
- Run project-review skill
- Final QA audit

**Total Estimated Time**: 7-9 days

---

## Acceptance Criteria

Pipeline is complete when:

- [ ] Scans any L2 project and generates manifest
- [ ] Classifies files correctly (new/modified/identical)
- [ ] Compares versions and selects newest
- [ ] Triggers anti-swelling when ≥50% override
- [ ] Generates valid variant.json
- [ ] Creates complete directory structure
- [ ] Validates platform parity
- [ ] Passes validate-templates.ts N-01 check
- [ ] Test project creation succeeds
- [ ] project-review skill passes L1 check

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| L2 project has structural issues | High | Phase 0 architect review catches early |
| Version conflicts | Medium | Fail-fast + clear error messages |
| Platform parity violations | High | Strict validation blocks generation |
| Anti-swelling over-triggering | Low | Conservative 50% threshold |
| Integration breaking changes | Medium | Comprehensive integration tests |

---

## Recommendation

**Proceed with implementation** with the following approach:

1. **Pilot Conversion**: Start with a simple L2 project (e.g., existing co-consult)
2. **Iterative Refinement**: Test pipeline, adjust based on results
3. **Documentation First**: Document error codes and troubleshooting before full rollout
4. **Safety Gates**: Keep strict validation - better to fail early than create broken variants

**Next Step**: PM approval → Dispatch automation-engineer for Phase 1-3 implementation

---

## Files Created

1. `docs/designs/l2-to-variant-conversion-pipeline.md` (Full design - 9000+ words)
2. `docs/designs/l2-to-variant-pipeline-executive-summary.md` (This file)

**Both files are ready for PM review.**
