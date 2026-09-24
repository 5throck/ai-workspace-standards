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

Registry of the skills this template delivers: one row per `templates/common/skills/<name>/` directory. These skills ship with every scaffolded project, except the region-scoped `k-*` skills (see the scope notes below the table).

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.2.0 | active | pm | 2026-09-18 | — | PM-led hiring/firing workflows + skill attach/detach rules |
| `finishing-a-development-branch` | 1.0.0 | active | pm | 2026-06-13 | — | Workspace override — redirects branch completion to /sync (mirrored 2026-09-04 from .claude/skills) |
| `meeting-facilitation` | 1.4.1 | active | pm | 2026-09-05 | — | Canonical meeting skill; `meeting` is a trigger alias, not a separate skill directory |
| `project-review` | 1.2.0 | active | pm | 2026-09-08 | — | — |
| `platform-command-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-31 | — | Mirrored 2026-09-04 from .claude/skills |
| `platform-skill-lifecycle-manager` | 1.0.0 | active | pm | 2026-05-31 | — | Mirrored 2026-09-04 from .claude/skills |
| `script-lifecycle-manager` | 1.2.0 | active | pm | 2026-05-30 | — | — |
| `security-scan` | 1.2.0 | active | pm | 2026-08-30 | — | Reassigned from security-expert — not defined in templates/common/agents/ or any variant, caused orphan on every propagated variant |
| `source-command-commit-push-pr` | 1.0.1 | active | pm | — | — | Redirects commit+push+PR requests to /sync (mirrored 2026-09-04 from .claude/skills) |
| `skill-lifecycle-manager` | 1.4.0 | active | pm | 2026-09-18 | — | Skill Request Workflow (agent-initiated, PM-approved) + Deprecation & Removal |
| `sync` | 1.3.0 | active | pm | 2026-09-06 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR. Reassigned from lifecycle-manager — same orphan cause as security-scan |
| `team-builder` | 1.1.0 | active | pm | 2026-06-13 | — | — |
| `translate` | 1.0.1 | active | pm | 2026-08-24 | — | — |
| `explain-me` | 1.0.0 | experimental | pm | 2026-08-03 | — | Single-file interactive HTML report generation. Inspired by beret21/reportme (MIT). Korean loanword data in references/loanword-refinements.json |
| `design-foundation` | 1.0.0 | active | architect | 2026-08-30 | — | Style-neutral design system derivation framework: principles, decision record, 3-layer token architecture ([data-theme] theming). Spec: templates/common/docs/design-foundation.md |
| `zod-contract-gate` | 1.0.0 | active | architect | 2026-08-06 | — | Defines Zod runtime schema validation patterns and contract safety rules |
| `standup-synthesizer` | 1.0.0 | active | pm | 2026-08-06 | — | Daily standup digest synthesizer aggregating commits, issues, PRs, and blockers |
| `api-documentation` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic REST/GraphQL/SDK documentation generation, not domain-specific |
| `documentation-writing` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic guide/manual/tutorial writing, not domain-specific |
| `accessibility-audit` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design (L2-as-basis per ADR-0068 plan): automated WCAG 2.1 AA audits via axe-core |
| `token-usage-lint` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design: token SSOT compliance lint; delegates to scripts/design-lint.ts (L0+L1) |
| `ui-ux-design-intelligence` | 1.0.1 | active | pm | 2026-09-06 | — | Promoted from co-design: component design, visual hierarchy, WCAG checklist; enabled by design-foundation |
| `research-analysis` | 1.0.0 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic research synthesis and evidence gathering, not domain-specific |
| `gateguard` | 1.0.0 | active | pm | 2026-08-01 | — | Pre-edit fact-forcing quality gate — investigate importers, schemas, scope constraints before editing (Hook-Prompt-Skill 3-layer enforcement) |
| `update-bun-packages` | 1.3.1 | active | pm | 2026-09-09 | — | Owns Bun dependency updates and root/common/variant alignment via sync-template-deps.ts --apply |
| `ci-triage` | 0.1.0 | active | pm | 2026-09-08 | — | CI failure triage and owner routing for scheduled health-check issues |
| `decision-record` | 1.1.0 | active | pm | 2026-08-25 | — | Decision record format for gate-moment rulings (Design Gate Row 0) captured as docs/decisions/DEC-YYYYMMDD-NN.md files |
| `evidence-ledger` | 1.1.0 | active | pm | 2026-08-25 | — | Fixed-column evidence ledger tracing every claim a decision depends on to a source, reference, and verification state |
| `handbook` | 0.6.0 | active | pm | 2026-09-20 | — | Document Production Workflow — searchable, themed handbook static sites (GitHub Pages); standalone, lecture-companion, and course modes |
| `handbook-sync-audit` | 1.0.5 | active | pm | 2026-08-29 | — | Verifies generated handbooks stay aligned with their sources: upstream content reflection, structural linkage, freshness |
| `i18n-audit` | 1.0.0 | active | pm | 2026-08-29 | — | Locale parity and glossary audit across locale files, with drift reporting and a parity certificate on success |
| `i18n-formatting` | 1.0.0 | active | pm | 2026-08-24 | — | Locale-specific date/time, number, and currency formatting, units of measure, Korean-scale numerals, print paper sizes |
| `i18n-layout` | 1.0.0 | active | pm | 2026-08-24 | — | Text layout and encoding guidance: UTF-8, legacy code pages, BOM hazards, RTL/bidi, script-specific fonts |
| `i18n-locale-config` | 1.0.0 | active | pm | 2026-08-24 | — | BCP 47 locale IDs, language-vs-country doctrine, collation order, timezone handling, region/language matrix |
| `k-dart` | 2.1.2 | active | strategy-analyst | 2026-08-09 | — | KR-scoped; pruned from region-neutral scaffolds. FSS DART OpenAPI queries: corporate disclosures, financial statements, major reports |
| `k-ecos` | 1.0.0 | active | financial-analyst | 2026-09-11 | — | KR-scoped; pruned from region-neutral scaffolds. Bank of Korea ECOS Open API: Korean macro-financial statistics |
| `k-kosis` | 1.0.2 | active | financial-analyst | 2026-08-23 | — | KR-scoped; pruned from region-neutral scaffolds. KOSIS Open API: Korean national statistics tables |
| `k-krx` | 1.0.2 | active | financial-analyst | 2026-09-11 | — | KR-scoped; pruned from region-neutral scaffolds. KRX Data Marketplace Open API: KOSPI/KOSDAQ market and stock data |
| `k-law` | 1.0.2 | active | strategy-analyst | 2026-08-09 | — | KR-scoped; pruned from region-neutral scaffolds. Korea Ministry of Government Legislation Open API: statutes, precedents, ordinances |
| `k-opendata` | 1.2.2 | active | hs-classification-specialist | 2026-09-03 | — | KR-scoped; pruned from region-neutral scaffolds. Korea Public Data Portal (data.go.kr) Open API gateway for government agency datasets |

**Scope notes — registries intentionally absent from this seed:**

- **Workspace-only (L0) skills** exist by design and are indexed in the workspace root `skills/SKILLS.md` — do not re-add them here. The scaffold registry reconcile prunes them from delivered projects (AGENTS.md §6).
- **Variant-exclusive skills** live in their owning variant's `templates/co-*/skills/` directory, and their registry rows belong in that variant's own `skills/SKILLS.md` (DEC-20260829-02).
- **`k-*` skills are KR-region-scoped**: they ship only to KR scaffolds and are pruned from region-neutral scaffolds at delivery — those prune lines are expected.
