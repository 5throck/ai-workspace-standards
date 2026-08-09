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

When creating a new platform skill (`SKILL.md`):

1. **Initialize version**: Add `version: 1.0.0` to frontmatter
2. **Dual platform**: Create in BOTH `.claude/skills/<name>/SKILL.md` AND `.gemini/skills/<name>/SKILL.md`
3. **Propagate to common**: Copy to `templates/common/.claude/skills/<name>/SKILL.md` AND `templates/common/.gemini/skills/<name>/SKILL.md`
4. **Register in AGENTS.md**: Add row to `## Skills` table
5. **Register in common-contract.json**: Add entry to `common_platform_skills` section
6. **Run verification**: `bun scripts/verify-platform-lifecycle.ts` must pass Check E, F, H

## Version Bump Rules

| Change Type | Version Bump |
|-------------|-------------|
| New skill created | Initialize `version: 1.0.0` |
| Trigger or description update | patch (1.0.0 → 1.0.1) |
| New procedures or sections added | minor (1.0.0 → 1.1.0) |
| Fundamental role change | major (1.0.0 → 2.0.0) |

When bumping version: update ALL 4 files (`.claude/skills/`, `.gemini/skills/`, both `templates/common/` copies).

## Propagation Rule

Every platform skill must exist in 4 locations:
```
.claude/skills/<name>/SKILL.md
.gemini/skills/<name>/SKILL.md
templates/common/.claude/skills/<name>/SKILL.md
templates/common/.gemini/skills/<name>/SKILL.md
```

`verify-platform-lifecycle.ts` Check H verifies propagation.

## Verification

```bash
bun scripts/verify-platform-lifecycle.ts
```
