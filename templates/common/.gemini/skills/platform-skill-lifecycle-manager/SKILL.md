---
name: platform-skill-lifecycle-manager
status: active
version: 1.0.0
description: >
  Manages the creation, versioning, and propagation of platform skills
  in .claude/skills/ and .gemini/skills/ directories. Use when: creating new platform skills,
  updating platform skill versions, or ensuring propagation to templates/common/.
owner: pm
last_reviewed: 2026-05-31
metadata:
  type: process
  triggers:
    - create platform skill
    - new .claude skill
    - new .gemini skill
    - platform skill version
    - platform skill lifecycle
    - update platform skill
---

# Platform Skill Lifecycle Manager

## When to Use

Use this skill when:
- Creating a new skill in `.claude/skills/` or `.gemini/skills/`
- Updating an existing platform skill's version
- Ensuring a platform skill is propagated to `templates/common/`

## Creation Checklist

1. **Initialize version**: Add `version: 1.0.0` to frontmatter
2. **Dual platform**: Create in BOTH `.claude/skills/<name>/SKILL.md` AND `.gemini/skills/<name>/SKILL.md`
3. **Propagate to common**: Copy to `templates/common/.claude/skills/` AND `templates/common/.gemini/skills/`
4. **Register in AGENTS.md**: Add row to `## Skills` table
5. **Register in common-contract.json**: Add entry to `common_platform_skills` section
6. **Run verification**: `bun scripts/verify-platform-lifecycle.ts` must pass Check E, F, H

## Verification

```bash
bun scripts/verify-platform-lifecycle.ts
```
