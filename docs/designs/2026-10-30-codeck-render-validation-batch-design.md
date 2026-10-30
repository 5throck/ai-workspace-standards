# co-deck Render/Validation Batch — 2026-10-30 (U-20261029-005 / -006 / -007)

- **Status**: implemented
- **Date**: 2026-10-30
- **Owner**: automation-engineer + docs-writer (PM Gateway dispatch)
- **Tickets**: U-20261029-005 (video-slide rendering branch), U-20261029-006
  (estimate-layout minimum content check), U-20261029-007 (validate-image-manifest
  background rules) — all `project: co-deck`, `suspected_layer: L2`
- **Tier**: L2 (templates/co-deck)
- **Precedent**: docs/designs/2026-10-29-owner-decision-batch-design.md (one batch
  design doc, registered implemented after gates pass)

## 1. Context

Three upstream tickets from the co-deck L2 project (template_version 0.23.0) share
a theme: the template's render/validation gates accept decks that clients then
flag in review — video slides rendering as standard content bubbles, sparse
content slides passing the layout lint, and background-image reuse/omission
passing the image-manifest gate. One batch design doc, one PR, all changes inside
`templates/co-deck/`. Delivered project copies are NOT synced (version-gated
re-delivery handles them).

Every claim was spot-verified before implementation (file:line evidence below,
plus an empirical repro harness for U-007 run against the current validator).

## 2. U-20261029-005 — video-slide rendering branch

**Evidence** (verified): zero occurrences of `videoId` across all six
`docs/html-themes/themes/*/template.html` and `themes/_shared/ppt-engine.js` —
each theme's `buildSlideChildren()` (zen: template.html:159-243; same shape in
outline/pitch/pitch-enhanced/vertical/outlook) dispatches by slide type and
falls through to the standard content card, so a `slideData[i].videoId` slide
renders the full chrome bubble and the per-project injector
(`scripts/co-deck/inject-video-players.ts`, v1.0.0) must overlay a player and
suppress the bubble per project (the recurring white-bubble-shows-through defect
class). The shared-runtime precedent for a slideData-driven component is
`FootnoteBuilder` (ppt-engine.js:1090-1116, invoked from `initPPT`). The video
play-mode contract is ADR-0002 (`docs/adr/0002-deck-video-asset-verification-and-
injector-binding.md`): idempotency, triple play-mode fallback (local mp4 → inline
YouTube iframe over http(s) with `origin` → new-tab watch URL over `file://`),
stop-on-slide-change. All six themes declare `css_ppt_engine`, so ppt-engine.js
and ppt-engine.css are inlined/linked in every theme (including outlook).

**Fix shape**:
1. `themes/_shared/ppt-engine.js` gains a shared `VideoSlide` component (placed
   after `FootnoteBuilder`): `VideoSlide.render(slide, data)` adds
   `class="video-slide"` + `data-video="1"`, renders a plain caption
   (`.video-caption`, title text via `appendInline`) and a click-to-load stage
   (`.video-stage` play affordance) whose handler implements the ADR-0002 triple
   fallback (local `videoLocal` → YouTube iframe on http(s) → new-tab watch URL
   on `file://`, with a client-side `onerror` fall-through from the local
   attempt to the YouTube embed). One shared MutationObserver (singleton guard)
   removes playing frames when the slide loses `.active` — the injector's
   stop-on-slide-change convention, kept out of `showSlide` to leave the shared
   navigation path untouched.
2. Each of the six `template.html` files gets a two-line FIRST branch in
   `buildSlideChildren`: `if (data.videoId) { VideoSlide.render(slide, data);
   return; }` — chrome-free regardless of the slide's declared type, so no
   theme card/bubble DOM is ever created for video slides. Theme package
   versions are NOT bumped (precedent: PR #432 shipped shared-engine + template
   fixes without theme.json version churn).
3. `themes/_shared/ppt-engine.css` gains the `.video-slide` layout block
   (full-bleed dark stage, bottom-left plain caption, centered play affordance,
   `.video-frame` full-bleed player shown only while `.playing`) — theme/style
   layers can override via normal CSS cascade.
4. `scripts/co-deck/inject-video-players.ts` v1.0.0 → 1.1.0: the injected
   binding loop skips elements marked `data-video="1"` (native-rendered slides),
   so the documented procedure ("re-run the injector after every rebuild") is
   safe on decks built from the new template — no double stage.
5. Tests: new `tests/video-slide.test.ts` (builder-side, bun:test, follows the
   `ppt-engine-integration.test.ts` harness): all six themes build a videoId
   deck with the shared component + per-theme branch present; CSS block present;
   non-video contract strings unchanged. `tests/ppt-engine-integration.browser.mjs`
   v0.1.0 → 0.2.0 gains a render-path DOM case (video slide has `.video-slide`,
   no `.slide-card`/`.slide-content` inside, caption + stage present;
   self-skips without Playwright). `tests/inject-video-players.test.ts`
   v1.0.0 → 1.1.0 gains the native-slide skip case.

