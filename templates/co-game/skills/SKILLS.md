# Skills Index — co-game

This directory contains variant-specific skills for the `co-game` template.

## Available Skills

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `arcade-physics` | 1.0.0 | active | pm | 2026-08-25 | — | Minimal Arcade-class physics on the ECS core: MovementSystem integration, gravity/damping, AABB collision response (backlog Low row) |
| `code-review` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `refactoring` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `test-driven-development` | 1.0.0 | active | pm | 2026-07-19 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `sound-synth` | 1.0.0 | active | sound-designer | 2026-08-06 | — | Web Audio API / jsfxr procedural 8-bit retro sound effect generation rules |


All other skills are inherited from `templates/common/skills/`. See the shared skills index for available platform-neutral skills.

## Adding Variant-Specific Skills

To add a co-game-specific skill:
1. Create a subdirectory: `templates/co-game/skills/<skill-name>/`
2. Add a `SKILL.md` with required frontmatter (`name`, `version`, `last_reviewed`)
3. Register the skill in this SKILLS.md and in `templates/co-game/variant.json skills[]`
4. Run `bun scripts/validate-templates.ts` to verify compliance
