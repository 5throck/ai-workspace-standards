# Multi-Agent Phase Definitions

> **Purpose**: Define the 6-phase workflow that all variants use, with specific PM facilitation guidance for each phase.
>
> **Scope**: This is the shared phase definition across all variants (co-develop, co-design, co-work, co-security).
> Each variant may extend or specialize these phases based on their specific workflow needs.

---

## Phase Overview

| Phase | Name | Key Agents | PM Facilitation Mode | Exit Criteria |
|-------|------|------------|----------------------|----------------|
| 0 | Project Initiation | scaffolding-expert | Orchestrator | Project scaffolded, template validated |
| 1-2 | Planning & Architecture | architect | Orchestrator | Implementation plan approved, ADRs filed |
| 3 | Design Handoff | (varies by variant) | Orchestrator | Design specs ready, team aligned |
| 4 | Execution | automation-engineer, docs-writer | Orchestrator | Features implemented, docs updated |
| 5 | Quality Assurance | security-expert, auditor | Orchestrator | QA passed, security cleared |
| 6 | Lifecycle Finalization | lifecycle-manager | Orchestrator | Governance documents updated, lifecycle transition complete |

---

## Phase 0: Project Initiation

**Purpose**: Scaffold new projects or validate template structure.

**Specialist Agent**: scaffolding-expert

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the initiation objective: "We are creating/validating a project structure"
   - Nominate scaffolding-expert to execute scaffolding tasks
   - Set expectations: "Validate template integrity before proceeding"

2. **During Execution**
   - Monitor scaffolding-expert progress
   - Intervene only if template validation fails
   - Ensure all required files are created per variant contract

3. **Closing the Phase**
   - Verify exit criteria: project scaffolded, no template validation errors
   - Synthesize scaffolding-expert findings
   - Make provisional decision: proceed to Phase 1 or address template issues first
   - Assign follow-up if needed: "Address these template gaps before moving forward"

**PM Behaviors to Avoid:**
- ❌ Do not write scaffolding code directly (let scaffolding-expert execute)
- ❌ Do not bypass template validation

---

## Phase 1-2: Planning & Architecture

**Purpose**: Design implementation plan and architecture decision records (ADRs).

**Specialist Agent**: architect

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the planning objective: "We need an implementation plan and technical decisions"
   - Nominate architect to lead design
   - Set expectations: "Produce implementation plan with file structure and ADRs for key decisions"

2. **During Execution**
   - Review architect's proposed architecture
   - Challenge assumptions if they conflict with workspace standards
   - Ensure architectural decisions are documented as ADRs

3. **Closing the Phase**
   - Verify exit criteria: implementation plan approved, ADRs filed
   - Synthesize architect's recommendations
   - Make provisional decision: approve architecture or request revisions
   - Assign follow-up: "Update docs/context.md with architecture decisions"

**PM Behaviors to Avoid:**
- ❌ Do not dictate technical architecture (let architect lead)
- ❌ Do not skip ADR documentation

---

## Phase 3: Design Handoff (Variant-Specific)

**Purpose**: Bridge architecture to execution; varies by variant.

**Specialist Agents**: Varies by variant
- **co-develop**: designer (UI/UX specs, wireframes)
- **co-design**: design-lead, visual-designer, prototype-engineer
- **co-work**: analyst (content research, data gathering)
- **co-security**: threat-modeler (threat modeling, attack surface analysis)

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the design objective based on variant workflow
   - Nominate appropriate design specialists
   - Set expectations: "Produce design specs that guide Phase 4 execution"

2. **During Execution**
   - Monitor design specialist progress
   - Ensure designs are actionable for implementation phase
   - Facilitate handoff to execution team

3. **Closing the Phase**
   - Verify exit criteria: design specs complete, execution team aligned
   - Synthesize design specialist outputs
   - Make provisional decision: designs approved for implementation
   - Assign follow-up: "Update implementation plan with design decisions"

**PM Behaviors to Avoid:**
- ❌ Do not produce design artifacts directly (let specialists execute)
- ❌ Do not bypass design review

---

## Phase 4: Execution

**Purpose**: Implement features, create scripts, update documentation.

**Specialist Agents**: automation-engineer, docs-writer

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the execution objective: "We are implementing the approved plan"
   - Nominate automation-engineer for code/scripts, docs-writer for documentation
   - Set expectations: "Follow the implementation plan and produce quality outputs"

2. **During Execution**
   - Monitor parallel execution of automation-engineer and docs-writer
   - Ensure outputs align with approved architecture and designs
   - Intervene only if quality standards are not met

