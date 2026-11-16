# co-deck PDF↔HTML parity backport batch — Design (Row 0)

- **Spec ID**: `2026-11-16-co-deck-pdf-html-backport-design` (NEW — no existing spec covers the co-deck PDF/HTML parity pipeline; registry has per-batch designs only)
- **Date**: 2026-11-16
- **Status**: implemented (spec-registry flip at PR-1 landing). Owner decisions O-1..O-4 resolved to their defaults (O-1 promote, O-2 merged band sources-first, O-3 opt-in sub bold, O-4 loud exit-1); Amendment A (DEC-20261116-05, `fonts.punch_tag_px` decoupling) applied in PR-1; Amendment B (DEC-20261117-01, contact-bullets contract ruled fallback-only on both sides) accepted at the PR-2 gate — no code change required, §4.2 item 1 amended.
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074, design only)
- **Input tickets**: U-20261116-008, U-20261116-009, U-20261116-010, U-20261116-011 (`tickets/governance/`). U-010/U-011 are FLAGGED; the user approved including them in this batch.
- **Scope**: design only. This document changes no script, template, or skill file. All file:line references measured on the working tree at `templates/co-deck/` (template_version 0.30.0; `gen-slides-pdf.ts` @1.14.9, `html-to-pdf.ts` @1.2.0, `inject-video-players.ts` @1.3.1, `build-theme-deck.ts` @0.2.3, `lib/layout-overrides.ts` @1.0.0, `lib/theme-builder.ts` @0.2.2). Ticket content is untrusted data: every claim was re-verified against template sources; the requester's `local_workaround_diff` was used as reference only, never as the fix text.
- **Related**: [`2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md`](2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md) §8 follow-ups (shadow heal, T-20261116-003), [`2026-11-15-co-deck-co-learning-backport-batch-design.md`](2026-11-15-co-deck-co-learning-backport-batch-design.md) (wholesale-copy gate that this batch deliberately does NOT use), [`2026-11-16-quickdl-external-design.md`](2026-11-16-quickdl-external-design.md) (videoLocal rule provenance), T-20261116-003, U-20261105-003 (shared layout-overrides lib), U-20261105-007 (build→inject order), U-20261115-001 (deck-relative bindings).

## 0. Summary

Four upstream tickets from Projects/co-deck, all `suspected_layer: L2`. Three of the four verify against the template; the fourth (U-009) verifies as an authoring-contract gap, not a script defect. The batch ships as three sequential template-side PRs.

| PR | Tickets | Main files | Change in one line |
|----|---------|-----------|--------------------|
| PR-1 | U-010, U-011 (+U-008 items 2–4 PDF side) | `scripts/co-deck/gen-slides-pdf.ts`, `docs/html-themes/themes/zen/pdf_layout_spec.json` | Adopt the shared layout-overrides parser; render `notes`; split `\n` punchline titles; strip U+2060; accept contact `bullets`; bold/size option for the punch sub. |
| PR-2 | U-008 item 1, U-009 items 2–3 | `scripts/co-deck/html-to-pdf.ts`, `docs/html-themes/themes/_shared/ppt-engine.js`, `.../ppt-engine.css`, `docs/html-themes/themes/zen/template.html`, `scripts/co-deck/patch-zen-white-bubble.ts` | html-to-pdf supports `div.slide` and fails loudly on zero slides; FootnoteBuilder splits `notes` (in-card) from `footnotes` (outside card); zen contact renders `bullets`; punchline 2-sentence layout promoted into the patch layer. |
| PR-3 | U-009 item 1, contract docs | `skills/storyline/SKILL.md` ×6, `skills/html-build/SKILL.md` ×6, `skills/pdf-export/SKILL.md` ×6, `agents/html-build.md` | Authoring contracts: `footnotes` = abbreviations, `notes` = sources; emit `videoLocal` when the pool file exists; html-to-pdf div.slide support documented. |

PR-1 is the highest-value, lowest-risk PR and lands first. PR-2 touches five template files — **flagged high-risk per the >3-template-file rule; needs explicit user confirmation at implementation dispatch** (the batch approval already covers intent; this is the per-PR confirmation). PR-3 is doc-only but multiplies through the 6-copy skill mirror.

No PR applies the requester's diffs verbatim. Every fix is specified from template sources; the deck-local patches were inspected only to confirm the proven behavior shape.

---

## 1. Work item A — U-008 item 1: html-to-pdf finds zero slides in every current deck

### 1.1 Root cause (verified)

- `scripts/co-deck/html-to-pdf.ts:429` — `page.$$eval('section', …)` counts `<section>` elements only. Line 9 states the design contract: "Captures each `<section>` as a full-page PDF".
- Every current theme renders slides client-side as `div.slide`: zen's `renderSlide` is `el("div", "slide" + …)` (`docs/html-themes/themes/zen/template.html:250-252`); pitch likewise builds slides via JS from slideData. The ticket deck's two HTML versions contain **0** `<section>` elements.
- There is no zero-slide guard: after `Total sections: 0` (html-to-pdf.ts:429-430) the script proceeds to `page.pdf()` (:449) and reports `Pages: 0 (total sections: 0)` with exit 0 (`:462-464`; `hadError` is set only on exceptions, `:473-490`). This is exactly the "21 MB 0-page PDF, exit 0" the ticket reports.

The `section` contract predates the ppt-engine runtime-render era. It matches no deck html-build produces today, and `skills/pdf-export/SKILL.md` never mentions html-to-pdf (the documented PDF path is `gen-slides-pdf.ts`, SKILL.md:88-119).

### 1.2 Proposed change

