---
status: "Accepted"
---

# ADR-0034: PM.md Architecture Evolution (v1.0 → v2.0)

**Status**: Proposed
**Date**: 2026-06-08
**Context**: PM.md operations design improvements (June 7-8, 2026 meetings)
**Related ADRs**: ADR-0031 (L1-L2 Fork Model), ADR-0039 (L0-L1-L2 Hierarchy and Extends)

---

## Context

During June 7-8, 2026 design reviews, significant architectural issues were identified in the PM.md operations design:

1. **Ambiguous semantics** in `variant_sections` leading to implementation confusion
2. **Over-engineering** in Layout Reconstruction Process (8 steps → 3 steps sufficient)
3. **Security vulnerabilities** in YAML parsing (path injection, external URL references)
4. **Missing edge case handling** and error recovery strategies
5. **Lack of performance optimization** (caching) and observability

This ADR documents the architectural evolution from v1.0 (current state) through v2.0+ (future roadmap).

---

## Decision

### Phase 1: Core Architecture Improvements (v1.2.0 - v1.3.0)

**Timeline**: Immediate (Phase 1+ implementation, 7-9 hours)
**Priority**: P0-P1 (Security and stability)

**1.1 variant_sections Semantic Definition**

**Change**: Explicit `action` field with three operations

```yaml
# Before (v1.0.0 - v1.1.0): Ambiguous
variant_overrides:
  remove_sections:
    - "## Role"

# After (v1.2.0+): Explicit actions
variant_overrides:
  variant_sections:
    - section: "## Role"
      action: "prepend"  # prepend | replace | append
```

**Rationale**: 
- Removes ambiguity in "update" semantics
- Provides machine-interpretable operations
- Enables predictable implementation

**Migration**: Automatic backward compatibility with warning for `remove_sections`

---

**1.2 Agent Roster Schema Simplification**

**Change**: 4-column → 3-column schema

```typescript
// Before (v1.0.0 - v1.1.0): 4-column
interface RosterEntry {
  phase: string;
  group: string;
  name: string;
  file?: string;
  responsibility?: string;
}

// After (v1.2.0+): 3-column
interface RosterEntry {
  phase: string;
  agent: string;  // "engagement-leader" or "engagement-leader (path/to/file.md)"
  responsibility?: string;  // Optional, defaults to "${phase} specialist"
}
```

**Rationale**:
- Reduces YAML complexity
- Eliminates `group` redundancy (information from `responsibility`)
- Simplifies `file` into `agent` with inline exception notation

**Migration**: Automatic migration with default value generation

---

**1.3 Layout Reconstruction Simplification**

**Change**: 8-step process → 3-step process

```typescript
// Before (v1.5.0 proposal): 8-step over-engineering
// 1. Parse L0 Base Body
// 2. Update L0 Custom Sections
// 3. Generate Variant Sections
// 4. Apply Agent Substitution
// 5. Assemble Layout
// ... (300-400 lines of code)

// After (v1.2.0+): 3-step simple approach
function reconstructPMContent(l0Path, l1Config, l2Config) {
  // Step 1: Parse L0 base content
  const l0Content = parsePMFile(readFile(l0Path));
  
  // Step 2: Merge frontmatter
  const mergedFrontmatter = mergeFrontmatter(l0Content, l1Config, l2Config);
  
  // Step 3: Apply variant sections
  let finalBody = l0Content.body;
  for (const sectionConfig of variantSections.reverse()) {
    finalBody = applySection(finalBody, sectionConfig);
  }
  
  return { frontmatter: mergedFrontmatter, body: finalBody };
}
```

**Rationale**:
- 60-70% code reduction (300-400 lines → 80-100 lines)
- Removes hardcoded `PM_CUSTOM_SECTIONS` list
- Configuration-driven instead of procedure-driven

**Migration**: No breaking changes (internal refactoring)

---

**1.4 Security Hardening**

**Change**: YAML injection protection

