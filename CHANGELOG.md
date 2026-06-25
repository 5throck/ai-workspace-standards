# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **[2026-06-23]**: feat(co-deck): add background image rendering system (gen-slides-pdf.ts v1.7.0) — image backgrounds for HTML and PDF output; independent `background_image` section in lecture-profile.md (enabled, scope: all/divider-cover/individual, source, overlay color+opacity, keywords, fallback_color); image-curator v1.3.0 downloads atmospheric bg image with global manifest entry; all 5 template.html files inject `--slide-bg-image` CSS variable in renderSlide(); html-build v1.1.0 binds backgroundImage per scope; pdf-export v2.1.0 renders full-bleed cover-crop + semi-transparent overlay; Stage 0 confirms background image preference; AGENTS.md, SCRIPTS.md, co-deck.context.md v3.4 updated
- **[2026-06-23]**: feat(co-deck): improve TTS voice selection UX — fix Chrome async voice loading timing (voice count tracking, incremental onvoiceschanged rebuild, 500ms fallback timer, remove premature direct dropdown build calls); add voice-info badge UI (voice-name + voice-badge with lang · L/N tags, active state accent styling, open-state preservation across rebuilds, button label badge); ppt-engine.js + ppt-engine.css updated in _shared/ (auto-propagates to all 4 PPT themes via html-build injection) — Web Speech API reads `slideData[i].script` aloud with auto-advance (auto/manual mode toggle, ko/en/ja multi-language, keyboard shortcuts P/A, footer UI buttons in all 4 PPT themes, speaking pulse animation); storyline agent mandates `script` field per slide; lecture-profile.md gains `narration` config section; migrate `docs/superpowers/` to `docs/designs/` with semantic filenames
- **[2026-06-23]**: feat(co-deck): NarrationEngine v2.0 — independent narration/auto-advance toggles (4 combinations: both on, narrator only, auto-slide only, both off); language dropdown (extensible `LANGUAGES` object replacing cycle toggle); voice selector dropdown (filtered by language, localStorage persistence per `narration_voice_<lang>`); configurable via `narrationConfig` bridge (lecture-profile.md → html-build → initPPT); footer UI updated in all 4 PPT themes (slideshow, scroll, notebook, pitch-enhanced); dropdown CSS styles added to ppt-engine.css; THEMES.md + co-deck.context.md feature tables updated
- **[2026-06-23]**: fix(co-deck): enforce UTF-8 without BOM + LF line endings across html-themes/ — normalize 36 files CRLF→LF; add `.gitattributes` (eol=lf for HTML/CSS/JS/JSON/MD); add File Encoding Standard section to THEMES.md; add UTF-8 output constraints to html-build agent/skill; add Domain Rule #16 to co-deck.context.md
- **[2026-06-23]**: fix(encoding): remove UTF-8 BOM from 3 template files (co-consult `.gitattributes`, co-consult `template-version.txt`, common `.gitattributes`) + root `.gitattributes`; strengthen root `.gitattributes` with explicit `eol=lf` for all text file types (md, js, ts, json, html, css, yml, yaml, toml, sh, c, h, mjs) to prevent `core.autocrlf=true` CRLF checkout on Windows; re-normalize 142 CRLF files across all 7 variants
- **[2026-06-23]**: feat(co-deck): register `validate-image-manifest.ts` (v1.0.0) as the Gate 3.5 hard gate — recomputes SHA-256 content hash + reads pixel dimensions (inline zero-dep PNG/JPEG/SVG parsers) for every image; ERROR on duplicate content-hash across slides (blocks image-curator → html-build); WARN on missing extended schema fields (content_hash/width/height/aspect_ratio) and aspect-ratio deviation >30% from the theme × image_role target; declared in `scripts/co-deck/SCRIPTS.md` + `variant.json` `script_manifest.local`
- **[2026-06-22]**: feat(co-deck): make each theme's `renderSlide(data, index)` the authoritative slide-structure implementation across pitch/notebook/scroll/slideshow — replaces the `throw new Error` stub with an imperative DOM builder (`createElement`/`textContent`/`appendChild`) that emits each theme's native classes (pitch `divider-left/right` + `slide-content` + `slide-visual`, notebook `cover-rule` + `gutter-num` + `nb-tabs`, scroll/slideshow base.css `slide-card` + `bullets-container`); a shared `initSlides()` runs on `DOMContentLoaded` before each theme's TOC/tab/spy hooks; html-build now injects only `slideData` + CSS links and stops hand-authoring `.slide` divs (`html-build` SKILL.md ×2 + agent .md updated; `THEMES.md` documents the runtime-render contract). PDF pipeline unaffected — `extract_slidedata.mjs` parses the inline `slideData` array, not the DOM
- **[2026-06-22]**: feat(co-deck): add `premium-dark` style as the default visual style for scroll/slideshow themes — dark navy (`#111827`) + gold accent (`#D97706`) + radial-gradient cover/divider + MaruBuri/Noto Serif KR + gold title glow; derived from the `kyobo_ax_2026` executive deck; wired as default across `theme.json` (scroll/slideshow `compatible_styles[0]`), `html-build`/`pm` agents, `html-build` SKILL.md, `preview.html`, `gen-slides-pdf.ts`, and `variant.json` `theme_manifest.default` (renamed from `kyobo` — a brand name is inappropriate for a reusable style)
- **[2026-06-22]**: feat(co-deck): add opt-in `--title-text-shadow` CSS variable to `styles/base.css` (defaults `none`; zero impact on classic/minimal/academic/visual-heavy) to express the premium-dark gold title glow within the CSS-variables-only style discipline