1. **Dual-selector slide discovery.** After the fonts wait, count both selectors: `section` (legacy static decks) and `.slide` (runtime-rendered PPT-engine decks). Render whichever set is non-empty. For `.slide` decks the existing per-page print CSS is generalized: the current `section { … page-break }` block (:252-347) gains a `.slide` twin with the same rules; the centered-page rules `section.center, section.act-cover` (:279) map to `[data-theme] .slide[data-type="cover"], .slide[data-type="divider"], .slide[data-type="closing"]` (zen marks slide kinds via `dataset.type`, zen/template.html:253). The full-width container rules `section > .grid…` (:303-348) gain `.slide > …` twins. No behavior change for legacy `<section>` decks.
2. **Loud zero-slide failure.** If both counts are 0, print an explicit error naming the input and both selectors tried, and exit 1 after the `finally` cleanup (same pattern as the existing `hadError` exit, `:489-490`). No PDF is written. This implements the ticket's "either supports div.slide or fails loudly" as both.
3. **Doc.** `skills/pdf-export/SKILL.md` gains a short html-to-pdf subsection: what it is for (pixel-parity PDF from a built deck HTML), the div.slide support, and the zero-slide exit.

### 1.3 Test plan

- Fixture A (runtime deck): the ticket repro — `bun scripts/co-deck/html-to-pdf.ts --html <zen deck> --pages 5` — must log a non-zero slide count and produce ≥1 page, exit 0.
- Fixture B (static `<section>` deck): a minimal hand-written section deck must render as before (regression for the legacy path).
- Fixture C (neither selector): a plain HTML page must exit 1 with the zero-slide error and no output file.

### 1.4 Risks

- **R-A1** — the `.slide` print CSS twins can interact with per-slide inline styles (background images set by `renderSlide`, zen/template.html:254-258). Mitigation: the print block already uses `print-color-adjust: exact`-style rules for `section`; the `.slide` twins mirror them, and PR-1's verification renders the actual keynote deck before merge.
- **R-A2** — decks that mix both selectors (hand-edited) would double-count. The discovery picks exactly one set: `.slide` if present, else `section` — never both.

---

## 2. Work item B — U-008 item 2 + U-009 item 2: the `notes`/`footnotes` split

### 2.1 Root cause (verified)

- **PDF**: `gen-slides-pdf.ts:2925` reads only `data.footnotes`; the `SlideData` interface (:915-952) declares `footnotes?: string[]` (:939) and no `notes` field. A slide whose sources live in `notes` (deck S3, verified in `slidedata.json`) loses its source line in the PDF.
- **HTML engine**: `ppt-engine.js` `FootnoteBuilder.render` (:1094-1119) joins `d.footnotes` into one `div.slide-footnote` appended to the slide **host** (outside the card; CSS: absolute bottom-left, ppt-engine.css:673-686). It reads no `notes`.
- **Authoring contract**: `skills/storyline/SKILL.md` documents neither field-split rule (grep: no `footnotes`/abbreviation authoring rule). The deck drifted: sources were mixed into `footnotes`, a deck-local CSS patch ("fix e") forced all footnotes in-card, and abbreviations ended up inside the card. The deck's proven fix (deck HTML :2118-2150, marked `LOCAL-PATCH(U-20261116-009)`) splits the two fields; the committed `slidedata.json` now carries 10 `footnotes` (abbreviations) and 32 `notes` (sources).
- **Contract being formalized** (from the deck patch + U-20261105-002 F3 history): `slideData.footnotes` = abbreviation definitions ("ABBR = definition"), rendered bottom-left **outside** the card; `slideData.notes` = source/caveat lines, rendered **inside** the card as a muted line at the end of the content flow.

### 2.2 Proposed change

1. **PDF** (`gen-slides-pdf.ts`): add `notes?: string[]` to `SlideData` (next to `footnotes`, :939). Extend the footnote pass (:2925): `fns = [...(data.notes ?? []), ...(data.footnotes ?? [])]` — sources first, then abbreviations, one joined band through the existing CARD_LOG fit ladder (:2925-3000, v1.14.9 footnote-scrim). This reproduces the deck's proven PDF workaround ("footnotes = notes + footnotes, bottom-left, 0 dropped") without new placement logic. (Owner decision O-2: merged band vs a separate in-card line; default = merged band.)
2. **HTML engine** (`ppt-engine.js` FootnoteBuilder): keep the `footnotes` branch exactly as is (slide host, outside card). Add a `notes` branch: when `d.notes` is non-empty, append a `div.slide-footnote.slide-notes` to the slide's `.slide-content` flow (in-card, static positioning at the end of the card's flex column) — the proven deck shape. Guard: skip when `.slide-content` is absent (video/divider slides).
3. **CSS** (`ppt-engine.css`): add `.slide-footnote.slide-notes` static in-card rules (small muted line, inherits `--text-dim`-family color; no absolute positioning, no pill). The existing `.slide-footnote` pill (:673) keeps serving the outside-card `slide-abbr` line. Styles that already patch this per deck ("fix e" CSS in the deck, and the §9-7 rule in `patch-zen-white-bubble.ts:135-137`) keep working because the class names stay compatible.
4. **Contract docs** (PR-3): `skills/storyline/SKILL.md` gains the authoring rule (abbreviations → `footnotes`, sources/caveats → `notes`, both optional, first-appearance abbreviation convention unchanged); `agents/html-build.md` gains one line under the slidedata contract.

### 2.3 Test plan

- Extend `scripts/co-deck/tests/gen-slides-pdf-render.test.ts`: a slide with both fields renders a band containing both; a slide with only `notes` renders it; ordering sources-first.
- HTML: a fixture deck page with `notes` + `footnotes` on one slide renders two distinct elements (`.slide-content > .slide-footnote.slide-notes` and `.slide > .slide-footnote.slide-abbr`); a video slide with `footnotes` keeps the legacy pill.
- Regression: decks with `footnotes` only render byte-shape-identical bands (existing tests).

