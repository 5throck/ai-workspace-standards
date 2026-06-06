# Meeting Transcript
**Date**: 2026-06-06
**Topic**: Utilizing External References for Variant Skills and Agent Creation
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator)
Agenda: We need to discuss incorporating external references to enhance our variants and agent creation process. Specifically:
1. When creating a new agent, we should internally draft it first, and then supplement it using information from `https://github.com/msitarzewski/agency-agents`.
2. For the `co-design` variant, examine ways to utilize `https://github.com/voltagent/awesome-design-md`.
3. For the `co-develop` variant, examine ways to utilize `https://github.com/addyosmani/agent-skills`.
Please share your thoughts on how to architect and implement these integrations.

**[architect]**: (Round 1)
PM, thank you for outlining the agenda. These external resources provide excellent benchmarks.
For agent creation, I propose we modify the `team-builder` or agent creation workflow. The system should first generate a base `agent.md` draft based on our internal ADRs and CONSTITUTION.md, and then explicitly fetch and cross-reference `msitarzewski/agency-agents` to inject specialized prompt techniques, persona depth, or missing tools.
For **`co-design`**, `awesome-design-md` provides a curated collection of DESIGN.md analysis frameworks. We should introduce a `design-doc-generator` skill exclusive to `co-design` that references this repository to structure UI/UX specifications uniformly.
For **`co-develop`**, `addyosmani/agent-skills` contains production-grade engineering workflows (like TDD, refactoring, and code review). These should be imported as core native skills for `co-develop`. @automation-engineer, how can we automate the ingestion of these external skills and guidelines into our scaffolding without causing version drift?

**[automation-engineer]**: (Round 1)
@architect, those are powerful additions.
For the agent creation process, I can update the `scripts/agent-creator.ts` (or `team-builder.ts`) to include a "supplementation phase". It will draft the markdown locally, fetch the `agency-agents` repository via the GitHub API, parse relevant personas, and inject the missing behavioral guidelines before saving the final `agent.md`.
For **`co-design`**, I can create a setup script in `co-design/scripts/` that fetches the `awesome-design-md` templates and enforces that any new feature includes a `DESIGN.md` matching those high-quality structures.
For **`co-develop`**, we can clone or fetch the specific skill markdown files from `addyosmani/agent-skills` and convert them into our `SKILL.md` format inside `templates/co-develop/skills/`. @auditor, since we are pulling external workflows and prompts, what governance and security checks do we need to put in place?

**[auditor]**: (Round 1)
@automation-engineer, bringing in external content poses a governance risk if not properly audited.
For the agent creation, the "supplementation phase" must never override our strict Phase/Tier constraints from `workspace-schema.json`. The external `agency-agents` data should only enrich the persona and prompts, not the `tier` or `role` metadata.
For the external skills in **`co-develop`** and design templates in **`co-design`**, they cannot be dynamically fetched at runtime. They must be downloaded, converted, and statically committed to our repository as part of the L1->L2 sync. This ensures they pass the `bun scripts/skill-lifecycle-audit.ts` and `qa-gate.ts` checks.
@architect, do you agree that these external resources should be baked into our repository statically rather than fetched dynamically during normal agent operations?

**[architect]**: (Round 2)
@auditor, I absolutely agree. Statically committing them is necessary to preserve the L1-L2 Fork Model and ensure offline availability. They should be ingested during the template scaffolding phase or when an agent explicitly runs an update script, not dynamically at runtime. The `agent-creator` script will fetch the `agency-agents` data at creation time, which is perfectly fine since the output is a statically committed `agent.md` file. I am fully aligned with this architectural approach. @automation-engineer, please ensure the ingestion scripts format everything to match our `SKILL.md` frontmatter standards.

**[automation-engineer]**: (Round 2)
@architect, understood. I will build ingestion scripts (`scripts/ingest-external-skills.ts`) that map the external `agent-skills` into our YAML frontmatter format (assigning versions, owners, and triggers). For `co-design`, the `DESIGN.md` templates will be statically added to the `co-design` scaffolding folder. The `agent-creator.ts` will be updated to include the two-step drafting and supplementing process. Everything will be thoroughly validated.

**[auditor]**: (Synthesis)
We have a clear and secure path for integrating these external resources.

1. **Points of Agreement**:
   - **Agent Creation**: Modify the agent creation script to perform a two-step process: 1) internally draft the agent based on local standards, 2) fetch `msitarzewski/agency-agents` to supplement missing persona/workflow details, 3) statically save the result.
   - **`co-design`**: Statically import `awesome-design-md` structures to create a `DESIGN.md` generation skill/template, enforcing high-quality design specs.
   - **`co-develop`**: Statically ingest `addyosmani/agent-skills` into the `co-develop/skills/` directory, converting them to our `SKILL.md` frontmatter standard.
   - **Governance**: All external content must be statically committed to the repository (not fetched at runtime) to ensure it passes `qa-gate.ts` and `skill-lifecycle-audit.ts`.

2. **Open Disagreements or Unresolved Questions**:
   - None.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | architect | High | Design the mapping specification for converting external `agent-skills` and `awesome-design-md` into local variant formats. | Both | Phase 1 |
| A-02 | automation-engineer | Low | Update `agent-creator.ts` for the two-step drafting process using `agency-agents`. | Both | Phase 4 |
| A-03 | automation-engineer | Low | Create `ingest-external-skills.ts` to fetch, format, and statically commit `agent-skills` to `co-develop` and `awesome-design-md` to `co-design`. | Both | Phase 4 |
| A-04 | auditor | Medium | Update `qa-gate.ts` to ensure ingested external skills contain the correct frontmatter and comply with internal security policies. | Both | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Agent creation uses a 2-step draft & supplement process | Manual test of `agent-creator.ts` |
| 2 | `co-design` contains `DESIGN.md` templates | Directory structure review |
| 3 | `co-develop` skills match `addyosmani/agent-skills` | File inspection in `co-develop/skills/` |
