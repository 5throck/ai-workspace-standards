---
name: skill-lifecycle-manager
status: active
scope: common
description: >
  Manages the creation, validation, and maintenance of skill files across the project.
  Use when: creating new skills, updating skill metadata, validating skill structure,
  managing skill-agent mappings, triaging agent skill requests, or deprecating/removing skills.
owner: pm
version: 1.5.0
last_reviewed: 2026-09-21
relates_to:
  - skill: script-lifecycle-manager
    type: composes_with
metadata:
  type: process
  triggers:
    - create skill
    - new skill
    - validate skills
    - skill lifecycle
    - manage skills
    - skill request
    - deprecate skill
    - remove skill
---

## Overview

This skill provides a systematic approach to creating, validating, and maintaining skill files. It ensures all skills follow proper structure, have correct frontmatter, and are properly documented in AGENTS.md and docs/context.md. (`docs/context.md` — like the other `docs/...` paths this skill mentions — exists inside a generated variant project, not at workspace root.)

## When to Use This Skill

**Create New Skill:**
- Trigger: "Create a skill for X capability" or "Add skill to do Y"
- Use Case: New workflow capability needed that doesn't fit in agent role definition

**Validate Existing Skills:**
- Trigger: "Check if skills are valid" or "Validate skill structure"
- Use Case: After modifying skills, before committing changes

**Update Skill Metadata:**
- Trigger: "Update skill triggers" or "Modify skill frontmatter"
- Use Case: Improving skill discoverability or updating descriptions

**Triage Agent Skill Requests (PM only):**
- Trigger: Pending skill request blocks in `memory/YYYY-MM-DD.md` logs
- Use Case: An agent requested a skill create/attach/remove; PM reviews and approves or rejects

**Deprecate or Remove a Skill:**
- Trigger: "Deprecate skill X" or "Remove skill Y", or an approved `remove` request
- Use Case: A skill is obsolete, superseded, or its owner agent was fired

---

## Step 1: Create New Skill Structure

**Purpose**: Create proper directory structure for a new skill.

**Steps**:
1. Choose the correct ownership layer:
   - **L0** (`skills/`): Workspace SSOT — all skill development happens here.
   - **L1** (`templates/common/skills/`): Template snapshot — published from L0 via `bun run propagate:apply`.
   - **L3** (`<project>/skills/`): Project snapshot created from L1 at `new-project` time.
   - Never edit L1 directly; edit L0 and publish.
2. Create skill directory: `mkdir -p skills/<skill-name>/`
3. Create SKILL.md file: `touch skills/<skill-name>/SKILL.md`
4. After editing, run `bun scripts/sync-skills.ts` to distribute to `.claude/skills/` and `.gemini/skills/`.
5. Check if `templates/common/` exists to confirm you are in the L0 workspace. If it does not exist, you are in an L3 project and must skip this step. If it does exist, propagate to the L1 template by running `bun run propagate:apply`.

**Validation**:
- Directory name should use kebab-case (lowercase with hyphens)
- SKILL.md must be exactly that name (uppercase)
- No nested subdirectories within skill directory

---

## Step 2: Write Skill Frontmatter

**Purpose**: Define skill metadata with proper YAML frontmatter.

**Required Frontmatter Structure**:

```yaml
---
name: skill-name
status: active
description: >
  Brief description of what this skill does and when to use it.
  Use when: [specific trigger scenarios]
owner: pm
version: 1.0.0
metadata:
  type: process | implementation | domain
  triggers:
    - keyword1
    - keyword2
    - keyword3
---
```

**Field Definitions**:
- `name`: kebab-case skill identifier (must match directory name)
- `description`: Clear explanation of skill purpose + trigger conditions
- `version`: Semantic version (start at 1.0.0)
- `metadata.type`: One of:
  - `process`: Workflow and methodology skills
  - `implementation`: Technical implementation skills
  - `domain`: Domain-specific knowledge skills
- `metadata.triggers`: List of keywords that should activate this skill

**Validation**:
- All required fields must be present
- `name` must match directory name
- `type` must be one of the three valid values
- `triggers` must be a list with at least one item

