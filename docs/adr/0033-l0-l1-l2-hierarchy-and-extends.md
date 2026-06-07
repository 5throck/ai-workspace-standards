# ADR-0033: L0→L1→L2 Hierarchy and Extends Implementation

**Status**: Proposed  
**Date**: 2026-06-07  
**Author**: architect  
**Related ADRs**: 0032 (Auto-Mode Deprecation), 0031 (L1-L2 Fork Model)

## Executive Summary

### Problem
Template structure ambiguity has created critical issues:
1. **Contradictory Implementation**: `variant-pm-spec.md` specifies an `extends` pattern, but actual implementation uses marker-based substitution
2. **Information Duplication**: 5 identical copies of `context.md` across templates with no synchronization
3. **Missing Single Source of Truth**: Unclear relationship between workspace root, common template, and variants

### Decision
Establish a clear L0→L1→L2 hierarchy with explicit extends mechanism:
- **L0 (Workspace Root)**: `agents/pm.md` - authoritative source of truth
- **L1 (Common Template)**: `templates/common/agents/pm.md` - extends from L0
- **L2 (Variant Templates)**: `templates/co-*/agents/pm.md` - extends from L1 with variant-specific overrides

### Impact
- Resolves the variant-pm-spec contradiction
- Eliminates context.md duplication (single source at L1)
- Provides clear inheritance path with IDE-friendly YAML frontmatter
- Enables automated synchronization and validation

## Background

### Current State Issues
**1. pm.md Relationship Contradiction**:
- Specification (`variant-pm-spec.md`): Declares extends pattern where variants inherit from common
- Implementation: Uses `<!-- VARIANT-SECTION -->` markers with no actual inheritance
- Result: No real relationship exists between files, only manual maintenance

**2. context.md Duplication**:
- 5 identical copies in: workspace root, common, and 4 variants
- No synchronization mechanism - manual updates required everywhere
- Creates maintenance burden and consistency risk

**3. User Clarifications**:
- Workspace root `agents/pm.md` is the single source of truth
- Auto-Mode section (lines 193-352) must be removed from workspace pm.md
- L0→L1→L2 hierarchy explicitly defined by user

### Meeting Context
- **Meeting 1**: Identified structural flaws and duplication issues
- **Meeting 2**: Established single source of truth and Auto-Mode removal
- **Meeting 3**: Identified 8 additional overlooked items including security risks

## Decision

### L0→L1→L2 Hierarchy Structure
```
L0 (Workspace Root) - Authoritative Source
  └── agents/pm.md (single source of truth)
      └── Core PM definition without Auto-Mode
      └── No platform-specific implementation details

L1 (Common Template) - Extension Point
  └── templates/common/agents/pm.md
      └── Frontmatter-only extends from L0
      └── Provides override template for L2 variants
      └── No duplicate common content

L2 (Variant Templates) - Variant-Specific Overrides
  └── templates/co-*/agents/pm.md
      └── Extends L1 with variant-specific overrides only
      └── No duplicate common content
      └── Only contains variant-specific sections
```

### Extends Implementation Approach
**Approach**: Frontmatter-only with explicit extends field
**Deprecation**: 3-phase migration from markers to frontmatter
**Override Sections**: Only `## Role` (first paragraph) and `## Agent Roster` can be overridden
**Inherited Sections**: All other sections are inherited from parent

### Key Principles
1. **Single Source of Truth**: Workspace root `agents/pm.md` is authoritative
2. **Explicit Overrides**: Only specific sections can be overridden
3. **No Duplication**: Variant pm.md contain only variant-specific content
4. **Circular Reference Prevention**: Mandatory depth limits and timeouts
5. **Platform Parity**: Identical behavior on Claude Code and Antigravity

## Implementation Details

### 4.1 Frontmatter Structure

**L2 (Variant) Example**:
```yaml
---
# Variant-specific frontmatter
name: pm
extends: ../../../common/agents/pm.md
variant: co-design
overrides:
  - section: "## Role"
    scope: "first_paragraph"
  - section: "## Agent Roster"
    scope: "full_section"
---
```

**L1 (Common) Example**:
```yaml
---
# Common template frontmatter
name: pm
extends: ../../../../agents/pm.md
overrides:
  - section: "## Role"
    scope: "first_paragraph"
---
```

**Override Scope Definitions**:
- `first_paragraph`: Only the first paragraph of a section
- `full_section`: The entire section content
- `custom_content`: Additional content to append (future enhancement)

### 4.2 Circular Reference Prevention

