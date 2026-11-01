# Skills Index — co-design

This directory contains variant-specific skills for the `co-design` template.

## Available Skills

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `accessibility-audit` | 1.1.0 | active | pm | 2026-09-06 | — | Automated WCAG 2.1 AA accessibility evaluation using axe-core |
| `design-foundation` | 1.2.0 | active | architect | 2026-11-02 | — | Style-neutral procedure for deriving a project's own design system: domain evidence → principles → decision record → 3-layer token architecture (`[data-theme]` theming) → components → validation contract. L3-ahead canonical restructured to the workspace skill battery at L2 (2026-11-01-hub-consolidation follow-up wave); L3 origin `Projects/co-design` v1.2.0 |
| `design-review` | 1.1.0 | active | pm | 2026-11-02 | — | Three-lens review of an IMPLEMENTED UI (conformance, interaction affordance, journey) plus an all-agent critique panel with an evidence-based issue log and a gated remediation loop. L3-ahead canonical conformed at L2 (`## Context` added from the L3 Purpose; 2026-11-01-hub-consolidation follow-up wave); L3 origin `Projects/co-design` v1.1.0 |
| `service-design` | 1.1.0 | active | pm | 2026-09-27 | — | Migrated to SSOT from `.claude/skills/`-only (no prior `skills/` entry) during a full skill-lifecycle audit |
| `token-usage-lint` | 1.1.1 | active | pm | 2026-10-08 | — | co-design fork of the root skill (variant-maintained) — binds the lint to the co-design playground SSOT contract, visual-designer palette ownership, and concrete hex examples the generic root copy generalizes away |
| `ui-ux-design-intelligence` | 1.0.2 | active | pm | 2026-10-08 | — | co-design fork of the root skill (variant-maintained) — adds the `service-design` follow relation for the co-design process chain |

All other skills are inherited from `templates/common/skills/`. See the shared skills index for available platform-neutral skills.

## Adding Variant-Specific Skills

To add a co-design-specific skill:
1. Create a subdirectory: `templates/co-design/skills/<skill-name>/`
2. Add a `SKILL.md` with required frontmatter (`name`, `version`, `last_reviewed`)
3. Register the skill in this SKILLS.md and in `templates/co-design/variant.json skills[]`
4. Run `bun scripts/audit.ts` to verify compliance
