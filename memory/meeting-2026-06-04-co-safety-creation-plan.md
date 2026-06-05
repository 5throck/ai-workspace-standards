---
name: meeting-2026-06-04-co-safety-creation-plan
description: Meeting on co-safety variant creation approach — Phase A skip, template SSOT strategy, safety-specific lifecycle rules
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-04
**Topic**: co-safety Variant Creation Plan and Approach
**Participants**: architect, scaffolding-expert, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[architect]**: (Round 1)

Reviewed safety-os-plan.md. The first branching decision is whether to follow the Phase A (independent prototype at `Projects/safety-os/`) → Phase B (workspace promotion at `templates/co-safety/`) sequence, or to start directly with `templates/co-safety/` as the SSOT.

All other variants (co-develop, co-design, etc.) were created directly in `templates/`. The Phase A intermediate step was included in the plan due to Safety OS's experimental nature, but since the workspace now has a complete scaffolding pipeline (new-project.sh, validate-templates.ts), it is more efficient to skip Phase A and define `templates/co-safety/` directly.

However, the Safety OS domain-specific files (workflows/, regulations/, evidence-models/) are structures not present in the common contract (common-contract.json). Question for scaffolding-expert: to what extent can the current scaffold pipeline auto-generate domain-specific subfolders?

---

**[scaffolding-expert]**: (Round 1)

Architect correctly identified the key point. The current new-project.sh/new-project.ps1 scripts copy the `templates/co-{name}/` folder to scaffold under `Projects/`. This means template definition must precede actual project creation.

The common contract (`templates/common/`) copies: CLAUDE.md, GEMINI.md, AGENTS.md, CHANGELOG.md, .claude/settings.json, .gemini/settings.json, agents/pm.md, scripts/audit.ts, etc.

Safety OS-specific folders (workflows/, regulations/, industry-profiles/, evidence-models/) are all co-safety-exclusive additional structure. Define them directly in `templates/co-safety/` — the scaffold script copies the entire template folder, so they are automatically included.

Work sequence:
1. Design `templates/co-safety/` folder structure (common inheritance + Safety OS exclusive additions)
2. Write co-safety proprietary files directly without modifying `templates/common/`
3. Verify validate-templates.ts passes
4. Generate `Projects/safety-os/` with new-project.sh

For security-expert: when designing agents/compliance-agent.md and regulations/ structure, it is important to pre-define boundaries on how regulation data is handled. If sensitive regulatory interpretations go directly into agent prompts, risks arise.

---

**[security-expert]**: (Round 1)

Scaffolding-expert's concern is important. Safety OS, unlike other variants, is a domain where legal liability is directly at stake. If an agent makes errors in interpreting the Occupational Safety and Health Act or the Serious Accidents Punishment Act, it becomes not just a bug but a legal risk.

Two principles that must be applied in design:

**First, Regulation Registry metadata-only principle.** The plan.md already states `regulations/` is "metadata only — content retrieved via MCP." This principle must be enforced at the template level. `.yaml` files should contain only article numbers + external reference URLs, not full statutory text. A disclaimer that "regulatory interpretation is user responsibility, not agent responsibility" should be explicit in CLAUDE.md.

**Second, evidence-models schema version management.** `finding.schema.json` and `corrective-action.schema.json` are the SSOT for audit traceability. If these schemas change, existing evidence may be invalidated — therefore, semver + migration script obligation on schema changes must be stated in the template-level CLAUDE.md.

Question back to architect: whether to include Layer 5 Evidence Graph in Phase A or defer to Phase B is an important security decision. Including it in MVP risks premature schema ossification.

---

**[auditor]**: (Round 1)

The three-way discussion has clarified scope and risks considerably.

Agreeing with architect's "skip Phase A" proposal, with one condition: include `PROMOTION_CHECKLIST.md` in `templates/co-safety/`, reinterpreting Phase A/B as maturity checklists internal to the variant. `Projects/safety-os/` is an "actual customer instance," while the template is the mold that stamps out that instance.

Audit checklist items required when creating co-safety:
1. `bun run agent:verify` — confirms new agent files (SGM, SWM, compliance-agent, etc.) are registered in AGENTS.md
2. `validate-templates.ts` P-01 parity check — CLAUDE.md ↔ GEMINI.md parity, templates/co-safety/CLAUDE.md propagation
3. `bun scripts/skill-lifecycle-audit.ts` — confirms 4 new SKILL.md files are registered in AGENTS.md §Skills

On security-expert's Evidence Graph timing question: from an audit perspective, recommend placing only schema skeleton in `evidence-models/base/` with actual evidence collection activation deferred to Phase B. Schemas exist but agents do not write to them.

To scaffolding-expert: the timing of tag-template.ts execution after `templates/co-safety/` creation must be clearly defined. It must come only after the full audit chain passes.

---

### Round 2

**[architect]**: (Round 2)

Incorporating auditor and security-expert feedback, concrete execution steps:

**S-00: Pre-investigation (30 min)**
- Review the most complex existing variant (co-work or co-develop) templates/ structure as reference
- Confirm current `templates/common/` version + `common-contract.json`
- Understand what checks `validate-templates.ts` performs