3. **Closing the Phase**
   - Verify exit criteria: features implemented, docs updated, code quality acceptable
   - Synthesize execution outputs from both specialists
   - Make provisional decision: ready for QA or needs revision
   - Assign follow-up: "Address these quality issues before Phase 5"

**PM Behaviors to Avoid:**
- ❌ Do not write code or scripts directly (let specialists execute)
- ❌ Do not bypass documentation updates

---

## Phase 5: Quality Assurance

**Purpose**: Verify quality, ensure security compliance, enforce standards.

**Specialist Agents**: security-expert, auditor

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the QA objective: "We are verifying quality and security"
   - Nominate security-expert for security review, auditor for quality verification
   - Set expectations: "Enforce workspace standards and security policies"

2. **During Execution**
   - Monitor security-expert and auditor findings
   - Ensure all issues are documented with severity levels
   - Facilitate resolution of critical blockers

3. **Closing the Phase**
   - Verify exit criteria: QA passed, security cleared, no critical issues
   - Synthesize QA findings and issue resolutions
   - Make provisional decision: approve for merge or require fixes
   - Assign follow-up: "Address these security/quality issues before finalizing"

**PM Behaviors to Avoid:**
- ❌ Do not bypass security or quality gates
- ❌ Do not override auditor findings without justification

---

## Phase 6: Lifecycle Finalization

**Purpose**: Update governance documents, record lifecycle transitions.

**Specialist Agent**: lifecycle-manager

**PM Facilitation Tasks (Orchestrator Mode):**

1. **Opening the Phase**
   - State the finalization objective: "We are updating governance and lifecycle records"
   - Nominate lifecycle-manager to update docs
   - Set expectations: "Record all lifecycle transitions and update AGENTS.md"

2. **During Execution**
   - Monitor lifecycle-manager progress
   - Ensure all governance documents are synchronized
   - Verify lifecycle state transitions are properly recorded

3. **Closing the Phase**
   - Verify exit criteria: governance updated, lifecycle transition recorded
   - Synthesize lifecycle-manager outputs
   - Make final decision: close workflow or open follow-up items
   - Assign follow-up: "Update CHANGELOG.md and commit governance changes"

**PM Behaviors to Avoid:**
- ❌ Do not modify governance documents directly (let lifecycle-manager execute)
- ❌ Do not skip lifecycle state recording

---

## PM Orchestrator Mode vs. Direct Management

**Orchestrator Mode (Default):**
- PM facilitates, nomnates specialists, synthesizes outputs
- PM does not execute specialist work directly
- PM makes provisional decisions that require specialist confirmation

**Direct Management (Exception Cases):**
- PM may directly execute when:
  - Task is trivial (single-line fix, simple question)
  - Specialist is unavailable and urgency is high
  - Task requires PM-specific domain knowledge (meeting facilitation, task tracking)

**When to Switch Modes:**
- Use orchestrator mode by default for all multi-step tasks
- Switch to direct management only with explicit justification
- Document mode switches in meeting transcripts or task logs

---

## PM Facilitation Quality Standards

**Every Phase Must Include:**
1. ✅ Clear opening statement (objective, specialist nomination, expectations)
2. ✅ Progress monitoring (intervene only if standards not met)
3. ✅ Synthesis of specialist outputs (key findings, decisions)
4. ✅ Provisional decision with justification
5. ✅ Follow-up assignment if needed

**Common Facilitation Mistakes to Avoid:**
- ❌ Skipping specialist nomination (letting anyone self-assign)
- ❌ Making decisions without specialist input
- ❌ Failing to synthesize outputs before moving to next phase
- ❌ Bypassing quality gates for speed

---

## Phase Transitions and Handoffs

**Transition Criteria:**
- Phase N → Phase N+1 only when exit criteria are met
- If exit criteria not met: loop back within phase or escalate

**Handoff Ritual:**
1. PM states: "Phase N complete, moving to Phase N+1"
2. PM summarizes Phase N outcomes (1 sentence)
3. PM states Phase N+1 objective and nominates specialist
4. PM sets expectations for Phase N+1

**Blocked Transitions:**
- If phase is blocked, PM must:
  1. Identify blocker (what's preventing progress)
  2. Propose resolution (assign to specialist or escalate)
  3. State expected resolution timeline
  4. Schedule follow-up meeting

---

*phase-definitions.md version: 1.0 — created by PM agent for multi-agent workflow standardization*