```typescript
// NEW (v1.3.0+): Security validation
function validateYAMLSecurity(config, basePath) {
  // 1. White-list based path validation
  if (config.extends) {
    const resolvedPath = resolvePath(basePath, config.extends);
    if (!isWithinWorkspace(resolvedPath)) {
      throw new Error("Security: extends path outside workspace");
    }
  }
  
  // 2. External URL blocking
  if (/^https?:\/\//.test(config.extends || "")) {
    throw new Error("Security: external extends not allowed");
  }
  
  // 3. Agent path validation
  if (config.variant_overrides?.agent_roster) {
    for (const entry of config.variant_overrides.agent_roster) {
      const agentPath = extractAgentPath(entry.agent);
      if (agentPath && !agentPath.startsWith("agents/") && 
          !agentPath.startsWith("vendors/")) {
        throw new Error(`Security: invalid agent path: ${agentPath}`);
      }
    }
  }
}
```

**Rationale**:
- Prevents path traversal attacks (`../../../etc/passwd`)
- Blocks external URL references (`https://evil.com/pm.md`)
- White-list approach (only `agents/`, `templates/`, `vendors/` allowed)

**Performance Impact**: Mitigated via caching (see Phase 3)

---

**1.5 Error Recovery Strategy**

**Change**: Structured error types with recoverable/unrecoverable classification

```typescript
// NEW (v1.3.0+): Error recovery
enum ErrorType {
  // Unrecoverable (fatal)
  CIRCULAR_REFERENCE = "circular_reference",
  SECURITY_VIOLATION = "security_violation",
  
  // Recoverable (warning)
  MISSING_FILE = "missing_file",
  MISSING_SECTION = "missing_section",
  INVALID_YAML = "invalid_yaml"
}

interface ResolutionError {
  type: ErrorType;
  path: string;
  message: string;
  recoverable: boolean;
  suggestion: string;
}

function resolveExtendsChainWithRecovery(filePath): ExtendsResolutionResult {
  const errors = [];
  
  try {
    // ... resolution logic
    
    return { success: true, content, errors: [] };
    
  } catch (error) {
    errors.push({
      type: classifyError(error),
      path: filePath,
      message: error.message,
      recoverable: isRecoverable(error),
      suggestion: getRecoverySuggestion(error)
    });
    
    // Attempt recovery for recoverable errors
    if (errors[0].recoverable) {
      return { 
        success: true, 
        content: getDefaultFallback(),
        errors,
        warnings: [`Using fallback: ${errors[0].message}`]
      };
    }
    
    return { success: false, errors };
  }
}
```

**Rationale**:
- Clear user guidance via `suggestion` field
- Graceful degradation for recoverable errors
- Prevents total system failure on partial errors

---

### Phase 2: Edge Case Documentation (v1.3.0)

**Timeline**: Immediate (Phase 1+ implementation, 1 hour)
**Priority**: P1

**2.1 Documented Edge Cases**

The following edge cases are now documented with specific behaviors:

1. **Missing L0 Section**: Throw error with clear message
2. **Circular Extends**: Detect immediately, terminate with fatal error
3. **Conflicting variant_sections**: Last action wins, with warning
4. **Empty variant_sections**: Handled gracefully (no-op)
5. **Invalid action**: Throw error (must be prepend/replace/append)
6. **Missing extends**: Use default L0 with warning
7. **Deep extends chain (>10)**: Throw error (depth limit exceeded)
8. **Duplicate sections**: Merge with warning
9. **Invalid YAML syntax**: Throw clear syntax error
10. **File permission errors**: Throw permission error with recovery suggestion

**Documentation Location**: `docs/designs/pm-md-operations-guide.md` → "Edge Cases and Error Handling" section

---

### Phase 3: Performance & Operations (v2.0.0, Long-term)

**Timeline**: 6-12 months after Phase 1+ completion
**Priority**: P2
**Breaking Change**: No (backward compatible)

**3.1 Caching Strategy**

**Proposal**: LRU cache for extends chain resolution

