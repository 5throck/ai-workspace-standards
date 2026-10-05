# Project Review — templates/co-consult · co-abap · co-develop — 2026-10-05 (scoped)

**Date**: 2026-10-05
**Scope**: templates/co-consult (stable v1.0.0, 12 agents), templates/co-abap (stable v1.0.0, 21 agents), templates/co-develop (stable v1.0.0, 8 agents) — SCOPED mode, 2 waves (4 slots each)
**Method**: machine battery (incl. `validate-variant-claims.ts` per target) + 8 parallel Explore slots (A Architecture / B Standards+Lifecycle / C Automation / D Docs+Security)
**Ratchet note**: the co-deck remediation's contract-truth validator caught **46 findings mechanically** before any agent ran (co-consult 16, co-abap 20, co-develop 10) — the co-deck review's `script-gap` classes are now caught-by-script. Agent findings below are the machine-uncatchable residue.

> Analysis only — no template files modified in this review. All outcomes wired to tickets (Action wiring).

## Baseline (machine battery)

`bun scripts/review-baseline.ts` **7/7 green**. Per-target validator runs (machine-caught, not re-counted below):

| Target | Validator result |
|---|---|
| co-consult | FAIL — 16 findings (roster claims ×5, evidence_models_dir, PENDING_REVIEW, undeclared imports ×3 [docx, mdast-util-from-markdown, yaml], AGENTS.md boilerplate ×6) |
| co-abap | FAIL — 20 findings (roster claim ×1, evidence_models_dir, PENDING_REVIEW, truncated gate title, "bun" imports ×4 [**false positives** — runtime builtin, confirmed by Slots A/C], AGENTS.md boilerplate ×12) |
| co-develop | FAIL — 10 findings (roster claim, raci/gates/evidence paths nonexistent, AGENTS.md boilerplate ×6) |

## Review Results

**Totals (agent findings, deduped)**: co-consult 🔴3 🟡9 🟢8 · co-abap 🔴5 🟡10 🟢8 · co-develop 🔴3 🟡7 🟢8 · cross-cutting 5 (mostly systemic).

### Cross-cutting systemic patterns (all three templates)