## 3. U-20261029-006 — estimate-layout minimum content check

**Evidence** (verified): `lintSlideContent()` (estimate-layout.ts:381-447)
checks only maxima — `max_title_chars`, `max_subtitle_chars`, `max_desc_chars`,
`max_bullets`, `max_body_chars` read per slide type from the merged spec's
`content_constraints` (:411-417); no minimum exists anywhere. Type
classification defaults a missing type to `standard` (:392). All six themes' `theme.json`
`content_rules` carry only `max_bullets_per_slide` / `max_title_chars`
(zen theme.json:12-17); all six `pdf_layout_spec.json` `content_constraints`
declare only `max_*` per type (zen standard: `{max_bullets: 5, max_title_chars:
50, max_body_chars: 80}`). The two-layer split is deliberate:
`theme.json content_rules` disciplines storyline at creation time (Stage 2,
see skills/slide-layout-gate "Relationship to content_rules");
`pdf_layout_spec.json content_constraints` is the machine layer the lint reads
through the 4-layer merge (base → theme → style → layout_overrides).

**Fix shape**:
1. `estimate-layout.ts` v1.3.0 → 1.4.0: the lint gains minimum checks reading
   `min_bullets` / `min_body_chars` from the SAME per-type
   `content_constraints` source as the maxima (zero new config plumbing; the
   values flow through the existing 4-layer merge, so
   `layout_overrides.content_constraints.<type>.min_bullets` can tune or zero
   them per project). Sensible defaults when a type declares no minimums:
   `min_bullets 3` / `min_body_chars 40` for `standard` slides only;
   an explicit `0` disables a floor for its type; other types
   (title/cover, divider, profile, contact, punchline) are exempt unless they
   declare explicit minimums; slides carrying `videoId` are exempt (media
   slides, cf. U-005). Rows print as `bullet count (min)` / `body chars (min)`
   with `≥` limits; the remediation ladder gains the sparse-content arm
   (densify/merge bullets or reclassify — the opposite of the over-bound arm).
2. All six `theme.json` `content_rules` gain `min_bullets_per_slide: 3` +
   `min_body_chars: 40` (authoring-level mirror, tunable per theme); all six
   `pdf_layout_spec.json` `content_constraints.standard` gain explicit
   `min_bullets: 3` + `min_body_chars: 40` so every theme's floor is visible
   and theme-tunable rather than only implicit.
3. `skills/slide-layout-gate/SKILL.md` "Relationship to content_rules" gains
   the two new keys (canonical copy only; platform mirrors are sync-managed).
4. Tests: new `tests/estimate-layout-lint.test.ts` — spawns the real CLI
   against a synthetic project under `presentations/` (workspace root is
   script-relative, so the fixture must live in the template tree; cleaned up
   after): sparse standard deck (2 bullets, short body) FAILs with exit 1;
   dense-enough deck passes; `videoId` slide exempt; divider/title types
   exempt; `layout_overrides` floor raise flips a 3-bullet deck to FAIL.

## 4. U-20261029-007 — validate-image-manifest background rules