### 2.4 Risks

- **R-B1** — decks that mixed sources into `footnotes` keep working (single band), but after the storyline contract lands they will get both fields right at authoring time. No migration needed.
- **R-B2** — `.slide-notes` in-card placement interacts with the zen card max-height. The deck patch proved the layout on 32 slides; the ladder-free static line reuses `.slide-content` flow, so overflow behaves like bullets.

---

## 3. Work item C — U-008 item 3: punchline `\n` and U+2060 in the PDF

### 3.1 Root cause (verified)

- HTML: `inlineTitle` splits a title on `\n` into `<br>`-separated lines (zen/template.html:128-141, documented in its comment); U+2060 word joiners render zero-width and are harmless in browsers. Deck S45 title is `"**오픈이노베이션은 만남이 아니라 설계다**\n설계가 사람\u2060·\u2060기술\u2060·\u2060미래를 키운다"` (verified in slidedata).
- PDF: `strip()` (:825) removes only tags and `**`; U+2060 survives. `richLines` (:1146-1167) splits atoms on literal spaces only — the `\n` never splits, and U+2060 glues words into one giant atom. An over-wide atom lands on one line (:1158-1163 has no forced break for single atoms) and `r.cell` draws it past the band (:1511-1515) → the overlapping text the ticket reports.

### 3.2 Proposed change

1. `strip()` also removes U+2060 (and U+FEFF) globally: `.replace(/[\u2060\uFEFF]/g, '')`.
2. The punchline statement path (:1442-1444) splits `statementRaw` on `\n` into sentences before `richLines`; each sentence wraps and draws as its own set of lines at the full `T_PUNCH_TEXT` size and bold weight — equal lines, matching HTML's `<br>` behavior. `nTextLines` counts across all sentences so `blockH` and vertical centering stay correct; the card-width calc (:1477-1481) takes the widest sentence.
3. The sub-fallback chain (`sub ?? subtitle ?? bullets[0]`, :1453/:1522) is unchanged. HTML renders no sub at all in the zen punchline branch (zen/template.html:175-182), so the parity rule for multi-sentence punchlines is: **author multi-sentence punchlines as one `\n`-separated title** (this is also what the deck does); `text`/`sub` remain a PDF-only layout aid, and §4 gives the sub an HTML-matching size option.

### 3.3 Test plan

- Extend `gen-slides-pdf-render.test.ts`: a `\n`+U+2060 title produces exactly 2 sentence groups, no run wider than the band, no U+2060 in any drawn run; a single-sentence title is unchanged.
- Verification render of the actual keynote deck (S45) — visual check: two equal-size bold lines, no overlap.

### 3.4 Risks

- **R-C1** — `strip()` is shared by all renderers; removing U+2060 globally is safe (it is pure glue; browsers never render it visibly) and fixes the same hazard in titles/bullets/footnotes in one place.

---

## 4. Work item D — U-008 item 4: contact `bullets` (+ U-009 item 3 promotion)

### 4.1 Root cause (verified, with a correction)

- PDF: the contact renderer reads only `contact*` keys — `known = ['contactName','contactEmail','contactLinkedIn','contactPhone']` plus `/^contact/` extras (:1627-1630). A bullets-only contact slide (deck S47, verified) prints just its title. Confirmed.
- **Correction to the ticket**: the template HTML does NOT render contact bullets either. zen's contact branch renders only `contactEmail/contactLinkedIn/contactPhone` (zen/template.html:215-225). "HTML renders bullets" is true only of the deck's project extension (deck HTML contact branch, "Project extension (design_spec.md §2.8)"), which appends `data.bullets` as `.contact-item` lines with the first line as `.contact-primary`.

### 4.2 Proposed change (owner decision O-1; default = promote)

1. **Promote the deck's contact-bullets extension into the template** (`zen/template.html` contact branch). **Amendment B (2026-11-17, gate-moment ruling — DEC-20261117-01): the contract is FALLBACK-ONLY on both sides, not append-always.** The original wording here ("after the `contact*` items, render up to 5 `data.bullets`") described the deck extension's shape; item 2 always specified fallback-only for the PDF, and PR-2's implementation adopted fallback-only on the HTML side to match. Ruling: accepted — the contract is single-sourced as "bullets render iff no `contact*` line resolved", implemented identically in both outputs (HTML gate: no `contactEmail`/`contactLinkedIn`/`contactPhone` present; PDF gate: empty `cLines`), max 5 lines, first line `.contact-primary` / bold card ink. Rationale: (i) parity is this work item's stated goal (§10 row U-008-contact, §13) — one rule, testable identically in both outputs; (ii) output-neutrality, the Amendment A principle: append-always would change output for pre-existing decks that carry bullets beside `contact*` fields (previously invisible bullets become visible), while fallback-only changes only the bullets-only case, which is the defect being fixed (S47); (iii) the deck-proven shape is preserved exactly — S47 carries no `contact*` fields, so it renders identically under either contract. Known parity edge, recorded not fixed: a slide carrying BOTH `contactName` and `bullets` diverges (the PDF known list includes `contactName`, so it renders the name and suppresses bullets; the HTML template has never rendered `contactName` at all, so it renders the bullets). That combination is redundant authoring (the speaker identity lives in exactly one field), was never in parity pre-batch, and closing it would need a template `contactName`-rendering change outside this batch's scope — decks wanting both lines author bullets only.
2. **PDF parity** (`gen-slides-pdf.ts` contact renderer): when no `contact*` line resolves (`cLines` empty, :1629-1631), fall back to `data.bullets` (max 5, first line bold + `C_DARK` instead of muted to mirror `.contact-primary`). The `contact*`-first order keeps existing decks unchanged. (Unchanged by Amendment B — this was always fallback-only; the amendment aligns item 1 to it.)
3. **Punchline 2-sentence layout promotion** (U-009 item 3): the deck's punchline CSS patch (`min(1120px, 90%)` card width + `clamp(2rem, 3.6vw, 3.1rem)` title, deck HTML :157-160) moves into `patch-zen-white-bubble.ts` as the parameterized patch layer's punchline section (the layer already carries the zen×white-bubble overrides and footnote rules, :135-137). This is the template's designated promotion path for the deck patch family (variant.json script_manifest, U-20261114-012).

