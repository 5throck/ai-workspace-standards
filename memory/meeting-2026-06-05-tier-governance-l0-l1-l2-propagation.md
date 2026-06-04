# Meeting Transcript
**Date**: 2026-06-05
**Topic**: Tier Governance Rules Propagation Strategy — L0 to L1 to L2
**Participants**: architect, automation-engineer, lifecycle-manager, auditor (synthesizer)
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Follow-up to previous meeting (meeting-2026-06-05-tier-governance-violation.md).
The user identified that the tier governance fix must propagate not only to L0 (workspace root)
but also to L1 (templates/co-*/) and L2 (Projects/), so that all future and existing variants
inherit the correct rules.

---

## Transcript

### Round 1

**[Architect]**: (Round 1)

The layer structure must be clearly defined first. L0 is C:/git/ — the workspace root, where agents/pm.md and CLAUDE.md define PM Gateway rules. L1 is templates/co-*/ — variant blueprints, inheriting common PM behavior via templates/common/agents/pm.md. L2 is Projects/<name>/ — operational instances with variant-specific agent overrides.

The core of this violation: tier governance enforcement rules exist only in L0's agents/pm.md. templates/common/agents/pm.md has PM Phases (0, 2, 5, 6) and single entry-point rules, but the "deliverable type to Phase determination to tier ceiling validation" checklist is absent. All variants derived from L1 and their L2 instances have structural vulnerability to repeat the same violation.

Design proposal for propagation: enforcement rules must be inserted into two places simultaneously. First, templates/common/agents/pm.md — the common PM behavior inherited by all variants. Second, CLAUDE.md Section 5 Agent Dispatch Rules — currently L0 only, needing propagation via templates/common/ to L1 and via create-l2-scaffold.ts to L2.

Question to automation-engineer: how does create-l2-scaffold.ts currently inject CLAUDE.md into L2?

---

**[Automation-Engineer]**: (Round 1)

Confirmed. create-l2-scaffold.ts Step 3 copies templates/common/ to L2, but CLAUDE.md is not in this path. Step 5 generates the CLAUDE.md stub independently — via internal template string, not from templates/common/CLAUDE.md.

Current propagation paths:
- L0 agents/pm.md: no L1 propagation (templates/common/agents/pm.md is a separate file)
- L0 CLAUDE.md Section 5: no L2 propagation (create-l2-scaffold.ts overwrites with stub)

Additional complexity for L2: Projects/safety-os/agents/pm.md is a variant-specific PM with CSO override. Directly copying L0 tier enforcement rules would conflict with domain-specific routing rules (SGM/SWM branching). For L2 propagation, "common tier principles" must be preserved while "workspace-only specialist list" (architect, automation-engineer) is replaced with variant agent list.

Question to lifecycle-manager: how should this separation be structured?

---

**[Lifecycle-Manager]**: (Round 1)

CLAUDE.md Section 5 Specialist Agent List hardcodes workspace-root-specific agent names. If propagated as-is to L2, safety-os would have a rule "consult architect for Phase 1-2" even though architect is not in its AGENTS.md.

Therefore the propagation strategy must separate tier principles from specialist list:

- Tier principles (variant-agnostic, identical across all layers): "new file design requires design agent first", "deliverable type to Phase determination to tier ceiling validation"
- Specialist list (variant-specific, per each AGENTS.md): L0 uses architect/automation-engineer; safety-os uses SGM/SWM/compliance-agent

Proposed propagation structure:
1. templates/common/agents/pm.md — add "Section: Tier Governance Principles" section (principles only, no specialist list)
2. CLAUDE.md Section 5 Agent Dispatch Rules — add deliverable type determination table (with L0-specific specialist list)
3. create-l2-scaffold.ts Step 5 — when generating L2 CLAUDE.md, inject Tier Governance Principles + auto-generate variant-specific specialist list from AGENTS.md

Question to architect: what is the status of retroactive ADR (A-01) in this structure? Is a separate ADR still needed after propagation is complete?

---

### Round 2

**[Architect]**: (Round 2)

Lifecycle-manager's separation strategy is correct. The retroactive ADR (A-01) remains independently necessary — an ADR records the rationale (why), while the CLAUDE.md section carries the enforcement rule (what). They serve different audiences. The ADR provides the basis for understanding "why it was decided this way" when rules need to change in the future.

Concrete work breakdown:

L0 work (architect design-first, automation-engineer implements):
- Add Phase determination table to agents/pm.md Section: Mandatory Execution Plan
- Add "deliverable type to Phase determination" rule table to CLAUDE.md Section 5

L1 work (templates/common/):
- Add "Section: Tier Governance Principles" to templates/common/agents/pm.md (variant-agnostic)
- Must pass bun scripts/validate-templates.ts afterward

L2 work (modify create-l2-scaffold.ts, automation-engineer):
- Modify Step 5 CLAUDE.md template to inject Tier Governance Principles section
- Add logic to parse agents/ directory and auto-inject variant-specific specialist list

Question to automation-engineer: is modifying create-l2-scaffold.ts Step 5 to parse agents/ frontmatter feasible given the current structure?

