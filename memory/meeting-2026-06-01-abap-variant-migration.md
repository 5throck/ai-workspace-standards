# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Safe migration strategy converting abap_vibe_coding to co-develop variant (re-discussion)
**Participants**: architect, automation-engineer, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context Correction: Variant Migration Strategy

**PM Critical Clarification**:

Previous meetings misunderstood the objective. **Correct understanding**:

**Objective**: Convert existing abap_vibe_coding project into a **co-develop variant**
- ✓ Create safe migration copy at `c:\git\abap_vibe_coding_mig`
- ✓ Test variant conversion in migration project
- ✓ Apply to main project after validation
- ✓ **Variant MUST NOT have CONSTITUTION.md** - references workspace root CONSTITUTION.md only

**Previous misunderstanding**:
- ✗ Thought: Add CONSTITUTION.md to abap_vibe_coding
- ✗ Thought: Treat abap_vibe_coding as independent project
- ✓ **Correct**: abap_vibe_coding becomes a variant that references workspace root CONSTITUTION.md

**Variant characteristics** (from workspace root CONSTITUTION.md §7.5):
- Variants live in `templates/co-*/` OR are created as variant-style projects
- Variants **reference** workspace root CONSTITUTION.md
- Variants **do not have their own CONSTITUTION.md**
- Variants have `docs/context.md` (immutable) + variant-specific context (custom)

**Migration safety approach**:
1. Create `c:\git\abap_vibe_coding_mig` (completed)
2. Test variant conversion in migration project
3. Validate variant behavior
4. Apply validated changes to main `abap_vibe_coding`
5. Keep migration project as rollback reference

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

Thank you PM for the critical correction. This fundamentally changes our architecture.

**The correct migration objective**:
- **FROM**: Standalone abap_vibe_coding project with monolithic context.md
- **TO**: co-develop variant that references workspace root CONSTITUTION.md

**Variant architecture clarification**:

| Aspect | Standalone project | **Variant (target)** |
|--------|-------------------|----------------------|
| **CONSTITUTION.md** | Has own (or none) | **References workspace root** |
| **docs/context.md** | Monolithic (everything) | **Immutable (project identity only)** |
| **Variant-specific context** | None | **Custom (domain-specific content)** |
| **CLAUDE.md** | Independent | **Extended from template** |

**Key constraint**: **abap_vibe_coding_mig MUST NOT have CONSTITUTION.md**. It must reference workspace root's CONSTITUTION.md via CLAUDE.md.

**Migration architecture (corrected)**:

| Phase | Action | Target | Constraint |
|-------|--------|--------|------------|
| **Phase 0** | Verify migration copy | `abap_vibe_coding_mig/` | Must be identical copy |
| **Phase 1** | Split context.md | `docs/context.md` (immutable) + `docs/abap.context.md` (custom) | Reference workspace root CONSTITUTION.md |
| **Phase 2** | Update CLAUDE.md | Add variant structure | **NO CONSTITUTION.md creation** |
| **Phase 3** | Validate variant behavior | Test PM Gateway, workflow | Must work as variant |
| **Phase 4** | Apply to main project | Copy validated changes to `abap_vibe_coding` | After validation success |

**automation-engineer**, does abap_vibe_coding_mig have any dependencies that assume it's a standalone project (not a variant)?

---

**[Automation-engineer]**: (Round 1)

**architect**'s variant architecture is correct. Let me analyze standalone vs variant dependencies.

**Standalone project assumptions in abap_vibe_coding**:

| Component | Current behavior | Variant-compatible? | Action |
|-----------|-----------------|:--------------------:|--------|
| **MCP server config** | `.mcp.json` references `./vsp` | ✓ Yes | No change needed |
| **Scripts** | References project root paths | ✓ Yes | No change needed |
| **Agents** | Independent agent definitions | ⚠️ Maybe | Check for workspace root dependencies |
| **context.md** | Self-contained governance | ⚠️ No | **Must reference workspace root** |
| **CLAUDE.md** | Independent configuration | ⚠️ No | **Must extend from template** |

**Critical finding**: abap_vibe_coding's `docs/context.md` currently contains governance content that should **reference workspace root CONSTITUTION.md**, not define it independently.

**Dependency check results**:

```bash
# Verify migration copy integrity
ls -la abap_vibe_coding_mig/
# Expected: Same file structure as abap_vibe_coding

# Check for hardcoded absolute paths
grep -r "C:\\\\git" abap_vibe_coding_mig/docs/
# Expected: None (all paths relative)

# Check for CONSTITUTION.md references
grep -r "CONSTITUTION.md" abap_vibe_coding_mig/
# Expected: Currently none - needs to be added in CLAUDE.md
```

