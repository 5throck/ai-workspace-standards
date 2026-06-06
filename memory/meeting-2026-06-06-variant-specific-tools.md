# Meeting Transcript
**Date**: 2026-06-06
**Topic**: Improving distribution of variant-specific skills and scripts
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
Agenda: The user pointed out that looking at each variant (`co-consult`, `co-design`, `co-develop`, `co-security`, `co-work`), it seems variant-specific skills and scripts are scattered or lacking clear organization. To improve this, please discuss individually what dedicated skills and scripts are needed for each variant and how they should be managed. Architect, please propose an architectural improvement plan considering the characteristics of each variant.

**[architect]**: (Round 1)
PM, thank you. According to our L1-L2 Fork Model (ADR-0031), while common skills and scripts are distributed from the `common` template (L1), specialized tools tailored to the purpose of each variant must be structurally separated and managed.
Let's first look at **`co-consult`** and **`co-design`**.
- `co-consult`: Since it's a template for business analysis and consulting, it needs dedicated market research scripts or analysis skills (e.g., `market-analysis-skill`).
- `co-design`: This is specialized for UI/UX. Skills like `ui-ux-pro-max` or scripts that synchronize design tokens should explicitly reside in the `skills/` and `scripts/` of this variant, rather than the common folder.
@automation-engineer, what is the most ideal way to technically separate these dedicated scripts from the common area for implementation and deployment?

**[automation-engineer]**: (Round 1)
@architect, good point. To ensure scripts don't mix technically, it's important to place dedicated tools in each variant directory (`templates/co-*/scripts/`, `templates/co-*/skills/`) and implement protection logic so that existing common deployment scripts don't overwrite them.
Next, let's look at **`co-develop`** and **`co-security`**.
- `co-develop`: Being development-centric, it requires TDD assistant scripts, code formatter automation scripts, PR generators, etc. Skills like `test-driven-development` should be exclusively allocated here.
- `co-security`: Since it must specialize in security audits, the `security-scan` skill and `.gitleaks` configuration automation scripts are essential.
@auditor, if unique skills and scripts are separated per variant like this, how should we conduct individual verification in terms of compliance and consistency audits (`qa-gate.ts`)?

**[auditor]**: (Round 1)
@automation-engineer, while acknowledging the specificities of each variant, audits must be conducted consistently. We should explicitly specify the 'list of dedicated skills and scripts' owned by each variant as metadata in its `variant.json`, and have `qa-gate.ts` read this to check for omissions.
Finally, let's examine **`co-work`**.
- `co-work`: This is for general collaboration and documentation. Here, it is appropriate to assign document verification skills like `validate-docs-links` and meeting minute automation scripts as dedicated tools.
@architect, do you agree with restructuring the template so that the existence and usage of these dedicated tools are also specified in the README or AGENTS.md of each variant?

**[architect]**: (Round 2)
@auditor, I completely agree. We must add a "Variant-Specific Skills & Scripts" section to the `README.md` of each variant so users clearly recognize what specialized tools are available to them.
In summary, architecturally, we should leave only universally shared tools like `lifecycle-manager` and `meeting-facilitation` in `common`, and refactor the structure to completely migrate domain-specific tools to their respective `co-*` folders. @automation-engineer, could you include the task of creating initial stubs for dedicated scripts per variant in the next implementation plan?

**[automation-engineer]**: (Round 2)
@architect, yes, that is possible. I will write a template update script that generates the stubs for skills and scripts tailored to each variant. Additionally, I will add path mapping logic so that the existing `publish-to-template.ts` can route and deploy specialized L0 scripts to the correct L2 variant. @auditor, if there are no further verification requirements, I think it's safe to proceed like this.

**[auditor]**: (Synthesis)
All agents have reached a consensus on the separation and management of dedicated skills/scripts for each variant.

1. **Points of Agreement**:
   - Only universal tools will remain in the `common` folder, while specialized skills and scripts tailored to each variant's purpose will be migrated/placed in dedicated folders within their respective `co-*` templates.
   - Variant-specific analysis:
     - `co-consult`: Business/market analysis skills and data aggregation scripts.
     - `co-design`: UI/UX skills (`ui-ux-pro-max`) and design token scripts.
     - `co-develop`: TDD assistant skills and code review scripts.
     - `co-security`: Vulnerability scanning (`security-scan`) and security hook scripts.
     - `co-work`: Document verification skills (`validate-docs-links`) and collaboration automation scripts.
   - Specify the list of dedicated tools in the `variant.json` metadata and `README.md` of each variant to increase visibility, and have `qa-gate.ts` verify them.

2. **Open Disagreements or Unresolved Questions**:
   - None.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Write directory structure and `README.md` template blueprints for placing variant-specific skills/scripts. | Both | Phase 1 |
| A-02 | automation-engineer | Low | Modify `publish-to-template.ts` mapping logic for correct routing of specialized scripts and implement stub generation scripts. | Both | Phase 4 |
| A-03 | auditor | Medium | Modify `qa-gate.ts` to add logic that individually verifies the integrity of specialized tools specified in `variant.json`. | Both | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Each variant has isolated skills/scripts | Directory structure review |
| 2 | variant.json includes tools metadata | Schema validation |
| 3 | qa-gate verifies specific tools per variant | Run qa-gate |
