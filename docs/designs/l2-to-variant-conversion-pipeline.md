# L2-to-Variant Conversion Pipeline Design

> **Architect**: Design document for converting L2 projects into new template variants
> **Status**: Draft Design - Implementation In Progress
> **Created**: 2026-06-03
> **Last Updated**: 2026-06-22 (Added Phase 1.6 pm.md pre-flight and Phase 3.5 AGENTS.md §-structure check; v1.8.2)
> **Phase**: 4 - Implementation

---

## Executive Summary

This document defines the architectural design for a pipeline that analyzes user-created L2 projects and converts them into new template variants (e.g., `templates/<new-variant>/`).

**Problem Statement**: Users create projects under the workspace root that evolve into reusable patterns. Converting these evolved projects into template variants is currently a manual, error-prone process with undefined steps. **Critical Gaps**:
1. **No ADR requirement for new variants** — Variant creation lacks architectural decision documentation
2. **No lifecycle governance for new variants** — All variants default to "stable" status without validation
3. **No template version management policy** — L1 (templates/common/) version impact unclear

**Solution**: An automated pipeline with two stages and multiple phases:

**Stage 1 — Scan & Prepare** (source normalization before generation):
1. **Phase 0 - ADR Creation**: Architectural decision record for variant creation rationale
2. **Phase 1 - Variant Structure Conversion**: Analyze L2 project → Extract variant-specific components
3. **Phase 1.5 - Agent/Skill Frontmatter Normalization**: Validate agent/skill frontmatter fields
4. **Phase 1.6 - pm.md Pre-flight Diagnosis** *(NEW, v1.8.2)*: Check L2 agents/pm.md structure — `extends:` pattern, 200-line limit, duplicate section detection vs L1 common pm.md
5. **Phase 2 - L0/L1 Reflection**: Compare with workspace → Reconcile versions → Repropagate
6. **Phase 3 - Dependency Validation**: Confirm dependency resolution
7. **Phase 3.5 - AGENTS.md §-Structure Check** *(NEW, v1.8.2, BLOCKING)*: Validate L2 AGENTS.md for VARIANT-\*-START/END markers and §1:/§3: section presence

**Stage 2 — Generate & Validate** (generation with post-generation QA):
8. **Phase 4 - Variant Generation**: Create variant structure with **BETA DEFAULT** (status="beta", version="0.1.0")
9. **Phase 4.5 - Golden Reference Gap Check** *(BLOCKING, double-defense)*: Validate generated AGENTS.md structure against golden reference
10. **Phase 4.6 - pm.md Generation Completion**: Inject variant-specific sections into generated pm.md; generate context.md
11. **Phase 5 - Beta Lifecycle Initialization**: Initialize lifecycle tracking, documentation, and promotion pathway
12. **Phase 6 - Platform Parity Validation**: Verify .claude/ ↔ .gemini/ parity
13. **Phase 7 - Workspace Integration**: Workspace updates and integration

**Key Innovation**: The pipeline respects SSOT (Single Source of Truth) principles by:
- **NEW**: Requiring ADR for all new variant creations (governance enforcement)
- Detecting L0/L1 overlaps before template creation
- Version-aware reconciliation (keep newer version)
- Anti-swelling protection (prevent duplicate content in variants)
- Platform parity validation (.claude/ ↔ .gemini/)
- **NEW**: **Beta lifecycle governance** (all new variants start as beta, promote to stable after validation)
- **NEW**: **Template version management** (L1 version impact policy and bumping rules)
- **NEW (v1.8.2)**: **Pre-flight source normalization** — Phase 1.6 (pm.md structure check) and Phase 3.5 (AGENTS.md §-structure BLOCKING gate) ensure L2 source is in a generatable state before Stage 2 begins

---

## 1. System Architecture

### 1.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    L2-to-Variant Pipeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │   Phase 1    │      │   Phase 2    │      │   Phase 3    │  │
│  │  Analysis    │ ───► │  Reconcile   │ ───► │  Generate    │  │
│  │              │      │              │      │              │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                   │
│  Input: L2 Project                                              │
│  Output: templates/<new-variant>/                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
L2 Project Path (User Input)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: Variant Structure Conversion                      │
├─────────────────────────────────────────────────────────────┤
│  1. Scan L2 project structure                                │
│  2. Categorize files (agents/, skills/, .claude/, .gemini/) │
│  3. Identify variant-specific additions                     │
│  4. Generate intermediate manifest                          │
└─────────────────────────────────────────────────────────────┘
    │
    │  Intermediate Manifest
    │  (JSON: files, versions, origins)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: L0/L1 Reflection & Reconciliation                  │
├─────────────────────────────────────────────────────────────┤
│  5. Compare with L0 (workspace root)                        │
│  6. Compare with L1 (templates/common/)                     │
│  7. Version comparison (keep newest)                         │
│  8. Reclassification: common vs variant-specific            │
│  9. Anti-swelling check (≥50% override = move to common)    │
└─────────────────────────────────────────────────────────────┘
    │
    │  Reconciled Manifest
    │  (JSON: keep-in-variant, move-to-common, discard)
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: Variant Generation                                 │
├─────────────────────────────────────────────────────────────┤
│  10. Generate variant.json                                   │
│  11. Copy variant-specific files                           │
│  12. Generate CLAUDE.md/GEMINI.md                           │
│  13. Generate README.md                                     │
│  14. Platform parity validation                            │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
templates/<new-variant>/
```

> **Note on Phase numbering alignment**: This design document uses the implementation phase numbering from `scripts/l2-to-variant-pipeline.ts`. Phases 1.6 and 3.5 were added in v1.8.2 (2026-06-22) after the original design (Phase 0-4) was written. The original design's "Phase 3.5 - Beta Lifecycle Setup" now corresponds to implementation **Phase 5**.

---

## 1.5. Stage 1 Pre-flight Checks (v1.8.2 — NEW)

> **Implementation**: `scripts/l2-to-variant-pipeline.ts` v1.8.2 | `docs/adr/0046-l2-pipeline-preflight-checks.md`

Phase 1.6 and Phase 3.5 were introduced to normalize L2 source files before Stage 2 generation begins. The principle: **ensure the source is in a generatable state before generating**.

### Phase 1.6: pm.md Pre-flight Diagnosis (Non-blocking)

**Objective**: Detect L2 `agents/pm.md` structural problems that would cause duplication bugs or incorrect generation.

**Position in pipeline**: After Phase 1.5 (agent/skill frontmatter normalization), before Phase 2 (L0/L1 reconciliation).

**Severity**: Non-blocking (warn only). Human review is possible for pm.md issues.

**Checks performed**:

| Check | Threshold | Action |
|-------|-----------|--------|
| `extends:` pattern presence | Required | WARN if missing — L2 pm.md should delegate common content via `extends: ../../common/agents/pm.md` |
| Line count | ≤ 200 lines | WARN if exceeded — proxy for L0 duplication bug (common content duplicated in L2) |
| Duplicate section headers | 0 | WARN for each L1 section found verbatim in L2 — indicates redundant content |

**Auto-fix** (`config.autoFixPmMd: true`): Outputs guidance only (does not modify source files by default). Modification only with explicit `--auto-fix` flag + git backup.

**Role distinction**:
- Phase 1.6 = **source diagnosis** (reads L2 source, outputs report)
- Phase 4.6 = **generation completion** (writes into the generated variant file — not the source)

### Phase 3.5: AGENTS.md §-Structure Check (BLOCKING)

**Objective**: Validate L2 `AGENTS.md` has all required VARIANT-\*-START/END markers and §-numbered sections before Stage 2 generation. Missing markers cause `injectVariantPlaceholders()` in `generate-variant.ts` to silently no-op, leaving AGENTS.md unpopulated.

**Position in pipeline**: After Phase 3 (dependency validation), immediately before Phase 4 (variant generation).

**Severity**: BLOCKING — pipeline halts if any required marker is missing.

**Checks performed**:

| Check | Required Items | Action |
|-------|----------------|--------|
| VARIANT-\* markers | 6 markers (AGENTS, AGENT-DETAILS, DISPATCH-TRIGGERS, PHASE-GATE, SUBAGENT-ROSTER, ROLE-BOUNDARY) | FAIL pipeline if any missing |
| §-numbered sections | `## §1:` and `## §3:` minimum | FAIL pipeline if missing |

**Auto-fix** (`config.autoFixAgentsMd: true`): Calls `regenerate-agents-md.ts --variant <name>` via subprocess to regenerate the AGENTS.md from L1 common template + variant agent frontmatter. Only runs if variant path is under `templates/`.

**Double-defense**: Phase 4.5 (Golden Reference Gap Check) also validates VARIANT-\* markers in the generated output, guarding against `--skip-normalize` bypass and external structural edits.

**Root cause this addresses**: co-consult, co-work, co-security, co-design AGENTS.md were generated before the §-numbered L1 structure was introduced → had no VARIANT-\*-START/END markers → pipeline injection found no anchors → silent drift. Fixed by `regenerate-agents-md.ts --all` (2026-06-22).

---

## 2. Phase 0: ADR Creation (Governance Gate)

**Objective**: Ensure all new variant creations are documented with architectural decision records before pipeline execution.

**Ownership**: architect agent (PM-dispatched) creates ADR, PM approves, then pipeline proceeds.

**Execution Timing**: BEFORE Phase 1 (Variant Structure Conversion) begins. This is a **blocking gate** — the pipeline cannot proceed without an approved ADR.

---

### 2.1 ADR Requirement Rationale

**Problem**: New variant creation significantly impacts workspace architecture:
- Introduces new agent rosters, skills, workflows
- Changes governance landscape (PM overrides, lifecycle rules)
- Affects L1 (templates/common/) version dependencies
- Impacts platform parity requirements
- Commits workspace to long-term maintenance

**Without ADR**:
- No architectural decision documentation
- No rationale for variant creation
- No alternative analysis
- No impact assessment
- No stakeholder review

**With ADR**:
- Clear decision rationale documented
- Alternatives considered and rejected
- Impact on workspace architecture assessed
- Stakeholder approval recorded
- Audit trail for future governance decisions

---

### 2.2 ADR Template for Variant Creation

**ADR File**: `docs/adr/YYYYMM-variant-creation-<variant-name>.md`

**Template Structure**:

```markdown
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
| **Phase 0 (ADR)** | 1-2 days | Architect | ADR document, PM approval |
| **Phase 1 (L2 Scan)** | 2-3 days | Automation Engineer | L2 scan, intermediate manifest |
| **Phase 1.5 (Frontmatter)** | < 1 day | Automation Engineer | Normalized agent/skill frontmatter |
| **Phase 1.6 (pm.md Pre-flight)** *(NEW)* | < 1 day | Automation Engineer | pm.md structure report, optional auto-fix |
| **Phase 2 (Reconcile)** | 2-3 days | Automation Engineer | Reconciled manifest |
| **Phase 3 (Dependencies)** | 1-2 days | Automation Engineer | Dependency validation |
| **Phase 3.5 (AGENTS.md Check)** *(NEW, BLOCKING)* | < 1 day | Automation Engineer | AGENTS.md §-structure validated; auto-regenerate if `--auto-fix-agents-md` |
| **Phase 4 (Generate)** | 3-5 days | Automation Engineer | Variant structure, VARIANT-* injection |
| **Phase 4.5 (Gap Check)** | < 1 day | Automation Engineer | Golden reference gap check (BLOCKING) |
| **Phase 4.6 (pm.md Completion)** | < 1 day | Automation Engineer | Variant pm.md sections injected; context.md generated |
| **Phase 5 (Beta Lifecycle)** | 2-3 days | Lifecycle Manager | Beta lifecycle tracking, documentation |
| **Phase 6 (Platform Parity)** | 1-2 days | PM | .claude/ ↔ .gemini/ parity validated |
| **Phase 7 (Integration)** | 2-3 days | PM + Docs Writer | Workspace updates, propagation |
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
```

---

### 2.3 ADR Gating Logic

**Pipeline Enforcement**:

The L2-to-variant pipeline **MUST NOT PROCEED** without an approved ADR. Implementation spec:

```typescript
/**
 * Verify ADR exists and is approved before pipeline execution
 * @version 1.0.0
 */

interface ADRValidationResult {
  approved: boolean;
  adrPath: string | null;
  status: 'approved' | 'not_found' | 'rejected' | 'pending';
  message: string;
}

function validateADRExists(variantName: string): ADRValidationResult {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Expected ADR path pattern: docs/adr/YYYYMM-variant-creation-<variant>.md
  const adrPattern = `docs/adr/${currentYear}${currentMonth}-variant-creation-${variantName}.md`;
  const adrPath = join(PROJECT_ROOT, adrPattern);
  
  if (!existsSync(adrPath)) {
    return {
      approved: false,
      adrPath: null,
      status: 'not_found',
      message: `ADR not found at ${adrPattern}. Create ADR before running pipeline. See template: docs/adr/templates/variant-creation-template.md`,
    };
  }
  
  const adrContent = readFileSync(adrPath, 'utf-8');
  
  // Check ADR status
  const statusMatch = adrContent.match(/\*\*Status\*\*:\s*(Proposed|Accepted|Rejected)/);
  if (!statusMatch) {
    return {
      approved: false,
      adrPath,
      status: 'pending',
      message: `ADR exists but status is not set. Must set 'Status: **Accepted**' in ADR before pipeline execution.`,
    };
  }
  
  const status = statusMatch[1] as 'Proposed' | 'Accepted' | 'Rejected';
  
  if (status === 'Rejected') {
    return {
      approved: false,
      adrPath,
      status: 'rejected',
      message: `ADR is rejected. Cannot proceed with variant creation.`,
    };
  }
  
  if (status === 'Proposed') {
    return {
      approved: false,
      adrPath,
      status: 'pending',
      message: `ADR is in 'Proposed' status. Must change to 'Status: **Accepted**' before pipeline execution.`,
    };
  }
  
  // Accepted - proceed
  return {
    approved: true,
    adrPath,
    status: 'approved',
    message: `ADR approved. Pipeline execution authorized.`,
  };
}

// Pipeline entry point - check ADR first
async function main() {
  const variantName = process.argv[2]; // --variant <name>
  
  console.log(`=== Phase 0: ADR Validation ===\n`);
  
  const adrCheck = validateADRExists(variantName);
  
  if (!adrCheck.approved) {
    console.error(`❌ ADR Check Failed: ${adrCheck.message}`);
    console.error(`\nRequired action:`);
    if (adrCheck.status === 'not_found') {
      console.error(`  1. Create ADR: docs/adr/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-variant-creation-${variantName}.md`);
      console.error(`  2. Use template: docs/adr/templates/variant-creation-template.md`);
      console.error(`  3. Set status: 'Status: **Accepted**'`);
    } else if (adrCheck.status === 'pending') {
      console.error(`  1. Review ADR: ${adrCheck.adrPath}`);
      console.error(`  2. Update status: Change 'Status: **Proposed**' to 'Status: **Accepted**'`);
    } else if (adrCheck.status === 'rejected') {
      console.error(`  1. Review rejection rationale in ADR: ${adrCheck.adrPath}`);
      console.error(`  2. Address concerns or create new ADR with revised proposal`);
    }
    process.exit(1);
  }
  
  console.log(`✅ ADR approved: ${adrCheck.adrPath}`);
  console.log(`\n=== Proceeding to Phase 1: Variant Structure Conversion ===\n`);
  
  // Continue to Phase 1...
}
```

