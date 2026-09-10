# SKILLS.md — Skill Lifecycle Registry

> Single Source of Truth for all project skills in `skills/`.  
> Propagation control is via SKILL.md frontmatter (`l2_propagate`/`scope`) — not this file.  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads each skill's `SKILL.md` frontmatter directly.  
> **Variant-exclusive skills (L0+L2)** live only in their owning variant's `templates/co-*/skills/` directory — never in the workspace root or `templates/common/skills/` (DEC-20260829-02).  
> **Inter-skill relations** are NOT tracked here — see `docs/skill-graph.json` / `docs/skill-graph.md` (ADR-0060).

---

## Registry

### Workspace Skills

Skills with a `skills/<name>/` directory in the workspace root. These are the primary skills available across all platforms.

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-30 | — | — |
| `audit-workspace` | 1.0.0 | deprecated | auditor | 2026-09-10 | 2026-10-10 | Deprecated: project-review Step 0 is its documented superset |
| `create-variant` | 1.4.1 | active | pm | 2026-08-24 | — | Workspace operator only — not deployed to L2 |
| `finishing-a-development-branch` | 1.0.0 | active | pm | 2026-06-13 | — | Workspace override — redirects branch completion to /sync (mirrored 2026-09-04 from .claude/skills) |
| `meeting-facilitation` | 1.4.1 | active | pm | 2026-09-05 | — | Canonical meeting skill; `meeting` is a trigger alias, not a separate skill directory |
| `project-review` | 1.2.0 | active | pm | 2026-09-08 | — | — |
| `promote-variant` | 1.3.0 | active | pm | 2026-08-24 | — | Workspace operator only — not deployed to L2 |
| `platform-command-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-31 | — | Mirrored 2026-09-04 from .claude/skills |
| `platform-skill-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-31 | — | Mirrored 2026-09-04 from .claude/skills |
| `script-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `security-scan` | 1.2.0 | active | pm | 2026-08-30 | — | Reassigned from security-expert — not defined in templates/common/agents/ or any variant, caused orphan on every propagated variant |
| `source-command-commit-push-pr` | 1.0.1 | active | pm | — | — | Redirects commit+push+PR requests to /sync (mirrored 2026-09-04 from .claude/skills) |
| `simulate-pipeline` | 1.0.0 | active | automation-engineer | 2026-09-09 | — | Merged smoke-test skill for project creation and L3→variant promotion modes |
| `skill-lifecycle-manager` | 1.3.0 | active | pm | 2026-09-06 | — | — |
| `sync` | 1.3.0 | active | pm | 2026-09-06 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR. Reassigned from lifecycle-manager — same orphan cause as security-scan |
| `team-builder` | 1.1.0 | active | pm | 2026-06-13 | — | — |
| `translate` | 1.0.1 | active | pm | 2026-08-24 | — | — |
| `validate-docs-links` | 1.0.0 | deprecated | pm | 2026-09-09 | 2026-12-09 | Deprecated: project-review baseline owns documentation/link checking |
| `project-to-variant` | 1.3.0 | active | scaffolding-expert | 2026-08-23 | — | Convert existing standalone project into official variant template |
| `upgrade-project` | 1.2.1 | active | pm | 2026-08-21 | — | Upgrade existing L2/L3 project to current template version |
| `variant-feature` | 1.0.0 | active | scaffolding-expert | 2026-07-31 | — | Add features (agents, skills, scripts, docs) to existing variant |
| `ticket-run` | 1.0.0 | active | automation-engineer | 2026-07-16 | — | Pulls next waiting service ticket from Phase A queue |
| `explain-me` | 1.0.0 | experimental | pm | 2026-08-03 | — | Single-file interactive HTML report generation. Inspired by beret21/reportme (MIT). Korean loanword data in references/loanword-refinements.json |
| `design-foundation` | 1.0.0 | active | architect | 2026-08-30 | — | Style-neutral design system derivation framework: principles, decision record, 3-layer token architecture ([data-theme] theming). Spec: templates/common/docs/design-foundation.md; l2_propagate: false |
| `zod-contract-gate` | 1.0.0 | active | architect | 2026-08-06 | — | Defines Zod runtime schema validation patterns and contract safety rules |
| `standup-synthesizer` | 1.0.0 | active | pm | 2026-08-06 | — | Daily standup digest synthesizer aggregating commits, issues, PRs, and blockers |
| `api-documentation` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic REST/GraphQL/SDK documentation generation, not domain-specific |
| `documentation-writing` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic guide/manual/tutorial writing, not domain-specific |
| `project-resync` | 1.2.0 | active | pm | 2026-09-06 | — | Whole-fleet bidirectional cycle: provenance audit (resync-audit.ts) → project GitHub sync → selective backport → root sync → upgrades. Operator skill; distinct from `sync` |
| `release-template` | 1.0.0 | active | pm | 2026-09-09 | — | Workspace operator only — atomically bumps templates/VERSION, cuts templates/CHANGELOG.md, and creates template tag |
| `accessibility-audit` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design (L2-as-basis per ADR-0068 plan): automated WCAG 2.1 AA audits via axe-core |
| `token-usage-lint` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design: token SSOT compliance lint; delegates to scripts/design-lint.ts (L0+L1) |
| `ui-ux-design-intelligence` | 1.0.1 | active | pm | 2026-09-06 | — | Promoted from co-design: component design, visual hierarchy, WCAG checklist; enabled by design-foundation |
| `research-analysis` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic research synthesis and evidence gathering, not domain-specific |
| `context-commonization-review` | 1.1.0 | active | architect | 2026-08-21 | — | Cross-variant docs/<variant>.context.md duplication review — promotes shared content into common docs/context.md (ADR-0050 Part 3) |
| `gateguard` | 1.0.0 | active | pm | 2026-08-01 | — | Pre-edit fact-forcing quality gate — investigate importers, schemas, scope constraints before editing (Hook-Prompt-Skill 3-layer enforcement) |
| `update-bun-packages` | 1.3.1 | active | pm | 2026-09-09 | — | Owns Bun dependency updates and root/common/variant alignment via sync-template-deps.ts --apply |
| `ci-triage` | 0.1.0 | active | pm | 2026-09-08 | — | CI failure triage and owner routing for scheduled health-check issues |

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
| `swe-solve` | 1.1.1 | active | pm | 2026-08-25 | — | co-develop only |
| `sound-synth` | 1.0.0 | active | sound-designer | 2026-08-06 | — | co-game only |
| `mece-logic-auditor` | 1.0.0 | active | strategy-analyst | 2026-08-06 | — | co-consult only |
| `sarif-exporter` | 1.0.1 | active | security-expert | 2026-08-06 | — | co-security only |
| `presenter-mode` | 1.0.1 | active | html-build | 2026-08-16 | — | co-deck only |
| `stride-threat-matrix` | 1.0.0 | active | security-expert | 2026-08-06 | — | co-security only |
