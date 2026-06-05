# SKILLS.md — Skill Lifecycle Registry

> Single Source of Truth for all project skills in `skills/`.  
> The `layer` column drives `publish-to-template.ts` (L1 sync) and `create-l2-scaffold.ts` (L2 scaffold).  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads the `## Registry` section only.  
> **L0+L1+L2 skills** are variant-specific overrides living in `templates/co-*/skills/` — NOT published to `templates/common/skills/`.

---

## Registry

| skill | version | status | layer | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.0.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `audit-workspace` | 1.0.0 | active | L0+L1 | auditor | 2026-05-30 | — | — |
| `change-impact-assessment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `competitive-intelligence` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `consulting-report-writing` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `create-variant` | 1.0.1 | active | L0 | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `executive-presentation` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `financial-modeling` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `insight-synthesis` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `meeting-facilitation` | 1.4.0 | active | L0+L1 | pm | 2026-06-05 | — | — |
| `narrative-framework` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `org-readiness-assessment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `project-delivery` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `project-review` | 1.0.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `promote-variant` | 1.0.1 | active | L0 | pm | 2026-06-05 | — | Workspace operator only — not deployed to L2 |
| `script-lifecycle-manager` | 1.2.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `security-scan` | 1.0.0 | active | L0+L1 | security-expert | 2026-05-30 | — | — |
| `simulate-project-creation` | 1.0.0 | active | L0 | scaffolding-expert | 2026-05-30 | — | Workspace scaffolding test only |
| `skill-lifecycle-manager` | 1.2.0 | active | L0+L1 | pm | 2026-05-30 | — | — |
| `solution-design` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-alignment` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `stakeholder-review-management` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `team-builder` | 1.1.0 | active | L0+L1 | pm | 2026-06-06 | — | — |
| `technical-feasibility` | 1.0.0 | active | L0+L1+L2 | pm | 2026-06-06 | — | co-consult only |
| `translate` | 1.0.0 | active | L0+L1 | pm | 2026-06-06 | — | — |
| `ui-ux-pro-max` | 1.0.0 | active | L0+L1 | architect | 2026-06-06 | — | Restored to L0+L1 — was incorrectly removed in PR 231 |
| `validate-docs-links` | 1.0.0 | active | L0+L1 | docs-writer | 2026-05-30 | — | — |
| `verify-authorization` | 1.0.0 | active | L0+L1+L2 | security-expert | 2026-06-06 | — | co-security only |
