# ADR 0020: abap_vibe_coding Variant Conversion

**Status**: Accepted
**Date**: 2026-06-01
**Decision Type**: Tech Strategy / Architecture
**Applies To**: abap_vibe_coding project

---

## Context

### Problem Statement

**abap_vibe_coding project structure analysis** revealed a fundamental architectural mismatch with the workspace standard:

**Current state (Standalone project)**:
- Monolithic `docs/context.md` containing everything (governance + tech stack + ABAP rules)
- No reference to workspace root CONSTITUTION.md
- Independent CLAUDE.md structure not aligned with co-develop template
- SAP ABAP Harness framework using custom `vsp` MCP server

**Workspace standard (co-develop variant)**:
- Layered context system: immutable `docs/context.md` + variant-specific custom context
- References workspace root CONSTITUTION.md for governance
- CLAUDE.md extends from co-develop template with PM Gateway enforcement
- Clear separation between immutable project identity and customizable domain content

**Structural differences identified**:

| Aspect | Current (abap_vibe_coding) | Target (co-develop variant) |
|--------|--------------------------|------------------------------|
| **CONSTITUTION.md** | None | **References workspace root only** |
| **docs/context.md** | Monolithic (everything) | Immutable (identity + governance refs) |
| **Variant-specific context** | None | `docs/abap.context.md` (custom) |
| **CLAUDE.md** | Independent structure | Extends co-develop template |

**Key constraint**: Variants MUST NOT have their own CONSTITUTION.md. All governance is defined in workspace root CONSTITUTION.md and referenced by variants.

### Driving Forces

**Benefits of variant conversion**:
1. **Governance consistency**: Align with workspace root standards, leverage proven PM Gateway workflow
2. **Maintainability**: Governance updates (CONSTITUTION.md) automatically apply to all variants
3. **Clarity**: Clear separation between immutable project identity and customizable ABAP-specific content
4. **Compliance**: Meet workspace multi-agent architecture standards (CONSTITUTION.md §5)

**Risks of inaction**:
1. Governance drift: abap_vibe_coding becomes increasingly out-of-sync with workspace standards
2. Maintenance burden: Duplicate governance content in multiple projects
3. Team confusion: Different PM Gateway behaviors across projects
4. Missed improvements: No automatic benefit from workspace governance updates

**Stakeholder impact**:
- **Development team**: Standardized PM Gateway workflow, clearer agent coordination
- **Project maintainers**: Reduced governance maintenance, automatic workspace updates
- **Workspace architects**: Consistent multi-agent architecture across all projects

---

## Decision

Convert abap_vibe_coding from standalone project to **co-develop variant** that references workspace root CONSTITUTION.md.

### Conversion Strategy

**Four-phase migration in safe test environment** (`abap_vibe_coding_mig`):

#### Phase 0: Preparation (Safety Setup)
- Create migration copy at `c:\git\abap_vibe_coding_mig`
- Verify migration copy integrity
- Create validation documentation (checklist, test scenarios, rollback procedure)

#### Phase 1: Context Split (Content Transformation)
**Create new `docs/context.md` (immutable)**:
```markdown
# context.md

> **Immutable project identity** for abap_vibe_coding variant.
> Variant-specific customization: `docs/abap.context.md`.
> Workspace governance: workspace root CONSTITUTION.md.

---

## Project Overview

SAP ABAP Harness Engineering framework --PM-led, multi-agent development harness using **vsp** MCP server.

---

## Governance References

This project is a **co-develop variant**. All governance rules defined in workspace root CONSTITUTION.md:

- Folder Structure → CONSTITUTION.md §1
- Memory System → CONSTITUTION.md §2
- GitHub PR Workflow → CONSTITUTION.md §3
- Multi-Agent Architecture → CONSTITUTION.md §5
- PM Gateway Workflow → CONSTITUTION.md §5.5
- Agent Lifecycle → CONSTITUTION.md §5.6
- Coding Guidelines → CONSTITUTION.md §8
- Operations → CONSTITUTION.md §9

> **Variant extension**: See `docs/abap.context.md` for ABAP-specific customization.

---

## Architecture

Key directories:
```
abap_vibe_coding/
├── agents/          # 19 AI agent role definitions (SAP-specific)
├── skills/          # ABAP development skills
├── scripts/         # dev-sync, audit, vsp-sync
├── memory/          # session logs
├── docs/            # context.md (this), abap.context.md (ABAP-specific)
├── vsp             # vsp binary (gitignored)
└── .mcp.json        # MCP server config
```

---

## Initial Context Files (Session Start)

Read order:
1. Workspace root CONSTITUTION.md - governance rules
2. docs/context.md (this file) - immutable identity
3. docs/abap.context.md - ABAP-specific customization
4. AGENTS.md - agent roster
5. memory/MEMORY.md - recent history

---

*Last Updated: 2026-06-01 - converted to variant structure*
```

