# Meeting Transcript

**Date**: 2026-06-07
**Topic**: Additional review items - identifying uncovered issues and edge cases in template structure reform
**Participants**: architect, docs-writer, automation-engineer, security-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

PM Facilitator opened meeting to identify **additional review items** that were missed in previous discussions about template structure reform. Goal: catch edge cases, technical barriers, and security risks before implementation.

---

## Round 1

### **architect** (Round 1)

Identified **3 critical overlooked items** from structural review:

**Overlooked 1: Actual Implementation of VARIANT-SECTION Markers**
Previous meeting decided on extends pattern, but **how to actually implement**?
- How to handle `<!-- VARIANT-SECTION: agent-roster -->` markers in variant pm.md?
- Does scaffold script need to recognize and replace these markers?
- Or should we completely deprecate markers and use pure frontmatter extends?

**Overlooked 2: Merge Complexity at Scaffold Time**
Decided to keep only L1 for context.md, but **when variant has <variant>.context.md**:
- How to merge L1's context.md with L2's <variant>.context.md?
- Section-level merge or entire file replacement?
- Priority on conflict?

**Overlooked 3: Impact on Existing Projects**
When template structure changes, **what happens to already-generated projects**?
- Migration path needed?
- Or do template changes only apply to new projects?

Asked automation-engineer: What technical risks do you see from implementation perspective?

---

### **automation-engineer** (Round 1)

Confirmed significant **technical barriers**:

**Barrier 1: Actual Implementation of extends Pattern**
Frontmatter alone is insufficient:
```yaml
# This is not enough
extends: "../../../../agents/pm.md"
overrides:
  - "## Agent Roster"
```
Actually needed:
- **Merge engine**: YAML/YAML merge, section-level merge, strategic merge - must choose
- **File parsing**: Marker recognition, section extraction, reassembly logic
- **Fallback strategy**: Rollback method when merge fails

**Barrier 2: Scaffold Script Complexity**
Current `create-l2-scaffold.ts` is simple copy. Implementing extends requires:
- 4-stage logic: Read → Parse → Merge → Write
- Recursive extends handling (L2 extends L1, L1 extends L0)
- Error handling and user feedback

**Barrier 3: Consistency Check Complexity**
For audit.ts to validate extends chain:
- **Circular reference detection**: Prevent L2→L1→L2... infinite loop
- **File existence check**: Verify extends target actually exists
- **Version compatibility**: Handle when extends target changes

Asked security-expert: Does this increased complexity introduce security risks?

---

### **security-expert** (Round 1)

Confirmed complexity increase **definitely introduces security risks**. Identified **security perspective risks**:

**Risk 1: Governance Breakdown via Implementation Bugs**
- Complex merge logic → Higher bug probability
- Extends chain validation failure → Wrong PM load possible
- Result: PM Gateway bypass, unauthorized code execution possible

**Risk 2: Circular Reference Attack Vector**
- Can malicious variant.json create circular references?
- L2→L1→L2... infinite loop stops system
- Currently no circular detection logic exists

**Risk 3: Drift from Inconsistency Detection Failure**
- Workspace pm.md change → No automatic variant pm.md update
- audit.ts cannot check consistency
- Over time, different PM versions coexist

**Proposed Safeguards**:
1. **Circular Reference Prevention**: Extends chain validation logic mandatory (depth limit)
2. **Forced Synchronization**: Verify variant consistency when workspace pm.md changes
3. **Rollback Mechanism**: Safe fallback when extends fails

Asked docs-writer: How should these constraint constraints be reflected in documentation?

---

### **docs-writer** (Round 1)

Important security concerns. From documentation management perspective, identified **additional overlooked items**:

**Overlooked 4: Platform Parity Documentation Missing**
extends pattern may behave differently on Claude Code vs Antigravity:
- Claude Code: Native Agent tool, frontmatter reading
- Antigravity: invoke_subagent, separate parser
- Will extends chain be interpreted differently on two platforms?

