# ADR-0033: L0→L1→L2 Hierarchy and Extends Implementation

**Status**: Implemented
**Date**: 2026-06-07
**Last Updated**: 2026-06-08
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
      └── Full PM agent definition
      └── Contains all sections including workspace-specific content
      └── Includes Auto-Mode, platform-specific sections
      └── No extends directive (root of hierarchy)

L1 (Common Template) - Pure Extends Filter
  └── templates/common/agents/pm.md
      └── YAML frontmatter only (empty body)
      └── extends: ../../../agents/pm.md
      └── remove_sections: [array of L0 sections to remove]
      └── Acts as cleaned version of L0 for L2 inheritance

L2 (Variant Templates) - Variant-Specific Configuration
  └── templates/co-*/agents/pm.md
      └── YAML frontmatter for variant metadata
      └── HTML marker sections for variant-specific content
      └── Implicitly extends L1 (via template structure)
      └── Inherits filtered L0 content via L1
```

**Extends Chain Flow**:
```
L2 co-security/agents/pm.md
  ↓ (implicit extends via template structure)
L1 common/agents/pm.md (YAML: remove_sections)
  ↓ (explicit extends: ../../../agents/pm.md)
L0 agents/pm.md (full content)
  ↓ (after remove_sections filtering + Layout Reconstruction)
L2 inherits cleaned L0 + adds variant-specific generated content
```

**Layout Reconstruction** (added 2026-06-08):
- L2 pm.md does NOT simply copy L0 content with sections removed
- Layout Reconstruction generates variant-specific content from scratch
- Ensures L2 pm.md files are ~50-100 lines (not 384 lines like L0)
- Triggered during L2 template generation and project scaffold
- See "Layout Reconstruction Architecture" section below for details

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

### 4.1 New L0→L1→L2 Extends Pattern (Implemented 2026-06-07)

**Architecture Evolution**: The original design specified a complex override system, but the actual implementation uses a simpler, more maintainable approach:

1. **L1 Pure Extends**: L1 is now a pure template file with YAML frontmatter only (empty body)
2. **L2 YAML Frontmatter**: L2 variants use YAML frontmatter for variant-specific overrides
3. **remove_sections Mechanism**: L1 strips L0-specific sections that shouldn't be inherited
4. **variant_overrides Structure**: L2 defines variant-specific configuration in structured YAML

#### L1 (Common Template) Structure

**File**: `templates/common/agents/pm.md`

**Current Implementation**:
```yaml
---
extends: ../../../agents/pm.md
formal_name: Project Manager (PM) Agent
remove_sections:
  - "## Governance Workflow"
  - "## Updated Role"
  - "## Agent Roster"
  - "## Dispatch Protocol"
  - "### Phase Determination (Deliverable-Type Gate)"
---
```

**Key Characteristics**:
- **Pure Extends File**: Contains only YAML frontmatter, empty body
- **remove_sections**: Lists L0 sections to remove before inheritance by L2
- **Template Function**: Acts as a cleaned version of L0 for L2 variants to extend

**Rationale for remove_sections**:
- L0 contains workspace-specific governance sections not relevant to templates
- L1 removes these sections so L2 variants inherit a clean baseline
- Variant-specific sections are defined by L2 YAML frontmatter or inline content

#### L2 (Variant Template) Structure

**File**: `templates/co-security/agents/pm.md`

**Current Implementation**:
```yaml
---
name: pm
status: active
formal_name: Project Manager (PM) Agent
tier:
  claude: high        # claude-opus-4-7
  antigravity: high   # gemini-3.1-pro (thinking_level="medium")
  gemini-cli: high    # gemini-3.1-pro
model: inherit
color: yellow
description: >
  PM orchestrator for security engagements — owns team assembly, authorization verification,
  threat model validation, and engagement finalization. Use when: starting any security task,
  coordinating red team / patch agents, reviewing scope changes, or closing findings.
examples:
  - user: "Begin a penetration test on the web application"
    assistant: "Running Phase 0 Team Assembly to verify authorization document, then Phase 2 Threat Model validation."
  - user: "A critical vulnerability was discovered"
    assistant: "Logging finding to docs/findings/FIND-NNNN.md and coordinating patch-engineer for remediation."
