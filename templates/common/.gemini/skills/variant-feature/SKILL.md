---
name: variant-feature
description: "Add features to an existing variant template. Use when: extending a variant with new agents, skills, scripts, or documentation."
version: "1.0.0"
status: active
scope: workspace
owner: scaffolding-expert
triggers:
  - add feature to variant
  - extend variant
  - variant feature
  - add agent to variant
  - add skill to variant
---

# Variant Feature

Guides addition of new features (agents, skills, scripts, docs) to an existing variant template.

## When to Use

- A variant needs a new domain-specific agent
- A new skill should be added to a variant
- Variant-specific scripts need to be created
- Documentation structure needs extension

## Script

**Script**: `scripts/variant-feature.ts`
**Usage**: `bun scripts/variant-feature.ts`

This is a guided CLI that prompts for:
- Target variant name
- Feature type (agent, skill, script, doc)
- Feature name and description

## What It Generates

| Feature Type | Generated Stubs |
|-------------|----------------|
| **Agent** | `agents/<name>.md` with frontmatter skeleton, Role, Responsibilities, Collaboration sections |
| **Skill** | `.claude/skills/<name>/SKILL.md` with frontmatter, description, triggers |
| **Script** | `scripts/co-<variant>/<name>.ts` with version header and bun imports |
| **Doc** | `docs/<name>.md` with heading skeleton |

## Step-by-Step Procedure

1. **Identify target variant**: `ls templates/co-*/variant.json`
2. **Run CLI**: `bun scripts/variant-feature.ts`
3. **Follow guided prompts**: Select variant, feature type, name, description
4. **Customize generated stubs**: Fill in agent responsibilities, skill triggers, script logic
5. **Update variant.json**: Add new agent/skill/script to manifest
6. **Validate**: `bun scripts/validate-templates.ts`
7. **Update platform parity**: If adding a skill, ensure `.gemini/skills/` mirrors `.claude/skills/`

## After Adding Features

- Update `variant.json` `agents[]`, `skills[]`, or `script_manifest.local[]`
- Run validation: `bun scripts/validate-templates.ts`
- For skills: verify `.claude/skills/` and `.gemini/skills/` parity
- For agents: update `AGENTS.md` roster table if the variant has one

## See Also

- [Variant Creation Skill](skills/create-variant/SKILL.md)
- [Variant Promotion Skill](skills/promote-variant/SKILL.md)
- [Agent Lifecycle Manager](skills/agent-lifecycle-manager/SKILL.md)
- [Skill Lifecycle Manager](skills/skill-lifecycle-manager/SKILL.md)