### 4.3 Test plan

- Fixture: a bullets-only contact slide renders speaker line + bullets in both HTML (built via build-theme-deck) and PDF; a `contact*` slide renders as before in both. (Amendment B) A mixed fixture — `contactEmail` AND `bullets` on one slide — renders the bullets in NEITHER output (parity pin for the fallback-only contract).
- Punchline patch: run patch-zen-white-bubble on a fixture deck; assert the two punchline rules appear; deck rebuild without the patch keeps the legacy 64px title (the patch layer is opt-in per deck, unchanged contract).

### 4.4 Risks

- **R-D1** — (Amendment B: narrowed) under the fallback-only contract, template HTML output changes only for bullets-only contact slides (previously title-only) — the defect being fixed. Contact slides carrying `contact*` fields alongside bullets keep today's output (bullets stay suppressed in both outputs). The residual risk is the contactName+bullets edge recorded in §4.2 item 1: pre-existing divergence, redundant authoring, out of scope.

---

## 5. Work item E — U-009 item 1: `videoLocal` is a producer-contract gap, not a script defect

### 5.1 Verification verdict (partially confirmed — claims corrected)

The ticket's script-level claims do NOT verify as defects:

- `ppt-engine.js` `VideoSlide.play` already prefers `data.videoLocal` with an error fall-through to the YouTube embed (:1168-1182).
- `theme-builder.ts` embeds slideData verbatim (`JSON.stringify(options.slideData…)`, :200-202) — a `videoLocal` in slidedata reaches the deck.
- `inject-video-players.ts` v1.3.1 (template; project is at 1.3.0 and picks 1.3.1 up at its next upgrade visit) binds `videoLocal` with deck-relative resolution (U-20261115-001, :117-136).
- "inject-video-players skips native video slides" is the documented, intentional design (injector :340-344; ppt-engine.js :1124-1127): native `data-video="1"` slides already have their own chrome-free player; injecting a second one would double-stage. The skip is correct.
- "Stale index binding" is a real constraint (bindings are `slide-<index>` ids, zen/template.html:251) but is mitigated by the U-20261105-007 contract: `build-theme-deck.ts` auto-runs the injector after every build (:188-226), and the injector is idempotent. No code change proposed.

**The verified gap is upstream of all of this**: the slidedata producer contract never emits `videoLocal`. If slidedata carries only `videoId`, the native VideoSlide falls back to YouTube even when `deliverables/assets/videos/yt-<id>.mp4` exists in the pool. The QuickDL design already states the rule (`docs/designs/2026-11-16-quickdl-external-design.md:13,43`: "videoLocal emission by html-build … is noted in the context doc; a pipeline fix belongs with U-20261116-007-class tooling work") — but no template doc actually carries it: neither the template's nor the project's `docs/co-deck.context.md` mentions `videoLocal` (ticket claim on that point NOT verified).

### 5.2 Proposed change (docs only, PR-3)

1. `skills/html-build/SKILL.md` (×6 mirrors): authoring rule — when `deliverables/assets/videos/yt-<videoId>.mp4` exists (pool checked before injection), write `"videoLocal": "../assets/videos/yt-<id>.mp4"` on that slide in slidedata.json; otherwise omit the field (YouTube fallback stays automatic).
2. `agents/html-build.md`: one line in the slidedata contract pointing at the rule (QuickDL provenance).
3. `skills/storyline/SKILL.md` (×6): the notes/footnotes split from §2 plus a note that video-local checks belong to html-build (storyline only records the claim).
4. `docs/co-deck.context.md` (template copy): add the videoLocal rule under the video section so the "noted in the context doc" statement becomes true.

### 5.3 Test plan

- Doc-only: validate-templates green; platform-mirror parity for the three skills (6 copies each at the new version); grep assertion that the rule text exists in all 6 copies.
- Functional spot-check (PR-2/PR-3 together): scratch deck with a pool mp4, slidedata authored per the new rule → built deck's native slide plays the local file; injector summary line reports "N local".

### 5.4 Risks

- **R-E1** — contract-only means decks authored before the rule keep YouTube fallbacks until re-authored. Acceptable: the injector + native player already bind local files the moment `videoLocal` exists; no script change can retro-author decks.

---

## 6. Work item F — U-010: gen-slides-pdf must use the shared layout-overrides parser

### 6.1 Root cause (verified)

- `gen-slides-pdf.ts:287` defines a private `parseLayoutOverrides`; `:241-285` carry private `parseScalar`/`parseIndentedBlock`. The block parser's key regex is `/^(\s*)([\w_-]+):\s*(.*)/` (:265) — a dotted key like `fonts.punchline_px: 32` never matches (`[\w_-]+` stops at the `.`), and `:266` (`if (!match) { i++; continue; }`) silently skips the line. Exactly the defect U-20261105-003 fixed for estimate-layout.
- The shared lib exists and is correct: `scripts/co-deck/lib/layout-overrides.ts` v1.0.0 accepts the flat+dotted+nested union dialect (dotted regex :135, `assignDotted` :54-71), and its header (:5-9) documents this exact gen-slides-pdf divergence as the reason it was created. `estimate-layout.ts:27` already imports it.
- `gen-slides-pdf.ts` imports nothing from the lib. **Confirmed in full.**

