# SKILLS.md — Skill Lifecycle Registry

> Single Source of Truth for all project skills in `skills/`.  
> The `layer` column drives `publish-to-template.ts` (L1 sync) and `create-l2-scaffold.ts` (L2 scaffold).  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads the `## Registry` section only.

---

## Registry

| skill | version | status | layer | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.0.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `audit-workspace` | 1.0.0 | active | L0+L1 | auditor | 2026-05-30 | — | — |
| `create-variant` | 1.0.1 | active | L0 | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `meeting-facilitation` | 1.4.0 | active | L0+L1 | pm | 2026-06-05 | — | — |
| `project-review` | 1.0.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `promote-variant` | 1.0.1 | active | L0 | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `script-lifecycle-manager` | 1.2.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `security-scan` | 1.0.0 | active | L0+L1 | security-expert | 2026-05-30 | — | — |
| `simulate-project-creation` | 1.0.0 | active | L0 | scaffolding-expert | 2026-05-30 | — | Workspace scaffolding test only |
| `skill-lifecycle-manager` | 1.2.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `team-builder` | 1.1.0 | active | L0+L1 | pm | 2026-06-06 | — | — |
| `translate` | 1.0.0 | active | L0+L1 | pm | 2026-06-06 | — | — |
| `ui-ux-pro-max` | 1.0.0 | active | L0+L1 | architect | 2026-06-06 | — | Restored to L0+L1 — was incorrectly removed in PR 231 |
| `validate-docs-links` | 1.0.0 | active | L0+L1 | docs-writer | 2026-05-30 | — | — |

## Variant-Specific Skills (L0+L1+L2)

> Skills below are variant-specific overrides in `templates/co-*/skills/`. They are NOT published to
> `templates/common/skills/` — each variant owns them as delta items.

| skill | version | status | layer | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|-------|---------------|--------------|-------|
| `change-impact-assessment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `competitive-intelligence` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `consulting-report-writing` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `executive-presentation` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `financial-modeling` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `insight-synthesis` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `narrative-framework` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `org-readiness-assessment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `project-delivery` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `solution-design` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-alignment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-review-management` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `technical-feasibility` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `verify-authorization` | 1.0.0 | active | L0+L1+L2 | security-expert | 2026-06-06 | — | co-security only |