**Variant compatibility assessment**:

| Component | Compatible | Migration needed |
|-----------|:----------:|------------------|
| MCP servers | ✓ Yes | None |
| Scripts | ✓ Yes | None |
| Agents | ✓ Yes | None (SAP agents are domain-specific) |
| context.md structure | ✗ No | **Split + reference CONSTITUTION.md** |
| CLAUDE.md structure | ✗ No | **Extend from co-develop template** |

**docs-writer**, how should we handle the governance content currently in `docs/context.md`? Should we delete it and replace with CONSTITUTION.md references?

---

**[Docs-writer]**: (Round 1)

**automation-engineer**'s assessment is accurate. Let me propose the content transformation strategy.

**Current `docs/context.md` content analysis** (from abap_vibe_coding_mig):

| Section | Current content | Variant approach | Action |
|---------|----------------|-------------------|--------|
| **Project Overview** | SAP ABAP Harness description | Keep (project identity) | **Preserve in context.md** |
| **Tech Stack** | vsp MCP server, SAP ADT | Domain-specific | **Move to abap.context.md** |
| **Coding Guidelines** | Duplicated rules | Reference CONSTITUTION.md §8 | **Replace with reference** |
| **Git / PR Workflow** | Duplicated rules | Reference CONSTITUTION.md §3 | **Replace with reference** |
| **Agent Roles** | SAP agents description | Domain-specific | **Move to abap.context.md** |
| **ABAP Development Rules** | ABAP SQL, naming | Domain-specific | **Move to abap.context.md** |

**Transformation strategy**:

**New `docs/context.md` (variant-style, immutable)**:
```markdown
# context.md

> **Shared reference for all AI tools**: This file is the **immutable project identity** for the abap_vibe_coding variant.
> Variant-specific customization lives in `docs/abap.context.md`.
> Workspace governance rules live in workspace root CONSTITUTION.md.

---

## Project Overview

SAP ABAP Harness Engineering framework --a PM-led, multi-agent development harness for SAP ABAP projects using the **vsp** MCP server.

---

## Governance References

This project is a **co-develop variant**. All governance rules are defined in the workspace root CONSTITUTION.md:

- **Folder Structure**: CONSTITUTION.md §1
- **Memory System**: CONSTITUTION.md §2
- **GitHub PR Workflow**: CONSTITUTION.md §3
- **Multi-Agent Architecture**: CONSTITUTION.md §5
- **PM Gateway Workflow**: CONSTITUTION.md §5.5
- **Agent Lifecycle**: CONSTITUTION.md §5.6
- **Skill Lifecycle**: CONSTITUTION.md §6
- **Script Lifecycle**: CONSTITUTION.md §6.5
- **Coding Guidelines**: CONSTITUTION.md §8
- **Operations Workflow**: CONSTITUTION.md §9

> **Variant extension**: See `docs/abap.context.md` for ABAP-specific customization.

---

## Architecture

(Keep high-level architecture - ABAP-specific details moved to abap.context.md)

Key directories:
```
abap_vibe_coding/
├── agents/          # 19 AI agent role definitions (SAP-specific)
├── skills/          # ABAP development skills
├── scripts/         # dev-sync, audit, vsp-sync automation
├── memory/          # session logs (YYYY-MM-DD.md)
├── docs/            # context.md (this file), abap.context.md (ABAP-specific)
├── vsp             # vsp binary (gitignored)
└── .mcp.json        # MCP server config (gitignored)
```

---

## Initial Context Files (Session Start)

> Read order for abap_vibe_coding variant:
> 1. **Workspace root CONSTITUTION.md** - governance rules (read once, reference as needed)
> 2. **docs/context.md** (this file) - immutable project identity
> 3. **docs/abap.context.md** - ABAP-specific customization
> 4. **AGENTS.md** - agent roster
> 5. **memory/MEMORY.md** - recent history (if exists)

---

*Last Updated: 2026-06-01 - converted to variant structure*
```

**New `docs/abap.context.md` (variant-specific, custom)**:
```markdown
# ABAP Development Context (abap.context.md)

> **Variant-specific customization for abap_vibe_coding**.
> This file contains ABAP-specific tech stack, agents, and workflow.
> Workspace governance is in workspace root CONSTITUTION.md.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **MCP Server** | `vsp` Go binary v2.38.1 --connects to SAP via ADT (ABAP Development Tools REST API) |
| **AI Orchestration** | Claude Code CLI / Desktop App, Gemini CLI, Antigravity (VS Code extension) |
| **SAP Connection** | HTTP/HTTPS to SAP NetWeaver AS ABAP; configured via `.env` (`SAP_*` prefix) |
| **Scripting** | Bash (`.sh`) + PowerShell (`.ps1`) pairs for all automation |

---

## Environment Setup

```bash
# 1. Place the vsp binary in the project root
cp /path/to/vsp ./vsp
chmod +x ./vsp          # macOS/Linux