---

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow
[Variant-specific workflow content...]
<!-- END-VARIANT-SECTION -->

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster
[Variant-specific agent roster table...]
<!-- END-VARIANT-SECTION -->

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol
[Variant-specific dispatch configuration...]
<!-- END-VARIANT-SECTION -->
```

**Key Characteristics**:
- **YAML Frontmatter**: Variant-specific metadata and configuration
- **Variant Sections**: HTML marker-based sections for variant-specific content
- **Mixed Model**: Some config in YAML, some content in marker sections
- **Backward Compatible**: Maintains existing marker-based approach

#### Extends Chain Resolution

**Resolution Order**: L2 → L1 → L0

```
L2 (co-security/agents/pm.md)
  ↓ (implicit extends L1 via template structure)
L1 (common/agents/pm.md)
  ↓ (explicit extends: ../../../agents/pm.md)
L0 (agents/pm.md)
```

**Runtime Resolution Process**:
1. Load L2 file content
2. Parse L2 YAML frontmatter for variant-specific configuration
3. Process L1 remove_sections list to filter L0 content
4. Merge L2 content on top of cleaned L1 content
5. Handle nested section removal (e.g., "### Phase Determination" within "## Governance")

**Nested Section Removal**:
- `remove_sections` supports nested heading removal
- Example: `"### Phase Determination"` removes only that subsection
- Allows precise filtering of L0 content

#### Section Inheritance Rules

**Inherited Sections** (from L0, unless in remove_sections):
- ## Role Declaration
- ## Agent Dispatch Rules
- ## Mandatory Execution Plan Display
- ## Execution Plan Table Format Guidelines
- ## Phase Determination Checklist
- ## PM Gateway Enforcement Summary
- ## Specialist Agent List
- ## Permission Denial Protocol
- All other PM agent sections

**Removed Sections** (by L1 remove_sections):
- ## Governance Workflow (variant-specific)
- ## Updated Role (variant-specific)
- ## Agent Roster (variant-specific)
- ## Dispatch Protocol (variant-specific)
- ### Phase Determination (variant-specific, nested)

**Variant-Specific Sections** (defined in L2):
- ## Governance Workflow (custom workflow)
- ## Agent Roster (specialist agents)
- ## Dispatch Protocol (dispatch rules)

#### YAML Schema Reference

**Complete Schema**: See `docs/variant/pm-yaml-schema.md` for the full YAML frontmatter specification for L2 variants.

**Schema Sections**:
1. Root-Level Fields (`extends`, `variant`, `variant_overrides`)
2. `variant_overrides.updated_role` - Role clarification and scope
3. `variant_overrides.governance_workflow` - Phase configuration
4. `variant_overrides.agent_roster` - Specialist agent configuration
5. `variant_overrides.dispatch_protocol` - Dispatch configuration
6. `variant_overrides.constraints.phase_determination` - Deliverable type rules

**Schema Version**: 1.0.0 (2026-06-07)

**Validation**: Scaffold scripts validate YAML syntax before creating L2 variants.

### 4.1.5 Layout Reconstruction Architecture (added 2026-06-08)

**Purpose**: Generate L2 variant-specific content without duplicating L0 content

**Problem Solved**: L2 pm.md files were duplicating L0 content (384 lines) instead of containing variant-specific content only (~50-100 lines)

**Implementation Location**: `scripts/helpers/merge-frontmatter.ts` lines 882-1632

**Trigger Points**:
1. **L2 Template Generation**: When `create-l2-scaffold.ts` creates a new L2 variant template
2. **Project Scaffold**: When `new-project.ps1` / `new-project.sh` creates a live project from L2 template

**Trigger Condition**:
```typescript
const isPMFile = filePath.toLowerCase().endsWith('agents/pm.md');
const hasVariantOverrides = !!yaml.variant_overrides;

