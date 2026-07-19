# Skills Index — co-work

This directory contains variant-specific skills for the `co-work` template.

## Available Skills

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `api-documentation` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `documentation-writing` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `research-analysis` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |

All other skills are inherited from `templates/common/skills/`. See the shared skills index for available platform-neutral skills.

## Adding Variant-Specific Skills

To add a co-work-specific skill:
1. Create a subdirectory: `templates/co-work/skills/<skill-name>/`
2. Add a `SKILL.md` with required frontmatter (`name`, `version`, `last_reviewed`)
3. Register the skill in this SKILLS.md and in `templates/co-work/variant.json skills[]`
4. Run `bun scripts/validate-templates.ts` to verify compliance
