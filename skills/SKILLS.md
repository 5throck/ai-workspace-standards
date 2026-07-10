# SKILLS.md — Skill Lifecycle Registry

> Single Source of Truth for all project skills in `skills/`.  
> Propagation control is via SKILL.md frontmatter (`l2_propagate`/`scope`) — not this file.  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads each skill's `SKILL.md` frontmatter directly.  
> **L0+L1+L2 skills** are variant-specific overrides living in `templates/co-*/skills/` — NOT published to `templates/common/skills/`.

---

## Registry

### Workspace Skills

Skills with a `skills/<name>/` directory in the workspace root. These are the primary skills available across all platforms.

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-30 | — | — |
| `audit-workspace` | 1.0.0 | active | auditor | 2026-05-30 | — | — |
| `create-variant` | 1.0.1 | active | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `meeting-facilitation` | 1.4.0 | active | pm | 2026-06-05 | — | — |
| `project-review` | 1.1.0 | active | pm | 2026-07-10 | — | — |
| `promote-variant` | 1.0.1 | active | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `script-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `security-scan` | 1.0.0 | active | security-expert | 2026-05-30 | — | — |
| `simulate-project-creation` | 1.0.0 | active | scaffolding-expert | 2026-05-30 | — | Workspace scaffolding test only |
| `skill-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `sync` | 1.1.0 | active | lifecycle-manager | 2026-07-10 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR |
| `team-builder` | 1.1.0 | active | pm | 2026-06-06 | — | — |
| `translate` | 1.0.0 | active | pm | 2026-06-06 | — | — |
| `validate-docs-links` | 1.0.0 | active | docs-writer | 2026-05-30 | — | — |

### Variant-Exclusive Skills

Skills registered in the catalog but without a `skills/<name>/` directory in the workspace root. These live exclusively inside variant templates (`templates/co-*/skills/`) and are only available when that variant is active.

| skill | version | status | owner | last_reviewed | removal-date | variant |
|-------|---------|--------|-------|---------------|--------------|---------|
| `change-impact-assessment` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `competitive-intelligence` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `consulting-report-writing` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `design` | 1.2.0 | active | pm | 2026-06-20 | — | co-deck only |
| `executive-presentation` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `financial-modeling` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `html-build` | 1.3.1 | active | pm | 2026-06-21 | — | co-deck only |
| `insight-synthesis` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `measure` | 1.3.0 | active | pm | 2026-06-20 | — | co-deck only |
| `narrative-framework` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `org-readiness-assessment` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `project-delivery` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `pdf-export` | 1.3.0 | active | pm | 2026-06-20 | — | co-deck only |
| `research` | 1.2.0 | active | pm | 2026-06-20 | — | co-deck only |
| `solution-design` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-alignment` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-review-management` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `storyline` | 1.2.0 | active | pm | 2026-06-20 | — | co-deck only |
| `technical-feasibility` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
| `theme-authoring` | 1.0.1 | active | pm | 2026-06-21 | — | co-deck only |
| `verify-authorization` | 1.0.0 | active | security-expert | 2026-06-06 | — | co-security only |
| `version` | 1.3.0 | active | pm | 2026-06-20 | — | co-deck only |
