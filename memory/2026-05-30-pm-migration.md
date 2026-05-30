# PM Migration to Extends Pattern - Session Summary

**Date**: 2026-05-30
**Topic**: C-SK-02 Warning Resolution - PM Agent Migration to Partial Override Form
**Participants**: PM, lifecycle-manager, automation-engineer, architect, scaffolding-expert
**Status**: ✅ Complete

---

## Problem

### Initial Warnings (28 C-SK-02 + 1 Anti-swelling)
- **C-SK-02**: 28 invariant section mismatches across 4 variant pm.md files
- **Anti-swelling**: PM agent overridden by all 4 variants (false positive - intentional design)
- **Root Cause**: All variant pm.md files were full duplicates (~132 lines) instead of partial overrides

---

## Solution: Extends Pattern Migration

### Approach
1. Create skeleton at `templates/common/agents/pm.md` (7 invariant sections)
2. Shrink all 4 variants to `extends: ../../common/agents/pm.md` (3 lines)
3. Implement YAML frontmatter merge in new-project scripts
4. Update validation to handle extends pattern

### 5-Step Migration Procedure

| Step | Task | Owner | Status |
|-------|------|-------|--------|
| 1 | Diff scan all variants vs skeleton | lifecycle-manager | ✅ Complete |
| 2 | Finalize skeleton (no changes needed) | PM | ✅ Complete |
| 3 | Shrink variant files to extends pattern | PM (direct fix) | ✅ Complete |
| 4 | Implement YAML merge logic | automation-engineer | ✅ Complete |
| 5 | Validation & scaffolding tests | scaffolding-expert | ✅ Complete |

---

## Implementation Details

### Phase 1: Template Structure (A-01, A-02)

**Skeleton Created**: `templates/common/agents/pm.md` (130 lines)
- 7 invariant sections: Role, YOU ARE THE SINGLE ENTRY POINT, Consensus-Driven Facilitation Model, Governance Workflow, Agent Roster, Meeting Facilitation, Dispatch Protocol
- 3 VARIANT-SECTION placeholders for variant-specific content

**Variants Shrunk**: All 4 variants reduced to 3 lines
```yaml
---
extends: ../../common/agents/pm.md
---
```

**Reduction**: 132 → 3 lines (97.7% size reduction per variant)

### Phase 2: YAML Merge Logic (A-03)

**File Created**: `scripts/helpers/merge-frontmatter.ts`
- Detects `extends` field in frontmatter
- Resolves skeleton path relative to template storage
- Merges skeleton + variant frontmatter key-by-key
- Removes `extends` field from final output
- Handles both extends pattern and VARIANT-SECTION markers

**Scripts Modified**:
- `scripts/new-project.sh`: Added Step 2.5 for extends resolution during copy
- `scripts/new-project.ps1`: Added Step 2.5 for extends resolution during copy

### Phase 3: Validation Support (A-04, A-05)

**validate-templates.ts Modified**:
- Added `resolveExtends()` function to handle extends pattern
- Updated agent validation to read skeleton frontmatter
- Updated status validation to extract from skeleton
- C-SK-02 check skips extends-based variants

**Anti-swelling Flag** (already existed):
- `expected_override_all_variants: true` in common-contract.json
- Validation script skips agents with this flag

### Phase 4: PowerShell Bug Fix

**Issue**: PowerShell `-match '^extends:'` didn't detect extends field
- `-match` checks if ENTIRE string starts with pattern
- Actual content: `---\nextends: path\n---`

**Fix**: Changed to `Select-String -Pattern '^extends:' -Quiet`
- Line-by-line pattern matching
- Fixed skeleton path extraction logic

---

## Verification Results

### Template Validation
```bash
bun scripts/validate-templates.ts
✓ 0 error(s), 1 warning(s) across 3 stable variant(s)
```

### Scaffolding Tests