**Security Constraints**:
```typescript
const MAX_EXTENDS_DEPTH = 3;        // L2→L1→L0 maximum
const MAX_FILE_SIZE = 100_000;      // 100KB per file
const MAX_PARSE_TIME = 5000;       // 5 seconds timeout

// Extends chain validation logic
function validateExtendsChain(filePath: string, visited = new Set()): void {
  if (visited.has(filePath)) {
    throw new Error(`Circular reference detected: ${filePath}`);
  }
  
  if (visited.size >= MAX_EXTENDS_DEPTH) {
    throw new Error(`Maximum extends depth exceeded: ${MAX_EXTENDS_DEPTH}`);
  }
  
  const content = readFile(filePath);
  const frontmatter = parseFrontmatter(content);
  
  if (frontmatter.extends) {
    visited.add(filePath);
    validateExtendsChain(frontmatter.extends, visited);
  }
}
```

**Detection Logic**:
1. Track visited nodes during extends resolution
2. Fail on any circular reference immediately
3. Enforce maximum depth to prevent stack overflow
4. Timeout parsing to prevent DoS attacks

### 4.3 3-Phase Migration Plan

**Phase 1: New Front-Only (Current)**
- New variants use frontmatter-only extends
- No markers accepted in new variants
- Frontmatter parsing implemented in scaffold script

**Phase 2: Backward Compatibility (Transition)**
- Existing variants support both markers and frontmatter
- Scaffold script detects and processes both
- Gradual migration of existing variants
- Deprecation warnings for marker usage

**Phase 3: Marker Deprecation (Future)**
- Markers completely deprecated
- Frontmatter-only becomes mandatory
- Migration tool removes marker content
- Audit script fails on marker usage

### 4.4 Merge Logic Implementation

**Section-Level Merge Strategy**:
```typescript
interface SectionOverride {
  section: string;
  scope: 'first_paragraph' | 'full_section' | 'custom_content';
  content?: string; // for custom_content
}

function mergeSections(
  parentContent: string,
  overrides: SectionOverride[]
): string {
  const sections = extractSections(parentContent);
  
  for (const override of overrides) {
    if (override.scope === 'full_section' && override.content) {
      sections[override.section] = override.content;
    } else if (override.scope === 'first_paragraph' && override.content) {
      const current = sections[override.section] || '';
      const firstPara = extractFirstParagraph(current);
      const remaining = current.substring(firstPara.length);
      sections[override.section] = override.content + remaining;
    }
  }
  
  return assembleSections(sections);
}
```

**Conflict Resolution**:
- Variant-specific overrides take precedence
- Unchanged sections inherited from parent
- Full replacement for full_section scope
- Partial replacement for first_paragraph scope

### 4.5 Platform Parity Implementation

**Claude Code Implementation**:
- Native YAML frontmatter parsing
- Agent tool with extends chain resolution
- IDE-friendly visible frontmatter

**Antigravity Implementation**:
- invoke_subagent with frontmatter parameter
- Same extends chain resolution logic
- Consistent behavior across platforms

**Testing Requirements**:
```typescript
// test-platform-parity.ts
function testPlatformParity(variant: string): void {
  const claudeResult = generateOnClaudeCode(variant);
  const antigravityResult = generateOnAntigravity(variant);
  
  assert.deepEqual(claudeResult, antigravityResult, 
    'Platform parity failed: generated content differs');
}
```

## Consequences

### Positive Consequences
1. **Eliminates Duplication**: Single source of truth for all common content
2. **Resolves Contradictions**: Clear extends pattern matches specification
3. **Clear Inheritance**: Explicit parent-child relationships between templates
4. **IDE Friendly**: YAML frontmatter visible in development tools
5. **Automated Validation**: Audit script can check extends chain consistency
6. **Security Safeguards**: Circular reference prevention and depth limits

### Negative Consequences
1. **Migration Complexity**: Existing variants need migration to new pattern
2. **Scaffold Updates**: create-l2-scaffold.ts requires extends logic
3. **Validation Overhead**: Need for validation tools and testing
4. **Learning Curve**: Developers need to understand extends mechanism
5. **Debug Complexity**: Inheritance issues harder to trace than flat files

### Risk Mitigation
1. **Phase Migration**: Gradual rollout with backward compatibility
2. **Validation Tools**: CLI tools to verify extends chain
3. **Audit Integration**: Automated consistency checking
4. **Documentation**: Comprehensive guides and examples

## Alternatives Considered

### 1. Marker-Only Approach
- **Pros**: No new syntax needed, familiar to existing variants
- **Cons**: No actual inheritance, just string replacement
- **Rejected**: Doesn't provide true inheritance relationship

### 2. Complete Rewrite
- **Pros**: Clean slate with all features
- **Cons**: Too disruptive, breaks existing projects
- **Rejected**: Migration risk too high

