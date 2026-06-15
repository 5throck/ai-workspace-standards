# Skills Index — co-work

This directory contains variant-specific skills for the `co-work` template.

## Available Skills

No variant-specific skills are currently defined for co-work.

All skills are inherited from `templates/common/skills/`. See the shared skills index for available platform-neutral skills.

## Adding Variant-Specific Skills

To add a co-work-specific skill:
1. Create a subdirectory: `templates/co-work/skills/<skill-name>/`
2. Add a `SKILL.md` with required frontmatter (`name`, `version`, `last_reviewed`)
3. Register the skill in this SKILLS.md and in `templates/co-work/variant.json skills[]`
4. Run `bun scripts/validate-templates.ts` to verify compliance
