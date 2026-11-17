# co-deck PDF follow-up batch (T-20261117-002..005) — Design (Row 0)

- **Spec ID**: `2026-11-17-co-deck-pdf-followups-design` (NEW — registered alongside this doc; the 2026-11-16 backport spec `2026-11-16-co-deck-pdf-html-backport-design` covers the parity pipeline this batch follows up on, but per-batch spec entries are the registry convention and that batch is closed. Relationship recorded in both documents.)
- **Date**: 2026-11-17
- **Status**: implemented (spec-registry flip at PR-4 landing; PR-4/PR-5 pending in the same batch). Owner decision O-5 (§5) is open; its default is stated and used if the owner does not object.
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074, design only)
- **Input tickets**: T-20261117-002 (UI-chrome print leak), T-20261117-003 (--pages non-functional), T-20261117-004 (white-bubble font paths), T-20261117-005 (contactName parity). T-005 carries the DEC-20261117-01 "recorded not fixed" edge.
- **Scope**: design only. All file:line references measured on `main` == `origin/main` @ `4f6ee2ce3` (verified equal). Code state: `html-to-pdf.ts` @1.3.0 (PR-2, d125f7778), `gen-slides-pdf.ts` @1.15.x (PR-1 + Amendment A), zen template with the fallback-only contact bullets (PR-2).
- **Related**: [`2026-11-16-co-deck-pdf-html-backport-design.md`](2026-11-16-co-deck-pdf-html-backport-design.md) (§1.4 R-A1, §8 observation — this batch resolves both), [`2026-11-15-co-deck-deliverables-migration-design.md`](2026-11-15-co-deck-deliverables-migration-design.md) (the migration that stranded the font paths), DEC-20261117-01 (contactName edge), DEC-20261116-05.

## 0. Summary

