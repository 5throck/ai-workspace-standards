# Extends Pattern Migration Guide

**Status**: Active  
**Version**: 1.0.0  
**Last Updated**: 2026-06-07  
**Related ADR**: [ADR-0039](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)

## Executive Summary

This document provides comprehensive guidance for migrating from the marker-based substitution approach to the frontmatter-only extends pattern for template inheritance across the L0→L1→L2 hierarchy.

### Current State (Marker-Based)

**Existing Implementation**:
- Uses `<!-- VARIANT-SECTION -->` markers for content substitution
- Manual string replacement during scaffold operations
- No actual inheritance relationship between files
- High maintenance burden with duplicated content

**Current Files Affected**:
- `templates/co-design/agents/pm.md`
- `templates/co-work/agents/pm.md`
- `templates/co-consult/agents/pm.md`
- `templates/co-develop/agents/pm.md`
- `templates/co-security/agents/pm.md`

### Target State (Frontmatter-Only)

**Target Implementation**:
- YAML frontmatter with explicit `extends` field
- True inheritance with parent-child relationships
- Single source of truth principle
- Automated validation and consistency checking

**Target Structure**:
```yaml
---
extends: ../../../common/agents/pm.md
variant: co-design
overrides:
  - section: "## Role"
    scope: "first_paragraph"
  - section: "## Agent Roster"
    scope: "full_section"
---
```

## 3-Phase Migration Strategy

### Phase 1: Frontmatter Markers (Transitional State)

**Timeline**: Immediate implementation  
**Purpose**: Test extends pattern without breaking existing workflows

#### Implementation Details

**1. Add Frontmatter to Existing Variants**

Each variant pm.md file receives dual frontmatter:

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
  PM orchestrator - owns team assembly, design validation, and finalization.
examples:
  - user: "Add a new API endpoint for user registration"
    assistant: "Running Phase 0 Team Assembly to assess requirements, then Phase 2 Design validation."
extends: ../../../common/agents/pm.md
variant: <variant-name>
overrides:
  - section: "## Role"
    scope: "first_paragraph"
  - section: "## Agent Roster"
    scope: "full_section"
---
```

**2. Maintain Existing Markers**

All `<!-- VARIANT-SECTION -->` markers remain functional:

```markdown
<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow
[variant-specific content]
<!-- END VARIANT-SECTION -->
```

**3. Backward Compatibility Layer**

The scaffold script (`create-l2-scaffold.ts`) supports both approaches:

```typescript
function processVariantContent(content: string): ProcessedContent {
  // Check for frontmatter extends
  const extendsMatch = content.match(/extends:\s*(.+)/);
  
  if (extendsMatch) {
    return processExtendsPattern(content);
  } else {
    // Fallback to marker-based processing
    return processMarkerPattern(content);
  }
}
```

#### Testing Requirements

**Acceptance Criteria**:
- ✅ Existing variants continue to work with markers
- ✅ New frontmatter extends field is recognized
- ✅ Scaffold script processes both patterns correctly
- ✅ No breaking changes to existing workflows

**Verification Steps**:
1. Create test variant with frontmatter only
2. Create test variant with both frontmatter and markers
3. Verify scaffold script processes both correctly
4. Test existing variant generation still works

#### Rollback Strategy

**If Issues Arise**:
1. Remove `extends` field from frontmatter
2. Continue using marker-based approach
3. Investigate frontmatter parsing issues
4. Re-attempt Phase 1 after fixes

**Rollback Command**:
```bash
# Emergency rollback to remove extends field
git revert <phase-1-commit>
```

### Phase 2: Backward Compatibility (Safe Rollout)

**Timeline**: 1-2 weeks after Phase 1 completion  
**Purpose**: Verify extends pattern works in production

#### Implementation Details

**1. Deprecation Warnings**

Add deprecation notices for marker usage:

```typescript
function detectMarkerUsage(content: string): boolean {
  const markerPattern = /<!--\s*VARIANT-SECTION/;
  return markerPattern.test(content);
}

