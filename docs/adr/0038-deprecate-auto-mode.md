---
status: "Accepted"
---

# ADR-0038: Deprecate Auto-Mode from PM Agents

## 1. Status

- **Type**: Deprecation
- **Status**: Approved
- **Date**: 2026-06-07
- **Decision**: Remove Auto-Mode section from all PM agent definitions

## 2. Context

The Auto-Mode section was originally included in PM agent definitions to provide Antigravity-specific workflow automation capabilities. However, analysis from multiple stakeholder meetings has revealed several issues:

- **Location**: Lines 193-352 in L0 (`agents/pm.md`), lines 197-348 in L1 (`templates/common/agents/pm.md`)
- **Purpose**: Originally intended for Antigravity platform workflow automation
- **Problems**:
  - Superseded by Agent Teams (Experimental) functionality
  - Adds 160+ lines without clear PM value
  - Represents platform-specific implementation detail in core agent definition
  - Creates maintenance burden and inconsistency across platforms

## 3. Decision

**Remove Auto-Mode sections from**:
- `agents/pm.md` (L0, workspace root)
- `templates/common/agents/pm.md` (L1, common template)

**Rationale**:
- Auto-Mode is platform-specific implementation detail, not core PM agent behavior
- Agent Teams provides better functionality for Claude Code users
- Reduces agent definition complexity by 160+ lines
- Improves clarity by separating platform-specific concerns
- Aligns with single source of truth principle (L0 is authoritative)

## 4. Removal Instructions

**For L0 (workspace root)**:
- Remove lines 193-352 (160 lines)
- Preserve all other content
- No changes to frontmatter or other sections

**For L1 (common template)**:
- Remove lines 197-348 (152 lines)
- Preserve all other content
- Maintain L0→L1 inheritance relationship

## 5. Impact Analysis

**Affected Files**:
- `agents/pm.md` (L0)
- `templates/common/agents/pm.md` (L1)

**Unaffected**:
- All L2 variant pm.md files (already don't have Auto-Mode)
- All other PM sections remain unchanged
- Existing Agent Teams functionality remains intact
- No breaking changes to PM agent core functionality

## 6. Alternatives Considered

1. **Keep Auto-Mode as optional feature**: Rejected
   - Adds unnecessary complexity to core agent definition
   - Creates maintenance burden for platform-specific code
   - Contradicts single source of truth principle

2. **Move Auto-Mode to separate file**: Rejected
   - Creates fragmentation of PM agent definition
   - Would require additional documentation and navigation
   - Doesn't solve the platform-specific nature issue

3. **Keep only in Antigravity docs**: Rejected
   - Claude Code users need clarity on platform differences
   - Creates inconsistency in agent documentation
   - Still adds complexity without clear value

## 7. Implementation

- **A-03**: automation-engineer removes Auto-Mode sections
  - Execute removal in both L0 and L1 files
  - Verify line counts match expectations (160 and 152 lines)
- **Post-removal validation**: audit.ts should verify no Auto-Mode references remain
- **A-04**: Update variant-pm-spec.md to reflect deprecation

## 8. Related Decisions

- **References ADR-0039**: L0→L1→L2 hierarchy governance
- **Enables A-13**: Document L0/L1 differences clearly
- **Supports**: Template structure simplification initiative
- **Aligns with**: Platform documentation parity requirements (CONSTITUTION.md §10)

## 9. Migration Path

For users currently relying on Auto-Mode functionality:

1. **Claude Code users**: Continue using Agent Teams (Experimental) functionality
   - Configured via `.claude/settings.json`
   - Provides superior workflow automation capabilities
   
2. **Antigravity users**: Platform-specific documentation will clarify
   - Auto-Mode concepts are documented in platform-specific sections
   - Agent Teams provides equivalent functionality with better implementation

## 10. Success Criteria

- Auto-Mode sections completely removed from L0 and L1 PM definitions
- No functional regressions in PM agent behavior
- Agent Teams functionality remains fully operational
- Documentation updated to reflect changes
- Audit passes with no Auto-Mode references