**Overlooked 5: Migration Path Missing**
Existing projects issue mentioned by architect:
- If 100 projects already exist?
- Manual migration to apply template changes?
- Or template version pinning to protect legacy projects?

**Overlooked 6: ADR and Document Consistency**
New documents to be created:
- `docs/adr/0032-deprecate-auto-mode.md`
- `docs/adr/0033-l0-l1-l2-hierarchy.md`
- `templates/common/docs/variant-pm-spec.md` (updated)
- How to maintain cross-references and consistency between these?

**Proposed Review Items**:
1. extends implementation decision (frontmatter only vs marker hybrid)
2. Circular reference prevention mechanism
3. Platform parity test method
4. Migration strategy for existing projects
5. Document version management and cross-reference system

Asked architect, automation-engineer, security-expert for opinions on these 5 additional items?

---

## Round 2

### **architect** (Round 2)

Provided structural proposals for the 5 items identified by docs-writer:

**Item 1: extends Implementation → Frontmatter Only**
Markers (`<!-- VARIANT-SECTION -->`) should be **completely deprecated**:
- Pros: Single parsing method (YAML frontmatter only)
- Pros: Pure YAML extends, IDE-friendly
- Cons: Need to remove markers from existing variant pm.md

**Item 2: Circular Reference Prevention**
```
Extends chain validation:
- Max depth: 3 (L2→L1→L0)
- Circular detection: Track already-visited nodes
- On failure: Safe fallback (empty agent definition)
```

**Item 3: Platform Parity Testing**
```
validate-templates.ts additional checks:
- Claude Code: Frontmatter parsing test
- Antigravity: invoke_subagent test
- Verify both produce identical results
```

**Item 4: Migration Strategy**
**Template Versioning Approach**:
- Template versioning (v1.0 → v1.1)
- Existing projects: Keep template version at creation time (leave as-is)
- New projects: Use latest template version
- Migration: Optional (only if user wants)

**Item 5: Document Version Management**
```
docs/
├── adr/
│   ├── 0032-deprecate-auto-mode.md
│   └── 0033-l0-l1-l2-hierarchy.md
│       └─> References: 0032, variant-pm-spec
├── constitution/
│   └── 05-multi-agent-architecture.md
│       └─> References: 0033
└── (cross-reference system)
```

Asked automation-engineer, security-expert: Do you agree with this proposal? Especially regarding implementation complexity vs security risk balance.

---

### **automation-engineer** (Round 2)

Basically agreed with architect proposal but **implementation reality adjustment proposals**:

**Adjusted Proposal 1: Frontmatter Only + Graceful Migration**
Immediately deprecating markers completely is impractical:
- **Phase 1**: New variants use frontmatter only
- **Phase 2**: Existing variants support markers (backward compatibility)
- **Phase 3**: After all variants migrate to frontmatter only, deprecate markers

**Adjusted Proposal 2: Circular Reference Prevention + Timeout**
```typescript
// Extends chain validation
const MAX_EXTENDS_DEPTH = 3;
const MAX_FILE_SIZE = 100_000; // 100KB
const MAX_PARSE_TIME = 5000; // 5 seconds
```

**Adjusted Proposal 3: Platform Parity Testing**
Actual testing needed:
- Create new `scripts/test-platform-parity.ts`
- Generate same variant on both platforms
- Verify generated pm.md is identical

**Additional Risk Identified**: 
**Risk 4: IDE Friendliness**
- YAML frontmatter only looks good in IDE
- However extends chain is not visible in IDE (runtime interpretation)
- Developers must manually merge to see actually loaded content

This can cause docs-writer's documentation issues.

---

### **security-expert** (Round 2)

Evaluated automation-engineer's adjusted proposals and identified risk:

**Adjusted Proposal 1 (Phase Migration) → Agree**
- Backward compatibility guarantees rollout safety
- Prevents existing variants from breaking
- ✅ Security perspective: Supported

