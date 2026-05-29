# Meeting Transcript
**Date**: 2026-05-29
**Topic**: lifecycle-manager agent scope reduction and template/variant deployment design
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Follow-up to meeting-2026-05-29-lifecycle-manager-agent.md. User feedback: the previously designed role (policy SSOT owner + coordination + impact assessment) is too broad and risks creating overload in the new agent. Also: should the agent exist only at workspace root, or also in templates/common and variants?

---

## Transcript

**PM**: (Opening)

Two agenda items:
1. Round 1: Narrow the lifecycle-manager role to a "minimum viable role"
2. Round 2: Workspace root only vs. template/variant extension

---

**Architect**: (Round 1)

The previous design was overloaded — essentially a "mini-PM for lifecycle." The real ownership gap was specifically: "changes happened but governance records were not updated." That is a state record keeping problem, not a design coordination problem.

Minimum viable role:
- **State monitor**: regularly checks lifecycle state across 5 domains
- **Record keeper**: updates governance docs to match reality
- **Drift reporter**: reports policy-reality gaps to PM

Removed from role: coordination between design/implementation/QA, proactive change impact assessment. Those belong to PM and architect respectively.

Question to automation-engineer: How do the 3 existing lifecycle skills map to this narrowed role?

---

**Automation-Engineer**: (Round 1)

The 3 existing skills already implement this role domain-by-domain:
- `agent-lifecycle-manager`: agent domain state monitoring + record keeping
- `skill-lifecycle-manager`: skill domain
- `script-lifecycle-manager`: script domain

lifecycle-manager agent uses these skills and handles the final step: reflecting results into governance documents (lifecycle-governance.json, VERSION_REGISTRY.json, SCRIPTS.md).

Additional narrowing: "change impact assessment" should be removed — that's architect's domain. lifecycle-manager only records after changes occur. **Post-hoc recording, not pre-hoc analysis.**

Core metaphor: **"Secretary (not decision-maker)"** — records decisions, does not make them.

Question to auditor: Is this narrowed role sufficient to prevent the 7 issues? Is there a risk of being too narrow?

---

**Auditor**: (Round 1)

The narrowed role is sufficient. 6 of the 7 issues were "record not updated after change" — exactly what lifecycle-manager addresses. The remaining issue (audit tools not enforcing status as required) is handled by lifecycle-manager reporting the gap to PM for remediation dispatch.

Narrower = more frequent execution = more effective. The "secretary" framing is correct and sufficient.

---

**PM**: (Round 1 — Close)

Finalized minimum viable role:
- Keep: state monitor, record keeper, drift reporter
- Remove: design coordination, proactive impact assessment, direct QA

Core principle: recorder, not decision-maker.

Round 2: Template/variant deployment question.

---

**Architect**: (Round 2)

Template/variant deployment is necessary. Lifecycle issues occur at every layer independently — co-work and co-design agent status gaps are L1 issues that workspace root lifecycle-manager cannot detect.

Deployment design:
- **L0 (workspace root)**: `agents/lifecycle-manager.md` — governs governance policy documents (lifecycle-governance.json, VERSION_REGISTRY.json, SCRIPTS.md) + L0 agent/skill/script state
- **L1 (templates/common)**: `lifecycle-manager` as common agent — auto-copied to projects via `new-project.sh`. Governs variant-internal agent/skill states
- **L2 (projects)**: inherited from L1, same behavior

Same agent name, different scope per execution context (same pattern as CLAUDE.md having different content at root vs. variant level). Two files with same role principles but different jurisdiction sections.

Question to automation-engineer: Is the two-file strategy implementable?

---

**Automation-Engineer**: (Round 2)

Yes, with one clarification: the two files must have different content in their jurisdiction sections but identical content in their principle sections:

- **Same across both files**: Role definition, behavioral principles (secretary principle — record, don't decide), PM-only invocation, output formats
- **Different per file**: Jurisdiction scope, list of files to check, tools to use

L0 file: `agents/lifecycle-manager.md`
L1 file: `templates/common/agents/lifecycle-manager.md`

Variant files: same as L1 common file, no customization. lifecycle record-keeping does not vary by variant. VARIANT_CONTRACT.md should add lifecycle-manager as a required agent.

Question to auditor: Is the two-file strategy manageable from a QA perspective?

---

**Auditor**: (Round 2)

Manageable. Key: validate "consistency of principles" not "identical content."

`validate-templates.ts` can check that variant lifecycle-manager files match the common file (same L0/L1 drift detection pattern applies). The principle sections must match; jurisdiction sections are expected to differ.

Strong recommendation: **variant files must not be customized** — use the common file as-is. Customization creates drift that defeats the purpose. Lifecycle record-keeping is identical across all variants; only the scope of what is recorded differs (and that is determined by execution context, not file content).

---

## Final Role Definition

**lifecycle-manager** — "The Secretary of Lifecycle State"

| Attribute | Value |
|-----------|-------|
| Role | State monitor + Record keeper + Drift reporter |
| NOT responsible for | Design decisions, impact assessment, QA gate execution, coordination |
| Tier | Medium (claude-sonnet-4.6) |
| Invocation | PM-only; mandatory at Phase 6 Finalization |
| Core tools | agent-lifecycle-manager skill, skill-lifecycle-manager skill, script-lifecycle-manager skill |
| Output | Lifecycle status report, governance document updates, drift report to PM |

## Deployment Design

| Layer | File | Jurisdiction |
|-------|------|-------------|
| L0 | `agents/lifecycle-manager.md` | Governance policy docs + L0 agents/skills/scripts lifecycle state |
| L1 | `templates/common/agents/lifecycle-manager.md` | Variant agents/skills + variant.json lifecycle state |
| L2 | Inherited from L1 (no customization) | Same as L1, scoped to project |

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| D-01 | architect | L0 lifecycle-manager role specification — jurisdiction, files to check, output format | Design |
| D-02 | automation-engineer | Create `agents/lifecycle-manager.md` (L0) + register in AGENTS.md | Implementation |
| D-03 | automation-engineer | Create `templates/common/agents/lifecycle-manager.md` (L1) + add to VARIANT_CONTRACT.md required agents | Implementation |
| D-04 | pm | Document Phase 6 Finalization lifecycle-manager review mandate in AGENTS.md or CONSTITUTION.md | Policy |
| D-05 | automation-engineer | Add lifecycle-manager existence check to `validate-templates.ts` | Validation |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | lifecycle-manager role definition explicitly excludes design coordination and impact assessment | Review agents/lifecycle-manager.md |
| AC-02 | L0 and L1 lifecycle-manager files have identical principle sections | Diff the Role/Principles/Output-format sections |
| AC-03 | All 4 variants have lifecycle-manager in agents/ after new-project scaffold | `ls templates/co-*/agents/lifecycle-manager.md` |
| AC-04 | VARIANT_CONTRACT.md lists lifecycle-manager as required | Manual review |
| AC-05 | Phase 6 mandate documented and verifiable | AGENTS.md or CONSTITUTION.md check |