# 2. Configure SAP credentials
cp .env.sample .env
# Edit .env --fill in SAP_URL, SAP_USER, SAP_PASSWORD

# 3. Activate git hooks
git config core.hooksPath .githooks

# 4. Verify connection
./vsp health
```

---

## Agent Roles (SAP-specific)

### Business Group
- PM (Orchestrator)
- SD Analyst (Sales & Distribution)
- MM Analyst (Materials Management)
- FI Analyst (Financial Accounting)
- CO Analyst (Controlling)
- PP Analyst (Production Planning)
- LE Analyst (Logistics Execution)

### Technical Group
- Architect (Technical Execution Lead)
- ABAP Developer (Code Writer)
- QA Engineer (Test Runner)
- DBA (Database Agent)
- DevOps / Admin
- Interface Expert
- Fiori Developer
- Form Expert
- GUI Scripter
- Security Monitor

> Full definitions in AGENTS.md

---

## ABAP Development Rules

### Naming Conventions
- **Classes**: `ZCL_` prefix
- **Interfaces**: `ZIF_` prefix
- **Programs**: `ZPROG_` prefix
- **Packages**: `Z*`, `$TMP`, `$ZADT*`

### SQL Reference
```sql
-- Correct ordering
ORDER BY field DESCENDING        -- NOT: ORDER BY field DESC

-- Row limiting (use max_rows parameter)
RunQuery(sql=..., max_rows=50)   -- NOT: LIMIT 50 in SQL

-- Date format
WHERE erdat >= '20260501'        -- YYYYMMDD string

-- Table aliasing in JOINs
FROM vbak AS a JOIN vbap AS b ON a~vbeln = b~vbeln

-- Field references with tilde
b~matnr    -- NOT: b.matnr
```

### Development Workflow
```bash
# 1. Start a task
/triage <request>          # PM classifies --creates task file --parallel research

# 2. After implementation
/post-write                # SyntaxCheck --RunUnitTests --RunATCCheck
/transport                 # Create/release CTS transport

# 3. Sync to Git
/sync "feat: description"  # memlog --changelog --audit --commit --PR
```

---

*Last Updated: 2026-06-01 - extracted from context.md*
```

**architect**, does this transformation maintain the invariant that `docs/context.md` is immutable and references workspace root CONSTITUTION.md?

---

### Round 2

**[Architect]**: (Round 2)

**docs-writer**'s transformation strategy is excellent. It correctly implements the variant pattern.

**Invariant validation**: Does `docs/context.md` maintain immutability?

**YES** - the new `docs/context.md` structure:
- ✓ Contains only immutable project identity (Overview, Architecture)
- ✓ References workspace root CONSTITUTION.md for governance
- ✓ Delegates all ABAP-specific content to `docs/abap.context.md`
- ✓ Cannot become outdated - governance lives in workspace root

**Variant architecture validation**:

| Check | Variant requirement | Proposed solution | Status |
|-------|-------------------|-------------------|:------:|
| **No CONSTITUTION.md** | Must not have own CONSTITUTION.md | References workspace root | ✓ Pass |
| **Immutable context.md** | Project identity only | Overview + Architecture only | ✓ Pass |
| **Custom layer exists** | Domain-specific content | `docs/abap.context.md` | ✓ Pass |
| **CLAUDE.md extension** | Extends from co-develop template | Next step (Phase 2) | ⚠️ Pending |

**Updated migration architecture** (variant-correct):

| Phase | Action | File changes | Validation |
|-------|--------|--------------|------------|
| **Phase 0** | Verify migration copy | None | File integrity check |
| **Phase 1a** | Create new `docs/context.md` | Replace existing | Reference CONSTITUTION.md check |
| **Phase 1b** | Create `docs/abap.context.md` | New file | ABAP content integrity |
| **Phase 2** | Update CLAUDE.md | Extend from co-develop template | PM Gateway enforcement |
| **Phase 3** | Test variant behavior | Integration test | Full workflow test |
| **Phase 4** | Apply to main project | Copy validated changes | Production rollout |

**Key difference from previous plan**:
- **NO CONSTITUTION.md creation** - reference workspace root only
- **context.md split** - immutable (identity) vs custom (ABAP-specific)
- **abap.context.md** - new file name for variant-specific content

