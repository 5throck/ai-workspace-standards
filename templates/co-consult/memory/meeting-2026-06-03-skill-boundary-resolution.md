# Meeting Transcript
**Date**: 2026-06-03
**Topic**: Resolving Open Issue — Boundary Between financial-modeling and technical-feasibility Skills
**Participants**: Engagement Leader (facilitator), Strategy Analyst, Change Management Partner, Communications Lead, Solutions Architect, Delivery Manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**Engagement Leader** (Facilitator Opening):
One open issue remained from the previous meeting: where does the `financial-modeling` skill end and the `technical-feasibility` skill begin? If the boundary is unclear, Strategy Analyst and Solutions Architect will either duplicate work or leave a gap where neither covers the analysis. Today's goal: agree on a clear boundary and define the input/output interface between the two skills.

**Strategy Analyst** (Round 1):
`financial-modeling` answers "why should we invest in this solution" with numbers: investment size estimation, expected revenue/cost-savings quantification, NPV/IRR/Payback Period, scenario sensitivity analysis. Critically, this skill presupposes the solution is already defined — it calculates "how much will this cost," not "is this buildable." That judgment belongs to Solutions Architect. Proposed sequence: Solutions Architect evaluates feasibility and rough complexity first, then Strategy Analyst converts that into specific cost figures. Question to Solutions Architect: what minimum outputs from `technical-feasibility` are required to build the financial model?

**Solutions Architect** (Round 1):
Basic agreement on the boundary, but these two tasks are iterative, not sequential, in real engagements. `technical-feasibility` scope: is this solution technically realizable, and at what complexity level? Specifically: technology readiness level (TRL), integration complexity with existing systems, data migration risk, capability gap between required and current state. Precise implementation cost is NOT a `technical-feasibility` output — complexity grade (Low/Medium/High) and key risk factors are, and conversion to cost is Strategy Analyst's responsibility. Minimum interface to Strategy Analyst: (1) implementation complexity grade, (2) 3-5 key risk factors, (3) preconditions (required infrastructure, external vendor dependencies). Problem: financial model investment assumptions can retroactively influence technology option selection if a budget constraint exists. Question to Delivery Manager: realistically, how many iteration loops between these two skills is sustainable?

**Delivery Manager** (Round 1):
Maximum 2 loops is realistic. Loop 1: draft technical assessment → rough cost range → check budget constraint. Loop 2: adjust technical options to fit budget → finalize cost model. Beyond 2 loops, Phase 1 extends too long and impacts overall schedule. Proposal: explicitly encode "maximum 2 iterations" as a constraint in both skill definitions. After 2 loops without agreement, Engagement Leader escalates to client for budget range reconfirmation. Question to Change Management Partner: when these two skills iterate, what organizational variables are easy to miss?

**Change Management Partner** (Round 1):
The most commonly omitted items are people costs: change management costs, training/education costs, and schedule delay costs from resistance. Both skills naturally miss these — they fall between technical complexity and pure financial modeling. Proposal: explicitly include a "change management cost" category in `financial-modeling`'s cost checklist, sourced from `org-readiness-assessment` outputs. This creates a three-skill pipeline: `technical-feasibility` → `org-readiness-assessment` → `financial-modeling` completing a full business case. Question to Communications Lead: what structure should the integrated output take for executive reporting?

**Communications Lead** (Round 1):
For executive reports, the three-skill outputs must arrive as a single integrated business case document: (1) Executive Summary (1 page): investment size, expected benefits, key risks, recommendation; (2) Technical Assessment Summary: complexity grade, key preconditions, option comparison; (3) Financial Analysis: NPV/IRR, scenario sensitivity, change management costs included; (4) Organizational Readiness: change impact, capability gaps, recommended implementation sequence. This structure becomes the standard template for the `executive-presentation` skill — 1:1 mapping of the three skills' outputs to report sections. Additional proposal: `technical-feasibility` risk outputs should include a "financial impact estimate" for each risk, since executives trust "expected loss if implementation fails" more than complexity grades.

### Round 2