---

### 2.4 ADR Acceptance Criteria

**ADR must include all following sections** (checklist):

- [ ] **Context**: Problem statement, driving forces, stakeholder impact
- [ ] **Decision**: Variant profile (name, domain, agents, skills, PM override type)
- [ ] **Consequences**: Positive/negative impacts, template version impact analysis
- [ ] **Template Version Impact**: L1 dependency, bumping policy (patch/minor/major scenarios)
- [ ] **L1 Version Dependency**: VERSION_REGISTRY.json schema updates documented
- [ ] **Risks and Mitigations**: Risk table with probability/impact/mitigation
- [ ] **Alternatives Considered**: At least 3 alternatives with pros/cons and decisions
- [ ] **Implementation Timeline**: Phase breakdown with durations and owners
- [ ] **Success Criteria**: 10+ criteria including governance and validation
- [ ] **Status**: Set to "**Accepted**" (not Proposed or Rejected)
- [ ] **References**: Links to L2 project, CONSTITUTION.md, variant lifecycle docs

**ADR Quality Gates**:

1. **Completeness**: All required sections present and populated
2. **Specificity**: Agent roster, skills, and workflows explicitly listed
3. **Template Version Policy**: L1 dependency and bumping rules clearly defined
4. **Risk Analysis**: At least 3 risks with mitigation strategies
5. **Alternatives**: Minimum 3 alternatives considered with clear rationale
6. **Approval**: PM and Platform Lead approval recorded

**ADR Approval Workflow**:

```
1. Architect drafts ADR (using template)
2. PM reviews ADR for completeness and accuracy
3. PM requests clarification if needed
4. Architect revises ADR based on PM feedback
5. PM approves ADR (changes status to "**Accepted**")
6. Platform Lead reviews and approves (for major architectural changes)
7. ADR status set to "**Accepted**"
8. Pipeline execution authorized
```

---

### 2.5 ADR Template File

**Template Location**: `docs/adr/templates/variant-creation-template.md`

**Template Creation** (Phase 4 integration step):

The automation-engineer must create the ADR template file during Phase 4 implementation. Template content should match the structure defined in §2.2 above.

**Acceptance Criteria**:

- [ ] Template file created at `docs/adr/templates/variant-creation-template.md`
- [ ] Template includes all required sections from §2.2
- [ ] Template includes placeholder examples for each field
- [ ] Template includes ADR acceptance criteria checklist
- [ ] Template includes approval workflow documentation
- [ ] Template references VERSION_REGISTRY.json schema v1.1

---

## 3. Phase 1: Variant Structure Conversion

### 2.1 L2 Project Analysis Strategy

**Objective**: Systematically categorize all files in the L2 project to understand:

1. **What's new** (not in L0/L1)
2. **What's modified** (exists in L0/L1 but different)
3. **What's inherited** (exists and identical to L0/L1)
4. **What's platform-specific** (.claude-only, .gemini-only, or both)

**File Classification Matrix**:

| File Path | In L0? | In L1? | Same? | Action |
|-----------|--------|--------|-------|--------|
| `agents/new-agent.md` | ❌ | ❌ | - | Keep as variant-specific |
| `agents/pm.md` | ✅ | ✅ | ❌ | Version compare → keep newer |
| `.claude/skills/new-skill/` | ❌ | ❌ | - | Keep as variant-specific |
| `.claude/settings.json` | ✅ | ✅ | ❌ | Diff → classify changes |
| `skills/project-review/` | ✅ | ✅ | ✅ | Discard (inherited) |

### 2.2 File Scanning Algorithm

```typescript
interface L2ScanResult {
  agents: FileClassification[];
  skills: FileClassification[];
  claude: FileClassification[];
  gemini: FileClassification[];
  docs: FileClassification[];
  scripts: FileClassification[];
  rootFiles: FileClassification[];
}

interface FileClassification {
  relativePath: string;
  existsInL0: boolean;
  existsInL1: boolean;
  l0Version?: string;
  l1Version?: string;
  l2Version?: string;
  hashL0?: string;
  hashL1?: string;
  hashL2?: string;
  classification: 'new' | 'modified' | 'identical' | 'conflict';
  platformScope: 'claude' | 'gemini' | 'both' | 'neutral';
}
```

**Implementation Approach** (for automation-engineer):

1. **Recursive directory traversal** of L2 project path
2. **Hash computation** for all files (SHA-256)
3. **L0/L1 lookup** by relative path:
   - L0 = workspace root (`agents/`, `skills/`, `.claude/`, `.gemini/`)
   - L1 = `templates/common/` equivalent paths
4. **Version extraction** from `@version` headers (`.md`, `.ts` files)
5. **Classification** using the matrix above

### 2.3 Intermediate Manifest Schema

```typescript
interface IntermediateManifest {
  scanMetadata: {
    l2ProjectPath: string;
    l2ProjectName: string;
    scannedAt: string;
    totalFiles: number;
    newFiles: number;
    modifiedFiles: number;
    identicalFiles: number;
  };
  classifications: {
    agents: FileClassification[];
    skills: FileClassification[];
    claude: FileClassification[];
    gemini: FileClassification[];
    docs: FileClassification[];
    rootFiles: FileClassification[];
  };
  variantCandidates: {
    variantSpecificAgents: string[];
    variantSpecificSkills: string[];
    variantSpecificCommands: string[];
    variantSpecificPlatformSkills: string[];
    overrideCandidates: OverrideCandidate[];
  };
}

interface OverrideCandidate {
  filePath: string;
  overrideType: 'additive' | 'replacement' | 'unknown';
  reason: string;
  existingInCommon: boolean;
  affectedAgents: string[];
}
```

---

## 4. Phase 2: L0/L1 Reflection & Reconciliation

### 3.1 Version Comparison Strategy

**Principle**: Keep the newest version across all layers (L0/L1/L2).

**Version Extraction Rules**:

| File Type | Version Source | Format |
|-----------|----------------|--------|
| `.md` files (agents, skills) | `@version X.Y.Z` header | Semver |
| `.ts` scripts | `@version X.Y.Z` header | Semver |
| `variant.json` | `version` field | Semver |
| `CLAUDE.md` / `GEMINI.md` | `Last Updated: YYYY-MM-DD` | ISO date |
| `settings.json` | No version → hash-based | SHA-256 |

**Reconciliation Logic**:

```typescript
function reconcileVersions(file: FileClassification): ReconciliationAction {
  if (file.classification === 'new') {
    return { action: 'keep', reason: 'New file not in L0/L1' };
  }

  if (file.classification === 'identical') {
    return { action: 'discard', reason: 'Identical to L0/L1 - inherited' };
  }

  // Modified - version compare
  const l2Ver = semver.parse(file.l2Version || '0.0.0');
  const l0Ver = semver.parse(file.l0Version || '0.0.0');
  const l1Ver = semver.parse(file.l1Version || '0.0.0');

  if (semver.gt(l2Ver, l0Ver) && semver.gt(l2Ver, l1Ver)) {
    return { action: 'keep-in-variant', reason: 'L2 has newest version' };
  }

  if (semver.gt(l0Ver, l2Ver) || semver.gt(l1Ver, l2Ver)) {
    return {
      action: 'move-to-common',
      reason: `L0/L1 (${l0Ver}) is newer than L2 (${l2Ver}) - use common version`,
    };
  }

  // Versions equal - use hash to determine actual differences
  if (file.hashL2 === file.hashL0 || file.hashL2 === file.hashL1) {
    return { action: 'discard', reason: 'Same content despite version difference' };
  }

  return {
    action: 'keep-in-variant',
    reason: 'Different content despite same version - variant-specific override',
  };
}
```

### 3.2 Anti-Swelling Protection

**Principle**: If ≥50% of variants override the same file, it belongs in `templates/common/`.

**Implementation**:

```typescript
function checkAntiSwelling(
  filePath: string,
  existingVariants: string[]
): AntiSwellingAction {
  const overrideCount = existingVariants.filter(v =>
    existsSync(`templates/${v}/${filePath}`)
  ).length;

  const overrideRatio = overrideCount / existingVariants.length;

  if (overrideRatio >= 0.5) {
    return {
      action: 'move-to-common',
      reason: `${overrideRatio * 100}% of variants override ${filePath} - belongs in common`,
      requiresBackpropagation: true,
    };
  }

  return { action: 'keep-in-variant', reason: 'Below anti-swelling threshold' };
}
```

### 3.3 Reclassification Matrix

| Original | L0 vs L2 | L1 vs L2 | Anti-Swelling | Final Action |
|----------|----------|----------|---------------|--------------|
| `new` | N/A | N/A | N/A | **keep-in-variant** |
| `modified` | L0 newer | same | <50% | **move-to-common** (use L0) |
| `modified` | same | L1 newer | <50% | **move-to-common** (use L1) |
| `modified` | L2 newer | same | <50% | **keep-in-variant** |
| `modified` | any | any | ≥50% | **move-to-common** + backpropagate |
| `identical` | same | same | N/A | **discard** (inherited) |

### 3.4 Reconciliation Output Schema

```typescript
interface ReconciledManifest {
  phase: 'reconciled';
  decisions: {
    keepInVariant: ReconciledFile[];
    moveToCommon: ReconciledFile[];
    discard: ReconciledFile[];
    conflicts: ConflictResolution[];
  };
  variantJson: {
    name: string;
    inherits_common: string;
    agent_overrides: Record<string, AgentOverride>;
    skill_manifest: SkillManifest;
    phases: PhaseOverrides;
    version: string;
    description: string;
  };
  propagationActions: {
    updateCommon: string[];
    backpropagateFromVariant: string[];
  };
}

interface ReconciledFile {
  sourcePath: string;
  targetPath: string;
  reason: string;
  version?: string;
  hash?: string;
}

interface ConflictResolution {
  filePath: string;
  conflict: 'version_mismatch' | 'content_divergence' | 'platform_parity';
  resolution: 'keep_l2' | 'keep_l0' | 'keep_l1' | 'merge';
  reason: string;
}
```

---

## 5. Phase 3: Variant Generation

### 4.1 variant.json Generation Strategy

**Input Sources**:
1. Reconciled manifest decisions
2. Common contract (`docs/templates/common-contract.json`)
3. L2 project metadata (if any exists)

**Generation Rules**:

> **CRITICAL DESIGN CHANGE**: New variants now initialize as `status: "beta"` with version `0.1.0`, NOT `stable`.

**Rationale**:
- Newly converted L2 projects lack real-world testing
- Beta status allows controlled validation before stable promotion
- Prevents premature production commitment to unproven variants
- Aligns with [`docs/governance/variant-lifecycle.md`](../../governance/variant-lifecycle.md) governance framework

```typescript
function generateVariantJson(
  reconciled: ReconciledManifest,
  variantName: string
): VariantJson {
  const overrides = extractAgentOverrides(reconciled);
  const skills = extractSkillManifest(reconciled);
  const today = new Date().toISOString().split('T')[0];

  return {
    name: variantName,
    version: '0.1.0',                    // Beta starts at 0.x.x
    description: generateDescription(overrides, skills),
    status: 'beta',                       // ALL new variants start as beta
    inherits_common: getCommonVersion(),
    agent_overrides: overrides,
    skill_manifest: {
      variant_specific: skills.variantSpecific,
    },
    phases: {
      phase3_name: inferPhase3Name(variantName),
    },
    lifecycle: {
      statusSince: today,
      lastTransition: 'initial → beta on ' + today,
      betaEngagements: 0,                 // Track for stable promotion
      stablePromotedOn: null,             // Set when promoted to stable
    },
  };
}
```

**Agent Override Detection**:

```typescript
function extractAgentOverrides(manifest: ReconciledManifest): Record<string, AgentOverride> {
  const pmOverrides = [];

  for (const file of manifest.decisions.keepInVariant) {
    if (file.targetPath.startsWith('agents/pm.md')) {
      // Determine override type
      const overrideType = classifyOverrideType(file.sourcePath);

      if (overrideType !== 'none') {
        pmOverrides.push({
          type: overrideType,
          reason: `Variant-specific ${overrideType} override`,
          since: new Date().toISOString().split('T')[0],
          reviewed_by: 'lifecycle-manager',
          overrides: detectOverrideSections(file.sourcePath),
        });
      }
    }
  }

  return {
    pm: pmOverrides.length > 0 ? {
      type: 'additive',
      reason: `${pmOverrides.length} variant-specific overrides detected`,
      since: new Date().toISOString().split('T')[0],
      reviewed_by: 'lifecycle-manager',
      overrides: pmOverrides.flatMap(o => o.overrides),
    } : undefined,
  };
}
```

### 4.2 File Copy Strategy

**Directory Structure**:

```
templates/<new-variant>/
├── agents/               # Variant-specific agent additions
├── skills/               # Variant-specific local skills
├── .claude/
│   ├── settings.json     # Platform-specific settings
│   ├── commands/         # Variant-specific commands
│   └── skills/           # Platform-specific skills
├── .gemini/
│   ├── settings.json     # Platform-specific settings
│   ├── commands/         # Variant-specific commands
│   └── skills/           # Platform-specific skills
├── docs/                 # Variant-specific documentation
├── CLAUDE.md             # Variant-specific Claude rules
├── GEMINI.md             # Variant-specific Gemini rules
├── README.md             # Variant description
└── variant.json          # Variant manifest
```

**Copy Rules**:

