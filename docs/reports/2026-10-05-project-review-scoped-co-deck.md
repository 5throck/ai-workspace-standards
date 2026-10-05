# Project Review — templates/co-deck — 2026-10-05 (scoped)

**Date**: 2026-10-05
**Scope**: templates/co-deck (L2 variant, v0.2.3, stable since 2026-08-30) — SCOPED mode per user request
**Method**: 4 parallel Explore review slots (A Architecture+Scaffolding / B Standards+Lifecycle / C Automation / D Docs+Security) + machine battery
**Mode rationale**: user-requested blast radius is the single co-deck template; smallest covering mode selected.

> Analysis only — no template files were modified in this review. All outcomes wired to tickets (see Action wiring).

## Baseline (machine battery)

`bun scripts/review-baseline.ts` — **6/6 green**:

| Validator | Result |
|---|---|
| audit.ts (workspace standards) | ✅ PASS |
| validate-templates.ts (template/variant integrity + L1 parity) | ✅ PASS |
| verify-scripts.ts --verify (SCRIPTS.md registry sync) | ✅ PASS |
| agent-lifecycle-audit | ✅ PASS |
| skill-lifecycle-audit | ✅ PASS |
| propagate-to-templates --check-drift | ✅ 6 tolerated (gemini-settings class) / 0 unexpected |

Every finding below is therefore something the machine battery does **not** catch — which is exactly why the `script-gap` count is high (24 of 39 findings).

## Review Results — templates/co-deck — 2026-10-05

**Totals**: 🔴 Critical 6 · 🟡 High 14 · 🟢 Moderate 19 · ℹ️ Low 4 · ✅ Strengths 10
**Class distribution**: `script-gap` 24 · `one-time` 15 · `systemic` 1 (a variant can be simultaneously machine-detectable in part; the class records the primary driver)

### 🔴 Critical (fix immediately)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | `--auto-calibrate` mode always crashes: TDZ ReferenceError — `workspaceRoot` used before its declaration 4 lines later; every invocation of the SCRIPTS.md-documented flag exits 1 | C | scripts/co-deck/gen-slides-pdf.ts:1551 (decl at :1555) | script-gap | T-20261005-006 |
| C2 | Runtime deps of 6 load-bearing scripts (`pdf-lib`, `@pdf-lib/fontkit`, `fflate`, `@resvg/resvg-js`, `puppeteer-core`, `playwright`) are declared in **no package.json** a scaffolded project resolves; the primary PDF path fails at import on a fresh scaffold despite SCRIPTS.md's "run `bun install`" instruction | C | templates/co-deck (no package.json); gen-slides-pdf.ts:29-31, html-to-pdf.ts:8, diagram-helpers.ts:9, download-font.ts:12 | script-gap | T-20261005-007 |
| C3 | `docs/phase-definitions.md` describes a pipeline with **no existing agents** (analyst, deck-architect, slide-designer…) and a "Phase 1.5 Storyline Gate" contradicting the real Gate 1.5 = Source Verification; AGENTS.md:20 names this file the phase authority, so a PM following it mis-dispatches | B, D | docs/phase-definitions.md:8-15 | script-gap | T-20261005-010 |
| C4 | `betaLifecycleSummary` is stale and contradicts stable status (`lastSynced` 2026-07-11, `promotionEligible: false` vs stable 2026-08-30 in the same file); convention is `null` for stable variants (co-design precedent); no tool maintains it post-promotion | B | variant.json:399-406 | script-gap | T-20261005-008 |
| C5 | PROMOTION_CHECKLIST.md still describes the **beta-era variant** (v0.2.1, all 10 criteria Pending, "earliest promotion 2026-09-17" contradicted by the actual 2026-08-30 promotion, 5-theme rows mislabel styles, Review History empty); variant.json:398 still points to it as the governance record | B, D | PROMOTION_CHECKLIST.md:4-5,13,18,28,42 | script-gap | T-20261005-008 |
| C6 | Governance scaffold is disconnected from the real 11-stage pipeline: stages.yaml defines only S1–S4 (all `PENDING_REVIEW`, S1 "Deck Source Research" owned by `version`); gates.yaml binds **all five gates to S2 with decider `version`** and two titles are truncated mid-word; skill-graph.json propagates the wrong model as nodes | B, D | process/stages.yaml; decisions/gates.yaml:29,41; governance/raci.yaml | script-gap | T-20261005-010 |