---

## Step 3: Write Skill Content

**Purpose**: Document the skill's workflow, steps, and expected outputs.

**Required Sections**:

1. **Overview**: High-level explanation of skill purpose
2. **When to Use This Skill**: Trigger conditions and use cases
3. **Steps**: Numbered workflow steps (grouped by logical phases)
4. **Expected Outputs**: What the skill produces
5. **Examples** (optional): Concrete usage examples

**Content Guidelines**:
- Use imperative mood ("Create X", not "Creates X")
- Include validation checks at each step
- Specify expected outputs clearly
- Add examples for complex skills

---

## Step 4: Update Documentation

**Purpose**: Register skill in project documentation.

**Files to Update**:

1. **AGENTS.md** (if applicable):
   - Add to Skills table
   - Include file path and trigger condition

2. **docs/context.md**:
   - Add to Skills section
   - Include skill name, type, and brief description

3. **skills/SKILLS.md**:
   - Update the skill registry row (version, status, owner, last_reviewed)
   - Ensure skill is discoverable

**Validation**:
- Skill appears in all relevant documentation
- File paths are correct
- Trigger conditions match frontmatter

---

## Step 5: Validate Skill

**Purpose**: Ensure skill follows all conventions and is properly structured.

**Validation Checklist**:
- [ ] Directory exists with correct name (kebab-case)
- [ ] SKILL.md file exists (exact name)
- [ ] Frontmatter has all required fields
- [ ] `name` matches directory name
- [ ] `type` is one of: process, implementation, domain
- [ ] `triggers` list has at least one item
- [ ] Content has Overview and When to Use sections
- [ ] Documentation updated (AGENTS.md, docs/context.md)
- [ ] No duplicate skill names exist
- [ ] **If education/tutoring/explanation purpose**: skill content includes the Socratic Method procedure — questions before answers, progressive hints, learner-discovery approach; with explicit exceptions for urgent or reference-lookup contexts

**Run Validation Script** (if available):
```bash
bun run verify-skills
```

---

## Step 6: Test Skill Activation

**Purpose**: Verify skill can be activated and functions correctly.

**Test Steps**:
1. Try activating skill via Claude Code: `Skill tool with skill name`
2. Verify frontmatter loads correctly
3. Check that content is readable and actionable
4. Test with sample trigger scenario

**Success Criteria**:
- Skill loads without errors
- Content is complete and actionable
- Triggers match expected use cases

---

## Skill Request Workflow (Agent-Initiated, PM-Approved)

Skill additions and removals are **bottom-up**: each agent judges its own needs and requests changes through PM. PM approval is mandatory before any skill work proceeds — agents never create, attach, or remove skills unilaterally.

### Step R1: Agent Submits Request

An agent that identifies a skill need or an unnecessary skill records a structured request block in its task report **and** in the active `memory/YYYY-MM-DD.md` session log:

```
## Skill Request
- requester: <agent-name>
- type: create | attach | remove
- target_skill: <skill-name> (or proposed name for `create`)
- justification: <what keeps failing / what is unused, with concrete evidence>
- evidence_refs: <session dates, file paths, or log lines backing the justification>
- impact: <which workflows, phases, or agents are affected>
```

A request without `evidence_refs` is incomplete and PM bounces it back at triage.
Evidence expectations by type:
- `create` — repeated task failures or accumulated manual work that no existing skill covers; name the occurrences
- `attach` — the agent performs work owned by a skill whose `owner:` does not include it
- `remove` — skill unused over an extended period, superseded by another skill, or detached from all workflows

### Step R2: PM Triage

PM reviews pending request blocks at the next orchestration cycle or at Phase 5 finalization:

| Check | Question |
|-------|----------|
| Evidence | Is the justification concrete and verifiable from session logs? |
| Duplication | Does an existing skill already cover the need (check `skills/*/SKILL.md` and `metadata.triggers`)? |
| Roster impact | Does the change overlap another agent's role or break an existing `owner:` mapping? |
| Layer | Is this an L0 workspace skill or should it live project-local (L3)? |

### Step R3: Approval or Rejection