| # | Pattern | Evidence (representative) | Class |
|---|---------|---------------------------|-------|
| X1 | **Unattested stable promotion** — all 3 PROMOTION_CHECKLISTs claim stable with 9/10 criteria Pending, empty Review History; co-consult promoted same day as creation (criterion "3 months in beta" impossible), co-abap same-day migration whose ADR-0051 asserts "criteria met" against the empty checklist and cites a CONSTITUTION lifecycle section that doesn't exist, co-develop went review→production in 4 days with **no ADR at all**. No governing migration/grandfather policy exists (ADR-0086 per-asset, postdates; ADR-0020 governs co-abap's conversion, not co-develop's promotion); the "3 months" criterion is generator boilerplate (`scripts/project-to-variant.ts:448`) replicated in 7 variant checklists. | co-consult/abap/develop PROMOTION_CHECKLIST.md:4-27; ADR-0051:12; project-to-variant.ts:448 | systemic + script-gap |
| X2 | **Lifecycle vocabulary unmapped** — variant.json "stable" vs root lifecycle records "production" vs checklists "beta/stable" vs CONSTITUTION Phase A/B/C; zero mapping docs. | docs/lifecycle/README.md:131-135 vs variant.json:5 | script-gap |
| X3 | **i18n-specialist drop-row drift** — present in variant.json/AGENTS.md/lifecycle records but missing from README team tables, agents/README tables, context tables, and phase-definitions in all 3 templates; co-develop's copy has no `phases:` and no dispatch placement anywhere; root lifecycle records undercount (co-consult "11"/10 names, co-abap "20", co-develop "6 agents/3 skills" — record refreshed 2026-09-28 but criteria left stale); co-abap additionally lacks the pm lifecycle record entirely. | co-consult README.md:38-51; co-abap README.md:46-65; co-develop README.md:36-44; docs/lifecycle/templates/*.md | script-gap + one-time |
| X4 | **AGENTS.md skeleton drift beyond the machine's boilerplate findings** — co-abap's file wholesale-replaced the common skeleton (no §4/§5/§8-10; HERMES.md's "§4–5 workflows / §5 plan format / §7 baseline" map points at phantoms); co-consult §3.5 keeps placeholder dispatch rows to nonexistent agents + §9 cites a nonexistent "Subagent Roster dispatch table" + user-guide cites phantom §4.2; co-develop §10 invokes the L0-only `scripts/skill-dependency-analysis.ts` — **all 10 variant AGENTS.md files carry that stale block** (fix belongs at the injection source). | co-abap AGENTS.md (structure); co-consult AGENTS.md:161-168,345; co-develop AGENTS.md:319,334 | systemic + script-gap |
| X5 | **settings.json hygiene not propagated** — co-deck got deduped hooks + guarded graft helpers; co-consult (4 duplicate hook pairs + 6 unguarded graft refs), co-develop (4 pairs incl. one schema-misnested `timeout`, 7 unguarded graft refs + graft MCP entry) did not; co-abap has no duplicates but ships a malformed PostToolUse entry (missing `hooks:[{type:command}]` wrapper — likely dead) and auto-enables third-party MCP servers (`enableAllProjectMcpServers: true`). | co-consult/.claude/settings.json; co-develop/.claude/settings.json:29-185; co-abap/.claude/settings.json:62-65 | one-time |
| X6 | **Validator batch-2 hardening queue** — script-gap candidates surfaced by this wave: checklist-criteria-vs-status (+ same-day-promotion attestation requirement), root-lifecycle-record claims scan, roster table-row completeness, `used_by_agents` ⊇ `required_skills`, phase-model cross-doc consistency + `phases:` range/contradiction scan, spawn-target existence, scaffold-layout-aware path model (common-flat vs variant-subdir), SCRIPTS.md documented-flags vs argv, runtime-builtin allowlist (kills the 4 `bun` false positives), cross-layer relative imports ⇒ `external[]` declaration, doc-referenced directory existence (deliverables/, python helpers), PROMOTION_CHECKLIST cited-key existence (`phaseAComplete`), settings hook schema/duplicate lint, skill_manifest[].version vs SKILL.md frontmatter, validate-docs-links scope extension to templates/*/docs, skill-graph generate/verify divergence (co-develop ships README-as-agent nodes committed *after* the generator fix — verifier's scope derivation lacks the exclusion). | 16 candidates across the slot reports | script-gap |

### 🔴 co-consult Critical

| # | Issue | Slot | File:Line | Class | Fix |
|---|-------|------|-----------|-------|-----|
| CC1 | HWP/HWPX report pipeline dead in any scaffold: hwp-extract.ts + hwpx-generate.ts spawn `python/extract_hwp.py` / `generate_hwpx.py` which don't ship (exist only in Projects/co-consult + co-newbiz); SCRIPTS.md registers both active v1.0.0; 3 skills instruct agents to run them (government submission format) | B, C, D | scripts/co-consult/hwp-extract.ts:51, hwpx-generate.ts:53 | script-gap (spawn existence) + one-time | Ticket T-f |
| CC2 | Flagship `md-to-report.ts` fails at import on a fresh scaffold (docx, mdast-util-from-markdown, yaml declared nowhere; no template package.json; common ships js-yaml only) — the variant's only DOCX/PDF path | A, C (machine caught imports) | scripts/co-consult/md-to-report.ts:16-22 | script-gap (caught) | Ticket T-g |
| CC3 | Same-day `initial → stable` promotion, zero criteria met, no ADR anywhere, lifecycle record created retroactively with no migration mention (X1 instance) | A, B | variant.json:8-12; PROMOTION_CHECKLIST.md:4-27 | systemic | Ticket T-a |

### 🟡 co-consult High

| # | Issue | Slot | File:Line | Class |
|---|-------|------|-----------|-------|
| CH1 | Silent content loss in the report generator: CommonMark parsing (no GFM) makes pipe tables paragraph text, and the docx `Table` is cast into `Paragraph` options (ignored) — consulting deliverables lose every table even after the parse fix | C | md-to-report.ts:24,410-444 | script-gap |
| CH2 | `skipFirstH1 = true` hardcoded → **every** H1 dropped from body/TOC, not just the cover | C | md-to-report.ts:284,353 | one-time |
| CH3 | workspaceRoot/fontDir resolve one/two levels ABOVE the project; relative inputs "File not found", `--out` writes outside the project, vendored fonts unreachable | C | md-to-report.ts:595,603-604,632 | script-gap |
| CH4 | Per-file render failures warn-only → exit 0 with zero deliverables produced | C | md-to-report.ts:653-656 | script-gap |
| CH5 | No `error` handlers on any of 7 python spawns — missing python3 = uncaught crash or hung pipeline promise | C | financial-*.ts:47-83, hwp-*.ts:54-80 | script-gap |
| CH6 | `used_by_agents` contradicts agent frontmatters: company-intelligence required by data-analyst/industry-expert/sme but manifest says [pm, strategy-analyst]; mece-logic-auditor reverse drift | A | variant.json:309-331 vs agents/*.md:23 | script-gap |
| CH7 | Process models unreconciled: S1-S4 stages (all PENDING_REVIEW) vs phases 0-6 vs README 5-step; strategy-analyst `phases:[1]` yet accountable S2/S3 and owner S1-S3; phase-definitions never mentions stages.yaml | A, B | stages.yaml; raci.yaml; agents/strategy-analyst.md:20 | script-gap |
| CH8 | README tier column contradicts frontmatter (PM "high" vs Medium; data-analyst "low" vs Medium; phase-definitions repeats the data-analyst error) | D | README.md:40,43; docs/phase-definitions.md:36,102 | script-gap |
| CH9 | Three docs, three phase models — user-guide omits Phase 1.5 and renames phases; context.md assigns different Phase 5/6 owners than phase-definitions.md (a PM runs `/sync` at different steps depending on which file they read) | D | user-guide.md:108-116; context.md:139-152; phase-definitions.md:9-18 | script-gap |

🟢 co-consult Moderate: financial-pipeline output dir `scripts/deliverables` contradicts documented `deliverables/<company>/` (C7) · financial-report crashes on missing KPI (`?.` misuse, roic/de_ratio) (C8) · winQuote applied to data args but not the script path — breaks on Windows paths with spaces (C10) · stale DART snapshot skip (C11) · dead TOC code (C13) · UTC date stamps for KST (C14) · SCRIPTS.md `--output` flag doesn't exist (C15) · requirements.txt has no installer wiring (C16) · single gate loosely bound + procedure criterion without gate (B C-4/M8) · skill version drift variant.json 1.3.0 vs frontmatter/registry 1.3.1 (only entry carrying a version key) (M1/C-5) · `optional: []` notes-only contract vs siblings populating optional (M4) · 1/18 skill lifecycle records (M6 — convention ambiguity with SKILLS.md, see co-develop D-4) · insight-synthesis/mece phase-range overreach (M2/M3) · PROMOTION_CHECKLIST cites nonexistent `phaseAComplete` key (C-🟡6) · context.md stale vs md-to-report v1.1.0 PDF capability (C-🟡7) · governance stage model referenced by no doc (C-🟢1) · AGENTS.md Version History stale (C-🟢2).

### 🔴 co-abap Critical

| # | Issue | Slot | File:Line | Class | Fix |
|---|-------|------|-----------|-------|-----|
| AB1 | **Three mutually contradictory phase numbering systems in the dispatch contract**: sap-investigator frontmatter `phases:[3]` vs its own "Dispatch in Phase 1" prose vs pipeline_order position 1; variant.json notes use a third scheme (write=2, verify=3) contradicting both the 6-step orchestration and phase-definitions' Agent Phase map; security-monitor `phases:[0,5]` — phase 0 doesn't exist in the documented scheme | A, D | agents/sap-investigator.md:3; variant.json:357; agents/security-monitor.md:3 | script-gap (range/contradiction lint) + needs human ruling | Ticket T-k |
| AB2 | `setup.ts` reports PASS on failed installs: uv branch runs `uv install` (nonexistent subcommand — should be `uv pip install`) so Python deps **always fail silently on uv machines**; venv created but never targeted; `bun install`/`brew install rtk`/`cargo install` results unchecked before unconditional `pass()` | C | setup.ts:189-192,220-232,419-423 | script-gap | Ticket T-i |
| AB3 | setup copies `.env.sample` → `.env` (SAP credentials) then runs `git add -A` + commit — and **no .gitignore ships in the template or common** → initial commit can contain live secrets with no undo | C | setup.ts:169-171,474-478 | script-gap (cross-file invariant) | Ticket T-i |
| AB4 | vsp binary supply-chain contradiction: installer downloads+executes from `oisee/vibing-steampunk` while context.md/LICENSE tell users to hand-download from `5throck/vsp` — two origins for a privileged binary; installer checksum is fail-open (missing `.sha256` → warn + install anyway), unpinned `releases/latest`, no fetch timeout, no `res.ok` check | D, C | install-vsp.ts:8,16,79-132; co-abap.context.md:36 | script-gap (partially) | Ticket T-j |
| AB5 | Default-path global tool install contradicts the variant's own baseline: `brew install rtk` / `cargo install --git …rtk` run unconditionally (remote code compile, writes outside project) while the same script and AGENTS.md mandate "never install tools without security review and explicit user approval"; superpowers clone is the only gated one | D, C | setup.ts:385,398-406,415-427 | script-gap (install-command scan) | Ticket T-j |

### 🟡 co-abap High

| # | Issue | Slot | File:Line | Class |
|---|-------|------|-----------|-------|
| AH1 | QA chain ungated + self-approval: the variant's defining mandatory chain (SyntaxCheck→UnitTests→Coverage≥70%→ATC zero P1) and user-approval gate have no decision records; the only gate's decider is `code-writer` — the implementer reviewing its own pre-release work (docs give QA to test-runner, sign-off to Technical Lead) | B, A | gates.yaml:7; procedures/custom-dev-delivery/schema.yaml:69-71; phase-definitions.md:36-37,80-81 | script-gap (gate coverage) |
| AH2 | Four Phase-3 implementation specialists (fiori-developer, form-expert, interface-expert, gui-scripter) have zero attributed skills — in no used_by list, no required_skills, abap-dev body ignores their domains; yet optional[] presents them as dispatchable | A | variant.json:157-172,349-356 | script-gap (zero-attribution warning) |
| AH3 | Real cross-layer coupling undeclared: dispatch*.ts/retry-handler.ts import `../dispatch.ts` etc. — resolves only post-scaffold (common flat-sync); validator's bare-import check can't see it while flagging the 4 harmless `bun` builtins | A, C | dispatch.ts:21, dispatch-parallel.ts:19, dispatch-serial.ts:20, retry-handler.ts:22 | script-gap (external[] rule) |
| AH4 | `deliverables/` tree referenced by phase-definitions (5-stage traceability matrix) and scaffolded by new-requirement.ts — doesn't exist in the template; sibling co-consult ships one | A, C | phase-definitions.md:65-81; new-requirement.ts:104-118 | script-gap |
| AH5 | AGENTS.md skeleton divergence (missing §4/§5/§8-§10; shared HERMES.md map references phantoms; execution-plan contract absent while the header still claims to be its SSOT) — the semantic residue behind the machine's ×12 boilerplate findings | A, D | AGENTS.md:10,14-459; HERMES.md:11,43 | systemic (X4) |
| AH6 | vsp-publish publishes nothing silently: sourceDir off-by-one (`scripts/` instead of project root) + 7 of 11 asset entries don't exist (docs templates, .mcp.json.sample, flat script paths) — every asset warn-skips; header claims the list was already corrected | C, D | vsp-publish.ts:20,33-45,71-74 | script-gap (scaffold-layout model) |
| AH7 | new-requirement.ts lies about success: templates + RTM index don't ship → 3 warn-skips then "✓ Created REQ-001 … RTM row added" (false) | C | new-requirement.ts:104-118,169 | script-gap |
| AH8 | Stale flat script paths in docs and usage headers: abap-dev SKILL.md:231,271 + context.md say `scripts/vsp-audit.ts` (actual `scripts/co-abap/`); 5 scripts' usage strings say flat paths, 2 say subdir | C, D | skills/abap-dev/SKILL.md; setup.ts:25 et al. | one-time |
| AH9 | Phantom slash commands `/triage` `/transport` `/post-write` documented as "registered as Skills" in 9 places across 5 files — no definition surface exists | D | README.md:24,107; user-guide.md:12-81; context.md:164-168; dump-monitor SKILL.md:64 | script-gap (command existence) |
| AH10 | Stage model compresses 6 procedures into 2 misleadingly-titled stages; transport release owned by code-writer in stages.yaml vs devops-admin's documented role; phase-definitions' 6-step mapping never mentions S1/S2 | B | stages.yaml; raci.yaml:5-28; phase-definitions.md:46-61 | script-gap |

🟢 co-abap Moderate: README skills omits `abap-code-review` (13th, added post-README) (A-4/D) · README PM/devops-admin tier errors + user-guide example violates the Tier Ceiling Rule it teaches (A-🟡3) · malformed PostToolUse hook entry missing wrapper → sync-md step dead (A-🟡7 — fold into T-d) · third-party MCP servers auto-enabled (`enableAllProjectMcpServers`) — deliberate but undocumented trust decision (A-🟡8) · `variant_scoped_skills` registry lacks the co-abap key (leak protection silently not covering the largest scoped inventory; co-export/co-hr too) (M1) · pm lifecycle record missing 20/21 (M2/A-5) · scratch-cleanup `--days` default 7 vs documented 30 for archive + NaN acceptance (A8/A11) · purgeTemp EISDIR on old directories (A10) · Windows python detection dead-end (A9) · `install-bun.ts` dead logic + advisorial curl text (A13) · vsp.exe vs ./vsp naming (A-🟢1) · security.md post-scaffold link (annotated; A-🟢2) · DART-style minors A12/A14/A15.

### 🔴 co-develop Critical

| # | Issue | Slot | File:Line | Class | Fix |
|---|-------|------|-----------|-------|-----|
| CD1 | **Five incompatible phase models across six surfaces**: README §B numbers 1-6, context.md numbers the same six 0-5, user-guide §4 uses 0-5 while §3 uses 7-phase numbers (self-contradiction), phase-definitions/AGENTS/frontmatter use 7-phase 0-6 with different names, and procedures schemas use a fifth (feature-implementation=3, citing its own "phase 2 design gate"); variant.json skill_manifest only coheres with the 7-phase model | D, A | README.md:63-68; context.md:96-103; user-guide.md:58-91; procedures/*/schema.yaml:6 | script-gap (phase-model consistency) | Ticket T-m |
| CD2 | Handoff spec's machine-readable chain dispatches phantom agents: `from/to_agent: "sd-analyst"` and "Business Analyst" exist nowhere in the 8-agent roster; heading and JSON disagree with each other; chain omits 4 real agents; `_ko` mirror carries the same | D | docs/handoff-spec.md:41-74 (+_ko) | one-time (old-generation leftover) | Ticket T-m |
| CD3 | Promotion unattested — worst of the three: checklist all-Pending with empty history, `Beta Since` recorded as the promotion day itself, lifecycle record shows `- → review → production` in 4 days (a beta phase never existed), and **no ADR confers legitimacy** (ADR-0020 governs co-abap's conversion; ADR-0051 supersedes it) (X1 instance) | A, B | variant.json:8-13; PROMOTION_CHECKLIST.md:4-27; docs/lifecycle/templates/co-develop.md:11-13 | systemic | Ticket T-a |

### 🟡 co-develop High

| # | Issue | Slot | File:Line | Class |
|---|-------|------|-----------|-------|
| DH1 | Committed skill-graph is not generator output: README/README_ko ship as `type:"agent"` nodes with zero edges — committed 2026-09-25, two days AFTER the generator's README-exclusion fix (a09c7d3d, T-20260923-001's exact bug class); `verify-skill-graph.ts --scope co-develop` passes because the verifier's scope derivation lacks the exclusion — generate/verify have diverged | A | docs/skill-graph.json; generate-skill-graph.ts:558-563 | script-gap (verifier divergence) |
| DH2 | Root lifecycle record attests a template that never existed: "All 6 development agents / 3 skills" vs actual 8/4 — refreshed 2026-09-28 but criteria left stale; a PM-gateway template's production record omits pm | B | docs/lifecycle/templates/co-develop.md:21-22 | script-gap |
| DH3 | `.claude/settings.json`: 4 duplicate hook pairs (incl. divergent-timeout TaskCompleted audit ×2 and a misnested `timeout`) + 7 unguarded graft-helper invocations + graft Bash allows + .gemini graft MCP entry — co-deck's guarded/deduped pattern not propagated (X5 instance) | C, D | .claude/settings.json:29-232 | one-time |
| DH4 | AGENTS.md mixed state: ADR-0090 thin-dispatcher links point at `docs/governance/agents/*` that the variant tree never received (common has them; co-safety ships its own) — distinct from the machine's boilerplate finding (X4 instance) | B | AGENTS.md:96,197,201 | script-gap |
| DH5 | i18n-specialist wired into no dispatch model: absent from pipeline_order, optional, notes, phase-definitions, all 4 roster tables; no `phases:` frontmatter; code-writer's `phases:[3,4]` disagrees with AGENTS/phase-definitions ("4") — 3-way (X3 + phase model) | A, B, C, D | variant.json:116-128; agents/code-writer.md:20 | script-gap |
| DH6 | Dead `bash scripts/audit.sh` ×3 in test-runner.md (the QA gate command — no such file; violates the variant's own ADR-0036 .ts-only rule) and stack-setup.md built around phantom `setup.sh/.ps1` ×6 (trigger story + Phase 6 persistence; the 2026-09-12 remediation fixed this class in live-docs but missed agent files; co-game has the same lineage copy) | C | agents/test-runner.md:54,61,73; agents/stack-setup.md:41-199 | script-gap (referenced-script existence) |

🟢 co-develop Moderate/Low: skill lifecycle 1/4 + swe-solve record's false "[x] registered in VERSION_MANIFEST" criterion + SSOT ambiguity vs SKILLS.md (D-4/M4) · generate-skill-graph silently skips missing raci/gates and validate-raci returns a vacuous OK (D-5 — feeds X6) · swe-solve "4-stage" README vs 5-stage skill (D-2/M5) · swe-solve prerequisite test-runner.ts is L0-only, unsatisfiable in an adopted project (M6) · 120 post-promotion commits with zero version movement + stale acceptance criteria (M7) · README/docs reference CLAUDE.md/GEMINI.md/context.md/`/meeting`/agent-lifecycle-manager/`_examples` that don't ship, while the shipped `/security-check` command and 3 platform-only skills are documented nowhere; platform_parity "skip" flags vs all-4-mirrored reality (M5/L3) · agents/README.md literal `\n` corruption collapsing the Handoff Specification section + wrong relative link (M6/L2) · user-guide 2-vs-3 QA iterations self-contradiction (M3) · duplicate `WORKSPACE-MANAGED: tier-model-mapping` zone name (L5) · skill_manifest vs procedure-schema skill pairings disagree and skill-graph emits a duplicate edge (G3) · `bun run agent-create` vs `agent:create` (G4) · handoff-spec_ko/privacy-checklist_ko untracked by hash sync (Low) · asyncRewake confirmed NOT a typo (same field in common + co-deck) · misplaced i18n lifecycle record (root instead of common layer) (Low).

### ✅ Strengths (cross-template)

- **HERMES.md byte-identical to common in all three**; extends-stub discipline textbook (pm/i18n-specialist 16-line frontmatter-only stubs); zero L1-only assets duplicated anywhere.
- **Registry three-way consistency held in both scripted suites**: co-consult 9 scripts = manifest = SCRIPTS.md with matching @versions; co-abap 12 + atc-rulepack.json likewise; skills[] = dirs = SKILLS.md in all three with version agreement (except co-consult's single 1.3.0).
- **skill-graph.json genuinely generated and verifier-green in all three scopes** (co-develop's README-node issue is a verifier divergence, not hand-editing).
- **co-abap's ADR-0050 inheritance architecture verified end-to-end against the real scaffold** (common flat-sync + variant overlay make `../dispatch.ts` resolve; wrapper signatures match common).
- **co-consult has zero network calls** in its suite; LibreOffice discovered locally with timeout + escaped paths; winQuote/shellEscapePath show real injection awareness. **co-abap network confined to the three installers**; vsp-audit is an exemplar (strict integrity, offline, exit discipline — smoke-run PASS).
- **co-abap's docs/phase-definitions.md is the best orchestration doc in the fleet** (explicit step↔phase mapping, PM facilitation matrix) — the contradictions live in files that ignore it.
- **co-develop's zero-script posture is deliberate and coherent** (4 stable siblings share it; propagation-map.json documents the fork model); every runnable scripts/ path resolves in common.
- **Language policy clean**: zero Hangul in scripts across all three; _ko hash pairs pass verify-readme-sync (13/13 fleet); Korean limited to sanctioned samples.
- **No secrets, no absolute machine paths** in any config; deny-lists sane; skill mirrors byte-identical across 5 platforms in all three.
- **Per-agent lifecycle records complete** in co-consult (12/12) and co-develop (8/8); co-abap 20/21 (pm missing — ticketed).

## Domain summary

| Slot | Verdict |
|------|---------|
| A Architecture | Contract structure sound (stubs, zones, mirrors, registries); the defects are **semantic contradictions inside the contracts** (co-abap's 3 phase systems, used_by vs required_skills, co-develop's unaccounted i18n agent) and the unattested-promotion governance gap. |
| B Standards + Lifecycle | The wave's heaviest finding: **stable status is procedurally unverified in all three** (empty checklists, no attestation policy, ADR-0051 asserting what didn't happen). Root lifecycle records and roster tables systematically undercount post-i18n-delivery. |
| C Automation | co-consult: two broken deliverable chains (HWP, DOCX) with **silent content loss** bugs; co-abap: installer suite that false-greens and risks committing `.env`; co-develop: coherent zero-script posture with stale agent-doc commands. Validator false positive (`bun`) + blind spots (spawn targets, cross-layer imports) confirmed. |
| D Docs + Security | No secrets anywhere; the exposure is **dispatch-breaking doc drift** (co-develop's 5 phase models, phantom agents/commands/sections in all three) and co-abap's supply-chain trust decisions (vsp repo split, default RTK install). |

**Root cause**: generation-1 variants were promoted before the lifecycle machinery existed (beta-lifecycle tracking shipped 2026-07-11; the beta-first convention arrived with co-safety 2026-08-26), and per-agent additions (i18n-specialist, abap-code-review, swe-solve 1.1.1) never propagated to human-facing rosters. Everything machine-checkable about these classes is now in the batch-2 hardening queue (X6).

## Action wiring

Routing: **no in-session fixes** (consistent with the co-deck review; Design Gate + /sync apply). 46 machine-caught findings are already closed by the standing validator. Agent findings wired to 11 tickets (created 2026-10-05):

| Ticket | Priority | Scope |
|--------|----------|-------|
| T-20261005-021 | high | X1+X2: migration-attestation policy (ADR) + reconcile 3 unattested stable promotions + status↔phase vocabulary mapping |
| T-20261005-022 | high | X6: validator-hardening batch 2 (16 check candidates listed above) |
| T-20261005-023 | normal | X4: regenerate variant AGENTS.md onto common skeleton (injection-source §10 fix, placeholder rows, phantom refs, co-abap skeleton decision) |
| T-20261005-024 | normal | X5: settings.json hygiene propagation (co-consult, co-develop; co-abap malformed entry) |
| T-20261005-025 | normal | X3: i18n-specialist roster-surface reconciliation ×3 templates + co-abap pm record + lifecycle-record count refreshes |
| T-20261005-026 | urgent | co-consult CC1: promote the 2 python helpers or deprecate the HWP pipeline + update 3 skills |
| T-20261005-027 | high | co-consult CC2+CH1-CH5: report-chain repair batch (package.json, GFM tables, H1 bug, paths, exit codes, spawn handlers) |
| T-20261005-028 | normal | co-consult contract curation: used_by reconciliation, optional[], gate/stage↔phase mapping, README tiers, minor hygiene |
| T-20261005-029 | urgent | co-abap AB2+AB3: setup.ts repair (uv/venv, exit-code honesty, .gitignore before git add -A, Windows detection) |
| T-20261005-030 | high | co-abap AB4+AB5: supply-chain (vsp repo reconciliation, fail-closed checksums, version pin, flag-gate RTK) |
| T-20261005-031 | high | co-abap AB1+AH1/AH10: phase-model unification + gate coverage (QA chain, decider separation) + stages retitling |
| T-20261005-032 | normal | co-abap AH4-AH9 + moderates: vsp-publish fix, deliverables/ tree, stale paths, phantom commands, registry key, roster rows |
| T-20261005-033 | high | co-develop CD1+CD2+DH5+DH6: phase-model unification, handoff chain rewrite, i18n wiring, agent-doc command repairs |
| T-20261005-034 | normal | co-develop DH1/DH2 + moderates: skill-graph regenerate + verifier divergence (with T-20261005-022), lifecycle record refresh, skill-lifecycle SSOT decision, version-bump policy, roster/README repairs |

Related open tickets from earlier today: T-20261005-019 (co-deck generator guards), T-20261005-020 (co-design same-class drift — co-consult/co-abap/co-develop's validator failures extend that fleet-cleanup ticket's scope).

## Verification

No template files modified in this session. Machine truth at review time: baseline 7/7 green; validator per-target FAIL counts (16/20/10) are the machine's live detection of the X-family classes — they remain FAIL until the tickets land, which is the intended ratchet posture (the failures now name exactly what the tickets fix).

---

## Verification (2026-10-05/06 remediation — all tickets landed)

**Remediation**: governed by `docs/designs/2026-10-05-consult-abap-develop-review-remediation-design.md` (spec `2026-10-05-consult-abap-develop-review-remediation-design`, registered) with pre-written **ADR-0099** (template migration admission policy) so the three PROMOTION_CHECKLIST reconciliations cite one policy. Executed by 6 exclusive-ownership agents (co-consult scripts/contract, co-abap scripts/contract, co-develop full, validator batch 2) after two rate-limit interruptions (resumed 2026-10-06); coordinator closed residuals inline (skipFirstH1 completion, co-abap .gitignore managed block, vsp repo reference, vocabulary mapping, intentional-duplicate marker).

**Machine battery**: `bun scripts/review-baseline.ts` → **7/7 green**. Per-target `validate-variant-claims.ts` flipped from FAIL (16/20/10) to **PASS 0 findings** on all three (v1.2.0: bun builtin allowlist + checks k–r). `validate-templates.ts` 0 errors; `typecheck.ts` 0 errors; `verify-skill-graph.ts --scope` ×3 PASS after regeneration (README-as-agent nodes eliminated from the scope pipeline: co-consult 57, co-abap 62, co-develop 31 nodes); `verify-readme-sync.ts` all pairs valid; `audit.ts` all checks passed.

**Spot checks (all zero)**: PENDING_REVIEW residue, stale 7/11/20-agent counts, `audit.sh`/`setup.sh` in co-develop agent docs, `sd-analyst`, live `/meeting` instructions, unguarded graft-helper invocations (7/7 guarded in both settings files).

**Policy outcome**: the three unattested stable promotions are now procedurally honest — beta-window criteria explicitly waived per ADR-0099 (not silently "Pending", not falsely "met"), ratification rows recorded, and the state is machine-enforced (checks k/l fail any future stable variant with unfilled checklists or unattested same-day promotions).

**Supply-chain outcome**: canonical vsp repo verified by API evidence (`oisee/vibing-steampunk` v2.60.0 — `5throck/vsp` is 404), pinned + fail-closed checksums; `.gitignore` now ships in co-abap so `setup.ts`'s `git add -A` cannot commit `.env`.

**Deferred / noted**: LICENSE copyright wording (legal decision, provenance covered by context.md note); validator batch-3 candidates (SCRIPTS.md flag validation, settings hook lint, phase-model prose lint, validate-docs-links scope to templates/*/docs — in design D9's queue); co-deck/README "5 parallel" wording kept (truthful — the skill dispatches 5 subagents); md-to-report's unused `--font-dir` banner flag (cosmetic, flagged for next touch).

**Ticket wiring (final)**: T-20261005-021…034 → **done** (14/14 with per-ticket results). Working tree uncommitted — land through `/sync`.
