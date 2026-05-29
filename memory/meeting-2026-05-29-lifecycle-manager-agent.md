# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Lifecycle governance dedicated agent — necessity review and design
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

The 5-domain × 3-layer lifecycle governance system has no single owner. Responsibilities are distributed:
- Architect: structural design of governance policy
- Automation-engineer: tool implementation
- Auditor: QA gate execution

This distribution resulted in 7 lifecycle issues found in the comprehensive audit, including silent-passing status field gaps and stale governance documentation.

---

## Transcript

**PM**: (Opening)

We built a complex 5-domain × 3-layer lifecycle governance system, but no agent clearly owns "design, evolution, and operation" of this system. 7 issues were found in the comprehensive audit. Is the ownership gap a root cause? Should we create a dedicated agent or expand existing roles?

Round 1: Does an ownership gap actually exist?
Round 2: New agent vs. role expansion — design decision.

---

**Architect**: (Round 1)

Ownership is not clear, and that is partly my responsibility. Lifecycle governance is currently split:
- Structural design → architect (VARIANT_LIFECYCLE.md, lifecycle-governance.json, VARIANT_CONTRACT.md)
- Monitoring compliance → supposedly auditor
- Tool implementation → automation-engineer

No one can claim to own "lifecycle governance as a whole." The 7 issues were caused by the absence of someone regularly checking that policy, tools, and reality are aligned.

**Diagnosis**: Shared responsibility equals no responsibility in practice.

Question to auditor: Did you observe concrete cases where this gap created operational risk?

---

**Auditor**: (Round 1)

Yes — concrete cases:

1. `status` field missing from 7 agents, yet `audit.ts` reported `[PASS] Agent audit: all agents healthy`. Each team assumed the other was responsible for including status in required fields.

2. `lifecycle-governance.json` still referenced `audit.sh` after it became a deprecated thin wrapper. No one owned the responsibility of updating governance docs when implementation changed.

3. The "meeting decision → implementation → completion verification" loop was never closed for the `pair` field — architect designed it, automation-engineer waited for instruction, no one tracked it.

**Core problem**: When lifecycle-relevant changes occur, no one is responsible for asking "how does this change affect the governance policy documents and tools?"

Question to automation-engineer: What specific decisions were made "without an owner" from your implementation perspective?

---

**Automation-Engineer**: (Round 1)

The most frequent pain: no reference point for "does this implementation align with lifecycle policy?"

`checkVariantSkills()` was built as presence-driven (no skills/ directory = OK), but this conflicted with VARIANT_CONTRACT.md. The conflict wasn't caught because no one was responsible for checking implementation-policy alignment before coding.

The `pair` field: designed in a meeting, recorded in meeting notes, but never tracked to implementation completion. Architect considered design done; automation-engineer waited for dispatch. The loop never closed.

**A dedicated lifecycle-manager agent** would act as coordinator between policy design (architect), tool implementation (automation-engineer), and QA (auditor) — and as the policy SSOT owner.

---

**PM**: (Round 1 — Close)

Unanimous diagnosis: ownership gap is real and caused all 7 issues. A dedicated agent is needed. Role: policy SSOT owner + coordinator between design, implementation, and QA.

Round 2: New agent vs. role expansion — design.

Question to architect: New agent or expand auditor/architect scope?

---

**Architect**: (Round 2)

**New agent is correct.** Role expansion fails for structural reasons:

Expanding auditor: auditor is a verifier of outcomes. Lifecycle policy owner must be a designer. Combining "defines the rules" and "verifies the rules are followed" in one agent violates independence principles.

Expanding architect: already owns Phases 1-2 (analysis, design) across the whole workspace. Adding lifecycle governance operations causes overload. Also, architect focuses on new feature design; governance operations require continuous, repetitive monitoring.

**Proposed design for `lifecycle-manager`**:
- Name: `lifecycle-manager`
- Core responsibilities: lifecycle policy SSOT ownership, 5-domain × 3-layer state monitoring, consistency surveillance (policy ↔ tools ↔ reality), change impact assessment
- Relationships: receives design decisions from architect → reflects in governance docs; pre-reviews automation-engineer's tool implementations for policy alignment; independent from auditor's QA layer

Question to auditor: Independence and role boundary assessment?

---

**Auditor**: (Round 2)

Two conditions must be met:

**Condition 1 — Independence boundary**: `lifecycle-manager` defines policy (what the rules are). Auditor enforces policy (whether rules are followed). These must not overlap. If lifecycle-manager both defines and verifies, independence fails again.

**Condition 2 — Trigger mechanism**: lifecycle-manager's highest-value moment is "updating governance docs when a change occurs." Without a clear trigger, we return to manual comprehensive audits. Proposed rule: **PM must dispatch lifecycle-manager at Phase 6 (Finalization) for every change affecting agents, skills, scripts, or variants.** This makes lifecycle-manager review mandatory in the workflow.

Question to automation-engineer: What tool access does lifecycle-manager need? Which existing skills become its core tools?

---

**Automation-Engineer**: (Round 2)

Existing skills already designed for lifecycle-manager (currently used by PM/automation-engineer as substitutes):
- `agent-lifecycle-manager` skill
- `skill-lifecycle-manager` skill  
- `script-lifecycle-manager` skill

Additional tool access needed:
1. `validate-templates.ts` execution — full variant lifecycle state query
2. `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts` execution — diagnostic runs
3. `lifecycle-governance.json` read/write — direct policy document ownership

Agent configuration:
- Tier: medium (claude-sonnet-4.6) — policy document authoring and analysis
- Invocation: PM-only (like auditor)
- Key outputs: lifecycle status reports, policy change impact analysis, governance document updates

Since the three skills already exist in `skills/`, creating `agents/lifecycle-manager.md` + AGENTS.md registration enables immediate operation.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| D-01 | architect | Detailed design of `lifecycle-manager` agent role (responsibilities, authority, outputs, dispatch conditions) | Design |
| D-02 | automation-engineer | Create `agents/lifecycle-manager.md` + register in AGENTS.md | Implementation |
| D-03 | automation-engineer | Add `lifecycle-manager` to each variant's agents/ + AGENTS.md (elevate to standard agent) | Implementation |
| D-04 | pm | Add "Phase 6 Finalization requires lifecycle-manager review" policy to CONSTITUTION.md or AGENTS.md | Policy |

## Key Design Decisions

| Decision | Details |
|----------|---------|
| New agent, not role expansion | Auditor independence preserved; architect overload avoided |
| lifecycle-manager = policy layer | Defines rules; does NOT verify compliance (that remains auditor's role) |
| PM Phase 6 trigger | Mandatory dispatch at Finalization for any lifecycle-impacting change |
| Tier: medium | claude-sonnet-4.6; policy authoring and governance analysis |
| Core tools | 3 existing lifecycle skills + validate-templates.ts + audit scripts |