### 🟡 High (fix within 1 week)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | Agent roster claims "13" but 14 exist (i18n-specialist, added 2026-09-25/10-01, missing from description, README ×3, README_ko, agents/README index, context.md:530; also absent from pipeline/handbook/used_by lists with no explanatory note) | A, B, D | variant.json:3; README.md:10,14,30; agents/README.md:3,9-21 | script-gap | T-20261005-009 |
| H2 | `theme_manifest` stale and self-contradictory: `available`/`default` hold **style** names (premium-dark…), notes say "Default theme is pitch-enhanced"; 6 actual themes (outline, outlook, pitch, pitch-enhanced, vertical, zen) and 6 styles (incl. white-bubble) vs 5 listed; THEMES.md/themes-manifest.js (updated 2026-10-05) are current — variant.json alone lags | A, B, D | variant.json:366-381 | script-gap | T-20261005-011 (+016) |
| H3 | AGENTS.md carries pre-ADR-0090 boilerplate: full §8/§9/§10 (common reduced these to pointers), missing §7 "Encoding Vigilance"/"Abuse Pattern Detection" bullets, still instructs retired `/meeting` invocation (:327; README.md:90 too), §3.5 placeholder roles for agents that don't exist, §3 subsections out of order | A | AGENTS.md:179-188,291-446 | script-gap | T-20261005-014 (check) + T-20261005-015 (fix) |
| H4 | Five live references to the promoted-away `skills/handbook/SKILL.md` path (promoted to common 2026-08-30; path dead in template and in every scaffolded project) | A | AGENTS.md:228; docs/user-guide.md:67; docs/user-guide_ko.md:70; docs/co-deck.context.md:87,533 | script-gap | T-20261005-015 |
| H5 | Phantom paths/rows: AGENTS.md:295 links `docs/VERSION_MANIFEST.md` (doesn't exist in template or common); AGENTS.md:333 + context.md point to `.claude/skills/agent-lifecycle-manager` (nonexistent); context.md lists a local `skills/graft/SKILL.md` (workspace-only); real skills `slide-layout-gate`/`presenter-mode` missing from context.md's table | D | AGENTS.md:295,333; docs/co-deck.context.md (skills table) | script-gap | T-20261005-015 |
| H6 | README skills section lists a **`measure` skill that doesn't exist** (measure is an agent; the skill is `prep-pdf`); user-guide.md:38 maps task→agent `measure`→skill `measure`; `slide-layout-gate` missing from README's skill list | B, D | README.md:59; docs/user-guide.md:38 | script-gap | T-20261005-015 |
| H7 | Gate-model contradictions across three docs: agents/README "Gates 1.5, 2, 5 require approval" vs user-guide "mandatory 2, 5; optional 1.5, 3, 4" vs context "approval gates at 2, 3, 5" — user-guide's is the credible one (source-verifier is `--skip-verify` skippable, so Gate 1.5 cannot be a hard gate) | D | agents/README.md:52; docs/user-guide.md:20,85; docs/co-deck.context.md (tech-stack) | systemic | T-20261005-015 |
| H8 | README/README_ko contradict their own Stable badge: "✅ Stable — v0.2.3" at :9 vs "This is a beta variant" :18 and "⚠️ Beta variant — not for production use" block :98-104 (updated 2026-09-06, *after* promotion); readme-lifecycle-audit.ts v1.0.4 exists but doesn't check status wording | B, D | README.md:9,18,98-104; README_ko.md:11,~99-105 | script-gap | T-20261005-009 |
| H9 | Root lifecycle record's acceptance criteria are stale inventories: "11 deck agents" (14 actual), "8 skills" (10), "5 themes" (6) | B | docs/lifecycle/templates/co-deck.md:21-24 | one-time | T-20261005-009 scope note |
| H10 | CRLF frontmatter silently resets theme/style to defaults in both PDF-path scripts (`/^---\n…/` fails on `\r\n` → `{}` → silent fallback to pitch-enhanced/premium-dark); a Windows-saved lecture-profile renders the whole deck in the wrong theme; build-theme-deck's parser handles CRLF correctly (3 parsers, 1 broken) | C | gen-slides-pdf.ts:65,1572-1573; estimate-layout.ts:51,484-485 | script-gap | T-20261005-017 |
| H11 | snapshot.ts never sets a non-zero exit (missing inputs "skipped" with exit 0; failed `--restore` exits 0) **and** writes a wrong restore path (`bun scripts/snapshot.ts` vs actual `scripts/co-deck/snapshot.ts`) into every generated VERSIONS.md | C | scripts/co-deck/snapshot.ts:61,76,132,191-193,265 | script-gap | T-20261005-017 |
| H12 | download-font.ts supply-chain hardening: unpinned `releases/latest`, no checksums, partial extraction exits 0 ("missing weight surfaces later as PDF font fallback"), default writes outside the project (`~/Library/Fonts`), spoofed UA, Korean console output (AGENTS.md §7 English-only), stale header usage path | C, D | scripts/co-deck/download-font.ts:5,23-78,29,89-95,138,161-172,181-248 | script-gap | T-20261005-017 |
| H13 | html-to-pdf.ts orphans a headless Chrome + listening Bun server on failure: `process.exit(1)` inside catch (:424-434) bypasses `finally`, so `browser.close()`/`server.stop()` never run | C | scripts/co-deck/html-to-pdf.ts:424-434 | one-time | T-20261005-017 |
| H14 | watch-deck.ts reports a signal-killed build as success: `proc.exitCode || 0` coerces `null` (signal termination) to 0; recursive-watch fallback also misses async `fs.watch` error events | C | scripts/co-deck/watch-deck.ts:94,184-231 | one-time | T-20261005-017 |

### 🟢 Moderate (fix within 2 weeks)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | `process_manifest.evidence_models_dir: "evidence-models/"` points at a nonexistent dir (fleet-wide field, only co-safety implements it); `country_config.profiles_dir` likewise missing (benign while `supported: []`) | A, D | variant.json:412,415 | script-gap | T-20261005-011 |
| M2 | Deprecated `measure-layout.ts` still instructed by the active theme-authoring skill + 5 platform mirrors, contradicting script_manifest/SCRIPTS.md/context.md | B, C | skills/theme-authoring/SKILL.md:91 (+.claude/.codex/.gemini/.agents/.hermes copies) | script-gap | T-20261005-015 |
| M3 | variant.json notes claim gen-slides-pdf "v1.7.0" vs actual `@version 1.9.0` (script header + SCRIPTS.md agree on 1.9.0) | B | variant.json:380 | one-time | T-20261005-016 |
| M4 | SCRIPTS.md drift: claims a vendored `extract_slidedata.mjs` copy at scripts/ root (none exists), documents `build-theme-preview [--all]` (flag unsupported), deps table omits `puppeteer-core` while the html-to-pdf entry says "using Puppeteer" | C | scripts/co-deck/SCRIPTS.md:27-39,77,84,97-101 | script-gap | T-20261005-018 |
| M5 | `bun run test:visual` / `test:smoke` referenced by baselines README + visual-regression test but defined in no package.json | C | docs/html-themes/baselines/README.md:47-106; tests/theme-visual-regression.test.ts:31-32 | script-gap | T-20261005-018 |
| M6 | Stray `docs/html-themes/baselines/outlook/` directory (typo of `outline`; not a registered theme; pollutes any fs-derived baseline logic) | C | docs/html-themes/baselines/outlook/ | one-time | T-20261005-016 |
| M7 | Stale in-script usage paths: download-font.ts:5,181 and gen-slides-pdf.ts:12-13,1544-1545 say `bun scripts/<name>.ts` (actual: `scripts/co-deck/`) | C | scripts/co-deck/download-font.ts:5,181; gen-slides-pdf.ts:12-13,1544-1545 | one-time | T-20261005-018 |
| M8 | Partial-failure handling warn-only: image embed failures print `img err` and silently omit the image (exit 0); auto-calibrate.ts:237 bare `catch {}` conflates "converter not installed" with "conversion failed" | C | gen-slides-pdf.ts:534-537,549-552; auto-calibrate.ts:237 | one-time | T-20261005-018 |
| M9 | `extract_slidedata.mjs` is the only snake_case script (17 kebab-case siblings); if the dual bun/node vendoring is intentional, SCRIPTS.md should say so | C | scripts/co-deck/extract_slidedata.mjs | one-time | T-20261005-018 |
| M10 | Windows path-quoting gap: `execSync(cmdParts.join(' '))` with unquoted paths breaks on workspace paths containing spaces | C | tests/theme-visual-regression.test.ts:~121-124 | script-gap | T-20261005-018 |
| M11 | Compat matrix hardcoded (19 pairs) in the visual-regression test, duplicating theme.json `compatible_styles`; the smoke test discovers it dynamically — the two can silently diverge | C | tests/theme-visual-regression.test.ts:53-88 | one-time | T-20261005-018 |
| M12 | html-to-pdf.ts traversal guard uses bare `startsWith(serveDir)` — a sibling dir sharing the prefix passes; fix is `resolve(fullPath).startsWith(serveDir + sep)` (localhost-only, low practical risk) | C | scripts/co-deck/html-to-pdf.ts:129 | script-gap | T-20261005-018 |
| M13 | build-theme-preview.ts prints "N built, M error(s)" but never exits non-zero on errors — CI/audit usage would pass despite failures | C | scripts/co-deck/build-theme-preview.ts:105-116,126 | script-gap | T-20261005-018 |
| M14 | generate-themes-manifest `--themes-md` silently no-ops if the AUTO-GENERATED markers were hand-deleted, yet still reports "THEMES.md tables updated." | C | scripts/co-deck/generate-themes-manifest.ts:187-199 | script-gap | T-20261005-018 |
| M15 | theme-builder embeds `JSON.stringify(slideData)` verbatim into an inline `<script>` — a slide string containing `</script>` terminates the tag early; vm.Script syntax check fails safe, fix is one line | C | scripts/co-deck/lib/theme-builder.ts:197-199 | one-time | T-20261005-018 |
| M16 | `.claude/settings.json` invokes graft helper scripts (graft-hooks.cjs, graft-statusline.cjs) that don't ship with the template — a scaffold skipping graft install gets failing hooks every session; also duplicated hook entries and a non-standard `asyncRewake` key | D | .claude/settings.json | script-gap | T-20261005-018 scope note (config hygiene) |
| M17 | Preview decks lag the registry: 27 decks, none for `outlook`/`white-bubble`, while THEMES.md (today) registers both; user-guide hardcodes "all 27" | D | docs/html-themes/preview/decks/; docs/user-guide.md:141 | script-gap | T-20261005-016 |
| M18 | PM tier mismatch: README says "high"; agents/pm.md frontmatter and AGENTS.md say Medium | B | README.md:38 vs agents/pm.md:9-14 | one-time | T-20261005-009 |
| M19 | i18n-specialist's structural role undocumented in agent_manifest (in agents[] but in no pipeline/optional/used_by list, no note distinguishing "intentionally outside" from "forgotten") | A | variant.json:68-71,73-103 | one-time | T-20261005-009 |

### ℹ️ Low / Improvements

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | Thin-dispatcher pointers to `docs/governance/agents/*.md` are dead inside the template (resolve at scaffold time via common — verify once, fleet-wide, that the scaffold actually copies common's docs/governance/) | A | AGENTS.md:156,285,289; HERMES.md:43 | one-time | verify during T-20261005-015 |
| L2 | lecture-profile.md `lang: ko` exception is thin (only placeholder Korean; "source-material" is a stretch for a config template) and the whole file is one giant YAML frontmatter block | D | docs/lecture-profile.md:2-3 | one-time | optional cleanup |
| L3 | AGENTS.md §3 subsection ordering artifact (§3.6 before §3.5; §3.8 after the H-Stage block) | A | AGENTS.md:158-236 | one-time | fold into T-20261005-015 |
| L4 | Dual phase-numbering systems (0–6 delivery phases vs 1–11 pipeline stages) have no coherent mapping anywhere; agents/design.md even contradicts itself (frontmatter `phases: [3]` :20 vs body "You own Stage 4" :33) — the unification is the highest-leverage single fix in this review | B, D | variant.json skill_manifest; agents/design.md:20,33 | systemic | T-20261005-010 |

### ✅ Strengths

- **agents[] ↔ disk is exact 1:1 (14 = 14)**; all 10 pipeline agents exist; optional/skippable/retry_policy semantics match the notes; handbook agents correctly excluded from the slide pipeline.
- **Three-way skill registry consistency**: variant.json skills[] (10) = skills/ dirs (10) = SKILLS.md rows (10); skill-graph.json covers all; per-agent lifecycle records complete for all 14 agents including i18n-specialist.
- **script_manifest.local ↔ scripts/co-deck exact match** (18/18, measure-layout correctly `deprecated`); SCRIPTS.md documents all 21 files with all 21 `@version` headers matching the registry 1:1.
- **Handbook delegation is clean**: zero local duplication; entry_skill and SKILLS.md both state the common inheritance correctly.
- **Agent inheritance discipline**: pm.md and i18n-specialist.md are pure 16-line `extends:` stubs; managed zones intact; **HERMES.md is byte-identical to common**.
- **No L1-only common assets duplicated** into the template (matches common-contract.json exclusion rules); country_config is in the compliant non-adopting state.
- **Security posture is solid**: zero secrets/tokens; API keys via gitignored `.env.local`; no `/Users/` machine paths; all subprocess calls invoke local sibling scripts; no `curl | bash`; `_ko` translation trio properly sanctioned with matching `translated_from_hash` sync metadata; extraction logic in download-font is traversal-safe.
- **Exit-code discipline is good almost everywhere** (build-theme-deck, estimate-layout, validate-image-manifest hard-gates, verify-new-theme final exit contract; "no silent fallback" spec-resolution policy in gen-slides-pdf AC-7).
- **Tests degrade gracefully offline**: browser suites self-skip without Playwright; remaining suites are pure-bun or local-subprocess; side effects cleaned in afterEach/afterAll; `bun test` runs fully offline today.
- **THEMES.md + auto-generated themes-manifest.js are current** (updated 2026-10-05) and can serve as the source of truth to regenerate all the stale counts above; user-guide.md and skills/SKILLS.md are likewise current and mutually consistent.

## Domain Summary

| Slot | Verdict |
|------|---------|
| A Architecture + Scaffolding | Contract structure is sound (roster/skills/scripts all 1:1); the drift is in **descriptive claims** (theme_manifest, counts) and **stale AGENTS.md boilerplate**. No scaffold-breaking issues. |
| B Standards + Lifecycle | The "stable" declaration is real but **not propagated**: lifecycle metadata, PROMOTION_CHECKLIST, README status blocks, and the governance scaffold all still describe the beta era. The governance scaffold (S1–S4/gates) was never adapted to the real pipeline. |
| C Automation | Registry hygiene excellent; **two Critical code defects** (TDZ crash, undeclared deps) plus a robustness cluster (CRLF, exit codes, orphaned Chrome, font supply chain). |
| D Docs + Security | No security blockers; the exposure is **doc integrity**: one wholly stale phase SSOT and a cluster of count/path/gate-model claims that drifted after the outlook (2026-07-22), stable (2026-08-30), and white-bubble (2026-10-05) changes. |

**Root cause pattern**: the machine battery validates structure (existence, parity, registry sync) but not **truthfulness of prose claims and semantic bindings**. The stable promotion and two theme additions happened without a claim-regeneration step; 24 of 39 findings are mechanically detectable in principle.

## Action wiring

Routing decision: **no in-session fixes** — the template's code/doc changes require the Design Gate (ADR-0074) and a /sync cycle, session budget after 4 heavy review slots is constrained, and partial in-session fixing would leave an inconsistent state. All 39 findings wired to 13 tickets (5 validator-hardening + 8 fix clusters), created 2026-10-05:

| Ticket | Priority | Class | Covers |
|--------|----------|-------|--------|
| T-20261005-006 | urgent | script-gap | C1 TDZ crash fix |
| T-20261005-007 | urgent | script-gap | C2 dependency declaration (template package.json) |
| T-20261005-008 | high | script-gap | C4 + C5 status metadata (betaLifecycleSummary, PROMOTION_CHECKLIST rewrite) |
| T-20261005-009 | high | script-gap | H1 + H8 + H9 + M18 + M19 roster recount, README beta blocks, lifecycle record criteria |
| T-20261005-010 | high | systemic | C3 + C6 + L4 process-model unification (stages/gates/RACI/phase-definitions/mapping) |
| T-20261005-011 | high | script-gap | VH: contract-truth check (theme_manifest, counts, status wording, path existence) |
| T-20261005-012 | high | script-gap | VH: doc lint (phantom paths, retired commands, owner-in-roster) |
| T-20261005-013 | normal | script-gap | VH: script lint (imports, SCRIPTS.md claims, deprecated refs, exit-code patterns) |
| T-20261005-014 | normal | script-gap | VH: AGENTS.md boilerplate L1↔L2 drift check |
| T-20261005-015 | normal | mixed | H3 + H4 + H5 + H6 + H7 + M2 + L1 + L3 stale paths/registry rows/gate-model |
| T-20261005-016 | normal | one-time | H2 + M1 + M3 + M6 + M17 theme-system claim sync |
| T-20261005-017 | normal | mixed | H10–H14 script hardening batch |
| T-20261005-018 | low | mixed | M4, M5, M7–M16 script/doc hygiene batch |

## Verification

No template files were modified in this session, so no validator re-run is due (baseline remains the current machine truth: 6/6 green). Next `/sync` cycle should land T-20261005-006/-007 first (the two Critical code defects), and the 5 validator-hardening tickets close the ratchet loop — at the next review, the 24 `script-gap` classes above should surface from the machine baseline, not from agent effort.

---

## Verification (2026-10-05 remediation — all 39 findings fixed same-day)

**Remediation**: 5 specialist clusters (S scripts / C contract-claims / P process-model / U docs-surface / V validator) + 2 follow-ups (procedures re-staging, stale sub-check retirement + L1 mirror sync), governed by `docs/designs/2026-10-05-co-deck-review-remediation-design.md` (spec `2026-10-05-co-deck-review-remediation-design`, registered). All 39 findings addressed; no known residuals from the original list.

**Machine battery**: `bun scripts/review-baseline.ts` → **7/7 green** — the battery now has a 7th entry, the new `scripts/validate-variant-claims.ts` (checks a–j implementing the report's 24 `script-gap` classes as standing machine checks). During verification the battery itself flagged stale root `docs/skill-graph.json` (a direct consequence of the process-model fix) — regenerated via `bun scripts/generate-skill-graph.ts`, audit back to full green. Ratchet outcome: at the next review these classes are caught by the machine, not by agent effort.

**Tests**: `bun test templates/co-deck/scripts/co-deck/tests/` → 187 pass / 1 fail. The single failure (visual-regression baseline compare) is **pre-existing and environmental** — Playwright's installed version wants `chromium_headless_shell-1228`, the machine cache has 1243; reproduced identically through the old code path before the fix. Not caused by this remediation; resolve by refreshing the Playwright browser cache.

**Spot checks** (all zero): stale "13 agents" claims (the one remaining mention is the honest historical note in PROMOTION_CHECKLIST), "5 themes/5 styles", `PENDING_REVIEW`, `measure-layout` in skills/agents, phantom agent names in phase-definitions. `/meeting` appears only in the retired-command phrasing. `betaLifecycleSummary: null`. `verify-readme-sync.ts` PASS (README_ko + user-guide_ko + agents/README_ko hash pairs).

**Corrections to the review findings above**:
- **M6**: `baselines/outlook/` was **not** a naming typo — its captures were broken frames from an early run (empty slide-2s, missing titles). Deletion still valid; rationale corrected.
- **M17**: outlook preview decks **already existed**; only `zen_white-bubble` was missing. Built; inventory now 28/28 matching the manifest.

**Known consequences / follow-ups**:
- The new template `package.json` **replaces** the common-generated root manifest in scaffolded co-deck projects (scaffold overlay order) — common's `test-runner` scripts and `js-yaml` dep do not survive into co-deck project manifests. Deliberate per D1; if common entries must survive, a scaffold-time merge is a design follow-up (recorded in T-20261005-007).
- Generator-script guards discovered during re-staging → **T-20261005-019** (bootstrap-stages.ts must refuse when a curated stages.yaml exists; generate-raci.ts accountable derivation needs a procedure-owner fallback). Until landed, do not run `generate-raci.ts --write` or `bootstrap-stages.ts` for co-deck.
- The new validator's fleet sweep surfaced the same drift class in **co-design** (11 findings) → **T-20261005-020**.
- `git status` during verification showed staged files **not from this remediation** (`docs/designs/2026-10-05-co-deck-template-panel-sync-design.md`, `templates/co-deck/docs/designs/2026-10-05-zen-text-panel-readability-design.md`, CHANGELOG/skill-graph edits — consistent with a concurrent session's zen panel work). This remediation touched none of them; review both change sets before the next `/sync`.

**Ticket wiring (final)**: T-20261005-006…018 → **done** (13/13, with per-ticket results). Open follow-ups: T-20261005-019 (generator guards), T-20261005-020 (co-design drift). Working tree is uncommitted by design — land through `/sync`.