**Create new `docs/abap.context.md` (custom)**:
```markdown
# ABAP Development Context (abap.context.md)

> **Variant-specific customization for abap_vibe_coding**.
> ABAP-specific tech stack, agents, workflow.
> Workspace governance in workspace root CONSTITUTION.md.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **MCP Server** | `vsp` Go binary v2.38.1 (SAP ADT REST API) |
| **AI Orchestration** | Claude Code CLI/Desktop, Gemini CLI, Antigravity |
| **SAP Connection** | HTTP/HTTPS to SAP NetWeaver AS ABAP |
| **Scripting** | Bash (.sh) + PowerShell (.ps1) pairs |

---

## Environment Setup

```bash
# 1. Place vsp binary
cp /path/to/vsp ./vsp
chmod +x ./vsp

# 2. Configure SAP credentials
cp .env.sample .env
# Edit: SAP_URL, SAP_USER, SAP_PASSWORD

# 3. Activate git hooks
git config core.hooksPath .githooks

# 4. Verify
./vsp health
```

---

## Agent Roles (SAP-specific)

### Business Group
- PM (Orchestrator)
- SD/MM/FI/CO/PP/LE Analysts

### Technical Group
- Architect (Technical Execution Lead)
- ABAP Developer (Code Writer)
- QA Engineer (Test Runner)
- DBA, DevOps/Admin, Interface Expert
- Fiori Developer, Form Expert, GUI Scripter
- Security Monitor

> Full definitions: AGENTS.md

---

## ABAP Development Rules

### Naming
- Classes: `ZCL_` prefix
- Interfaces: `ZIF_` prefix
- Programs: `ZPROG_` prefix
- Packages: `Z*`, `$TMP`, `$ZADT*`

### SQL Reference
```sql
-- Correct ordering
ORDER BY field DESCENDING

-- Row limiting (use max_rows)
RunQuery(sql=..., max_rows=50)

-- Date format
WHERE erdat >= '20260501'  -- YYYYMMDD

-- Table aliasing
FROM vbak AS a JOIN vbap AS b ON a~vbeln = b~vbeln

-- Field references
b~matnr  -- NOT: b.matnr
```

### Development Workflow
```bash
/triage <request>      # PM triage
/post-write           # QA chain
/transport            # CTS transport
/sync "feat: desc"    # Git sync
```

---

*Last Updated: 2026-06-01 - extracted from context.md*
```

**Delete old `docs/context.md`** after verification.

#### Phase 2: CLAUDE.md Update (Variant Extension)

**Add to CLAUDE.md**:
```markdown
## Role Declaration

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.
```

**Add PM Gateway enforcement**:
```markdown
### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

See [CONSTITUTION.md §5](CONSTITUTION.md#5-multi-agent-architecture) for the 4-level enforcement model.

#### Mandatory Execution Plan Display

Before any multi-agent dispatch (2+ agents), PM **must** output an execution plan table:

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task] | [agent] | High/Medium/Low | opus/sonnet/haiku |
| N-1 | Lifecycle Update | pm (variant) | Medium | [Model] |
| N | Final QA Audit | pm (variant) | Medium | [Model] |

Always include Lifecycle Update and Final QA Audit as final two steps.
```