function addDeprecationWarning(content: string): string {
  if (detectMarkerUsage(content)) {
    console.warn("⚠️  Warning: VARIANT-SECTION markers are deprecated.");
    console.warn("   Please migrate to frontmatter-only extends pattern.");
    console.warn("   See: docs/migration/extends-pattern.md");
  }
  return content;
}
```

**2. Primary Method Switch**

Scaffold script prioritizes frontmatter processing:

```typescript
function processVariantContent(content: string): ProcessedContent {
  // Primary: frontmatter extends
  const extendsMatch = content.match(/extends:\s*(.+)/);
  
  if (extendsMatch) {
    return processExtendsPattern(content); // Primary method
  } else {
    // Fallback: marker-based (with deprecation warning)
    console.warn("Using deprecated marker-based approach");
    return processMarkerPattern(content);
  }
}
```

**3. Gradual Migration of Existing Variants**

Migrate existing variants one at a time:

**Migration Order**:
1. `templates/co-design/agents/pm.md` ✅ (migrated 2026-06-23, ADR-0047)
2. `templates/co-work/agents/pm.md` ✅ (migrated 2026-06-23, ADR-0047)
3. `templates/co-consult/agents/pm.md` ✅ (already frontmatter-only)
4. `templates/co-develop/agents/pm.md` ✅ (already frontmatter-only)
5. `templates/co-security/agents/pm.md` ✅ (already frontmatter-only)
6. `templates/co-deck/agents/pm.md` ✅ (migrated 2026-06-23, ADR-0048 — domain orchestration moved to AGENTS.md §4.2)

**Migration Process per Variant**:
```bash
# 1. Backup current file
cp templates/<variant>/agents/pm.md templates/<variant>/agents/pm.md.backup

# 2. Remove marker content
# Manually edit to remove VARIANT-SECTION markers

# 3. Verify frontmatter is correct
# Ensure extends field points to correct parent

# 4. Test variant generation
bun scripts/create-l2-scaffold.ts <variant>-test --dry-run

# 5. Commit migration
git add templates/<variant>/agents/pm.md
git commit -m "feat: migrate <variant> to frontmatter-only extends"
```

#### Testing Requirements

**Acceptance Criteria**:
- ✅ Extends pattern works in production
- ✅ All existing variants migrated successfully
- ✅ New variants use frontmatter-only by default
- ✅ Scaffold script emits deprecation warnings for markers

**Verification Steps**:
1. Generate new variant with frontmatter-only
2. Generate test variant with markers (should warn)
3. Verify all existing variants still work
4. Test platform parity (Claude Code + Antigravity)

#### Rollback Strategy

**If Issues Arise**:
1. Restore from `.backup` files
2. Re-enable marker-based processing as primary
3. Investigate production issues
4. Re-attempt migration after fixes

**Rollback Command**:
```bash
# Restore all variants from backup
for variant in co-design co-work co-consult co-develop co-security; do
  cp templates/$variant/agents/pm.md.backup templates/$variant/agents/pm.md
done
```

### Phase 3: Frontmatter-Only (Final State)

**Timeline**: 2-4 weeks after Phase 2 completion  
**Purpose**: Clean, simplified architecture

#### Implementation Details

**1. Remove Marker-Based Logic**

Delete marker processing code from scaffold script:

```typescript
// REMOVED: function processMarkerPattern(content: string): ProcessedContent
// REMOVED: function detectMarkerUsage(content: string): boolean

// NOW PRIMARY ONLY
function processVariantContent(content: string): ProcessedContent {
  const extendsMatch = content.match(/extends:\s*(.+)/);
  
  if (!extendsMatch) {
    throw new Error("Missing required 'extends' field in frontmatter");
  }
  
  return processExtendsPattern(content);
}
```

**2. Audit Script Enforcement**

Add marker detection to audit script:

```typescript
// scripts/audit.ts
function auditMarkerDeprecation(files: string[]): AuditResult {
  const violations: string[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('VARIANT-SECTION')) {
      violations.push(file);
    }
  }
  
  if (violations.length > 0) {
    return {
      status: 'failed',
      message: `Deprecated markers found in ${violations.length} files`,
      violations
    };
  }
  
  return { status: 'passed' };
}
```

**3. Migration Tool**

Create automated migration tool:

```typescript
// scripts/migrate-extends.ts
interface MigrationOptions {
  variant: string;
  dryRun?: boolean;
  backup?: boolean;
}

