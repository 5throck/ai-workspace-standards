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
| 1-2 | Planning & Architecture | architect | Approver (architect leads) | Implementation plan approved, ADRs filed |
| 3 | Design Handoff | (varies by variant) | Approver (variant specialist leads) | Design specs ready, team aligned |
| 4 | Execution | automation-engineer, docs-writer | Absent (autonomous) | Features implemented, docs updated |
| 5 | Lifecycle Finalization | pm | Executor | Governance documents updated, lifecycle transition complete |
| 6 | Quality Assurance & Finalization | pm, auditor, security-expert | Executor (Variant) / Absent (Workspace) | QA passed, PR created |

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

> **PM Role**: Approver — architect leads this phase autonomously. PM does not orchestrate execution; PM reviews and approves the output before Phase 3 begins.

**PM Responsibilities (Approver Mode):**

1. **At Phase Start**
   - Confirm the planning objective is clear and hand off to architect
   - Architect proceeds independently: produces implementation plan, file structure, and ADRs

2. **At Phase Close**
   - Review architect's implementation plan and ADRs
   - Approve or request targeted revisions (PM does not rewrite the plan)
   - Assign follow-up: "Update docs/context.md with architecture decisions"

**PM Behaviors to Avoid:**
- ❌ Do not orchestrate or direct architect's design process
- ❌ Do not dictate technical architecture (architect leads)
- ❌ Do not skip ADR documentation

---

## Phase 3: Design Handoff (Variant-Specific)

**Purpose**: Bridge architecture to execution; varies by variant.

**Specialist Agents**: Varies by variant
- **co-develop**: designer (UI/UX specs, wireframes)
- **co-design**: design-lead, visual-designer, prototype-engineer
- **co-work**: analyst (content research, data gathering)
- **co-security**: threat-modeler (threat modeling, attack surface analysis)

> **PM Role**: Approver — variant specialist(s) lead this phase autonomously. PM does not orchestrate execution; PM reviews and approves design outputs before Phase 4 begins.

**PM Responsibilities (Approver Mode):**

1. **At Phase Start**
   - Confirm design objective and hand off to the appropriate variant specialist(s)
   - Specialists proceed independently: produce design specs that guide Phase 4 execution

2. **At Phase Close**
   - Review design specialist outputs
   - Approve or request targeted revisions (PM does not produce design artifacts)
   - Assign follow-up: "Update implementation plan with design decisions"

**PM Behaviors to Avoid:**
- ❌ Do not orchestrate or direct the specialist's design process
- ❌ Do not produce design artifacts directly (let specialists execute)
- ❌ Do not bypass design review

---

## Phase 4: Execution

**Purpose**: Implement features, create scripts, update documentation.

**Specialist Agents**: automation-engineer (scripts/code), docs-writer (documentation)

> **Phase 4 is autonomous — PM does not orchestrate.** The Lead Agent (automation-engineer for scripts, docs-writer for documentation) executes independently per the approved plan from Phases 1-2. PM is not involved during execution and does not monitor, intervene, or synthesize outputs in this phase.

**How Phase 4 Runs:**
- automation-engineer and docs-writer execute the approved plan without PM direction
- They follow the implementation plan and quality standards established in Phases 1-2
- Phase 5 (Lifecycle Finalization) begins only after both agents have completed their work

**PM Behaviors to Avoid:**
- ❌ Do not orchestrate, monitor, or intervene during Phase 4
- ❌ Do not write code or scripts directly (automation-engineer owns this)
- ❌ Do not bypass documentation updates (docs-writer owns this)

---

## Phase 5: Lifecycle Finalization

**Purpose**: Update governance documents, record lifecycle transitions.

**Specialist Agent**: pm

**PM Facilitation Tasks (Executor Mode):**

1. **Opening the Phase**
   - State the finalization objective: "We are updating governance and lifecycle records"

2. **During Execution**
   - Ensure all governance documents are synchronized

3. **Closing the Phase**
   - Verify exit criteria: governance updated, lifecycle transition recorded

**PM Behaviors to Avoid:**
- ❌ Do not skip lifecycle state recording

---

## Phase 6: Quality Assurance & Finalization

**Purpose**: Verify quality, ensure security compliance, enforce standards, and create PR.

**Specialist Agents**: pm (variant QA scripts), security-expert (security review), auditor (workspace root only)

> **Phase 6 Execution**: In variants, the PM directly executes QA skills (`audit-workspace`, `validate-docs-links`). In the workspace root, the Auditor leads the QA gate independently. The security-expert conducts security review independently.

**How Phase 6 Runs:**
- In variants, PM runs QA skills directly
- In workspace root, auditor runs the quality gate against workspace standards
- security-expert conducts security review independently
- If issues are found, execution agents (Phase 4) address them and Phase 6 re-runs
- PM validates completion of QA gates
- PM runs `/sync` script and creates PR

**PM Behaviors to Avoid:**
- ❌ Do not bypass security or quality gates
- ❌ Do not override auditor findings (in workspace root) without justification
- ❌ Do not skip `/sync` pipeline

---

## PM Orchestrator Mode vs. Approver Mode vs. Absent

**PM owns Phases 0, 5 (Orchestrator/Executor Mode), and 6 (variants):**
- PM facilitates Phase 0, synthesizes outputs
- PM directly executes Phase 5 Lifecycle Finalization
- PM directly executes Phase 6 QA scripts in variants and Finalization (`/sync`, PR creation)

**PM approves Phases 1-2 and 3 (Approver Mode):**
- Architect leads Phase 1-2 autonomously; PM reviews and approves the output
- Variant specialists lead Phase 3 autonomously; PM reviews and approves design specs
- PM does not direct or monitor execution in these phases

**PM is absent from Phase 4 (and Phase 6 in workspace root):**
- Phase 4 (Execution): automation-engineer and docs-writer execute per the approved plan
- Phase 6 (QA - Workspace Root): auditor and security-expert run the quality gate independently

**Direct Management (Exception Cases):**
- PM may directly execute when:
  - Task is trivial (single-line fix, simple question)
  - Specialist is unavailable and urgency is high
  - Task requires PM-specific domain knowledge (meeting facilitation, task tracking)

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