**On approval** (PM):
1. Emit a Gate-Moment Decision Record at `docs/decisions/DEC-YYYYMMDD-NN.md` (ADR-0061) before dispatch continues. The record must carry the ADR-0061 required frontmatter fields (`id, date, agent, decision, alternatives, status`) with `evidence_refs` pointing at the request block; validate it with `bun scripts/validate-decisions.ts`
2. Dispatch automation-engineer to execute the change via Steps 1–6 above (`create`), the attach rules in `agent-lifecycle-manager` (`attach`), or the Deprecation & Removal section below (`remove`)
3. Complete the Registry Lockstep Checklist (next section) for every surface the change touches
4. Run validation (`bun run verify-skills`, relevant lifecycle audits)

**On rejection** (PM):
1. Record the rationale in the same `memory/YYYY-MM-DD.md` log next to the request
2. Relay the rejection rationale to the requesting agent at its next dispatch

---

## Registry Lockstep Checklist

Every skill create/modify/deprecate/remove must leave ALL of the following surfaces
consistent before the work is done. The lifecycle audits and the VERSION_MANIFEST
gate fail the sync when any of these drift — treat this checklist as the definition
of done, not as a post-fix list.

| # | Surface | Action |
|---|---------|--------|
| 1 | `skills/<name>/SKILL.md` frontmatter | `version` bump per §6.6 rules (any content change ≥ patch), `last_reviewed`, `status`, `superseded_by` (deprecations) |
| 2 | `skills/SKILLS.md` | Row added/updated: version, status, owner, last_reviewed, removal-date (deprecated skills) |
| 3 | `docs/lifecycle/skills/<name>.md` | Create on first registration; update Version + Phase History/Changelog with symptom-and-evidence citations |
| 4 | `docs/VERSION_MANIFEST.md` | Regenerate: `bun scripts/generate-version-manifest.ts` (gate fails on stale) |
| 5 | `docs/skill-graph.json` / `.md` | Regenerate: `bun scripts/generate-skill-graph.ts` |
| 6 | Platform mirrors (4) | `bun scripts/sync-skills.ts` distributes to `.claude/`, `.gemini/`, `.agents/`, `.codex/` |
| 7 | L1 template | `bun run propagate:apply` (L0 is the SSOT — never edit `templates/common/skills/` directly) |
| 8 | Validators | `bun run verify-skills`, `bun scripts/skill-lifecycle-audit.ts`, `bun scripts/lifecycle-sync-audit.ts` all pass |

---

## Skill Deprecation & Removal

Skills follow a two-stage exit: **deprecate** first, **remove** only when retirement is confirmed. Removal executes only through PM approval — either an approved `remove` request (Step R3) or the skill-transfer plan inside a Firing Workflow decision (`agent-lifecycle-manager`).

### Deprecate (default)

1. Set `status: deprecated` in the skill frontmatter (keep the directory in place)
2. Record the successor: add `superseded_by: <skill-name>` to the frontmatter (or `superseded_by: none` when truly terminal) — the reference-integrity audit uses this to route references to the replacement
3. Bump the frontmatter `version` (deprecation is a content change, not bookkeeping) and set a `removal-date` comment in the SKILLS.md row (default: deprecation + 30 days per lifecycle standards §6.6)
4. Reassign responsibility: update `owner:` to the surviving agent, or leave a comment pointing to the replacement skill
5. Strip stale `metadata.triggers` so the skill stops auto-activating
6. Update `skills/SKILLS.md` registry row (status, version, owner, last_reviewed, removal-date)
7. Note the deprecation rationale in the governance record (`docs/lifecycle/skills/<name>.md`) and the session memory log
8. Complete the Registry Lockstep Checklist

Deprecation is reversible; keep the folder until the removal review confirms nothing references it. An expired `removal-date` on a still-present skill FAILS `skill-lifecycle-audit.ts` — the removal review must run before the date passes.

### Remove (explicit approval only)

Run only after deprecation or with explicit user/PM approval:

