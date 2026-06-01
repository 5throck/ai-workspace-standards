# Meeting Transcript
**Date**: 2026-06-01
**Topic**: abap_vibe_coding migration strategy formulation through structural difference analysis
**Participants**: architect, automation-engineer, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context: Structural Analysis Results

**PM Analysis Summary**:

Before this meeting, I analyzed three structures:

1. **Workspace Root (C:\git)**:
   - ✓ `CONSTITUTION.md` exists - centralized governance document
   - ✓ `docs/constitution/` with detailed subsections
   - All rules, standards, workflows defined in CONSTITUTION.md

2. **co-develop Template (templates/co-develop/)**:
   - ✓ References CONSTITUTION.md (workspace root)
   - ✓ `CLAUDE.md` exists - PM Gateway, Agent Dispatch Rules included
   - ✓ `docs/co-develop.context.md` - project-specific customization layer
   - ✓ Standardized `agents/`, `skills/`, `scripts/` structure

3. **abap_vibe_coding (current project)**:
   - ✗ No `CONSTITUTION.md`
   - ✓ `CLAUDE.md` exists but different structure
   - ✓ `docs/context.md` - everything embedded in context.md (monolithic)
   - ✓ `AGENTS.md` exists
   - Independent structure

**Key Structural Difference**:

| Aspect | co-develop template | abap_vibe_coding |
|--------|-------------------|------------------|
| **Governance** | CONSTITUTION.md (workspace root) | Embedded in docs/context.md |
| **Context** | docs/co-develop.context.md (customization layer) | docs/context.md (everything) |
| **CLAUDE.md** | PM Gateway enforcement, Agent Dispatch Rules | Tool-specific config only |
| **Separation** | Immutable context.md + customization layer | Monolithic context.md |

**Read order for co-develop**:
1. `docs/context.md` (immutable project identity)
2. `docs/co-develop.context.md` (customization layer - tech stack, agents, skills, workflow)

**abap_vibe_coding current state**:
- Single `docs/context.md` contains everything (architecture + tech stack + ABAP rules + workflow)
- No separation between immutable and customizable
- No CONSTITUTION.md reference

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

Thank you PM for the structural analysis. This clarifies the migration challenge fundamentally.

**The core problem**: abap_vibe_coding uses a **monolithic context.md** pattern, while co-develop template uses a **layered context system** (immutable context.md + customization layer).

**Structural mapping**:

| co-develop template | abap_vibe_coding | Action |
|---------------------|------------------|--------|
| `docs/context.md` (immutable) | Not exists | **Create** - pull from workspace root |
| `docs/co-develop.context.md` (custom) | `docs/context.md` (monolithic) | **Split** - extract custom content |
| `CONSTITUTION.md` (referenced) | Not exists | **Reference** - add to CLAUDE.md |

**Migration strategy hypothesis**:
1. **Introduce CONSTITUTION.md governance**: Make abap_vibe_coding reference workspace root CONSTITUTION.md
2. **Split monolithic context.md**: Separate immutable (identity) from customizable (ABAP-specific)
3. **Update CLAUDE.md**: Add PM Gateway enforcement from co-develop template

**automation-engineer**, does this structural change affect scripts? Are there script dependencies on current `docs/context.md` structure?

---

**[Automation-engineer]**: (Round 1)

**architect**'s structural mapping is accurate. Let me add script dependency analysis.

**Script dependency on context.md**:

| Script | Current dependency | Impact of context.md split |
|--------|-------------------|----------------------------|
| `vsp-sync.*` | Reads context indirectly via CLAUDE.md | **Low** - no direct context.md reads |
| `audit.sh/.ps1` | No context.md dependency | **None** - validates docs only |
| `dev-sync.sh/.ps1` | No context.md dependency | **None** - wrapper for /sync |
| `dispatch.ts` (if exists) | No context.md dependency | **None** - agent orchestration |

**Good news**: abap_vibe_coding scripts **do not directly read** `docs/context.md`. They reference it indirectly via CLAUDE.md session start checklist.

**Migration impact assessment**:

| Change | Script impact | Risk level |
|--------|--------------|------------|
| Introduce CONSTITUTION.md | None - just reference in CLAUDE.md | Low |
| Split context.md | Medium - CLAUDE.md session checklist changes | Medium |
| Update CLAUDE.md structure | High - PM Gateway enforcement changes | High |

**Recommended phased approach**:
1. **Phase 1 (Low risk)**: Add CONSTITUTION.md reference to CLAUDE.md
2. **Phase 2 (Medium risk)**: Split `docs/context.md` → `docs/context.md` (immutable) + `docs/abap-specific.context.md` (custom)
3. **Phase 3 (High risk)**: Merge co-develop CLAUDE.md PM Gateway sections into abap_vibe_coding CLAUDE.md

**docs-writer**, Phase 2 involves splitting the current monolithic context.md. Which sections should stay in `docs/context.md` (immutable) vs move to `docs/abap-specific.context.md` (custom)?

---

**[Docs-writer]**: (Round 1)

Excellent analysis by **automation-engineer**. Let me propose the context.md split strategy.

**Content classification for split**:

**Section destination analysis** (based on abap_vibe_coding/docs/context.md content):

| Section | Current location | Target location | Rationale |
|---------|-----------------|-----------------|-----------|
| **Project Overview** | context.md | **context.md (immutable)** | Project identity - doesn't change |
| **Architecture** | context.md | **context.md (immutable)** | Core structure - stable |
| **Tech Stack** | context.md | **abap-specific.context.md (custom)** | ABAP-specific - custom layer |
| **Environment Setup** | context.md | **abap-specific.context.md (custom)** | SAP credentials - project-specific |
| **ABAP Development Rules** | context.md | **abap-specific.context.md (custom)** | Domain-specific - not universal |
| **Agent Roles** | context.md | **abap-specific.context.md (custom)** | SAP agents - not standard |
| **Coding Guidelines** | context.md | **context.md (immutable)** | Reference CONSTITUTION.md §8 |
| **Git / PR Workflow** | context.md | **context.md (immutable)** | Reference CONSTITUTION.md §3 |

**Proposed file structure after split**:

```
docs/
├── context.md                    # Immutable - references workspace root
│   ├── Project Overview
│   ├── Architecture
│   ├── Coding Guidelines (ref CONSTITUTION.md §8)
│   └── Git / PR Workflow (ref CONSTITUTION.md §3)
│
└── abap-specific.context.md      # Custom - ABAP development layer
    ├── Tech Stack (vsp MCP server, SAP connection)
    ├── Environment Setup (SAP credentials)
    ├── ABAP Development Rules (ABAP SQL, naming)
    ├── Agent Roles (Business/Technical groups)
    └── Development Workflow (/triage, /post-write)
```

**Read order documentation** (to be added to CLAUDE.md):

```markdown
## Session Start Checklist

Read order for abap_vibe_coding:
1. CONSTITUTION.md - workspace governance (read from workspace root)
2. docs/context.md - immutable project identity
3. docs/abap-specific.context.md - ABAP-specific customization
4. AGENTS.md - agent roster
5. memory/MEMORY.md - recent history (if exists)
```

**architect**, does this split maintain the invariant that `docs/context.md` contains only immutable content? Can we guarantee that ABAP-specific sections won't need to "leak" back into context.md?

---

### Round 2

**[Architect]**: (Round 2)

**docs-writer**'s split strategy is sound. Let me validate the invariant.

**Invariant validation**: Can `docs/context.md` stay immutable?

**Potential conflict points**:

| Section | Current dependency | Conflict risk | Mitigation |
|---------|-------------------|---------------|------------|
| **Architecture** | References ABAP agents in context.md | Low - abstract architecture only | Keep architecture layer abstract |
| **Agent Roles** | Described in context.md | Medium - ABAP agents listed | **Move to abap-specific.context.md** ✓ |
| **Development Workflow** | /triage command references ABAP workflow | Low - workflow is ABAP-specific | **Move to abap-specific.context.md** ✓ |
| **Coding Guidelines** | References CONSTITUTION.md §8 | None - already intentional duplicate | Keep with reference annotation ✓ |

