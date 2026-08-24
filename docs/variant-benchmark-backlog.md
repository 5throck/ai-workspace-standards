# Variant Benchmark Gap Backlog (2026 Q3–Q4)

**Document Version**: 1.0.0
**Date**: 2026-08-24
**Status**: Content doc (not an ADR/design spec — no `docs/specs/registry.json` entry)
**Scope**: All 11 workspace variant templates (`co-develop`, `co-design`, `co-consult`, `co-deck`, `co-game`, `co-security`, `co-work`, `co-news`, `co-export`, `co-hr`, `co-abap`)
**Inputs**: [Variant Roadmap 2026 Q3–Q4](variant-roadmap-2026-q3-q4.md) §2 benchmark matrix; [Skill Relationship Graph](skill-graph.md) (203 nodes, regenerated projection); each variant's `variant.json` and `templates/<variant>/` tree

---

## 1. Methodology: The Gap Worksheet

Each variant is assessed with a five-step gap worksheet against one external industry benchmark:

1. **Benchmark capability** — what the external reference standard provides (from the roadmap §2 matrix; two variants tracked separately get their benchmarks assigned here — see §11 and §12).
2. **Current assets** — what the variant ships **today**, verified against the generated [skill graph](skill-graph.md) (skill/agent nodes, `required_by` and `phase` edges), the variant's `variant.json` manifest, and direct inspection of `templates/<variant>/agents/`, `skills/`, and `scripts/`. The graph is a regenerated projection, not a hand list: nodes are deduplicated by name across layers (L0 wins over common, common wins over variant), so a variant's layer node count is a lower bound on its roster, not a roster census. Current layer attribution: L0 40, common 9, co-abap 32, co-consult 27, co-deck 15, co-design 9, co-develop 5, co-export 18, co-game 7, co-hr 16, co-news 11, co-security 6, co-work 8.
3. **Gap classification** — each gap is labeled exactly one of:
   - `skill` — a missing or thin SKILL.md capability package
   - `agent` — a missing or under-specified agent role
   - `doc` — missing guidance/reference documentation
   - `config` — missing schema, manifest, or tooling configuration
4. **Improvement item** — one actionable sentence.
5. **Size** — `S` (≤2 files), `M` (3–8 files), `L` (9+ files or a new pipeline).

**Target phase** ties every item to the roadmap's phase framing: near-term (Phase 1 foundations), mid-term (Phase 2 core engines), long-term (Phase 3 automation), per [roadmap §3](variant-roadmap-2026-q3-q4.md).

**Prioritization rule**: priority = impact × effort inversion. `High` = closes a named benchmark-parity hole that every scaffolded project inherits; `Medium` = meaningful for a majority of engagements; `Low` = polish or single-scenario value. When impact is equal, smaller size wins (S beats M beats L).

**Maintenance note**: this backlog is a point-in-time snapshot. Re-run the worksheet for a variant whenever its skill manifest changes (skill added/removed, `skill_manifest.variant_specific` edited, agent `required_skills` updated). The skill graph regenerates deterministically via `bun scripts/generate-skill-graph.ts`, and `dev-sync` step 4.65 fails on drift, so the asset-lookup input for step 2 is always current at sync time — regenerate the graph first, then re-derive the "Current assets" bullets and gap rows from it.

---

## 2. `co-develop` — SWE-agent (Princeton) & MetaGPT

