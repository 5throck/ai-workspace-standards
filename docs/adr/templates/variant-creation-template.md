# ADR NNNN: <variant-name> Variant Creation

**Status**: Proposed / Accepted / Rejected
**Date**: YYYY-MM-DD
**Decision Type**: Tech Strategy / Architecture
**Applies To**: <variant-name> variant
**PR**: <link-to-PR-if-exists>

---

## Context

### Problem Statement

**Current state (L2 project)**:
- Description of the L2 project being converted
- Key characteristics and domain focus
- Current agent roster, skills, workflows
- Platform-specific implementations

**Gap in current variants**:
- Why existing variants don't cover this use case
- What unique domain/workflow this variant addresses
- Evidence of user demand (project count, community requests)

**Workspace impact**:
- How this variant changes workspace architecture
- Dependencies on L0/L1 layers
- Platform parity considerations

### Driving Forces

**Benefits of creating <variant-name> variant**:
1. [Benefit 1 - specific, measurable]
2. [Benefit 2 - specific, measurable]
3. [Benefit 3 - specific, measurable]

**Risks of inaction**:
1. [Risk 1 - specific consequence]
2. [Risk 2 - specific consequence]
3. [Risk 3 - specific consequence]

**Stakeholder impact**:
- **Development team**: [impact]
- **Project maintainers**: [impact]
- **Workspace architects**: [impact]
- **Variant users**: [impact]

---

## Decision

Create <variant-name> variant as new template under `templates/<variant-name>/`.

### Variant Profile

| Attribute | Value |
|-----------|-------|
| **Variant Name** | <variant-name> |
| **Domain Focus** | [description] |
| **Target Users** | [user persona] |
| **Phase 3 Name** | [phase 3 workflow name] |
| **Initial Version** | 0.1.0 (beta) |
| **Initial Status** | beta |
| **Inherits Common** | [current L1 version] |

### Agent Roster (Variant-Specific)

| Agent | Role | Phase | Justification |
|-------|------|-------|---------------|
| <agent1> | <role> | <phases> | <why needed> |
| <agent2> | <role> | <phases> | <why needed> |

### Skills (Variant-Specific)

| Skill | Layer | Used By | Platform Parity |
|-------|-------|---------|-----------------|
| <skill1> | local/platform | <agents> | required/skip |
| <skill2> | local/platform | <agents> | required/skip |

### PM Override Type

**Override Type**: additive / replacement / none

**Override Reason**: <why PM behavior differs from base>

**What This Means**:
- If `additive`: Variant adds specialized agents to base PM workflow
- If `replacement`: Variant completely replaces PM workflow (rare)
- If `none`: Variant uses base PM workflow unchanged

### Platform Parity Strategy

| Platform | Support Status | Implementation |
|----------|----------------|----------------|
| **Claude Code** | Full / Partial / None | <notes> |
| **Gemini** | Full / Partial / None | <notes> |
| **Antigravity** | Full / Partial / None | <notes> |

---

## Consequences

### Positive Impacts

**1. [Impact area 1]** (High/Medium/Low value):
- [Specific benefit 1]
- [Specific benefit 2]

**2. [Impact area 2]** (High/Medium/Low value):
- [Specific benefit 1]
- [Specific benefit 2]

### Negative Impacts

**1. [Risk area 1]** (High/Medium/Low risk):
- [Specific negative impact]
- **Mitigation**: [how addressed]

**2. [Risk area 2]** (High/Medium/Low risk):
- [Specific negative impact]
- **Mitigation**: [how addressed]

### Template Version Impact

**L1 (templates/common/) Version Impact**:
- Current L1 version: [X.Y.Z]
- New variant inherits: [X.Y.Z]
- L1 bump required: Yes/No
- If L1 bumps in future: [impact on this variant]

**L1 Bumping Policy**:
- **Scenario A**: L1 bumps from X.Y.Z to X.Y.(Z+1) (PATCH)
  - **Impact**: Compatible upgrade, variant inherits automatically
  - **Action**: Run Phase 2 reconciliation on next sync

- **Scenario B**: L1 bumps from X.Y.Z to X.(Y+1).0 (MINOR)
  - **Impact**: May include breaking changes to common layer
  - **Action**: Review variant compatibility, test thoroughly