Four follow-ups from the R-A1 verification render (PR #2053 thread) plus one recorded edge. Two are html-to-pdf print-CSS defects (same file, same block, verified together); one is the font-path stranding observed in the original batch design §8; one is the contactName parity edge. Two PRs, each ≤3 template files (below the high-risk flag threshold):

| PR | Tickets | Files | Change in one line |
|----|---------|-------|--------------------|
| PR-4 | T-002, T-003 | `scripts/co-deck/html-to-pdf.ts` | Print CSS hides the real theme chrome (page count == slide count); `--pages` exclusion survives the `!important` flex rule via a class the print block honors. |
| PR-5 | T-004, T-005 | `docs/html-themes/styles/white-bubble/style.css`, `docs/html-themes/styles/classic/style.css`, `docs/html-themes/themes/zen/template.html` | Font URLs repointed to the migrated layout (2 stylesheets, 4 lines); zen contact branch renders `contactName` (HTML-only change; PDF already renders it). |

PR-4 lands first: the T-005 verification render runs through html-to-pdf, so clean page-count semantics must exist before content-parity renders are trusted.

---

## 1. Work item A — T-20261117-002: UI-chrome print leak (pages ≠ slides)

### 1.1 Root cause (verified, mechanism refined)

The ticket's cause statement is correct but incomplete. `html-to-pdf.ts:256-260` sets `html, body { overflow: visible !important; height: auto !important }` with no chrome hiding — **but v1.3.0 already carries a chrome-hide block** at `:477-486`:

```css
.footer-bar, .progress-track, .progress-fill,
.toc, .toc-backdrop, .toc-toggle, .note-panel { display: none !important; }
```

**The selectors are stale legacy vocabulary.** Verified across all six theme templates: the actual chrome ids/classes are `#toc-overlay`, `#toc-drawer` (all 6: outline, outlook, pitch, pitch-enhanced, vertical, zen), `#script-panel` (5 of 6; outlook has none), and `<footer class="ppt-footer">` containing the slide counter / narration / progress bar (all 6). The hide-list vocabulary (`.footer-bar`, `.note-panel`, `.toc`) matches none of them — `.toc-toggle` survives only in the `docs/html-themes/preview/decks/*.html` fixture previews. Result: the TOC drawer renders as page 1 and the speaker-notes panel as page 49 (the R-A1 observation: 49 pages for 47 slides, slides mapping 1:1 to pages 2-48).

The leak mechanism itself is the ticket's: with `overflow: visible` + `height: auto` on html/body, the fixed/off-canvas chrome (`#toc-drawer` transform-offset, `#script-panel`) enters the printed flow instead of being clipped.

### 1.2 Proposed change

Extend the **existing** hide block at `:477-486` (keep the legacy selectors — they are harmless and the preview fixtures still use some) with the audited theme-chrome set:

```css
#toc-drawer, #toc-overlay, #script-panel,
footer, .ppt-footer, .progress-bar-wrap {
  display: none !important;
}
```

- `footer` (element selector) covers the `<footer class="ppt-footer">` pair across all six themes; `.progress-bar-wrap` and the footer-internal counters/narration buttons die with the footer.
- No `body > :not(…)` structural chain: the wrappers differ per theme (zen uses `.ppt-main`, others their own), and a denylist of audited ids is predictable and theme-safe. A structural selector would also kill legitimate future chrome-less wrappers.
- Theme-safety note: outlook (horizontal-scroll, own nav chrome) has no `#script-panel`/`#presentation` id — the denylist still hides its drawer/footer/overlay, which is all it needs. pitch (no ppt-engine) carries the same footer/drawer ids, covered.
- Zero-slide guard interplay: none — chrome hiding does not affect the dual-selector slide discovery (`:527-537` region counts only `section`/`.slide`).
- **T-002 Addendum (2026-11-17, gate-moment ruling — DEC-20261117-04, appended entry): the denylist alone does not achieve the §1.3 invariant on ppt-engine runtime decks — a wrapper-flow reset joins the fix scope, same file, same injected block.** Empirically debugged by automation-engineer: after chrome hiding, a 3-slide zen fixture still measured 2 pages. Mechanism verified in code: ppt-engine.css's `@media print` block (`:728+`) resets `.ppt-main` only partially — `flex: none; height: auto; overflow: visible` (`:735-738`) — leaving its base `display: flex` (:32) intact, and **never touches `.presentation-container`** (base `:37-43`: `flex: 1; display: flex; align-items: center; justify-content: center; padding: 1.5rem`). The consequence chain: the wrapper pair stays a flex/centering/padded context around the engine's per-slide print rules ("Slide cards: block flow, one per page"), so the stacked slide flow gets horizontally flexed, vertically centered against page boundaries (misalignment) and clipped/pushed into empty pages via `break-inside: avoid` — pages ≠ slides persists. One property-attribution correction to the engineer's report: `overflow: hidden` lives on `.ppt-main`'s base rule (:33) and the print block DOES reset it there; the residual culprits are the un-reset `display: flex` on both wrappers and `.presentation-container`'s untouched flex/centering/padding. Ruling: **accepted as specified** — same symptom class (pages ≠ slides), same mechanism block (the injected print-CSS), zero legacy-deck impact (legacy `<section>` decks and non-ppt-engine decks lack both classes, so the class-scoped selectors are no-ops; outlook/vertical templates don't carry the wrappers at all). Exact addition to the injected block: `.ppt-main, .presentation-container { display: block !important; overflow: visible !important; height: auto !important; flex: none !important; padding: 0 !important; }`. Two notes: (1) defense-in-depth context — ppt-engine.css's own print block already carries a correct chrome denylist for current engine copies, but a deck linking an older engine copy (as the R-A1 deck's project-side copy evidently did) leaks; the injected denylist stays as the render-side guarantee. (2) Verification scope — the landed diff was not visible in any git state reachable at ruling time (branch `pr/20261117-co-deck-pdf-followups-pr4` tip carried no html-to-pdf changes; working tree clean), so this ruling verifies the MECHANISM against main's source of truth and accepts the described fix shape; the QA gate must pin the actual landed diff (`@version` 1.3.1 + both wrapper selectors + the §1.2 denylist present in the injected block).

### 1.3 Test plan

- Full-deck render of a built zen deck (the R-A1 deck or a fixture): **PDF page count == slide count**; first page is slide 1 (no TOC drawer), last page is the last slide (no notes panel).
- Spot-render an outlook and a pitch deck fixture: page count == slide count (theme-safety pin).
- Legacy regression: a static `<section>` deck renders unchanged (the hide additions don't touch section/slide rules).

### 1.4 Risks

- **R-A1'** — a future theme that renders slide content inside `footer`/drawer-like elements would be hidden. Mitigated by the denylist being id-scoped (`#toc-drawer`, `#script-panel`), not class-greedy; the theme-authoring skill should note the reserved ids (one line in PR-5's doc touch, §6).

