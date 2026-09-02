# SKILLS.md — Skill Lifecycle Registry

> Single Source of Truth for all project skills in `skills/`.  
> Propagation control is via SKILL.md frontmatter (`l2_propagate`/`scope`) — not this file.  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads each skill's `SKILL.md` frontmatter directly.  
> **Variant-exclusive skills (L0+L2)** live only in their owning variant's `templates/co-*/skills/` directory — never in the workspace root or `templates/common/skills/` (DEC-20260829-02).  
> **Country-scoped skills** (`k-law`/`k-dart`/`k-kosis`, KR): deployment scope lives in the `country_scoped_assets` registry in `docs/workspace-schema.json` - NOT in SKILL.md frontmatter. They deploy only to projects scaffolded with a matching target country (`--country KR`); region-neutral projects exclude them. See `docs/country-profiles.md` and ADR-0057.

---

## Registry

### Workspace Skills

Skills with a `skills/<name>/` directory in the workspace root. These are the primary skills available across all platforms.

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-30 | — | — |
| `audit-workspace` | 1.0.0 | active | auditor | 2026-05-30 | — | — |
| `create-variant` | 1.4.1 | active | pm | 2026-08-24 | — | Workspace operator only — not deployed to L2 |
| `meeting-facilitation` | 1.4.0 | active | pm | 2026-06-05 | — | — |
| `project-review` | 1.1.0 | active | pm | 2026-07-10 | — | — |
| `promote-variant` | 1.2.1 | active | pm | 2026-08-24 | — | Workspace operator only — not deployed to L2 |
| `script-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `security-scan` | 1.0.0 | active | pm | 2026-07-19 | — | Reassigned from security-expert — not defined in templates/common/agents/ or any variant, caused orphan on every propagated variant |
| `simulate-project-creation` | 1.0.1 | active | scaffolding-expert | 2026-08-09 | — | Workspace scaffolding test only |
| `skill-lifecycle-manager` | 1.2.1 | active | pm | 2026-08-29 | — | — |
| `sync` | 1.2.2 | active | pm | 2026-08-25 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR. Reassigned from lifecycle-manager — same orphan cause as security-scan |
| `team-builder` | 1.1.0 | active | pm | 2026-06-06 | — | — |
| `translate` | 1.0.1 | active | pm | 2026-08-24 | — | — |
| `validate-docs-links` | 1.0.0 | active | pm | 2026-07-19 | — | Reassigned from docs-writer — same orphan cause as security-scan |
| `project-to-variant` | 1.3.0 | active | scaffolding-expert | 2026-08-23 | — | Convert existing standalone project into official variant template |
| `upgrade-project` | 1.2.1 | active | pm | 2026-08-21 | — | Upgrade existing L2/L3 project to current template version |
| `variant-feature` | 1.0.0 | active | scaffolding-expert | 2026-07-31 | — | Add features (agents, skills, scripts, docs) to existing variant |
| `ticket-run` | 1.0.0 | active | automation-engineer | 2026-07-16 | — | Pulls next waiting service ticket from Phase A queue |
| `explain-me` | 1.0.0 | experimental | pm | 2026-08-03 | — | Single-file interactive HTML report generation. Inspired by beret21/reportme (MIT). Korean loanword data in references/loanword-refinements.json |
| `zod-contract-gate` | 1.0.0 | active | architect | 2026-08-06 | — | Defines Zod runtime schema validation patterns and contract safety rules |
| `k-dart` | 2.1.0 | active | strategy-analyst | 2026-09-01 | — | Unified DART OpenAPI skill — disclosure query, financial parsing, line-item extraction; v2.1: corp_code fallback chain (cache TTL → bulk retry → web fallback + company.json cross-validation), account alias normalization + summation check, CFS→BFS fallback, disclosure search presets, shareholder signal, source-document text extraction, shared fetch gate (concurrency/backoff/daily budget) (scope: common, l2_propagate); KR-scoped - deployed only to KR-target projects, pruned otherwise (registry: `country_scoped_assets` in `docs/workspace-schema.json`) |
| `k-law` | 1.0.0 | active | strategy-analyst | 2026-08-09 | — | Korean Ministry of Government Legislation (`법제처`) National Law Information Center OpenAPI — statutes, precedents, ordinances (scope: common, l2_propagate); KR-scoped - deployed only to KR-target projects, pruned otherwise (registry: `country_scoped_assets` in `docs/workspace-schema.json`) |
| `k-kosis` | 1.0.0 | active | financial-analyst | 2026-08-23 | — | Korean Statistical Information Service (`통계청 KOSIS`) OpenAPI — national statistics search, table browsing, data retrieval, metadata lookup (scope: common, l2_propagate); promoted from co-pitch; KR-scoped - deployed only to KR-target projects, pruned otherwise (registry: `country_scoped_assets` in `docs/workspace-schema.json`) |
| `standup-synthesizer` | 1.0.0 | active | pm | 2026-08-06 | — | Daily standup digest synthesizer aggregating commits, issues, PRs, and blockers |
| `api-documentation` | 1.0.0 | active | pm | 2026-08-28 | — | Promoted from co-work/co-safety duplicate copies — generic REST/GraphQL/SDK documentation generation, not domain-specific |
| `documentation-writing` | 1.0.0 | active | pm | 2026-08-28 | — | Promoted from co-work/co-safety duplicate copies — generic guide/manual/tutorial writing, not domain-specific |
| `research-analysis` | 1.0.0 | active | pm | 2026-08-28 | — | Promoted from co-work/co-safety duplicate copies — generic research synthesis and evidence gathering, not domain-specific |
| `evidence-ledger` | 1.0.0 | active | pm | 2026-08-24 | — | Fixed-column evidence ledger with variant overlays (scope: common); ADR-0061 decision-chain standard |
| `decision-record` | 1.0.0 | active | pm | 2026-08-24 | — | Decision record format for gate-moment rulings (scope: common); ADR-0061 decision-chain standard |
| `i18n-locale-config` | 1.0.0 | active | pm | 2026-08-24 | — | BCP 47 locale IDs, collation, timezone, region/language matrix (scope: common); i18n asset suite per constitution §4.4 — never country-scoped (§4.3) |
| `i18n-formatting` | 1.0.0 | active | pm | 2026-08-24 | — | Per-locale date/number/currency/unit formatting, Korean-scale numerals, paper sizes (scope: common); i18n asset suite per constitution §4.4 — never country-scoped (§4.3) |
| `i18n-layout` | 1.0.0 | active | pm | 2026-08-24 | — | Character encoding, RTL/bidi, script fonts, hwp pointers (scope: common); i18n asset suite per constitution §4.4 — never country-scoped (§4.3) |


| `handbook` | 0.4.0 | active | pm | 2026-08-30 | — | Document Production Workflow — searchable, themed handbook static sites (standalone / companion / course, dark mode, i18n; H-Stage pipeline); promoted from co-deck (scope: common) |
| `handbook-sync-audit` | 1.0.0 | active | handbook-reviewer | 2026-08-29 | — | Handbook drift audit — workspace content reflection, structural/cross-handbook linkage, section-level language parity; promoted from co-deck (scope: common) |
| `context-commonization-review` | 1.1.0 | active | architect | 2026-08-21 | — | Cross-variant docs/<variant>.context.md duplication review — promotes shared content into common docs/context.md (ADR-0050 Part 3) |
| `gateguard` | 1.0.0 | active | pm | 2026-08-01 | — | Pre-edit fact-forcing quality gate — investigate importers, schemas, and scope constraints before editing (Hook-Prompt-Skill 3-layer enforcement) |
| `simulate-l3-to-variant-promotion` | 1.0.0 | active | automation-engineer | 2026-08-09 | — | E2E smoke test of the L3 scaffold to variant promotion pipeline |
| `update-bun-packages` | 1.3.0 | active | pm | 2026-08-15 | — | Scans, updates, and upgrades Bun dependencies with lockfile and security compliance |

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
| `accessibility-audit` | 1.0.0 | active | pm | 2026-08-06 | — | co-design only |
| `presenter-mode` | 1.0.1 | active | html-build | 2026-08-16 | — | co-deck only |
| `stride-threat-matrix` | 1.0.0 | active | security-expert | 2026-08-06 | — | co-security only |