**S-01: templates/co-safety/ skeleton creation (scaffolding-expert)**
- Common inherited files: CLAUDE.md, GEMINI.md, AGENTS.md, CHANGELOG.md, .claude/settings.json
- Safety OS exclusive folder skeletons: agents/(7 files), skills/(4 files), workflows/_template/, regulations/KR/, evidence-models/base/, industry-profiles/, docs/blueprint/
- _ORIGIN.md, _COMMON_VERSION.md, PROMOTION_CHECKLIST.md

**S-02: Agent file authoring (architect + docs-writer)**
- pm.md (CSO override added), SGM, SWM, compliance-agent, risk-assessment-agent, emergency-agent, audit-agent
- 3-Section structure (A: Role, B: Claude Code, C: Antigravity) strictly followed

**S-03: Skill file authoring (docs-writer)**
- 4 SKILL.md files

**S-04: Workflow template + 6 manufacturing workflows (docs-writer)**

**S-05: Validation (auditor)**
- validate-templates.ts, agent:verify, skill-lifecycle-audit.ts

Agreement with security-expert: Evidence Graph skeleton placed in evidence-models/base/ as schema files only, "agent write forbidden until Phase B activation" stated in CLAUDE.md.

---

**[scaffolding-expert]**: (Round 2)

Architect's S-00 through S-05 sequence is executable. One additional note for S-01.

The current `validate-templates.ts` P-01 check verifies that all variant CLAUDE.md files are synchronized with workspace root CLAUDE.md. co-safety must add Safety OS-exclusive sections (like `§ Safety OS Context`), which could be flagged as "mismatch" by P-01.

Must verify how existing variants handle this — likely a `# variant-specific` marker or allowed zone exists. **Must confirm this pattern in S-00.**

Also, must verify how new-project.sh receives variant names. If there is an existing enum supporting co-design, co-work, etc., adding co-safety there is also within S-01 scope.

From a resource perspective, S-01 through S-04 have parallelizable portions:
- S-02 (agents) and S-03 (skills) are independent and can run in parallel
- S-04 (workflows) starts after workflow template (S-01 output) is complete

---

**[security-expert]**: (Round 2)

One emphasis on architect's confirmed plan.

Safety OS's biggest differentiator is the **mandatory `legal_basis` field**. safety-audit.ts is designed to perform `legal_basis missing check` for exactly this reason. This auditing logic must be stated in co-safety variant's CLAUDE.md lifecycle rules.

Specifically, analogous to the Lifecycle Management Rules table in workspace root CLAUDE.md, propose adding the following to co-safety/CLAUDE.md:

```
| workflows/**/*.md modified | Verify legal_basis field existence (safety-audit.ts) |
| agents/*.md modified       | Verify Section A contains legal basis section         |
```

This is not merely a documentation rule — it is the core quality gate of this variant. If omitted, the variant's raison d'être is undermined.

---

**[auditor]**: (Synthesis)

Synthesizing the four-way discussion.

**Points of Agreement:**

1. **Skip Phase A** — Do not use `Projects/safety-os/` as Phase A prototype. Define `templates/co-safety/` directly as SSOT. `Projects/safety-os/` is reinterpreted as the actual instance location generated by new-project.sh.

2. **Evidence Graph handling** — Include evidence-models/base/ schema skeleton in template, but state "agent write forbidden until Phase B activation" in CLAUDE.md.

3. **Regulation Registry principle** — Store only metadata (law number, article reference) in .yaml files, prohibit full statutory text. Disclaimer on legal interpretation responsibility stated in CLAUDE.md.

4. **legal_basis field mandatory** — Include safety-audit.ts execution in co-safety CLAUDE.md lifecycle rules.

5. **Parallel dispatch** — S-02 (agents) and S-03 (skills) can run in parallel.

**Open Questions:**

- Pattern for allowing co-safety-exclusive sections in validate-templates.ts P-01 check — must be confirmed in S-00 pre-investigation.
- Method and scope of adding `co-safety` to new-project.sh variant enum.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | S-00 pre-investigation: existing variant structure + P-01 pattern + new-project.sh enum gap report | S-00 |
| A-02 | scaffolding-expert | Medium | `templates/co-safety/` skeleton creation (common inheritance + Safety OS exclusive folder skeleton) | S-01 |
| A-03 | architect + docs-writer | Medium | 7 agent .md files (3-Section structure: Role/Claude Code/Antigravity) | S-02 |
| A-04 | docs-writer | Medium | 4 SKILL.md + workflow _template/ + 6 manufacturing workflows | S-03~S-04 |
| A-05 | security-expert | Medium | co-safety/CLAUDE.md safety-specific lifecycle rules section draft | S-01 |
| A-06 | auditor | Medium | Full validation pass: validate-templates.ts + agent:verify + skill-lifecycle-audit.ts | S-05 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | validate-templates.ts passes P-01 parity check | bun scripts/validate-templates.ts |
| C-02 | All 7 agents registered in AGENTS.md | bun run agent:verify |
| C-03 | All 4 SKILL.md registered in AGENTS.md §Skills | bun scripts/skill-lifecycle-audit.ts |
| C-04 | safety-audit.ts legal_basis check passes | bun scripts/safety-audit.ts (to be created) |
| C-05 | evidence-models schema files present, no agent write references active | Manual review |
