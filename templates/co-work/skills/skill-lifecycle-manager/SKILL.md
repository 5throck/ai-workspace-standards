---
name: skill-lifecycle-manager
description: >
  Guides the PM through creating, modifying, validating, and deprecating skills in the
  co-security variant. Ensures skills follow the required frontmatter schema and are
  registered in AGENTS.md § Skills.
version: 1.0.0
status: active
owner: pm
prerequisites: none
---

# 🔄 Skill: skill-lifecycle-manager

## Context

Use when adding a new domain skill (e.g., a cloud-recon or malware-analysis skill) or
deprecating an existing one.

## Execution Steps

### Creating a Skill

1. Create `skills/<name>/SKILL.md` with required frontmatter:
   ```yaml
   ---
   name: <name>
   description: >
     <multi-line description — what this skill does and when to invoke it>
   version: 1.0.0
   status: active
   owner: <agent-name>
   prerequisites: <what must exist before this skill can run>
   ---
   ```
2. Add sections: `## Context`, `## Execution Steps`, `## Output Format`, `## Related Skills`.
3. Update `AGENTS.md § Skills` — add row to Skills table with trigger condition.
4. Update `docs/co-security.context.md § Skills` — add row.

### Deprecating a Skill

1. Change `status: active` → `status: deprecated` in the skill's frontmatter.
2. In `AGENTS.md § Skills`, add `(deprecated)` to the skill name.
3. Update any skills that reference this one in their `## Related Skills` section.

### Validation

After any change:
- [ ] All skills referenced in `AGENTS.md` have a corresponding `SKILL.md` file
- [ ] All `SKILL.md` files have valid frontmatter (name, description, version, status, owner)