function migrateVariantToExtends(options: MigrationOptions): void {
  const { variant, dryRun = false, backup = true } = options;
  
  const filePath = path.join(
    WORKSPACE_ROOT,
    'templates',
    variant,
    'agents',
    'pm.md'
  );
  
  if (backup) {
    fs.copyFileSync(filePath, `${filePath}.backup`);
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove markers
  content = content.replace(/<!--\s*VARIANT-SECTION[^>]*-->/g, '');
  content = content.replace(/<!--\s*END-VARIANT-SECTION[^>]*-->/g, '');
  
  // Ensure extends field exists
  if (!content.includes('extends:')) {
    const extendsLine = `extends: ../../../common/agents/pm.md`;
    content = content.replace('---', `---\nextends: ${extendsLine}`);
  }
  
  if (!dryRun) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Migrated ${variant} to extends pattern`);
  } else {
    console.log(`🔍 Dry run: would migrate ${variant}`);
  }
}
```

#### Testing Requirements

**Acceptance Criteria**:
- ✅ All marker-based code removed
- ✅ Audit script fails on marker usage
- ✅ Migration tool available for legacy projects
- ✅ Platform parity maintained
- ✅ No performance degradation

**Verification Steps**:
1. Run audit script on all templates
2. Generate test variants with extends pattern
3. Verify platform parity tests pass
4. Performance test extends chain resolution
5. Test circular reference prevention

#### Rollback Strategy

**If Critical Issues Found**:
1. Restore marker-based processing
2. Rollback to Phase 2 state
3. Perform root cause analysis
4. Re-test extensively before Phase 3 re-attempt

**Emergency Rollback**:
```bash
# Complete rollback to Phase 2
git revert <phase-3-commits>
git revert <phase-2-commits>
git cherry-pick <phase-1-commit>
```

## Variant pm.md Frontmatter Schema

Since ADR-0048 (June 2026), all variant pm.md files follow a frontmatter-only extends pattern. The schema defines **required** and **optional** fields.

### Schema Definition

| Field | Required | Level | Description |
|-------|----------|-------|-------------|
| `extends` | **Yes** | L1, L2 | Path to parent pm.md (`../../common/agents/pm.md` for L2, `../../../agents/pm.md` for L1) |
| `name` | **Yes** | All | Agent identifier (always `pm`) |
| `variant` | **Yes** | L2 only | Variant identifier (`co-deck`, `co-work`, etc.) |
| `version` | **Yes** | All | Semver version string (e.g. `"1.1.0"`) |
| `last_updated` | **Yes** | All | ISO date (e.g. `"2026-06-23"`) |
| `formal_name` | No | L0, L1 | Human-readable name |
| `status` | No | All | `active` / `deprecated` / `draft` |
| `tier` | No | L0, L1 | Per-platform model tier mapping (`claude`, `gemini`, `antigravity`, `gemini-cli`) |
| `model` | No | L0, L1 | Model override strategy (`inherit` or explicit model name) |
| `color` | No | L0, L1 | Display color for tool UI |
| `description` | No | L0, L1 | Agent description with trigger phrases |
| `examples` | No | L0, L1 | Usage example pairs (`user` / `assistant`) |
| `role` | No | L0 | Role classification (e.g. `orchestrator`) |
| `lifecycle` | No | L0 | Lifecycle metadata (phase, created, last_updated, governance path) |

### Inheritance Rules

The L2→L1→L0 extends chain resolves as follows:
1. **L2 frontmatter** fields are read first
2. **L1 frontmatter** fields are read and merged (L2 values take priority for duplicate keys)
3. **L0 frontmatter** fields are the base (L1 values take priority for duplicate keys)

**Body content**: If L2 has no body (frontmatter-only), the resolved body comes from L1 → L0. If L2 has any body content, it **completely replaces** the entire parent chain body.

### Usage Patterns

**Minimal pattern** (all current variants use this):
```yaml
---
extends: ../../common/agents/pm.md
name: pm
variant: co-deck
version: "1.1.0"
last_updated: "2026-06-23"
---
```

**Rich pattern** (for variants needing custom description/examples):
```yaml
---
extends: ../../common/agents/pm.md
name: pm
variant: co-example
version: "1.0.0"
last_updated: "2026-06-23"
description: >-
  Custom variant PM description. Use when: "specific trigger phrase"
examples:
  - user: "Start co-example workflow"
    assistant: "I'll begin the co-example pipeline..."
---
```

> **Note**: Both patterns are valid. Use the minimal pattern when L1 common defaults are sufficient. Use the rich pattern only when variant-specific override is needed.

### Validation

- `validate-pm-extends.ts` scans only git-tracked `pm.md` files (untracked test projects are auto-excluded)
- Required fields (`extends`, `name`, `variant`, `version`, `last_updated`) are not yet enforced by the validator — only extends chain correctness is checked
- `audit.ts` verifies L0→L1→L2 alignment and pm.md consistency

## Implementation Checklist

### Phase 1 Checklist

- [x] Add frontmatter extends field to all 5 existing variants
- [x] Implement extends parsing in scaffold script
- [x] Add backward compatibility layer
- [x] Test dual-mode operation (frontmatter + markers)
- [x] Document Phase 1 completion in memory log
- [x] Verify no breaking changes to existing workflows
- [x] Update ADR-0033 with Phase 1 completion status

### Phase 2 Checklist

- [x] Implement deprecation warnings for markers
- [x] Switch scaffold script to frontmatter-first processing
- [x] Migrate co-design variant (test case)
- [x] Verify co-design migration success
- [x] Migrate co-work variant
- [x] Migrate co-consult variant
- [x] Migrate co-develop variant
- [x] Migrate co-security variant
- [x] Migrate co-deck variant (ADR-0048 — domain orchestration moved to AGENTS.md §4.2)
- [x] Test all variants in production
- [x] Run platform parity tests
- [x] Document Phase 2 completion in memory log (see ADR-0047, ADR-0048)
- [x] Update ADR-0033 with Phase 2 completion status

### Phase 3 Checklist

- [ ] Remove all marker-based processing code
- [ ] Add marker detection to audit script
- [ ] Create migration tool for legacy projects
- [ ] Run full audit on workspace
- [ ] Verify all markers removed
- [ ] Test migration tool functionality
- [ ] Performance test extends resolution
- [ ] Security test circular reference prevention
- [ ] Document Phase 3 completion in memory log
- [ ] Update ADR-0033 with Phase 3 completion status
- [ ] Celebrate migration completion! 🎉

## Risk Assessment

### High-Risk Areas

**1. Breaking Existing Workflows**
- **Risk Level**: HIGH
- **Impact**: Existing variant scaffolding fails
- **Mitigation**: 
  - Extensive backward compatibility testing
  - Phase 1 maintains dual-mode operation
  - Emergency rollback procedures documented

**2. Platform Parity Loss**
- **Risk Level**: MEDIUM
- **Impact**: Claude Code and Antigravity behave differently
- **Mitigation**:
  - Platform parity test script
  - Consistent extends resolution logic
  - Cross-platform validation

**3. Circular Reference Vulnerabilities**
- **Risk Level**: MEDIUM
- **Impact**: Infinite loops, DoS attacks
- **Mitigation**:
  - Maximum depth limits (MAX_EXTENDS_DEPTH = 3)
  - Circular reference detection
  - Timeout protection (MAX_PARSE_TIME = 5000ms)

**4. Performance Degradation**
- **Risk Level**: LOW
- **Impact**: Slower variant generation
- **Mitigation**:
  - Benchmark testing
  - Optimized parsing logic
  - File size limits (MAX_FILE_SIZE = 100KB)

### Medium-Risk Areas

**5. Migration Data Loss**
- **Risk Level**: MEDIUM
- **Impact**: Variant-specific content lost during migration
- **Mitigation**:
  - Automatic backup creation (.backup files)
  - Dry-run mode for testing
  - Manual verification steps

**6. Validation Errors**
- **Risk Level**: MEDIUM
- **Impact**: False positives/negatives in audit script
- **Mitigation**:
  - Comprehensive test coverage
  - Manual audit verification
  - Clear error messages

### Low-Risk Areas

**7. Documentation Drift**
- **Risk Level**: LOW
- **Impact**: Confusion about migration process
- **Mitigation**:
  - Comprehensive migration guide
  - Memory log updates
  - ADR status tracking

## Impact Analysis

### Impact on Existing Variants

**Affected Variants**:
- `templates/co-deck/agents/pm.md` (migrated ADR-0048 — domain orchestration moved to AGENTS.md §4.2)
- `templates/co-design/agents/pm.md` (migrated ADR-0047)
- `templates/co-work/agents/pm.md` (migrated ADR-0047)
- `templates/co-consult/agents/pm.md` (already frontmatter-only)
- `templates/co-develop/agents/pm.md` (already frontmatter-only)
- `templates/co-security/agents/pm.md` (already frontmatter-only)

**Changes Required**:
1. Add frontmatter `extends` field
2. Define `overrides` array
3. Remove `<!-- VARIANT-SECTION -->` markers (Phase 3)
4. Keep variant-specific content only

**No Functional Changes**: Behavior remains identical, only implementation changes.

### Impact on Scaffolding Scripts

**Affected Scripts**:
- `scripts/create-l2-scaffold.ts`
- `scripts/validate-templates.ts`

**Changes Required**:
1. Add frontmatter parsing logic
2. Implement extends chain resolution
3. Add circular reference validation
4. Remove marker-based processing (Phase 3)

**New Functionality**:
```typescript
// Extends chain resolution
function resolveExtendsChain(filePath: string): ResolvedContent {
  const visited = new Set<string>();
  return resolveExtendsRecursive(filePath, visited);
}

function resolveExtendsRecursive(
  filePath: string,
  visited: Set<string>
): ResolvedContent {
  // Circular reference detection
  if (visited.has(filePath)) {
    throw new Error(`Circular reference: ${filePath}`);
  }
  
  // Depth limit enforcement
  if (visited.size >= MAX_EXTENDS_DEPTH) {
    throw new Error(`Max depth exceeded: ${MAX_EXTENDS_DEPTH}`);
  }
  
  // Parse and merge
  const content = fs.readFileSync(filePath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  
  if (frontmatter.extends) {
    visited.add(filePath);
    const parent = resolveExtendsRecursive(frontmatter.extends, visited);
    return mergeContent(parent, content, frontmatter.overrides);
  }
  
  return { content, frontmatter };
}
```

### Impact on Documentation

**Affected Documentation**:
- `docs/adr/0033-l0-l1-l2-hierarchy-and-extends.md`
- `docs/templates/variant-pm-spec.md`
- `templates/common/CLAUDE.md`
- `templates/common/GEMINI.md`

**Changes Required**:
1. Update variant-pm-spec.md with new pattern
2. Update ADR-0033 with migration status
3. Create this migration guide
4. Update platform documentation

### Impact on CI/CD Pipelines

**Affected Pipelines**:
- Pre-commit hooks (audit script)
- Pre-push hooks (validation)
- Sync pipeline (dev-sync.ts)

**Changes Required**:
1. Add marker detection to audit script
2. Add extends validation to pre-commit
3. Update sync pipeline for new structure

**No Breaking Changes**: Pipelines continue to work, with additional validation.

## Testing Strategy

### Unit Tests

**Test Cases**:
```typescript
describe('Extends Pattern', () => {
  test('parses frontmatter extends field', () => {
    const content = `---
extends: ../../../common/agents/pm.md
variant: co-design
---`;
    const result = parseFrontmatter(content);
    expect(result.extends).toBe('../../../common/agents/pm.md');
  });
  
  test('detects circular references', () => {
    // Create circular dependency
    expect(() => resolveExtendsChain('circular.md')).toThrow();
  });
  
  test('enforces maximum depth', () => {
    // Create deep chain (>3 levels)
    expect(() => resolveExtendsChain('deep.md')).toThrow();
  });
  
  test('merges sections correctly', () => {
    const parent = '## Role\nParent content';
    const child = '## Role\nChild content';
    const result = mergeSections(parent, child, ['## Role']);
    expect(result).toContain('Child content');
  });
});
```

### Integration Tests

**Test Cases**:
```typescript
describe('Variant Generation', () => {
  test('generates variant with extends pattern', () => {
    const result = execSync('bun scripts/create-l2-scaffold.ts test-variant');
    expect(result.toString()).toContain('extends:');
  });
  
  test('maintains backward compatibility', () => {
    const result = execSync('bun scripts/create-l2-scaffold.ts legacy-variant');
    expect(result.toString()).toContain('VARIANT-SECTION'); // Should still work
  });
  
  test('migrates existing variant', () => {
    execSync('bun scripts/migrate-extends.ts co-design');
    const content = fs.readFileSync('templates/co-design/agents/pm.md', 'utf8');
    expect(content).toContain('extends:');
    expect(content).not.toContain('VARIANT-SECTION');
  });
});
```

### Platform Parity Tests

**Test Cases**:
```typescript
describe('Platform Parity', () => {
  test('claude-code generates same content as antigravity', () => {
    const claude = generateOnClaudeCode('co-design');
    const antigravity = generateOnAntigravity('co-design');
    expect(claude).toEqual(antigravity);
  });
  
  test('extends resolution works on both platforms', () => {
    const claudeChain = resolveExtendsChainOnClaude('co-design');
    const antigravityChain = resolveExtendsChainOnAntigravity('co-design');
    expect(claudeChain).toEqual(antigravityChain);
  });
});
```

### Security Tests

**Test Cases**:
```typescript
describe('Security Validation', () => {
  test('prevents circular reference attack', () => {
    const malicious = createMaliciousExtends('circular');
    expect(() => validateExtendsSecurity(malicious)).toThrow();
  });
  
  test('enforces file size limits', () => {
    const oversized = createOversizedFile(200_000); // 200KB
    expect(() => validateExtendsSecurity(oversized)).toThrow();
  });
  
  test('enforces parse time limits', () => {
    const slow = createSlowParsingFile();
    expect(() => validateExtendsSecurity(slow)).toThrow();
  });
});
```

## Timeline and Milestones

### Phase 1 Timeline

**Duration**: 1 week  
**Start**: 2026-06-07  
**End**: 2026-06-14

**Milestones**:
- Day 1-2: Implement frontmatter parsing
- Day 3-4: Add backward compatibility layer
- Day 5-6: Test dual-mode operation
- Day 7: Document completion, move to Phase 2

### Phase 2 Timeline

**Duration**: 2 weeks  
**Start**: 2026-06-15  
**End**: 2026-06-29

**Milestones**:
- Week 1: Migrate 2-3 variants
- Week 2: Migrate remaining variants
- End of Week 2: Production testing

### Phase 3 Timeline

**Duration**: 2 weeks  
**Start**: 2026-06-30  
**End**: 2026-07-14

**Milestones**:
- Week 1: Remove markers, add audit enforcement
- Week 2: Create migration tool, final testing
- End of Week 2: Migration complete!

## Rollback Procedures

### Emergency Rollback (Phase 1)

**Trigger**: Critical bugs in production

**Steps**:
```bash
# 1. Revert Phase 1 commit
git revert <phase-1-commit-hash>

# 2. Verify workspace state
bun scripts/audit.ts

# 3. Test existing workflows
bun scripts/create-l2-scaffold.ts test-variant --dry-run

# 4. Document rollback in memory log
```

### Emergency Rollback (Phase 2)

**Trigger**: Migration failures, variant generation errors

**Steps**:
```bash
# 1. Restore all variants from backup
for variant in co-design co-work co-consult co-develop co-security; do
  cp templates/$variant/agents/pm.md.backup templates/$variant/agents/pm.md
done

# 2. Revert to Phase 1 state
git revert <phase-2-commit-hash>

# 3. Verify marker-based processing still works
bun scripts/validate-templates.ts

# 4. Document rollback and root cause
```

### Emergency Rollback (Phase 3)

**Trigger**: Audit failures, platform parity loss

**Steps**:
```bash
# 1. Complete rollback to Phase 2
git revert <phase-3-commits>

# 2. Re-enable marker-based processing
git cherry-pick <phase-2-commit-hash>

# 3. Restore marker compatibility
# Manual intervention may be required

# 4. Extensive testing before re-attempt
```

## Success Criteria

### Phase 1 Success Criteria

- ✅ All existing variants work without modification
- ✅ New frontmatter extends field recognized
- ✅ Scaffold script supports both patterns
- ✅ No breaking changes to existing workflows
- ✅ Backward compatibility verified

### Phase 2 Success Criteria

- ✅ All variants migrated to frontmatter-only
- ✅ Marker deprecation warnings implemented
- ✅ Production testing passed
- ✅ Platform parity maintained
- ✅ No performance degradation

### Phase 3 Success Criteria

- ✅ All marker-based code removed
- ✅ Audit script enforces frontmatter-only
- ✅ Migration tool available for legacy projects
- ✅ Circular reference prevention verified
- ✅ Platform parity tests passing
- ✅ Performance within acceptable limits

## Troubleshooting

### Common Issues

**Issue 1: "Missing extends field in frontmatter"**
- **Cause**: Frontmatter missing `extends` field
- **Solution**: Add `extends: ../../../common/agents/pm.md` to frontmatter
- **Verification**: Check file has proper YAML frontmatter

**Issue 2: "Circular reference detected"**
- **Cause**: File extends itself or creates circular chain
- **Solution**: Check extends chain for circular dependencies
- **Verification**: Use `npm run validate:pm-extends` to check chain

**Issue 3: "Maximum extends depth exceeded"**
- **Cause**: Extends chain longer than 3 levels (L2→L1→L0)
- **Solution**: Verify chain doesn't exceed 3 levels
- **Verification**: Check `extends` fields form valid hierarchy

**Issue 4: "Variant generation fails with markers"**
- **Cause**: Marker-based processing removed (Phase 3)
- **Solution**: Migrate variant to frontmatter-only pattern
- **Verification**: Run migration tool on affected variant

**Issue 5: "Platform parity test fails"**
- **Cause**: Different behavior on Claude Code vs Antigravity
- **Solution**: Check extends resolution logic is consistent
- **Verification**: Run platform parity test suite

**Issue 6: "validate-pm-extends scans untracked test projects"**
- **Cause**: `findPmFiles()` previously scanned entire workspace filesystem
- **Solution**: `validate-pm-extends.ts` now uses `git ls-files` to scan only git-tracked pm.md files. Untracked directories (test projects, generated output) are automatically excluded. Fallback filesystem scan is scoped to `agents/` and `templates/` only.
- **Verification**: Run `bun scripts/validate-pm-extends.ts` — should show 0 errors if all tracked files are valid

## Related Documentation

- [ADR-0039: L0→L1→L2 Hierarchy and Extends Implementation](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)
- [ADR-0047: Variant PM Extends Redundant Body Cleanup](../adr/0047-variant-pm-extends-redundant-body-cleanup.md)
- [ADR-0048: Variant PM Architecture — AGENTS.md as Workflow SSOT](../adr/0048-variant-pm-agents-md-workflow-ssot.md)
- [ADR-0031: L1-L2 Fork Model](../adr/0031-l1-l2-fork-model.md)
- [Variant PM Specification](../templates/variant-pm-spec.md)
- [Scaffold Script Documentation](../scripts/create-l2-scaffold.ts)

## Support and Questions

For questions or issues during migration:
1. Check this migration guide first
2. Review ADR-0033 for design rationale
3. Check memory log for recent migration updates
4. Consult with architect or automation-engineer agents

---

**Document Status**: Phase 2 Complete  
**Next Review**: 2026-09-14 (Q3 quarterly review)  
**Maintainer**: docs-writer agent  
**Approved By**: architect agent (design review)