**automation-engineer**, Phase 2 involves updating CLAUDE.md to extend from co-develop template. What are the CLAUDE.md differences between standalone and variant?

---

**[Automation-engineer]**: (Round 2)

**architect**'s updated migration architecture is correct. Let me analyze CLAUDE.md differences.

**CLAUDE.md comparison**: Standalone vs Variant

| Section | abap_vibe_coding (standalone) | co-develop template (variant) | Delta |
|---------|------------------------------|-------------------------------|-------|
| **CONSTITUTION reference** | None | **"Read CONSTITUTION.md first"** | **Add** (critical) |
| **Role Declaration** | "You ARE the PM agent" | **Same** | Keep |
| **PM Gateway enforcement** | Not explicit | **Explicit §5** | **Add** (mandatory) |
| **Session Start Checklist** | Custom list | **Standardized list** | **Align** with variant |
| **Agent Dispatch Rules** | Referenced in AGENTS.md only | **Explicit in CLAUDE.md** | **Add** |
| **Lifecycle Management** | None | **§10** | **Add** (optional) |
| **ABAP-specific sections** | Custom content | **None** (moved to abap.context.md) | **Remove** from CLAUDE.md |

**Critical CLAUDE.md changes for variant**:

**Add (mandatory)**:
```markdown
## Role Declaration

> **Shared workspace setup, session start checklist, project structure, and design standards live in [`CONSTITUTION.md`](CONSTITUTION.md) - read it first and the files listed in its `## Required Reading` block.
```

**Add (mandatory)**:
```markdown
### 5. Agent Dispatch Rules

**MANDATORY PM GATEWAY**: All specialist agent dispatch MUST go through PM.

See [CONSTITUTION.md §5](docs/constitution/05-multi-agent-architecture.md) for the 4-level enforcement model and governance rules.
```

**Update (align with variant)**:
```markdown
## Session Start Checklist

0. **Forced Hook Activation**: `git config core.hooksPath .githooks`
1. **Workspace Standard**: Read CONSTITUTION.md (workspace root)
2. **Project Context**: Read docs/context.md (this file)
3. **Variant Context**: Read docs/abap.context.md
4. **Agent Roster**: Read AGENTS.md
5. **Session History**: Read memory/MEMORY.md (if exists)
```

**Remove (cleanup)**:
- ABAP-specific configuration details (moved to abap.context.md)
- Custom environment setup instructions (moved to abap.context.md)

**docs-writer**, after CLAUDE.md is updated, how do we verify that abap_vibe_coding_mig works correctly as a variant?

---

**[Docs-writer]**: (Round 2)

**automation-engineer**'s CLAUDE.md analysis is comprehensive. Let me propose the variant validation plan.

**Variant validation strategy**:

**Phase 3: Integration Test Plan**

```
docs/
└── validation/
    ├── variant-checklist.md      # Pre- and post-migration checks
    ├── test-scenarios.md         # PM Gateway, workflow tests
    └── rollback-procedure.md     # If validation fails
```

**Variant checklist** (`docs/validation/variant-checklist.md`):

```markdown
# Variant Validation Checklist

## Pre-migration (abap_vibe_coding_mig initial state)
- [ ] Migration copy integrity verified (same file count/structure as original)
- [ ] No CONSTITUTION.md exists (correct - variant references workspace root)
- [ ] Original context.md backed up
- [ ] Git commit created (baseline)

## Phase 1 validation (context.md split)
- [ ] New docs/context.md created (immutable)
- [ ] New docs/abap.context.md created (custom)
- [ ] Old context.md removed
- [ ] CONSTITUTION.md references present in context.md
- [ ] ABAP-specific content moved to abap.context.md
- [ ] No content loss (sections audited)

## Phase 2 validation (CLAUDE.md update)
- [ ] CONSTITUTION.md reference added to Role Declaration
- [ ] PM Gateway enforcement §5 added
- [ ] Session Start Checklist updated
- [ ] ABAP-specific sections removed from CLAUDE.md
- [ ] CLAUDE.md extends co-develop template structure

## Phase 3 validation (integration test)
- [ ] CONSTITUTION.md resolves correctly (references workspace root)
- [ ] Session start checklist loads all files in correct order
- [ ] PM Gateway enforcement works (test multi-agent task)
- [ ] Agent dispatch follows variant pattern
- [ ] ABAP-specific content accessible in abap.context.md
- [ ] No broken file references