**Conclusion**: **YES**, the invariant can be maintained. All ABAP-specific content can move to `abap-specific.context.md` without breaking `docs/context.md` immutability.

**Updated migration architecture**:

| Phase | Change | File impact | Risk |
|-------|--------|-------------|------|
| **Phase 1** | Add CONSTITUTION.md reference | CLAUDE.md (add §0) | Low |
| **Phase 2a** | Create `docs/context.md` (immutable) | New file + CLAUDE.md session checklist update | Medium |
| **Phase 2b** | Create `docs/abap-specific.context.md` (custom) | New file + move content from old context.md | Medium |
| **Phase 2c** | Delete old `docs/context.md` | Delete file | Low (after 2a, 2b verified) |
| **Phase 3** | Merge PM Gateway from co-develop CLAUDE.md | CLAUDE.md (add §5) | High |

**automation-engineer**, Phase 3 is high-risk because it changes PM enforcement behavior. Can we validate PM Gateway changes incrementally? Should we create a test project first?

---

**[Automation-engineer]**: (Round 2)

**architect**'s risk assessment is correct. Phase 3 (PM Gateway merge) requires careful validation.

**PM Gateway change analysis**:

Current abap_vibe_coding CLAUDE.md vs co-develop template CLAUDE.md:

| Section | abap_vibe_coding | co-develop template | Delta |
|---------|------------------|---------------------|-------|
| **PM Gateway enforcement** | Not explicit | **Explicit** (§5) | **Add** - high impact |
| **Execution plan display** | Not specified | **Mandatory** table format | **Add** - high impact |
| **Specialist agent list** | Not listed | **Explicit** (architect, automation-engineer, etc.) | **Add** - medium impact |
| **Permission denial protocol** | Not specified | **Explicit** (Type A/B/C/D) | **Add** - medium impact |

**Risk mitigation strategy**:

1. **Parallel test project** (Recommended):
   - Create test project using `/new-project test-abap-migration` with co-develop variant
   - Verify PM Gateway behavior in test project
   - Apply same changes to abap_vibe_coding after validation

2. **Incremental rollout** (Alternative):
   - Add PM Gateway sections to CLAUDE.md but **commented out**
   - Test with a small multi-agent task
   - Uncomment after verification

3. **Rollback plan**:
   - Git commit before Phase 3 changes
   - Document rollback procedure in migration plan
   - Test rollback in test project first

**docs-writer**, if we create a test project, what documentation should it have to validate PM Gateway behavior?

---

**[Docs-writer]**: (Round 2)

**automation-engineer**'s risk mitigation is prudent. Let me propose test project documentation.

**Test project validation plan**:

**Test project setup**:
```bash
/new-project test-abap-pm-gateway
# Select variant: co-develop
# Select platform: both
```

**Test project documentation**:

```
test-abap-pm-gateway/
├── docs/
│   ├── test-plan.md              # PM Gateway test scenarios
│   ├── validation-checklist.md   # Pre/post migration validation
│   └── rollback-procedure.md     # Rollback steps if test fails
└── memory/
    └── test-results-YYYY-MM-DD.md # Test execution results
```

**Test scenarios** (for `docs/test-plan.md`):

| Scenario | Test | Expected behavior |
|----------|------|-------------------|
| **Single-step task** | PM executes directly | No execution plan displayed |
| **Multi-agent task** | PM dispatches architect + automation-engineer | Execution plan table displayed before Agent tool calls |
| **Direct specialist invoke** | User tries to invoke architect directly | PM refuses, redirects through PM |
| **Permission denial** | Architect's Write tool denied | PM outputs Escalation Template, halts task |

**Validation checklist** (for `docs/validation-checklist.md`):

```markdown
## Pre-migration validation
- [ ] Current abap_vibe_coding baseline documented
- [ ] Git commit created (rollback point)
- [ ] Test project created successfully
- [ ] Test scenarios documented

## Post-migration validation
- [ ] PM Gateway sections added to CLAUDE.md
- [ ] Execution plan table displays correctly
- [ ] Specialist agent list enforced
- [ ] Permission denial protocol functional
- [ ] All test scenarios pass
- [ ] Rollback procedure tested (if needed)
```

