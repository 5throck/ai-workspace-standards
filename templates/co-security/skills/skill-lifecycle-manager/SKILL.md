---
name: skill-lifecycle-manager
status: active
scope: common
description: >
  Manages the creation, validation, and maintenance of skill files across the project.
  Use when: creating new skills, updating skill metadata, validating skill structure,
  or managing skill-agent mappings.
owner: pm
version: 1.2.0
last_reviewed: 2026-05-30
metadata:
  type: process
  triggers:
    - create skill
    - new skill
    - validate skills
    - skill lifecycle
    - manage skills
---

## Overview

This skill provides a systematic approach to creating, validating, and maintaining skill files. It ensures all skills follow proper structure, have correct frontmatter, and are properly documented in AGENTS.md and docs/context.md.

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

---

## Step 1: Create New Skill Structure

**Purpose**: Create proper directory structure for a new skill.

**Steps**:
1. Choose the correct ownership layer:
   - **L0** (`skills/`): Workspace SSOT — all skill development happens here.
   - **L1** (`templates/common/skills/`): Template snapshot — published from L0 via `bun scripts/publish-to-template.ts`.
   - **L2** (`<project>/skills/`): Project snapshot created from L1 at `new-project` time.
   - Never edit L1 directly; edit L0 and publish.
2. Create skill directory: `mkdir -p skills/<skill-name>/`
3. Create SKILL.md file: `touch skills/<skill-name>/SKILL.md`
4. After editing, run `bun scripts/sync-skills.ts` to distribute to `.claude/skills/` and `.gemini/skills/`.
5. Check if `templates/common/` exists to confirm you are in the L0 workspace. If it does not exist, you are in an L2 project and must skip this step. If it does exist, propagate to the L1 template by running `bun scripts/publish-to-template.ts`.

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

3. **skills/README.md**:
   - Update available skills list
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
- **agent-lifecycle-manager**: Manages agent creation and validation (parallel workflow)
