---
lang: ko
lang_reason: source-material
---

# Design: co-deck pipeline ticket batch 2 (U-20261119-004 .. U-20261119-010)

- **Spec id**: `2026-11-20-co-deck-pipeline-batch-2-design`
- **Date**: 2026-11-19
- **Status**: implemented-in-part — PR-A1 landed #2115 (d4124c300, gen-slides-pdf 1.16.0, U-20261119-007); PR-B1 landed this change set (pitch-enhanced theme defects, U-20261119-005); PR-A2 follows (consumes R2's caption/punchline semantics); PR-C1/D1/E1 gated on §Open questions owner decisions; PR-F1 descope candidate.

Architect triage-verify + batch design for the 7 upstream requests filed by the
co-deck sync-detection pilot (2026-11-19). All claims were verified against
`origin/main` = `d62ec06e2` (merge of #2113) — template root
`templates/co-deck/`, live project `Projects/co-deck/` (which carries Gate-5
LOCAL-PATCHes awaiting exactly this landing). Triage only + design only; no
implementation in this spec.

## Verdict summary

| Ticket | Verdict | In-batch work |
|--------|---------|---------------|
| U-004 | **partially confirmed** — adapter half already fixed upstream; venv-provisioning half confirmed | R6 (verify-side surfacing) + delivery rides T-20261117-012 follow-up 1 |
| U-005 | **confirmed** (all 5 sub-defects) — NOT addressed by PR #2080 | R2 |
| U-006 | **partially confirmed** — audience-language rule exists (U-20261116-003); the new Korean patterns + lint do not | R5 |
| U-007 | **confirmed** (both defects) | R1 |
| U-008 | **confirmed** (both gaps); rejection rationale is consolidation, not privacy — policy direction needs owner decision | R4 |
| U-009 | **confirmed** (contract gap, not a script bug) | R3 |
| U-010 | **confirmed** (all structural claims) | R1b |

## R1 — Group A: gen-slides-pdf premium-dark + framed PDF parity (U-007, U-010)

Two PRs against `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts` (currently
@version 1.15.0 upstream; the live project carries ~324 added lines of
LOCAL-PATCH(U-20261119-007/-010) that are the reference implementation).

### R1a — PR-A1: U-20261119-007 (two-column overflow + invisible cover title)

**Defect 1 — hasRight overflow.** In `renderStandardSlide` the non-forceInCard
branch computes `cardW0 = min((hasRight ? titleW : bulTxtW) + padX*2, CW - 8)`
and page-centers it: `cardX = CX + (CW - cardW0)/2` (gen-slides-pdf.ts:1975-1976),
while bullets anchor at `contentR.x + shiftX` (:1979). The `hasRight` visual
panel is painted **after** the text/card (:2018-2034: `fillRect(visR…)` +
`placeImage`), so the panel covers the card's right portion and title/bullet ink
clips mid-glyph. Confirmed mechanically: `bulTxtW` is measured from
`contentR.x` (:1744) but text is drawn from the page-centered card origin, so
lines can cross `visR.x`.

**Fix (reference = project LOCAL-PATCH at Projects/co-deck
gen-slides-pdf.ts:2145-2152):** when `hasRight`, anchor the card inside the text
column `[contentR.x, visR.x]` (`colW = visR.x - contentR.x`), wrap title to
`colW - padX*2` and bullets to `colW - padX*2 - 6 - px2mm(24)`, and drop the
page-centering (`cardX = contentR.x`, card width = min(colW, …)) so no line
crosses `visR.x`. Single-column decks (`!hasRight`) keep legacy widths — compat
gate: the zen `forceInCard` hug-card branch (:1759-1890) is untouched.

**Defect 2 — invisible cover title.** `drawBubbleBehind` fills the bgDrawn
bubble with `colors.C_CARD` (:1156-1164). On premium-dark, C_CARD resolves from
`card_dark = [11,15,25]` (styles/premium-dark/pdf_color_spec.json) while
`C_DARK` falls back to the same `[11,15,25]` (buildColors:2181, no `dark` key in
the spec) — the bgDrawn title branch draws the title in `colors.C_DARK`
(:1263-1270), i.e. **ink color == card fill**, contrast 1:1, title invisible.
`readableTextOn`/`readableMutedOn` already exist (:234-238) and are already the
pattern for the divider branch (:1305-1306) and standard-card ink.

**Fix:** swap the bgDrawn title/punchline/contact/profile inks to
`readableTextOn(colors.C_CARD)` / `readableMutedOn(colors.C_CARD)` (title branch
:1263-1270; punchline `stmtInk` :1499; contact thanks/lines; profile branch
defensively). Compat gate: on light-bubble styles (classic/white-bubble, where
`c.dark` IS declared and differs from `card_dark`) `readableTextOn(C_CARD)`
returns the same ink the hardcoded branch produced — verify byte-shape via one
classic deck + one premium-dark deck export diff.

**Correction to the ticket:** `scripts/co-deck/lib/pdf-font-patch.ts` is NOT
affected — project and template copies are byte-identical; the fix lives entirely
in gen-slides-pdf.ts. Affected path list for the dispatch should drop it.

### R1b — PR-A2: U-20261119-010 (framed PDF↔HTML parity, opt-in)

Confirmed at template level:
- HTML draws every slide in a rounded `.slide` frame on a darker page:
  ppt-engine.css:240-246 (`border-radius`, `--slide-bg`) + premium-dark
  style.css:10-18 (`--bg-color #0B0F19` page vs `--slide-bg #111827` slide).
- The PDF instead draws a header bar (`drawHeaderBar` call :1706), a separate
  page-centered hug card (:1975-1989), a full-height visual panel without any
  caption (:2018-2034 — captions exist only for zen in-card diagram embeds,
  :1811), a decorative `”` quote mark on punchlines when `!cardMode`
  (:1477-1480) that pitch-enhanced HTML never renders (template.html punchline
  branch :150-153 draws eyebrow + single h1 only), a contact slide that never
  touches `visualImage` (renderContactSlide :1595+; HTML renders it,
  template.html:211-215), and footnotes in a bottom band outside the frame
  (:2939-3015).
- Template `pdf_layout_spec.json` has **no** `frame` key (verified via JSON
  parse); the project copy carries the opt-in `frame` block (36 geometry keys +
  `_comment`, measured from a rendered 1280x720 pitch-enhanced deck).

**Fix (reference = project LOCAL-PATCH(U-20261119-010), +324 lines):**
- Add the opt-in `frame` block to
  `templates/co-deck/docs/html-themes/themes/pitch-enhanced/pdf_layout_spec.json`
  (ship the project-measured geometry verbatim; `_comment` documents provenance).
- gen-slides-pdf.ts v1.17.0: when `spec.frame` is present, route standard /
  title / divider / contact / punchline / video renderers to framed variants —
  frame rect + rounded mask (clip every layer to the frame), page fill
  `frame.page_rgb` + frame fill `frame.frame_rgb`, two-column grid
  (`col_*`/`panel_*` keys), section eyebrow above left-aligned title,
  `**bold**` accent runs in bullets, image-panel caption from `visualCaption`
  (pairs with R2's caption change — see dependency below), punchline `\n`
  sentence split without the `”` mark, contact slide with right-panel image,
  footnotes inside the frame. Decks whose spec has no `frame` key keep the
  1.15.0 rendering byte-for-byte — the block is the compat gate.
- `zen`/other themes: no frame block shipped in this batch; renderer stays
  generic (frame geometry comes only from the spec), so no cross-theme risk.

**Dependency:** PR-A2 lands **after** R2 (U-005) so the parity target is the
fixed HTML (captions rendered theme-side, punchline two-line support), not the
deck-level patch workaround. PR-A1 is independent of both.

## R2 — Group B: pitch-enhanced theme defect set (U-005)

All five sub-defects confirmed in the template theme; the project theme files
are byte-identical to the template (no theme-side fix landed anywhere — the
project used deck-level `deck-overrides`/`deck-captions-js` injections, which
are lost on rebuild, exactly as the ticket says).

**Correction:** PR #2080 (`199450f5a`, "pitch buildBullets defined") fixed the
`buildBullets` **undefined function** in the generated pitch preview decks — it
did NOT touch the flex/strong interaction. The defect stands.

1. **Flex/strong column split** — `theme.css:308-315`
   `.slide-bullets li { display:flex; gap:0.75rem }` +
   ppt-engine.js:91-97 `appendInline()` emitting text nodes and `<strong>`
   elements: every child of the li becomes an anonymous flex item in one
   non-wrapping row → bold words split into columns. Fix per the proven
   workaround: `display:block; position:relative; padding-left:1.4rem` +
   `li::before { position:absolute; left:0; top:.1em }` (drop
   `flex-shrink`/`align-items`).
2. **visualCaption never rendered** — the field exists slidedata-side and the
   PDF consumes it (gen-slides-pdf.ts:894, :1811) but no theme file references
   it (grep across docs/html-themes = 0 hits). Fix: render a caption element
   under the right-panel image (`.cdk-caption` class to match the deck-level
   workaround naming) populated from `data.visualCaption`, plus caption CSS in
   theme.css.
3. **Contact slide ignores bullets** — template.html contact branch
   (:203-215) reads only contactEmail/contactLinkedIn/contactPhone + visualImage.
   Fix: mirror the PDF-side rule already landed in v1.15.0 (gen-slides-pdf.ts
   "U-20261116-008 item 4": when no `contact*` line resolves, fall back to
   `bullets` max 5, first line bold) so HTML and PDF agree.
4. **Punchline single h1** — template.html:150-153 renders one `h1` via
   `el()`/`textContent`; a `\n` punchline cannot size its lines differently.
   Fix: split on `\n` into per-line elements (`punch-line` + `punch-line sub`
   size classes), keeping the existing accent/bold run handling.
5. **References slide empty visual panel** — references slides fall through to
   the `standard` branch and render an empty `.slide-visual` box when no
   visualImage/visualDisplay (the ticket hides it via fragile `#slide-N` CSS).
   Fix: skip the right panel when the slide has neither visualImage nor
   non-empty visualDisplay (references check per theme.json content rules), or
   render the references list as the panel content — implementer picks the
   cheaper of the two after checking the deck contract.

**Files:** `templates/co-deck/docs/html-themes/themes/pitch-enhanced/theme.css`,
`.../template.html` (+ `.agents`/`.claude` skill mirrors only if the deck-skill
docs reference the CSS contract). **Risk:** theme CSS touches every
pitch-enhanced deck — regenerate the 7 preview baselines
(docs/html-themes/preview/decks/pitch-enhanced_*.html) and eyeball-diff before
merge.

## R3 — Group C: diagram pipeline layout-safety contract (U-009)

Confirmed as an **authoring-contract gap**, not a script bug: layout math lives
in each deck's `diagram-defs.ts` (agent-authored); the shared
`diagram-helpers.ts` v1.3.2 is infrastructure-only (svgWrap/strip/audit/fonts —
no node geometry knowledge). `agents/diagram-specialist.md` declares layout
types, orientation resolution, node padding minimums (12px/8px) and a ≥11px
min-font rule, but has **no** inter-node gap floor, no connector draw-order
rule, no hard overflow guard, no layout-variety mandate.

**Fix:**
- `agents/diagram-specialist.md` (+ `.agents`/`.claude` mirrors): add the
  safety section — (a) inter-node gap floor ≥24px (≥30px on ≥5-node layouts),
  computed as leftover space never below the floor (compact variant when type
  doesn't fit); (b) connectors drawn **after** node rects; (c) hard overflow
  guard against the viewBox; (d) layout-variety mandate — distinct layouts per
  diagram type (timeline/columns/merge/cycle/stairs/funnel/chevrons/fan), no
  run reusing one vertical stack; (e) legibility minimums label ≥22px,
  sub ≥17px, gold connectors ≥3px with visible arrowheads.
- `diagram-helpers.ts` v1.4.0: add a lintable audit alongside the existing
  `svgMinFontSize` WARN — parse `<line>`/`<path>` segments and WARN on
  negative-length segments and elements outside the viewBox (feasible without
  geometry knowledge; gap floors stay contract-only since node rects are
  generator-specific).
- `scripts/co-deck/gen-visual-images.ts` already WARNs on tiny fonts
  (:104-106) — route the new audit through the same non-fatal WARN channel.

**Owner decision:** adopt the ticket's exact numbers (22/17/24-30/3px) as
contract minimums, or soften to ranges; they come from one deck's v3 generator.

## R4 — Group D: validate-image-manifest policy (U-008)

Both gaps confirmed in `scripts/co-deck/validate-image-manifest.ts` v1.5.0:
- `POOL_STYLE = /^(deliverables|\.\.)\/assets\/(images|fonts|videos)\//` (:224)
  — `./assets/…` deck-local paths are rejected with a migration error (:234).
  **Rationale check (as ordered):** the shared-pool convention exists for
  pool-wide consolidation and the duplicate-content scan over
  `deliverables/assets/images/` (:502-506) — the header comments call deck-local
  trees "legacy (pre-rename layouts)" debt. **It is not a privacy rule**; the
  privacy exposure is a side effect of forcing user-cleared press images into
  the cross-deck pool.
- Missing `image-manifest.json` → hard `err` + exit 1 (:253-257); no
  diagrams-only mode (the diagram-manifest check is bundled behind the image
  manifest's existence).

**Fix direction (needs owner decision — two independent sub-changes):**
1. **Deck-local images:** Option A (recommended) — accept a third path style
   `deliverables/<deck>/assets/…` (and `./assets/…` deck-relative spelling) as
   **deck-scoped** entries, excluded from the pool-wide dedupe scan and tagged
   in the report as `deck-local`; keeps the shared-pool convention as default
   and the dedupe guarantees intact. Option B — keep the pool-only rule and
   add an explicit per-deck `image_pool: deck-local` manifest opt-in. Option C
   (do nothing, document the privacy caveat) — weakest; the pilot hit it in
   practice. The owner decision is whether deck-scoped images are a supported
   workflow (A/B) or the pool remains mandatory (C).
2. **Missing manifest:** auto-degrade — when `image-manifest.json` is absent,
   run the diagram-manifest checks and emit `WARN: image-manifest.json not
   found — image checks skipped (diagram-only stage)` instead of erroring;
   `--diagrams-only` flag as the explicit spelling. Compat gate: a missing
   manifest must still FAIL in the full-deck Gate 3.5 context (add
   `--strict-missing-manifest` for the gate wiring, or keep exit-1 only when
   the deck references images) — implementer decides after reading the Gate
   3.5 wiring; the design intent is "no temp-workspace workaround".
- The download-videos/QuickDL item inside U-008's repro is a duplicate of
  U-004 — not re-designed here.

## R5 — Group E: storyline audience-language gate (U-006)

**Partially confirmed.** The U-20261116-003 audience-language rule landed in
`templates/co-deck/.agents/skills/storyline/SKILL.md` (R1 ban table :188-198,
distinction paragraph :207, slide-field rule :257, checklist :275; synced to the
template in `76eeca4b3`). The ticket's NEW patterns are outside it:
- Bullet **prefixes** `사실 —`, `가능성 —`, `해석 —` (the ban covers `—` aside
  *headers* `— 해석 주의…`, i.e. label-after-dash; the defect is label-before-dash);
- Parentheticals `(강연자 해석)`, `(확정된 사실은 아님)` (the bracketed-caveat
  list covers only 근사치/단일 소스/Unverified/미검증);
- Narration disclaimers `근거는 없습니다`,
  `독립적인 검증을 거친 것은 아니라는 점` — and note a real tension: the
  allowed-replacement table (:201-205) actively routes caveats **into the
  script**, which is how the pilot's narration kept carrying them.
- `agents/storyline.md` has no audience-language rules (skill-only);
  `estimate-layout.ts --lint` checks content_constraints counts only
  (:323-380) — no wording patterns.

**Fix:**
- SKILL.md: extend the ban table + regex sketch with
  `^(사실|가능성|해석|추정|전망)\s*[—:-]` bullet prefixes and parentheticals
  `(강연자 해석|확정된 사실은 아님|확인 필요)`; rewrite the script guidance so
  narration carries **natural attribution** only (`행정안전부는 …라고 밝혔다`)
  and never bare epistemic disclaimers — replacing the caveat-to-script
  migration row for this pattern class.
- `agents/storyline.md`: one pointer line to the skill's R1 section (single
  source of truth stays the skill).
- `estimate-layout.ts` v1.5.0: `--lint` gains a wording check on slide-visible
  fields (bullets, captions, titles) implementing the ban regex — FAIL rows in
  the existing markdown report format. Slide-scripts are not lintable
  (they live in storyline.md prose), so the narration rule stays
  authoring-side; the lint covers the artifact the builder consumes.

**Owner decision:** confirm the narration rule's scope (ban bare
`근거는 없습니다`-style sentences in scripts, keep in-sentence attribution
allowed) — it narrows an existing allowed-replacement row.

## R6 — Group F: QuickDL adapter / external-deps (U-004)

**Already fixed upstream (ticket's headline claim is stale):**
`templates/co-deck/scripts/co-deck/download-videos.ts` v1.1.0 (2026-11-16, spec
`docs/designs/2026-11-16-quickdl-external-design.md`) introduced exactly the
requested resolution order `--quickdl-dir > CDK_QUICKDL_DIR >
<root>/external/quickdl > legacy ~/git/project/QuickDL` (:69-76) plus
`selftest`; v1.2.0 (commit `51f6cab06`) accepts the QuickDL src/ restructure
and the not-found error prints an actionable setup command (:160-166). The
project hit the defect because its adapter copy predates v1.1.0 — that is
**T-20261117-012's deferred follow-up 1** (deliver template adapter to
Projects/co-deck; project copy is v1.0.0 + LOCAL-PATCH, manifest
compatibility_test broken project-side). The project's LOCAL-PATCH already
back-ports resolution + selftest (root cli.py only — v1.2.0's src-layout
support is the delta the delivery must carry).

**Confirmed gap:** `external-deps install` clones only — no post-install hook
(`templates/common/scripts/external-deps.ts` v1.0.0, byte-identical in
projects; no venv/pip machinery anywhere; the manifest's own `$comment` defers
venv setup to the adapter header). The compatibility_test command executes only
in the update pass, not `verify`.

**Fix (recommended):** `scripts/lib/external-deps.ts` + `scripts/external-deps.ts`
+ `templates/common/scripts/external-deps.ts`: `verify` (and the tail of
`install`) executes a declared `compatibility_test` when present and prints its
output — the quickdl selftest's own `.venv` note
("run `python3.13 -m venv .venv && .venv/bin/pip install -r requirements.txt`")
then surfaces at install/verify time. **Auto-provisioning the venv is
rejected** (owner decision): the repro itself shows python3.12 failing
ensurepip on this machine — interpreter selection is environment-specific and
belongs to the operator; the standard's install contract stays clone-only
(DEC-20261107-02). Alternative (smaller): no script change — the adapter's
error text + selftest warning already cover the operator path; batch item
becomes documentation-only (external-deps.json `$comment` already points at the
header). PM may descope R6 to the alternative.

**Delivery coordination:** T-20261117-012 follow-up 1 (adapter v1.2.0 delivery
to Projects/co-deck, superseding the project LOCAL-PATCH) rides this group —
it is a project-side landing, not a template PR; fold into the next co-deck
upgrade pass or a dedicated delivery dispatch, and refresh the cosmetic
`.gitignore:184` pin comment with it (follow-up 2).

## PR sequence and file lists

| # | PR | Tickets | Files |
|---|----|---------|-------|
| 1 | PR-A1 premium-dark ink + card anchoring | U-007 | `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts` |
| 2 | PR-B1 pitch-enhanced theme fixes | U-005 | `templates/co-deck/docs/html-themes/themes/pitch-enhanced/theme.css`, `.../template.html` (+ preview-baseline regeneration) |
| 3 | PR-A2 framed PDF layout (opt-in `frame` block) | U-010 | `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts`, `templates/co-deck/docs/html-themes/themes/pitch-enhanced/pdf_layout_spec.json` |
| 4 | PR-C1 validator policy | U-008 | `templates/co-deck/scripts/co-deck/validate-image-manifest.ts` (owner decision gate) |
| 5 | PR-D1 diagram contract + audit | U-009 | `templates/co-deck/agents/diagram-specialist.md` (+ mirrors), `templates/co-deck/scripts/co-deck/diagram-helpers.ts`, `.../gen-visual-images.ts` |
| 6 | PR-E1 storyline gate + lint | U-006 | `templates/co-deck/.agents/skills/storyline/SKILL.md` (+ mirrors), `templates/co-deck/agents/storyline.md`, `templates/co-deck/scripts/co-deck/estimate-layout.ts` |
| 7 | PR-F1 external-deps compat surfacing | U-004 | `scripts/lib/external-deps.ts`, `scripts/external-deps.ts`, `templates/common/scripts/external-deps.ts` (descope candidate) |

Ordering rationale: PR-A1 independent (smallest, user-visible data-loss-grade
rendering bug); PR-B1 before PR-A2 (parity target = fixed HTML); PR-A2 consumes
R2's caption semantics; C1/D1/E1 independent of each other; F1 last (L0/common
blast radius + descope candidate). Each PR bumps the touched script's
`@version` header and VERSION_MANIFEST row per house convention; PR-A2 and
PR-B1 each need one design-doc pointer in their PR body to this spec.

## Acceptance criteria

- [ ] PR-A1: premium-dark export shows the cover title; hasRight slides show no
      ink past `visR.x`; classic/zen exports byte-diff clean on non-bgDrawn
      slides.
- [ ] PR-B1: bullet with `**bold**` renders as one wrapped sentence; captions
      appear under right-panel images; contact bullets fallback matches PDF;
      two-line punchline sizes differ; references slide has no empty panel.
- [ ] PR-A2: deck with `frame` block exports visually matching the HTML deck at
      1280x720 (frame, eyebrow grid, captions, punchline, contact image,
      footnotes in-frame); deck without `frame` block exports identical to
      1.15.0 output.
- [ ] PR-C1: deck-local image reference passes (or documented-declined);
      diagram-only stage validates without a temp-workspace workaround.
- [ ] PR-D1: contract section merged; audit WARNs on negative-length/out-of-view
      segments in the pilot deck's v2-style SVGs.
- [ ] PR-E1: ban regex covers the pilot's S11/S15/S17/S18/S20 patterns; `--lint`
      FAILs on them and passes on the cleaned deck.
- [ ] PR-F1 (if not descoped): `external-deps verify` surfaces the quickdl
      selftest note on a venv-less clone.
- [ ] T-20261117-012 follow-up 1 dispatched (adapter v1.2.0 delivery) with the
      compatibility_test green project-side.

## Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — batch changes only template/script content consumed identically by all platforms; skill mirrors (.claude) updated in PR-D1/PR-E1 | templates/co-deck/.claude/skills/storyline/SKILL.md, templates/co-deck/.claude/agents/diagram-specialist.md (mirror rows) |
| Antigravity (GEMINI.md) | None — no workspace-root GEMINI.md content touched; skill mirrors (.gemini equivalents) updated alongside PR-D1/PR-E1 mirrors | same mirror set |
| templates/common | PR-F1 touches `templates/common/scripts/external-deps.ts` (byte-identical rule at L0/common must hold — land all three copies in one commit) | templates/common/scripts/external-deps.ts |

## Open questions (owner decisions)

1. **U-008 privacy direction** (R4.1): Option A deck-scoped path style /
   Option B manifest opt-in / Option C keep pool-only. Recommended A.
2. **U-009 contract numbers** (R3): adopt 22/17/24-30/3px verbatim or soften to
   ranges.
3. **U-006 narration scope** (R5): ban bare epistemic disclaimers in scripts
   (narrowing the caveat-to-script migration row) — confirm.
4. **U-004 provisioning** (R6): verify-side surfacing (recommended) vs
   documentation-only descope; auto-provision rejected.