- **Scenario C**: L1 bumps from X.Y.Z to (X+1).0.0 (MAJOR)
  - **Impact**: Breaking changes to common layer structure
  - **Action**: **REQUIRED** - Run full L2-to-variant pipeline reconciliation
  - **Rationale**: MAJOR changes may invalidate variant assumptions

### L1 Version Dependency Registration

**Update to VERSION_REGISTRY.json**:

```json
{
  "version": "1.0.0",
  "last_updated": "YYYY-MM-DD",
  "description": "Central version registry for all template variants",
  "variants": {
    "<variant-name>": {
      "latest": "0.1.0",
      "released": "YYYY-MM-DD",
      "status": "beta",
      "inherits_common": "X.Y.Z",
      "common_version_policy": {
        "patch_auto_inherit": true,
        "minor_requires_review": true,
        "major_requires_reconciliation": true
      },
      "security_advisories": [],
      "migration_guides": []
    }
  },
  "schema_version": "1.1"
}
```

**New Schema Fields (v1.1)**:
- `inherits_common`: L1 version this variant inherits from
- `common_version_policy.patch_auto_inherit`: Auto-inherit PATCH updates
- `common_version_policy.minor_requires_review`: Review MINOR updates for compatibility
- `common_version_policy.major_requires_reconciliation`: **REQUIRED** - Full pipeline reconciliation on MAJOR updates

### Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **[Risk 1]** | High/Medium/Low | Low/Medium/High | [Mitigation strategy] |
| **[Risk 2]** | High/Medium/Low | Low/Medium/High | [Mitigation strategy] |

### Alternatives Considered

**Alternative 1: [Alternative description]**
- **Pros**: [Pro 1], [Pro 2]
- **Cons**: [Con 1], [Con 2]
- **Decision**: Rejected / Accepted - [rationale]

**Alternative 2: [Alternative description]**
- **Pros**: [Pro 1], [Pro 2]
- **Cons**: [Con 1], [Con 2]
- **Decision**: Rejected / Accepted - [rationale]

**Alternative 3: [Alternative description]**
- **Pros**: [Pro 1], [Pro 2]
- **Cons**: [Con 1], [Con 2]
- **Decision**: Rejected / Accepted - [rationale]

### Implementation Timeline

| Phase | Duration | Owner | Deliverables |
|-------|----------|-------|--------------|
| **ADR Creation** | 1-2 days | Architect | ADR document, PM approval |
| **Phase 1 (Analysis)** | 2-3 days | Architect | L2 scan, intermediate manifest |
| **Phase 2 (Reconcile)** | 2-3 days | Architect | Reconciled manifest |
| **Phase 3 (Generate)** | 3-5 days | Automation Engineer | Variant structure, validation |
| **Phase 3.5 (Beta Setup)** | 2-3 days | Lifecycle Manager | Beta lifecycle, documentation |
| **Phase 4 (Integration)** | 3-5 days | PM + Docs Writer | Workspace updates, propagation |
| **Phase 5 (Validation)** | 2-3 days | PM + Auditor | QA audit, testing |
| **Total** | 15-25 days | Full team | Production-ready beta variant |

### Success Criteria

- [ ] ADR approved by PM and Platform Lead
- [ ] L2 project analysis complete (Phase 1)
- [ ] L0/L1 reconciliation complete (Phase 2)
- [ ] Variant structure generated (Phase 3)
- [ ] Beta lifecycle initialized (Phase 3.5)
- [ ] Workspace integration complete (Phase 4)
- [ ] All validation tests passing (Phase 5)
- [ ] Test project creation successful
- [ ] Platform parity validated
- [ ] VERSION_REGISTRY.json updated with L1 dependency

### References

- **L2 Project**: [path-or-link]
- **CONSTITUTION.md**: [link-to-relevant-sections]
- **Variant Lifecycle**: [link-to-variant-lifecycle-governance]
- **Template Version Policy**: [link-to-version-policy-document]

---

**Decision made by**: PM [Name]
**Date**: YYYY-MM-DD
**Status**: **Proposed** / **Accepted** / **Rejected**

---

*Next action: [Execute Phase 1] / [Revise ADR] / [Reject variant creation]*