1. **agents/**: Only variant-specific agents (not in L0/L1)
2. **skills/**: Only variant-specific local skills
3. **.claude/skills/**: Platform-specific skills (override or new)
4. **.gemini/skills/**: Platform-specific skills (override or new)
5. **.claude/commands/**: Variant-specific commands
6. **.gemini/commands/**: Variant-specific commands
7. **CLAUDE.md**: Generated from common + variant additions
8. **GEMINI.md**: Generated from common + variant additions

**CLAUDE.md/GEMINI.md Generation**:

```typescript
function generatePlatformVariantDocs(
  variantName: string,
  reconciled: ReconciledManifest
): { claudeMd: string; geminiMd: string } {
  // Base from templates/common/
  const commonClaude = readFileSync('templates/common/CLAUDE.md', 'utf-8');
  const commonGemini = readFileSync('templates/common/GEMINI.md', 'utf-8');

  // Extract variant-specific additions
  const variantAdditions = extractVariantSpecificSections(reconciled);

  // Merge: common skeleton + variant additions
  const claudeMd = mergeVariantDocs(commonClaude, variantAdditions.claude);
  const geminiMd = mergeVariantDocs(commonGemini, variantAdditions.gemini);

  return { claudeMd, geminiMd };
}
```

### 4.3 Platform Parity Validation

**Validation Checks**:

1. **.claude ↔ .gemini skill parity**: Every skill in `.claude/skills/` must have a matching `.gemini/skills/` entry (unless `gemini-parity: skip`)
2. **Command parity**: Same for `.claude/commands/` ↔ `.gemini/commands/`
3. **Settings parity**: Validate against `docs/templates/common-contract.json § platform_settings`
4. **README parity**: CLAUDE.md and GEMINI.md must document platform-specific differences

**Failure Handling**:

```typescript
function validatePlatformParity(variantPath: string): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Check skill parity
  const claudeSkills = glob.sync(`${variantPath}/.claude/skills/*/SKILL.md`);
  const geminiSkills = glob.sync(`${variantPath}/.gemini/skills/*/SKILL.md`);

  for (const claudeSkill of claudeSkills) {
    const skillName = path.basename(path.dirname(claudeSkill));
    const geminiEquivalent = `${variantPath}/.gemini/skills/${skillName}/SKILL.md`;

    if (!existsSync(geminiEquivalent)) {
      // Check for gemini-parity: skip frontmatter
      const content = readFileSync(claudeSkill, 'utf-8');
      if (!content.includes('gemini-parity: skip')) {
        issues.push({
          level: 'error',
          check: 'platform-parity',
          message: `.claude/skills/${skillName} missing .gemini equivalent`,
          fix: `Create ${geminiEquivalent} or add 'gemini-parity: skip' to frontmatter`,
        });
      }
    }
  }

  return { passed: issues.length === 0, issues };
}
```

---

### 4.4 Beta Lifecycle Management System

**Objective**: Define comprehensive governance for new variants from beta creation through stable promotion.

**Governance Reference**: All lifecycle rules follow [`docs/governance/variant-lifecycle.md`](../../governance/variant-lifecycle.md).

---

#### 4.4.1 Default Beta Creation State

**All new variants created by the L2-to-Variant pipeline MUST initialize with**:

| Field | Value | Rationale |
|-------|-------|-----------|
| `status` | `"beta"` | Requires validation before production use |
| `version` | `"0.1.0"` | Semantic versioning for pre-release |
| `lifecycle.statusSince` | Today's date (`YYYY-MM-DD`) | Tracks beta duration |
| `lifecycle.lastTransition` | `"initial → beta on YYYY-MM-DD"` | Audit trail |
| `lifecycle.betaEngagements` | `0` | Counter for stable promotion criteria |
| `lifecycle.stablePromotedOn` | `null` | Set only on stable promotion |

**variant.json Example**:

```json
{
  "name": "co-data",
  "version": "0.1.0",
  "status": "beta",
  "description": "Data engineering variant for ETL, data pipeline, and analytics projects.",
  "inherits_common": "1.0.0",
  "agent_overrides": {
    "pm": {
      "type": "additive",
      "reason": "co-data provides variant-specific Agent Roster (data-engineer, data-analyst)",
      "since": "2026-06-03",
      "reviewed_by": "lifecycle-manager",
      "overrides": ["agent-roster", "governance-workflow"]
    }
  },
  "skill_manifest": {
    "variant_specific": [
      {
        "name": "data-pipeline",
        "layer": "local",
        "used_by_agents": ["data-engineer", "pm"],
        "phases": [3, 4],
        "platform_parity": "required"
      }
    ]
  },
  "phases": {
    "phase3_name": "Data Pipeline"
  },
  "lifecycle": {
    "statusSince": "2026-06-03",
    "lastTransition": "initial → beta on 2026-06-03",
    "betaEngagements": 0,
    "stablePromotedOn": null
  }
}
```

**Acceptance Criteria**:

- [ ] New variant `status` field is `"beta"` (not `"stable"`)
- [ ] New variant `version` is `"0.1.0"` (not `"1.0.0"`)
- [ ] `lifecycle.statusSince` set to creation date
- [ ] `lifecycle.betaEngagements` initialized to `0`
- [ ] `lifecycle.stablePromotedOn` is `null`

---

#### 4.4.2 Beta Status Constraints

**Restrictions** applied to beta variants:

| Constraint | Implementation | Enforcement Point |
|------------|----------------|-------------------|
| **No production SLA** | Warning in README.md | Documentation generation |
| **Beta warning on project creation** | `new-project.sh` prompt | User interaction |
| **Feature changes without notice** | CHANGELOG beta entries | Communication |
| **No backwards compatibility guarantee** | Version 0.x.x allows breaking changes | Semantic versioning |
| **Limited support scope** | Best-effort only | Support policy |

**Beta Usage Scope**:

| Variant Type | Beta Scope | Rationale |
|--------------|-------------|------------|
| **Security variants** (co-security) | Single engagement trial | High-risk domain requires controlled testing |
| **Development variants** (co-develop) | Full access | Lower risk, broader testing needed |
| **Consulting variants** (co-consult) | Full access | Client-facing but not critical infrastructure |
| **All new variants** | Full access | Default for L2 conversions |

**Implementation** (in `scripts/new-project.sh`):

```bash
# Beta variant warning
if [ "$variant_status" = "beta" ]; then
  echo ""
  echo "⚠️  ════════════════════════════════════════════════════════════════════════════════"
  echo "⚠️  WARNING: Creating project with BETA variant '$variant_name'"
  echo "⚠️  ════════════════════════════════════════════════════════════════════════════════"
  echo ""
  echo "Beta variants are for testing purposes only:"
  echo "  • Features may change without notice"
  echo "  • No production SLA or uptime guarantees"
  echo "  • No backwards compatibility commitment"
  echo "  • Best-effort support only"
  echo ""
  echo "Variant: $variant_name"
  echo "Beta Since: $variant_beta_since"
  echo "Current Version: $variant_version"
  echo ""
  read -p "Do you understand and accept these limitations? (yes/NO): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Project creation cancelled."
    exit 1
  fi
  echo ""
  echo "✓ Beta variant accepted. Project creation proceeding..."
  echo ""
fi
```

**Acceptance Criteria**:

- [ ] `new-project.sh` displays beta warning before project creation
- [ ] Beta warning includes variant name, beta since date, and version
- [ ] User must explicitly type "yes" to proceed (capitalized NO default)
- [ ] Cancellation message displayed if user rejects
- [ ] Confirmation message displayed after acceptance

---

#### 4.4.3 Beta → Stable Promotion Criteria

**Stable promotion requires ALL of the following criteria**:

| Criterion | Requirement | Verification Method |
|-----------|-------------|---------------------|
| **1. Minimum Engagement Count** | ≥3 successful real-world projects created with the variant | Query `templates/<variant>/lifecycle.betaEngagements` + manual verification |
| **2. Bug Report Status** | 0 unresolved bug reports (all closed or documented as known limitations) | GitHub Issues query + documentation review |
| **3. Duration in Beta** | Minimum 3 months in beta status | Compare `lifecycle.statusSince` with current date |
| **4. Documentation Review** | All variant documentation (README.md, CLAUDE.md, GEMINI.md) reviewed and approved | Manual lifecycle-manager review |
| **5. User Feedback Validation** | Positive feedback from beta users (no critical UX/functional complaints) | Memory log entries + GitHub feedback |
| **6. Script Health** | 0 deprecated scripts in use (all scripts at `active` status in SCRIPTS.md) | `bun scripts/validate-templates.ts --variant <name>` |
| **7. Platform Parity** | Full `.claude/` ↔ `.gemini/` parity validated | `bun scripts/validate-templates.ts --variant <name>` |
| **8. ADR Created** | Architectural Decision Record for stable promotion | `docs/adr/YYYYMM-stable-promotion-<variant>.md` exists |

**Verification Process**:

```typescript
/**
 * Verify beta → stable promotion criteria
 * @version 1.0.0
 */

interface StablePromotionCheckResult {
  canPromote: boolean;
  criteria: {
    engagements: { passed: boolean; count: number; required: number };
    bugReports: { passed: boolean; unresolvedCount: number };
    duration: { passed: boolean; monthsInBeta: number; required: number };
    documentation: { passed: boolean; reviewStatus: string };
    userFeedback: { passed: boolean; criticalComplaints: number };
    scriptHealth: { passed: boolean; deprecatedScripts: string[] };
    platformParity: { passed: boolean; parityErrors: string[] };
    adr: { passed: boolean; adrPath: string | null };
  };
  blockingIssues: string[];
  nextSteps: string[];
}

async function verifyStablePromotionCriteria(
  variantName: string
): Promise<StablePromotionCheckResult> {
  const variantJson = JSON.parse(
    readFileSync(`templates/${variantName}/variant.json`, 'utf-8')
  );
  const today = new Date();
  const betaSince = new Date(variantJson.lifecycle.statusSince);
  const monthsInBeta = monthDiff(betaSince, today);

  const result: StablePromotionCheckResult = {
    canPromote: true,
    criteria: {
      engagements: {
        passed: variantJson.lifecycle.betaEngagements >= 3,
        count: variantJson.lifecycle.betaEngagements,
        required: 3,
      },
      bugReports: {
        passed: await checkUnresolvedBugReports(variantName) === 0,
        unresolvedCount: await checkUnresolvedBugReports(variantName),
      },
      duration: {
        passed: monthsInBeta >= 3,
        monthsInBeta,
        required: 3,
      },
      documentation: {
        passed: await checkDocumentationReviewed(variantName),
        reviewStatus: await getDocumentationReviewStatus(variantName),
      },
      userFeedback: {
        passed: await checkCriticalUserComplaints(variantName) === 0,
        criticalComplaints: await checkCriticalUserComplaints(variantName),
      },
      scriptHealth: {
        passed: await checkDeprecatedScripts(variantName) === 0,
        deprecatedScripts: await listDeprecatedScripts(variantName),
      },
      platformParity: {
        passed: await checkPlatformParity(variantName),
        parityErrors: await listPlatformParityErrors(variantName),
      },
      adr: {
        passed: existsSync(`docs/adr/${formatADRDate()}-stable-promotion-${variantName}.md`),
        adrPath: findADRPath(variantName, 'stable-promotion'),
      },
    },
    blockingIssues: [],
    nextSteps: [],
  };

  // Collect blocking issues
  for (const [key, value] of Object.entries(result.criteria)) {
    if (!value.passed) {
      result.blockingIssues.push(`${key}: ${value}`);
    }
  }

  result.canPromote = result.blockingIssues.length === 0;

  // Generate next steps
  if (result.canPromote) {
    result.nextSteps = [
      `1. Create ADR for stable promotion (if not exists)`,
      `2. Update variant.json: status = "stable", version = "1.0.0"`,
      `3. Update lifecycle.stablePromotedOn = "${today.toISOString().split('T')[0]}"`,
      `4. Update CHANGELOG.md with v1.0.0 entry`,
      `5. Run full sync pipeline: /sync "promote ${variantName} to stable"`,
      `6. Update VERSION_REGISTRY.json status to "stable"`,
    ];
  } else {
    result.nextSteps = [
      `1. Resolve blocking issues:`,
      ...result.blockingIssues.map(issue => `   - ${issue}`),
      `2. Re-run verification after fixes`,
    ];
  }

  return result;
}
```

**Acceptance Criteria**:

- [ ] Engagement count ≥3 verified from variant.json or project logs
- [ ] 0 unresolved bug reports confirmed via GitHub Issues
- [ ] Minimum 3 months in beta confirmed via date calculation
- [ ] Documentation reviewed and approved by lifecycle-manager
- [ ] User feedback validated (no critical complaints)
- [ ] Script health check passes (0 deprecated scripts)
- [ ] Platform parity validation passes (0 parity errors)
- [ ] ADR for stable promotion exists in `docs/adr/`
- [ ] All 8 criteria passed before promotion proceeds

---

#### 4.4.4 Stable Promotion Process

**Ownership**: lifecycle-manager (workspace) executes the promotion. PM approves and coordinates.

**Phase 1: Pre-Promotion Verification**

1. **Run verification script**:
   ```bash
   bun scripts/verify-stable-promotion.ts <variant-name>
   ```

2. **Review verification results**:
   - All 8 criteria must pass
   - Document any waived criteria with ADR justification

3. **Create ADR** (if not exists):
   - Template: `docs/adr/YYYYMM-stable-promotion-<variant>.md`
   - Content: Why stable promotion is justified, engagement summary, known limitations

**Phase 2: Execute Promotion**

1. **Update `variant.json`**:
   ```json
   {
     "status": "stable",
     "version": "1.0.0",
     "lifecycle": {
       "statusSince": "2026-09-03",
       "lastTransition": "beta → stable on 2026-09-03",
       "betaEngagements": 5,
       "stablePromotedOn": "2026-09-03"
     }
   }
   ```

2. **Update `VERSION_REGISTRY.json`**:
   ```json
   {
     "variants": {
       "<variant>": {
         "latest": "1.0.0",
         "status": "stable",
         "released": "2026-09-03"
       }
     }
   }
   ```

3. **Update `CHANGELOG.md`**:
   ```markdown
   ## [1.0.0] - 2026-09-03

   ### Added
   - Promoted <variant> from beta to stable

   ### Changed
   - All 8 stable promotion criteria met:
     • 5 successful beta engagements (required: 3)
     • 0 unresolved bug reports
     • 3 months in beta status
     • Documentation reviewed and approved
     • Positive user feedback validated
     • All scripts at active status
     • Platform parity validated
     • ADR created (docs/adr/202609-stable-promotion-<variant>.md)
   ```

4. **Update variant `README.md`**:
   - Change status badge from `beta` to `stable`
   - Remove beta warning from Quick Start section
   - Update lifecycle status table

5. **Update workspace `README.md`**:
   - Change variant status from `beta` to `stable` in Available Variants table

**Phase 3: Post-Promotion Validation**

1. **Run full validation suite**:
   ```bash
   bun scripts/validate-templates.ts --variant <variant>
   bun run agent:verify
   bun scripts/skill-lifecycle-audit.ts
   bun scripts/lifecycle-sync-audit.ts
   ```

2. **Test project creation**:
   ```bash
   bun scripts/new-project.sh test-<variant>-stable --variant <variant>
   ```

3. **Verify no beta warning**:
   - Project creation should proceed without beta warning
   - Variant should be listed as stable in selection menu

4. **Commit via /sync pipeline**:
   ```bash
   /sync "promote <variant> to stable (v1.0.0)"
   ```

**Acceptance Criteria**:

- [ ] Verification script confirms all 8 criteria passed
- [ ] ADR for stable promotion created and reviewed
- [ ] `variant.json` updated: status="stable", version="1.0.0"
- [ ] `lifecycle.stablePromotedOn` set to promotion date
- [ ] `lifecycle.lastTransition` updated to "beta → stable on YYYY-MM-DD"
- [ ] `VERSION_REGISTRY.json` updated with status="stable"
- [ ] `CHANGELOG.md` includes v1.0.0 entry with promotion details
- [ ] Variant README.md updated (status badge, warnings removed)
- [ ] Workspace README.md updated (variant status in Available Variants)
- [ ] All validation scripts pass (validate-templates, agent:verify, skill-lifecycle-audit)
- [ ] Test project creation succeeds without beta warning
- [ ] Changes committed via /sync pipeline

---

#### 4.4.5 Lifecycle Status Documentation Updates

**README.md Lifecycle Status Section** (in each variant):

```markdown
## Lifecycle Status