**Update Session Start Checklist**:
```markdown
## Session Start Checklist

0. git config core.hooksPath .githooks
1. Read CONSTITUTION.md (workspace root)
2. Read docs/context.md (this file)
3. Read docs/abap.context.md (ABAP-specific)
4. Read AGENTS.md
5. Read memory/MEMORY.md (if exists)
```

**Remove from CLAUDE.md**:
- ABAP-specific configuration details (moved to abap.context.md)
- Custom environment setup (moved to abap.context.md)

#### Phase 3: Integration Test (Validation)

**Test scenarios**:
| Scenario | Steps | Expected result |
|----------|-------|-----------------|
| Session start | Start PM agent | Loads: CONSTITUTION.md → context.md → abap.context.md → AGENTS.md |
| Multi-agent task | Request "design X" | PM displays execution plan table |
| CONSTITUTION reference | Check context.md | References workspace root, not local |
| ABAP context access | Query ABAP rules | Found in abap.context.md |
| Agent dispatch | Invoke architect | PM enforces Gateway, dispatches |

**Success criteria**:
- [ ] All variant checklist items pass
- [ ] All integration tests pass
- [ ] No regressions detected
- [ ] No content loss verified

#### Phase 4: Production Rollout (Apply to Main Project)

**Pre-rollout**:
- Create abap_vibe_coding backup
- Verify Phase 3 validation 100% success
- Document rollback procedure

**Execution**:
- Copy validated changes from abap_vibe_coding_mig to abap_vibe_coding
- Run full validation on main project
- Confirm variant behavior

### Key Constraints

1. **NO CONSTITUTION.md in variant**: abap_vibe_coding must NOT have its own CONSTITUTION.md. References workspace root only.
2. **Immutable context.md**: docs/context.md contains only project identity + CONSTITUTION references. Cannot contain ABAP-specific content.
3. **Safe migration first**: Test in abap_vibe_coding_mig, validate thoroughly, then apply to main project.
4. **Zero data loss**: All sections from original context.md must be preserved in either context.md or abap.context.md.

---

## Consequences

### Positive Impacts

**1. Governance consistency** (High value):
- abap_vibe_coding now follows workspace multi-agent architecture standards
- PM Gateway workflow enforced consistently across all projects
- Automatic benefit from workspace governance updates

**2. Maintainability improvement** (High value):
- Clear separation: immutable identity (context.md) vs custom content (abap.context.md)
- No duplicate governance content - single source of truth in workspace root
- Easier onboarding for developers familiar with workspace standards

**3. Clarity and organization** (Medium value):
- Project identity clearly defined in context.md
- ABAP-specific customization isolated in abap.context.md
- Read order standardized (CONSTITUTION → context → abap.context)

**4. Compliance with workspace standards** (High value):
- Meets CONSTITUTION.md §5 (Multi-Agent Architecture)
- Aligns with co-develop variant pattern
- Platform parity achievable (Claude Code, Gemini CLI, Antigravity)

### Negative Impacts

**1. Migration complexity** (Medium risk):
- Four-phase migration requires careful execution
- Risk of content loss during context.md split
- Need comprehensive validation before production rollout

**Mitigation**:
- Safe migration in abap_vibe_coding_mig first
- Comprehensive validation checklist and test scenarios
- Rollback procedure documented and tested

**2. Team adaptation** (Low risk):
- Developers must adjust to new context structure
- Session start checklist changes (CONSTITUTION.md first)
- Different file structure (context.md + abap.context.md)

**Mitigation**:
- Clear documentation in new files
- Session start checklist explicitly documented
- Migration ADR explains rationale

**3. CLAUDE.md changes** (Medium risk):
- PM Gateway enforcement changes workflow behavior
- Some ABAP-specific sections removed from CLAUDE.md
- Potential confusion if not properly communicated

**Mitigation**:
- ABAP-specific content preserved in abap.context.md
- CLAUDE.md changes follow co-develop template pattern
- Integration tests validate PM Gateway behavior

### Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Content loss during context.md split** | High | Low | Comprehensive section audit, verification checklist |
| **CONSTITUTION.md mistakenly added to variant** | High | Low | Explicit constraint in ADR, validation checklist |
| **PM Gateway behavior breaks existing workflows** | Medium | Low | Integration tests, rollback procedure |
| **Migration copy integrity issues** | Medium | Low | Pre-migration verification, file count check |
| **Phase 3 validation failures** | Medium | Medium | Iterative fixes in migration project, rollback if needed |

### Migration Success Criteria

**Phase 0** (Preparation):
- [ ] Migration copy verified (identical structure to original)
- [ ] Validation documentation complete (checklist, scenarios, rollback)

**Phase 1** (Context split):
- [ ] New docs/context.md created (immutable)
- [ ] New docs/abap.context.md created (custom)
- [ ] All original sections preserved (no content loss)
- [ ] CONSTITUTION.md references present

**Phase 2** (CLAUDE.md update):
- [ ] CONSTITUTION.md reference added
- [ ] PM Gateway enforcement added
- [ ] Session start checklist updated
- [ ] ABAP-specific sections removed

**Phase 3** (Integration test):
- [ ] All variant checklist items pass
- [ ] All integration test scenarios pass
- [ ] No regressions detected
- [ ] CONSTITUTION.md resolves correctly

**Phase 4** (Production rollout):
- [ ] Main project backup created
- [ ] Validated changes applied to abap_vibe_coding
- [ ] Final validation successful
- [ ] No production issues

### Alternatives Considered

**Alternative 1: Keep abap_vibe_coding as standalone project**
- **Pros**: No migration effort, no risk of breaking changes
- **Cons**: Governance drift, maintenance burden, team confusion, missed workspace improvements
- **Decision**: Rejected - long-term costs outweigh short-term effort

**Alternative 2: Create full CONSTITUTION.md for abap_vibe_coding**
- **Pros**: Complete governance independence
- **Cons**: Duplicate content, maintenance burden, violates variant principle
- **Decision**: Rejected - variants MUST NOT have own CONSTITUTION.md

**Alternative 3: Merge abap_vibe_coding into workspace root**
- **Pros**: No variant complexity
- **Cons**: Loses ABAP-specific focus, mixes concerns, workspace root bloat
- **Decision**: Rejected - ABAP domain specificity requires variant

### Implementation Timeline

| Phase | Duration | Owner | Deliverables |
|-------|----------|-------|--------------|
| **Phase 0** | 1 day | PM + automation-engineer + docs-writer | Migration copy verified, validation docs created |
| **Phase 1** | 2-3 days | Architect | New context.md + abap.context.md, old removed |
| **Phase 2** | 2-3 days | Architect | CLAUDE.md updated to extend co-develop template |
| **Phase 3** | 3-5 days | PM + Architect | Integration tests, validation complete |
| **Phase 4** | 1-2 days | Architect + PM | Main project updated, final validation |

**Total estimated duration**: 9-14 days (assuming validation passes, no major issues)

### References

- **CONSTITUTION.md** (workspace root): https://github.com/5throck/ai-workspace-standards/blob/main/CONSTITUTION.md
- **co-develop template**: `C:\git\templates\co-develop\`
- **Meeting transcripts**:
  - `memory/meeting-2026-06-01-abap-migration-strategy.md` (initial - superseded)
  - `memory/meeting-2026-06-01-abap-codify-upgrade.md` (re-convene - superseded)
  - `memory/meeting-2026-06-01-abap-structural-analysis.md` (structural analysis)
  - `memory/meeting-2026-06-01-abap-variant-migration.md` (variant strategy)

---

**Decision made by**: PM (Mark Park)
**Date**: 2026-06-01
**Status**: **Accepted** - Ready for Phase 0 execution

---

*Next action: Execute Phase 0 (Preparation) - A-02 (migration copy verification), A-03 (validation docs)*