if (isPMFile && hasVariantOverrides && variantLevel === 'L2') {
  return reconstructPMLayout(yaml, baseContent, variantLevel);
}
```

**Content Generation Strategy**:

**Strategy 1: Complete Reconstruction (Preferred)**
- Do NOT copy L0 body content to L2
- Generate ALL L2 content from scratch using variant_overrides
- Result: L2 contains only variant-specific content

**Strategy 2: Copy + Remove (Fallback)**
- Copy L0 body content to L2
- Apply remove_sections filter
- Apply removeL0OnlyContent() cleanup
- Result: L2 contains L0 content with L0-specific sections removed

**Design Decision**: Use Strategy 1 (Complete Reconstruction)

**Rationale**:
- Prevents L0 content leakage completely
- Eliminates need for complex remove_sections logic
- Ensures L2 variants are truly independent
- Aligns with ADR-0031 Fork Model principles

**6-Component Architecture**:

1. **Agent Type Extraction**
   - Extract agent types from variant_overrides.agent_roster using Group → Type mapping
   - Apply fallback hierarchy for missing agent types
   - Handle special cases (e.g., Strategy group context-based mapping)

2. **Group → Type Mapping**
   - Define comprehensive Group → Type mapping for all 5 variants
   - Support variant-specific overrides
   - Support phase-based context rules
   - Centralized in single configuration

3. **Agent Roster Table Generation**
   - Generate 4-column table: Phase | Group | Agent file | Responsibility
   - Handle missing responsibility with fallback: `${group} specialist`
   - Parse agent entries from string or object format

4. **Phase Determination Table Generation**
   - Generate variant-specific agent mapping
   - Validate NO L0 agent names (automation-engineer, docs-writer, architect, auditor, security-expert, scaffolding-expert)
   - Extract agent types from variant_overrides.agent_roster
   - Apply fallback hierarchy with WARNING logs

5. **L0-Only Content Removal**
   - Remove "Platform Note" section from L2 variants
   - Replace "CONSTITUTION.md" references with "context.md and <variant>.context.md"
   - Remove L0-specific terminology (e.g., "workspace root", "ai-workspace-standards")
   - Remove "YOU ARE THE SINGLE ENTRY POINT" section (L0-specific)

6. **MANDATORY Dispatch List Generation**
   - Generate variant-specific dispatch list
   - Extract unique agent names from variant_overrides.agent_roster
   - Format as markdown list with agent file references

**L0 Content Duplication Prevention**:

**Prevention Strategy**:
- L0 provides skeleton structure only (not full content)
- L1 acts as base template that defines extends chain
- L2 generates variant-specific content from scratch
- No copy-paste of L0 body content to L2

**Validation Rules**:
```typescript
const L0_AGENT_NAMES = [
  'automation-engineer',
  'docs-writer',
  'architect',
  'auditor',
  'security-expert',
  'scaffolding-expert'
];