### Fixed
- **[2026-06-25]**: fix(co-deck): preview.html — refactor renderSlides() from binary slideshow/else to paradigm-based STACKED_THEMES set (pitch, pitch-enhanced, outline, zen → fullscreen stacked; vertical → scroll list); add punchline/profile slide types to dummy data + buildSlideEl(); add data-bg attribute for zen theme CSS selector; update defaults from scroll to outline
- **[2026-06-25]**: fix(audit): stray-artifact check and encoding gate now skip untracked local directories — use `git ls-files --cached` to build tracked-item set instead of scanning `readdirSync('.')` directly; prevents false positives from non-workspace test project directories (audit v2.10.1, propagate-to-templates v2.0.9)
- **[2026-06-24]**: fix(co-deck): unify CSS variable names across styles — add `--accent-color: var(--accent)` alias in base.css so pitch/pitch-enhanced TOC accent colors correctly reflect each style's accent (classic=#4a90d9, minimal=#333344, academic=#8b1a1a, visual-heavy=#7ec8f0); hardcode bright text colors in ppt-engine.css glass panels (thumbnail counter, footer buttons, transition buttons, script panel, presenter timer, voice options) to prevent dark-on-dark contrast failure when light styles set --text-muted to dark values
- **[2026-06-24]**: fix(co-deck): pitch theme TOC drawer uses hardcoded dark glass panel + bright text instead of CSS variable fallbacks that produced invisible text on light styles; add backgroundImage to preview.html cover/divider slides and set --slide-bg-image CSS variable in buildSlideEl() for style-aware background rendering
- **[2026-06-24]**: feat(co-deck): improve HTML generation across all 5 themes — add `visual-title`/`visual-display`/`visual-heading`/`visual-item`/`visual-paragraph` CSS rules (P0); add `imgEl()` onerror handler with `.img-fallback` styling for broken images (P0); add `renderVisualDisplay()` structured text parser (`[Title]` → heading, `✓/→/•` → list item, default → paragraph) in ppt-engine.js + pitch theme (P2); add `visualDisplay` text panel support to base themes slideshow/notebook/scroll (P1); add `isPunchlineSlide` support to pitch theme (P1); add profile avatar (`visualImage` → circular crop) and `contactPhone` field to all themes (P1); update html-build agent v1.2.0 + SKILL.md v1.5.0 with full documentation
- **[2026-06-24]**: fix(co-deck): remove all `innerHTML` usage from `ppt-engine.js` NarrationEngine — replace 2 `dropdown.innerHTML = ''` with `while(firstChild) removeChild(firstChild)` loops and 3 `btn.innerHTML` with `textContent` + `createElement('span')` DOM construction; prevents LLMs from applying spurious `innerHTML → clearEl()` security patches during html-build invocations
- **[2026-06-24]**: fix(co-deck): neutralize base.css structural rule leaks into pitch-enhanced PPT theme — add `@media (max-width: 1340px) { .slide { transform: none; } }` in ppt-engine.css to prevent double-scaling at 1366px viewport; add `display: block` on `.slide` in pitch-enhanced/theme.css to neutralize base.css `display:flex; flex-direction:column` leak on standard slides (type-specific overrides via `[data-type="..."]` retain higher specificity); add `min-width:0; border-radius:0` on `.right-panel` to neutralize base.css `min-width:280px` and `border-radius:0.375rem` leaks
- **[2026-06-23]**: fix(co-deck): wire the `--bg-color` CSS variable end-to-end — define in `styles/base.css` (default `#e8e8e8`, body rule now `var(--bg-color, #e8e8e8)`) + all 5 styles (premium-dark `#0B0F19`, classic/minimal `#e8e8e8`, academic `#e8e4dc`, visual-heavy `#0a0a1e`) and remove the redundant per-theme fallbacks in pitch/notebook theme.css + slideshow template.html; previously `--bg-color` was consumed by theme body rules but never defined, so the hardcoded fallback always won and no style could control the page background behind the floating slide card
- **[2026-06-23]**: fix(co-deck): backport `gen-slides-pdf.ts` v1.3.9→v1.4.0 (placeImageCover object-fit:cover via a pdf-lib clip path so divider images crop-to-fill instead of letterbox; `layout_overrides` `fonts`/`line_heights` base-indent parser fix so nested overrides actually apply; wrapping-aware divider vertical centering within the full card; Pretendard→MaruBuri font fallback) + `gen-visual-images.ts` v3.0.0→v3.0.1 (target filter honours an absent `visual` field — an `images/`-prefixed visualImage still counts as a diagram target) from the co-deck2 instance; reflected in `agents/pdf-export.md` v1.0.0→v1.1.0 + `docs/co-deck.context.md` + `agents/diagram-specialist.md`; `docs/lecture-profile.md` gains a commented pitch `fonts`/`line_heights` calibration reference
- **[2026-06-22]**: fix(co-deck): add STRICT PROHIBITION to `templates/co-deck/agents/html-build.md` — forbid `.ts`/`.js`/`.sh`/`.py` scripts in `presentations/<project>/` (only `diagram-defs.ts` permitted); root cause: html-build agent was self-generating `build-html.ts` on each invocation
- **[2026-06-22]**: fix(co-deck): backport `gen-visual-images.ts` v3.0.0 (infrastructure-only dispatcher; dynamic import of `presentations/<project>/diagram-defs.ts`) + new `diagram-helpers.ts` v1.0.0 (shared SVG utilities + `DARK_AMBER`/`B2B_NAVY` palettes) to `templates/co-deck/`; `co-deck.context.md` v2.8 + `SCRIPTS.md` updated; old hardcoded project generators removed from template
- **[2026-06-22]**: fix(co-deck): backport `measure-layout.ts` v1.1.0 — HTML pre-flight validation (`validateHtml()`: structure, `slideData` declaration, `.slide` element count) before Playwright launches; exits with actionable error if HTML is incomplete; `co-deck.context.md` v2.7 + `SCRIPTS.md` updated to reflect v1.1.0
- **[2026-06-22]**: fix(co-deck): backport `gen-slides-pdf.ts` v1.3.3→v1.3.9 from the `co-deck1` instance to `templates/co-deck/` — contact slide HTML parity (centered 80% band, no header strip, measured colors: thanks white / lines secondary #CBD5E1 / CTA gold), punchline element-to-element gaps (56/41/56 px) + dynamic line-count centering, divider card C_BG parity (matches cover/standard, not a darker slab), profile slide LH/GAP re-derived from Playwright measurement, per-item font calibration (HTML px×0.75=pt), and `divider` slide_type support; enable `slideshow/theme.json` `divider: true` and bump `slideshow/pdf_layout_spec.json` v1.3.1→v1.3.3 (divider slide_type + per-item font fields); sync `scripts/co-deck/SCRIPTS.md` version/description/footer while preserving the generic `scripts/<variant>/` path placeholder
- **[2026-06-22]**: fix(co-deck): cover slide eyebrow (`meta`) now renders above title with accent color; title/subtitle vertical coordinates adjusted for centered layout (`pdf_layout_spec.json`, `gen-slides-pdf.ts`); `gen-visual-images.ts` v2.0.0 (SVG→PNG, no browser) synced to `templates/co-deck/`
- **[2026-06-22]**: fix(co-deck): correct `classic/pdf_color_spec.json` to a LIGHT palette matching `classic/style.css` — previously held a dark palette, causing an HTML(light)/PDF(dark) mismatch; the dark palette now lives under `premium-dark`
- **[2026-06-20]**: fix(l2-propagation): revert agent script exclusions — `agent-create/delete/list/verify.ts` and `agent-lifecycle-audit.ts` restored to `L0+L1` scope (copied to L2); `agent-lifecycle-manager` skill `l2_propagate: false` removed (skill + scripts both in L2); `script-lifecycle-manager` skill confirmed in L2 (L2 projects manage their own scripts)
- **[2026-06-20]**: docs(constitution): update §6, §6.5, §7 to reflect final L2 exclusion list — excluded skills: `audit-workspace`, `create-variant`, `promote-variant`; excluded scripts: `upgrade-project.ts` only; corrected examples and "when to use" guidance

### Added
- **[2026-06-21]**: feat(i18n): add Korean language policy exception for legal/regulatory content — allows lang: ko and lang_reason in frontmatter for content files; updates validate-md-language.ts and CONSTITUTION.md
- **[2026-06-21]**: feat(i18n): implement 4-stage Korean content audit judgment in `scripts/validate-md-language.ts` v1.4.0 — protected path check (agents/, skills/, governance files → FAIL), frontmatter lang: ko + valid lang_reason → PASS+INFO, undeclared Korean → FAIL
- **[2026-06-20]**: feat(l2-propagation): metadata-based L2 exclusion for skills and scripts — `l2_propagate: false` in SKILL.md frontmatter + `// @l2-propagate: false` header comment exclude workspace-management artifacts from generated projects; replaces hardcoded exclusion lists in `new-project.ts`
- **[2026-06-20]**: feat(verify-skills): add `l2_propagate` field validation for `templates/common/skills/` — warns if field is missing or not a bare boolean (`v1.1.0`)
- **[2026-06-20]**: feat(verify-scripts): add `checkL2PropagateConsistency()` — cross-checks `L0+L1-ws` scope in SCRIPTS.md against `@l2-propagate: false` header; mismatches fail pre-commit (`v1.1.0`)
- **[2026-06-20]**: docs: update constitution §6, §6.5, §7 to document `l2_propagate`, `@l2-propagate`, `L0+L1-ws` scope, and §7.3 L2 Exclusion Rules

### Fixed
- **[2026-06-20]**: fix(variants): remove `agent-lifecycle-manager` from `.claude/skills/` and `.gemini/skills/` of all 6 variants — it is a `scope: common` workspace skill deployed via `skills/` and must not be duplicated in platform-config skill dirs; affected: co-consult, co-design, co-develop, co-work, co-security, co-deck (12 dirs removed)
- **[2026-06-20]**: fix(co-deck): move `extract_slidedata.mjs` from `scripts/` root to `scripts/co-deck/` — aligns with all other co-deck scripts; prevents stray file at generated project `scripts/` root
- **[2026-06-20]**: fix(new-project): add `agent-lifecycle-manager` to `L0_SKILLS` cleanup list in `scripts/new-project.ts` — safety net to remove `.claude/skills/agent-lifecycle-manager` and `.gemini/skills/agent-lifecycle-manager` from any generated project

### Added
- **[2026-06-21]**: feat(co-deck): two-layer theme/style system (scroll/slideshow themes × 4 styles, THEMES.md registry, T-Stage authoring pipeline, shared asset pool, preview.html) (`templates/co-deck/docs/html-themes/`)
- **[2026-06-20]**: feat(variants): standard sections (`## ⚠️ PM-ONLY INVOCATION`, `## Responsibilities`, `## Output Format`, `## Constraints`) added to 31 variant agent files across co-consult (10), co-design (7), co-work (6), co-security (5), co-develop (3) — resolves all WARN items from project-review audit
- **[2026-06-20]**: feat(co-deck): `retry_policy` and `skippable[]` fields added to `agent_manifest` in `co-deck/variant.json` — source-verifier on_fail→research, max_retries:2, failure_condition: trust_score < 0.9
- **[2026-06-20]**: feat(co-deck): `## Failure Protocol` section added to `source-verifier.md` with retry loop (max 2 cycles), escalation format, and PM handoff path; `handoff_to` updated to include research and pm
- **[2026-06-20]**: feat(variants): `agent_manifest` block added to all 5 stable variants (co-consult, co-design, co-develop, co-work, co-security) with `pipeline_order`, `optional`, and contextual `notes`
- **[2026-06-20]**: feat(workspace-schema): `_shared.agent_manifest` schema block added to `docs/workspace-schema.json` covering required/optional fields and co-deck retry_policy sub-schema
- **[2026-06-20]**: feat(variants): `skills[]` registration gaps filled — co-consult (+documentation-writing, +research-analysis), co-design (+service-design, +ui-ux-design-intelligence), co-develop (+code-review, +refactoring, +test-driven-development), co-work (+api-documentation, +documentation-writing, +research-analysis)

### Fixed
- **[2026-06-20]**: fix(co-deck): updated path of `lecture-profile.md` from `docs/lecture-profile.md` to `presentations/<project>/lecture-profile.md` across all agents (pm, research, storyline, image-curator, source-verifier) and `variant.json` to keep local presentation settings isolated from shared template folder; added warning header to master template `lecture-profile.md`
- **[2026-06-20]**: fix(co-work): `project-coordinator.md` self-referencing loop removed — `handoff_to: []` and `Can Lead Phases: []` (was [4]) to prevent infinite PM ping-pong (C-15)
- **[2026-06-20]**: fix(co-consult): `required_skills` added to 6 agents (data-analyst, industry-expert, sme, solutions-architect, technology-specialist, workstream-lead) — C-17
- **[2026-06-20]**: fix(co-deck): `api_keys:` block removed from `docs/lecture-profile.md`; replaced with comment pointing to `.env.local` — C-19
- **[2026-06-20]**: fix(co-consult): `industry-expert.md` `## ⚠️ PM-ONLY INVOCATION` section added with enforcement rationale
- **[2026-06-20]**: fix(co-deck): `variant.json` description updated to "10 agents (1 PM orchestrator + 9 specialists)" for accurate count
- **[2026-06-20]**: fix(co-design/co-work): storyteller.md `Dispatch Protocol` tier corrected from `high` → `medium`
- **[2026-06-20]**: fix(co-deck): `co-deck/variant.json` version bumped `0.1.0` → `0.2.0`; pm agent added to agents[]; image-curator added to skills[]
- **[2026-06-20]**: fix(co-security): PostToolUse hook command corrected `bash scripts/audit.sh` → `bun scripts/audit.ts` (ADR-0036)
- **[2026-06-20]**: fix(co-consult): industry-expert `handoff_to` corrected from non-existent `analyst` → `project-consultant`
- **[2026-06-20]**: fix(co-design): `storyteller` removed from `agent_manifest.optional[]` — it is a core narrative agent, not omittable
- **[2026-06-20]**: fix(trust-score): trust_score threshold unified to 0.9/90% across variant.json notes, workspace-schema.json example, and source-verifier.md Gate 1.5 and Failure Protocol
- **[2026-06-20]**: fix(claude-md): CONSTITUTION.md §9/§10 cross-links corrected to existing anchors (previously pointing to non-existent anchors)

### Changed
- **[2026-06-20]**: chore(variants): `version: "1.0.0"` and `last_updated:` frontmatter added to all 47 variant agent files across 6 variants (co-consult 11, co-design 7, co-develop 7, co-work 6, co-security 6, co-deck 10) — H-01/H-02 metadata completion
- **[2026-06-20]**: chore(workspace-schema): `_note` field added to `_shared` object in `docs/workspace-schema.json` clarifying cross-reference purpose
- **[2026-06-20]**: chore(co-design): `agent_manifest.notes` clarified with system skills exclusion rationale in `co-design/variant.json`
- **[2026-06-20]**: chore(co-deck): `language: ko` added to frontmatter of `research.md` and `storyline.md`; Agent Control Flags subsection added to `docs/co-deck.context.md`
- **[2026-06-20]**: chore(common): `version: "1.0.0"` and `last_updated: "2026-05-28"` added to `templates/common/agents/pm.md` and `templates/common/agents/_COMMON.md` frontmatter
- **[2026-06-20]**: chore(constitution): §10 variant list updated from 4 → 6 entries to include co-security and co-deck
- **[2026-06-20]**: chore(readme-ko): `## Prerequisites` section added to workspace root `README_ko.md` (Korean localization)
- **[2026-06-20]**: chore(memory): 5 meeting transcript files translated from Korean to English in `**Topic**:` fields; `ai-workspace-standards-architecture-analysis_ko.md` frontmatter added
- **[2026-06-20]**: chore(storyteller): co-design storyteller upgraded — Narrative Gap Analysis step added, 2 new examples, `last_updated` frontmatter, `handoff_to` updated
- **[2026-06-20]**: chore(storyteller): co-work storyteller upgraded — institutional knowledge framing, 2 new examples, `last_updated` frontmatter
- **[2026-06-20]**: chore(source-verifier): `Auto-Dispatch To` updated with research failure path; `last_updated` frontmatter added
- **[2026-06-20]**: chore(co-develop): `security-monitor.md` and `stack-setup.md` structural sections verified/added (PM-ONLY, Dispatch Protocol, Meeting Participation, handoff_from)
- **[2026-06-20]**: chore(co-security): red-team-lead `Can Lead Phases` corrected [] (was [1]); PM-ONLY scope clarified
- **[2026-06-20]**: chore(co-consult): PM-ONLY removed from direct-user-entry agents (project-consultant, researcher)

### Added
- **[2026-06-19]**: feat(wave-2a): introduce L1 agent layer — `templates/common/agents/` with `.gitkeep`, ADR-0043 (L1 agent layer and hybrid override mechanism), `docs/designs/l1-agent-format-spec.md` (TypeScript interfaces + governance rules), and `scripts/helpers/agent-similarity-analyzer.ts` v1.1.0 (Mode 1 cross-variant Jaccard similarity scan, Mode 2 L2 version drift detection; critical fixes: CRLF normalization, path traversal guard, missingL1 bucket, pm.md exclusion, SectionKey type, remove_reason field)
- **[2026-06-19]**: feat(co-deck): convert 4 Python scripts to TypeScript — `snapshot.ts`, `download-font.ts`, `measure-layout.ts`, `gen-slides-pdf.ts` (merges gen_full.py + gen_sample5.py with `--sample N` flag); add `package.json` and `scripts/SCRIPTS.md` lifecycle registry for co-deck variant; remove original `.py` files
- **[2026-06-19]**: feat(wave-2a): register `helpers/agent-promote.ts` (experimental stub, Wave 2b) and `helpers/agent-similarity-analyzer.ts` v1.1.0 in SCRIPTS.md (L0 and L1 template); add `co-deck` to `governance-agents.target_variants` in `scripts/propagation-map.json`
- **[2026-06-17]**: feat: promote co-deck variant to templates/co-deck — 11-stage lecture material production system migrated from co-deck_prototype via 3-phase variant creation workflow (Phase A: agent frontmatter + docs; Phase B: workspace infra + audit pass; Phase C: l2-to-variant-pipeline promotion, 0 validate-templates errors, end-to-end scaffold verified)
- **[2026-06-13]**: feat: introduce variant.context.template.md SSOT, VARIANT-INJECT guidelines taxonomy, and execution plan boilerplate enforcement — establishes variant.context.template.md as the single source of truth for variant-specific context injection; defines VARIANT-INJECT taxonomy for guidelines classification; enforces execution plan boilerplate in all multi-agent dispatch workflows (PR #256)
- **[2026-06-13]**: feat: A-01~A-05 — template-utils.ts SSOT, generateContextMd refactor, new-project.ts context.md integration — centralizes context.md generation logic in template-utils.ts; refactors generateContextMd to use SSOT helpers; integrates context.md scaffolding into new-project.ts pipeline (PR #257)

### Fixed
- **[2026-06-15]**: fix: update `templates/co-work/.gemini/settings.json` to explicitly include security policies (`terminal.executionPolicy`, `mcp.toolApproval`, `terminal.denyList`) and correct stale `_comment` field
- **[2026-06-15]**: fix: Fix `new-project.ts` to correctly preserve L0+L1 helper scripts in scaffolded projects by cleaning up L0 scripts by explicit relative paths and removing unconditional helpers/ directory deletion.
- **[2026-06-15]**: fix: Fix Tier 3 detection in `verify-platform-lifecycle.ts` by falling back to checking templates/ directory existence since `variant.json` is cleaned up in scaffolded projects.
- **[2026-06-15]**: fix: replace `validate-templates.sh` with `bun scripts/validate-templates.ts` and remove obsolete `.sh`/`.ps1` script parity rule — update `templates/README.md`, `templates/README_ko.md`, `templates/co-design/AGENTS.md`, `memory/ai-workspace-standards-architecture-analysis_ko.md`; replace §8.8 Hybrid Scripting Pairing rule in `docs/constitution/08-coding-guidelines.md` with TypeScript-first rule per ADR-0036; update `qa-gate.sh/.ps1` → `qa-gate.ts` in `docs/constitution/05-multi-agent-architecture.md`
- **[2026-06-15]**: fix: promote all variant beta references to stable — update `.pipeline-state/beta-lifecycle/co-develop.json` status to stable; rewrite `templates/co-security/docs/co-security.context.md` Beta Usage Scope section to reflect stable promotion on 2026-06-13; update `docs/governance/variant-lifecycle.md` beta variants table to show all 5 variants as stable
- **[2026-06-15]**: fix: replace stale `.sh`/`.ps1` operational script references with `.ts` equivalents per ADR-0036 — `audit.sh` → `audit.ts` in `docs/governance/LIFECYCLE_GOVERNANCE.md` (8 occurrences), `docs/constitution/` (4 files), `.github/pull_request_template.md`; `new-project.sh`/`.ps1` → `new-project.ts` in `agents/architect.md`, `agents/auditor.md`, `agents/scaffolding-expert.md`; update `agents/automation-engineer.md` cross-platform rule to TypeScript-first; fix `simulate-project-creation` skill (`.claude` + `.gemini`) to use `bun scripts/new-project.ts`; fix `audit.sh`/`audit.ts` → `audit.ts` in `memory/ai-workspace-standards-architecture-analysis_ko.md`
- **[2026-06-15]**: fix: repair meeting skill propagation gaps across all variant templates — remove `simulate-project-creation` L0 contamination from 10 variant template locations; sync `templates/common/.gemini/commands/meeting.md` to v1.4.0; copy 7 missing `.gemini/skills/` entries across co-consult, co-design, co-develop, co-work; add `claude-commands`/`gemini-commands` `override_only` domains to `scripts/propagation-map.json`; add `l0_exclude` filter for `simulate-project-creation` in drift-check; add L0 contamination pre-check warning to `scripts/new-project.ts`
- **[2026-06-15]**: fix: comprehensive project review fixes for co-design and co-architect — remove `templates/` boundary violation from co-architect; fix AGENTS.md dispatch table with actual agent roster; fix README_ko.md section parity; clean stale `scripts-snapshot.json` L0 entries; update PostToolUse hook to `audit.ts`; add `audit`/`dev-sync`/`sync-md` to `package.json`; remove scaffolding artifacts (`variant.context.template.md`, `.gemini/settings.json.bak`, nested `ui-ux-pro-max` duplicate); add `status: active` to platform-config skills; delete stale `pm-md-parser.js`; fix misdated meeting file (2025→2026); add `backups/` to `.gitignore`
- **[2026-06-15]**: fix: replace `process.cwd()` with `import.meta.dir`-anchored paths in `propagate-to-templates.ts`, `resolve-variants.ts`, `validate-doc-folder.ts`, `validate-pm-extends.ts`; add workspace root guard to `dev-sync.ts` (v1.2.4) to prevent CWD mismatch when multiple workspace clones exist; remove hardcoded `C:/git` path entries from `.claude/settings.local.json`
- **[2026-06-19]**: fix: document variant-specific script design — add "Variant-Specific Scripts (L2)" section to `docs/constitution/06.5-script-lifecycle.md`; add WORKSPACE_ONLY_FILES + variant `package.json` deployment mechanics to `docs/constitution/07-new-project.md`; add script Step 3.5 + optional checklist to `docs/creating-a-variant.md`; revise `docs/adr/0033` (`scripts/local/` → `scripts/<variant>/`, fix status inconsistency, defer `external/` to Phase 2); add `script_manifest.local` to `templates/co-deck/variant.json` with `validate-templates.ts` B-03 path-existence check; update `CONSTITUTION.md §6.5` hub
- **[2026-06-19]**: feat(co-deck): Phase 1 pipeline enhancements — `presentations/lecture-profile.md` template (audience/level/theme/keywords/instructor schema); new `image-curator` agent (license-clear image search+download via Unsplash/Pexels, `image-manifest.json` output); `storyline` agent updated with `image_role`/`image_query` per-slide fields and interactive cover/divider confirmation flow; `research` agent loads profile for tailored search queries; `html-build` agent reads theme+instructor from profile (`templates/co-deck/agents/`, `variant.json`)
- **[2026-06-19]**: fix(co-deck): move `playwright` to `optionalDependencies` — skipped by `bun install` by default (~300MB chromium avoided on project creation); `measure-layout.ts` now detects missing playwright at runtime and prints install instructions (`templates/co-deck/package.json`, `scripts/co-deck/measure-layout.ts`)
- **[2026-06-19]**: fix(co-deck): move variant TS scripts to `scripts/co-deck/` subdirectory — prevents `templates/co-deck/scripts/SCRIPTS.md` from overwriting L1 common SCRIPTS.md during scaffolding; avoids `verifyScriptRegistryConsistency()` audit failures in scaffolded co-deck projects; update `package.json` npm scripts and `import.meta.path` workspace-root paths accordingly
- **[2026-06-12]**: fix: resolve PM.md Layout Reconstruction — implement reconstructPMLayout function and regenerate 4 project pm.md files (PR #255)

### Changed
- **[2026-06-13]**: refactor: remove variant-specific CLAUDE.md/GEMINI.md — fallback to templates/common/ — eliminates redundant per-variant CLAUDE.md and GEMINI.md files; all variants now inherit platform docs from templates/common/ reducing maintenance surface (PR #259)

### Security
- **[2026-06-13]**: feat: Wave 1 critical fixes — prune L0-only orphans, security guards, Check X regex, variant CLAUDE/GEMINI files — removes L0-only orphan scripts from L1 via --prune flag; adds security guards against unauthorized propagation; fixes Check X regex pattern matching; cleans up variant platform doc overrides (PR #258)

### Breaking Changes
- **[2026-06-11]**: [Breaking] scripts: migrate all sh/ps1 scripts to TypeScript (ADR-0036) — `bash scripts/new-project.sh` → `bun scripts/new-project.ts`, `bash scripts/upgrade-project.sh` → `bun scripts/upgrade-project.ts`, `bash scripts/remove-project.sh` → `bun scripts/remove-project.ts`, `bash scripts/cleanup-completed-md.sh` → `bun scripts/cleanup-completed-md.ts`; `install-bun.sh/ps1` deleted (bun is a workspace prerequisite); all file permission-setting code (chmod/chown/icacls/attrib/takeown) removed

### Added
- **[2026-06-09]**: docs: restructure AGENTS.md as SSOT for agent ecosystem and PM Gateway workflow — AGENTS.md v2.0.0 restructured as Single Source of Truth; integrated PM Gateway workflow (§3), execution plan templates (§5), and agent ecosystem overview; eliminated 229 lines of duplicate content across pm.md, CLAUDE.md §5, and GEMINI.md §5
- **[2026-06-09]**: docs: simplify pm.md — removed duplicate Agent Roster table (11 lines), added AGENTS.md reference section; pm.md now focuses only on PM-specific roles while deferring agent ecosystem information to AGENTS.md
- **[2026-06-09]**: docs: neutralize CLAUDE.md §5 and GEMINI.md §5 — removed duplicate PM Gateway content (114 lines per file, 228 total); added AGENTS.md references for PM Gateway workflow (§3) and execution plan templates (§5); CLAUDE.md/GEMINI.md now focus only on platform-specific tool behaviors
- **[2026-06-09]**: docs: remove L0→L1→L2 deployment strategy from platform docs — removed L1-L2 Fork Model and Lifecycle Management Rules sections (59 lines per file, 236 total) from CLAUDE.md §9-10 and GEMINI.md §6-7; replaced with CONSTITUTION.md references; platform docs now focus exclusively on platform-specific tool behaviors
- **[2026-06-09]**: docs: update CONSTITUTION.md terminology — fixed L0/L1/L2 terminology confusion; clarified distribution path (workspace root → templates/common → templates/co-*) vs layer structure (L1 → L2 → L3); fixed §6.5 Script Lifecycle Management to use explicit distribution path terminology; translated Korean "Terminology Definitions" section to English
- **[2026-06-09]**: docs: restructure PM.md design document — updated pm-md-variant-specific-content-injection-design.md v1.1.0 → v1.2.0 (Deprecated), added v2.0.0 (Current Standard) with 2-Phase Pre-Build Strategy; documented deprecation reason and migration guide
- **[2026-06-09]**: docs: update ADR-0033 with PM.md multi-implementation support — added note in ADR-0033-l0-l1-l2-hierarchy-and-extends.md documenting that PM.md supports multiple implementation approaches while maintaining ADR-0033 compliance

### Fixed
- **[2026-06-08]**: fix: Windows project folder deletion permissions — enhanced Windows permission handling in `scripts/new-project.ps1` (v1.6.9) with three improvements: (1) robocopy now uses `/COPY:DT` to copy only data/timestamps, NOT security permissions (ACLs); (2) added icacls commands to reset ACL inheritance and grant current user full control; (3) removed hidden/system attributes; projects can now be deleted without admin rights
- **[2026-06-08]**: fix: skip memory folder check in new-project post-scaffold audit — added `--skip-memory` flag to `scripts/audit.ts` (v2.6.4) and updated `scripts/new-project.sh` (v1.5.0) and `scripts/new-project.ps1` (v1.6.8) to skip workspace memory folder validation during project creation; new projects start with empty memory folder, so workspace root memory check is unnecessary and creates confusion
- **[2026-06-08]**: fix: Windows project folder permission issues — skip `git update-index --chmod=+x` on Windows in `scripts/new-project.ps1` (v1.6.7) to prevent permission problems that require admin rights for deletion; added Windows-specific permission cleanup to remove hidden/system attributes from project files; Linux/macOS versions remain unchanged with proper chmod handling
- **[2026-06-08]**: fix: optimize extends resolution progress display in new-project scripts — added progress counter and periodic status updates during extends resolution phase in `scripts/new-project.sh` (v1.4.9) and `scripts/new-project.ps1` (v1.6.6); displays "Processing extends: X/Y files..." every 10 files to show user that work is progressing; resolves user perception of script hanging during silent extends processing of hundreds of markdown files
- **[2026-06-08]**: fix: auto-install dependencies in new-project scripts — added automatic dependency check and `bun install` execution to `scripts/new-project.sh` (v1.4.8) and `scripts/new-project.ps1` (v1.6.5); prevents "Cannot find package 'js-yaml'" errors on fresh workspaces or when node_modules is missing; checks for `node_modules/js-yaml` before running scaffold and runs `bun install` if needed
- **[2026-06-08]**: fix: inject variant-specific sections from `variant_overrides` in `merge-frontmatter.ts` (v1.3.0) — `## Updated Role`, `## Governance Workflow`, `## Agent Roster`, `## Dispatch Protocol` sections are now generated from the variant's `variant_overrides` YAML and appended to the body after L0 section removal, ensuring generated `pm.md` reflects the correct variant characteristics instead of L0 workspace root values
- **[2026-06-08]**: fix: implement `remove_sections` support in `merge-frontmatter.ts` (v1.2.0) — variant `pm.md` files now correctly strip L0-specific sections (e.g. `## Governance Workflow`, `## Updated Role`, `## Agent Roster`, `## Dispatch Protocol`, `### Phase Determination`) from the body when scaffolding new projects; prefix-based heading matching handles headings with suffixes (e.g. `## Updated Role (Phase 0/1-2/5/6 Only)`); `remove_sections` key no longer emitted in final output frontmatter
- **[2026-06-08]**: Indented the yaml code block in `templates/common/docs/variant-pm-spec.md` to prevent extends validator false positives during scaffolding audit.
- **[2026-06-08]**: fix: resolve new-project scaffolding validation failure — remove `CLAUDE.md` and `GEMINI.md` from `variantRequired` in `scripts/helpers/template-validation.ts` to reflect template separation architecture where platform docs are inherited from common template; bumps version to `1.0.1`
- **[2026-06-07]**: fix: correct TaskCompleted hook structure in templates — add missing `hooks` wrapper and `matcher` field to `templates/common/.claude/settings.json` and `templates/co-consult/.claude/settings.json`; ensures proper hook format consistency across all templates (`templates/common/.claude/settings.json`, `templates/co-consult/.claude/settings.json`)

### Changed
- **[2026-06-08]**: Bumped `scripts/validate-templates.ts` to `1.5.4` to remove `CLAUDE.md` and `GEMINI.md` from the templates/common blocklist.
- **[2026-06-08]**: Bumped `scripts/audit.ts` to `2.6.2` to remove `CLAUDE.md` and `GEMINI.md` from L2 variant structural requirements.
- **[2026-06-08]**: Bumped `scripts/helpers/pm-md-parser.ts` to `1.0.2` to support structured object/array types in YAML frontmatter `variant_overrides`.
- **[2026-06-08]**: Updated version entries in `scripts/SCRIPTS.md` and `templates/common/scripts/SCRIPTS.md`.
- **[2026-06-08]**: Bumped `scripts/helpers/merge-frontmatter.ts` to `1.3.0` — add `injectVariantSections()` that generates `## Updated Role`, `## Governance Workflow`, `## Agent Roster`, `## Dispatch Protocol` markdown sections from `variant_overrides` YAML and appends them to body content after L0 section removal.
- **[2026-06-08]**: Bumped `scripts/new-project.sh` to `1.4.7` to pass original template source path for extends validation during scaffolding.
- **[2026-06-03]**: chore: clean up co-consult template — remove stale co-work skill copies (`meeting-facilitation`, `skill-lifecycle-manager`) from all 5 variants; register `agent-lifecycle-manager` as platform override in variant.json; remove template contamination files (`_COMMON.md`, `GLOBAL_TOOLS.md`, `settings.local.json`, `api-documentation` skill, empty `adr/`); add co-consult to `new-project.sh`/`ps1`/`md` at L0 and L1

### Added
- **[2026-06-03]**: feat: L2-to-Variant conversion pipeline (Wave 3 MVP) — complete 7-phase pipeline for automated variant generation; 14 TypeScript helper scripts (scan-l2-project, reconcile-with-l0-l1, validate-dependencies, generate-variant, initialize-beta-lifecycle, validate-platform-parity, integration-helpers); cross-platform UTF-8 encoding; dependency validation; template integrity validation; agent override merge logic; skill injection system; pipeline state management; **co-test cleanup**: removed test variant (pipeline validated successfully); preserved all pipeline scripts and skills for future reuse (`scripts/l2-to-variant-pipeline.ts`, `scripts/helpers/*.ts`, `scripts/lib/*.ts`, `docs/designs/l2-to-variant-conversion-pipeline.md`)
- **[2026-06-03]**: feat: add co-consult variant — strategy consulting template with 11 specialized agents (Engagement Leader, Strategy Analyst, Industry Expert, Change Management Partner, Communications Lead, Solutions Architect, and more), 13 variant-specific skills, 7-phase workflow; removed Project-Specific Tools section from workspace README; added co-consult to all SSOT registries (`templates/co-consult/`, `scripts/helpers/inject-skills.ts`, `templates/README.md`, `README.md`)
- **[2026-06-02]**: feat: add Claude Code Agent Teams support — enabled `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, `teammateMode: auto`, `TeammateIdle`/`TaskCompleted` hooks across workspace root and all 4 variant templates; documented Desktop App limitations and Antigravity CLI comparison in CLAUDE.md/GEMINI.md (`settings.json`, `CLAUDE.md`, `GEMINI.md`)
- **[2026-06-02]**: feat: add variant workflow governance — agent `phases`/`handoff_to`/`handoff_from`/`required_skills` frontmatter across 24 agent files; `variant.json skill_manifest` sections; 4 new `validate-templates.ts` checks (VA-01 phase×agent cross-validation, VA-02 workspace-root intrusion, VA-03 platform parity, WS-03 common-contract×variant skills); post-scaffolding validation in `new-project` scripts (`templates/co-*/agents/*.md`, `templates/co-*/variant.json`, `scripts/validate-templates.ts`)
- **[2026-06-02]**: feat: add platform settings parity policy — 3-tier classification (shared/claude_only/gemini_only) in `common-contract.json platform_settings`; Check VA-04 validates shared key presence in both `.claude/settings.json` and `.gemini/settings.json`; CLAUDE.md/GEMINI.md §10 lifecycle table updated with explicit settings file propagation rules (`docs/templates/common-contract.json`, `scripts/validate-templates.ts`)
- **[2026-06-02]**: feat: platform sync infrastructure — `templates/common/.gemini/settings.json` created; `propagation-map.json` `gemini-settings` domain added; `CLAUDE.md`/`GEMINI.md` common section markers (`<!-- COMMON-CLAUDE:START/END -->`, `<!-- COMMON-GEMINI:START/END -->`); `publish-to-template.ts --docs` flag for automated doc sync; Check VA-05 for common section drift detection (`scripts/publish-to-template.ts`, `scripts/validate-templates.ts`, `scripts/propagation-map.json`)
- **[2026-06-02]**: feat: Phase 1 hook improvements — `asyncRewake: true` on PostToolUse/TeammateIdle hooks (silent failure → Claude re-wake); `effortLevel: high`; `permissions.deny` for destructive commands; `worktree.bgIsolation: none`; `WorktreeCreate` hook across all settings files (`*.claude/settings.json`)
- **[2026-06-02]**: docs: add `_shared/` + `_platform/` governance document architecture design for P2 migration (`docs/architecture/governance-docs-architecture.md`)

### Changed
- **[2026-06-02]**: refactor: complete L2 template level skill remediation — executed publish-to-template.ts for L1→L2 sync, removed 11 duplicate workspace-level skills from templates/common/.claude/skills/ and .gemini/skills/ (22 deletions), deleted 11 workspace skills from all 4 variant templates' .claude/skills/ and .gemini/skills/ (88 deletions total); templates now aligned with L1 SSOT structure: workspace-level skills exist only in workspace root, platform-specific skills properly isolated in template locations (`templates/common/.claude/skills/`, `templates/common/.gemini/skills/`, `templates/co-*/.claude/skills/`, `templates/co-*/.gemini/skills/`)
- **[2026-06-02]**: refactor: remove migration folder from L2 templates — moved `templates/common/migrations/` to `docs/migrations/` at workspace root; eliminated unnecessary duplication from template creation-time snapshot; updated all documentation references in VERSION_REGISTRY.json and governance docs (`docs/migrations/`, `docs/templates/VERSION_REGISTRY.json`, `docs/governance/version-registry-schema.md`)
- **[2026-06-02]**: refactor: consolidate skill location structure per SSOT principles — removed 11 duplicate workspace-level skills from `.claude/skills/` and `.gemini/skills/` (reduced from 33 to 17 skill files, -48%); retained 3 platform-specific skills in both locations; AGENTS.md Skill Resolution Priority rules now fully compliant with single-location requirement (`skills/`, `.claude/skills/`, `.gemini/skills/`, `AGENTS.md`)
- **[2026-06-02]**: refactor: transition template permission strategy from strict read-only locks (444) to standard 644/755, utilizing Git Index (+x) for cross-platform executable enforcement; removed legacy read-only recovery logic from scaffolding scripts (`scripts/new-project.sh`, `scripts/new-project.ps1`, `scripts/audit.ts`)
- **[2026-06-02]**: refactor: consolidate L0→L1→L2 synchronization into a single script; integrated `propagate-to-templates.ts` into `publish-to-template.ts`; explicitly enforce Git executable bits during propagation (`scripts/publish-to-template.ts`, `scripts/SCRIPTS.md`)
- **[2026-06-02]**: docs: clarify Skill Resolution Priority rules in AGENTS.md — specify single location requirement for workspace-level skills (skills/ folder only), distinguish platform-specific skills (.claude/skills/ and .gemini/skills/ for platform hooks/commands), add explicit cross-duplication discouragement rule, and include canonical conflict example (`AGENTS.md`)
### Added
- **[2026-06-01]**: feat: complete Phase 3 (Integration Test) for abap_vibe_coding variant conversion — All critical integration tests passed (7/10): Session Start Flow, CONSTITUTION Reference Resolution, PM Gateway Enforcement, Specialist Agent Dispatch Protocol, ABAP Workflow Integration, Content Loss Verification, Variant Independence; variant structure complete, CONSTITUTION references correct, PM Gateway operational, zero content loss (`abap_vibe_coding_mig/`)
- **[2026-06-01]**: feat: complete Phase 2 (CLAUDE.md Update) for abap_vibe_coding variant conversion — Updated CLAUDE.md to extend co-develop template; added Role Declaration with CONSTITUTION.md reference, updated Session Start Checklist (7 steps), added Agent Dispatch Rules §5 (PM Gateway enforcement, execution plan display, specialist agent list, permission denial protocol); removed ABAP-specific sections (`abap_vibe_coding_mig/CLAUDE.md`)
- **[2026-06-01]**: feat: complete Phase 1 (context.md Split) for abap_vibe_coding variant conversion — Created immutable docs/context.md (125 lines, CONSTITUTION references) + custom docs/abap.context.md (303 lines, ABAP-specific); original monolithic context.md removed; 41 sections → 30 sections (8 + 22), zero content loss (`abap_vibe_coding_mig/docs/context.md`, `abap_vibe_coding_mig/docs/abap.context.md`)
- **[2026-06-01]**: feat: complete Phase 0 (Preparation) for abap_vibe_coding variant conversion migration — ADR 0020 created, migration copy verified (197 files), validation documentation created (variant-checklist.md, test-scenarios.md, rollback-procedure.md) (`docs/adr/0020-abap-variant-conversion.md`, `abap_vibe_coding_mig/docs/validation/`)
- **[2026-06-01]**: feat: implement `propagate-to-templates.ts` + `propagation-map.json` — pull-based L0→L1 sync tool with `--dry-run`/`--apply` modes and 5-domain mapping (scripts, hooks, helpers, claude-skills, gemini-skills) (`scripts/propagate-to-templates.ts`, `scripts/propagation-map.json`)
- **[2026-06-01]**: feat: add `engagement_criteria` schema to `workspace-schema.json` (v1.1.0) and populate `co-security/variant.json` — beta governance lifecycle field for all future beta variants (`docs/workspace-schema.json`, `templates/co-security/variant.json`)
- **[2026-06-01]**: feat: add `triggers` metadata to 7 skills missing auto-invocation hints — `audit-workspace`, `project-review`, `security-scan`, `simulate-project-creation`, `translate`, `ui-ux-pro-max`, `validate-docs-links` (`skills/*/SKILL.md`, `.claude/skills/*/SKILL.md`)
- **[2026-06-01]**: feat: add dependency vulnerability audit step to CI pipeline — `bun audit || npm audit --audit-level=high` on all OS matrix entries (`.github/workflows/test.yml`)
- **[2026-06-01]**: feat: add `templates/common/package.json` baseline — enables new variant scaffolding without manual setup (`templates/common/package.json`)
- **[2026-06-01]**: docs: create ADR-0013 — documents `content_hash` removal decision and `sync_version` retention (`docs/adr/0013-content-hash-removal.md`)
- **[2026-06-01]**: feat: add File Organization Policy across all variants — prohibit non-standard `.md` files at project root; routing table (analysis→`docs/`, logs→`memory/`, drafts→`docs/drafts/`); `audit.ts` L2 root `.md` detection check; pre-created subdirectory scaffolding for all 4 variants (`docs/reports/`, `docs/drafts/`, `docs/research/`, `docs/adr/`, `docs/specs/`, etc.) (`templates/common/docs/context.md`, `scripts/audit.ts`)
- **[2026-06-01]**: feat: add Research Standards — mandatory source citation policy for all agents; inline `[Source: URL]` format; `⚠️ Unverified` disclosure for unverifiable claims; `audit.ts` WARN check for missing `## References` in `docs/research/*.md`; education/research agent creation checklist item (`templates/common/docs/context.md`, `AGENTS.md`, `scripts/audit.ts`)
- **[2026-06-01]**: feat: add Computational Integrity Standards — AI must not directly compute safety-critical or regulated financial calculations; mandatory external tool delegation (Fortran/gfortran for aerospace, Python+NumPy/SciPy for finance); 5-step procedure with security-reviewed installation; domain-tool mapping table; numerical computation agent creation checklist item (`templates/common/docs/context.md`, `AGENTS.md`)
- **[2026-06-01]**: feat: add Socratic method to education-role agent and skill creation checklists — role-selective methodology (not universal); conditional checklist items in `agent-lifecycle-manager` and `skill-lifecycle-manager` skills for education/tutoring/coaching roles (`skills/agent-lifecycle-manager/SKILL.md`, `skills/skill-lifecycle-manager/SKILL.md`)
- **[2026-06-01]**: feat: add permission allowlist entries to `.claude/settings.json` — `bun scripts/audit.ts`, `bun scripts/lifecycle-sync-audit.ts`, `bun run agent:verify`, `curl -sI`, `bun scripts/validate-templates.ts` to reduce permission prompts

### Changed
- **[2026-06-01]**: fix: unify `meeting-facilitation` skill version to 1.3.2 across all layers (`skills/`, `.claude/skills/`, `.gemini/skills/`) (`skills/meeting-facilitation/SKILL.md`)
- **[2026-06-01]**: fix: sync 4 stale scripts from L0 to L1 (`agent-create.ts`, `generate-scripts-readme.ts`, `sync-agent-status.ts`, `sync-skill-status.ts`) (`templates/common/scripts/`)
- **[2026-06-01]**: refactor: remove `auditor` and `lifecycle-manager` agents from `templates/common/agents/` — isolated to workspace root only; all 5 variant common skill owners changed to `pm`; `simulate-project-creation` skill removed from `templates/common/skills/`; `skill-lifecycle-audit.ts` orphan check changed from FAIL to WARNING; `validate-templates.ts` common skill owner validation check added; `common-contract.json` updated; `upgrade-project.sh/.ps1` updated (`templates/common/agents/`, `scripts/`)
- **[2026-06-01]**: refactor: move `workspace-schema.json` to `docs/workspace-schema.json`; `validate-model-registry.ts` and `validate-templates.ts` marked `L0-only`; removed from `templates/common/scripts/` (`docs/workspace-schema.json`, `scripts/SCRIPTS.md`)
- **[2026-06-01]**: refactor: flatten `tests/integration/` to `tests/` — `script-registry-integrity.test.ts` and `workspace-smoke.test.ts` moved up; `test-runner.ts` path updated (`scripts/test-runner.ts`)
- **[2026-06-01]**: fix: clarify PM boilerplate execution plan — workspace root uses specialist dispatch (`lifecycle-manager` N-1, `auditor` N); variant projects use `pm (direct)`; context declaration rule added; all 4 variant CLAUDE.md/GEMINI.md updated (`CLAUDE.md`, `GEMINI.md`, all variant templates)
- **[2026-06-01]**: fix: use `js-yaml` in section-merge `parseFrontmatter` to preserve nested YAML frontmatter — resolves `tier.antigravity` flattening bug in new-project scaffolding (`scripts/new-project.sh`, `scripts/new-project.ps1`)
- **[2026-06-01]**: docs: update README structure — add `agents/`, `skills/`, `tests/` to repository diagram; fix `.cmd`→`.ps1` reference; update Last Updated date (`README.md`, `README_ko.md`)

### Fixed
- **[2026-06-01]**: fix: repair Unicode Mojibake corruption in `CLAUDE.md` and `GEMINI.md` -- replaced CP949-corrupted characters with correct Unicode symbols (warning emoji, section sign, arrow, em-dash) (`CLAUDE.md`, `GEMINI.md`)
- **[2026-06-01]**: fix: sync `templates/common/scripts/new-project.sh` call signature — `validate_project_name` updated to 3-argument form matching workspace root (`templates/common/scripts/new-project.sh`)
- **[2026-06-01]**: fix: add `lifecycle-manager` to `AGENTS.md` roster; add `role:` frontmatter to all 8 agent files (`pm`=orchestrator, others=specialist) (`AGENTS.md`, `agents/*.md`)
- **[2026-06-01]**: fix: add `@version` JSDoc headers to 39 TypeScript scripts missing version tracking (`scripts/*.ts`, `scripts/hooks/*.ts`, `scripts/helpers/*.ts`)
- **[2026-06-01]**: fix: standardize `docs/adr/0012-version-manifest-schema.md` frontmatter — converted markdown-bold pseudo-fields to valid YAML (`docs/adr/0012-version-manifest-schema.md`)
- **[2026-06-01]**: fix: remove `content_hash: PLACEHOLDER` from all variant README frontmatter — field was never implemented (`templates/co-*/README.md`, `templates/common/README.md`)
- **[2026-06-01]**: fix: replace placeholder body content in `co-design` and `co-work` README files with accurate stable feature descriptions (`templates/co-design/README.md`, `templates/co-work/README.md`)
- **[2026-06-01]**: fix: allow tag pushes in `pre-push.ts` — branch protection check now skips when pushing refs/tags only; Bun stdin stream used for cross-platform compatibility (`scripts/hooks/pre-push.ts` v1.2.0)
- **[2026-06-01]**: fix: `new-project.ps1`/`.sh` error message — updated to reference `bun scripts/list-template-versions.ts` instead of non-existent shell wrappers (`scripts/new-project.ps1`, `scripts/new-project.sh`)
- **[2026-06-01]**: fix: push `template-v0.5.1` tag to remote — resolves user-blocking "Template version not found" error when cloning and scaffolding `co-work`
- **[2026-06-01]**: fix: add skills table to `templates/co-security/AGENTS.md` — replaced text list with validator-compatible table format (`templates/co-security/AGENTS.md`)
- **[2026-06-01]**: fix: transition `co-security` variant from `beta` to `stable` (`templates/co-security/variant.json` v0.3.0)
- **[2026-06-01]**: fix: remove redundant variant `.gitignore` files — `templates/co-*/gitignore` (containing only `tests/.temp/`) were overwriting `templates/common/.gitignore` during scaffolding, stripping `.env` exclusion (`templates/co-develop/`, `co-design/`, `co-security/`, `co-work/`)
- **[2026-06-01]**: fix: workspace root cleanup — removed `%userprofile%/` (Windows env var bug), `.sandbox/`, `CHANGELOG_ENTRY.md`, `.agents/` (stale skills mirror), `debug-test/`, `bootstrap.ps1` (unused); `CHANGELOG_ENTRY.md` added to `.gitignore`

### Changed
- **[2026-05-31]**: update: modified `audit.ts`, `dev-sync.ts`, `verify-memory.ts`, `upgrade-project` scripts, and `CONSTITUTION.md` for memory system archiving support
- **[2026-05-31]**: refactor: swapped the order of the last two steps in the Execution Task Plan boilerplate (Lifecycle Update is now N-1, and Final QA Audit is N) across all 10 CLAUDE.md and GEMINI.md files (at root and in the 4 templates)
- **[2026-05-31]**: refactor: removed "Phase 5:" and "Phase 6:" prefixes from execution plan boilerplate in CLAUDE.md and GEMINI.md (both at root and across all 4 templates) to reduce cognitive friction between 'Steps' and 'Phases'
- **[2026-05-31]**: refactor: `meeting-facilitation` SKILL.md converted to stubs; established `.gemini/commands/meeting.md` as SSOT alongside `.claude/commands/meeting.md`; updated Antigravity Command Intercept Rule in `GEMINI.md` (and template copies)

### Fixed
- **[2026-06-01]**: fix: resolve stray test files cluttering the workspace root
  - **[2026-06-01]**: Created a standard test scratchpad at `tests/.temp/` and ignored it in all `.gitignore` files.
  - **[2026-06-01]**: Updated test scripts (`test-runner.ts`, `test-new-project.ts`, `new-project` wrappers) to output there and perform automated cleanup.
  - **[2026-06-01]**: Documented `tests/.temp/` in `CONSTITUTION.md` and updated `audit.ts` to actively scan and block stray test files (e.g., `out.txt`, `NUL`, `Test-*`).
- **[2026-05-31]**: fix: propagate PR gate protections to Antigravity platform and all generated projects — added SessionStart `.githooks` hook to all 4 variant `.gemini/settings.json` files (clone-safe), created `.gemini/commands/commit-push-pr.md` and `.gemini/skills/finishing-a-development-branch/SKILL.md` for Gemini/Antigravity, propagated all protections to `templates/common/.claude/` and `templates/common/.gemini/`, added Check P-02 to `validate-templates.ts` (root↔common command parity for both platforms), added `.claude/commands/`, `.claude/skills/`, `.gemini/commands/`, `.gemini/skills/` lifecycle rules to CLAUDE.md and GEMINI.md §9
- **[2026-05-31]**: fix: enforce `/sync` as sole PR creation path across Claude, Gemini, and Antigravity platforms — pre-commit `--no-verify` prohibition hardened, local `finishing-a-development-branch` override created, `commit-push-pr` redirect command added, `SYNC_ACTIVE` mechanism documented in all variant CLAUDE.md and GEMINI.md (9 files), `run_command` git safety rules and `invoke_subagent` commit prohibition added to GEMINI.md for Antigravity, `templates/common/.claude/settings.json` PostToolUse hook added

### Added
- **[2026-05-31]**: feat: added `archive-memory.ts` script to archive memory markdown files older than 7 days
- **[2026-05-31]**: feat: implement Mandatory Lifecycle Dispatch across all platforms
  - **[2026-05-31]**: Hardcoded the `lifecycle-manager` as the mandatory Step N-1 (Phase 6) in the `implementation_plan.md` boilerplate inside `GEMINI.md`, immediately followed by a Final QA Audit (`auditor`) as Step N.
  - **[2026-05-31]**: Added an explicit `lifecycle-manager` row and `auditor` Final QA row to the `Mandatory Execution Plan Display` section in `CLAUDE.md`, enforcing that all file modifications are strictly audited before `/sync`.
- **[2026-05-31]**: refactor: deprecate legacy physical PM Approval hooks globally
  - **[2026-05-31]**: Purged `check-pm-approval.ts` and `clear-pm-approval.ts` from all `settings.json` files in the workspace root and all variant templates.
  - **[2026-05-31]**: Deleted the obsolete hook scripts from `templates/common/scripts/` to prevent propagation, and formally marked them as `deprecated` in `SCRIPTS.md`.
  - **[2026-05-31]**: Removed outdated `.pm-approved` flag instructions from `GEMINI.md` and `CLAUDE.md`, cementing the Double-Lock Strategy as the sole enforcement mechanism.
- **[2026-05-31]**: fix: resolve template compatibility crash caused by lifecycle boilerplate
  - **[2026-05-31]**: Promoted the `auditor` QA agent to a Common Agent (`templates/common/agents/auditor.md`) to ensure it is scaffolded into all new projects, preventing dispatch errors when executing the hardcoded Phase 6 QA boilerplate.
  - **[2026-05-31]**: Registered `auditor` in `common-contract.json` while deliberately preserving the root `agents/auditor.md` to maintain the framework's own stringent QA validation logic.
  - **[2026-05-31]**: Retroactively applied missing lifecycle updates (`@version 1.0.3` to `validate-templates.ts`, `last_updated` to `pm.md`) and propagated to all templates.
- **[2026-05-31]**: feat: implement Double-Lock Strategy for systemic Agent Dispatch Rules enforcement
  - **[2026-05-31]**: Injected literal Markdown boilerplate for `implementation_plan.md` into root and template `GEMINI.md` files to eliminate instruction drift.
  - **[2026-05-31]**: Strengthened `agents/pm.md` constraints to strictly mandate copy-pasting the exact `[Step, Task, Agent, Tier, Model]` table format into chat and artifacts.
- **[2026-05-31]**: feat: enforce Planning Mode Agent Dispatch Rules and adopt Hybrid Abstraction for model tiers
  - **[2026-05-31]**: Decoupled hardware model versions from agent definitions by stripping literal model comments (`# gemini-3.1-pro`) from 45 agent files across root and templates.
  - **[2026-05-31]**: Established `templates/common/docs/context.md` as the local Single Source of Truth for model tier mappings in scaffolded projects.
  - **[2026-05-31]**: Added `Execution Task Plan` format requirement to `GEMINI.md` to force the PM to explicitly declare Agent Dispatch Rules in `implementation_plan.md`.
  - **[2026-05-31]**: Refactored `validate-templates.ts` to support the new Hybrid Abstraction architecture by removing comment hint validation.
- **[2026-05-31]**: feat: enforce `/sync` pipeline usage and upgrade Gemini 3-Tier models
  - **[2026-05-31]**: Block direct `git commit` via `scripts/hooks/pre-commit.ts` to enforce `dev-sync.ts` logging. Added `--no-verify` fallback for intentional hotfixes.
  - **[2026-05-31]**: Upgraded Gemini models in `workspace-schema.json` and all agent files (`gemini-3.1-pro` for High, `gemini-3.5-flash` for Medium/Low).
  - **[2026-05-31]**: Updated `validate-templates.ts` to strictly validate `gemini` platform schema across 38 agent templates.
- **[2026-05-31]**: feat: implement Skill Resolution Priority and cross-platform section parity check
  - **[2026-05-31]**: Defined 3-tier Skill Resolution Priority (Local > Config > Global) in `docs/decisions/0001-skill-resolution-priority.md`
  - **[2026-05-31]**: Added Skill Resolution Priority rule to `CLAUDE.md` and all template variants' `CLAUDE.md` and `GEMINI.md`
  - **[2026-05-31]**: Extended `validate-templates.ts` to perform strict section parity checks across root documentation and templates
- **[2026-05-30]**: feat: implement 3-Tier QA Framework for lifecycle governance
  - **[2026-05-30]**: Tier 1 (Gatekeeper): Pre-commit hook lifecycle compliance verification in `scripts/hooks/pre-commit.ts`
  - **[2026-05-30]**: Tier 2 (Sentinel): Agent execution result verification in `scripts/verify-agent-deliverables.ts`
  - **[2026-05-30]**: Tier 3 (Auditor): CI/CD pipeline comprehensive audit in `.github/workflows/test.yml`
  - **[2026-05-30]**: Prevents recurring governance failures: script modifications without SCRIPTS.md updates, agent "report forgery", and missing lifecycle audits
- **[2026-05-30]**: `scripts/verify-readme-sync.ts` — improved warning messages with change summary and actionable guidance for translators
- **[2026-05-30]**: `scripts/translate-readme.ts` — translation helper tool with diff preview, section analysis, and hash synchronization check
- **[2026-05-30]**: `skills/translate/SKILL.md` — translation helper skill with integrated English + Korean documentation
- **[2026-05-30]**: Meeting transcript: `memory/meeting-2026-05-30-readme-auto-sync-review.md` — rejected automatic README overwriting; adopted improved warnings + translation helper tool
- **[2026-05-30]**: Meeting transcript: `memory/meeting-2026-05-30-qa-lifecycle-enforcement.md` — 3-Tier QA Framework design and implementation plan
- **[2026-05-30]**: Meeting transcript: `memory/meeting-2026-05-30-translator-guide-language-and-skill-conversion.md` — resolved TRANSLATOR_GUIDE.md language policy violation via skill integration

### Changed
- **[2026-05-30]**: `scripts/new-project.ps1` — realigned structure and step numbering to match `new-project.sh`; removed unused `-Description`/`-TechStack` params and dead `Validate-TemplateSync` function; added `test-*` exclusion to script-pair check
- **[2026-05-30]**: `.claude/settings.json` — removed PM approval `PreToolUse` hook (`check-pm-approval.ts`)
- **[2026-05-30]**: `scripts/hooks/pre-commit.ts` — bumped to v1.0.2; added Tier 1 Gatekeeper lifecycle compliance check
- **[2026-05-30]**: `scripts/verify-readme-sync.ts` — bumped to v1.0.1; enhanced error messages with structured guidance
- **[2026-05-30]**: `scripts/SCRIPTS.md` — registered `translate-readme.ts` (v1.0.0), `verify-agent-deliverables.ts` (v1.0.0), and `hooks/pre-commit.ts` (v1.0.2)

### Fixed
- **[2026-05-30]**: Language policy violation — resolved `scripts/TRANSLATOR_GUIDE.md` Korean documentation by integrating into `skills/translate/SKILL.md` with English primary + Korean section
- **[2026-05-30]**: Agent "report forgery" incident — `translate-readme.ts` reported as complete but file not created; implemented verification to prevent recurrence via Tier 2 Sentinel
- **[2026-05-31]**: Template README titles — replaced hardcoded titles in co-develop, co-security, co-work README.md with {{PROJECT_NAME}} placeholder for better template flexibility
- **[2026-05-31]**: Documentation — added meeting transcript for PR sync conflict resolution (finishing-a-development-branch vs /sync workflow)

### Added
- **[2026-05-30]**: feat: implement TS-based hooks and template synchronization
- **[2026-05-29]**: `templates/common/phase-definitions.md` — comprehensive 6-phase workflow definition with PM facilitator tasks for each phase (Initiation, Planning, Design Handoff, Execution, QA, Finalization)
- **[2026-05-29]**: Multi-Agent Phase Definitions section — added to all 4 variant AGENTS.md files (co-develop, co-design, co-work, co-security) with phase-specific specialist agent mappings and PM orchestrator guidance
- **[2026-05-29]**: `memory/meeting-2026-05-29-pm-facilitator-transition-review.md` — meeting transcript documenting 3-agenda review: PM facilitator transition, skill lifecycle procedures, and script advancement needs
- **[2026-05-29]**: `README.md` — added platform-specific installation methods to Project-Specific Tools table (e.g., `winget install OpenJS.NodeJS` for Windows) and reference to Getting Started guide
- **[2026-05-29]**: `templates/common/docs/context.md` — added "Platform-Specific Tools" table with standard package managers (winget, brew, apt, dnf) for consistent installation experiences
- **[2026-05-29]**: `docs/getting-started.md` — comprehensive installation guide with prerequisites checklist, troubleshooting, and platform-specific instructions
- **[2026-05-29]**: TypeScript helper scripts for project creation — `scripts/helpers/` directory with 8 modular scripts (template-validation.ts, lifecycle-governance.ts, validate-output.ts, substitute-placeholders.ts, update-variant-lifecycle.ts, write-scripts-snapshot.ts, merge-package-scripts.ts, inject-skills.ts)
- **[2026-05-29]**: Test 0e to `test-new-project.ts` — validates new-project.sh template verification logic checks common/ and variant/ separately
- **[2026-05-29]**: Documentation restructuring — Runtime vs Governance separation: `agents/*.md` with lifecycle frontmatter (phase, created, last_updated, governance) and `docs/lifecycle/agents/*.md` with detailed governance records
- **[2026-05-29]**: `docs/governance/` directory — centralized governance documentation (branch-strategy.md, pr-workflow.md, skill-update-procedure.md, LIFECYCLE_GOVERNANCE.md, lifecycle-governance.json)
- **[2026-05-29]**: `templates/common/variant/` directory — variant phase definitions moved from `docs/variant/` to correct template location
- **[2026-05-29]**: Lifecycle validation scripts — `validate-agents.sh`, `validate-skills.sh`, `validate-doc-folder.sh`, `cleanup-completed-md.sh`
- **[2026-05-29]**: `docs/lifecycle/` directory — governance records for all agents and skills with Phase History and Acceptance Criteria sections
- **[2026-05-29]**: `scripts/audit.sh` / `audit.ps1` — `check_command_parity()` check: compares `.claude/commands/` file list against `.gemini/commands/` and WARNs on missing files; supports `gemini-parity: skip` frontmatter for intentional Claude-only exceptions
- **[2026-05-29]**: `.gemini/commands/` directory at workspace root — `meeting.md`, `changelog.md`, `memlog.md`, `new-task.md`, `sync.md` created (cross-platform parity with `.claude/commands/`)
- **[2026-05-29]**: `docs/constitution/06-skill-lifecycle.md` — **Cross-Platform Deployment Rule** section: any command file in `.claude/commands/` must have a matching file in `.gemini/commands/`; `gemini-parity: skip` frontmatter as explicit opt-out mechanism
- **[2026-05-29]**: PM Orchestrator mode in `/meeting` skill — when PM is in participant list (default), PM opens each round (agenda + agent nomination), closes each round (synthesis + provisional decision), and delivers final synthesis owning the action items table; applied to all 6 meeting.md files (workspace root + 4 variants + templates/common/.gemini)
- **[2026-05-29]**: Meeting transcript: `memory/meeting-2026-05-28-gemini-parity-gap.md` — root cause analysis of Gemini command parity gap; 5 action items (A-01~A-05)
- **[2026-05-29]**: Meeting transcript: `memory/meeting-2026-05-28-script-pair-sync.md` — structural analysis of `intentional drift` policy flaw in `.sh`/`.ps1` horizontal sync; proposed `pair` field to SCRIPTS.md schema; 5 action items (A-01~A-05)

### Changed
- **[2026-05-29]**: `scripts/new-project.ps1` — fixed final working directory to match SH behavior; script now exits at workspace root (not project directory) after saving original location; aligns with README instructions for manual `cd`
- **[2026-05-29]**: `docs/getting-started.md` — removed redundant "Python 3 (Optional - Project-Specific)" section; simplified to avoid duplication with Optional Software section
- **[2026-05-29]**: `README.md` — added "Project-Specific Tools" table; removed Python/uv from Optional Tools; clarified project-specific tool installation
- **[2026-05-29]**: `docs/getting-started.md` — reclassified Python 3 from "essential" to "optional" (project-specific); updated prerequisites checklist to reflect Git + Bun as the only truly essential tools
- **[2026-05-29]**: `README.md` — removed Python from "Must-Have Tools" section; moved to "Optional Tools" (Python projects only)
- **[2026-05-29]**: `scripts/new-project.sh` — replaced all Python inline code with TypeScript helper calls; UTF-8 decoding errors resolved
- **[2026-05-29]**: `scripts/new-project.ps1` — replaced PowerShell native code with TypeScript helper calls; now uses identical logic to SH version (single source of truth)
- **[2026-05-29]**: `.claude/settings.json` and all template settings files — fixed SessionStart hook structure (added missing `matcher` and `hooks` wrapper)
- **[2026-05-29]**: `.gitignore` — added negation patterns for `!docs/governance/`, `!docs/lifecycle/`, `!docs/variant/`, `!docs/designs/`, `!templates/common/`
- **[2026-05-29]**: `CLAUDE.md` §2 — added platform parity note: "every command file in `.claude/commands/` must have a matching file in `.gemini/commands/`; see CONSTITUTION.md §6"
- **[2026-05-29]**: `GEMINI.md` §6 — added platform parity note referencing `CONSTITUTION.md §6 Cross-Platform Deployment Rule`
- **[2026-05-29]**: `.claude/commands/new-project.md` — added `gemini-parity: skip` frontmatter (Claude Code Agent tool dispatch has no Gemini equivalent)
- **[2026-05-29]**: `/meeting` skill — `Orchestrator: [PM | Facilitator]` field added to meeting header; transcript metadata includes orchestrator field

### Fixed
- **[2026-05-29]**: Template folder structure — deleted completed plan files (`PHASE_3_DELIVERY.md`, `VARIANT_LIFECYCLE_INTEGRATION.md`), moved governance docs to `docs/governance/`
- **[2026-05-29]**: `templates/common/scripts/readme-lifecycle-audit.ts` (L1) — published CRLF fix from L0; L0/L1 drift resolved (both now normalize `\r\n` → `\n` in `parseSections`)
- **[2026-05-29]**: `scripts/audit.ps1` — added command parity check block mirroring `audit.sh` `check_command_parity()` (was absent, discovered via user review)

### Added
- **[2026-05-28]**: `scripts/upgrade-project.sh` / `.ps1` — new scripts to upgrade existing projects to the latest template version with 3-tier file classification (LOCKED/MERGE/PRESERVE), `--dry-run`, `--platform`, and pre-upgrade git stash snapshot
- **[2026-05-28]**: `--platform claude|antigravity|both` flag to `scripts/new-project.sh` / `.ps1` — controls which AI platform config files are included (default: `both`)
- **[2026-05-28]**: Security Bootstrap Check (5-point) to `scripts/new-project.sh` / `.ps1` and `upgrade-project.sh` / `.ps1` — halts on missing `.gitleaks.toml`, `.githooks/pre-commit`, `.gitattributes eol=lf`, `.gitignore .env`, or unset `core.hooksPath`
- **[2026-05-28]**: `CONSTITUTION.md §10 Terminology` — canonical definitions for Template Variant, Platform Profile, WORKSPACE-MANAGED Marker, LOCKED/MERGE/PRESERVE tiers, Platform Documentation Parity, Script Parity Annotation
- **[2026-05-28]**: Security & Hook Configuration section with `WORKSPACE-MANAGED` markers to all 3 variant `GEMINI.md` templates (`co-develop`, `co-design`, `co-work`)
- **[2026-05-28]**: feat: Variant lifecycle management system - 4-stage lifecycle (draft → beta → stable → deprecated) with transition criteria
- **[2026-05-28]**: feat: Template version tracking system - .template-info.json auto-generation on project creation
- **[2026-05-28]**: feat: /template-status skill for checking current template version against latest
- **[2026-05-28]**: feat: Template CHANGELOG.md and migration guide system in templates/common/
- **[2026-05-28]**: feat: validate-templates.ts lifecycle-based validation (status-aware checks)
- **[2026-05-28]**: feat: Common security-check.md for all variants (.gemini/commands/)
- **[2026-05-28]**: docs: Beta usage scope documentation in co-security.context.md
- **[2026-05-27]**: `scripts/publish-to-template.sh` / `.ps1` — new scripts to sync workspace changes into `templates/common/` (#109)
- **[2026-05-27]**: `skills/` directory — 9 workspace-root skills with SKILL.md, data files, and Python scripts (`ui-ux-pro-max`, `agent-lifecycle-manager`, `skill-lifecycle-manager`, `script-lifecycle-manager`, `meeting-facilitation`, `audit-workspace`, `security-scan`, `simulate-project-creation`, `validate-docs-links`) (#109)
- **[2026-05-27]**: `template-v0.5.0` git tag — enables `.\scripts\new-project.ps1 "name" -Version 0.5.0` versioned scaffold (#110)

### Changed
- **[2026-05-28]**: `agents/docs-writer.md` — tier promoted Low→Medium (`claude-sonnet-4-6`); role split with Architect (DocsWriter executes, Architect designs document architecture)
- **[2026-05-28]**: `AGENTS.md`, `CLAUDE.md` — Documentation Writer tier updated to Medium across all roster tables
- **[2026-05-28]**: chore: Variant status corrections
  - **[2026-05-29]**: co-develop: stable 0.4.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-work: stable 0.5.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-design: stable 0.5.0 → stable 1.0.0 (version bump per lifecycle requirements)
  - **[2026-05-29]**: co-security: draft 0.1.0 → beta 0.2.0 (beta promotion after A-04 verification)
- **[2026-05-28]**: chore: new-project.sh/ps1 now creates .template-info.json by default for all variants

### Security
- **[2026-05-28]**: security: co-security beta status restricts usage to test environments only (actual customer engagements prohibited)

### Fixed
- **[2026-05-27]**: `scripts/new-project.ps1`: wrap `git archive` and `tar` in `try/catch` to suppress `NativeCommandError` under inherited `ErrorActionPreference=Stop` (#112)
- **[2026-05-27]**: `scripts/new-project.ps1`: switch from PowerShell pipe to `git archive -o <tempfile>` + `tar -x -f <tempfile>` — PowerShell pipes corrupt binary tar streams (#111)
- **[2026-05-27]**: `templates/common/scripts/setup.ps1`: add `exit 0` at end — `git commit` exit code 1 ("nothing to commit") was causing false ⚠️ Setup error warning in `new-project.ps1` (#110)
- **[2026-05-27]**: `scripts/new-project.ps1`: improve error message for `git archive` failure on pre-v0.5.0 tags that lack `templates/common/` structure (#110)
- **[2026-05-27]**: `.gitattributes`: add `eol=lf` to `*.md` rule — CRLF on Windows checkout was corrupting YAML frontmatter in SKILL.md files, breaking `skill-lifecycle-audit.ts` (#111)
- **[2026-05-27]**: `skills/*.md`: normalize CRLF to LF; add missing `owner: pm` frontmatter field to 4 skills (`agent-lifecycle-manager`, `meeting-facilitation`, `script-lifecycle-manager`, `skill-lifecycle-manager`) (#109)
- **[2026-05-27]**: `templates/common/scripts/setup.ps1`: wrap `git clone`, `git rev-parse`, `git add`, `git commit` in `try/catch` — all inherited `NativeCommandError` false positives (#107, #108)

### Added
- **[2026-05-27]**: feat: Implement README synchronization policy and workspace QA rules

### Added
- **[2026-05-27]**: feat: Implement architectural refinements (TS migration, URL fix, Script parity)

### Added
- **[2026-05-27]**: chore\:\ update

### Added
- **[2026-05-27]**: chore\:\ update

### Added
- **[2026-05-27]**: `templates/common/docs/context.md` — new immutable common context file (project identity, architecture, key files, documentation standards) (#95)
- **[2026-05-27]**: `templates/co-develop/docs/co-develop.context.md` — new variant config file (tech stack, agents, skills, scripts, workflow) with lifecycle status columns (#95)
- **[2026-05-27]**: `templates/co-design/docs/co-design.context.md` — new variant config file for design projects (#95)
- **[2026-05-27]**: `templates/co-work/docs/co-work.context.md` — new variant config file for collaboration projects (#95)
- **[2026-05-27]**: All variant CLAUDE.md and GEMINI.md — Session Start context loading order added (#95)
- **[2026-05-27]**: `scripts/new-project.sh` / `.ps1` — provenance to variant.context.md; docs/context.md merge=ours in .gitattributes (#95)
- **[2026-05-27]**: `templates/common/scripts/SCRIPTS.md` — script lifecycle registry (Registry + Guide dual-section) (#96)
- **[2026-05-27]**: `scripts/verify-scripts.ts` — script registry verifier with --verify / --generate / --report modes (#96)
- **[2026-05-27]**: `CONSTITUTION.md §6.5` — Script Lifecycle Management section (ownership layers, states, deprecation/security protocols) (#96)
- **[2026-05-27]**: Meeting transcripts English mandate — `/meeting` skill updated to always save transcripts in English regardless of dialogue language; all variant `meeting.md` commands updated
- **[2026-05-27]**: Existing Korean meeting transcripts translated to English (`meeting-2026-05-27-template-lifecycle-review.md`, `meeting-2026-05-27-script-lifecycle-context-structure.md`)
- **[2026-05-27]**: `.githooks/pre-commit` — removed meeting-transcript Korean exemption; all `memory/*.md` files now subject to English-only enforcement
- **[2026-05-27]**: `scripts/verify-memory.ts` — memory log format verifier with --verify / --report modes (#99)
- **[2026-05-27]**: `scripts/sync-md.sh/ps1` — MEMORY.md 3-section structure (Sessions/Meetings/ADRs) with --meeting and --adr flags (#99)

### Changed
- **[2026-05-27]**: `.githooks/commit-msg` — auto-log now generates mandatory 4-section format (## Session Summary / ## Changes / ## Decisions / ## Open Issues) (#99)
- **[2026-05-27]**: `memory/MEMORY.md` — restructured into Sessions / Meetings / ADRs sections (#99)
- **[2026-05-27]**: `.claude/commands/memlog.md` — auto-scaffolds 4-section format with git diff pre-populated (#99)
- **[2026-05-27]**: `/meeting` skill — now registers transcript to MEMORY.md Meetings section after saving (#99)
- **[2026-05-27]**: `scripts/audit.sh` — memory format audit integrated as non-blocking warning (#99)

### Changed
- **[2026-05-27]**: `.github/pull_request_template.md` redesigned with Summary/Changes table/Test Plan/Security Checklist sections — applied to workspace and all template variants (#93)
- **[2026-05-27]**: `CONSTITUTION.md §2`: Memory session log mandatory four-section format (Session Summary, Changes, Decisions, Open Issues) with cross-tool consistency note (#93)
- **[2026-05-27]**: `CONSTITUTION.md §2.1`: CHANGELOG entry `(#PR-number)` reference requirement (#93)
- **[2026-05-27]**: `Documentation Standards` section added to all variant `docs/context.md` files (co-develop, co-design, co-work) (#93)
- **[2026-05-27]**: `scripts/dev-sync.sh` + `.ps1`: `[Unreleased]` content check — warns if section is empty before commit (#93)
- **[2026-05-27]**: `templates/common/.githooks/pre-commit`: §2-A UTF-8 Markdown encoding check + §2-B English-only enforcement added; section order corrected (#93)
- **[2026-05-27]**: `scripts/`: reverse-sync from `templates/common/scripts/` — added `verify-skills.ts`, `install-bun.sh/.ps1`, `dispatch-parallel.ts`, `dispatch-serial.ts`, `dispatch.ts`, `retry-handler.ts` (#93)

### Changed
- **[2026-05-27]**: `templates/CHANGELOG.md`: added `[0.5.0]` release entry with `(#PR)` reference format — establishes PR reference convention (#93)
- **[2026-05-27]**: `.githooks/pre-commit`: section header emoji replaced with `──` separator style for consistency with template (#93)

### Changed
- **[2026-05-26]**: docs: simplify co-develop variant summary for consistency

### Changed
- **[2026-05-26]**: docs: update variant summaries in root READMEs to reflect domain-native workflows

### Changed
- **[2026-05-26]**: docs: update co-design and co-work context.md with domain-native workflows

### Changed
- **[2026-05-26]**: docs: encapsulate multi-agent workflow details by variant

### Changed
- **[2026-05-26]**: docs: simplify repository structure for better maintainability

### Changed
- **[2026-05-26]**: docs: update templates directory structure in readme

### Changed
- **[2026-05-26]**: docs: sync readme structure with current repository state

### Changed
- **[2026-05-26]**: docs: standardize powershell argument casing in readme

### Changed
- **[2026-05-26]**: chore: remove stale meeting summary files

### Added
- **[2026-05-26]**: feat: enforce english only and utf-8 encoding in git hooks

### Added
- **[2026-05-26]**: feat: implement dynamic template generation and audit hooks

### Added
- **[2026-05-26]**: feat: sync docs context and add template validation logic

### Added
- **[2026-05-26]**: feat: implement agent lifecycle management and sync template agent references

### Added
- **[2026-05-25]**: feat\(lifecycle\)\:\ add\ execution\ location\ output\,\ simplify\ templates

### Added
- **[2026-05-25]**: feat: add agent and skill lifecycle management system with Bun/TypeScript audit scripts
  - **[2026-05-25]**: `scripts/agent-lifecycle-audit.ts` - validates agent frontmatter, AGENTS.md consistency, deprecated agent references
  - **[2026-05-25]**: `scripts/skill-lifecycle-audit.ts` - validates skill frontmatter, owner references, deprecated skills, dependencies
  - **[2026-05-25]**: Pre-commit hooks automatically run audits when agent/skill files are staged
  - **[2026-05-25]**: `.claude/skills/skill-lifecycle-manager/SKILL.md` - PM agent skill for managing skill lifecycle
- **[2026-05-25]**: docs: add lifecycle management sections to CONSTITUTION.md (§5.5 Agent Lifecycle, §6.5 Skill Lifecycle)
- **[2026-05-25]**: docs: add lifecycle management documentation to templates/docs/context.md with frontmatter templates and audit commands

### Changed
- **[2026-05-26]**: Update `README.md` and `README_ko.md` to reflect current state: co-design and co-work variants marked ✅ Stable, agent rosters listed, `common/skills/` added to structure, template version bumped to 0.5.0, branch naming convention updated to `feat/fix/docs` prefix
- **[2026-05-26]**: Bump `templates/VERSION` from `0.4.0` to `0.5.0`
- **[2026-05-25]**: feat: add `role` and `status: active` fields to all workspace root agent files (architect, auditor, automation-engineer, docs-writer, pm, scaffolding-expert, security-expert)
- **[2026-05-25]**: docs: update AGENTS.md and templates/AGENTS.md with skill-lifecycle-manager entry
- **[2026-05-25]**: docs: update platform notes to specify Bun-only for lifecycle audit scripts (removed Bash/PS1 references)
- **[2026-05-25]**: docs: improve README Step 4 - add concrete example (Tetris game) with context guidance and custom agent team explanation to help users understand PM kick-off process
- **[2026-05-25]**: docs: improve README Step 4 - add concrete example (Tetris game) with context guidance and custom agent team explanation to help users understand PM kick-off process
- **[2026-05-25]**: docs: apply same README improvements to README_ko.md for bilingual consistency

### Fixed
- **[2026-05-27]**: Wrap all git native commands in `setup.ps1` with `try/catch` to suppress PS5.1 `NativeCommandError` inheritance from `new-project.ps1` — affects `git clone`, `git rev-parse`, `git add`, `git commit` (`templates/common/scripts/setup.ps1`, #107, #108)
- **[2026-05-25]**: feat: enhance memory log format - commit-msg hook now captures rich context (summary, file count, decisions, issues) from commit body instead of generic placeholders
- **[2026-05-25]**: fix: resolve param syntax bug in powershell scripts

### Added
- **[2026-05-24]**: docs: multi-agent meeting summary - 96 improvement opportunities identified across 7 agents
- **[2026-05-24]**: feat: establish multi-agent harness for workspace root

### Added
- **[2026-05-24]**: feat: add scripts/temp directory for scratch scripts with gitignore rules

### Changed
- **[2026-05-24]**: chore: remove leftover temporary automation scripts from workspace root

### Changed
- **[2026-05-24]**: refactor: consolidate Session Start/Context Loading into CONSTITUTION.md and remove duplicates from CLAUDE and GEMINI templates

### Changed
- **[2026-05-24]**: refactor: remove duplicated Response Language block from GEMINI.md

### Changed
- **[2026-05-24]**: docs: backfill today's changelog entries that were missed due to the previous bug

### Fixed
- **[2026-05-24]**: scripts/dev-sync.*, 	emplates/scripts/dev-sync.*: Fixed bug where Changelog auto-add would skip logging after the first commit in a release cycle.
- **[2026-05-24]**: 	emplates/GEMINI.md, 	emplates/docs/context.md: Moved 'Pre-PR Security Gate' rule from GEMINI-specific instructions to common context.md Git/PR Workflow as it applies to all agents.
- **[2026-05-24]**: scripts/*.ps1, 	emplates/scripts/*.ps1: Fixed critical Windows CP949 encoding corruption bug by enforcing -Encoding UTF8 on all Get-Content calls.
- **[2026-05-24]**: 	emplates/AGENTS.md, 	emplates/CLAUDE.md, 	emplates/GEMINI.md, 	emplates/docs/context.md: Deduplicated behavioral rules into context.md and restored 3-tier strategy references. Removed Em Dashes to prevent encoding errors.


### Added
- **[2026-05-23]**: `templates/docs/context.md`, `templates/agents/pm.md`, `templates/agents/*.md`: PM-first multi-agent workflow enforcement. Added "Multi-Agent Workflow" section to context.md as single source of truth; PM agent declared as SINGLE ENTRY POINT; all specialist agents (architect, designer, code-writer, test-runner, security-monitor, stack-setup) now refuse direct invocation and redirect to PM.
- **[2026-05-23]**: `templates/CLAUDE.md`, `templates/GEMINI.md`: Added brief "Multi-Agent Workflow" reference pointing to docs/context.md; eliminated duplication.
- **[2026-05-23]**: `.githooks/pre-commit` + `templates/.githooks/pre-commit`: New §1-B - auto-creates memory log entry and CHANGELOG entry on every direct `git commit`, not just when using `dev-sync.sh`. Reads commit message from `.git/COMMIT_EDITMSG`; skips duplicates already written by dev-sync; stages generated files into the same commit.
- **[2026-05-23]**: `GEMINI.md`: Added §4 PR Language Rule (reference to CONSTITUTION.md §3); renumbered §4-7 → §5-8; Git & PR Additions: added PR Language bullet.
- **[2026-05-23]**: `CLAUDE.md`, `GEMINI.md`, `templates/CLAUDE.md`, `templates/GEMINI.md`, `templates/docs/context.md`: PR Language Rule consolidated to CONSTITUTION.md §3 as single source of truth; removed inline duplicates; all files now reference §3 instead.
- **[2026-05-23]**: `.github/pull_request_template.md`: Converted to English-only (removed Korean bilingual labels).
- **[2026-05-23]**: `templates/docs/context.md`, `templates/CLAUDE.md`, `templates/GEMINI.md`: §7 PR Language Rule added to scaffold - new projects inherit the English-only PR rule from creation.
- **[2026-05-23]**: `README_ko.md`: Step 3 updated from tool-based (Claude Code/Antigravity) to OS-based format; AI tool shortcut moved to tip note.
- **[2026-05-23]**: `templates/README_ko.md`: Full UTF-8 Korean rewrite replacing EUC-KR-corrupted content; mirrors `templates/README.md` structure.

### Added
- **[2026-05-23]**: `.githooks/pre-commit`: Add Markdown date auto-bumper and CHANGELOG auto-dating logic. Automatically updates `Last Updated:` date in staged `.md` files upon commit, and injects date into undated `CHANGELOG.md` entries.

### Removed
- **[2026-05-23]**: `README.md` / `README_ko.md`: Remove obsolete manual "Multi-Agent Kickoff" instruction text (automated in the background via post-checkout hook).


### Added -Go/Rust/Elixir stack support + unknown-stack security agent
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Go (`go mod download` + `go-licenses`), Rust (`cargo fetch` + `cargo-license`), Elixir (`mix deps.get`) stacks added; unknown-stack detection block prints a security banner pointing users to `agents/stack-setup.md` and blocks accidental installs
- **[2026-05-23]**: `templates/agents/stack-setup.md` (NEW): 6-phase security-conscious agent for unrecognized stacks -Stack ID -Web Research -Mandatory Security Review (?/?/? risk levels, HIGH requires `CONFIRM HIGH RISK`) -Present Plan -Execute via sub-agent -Persist to setup.sh/ps1
- **[2026-05-23]**: `templates/AGENTS.md`: `stack-setup` added to Agent Roster (? Security/Setup group) and Subagent Roster dispatch table

### Added -Multi-stack setup automation with mandatory Python venv and cross-platform support
- **[2026-05-23]**: `templates/scripts/setup.sh` + `setup.ps1`: Python venv now uses `uv venv` + `uv pip install` when uv is available, falling back to `python -m venv` + `pip`; `py_install`/`Py-Install` helper abstracts manager; multi-stack OS-aware setup with OSI license audit -Node.js (npm + `license-checker`), Python (uv/venv + `pip-licenses`), Ruby, .NET, Maven, Gradle, CMake/Makefile; `--skip-license-check` flag
- **[2026-05-23]**: `CONSTITUTION.md` §8.5: Open-Source Package Policy -prefer OSI-approved licenses, document non-OSS exceptions
- **[2026-05-23]**: `templates/docs/context.md`: Coding Guidelines §5 Open-Source Package Policy added
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: step 9 prints directory-change banner with exact `cd <path>` command


### Changed -Antigravity 2.0 / Gemini CLI session start config (workspace + templates + 4 sub-projects)

**`GEMINI.md` (workspace root)**
- **[2026-05-23]**: Tool mapping expanded with full operational guidance (`StartLine`, `EndLine`, `IsArtifact`, `MatchPerLine`, `NEVER use cd`)
- **[2026-05-23]**: 🚨 Multi-replace offset safeguard added (bottom-to-top chunk ordering rule)
- **[2026-05-23]**: 🚨 Grep 50-match cap safeguard added (partitioning remediation)
- **[2026-05-23]**: Planning Mode artifact specifications added (`implementation_plan.md`, `task.md`, `walkthrough.md` -brain/ paths + ArtifactType metadata)
- **[2026-05-23]**: Subagent orchestration added (`define_subagent`, `invoke_subagent` JSON examples, `send_message`, Reactive Wakeup)

**`CLAUDE.md` (workspace root)**
- **[2026-05-23]**: Added note to skip Session Start steps 2, 3, 5 in workspace root (due to absence of docs/context.md and AGENTS.md)

**`templates/GEMINI.md`**
- **[2026-05-23]**: Fully applied identical Antigravity 2.0 settings (safeguards, Planning Mode artifacts, Subagent orchestration)
- **[2026-05-23]**: Removed duplicate `### Session Start` section at bottom of file (identical to `## Context Loading` at top)

### Changed -`scripts/audit.sh` + `scripts/audit.ps1` (workspace root) + `templates/scripts/audit.sh` + `templates/scripts/audit.ps1`
- **[2026-05-23]**: Moved CHANGELOG.md `[Unreleased]` section check outside `docs/context.md` condition block -enforced equally for workspace root and new projects
- **[2026-05-23]**: scripts/audit.ps1 (workspace root): synced to 8 checks with .sh -added missing checks for AGENTS.md, agents/, .env.sample, scripts parity

### Fixed
- **[2026-05-23]**: MD file consistency: unified Session Start Checklist across CLAUDE.md, GEMINI.md, and README.md (including templates/)
- **[2026-05-23]**: MD file consistency: updated subagent Phase 4 execution loop and `/sync` pipeline descriptions in `templates/` and root configurations

### Added
- **[2026-05-23]**: `scripts/sync-md.sh` and `scripts/sync-md.ps1` -missing files required by `dev-sync.sh` (workspace pipeline was broken without them)

### Fixed + Added -Global best practices audit (13 items)

**P1 -Bugs / Inconsistencies:**
- **[2026-05-23]**: `CONSTITUTION.md §5`: added `purple` to color palette (was missing after designer.md update)
- **[2026-05-23]**: `CONSTITUTION.md §5`: fixed JSON Input Contract -removed `//` comments (invalid JSON syntax)
- **[2026-05-23]**: `CONSTITUTION.md §1`: added `.github/` (workflows/, CODEOWNERS, pull_request_template.md) and `SECURITY.md` to standard folder structure
- **[2026-05-23]**: `CONSTITUTION.md §3`: added `perf:`, `ci:`, `style:`, `revert:` to Conventional Commits table (Conventional Commits v1.0 compliance)
- **[2026-05-23]**: `CONSTITUTION.md § Workspace`: unified Session Start checklist order (1?ONSTITUTION, 2?ontext.md, 3?GENTS.md, 4?EMORY.md, 5?kills) -was inconsistent with CLAUDE.md
- **[2026-05-23]**: `scripts/dev-sync.sh` + `dev-sync.ps1` (workspace): use `.github/pull_request_template.md` for PR body when present; fall back to `--fill`
- **[2026-05-23]**: `scripts/dev-sync.sh` (workspace): applied same perl escape fix and branch guard as templates

**P2 -Feature gaps:**
- **[2026-05-23]**: `CONSTITUTION.md §2`: added memory archiving policy (50-row threshold, 30-day retention, `memory/archive/` for older logs, `docs/history.md` for ADR summaries)
- **[2026-05-23]**: `templates/docs/context.md`: added `## Git / PR Workflow` section (present in all real projects but was missing from the template)
- **[2026-05-23]**: `.editorconfig` + `templates/.editorconfig`: new -charset/indent/EOL/trailing-whitespace rules for all editors (VS Code, JetBrains, Vim, etc.)

**P3 -Best practices:**
- **[2026-05-23]**: `templates/.github/CODEOWNERS`: new -automatic PR reviewer assignment template
- **[2026-05-23]**: `templates/.github/dependabot.yml`: new -dependency auto-update config template (pip/npm/github-actions stubs)
- **[2026-05-23]**: `templates/.github/workflows/ci.yml`: new -GitHub Actions CI stub (audit gate + Python/Node test job stubs)
- **[2026-05-23]**: `SECURITY.md` + `templates/SECURITY.md`: new -security vulnerability reporting policy (GitHub Advisory + response SLA)
- **[2026-05-23]**: `README.md`: updated Conventional Commits list to include new prefixes

### Fixed -Template system (14-item improvement pass)

**P1 -Bugs:**
- **[2026-05-23]**: `templates/scripts/dev-sync.sh`: perl changelog auto-insert now passes `$MSG` as a Perl variable (`BEGIN{$m=shift}`) -prevents breakage when commit message contains `/`, `&`, or `\`
- **[2026-05-23]**: `templates/scripts/dev-sync.ps1`: removed `-NoNewline` from `Set-Content` call -was silently stripping trailing newline from `CHANGELOG.md`
- **[2026-05-23]**: `templates/scripts/sync-md.sh` + `sync-md.ps1`: added deduplication guard -same-day entries no longer appended twice to `MEMORY.md`

**P2 -Feature gaps:**
- **[2026-05-23]**: `templates/scripts/audit.sh` + `audit.ps1`: strengthened from 4 -8 checks (added: AGENTS.md existence, agents/ non-empty, .env.sample existence, scripts .sh/.ps1 parity)
- **[2026-05-23]**: `scripts/new-project.sh` + `new-project.ps1`: post-scaffold audit runs automatically; added initial commit guidance; `.ps1` files now included in `git update-index --chmod=+x`
- **[2026-05-23]**: `templates/README.md`: added `## Contributing` and `## License` placeholder sections; added CLAUDE.md + GEMINI.md to Documentation links
- **[2026-05-23]**: `templates/docs/context.md`: converted Tech Stack from bullet list to table (better AI parseability; consistent with project examples)
- **[2026-05-23]**: `templates/GEMINI.md`: Session Start section now has actual `@`-syntax loading instructions (was comment-only)

**P3 -Quality / best practices:**
- **[2026-05-23]**: `templates/.github/pull_request_template.md`: new file -PR body template for `gh pr create --fill`
- **[2026-05-23]**: `templates/scripts/dev-sync.sh` + `dev-sync.ps1`: added branch guard -if already on a PR branch, commits in place instead of creating a new branch
- **[2026-05-23]**: `templates/memory/MEMORY.md`: added explanatory header distinguishing index (MEMORY.md) from daily logs (YYYY-MM-DD.md)
- **[2026-05-23]**: `templates/agents/designer.md`: changed `color: magenta` -`color: purple` (was conflicting with analyst-example.md)
- **[2026-05-23]**: `scripts/audit.sh` (workspace): synced with template -now runs all 8 checks

### Fixed -MD file comparison (workspace + templates)
- **[2026-05-23]**: `templates/agents/architect.md`: Unicode corruption on line 60 -`Context → Decision` -`Context →Decision` (arrow was mangled to replacement characters)
- **[2026-05-23]**: `templates/agents/pm.md`: Phase 6 Finalization -added Co-Authored-By commit signature requirement
- **[2026-05-23]**: `templates/agents/code-writer.md`: added rule 5 -update `CHANGELOG.md [Unreleased]` after every change
- **[2026-05-23]**: `templates/CLAUDE.md`: added `### Custom Command Error Recovery` section (error handling for `/sync` failures, hook bypass prohibition)
- **[2026-05-23]**: `templates/GEMINI.md`: added `/new-project` and `/post-write` rows to command emulation table
- **[2026-05-23]**: `templates/CHANGELOG.md`: added `---` separator and Semantic Versioning link (parity with workspace format)
- **[2026-05-23]**: `CLAUDE.md` (workspace): added `## Session Start` checklist and doc intent statement at top
- **[2026-05-23]**: `GEMINI.md` (workspace): added `### 3. Response Language` section (Korean/English split rule)

### Changed
- **[2026-05-23]**: Improve `templates/AGENTS.md` with AI disclaimer, dispatch protocol, phase workflow, role boundary matrix, skills table, and expanded maintenance rule

### Fixed
- **[2026-05-23]**: `CONSTITUTION.md §7` -Windows `.\scripts\new-project.ps1` command had a line-break bug rendering it as `.\scripts` + `ew-project.ps1`
- **[2026-05-23]**: `scripts/audit.sh` -remove unused `PASS=0` / `FAIL=1` dead code variables
- **[2026-05-23]**: `CONSTITUTION.md §1` -add workspace-root exception note to AGENTS.md rule
- **[2026-05-23]**: Improve `templates/CLAUDE.md` with doc intent, CLI vs Desktop table, behavioral rules section, git hooks install, Co-Authored-By, and settings.json clarification
- **[2026-05-23]**: Improve `templates/GEMINI.md` with doc intent, tool name mapping table, git commit policy, command emulation guide, and `.claude/` coexistence rules

### Fixed -Missing slash commands / Skill registrations
- **[2026-05-23]**: Added `.claude/commands/memlog.md` (workspace + templates) -registered `/memlog` Skill
- **[2026-05-23]**: Added `.claude/commands/new-task.md` (workspace + templates) -registered `/new-task` Skill
- **[2026-05-23]**: Added `.claude/commands/new-project.md` (workspace only) -registered `/new-project` Skill
- **[2026-05-23]**: CLAUDE.md §2: reflected exact filenames in command table and added explanation of Skill registration principle
- **[2026-05-23]**: templates/CLAUDE.md: added Slash Commands section (specifying command->Skill auto-registration principle)
- **[2026-05-23]**: templates/docs/context.md: added `/memlog` to Development Workflow, added Slash Commands table

### Changed -License
- **[2026-05-23]**: MIT -AGPL-3.0

### Fixed -Scaffold guideline consistency (4th review -final)
- **[2026-05-23]**: CONSTITUTION.md §5: specified Designer parallel dispatch in Phase 3 Governance Workflow

### Fixed -Scaffold guideline consistency (3rd 5-round review)
- **[2026-05-23]**: templates/agents/pm.md: specified designer parallel dispatch in Governance Workflow Phase 3
- **[2026-05-23]**: CONSTITUTION.md §Workspace: corrected Session Start checklist order (swapped 3<->4 -MEMORY.md first, then skills)
- **[2026-05-23]**: CONSTITUTION.md §3: synced /sync pipeline order with actual dev-sync.sh (memlog->MEMORY.md->CHANGELOG->audit->branch->commit->push->PR)

### Fixed -Scaffold guideline consistency (2nd 5-round review)
- **[2026-05-23]**: scripts/new-project.ps1: moved git update-index after git init (removed dead code)
- **[2026-05-23]**: templates/CLAUDE.md: corrected Hooks Override comment (clarified inactive hook state), improved Step 0 expression, specified `model: inherit` default
- **[2026-05-23]**: templates/GEMINI.md: already modified (previous round)
- **[2026-05-23]**: templates/docs/context.md: fixed CONSTITUTION.md link path (`../` -> `../../`)
- **[2026-05-23]**: templates/AGENTS.md: fixed `_examples` relative path (`../../templates/` -> `../templates/`)
- **[2026-05-23]**: CONSTITUTION.md §7: "pm.md + 3 others" -> "+ 4 others", corrected `.claude/settings.json` description
- **[2026-05-23]**: GEMINI.md §3: added `@AGENTS.md` to Context Loading (workspace root)

### Fixed -Scaffold guideline consistency (5-round review)
- **[2026-05-23]**: templates/agents/pm.md: added missing `designer.md` to Agent Roster
- **[2026-05-23]**: templates/CLAUDE.md: detailed Session Start section (4-step checklist)
- **[2026-05-23]**: templates/GEMINI.md: added `@AGENTS.md` to Context Loading
- **[2026-05-23]**: templates/agents/architect.md: clarified ADR example path (workspace relative path)
- **[2026-05-23]**: templates/AGENTS.md: clarified `_examples` reference path (workspace relative path)
- **[2026-05-23]**: templates/docs/context.md: detailed Architecture placeholder, added sync-md.sh to Key Files, added guide for Session Start Skills, corrected Development Workflow hook state
- **[2026-05-23]**: scripts/new-project.sh: escaped Perl replacement special characters (`\Q...\E`), added test-runner command guide to Next steps
- **[2026-05-23]**: scripts/new-project.ps1: removed duplicate `.sample` filter, added `chmod +x` parity for WSL (git update-index), added test-runner command guide to Next steps

### Fixed -Project consistency (README, CLAUDE.md, CONSTITUTION.md)
- **[2026-05-23]**: CLAUDE.md §1: clearly indicated that PostToolUse hook is inactive (`.claude/settings.json` is `{}`)
- **[2026-05-23]**: README.md: updated 4-role -> 5-role agent model (added Designer), added `templates/` to Repository Structure, included Designer in Two Philosophies, updated Multi-Agent Workflow
- **[2026-05-23]**: CONSTITUTION.md §7: updated Post-scaffold checklist agent count 4 -> 5, fixed `.\scriptsudit.ps1` typo (`.\scripts\audit.ps1`)
- **[2026-05-23]**: scripts/dev-sync.ps1: added missing file to workspace root (Script Parity rule compliance)

### Changed -workspace `.githooks/pre-commit` + `.claude/settings.json` + `.claude/commands/`
- **[2026-05-23]**: Applied same changes as templates/ to the workspace root itself
- **[2026-05-23]**: `.githooks/pre-commit`: conditional audit (memory/ exempt)
- **[2026-05-23]**: .claude/settings.json: removed PostToolUse hook
- **[2026-05-23]**: .claude/commands/changelog.md + sync.md: newly added
- **[2026-05-23]**: `scripts/dev-sync.sh`: Added newly (memlog -> sync-md -> changelog -> audit -> commit)

### Changed -`templates/.githooks/pre-commit`
- **[2026-05-23]**: Smart conditional audit: skips `audit.sh` when only `memory/` files are staged (session logs, daily entries)
- **[2026-05-23]**: Runs audit only when structural files outside `memory/` are staged -prevents spurious failures on log-only commits

### Changed -`templates/.claude/settings.json`
- **[2026-05-23]**: Removed PostToolUse hook -audit no longer fires on every Write/Edit
- **[2026-05-23]**: Audit is now enforced exclusively via pre-commit hook and `dev-sync.sh` pipeline

### Changed -`templates/scripts/dev-sync.sh` + `dev-sync.ps1`
- **[2026-05-23]**: Reordered pipeline: `memlog → sync-md → changelog → audit → commit → PR`
  (was: `audit → memlog → sync-md → commit`)
- **[2026-05-23]**: Added auto-changelog step: if `[Unreleased]` section has no entries, inserts the commit message automatically
- **[2026-05-23]**: Audit now runs after memory and changelog are updated -logically correct order

### Added -`templates/.claude/commands/changelog.md`
- **[2026-05-23]**: `/changelog "description"` command: adds a typed entry (`### Added/Changed/Fixed/Removed`) to `CHANGELOG.md [Unreleased]`

### Added -`templates/.claude/commands/sync.md`
- **[2026-05-23]**: `/sync "feat: ..."` command: wraps `bash scripts/dev-sync.sh` with pipeline description

### Added -`templates/agents/designer.md` (new)
- **[2026-05-23]**: UI/UX design agent for Phase 3 -Design group
- **[2026-05-23]**: Produces wireframes (text-based), component specs, design tokens, and accessibility checklists
- **[2026-05-23]**: Output format: Design Specification with Screen Overview, Component List, Interaction Spec, Design Tokens, Accessibility Notes
- **[2026-05-23]**: Added to `templates/AGENTS.md` and `templates/docs/context.md` agent tables
- **[2026-05-23]**: Added to CONSTITUTION.md §5 Role groups table

### Added -`templates/` folder (new)
- **[2026-05-23]**: Created `templates/` directory mirroring the exact structure of a new project -the folder itself is the authoritative scaffold reference
- **[2026-05-23]**: All project files: `docs/context.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CHANGELOG.md`, `.env.sample`, `.gitignore`
- **[2026-05-23]**: Config files: `.claude/settings.json`, `.gemini/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`
- **[2026-05-23]**: Agent definitions: `agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`
- **[2026-05-23]**: Scripts (cross-platform): `scripts/audit.sh`, `audit.ps1`, `dev-sync.sh`, `dev-sync.ps1`, `sync-md.sh`, `sync-md.ps1`
- **[2026-05-23]**: Structural stubs: `memory/MEMORY.md`, `docs/adr/.gitkeep`, `skills/.gitkeep`
- **[2026-05-23]**: `_examples/` subfolder (reference-only, excluded from new projects):
  - **[2026-05-23]**: `adr/0001-example-decision.md` -filled-in ADR example
  - **[2026-05-23]**: `agents/analyst-example.md` -domain analyst agent template
  - **[2026-05-23]**: `memory/2026-01-15-example.md` -daily session log example
  - **[2026-05-23]**: `skills/example-skill/SKILL.md` -reusable skill template

### Changed -`scripts/new-project.sh` + `new-project.ps1` (rewrite)
- **[2026-05-23]**: Replaced ~270-line heredoc approach with `cp -r templates/. <project>/` + `perl -pi` placeholder substitution
- **[2026-05-23]**: Script now has 6 logical steps: copy -remove `_examples/` -remove `.gitkeep` -substitute `[Project Name]` -chmod -git init
- **[2026-05-23]**: Emits `_examples/` path in output so users know where to find extension templates

### Changed -CONSTITUTION.md §7 (simplified)
- **[2026-05-23]**: Reduced from ~1,000 lines to ~70 lines -all template content moved to `templates/`
- **[2026-05-23]**: §7 now contains: scaffolding commands, generated-files table, and a concise post-scaffold checklist
- **[2026-05-23]**: Post-scaffold checklist reduced to essential placeholder checks only

### Changed -`.gitignore` (workspace)
- **[2026-05-23]**: Added `!templates/` negation so the new folder is tracked by git

### Added -CONSTITUTION.md §7 (scaffold template completeness review)
- **[2026-05-23]**: `scripts/audit.sh` + `audit.ps1` scaffold templates added to §7 (previously only copied from workspace, never documented)
- **[2026-05-23]**: `scripts/dev-sync.ps1` scaffold template added alongside existing `dev-sync.sh` template (Windows parity)
- **[2026-05-23]**: `scripts/sync-md.ps1` scaffold template added alongside existing `sync-md.sh` template (Windows parity)
- **[2026-05-23]**: `.gemini/settings.json` scaffold template added (`{}`) -referenced in checklist but never templated
- **[2026-05-23]**: **Extension templates** subsection added (created on demand, not at project init):
  - **[2026-05-23]**: `docs/adr/NNNN-slug.md` -Architecture Decision Record (3-section: Context -Decision -Consequences)
  - **[2026-05-23]**: `agents/<name>-analyst.md` -Analysis agent (read-only investigator; dispatched by PM in Phase 1-)
  - **[2026-05-23]**: `memory/YYYY-MM-DD.md` -Daily session log format

### Fixed -CONSTITUTION.md §7 (path bugs)
- **[2026-05-23]**: `CLAUDE.md` scaffold: `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md` -`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CLAUDE.md` (project-root file is one level above workspace, not two)
- **[2026-05-23]**: `GEMINI.md` scaffold: `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md` -`https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/GEMINI.md`; `@../https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md` -`@https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md`
- **[2026-05-23]**: Path notes for both templates corrected; clarified that `../../` is correct only for files inside subdirectories (`docs/`, `agents/`, etc.)
- **[2026-05-23]**: Post-scaffold checklist: path check items updated to show correct `../` expectation with anti-pattern warning

### Fixed -`scripts/audit.sh` + `audit.ps1`
- **[2026-05-23]**: CONSTITUTION.md check: now looks at both `./CONSTITUTION.md` and `https://raw.githubusercontent.com/5throck/ai-workspace-standards/main/CONSTITUTION.md` -previously always failed when run from a project directory (CONSTITUTION.md lives at workspace root, one level up)

### Fixed -`scripts/new-project.sh`
- **[2026-05-23]**: `dev-sync.sh` stub: corrected git workflow order -`git checkout -b "$BRANCH"` now runs before `git add -A && git commit` (previously committed to main before creating the PR branch)
- **[2026-05-23]**: Generated `CLAUDE.md` / `GEMINI.md`: fixed path references (`../../` -`../`)
- **[2026-05-23]**: Added `README.md` generation (was missing -checklist required it but script never created it)
- **[2026-05-23]**: Added `.gemini/settings.json` generation (`{}`)
- **[2026-05-23]**: `dev-sync.sh` memlog line: changed `echo "Session synced: $MSG"` to `echo "## Session → $MSG"` (matches §7 template)

### Fixed/Added -`scripts/new-project.ps1`
- **[2026-05-23]**: Full rewrite for feature parity with `new-project.sh`:
  - **[2026-05-23]**: Now generates all files: `docs/context.md` (full 10-section template), `AGENTS.md`, agent stubs (all 4), `CHANGELOG.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, `CLAUDE.md`, `.claude/settings.json`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `scripts/dev-sync.ps1`, `scripts/dev-sync.sh`, `scripts/sync-md.ps1`, `scripts/sync-md.sh`, `.githooks/pre-commit`, `.githooks/pre-push`
  - **[2026-05-23]**: Copies `audit.sh` + `audit.ps1` from workspace
  - **[2026-05-23]**: Emits actionable "Next steps" instructions on completion

### Fixed -CONSTITUTION.md §7 (5-round iterative review)
- **[2026-05-23]**: `README.md` scaffold template: changed outer fence from ` ```markdown ` to `~~~~markdown` to fix nested code block rendering (same fix applied earlier to `docs/context.md` and `GEMINI.md`)
- **[2026-05-23]**: `scripts/dev-sync.sh` scaffold: fixed git workflow order -`git checkout -b "$BRANCH"` now runs **before** `git add -A && git commit` to prevent commits landing on `main` before the PR branch is created
- **[2026-05-23]**: `agents/pm.md` scaffold header: added 🚨 stub-replacement warning (consistent with architect, code-writer, test-runner)
- **[2026-05-23]**: Post-scaffold checklist: added `agents/pm.md → full template used (not a stub)` check (script stubs all 4 agents, not 3)
- **[2026-05-23]**: §7 intro: expanded generated-files list to include all 4 agent files (`agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`)

## [2026-05-22]

### Added -CONSTITUTION.md

#### §1 Standard Folder Structure
- Added `.env.sample` and `.gitignore` to the standard folder structure tree
- Added rule: `AGENTS.md` is always created at project root as the canonical agent roster
- Added rule: `.env.sample` always committed; `.env` always in `.gitignore`

#### §5 Multi-Agent Architecture
- Split "Execution" group into distinct **Design** and **Execution** groups
  - **Design**: `architect.md` -architecture decisions, implementation planning, technical spec
  - **Execution**: `code-writer.md`, `test-runner.md` -code implementation and test verification

#### §6 Reusable Skills
- Updated Session skill load timing to reference `docs/context.md ## Session Start Skills`

#### §7 New Project Initialization -scaffold templates
- `docs/context.md` full scaffold template
  - Cross-platform Python venv activation (macOS/Linux + Windows)
  - `## Session Start Skills` section
  - `## Agents` table with all 4 core agents and Group column
  - `## Key Files` expanded with AGENTS.md, CHANGELOG.md, and all agent files
  - Path assumption note added to `## Coding Guidelines` link
  - Outer fence changed to `~~~~markdown` to fix nested code block rendering
- `AGENTS.md` scaffold template (new) -canonical agent index with Group column, dispatch guidance, maintenance rule
- `agents/pm.md` scaffold template (new) -YAML frontmatter + markdown body, 6-phase workflow, Agent Roster with Group column
- `agents/architect.md` scaffold template (new) -design-only agent; produces plans/ADRs; structured Implementation Plan output format
- `agents/code-writer.md` scaffold template (new) -implements approved plans only; per-file change report format
- `agents/test-runner.md` scaffold template (new) -QA agent; verification sequence; structured QA Report with READY/BLOCKED verdict
- `CLAUDE.md` project-level scaffold template (new) -Session Start, MCP Servers, Hooks Override, Model Selection Override
- `.claude/settings.json` scaffold template (new) -PostToolUse hook wiring for `scripts/audit.sh`
- `GEMINI.md` project-level scaffold template (new) -`@`-syntax context loading, model selection override
- `CHANGELOG.md` initial scaffold (new)
- `.env.sample` initial scaffold (new)
- `memory/MEMORY.md` initial scaffold (new)
- `.gitignore` initial scaffold covering Python, Node.js, OS artifacts (new)
- Post-scaffold checklist (new) -10-item verification with cross-platform commands

#### §7 Design principle
- `docs/context.md` = single source of truth for ALL AI tools; project-level `CLAUDE.md`/`GEMINI.md` = platform-specific overrides only

---

*Last Updated: 2026-06-25*

























### Changed
- **[2026-06-06]**: chore: update validate-templates.ts and SKILLS.md - improve template validation checks and skill registration consistency