1. Verify no live references — the reference-integrity check in `bun scripts/skill-lifecycle-audit.ts` FAILS while any SKILL.md still cites the name; additionally grep `agents/*.md`, `AGENTS.md`, `skills/SKILLS.md`, procedures, other skills' `relates_to`, and `memory/` session logs
2. Delete the skill directory `skills/<skill-name>/`
3. Update registries: remove rows from `skills/SKILLS.md`, `AGENTS.md` (if listed), and `docs/context.md` in generated projects; retire the lifecycle record (set Current Phase to `retired` with the removal date — records are preserved, never deleted)
4. Sync platform mirrors: `bun scripts/sync-skills.ts` (removes stale copies from all four of `.claude/`, `.gemini/`, `.agents/`, `.codex/`)
5. Publish the deletion to the L1 template: `bun run propagate:apply` (L0 is the SSOT — never edit `templates/common/skills/` directly)
6. Regenerate derived artifacts: `generate-version-manifest.ts` + `generate-skill-graph.ts`
7. Run `bun run verify-skills` and record the removal in the session memory log

**Validation**:
- [ ] No dangling references to the removed skill anywhere in the workspace (reference-integrity check passes)
- [ ] `.claude/`, `.gemini/`, `.agents/`, `.codex/` skill mirrors no longer contain the skill
- [ ] `templates/common/skills/` reflects the removal after propagation
- [ ] Lifecycle record preserved with `retired` phase and removal date
- [ ] Deprecation path used `status: deprecated` + `superseded_by` and preserved the rationale

---

## Whole-Skill Revision Principle

When executing an approved revision from the session-evidence review loop
(`memory/skill-review/`, see the skill-lifecycle standards §6.6
Session-Evidence Skill Review Loop and
`docs/designs/2026-09-06-skill-session-review-design.md`), treat the skill as a
**whole folder** —
one approved change may update SKILL.md prose, add/fix `scripts/`, and extend
`references/` together. Prompt-only revisions cannot fix failures that live in
helper scripts (SkillHone finding). Requirements per revision:

- Reference the observed symptom and its evidence (sessions/occurrences) in
  the governance record Changelog entry
- Follow the skill version bump rules (lifecycle standards §6.6)
- Dependency revalidation happens automatically at the next `/sync` (step 3.96c)

## Expected Outputs

**For New Skill Creation**:
- Properly structured skill directory
- Complete SKILL.md with valid frontmatter
- Updated documentation (AGENTS.md, docs/context.md)
- Validation confirmation

**For Skill Validation**:
- Pass/fail status for each validation check
- List of any issues found
- Suggestions for fixing problems

---

## Common Mistakes to Avoid

❌ **Don't**:
- Create skills that duplicate agent roles
- Use vague or generic trigger keywords
- Skip updating documentation
- Mix skill types incorrectly
- Create deeply nested skill directories

✅ **Do**:
- Focus skills on specific capabilities
- Use clear, specific trigger keywords
- Always update documentation after creating skills
- Choose appropriate skill type
- Keep skill structure flat (one level deep)

---

## Examples

**Example 1: Process Skill**
```yaml
---
name: debugging-workflow
status: active
description: Use when troubleshooting code issues, investigating bugs, or diagnosing errors
metadata:
  type: process
  triggers:
    - debug
    - troubleshoot
    - investigate error
---
```

**Example 2: Implementation Skill**
```yaml
---
name: frontend-design
status: active
description: Use when implementing user interfaces, creating visual designs, or building UI components
metadata:
  type: implementation
  triggers:
    - design ui
    - create interface
    - build component
---
```

**Example 3: Domain Skill**
```yaml
---
name: api-integration
status: active
description: Use when integrating with external APIs, handling authentication, or managing API clients
metadata:
  type: domain
  triggers:
    - api integration
    - external service
    - authentication
---
```

---

## Related Skills

- **validate-templates**: Validates template structure (related validation skill)
- **agent-lifecycle-manager**: Manages agent creation, validation, and PM-led hiring/firing (parallel workflow; its Firing Workflow is a valid source of approved skill removals)
- **team-builder**: Whole-team restructuring with bulk skill transfer plans (superset of this skill's per-skill operations)