**Strategy Analyst** (Round 2):
Communications Lead's proposal resolves the boundary debate practically. If `technical-feasibility` includes financial impact estimates for each risk, those values become direct inputs for risk-adjusted scenario modeling in `financial-modeling`. Final proposed boundary agreement: `financial-modeling` inputs: (1) solution definition, (2) `technical-feasibility` complexity grade + risk financial impact values, (3) `org-readiness-assessment` change management cost estimates. `financial-modeling` outputs: TCO, NPV/IRR, scenario sensitivity, full business case with change management costs. `technical-feasibility` inputs: solution design draft, current technology environment. `technical-feasibility` outputs: implementation complexity grade, 3-5 key risks + financial impact estimate per risk, preconditions list.

**Solutions Architect** (Round 2):
Agree with the final boundary proposal. Clarification on "financial impact estimate" in `technical-feasibility`: this skill will NOT perform precise financial calculations. Instead, it provides a standard risk-grade cost range lookup table (e.g., Medium risk → 15-25% additional implementation cost possible). Precise financial calculation remains `financial-modeling`'s domain. This preserves each skill's expertise boundary while providing a clean interface. Question to Delivery Manager: does this interface structure provide sufficient information for execution planning?

**Delivery Manager** (Round 2):
The risk-grade cost range lookup approach is the most practical for execution management. "15-25% additional buffer" directly feeds into schedule contingency and budget reserve setting in the risk register. Final addition: loop entry and exit conditions must be explicit. Entry condition: confirmed mismatch between budget constraint and technical options. Exit conditions: (1) cost range fits within client budget, OR (2) after 2 iterations, Engagement Leader makes escalation decision. Escalation: Engagement Leader renegotiates budget scope with client.

**Change Management Partner** (Round 2):
One principle to emphasize: regardless of how well the skill boundaries are defined, in real engagements these boundaries must operate flexibly. When organizational change resistance is severe, `org-readiness-assessment` results can overturn the technical option selection itself — causing all three skills to be re-examined simultaneously. Each skill should include explicit "trigger conditions under which this skill's result may require re-execution of another skill." This is not a boundary problem but a skill orchestration principle. Recommendation: Engagement Leader documents this in `pm.md` or as a separate `engagement-orchestration` guideline.

**Communications Lead** (Round 2):
Change Management Partner's orchestration principle is the most important conclusion of this discussion. "When to invoke which skill in what sequence" is the higher-order question. From an `executive-presentation` design perspective: the business case section is only complete when all three skills (`technical-feasibility`, `org-readiness-assessment`, `financial-modeling`) have produced outputs. If any is missing, the executive presentation has a visible gap. Practical resolution: list all three skills in `executive-presentation`'s `prerequisites` field. This implements Change Management Partner's orchestration principle at the skill metadata level — dependency declared, not just implied.

---

## Synthesis (Delivery Manager)

### Open Issue: Resolved

**Agreed Boundary Definition:**

| Skill | Inputs | Outputs | Expertise Boundary |
|-------|--------|---------|-------------------|
| `technical-feasibility` | Solution design draft, current tech environment | Complexity grade (L/M/H), 3-5 key risks + cost range per grade (lookup table), preconditions | Technical judgment only — no precise financial calculation |
| `financial-modeling` | Solution definition + `technical-feasibility` results + `org-readiness-assessment` results | TCO, NPV/IRR, scenario sensitivity, full business case incl. change management costs | Financial judgment only — no technical option evaluation |

### Additional Agreements:
1. **Iteration loop control**: max 2 iterations; entry/exit conditions explicit in both skills; after 2 loops, Engagement Leader escalates to client
2. **Change management costs**: `financial-modeling` cost checklist explicitly includes "change management cost" category, sourced from `org-readiness-assessment`
3. **Risk financial impact**: `technical-feasibility` provides cost range lookup table by risk grade — not precise calculation
4. **Prerequisites declaration**: `executive-presentation` lists `technical-feasibility`, `org-readiness-assessment`, `financial-modeling` as prerequisites
5. **Orchestration principle**: skill re-execution trigger conditions to be documented in `pm.md` or `docs/engagement-orchestration.md`

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-14 | Solutions Architect | Medium | Add cost range lookup table and loop exit conditions to `technical-feasibility` skill |
| A-15 | Strategy Analyst | Medium | Add change management cost category and loop entry/exit conditions to `financial-modeling` skill |
| A-16 | Communications Lead | Medium | Add three prerequisite skills to `executive-presentation` skill prerequisites field |
| A-17 | Engagement Leader | High | Document skill re-execution trigger conditions in `pm.md` or `docs/engagement-orchestration.md` |