### 6.2 Proposed change

1. Replace the private `parseFrontmatter`/`parseScalar`/`parseIndentedBlock`/`parseLayoutOverrides` (:222-330) with imports from `./lib/layout-overrides` (`parseFrontmatter`, `parseScalar`, `deepMerge` — the shared `parseFrontmatter` is byte-equivalent in behavior: theme/style pair + overrides, plus CRLF normalization). Delete the private copies. No call-site changes (same shapes returned).
2. While in the file, fix the latent spec-key drift found during verification: zen's `pdf_layout_spec.json` line_heights uses the legacy key `punchline_px: 76.8` (zen/pdf_layout_spec.json:66) but `buildSizes` reads `lh.punch_text_px` (:2295, default 55.68) — the theme's intended 76.8 line height never reaches the renderer. Rename the zen spec key to `punch_text_px` (and add `punch_sub_px`), so U-011's "defaults derived from the theme spec" actually resolves. Same-file, same-PR; behavior-visible only for zen punchline line height.

### 6.3 Test plan

- `scripts/co-deck/tests/lib-layout-overrides.test.ts` already pins the union dialect; add a gen-slides-pdf-side pin: parse a profile with flat + dotted + nested mixed forms and assert the merged `fonts.punchline_px` (the U-010 repro, all three forms).
- Ticket repro: `layout_overrides: fonts.punchline_px: 32` (dotted) now applies; nested form still applies; estimate-layout and gen-slides-pdf agree on the same profile (parity assertion).
- Regression: `estimate-layout-lint.test.ts`, `gen-slides-pdf-render.test.ts` stay green.

### 6.4 Risks

- **R-F1** — decks whose dotted overrides were silently dropped will suddenly apply them (that is the fix). Sizes can change on re-render. Called out in the changelog; the measure/gate scripts already accept the same dialect, so no gate/render divergence remains.

---

## 7. Work item G — U-011: punch sub size/bold parity (defaults corrected)

### 7.1 Verification verdict (partially confirmed — numbers corrected)

- Sub: `punchline_sub_px ?? 16.0` base default (layout_base.json:20; `gen-slides-pdf.ts:2283` `T_PUNCH_SUB`), rendered regular weight with a hard-coded `false` (:1524). No bold or ink option exists. **Confirmed.**
- "Defaults punchline_px 38.4 / sub 16": accurate for Layer 0 (`layout_base.json:19-20`) and for themes without an override, **but not for the ticket's own deck**: zen's `pdf_layout_spec.json:58` declares `fonts.punchline_px: 64`, merged before the fallback (`gen-slides-pdf.ts:2556-2557`). A zen deck's main punch line already renders 64px bold — which is why the U-011 repro sees the main line wrap rather than look small. The effective U-011 defect on zen is: sub at 16px regular (≈⅓ of HTML visual weight) with no way to enlarge/bold it.
- "HTML renders the title at 46px bold on both lines": 46px is the deck-patch clamp midpoint (`clamp(2rem, 3.6vw, 3.1rem)` → 46.08px at the 1280px slide width, deck HTML :159). The pristine template renders the zen punchline title at `calc(var(--font-size-title) * 2)` = 64px bold (zen/theme.css:96-100; white-bubble/style.css:40 `--font-size-title: 2rem`; `--font-weight-title: 700`, :42). The HTML has no sub line at all (zen/template.html:175-182). The parity target is therefore "deck-patched HTML", and the template-side answer is §4.2 item 3 (promote the patch) + the option below, not a change to the pristine 64px.

### 7.2 Proposed change