```typescript
const extendsCache = new LRUCache({ 
  max: 100,
  ttl: 1000 * 60 * 60  // 1 hour
});
```

**Performance Targets**:
- Cache hit rate: 50%+
- Resolution time: <10ms (cached) vs <100ms (uncached)

**Activation**: `--no-cache` CLI flag to bypass

---

**3.2 Observability**

**Proposal**: Structured logging with DEBUG mode

```typescript
class StructuredLogger {
  log(log: ResolutionLog) {
    if (process.env.DEBUG === '1') {
      console.log(JSON.stringify(log, null, 2));
    } else if (log.level === 'error') {
      console.error(JSON.stringify(log, null, 2));
    }
  }
}
```

**Metrics**:
- Cache hit rate
- Average resolution time
- Max chain depth
- Error rate by type

---

### Phase 4: Extensibility & Internationalization (v2.5.0+, Long-term)

**Timeline**: 12-18 months after Phase 3 completion
**Priority**: P3
**Breaking Change**: Yes (v1.x → v2.0)

**4.1 Extensibility Design**

**Proposal**: Pluggable section processors

```typescript
interface SectionProcessor {
  type: string;
  priority: number;
  process(content: string, config: any): string;
}

// Built-in
registry.register({ type: "variant_sections", priority: 100, ... });

// Future custom
registry.register({ type: "section_append", priority: 200, ... });
```

**Breaking Change**: Major version bump to v2.0.0

---

**4.2 Internationalization (i18n)**

**Proposal**: Multi-language YAML fields and error messages

<!-- Korean text in code example is intentional source material -->
```typescript
const LOCALES = {
  'en': { variant_sections: 'variant_sections', ... },
  'ko': { variant_sections: 'variant_섹션', ... },
  'ja': { variant_sections: 'variant_セクション', ... }
};
```

**Breaking Change**: Major version bump to v2.0.0

---

## Consequences

### Positive

- **Improved security**: YAML injection protection
- **Better UX**: Clear error messages with recovery suggestions
- **Simpler implementation**: 60-70% code reduction
- **Performance optimization**: 50%+ improvement with caching
- **Future-proof**: Extensibility and i18n foundation

### Negative

- **Increased complexity**: More validation layers
- **Migration cost**: 5 variants require updates
- **Performance overhead**: Security validation (mitigated by caching)
- **Long-term maintenance**: Translation overhead for i18n

### Neutral

- **No breaking changes** in Phase 1-2 (v1.2.0 - v1.6.0)
- **Breaking changes** in Phase 4 (v2.0.0+) with migration guide

---

## Implementation Status

| Phase | Version | Status | Target Date |
|-------|---------|--------|-------------|
| Phase 1 (Core improvements) | v1.2.0 - v1.3.0 | 📋 Proposed | 2026-06 (Immediate) |
| Phase 2 (Edge cases) | v1.3.0 | 📋 Proposed | 2026-06 (Immediate) |
| Phase 3 (Performance) | v2.0.0 | 📋 Proposed | 2027 Q1-Q2 (6-12 months) |
| Phase 4 (Extensibility) | v2.5.0+ | 📋 Proposed | 2027 Q3-Q4 (12-18 months) |

---

## Alternatives Considered

### Alternative 1: Keep 8-Step Layout Reconstruction

**Rejected**: Over-engineering, 300-400 lines of code vs 80-100 lines needed

### Alternative 2: No Security Validation

**Rejected**: Critical security vulnerability (YAML injection)

### Alternative 3: Implement Extensibility Now (v1.3.0)

**Rejected**: No current demand, adds complexity prematurely

### Alternative 4: Implement i18n Now (v1.3.0)

**Rejected**: No current demand for non-English variants, translation overhead

---

## References

- **Meeting 1**: pm-md-operations-guide design content review (2026-06-08)
- **Meeting 2**: pm-md-operations-guide additional improvements review (2026-06-08)
- **Design Document**: docs/designs/pm-md-operations-guide.md
- **Related ADRs**: ADR-0031, ADR-0039

---

*End of ADR-0034*