**Evidence** (verified + empirical): the validator
(validate-image-manifest.ts, v1.0.0) iterates `manifest.slides[]` only — the
top-level `background_image` section (image-curator.md:83-90) is never read,
and a slide entry without a `path` is silently skipped (:177). Empirical runs
against the current script: (1) per-slide background entries sharing one file →
the generic duplicate-hash check (:227-233) already ERRORs; (2) global
`background_image.path` under `scope: divider-cover` serving all background
slides → **0 errors, exit 0** (family reuse invisible); (3) divider with no
background entry under divider-cover → **0 errors, exit 0**. Renderer truth:
`gen-slides-pdf.ts` `resolveBgImagePath` (:228-254) applies the GLOBAL path to
every in-scope slide for `all`/`divider-cover` and consults per-slide entries
only under `individual`; html-build binds per-slide entries only under
`individual` (agents/html-build.md:52-57, skills/html-build SKILL:167-171).
So the compliant distinct-per-background-slide flow the ticket declares
("each background slide (cover + each divider) is expected to carry its own
distinct image") is `scope: individual` with one `image_role: "background"`
entry per background slide — both renderers honor it today.

**Fix shape** (`validate-image-manifest.ts` v1.0.0 → 1.1.0, verdicts per the
script's conventions — Gate 3.5 is a hard gate, and the ticket calls both modes
failure modes, so ERROR not WARN):
1. Rule A (family reuse, ERROR): `background_image.enabled` + scope
   `all`/`divider-cover` + global path set + ≥2 background-scoped slides in the
   deck → the single global image serves N background slides; remediation
   message routes to scope `individual` + per-slide distinct entries.
2. Rule B1 (coverage, ERROR): `background_image.enabled` + scope
   `all`/`divider-cover` + no global path → the declared scope renders no
   background at all (per-slide entries are ignored in these scopes by both
   renderers — message says so).
3. Rule B2 (ERROR): any `slides[]` entry with `image_role: "background"`
   (slide_index ≥ 0) lacking a string `path` — previously silently skipped.
4. Rule B3 (ERROR): `background_image.path` set but the file is missing on
   disk — the global path never passed through the slides loop, so this was
   invisible.
5. WARN: `background_image.path` set under scope `individual` (ignored by both
   renderers); WARN + explicit skip when `slidedata.json` is absent and scope
   is `all`/`divider-cover` (slide types are needed to count background-scoped
   slides; the validator reads `slidedata.json` from the workspace, which the
   pipeline always produces by Gate 3.5).
6. `agents/image-curator.md`: Background image handling (:45-54) re-documented
   — per-background-slide distinct images via `scope: individual` per-slide
   entries are the compliant flow; the single global download is valid only
   when exactly one background slide is in scope; the Gate 3.5 validator
   checklist (:215-233) gains the new ERROR/WARN arms.

**Known renderer follow-up (out of scope, recorded)**: `gen-slides-pdf.ts` and
html-build binding honor per-slide background entries only under scope
`individual`; making `divider-cover`/`all` scopes honor per-slide overrides in
the renderers is a renderer change (visual baselines, gen-slides-pdf version
bump) deliberately not pulled into this ticket — the validator enforces the
manifest contract; curators use `individual` scope until the follow-up.

## 5. Validation

Per PR: `bun test templates/co-deck/scripts/co-deck/tests/` (template suites,
offline; browser suites self-skip without Playwright), `bun run test:unit`
(root), `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`, and
`bun scripts/lifecycle-sync-audit.ts` (Check V @version ↔ registry consistency
for the bumped scripts). Delivered project copies under `Projects/co-deck/` are
NOT synced — version-gated re-delivery lands them with the project's next sync.

## 6. Decisions

- **Shared `VideoSlide` in ppt-engine.js + 2-line branch per theme (U-005)** —
  renderSlide is per-theme by contract (ppt-engine.js:32-55), but the video
  layout is theme-independent; the split keeps the chrome-free DOM vocabulary
  shared (like FootnoteBuilder) while themes keep their own dispatch. All six
  themes get the branch, not just zen — the defect class is theme-independent.
- **Click-to-load, not autoplay embed (U-005)** — the existing video tooling
  convention (ADR-0002 triple fallback) exists because `file://` decks cannot
  rely on YouTube embeds and local mp4s may be absent; the native branch
  preserves exactly that UX.
- **Injector skip guard, not injector removal (U-005)** — legacy decks and the
  documented re-run-after-rebuild procedure keep working; native-rendered
  slides are detected client-side via `data-video="1"`.
- **Minimums in the merged content_constraints, not a new config source
  (U-006)** — the ticket names `theme.json content_rules`, but the lint's
  single source of truth is the 4-layer-merged `content_constraints`; adding
  `min_*` keys there (with `content_rules` mirroring them for the authoring
  layer) enforces the floor without a second read path and keeps
  `layout_overrides` able to tune it per project. Recorded as a deviation from
  the dispatch's "minimums come from theme.json content_rules" phrasing — the
  theme.json keys ARE added (all six themes), but the lint reads the machine
  layer.
- **Background rules as ERRORs, slidedata.json as the type source (U-007)** —
  Gate 3.5 is a hard gate and the ticket calls both modes failure modes; slide
  types live in slidedata.json (the deck SSOT), and an absent slidedata.json
  degrades to an explicit WARN-skip rather than a false pass. The literal repro
  clause "two background-scoped slides point at the same image path" already
  ERRORs via the generic hash rule (verified empirically); the real gap is the
  `background_image` section, which the new rules close.
- **Registry versions**: estimate-layout.ts 1.3.0 → 1.4.0;
  validate-image-manifest.ts 1.0.0 → 1.1.0; inject-video-players.ts 1.0.0 →
  1.1.0; new tests video-slide.test.ts / estimate-layout-lint.test.ts /
  validate-image-manifest.test.ts at 1.0.0; ppt-engine-integration.browser.mjs
  0.1.0 → 0.2.0; inject-video-players.test.ts 1.0.0 → 1.1.0 — SCRIPTS.md rows
  (templates/co-deck copy) bumped/added with each. Theme package versions are
  not bumped (PR #432 precedent for shared-engine changes).

## 7. Rollback

Single-commit revert per PR; no schema migrations, no registry seed changes,
no project-copy edits. The new validator/lint arms are additive gates —
reverting restores the previous pass behavior exactly.