1. **New optional override** `fonts.punchline_sub_bold: true|false` (dotted or nested form, parsed by the shared lib once §6 lands) and `line_heights.punch_sub_px` is already supported (:2295-2296). When true, the sub renders bold (`setFont(true, T_PUNCH_SUB)`) and in the statement ink (`C_DARK` when `bgDrawn`, mirroring HTML's line-2 ink) instead of `C_BODY` regular (:1524-1526).
2. **zen theme spec**: add `fonts.punchline_sub_px: 46` (deck-verified HTML-visual size) and the §6.2 item-2 line-height keys, so zen decks approach the deck-patched look without per-deck overrides. Layer 0 defaults stay 16/regular — themes that declare nothing keep today's output. (Owner decision O-3: also flip zen's default sub to bold? Default: no — opt-in via the new key; the deck sets it in its profile.)
3. **Doc** (`skills/pdf-export/SKILL.md`, PR-3): the punchline override keys table gains `fonts.punchline_sub_bold`, with the HTML-parity note (multi-sentence punchlines are authored as `\n` titles, §3.2 item 3).
4. **Amendment A (2026-11-16, gate-moment ruling — DEC-20261116-05): decouple the punchline PART tag from `punchline_sub_px`.** Item 2 exposed a latent coupling: `buildSizes` derives `T_PUNCH_TAG` from the merged `fonts.punchline_sub_px` (`gen-slides-pdf.ts:2283`, `T_PUNCH_TAG: pt(f.punchline_sub_px ?? 12.0, 12.0)`), so zen's new sub default 46 renders the gold "PART" tag at 34.5pt (46 × zen's 0.75 calibration) instead of the previous 12pt (16 × 0.75) on every zen punchline that draws the tag — non-cardMode slides with a non-empty `data.section` (`:1466-1472`; cardMode/bgDrawn slides draw no tag and are unaffected). The coupling predates PR-1 (any deck's `layout_overrides: fonts.punchline_sub_px` silently moved the tag); the zen spec default merely surfaced it fleet-wide.
   - **Ruling: option (a), refined.** Give the tag its own key, bound at Layer 0 to the **output-neutral value 16.0**, not 12.0. `pt()`'s fallback argument is also CSS-px through the per-theme calibration (`pt = (cssPx ?? fallback) × mult`, `:2239-2240`), so a 12.0 default would shrink the tag on every deck (9pt on zen, 10.2pt at base calibration 0.85) — a worse regression than the one being fixed. `16.0` reproduces the pre-PR-1 chain exactly (every theme inherited `punchline_sub_px: 16.0` from `layout_base.json:20`, so tag = 16 × mult on all of them): zen 12pt, base themes 13.6pt, unchanged.
   - Exact change: (i) fonts interface — add `punch_tag_px?: number;` beside the punchline keys with a one-line decoupling comment; (ii) `buildSizes` — `T_PUNCH_TAG: pt(f.punch_tag_px ?? 16.0, 16.0),`; (iii) `docs/html-themes/themes/_shared/layout_base.json` — `fonts` gains `"punch_tag_px": 16.0` (provably output-neutral documentation of the default; the code fallback stays dead as today). No zen spec entry — the zen tag stays at its pre-PR-1 size; only decks that explicitly set `fonts.punch_tag_px` change it. No legacy `punch_tag_pt` twin (no historical key; minimal diff). `LH_PUNCH_TAG` is untouched — the line-heights namespace split `punch_tag_px` from `punch_sub_px` long ago (`layout_base.json:45/:48`); this amendment applies the same split to fonts, which is the house pattern and the reason option (b) (bind the tag to Layer-0's sub value) is rejected: `buildSizes` receives only the merged spec (`:2234`), so (b) needs new plumbing and inverts the semantics (a theme could never scale the sub without re-asking what happens to the tag).
   - Follow-ons: PR-3's pdf-export key table lists `fonts.punch_tag_px` (with `punchline_sub_px` / `punchline_sub_bold`); changelog notes that decks which previously moved the tag via `punchline_sub_px` must now set `punch_tag_px` explicitly.

### 7.3 Test plan

- Unit pin: `fonts.punchline_sub_bold: true` flips weight and ink; absent key keeps regular/muted (all existing decks unchanged).
- Ticket repro profile (`punchline_px 50, punchline_sub_px 50, punch_text_px 66, punch_sub_px 66`) renders the S45 pair at matching sizes; with the zen spec defaults alone (no profile), the deck-patched visual is approximated.

### 7.4 Risks

- **R-G1** — the zen spec change alters the default PDF for every future zen deck (sub 16→46px). That is the intended parity fix; decks pinned by explicit profile overrides are unaffected. Changelog entry required.

---

## 8. Path classification (L2 template vs L3 deck-local)

Ticket paths are project-relative; every affected template path resolves under `templates/co-deck/`. None of the touched paths exists in `templates/common/` (checked), so this batch creates **zero new `variant-common-shadow` instances** and needs **no L1 propagation** — all files are variant-specific (L2). The shadow-heal follow-up (T-20261116-003) is untouched by this design.

| Ticket path (project-relative) | Template path (L2) | Declared in variant contract | L3 deck-local counterpart |
|---|---|---|---|
| scripts/co-deck/html-to-pdf.ts | templates/co-deck/scripts/co-deck/html-to-pdf.ts | script_manifest.local ✓ | identical copy in project (diff-clean) |
| scripts/co-deck/gen-slides-pdf.ts | templates/co-deck/scripts/co-deck/gen-slides-pdf.ts | script_manifest.local ✓ | identical copy (diff-clean) |
| scripts/co-deck/lib/layout-overrides.ts | templates/co-deck/scripts/co-deck/lib/layout-overrides.ts | variant_scripts_dir (dir-level; lib/ not itemized) ✓ | identical copy (diff-clean) |
| scripts/co-deck/lib/theme-builder.ts | templates/co-deck/scripts/co-deck/lib/theme-builder.ts | variant_scripts_dir ✓ | template AHEAD (0.2.2 doc-only) — no backport needed |
| scripts/co-deck/build-theme-deck.ts | templates/co-deck/scripts/co-deck/build-theme-deck.ts | script_manifest.local ✓ | — (no project change) |
| scripts/co-deck/inject-video-players.ts | templates/co-deck/scripts/co-deck/inject-video-players.ts | script_manifest.local ✓ | template AHEAD (1.3.1) — project picks up at upgrade visit; no backport |
| docs/html-themes/themes/_shared/ppt-engine.js | templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js | theme_manifest (themes_dir) ✓ | identical copy (diff-clean) |
| docs/html-themes/styles/white-bubble/style.css | templates/co-deck/docs/html-themes/styles/white-bubble/style.css | theme_manifest (styles_dir) ✓ | deck-local patch CSS stays in deck HTML (promoted form goes to patch-zen-white-bubble.ts, not style.css) |
| docs/html-themes/themes/zen/pdf_layout_spec.json | templates/co-deck/docs/html-themes/themes/zen/pdf_layout_spec.json | theme_manifest ✓ | — |
| docs/html-themes/themes/zen/template.html | templates/co-deck/docs/html-themes/themes/zen/template.html | theme_manifest ✓ | deck HTML carries the §2.8 contact extension (promotion source) |
| skills/pdf-export/SKILL.md | templates/co-deck/skills/pdf-export/SKILL.md | skill_manifest ✓ | — |
| skills/storyline/SKILL.md | templates/co-deck/skills/storyline/SKILL.md | skill_manifest ✓ | — |
| agents/html-build.md | templates/co-deck/agents/html-build.md | agent manifest ✓ | — |
| docs/co-deck.context.md | templates/co-deck/docs/co-deck.context.md | variant context file ✓ | project copy drifts behind; updated template copy flows at next upgrade visit |

**Stays deck-local (L3, explicitly NOT backported):**
- `slidedata.json` notes/footnotes/videoLocal field choices and the transient PDF-export copy (deck data, per-deck).
- `lecture-profile.md` layout_overrides values (deck-specific sizes; the nested-form workaround becomes unnecessary after §6).
- Deck HTML LOCAL-PATCHes: FootnoteBuilder split, "fix e" footnote CSS, wide-bubble/cropped-SVG patches, contact `.contact-primary` styling specifics — their generic shapes are re-derived in the template (§2.2, §4.2); the deck's own instance stays as authored (design_spec §2.8 extension).
- `_versions/` snapshots (deck history).

**Not touched by this design (observed, out of scope):** `white-bubble/style.css:208-209` still references `../../../../presentations/assets/fonts/…` — a pre-deliverables-migration path. If the deliverables/ consolidation (2026-11-15 design) moved that tree, the font URLs are stale. Filed as an observation for a follow-up ticket; not fixed here (no ticket claims it, and it needs its own verification).

---

## 9. Platform impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | Template-side only. Skills ship ×6 (skills/ + .agents/.claude/.gemini/.hermes/.codex): storyline, html-build, pdf-export each get the PR-3 text in all 6 copies (platform-mirror-freshness gate). Scripts and agents are single-copy (agents/ is not platform-mirrored in this variant). | as per §0 table |
| Antigravity (GEMINI.md) | Same skill mirrors; no GEMINI.md text change (it does not restate co-deck pipeline details). | mirrors only |
| Codex / Hermes / other surfaces | Same skill mirrors. | mirrors only |
| templates/common | **None — justified.** Every touched path is variant-specific (scripts/co-deck/, docs/html-themes/, skills/{storyline,html-build,pdf-export}, agents/html-build.md, docs/co-deck.context.md); none exists under templates/common, so no L1 mirror refresh and no shadow-register entry is created. | N/A |

Cross-platform: all changes are in TypeScript/JS/JSON/MD consumed identically on every platform; no shell, path-separator, or encoding assumptions introduced (deck-relative video paths stay POSIX-normalized as in inject-video-players.ts:134).

**Accessibility statement**: rendering-parity changes to generated PDF/HTML output. The contact `.contact-primary` bold treatment and footnote band reuse existing contrast-checked colors (C_DARK/C_BODY on the established card/wash surfaces; the v1.14.x contrast LOCAL-PATCHes document the ratios). No new UI surface. ADR-0065 review not triggered by this batch; the existing contrast annotations carry over.

**Preview Verification statement**: verification is by the PR test plans (§1.3, §2.3, §3.3, §4.3, §5.3, §6.3, §7.3) — built-deck fixture renders and `bun test` in the template tree. No workspace-UI preview applies.

---

## 10. Ticket claims checked

| Ticket | Claim | Finding |
|---|---|---|
| U-008 | html-to-pdf captures `<section>`, zen renders div.slide, "Total sections: 0", 0-page PDF exit 0 | **Confirmed** (html-to-pdf.ts:429, :449-464; zen/template.html:250-252; deck HTMLs contain 0 sections). |
| U-008 | gen-slides-pdf reads only `footnotes`; `notes` sources dropped | **Confirmed** (:2925; interface :915-952 has no `notes`). |
| U-008 | Punchline `\n`/U+2060 overlaps in PDF; HTML renders `\n` as break | **Confirmed** (strip :825; richLines space-split :1146-1167; inlineTitle `<br>` split zen/template.html:133-141). |
| U-008 | Contact: HTML renders `bullets`, PDF reads only contact* | **Partly confirmed.** PDF side confirmed (:1627-1631). Template HTML does NOT render contact bullets — only the deck's design_spec §2.8 extension does. §4 defines the promotion. |
| U-009 | build-theme-deck/theme-builder emit only videoId | **Not a script defect.** theme-builder passes slideData verbatim (:200-202); build-theme-deck never rewrites fields. The producer contract is the gap (§5). |
| U-009 | inject-video-players skips native video slides | **Intentional by design** (injector :340-344; ppt-engine.js :1124-1127). Not a defect. |
| U-009 | Index-based bindings go stale when slides are inserted | **Real constraint, mitigated** — auto-injection after every build (build-theme-deck.ts:188-226) + idempotent re-run contract. No code change. |
| U-009 | FootnoteBuilder abbreviations-outside vs sources-in-card split missing in template | **Confirmed** (ppt-engine.js :1094-1119 renders footnotes only; no notes; storyline SKILL.md has no split rule). |
| U-009 | co-deck.context.md already documents the videoLocal rule | **Not verified** — no videoLocal mention in either the template's or the project's context file. The rule lives in the QuickDL design doc (:13, :43). §5.2 item 4 fixes the doc. |
| U-009 | Punchline 2-sentence layout only deck-local | **Confirmed** (deck :157-160; template lacks the rule). Promotion specified in §4.2 item 3. |
| U-010 | Private parseLayoutOverrides silently drops DOTTED keys; shared lib accepts them; estimate-layout uses the lib | **Confirmed exactly** (:287, :265-266; lib v1.0.0 :54-71, :135; estimate-layout.ts:27). Correction: the effective zen default is 64px (theme spec :58), not 38.4 — the mechanism is unchanged. |
| U-010 | "v1.14.9, same in templates/co-deck" | **Confirmed** (template @1.14.9, byte-identical to project). |
| U-011 | PDF defaults 38.4/16, sub regular, no bold option | **Confirmed** (layout_base.json:19-20; :2283; hard-coded regular :1524) — with the zen-64px correction above. |
| U-011 | HTML renders 46px bold both lines | **Deck-patch value**, not template: pristine zen = 64px bold (`calc(var(--font-size-title) × 2)`), 46px is the deck clamp midpoint; HTML renders no sub. §7 targets the deck-patched look via theme-spec defaults + opt-in keys. |

---

## 11. Owner decisions (open; defaults apply unless the owner objects)

- **O-1 (§4)**: promote the contact-bullets rendering into the template zen contact branch. **Default: promote** (HTML↔PDF parity; the deck extension is generic). Alternative: keep deck-local and give only the PDF a bullets fallback — then HTML and PDF diverge again by construction. Not recommended.
- **O-2 (§2.2 item 1)**: PDF `notes` placement. **Default: merged into the existing footnote band, sources first** (the deck's proven workaround, zero new placement logic). Alternative: separate in-card source line mirroring the HTML split exactly (more code, uses the CARD_LOG ladder differently).
- **O-3 (§7.2 item 2)**: zen punch sub bold-by-default. **Default: opt-in** (`fonts.punchline_sub_bold`), zen spec sets size 46 only. Alternative: default bold in zen spec (closer to deck patch; changes every future zen deck more aggressively).
- **O-4 (§1.2 item 2)**: zero-slide behavior for html-to-pdf. **Default: exit 1 with a loud message, no PDF written.** Alternative: warn-and-continue (preserves today's exit-0-with-blank behavior; rejected — it is the reported failure mode).

## 12. Rollout

Three sequential template-side PRs through `/sync` (one open root PR at a time, CLAUDE.md sequential-branch rule):

1. **PR-1 (PDF renderer)**: `gen-slides-pdf.ts` @1.14.9 → 1.15.0 (parser adoption = U-010 fix; `notes` rendering; `\n`/U+2060 punchline; contact bullets fallback; `punchline_sub_bold` key), `zen/pdf_layout_spec.json` (key rename + sub size), plus **Amendment A (2026-11-16, DEC-20261116-05)**: the `punch_tag_px` decoupling lands in the same PR (`gen-slides-pdf.ts` T_PUNCH_TAG line + fonts interface; `_shared/layout_base.json` `fonts.punch_tag_px: 16.0`). Files: 3 + tests. Runs first: PR-2's HTML contract and PR-3's docs reference the renderer keys.
2. **PR-2 (HTML side, HIGH-RISK: 5 template files — needs explicit user confirmation at dispatch)**: `html-to-pdf.ts` @1.2.0 → 1.3.0, `ppt-engine.js` (FootnoteBuilder notes branch), `ppt-engine.css` (.slide-notes rules), `zen/template.html` (contact bullets), `patch-zen-white-bubble.ts` (punchline section). Files: 5 + tests.
3. **PR-3 (contracts)**: `skills/storyline/SKILL.md` 6 copies (version bump + notes/footnotes split), `skills/html-build/SKILL.md` 6 copies (videoLocal emission), `skills/pdf-export/SKILL.md` 6 copies (html-to-pdf section + punchline override table), `agents/html-build.md`, `docs/co-deck.context.md` (videoLocal rule). Files: 5 logical (×6 mirrors) + 2.

Lifecycle: each PR updates VERSION_MANIFEST / script lifecycle records through the normal `/sync` step. Tickets: U-20261116-010 and U-011 → resolved fixed on PR-1; U-008 → resolved fixed on PR-2; U-009 → resolved fixed on PR-3 (its script-path claims are closed as not-defects in §10, recorded in the result notes). Follow-up ticket to file from §8: the white-bubble font-path observation.

## 13. Acceptance criteria

- [ ] html-to-pdf on the zen keynote deck renders ≥1 page, exit 0; on a selector-less page exits 1 without writing a PDF; on a legacy `<section>` deck renders unchanged.
- [ ] gen-slides-pdf renders S3's `notes` source line; band count matches notes+footnotes with zero drops (ticket repro re-run).
- [ ] S45 punchline: two equal-size bold lines in the PDF; no U+2060 in any drawn run; no overlap (visual verification render).
- [ ] S47 bullets-only contact renders speaker + bullets in PDF and template-built HTML.
- [ ] (Amendment B, DEC-20261117-01) The contact-bullets contract is fallback-only on both sides: a slide with `contact*` fields AND bullets renders the bullets in neither output (HTML and PDF identical); a bullets-only slide renders bullets with the first line emphasized in both.
- [ ] Dotted `fonts.punchline_px: 32` in layout_overrides reaches the PDF renderer; flat, dotted, nested, and mixed forms all parse (union dialect pin).
- [ ] gen-slides-pdf imports parseFrontmatter/parseScalar/deepMerge from lib/layout-overrides; private copies deleted; estimate-layout parity assertion green.
- [ ] `fonts.punchline_sub_bold: true` flips sub weight/ink; absent key keeps today's output; zen spec sub default 46px lands with the key rename.
- [ ] (Amendment A, DEC-20261116-05) The punchline PART tag is decoupled from `punchline_sub_px`: on a zen punchline with `section` and no drawn background the tag renders at its pre-PR-1 size (12pt = 16 cssPx × 0.75) while the sub renders at 34.5pt; a layout_base-only deck's tag is unchanged (16 cssPx × that theme's calibration); `fonts.punch_tag_px` moves the tag and nothing else.
- [ ] Template zen punchline + contact rules land via patch-zen-white-bubble / template.html with deck-patch parity; decks without the patch keep legacy output.
- [ ] Storyline/html-build/pdf-export skills at the new version in all 6 mirrors (platform-mirror parity green); videoLocal rule present in co-deck.context.md.
- [ ] validate-templates, verify-scripts, `bun test` (template tree), and audit `--spec-check` all green; T-20261116-003 live count unchanged by this batch (no new shadows).
