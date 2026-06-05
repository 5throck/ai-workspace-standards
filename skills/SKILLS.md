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