**Adjusted Proposal 2 (Timeout + Limits) → ✅ Strong Support**
```typescript
const MAX_EXTENDS_DEPTH = 3;
const MAX_FILE_SIZE = 100_000;
const MAX_PARSE_TIME = 5000;
```
These constraints are **essential for DoS prevention**.

**Risk 4 (IDE Friendliness) → New Security Problem**
The risk identified by automation-engineer is actually a **serious security problem**:
- Developers can't verify extends chain in IDE
- Wrong extends can lead to bugs
- Currently no way to validate this

**New Proposal: Validation Tool**
```bash
# Developer verify actually loaded pm.md
npm run validate:pm-extends --variant co-design

# Output: Full actually-loaded pm.md content
```
Without this tool, extends becomes "invisible magic" that causes bugs.

---

### **docs-writer** (Round 2)

Synthesized additional risks and proposals from documentation management perspective:

**Confirmation Needed**:
1. **Phase Migration Documentation**: Should automation-engineer's 3-phase migration be recorded in ADR?
2. **Validation Tool Documentation**: Where to document security-expert's proposed `validate:pm-extends` tool usage?
3. **Platform Parity Test Results**: Where to record test results?

**Proposed Review Items (Final)**:
Now organizing final items that need review.

---

## Synthesis

### Newly Identified Overlooked Items (8 total)

| # | Item | Impact | Priority |
|---|------|-------|----------|
| **N-1** | extends actual implementation (frontmatter only vs marker hybrid) | Implementation complexity | High |
| **N-2** | Scaffold time merge logic (L1 + L2 context.md merge) | Implementation complexity | High |
| **N-3** | Existing project migration strategy | Backward compatibility | Medium |
| **N-4** | Circular reference prevention (depth limit, timeout, file size limit) | Security (DoS) | High |
| **N-5** | Platform parity testing (verify extends behavior on both platforms) | Platform difference | High |
| **N-6** | IDE friendliness (can developers verify extends chain?) | Developer experience | Medium |
| **N-7** | Validation Tool (`validate:pm-extends`) necessity | Quality assurance | Medium |
| **N-8** | ADR and document cross-reference system | Governance | Low |

### Integration with Existing Action Items

New Action Items needed in addition to existing A-01 ~ A-05:

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| **A-06** | architect | High | Finalize extends implementation decision - frontmatter only vs marker hybrid, 3-phase migration plan | Both | Phase 1-2 |
| **A-07** | automation-engineer | Medium | Implement circular reference prevention - depth limit, timeout, file size limit, safe fallback | Both | Phase 4 |
| **A-08** | automation-engineer | Medium | Create platform parity test script - `test-platform-parity.ts` | Both | Phase 4 |
| **A-09** | automation-engineer | Low | Implement Validation Tool - `validate:pm-extends` CLI tool | Both | Phase 4 |
| **A-10** | docs-writer | Medium | Document Migration Path - impact on existing projects and migration method | Both | Phase 4 |
| **A-11** | security-expert | Medium | Add extends chain security check - circular reference detection in audit.ts | Both | Phase 6 |

### Modified Execution Plan (existing + new items)

**Total 11 items** (original 5 + new 6)

**Sequence Optimization**:
1. **Phase 1-2** (Design): A-01, A-06 - Decide structure and implementation approach
2. **Phase 4** (Implementation): A-02, A-03, A-04, A-07, A-08, A-09, A-10 - Parallel implementation work
3. **Phase 6** (QA): A-05, A-11 - Verification and security checks

---

## Relation to Previous Meetings

Builds upon:
1. `meeting-2026-06-07-template-consistency.md` - Initial template consistency issues
2. `meeting-2026-06-07-pm-single-source-auto-mode.md` - L0→L1→L2 hierarchy and Auto-Mode removal

Identified critical implementation gaps and security concerns not addressed in previous discussions.

---

*Transcript created by: pm*
*Synthesis by: auditor (cross-domain agent)*