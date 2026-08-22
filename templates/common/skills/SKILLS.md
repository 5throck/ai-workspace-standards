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
| `security-scan` | 1.0.0 | active | pm | 2026-07-19 | — | Reassigned from security-expert — not defined in templates/common/agents/ or any variant, caused orphan on every propagated variant |
| `simulate-project-creation` | 1.0.0 | active | scaffolding-expert | 2026-05-30 | — | Workspace scaffolding test only |
| `skill-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `sync` | 1.1.0 | active | pm | 2026-07-19 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR. Reassigned from lifecycle-manager — same orphan cause as security-scan |
| `team-builder` | 1.1.0 | active | pm | 2026-06-06 | — | — |
| `translate` | 1.0.0 | active | pm | 2026-06-06 | — | — |
| `validate-docs-links` | 1.0.0 | active | pm | 2026-07-19 | — | Reassigned from docs-writer — same orphan cause as security-scan |
| `project-to-variant` | 1.0.0 | active | scaffolding-expert | 2026-07-31 | — | Convert existing standalone project into official variant template |
| `upgrade-project` | 1.1.0 | active | pm | 2026-07-31 | — | Upgrade existing L2/L3 project to current template version |
| `variant-feature` | 1.0.0 | active | scaffolding-expert | 2026-07-31 | — | Add features (agents, skills, scripts, docs) to existing variant |
| `ticket-run` | 1.0.0 | active | automation-engineer | 2026-07-16 | — | Pulls next waiting service ticket from Phase A queue |
| `explain-me` | 1.0.0 | experimental | pm | 2026-08-03 | — | Single-file interactive HTML report generation. Inspired by beret21/reportme (MIT). Korean loanword data in references/loanword-refinements.json |
| `zod-contract-gate` | 1.0.0 | active | architect | 2026-08-06 | — | Defines Zod runtime schema validation patterns and contract safety rules |
| `presenter-mode` | 1.0.0 | active | presentation-architect | 2026-08-06 | — | Dual-window presenter state synchronization using browser BroadcastChannel API |
| `stride-threat-matrix` | 1.0.0 | active | security-expert | 2026-08-06 | — | Automated STRIDE threat matrix generation and DREAD risk scoring framework |
| `sarif-exporter` | 1.0.0 | active | security-expert | 2026-08-06 | — | Exports security scan results, threat matrices, and vulnerability findings into standard SARIF v2.1.0 JSON format |
| `accessibility-audit` | 1.0.0 | active | pm | 2026-08-06 | — | Automated WCAG 2.1 AA accessibility evaluation using axe-core |
| `k-dart` | 2.0.0 | active | strategy-analyst | 2026-08-09 | — | Unified DART OpenAPI skill — disclosure query, financial parsing, line-item extraction (scope: common, l2_propagate) |
| `k-law` | 1.0.0 | active | strategy-analyst | 2026-08-09 | — | Korean Ministry of Government Legislation (`법제처`) National Law Information Center OpenAPI — statutes, precedents, ordinances (scope: common, l2_propagate) |
| `k-kosis` | 1.0.0 | active | financial-analyst | 2026-08-23 | — | Korean Statistical Information Service (`통계청 KOSIS`) OpenAPI — national statistics search, table browsing, data retrieval, metadata lookup (scope: common, l2_propagate); promoted from co-pitch |
| `mece-logic-auditor` | 1.0.0 | active | strategy-analyst | 2026-08-06 | — | MECE issue tree auditing and strategic reasoning evaluation rules |
| `sound-synth` | 1.0.0 | active | sound-designer | 2026-08-06 | — | Web Audio API / jsfxr procedural 8-bit retro sound effect generation rules |
| `standup-synthesizer` | 1.0.0 | active | pm | 2026-08-06 | — | Daily standup digest synthesizer aggregating commits, issues, PRs, and blockers |
| `swe-solve` | 1.0.0 | active | pm | 2026-08-06 | — | Autonomous 4-stage issue-to-PR resolution pipeline for software engineering tasks |



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