## Phase 4 readiness (apply to main project)
- [ ] All validation checks pass
- [ ] Integration test successful
- [ ] No regressions detected
- [ ] Main project backup confirmed
- [ ] Rollback procedure tested (if needed)
```

**Test scenarios** (`docs/validation/test-scenarios.md`):

| Scenario | Steps | Expected result |
|----------|-------|-----------------|
| **Session start** | Start PM agent | Loads: CONSTITUTION.md → context.md → abap.context.md → AGENTS.md |
| **Multi-agent task** | Request "design X" | PM displays execution plan table before dispatching |
| **CONSTITUTION reference** | Check context.md | References workspace root CONSTITUTION.md, not local |
| **ABAP context access** | Query ABAP development rules | Found in abap.context.md, not in context.md |
| **Agent dispatch** | Invoke architect | PM enforces Gateway, displays plan, then dispatches |

**architect**, with validation plan complete, are you ready to synthesize the final migration strategy?

---

**[Architect]**: (Synthesis)

**[Synthesis]**

Colleagues, our variant migration strategy is complete. Let me synthesize.

## Points of Agreement

1. **Variant architecture confirmed**: abap_vibe_coding_mig will be a **co-develop variant** that references workspace root CONSTITUTION.md (not having its own)
2. **Safe migration approach**: Test in `abap_vibe_coding_mig`, validate thoroughly, then apply to main project
3. **Three-phase transformation**: Phase 1 (context.md split) → Phase 2 (CLAUDE.md update) → Phase 3 (validation) → Phase 4 (apply to main)
4. **Immutable context.md**: `docs/context.md` contains only project identity + CONSTITUTION.md references
5. **Custom abap.context.md**: All ABAP-specific content lives in `docs/abap.context.md`

## Open Disagreements or Unresolved Questions

1. **Phase 4 trigger criteria**:
   - What validation threshold must be met before applying to main project?
   - Who approves Phase 4 execution - PM, architect, or user?

2. **Rollback decision point**:
   - If Phase 3 validation fails, do we rollback abap_vibe_coding_mig or iterate fixes?
   - How many test failures are acceptable?

3. **Main project backup strategy**:
   - Should we create a git branch or a full directory copy of main abap_vibe_coding?
   - When is backup created - before Phase 1 or before Phase 4?

## Concrete Next Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | **Migration ADR**: Document variant conversion strategy | Phase 0 |
| A-02 | automation-engineer | Low | **Migration copy verification**: Verify abap_vibe_coding_mig integrity | Phase 0 |
| A-03 | docs-writer | Medium | **Validation docs**: Create variant-checklist.md, test-scenarios.md, rollback-procedure.md | Phase 0 |
| A-04 | architect | High | **Phase 1a execution**: Create new docs/context.md (immutable) | Phase 1 |
| A-05 | architect | High | **Phase 1b execution**: Create docs/abap.context.md (custom) + move ABAP content | Phase 1 |
| A-06 | architect | High | **Phase 1c execution**: Remove old context.md | Phase 1 |
| A-07 | architect | High | **Phase 2 execution**: Update CLAUDE.md to extend co-develop template | Phase 2 |
| A-08 | pm | High | **Phase 3 validation**: Run all variant checklist items + test scenarios | Phase 3 |
| A-09 | automation-engineer | Low | **Main project backup**: Create abap_vibe_coding backup before Phase 4 | Phase 4 |
| A-10 | architect | High | **Phase 4 execution**: Apply validated changes to main abap_vibe_coding | Phase 4 |
| A-11 | pm | High | **Final validation**: Test main project variant behavior | Phase 4 |

**Acceptance Criteria**:
- [AC-01] Migration ADR approved
- [AC-02] Migration copy verified (identical structure)
- [AC-03] Validation documentation complete
- [AC-04] Phase 1: context.md split complete, no content loss
- [AC-05] Phase 2: CLAUDE.md extends co-develop template correctly
- [AC-06] Phase 3: All variant checks pass, integration test successful
- [AC-07] Phase 4: Main project variant behavior validated, no regressions

---

**Meeting Summary by Architect**

This meeting established the **correct variant migration strategy**:

**Key insight**: abap_vibe_coding must become a **co-develop variant** that references workspace root CONSTITUTION.md, not a standalone project with its own CONSTITUTION.md.

**Critical constraint**: **abap_vibe_coding_mig MUST NOT have CONSTITUTION.md**. All governance lives in workspace root.

**Architecture transformation**:
- **Old**: Standalone project with monolithic context.md (contains everything)
- **New**: Variant with immutable context.md (identity + CONSTITUTION references) + abap.context.md (ABAP-specific)

**Safe migration path**: Test in abap_vibe_coding_mig → validate thoroughly → apply to main project after all checks pass.

**Next step**: PM approves A-01 (Migration ADR) to begin Phase 0.

---

*Transcript archived by PM following meeting-facilitation skill protocol*