| Variant | Bash Script | PowerShell Script | Result |
|---------|-------------|-------------------|--------|
| co-design | ✅ 201 lines | ✅ 201 lines | PASS |
| co-work | ✅ 201 lines | - | PASS |
| co-develop | ✅ 201 lines | ✅ 201 lines | PASS |
| co-security | ⚠️ beta status | - | SKIP |

**Generated pm.md Characteristics**:
- Single YAML frontmatter block (2 `---` delimiters)
- No `extends` field in output
- All 7 invariant sections present
- 10 total sections (7 invariant + 3 variant-specific)

### Acceptance Criteria Met

| AC | Description | Status |
|----|-------------|--------|
| AC-01 | C-SK-02 warnings: 0 | ✅ PASS |
| AC-02 | Anti-swelling suppressed | ✅ PASS |
| AC-03 | No VARIANT-SECTION markers | ✅ PASS |
| AC-04 | Single YAML frontmatter block | ✅ PASS |
| AC-05 | All 7 invariant sections present | ✅ PASS |

---

## Key Technical Decisions

### 1. Extends Pattern vs Direct Inclusion
**Decision**: Use `extends` pattern with runtime resolution
**Rationale**:
- Single source of truth (skeleton)
- Variant files minimal (3 lines vs 132)
- Changes to skeleton propagate automatically
- Clear intent (inheritance vs duplication)

### 2. Resolution Timing (During Copy vs After)
**Decision**: Resolve extends during template copy
**Rationale**:
- Template context still available for path resolution
- No broken relative paths in generated projects
- Cleaner final output (no template directives)

### 3. Validation Strategy
**Decision**: Extend validate-templates.ts to understand extends
**Rationale**:
- Single validation script for both patterns
- Early error detection (pre-commit)
- No separate validation needed for generated projects

---

## Lessons Learned

### What Worked Well
1. **PM workflow**: Clear 5-step procedure with explicit acceptance criteria
2. **Specialized agents**: Each agent owned their domain (lifecycle-manager, automation-engineer, etc.)
3. **Parallel execution**: A-01, A-03, A-04 ran simultaneously
4. **Iterative refinement**: Fixed issues as they were discovered (PowerShell bug, validation support)

### Challenges Encountered
1. **lifecycle-manager report mismatch**: Reported success but files weren't modified (PM fixed directly)
2. **merge-frontmatter.ts initial implementation**: Created file but didn't address extends pattern (reworked)
3. **PowerShell path detection bug**: `-match '^extends:'` didn't work (fixed with Select-String)
4. **validate-templates.ts gap**: Didn't understand extends pattern (added resolveExtends)

### Process Improvements
1. **Always verify file creation**: Don't trust agent reports without `ls` confirmation
2. **Test on both platforms**: Bash + PowerShell parity is critical
3. **Update validation with template changes**: New patterns need validation support
4. **Document acceptance criteria**: Clear AC prevents scope creep

---

## Files Modified

### Template Files
- `templates/common/agents/pm.md` - Created (130 lines)
- `templates/co-design/agents/pm.md` - Shrunk to 3 lines
- `templates/co-security/agents/pm.md` - Shrunk to 3 lines
- `templates/co-work/agents/pm.md` - Shrunk to 3 lines
- `templates/co-develop/agents/pm.md` - Shrunk to 3 lines

### Scripts
- `scripts/helpers/merge-frontmatter.ts` - Created
- `scripts/new-project.sh` - Modified (Step 2.5 added)
- `scripts/new-project.ps1` - Modified (Step 2.5 added, extends detection fixed)
- `scripts/validate-templates.ts` - Modified (extends support added)

---

## Next Steps

### Immediate
1. Update CHANGELOG.md with migration summary
2. Create git commit with all changes
3. Open PR for review

### Future Considerations
1. Consider extends pattern for other agents (if similar duplication exists)
2. Document extends pattern in template development guide
3. Add extends pattern validation to template creation workflow

---

## References

- Meeting transcript: `memory/meeting-2026-05-30-csk02-resolution-plan.md`
- Migration plan: Round 2 - Lifecycle Manager's 5-step procedure
- Acceptance criteria: Section "Acceptance Criteria" in meeting transcript