### 3. Symlink Approach
- **Pros**: Simple, preserves single source
- **Cons**: Not cross-platform compatible, IDE issues
- **Rejected**: Platform compatibility is essential

### 4. Complex Merge Engine
- **Pros**: Powerful merge capabilities
- **Cons**: Too complex, high bug risk
- **Rejected**: Keep implementation simple and focused

## Related Decisions

### ADR-0032: Auto-Mode Deprecation
- **Relationship**: ADR-0033 removes Auto-Mode from workspace pm.md
- **Impact**: L1 and L2 inherit clean version without platform details

### ADR-0031: L1-L2 Fork Model
- **Relationship**: L0→L1→L2 builds upon established fork model
- **Impact**: Extends mechanism provides proper inheritance vs copy model

### ADR-0029: Create L2 Scaffold Design
- **Relationship**: Scaffold scripts need updates for extends pattern
- **Impact**: create-l2-scaffold.ts implements extends resolution

## Resolution Plan

### Phase 1-2: Design and Planning
1. **A-01**: Define L0→L1→L2 hierarchy (this ADR)
2. **A-06**: Finalize extends implementation approach

### Phase 4: Implementation
3. **A-02**: Remove Auto-Mode from workspace pm.md
4. **A-03**: Update scaffold scripts with extends logic
5. **A-04**: Update variant-pm-spec.md with new pattern
6. **A-07**: Implement circular reference prevention
7. **A-08**: Create platform parity test script
8. **A-09**: Implement validation CLI tool
9. **A-10**: Document migration path for existing projects

### Phase 6: Quality Assurance
10. **A-05**: Add extends consistency to audit script
11. **A-11**: Add security checks for circular references

### Immediate Actions
1. Publish this ADR as design specification
2. Update variant-pm-spec.md to reflect new pattern
3. Begin Phase 1 with frontmatter-only extends

## Acceptance Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| AC-01 | L0→L1→L2 hierarchy documented | docs/adr/0033.md exists |
| AC-02 | Frontmatter extends pattern implemented | New variants use YAML frontmatter |
| AC-03 | No Auto-Mode in workspace pm.md | grep -v "Auto-Mode" agents/pm.md |
| AC-04 | Circular reference prevention | Scripts validate extends depth < 3 |
| AC-05 | Platform parity verified | test-platform-parity.ts passes |
| AC-06 | Validation tool available | npm run validate:pm-extends works |
| AC-07 | Context.md duplication eliminated | Only templates/common/docs/context.md exists |
| AC-08 | Audit detects inconsistencies | bun scripts/audit.ts fails on marker usage |

## Appendices

### A. Example Implementation

**Before (Current)**:
```markdown
<!-- VARIANT-SECTION: role -->
Variant-specific role definition
<!-- END-VARIANT-SECTION -->

<!-- VARIANT-SECTION: roster -->
# Variant Agent Roster
- variant-specific-agent
<!-- END-VARIANT-SECTION -->
```

**After (New Pattern)**:
```yaml
---
extends: ../../../common/agents/pm.md
overrides:
  - section: "## Role"
    scope: "first_paragraph"
---
## Role

Variant-specific role definition that only replaces the first paragraph.

## Agent Roster

- variant-specific-agent
- inherited-agent-from-common
```

### B. Migration Script Example

```bash
# migrate-variant-to-extends.sh
variant=$1

# Extract variant-specific content using markers
variant_content=$(extract-variant-sections $variant/agents/pm.md)

# Convert to frontmatter format
cat > $variant/agents/pm.md <<EOF
---
extends: ../../../common/agents/pm.md
overrides:
  - section: "## Role"
    scope: "first_paragraph"
  - section: "## Agent Roster"
    scope: "full_section"
---

$variant_content
EOF
```

### C. Security Validation

```typescript
// security-validator.ts
function validateExtendsSecurity(filePath: string): ValidationResult {
  const stats = fs.statSync(filePath);
  
  // File size check
  if (stats.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeded' };
  }
  
  // Parse time check
  const start = Date.now();
  const content = fs.readFileSync(filePath, 'utf8');
  parseFrontmatter(content);
  if (Date.now() - start > MAX_PARSE_TIME) {
    return { valid: false, error: 'Parse timeout' };
  }
  
  // Circular reference check
  try {
    validateExtendsChain(filePath);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

---
*This ADR establishes the foundation for template inheritance and resolves the structural ambiguities identified in the June 7, 2026 meetings. The L0→L1→L2 hierarchy with frontmatter-based extends provides clear, maintainable, and secure template relationships.*