function validateNoL0Leakage(generatedTable: string): ValidationResult {
  const violations = L0_AGENT_NAMES.filter(agent =>
    generatedTable.toLowerCase().includes(agent.toLowerCase())
  );

  return {
    valid: violations.length === 0,
    violations,
    message: violations.length > 0
      ? `L0 leakage detected: ${violations.join(', ')}`
      : 'No L0 leakage'
  };
}
```

**remove_sections Chain Propagation**:

**Propagation Rules**:
1. L1 defines base remove_sections (L0-specific sections to remove)
2. L2 can define additional remove_sections (variant-specific sections to remove)
3. merge-frontmatter.ts merges both lists before processing
4. Merged list applied to L0 content before L2 variant generation

**Implementation**:
```typescript
const inheritedRemoveSections = [
  ...(l1RemoveSections || []),
  ...(l2RemoveSections || [])
];
```

**Validation**: ensure remove_sections are properly inherited from L1 to L2 during reconstruction

**Acceptance Criteria**:
- **AC-01**: No L0 agent names in Phase Determination table
- **AC-02**: All roster entries have non-empty responsibility field
- **AC-03**: Platform Note removed from L2 variants
- **AC-04**: MANDATORY Dispatch List contains only variant agents
- **AC-05**: remove_sections properly inherited from L1 to L2
- **AC-06**: L2 pm.md file size under 150 lines (target: ~50-100 lines)

For detailed design specifications, see [PM.md Variant-Specific Content Injection Design](../designs/pm-md-variant-specific-content-injection-design.md).

### 4.2 Legacy Frontmatter Structure (Original Design)

**Note**: The following was the original design but is NOT the current implementation. Kept for historical reference.

**Original L2 Design**:
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

**Original L1 Design**:
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

**Override Scope Definitions** (original design, not implemented):
- `first_paragraph`: Only the first paragraph of a section
- `full_section`: The entire section content
- `custom_content`: Additional content to append (future enhancement)

**Why This Was Not Implemented**:
- Too complex for initial implementation
- Marker-based approach was already working
- YAML-only approach (L1) proved simpler and more maintainable

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
1. **Single Source of Truth**: L0 workspace root is authoritative, no duplication
2. **Clear Inheritance Path**: L2→L1→L0 resolution is explicit and traceable
3. **Template Simplicity**: L1 is a pure extends file with remove_sections only
4. **Variant Flexibility**: L2 variants can override specific sections via YAML or markers
5. **IDE Friendly**: YAML frontmatter visible and editable in development tools
6. **Automated Validation**: Audit script can check extends chain consistency
7. **Nested Section Removal**: Precise filtering of L0 content (e.g., "### Phase Determination")
8. **Schema Documentation**: Complete YAML schema documented in `docs/variant/pm-yaml-schema.md`

### Negative Consequences
1. **Mixed Implementation**: Current system uses both YAML frontmatter and HTML markers
2. **L1 Simplicity vs L2 Complexity**: L1 is clean (YAML only) but L2 still uses markers
3. **Migration Path**: Existing variants may need updates to match new pattern
4. **Documentation Maintenance**: Two schemas to maintain (original design vs actual implementation)
5. **Learning Curve**: Developers need to understand both remove_sections and variant_overrides

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
| AC-01 | L0→L1→L2 hierarchy documented | docs/adr/0033-l0-l1-l2-hierarchy-and-extends.md exists |
| AC-02 | L1 pure extends implemented | templates/common/agents/pm.md has YAML only, empty body |
| AC-03 | L1 remove_sections mechanism | L1 YAML includes remove_sections array |
| AC-04 | L2 YAML frontmatter implemented | templates/co-*/agents/pm.md have valid YAML frontmatter |
| AC-05 | YAML schema documented | docs/variant/pm-yaml-schema.md exists and is complete |
| AC-06 | Extends chain resolution documented | ADR-0033 §4.1.4 documents resolution process |
| AC-07 | Nested section removal documented | ADR-0033 documents "### Phase Determination" removal |
| AC-08 | L2 variant sections functional | L2 variants define variant-specific sections in markers |
| AC-09 | Audit validates consistency | bun scripts/audit.ts validates L1/L2 structure |
| AC-10 | Scaffold script integration | create-l2-scaffold.ts uses new pattern |

## Appendices

### A. Actual Implementation Examples

**L0 (Workspace Root)**: `agents/pm.md`
- Full PM agent definition with all sections
- Contains workspace-specific governance workflows
- Includes platform-specific sections (Auto-Mode, etc.)

**L1 (Common Template)**: `templates/common/agents/pm.md`
```yaml
---
extends: ../../../agents/pm.md
formal_name: Project Manager (PM) Agent
remove_sections:
  - "## Governance Workflow"
  - "## Updated Role"
  - "## Agent Roster"
  - "## Dispatch Protocol"
  - "### Phase Determination (Deliverable-Type Gate)"
---
```
*(Empty body - pure extends file)*

**L2 (Variant - co-security)**: `templates/co-security/agents/pm.md`
```yaml
---
name: pm
status: active
formal_name: Project Manager (PM) Agent
tier:
  claude: high
  antigravity: high
  gemini-cli: high
model: inherit
color: yellow
description: >
  PM orchestrator for security engagements — owns team assembly, authorization verification,
  threat model validation, and engagement finalization.
examples:
  - user: "Begin a penetration test on the web application"
    assistant: "Running Phase 0 Team Assembly to verify authorization document."