**Current assets** (v1.0.0, stable; 7 agents, 4 variant skills; 5 graph nodes at the variant layer — `pm`, `architect`, `code-writer`, `security-monitor`, `test-runner` dedupe to L0/common):
- Agent roster exactly matches the roadmap target: `pm`, `architect`, `code-writer`, `designer`, `security-monitor`, `stack-setup`, `test-runner`.
- `swe-solve` autonomous issue-to-PR pipeline (4-stage: ingest, localize+plan, mutate+test, review+PR) plus `code-review`, `refactoring`, `test-driven-development` skills.
- `zod-contract-gate` and `generate-ide-rules.ts` (`.cursorrules`/`.clauderules` synthesis) shipped from the workspace-root scripts layer into every scaffold; `test-runner.ts` v1.1.0 parallel worker pool behind `test-runner`.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No resolution-trajectory logging or eval harness (SWE-agent's core artifact is the scored trajectory) | skill | Extend `swe-solve` to emit a per-run trajectory log (issue, files touched, test outcomes, PR link) so resolve-rate is measurable | S | High |
| No benchmark fixture set to regression-test the pipeline itself (SWE-bench-style accepted/resolved counting) | doc | Add a small curated issue-fixture doc set with known-good resolutions for pipeline regression checks | M | Medium |
| No standardized per-role deliverable artifacts (MetaGPT's PRD/design/task artifacts per agent hand-off) | doc | Document the required output artifact per role in each agent file's Output Contract section | S | Medium |
| `designer` agent has no required-skills binding in the graph (no inbound skill edges) | agent | Bind `designer` to a UI/design skill or document why it stays prompt-only | S | Low |

**Top improvement**: Instrument `swe-solve` with trajectory logging so every autonomous run produces a scoreable record — the single SWE-agent capability whose absence makes the pipeline unmeasurable.

---

## 3. `co-design` — shadcn/ui & Tailwind CSS

**Current assets** (v1.0.0, stable; 8 agents, 3 variant skills; 9 graph nodes):
- Full 8-agent roster per the roadmap: `design-lead`, `pm`, `prototype-engineer`, `service-designer`, `storyteller`, `typography-expert`, `ux-researcher`, `visual-designer`.
- `tokens.json` SSOT in the template root, compiled by workspace-root `compile-tokens.ts` (CSS custom properties + typed TS constants).
- `accessibility-audit` skill (axe-core, WCAG 2.1 AA gating) plus `service-design` and `ui-ux-design-intelligence`.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No component-primitive catalog (shadcn's registry of composable, token-bound components) | doc | Author a component-primitive catalog doc mapping each primitive to the token classes it must consume | M | High |
| No component playground in the template (roadmap §2 lists a Vite playground; `templates/co-design/` has no `scripts/` or playground dir) | config | Ship a minimal Vite playground scaffold wired to compiled tokens for live preview | M | Medium |
| No dark-mode/high-contrast token theme presets alongside the default palette | config | Add theme-preset variants to `tokens.json` with compiler support for `data-theme` scoping | S | Medium |
| No token-usage lint (detecting hardcoded colors/spacing that bypass the SSOT) | skill | Add a lint skill that greps generated code for raw hex/px values outside `tokens.ts` | S | Low |

**Top improvement**: Create the component-primitive catalog — it converts `tokens.json` from a palette definition into an actually reusable component system, which is the heart of shadcn/ui parity.

---

## 4. `co-consult` — OpenBB Platform & McKinsey Frameworks

**Current assets** (v1.0.0, stable; 11 agents, 18 variant skills — the largest skill set of any variant; 27 graph nodes):
- Roster: `pm`, `strategy-analyst`, `data-analyst`, `industry-expert`, `sme`, `solutions-architect`, `technology-specialist`, `delivery-manager`, `workstream-lead`, `change-management-partner`, `communications-lead`.
- Deep analysis suite: `financial-modeling`, `financial-statement-analysis` (DART pipeline under the KR country profile), `company-intelligence`, `competitive-intelligence`, `insight-synthesis`, `narrative-framework`, `mece-logic-auditor`, `executive-presentation`.
- Variant-local scripts: `scripts/co-consult/financial-driver-tree.ts` and `financial-kpi.ts`; `k-dart` arrives as a KR-scoped common skill via country-profile deployment.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| Data ingestion is DART-only (OpenBB's value is multi-provider market data abstraction) | skill | Generalize the disclosure-ingestion pattern into a provider-agnostic interface doc with DART as the KR reference implementation | M | High |
| No engagement kickoff artifact pack (McKinsey-style issue tree + hypothesis log templates) | doc | Add a standard issue-tree/hypothesis-log template pair to the deliverable-writer flow | S | Medium |
| No quantitative dataset schema convention for ingested market data (column contracts, units, currency) | config | Define a dataset schema convention consumed by `financial-modeling` and `financial-kpi.ts` | S | Medium |
| No portfolio/backtest analytics capability (OpenBB's terminal-class feature) | skill | Scope a `portfolio-analytics` skill or explicitly record it out-of-domain in the context doc | S | Low |

**Top improvement**: Abstract the DART ingestion pattern into a provider-agnostic disclosure-ingestion contract so non-KR profiles can plug in their local data systems without new ad-hoc skills.

---

## 5. `co-deck` — Slidev & Marp

**Current assets** (v0.2.1, beta; 13 agents, 11 variant skills; 15 graph nodes; a parallel session is actively evolving this template — asset summary reflects the tree as of 2026-08-24):
- Roster spans authoring (`presentation-architect`-equivalent `storyline`, `design`, `html-build`) through QA (`source-verifier`, `handbook-reviewer`, `measure`) and release (`version`, `pdf-export`).
- 20 variant scripts under `scripts/co-deck/` including `gen-slides-pdf.ts`, `html-to-pdf.ts`, `build-theme-deck.ts`, `estimate-layout.ts`, `auto-calibrate.ts`, `validate-theme-styles.ts`, `validate-image-manifest.ts`; workspace-root `render-pdf-deck.ts` (Playwright paged-media PDF).
- `presenter-mode` dual-screen skill (BroadcastChannel state sync) shipped from the common layer; theme system (`theme-authoring`, `generate-themes-manifest.ts`).

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No PPTX export path (Slidev's key interop feature; current export terminates at PDF) | config | Add an OOXML `.pptx` export script or document the deliberate PDF-only boundary in the context doc | M | High |
| No live-reload authoring loop (Slidev's dev-server experience) | config | Add a watch mode that rebuilds the theme deck on save for authoring feedback | M | Medium |
| No slide-layout conformance lint (Marp enforces consistent directives; `estimate-layout.ts` measures but does not gate) | skill | Turn layout estimation into a gate skill that fails slides exceeding safe text/element bounds | S | Medium |
| No speaker-notes export format for handoff to non-tool presenters | doc | Document a plain-text speaker-notes export convention alongside the PDF pipeline | S | Low |

**Top improvement**: Close the PPTX export gap — PowerPoint interop is the most common external handoff request and the only Slidev export capability with no template equivalent.

---

## 6. `co-game` — Phaser & jsfxr

**Current assets** (v1.0.0, stable — promoted 2026-08-12; 13 agents, 4 variant skills; 7 graph nodes):
- Roster: `pm`, `architect`, `game-designer`, `game-developer`, `game-debugger`, `arcade-designer`, `puzzle-designer`, `visual-artist`, `sound-designer`, `stack-setup`, `test-runner`, `security-monitor`, `designer`.
- Zero-dependency TypeScript ECS core at `src/ecs/ecs-core.ts` (~150 lines, bitmask allocation) plus `arcade-puzzle-template.ts` starter.
- `sound-synth` Web Audio procedural SFX generator (common-layer skill, jsfxr parity); `code-review`, `refactoring`, `test-driven-development` shared with the development family.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No single-file HTML game bundler (roadmap Phase-2 deliverable; no bundler script exists in the template) | config | Ship a bundler script that inlines the built game plus assets into one distributable HTML file | M | High |
| No scene-management convention (Phaser's core organizing abstraction) | doc | Document a scene-graph convention over the ECS core for multi-level games | S | Medium |
| No asset pipeline (sprite atlas packing, audio encoding checks) | config | Add an asset-manifest validation script mirroring co-deck's `validate-image-manifest.ts` pattern | M | Medium |
| No physics module beyond the ECS template (Phaser ships Arcade/Matter physics) | skill | Add a minimal velocity/collision system skill scoped to the ECS core, or record 2D-casual-only scope | M | Low |

**Top improvement**: Ship the promised single-file HTML bundler — it is the variant's distribution story and the one roadmap Phase-2 deliverable with no on-disk artifact.

---

## 7. `co-security` — OWASP SAMM & DefectDojo

**Current assets** (v1.0.0, stable; 6 agents, 3 variant skills; 6 graph nodes):
- Roster: `pm`, `red-team-lead`, `pentester`, `threat-modeler`, `patch-engineer`, `report-writer`.
- `stride-threat-matrix` generator (structured STRIDE model with risk ratings) and `sarif-exporter` (SARIF v2.1.0 CI telemetry).
- `verify-authorization` skill plus the common-layer `security-scan`; gitleaks secret-detection rules as baseline hygiene.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No SAMM maturity self-assessment (SAMM's five business functions × three maturity levels — the benchmark's core artifact) | skill | Add an OWASP SAMM maturity-assessment skill producing a scored maturity roadmap per engagement | M | High |
| No SBOM/SPDX generation (roadmap §2 lists it under a `compliance-expert` agent that does not exist in the shipped roster; no SPDX/SBOM references anywhere in the template) | skill | Add a dependency-extraction + SPDX SBOM export skill, then register it in the roadmap matrix as the corrected roster | M | High |
| No finding deduplication/triage pipeline (DefectDojo's central value) | skill | Add a finding-reconciliation skill that merges duplicate SARIF/scan hits by code location | M | Medium |
| Roster lacks the governance-side roles the roadmap named (`compliance-expert`, `cloud-sec-architect`, `incident-responder`) | agent | Either add the missing roles or correct the roadmap §2 roster to the shipped six | S | Medium |

**Top improvement**: Land the SAMM maturity self-assessment skill — it moves engagements from one-off findings to a scored, comparable security posture, which is what the benchmark actually measures.

---

## 8. `co-work` — n8n & Apache POI

**Current assets** (v1.0.0, stable; 7 agents, 4 variant skills; 8 graph nodes):
- Roster: `pm`, `analyst`, `content-writer`, `technical-writer`, `storyteller`, `project-coordinator`, `ms365-expert` (M365 app guidance: Outlook, Word, Excel, PowerPoint, SharePoint, Teams).
- `standup-synthesizer` daily digest skill (commits/issues/PRs/tickets → structured standup) plus `api-documentation`, `documentation-writing`, `research-analysis`.
- Markdown→OOXML compilation via workspace-root `md-to-ooxml.ts` (`.docx` and `.xlsx`; styled headings, tables, callouts, spreadsheet formulas — no Office binary dependency).

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No `.pptx` output (POI parity requires the full Office trio; `md-to-ooxml.ts` handles docx/xlsx only — verified) | config | Extend `md-to-ooxml.ts` with a presentation package writer | L | High |
| No workflow connector schema library (n8n's trigger/action node contracts; roadmap §2 lists it, no schema assets exist) | config | Add a connector-schema pack (trigger/event contracts per integration) consumable by `project-coordinator` | M | Medium |
| No automation-runbook convention (when to script vs when to hand off) | doc | Document an automation decision framework in the context doc | S | Medium |
| No document template registry (reusable corporate doc/xlsx styles) | config | Add a style-template registry keyed by document type for OOXML compilation | S | Low |

**Top improvement**: Extend the OOXML compiler to `.pptx` — it completes native Office parity (the Apache POI side of the benchmark) with one well-understood pipeline extension.

---

## 9. `co-news` — Reuters/Sedaily-style Business Journalism

**Current assets** (v0.1.0, beta — promoted to official variant 2026-08-10; 7 agents, 5 variant skills; 11 graph nodes; KR country profile):
- Roster: `pm`, `reporter`, `fact-checker`, `financial-analyst`, `legal-researcher`, `style-editor`, `visual-editor`.
- Verification chain: `source-verification-ledger` (evidence-ledger overlay with the two-source rule, anchored by the pilot stable rule ID `NEWS-R1` in `co-news.context.md`), `fact-checker` agent, `legal-researcher` for statutory review.
- Narrative quality: `financial-journalism-style`, `financial-narrative-brief`, `ai-tell-reduction`, `financial-infographic-svg`; DART filing ingestion under the KR profile.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No correction/transparent-error workflow (Reuters' published-corrections discipline) | doc | Add a corrections workflow doc defining how published errors are flagged, corrected, and annotated | S | High |
| No standards-as-code style lint (Reuters' handbook rules are enforceable prose) | skill | Encode the top style-guide rules as a lint checklist skill run by `style-editor` before publication | M | Medium |
| No wire-format output templates (agency dispatch structure: slug, dateline, source line) | doc | Add wire-format templates for the brief and article deliverables | S | Medium |
| No legal-review escalation matrix (what must route to `legal-researcher` pre-publication) | doc | Document risk-tiered escalation triggers in the context doc | S | Low |

**Top improvement**: Author the corrections workflow — every journalism benchmark treats transparent error handling as non-negotiable, and the template currently has no answer.

---

## 10. `co-export` — WTO-Framework Customs Compliance

**Current assets** (v0.1.0, beta — official variant 2026-08-08; 10 agents, 9 variant skills; 18 graph nodes; KR country profile):
- Ten specialist agents exactly matching the roadmap roster: HS classification, FTA origin, customs drawback, export control, foreign regulatory intelligence, halal certification, logistics, market entry, trade documentation, plus `pm`.
- Nine workflow skills mirroring the agent specializations one-to-one (`hs-classification-workflow`, `fta-origin-determination`, `customs-duty-drawback-workflow`, `export-control-screening`, `foreign-regulation-monitoring`, `halal-certification-workflow`, `logistics-coordination`, `market-entry-strategy`, `trade-documentation-checklist`).
- Country-profile mechanism live: KR profile owns the jurisdiction specifics; variant body is region-neutral.

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| No rules-of-origin qualification worksheet (WTO rule text → repeatable origin-determination artifact) | skill | Add a RoO worksheet skill producing a per-shipment origin qualification record from the FTA skill's rules | M | High |
| No landed-cost computation convention (duty + freight + insurance breakdown) | skill | Add a landed-cost computation skill with an explicit formula/assumption ledger | M | Medium |
| Only one country profile exists (KR); no profile template for onboarding a second jurisdiction | doc | Author a blank country-profile skeleton doc derived from the KR profile's five sections | S | Medium |
| No tariff-schedule dataset schema (HS code lookup needs a structured local dataset contract) | config | Define a tariff-dataset schema the classification skill can consume offline | S | Low |

**Top improvement**: Build the rules-of-origin qualification worksheet — it converts the FTA skill's knowledge into an auditable per-shipment artifact, which is what customs authorities actually demand.

---

## 11. `co-abap` — SAP Clean ABAP Style Guide + abapOpenChecks

*Benchmark assigned by this document (the roadmap tracks co-abap separately; §2 does not cover it).*

**Current assets** (v1.0.0, stable; 20 agents — the largest roster of any variant; 12 variant skills; 32 graph nodes, the densest variant layer):
- Broadest functional coverage of any variant: module analysts for FI, CO, MM, SD, PP, LE plus technical roles (`dba`, `schema-inspector`, `interface-expert`, `form-expert`, `fiori-developer`, `gui-scripter`, `read-only-analyst`, `sap-investigator`, `devops-admin`).
- `abap-dev` skill driven by the vsp MCP server (surgical `EditSource` edits, `GetContext` analysis, `AnalyzeCallGraph` impact analysis, ABAP Unit transport workflows); ATC referenced in skill prose as the system-level check runner.
- 14 variant scripts under `scripts/co-abap/` (`vsp-audit.ts`, `vsp-publish.ts`, `new-requirement.ts`, `setup.ts`, transport and scratch hygiene).

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| Zero "Clean ABAP" references in the template (verified by grep) — the style guide is the benchmark's core and is absent | doc | Author a Clean ABAP conformance checklist mapping each style-guide rule to the owning agent review step | M | High |
| No codified static-check rule pack (abapOpenChecks parity: named, versioned, runnable checks) | config | Encode an ATC check-selection config per change type so `vsp-audit.ts` runs a deterministic rule set | M | High |
| No ABAP-specific code-review skill (co-develop's `code-review` is general-purpose; naming conventions, pretty-printer, pattern compliance are ABAP-specific) | skill | Add an ABAP review skill covering naming, pretty-printer, and anti-pattern rules | M | Medium |
| No transport-release quality gate doc (release-strategy rules, import ordering) | doc | Document the transport release checklist consumed by `devops-admin` | S | Low |

**Top improvement**: Write the Clean ABAP conformance checklist — it is the cheapest high-impact artifact (pure documentation) and anchors every downstream static-check and review improvement.

---

## 12. `co-hr` — SHRM Body of Knowledge + ISO 30414

*Benchmark assigned by this document (the roadmap tracks co-hr separately; §2 does not cover it).*

**Current assets** (v0.1.0, beta; 12 agents, 10 variant skills; 16 graph nodes; KR country profile):
- Roster: `pm`, `talent-acquisition-specialist`, `compensation-benefits-analyst`, `labor-compliance-analyst`, `labor-relations-specialist`, `learning-development-specialist`, `performance-management-consultant`, `career-succession-consultant`, `org-design-consultant`, `safety-health-officer`, `data-analyst`, `change-management-partner`.
- Ten domain skills including `hr-metrics-analysis` (reproducible metrics, causal driver hypotheses, dashboards, benchmarking guardrails), `compensation-benchmarking`, `talent-acquisition-strategy`, `performance-system-design`, `learning-curriculum-design`, `org-design-framework`.
- KR country profile owns labor-statute and authority specifics; consulting craft shared with co-consult (`consulting-report-writing`, `org-readiness-assessment`, `stakeholder-alignment`).

| Gap | Classification | Improvement | Size | Priority |
|---|---|---|---|---|
| Zero SHRM/ISO 30414 references in the template (verified by grep) — `hr-metrics-analysis` has no external reporting taxonomy to anchor to | doc | Map `hr-metrics-analysis` metric families onto the ISO 30414 human-capital reporting categories so dashboards become externally comparable | M | High |
| No competency-model framework skill (SHRM BoK's talent core) | skill | Add a competency-modeling skill covering definition, leveling, and assessment design | M | Medium |
| No HR-compliance audit skill mapped to a recognized framework | skill | Add a labor-compliance audit skill that instantiates the active country profile's statute table as a checklist | M | Medium |
| No metric-definition dictionary (calculation formulas, data sources, refresh cadence per metric) | config | Define a metric dictionary schema consumed by `hr-metrics-analysis` and `data-analyst` | S | Low |

**Top improvement**: Anchor `hr-metrics-analysis` to the ISO 30414 reporting taxonomy — it turns internally consistent dashboards into externally comparable human-capital reports, which is precisely what the benchmark standardizes.

---

## 13. Consolidated Cross-Variant Backlog

Merged highest-priority items across all 11 variants, ordered by impact. Phase labels follow the roadmap framing (near/mid/long term).

The **Status** column tracks execution (marked 2026-08-25): `Done — #PR` references the merged pull request; `Open` rows are pending execution.

| # | Variant | Improvement | Classification | Size | Phase | Priority | Status |
|---|---|---|---|---|---|---|---|
| 1 | co-develop | `swe-solve` trajectory logging + measurable resolve-rate | skill | S | near-term | High | Done — #650 |
| 2 | co-security | OWASP SAMM maturity self-assessment skill | skill | M | near-term | High | Done — #651 + #652 |
| 3 | co-security | SPDX SBOM generation (and roadmap roster correction) | skill | M | near-term | High | Done — #653 |
| 4 | co-work | `.pptx` extension for `md-to-ooxml.ts` | config | L | long-term | High | Done — #654 |
| 5 | co-deck | PPTX export path (or documented PDF-only boundary) | config | M | near-term | High | Done — #655 |
| 6 | co-design | Component-primitive catalog bound to `tokens.json` | doc | M | mid-term | High | Done — #656 |
| 7 | co-consult | Provider-agnostic disclosure-ingestion contract | skill | M | mid-term | High | Done — #657 |
| 8 | co-game | Single-file HTML game bundler script | config | M | mid-term | High | Done — #658 |
| 9 | co-abap | Clean ABAP conformance checklist | doc | M | mid-term | High | Done — #659 |
| 10 | co-hr | ISO 30414 taxonomy mapping for `hr-metrics-analysis` | doc | M | long-term | High | Done — #660 |
| 11 | co-news | Corrections / transparent-error workflow | doc | S | mid-term | High | Done — #661 |
| 12 | co-export | Rules-of-origin qualification worksheet | skill | M | long-term | High | Done — #662 |
| 13 | co-news | Style-guide rules as a lint checklist skill | skill | M | mid-term | Medium | Done — #664 |
| 14 | co-export | Second-jurisdiction country-profile skeleton | doc | S | long-term | Medium | Done — #665 |
| 15 | co-game | Scene-management convention over the ECS core | doc | S | mid-term | Medium | Done — #666 |
| 16 | co-design | Vite component playground scaffold | config | M | mid-term | Medium | Done — #669 |
| 17 | co-hr | Competency-modeling skill (SHRM BoK core) | skill | M | long-term | Medium | Done — #667 |
| 18 | co-consult | Engagement kickoff artifact pack (issue tree + hypothesis log) | doc | S | mid-term | Medium | Done — #668 |

Ordering rationale: items 1–3 harden already-shipped flagship capabilities (measurement, posture, supply-chain) that every scaffolded project inherits; items 4–8 close named benchmark-parity holes flagged by the roadmap itself; items 9–12 establish the benchmark anchors for the four variants outside the roadmap matrix; items 13–18 are the strongest Medium-priority items held back only by breadth of benefit.

Execution note: the High-priority rows 1–12 were executed sequentially as the backlog execution series (2026-08-24 → 2026-08-25), one PR per row, PM-verified before each merge. Row 2 landed in two PRs (#651 delivered the SKILL.md via a parallel session's sync after the original dispatch died on an API usage limit; #652 completed registration and mirrors). Row 5 resolved via the documented-boundary option (PDF-only by design, markdown→pptx path documented) rather than a co-deck-local pptx pipeline. The Medium rows 13–18 followed in the same series (2026-08-25) as PRs #664–#669, PM-authored inline during an API usage-limit window (the same battery gates ran before every merge); row 16 (Vite playground) additionally passed a live compiler smoke test into the scaffold's generated dir. All 18 consolidated rows are now Done; the remaining Low-priority items in the per-variant sections stay unsequenced.

---

*Last reviewed: 2026-08-25. Re-run the §1 worksheet when any variant's skill manifest changes (see the maintenance note).*