**architect**, with test project validation plan in place, are you ready to define the complete migration architecture with all three phases?

---

**[Architect]**: (Synthesis)

**[Synthesis]**

Colleagues, our structural analysis and risk mitigation planning is complete. Let me synthesize the complete migration architecture.

## Points of Agreement

1. **Structural difference confirmed**: abap_vibe_coding uses monolithic context.md; co-develop uses layered system (immutable + custom)
2. **Three-phase migration approach**: Phase 1 (CONSTITUTION.md reference) → Phase 2 (context.md split) → Phase 3 (PM Gateway merge)
3. **Risk mitigation required**: Phase 3 (PM Gateway) is high-risk; test project validation required before rollout
4. **Content split strategy defined**: Immutable content in `docs/context.md`, ABAP-specific in `docs/abap-specific.context.md`

## Open Disagreements or Unresolved Questions

1. **Test project creation authority**:
   - Who creates test project? PM or architect?
   - When? Before Phase 1 starts, or after Phase 2 completes?

2. **Phase sequencing**:
   - Should we run all phases sequentially (1 → 2 → 3)?
   - Or can we validate Phase 1, then pause before Phase 2?

3. **Rollback trigger criteria**:
   - What test failure triggers rollback?
   - Who decides to rollback - PM, architect, or user?

## Concrete Next Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | **Migration ADR Creation**: Document migration architecture with 3-phase plan | Phase 0 (Planning) |
| A-02 | architect | High | **Test Project Setup**: Create `test-abap-pm-gateway` using `/new-project` | Phase 0 (Validation setup) |
| A-03 | docs-writer | Medium | **Test Documentation**: Create `test-plan.md`, `validation-checklist.md`, `rollback-procedure.md` in test project | Phase 0 (Validation setup) |
| A-04 | automation-engineer | Low | **Current State Baseline**: Document current abap_vibe_coding CLAUDE.md structure before changes | Phase 0 (Baseline) |
| A-05 | architect | High | **Phase 1 Execution**: Add CONSTITUTION.md reference to abap_vibe_coding CLAUDE.md | Phase 1 |
| A-06 | architect | High | **Phase 2a Execution**: Create `docs/context.md` (immutable) | Phase 2 |
| A-07 | architect | High | **Phase 2b Execution**: Create `docs/abap-specific.context.md` (custom) + move content | Phase 2 |
| A-08 | architect | High | **Phase 2c Execution**: Delete old `docs/context.md` after verification | Phase 2 |
| A-09 | pm | High | **Test Project Validation**: Run all PM Gateway test scenarios in test project | Phase 3 (Pre-validation) |
| A-10 | architect | High | **Phase 3 Execution**: Merge PM Gateway sections from co-develop CLAUDE.md to abap_vibe_coding CLAUDE.md | Phase 3 |
| A-11 | pm | High | **Final Validation**: Run full workflow test in migrated abap_vibe_coding | Phase 3 (Post-validation) |

**Acceptance Criteria**:
- [AC-01] Migration ADR approved by user
- [AC-02] Test project created with all documentation
- [AC-03] Baseline CLAUDE.md documented
- [AC-04] Phase 1: CONSTITUTION.md reference added
- [AC-05] Phase 2: context.md split completed and verified
- [AC-06] Phase 3: PM Gateway test scenarios all pass
- [AC-07] Final validation: Full workflow test passes in migrated project

---

**Meeting Summary by Architect**

This meeting established the complete migration architecture based on structural analysis. The key insight: abap_vibe_coding's **monolithic context.md** must be split into **immutable + custom layers** to align with co-develop template pattern.

**Critical path**: A-01 (ADR) → A-02~A-04 (Test setup) → A-05~A-08 (Phase 1-2) → A-09 (Test validation) → A-10~A-11 (Phase 3).

**Risk checkpoint**: A-09 (Test project validation) must complete successfully before A-10 (Phase 3 execution). If tests fail, rollback via documented procedure.

**Next step**: PM approves A-01 (Migration ADR) to authorize the migration plan.

---

*Transcript archived by PM following meeting-facilitation skill protocol*