---

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow
[Variant-specific workflow content]
<!-- END-VARIANT-SECTION -->

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster
| Phase | Group | Agent file | Responsibility |
|-------|-------|------------|----------------|
| Threat Modeling | Red Team | `agents/red-team-lead.md` | Attack surface analysis |
| Penetration Testing | Red Team | `agents/pentester.md` | Vulnerability discovery |
<!-- END-VARIANT-SECTION -->

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol
**Can Lead Phases**: [0, 2, 6]
**Auto-Dispatch To**: red-team-lead, pentester, threat-modeler, patch-engineer, report-writer
**Tier**: high
**Communication Style**: sync
<!-- END-VARIANT-SECTION -->
```

### B. Extends Chain Resolution Logic

**Pseudocode**:
```typescript
function resolveExtendsChain(l2Path: string): string {
  // Step 1: Load L2 file
  const l2Content = readFile(l2Path);
  const l2Frontmatter = parseYamlFrontmatter(l2Content);
  
  // Step 2: Load L1 file
  const l1Path = "../../common/agents/pm.md"; // Relative to L2
  const l1Content = readFile(l1Path);
  const l1Frontmatter = parseYamlFrontmatter(l1Content);
  
  // Step 3: Load L0 file
  const l0Path = l1Frontmatter.extends; // "../../../agents/pm.md"
  const l0Content = readFile(l0Path);
  
  // Step 4: Apply L1 remove_sections to L0
  const l0Sections = parseMarkdownSections(l0Content);
  const cleanedSections = l0Sections.filter(section => 
    !l1Frontmatter.remove_sections.includes(section.heading)
  );
  
  // Step 5: Merge L2 content on top
  const l2Sections = parseVariantSections(l2Content);
  const finalSections = mergeSections(cleanedSections, l2Sections);
  
  // Step 6: Assemble final content
  return assembleMarkdown(finalSections);
}

function parseVariantSections(content: string): Section[] {
  // Extract content between <!-- VARIANT-SECTION:name --> markers
  const regex = /<!-- VARIANT-SECTION:(\w+) -->([\s\S]*?)<!-- END-VARIANT-SECTION -->/g;
  const sections = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    sections.push({
      name: match[1],
      content: match[2].trim()
    });
  }
  
  return sections;
}
```

### C. Migration from Original Design

**Original Design (Not Implemented)**:
- Complex override system with `first_paragraph` and `full_section` scopes
- Required deep merge algorithms
- Too complex for initial implementation

**Actual Implementation (Simplified)**:
- L1 pure extends with remove_sections
- L2 uses existing marker-based approach
- YAML frontmatter for metadata only
- Simpler, more maintainable

**Migration Path** (if needed in future):
1. Keep current L1 structure (pure extends, remove_sections)
2. Gradually convert L2 markers to YAML variant_overrides
3. Maintain backward compatibility during transition
4. Use scaffold scripts to enforce new pattern for new variants

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

## Related Documentation

### Primary References
- **[PM.md Variant-Specific Content Injection Design](../designs/pm-md-variant-specific-content-injection-design.md)**: Complete Layout Reconstruction architecture
- **[L2 PM YAML Schema](../variant/pm-yaml-schema.md)**: Complete YAML frontmatter specification for L2 variants
- **[ADR-0031: L1-L2 Fork Model](0031-l1-l2-fork-model.md)**: 5 Fork Model Principles + Layout Reconstruction trigger points
- **[ADR-0032: Auto-Mode Deprecation](0032-deprecate-auto-mode.md)**: Auto-Mode removal from L0

### Supporting Documentation
- **[Variant Creation Workflow](../variant-creation-workflow.md)**: End-to-end variant creation process
- **[PM Agent Role](../../lifecycle/agents/pm.md)**: Full PM agent specification (L0)
- **[Multi-Agent Architecture](../../constitution/05-multi-agent-architecture.md)**: Governance framework
- **[Agent Lifecycle](../../constitution/05.6-agent-lifecycle.md)**: Agent management lifecycle

### Schema Documentation
- **[docs/variant/pm-yaml-schema.md](../variant/pm-yaml-schema.md)**: Complete YAML schema with:
  - Root-level fields (`extends`, `variant`, `variant_overrides`)
  - `variant_overrides` structure (5 override types)
  - Validation rules and examples
  - Complete example files for each variant

---
*This ADR documents the actual implemented L0→L1→L2 hierarchy with pure extends pattern. The L1 template acts as a filter using `remove_sections`, while L2 variants define variant-specific configuration via YAML frontmatter and HTML marker sections. This approach provides a clean, maintainable inheritance chain with clear single source of truth at L0.*