---

## 2. Work item B — T-20261117-003: `--pages` non-functional on div.slide decks

### 2.1 Root cause (verified — latent claim confirmed)

- The `--pages` filter (`:530-538`) hides out-of-limit slides with an inline `slides[i].style.display = 'none'` — **no `!important`**.
- The print rule `section, .slide { … display: flex !important; … }` (`:289`, inside the `:272-299` block) is a stylesheet `!important`, which beats a normal inline style (only inline `!important` wins the cascade).
- **Latent claim confirmed by git**: the v1.2.0 blob (oldest tracked version of the file) already had `section { … display: flex !important }` (`:209`/`:223` of that blob). The defect existed since v1.2.0 but never manifested — no deck HTML contained `section` or `.slide` elements until PR-2 made div.slide decks render at all.
- Arithmetic cross-check: with `--pages 5` on the 47-slide deck, nothing hid (49 = 47 slides + 2 chrome pages, matching the T-002 count exactly) — the inline style was fully overridden, not partially.
- The "Pages: 5" log is computed, not measured (`:561`: `renderedPages = pageLimit` when limiting) — it reports intent, never truth.

### 2.2 Proposed change — class-based exclusion (chosen), not inline-specificity

Two candidate designs:

| Option | Mechanism | Assessment |
|---|---|---|
| (a) inline `style.setProperty('display', 'none', 'important')` | inline `!important` beats stylesheet `!important` | Works, but leaves screen-context markup mutated with priority hints and keeps two competing sources of truth (inline + stylesheet). Rejected. |
| (b) **class the filter adds; the print block honors it** | JS adds `cdk-page-hidden`; a print rule with **higher specificity** sets `display: none !important` | Chosen. One source of truth (the print block), the filter stays declarative, and the same class serves future print-side exclusions. |

Exact change:

1. In the `--pages` evaluate loop (`:530-538`), alongside the existing inline style (kept — it makes the hide effective in any screen-context re-render too), add `(slides[i] as HTMLElement).classList.add('cdk-page-hidden')`.
2. In the print-CSS block, immediately **after** the `section, .slide { … }` rule, add:

```css
section.cdk-page-hidden, .slide.cdk-page-hidden {
  display: none !important;
  page-break-after: auto !important;
  break-after: auto !important;
}
```

   Specificity `0,2,0` beats the twin rule's `0,1,0` at equal importance — order-independent, no fragile "later rule wins" coupling. The break-after resets are belt-and-braces (a `display: none` box generates no pages or breaks; they cost nothing and keep the last-*visible*-slide's trailing-break semantics identical to the full-deck case).
3. The `renderedPages` log stays computed (it becomes truthful once the page count == slide count invariant holds via §1; no measurement plumbing needed for a preview flag).

### 2.3 Test plan

- `--pages 5` on the 47-slide zen deck: PDF has **exactly 5 pages** (post-§1: no chrome pages), slides 1-5 in order, "Hidden 42 slides" logged.
- `--pages N` with N ≥ slide count: full deck, no hidden class present.
- Legacy `<section>` deck with `--pages 2`: exactly 2 pages (the section twin is covered by the same class rule).
- Full-deck render unchanged (no `cdk-page-hidden` in DOM).

### 2.4 Risks