| Metric | Value |
|--------|-------|
| **Current Status** | beta |
| **Version** | 0.1.0 |
| **Beta Since** | 2026-06-03 |
| **Months in Beta** | 0.5 |
| **Successful Engagements** | 1 / 3 required |
| **Unresolved Bug Reports** | 0 |
| **Stable Promotion Eligible** | ❌ Not yet (2 more engagements required, 2.5 more months) |

### Promotion Timeline

- **Current**: Beta (since 2026-06-03)
- **Earliest Stable Promotion**: 2026-09-03 (after 3 months in beta + 3 engagements)
- **Next Review**: 2026-07-03 (monthly engagement and bug report check)

### Stable Promotion Requirements

This variant will be promoted to stable when ALL criteria are met:

1. ✅ **Minimum 3 months in beta** (eligible 2026-09-03)
2. ⏳ **3 successful engagements** (current: 1, need: 2 more)
3. ✅ **0 unresolved bug reports** (current: 0)
4. ✅ **Documentation reviewed** (approved by lifecycle-manager)
5. ⏳ **User feedback validated** (no critical complaints received yet)

> **Beta Usage Notice**: This variant is in beta and may change without notice. No production SLA or backwards compatibility guarantees. Use for testing purposes only.
```

**After Stable Promotion** (update to):

```markdown
## Lifecycle Status

| Metric | Value |
|--------|-------|
| **Current Status** | ✅ stable |
| **Version** | 1.0.0 |
| **Stable Since** | 2026-09-03 |
| **Beta Duration** | 3 months (2026-06-03 → 2026-09-03) |
| **Total Engagements** | 5 (3 required for promotion) |
| **Bug Report Status** | 0 unresolved at promotion |

### Promotion History

- **2026-06-03**: Initial beta release (v0.1.0)
- **2026-09-03**: Promoted to stable (v1.0.0)
  - All 8 promotion criteria met
  - ADR approved: [docs/adr/202609-stable-promotion-<variant>.md](../../adr/202609-stable-promotion-<variant>.md)

### Production Support

✅ Full support commitment
✅ Backwards compatibility guaranteed within v1.x
✅ Production SLA applies
✅ Recommended for all new projects
```

**Acceptance Criteria**:

- [ ] Beta README includes lifecycle status table with all metrics
- [ ] Promotion timeline clearly documented with dates
- [ ] Stable requirements checklist shows progress (✅/⏳ indicators)
- [ ] Beta usage notice prominently displayed
- [ ] After promotion, README updated to stable format
- [ ] Promotion history section added with ADR reference
- [ ] Production support commitments clearly stated

---

## 6. Integration with Existing Systems

### 5.1 Workspace README Update

**Required Changes** to `README.md`:

```markdown
## Available Variants