---

**[Automation-Engineer]**: (Round 2)

Feasible, but full AGENTS.md parsing is overly complex. Simpler approach: scan the agents/ directory for .md files, read the tier field from each frontmatter, and dynamically generate the specialist list.

Example:
- agents/sgm.md with tier: medium becomes Medium-tier specialist
- agents/swm.md with tier: medium becomes Medium-tier specialist
- agents/compliance-agent.md with tier: low becomes Low-tier specialist

This way, Step 5 modification:
1. Scans variant's agents/ folder at execution time
2. Auto-generates specialist list based on frontmatter tier field
3. Injects into CLAUDE.md Section 5 Specialist Agent List

However, this logic is itself a design decision and must be included in architect ADR (A-01) — create-l2-scaffold.ts modification (A-05) must not begin until A-01 ADR is approved. Violating this order repeats the same Phase misclassification.

Question to lifecycle-manager: does retroactive update of existing variants (co-consult, co-design, etc.) pm.md also require a procedure?

---

**[Lifecycle-Manager]**: (Round 2)

Yes — required. The retroactive update procedure is more complex than it appears.

Each variant's pm.md is based on templates/common/agents/pm.md but exists as an independent file. Modifications to the common file do not automatically propagate to existing variants — they already diverged when new-project.sh copied them.

Therefore, after modifying templates/common/agents/pm.md, the existing 5 variants (co-consult, co-design, co-develop, co-security, co-work) must be manually synchronized.

This is a missing entry in CLAUDE.md Section 10 Lifecycle Rules. There is currently no defined propagation obligation for templates/common/agents/*.md modifications to variant synchronization. A new row in CLAUDE.md Section 10 is also needed as an action item:

> When templates/common/agents/*.md is modified, synchronize the identical file in all templates/co-*/agents/ — this is mandatory.

Question to architect: should this item be included in A-04 (PM Gateway hardening) or a separate action item?

---

## Synthesis

**[Auditor]**: (Synthesis)

**Points of Agreement**:
1. Separation principle confirmed: "tier principles" (variant-agnostic) and "specialist list" (variant-specific) must be separated for propagation
2. 3-layer propagation path: L0 agents/pm.md + CLAUDE.md Section 5 to L1 templates/common/agents/pm.md to L2 create-l2-scaffold.ts Step 5
3. 5 retroactive targets: existing variants (co-consult, co-design, co-develop, co-security, co-work) pm.md manual sync required
4. Sequence dependency confirmed: A-01 (ADR) must precede A-05 (create-l2-scaffold modification)

**Open Questions**:
- templates/common/agents/*.md modification to variant sync obligation is missing from CLAUDE.md Section 10 Lifecycle Rules (identified by lifecycle-manager)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase | Depends On |
|---|-------|------|-------------|-------|------------|
| B-01 | architect | High | Add "deliverable type to Phase determination" rule table to L0 agents/pm.md Section: Mandatory Execution Plan | Phase 1-2 | — |
| B-02 | architect | High | Add Phase determination checklist to L0 CLAUDE.md Section 5 Agent Dispatch Rules + GEMINI.md parity | Phase 1-2 | B-01 |
| B-03 | automation-engineer | Low | Add Tier Governance Principles section (variant-agnostic) to L1 templates/common/agents/pm.md | Phase 4 | B-01 |
| B-04 | automation-engineer | Low | Retroactive sync of existing 5 variant templates/co-*/agents/pm.md files | Phase 4 | B-03 |
| B-05 | automation-engineer | Low | Modify L2 create-l2-scaffold.ts Step 5 — inject Tier Governance Principles in CLAUDE.md generation + auto-generate specialist list from agents/ frontmatter scan | Phase 4 | A-01, B-01 |
| B-06 | automation-engineer | Low | Retroactive: add Tier Governance Principles section to L2 Projects/safety-os/CLAUDE.md Section 5 and agents/pm.md (without conflicting with CSO override) | Phase 4 | B-01 |
| B-07 | pm | Medium | Add new row to CLAUDE.md Section 10 Lifecycle Rules: "when templates/common/agents/*.md is modified, sync all templates/co-*/agents/ required" + GEMINI.md parity | Governance | B-01 |

## Execution Order

Sequential phases:
1. B-01 (architect design first — L0 ADR + pm.md rule table)
2. B-02 + B-03 in parallel (L0 CLAUDE.md + L1 common pm.md)
3. B-04 + B-05 + B-06 in parallel (L1 variant retroactive sync + L2 scaffold modification + L2 safety-os retroactive)
4. B-07 (Section 10 lifecycle rules new row)

## Core Conclusion

Tier governance rules have been managed only in L0 pm.md, with propagation paths to L1 and L2 structurally disconnected. The solution is separating rules into a "principles layer" (variant-agnostic, located in templates/common) and an "enforcement layer" (variant-specific, in each CLAUDE.md/agents/pm.md) and propagating accordingly. Once this structure is complete, all new L2 projects will automatically inherit correct tier governance via create-l2-scaffold.ts alone.