- **R-B1** — a deck that already styles `.cdk-page-hidden` would collide. The name is cdk-namespaced like the injector's `cdk-*` markers; grep of theme CSS shows no such class. Negligible.
- **R-B2** — interaction with `section:last-of-type`/`.slide:last-of-type` trailing-break reset (`:488-492`): with slides 6-47 hidden, slide 5 is not `:last-of-type`, so it keeps `page-break-after: always`; Chromium suppresses a trailing page break at document end (empirically confirmed by the R-A1 render's exact 49-page count), so no trailing blank. Pinned by the §2.3 first test.

---

## 3. Work item C — T-20261117-004: stale font paths in white-bubble (and classic)

### 3.1 Root cause (verified — scope corrected)

- `docs/html-themes/styles/white-bubble/style.css:208-209` and **`docs/html-themes/styles/classic/style.css:104-105`** (sibling audit result — the ticket named white-bubble as primary with "audit the siblings"; the audit found exactly one more affected stylesheet, so the affected set is **2 files, 4 `@font-face` lines**) carry:

```css
@font-face { font-family: 'Pretendard'; src: url('../../../../presentations/assets/fonts/Pretendard-Regular.ttf') … }
@font-face { font-family: 'Pretendard'; src: url('../../../../presentations/assets/fonts/Pretendard-Bold.ttf') … }
```

- The 2026-11-15 deliverables migration moved the scaffold tree `presentations/` → `deliverables/`; `download-font.ts` v2.1.1 was migrated with it (`PROJECT_FONT_DIR = 'deliverables/assets/fonts'`, `:96`). The CSS URLs are the only stale remnants — a repo-wide grep for `presentations/` under `docs/html-themes/` finds no other hit.
- URL resolution is relative to the **CSS file** (not the consuming HTML), so the path is consumer-independent: from `docs/html-themes/styles/<style>/`, `../../../../` = the variant root. The correct migrated target is `../../../../deliverables/assets/fonts/Pretendard-*.ttf` — resolving correctly for a built deck (deck links `../../docs/html-themes/styles/…`, CSS base stays `docs/html-themes/styles/<style>/`) and for any template-context preview alike.
- Provisioning reality (verified): neither the template nor a fresh scaffold ships Pretendard — `templates/co-deck/deliverables/assets/fonts/` is tracked as `.gitkeep` only; the TTFs are per-project downloads via `download-font.ts`. The path fix therefore makes the URLs resolve **when fonts are downloaded**; absent files fall back via `font-display: swap` to the declared system families — the same degradation as today, minus the guaranteed 404s. The R-A1 "4 CSS 404s" are the font requests initiated from the four linked stylesheets' cascade context; this fix removes their cause.

### 3.2 Proposed change

1. Repoint all 4 lines to `url('../../../../deliverables/assets/fonts/Pretendard-Regular.ttf')` / `…-Bold.ttf` in both stylesheets. No other attribute changes (weight/style/font-display stay).
2. Sibling audit closure: grep gate in the PR (or a one-off verification step) asserting no `presentations/` reference remains under `docs/html-themes/`.

### 3.3 Test plan

- Render a white-bubble deck with fonts downloaded: network log shows the font requests resolving (no 404), glyph metrics match Pretendard (the R-A1 render's fallback-font difference disappears).
- Render with fonts absent: no crash, swap fallback, exit 0 (degradation path pinned).
- Grep assertion: `grep -r "presentations/" docs/html-themes/` → empty.

### 3.4 Risks

- **R-C1** — decks/installs that pre-created the old `presentations/assets/fonts/` tree locally would lose resolution. The migration (2026-11-15) already declared that tree dead; `download-font.ts` is the supported provisioning path. Changelog notes the repoint.

---

## 4. Work item D — T-20261117-005: contactName parity

### 4.1 Verification verdict (confirmed; both options designed)

- PDF: `gen-slides-pdf.ts:1623` — `known = ['contactName', 'contactEmail', 'contactLinkedIn', 'contactPhone']`; contactName renders as the first contact line (regular weight — the bold `primaryFirst` treatment applies only to the bullets-fallback first line, `:1634`/`:1651`). Ticket line ref exact.
- HTML: zen contact branch (`zen/template.html`) gates bullets on `contactEmail || contactLinkedIn || contactPhone` only and has never rendered `contactName` — the DEC-20261117-01 recorded edge, exactly as described.
- Divergence surface: a contactName+bullets slide → PDF name-only; HTML bullets-only. A contactName-only slide → PDF name; HTML title-only.

### 4.2 Option A (recommended default): HTML renders contactName

- zen contact branch: render `data.contactName` as the **first** `.contact-item` line (plain — NOT `.contact-primary`; see below), before email/linkedin/phone; extend the gate to `hasContactLine = !!(data.contactName || data.contactEmail || data.contactLinkedIn || data.contactPhone)`.
- **No PDF change.** Parity ledger: field order matches the PDF known-list order (name first, `:1623`); weight matches (both regular — rendering the name as `.contact-primary` would make HTML bold where PDF is regular, re-introducing a divergence); the fallback-only bullets contract (DEC-20261117-01) is preserved exactly — the gate widens by one field on both sides symmetrically (PDF's `cLines` already includes contactName).
- Output mutations (the fix's point, mirroring the S47 precedent): contactName-only slides gain the name line in HTML (were title-only); contactName+bullets slides flip from bullets to name in HTML (matching PDF, which already showed name-only). Both are parity-direction changes on a combination DEC-20261117-01 classified as redundant authoring.

### 4.3 Option B: PDF drops contactName

- Remove `contactName` from the `:1623` known list. contactName-only slides fall through to the bullets fallback on both sides; contactName+bullets slides render bullets on both sides.
- Rejected as default: it is **capability removal** — the PDF is currently the only renderer of an authored, interface-declared field (`SlideData.contactName`, `:917`), and the batch family's consistent direction has been promoting the richer side's capability into the template (contact-bullets promotion, O-1 of the original batch). It also mutates PDF output for any existing deck that renders a contactName today, with no compensating capability.

### 4.4 Owner decision O-5

Ticket says "owner to scope at triage". **Default: Option A** (§4.2), HTML-only, no PDF change, contract intact. Option B remains available if the owner prefers retiring the field. If the owner wants contactName rendered with primary emphasis in both outputs (bold name in PDF too), that is a third scope — a PDF weight change — deferred unless asked; it is not needed for parity.

### 4.5 Test plan

- Fixture slides: contactName-only; contactName+bullets; contactEmail-only; bullets-only (the S47 regression case). Assert HTML and PDF render the same line sequence and emphasis for each (name first, regular; bullets only when no contact field; bullets-fallback first line emphasized on both sides).
- Deck-level: rebuild the R-A1 deck (S47) — unchanged output (no contactName in its slidedata).

### 4.6 Risks

- **R-D1'** — decks relying on HTML's never-rendered contactName are unaffected (nothing was rendered before). Decks whose contactName+bullets HTML output changes see the §4.2-documented flip; the storyline contract (PR-3 of the original batch) already tells authors to keep identity in one field.

---

## 5. Path classification

All four tickets are L2 template files. None exists under `templates/common/` (verified) — no new `variant-common-shadow` instances, no L1 propagation, T-20261116-003 unaffected. Variant-contract declarations: html-to-pdf.ts (script_manifest.local ✓), both style.css files (theme_manifest styles_dir ✓), zen/template.html (theme_manifest themes_dir ✓).

| Ticket | Template path | L3 counterpart |
|---|---|---|
| T-002, T-003 | templates/co-deck/scripts/co-deck/html-to-pdf.ts | deck-local copies pick up at upgrade visit |
| T-004 | templates/co-deck/docs/html-themes/styles/{white-bubble,classic}/style.css | none (template-only CSS; deck HTML links the template files) |
| T-005 | templates/co-deck/docs/html-themes/themes/zen/template.html | deck design_spec §2.8 extension stays deck-local (identity-in-bullets authoring unchanged) |

---

## 6. Platform impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | Template-side only; no skill text changes required except the optional theme-authoring note (§1.4). | as per §0 table |
| Antigravity / Codex / Hermes / other | Same — no GEMINI.md/CODEX.md/HERMES.md text restates these selectors or paths. | none |
| templates/common | **None — justified.** Every touched path is variant-specific (co-deck scripts and theme tree); none exists under templates/common, so no mirror refresh and no shadow-register entry. | N/A |

Cross-platform: the print-CSS additions are plain CSS injected via `page.addStyleTag`; the classList addition is DOM API — no shell, path-separator, or encoding assumptions. Windows font-path note: CSS `url()` uses forward slashes, unchanged.

**Accessibility statement**: print-rendering parity and asset-path fixes. The contactName line inherits the existing contrast-checked `.contact-item` styles; no new color or emphasis is introduced. No new UI surface. ADR-0065 review not triggered; existing contrast annotations carry over.

**Preview Verification statement**: verification is by the §1.3/§2.3/§3.3/§4.5 renders and grep assertions — built-deck fixtures through html-to-pdf. No workspace-UI preview applies.

## 7. Ticket claims checked

| Ticket | Claim | Finding |
|---|---|---|
| T-002 | print CSS lacks chrome hiding; TOC drawer = p1, notes panel = p49; 49 pages / 47 slides | **Confirmed with refinement** — a hide block EXISTS (:477-486) but its selectors are stale legacy vocabulary matching no current theme; the audited chrome set is `#toc-drawer`/`#toc-overlay`/`#script-panel`/`footer.ppt-footer` across all 6 themes (outlook lacks script-panel). §1.2 extends the existing block. |
| T-003 | inline `display:none` overridden by `.slide { display: flex !important }`; "Pages: 5" logged but 49 actual; latent since v1.2.0 | **Confirmed exactly** — inline style has no `!important` (:534); stylesheet wins (:289); v1.2.0 blob carried the flex rule (:223 of the oldest blob); the 49 = 47+2 arithmetic cross-checks with T-002. The `:561` "Pages" log is computed, not measured. |
| T-004 | white-bubble:208-209 references `presentations/assets/fonts`; sibling audit; 4 CSS 404s | **Confirmed, scope corrected** — classic/style.css:104-105 is the one additional affected stylesheet (2 files, 4 lines total, repo-wide audit clean otherwise). Fonts now provision to `deliverables/assets/fonts/` (download-font.ts:96); fix = repoint 4 URLs. |
| T-005 | zen gates bullets on email/linkedin/phone only, never renders contactName; PDF known list includes it (:1623) | **Confirmed exactly** — both sides as described; DEC-20261117-01 edge. Both remediation options designed; Option A recommended as O-5 default (§4.2-4.4). |

## 8. Owner decisions (open; defaults apply unless the owner objects)

- **O-5 (T-005)**: contactName parity direction. **Default: Option A** — zen renders contactName as the first plain `.contact-item`, gate includes contactName on both sides, no PDF change, DEC-20261117-01 fallback-only contract intact. Alternative: Option B (PDF drops contactName). Deferred third scope: primary-emphasis name in both outputs.

## 9. Rollout

Two sequential template-side PRs through `/sync` (one open root PR at a time), each ≤3 template files — deliberately below the >3-file high-risk flag (agents/architect.md); a single 4-file PR would have tripped it.

1. **PR-4 (renderer correctness, T-002 + T-003)**: `html-to-pdf.ts` @1.3.0 → 1.3.1 — extend the chrome-hide block with the audited selectors (§1.2); `cdk-page-hidden` class + high-specificity print exclusion (§2.2). Files: 1 + tests. Lands first: the T-005 verification render depends on truthful page counts.
2. **PR-5 (content parity, T-004 + T-005)**: `white-bubble/style.css` + `classic/style.css` (4 URL lines), `zen/template.html` (contactName line + gate widening per O-5 default). Files: 3. Includes the grep closure for `presentations/` and the optional one-line theme-authoring skill note (§1.4) if PM folds it in.

Lifecycle: VERSION_MANIFEST / script lifecycle records via the normal `/sync` step. Tickets: T-002/T-003 → resolved fixed on PR-4; T-004/T-005 → resolved fixed on PR-5 (T-005's result note cites DEC-20261117-01 as the recorded edge and O-5's resolution).

## 10. Acceptance criteria

- [ ] Full-deck html-to-pdf render of a zen deck: page count == slide count; first page is slide 1; last page is the last slide (no drawer/notes pages).
- [ ] (T-002 Addendum, DEC-20261117-04) Wrapper-flow reset present in the injected block (`.ppt-main, .presentation-container` display/overflow/height/flex/padding resets) and pinned by a minimal-fixture measured page count (e.g. 3-slide zen fixture == 3 pages via pdf-lib); legacy `<section>` fixture (Fixture C class) renders unchanged — the wrapper selectors are no-ops where the classes are absent.
- [ ] outlook and pitch fixture renders: page count == slide count (theme-safety pin).
- [ ] `--pages 5` on the 47-slide deck: exactly 5 pages, slides 1-5 in order, hidden slides carry `cdk-page-hidden`; `--pages` on a legacy section deck: exactly N pages.
- [ ] Full-deck render without `--pages` contains no `cdk-page-hidden` and is byte-shape unchanged except the chrome-hide CSS.
- [ ] `grep -r "presentations/" templates/co-deck/docs/html-themes/` → empty; white-bubble and classic renders resolve Pretendard when fonts are downloaded and degrade via swap when absent.
- [ ] (O-5 default) zen contact: contactName renders first as a plain `.contact-item`; HTML and PDF line sequences match for contactName-only, contactName+bullets, email-only, and bullets-only fixtures; S47 unchanged.
- [ ] validate-templates, verify-scripts, `bun test` (template tree), audit `--spec-check` green; no new variant-common-shadow instances.