| Variant | Description | Status | Phase 3 Focus |
|---------|-------------|--------|---------------|
| co-develop | Software development | stable | Implementation |
| co-design | UI/UX design | stable | Design Handoff |
| co-work | Collaboration & documentation | stable | Delivery |
| co-security | Security engagement | stable | Assessment |
| co-consult | Strategy consulting | stable | Presentation |
| <new-variant> | <description> | beta | <focus> |
```

> **CRITICAL**: New variants are added as `beta` status, NOT `stable`. Status updates to `stable` only after promotion criteria are met (see §4.4.3).

**Location**: Line ~150 (after "Available Variants" section)

### 5.2 new-project Script Updates

**Affected Files**:
1. `scripts/new-project.sh` (Unix)
2. `scripts/new-project.ps1` (Windows)
3. `scripts/helpers/inject-skills.ts` (Skill injection logic)

**Required Changes**:

```bash
# Variant selection prompt - add new variant
echo "   co-consult  — Strategy consulting (stable)"
echo "   <new-variant> — <description> (stable)"
```

**Version Registry Update** (`docs/templates/VERSION_REGISTRY.json`):

```json
{
  "variants": {
    "co-design": { "latest": "1.0.0", "status": "stable", "released": "2026-05-28" },
    "co-develop": { "latest": "1.0.0", "status": "stable", "released": "2026-05-28" },
    "co-work": { "latest": "1.0.0", "status": "stable", "released": "2026-05-28" },
    "co-security": { "latest": "0.3.0", "status": "stable", "released": "2026-05-28" },
    "co-consult": { "latest": "1.0.0", "status": "stable", "released": "2026-06-03" },
    "<new-variant>": { "latest": "0.1.0", "status": "beta", "released": "2026-06-03" }
  },
  "schema_version": "1.0"
}
```

> **CRITICAL**: New variants are added with `status: "beta"` and `version: "0.1.0"`, NOT `stable` and `1.0.0`.

**NEW: Template Version Management (schema v1.1)**:

```json
{
  "version": "1.0.0",
  "last_updated": "2026-06-03",
  "description": "Central version registry for all template variants",
  "variants": {
    "<new-variant>": {
      "latest": "0.1.0",
      "released": "2026-06-03",
      "status": "beta",
      "inherits_common": "1.0.0",
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

**New Schema Fields (v1.0 → v1.1)**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inherits_common` | string | Yes | L1 (templates/common/) version this variant inherits from |
| `common_version_policy` | object | Yes | L1 version bump impact policy |
| `common_version_policy.patch_auto_inherit` | boolean | Yes | Auto-inherit PATCH updates (X.Y.Z → X.Y.Z+1) |
| `common_version_policy.minor_requires_review` | boolean | Yes | Review MINOR updates for compatibility (X.Y.Z → X.Y+1.0) |
| `common_version_policy.major_requires_reconciliation` | boolean | Yes | **REQUIRED** - Full pipeline reconciliation on MAJOR updates (X.Y.Z → X+1.0.0) |

**Rationale**: New variants must declare their L1 dependency explicitly. This ensures:
- Clear version dependency tracking
- Automated compatibility checks
- Structured upgrade policies for different semver levels
- Governance enforcement for breaking changes

### 5.3 Template Version Management Policy

**Objective**: Define clear governance rules for how L1 (templates/common/) version changes affect existing variants.

**Problem**: Without clear version management policies, L1 updates can:
- Break variants unexpectedly (breaking changes not caught)
- Create inconsistent common layer inheritance across variants
- Cause uncontrolled technical debt accumulation
- Make variant maintenance difficult and error-prone

**Solution**: Define three-tier version impact policy (PATCH/MINOR/MAJOR) with automated enforcement.

---

#### 5.3.1 L1 Version Impact Scenarios

**Scenario A: PATCH Update (X.Y.Z → X.Y.Z+1)**
- **Impact**: Bug fixes, small improvements, no breaking changes
- **Variant Behavior**: Auto-inherit, no action required
- **Enforcement**: Automated via `update-inherits-common.ts`

**Scenario B: MINOR Update (X.Y.Z → X.Y+1.0)**
- **Impact**: New features, backwards compatible changes
- **Variant Behavior**: Review required, test thoroughly, then update
- **Enforcement**: Validation warns if `minor_review_completed` missing

**Scenario C: MAJOR Update (X.Y.Z → X+1.0.0)**
- **Impact**: Breaking changes, structural changes, incompatible API changes
- **Variant Behavior**: **REQUIRED** - Full L2-to-variant pipeline reconciliation
- **Enforcement**: Validation **FAILS** without `major_reconciliation_completed`

For detailed scenarios, decision trees, and enforcement logic, see the full Template Version Management Policy section in the ADR template (§2.2).

---

#### 5.3.2 Implementation Requirements

**Phase 4 Integration Tasks**:

- [ ] Update `VERSION_REGISTRY.json` schema to v1.1
- [ ] Add `inherits_common` field to all variants
- [ ] Add `common_version_policy` object to all variants
- [ ] Create `scripts/update-inherits-common.ts` for PATCH auto-inherit
- [ ] Update `validate-templates.ts` with L1 inheritance check
- [ ] Document L1 version impact scenarios in user guide

---

### 5.4 Validation Script Updates

**File**: `scripts/validate-templates.ts`

**New Validation Check**:

```typescript
function checkNewVariantIntegrity(): void {
  const newVariant = process.env.NEW_VARIANT_NAME; // Env var for pipeline
  if (!newVariant) return;

  console.log(`\n=== Check N-01: New Variant Integrity (${newVariant}) ===`);

  // N-01.1: variant.json exists and valid
  const variantJsonPath = join(TEMPLATES_DIR, newVariant, 'variant.json');
  if (!existsSync(variantJsonPath)) {
    fail(newVariant, 'variant-json-missing', 'variant.json not found');
    return;
  }

  try {
    const variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));

    // N-01.2: inherits_common matches current common version
    const commonVersion = getCommonVersion();
    if (variantJson.inherits_common !== commonVersion) {
      warn(newVariant, 'common-version-mismatch',
        `variant.json inherits_common=${variantJson.inherits_common} but common is ${commonVersion}`,
        'Update inherits_common or run common sync'
      );
    } else {
      pass(`variant.json inherits_common = ${commonVersion}`);
    }

    // N-01.3: All declared skills exist
    for (const skill of variantJson.skill_manifest?.variant_specific || []) {
      const skillPath = join(TEMPLATES_DIR, newVariant, '.claude', 'skills', skill.name, 'SKILL.md');
      if (!existsSync(skillPath)) {
        fail(newVariant, 'skill-missing-in-manifest',
          `variant.json declares ${skill.name} but file not found`,
          'Create skill file or remove from manifest'
        );
      }
    }

    // N-01.4: Platform parity validation
    const parityResult = validatePlatformParity(join(TEMPLATES_DIR, newVariant));
    if (!parityResult.passed) {
      for (const issue of parityResult.issues) {
        fail(newVariant, 'platform-parity', issue.message, issue.fix);
      }
    } else {
      pass('Platform parity validated');
    }

  } catch (e) {
    fail(newVariant, 'variant-json-invalid', `Cannot parse variant.json: ${e}`);
  }
}
```

### 5.5 project-review Skill L1 Check

**Skill**: `skills/project-review/SKILL.md`

**New Review Step**: L1 Template Consistency Check

```markdown
## L1 Check: Template Consistency

### Objective
Verify the project's alignment with L1 (templates/common/) baseline.

### Checks

1. **Common Layer Inheritance**
   - [ ] CLAUDE.md includes all common sections
   - [ ] GEMINI.md includes all common sections
   - [ ] .claude/settings.json includes shared tier settings
   - [ ] .gemini/settings.json includes shared tier settings

2. **Variant-Specific Overrides**
   - [ ] variant.json exists and is valid
   - [ ] All declared skills/agents exist
   - [ ] Platform parity maintained (.claude ↔ .gemini)

3. **Lifecycle Compliance**
   - [ ] All scripts have @version headers
   - [ ] All agents have version frontmatter
   - [ ] No L0-only files present (e.g., validate-templates.ts)

### Remediation

If checks fail:
1. Identify missing common layer components
2. Re-run variant generation pipeline with `--force-common-sync`
3. Re-validate with `bun scripts/validate-templates.ts --variant <name>`
```

### 5.6 L1 Lifecycle Management Steps

**Objective**: Ensure the newly created variant complies with all L1 (templates/common/) lifecycle governance requirements and is properly registered in workspace governance documents.

**Timing**: Executed after Phase 3 (Variant Generation) completes successfully, before Phase 4 (Integration) begins.

**Prerequisites**:
- `templates/<new-variant>/` directory structure created
- `variant.json` generated and valid
- Platform parity validation passed

**Ownership**: Executed by lifecycle-manager agent (dispatched by PM at Phase 6 in workspace context, or by PM directly in variant context).

---

#### 5.5.1 memory/ Development Log Cleanup

**Objective**: Remove non-portable artifacts from the L2 project's memory/ directory before variant template creation.

**Problem**: L2 projects accumulate development logs that include:
- File system artifacts (`.git/`, `node_modules/`, `.codegraph/`, `.env/` references)
- Environment-specific paths
- Temporary debugging notes

These should NOT be propagated to the variant template.

**Preservation Rules**:

| Content Type | Keep | Reason |
|--------------|------|--------|
| Meeting summaries | ✅ | Document decision-making rationale |
| Design decisions | ✅ | Capture architectural context |
| Action items | ✅ | Show variant-specific workflows |
| File system paths | ❌ | Environment-specific, not reusable |
| `.git/` references | ❌ | Not applicable to template consumers |
| `node_modules/` refs | ❌ | Not applicable to template consumers |
| `.codegraph/` refs | ❌ | Not applicable to template consumers |
| `.env/` refs | ❌ | Security risk, not reusable |

**Implementation Spec**:

```typescript
/**
 * Cleanup memory logs for variant template inclusion
 * @version 1.0.0
 *
 * Removes environment-specific artifacts while preserving decision records.
 */

interface MemoryLogCleanupResult {
  originalFiles: string[];
  cleanedFiles: string[];
  removedLines: number;
  preservedSections: string[];
  cleanupSummary: string;
}

function cleanupMemoryLogs(memoryDir: string): MemoryLogCleanupResult {
  const logFiles = glob.sync(`${memoryDir}/*.md`);
  const cleanedFiles: string[] = [];
  let totalRemovedLines = 0;
  const preservedSections: string[] = [];

  for (const logFile of logFiles) {
    const content = readFileSync(logFile, 'utf-8');
    const lines = content.split('\n');
    const cleanedLines: string[] = [];
    let inPreservableSection = false;
    let currentSection = '';

    for (const line of lines) {
      // Detect preservable sections
      if (line.match(/^#{1,3} (Meeting|Decision|Action|Design)/)) {
        inPreservableSection = true;
        currentSection = line;
        preservedSections.push(currentSection);
      }

      // Filter out environment-specific lines
      if (line.includes('.git/') || line.includes('node_modules/') ||
          line.includes('.codegraph/') || line.includes('.env/')) {
        totalRemovedLines++;
        continue; // Skip this line
      }

      if (inPreservableSection) {
        cleanedLines.push(line);
      }
    }

    writeFileSync(logFile, cleanedLines.join('\n'), 'utf-8');
    cleanedFiles.push(logFile);
  }

  return {
    originalFiles: logFiles,
    cleanedFiles,
    removedLines: totalRemovedLines,
    preservedSections,
    cleanupSummary: `Cleaned ${cleanedFiles.length} memory logs, removed ${totalRemovedLines} environment-specific lines`,
  };
}
```

**Acceptance Criteria**:

- [ ] All `.git/` references removed from memory logs
- [ ] All `node_modules/` references removed
- [ ] All `.codegraph/` references removed
- [ ] All `.env/` references removed
- [ ] Meeting summaries preserved intact
- [ ] Design decision sections preserved
- [ ] Action item lists preserved
- [ ] File remains valid Markdown after cleanup
- [ ] Cleanup summary logged to `memory/YYYY-MM-DD.md`

**Integration Point**: Call this function in Phase 3 after file copy but before directory finalization.

---

#### 5.5.2 AGENTS.md Registration Validation

**Objective**: Ensure all L2 variant agents, skills, and workflows are properly registered in the workspace `AGENTS.md` governance document.

**Problem**: L2 projects may introduce:
- New agents not in workspace roster
- New skills not in skills registry
- New workflows not documented
- Modified agent capabilities not reflected

**Validation Checks**:

```typescript
/**
 * Validate L2 variant registrations in AGENTS.md
 * @version 1.0.0
 */

interface AGENTSValidationResult {
  missingAgents: string[];
  missingSkills: string[];
  missingWorkflows: string[];
  outdatedRosterEntries: string[];
  validationPassed: boolean;
  remediationSteps: string[];
}

function validateAGENTSRegistrations(
  variantPath: string,
  agentsMdPath: string
): AGENTSValidationResult {
  const agentsMd = readFileSync(agentsMdPath, 'utf-8');
  const variantAgents = glob.sync(`${variantPath}/agents/*.md`);
  const variantSkills = glob.sync(`${variantPath}/skills/*/SKILL.md`);
  const variantJson = JSON.parse(readFileSync(`${variantPath}/variant.json`, 'utf-8'));

  const missingAgents: string[] = [];
  const missingSkills: string[] = [];
  const missingWorkflows: string[] = [];

  // Check 1: All variant agents in workspace AGENTS.md
  for (const agentFile of variantAgents) {
    const agentName = path.basename(agentFile, '.md');
    if (!agentsMd.includes(`## ${agentName}`) && !agentsMd.includes(`| ${agentName} |`)) {
      missingAgents.push(agentName);
    }
  }

  // Check 2: All variant skills in AGENTS.md § Skills table
  for (const skillFile of variantSkills) {
    const skillName = path.basename(path.dirname(skillFile));
    const skillContent = readFileSync(skillFile, 'utf-8');
    const versionMatch = skillContent.match(/version:\s*(\d+\.\d+\.\d+)/);

    if (versionMatch && !agentsMd.includes(`| ${skillName} |`)) {
      missingSkills.push(`${skillName} (v${versionMatch[1]})`);
    }
  }

  // Check 3: All workflows documented
  if (variantJson.agent_overrides?.pm?.overrides?.includes('governance-workflow')) {
    if (!agentsMd.includes('Governance Workflow')) {
      missingWorkflows.push('Governance Workflow');
    }
  }

  const validationPassed = missingAgents.length === 0 &&
                         missingSkills.length === 0 &&
                         missingWorkflows.length === 0;

  const remediationSteps: string[] = [];
  if (missingAgents.length > 0) {
    remediationSteps.push(`Add missing agents to AGENTS.md roster: ${missingAgents.join(', ')}`);
  }
  if (missingSkills.length > 0) {
    remediationSteps.push(`Add missing skills to AGENTS.md § Skills: ${missingSkills.join(', ')}`);
  }
  if (missingWorkflows.length > 0) {
    remediationSteps.push(`Document missing workflows: ${missingWorkflows.join(', ')}`);
  }

  return {
    missingAgents,
    missingSkills,
    missingWorkflows,
    outdatedRosterEntries: [],
    validationPassed,
    remediationSteps,
  };
}
```

**Acceptance Criteria**:

- [ ] All agents in `templates/<new-variant>/agents/*.md` registered in `AGENTS.md` roster
- [ ] All skills in `templates/<new-variant>/skills/*/SKILL.md` in `AGENTS.md § Skills` table
- [ ] All workflows defined in `variant.json.agent_overrides` documented in `AGENTS.md`
- [ ] Agent versions match between variant files and `AGENTS.md`
- [ ] Skill versions match between variant files and `AGENTS.md`
- [ ] Validation passes with zero missing registrations
- [ ] Remediation steps provided if validation fails

**Remediation Protocol**:

If validation fails:
1. PM reviews missing registrations
2. PM updates `AGENTS.md` with missing entries
3. lifecycle-manager propagates changes to all variant `AGENTS.md` files
4. Re-run validation until all checks pass

---

#### 5.5.3 AGENTS.md PM Dispatch Table Update

**Objective**: Add the new variant to the PM Dispatch Table in `AGENTS.md` with correct override type and reason.

**Problem**: The PM Dispatch Table documents which variants override PM agent behavior. New variants must be registered correctly.

**PM Dispatch Table Schema**:

```markdown
## PM Dispatch Table

| Variant | Override Type | Agent Roster | Governance Workflow | Phase 3 Focus | Reason |
|---------|--------------|--------------|---------------------|---------------|---------|
| co-design | additive | designer, design-critic, design-system-builder, prototyper, handoff-specialist | Design Handoff | Design artifacts | Variant-specific agent roster and workflow |
| co-develop | additive | developer, code-reviewer, qa-tester, implementation-engineer | Implementation | Coding execution | Variant-specific agent roster and workflow |
| co-work | additive | delivery-lead, documenter, coordinator, facilitator | Delivery | Project delivery | Variant-specific agent roster and workflow |
| co-security | additive | security-auditor, penetration-tester, compliance-officer, security-architect | Assessment | Security review | Variant-specific agent roster and workflow |
| <new-variant> | <type> | <agent1>, <agent2> | <workflow> | <focus> | <reason> |
```

**Override Type Classification**:

| Type | Definition | When to Use | Example |
|------|------------|-------------|---------|
| `additive` | Adds agents/workflows to base PM | Variant extends base with new specialists | co-design adds designer, prototyper |
| `replacement` | Replaces entire PM behavior | Variant has completely different governance | (rare - future use) |
| `none` | Uses base PM unchanged | Variant has no agent differences | (rare - future use) |

**Implementation Spec**:

```typescript
/**
 * Update AGENTS.md PM Dispatch Table with new variant
 * @version 1.0.0
 */

interface DispatchTableRow {
  variant: string;
  overrideType: 'additive' | 'replacement' | 'none';
  agentRoster: string[];
  governanceWorkflow: string;
  phase3Focus: string;
  reason: string;
}

function updatePMDispatchTable(
  agentsMdPath: string,
  variantName: string,
  variantJson: any
): void {
  const agentsMd = readFileSync(agentsMdPath, 'utf-8');

  // Extract variant metadata
  const pmOverride = variantJson.agent_overrides?.pm;
  const overrideType = pmOverride?.type || 'none';
  const phase3Name = variantJson.phases?.phase3_name || 'Standard';

  // Build agent roster list
  const variantAgents = glob.sync(`templates/${variantName}/agents/*.md`)
    .map(f => path.basename(f, '.md'))
    .filter(a => a !== 'pm') // Exclude PM itself
    .join(', ');

  // Build reason from variant.json or use default
  const reason = pmOverride?.reason ||
    `${variantName} provides variant-specific governance with ${overrideType} override type`;

  // Build new row
  const newRow = `| ${variantName} | ${overrideType} | ${variantAgents} | ${phase3Name} | ${phase3Name} | ${reason} |`;

  // Insert row after existing variant rows (before "## Workflows" section)
  const updated = agentsMd.replace(
    /(\| [^\n]+\n)(\n## Workflows)/,
    `$1${newRow}\n$2`
  );

  writeFileSync(agentsMdPath, updated, 'utf-8');
}
```

**Acceptance Criteria**:

- [ ] New variant row added to PM Dispatch Table
- [ ] Override type correctly classified (additive/replacement/none)
- [ ] Agent roster lists all variant-specific agents (excluding PM)
- [ ] Governance workflow matches `variant.json.phases.phase3_name`
- [ ] Phase 3 focus matches workflow name
- [ ] Reason field populated from `variant.json.agent_overrides.pm.reason`
- [ ] Table formatting consistent with existing rows
- [ ] No duplicate variant entries

**Validation Command**:

```bash
# After update, verify AGENTS.md passes agent verification
bun run agent:verify

# Verify no Markdown table syntax errors
# (Manual check: ensure pipes align correctly)
```

---

#### 5.5.4 co-consult CLAUDE.md/GEMINI.md Propagation

**Objective**: Propagate new variant rules to the co-consult variant's platform documentation (`CLAUDE.md`, `GEMINI.md`).

**Problem**: co-consult is the "consulting platform" variant that aggregates all other variants' rules. When a new variant is created, co-consult's platform docs must reflect the new variant's existence and rules.

**co-consult Specific Requirements**:

1. **Supported Variants Table Update**:
   ```markdown
   | Variant | Description | Phase 3 Focus | Status |
   |---------|-------------|---------------|--------|
   | co-design | Design-focused variant | Design Handoff | stable |
   | co-develop | Development-focused variant | Implementation | stable |
   | co-work | Collaboration-focused variant | Delivery | stable |
   | co-security | Security-focused variant | Assessment | stable |
   | <new-variant> | <description> | <focus> | stable |
   ```

2. **Variant Rules Integration**:
   - Extract variant-specific rules from `templates/<new-variant>/CLAUDE.md`
   - Add to co-consult's "Variant-Specific Rules" section
   - Maintain platform parity with `GEMINI.md`

**Implementation Spec**:

```typescript
/**
 * Propagate new variant rules to co-consult platform docs
 * @version 1.0.0
 */

interface PropagationResult {
  updatedClaudeMd: boolean;
  updatedGeminiMd: boolean;
  variantsTableUpdated: boolean;
  rulesSectionUpdated: boolean;
  propagationSummary: string;
}

function propagateToCoConsult(
  newVariantName: string,
  newVariantDesc: string,
  phase3Focus: string
): PropagationResult {
  const coConsultClaude = 'templates/co-consult/CLAUDE.md';
  const coConsultGemini = 'templates/co-consult/GEMINI.md';
  const newVariantClaude = `templates/${newVariantName}/CLAUDE.md`;

  let claudeUpdated = false;
  let geminiUpdated = false;
  let tableUpdated = false;
  let rulesUpdated = false;

  // Step 1: Update Supported Variants table
  const claudeContent = readFileSync(coConsultClaude, 'utf-8');
  const tableRow = `| ${newVariantName} | ${newVariantDesc} | ${phase3Focus} | stable |`;

  if (claudeContent.includes('## Supported Variants')) {
    const updated = claudeContent.replace(
      /(## Supported Variants\n\n\|[\s\S]*?\n)(\|)/,
      `$1${tableRow}\n$2`
    );
    writeFileSync(coConsultClaude, updated, 'utf-8');
    claudeUpdated = true;
    tableUpdated = true;
  }

  // Step 2: Extract and append variant-specific rules
  const newVariantContent = readFileSync(newVariantClaude, 'utf-8');
  const variantSpecificRules = extractVariantSpecificRules(newVariantContent);

  if (variantSpecificRules.length > 0) {
    const coConsultWithRules = readFileSync(coConsultClaude, 'utf-8');

    // Find "## Variant-Specific Rules" section and append
    const updatedWithRules = coConsultWithRules.replace(
      /(## Variant-Specific Rules\n\n)/,
      `$1### ${newVariantName}\n\n${variantSpecificRules.join('\n\n')}\n\n`
    );

    writeFileSync(coConsultClaude, updatedWithRules, 'utf-8');
    claudeUpdated = true;
    rulesUpdated = true;
  }

  // Step 3: Propagate to GEMINI.md (platform parity)
  if (claudeUpdated) {
    const geminiContent = readFileSync(coConsultGemini, 'utf-8');
    const geminiUpdated = geminiContent.replace(
      /(## Supported Variants\n\n\|[\s\S]*?\n)(\|)/,
      `$1${tableRow}\n$2`
    );
    writeFileSync(coConsultGemini, geminiUpdated, 'utf-8');
    geminiUpdated = true;
  }

  return {
    updatedClaudeMd: claudeUpdated,
    updatedGeminiMd: geminiUpdated,
    variantsTableUpdated: tableUpdated,
    rulesSectionUpdated: rulesUpdated,
    propagationSummary: `Propagated ${newVariantName} to co-consult: table=${tableUpdated}, rules=${rulesUpdated}`,
  };
}

function extractVariantSpecificRules(content: string): string[] {
  // Extract sections unique to variant (not in common/)
  const rules: string[] = [];
  const lines = content.split('\n');
  let currentRule: string[] = [];

  for (const line of lines) {
    if (line.match(/^#{3,4}\s/)) {
      // New rule section
      if (currentRule.length > 0) {
        rules.push(currentRule.join('\n'));
      }
      currentRule = [line];
    } else {
      currentRule.push(line);
    }
  }

  if (currentRule.length > 0) {
    rules.push(currentRule.join('\n'));
  }

  return rules.filter(rule => !rule.includes('## Common')); // Exclude common sections
}
```

**Acceptance Criteria**:

- [ ] New variant added to co-consult "Supported Variants" table
- [ ] Variant description matches `variant.json.description`
- [ ] Phase 3 focus matches `variant.json.phases.phase3_name`
- [ ] Variant status set to "stable"
- [ ] Variant-specific rules extracted and appended to co-consult CLAUDE.md
- [ ] Platform parity maintained (CLAUDE.md ↔ GEMINI.md)
- [ ] No duplicate variant entries in table
- [ ] Rules sections properly formatted (Markdown hierarchy preserved)

**Validation Command**:

```bash
# After propagation, validate co-consult platform parity
bun scripts/validate-templates.ts --variant co-consult
```

---

#### 5.5.5 Variant README.md Update

**Objective**: Generate a standardized `README.md` for the new variant with all required sections.

**Problem**: Each variant needs clear documentation explaining:
- What the variant is for
- How to use it
- What agents it includes
- What makes it different from other variants
- Platform parity considerations
- Lifecycle management rules

**README.md Template**:

```markdown
# <Variant Name> Template

> **Variant**: <variant-name>
> **Status**: stable
> **Version**: 1.0.0
> **Inherits**: templates/common@1.0.0

---

## Quick Start

```bash
# Create a new <variant-name> project
bun scripts/new-project.sh my-project --variant <variant-name>

# Windows
.\scripts\new-project.ps1 my-project -Variant <variant-name>
```

## Variant Description

<description from variant.json>

**This variant is ideal for**:
- <use case 1>
- <use case 2>
- <use case 3>

---

## Variant-Specific Features

### Agent Roster

| Agent | Role | Phase |
|-------|------|-------|
| <agent1> | <role> | <phases> |
| <agent2> | <role> | <phases> |
| PM | Orchestrator | All phases |

### Phase 3 Focus: <phase3_name>

<phase3 description>

### Skills

| Skill | Layer | Used By | Platform Parity |
|-------|-------|---------|-----------------|
| <skill1> | local/platform | <agents> | required/skip |
| <skill2> | local/platform | <agents> | required/skip |

---

## Platform Parity

This variant maintains full platform parity between Claude Code and Gemini:

| Platform | Status | Notes |
|----------|--------|-------|
| **Claude Code** | ✅ Full support | All features available |
| **Gemini** | ✅ Full support | All features available via Agent Manager |

### Platform-Specific Files

- `.claude/` — Claude Code-specific configurations
- `.gemini/` — Gemini-specific configurations
- Platform skills are duplicated in both `.claude/skills/` and `.gemini/skills/`

---

## Lifecycle Management

### Version Tracking

| Artifact | SSOT | Update Rule |
|----------|------|-------------|
| Agents | `last_updated` frontmatter | Update on any change |
| Skills | `version:` frontmatter | Semver bump on change |
| Scripts | `scripts/SCRIPTS.md` | Version in file + registry |
| Platform Skills | `version:` frontmatter | Initialize at 1.0.0 |

### Lifecycle Rules

This variant follows the **8-domain × 3-layer** lifecycle governance system:

1. **Agent Domain**: All agents in `agents/*.md` tracked via `last_updated` field
2. **Skill Domain**: All skills in `skills/*/SKILL.md` tracked via `version:` field
3. **Script Domain**: All scripts in `scripts/*.ts` tracked via `scripts/SCRIPTS.md`
4. **Platform Skills**: `.claude/skills/*/SKILL.md` and `.gemini/skills/*/SKILL.md` tracked
5. **Platform Commands**: `.claude/commands/*.md` and `.gemini/commands/*.md` tracked

> **Note**: This variant is **L2 (Generated Project layer)**. For L0/L1 lifecycle management, see the workspace root.

---

## Governance Workflow

### PM Override Type: <override_type>

**Override Type**: `additive` / `replacement` / `none`

**Reason**: <reason from variant.json>

**What This Means**:
- If `additive`: Variant adds specialized agents to base PM workflow
- If `replacement`: Variant completely replaces PM workflow (rare)
- If `none`: Variant uses base PM workflow unchanged

### Phase 3 Focus: <phase3_name>

<phase3 detailed description>

**Specialist Agents**:
- <agent1>: <role>
- <agent2>: <role>

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | YYYY-MM-DD | Initial stable release |

---

## Contributing

This variant is maintained by the workspace lifecycle-manager agent. To suggest changes:

1. Create a project using this variant
2. Test your changes in the project
3. Submit feedback via GitHub issue

## Related Variants

- **co-design**: UI/UX design and prototyping
- **co-develop**: Software development and implementation
- **co-work**: Collaboration and documentation
- **co-security**: Security assessment and compliance

---

**Template Version**: 1.0.0
**Last Updated**: YYYY-MM-DD
**Lifecycle Status**: stable
**Governed By**: workspace lifecycle-manager
```

**Implementation Spec**:

```typescript
/**
 * Generate standardized README.md for new variant
 * @version 1.0.0
 */

interface ReadMeGenerationOptions {
  variantName: string;
  variantJson: any;
  agents: string[];
  skills: any[];
  lastUpdated: string;
}

function generateVariantReadMe(options: ReadMeGenerationOptions): string {
  const { variantName, variantJson, agents, skills, lastUpdated } = options;

  // Build agent roster table
  const agentRows = agents
    .filter(a => a !== 'pm')
    .map(agent => {
      const agentFile = `templates/${variantName}/agents/${agent}.md`;
      const content = readFileSync(agentFile, 'utf-8');
      const roleMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
      const phaseMatch = content.match(/Can Lead Phases:\s*\[([^\]]+)\]/);
      const role = roleMatch ? roleMatch[1] : 'Specialist';
      const phases = phaseMatch ? phaseMatch[1] : '3-4';
      return `| ${agent} | ${role} | ${phases} |`;
    })
    .join('\n');

  // Build skills table
  const skillRows = skills.map(skill => {
    const usedBy = skill.used_by_agents.join(', ');
    return `| ${skill.name} | ${skill.layer} | ${usedBy} | ${skill.platform_parity} |`;
  }).join('\n');

  // Build related variants list
  const allVariants = ['co-design', 'co-develop', 'co-work', 'co-security']
    .filter(v => v !== variantName)
    .map(v => `- **${v}**: [description]`)
    .join('\n');

  return `# ${variantName.charAt(0).toUpperCase() + variantName.slice(1)} Template

> **Variant**: ${variantName}
> **Status**: ${variantJson.status}
> **Version**: ${variantJson.version}
> **Inherits**: templates/common@${variantJson.inherits_common}

---

## Quick Start

\`\`\`bash
# Create a new ${variantName} project
bun scripts/new-project.sh my-project --variant ${variantName}

# Windows
.\\scripts\\new-project.ps1 my-project -Variant ${variantName}
\`\`\`

## Variant Description

${variantJson.description}

**This variant is ideal for**:
- [Specific use cases to be documented]

---

## Variant-Specific Features

### Agent Roster

| Agent | Role | Phase |
|-------|------|-------|
${agentRows}
| PM | Orchestrator | All phases |

### Phase 3 Focus: ${variantJson.phases.phase3_name}

${variantJson.phases.phase3_name} focuses on ${variantName}-specific execution.

### Skills

| Skill | Layer | Used By | Platform Parity |
|-------|-------|---------|-----------------|
${skillRows}

---

## Platform Parity

This variant maintains full platform parity between Claude Code and Gemini:

| Platform | Status | Notes |
|----------|--------|-------|
| **Claude Code** | ✅ Full support | All features available |
| **Gemini** | ✅ Full support | All features available via Agent Manager |

### Platform-Specific Files

- \`.claude/\` — Claude Code-specific configurations
- \`.gemini/\` — Gemini-specific configurations
- Platform skills are duplicated in both \`.claude/skills/\` and \`.gemini/skills/\`

---

## Lifecycle Management

### Version Tracking

| Artifact | SSOT | Update Rule |
|----------|------|-------------|
| Agents | \`last_updated\` frontmatter | Update on any change |
| Skills | \`version:\` frontmatter | Semver bump on change |
| Scripts | \`scripts/SCRIPTS.md\` | Version in file + registry |
| Platform Skills | \`version:\` frontmatter | Initialize at 1.0.0 |

### Lifecycle Rules

This variant follows the **8-domain × 3-layer** lifecycle governance system:

1. **Agent Domain**: All agents in \`agents/*.md\` tracked via \`last_updated\` field
2. **Skill Domain**: All skills in \`skills/*/SKILL.md\` tracked via \`version:\` field
3. **Script Domain**: All scripts in \`scripts/*.ts\` tracked via \`scripts/SCRIPTS.md\`
4. **Platform Skills**: \`.claude/skills/*/SKILL.md\` and \`.gemini/skills/*/SKILL.md\` tracked
5. **Platform Commands**: \`.claude/commands/*.md\` and \`.gemini/commands/*.md\` tracked

> **Note**: This variant is **L2 (Generated Project layer)**. For L0/L1 lifecycle management, see the workspace root.

---

## Governance Workflow

### PM Override Type: ${variantJson.agent_overrides?.pm?.type || 'none'}

**Override Type**: \`${variantJson.agent_overrides?.pm?.type || 'none'}\`

**Reason**: ${variantJson.agent_overrides?.pm?.reason || 'No PM override'}

**What This Means**:
${variantJson.agent_overrides?.pm?.type === 'additive' ?
  '- Variant adds specialized agents to base PM workflow\n- Base PM workflow is preserved' :
  variantJson.agent_overrides?.pm?.type === 'replacement' ?
  '- Variant completely replaces PM workflow (rare)' :
  '- Variant uses base PM workflow unchanged'}

### Phase 3 Focus: ${variantJson.phases.phase3_name}

${variantJson.phases.phase3_name} focuses on ${variantName}-specific execution.

**Specialist Agents**:
${agents.filter(a => a !== 'pm').map(a => {
  const agentFile = \`templates/\${variantName}/agents/\${a}.md\`;
  const content = readFileSync(agentFile, 'utf-8');
  const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
  const desc = descMatch ? descMatch[1] : 'Specialist agent';
  return \`- \${a}: \${desc}\`;
}).join('\n')}

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| ${variantJson.version} | ${lastUpdated} | Initial stable release |

---

## Contributing

This variant is maintained by the workspace lifecycle-manager agent. To suggest changes:

1. Create a project using this variant
2. Test your changes in the project
3. Submit feedback via GitHub issue

## Related Variants

- **co-design**: UI/UX design and prototyping
- **co-develop**: Software development and implementation
- **co-work**: Collaboration and documentation
- **co-security**: Security assessment and compliance

---

**Template Version**: ${variantJson.version}
**Last Updated**: ${lastUpdated}
**Lifecycle Status**: ${variantJson.status}
**Governed By**: workspace lifecycle-manager
`;
}
```

**Acceptance Criteria**:

- [ ] README.md created in `templates/<new-variant>/README.md`
- [ ] All required sections present (Quick Start, Variant Description, Agent Roster, Platform Parity, Lifecycle Management, Governance Workflow, Version History)
- [ ] Variant description matches `variant.json.description`
- [ ] Agent roster table includes all variant-specific agents
- [ ] Skills table includes all variant-specific skills
- [ ] Platform parity section complete
- [ ] Lifecycle Management section documents 8-domain governance
- [ ] PM Override Type correctly populated from `variant.json`
- [ ] Phase 3 Focus matches `variant.json.phases.phase3_name`
- [ ] Related variants list excludes self
- [ ] Markdown formatting valid (no broken tables)
- [ ] Internal links use correct relative paths

---

### Summary: L1 Lifecycle Management Integration

**Phase 4 Integration Updates**:

After implementing §5.5, update Phase 4 (Integration) to include these steps:

```markdown
### Phase 4: Integration (PM + Docs Writer + Lifecycle Manager)

1. [ ] Update `README.md` workspace root
2. [ ] Update `scripts/new-project.sh`
3. [ ] Update `scripts/new-project.ps1`
4. [ ] Update `scripts/helpers/inject-skills.ts`
5. [ ] Update `docs/templates/VERSION_REGISTRY.json`
6. [ ] Update `scripts/validate-templates.ts`
7. [ ] **Execute L1 Lifecycle Management Steps (§5.5)**:
   - [ ] 5.5.1: memory/ development log cleanup
   - [ ] 5.5.2: AGENTS.md registration validation
   - [ ] 5.5.3: AGENTS.md PM Dispatch Table update
   - [ ] 5.5.4: co-consult CLAUDE.md/GEMINI.md propagation
   - [ ] 5.5.5: Variant README.md generation
```

**Acceptance Criteria §10 Updates**:

Add to §10.3 Integration Requirements:

```markdown
### 11.5 Integration Requirements

- [ ] **README.md**: Updated with new variant row
- [ ] **new-project scripts**: All three files (`.sh`, `.ps1`, `inject-skills.ts`) updated
- [ ] **VERSION_REGISTRY.json**: New variant entry added
- [ ] **validate-templates.ts**: N-01 check implemented
- [ ] **project-review skill**: L1 template consistency check added
- [ ] **L1 Lifecycle Management**: All 5 steps completed and validated:
  - [ ] 5.5.1: memory/ logs cleaned
  - [ ] 5.5.2: AGENTS.md registrations valid
  - [ ] 5.5.3: PM Dispatch Table updated
  - [ ] 5.5.4: co-consult platform docs propagated
  - [ ] 5.5.5: Variant README.md generated
```

---

## 7. Automation Engineer Implementation Spec

### 6.1 Script Structure

**New Script**: `scripts/l2-to-variant-pipeline.ts`

```typescript
#!/usr/bin/env bun
/**
 * L2-to-Variant Conversion Pipeline
 * @version 1.0.0
 *
 * Converts a user-created L2 project into a new template variant.
 *
 * Usage:
 *   bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name>
 *   bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name> --dry-run
 *   bun scripts/l2-to-variant-pipeline.ts <l2-project-path> --variant <name> --force
 *
 * Options:
 *   --dry-run        : Analyze without generating files
 *   --force          : Overwrite existing variant directory
 *   --skip-validation: Skip platform parity validation
 *   --json           : Output manifest as JSON
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { load } from 'js-yaml';
// Import existing validation functions from validate-templates.ts

// ... implementation ...
```

### 6.2 Core Functions

**Phase 1 Functions**:

```typescript
async function scanL2Project(l2Path: string): Promise<L2ScanResult> {
  // Recursive directory scan
  // Hash computation
  // L0/L1 lookup
  // Classification
  // Return L2ScanResult
}

function generateIntermediateManifest(scan: L2ScanResult): IntermediateManifest {
  // Extract variant candidates
  // Identify overrides
  // Return IntermediateManifest
}
```

**Phase 2 Functions**:

```typescript
async function reconcileWithL0L1(
  manifest: IntermediateManifest
): Promise<ReconciledManifest> {
  // Version comparison
  // Anti-swelling check
  // Reclassification
  // Conflict resolution
  // Return ReconciledManifest
}

function checkAntiSwelling(
  filePath: string,
  existingVariants: string[]
): AntiSwellingAction {
  // Override ratio calculation
  // Return action
}
```

**Phase 3 Functions**:

```typescript
async function generateVariant(
  reconciled: ReconciledManifest,
  variantName: string,
  outputDir: string
): Promise<GenerationResult> {
  // Create directory structure
  // Generate variant.json
  // Copy files
  // Generate CLAUDE.md/GEMINI.md
  // Validate platform parity
  // Return GenerationResult
}

function validatePlatformParity(variantPath: string): ValidationResult {
  // .claude ↔ .gemini checks
  // settings.json parity
  // Return ValidationResult
}
```

### 6.3 CLI Interface

```typescript
interface PipelineOptions {
  l2ProjectPath: string;
  variantName: string;
  dryRun: boolean;
  force: boolean;
  skipValidation: boolean;
  jsonOutput: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  // Parse arguments
  // Validate inputs
  // Run pipeline
  // Output results
}
```

### 6.4 Error Handling

```typescript
class PipelineError extends Error {
  constructor(
    public phase: 'scan' | 'reconcile' | 'generate',
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'PipelineError';
  }
}

// Error codes:
// - L2_NOT_FOUND: L2 project path does not exist
// - L2_INVALID: L2 project is not a valid project (missing CLAUDE.md/GEMINI.md)
// - VARIANT_EXISTS: Variant directory already exists (use --force)
// - VERSION_CONFLICT: Unresolvable version conflict
// - PARITY_VIOLATION: Platform parity check failed
// - COMMON_CONFLICT: Cannot reconcile with common layer
```

---

## 8. Testing Strategy

### 7.1 Unit Tests

**Test File**: `scripts/test-l2-to-variant-pipeline.ts`

```typescript
describe('L2-to-Variant Pipeline', () => {
  describe('Phase 1: Scan', () => {
    it('should classify new files correctly', async () => {
      // Test: File in L2 but not in L0/L1 → classification: 'new'
    });

    it('should detect modified files', async () => {
      // Test: File in all layers with different hashes → classification: 'modified'
    });

    it('should identify identical files', async () => {
      // Test: Same hash across layers → classification: 'identical'
    });
  });

  describe('Phase 2: Reconcile', () => {
    it('should keep newer version', async () => {
      // Test: L2 version 1.2.0 > L0 version 1.1.0 → action: 'keep-in-variant'
    });

    it('should discard older version', async () => {
      // Test: L2 version 1.0.0 < L1 version 1.3.0 → action: 'move-to-common'
    });

    it('should trigger anti-swelling protection', async () => {
      // Test: 3/5 variants override same file → action: 'move-to-common'
    });
  });

  describe('Phase 3: Generate', () => {
    it('should create valid variant.json', async () => {
      // Test: variant.json schema validation
    });

    it('should maintain platform parity', async () => {
      // Test: .claude/ ↔ .gemini/ parity check
    });

    it('should generate correct directory structure', async () => {
      // Test: All required directories exist
    });
  });
});
```

### 7.2 Integration Tests

**Test Scenarios**:

1. **End-to-end conversion**: Convert a real L2 project (e.g., `test-projects/variant-candidate/`)
2. **Conflict resolution**: L2 project with conflicting L0/L1 versions
3. **Anti-swelling**: L2 project that should move content to common
4. **Platform parity**: L2 project with parity violations
5. **Dry run**: Verify analysis without file generation

### 7.3 Validation Tests

**Post-Generation Checks**:

```bash
# After pipeline runs, validate the new variant
bun scripts/validate-templates.ts --variant <new-variant>

# Test project creation with new variant
bun scripts/new-project.sh test-project --variant <new-variant>

# Verify new project structure
cd test-project
ls -la agents/ skills/ .claude/ .gemini/
```

---

## 9. Trade-offs & Decisions

### 8.1 Design Decisions

| Decision | Option A | Option B | Chosen | Rationale |
|----------|----------|----------|--------|-----------|
| **Version resolution** | Always keep L2 | Semver compare | **B** | Respects SSOT - L0/L1 may have newer fixes |
| **Hash vs version** | Use only version | Hash for binaries, version for text | **B** | Text files may have uncommitted changes |
| **Anti-swelling threshold** | 40% | 50% | **B** (50%) | Conservative - avoid premature common moves |
| **Platform parity enforcement** | Strict (block generation) | Warning only | **A** (strict) | Prevents technical debt accumulation |
| **Conflict handling** | Auto-resolve (keep newer) | Fail and prompt user | **B** (fail) | Safety first - user must decide |

### 8.2 Architectural Trade-offs

**Trade-off 1: Complexity vs. Flexibility**

- **Approach A**: Simple copy pipeline (always keep L2 files as-is)
  - Pro: Simple, predictable
  - Con: Violates SSOT, duplicates content

- **Approach B**: Full reconciliation pipeline (chosen)
  - Pro: Respects SSOT, prevents duplication
  - Con: More complex, requires user understanding

**Decision**: Approach B - SSOT compliance is non-negotiable.

**Trade-off 2: Automation vs. Control**

- **Approach A**: Fully automated (no user intervention)
  - Pro: Fast, no friction
  - Con: May make wrong decisions

- **Approach B**: Interactive prompts (chosen)
  - Pro: User control over conflicts
  - Con: Slower, requires attention

**Decision**: Approach B with `--force` flag for power users.

---

## 10. Open Questions

1. **Backpropagation Strategy**: When anti-swelling triggers a "move-to-common" action, should the pipeline:
   - Automatically update `templates/common/`?
   - Require manual lifecycle-manager review?
   - Create a separate PR for common layer updates?

   **Recommendation**: Require lifecycle-manager review (generate ADR, create separate PR).

2. **Variant Naming Convention**: Should variant names:
   - Follow `co-*` pattern (co-consult, co-data)?
   - Allow arbitrary names?
   - Be validated against a naming schema?

   **Recommendation**: Enforce `co-*` pattern for consistency, but allow `custom-*` for user-specific variants.

3. **Version Conflict Resolution**: When L2 has same version as L0/L1 but different content:
   - Keep L2 (assume user intent)?
   - Fail with conflict error?
   - Use hash as tiebreaker?

   **Recommendation**: Fail with conflict error + prompt user to increment version in L2.

4. **L0-Only File Detection**: Should the pipeline:
   - Scan for L0-only scripts (validate-templates.ts, audit.ts)?
   - Silently discard them?
   - Fail with error?

   **Recommendation**: Warn but continue - L0 files may be accidentally copied but don't break variants.

---

## 11. Acceptance Criteria

The pipeline implementation is complete when:

### 11.1 ADR Requirements (NEW - Governance Gap #1)

- [ ] **ADR Created**: Architectural Decision Record created before pipeline execution
  - [ ] ADR file exists: `docs/adr/YYYYMM-variant-creation-<variant>.md`
  - [ ] ADR follows template structure (all required sections present)
  - [ ] ADR status set to "**Accepted**" (not Proposed or Rejected)
- [ ] **ADR Content Completeness**: ADR includes all required sections
  - [ ] Context: Problem statement, driving forces, stakeholder impact
  - [ ] Decision: Variant profile (name, agents, skills, PM override type)
  - [ ] Consequences: Positive/negative impacts, template version impact analysis
  - [ ] Template Version Impact: L1 dependency, bumping policy (patch/minor/major)
  - [ ] L1 Version Dependency: VERSION_REGISTRY.json schema v1.1 fields documented
  - [ ] Risks and Mitigations: 3+ risks with mitigation strategies
  - [ ] Alternatives Considered: Minimum 3 alternatives with pros/cons/decisions
  - [ ] Implementation Timeline: Phase breakdown with durations and owners
  - [ ] Success Criteria: 10+ criteria including governance and validation
  - [ ] References: Links to L2 project, CONSTITUTION.md, variant lifecycle docs
- [ ] **ADR Approval**: ADR approved by proper authorities
  - [ ] PM approval recorded in ADR
  - [ ] Platform Lead approval recorded (for major architectural changes)
  - [ ] Approval date documented
- [ ] **ADR Gating Logic**: Pipeline enforces ADR requirement
  - [ ] Pipeline entry point validates ADR existence
  - [ ] Pipeline checks ADR status is "**Accepted**"
  - [ ] Pipeline blocks execution if ADR missing or not approved
  - [ ] Clear error messages guide user to create/approve ADR
- [ ] **ADR Template**: Template file created for future ADR creation
  - [ ] Template location: `docs/adr/templates/variant-creation-template.md`
  - [ ] Template includes all required sections with placeholders
  - [ ] Template includes acceptance criteria checklist
  - [ ] Template includes approval workflow documentation

### 11.2 Template Version Management Requirements (NEW - Governance Gap #2)

- [ ] **VERSION_REGISTRY.json Schema v1.1**: Registry updated with new schema fields
  - [ ] Schema version bumped to "1.1"
  - [ ] New variant includes `inherits_common` field (L1 version dependency)
  - [ ] New variant includes `common_version_policy` object with all three fields:
    - [ ] `patch_auto_inherit: true`
    - [ ] `minor_requires_review: true`
    - [ ] `major_requires_reconciliation: true`
  - [ ] All existing variants migrated to schema v1.1 (if applicable)
- [ ] **L1 Version Inheritance**: Each variant declares L1 dependency explicitly
  - [ ] `inherits_common` field set to current L1 version (e.g., "1.0.0")
  - [ ] `inherits_common` documented in ADR (Consequences section)
  - [ ] `inherits_common` validated by `validate-templates.ts`
- [ ] **L1 Version Impact Policy**: Three-tier version impact rules defined
  - [ ] PATCH updates (X.Y.Z → X.Y.Z+1): Auto-inherit, no action required
  - [ ] MINOR updates (X.Y.Z → X.Y+1.0): Review required, test thoroughly
  - [ ] MAJOR updates (X.Y.Z → X+1.0.0): **REQUIRED** - Full Phase 2 reconciliation
  - [ ] Policy documented in ADR (Template Version Impact section)
  - [ ] Policy documented in VERSION_REGISTRY.json schema
- [ ] **L1 Version Validation**: Automated validation enforces inheritance rules
  - [ ] `validate-templates.ts` includes L1_VERSION_INHERITANCE check
  - [ ] Validation warns if PATCH mismatch (should auto-inherit)
  - [ ] Validation warns if MINOR mismatch without review
  - [ ] Validation **FAILS** if MAJOR mismatch without reconciliation
  - [ ] Clear error messages guide remediation steps
- [ ] **PATCH Auto-Inherit Script**: Automation script created for PATCH updates
  - [ ] Script location: `scripts/update-inherits-common.ts`
  - [ ] Script auto-updates `inherits_common` for all variants on PATCH
  - [ ] Script validates update succeeded
  - [ ] Script provides next action (commit via /sync)
- [ ] **MAJOR Reconciliation Process**: Documented process for L1 MAJOR updates
  - [ ] Process documented in pipeline design (§5.3)
  - [ ] Process includes step-by-step reconciliation workflow
  - [ ] Process includes validation checkpoints
  - [ ] Process includes rollback procedures

### 11.3 Functional Requirements

- [ ] **SSOT Compliance**: No L0-only files (e.g., `validate-templates.ts`) copied to variant
- [ ] **No Duplication**: Files identical to L0/L1 are discarded (not copied)
- [ ] **Version Accuracy**: `@version` headers correctly extracted and compared
- [ ] **Hash Integrity**: SHA-256 hashes computed for all files
- [ ] **Error Handling**: All error codes defined and documented

### 11.5 Integration Requirements

- [ ] **README.md**: Updated with new variant row (**status="beta"** NOT "stable")
- [ ] **new-project scripts**: All three files (`.sh`, `.ps1`, `inject-skills.ts`) updated
  - [ ] Beta warning prompt implemented in `new-project.sh`
  - [ ] Beta warning displayed before project creation
  - [ ] User must type "yes" to accept beta limitations
- [ ] **VERSION_REGISTRY.json**: New variant entry added (**status="beta"** NOT "stable")
- [ ] **validate-templates.ts**: N-01 check implemented
- [ ] **project-review skill**: L1 template consistency check added

### 11.6 Documentation Requirements

- [ ] **ADR**: Architectural Decision Record for variant auto-generation
- [ ] **User Guide**: `docs/how-to/use-l2-to-variant-pipeline.md`
- [ ] **Error Codes**: All error codes documented with examples
- [ ] **Migration Guide**: How to update existing variants after pipeline changes
- [ ] **Beta Lifecycle Documentation**: Variant README.md includes:
  - [ ] Lifecycle Status section with all metrics table
  - [ ] Promotion timeline with specific dates
  - [ ] Stable requirements checklist (✅/⏳ progress indicators)
  - [ ] Beta usage notice prominently displayed
- [ ] **Stable Promotion ADR**: Template created in `docs/adr/YYYYMM-stable-promotion-<variant>.md` when ready for promotion

### 11.7 Lifecycle Management Requirements

- [ ] **L1 Lifecycle Management**: All 5 steps completed and validated:
  - [ ] 5.5.1: memory/ logs cleaned (environment-specific artifacts removed)
  - [ ] 5.5.2: AGENTS.md registrations valid (all agents/skills/workflows registered)
  - [ ] 5.5.3: PM Dispatch Table updated (new variant row added)
  - [ ] 5.5.4: co-consult platform docs propagated (Supported Variants table + rules)
  - [ ] 5.5.5: Variant README.md generated (all required sections present)
- [ ] **Governance Compliance**: All lifecycle audit tools pass:
  - [ ] `bun run agent:verify` — agent domain valid
  - [ ] `bun scripts/skill-lifecycle-audit.ts` — skill domain valid
  - [ ] `bun scripts/lifecycle-sync-audit.ts` — script domain valid
  - [ ] `bun scripts/validate-templates.ts` — variant domain valid

### 11.8 Beta Lifecycle Requirements

- [ ] **Beta Creation**: New variant created with correct default state:
  - [ ] `variant.json` status="beta" (NOT "stable")
  - [ ] `variant.json` version="0.1.0" (NOT "1.0.0")
  - [ ] `lifecycle.statusSince` set to creation date
  - [ ] `lifecycle.betaEngagements` initialized to 0
  - [ ] `lifecycle.stablePromotedOn` set to null
- [ ] **Beta Documentation**: Variant README.md includes beta lifecycle section:
  - [ ] Lifecycle Status table with all metrics (status, version, engagements, bugs)
  - [ ] Promotion timeline with specific dates
  - [ ] Stable requirements checklist with progress indicators (✅/⏳)
  - [ ] Beta usage notice prominently displayed
- [ ] **Beta User Experience**: `new-project.sh` implements beta warning:
  - [ ] Beta warning displayed before project creation
  - [ ] Warning includes variant name, beta since date, and version
  - [ ] User must explicitly type "yes" to accept (capitalized NO default)
  - [ ] Cancellation message if user rejects
- [ ] **Stable Promotion Tracking**: System tracks promotion eligibility:
  - [ ] Engagement count tracked in `lifecycle.betaEngagements`
  - [ ] Bug report status queryable via GitHub Issues
  - [ ] Duration in beta calculable from `lifecycle.statusSince`
  - [ ] Documentation review status tracked in memory logs
  - [ ] Platform parity validated via `validate-templates.ts`
- [ ] **Stable Promotion Process**: Defined and documented:
  - [ ] Verification script (`verify-stable-promotion.ts`) implements 8-criteria check
  - [ ] ADR template created for promotion documentation
  - [ ] Promotion process documented in pipeline design
  - [ ] Post-promotion validation steps defined
- [ ] **Governance Alignment**: All lifecycle rules comply with:
  - [ ] `docs/governance/variant-lifecycle.md` framework
  - [ ] `docs/templates/VERSION_REGISTRY.json` schema
  - [ ] `docs/templates/variant.schema.json` validation rules
  - [ ] lifecycle-manager agent responsibilities defined in `agents/lifecycle-manager.md`

---

## 12. Implementation Phases

### Phase 0: ADR Creation (PM + Architect)

**Governance Gate**: Pipeline cannot proceed without approved ADR.

1. Architect creates ADR using template (`docs/adr/templates/variant-creation-template.md`)
2. Architect documents:
   - Problem statement and driving forces
   - Variant profile (agents, skills, PM override type)
   - Template version impact (L1 dependency, bumping policy)
   - Consequences (positive/negative impacts, risks)
   - Alternatives considered (minimum 3)
3. PM reviews ADR for completeness and accuracy
4. Platform Lead reviews ADR (for major architectural changes)
5. ADR status set to "**Accepted**"
6. Pipeline execution authorized

**Deliverables**:
- Approved ADR: `docs/adr/YYYYMM-variant-creation-<variant>.md`
- VERSION_REGISTRY.json schema v1.1 fields defined (inherits_common, common_version_policy)

**Acceptance Criteria**:
- [ ] ADR includes all required sections (Context, Decision, Consequences, etc.)
- [ ] ADR status set to "**Accepted**"
- [ ] Variant profile explicitly lists agents, skills, workflows
- [ ] Template version impact documented (L1 inherits_common, patch/minor/major policies)
- [ ] Risk analysis complete (3+ risks with mitigation)
- [ ] Alternatives considered (minimum 3)
- [ ] PM and Platform Lead approval recorded

### Phase 1: Prerequisites (PM + Architect)

1. User provides L2 project path
2. Architect reviews L2 project structure
3. Architect identifies potential issues (missing L0 components, platform parity violations)
4. Architect approves or rejects conversion

### Phase 2: Core Pipeline (Automation Engineer)

1. Implement `scripts/l2-to-variant-pipeline.ts`
2. Implement file scanning and classification
3. Implement version comparison logic
4. Implement intermediate manifest generation
5. Unit tests for Phase 1

### Phase 3: Reconciliation Engine (Automation Engineer)

1. Implement L0/L1 comparison logic
2. Implement anti-swelling detection
3. Implement conflict resolution
4. Implement reconciled manifest generation
5. Unit tests for Phase 2

### Phase 4: Generation Engine (Automation Engineer)

1. Implement `variant.json` generation with **BETA DEFAULT** (status="beta", version="0.1.0")
2. Implement directory structure creation
3. Implement file copying logic
4. Implement CLAUDE.md/GEMINI.md generation
5. Implement platform parity validation
6. **NEW**: Implement beta lifecycle metadata initialization
7. **NEW**: Implement beta documentation generation (README.md lifecycle section)
8. **NEW**: Implement inherits_common field in variant.json (L1 dependency)
9. **NEW**: Implement common_version_policy object (patch/minor/major rules)
10. Unit tests for Phase 4

### Phase 4.5: Beta Lifecycle Setup (Automation Engineer + Lifecycle Manager)

1. Implement beta warning in `new-project.sh` (Unix) and `new-project.ps1` (Windows)
2. Create `scripts/verify-stable-promotion.ts` script for 8-criteria verification
3. Create ADR template for stable promotion (`docs/adr/templates/stable-promotion-template.md`)
4. Implement engagement tracking in variant.json (lifecycle.betaEngagements counter)
5. Implement beta duration calculation utilities
6. Document beta → stable promotion process in pipeline design
7. Update validate-templates.ts to check beta status compliance
8. **NEW**: Create ADR template for variant creation (`docs/adr/templates/variant-creation-template.md`)
9. **NEW**: Implement ADR gating logic in pipeline entry point (validate ADR before Phase 1)

### Phase 5: Integration (PM + Docs Writer + Lifecycle Manager)

1. Update `README.md`
2. Update `scripts/new-project.sh`
3. Update `scripts/new-project.ps1`
4. Update `scripts/helpers/inject-skills.ts`
5. Update `docs/templates/VERSION_REGISTRY.json`:
   - **NEW**: Bump schema_version to "1.1"
   - **NEW**: Add inherits_common field for new variant
   - **NEW**: Add common_version_policy object for new variant
6. Update `scripts/validate-templates.ts`:
   - **NEW**: Add L1_VERSION_INHERITANCE check
   - **NEW**: Validate inherits_common field presence
   - **NEW**: Validate common_version_policy object
7. **NEW**: Create `scripts/update-inherits-common.ts` for PATCH auto-inherit
8. **Execute L1 Lifecycle Management Steps (§5.6)**:
   - [ ] 5.6.1: memory/ development log cleanup
   - [ ] 5.6.2: AGENTS.md registration validation
   - [ ] 5.6.3: AGENTS.md PM Dispatch Table update
   - [ ] 5.6.4: co-consult CLAUDE.md/GEMINI.md propagation
   - [ ] 5.6.5: Variant README.md generation

### Phase 6: Validation (PM + Auditor)

1. Run `bun scripts/validate-templates.ts --variant <new-variant>`
2. Test project creation: `bun scripts/new-project.sh test-<variant> --variant <new-variant>`
3. Run `project-review` skill on test project
4. Fix any validation failures
5. Final QA audit: `bun scripts/audit.ts`

---

## 13. Next Steps

**For PM**:
1. Review this design document
2. Approve or request changes
3. Provide L2 project path for pilot conversion
4. Dispatch automation-engineer for implementation

**For Automation Engineer** (after PM approval):
1. Implement Phase 1 (file scanning)
2. Implement Phase 2 (reconciliation)
3. Implement Phase 3 (generation)
4. Write unit tests
5. Coordinate with PM for integration updates

**For Docs Writer** (after implementation):
1. Create user guide: `docs/how-to/use-l2-to-variant-pipeline.md`
2. Update README.md with new variant
3. Document error codes and troubleshooting

---

## Appendix A: Example Manifests

### A.1 IntermediateManifest Example

```json
{
  "scanMetadata": {
    "l2ProjectPath": "/Users/test/my-co-data-project",
    "l2ProjectName": "my-co-data-project",
    "scannedAt": "2026-06-03T10:30:00Z",
    "totalFiles": 45,
    "newFiles": 12,
    "modifiedFiles": 8,
    "identicalFiles": 25
  },
  "classifications": {
    "agents": [
      {
        "relativePath": "agents/data-engineer.md",
        "existsInL0": false,
        "existsInL1": false,
        "classification": "new",
        "platformScope": "neutral"
      },
      {
        "relativePath": "agents/pm.md",
        "existsInL0": true,
        "existsInL1": true,
        "l0Version": "1.0.0",
        "l1Version": "1.0.0",
        "l2Version": "1.1.0",
        "classification": "modified",
        "platformScope": "neutral"
      }
    ],
    "skills": [
      {
        "relativePath": "skills/data-pipeline/SKILL.md",
        "existsInL0": false,
        "existsInL1": false,
        "classification": "new",
        "platformScope": "neutral"
      }
    ]
  },
  "variantCandidates": {
    "variantSpecificAgents": ["agents/data-engineer.md"],
    "variantSpecificSkills": ["skills/data-pipeline/"],
    "variantSpecificCommands": [],
    "variantSpecificPlatformSkills": [".claude/skills/etl-automation/"],
    "overrideCandidates": [
      {
        "filePath": "agents/pm.md",
        "overrideType": "additive",
        "reason": "Adds data-engineer to agent roster",
        "existingInCommon": true,
        "affectedAgents": ["pm"]
      }
    ]
  }
}
```

### A.2 ReconciledManifest Example

```json
{
  "phase": "reconciled",
  "decisions": {
    "keepInVariant": [
      {
        "sourcePath": "/Users/test/my-co-data-project/agents/data-engineer.md",
        "targetPath": "templates/co-data/agents/data-engineer.md",
        "reason": "New agent not in L0/L1"
      },
      {
        "sourcePath": "/Users/test/my-co-data-project/agents/pm.md",
        "targetPath": "templates/co-data/agents/pm.md",
        "reason": "L2 version 1.1.0 > L0/L1 version 1.0.0"
      }
    ],
    "moveToCommon": [
      {
        "sourcePath": "/Users/test/my-co-data-project/.claude/skills/audit-workspace/SKILL.md",
        "targetPath": "templates/common/.claude/skills/audit-workspace/SKILL.md",
        "reason": "L0 version 1.2.0 > L2 version 1.0.0"
      }
    ],
    "discard": [
      {
        "sourcePath": "/Users/test/my-co-data-project/skills/project-review/SKILL.md",
        "targetPath": null,
        "reason": "Identical to L0/L1 - inherited"
      }
    ],
    "conflicts": []
  },
  "variantJson": {
    "name": "co-data",
    "inherits_common": "1.0.0",
    "agent_overrides": {
      "pm": {
        "type": "additive",
        "reason": "co-data provides variant-specific Agent Roster (data-engineer, data-analyst), Governance Workflow (Phase 3 = Data Pipeline), and Dispatch Protocol",
        "since": "2026-06-03",
        "reviewed_by": "lifecycle-manager",
        "overrides": ["agent-roster", "governance-workflow", "dispatch-protocol"]
      }
    },
    "skill_manifest": {
      "variant_specific": [
        {
          "name": "data-pipeline",
          "layer": "local",
          "used_by_agents": ["data-engineer", "pm"],
          "phases": [3, 4],
          "platform_parity": "required"
        }
      ]
    },
    "phases": {
      "phase3_name": "Data Pipeline"
    },
    "version": "1.0.0",
    "description": "Data engineering variant for ETL, data pipeline, and analytics projects. Includes 2 specialized data agents."
  },
  "propagationActions": {
    "updateCommon": [],
    "backpropagateFromVariant": []
  }
}
```

---

**Document Status**: Design Complete - Ready for PM Review (Governance Gaps Addressed)
**Next Action**: PM approval → Automation Engineer implementation
**Enhancement Summary**: Added ADR requirements (§2) and template version management (§5.3) to address critical governance gaps

---

## Appendix B: Governance Enhancement Summary

**Changes Made (2026-06-03)**:

### 1. Core Governance Gaps Addressed

**Gap #1: ADR Requirements for New Variants**
- **Problem**: No architectural decision documentation required for variant creation
- **Solution**: Phase 0 (ADR Creation) added as blocking gate before pipeline execution
- **Impact**: All new variants must document rationale, alternatives, and impact before creation

**Gap #2: Template Version Management**
- **Problem**: L1 (templates/common/) version impact on variants unclear
- **Solution**: Three-tier version impact policy (PATCH/MINOR/MAJOR) with automated enforcement
- **Impact**: Clear governance rules for L1 updates, breaking change detection, reconciliation requirements

### 2. New Sections Added

| Section | Description | Location |
|---------|-------------|----------|
| §2 (Phase 0) | ADR Creation | Governance gate before pipeline execution |
| §2.1 | ADR Requirement Rationale | Why ADRs are mandatory for variant creation |
| §2.2 | ADR Template for Variant Creation | Comprehensive ADR structure with all required sections |
| §2.3 | ADR Gating Logic | Pipeline enforcement implementation |
| §2.4 | ADR Acceptance Criteria | Quality gates for ADR approval |
| §2.5 | ADR Template File | Template file creation requirement |
| §5.3 | Template Version Management Policy | L1 version impact governance |
| §5.3.1 | L1 Version Impact Scenarios | PATCH/MINOR/MAJOR scenarios |
| §5.3.2 | L1 Version Dependency Matrix | Variant inheritance tracking |
| §5.3.3 | L1 Bumping Decision Tree | Automated decision logic |
| §5.3.4 | Automated Enforcement | Validation checks and scripts |
| §5.3.5 | Template Version Acceptance Criteria | Schema v1.1 requirements |

### 3. Enhanced Acceptance Criteria

**New Requirement Categories**:
- §11.1: ADR Requirements (governance documentation, approval workflow)
- §11.2: Template Version Management Requirements (L1 dependency, version impact policy)

**Updated Requirement Categories**:
- §11.3: Functional Requirements (phase numbering updated)
- §11.4: Quality Requirements (phase numbering updated)
- §11.5: Integration Requirements (phase numbering updated, VERSION_REGISTRY.json schema v1.1)
- §11.6: Documentation Requirements (ADR template added)
- §11.7: Lifecycle Management Requirements (phase numbering updated)
- §11.8: Beta Lifecycle Requirements (phase numbering updated)

### 4. Implementation Phases Updated

**New Phase**: Phase 0 (ADR Creation) added as first step
**Updated Phases**: All subsequent phases renumbered (Phase 1 → Phase 2, etc.)

### 5. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **ADR Requirement** | Mandatory before pipeline | Prevents unvalidated architectural changes |
| **ADR Template** | Comprehensive (10+ sections) | Ensures thorough analysis and documentation |
| **ADR Gating** | Pipeline blocks without approved ADR | Enforcement mechanism for governance |
| **L1 Dependency Declaration** | Required (inherits_common field) | Clear version tracking and impact analysis |
| **PATCH Auto-Inherit** | Fully automated | Bug fixes should propagate without friction |
| **MINOR Review** | Manual review required | New features may need compatibility testing |
| **MAJOR Reconciliation** | Full pipeline required | Breaking changes need systematic reconciliation |
| **Schema Version Bump** | 1.0 → 1.1 | Signals new governance capabilities |

### 6. Risk Mitigation

**Risks Addressed**:
- Unvalidated variant creation → ADR requirement prevents this
- Unclear L1 version impact → Template version management policy clarifies
- Breaking changes undetected → MAJOR reconciliation enforcement catches them
- Governance bypass attempts → ADR gating logic blocks pipeline execution

**Governance Safeguards**:
- ADR must be approved by PM and Platform Lead
- Pipeline enforces ADR requirement programmatically
- VERSION_REGISTRY.json schema validates L1 dependency declarations
- validate-templates.ts enforces version inheritance rules
- MAJOR mismatches fail validation, forcing reconciliation

---

## Appendix C: Beta Lifecycle Enhancement Summary (Original)

**Previous Enhancement (2026-06-03 - Morning)**:

### 1. Core Design Change
- **Before**: New variants created as `status: "stable"`, `version: "1.0.0"`
- **After**: New variants created as `status: "beta"`, `version: "0.1.0"`
- **Rationale**: All variants require real-world validation before production use

### 2. New Sections Added (Original Enhancement)

| Section | Description | Location |
|---------|-------------|----------|
| §4.4.1 | Default Beta Creation State | variant.json initialization rules |
| §4.4.2 | Beta Status Constraints | Usage restrictions, warnings, support scope |
| §4.4.3 | Beta → Stable Promotion Criteria | 8-criteria verification system |
| §4.4.4 | Stable Promotion Process | 3-phase promotion workflow |
| §4.4.5 | Lifecycle Status Documentation | README.md updates for beta/stable states |

---

**Enhancement Author**: Architect Agent (PM Dispatched)
**Review Status**: Ready for PM Review
**Next Review**: After PM approval, before automation-engineer implementation
- §10.6: Beta lifecycle governance requirements (24 new criteria)

**Total New Criteria**: 33 acceptance criteria specifically for beta lifecycle management

### 4. Implementation Impact

**Affected Components**:
1. `variant.json` generation (Phase 3) - BETA DEFAULT logic
2. `README.md` generation (Phase 3) - Lifecycle Status section
3. `new-project.sh` (Phase 3.5) - Beta warning prompt
4. `VERSION_REGISTRY.json` (Phase 4) - Beta registration
5. Workspace `README.md` (Phase 4) - Beta status in Available Variants

**New Scripts Required**:
1. `scripts/verify-stable-promotion.ts` - 8-criteria verification
2. `docs/adr/templates/stable-promotion-template.md` - ADR template

### 5. Governance Compliance

All changes comply with:
- [`docs/governance/variant-lifecycle.md`](../../governance/variant-lifecycle.md) - Official lifecycle framework
- [`agents/lifecycle-manager.md`](../../agents/lifecycle-manager.md) - Lifecycle governance ownership
- [`docs/templates/VERSION_REGISTRY.json`](../../templates/VERSION_REGISTRY.json) - Schema compliance

### 6. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Default status** | beta (not stable) | Prevents premature production commitment |
| **Default version** | 0.1.0 (not 1.0.0) | Semantic versioning for pre-release |
| **Engagement tracking** | betaEngagements counter | Quantifiable promotion metric |
| **User experience** | Explicit "yes" confirmation | Prevents accidental beta usage |
| **Promotion criteria** | 8 mandatory checks | Comprehensive validation before stable |
| **Documentation** | ADR required for promotion | Architectural decision record-keeping |

### 7. Risk Mitigation

**Risks Addressed**:
- Unvalidated variants in production → Beta default prevents this
- User unawareness of beta status → Warning prompt ensures acknowledgment
- Premature stable promotion → 8-criteria verification enforces waiting period
- Lack of promotion audit trail → ADR requirement creates documentation

**Governance Safeguards**:
- lifecycle-manager owns all status transitions (no automated promotion)
- Platform Lead approval required for stable promotion
- All criteria must pass (no waivers without ADR)
- Post-promotion validation required before commit

---

**Enhancement Author**: Architect Agent (PM Dispatched)
**Review Status**: Ready for PM Review
**Next Review**: After PM approval, before automation-engineer implementation
