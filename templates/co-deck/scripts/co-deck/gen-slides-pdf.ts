// @version 1.17.0 — LOCAL-PATCH(U-20261119-010, design
//   2026-11-20-co-deck-pipeline-batch-2-design R1b): opt-in framed PDF↔HTML
//   parity for pitch-enhanced (+ premium-dark style) decks. HTML draws every
//   slide inside one rounded `.slide` frame on a darker page (two-column grid:
//   section eyebrow above a left-aligned title, `**bold**` accent bullet runs,
//   right panel with the image + its caption); the PDF drew a header bar, a
//   separate page-centered text card, a captionless full-height visual panel, a
//   decorative `”` punchline quote mark the HTML never renders, a contact slide
//   without its image, and footnotes in a band outside the frame. When the
//   theme's pdf_layout_spec.json declares the opt-in `frame` block (geometry in
//   HTML px of a `ref_w_px`-wide 1280×720 viewport, measured from a rendered
//   pitch-enhanced deck — shipped verbatim in the pitch-enhanced theme spec),
//   standard / title / divider / contact (with visualImage) slides route to
//   framed variants; punchline gains a tracked eyebrow, drops the `”` mark and
//   accents the first statement line; video slides center the play button on
//   the frame with a bottom-left caption chip; background images, video
//   thumbnails and cover backgrounds fill the FRAME instead of the page;
//   footnotes render inside the frame bottom-left; a post-pass mask paints
//   everything outside the rounded frame with frame.page_rgb so every layer is
//   clipped to the HTML `.slide`. Decks whose spec has NO `frame` key keep the
//   1.16.0 rendering byte-for-byte — the block is the compat gate (frame
//   geometry is renderer-generic; no other theme ships a frame block in this
//   batch). Reference: Projects/co-deck LOCAL-PATCH (Gate 5, 2026-11-19).
// @version 1.16.0 — LOCAL-PATCH(U-20261119-007, design
//   2026-11-20-co-deck-pipeline-batch-2-design R1a): premium-dark ink contrast +
//   two-column anchoring. ①bgDrawn ink contrast — the title-slide bubble
//   (drawBubbleBehind fills colors.C_CARD) drew its title/sub/meta in hardcoded
//   C_DARK/C_BODY tuned for the light bubble; on premium-dark C_CARD resolves to
//   dark navy [11,15,25] and C_DARK falls back to the same value (no `dark` key
//   in the spec), so the cover title rendered at 1:1 contrast — invisible. All
//   bgDrawn bubble/card ink sites now derive from the actual fill via the
//   existing readableTextOn/readableMutedOn(colors.C_CARD) helpers (divider-
//   branch pattern): title slide (title/sub/meta), punchline statement ink,
//   contact thanks + bullets-fallback primary line, profile name/bio
//   (defensively). ②two-column anchoring — on standard slides with a right
//   visual panel (hasRight), the hug content card was page-centered
//   (cardX = CX + (CW - cardW0)/2, cardW0 from titleW) while bullets anchored
//   at contentR.x + shiftX and the panel painted AFTER the text, covering the
//   card's right portion and clipping ink mid-glyph. hasRight decks now anchor
//   the card inside the text column [contentR.x, visR.x] (cardX = contentR.x,
//   cardW = colW) and wrap title/bullets to the card inner width
//   (colW - padX*2 / colW - padX*2 - 6 - px2mm(24)) so no line crosses visR.x;
//   single-column decks (!hasRight) keep the legacy widths and page-centering
//   byte-for-byte (identical geometry expressions, shiftX removed as an
//   identity). lib/pdf-font-patch.ts unaffected (byte-identical project copy).
// @version 1.15.0 — LOCAL-PATCH(U-20261116-008/-010/-011, design
//   2026-11-16-co-deck-pdf-html-backport-design PR-1): ①U-010 — the private
//   frontmatter/override parsers are REPLACED by the shared lib
//   (lib/layout-overrides.ts, the same parser estimate-layout's gate uses):
//   the private block parser's key regex could not match dotted keys
//   (`fonts.punchline_px: 32`) and silently dropped them, so a dotted override
//   passed the gate and never reached this renderer. flat + dotted + nested +
//   mixed forms all parse now; gate and renderer see the same merged spec.
//   ②U-008 item 2 / U-009 item 2 (owner decision O-2) — per-slide `notes`
//   (sources/caveats) render in the footnote band, sources first then the
//   `footnotes` abbreviations, one joined band through the v1.14.9 fit ladder
//   (zero new placement logic, zero drops). ③U-008 item 3 — punchline
//   statements split on `\n` into equal full-size bold sentence groups
//   (HTML inlineTitle renders `\n` as <br>; the PDF never split, gluing the
//   second sentence onto the first), and U+2060 WORD JOINER / U+FEFF are
//   stripped globally in strip() and from the punchline raw before the rich
//   splitter (joiners glued words into one atom that drew past the band —
//   S45). ④U-008 item 4 PDF side (owner decision O-1) — a contact slide with
//   no `contact*` fields falls back to `bullets` (max 5, first line bold in
//   the card ink mirroring HTML .contact-primary; contact*-first order keeps
//   existing decks unchanged). ⑤U-011 — new opt-in `fonts.punchline_sub_bold`
//   flips the punchline sub to bold in the statement ink (C_DARK on a drawn
//   background, mirroring HTML line-2); the absent key keeps today's regular
//   C_BODY output unchanged. zen's theme spec ships the matching defaults
//   (fonts.punchline_sub_px: 46 + the punch_text_px/punch_sub_px line-height
//   key rename — the legacy `line_heights.punchline_px` never reached
//   buildSizes, which reads punch_text_px).
//   ⑥Amendment A (DEC-20261116-05, design §7.2) — the punch tag is DECOUPLED
//   from punchline_sub_px (it borrowed the sub size, so zen's sub 46px would
//   have ballooned the legacy punchline tag to 34.5pt): new
//   `fonts.punch_tag_px` key with a 16.0 fallback (CSS px through calibration
//   — 12.0 would shrink the tag to 9pt deck-wide); layout_base.json pins
//   16.0, no zen entry (zen tag stays at its pre-PR-1 12pt).
// @version 1.14.9 — LOCAL-PATCH(pm-2026-11-15 footnote-scrim): photo-aware footnote
//   scrim + placement fit ladder. Audit of the 24 gloss slides / 37 glosses found
//   NO absent text, NO off-page text and NO card overlap — the reported
//   "약어 글상자가 사라진다" was CONTRAST: the bare C_MUTED grey gloss line
//   (~lum 115) sits directly on the photo backgrounds that v1.14.7 made render,
//   and every one of the 24 backdrops measured p90 luminance 52–130, so the
//   gloss read as gone. HTML parity is the deck injector's photo-aware footnote
//   scrim. ①when a background was drawn (ctx.bgDrawn), the band now gets a white
//   C_CARD scrim (rounded, 0.96, hug-width) and body-navy C_BODY ink — worst-case
//   ≈4.9:1 on pure black; decks without a drawn background keep the legacy grey.
//   ②placement is a first-fit ladder: (1a) below the card at the legacy anchor
//   (1-line bands land exactly where they always did), (1b) shrunk to the 11px
//   floor and re-wrapped, (1c) on the card's empty bottom padding (kept below the
//   card title area; scrim-over-card seam is white-on-white), (2) the top margin
//   above the card, (3) drop as the last resort ONLY — with a loud per-gloss
//   ⚠ log and an end-of-run summary (audited deck cannot reach it). Per-slide
//   placement lines are logged for verification (band rect + rung + scrim flag).
// @version 1.14.8 — LOCAL-PATCH(pm-2026-11-15 footnote-wrap; html-build finding, no
//   upstream ticket id yet): footnote band wrapping. The joined gloss list was
//   already wrapped by multiCell, but the band was anchored at a FIXED bottom
//   offset (CY+CH−18px) and grew DOWNWARD, so every line after the first landed
//   below the page edge and was clipped at export — S11 lost
//   "FY = Fiscal Year — 회사 회계연도", S48 lost "AP2 = Agent Payments Protocol
//   — …프로토콜" (2 of the deck's 37 glosses; the HTML deck shows both in full,
//   so the PDF was the outlier). The wrap count is now measured up front with
//   the same greedy discipline bullets use, the band is placed so it ENDS at the
//   legacy footer baseline and grows UPWARD, and it is card-aware: the white
//   card's own bottom (CARD_LOG rect) is the floor, so a 2-line band slides
//   under the card instead of painting through its bottom edge; the last line is
//   always clamped on-page and a cramped band is logged. No text is truncated.
// @version 1.14.7 — LOCAL-PATCH(U-20261114-011, PDF-side half of "chapter background
//   groups"): background resolution + divider paint order (PM-approved option A).
//   ①scope `all`/`divider-cover` per-slide precedence — a slide's OWN
//   slideData.backgroundImage / manifest binding now wins over the deck-wide
//   global backdrop; only slides with no binding fall back to the global pool
//   image. This is the model documented in lecture-profile.md + image-manifest
//   ("individual bindings win over the global") and what the per-chapter
//   CHAPTER_BG order depends on; previously scope `all` ignored slideBgEntries
//   entirely, so bgDrawn was false on every slide and the tooling silently
//   dropped the deck backdrop too (next item). ②global pool path dual-base
//   resolution — resolveImageCandidate() tries absolute → imgDir → workspaceRoot
//   for the global path as the individual branch always did; the global was
//   resolved against imgDir alone, so "deliverables/assets/images/bg-deck.jpg"
//   (workspace-relative) never resolved and no background was drawn deck-wide.
//   Both failures are now warned instead of silent. ③divider legacy paint order
//   — the divider's own full-bleed visual is drawn BEFORE the part/title/desc
//   text (was after), so a photo-less divider can no longer paint its own image
//   over its title card when the theme's `visual` region covers the page (zen:
//   0,0,100%,100%); this is the same "drawn background ⇒ title stays legible"
//   guarantee the title/punchline/contact/profile bgDrawn branches provide.
// @version 1.14.6 — LOCAL-PATCH(U-20261114-008/-009 pending promotion): profile-slide
//   background parity. renderProfileSlide now honours ctx.bgDrawn — when the
//   generic per-slide step already drew this slide's own background photo +
//   wash, the flat C_BG full-page repaint is SKIPPED (it erased the photo:
//   the same overpaint class as v1.12.0 divider / v1.12.1 contact / F4
//   punchline / R1 title), the white-bubble card is drawn behind the profile
//   block (drawBubbleBehind, C_CARD @0.97, 14px radius, before any text), and
//   the name renders in ink (C_DARK) with the bio in body ink (C_BODY) —
//   mirroring the HTML .slide-card/.slide-content profile branch and the
//   v1.14.0 contact treatment. Eyebrow and affiliation keep C_ACCENT (legible
//   on the white card). Decks WITHOUT a drawn per-slide background keep the
//   legacy flat-surface white-name/muted-bio path, unchanged.
//   Re-applied per design 2026-11-14-co-deck-tooling-hardening D5 (the
//   session-verified edit was absent from the tree at landing time).
// @version 1.14.5 — LOCAL-PATCH(U-20261105-005): punchline statement renders **keyword** bold-accent (HTML parity; T-20261110-007) via richRuns/richLines
// @version 1.14.4 — LOCAL-PATCH(U-20261105-005): ToUnicode CMap fix (one preferred code point per glyph; ':' '-' '+' '→' '–' no longer extract as CJK-compat chars)
// @version 1.14.3 — LOCAL-PATCH(U-20261105-005): rich bullets (**bold** = bold + accent, inline wrap), diagram caption/source in the card, generic contact* lines
// @version 1.14.2 — LOCAL-PATCH(U-20261105-005): zen/white-bubble standard + divider cards hug content like HTML (fit-content, max 88%, centered; bullets col 600px, visual 760px/216px)
// @version 1.14.1 — LOCAL-PATCH(U-20261105-005): subset font embed (fixes ':'/'-' gaps), 5% card page margin, centered card+title
// @version 1.14.0 — white bubble card behind COVER / PUNCHLINE / CONTACT text
//   (LOCAL-PATCH anchored U-20261105-005, user complaint: cover + last-slide
//   text sat directly on the photo). When ctx.bgDrawn, renderTitleSlide (no-image
//   column branch), renderPunchlineSlide and renderContactSlide now draw the
//   white-bubble card (colors.C_CARD @0.97, 14px radius — same as the divider
//   v1.12.0 card and HTML .slide-content) sized to the measured text block
//   BEFORE the ink text; legacy path unchanged without a drawn background.
//   Mirrors the HTML white-bubble style.css change (cover/punchline/contact
//   all render the card). New helpers: drawBubbleBehind(), widestWrappedLine().
//   v1.13.2 — C_BODY spec-key fallback in buildColors: accept
//   `text_body` (classic pdf_color_spec.json) alongside `body`, so the R1/F4/R2
//   ink-muted text actually resolves from the spec on wash backgrounds
//   (previously always the light [203,213,225] default). One-line fix.
//   v1.13.1 — R1/R2 contrast fixes (post-re-measure, same class as the
//   F4 ink branch): title slide NO-IMAGE branch and contact "감사합니다" hero
//   now render in ink (C_DARK; subtitle/meta → C_BODY) when ctx.bgDrawn —
//   white type sat at ≈1.08:1 on the warm-paper wash enabled by F2; legacy
//   colors unchanged without a drawn background. LOCAL-PATCH anchored
//   (U-20261105-002). S2 profile white-on-white is pre-existing, accepted.
//   v1.13.0 — zen visual fix (design 2026-11-05-codeck-pdf-engine-zen-visual-fix,
//   upstream tickets U-20261105-001/-002, LOCAL-PATCH anchored): ①F1 full-page-cover
//   guard — a visual region that CONTAINS the content region (zen: 0,0,100%,100%)
//   routes to the in-card path even when bgDrawn=false (extends the v1.11.0
//   bgDrawn-only condition), fixing negative bullet width and the C_VIS_BG
//   full-bleed overpaint on 22 slides; adds an in-card text-visual render for
//   visualTitle/visualDisplay-only slides (onCardText ink, parallel to the
//   diagram embed). ②F3 footnotes — per-slide source citations now render as a
//   bottom dim line (9pt, C_MUTED) for every slide type, drawn last.
//   ③F4 isPunchlineSlide acceptance (interface, divider-cover scope, type
//   dispatch) + punchline bgDrawn branch — skip the flat C_BG repaint and draw
//   the statement in ink when a background was drawn (mirror of the v1.12.1
//   contact pattern); legacy colors unchanged otherwise.
//   v1.12.1 — contact slide: when the per-slide loop already drew the
//   slide's own background photo + wash (ctx.bgDrawn), renderContactSlide no
//   longer repaints the flat C_BG surface that erased the photo (same overpaint
//   class as the v1.12.0 divider fix); decks without a background keep the fill.
//   v1.12.0 — divider-with-background HTML parity: dividers whose
//   background image was drawn (ctx.bgDrawn) now render inside the white-bubble
//   style's white rounded bubble card (C_CARD, rgba(255,255,255,0.97) + 14px
//   radius like HTML .slide-content) with a dark navy title (--divider-text
//   #1f2a44) — previously white title text sat directly on the photo. Dividers
//   WITHOUT a resolvable background keep the legacy white-text-on-photo path.
//   v1.11.0 — per-slide background-image layering fix for individual-scope
//   decks (2026-10-ai-era-business-majors Gate 5 round): ①Standard slides whose
//   visualImage duplicates their own background photo no longer repaint a
//   full-bleed C_VIS_BG panel + photo over the white C_CARD bubble/text (the
//   zen theme's "visual" region is the full page, so the repaint erased
//   everything drawn beneath it) — when the slide's own background was drawn,
//   a visual that IS the background is skipped entirely. ②Diagram slides
//   (visualImage ≠ backgroundImage) now embed the diagram INSIDE the white
//   card under the bullets (HTML zen layout); SVG-only diagrams are
//   rasterized on demand via @resvg/resvg-js (pdf-lib cannot embed SVG) and
//   a missing/unresolvable visual no longer paints a blank full-page panel.
//   ③Video slides (videoId) draw the slideData.videoThumbnail full-bleed
//   (HTML .cdk-video-thumb parity) before the play button, add a top-center
//   dark title pill (HTML video-slide chip) and extend the URI link
//   annotation to the whole slide (HTML .video-stage is inset:0).
//   v1.10.1 — doc comments codifying the HTML-local/PDF-YouTube video split
//   as a standing rule (docs/co-deck.context.md "Video Rules"); no behavior change.
//   v1.10.0: video play-button links, content card, divider/background-image fixes.
//   Video slides (slideData.videoId) now draw a clickable play-button (circle + triangle)
//   with a real PDF URI link annotation to the YouTube watch URL instead of a plain
//   "link: youtube.com/..." text bullet, and skip the title/bullets overlay entirely.
//   renderStandardSlide now draws the HTML deck's white-bubble content-card background
//   (new C_CARD color role, sourced from pdf_color_spec.json's card_dark) behind
//   title/bullets, with automatic light/dark text contrast (readableTextOn/readableMutedOn).
//   renderDividerSlide no longer re-fills the card over the already-drawn background photo
//   (which left near-invisible pale text on light styles) — uses the cover slide's fixed
//   white/muted text colors instead. resolveBgImagePath's individual-mode branch now
//   resolves paths against both the project dir and workspace root (previously assumed one
//   base and silently dropped the image on mismatch), and slideData.backgroundImage now
//   wins over image-manifest.json's slide_index map, which goes stale on deck reordering.
//   v1.9.0: CJK fallback font + contact slide LinkedIn fix.
//   When primary font (Pretendard/MaruBuri) lacks glyphs for CJK characters (e.g. 한자),
//   automatically falls back to NotoSansKR (system or project font). Fixes tofu/box
//   rendering on profile slides with 한자 bio text. Also fixed: renderContactSlide now
//   renders contactLinkedIn field from slidedata.json.
//   v1.8.0: Increased PDF body/bullet font sizes for readability. bullet_pt raised
//   from 11-13pt to 14-15pt across all themes; bullet_px/line_heights adjusted proportionally.
//   Auto-calibrate FONT_PT_MULT tuned from 0.85→0.94 to produce readable estimates.
//   v1.7.0: Background image support. When lecture-profile.md → background_image.enabled
//   is true, renders full-bleed background image (cover-crop) with semi-transparent overlay.
//   Supports scope: all | divider-cover | individual. Reads background image config from
//   lecture-profile.md frontmatter; resolves image path from image-manifest.json or slideData.
//   v1.6.0: OS-aware font search paths (Windows, macOS, Linux).
// Generate a slide deck PDF from slidedata.json using pdf-lib.
// Region-based layout model (ADR-0045 Decision #2): buildCoords() resolves
// `regions.*` uniformly for every theme; renderers iterate `slide_types[type].regions`.
// Merges gen_full.py + gen_sample5.py — use --sample N to limit slide count.
// Usage:
//   bun scripts/gen-slides-pdf.ts --project deliverables/<project> [--out name.pdf] [--sample 5]
//   bun scripts/gen-slides-pdf.ts --auto-calibrate --project deliverables/<project>
//   --auto-calibrate  estimate fonts/line_heights from CSS and print layout_overrides YAML (no PDF)
//   --project  project folder (relative to workspace root)
//   --out      output PDF filename (default: <folder>.pdf or <folder>_sample<N>.pdf)
//   --sample   limit to first N slides only (omit for full deck)
//   --font-dir directory containing font TTF files (default: deliverables/assets/fonts/)
//   --data     path to slidedata.json (default: <project>/slidedata.json)
// Requires: pdf-lib @pdf-lib/fontkit (bun install pdf-lib @pdf-lib/fontkit)

import CustomFontEmbedder from 'pdf-lib/cjs/core/embedders/CustomFontEmbedder';
import { createCmap as pdfLibCreateCmap } from 'pdf-lib/cjs/core/embedders/CMap';
import { PDFDocument, PDFFont, PDFPage, PDFString, rgb, RGB,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath } from 'pdf-lib';
import fontkit, { create as fontkitCreate } from '@pdf-lib/fontkit';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { platform, homedir } from 'os';
// v1.15.0 (U-20261116-010) — shared frontmatter/layout_overrides parser (the
// same module estimate-layout's gate imports). The private copies below it were
// deleted: the private block parser silently dropped DOTTED keys
// (`fonts.punchline_px: 32` — its key regex stopped at the `.`), so dotted
// overrides passed the lint gate but never reached this renderer. The shared
// lib accepts the union dialect (flat + dotted + nested + mixed), so gate and
// renderer always see the same merged spec.
import { deepMerge, parseFrontmatter, parseScalar } from './lib/layout-overrides';

// ── Constants ─────────────────────────────────────────────────────────────────

const MM_TO_PT = 2.835;
const mm = (v: number) => v * MM_TO_PT;

// Convert an [R, G, B] array (0-255) to a pdf-lib RGB value
const toRGB = (arr: number[]) => rgb(arr[0] / 255, arr[1] / 255, arr[2] / 255);

// Picks a readable text color for text drawn on top of `bg` (a pdf-lib RGB with
// 0..1 components): dark navy on a light card, white on a dark card. Avoids
// hardcoding per-style text colors for the content card, whose fill color
// (card_dark in pdf_color_spec.json) flips from white (white-bubble) to dark
// navy (classic) depending on style.
function readableTextOn(bg: RGB): RGB {
  const luma = 0.299 * bg.red + 0.587 * bg.green + 0.114 * bg.blue;
  return luma > 0.6 ? toRGB([31, 42, 68]) : rgb(1, 1, 1);
}
function readableMutedOn(bg: RGB): RGB {
  const luma = 0.299 * bg.red + 0.587 * bg.green + 0.114 * bg.blue;
  return luma > 0.6 ? toRGB([90, 99, 120]) : toRGB([203, 213, 225]);
}

// ── background_image block parser ─────────────────────────────────────────────
// v1.15.0 (U-20261116-010) — the frontmatter/layout_overrides parsing itself
// moved to the shared lib (see the import above): private parseFrontmatter /
// parseScalar / parseLayoutOverrides were deleted. `parseIndentedBlock` stays
// as a PRIVATE helper because it serves a different frontmatter section
// (`background_image:`, below) that the shared lib does not model; it now
// consumes the shared parseScalar so scalar semantics cannot diverge again.

function parseIndentedBlock(lines: string[], baseIndent: number): { value: Record<string, any>, consumed: number } {
  const result: Record<string, any> = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const indent = line.search(/\S/);
    if (indent < 0) { i++; continue; }  // blank line
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i++; continue; }  // unexpected deeper indent, skip

    const match = line.match(/^(\s*)([\w_-]+):\s*(.*)/);
    if (!match) { i++; continue; }

    const key = match[2];
    const rawVal = match[3].trim();

    if (!rawVal) {
      // Nested object — collect child lines
      const childLines = lines.slice(i + 1);
      const { value, consumed } = parseIndentedBlock(childLines, indent + 2);
      result[key] = value;
      i += 1 + consumed;
    } else {
      // Scalar value
      result[key] = parseScalar(rawVal);
      i++;
    }
  }

  return { value: result, consumed: i };
}

// ── Background image config parser ───────────────────────────────────────────
// Reads the background_image: section from lecture-profile.md frontmatter.
// Returns null when background_image is not configured or disabled.

interface BgImageConfig {
  enabled: boolean;
  scope: 'all' | 'divider-cover' | 'individual';
  source: string;
  overlay: { color: number[]; opacity: number };
  keywords: string[];
  fallback_color: number[] | null;
}

function parseBackgroundImage(frontmatter: string): BgImageConfig | null {
  const lines = frontmatter.split('\n');
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === 'background_image:' && !lines[i].trimStart().startsWith('#')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return null;

  const block: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (line.length > 0 && line[0] !== ' ') break;
    block.push(line);
  }
  if (block.length === 0) return null;

  const minIndent = block.reduce((min, l) => {
    const ind = l.search(/\S/);
    return ind >= 0 ? Math.min(min, ind) : min;
  }, Infinity);
  const parsed = parseIndentedBlock(block, minIndent === Infinity ? 0 : minIndent).value as Record<string, any>;

  const enabled = parsed.enabled === true;
  if (!enabled) return null;

  return {
    enabled: true,
    scope: parsed.scope ?? 'divider-cover',
    source: parsed.source ?? 'download',
    overlay: {
      color: parsed.overlay?.color ?? [0, 0, 0],
      opacity: parsed.overlay?.opacity ?? 0.4,
    },
    keywords: parsed.keywords ?? [],
    fallback_color: parsed.fallback_color ?? null,
  };
}

// Try one background-image reference against every base we support.
// Entries come from two sources with different base dirs: image-manifest.json
// paths are repo-root-relative pool paths ("deliverables/assets/..."), while the
// slideData.json backgroundImage fallback is HTML/imgDir-relative
// ("../assets/images/..."). Try both bases (plus already-absolute) rather than
// assuming one — guessing wrong silently drops the image (ENOENT inside
// embedImg's own try/catch), leaving a flat color behind the play button with
// no visible error.
// LOCAL-PATCH(upstream-request: U-20261114-011) v1.14.7 — this was individual-only
// behaviour; the global pool path was resolved against imgDir alone, so a
// registered deck backdrop ("deliverables/assets/images/bg-deck.jpg") silently
// never drew on any slide (bgDrawn stayed false deck-wide).
function resolveImageCandidate(raw: string, imgDir: string, workspaceRoot: string): string | null {
  if (!raw) return null;
  if (existsSync(raw)) return raw;
  const viaImgDir = resolve(imgDir, raw);
  if (existsSync(viaImgDir)) return viaImgDir;
  const viaWorkspace = resolve(workspaceRoot, raw);
  if (existsSync(viaWorkspace)) return viaWorkspace;
  return null;
}

// Resolve the background image file path for a given slide.
// Returns null if the slide should not have a background image or the file doesn't exist.
function resolveBgImagePath(
  data: SlideData,
  slideIdx: number,
  bgConfig: BgImageConfig,
  imgDir: string,
  globalBgPath: string | null,
  slideBgEntries: Map<number, string>,
  workspaceRoot: string,
): string | null {
  if (!bgConfig.enabled) return null;

  if (bgConfig.scope === 'divider-cover') {
    // LOCAL-PATCH(upstream-request: U-20261105-002) F4 — accept both
    // isPunchline and isPunchlineSlide spellings.
    // Only title, divider, punchline slides
    if (!data.isTitleSlide && !data.isDividerSlide && !(data.isPunchline || data.isPunchlineSlide)) return null;
  }

  // LOCAL-PATCH(upstream-request: U-20261114-011) v1.14.7 — per-slide precedence.
  // A slide's OWN binding (slideData.backgroundImage / its manifest entry) wins
  // over the deck-wide global backdrop for EVERY scope, not just `individual`:
  // the deck model documented in lecture-profile.md and image-manifest.json is
  // "individual bindings win over the global", and the per-chapter background
  // order (CHAPTER_BG in the deck generator) depends on it. Before this, scope
  // `all` ignored slideBgEntries entirely, so a global backdrop repainted every
  // slide and the per-slide chapter photos were unreachable. Slides with no
  // binding fall through to the global pool image below.
  const own = slideBgEntries.get(slideIdx);
  if (own) {
    const resolvedOwn = resolveImageCandidate(own, imgDir, workspaceRoot);
    if (resolvedOwn) return resolvedOwn;
    // Individual scope used to drop unresolvable entries silently; keep the
    // fall-through for `all`/`divider-cover` (global backdrop) but say so.
    if (bgConfig.scope !== 'individual') {
      console.warn(`  bg own binding unresolvable (slide ${slideIdx + 1}): ${own} — falling back to the global backdrop`);
    }
  }

  if (bgConfig.scope === 'individual') return null;   // only explicit per-slide entries
  if (!globalBgPath) return null;

  const resolvedGlobal = resolveImageCandidate(globalBgPath, imgDir, workspaceRoot);
  if (!resolvedGlobal) {
    console.warn(`  bg global backdrop unresolvable: ${globalBgPath} — no background drawn (check the pool path base)`);
  }
  return resolvedGlobal;
}

// ── Slide renderer ────────────────────────────────────────────────────────────

class Renderer {
  private page!: PDFPage;
  private regular: PDFFont;
  private bold: PDFFont;
  /** CJK fallback font for glyphs missing in primary font (e.g. 한자 in Pretendard). */
  private fallbackRegular: PDFFont | null = null;
  private fallbackBold: PDFFont | null = null;
  /**
   * Set of Unicode code points known to be MISSING in the primary font.
   * Built from fontkit's hasGlyphForCodePoint at font load time.
   * Used at render time to switch to fallback font for these code points.
   */
  private missingCps: Set<number> = new Set();
  private curFont: PDFFont;
  private curSize = 12;
  private curColor: RGB;
  readonly pageW: number;   // pts
  readonly pageH: number;   // pts

  constructor(regular: PDFFont, bold: PDFFont, pageWMm: number, pageHMm: number, defaultColor: RGB,
              fallbackRegular?: PDFFont | null, fallbackBold?: PDFFont | null,
              missingCps?: Set<number>) {
    this.regular         = regular;
    this.bold            = bold;
    this.fallbackRegular = fallbackRegular ?? null;
    this.fallbackBold    = fallbackBold ?? null;
    this.missingCps      = missingCps ?? new Set();
    this.curFont         = regular;
    this.curColor        = defaultColor;
    this.pageW           = mm(pageWMm);
    this.pageH           = mm(pageHMm);
  }

  setPage(p: PDFPage) { this.page = p; }

  // Convert mm (fpdf2-style top-left origin) → pts bottom-left (pdf-lib)
  private pt(v: number) { return mm(v); }
  private fy(yMm: number) { return this.pageH - mm(yMm); }  // flip Y: top → bottom

  /**
   * Check if the given code point is missing from the primary font
   * (and thus should use the fallback font).
   */
  private needsFallback(cp: number): boolean {
    return this.missingCps.has(cp);
  }

  /**
   * Get the effective font for a code point: primary if it has the glyph,
   * otherwise the fallback font (or primary if no fallback available).
   */
  private effectiveFontForCp(cp: number): PDFFont {
    if (!this.needsFallback(cp)) return this.curFont;
    const fb = this.curFont === this.bold ? this.fallbackBold : this.fallbackRegular;
    return fb ?? this.curFont;
  }

  /**
   * Split a string into mono-font runs where each run uses a single PDFFont.
   * Consecutive characters sharing the same effective font are grouped together.
   */
  private buildFontRuns(text: string): Array<{ text: string; font: PDFFont }> {
    // Fast path: no fallback font or no missing code points in text
    if (!this.fallbackRegular) return [{ text, font: this.curFont }];
    let anyMissing = false;
    for (const ch of text) {
      if (this.missingCps.has(ch.codePointAt(0)!)) { anyMissing = true; break; }
    }
    if (!anyMissing) return [{ text, font: this.curFont }];

    const runs: Array<{ text: string; font: PDFFont }> = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const font = this.effectiveFontForCp(cp);
      if (runs.length > 0 && runs[runs.length - 1].font === font) {
        runs[runs.length - 1].text += ch;
      } else {
        runs.push({ text: ch, font });
      }
    }
    return runs;
  }

  setFont(bold: boolean, sizePt: number) {
    this.curFont = bold ? this.bold : this.regular;
    this.curSize = sizePt;
  }
  setColor(c: RGB) { this.curColor = c; }

  fillRect(xMm: number, yMm: number, wMm: number, hMm: number, color: RGB) {
    this.page.drawRectangle({
      x: this.pt(xMm),
      y: this.fy(yMm + hMm),   // bottom-left y
      width:  this.pt(wMm),
      height: this.pt(hMm),
      color,
    });
  }

  // Fill a rectangle with semi-transparent overlay for background image readability.
  // Uses pdf-lib page opacity to achieve the transparency effect.
  fillRectOverlay(xMm: number, yMm: number, wMm: number, hMm: number, color: RGB, opacity: number) {
    const prevOpacity = (this.page as any).opacity ?? 1;
    this.page.drawRectangle({
      x: this.pt(xMm),
      y: this.fy(yMm + hMm),
      width:  this.pt(wMm),
      height: this.pt(hMm),
      color,
      opacity,
    });
  }

  // Draw a single line of text. yMm is the top of the line (fpdf2 style).
  // We approximate the baseline as yMm + cellH * 0.72 (empirical for typical fonts).
  // Supports CJK fallback: splits text into mono-font runs for characters that
  // the primary font cannot render (e.g. 한자 in Pretendard).
  private drawLine(text: string, xMm: number, yMm: number, cellH: number) {
    const baselineY = this.fy(yMm + cellH * 0.72);
    const runs = this.buildFontRuns(text);
    let curX = xMm;
    for (const run of runs) {
      this.page.drawText(run.text, {
        x: this.pt(curX),
        y: baselineY,
        size:  this.curSize,
        font:  run.font,
        color: this.curColor,
      });
      curX += run.font.widthOfTextAtSize(run.text, this.curSize) / MM_TO_PT;
    }
  }

  // Single-line cell (no wrapping)
  cell(wMm: number, hMm: number, text: string, xMm: number, yMm: number, align: 'L' | 'R' | 'C' = 'L') {
    if (!text) return;
    let drawX = xMm;
    if (align !== 'L') {
      const tw = this.stringWidth(text);
      drawX = align === 'C' ? xMm + (wMm - tw) / 2 : xMm + wMm - tw;
    }
    this.drawLine(text, drawX, yMm, hMm);
  }

  // Multi-line cell — returns Y position after last line (mm from top).
  // Empty lines (from consecutive \n) consume a full hMm row as blank spacing.
  multiCell(wMm: number, hMm: number, text: string, xMm: number, yMm: number, align: 'L' | 'R' | 'C' = 'L'): number {
    const lines = this.wrapText(text, wMm);
    let y = yMm;
    for (const line of lines) {
      if (line) {
        this.cell(wMm, hMm, line, xMm, y, align);
      }
      y += hMm;
    }
    return y;
  }

  // Returns text width in mm (accounts for CJK fallback font width differences)
  stringWidth(text: string): number {
    const runs = this.buildFontRuns(text);
    let total = 0;
    for (const run of runs) {
      total += run.font.widthOfTextAtSize(run.text, this.curSize);
    }
    return total / MM_TO_PT;
  }

  wrapText(text: string, maxWidthMm: number): string[] {
    const lines: string[] = [];
    for (const segment of text.split('\n')) {
      const words = segment.split(' ');
      let line = '';
      let lineW = 0;

      for (let i = 0; i < words.length; i++) {
        const word   = words[i];
        const suffix = i < words.length - 1 ? ' ' : '';
        const ww     = this.stringWidth(word + suffix);

        if (lineW > 0 && lineW + ww > maxWidthMm) {
          lines.push(line.trimEnd());
          line  = word + suffix;
          lineW = this.stringWidth(word + suffix);
        } else {
          line  += word + suffix;
          lineW += ww;
        }
      }
      // Preserve empty lines as empty strings so multiCell renders blank spacing.
      lines.push(line.trimEnd());
    }
    return lines;
  }

  // Estimate total rendered height of a bullet list in mm
  estimateBulletHeight(bullets: string[], widthMm: number, tBul: number, lhBul: number, bulGap: number): number {
    this.setFont(false, tBul);
    let total = 0;
    let nValid = 0;
    for (const b of bullets) {
      const t = strip(b);
      if (!t) continue;
      nValid++;
      total += this.wrapText(t, widthMm).length * lhBul + bulGap;
    }
    if (nValid > 0) total -= bulGap;
    return total;
  }

  estimateTextHeight(text: string, widthMm: number, sizePt: number, lhMm: number, bold = false): number {
    this.setFont(bold, sizePt);
    return this.wrapText(text, widthMm).length * lhMm;
  }

  drawHLine(x1Mm: number, y1Mm: number, x2Mm: number, widthMm: number, color: RGB) {
    this.page.drawLine({
      start: { x: this.pt(x1Mm), y: this.fy(y1Mm) },
      end:   { x: this.pt(x2Mm), y: this.fy(y1Mm) },
      color,
      thickness: this.pt(widthMm),
    });
  }

  drawEllipse(xMm: number, yMm: number, diamMm: number, color: RGB) {
    // fpdf2 ellipse(x, y, w, h): x,y = top-left of bounding box, w,h = diameter
    const cx = this.pt(xMm + diamMm / 2);
    const cy = this.fy(yMm + diamMm / 2);
    this.page.drawEllipse({ x: cx, y: cy, xScale: this.pt(diamMm / 2), yScale: this.pt(diamMm / 2), color });
  }

  /**
   * Draws a circular "play" button (dark disc + white triangle), centered at
   * (cxMm, cyMm), matching the HTML deck's .yt-play-btn look. PDF viewers
   * don't support live embedded video, so this is the practical substitute:
   * a visible button a reader taps, paired with addLinkAnnotation() to make
   * that exact spot open the YouTube video.
   */
  drawPlayButton(cxMm: number, cyMm: number, diamMm: number) {
    const cx = this.pt(cxMm);
    const cy = this.fy(cyMm);
    const r  = this.pt(diamMm) / 2;
    this.page.drawEllipse({
      x: cx, y: cy, xScale: r, yScale: r,
      color: rgb(11 / 255, 15 / 255, 25 / 255), opacity: 0.68,
      borderColor: rgb(1, 1, 1), borderOpacity: 0.9, borderWidth: this.pt(diamMm) * 0.012,
    });
    const triR = r * 0.42;
    const path = `M ${-triR * 0.6},${-triR} L ${-triR * 0.6},${triR} L ${triR},0 Z`;
    this.page.drawSvgPath(path, { x: cx, y: cy, color: rgb(1, 1, 1) });
  }

  /**
   * Attaches a clickable URI link annotation over a rectangular area
   * (mm, same top-left coordinate space as fillRect/cell).
   */
  addLinkAnnotation(doc: PDFDocument, xMm: number, yMm: number, wMm: number, hMm: number, url: string) {
    const x1 = this.pt(xMm);
    const y2 = this.fy(yMm);
    const x2 = this.pt(xMm + wMm);
    const y1 = this.fy(yMm + hMm);
    const annotDict = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x1, y1, x2, y2],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    const annotRef = doc.context.register(annotDict);
    this.page.node.addAnnot(annotRef);
  }

  /**
   * Detect actual image format from magic bytes, falling back to extension.
   * Prevents "SOI not found in JPEG" errors when a PNG is saved with .jpg extension.
   */
  private detectImageFormat(data: Buffer): 'png' | 'jpeg' {
    // PNG magic: 89 50 4E 47
    if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return 'png';
    }
    // JPEG magic: FF D8 FF
    if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return 'jpeg';
    }
    return 'jpeg'; // fallback default
  }

  async embedImg(doc: PDFDocument, img: string | Buffer) {
    const data = typeof img === 'string' ? readFileSync(img) : img;
    const format = this.detectImageFormat(data);
    return format === 'png' ? await doc.embedPng(data) : await doc.embedJpg(data);
  }

  drawEmbeddedImage(img: any, xMm: number, yMm: number, wMm: number, hMm: number) {
    this.page.drawImage(img, {
      x: this.pt(xMm), y: this.fy(yMm + hMm),
      width: this.pt(wMm), height: this.pt(hMm),
    });
  }

  /**
   * Filled rounded rectangle (mm, top-left origin) drawn as an SVG path —
   * pdf-lib's drawRectangle has no corner radius. Used for the video slide's
   * HTML-parity title pill (.video-slide title chip).
   */
  drawRoundedRect(xMm: number, yMm: number, wMm: number, hMm: number, rMm: number,
                  color: RGB, opacity = 1) {
    const w = this.pt(wMm), h = this.pt(hMm), rr = Math.min(this.pt(rMm), w / 2, h / 2);
    const k = 0.5523;  // circle-to-bezier control-point constant
    const path =
      `M ${rr},0 H ${w - rr}` +
      ` C ${w - rr + k * rr},0 ${w},${rr - k * rr} ${w},${rr}` +
      ` V ${h - rr}` +
      ` C ${w},${h - rr + k * rr} ${w - rr + k * rr},${h} ${w - rr},${h}` +
      ` H ${rr}` +
      ` C ${rr - k * rr},${h} 0,${h - rr + k * rr} 0,${h - rr}` +
      ` V ${rr}` +
      ` C 0,${rr - k * rr} ${rr - k * rr},0 ${rr},0 Z`;
    this.page.drawSvgPath(path, {
      // drawSvgPath translate point is the path's BOTTOM edge in PDF space —
      // it scales (1,-1), so local SVG +y extends UPWARD from it. fy(yMm) is
      // the PDF y of the rect's bottom edge.
      x: this.pt(xMm), y: this.fy(yMm),
      color, opacity, borderColor: color, borderWidth: 0,
    });
  }

  // LOCAL-PATCH(upstream-request: U-20261119-010) — framed-layout helpers.
  // Draw an SVG path (pt units, y-down) anchored at the mm top-left point.
  drawPathAt(path: string, xMm: number, yMm: number, color: RGB, opacity = 1) {
    this.page.drawSvgPath(path, { x: this.pt(xMm), y: this.fy(yMm), color, opacity, borderWidth: 0 });
  }
  // Small right-pointing triangle bullet marker (HTML `▸`), centred on (cx, cy).
  drawTriangle(cxMm: number, cyMm: number, sizeMm: number, color: RGB) {
    const s = this.pt(sizeMm);
    this.drawPathAt(`M 0 0 L ${s} ${s / 2} L 0 ${s} Z`, cxMm - sizeMm / 2, cyMm - sizeMm / 2, color);
  }
  // Paint everything OUTSIDE a rounded frame with `color` (post-pass mask), so
  // full-bleed layers drawn earlier end up clipped to the HTML `.slide` frame.
  maskOutsideFrame(xMm: number, yMm: number, wMm: number, hMm: number, rMm: number, color: RGB) {
    this.fillRect(0, 0, this.pageW / MM_TO_PT, yMm, color);
    this.fillRect(0, yMm + hMm, this.pageW / MM_TO_PT, this.pageH / MM_TO_PT - yMm - hMm, color);
    this.fillRect(0, yMm, xMm, hMm, color);
    this.fillRect(xMm + wMm, yMm, this.pageW / MM_TO_PT - xMm - wMm, hMm, color);
    const W = this.pt(wMm), H = this.pt(hMm), R = this.pt(rMm);
    const corners = [
      `M 0 0 L ${R} 0 A ${R} ${R} 0 0 0 0 ${R} Z`,
      `M ${W} 0 L ${W} ${R} A ${R} ${R} 0 0 0 ${W - R} 0 Z`,
      `M ${W} ${H} L ${W - R} ${H} A ${R} ${R} 0 0 0 ${W} ${H - R} Z`,
      `M 0 ${H} L 0 ${H - R} A ${R} ${R} 0 0 0 ${R} ${H} Z`,
    ];
    for (const c of corners) this.drawPathAt(c, xMm, yMm, color);
  }

  async placeImageCover(doc: PDFDocument, img: string | Buffer, xMm: number, yMm: number, wMm: number, hMm: number) {
    try {
      const embedded = await this.embedImg(doc, img);
      const { width: ow, height: oh } = embedded;
      const imgAsp = ow / oh;
      const boxAsp = wMm / hMm;
      let iw: number, ih: number;
      if (imgAsp > boxAsp) { ih = hMm; iw = ih * imgAsp; }
      else                 { iw = wMm; ih = iw / imgAsp; }
      const ix = xMm + (wMm - iw) / 2;
      const iy = yMm + (hMm - ih) / 2;
      const cx = this.pt(xMm), cy = this.fy(yMm + hMm);
      const cw = this.pt(wMm), ch = this.pt(hMm);
      this.page.pushOperators(
        pushGraphicsState(),
        moveTo(cx, cy), lineTo(cx + cw, cy), lineTo(cx + cw, cy + ch), lineTo(cx, cy + ch),
        closePath(), clip(), endPath(),
      );
      this.drawEmbeddedImage(embedded, ix, iy, iw, ih);
      this.page.pushOperators(popGraphicsState());
    } catch (e: any) {
      console.warn(`  img err: ${e.message}`);
    }
  }

  async placeImage(doc: PDFDocument, img: string | Buffer, xMm: number, yMm: number, mwMm: number, mhMm: number) {
    try {
      const embedded  = await this.embedImg(doc, img);
      const { width: ow, height: oh } = embedded;
      const asp = oh / ow;
      let iw = mwMm, ih = iw * asp;
      if (ih > mhMm) { ih = mhMm; iw = ih / asp; }
      const ix = xMm + (mwMm - iw) / 2;
      const iy = yMm + (mhMm - ih) / 2;
      this.drawEmbeddedImage(embedded, ix, iy, iw, ih);
    } catch (e: any) {
      console.warn(`  img err: ${e.message}`);
    }
  }
}

// ── Text utilities ────────────────────────────────────────────────────────────

function strip(s: string | undefined | null): string {
  // v1.15.0 (U-20261116-008 item 3) — U+2060 WORD JOINER / U+FEFF are pure
  // glue: browsers never render them (HTML decks are unaffected), but the PDF
  // treats them as word characters — they glued words into one giant atom the
  // line wrappers cannot break, which then drew past the band (S45). Strip
  // globally so titles/bullets/footnotes are fixed in one place.
  return (s ?? '').replace(/<[^>]+>/g, '').replace(/\*\*/g, '').replace(/[\u2060\uFEFF]/g, '');
}

function imgPath(src: string | undefined, imgDir: string): string | null {
  if (!src) return null;
  // src is relative to the project dir; visualImage may reference .svg (HTML primary delivery format).
  // PDF pipeline only embeds .png/.jpg — auto-derive PNG path when src is SVG.
  const resolved = src.endsWith('.svg') ? src.replace(/\.svg$/, '.png') : src;
  const p = join(imgDir, resolved);
  return existsSync(p) ? p : null;
}

// ── SVG rasterization (v1.11.0) ───────────────────────────────────────────────
// pdf-lib cannot embed SVG, but decks increasingly author diagram visuals as
// SVG-only (the diagram pipeline's primary delivery format) with no committed
// .png sibling — imgPath() then resolved to null and the slide's visual branch
// painted a blank full-page panel instead. Rasterize on demand with
// @resvg/resvg-js (the same engine scripts/co-deck/diagram-helpers.ts uses).

// Korean text inside diagram SVGs needs a font with Hangul glyphs — prefer the
// deck's own font dir, then the usual system CJK candidates (mirrors
// diagram-helpers.ts systemFontCandidates, plus the deck font dir first).
function findSvgFontFile(fontDir: string): string | null {
  const candidates = [
    join(fontDir, 'Pretendard-Regular.ttf'),
    join(fontDir, 'NotoSansKR-Regular.ttf'),
    join(fontDir, 'MaruBuri-Regular.ttf'),
    join(homedir(), 'Library/Fonts/Pretendard-Regular.ttf'),
    '/Library/Fonts/Pretendard-Regular.ttf',
    '/Library/Fonts/AppleSDGothicNeo-Regular.otf',
    '/System/Library/Fonts/PingFang.ttc',
    join(homedir(), '.local/share/fonts/NotoSansCJK-Regular.ttc'),
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  ];
  return candidates.find(existsSync) ?? null;
}

// resvg does not resolve CSS var() expressions — an unresolvable var() makes
// the declaration invalid and the SVG falls back to its DEFAULT fill (black),
// so a diagram authored `style="fill:var(--card-bg,#ffffff)"` (white boxes in
// the HTML deck, where the deck CSS defines the variables) rasterizes as
// solid black boxes. Substitute each var() with its declared fallback before
// rasterizing; every pool diagram declares hex fallbacks for exactly this
// standalone-consumption case.
function substituteSvgVars(svg: string): string {
  return svg.replace(/var\(--[\w-]+\s*,\s*([^)]+)\)/g, '$1');
}

function rasterizeSvg(svgPath: string, fontDir: string): Buffer {
  const svg = substituteSvgVars(readFileSync(svgPath, 'utf-8'));
  // Render at 2x the authored width for print-sharp output (SVGs are embedded
  // at up to ~200mm; original-size rendering reads soft in print).
  const widthMatch = svg.match(/<svg[^>]*\swidth="([\d.]+)/);
  const opts: Record<string, any> = widthMatch
    ? { fitTo: { mode: 'width', value: Math.round(parseFloat(widthMatch[1]) * 2) } }
    : { fitTo: { mode: 'original' } };
  const fontFile = findSvgFontFile(fontDir);
  if (fontFile) opts.font = { fontFiles: [fontFile], loadSystemFonts: false };
  return Buffer.from(new Resvg(svg, opts).render().asPng());
}

// Resolve a visual/src to embeddable raster input: PNG/JPG path as-is; SVG via
// its committed .png sibling when one exists, else on-demand rasterization.
// Returns null when nothing resolvable exists — callers must NOT paint a
// placeholder panel over a background-image slide in that case (that was the
// blank-navy defect on diagram slides).
function resolveVisualRaster(src: string | undefined, imgDir: string, fontDir: string): string | Buffer | null {
  if (!src) return null;
  const resolved = join(imgDir, src);
  if (!src.endsWith('.svg')) return existsSync(resolved) ? resolved : null;
  const pngSibling = resolved.replace(/\.svg$/, '.png');
  if (existsSync(pngSibling)) return pngSibling;
  if (!existsSync(resolved)) return null;
  try {
    return rasterizeSvg(resolved, fontDir);
  } catch (e: any) {
    console.warn(`  svg rasterize err (${src}): ${e.message}`);
    return null;
  }
}

// ── Slide data type ───────────────────────────────────────────────────────────

interface SlideData {
  section?:       string;
  title?:         string;
  subtitle?:      string;
  text?:          string;   // punchline main statement (HTML .punch-text)
  sub?:           string;   // punchline support line (HTML .punch-sub)
  meta?:          string;
  desc?:          string;
  partNum?:       string;
  bullets?:       string[];
  visual?:        string;
  visualImage?:   string;
  backgroundImage?: string;   // relative path to full-bleed background image (from html-build)
  videoId?:       string;   // YouTube video ID. HTML plays a local assets/videos/yt-<id>.mp4
                             // if present; the PDF never plays video — always a play-button
                             // link annotation to youtube.com/watch?v=<id> (docs/co-deck.context.md "Video Rules").
  visualTitle?:   string;
  visualDisplay?: string;
  visualCaption?: string;
  visualSource?: string;
  [k: `contact${string}`]: string | undefined;
  isTitleSlide?:  boolean;
  isDividerSlide?: boolean;
  isPunchline?:   boolean;
  // LOCAL-PATCH(upstream-request: U-20261105-002) F4 — the slidedata producer
  // emits isPunchlineSlide (HTML isPunchlineSlide flag); accept both spellings.
  isPunchlineSlide?: boolean;
  // LOCAL-PATCH(upstream-request: U-20261105-002) F3 — per-slide source
  // citations (design_spec §3 source line); previously never rendered.
  footnotes?:     string[];
  // v1.15.0 (U-20261116-008 item 2 / U-20261116-009 item 2) — per-slide
  // source/caveat lines. Authoring contract (formalized in PR-3):
  // `notes` = sources/caveats, `footnotes` = abbreviation definitions. The
  // footnote band merges both (sources first) through the existing fit ladder.
  notes?:         string[];
  isProfileSlide?: boolean;
  speakerName?:   string;
  speakerTitle?:  string;
  speakerBio?:    string;
  photoPath?:     string;
  isContactSlide?: boolean;
  contactName?:      string;
  contactEmail?:     string;
  contactLinkedIn?:  string;
  contactPhone?:     string;
  contactNote?:      string;
}

// ── Region-based layout spec type (ADR-0045 Decision #2) ──────────────────────

interface Region {
  x_pct: number;
  y_pct: number;
  w_pct: number;
  h_pct: number;
  fit?:  'contain' | 'cover';
}

interface LayoutSpec {
  version?:     string;
  /** LOCAL-PATCH(upstream-request: U-20261119-010) — optional HTML `.slide`
   *  rounded-frame layout (pitch-enhanced). Geometry in HTML px of a
   *  `ref_px`-wide (default 1280×720) viewport. */
  frame?: FrameSpec;
  page?: {
    width_mm?:  number;
    height_mm?: number;
    margin_mm?: number;
    aspect_ratio?: string;
  };
  calibration?: {
    viewport_px?: number | null;
    font_px_to_pt?: number;
  };
  regions?: Record<string, Region | null>;
  slide_types?: Record<string, {
    regions?: string[];
  }>;
  slide_type_overrides?: Record<string, Record<string, Region | null>>;
  // Font sizes in CSS px (v2.0). Legacy _pt keys are auto-converted.
  fonts?: {
    // CSS px keys (preferred)
    section_px?:       number;
    slide_num_px?:     number;
    title_px?:         number;
    bullet_px?:        number;
    punchline_px?:     number;
    punchline_sub_px?: number;
    // v1.15.0 (U-20261116-011) — opt-in punchline sub weight/ink parity with
    // the deck-patched HTML (bold + statement ink). Absent key = regular
    // C_BODY, byte-shape identical to pre-1.15.0 output.
    punchline_sub_bold?: boolean;
    // Amendment A (DEC-20261116-05) — the punch tag no longer borrows
    // punchline_sub_px; it has its own size key.
    punch_tag_px?:     number;
    vis_title_px?:     number;
    vis_body_px?:      number;
    ts_eyebrow_px?:    number;
    ts_title_px?:      number;
    ts_subtitle_px?:   number;
    ts_meta_px?:       number;
    div_part_px?:      number;
    div_title_px?:     number;
    div_desc_px?:      number;
    // Legacy pt keys (auto-converted via buildSizes)
    title_pt?:         number;
    bullet_pt?:        number;
    punchline_pt?:     number;
    punchline_sub_pt?: number;
    div_title_pt?:     number;
    div_desc_pt?:      number;
  };
  // Line heights in CSS px (v2.0). One cssPx value = font-size × line-height-ratio.
  line_heights?: {
    title_px?:         number;
    bullet_px?:        number;
    bullet_gap_px?:    number;
    punchline_px?:     number;
    div_title_px?:     number;
    div_desc_px?:      number;
    vis_title_px?:     number;
    vis_body_px?:      number;
    ts_eyebrow_px?:    number;
    ts_title_px?:      number;
    ts_subtitle_px?:   number;
    ts_meta_px?:       number;
    div_part_px?:      number;
    punch_tag_px?:     number;
    punch_mark_px?:    number;
    punch_text_px?:    number;
    punch_sub_px?:     number;
    prof_eyebrow_px?:  number;
    prof_name_px?:     number;
    prof_affil_px?:    number;
    prof_bio_px?:      number;
    cont_thanks_px?:   number;
    cont_line_px?:     number;
    cont_note_px?:     number;
  };
  // Gaps between elements in CSS px.
  gaps_px?: {
    ts_eye_ttl_px?:      number;
    ts_ttl_sub_px?:      number;
    ts_sub_meta_px?:     number;
    div_part_title_px?:  number;
    div_title_desc_px?:  number;
    punch_tag_mark_px?:  number;
    punch_mark_text_px?: number;
    punch_text_sub_px?:  number;
    prof_eyebrow_name_px?: number;
    prof_name_affil_px?:  number;
    prof_affil_bio_px?:   number;
    cont_thanks_line_px?: number;
    cont_line_note_px?:   number;
  };
  content_constraints?: Record<string, any>;
  print?: Record<string, any>;
  image_zones?: Record<string, any>;
  toc?: any;
  colors?: Record<string, number[]>;
  visual_inner_padding_px?: number;
}

// A region resolved to absolute mm coordinates relative to the page top-left.
interface ResolvedRegion {
  x: number; y: number; w: number; h: number; fit?: 'contain' | 'cover';
}

const RESOLVE_ERROR_PREFIX = '[region-spec] ';

// ── Slide render helpers ──────────────────────────────────────────────────────

// Render the header bar for standard/title/divider slides. The header region
// encodes the TEXT BAND (hdr_y, hdr_h); the dark bar extends from the card top
// (CX, CY) down to headerR.y + headerR.h to mirror the pre-rewrite fillRect.
// Section/number baseline math mirrors the pre-rewrite drawHeader exactly.
function drawHeaderBar(
  r: Renderer,
  sec: string, n: number, total: number,
  headerR: ResolvedRegion, contentR: ResolvedRegion | null,
  titleX: number,
  cardTopY: number,   // CY — top of the card (dark bar starts here)
  C_DARK: RGB, C_ACCENT: RGB, C_MUTED: RGB, C_BORDER: RGB,
  T_SECT: number, T_NUM: number,
) {
  // Dark bar: from cardTopY down to the bottom of the header text band.
  const barH = (headerR.y - cardTopY) + headerR.h;
  r.fillRect(headerR.x, cardTopY, headerR.w, barH, C_DARK);
  const hy      = headerR.y + headerR.h * 0.18;
  const numX    = headerR.x + headerR.w - 45;  // ~30mm-wide right-aligned number cell
  const lineEnd = headerR.x + headerR.w - (contentR ? (contentR.x - headerR.x) : 0);
  r.setFont(true,  T_SECT); r.setColor(C_ACCENT);
  r.cell(180, headerR.h * 0.6, sec.toUpperCase(), titleX, hy, 'L');
  r.setFont(false, T_NUM);  r.setColor(C_MUTED);
  r.cell(30, headerR.h * 0.6, `${n} / ${total}`, numX, hy, 'R');
  r.drawHLine(titleX, headerR.y + headerR.h, lineEnd, 0.088, C_BORDER);
}

// ── Slide render functions (region-driven) ────────────────────────────────────
//
// Each render function receives a `region(name)` resolver that returns the
// ResolvedRegion for the requested region name. Regions not declared by the
// slide type are NOT resolved — accessing one is a hard error (AC-7). Renderers
// iterate only the regions declared in slide_types[type].regions (AC-2).

interface RenderCtx {
  r:        Renderer;
  doc:      PDFDocument;
  data:     SlideData;
  n:        number;
  total:    number;
  imgDir?:  string;
  fontDir?: string;                   // deck font dir (SVG rasterization font lookup)
  spec:     LayoutSpec;
  coords:   ReturnType<typeof buildCoords>;
  colors:   ReturnType<typeof buildColors>;
  sizes:    ReturnType<typeof buildSizes>;
  declared: string[];                 // slide_types[type].regions
  /** True when the generic per-slide step drew this slide's own full-bleed
   *  background image (slideData.backgroundImage or the global bg). Standard
   *  renderers must not paint opaque panels over it (v1.11.0). */
  bgDrawn?: boolean;
  region:   (name: string) => ResolvedRegion;
}

// LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.0 — white bubble card
// helpers shared by the cover / punchline / contact bgDrawn branches. The card
// matches the divider v1.12.0 card and HTML .slide-content (white-bubble:
// rgba(255,255,255,0.97), radius 14px, padding 2rem 2.75rem, fit-content width).
// LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.2 — optional card-rect log
// (env CARD_RECTS_OUT=<file.json>): per-page card rect as fractions of the page.
const CARD_LOG: Array<{ n: number; x: number; y: number; w: number; h: number }> = [];
function logCard(ctx: RenderCtx, x: number, y: number, w: number, h: number) {
  CARD_LOG.push({ n: ctx.n, x: x / ctx.coords.PW, y: y / ctx.coords.PH, w: w / ctx.coords.PW, h: h / ctx.coords.PH });
}
// HTML .slide-content cap: max-width 88% of the 1200px area inside the 1280px
// slide (40px side padding) = 0.825 of the frame width (measured max card w).
function cardCapMm(coords: any): number { return 0.88 * (coords.PW - 2 * coords.px2mm(40)); }
// LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.3 — rich (bold-accent) text.
// `**x**` / <strong>x</strong> = bold + accent colour inline (HTML `.slide-card strong`).
type RichRun = { t: string; b: boolean };
function richRuns(raw: string | undefined | null): RichRun[] {
  const src = (raw ?? '').replace(/<\/?(strong|b)\s*>/gi, '**').replace(/<[^>]+>/g, '');
  const out: RichRun[] = [];
  src.split('**').forEach((t, i) => { if (t) out.push({ t, b: i % 2 === 1 }); });
  return out;
}
function richRunW(r: Renderer, run: RichRun, sizePt: number, forceBold = false): number {
  r.setFont(run.b || forceBold, sizePt);
  return r.stringWidth(run.t);
}
// Greedy word wrap (same rule as Renderer.wrapText) over styled runs.
function richLines(r: Renderer, raw: string, maxW: number, sizePt: number, forceBold = false): RichRun[][] {
  const atoms: RichRun[][] = [];
  let cur: RichRun[] = [];
  for (const run of richRuns(raw)) {
    const parts = run.t.split(' ');
    parts.forEach((w, i) => {
      const last = i === parts.length - 1;
      const txt = last ? w : w + ' ';
      if (txt) cur.push({ t: txt, b: run.b });
      if (!last) { atoms.push(cur); cur = []; }
    });
  }
  if (cur.length) atoms.push(cur);
  const lines: RichRun[][] = [];
  let line: RichRun[] = [], lineW = 0;
  for (const atom of atoms) {
    const aw = atom.reduce((a, x) => a + richRunW(r, x, sizePt, forceBold), 0);
    if (lineW > 0 && lineW + aw > maxW) { lines.push(line); line = [...atom]; lineW = aw; }
    else { line.push(...atom); lineW += aw; }
  }
  lines.push(line);
  for (const l of lines) if (l.length) l[l.length - 1] = { ...l[l.length - 1], t: l[l.length - 1].t.trimEnd() };
  return lines;
}
function richWidth(r: Renderer, runs: RichRun[], sizePt: number): number {
  return runs.reduce((a, x) => a + richRunW(r, x, sizePt), 0);
}
function widestWrappedLine(r: Renderer, text: string, maxW: number, sizePt: number, bold: boolean): number {
  if (!text) return 0;
  r.setFont(bold, sizePt);
  return Math.max(0, ...r.wrapText(text, maxW).map(l => r.stringWidth(l)));
}
function drawBubbleBehind(ctx: RenderCtx, centerX: number, topY: number, blockH: number, textW: number) {
  const { r, coords, colors } = ctx;
  const padX  = coords.px2mm(44);   // HTML card padding: 2.75rem horizontal
  const padY  = coords.px2mm(32);   // HTML card padding: 2rem vertical
  const cardW = Math.min(textW + padX * 2, cardCapMm(coords));
  logCard(ctx, centerX - cardW / 2, topY - padY, cardW, blockH + padY * 2);
  r.drawRoundedRect(centerX - cardW / 2, topY - padY, cardW, blockH + padY * 2,
    coords.px2mm(14), colors.C_CARD, 0.97);
}

async function renderTitleSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_ACCENT, C_MUTED, C_WHITE, C_META, C_DARK, C_BORDER } = colors;
  const {
    T_TS_EYEBROW, T_TS_TITLE, T_TS_SUB, T_TS_META, T_SECT, T_NUM,
    LH_TS_EYEBROW, LH_TS_TITLE, LH_TS_SUB, LH_TS_META,
    GAP_TS_EYE_TTL, GAP_TS_TTL_SUB, GAP_TS_SUB_META,
  } = sizes;

  const titleR = region('title');
  const subR   = tryRegion(ctx, 'subtitle') ?? titleR;
  const metaR  = tryRegion(ctx, 'meta')     ?? subR;
  const visR   = tryRegion(ctx, 'visual');
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  const ip = imgPath(data.visualImage, imgDir ?? '');
  const hasImage = !!(ip && visR);

  if (hasImage) {
    // HTML: .slide-content 1fr/1fr grid — slide-left (L-aligned text) + right-panel (image)
    // Left column: from slide margin to visR, gap = 3rem
    const margin  = coords.CX + coords.px2mm(56);          // padding-left 3.5rem
    const textW   = visR!.x - margin - coords.px2mm(48);   // gap 3rem

    const eyebrow  = strip(data.section);
    const titleTxt = strip(data.title);
    const subtitle = strip(data.subtitle);
    const meta     = strip(data.meta);

    r.setFont(true, T_TS_TITLE);
    const titleLineCount = r.wrapText(titleTxt, textW).length;
    const hEye   = eyebrow  ? LH_TS_EYEBROW + GAP_TS_EYE_TTL                       : 0;
    const hTitle = titleLineCount * LH_TS_TITLE + (subtitle || meta ? GAP_TS_TTL_SUB : 0);
    const hSub   = subtitle ? LH_TS_SUB + (meta ? GAP_TS_SUB_META : 0)           : 0;
    const hMeta  = meta     ? LH_TS_META                                              : 0;
    const blockH = hEye + hTitle + hSub + hMeta;

    let vy = coords.CY + coords.px2mm(48)
           + Math.max(0, (coords.CH - coords.px2mm(96) - blockH) / 2);

    if (eyebrow) {
      r.setFont(true, T_TS_EYEBROW); r.setColor(C_ACCENT);
      r.multiCell(textW, LH_TS_EYEBROW, eyebrow.toUpperCase(), margin, vy, 'L');
      vy += LH_TS_EYEBROW + GAP_TS_EYE_TTL;
    }
    r.setFont(true, T_TS_TITLE); r.setColor(C_WHITE);
    vy = r.multiCell(textW, LH_TS_TITLE, titleTxt, margin, vy, 'L');
    if (subtitle || meta) vy += GAP_TS_TTL_SUB;
    if (subtitle) {
      r.setFont(false, T_TS_SUB); r.setColor(C_MUTED);
      vy = r.multiCell(textW, LH_TS_SUB, subtitle, margin, vy, 'L');
      if (meta) vy += GAP_TS_SUB_META;
    }
    if (meta) {
      r.setFont(false, T_TS_META); r.setColor(C_META);
      r.multiCell(textW, LH_TS_META, meta, margin, vy, 'L');
    }
    await r.placeImage(doc, ip!, visR!.x, visR!.y, visR!.w, visR!.h);
  } else {
    // No image: single centered column (HTML: grid-template-columns: 1fr, text-align: center)
    // LOCAL-PATCH(upstream-request: U-20261105-002) R1 — ink text on a drawn
    // background: C_WHITE title (≈1.08:1) + light C_MUTED/C_META on the
    // warm-paper wash were invisible; when the per-slide loop drew this
    // slide's own background photo + wash, mirror the F4 punchline pattern —
    // title ink (colors.C_DARK), subtitle/meta body-ink (C_BODY, the darkest
    // non-ink text role, F4 sub-line analog); eyebrow keeps C_ACCENT. Without
    // a drawn background, legacy colors unchanged.
    const bgDrawn = ctx.bgDrawn === true;
    const eyebrow = strip(data.section);
    // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.0 — white bubble card
    // behind the cover text block (title + subtitle + meta) when a background
    // photo was drawn; the card is drawn BEFORE any ink text.
    if (bgDrawn) {
      const tTxt = strip(data.title), sTxt = strip(data.subtitle), mTxt = strip(data.meta);
      r.setFont(true, T_TS_TITLE);
      const tLines = r.wrapText(tTxt, titleR.w).length;
      r.setFont(false, T_TS_SUB);
      const sLines = sTxt ? r.wrapText(sTxt, subR.w).length : 0;
      const metaBottom = mTxt ? subR.y + LH_TS_SUB + GAP_TS_SUB_META + LH_TS_META : 0;
      const bottom = Math.max(titleR.y + tLines * LH_TS_TITLE, subR.y + sLines * LH_TS_SUB, metaBottom);
      const textW = Math.max(
        widestWrappedLine(r, tTxt, titleR.w, T_TS_TITLE, true),
        widestWrappedLine(r, sTxt, subR.w, T_TS_SUB, false),
        widestWrappedLine(r, mTxt, subR.w, T_TS_META, false),
      );
      drawBubbleBehind(ctx, titleR.x + titleR.w / 2, titleR.y, bottom - titleR.y, textW);
    }
    // (eyebrow skipped when the card is drawn: zen hides .slide-header in HTML, and
    // the eyebrow would sit outside the card on the photo — U-20261105-005 v1.14.0)
    if (eyebrow && metaR && !bgDrawn) {
      r.setFont(true, T_TS_EYEBROW); r.setColor(C_ACCENT);
      r.multiCell(metaR.w, LH_TS_META, eyebrow.toUpperCase(), metaR.x, metaR.y, 'C');
    }
    // LOCAL-PATCH(upstream-request: U-20261119-007) (Gate 5, 2026-11-19): the bgDrawn ink was hardcoded to C_DARK/C_BODY,
    // which assumed the zen×white-bubble light card. On dark styles
    // (premium-dark: C_CARD is dark navy) the title vanished into the bubble.
    // Derive ink from the actual card color instead.
    r.setFont(true, T_TS_TITLE); r.setColor(bgDrawn ? readableTextOn(colors.C_CARD) : C_WHITE);
    r.multiCell(titleR.w, LH_TS_TITLE, strip(data.title), titleR.x, titleR.y, 'C');
    r.setFont(false, T_TS_SUB); r.setColor(bgDrawn ? readableMutedOn(colors.C_CARD) : C_MUTED);
    r.multiCell(subR.w, LH_TS_SUB, strip(data.subtitle), subR.x, subR.y, 'C');
    const meta = strip(data.meta);
    if (meta) {
      const metaY = subR.y + LH_TS_SUB + GAP_TS_SUB_META;
      r.setFont(false, T_TS_META); r.setColor(bgDrawn ? readableMutedOn(colors.C_CARD) : C_META);
      r.multiCell(subR.w, LH_TS_META, meta, subR.x, metaY, 'C');
    }
  }
}

async function renderDividerSlide(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors, sizes, region } = ctx;
  const { C_DARK3, C_DARK, C_BORDER, C_ACCENT, C_MUTED, C_WHITE } = colors;
  const { CX, CY, CW, CH } = coords;
  const {
    T_DIV_PART, T_DIV_TITLE, T_DIV_DESC, T_SECT, T_NUM,
    LH_DIV_PART, LH_DIV_TITLE, LH_DIV_DESC,
    GAP_DIV_PART_TITLE, GAP_DIV_TITLE_DESC,
  } = sizes;

  // v1.12.0 — dividers WITH a drawn background (bgDrawn) mirror the HTML deck:
  // the white-bubble style paints divider text inside the same white rounded
  // bubble card as standard slides ([data-theme="zen"] .slide-content:
  // rgba(255,255,255,0.97), border-radius 14px) with a dark navy title
  // (--divider-text #1f2a44), not white type straight on the photo. The CH
  // part-number chip stays accent (HTML .part-number) and the desc uses
  // readableMutedOn. Dividers WITHOUT a resolvable background fall through to
  // the legacy white-text-on-photo path below (dark-overlaid backdrop).
  const bgDrawn = ctx.bgDrawn === true;

  const titleR = region('title');
  const visR   = region('visual');
  const hdrR   = tryRegion(ctx, 'header');

  if (hdrR) {
    drawHeaderBar(r, strip(data.section), ctx.n, ctx.total, hdrR, titleR, titleR.x, ctx.coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  if (bgDrawn) {
    const onCardText  = readableTextOn(colors.C_CARD);
    const onCardMuted = readableMutedOn(colors.C_CARD);
    // Bubble card: ~55-60% of the printable width (task spec; HTML caps the
    // fit-content card at 88%), horizontally centered, sized to the wrapped
    // text block + padding, vertically centered in the printable card area.
    const padX   = coords.px2mm(44);   // HTML card padding: 2.75rem horizontal
    const padY   = coords.px2mm(32);   // HTML card padding: 2rem vertical
    // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.2 — hug the content like
    // HTML (fit-content, max 88%) instead of a fixed 58% card.
    const innerMaxD = cardCapMm(coords) - padX * 2;
    const dPart  = strip(data.partNum).toUpperCase();
    const dTitle = strip(data.title), dDesc = strip(data.desc ?? '');
    const hugW   = Math.max(
      widestWrappedLine(r, dPart, innerMaxD, T_DIV_PART, true),
      widestWrappedLine(r, dTitle, innerMaxD, T_DIV_TITLE, true),
      widestWrappedLine(r, dDesc, innerMaxD, T_DIV_DESC, false));
    const cardW  = Math.min(hugW + padX * 2, cardCapMm(coords));
    const innerW = cardW - padX * 2 + 0.01;

    r.setFont(true, T_DIV_TITLE);
    const titleH = r.estimateTextHeight(strip(data.title), innerW, T_DIV_TITLE, LH_DIV_TITLE, true);
    r.setFont(false, T_DIV_DESC);
    const descH  = r.estimateTextHeight(strip(data.desc ?? ''), innerW, T_DIV_DESC, LH_DIV_DESC, false);
    const blockH = LH_DIV_PART + GAP_DIV_PART_TITLE + titleH + GAP_DIV_TITLE_DESC + descH;

    const cardH = blockH + padY * 2;
    const cardX = CX + (CW - cardW) / 2;
    const cardY = Math.min(coords.PH * 0.95 - cardH, Math.max(coords.PH * 0.05, (coords.PH - cardH) / 2));
    logCard(ctx, cardX, cardY, cardW, cardH);
    r.drawRoundedRect(cardX, cardY, cardW, cardH, coords.px2mm(14), colors.C_CARD, 0.97);

    const textX = cardX + padX;
    let y = cardY + padY;
    r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
    r.cell(innerW, LH_DIV_PART, (strip(data.partNum)).toUpperCase(), textX, y, 'C');
    y += LH_DIV_PART + GAP_DIV_PART_TITLE;
    r.setFont(true, T_DIV_TITLE); r.setColor(onCardText);
    y = r.multiCell(innerW, LH_DIV_TITLE, strip(data.title), textX, y, 'C');
    y += GAP_DIV_TITLE_DESC;
    r.setFont(false, T_DIV_DESC); r.setColor(onCardMuted);
    r.multiCell(innerW, LH_DIV_DESC, strip(data.desc), textX, y, 'C');
    return;
  }

  // Legacy path (no resolvable background): do NOT re-fill the card here — the
  // generic per-slide step in main() painted the flat card background, and
  // re-filling with C_BG used to blot out a photo and left C_TEXT (a pale
  // "text on dark" default) nearly invisible against a light style's flat card
  // color (e.g. white-bubble's cream). Title/desc use the same fixed white/
  // muted colors renderTitleSlide uses, since both slide types assume a
  // dark-overlaid backdrop.

  const ip = imgPath(data.visualImage, imgDir ?? '');

  // LOCAL-PATCH(upstream-request: U-20261114-011) v1.14.7 — paint order fix.
  // The legacy path used to draw the part/title/desc text FIRST and then a
  // full-bleed cover-crop of the divider's own visual over the whole `visual`
  // region. Under zen that region IS the page (0,0,100%,100%), so every
  // photo-less divider lost its title card to its own image (blank photo page;
  // observed on S4 of the sample after the deck moved to background scope
  // `all`). Drawing the image first makes the title card unconditionally
  // legible on top of the photo — the same "drawn background" guarantee the
  // title / punchline / contact / profile bgDrawn branches provide. The
  // bgDrawn branch above already returns early with the white-bubble card;
  // this path is what a future deck without a resolvable background gets.
  if (ip && visR) {
    r.fillRect(visR.x, visR.y, visR.w, visR.h, C_DARK3);
    await r.placeImageCover(doc, ip, visR.x, visR.y, visR.w, visR.h);
  }

  const align: 'L' | 'C' = ip ? 'L' : 'C';

  // Estimate actual block height accounting for title/desc text wrapping.
  // For image dividers, center vertically within the full card (not just titleR).
  // For text-only dividers, center within titleR as before.
  r.setFont(true, T_DIV_TITLE);
  const titleH_est = r.estimateTextHeight(strip(data.title), titleR.w, T_DIV_TITLE, LH_DIV_TITLE, true);
  r.setFont(false, T_DIV_DESC);
  const descH_est  = r.estimateTextHeight(strip(data.desc ?? ''), titleR.w, T_DIV_DESC, LH_DIV_DESC, false);
  const blockH = LH_DIV_PART + GAP_DIV_PART_TITLE + titleH_est + GAP_DIV_TITLE_DESC + descH_est;
  const py0 = ip
    ? coords.CY + Math.max(LH_DIV_PART, (coords.CH - blockH) / 2)
    : titleR.y + Math.max(0, (titleR.h - blockH) / 2);

  r.setFont(true, T_DIV_PART); r.setColor(C_ACCENT);
  r.cell(titleR.w, LH_DIV_PART, (strip(data.partNum)).toUpperCase(), titleR.x, py0, align);

  const py1 = py0 + LH_DIV_PART + GAP_DIV_PART_TITLE;
  r.setFont(true, T_DIV_TITLE); r.setColor(C_WHITE);
  const afterTitle = r.multiCell(titleR.w, LH_DIV_TITLE, strip(data.title), titleR.x, py1, align);

  const py2 = afterTitle + GAP_DIV_TITLE_DESC;
  r.setFont(false, T_DIV_DESC); r.setColor(C_MUTED);
  r.multiCell(titleR.w, LH_DIV_DESC, strip(data.desc), titleR.x, py2, align);
}

function renderPunchlineSlide(ctx: RenderCtx) {
  const { r, data, spec, coords, colors, sizes, region } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;
  const {
    T_PUNCH_TAG, T_PUNCH_MARK, T_PUNCH_TEXT, T_PUNCH_SUB,
    LH_PUNCH_TAG, LH_PUNCH_MARK, LH_PUNCH_TEXT, LH_PUNCH_SUB,
    GAP_PUNCH_TAG_MARK, GAP_PUNCH_MARK_TEXT, GAP_PUNCH_TEXT_SUB,
  } = sizes;

  const titleR = region('title');
  const box    = tryRegion(ctx, 'content') ?? titleR;   // center within the large content region
  const bandW  = box.w;

  // HTML constrains .punch-text to max-width: 32ch (≈607px ≈160.6mm) so the statement
  // wraps to ~2 centered lines. Reproduce that exact max-width (measured from slide-7,
  // whose natural width 169.3mm > 160.6mm → wraps). Count the wrapped lines so blockH /
  // vertical centering accounts for the ACTUAL statement height.
  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.5 — keep the raw `**keyword**`
  // markup (HTML `.punch-text strong` = accent) and wrap/draw through richLines.
  // v1.15.0 (U-20261116-008 item 3) — resolve text/sub as before, then split
  // the statement on `\n` into sentences: HTML's inlineTitle renders `\n` as a
  // <br> (equal full-size lines), but the PDF never split — the literal `\n`
  // rode along inside the next atom and U+2060 word joiners glued words into
  // one giant atom that drew past the band (S45). Strip the joiners from the
  // raw BEFORE the rich splitter (strip() alone cannot: richLines receives the
  // `**keyword**` markup raw). Every sentence wraps and draws as its own group
  // at the full T_PUNCH_TEXT size and bold weight.
  const statementRaw = ((data.text ?? '').replace(/<[^>]+>/g, '').trim() ? (data.text as string) : (data.title ?? ''))
    .replace(/[\u2060\uFEFF]/g, '');
  const punchSentences = statementRaw.split('\n').map((s) => s.trim()).filter(Boolean);
  r.setFont(true, T_PUNCH_TEXT);
  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.2 — with the white bubble
  // card (bgDrawn) HTML zen shows ONLY the statement (+ optional sub) in the card:
  // title max-width 85% of the card inner width, tag / quote mark not rendered.
  const cardMode = ctx.bgDrawn === true;
  const padXp = coords.px2mm(44), padYp = coords.px2mm(32);
  const capW  = cardCapMm(coords);
  // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks wrap at the
  // frame inner width (HTML .slide-title has no 32ch cap there).
  const framed = !!spec.frame;
  const textBand = cardMode ? 0.85 * (capW - padXp * 2)
    : framed ? Math.min(bandW, frameGeom(spec, coords).fw * 0.9) : Math.min(bandW, coords.px2mm(607));
  const textX    = box.x + (bandW - textBand) / 2;
  const stmtLines = punchSentences.flatMap((s) => richLines(r, s, textBand, T_PUNCH_TEXT, true));
  const nTextLines = stmtLines.length || 1;
  const textLineH = nTextLines * LH_PUNCH_TEXT;
  // v1.15.0 (U-20261116-011) — opt-in sub bold/ink parity (fonts.punchline_sub_bold).
  const subBold = ctx.spec.fonts?.punchline_sub_bold === true;

  const subPre = strip(data.sub) || strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  const blockH = cardMode
    ? textLineH + (subPre ? GAP_PUNCH_TEXT_SUB + LH_PUNCH_SUB : 0)
    : framed ? LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK + textLineH + (subPre ? GAP_PUNCH_TEXT_SUB + LH_PUNCH_SUB : 0)
    : LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK + LH_PUNCH_MARK + GAP_PUNCH_MARK_TEXT + textLineH + GAP_PUNCH_TEXT_SUB + LH_PUNCH_SUB;
  let y = cardMode
    ? Math.min(coords.PH * 0.95 - padYp - blockH, Math.max(coords.PH * 0.05 + padYp, (coords.PH - blockH) / 2))
    : box.y + Math.max(0, (box.h - blockH) / 2);

  // LOCAL-PATCH(upstream-request: U-20261105-002) F4 — skip the flat C_BG
  // full-page repaint when the per-slide loop already drew this slide's own
  // background photo + wash (mirror of the v1.12.1 contact pattern); the
  // repaint would erase the drawn background. Decks without a drawn background
  // keep the legacy full-bleed fill (HTML .slide[data-type="punchline"] radial navy).
  if (ctx.bgDrawn !== true) {
    r.fillRect(0, 0, coords.CW, coords.CH, C_BG);
  } else {
    // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.0 — white bubble card
    // behind the whole punchline block (tag + mark + statement + sub), drawn
    // before any ink text; width = widest wrapped line (HTML fit-content).
    const subForCard = strip(data.sub) || strip(data.subtitle) || strip((data.bullets ?? [])[0]);
    // HTML: a statement that wraps makes the fit-content card hit its cap.
    // v1.15.0: the card width takes the widest SENTENCE (a `\n` title means
    // ≥2 sentence groups); the sub measures bold when punchline_sub_bold set.
    const textW = nTextLines > 1 ? capW - padXp * 2 : Math.max(
      ...punchSentences.map((s) => widestWrappedLine(r, s, textBand, T_PUNCH_TEXT, true)),
      widestWrappedLine(r, subForCard, bandW, T_PUNCH_SUB, subBold),
    );
    drawBubbleBehind(ctx, box.x + bandW / 2, y, blockH, textW);
  }

  // part-tag (gold, uppercase) — e.g. “PART 01 · 패러다임 전환”
  const sec = cardMode ? '' : strip(data.section);
  if (sec && framed) {
    // LOCAL-PATCH(upstream-request: U-20261119-010) — Framed: HTML .slide-eyebrow
    // — bold, 0.2em tracked, centred.
    r.setFont(true, T_PUNCH_TAG); r.setColor(C_ACCENT);
    const up = sec.toUpperCase();
    const tw = Array.from(up).reduce((a, ch) => a + r.stringWidth(ch), 0) + (T_PUNCH_TAG / MM_TO_PT) * 0.2 * (Array.from(up).length - 1);
    drawTracked(r, up, box.x + (bandW - tw) / 2, y, LH_PUNCH_TAG, T_PUNCH_TAG, 0.2);
    y += LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK;
  } else if (sec) {
    r.setFont(false, T_PUNCH_TAG); r.setColor(C_ACCENT);
    r.cell(bandW, LH_PUNCH_TAG, sec.toUpperCase(), box.x, y, 'C');
    y += LH_PUNCH_TAG + GAP_PUNCH_TAG_MARK;
  }

  // decorative gold quote mark (“) above the statement
  // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks skip it: the
  // pitch-enhanced HTML punchline branch (template.html) draws eyebrow + h1
  // only, never the mark.
  if (!cardMode && !framed) {
    r.setFont(false, T_PUNCH_MARK); r.setColor(C_ACCENT);
    r.cell(bandW, LH_PUNCH_MARK, '”', box.x, y, 'C');
    y += LH_PUNCH_MARK + GAP_PUNCH_MARK_TEXT;
  }

  // LOCAL-PATCH(upstream-request: U-20261105-002) F4 — when the background
  // photo + wash was drawn, the statement renders in ink (colors.C_DARK,
  // design_spec §5 "잉크 64px 한 문장") instead of the legacy C_WHITE tuned
  // for the dark radial background; without a drawn background, legacy colors
  // unchanged. Sub line keeps C_BODY; tag/quote mark keep C_ACCENT.
  // punch-text — the statement (data.text, fallback title), wrapped at the
  // HTML max-width (textBand), centered on the same axis as the tag/mark/sub above.
  r.setFont(true, T_PUNCH_TEXT);
  // LOCAL-PATCH(upstream-request: U-20261119-007) (Gate 5, 2026-11-19): the
  // statement ink assumed the white-bubble card; on premium-dark (C_CARD dark
  // navy) it vanished into the bubble. Derive ink from the actual bubble
  // color (same pattern as the divider branch).
  const stmtInk = ctx.bgDrawn === true ? readableTextOn(colors.C_CARD) : C_WHITE;
  let sy = y;
  // LOCAL-PATCH(upstream-request: U-20261119-010) — Framed: HTML
  // `.slide-title::first-line { color: accent }` — the first rendered line is
  // accent, the rest statement ink.
  stmtLines.forEach((ln, li) => {
    const lineInk = framed && li === 0 ? toRGB(spec.frame!.accent_rgb) : stmtInk;
    let lx = textX + (textBand - richWidth(r, ln.map(x => ({ ...x, b: true })), T_PUNCH_TEXT)) / 2;
    for (const run of ln) {
      r.setFont(true, T_PUNCH_TEXT); r.setColor(run.b ? C_ACCENT : lineInk);
      if (run.t) r.cell(1, LH_PUNCH_TEXT, run.t, lx, sy, 'L');
      lx += richRunW(r, run, T_PUNCH_TEXT, true);
    }
    sy += LH_PUNCH_TEXT;
  });
  y = sy + GAP_PUNCH_TEXT_SUB;

  // punch-sub (slate) — support line (data.sub, fallback subtitle/bullets)
  // v1.15.0 (U-20261116-011): fonts.punchline_sub_bold flips the sub to bold
  // in the statement ink (stmtInk = C_DARK when a background was drawn,
  // mirroring the HTML line-2 ink); the absent key keeps regular C_BODY.
  const subText = strip(data.sub) || strip(data.subtitle) || strip((data.bullets ?? [])[0]);
  if (subText) {
    r.setFont(subBold, T_PUNCH_SUB); r.setColor(subBold ? stmtInk : C_BODY);
    r.multiCell(bandW, LH_PUNCH_SUB, subText, box.x, y, 'C');
  }
}

function renderProfileSlide(ctx: RenderCtx) {
  const { r, data, coords, colors, sizes } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_MUTED } = colors;
  const {
    T_PROF_EYEBROW, T_PROF_NAME, T_PROF_AFFIL, T_PROF_BIO,
    LH_PROF_EYEBROW, LH_PROF_NAME, LH_PROF_AFFIL, LH_PROF_BIO,
    GAP_PROF_EYEBROW_NAME, GAP_PROF_NAME_AFFIL, GAP_PROF_AFFIL_BIO,
  } = sizes;

  // HTML pitch-enhanced .slide[data-type="profile"]:
  //   flex column, centered, text-align:center, padding: 4rem
  //   profile-eyebrow (section) → profile-name → profile-affiliation (accent) → profile-bio
  //   No slide-title element.
  // LOCAL-PATCH(upstream-request: U-20261114-008/-009 pending) v1.14.6 — when the
  // per-slide loop already drew this slide's own background photo + wash
  // (ctx.bgDrawn), SKIP the flat C_BG fill: the opaque full-page repaint painted
  // straight over the photo (same overpaint class as v1.12.0 divider / v1.12.1
  // contact / F4 punchline / R1 title). The profile block then renders inside the
  // white-bubble card, mirroring HTML (zen × white-bubble: .slide-card >
  // .slide-content) and the v1.14.0 contact treatment. Decks without a drawn
  // per-slide background keep the legacy flat surface unchanged.
  const bgDrawn = ctx.bgDrawn === true;
  if (!bgDrawn) {
    r.fillRect(0, 0, coords.CW, coords.CH, C_BG);
  }

  const bandW = coords.CW * 0.80;
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  const eyebrowTxt = strip(data.section);
  const nameTxt    = strip(data.speakerName);
  const affilTxt   = strip(data.speakerTitle);
  const bioLines   = (data.speakerBio ?? '')
    .split(/\n|<br\s*\/?>/i).map((s: string) => strip(s).trim()).filter(Boolean);

  const blockH = LH_PROF_EYEBROW + GAP_PROF_EYEBROW_NAME + LH_PROF_NAME + GAP_PROF_NAME_AFFIL
               + LH_PROF_AFFIL + GAP_PROF_AFFIL_BIO + LH_PROF_BIO * Math.max(1, bioLines.length);
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  // v1.14.6 — white bubble card behind the profile block (eyebrow + name +
  // affiliation + bio), drawn BEFORE any text; width = widest wrapped line.
  if (bgDrawn) {
    const textW = Math.max(
      widestWrappedLine(r, eyebrowTxt ? eyebrowTxt.toUpperCase() : '', bandW, T_PROF_EYEBROW, true),
      widestWrappedLine(r, nameTxt,  bandW, T_PROF_NAME,  true),
      widestWrappedLine(r, affilTxt, bandW, T_PROF_AFFIL, false),
      ...bioLines.map(l => widestWrappedLine(r, l, bandW, T_PROF_BIO, false)),
    );
    if (textW > 0) drawBubbleBehind(ctx, bandX + bandW / 2, y, blockH, textW);
  }

  r.setFont(true,  T_PROF_EYEBROW); r.setColor(C_ACCENT);
  r.cell(bandW, LH_PROF_EYEBROW, eyebrowTxt.toUpperCase(), bandX, y, 'C');
  y += LH_PROF_EYEBROW + GAP_PROF_EYEBROW_NAME;

  // v1.14.6 — name in ink on the drawn white card (C_WHITE was invisible);
  // legacy decks keep white. Bio is body ink (C_BODY); affiliation keeps accent.
  // LOCAL-PATCH(upstream-request: U-20261119-007) (Gate 5, 2026-11-19): ink from
  // the actual card color, defensively (premium-dark C_CARD is dark navy).
  r.setFont(true,  T_PROF_NAME); r.setColor(bgDrawn ? readableTextOn(colors.C_CARD) : C_WHITE);
  r.cell(bandW, LH_PROF_NAME, nameTxt, bandX, y, 'C');
  y += LH_PROF_NAME + GAP_PROF_NAME_AFFIL;

  r.setFont(false, T_PROF_AFFIL); r.setColor(C_ACCENT);   // CSS: var(--accent-color)
  r.cell(bandW, LH_PROF_AFFIL, affilTxt, bandX, y, 'C');
  y += LH_PROF_AFFIL + GAP_PROF_AFFIL_BIO;

  r.setFont(false, T_PROF_BIO); r.setColor(bgDrawn ? readableMutedOn(colors.C_CARD) : C_MUTED);
  for (const line of bioLines) {
    r.cell(bandW, LH_PROF_BIO, line, bandX, y, 'C');
    y += LH_PROF_BIO;
  }
}

function renderContactSlide(ctx: RenderCtx) {
  const { r, data, coords, colors, sizes } = ctx;
  const { C_BG, C_ACCENT, C_WHITE, C_BODY } = colors;
  const {
    T_CONT_THANKS, T_CONT_LINE, T_CONT_NOTE,
    LH_CONT_THANKS, LH_CONT_LINE, LH_CONT_NOTE,
    GAP_CONT_THANKS_LINE, GAP_CONT_LINE_NOTE,
  } = sizes;

  // v1.12.1 — when the generic per-slide step already drew this slide's own
  // background photo + dark wash (ctx.bgDrawn), SKIP the flat C_BG fill: the
  // opaque fill painted straight over the photo, leaving a blank surface (same
  // overpaint class as the v1.12.0 divider fix). The light contact text reads
  // fine on the dark wash and is kept as-is. Decks WITHOUT a per-slide
  // background keep the legacy flat full-bleed surface, unchanged.
  const bgDrawn = ctx.bgDrawn === true;
  if (!bgDrawn) {
    r.fillRect(0, 0, coords.CW, coords.CH, C_BG);   // full-bleed surface, no header strip
  }

  const bandW = coords.CW * 0.80;                 // centered 80% band (HTML centers everything)
  const bandX = coords.CX + (coords.CW - bandW) / 2;

  const thanks = strip(data.title);
  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.3 — render every contact*
  // field generically (known order first, then any extra contact* key); the
  // note (contactNote) stays the accent CTA line.
  const note   = strip(data.contactNote);
  const known  = ['contactName', 'contactEmail', 'contactLinkedIn', 'contactPhone'];
  const extra  = Object.keys(data).filter(k => /^contact/.test(k) && !known.includes(k) && k !== 'contactNote');
  let cLines = [...known, ...extra].map(k => strip((data as any)[k])).filter(Boolean);
  // v1.15.0 (U-20261116-008 item 4 PDF side, owner decision O-1) — bullets-only
  // contact slide (deck S47 shape): when NO contact* line resolves, fall back to
  // `bullets` (max 5), the first line bold in the card ink mirroring the HTML
  // .contact-primary treatment. The contact*-first order keeps every existing
  // deck unchanged.
  let primaryFirst = false;
  if (cLines.length === 0) {
    cLines = (data.bullets ?? []).slice(0, 5).map(s => strip(s)).filter(Boolean);
    primaryFirst = cLines.length > 0;
  }
  const nLines = cLines.length || 1;

  r.setFont(false, T_CONT_NOTE);
  const noteLines = note ? Math.max(1, r.wrapText(note, bandW).length) : 1;

  // Vertically center the whole contact group, then stack with measured gaps.
  const blockH = LH_CONT_THANKS + GAP_CONT_THANKS_LINE + LH_CONT_LINE * nLines + (note ? GAP_CONT_LINE_NOTE + LH_CONT_NOTE * noteLines : 0);   // v1.14.3: no empty note row
  let y = coords.CY + Math.max(0, (coords.CH - blockH) / 2);

  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.0 — white bubble card
  // behind the contact group (thanks + lines + note) when a background photo
  // was drawn, before any ink text; width = widest wrapped line.
  if (bgDrawn) {
    const cardTextW = Math.max(
      widestWrappedLine(r, thanks, bandW, T_CONT_THANKS, true),
      ...cLines.map((l, i) => widestWrappedLine(r, l, bandW, T_CONT_LINE, primaryFirst && i === 0)),
      widestWrappedLine(r, note, bandW, T_CONT_NOTE, false),
      // HTML contact card min-width: min(28rem, 80%)
      Math.min(coords.px2mm(448), coords.PW * 0.80) - coords.px2mm(88),
    );
    drawBubbleBehind(ctx, bandX + bandW / 2, y, blockH, cardTextW);
  }

  // "감사합니다" — WHITE bold (HTML .contact-thanks is white, not gold)
  // LOCAL-PATCH(upstream-request: U-20261105-002) R2 — when the background
  // photo + warm wash was drawn, the thanks hero renders in ink
  // (colors.C_DARK, ≈15:1 on the wash) — the v1.12.1 fill-skip assumed the
  // legacy dark overlay; white on the light wash was ≈1.08:1. Contact lines
  // keep C_BODY (already legible ink-muted), note keeps C_ACCENT. Without a
  // drawn background, legacy white on the dark flat surface unchanged.
  r.setFont(true, T_CONT_THANKS);
  // LOCAL-PATCH(upstream-request: U-20261119-007) (Gate 5, 2026-11-19): thanks
  // ink from the actual bubble color — premium-dark C_CARD is dark navy, so
  // the hardcoded C_DARK vanished (same pattern as the divider branch).
  r.setColor(bgDrawn ? readableTextOn(colors.C_CARD) : C_WHITE);
  r.cell(bandW, LH_CONT_THANKS, thanks, bandX, y, 'C');
  y += LH_CONT_THANKS + GAP_CONT_THANKS_LINE;

  // contact lines — secondary #CBD5E1 (C_BODY), regular weight. v1.15.0: the
  // first bullets-fallback line renders bold in the card ink — bgDrawn ? C_DARK
  // : C_WHITE, the same conditional the R2 thanks hero uses on this surface
  // (bare C_DARK would be invisible on the legacy dark flat background).
  for (let i = 0; i < cLines.length; i++) {
    const primary = primaryFirst && i === 0;
    r.setFont(primary, T_CONT_LINE);
    r.setColor(primary ? (bgDrawn ? readableTextOn(colors.C_CARD) : C_WHITE) : C_BODY);
    r.cell(bandW, LH_CONT_LINE, cLines[i], bandX, y, 'C');
    y += LH_CONT_LINE;
  }

  // note / CTA — GOLD (HTML .contact-next is accent gold)
  y += GAP_CONT_LINE_NOTE;
  r.setFont(false, T_CONT_NOTE); r.setColor(C_ACCENT);
  r.multiCell(bandW, LH_CONT_NOTE, note, bandX, y, 'C');
}

// ── LOCAL-PATCH(upstream-request: U-20261119-010) — framed layout ─────────────
// HTML pitch-enhanced draws every slide inside one rounded `.slide` frame on a
// darker page; standard slides are a two-column grid (.slide-left text column
// with the section eyebrow ABOVE the title, rich `**accent**` bullets, and a
// .right-panel holding the image + .cdk-caption). The legacy PDF path drew a
// header bar, a separate text card and a full-height visual panel instead.
// When the theme spec declares `frame`, standard/contact slides use this
// renderer and every page is masked to the frame (HTML parity, Gate 5 2026-11-19).
interface FrameSpec {
  ref_w_px?: number;                       // reference viewport width (1280)
  x_px: number; y_px: number; w_px: number; h_px: number; radius_px: number;
  col_x_px: number; col_y_px: number; col_w_px: number; col_h_px: number;
  panel_x_px: number; panel_w_px: number; panel_radius_px?: number; panel_pad_px?: number;
  panel_rgba?: number[];                   // [r,g,b,a] panel tint
  page_rgb: number[]; frame_rgb: number[];
  text_rgb: number[]; body_rgb: number[]; accent_rgb: number[]; muted_rgb: number[];
  eyebrow_px: number; eyebrow_lh_px: number; eyebrow_gap_px: number; eyebrow_tracking_em?: number;
  title_px: number; title_lh_px: number; title_gap_px: number;
  bullet_px: number; bullet_lh_px: number; bullet_gap_px: number; bullet_indent_px: number;
  caption_px: number; caption_lh_px: number; caption_gap_px: number;
  footnote_px: number; footnote_lh_px: number; footnote_bottom_px: number;
}
function frameGeom(spec: LayoutSpec, coords: ReturnType<typeof buildCoords>) {
  const f = spec.frame!;
  const k = coords.PW / (f.ref_w_px ?? 1280);            // HTML px → mm
  const px = (v: number) => v * k;
  const pt = (v: number) => v * k * MM_TO_PT;            // HTML px → font pt
  const fx = px(f.x_px), fy = px(f.y_px), fw = px(f.w_px), fh = px(f.h_px);
  return { f, k, px, pt, fx, fy, fw, fh, rad: px(f.radius_px) };
}
// Letter-spaced single-line text (CSS letter-spacing) — HTML eyebrows use 0.2em.
function drawTracked(r: Renderer, text: string, xMm: number, yMm: number, hMm: number, sizePt: number, trackEm: number) {
  const track = (sizePt / MM_TO_PT) * trackEm;
  let x = xMm;
  for (const ch of Array.from(text)) {
    r.cell(1, hMm, ch, x, yMm, 'L');
    x += r.stringWidth(ch) + track;
  }
}
async function renderFramedStandard(ctx: RenderCtx, opts: { lines?: string[] } = {}) {
  const { r, doc, data, imgDir, spec, coords } = ctx;
  const { f, px, pt, fx, fy } = frameGeom(spec, coords);
  const C = (a: number[]) => toRGB(a);
  const cText = C(f.text_rgb), cBody = C(f.body_rgb), cAcc = C(f.accent_rgb), cMuted = C(f.muted_rgb);

  // Visual: raster (photo/png) or rasterized SVG diagram.
  const visRaster = data.visualImage
    ? resolveVisualRaster(data.visualImage, imgDir ?? '', ctx.fontDir ?? imgDir ?? '') : null;
  let visImg: any = null;
  if (visRaster) {
    try { visImg = await r.embedImg(doc, visRaster); }
    catch (e: any) { console.warn(`  framed visual err (slide ${ctx.n}): ${e.message}`); }
  }
  const twoCol = !!visImg;
  const colX = fx + px(f.col_x_px), colY = fy + px(f.col_y_px), colH = px(f.col_h_px);
  const colW = twoCol ? px(f.col_w_px) : px(f.w_px - 2 * f.col_x_px);

  // ── Left column: eyebrow → title → bullets, vertically centred ──
  const eyebrow = strip(data.section).toUpperCase();
  const titleTxt = strip(data.title);
  const T_E = pt(f.eyebrow_px), T_T = pt(f.title_px), T_B = pt(f.bullet_px);
  const LH_E = px(f.eyebrow_lh_px), LH_T = px(f.title_lh_px), LH_B = px(f.bullet_lh_px);
  const indent = px(f.bullet_indent_px);
  const plain = !!opts.lines;
  const items = (opts.lines ?? data.bullets ?? []).filter((b: string) => strip(b));
  r.setFont(true, T_T);
  const tLines = r.wrapText(titleTxt, colW);
  const bTextW = plain ? colW : colW - indent;
  const bLines = items.map((b: string) => richLines(r, b, bTextW, T_B));
  const titleH = tLines.length * LH_T;
  const bulH = bLines.reduce((a: number, l: RichRun[][]) => a + l.length * LH_B, 0)
    + px(f.bullet_gap_px) * Math.max(0, bLines.length - 1);
  const eyeH = eyebrow ? LH_E + px(f.eyebrow_gap_px) : 0;
  const blockH = eyeH + titleH + (items.length ? px(f.title_gap_px) + bulH : 0);
  let y = colY + Math.max(0, (colH - blockH) / 2);

  if (eyebrow) {
    r.setFont(true, T_E); r.setColor(cAcc);
    drawTracked(r, eyebrow, colX, y, LH_E, T_E, f.eyebrow_tracking_em ?? 0.2);
    y += eyeH;
  }
  r.setFont(true, T_T); r.setColor(cText);
  for (const ln of tLines) { r.cell(colW, LH_T, ln, colX, y, 'L'); y += LH_T; }
  if (items.length) y += px(f.title_gap_px);
  bLines.forEach((lines: RichRun[][], bi: number) => {
    if (!plain) r.drawTriangle(colX + px(5), y + LH_B / 2, px(7), cAcc);
    for (const ln of lines) {
      let bx = colX + (plain ? 0 : indent);
      for (const run of ln) {
        r.setFont(run.b, T_B); r.setColor(run.b ? cAcc : cBody);
        if (run.t) r.cell(1, LH_B, run.t, bx, y, 'L');
        bx += richRunW(r, run, T_B);
      }
      y += LH_B;
    }
    if (bi < bLines.length - 1) y += px(f.bullet_gap_px);
  });

  // ── Right panel: tinted rounded box, image (contain) + caption, centred ──
  if (twoCol) {
    const pX = fx + px(f.panel_x_px), pY = colY, pW = px(f.panel_w_px), pH = colH;
    const tint = f.panel_rgba ?? [255, 255, 255, 0.03];
    r.drawRoundedRect(pX, pY, pW, pH, px(f.panel_radius_px ?? 12), C(tint.slice(0, 3)), tint[3] ?? 0.03);
    const pad = px(f.panel_pad_px ?? 12);
    const cap = strip(data.visualCaption);
    const T_C = pt(f.caption_px), LH_C = px(f.caption_lh_px);
    r.setFont(false, T_C);
    const capLines = cap ? r.wrapText(cap, pW - pad * 2) : [];
    const capH = capLines.length ? px(f.caption_gap_px) + capLines.length * LH_C : 0;
    const boxW = pW - pad * 2, boxH = pH - pad * 2 - capH;
    const asp = visImg.width / visImg.height;
    let iw = boxW, ih = iw / asp;
    if (ih > boxH) { ih = boxH; iw = ih * asp; }
    const groupY = pY + pad + (pH - pad * 2 - (ih + capH)) / 2;
    r.drawEmbeddedImage(visImg, pX + (pW - iw) / 2, groupY, iw, ih);
    let cy = groupY + ih + (capLines.length ? px(f.caption_gap_px) : 0);
    r.setFont(false, T_C); r.setColor(cMuted);
    for (const ln of capLines) { r.cell(pW - pad * 2, LH_C, ln, pX + pad, cy, 'C'); cy += LH_C; }
  }
}

// Framed cover (HTML .slide[data-type="title"]): centred eyebrow → title →
// subtitle → meta stack on the scrimmed photo, cover caption bottom-right.
// Sizes/gaps are the measured HTML px (1280×720) of the pitch-enhanced cover.
function renderFramedTitle(ctx: RenderCtx) {
  const { r, data, spec, coords, colors } = ctx;
  const { f, px, pt, fx, fy, fw, fh } = frameGeom(spec, coords);
  const innerW = px(722);
  const x0 = fx + (fw - innerW) / 2;
  const eyebrow = strip(data.section).toUpperCase();
  const title = strip(data.title), sub = strip(data.subtitle), meta = strip(data.meta);
  // PDF glyph advances run slightly wider than the browser's; wrap the title
  // at the frame inner width so a one-line HTML title stays one line.
  const titleW = fw - px(112);
  r.setFont(true, pt(52));  const tL = r.wrapText(title, titleW);
  r.setFont(false, pt(22)); const sL = sub ? r.wrapText(sub, px(560)) : [];
  r.setFont(false, pt(14)); const mL = meta ? r.wrapText(meta, innerW) : [];
  const h = (eyebrow ? px(15 + 24) : 0) + tL.length * px(62)
    + (sL.length ? px(25) + sL.length * px(35) : 0) + (mL.length ? px(24) + mL.length * px(17) : 0);
  let y = fy + (fh - h) / 2;
  if (eyebrow) {
    r.setFont(true, pt(12.8)); r.setColor(colors.C_ACCENT);
    const tw = Array.from(eyebrow).reduce((a, ch) => a + r.stringWidth(ch), 0) + (pt(12.8) / MM_TO_PT) * 0.2 * (Array.from(eyebrow).length - 1);
    drawTracked(r, eyebrow, fx + (fw - tw) / 2, y, px(15), pt(12.8), 0.2);
    y += px(15 + 24);
  }
  r.setFont(true, pt(52)); r.setColor(toRGB(f.text_rgb));
  for (const l of tL) { r.cell(titleW, px(62), l, fx + px(56), y, 'C'); y += px(62); }
  if (sL.length) {
    y += px(25); r.setFont(false, pt(22)); r.setColor(toRGB(f.body_rgb));
    for (const l of sL) { r.cell(innerW, px(35), l, x0, y, 'C'); y += px(35); }
  }
  if (mL.length) {
    y += px(24); r.setFont(false, pt(14)); r.setColor(toRGB(f.muted_rgb));
    for (const l of mL) { r.cell(innerW, px(17), l, x0, y, 'C'); y += px(17); }
  }
  const cap = strip(data.visualCaption);
  if (cap) {
    r.setFont(false, pt(11)); r.setColor(toRGB(f.muted_rgb));
    r.cell(px(400), px(15), cap, fx + fw - px(20) - px(400), fy + fh - px(15) - px(14.4), 'R');
  }
}

// Framed divider (HTML .divider-left / .divider-right halves of the frame).
async function renderFramedDivider(ctx: RenderCtx) {
  const { r, doc, data, imgDir, spec, coords, colors } = ctx;
  const { f, px, pt, fx, fy, fw, fh } = frameGeom(spec, coords);
  const half = fw / 2;
  const ip = imgPath(data.visualImage, imgDir ?? '');
  if (ip) await r.placeImageCover(doc, ip, fx + half, fy, half, fh);
  r.fillRectOverlay(fx, fy, half, fh, rgb(0, 0, 0), 0.2);
  const tx = fx + px(64), tw = px(477);
  const part = strip(data.partNum || data.section).toUpperCase();
  const title = strip(data.title), desc = strip(data.desc ?? '');
  r.setFont(true, pt(44.8)); const tL = r.wrapText(title, tw);
  r.setFont(false, pt(16));  const dL = desc ? r.wrapText(desc, tw) : [];
  const h = (part ? px(14 + 16) : 0) + tL.length * px(54) + (dL.length ? px(24) + dL.length * px(26) : 0);
  let y = fy + (fh - h) / 2;
  if (part) {
    r.setFont(true, pt(12)); r.setColor(colors.C_ACCENT);
    drawTracked(r, part, tx, y, px(14), pt(12), 0.2);
    y += px(14 + 16);
  }
  r.setFont(true, pt(44.8)); r.setColor(toRGB(f.text_rgb));
  for (const l of tL) { r.cell(tw, px(54), l, tx, y, 'L'); y += px(54); }
  if (dL.length) {
    y += px(24); r.setFont(false, pt(16)); r.setColor(toRGB(f.body_rgb));
    for (const l of dL) { r.cell(tw, px(26), l, tx, y, 'L'); y += px(26); }
  }
}

async function renderStandardSlide(ctx: RenderCtx) {
  // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks route here
  // (video slides fall through to the legacy path for the play button, with
  // framed geometry tweaks below).
  if (ctx.spec.frame && !ctx.data.videoId) return renderFramedStandard(ctx);
  const { r, doc, data, n, total, imgDir, spec, coords, colors, sizes, declared, region } = ctx;
  const { C_DARK, C_ACCENT, C_MUTED, C_BORDER, C_WHITE, C_BODY, C_VIS_BG } = colors;
  const {
    T_SECT, T_NUM, T_TITLE, T_BUL, T_VIS_T, T_VIS_B,
    LH_TITLE, LH_BULLET, LH_BULLET_GAP, LH_VIS_TITLE, LH_VIS_BODY,
  } = sizes;

  // Resolve the regions this standard slide type declares. Some themes omit
  // header/meta/visual — access defensively for those.
  const headerR  = tryRegion(ctx, 'header');
  const titleR   = tryRegion(ctx, 'title')   ?? (headerR ? { x: headerR.x, y: headerR.y + headerR.h + coords.px2mm(8), w: headerR.w, h: 30 } : null)!;
  const contentR = tryRegion(ctx, 'content') ?? titleR;
  const visR     = tryRegion(ctx, 'visual');
  const metaR    = tryRegion(ctx, 'meta');

  if (headerR) {
    drawHeaderBar(r, strip(data.section), n, total, headerR, contentR, titleR.x, coords.CY, C_DARK, C_ACCENT, C_MUTED, C_BORDER, T_SECT, T_NUM);
  }

  // data.visual (text description) maps to visualDisplay; "none" is excluded.
  const rawVisual = data.visual && data.visual.toLowerCase() !== 'none' ? data.visual : undefined;
  const visualDisplay = data.visualDisplay || (!data.visualImage ? rawVisual : undefined);

  // v1.11.0 — background-image layering (individual-scope decks): when the
  // generic per-slide step already drew this slide's own full-bleed background
  // photo + dark wash, the "visual" must NOT repaint the page. The zen theme's
  // standard "visual" region is the FULL PAGE (x0 y0 w1 h1), so the old
  // C_VIS_BG panel + photo repaint here painted straight over the white
  // C_CARD bubble and all text drawn moments earlier — the photo survived,
  // the content vanished (Gate 5 defect: bubble/text invisible on slides 2-3,
  // blank navy on the journey-map slide). Decks WITHOUT a per-slide background
  // keep the legacy full-bleed visual panel below, unchanged.
  const bgDrawn = ctx.bgDrawn === true;
  const visualIsBackground = !!data.visualImage && !!data.backgroundImage
    && data.visualImage === data.backgroundImage;
  // LOCAL-PATCH(upstream-request: U-20261105-002) F1 — full-page-cover guard:
  // a visual region that CONTAINS the content region (zen: 0,0,100%,100%) can
  // never host a side panel; route to the in-card path even when bgDrawn=false
  // (extends the v1.11.0 bgDrawn-only condition). Containment uses a ±0.5 mm
  // float epsilon.
  const visCoversContent = !!visR
    && visR.x <= contentR.x + 0.5 && visR.y <= contentR.y + 0.5
    && (visR.x + visR.w) >= (contentR.x + contentR.w) - 0.5
    && (visR.y + visR.h) >= (contentR.y + contentR.h) - 0.5;
  const forceInCard = bgDrawn || visCoversContent;
  // With the background drawn (or a full-page-cover visual): a visual that IS
  // the background is redundant (HTML draws the photo once as the bg and
  // floats the bubble on top); any OTHER visual is a diagram embedded inside
  // the card under the bullets.
  const diagramRaster = forceInCard && !visualIsBackground && !data.videoId
    ? resolveVisualRaster(data.visualImage, imgDir ?? '', ctx.fontDir ?? imgDir ?? '')
    : null;
  const hasRight = !forceInCard && !!(data.visualImage || visualDisplay || data.visualTitle) && !!visR;
  const titleW   = titleR.w;
  const bulTxtW  = hasRight ? Math.min(contentR.w, visR!.x - contentR.x - 6) : contentR.w;

  // HTML .slide-content uses justify-content: center — vertically center the
  // [title + gap + bullets] block as a unit in the available area below the header.
  const headerBottom = headerR ? headerR.y + headerR.h : coords.CY;
  const cardBottom   = coords.CY + coords.CH - coords.px2mm(8);
  const availStart   = headerBottom + coords.px2mm(8);
  const availH       = cardBottom - availStart;

  // Video slides (data.videoId) get a clean thumbnail + play button (see
  // below) instead of the usual title/bullets overlay — the title bar and
  // any "Link: youtube.com/watch?v=..." bullet are both redundant once the
  // button itself is the call to action.
  const bullets = data.videoId ? [] : (data.bullets ?? []);
  if (!data.videoId && forceInCard) {
    // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.2 — hugging card (HTML
    // `.slide-content { width: fit-content; max-width: 88% }` parity). Width =
    // max(title, bullets column, visual, panel) + horizontal padding, capped at
    // 88% of the page, centered; height = content + vertical padding, centered
    // in the 5-95% band. HTML px (1280px frame) are scaled via coords.px2mm.
    const px = (v: number) => coords.px2mm(v);
    const padX = px(44), padY = px(32);                 // HTML padding 2rem 2.75rem
    const maxCardW = cardCapMm(coords);
    const innerMax = maxCardW - padX * 2;
    const titleTxt = strip(data.title);
    const titleW   = widestWrappedLine(r, titleTxt, innerMax, T_TITLE, true);
    const titleH   = r.estimateTextHeight(titleTxt, innerMax, T_TITLE, LH_TITLE, true);

    // Bullets column: CSS shrink-to-fit = min(max-content, max-width 600px).
    const bTxts = bullets.filter((b: string) => strip(b));   // raw (rich) strings
    const mi = (T_BUL / MM_TO_PT) * 1.1;                // hanging-indent marker (1.1em)
    const bulBox = Math.min(px(600), innerMax);
    r.setFont(false, T_BUL);
    let maxUn = 0, anyWrap = false;
    for (const t of bTxts) {
      const w = richWidth(r, richRuns(t), T_BUL);
      maxUn = Math.max(maxUn, w);
      if (mi + w > bulBox) anyWrap = true;
    }
    let bulCol = bTxts.length ? (anyWrap ? bulBox : mi + maxUn) : 0;

    // Visual: raster diagram wrapper = min(760px, 72vw) wide; text panel <= 600px.
    const visTitleTxt = !diagramRaster ? strip(data.visualTitle) : '';
    const visBodyTxt  = !diagramRaster ? strip((visualDisplay ?? '').replace(/<br\s*\/?>/gi, '\n')) : '';
    const visTxtOn    = !!(visTitleTxt || visBodyTxt);
    const panelPad    = px(19.2) + px(2);               // 1.2rem + half border (accent bar 3px + 1px)
    let panelW = 0, panelInner = 0;
    if (visTxtOn) {
      r.setFont(true, T_VIS_T);
      let un = visTitleTxt ? r.stringWidth(visTitleTxt) : 0;
      r.setFont(false, T_VIS_B);
      for (const ln of visBodyTxt.split('\n')) un = Math.max(un, r.stringWidth(ln));
      panelW = Math.min(px(600), innerMax, un + panelPad * 2);
      panelInner = panelW - panelPad * 2 + 0.01;
      // `:has(.zen-visual-panel)` makes the bullets column width:100% (<= 600px)
      bulCol = Math.min(bulBox, Math.max(titleW, bulCol, panelW));
    }
    const bulTextW = Math.max(10, bulCol - mi) + 0.01;
    const bLines  = bTxts.map((t: string) => richLines(r, t, bulTextW, T_BUL));
    const totalBh = bTxts.length ? bLines.reduce((a: number, l: RichRun[][]) => a + l.length * LH_BULLET, 0) + LH_BULLET_GAP * (bTxts.length - 1) : 0;
    const gap1 = bTxts.length > 0 ? px(12) : 0;         // title -> bullets (HTML flex gap .75rem)

    const cardMaxH = coords.PH * 0.90;                  // keep >= 5% page margin top/bottom
    let diagramImg: any = null;
    let visW = 0, boxH = 0, diaW = 0, diaH = 0, gap2 = 0;
    // Diagram caption (14px) + source (12px) siblings under the diagram (HTML
    // .zen-visual-caption / -source: centered, muted navy, 4px / 2.4px margin-top).
    const capTxt = diagramRaster ? strip(data.visualCaption) : '';
    const srcTxt = diagramRaster ? strip(data.visualSource) : '';
    const fpt = spec.calibration?.font_px_to_pt ?? 0.85;
    const T_CAP = 14 * fpt, T_SRC = 12 * fpt;
    const capH = capTxt ? px(16) : 0, srcH = srcTxt ? px(14) : 0;
    const capBlockH = (capTxt ? px(16) + capH : 0) + (srcTxt ? px(14.4) + srcH : 0);   // gap 12 + margin
    if (diagramRaster) {
      try {
        diagramImg = await r.embedImg(doc, diagramRaster);
        const asp = diagramImg.width / diagramImg.height;
        visW = Math.min(px(760), innerMax);
        boxH = Math.min(visW / asp, px(216));           // img max-height 24vh
        gap2 = px(12);
        const availForDia = cardMaxH - 2 * padY - (titleH + gap1 + totalBh) - gap2 - capBlockH;
        if (boxH > availForDia && availForDia > 24) boxH = availForDia;
        diaW = Math.min(visW, boxH * asp);              // object-fit: contain inside the box
        diaH = diaW / asp;
      } catch (e: any) {
        console.warn(`  diagram embed err (slide ${ctx.n}): ${e.message}`);
        diagramImg = null; visW = 0; boxH = 0; gap2 = 0;
      }
    }
    const capOn = !!diagramImg;
    const visTxtGap = px(28);
    const visInnerGap = (visTitleTxt && visBodyTxt) ? px(6.4) : 0;   // heading margin-bottom .4rem
    const panelPadY = px(14.4) + px(1);                 // .9rem + 1px border
    const hVt = visTitleTxt ? r.estimateTextHeight(visTitleTxt, panelInner, T_VIS_T, LH_VIS_TITLE, true) : 0;
    const hVb = visBodyTxt  ? r.estimateTextHeight(visBodyTxt,  panelInner, T_VIS_B, LH_VIS_BODY, false) : 0;
    const visTxtH = visTxtOn ? hVt + visInnerGap + hVb + panelPadY * 2 : 0;

    const blockH = titleH + gap1 + totalBh + (diagramImg ? gap2 + boxH + capBlockH : 0) + (visTxtH > 0 ? visTxtGap + visTxtH : 0);
    const cardInnerW = Math.max(titleW, bulCol, diagramImg ? visW : 0, panelW);
    const cardW  = Math.min(cardInnerW + padX * 2, maxCardW);
    const cardX  = coords.CX + (coords.CW - cardW) / 2;
    const cardH  = Math.min(blockH + padY * 2, cardMaxH);
    const cardY  = Math.min(coords.PH * 0.95 - cardH, Math.max(coords.PH * 0.05, (coords.PH - cardH) / 2));
    logCard(ctx, cardX, cardY, cardW, cardH);
    r.drawRoundedRect(cardX, cardY, cardW, cardH, px(14), colors.C_CARD, 0.97);   // HTML radius 14px
    const onCardText  = readableTextOn(colors.C_CARD);
    const onCardMuted = readableMutedOn(colors.C_CARD);

    const innerX = cardX + padX, innerW = cardW - padX * 2;
    r.setFont(true, T_TITLE); r.setColor(onCardText);
    let by = r.multiCell(innerW + 0.01, LH_TITLE, titleTxt, innerX, cardY + padY, 'C') + gap1;

    const bulX = cardX + (cardW - bulCol) / 2;          // column centered, text left-aligned
    bLines.forEach((lines: RichRun[][], bi: number) => {
      r.drawEllipse(bulX + mi * 0.1, by + (LH_BULLET - px(6)) / 2, px(6), C_ACCENT);
      for (const ln of lines) {
        let bx = bulX + mi;
        for (const run of ln) {
          r.setFont(run.b, T_BUL); r.setColor(run.b ? C_ACCENT : onCardMuted);
          if (run.t) r.cell(1, LH_BULLET, run.t, bx, by, 'L');
          bx += richRunW(r, run, T_BUL);
        }
        by += LH_BULLET;
      }
      if (bi < bLines.length - 1) by += LH_BULLET_GAP;
    });

    if (diagramImg) {
      const dy = by + gap2 + (boxH - diaH) / 2;
      r.drawEmbeddedImage(diagramImg, cardX + (cardW - diaW) / 2, dy, diaW, diaH);
      let cy = by + gap2 + boxH;
      if (capOn && capTxt) {
        cy += px(16);
        r.setFont(false, T_CAP); r.setColor(onCardMuted);
        r.cell(innerW, capH, capTxt, innerX, cy, 'C'); cy += capH;
      }
      if (capOn && srcTxt) {
        cy += px(14.4);
        r.setFont(false, T_SRC); r.setColor(colors.C_MUTED);
        r.cell(innerW, srcH, srcTxt, innerX, cy, 'C');
      }
    }
    if (visTxtH > 0) {
      let vy = by + visTxtGap;
      const panelX = cardX + (cardW - panelW) / 2;
      r.fillRectOverlay(panelX, vy, panelW, visTxtH, C_ACCENT, 0.07);
      r.fillRect(panelX, vy, px(3), visTxtH, C_ACCENT);
      vy += panelPadY;
      const vx = panelX + panelPad;
      if (visTitleTxt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(panelInner, LH_VIS_TITLE, visTitleTxt, vx, vy, 'L') + visInnerGap;
      }
      if (visBodyTxt) {
        r.setFont(false, T_VIS_B); r.setColor(onCardText);
        r.multiCell(panelInner, LH_VIS_BODY, visBodyTxt, vx, vy, 'L');
      }
    }
  } else if (!data.videoId) {
    // LOCAL-PATCH(upstream-request: U-20261119-007) (Gate 5, 2026-11-19; pitch-enhanced two-column overflow): the
    // page-centered hug card ran from contentR.x through visR.x, and the right
    // visual panel (painted AFTER the text) covered the card's right portion —
    // title/bullet ink clipped mid-glyph. Anchor the card inside the text
    // column [contentR.x, visR.x] and wrap title/bullets to the card inner
    // width so no line crosses visR.x. Single-column decks keep legacy widths.
    const padXCol  = coords.px2mm(40);
    const colW     = hasRight ? (visR!.x - contentR.x) : coords.CW - coords.px2mm(8);
    const drawTitleW = hasRight ? Math.max(20, colW - padXCol * 2) : titleW;
    const drawBulW   = hasRight ? Math.max(20, colW - padXCol * 2 - 6 - coords.px2mm(24))
                                : bulTxtW - 6;
    const titleH   = r.estimateTextHeight(strip(data.title), drawTitleW, T_TITLE, LH_TITLE, true);
    const totalBh  = r.estimateBulletHeight(bullets, drawBulW, T_BUL, LH_BULLET, LH_BULLET_GAP);
    const blockGap = bullets.length > 0 ? coords.px2mm(24) : 0;

    const cardMaxH = (coords.PH ?? 0) * 0.90;
    // Diagram slides: embed the visual INSIDE the white card under the
    // bullets (HTML zen layout — the diagram sits in the bubble, not on a
    // full-bleed panel). Embed first so the card height can include it;
    // an unresolvable diagram is skipped (no placeholder panel).
    let diagramImg: any = null;
    let diaW = 0, diaH = 0, diaGap = 0;
    if (diagramRaster) {
      try {
        diagramImg = await r.embedImg(doc, diagramRaster);
        const asp = diagramImg.width / diagramImg.height;
        diaW = Math.max(30, bulTxtW);
        diaH = diaW / asp;
        // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.1 — keep the card
        // >= 5% of page height away from the top and bottom page edges: the diagram
        // shrinks to fit (title + bullets + diagram + card padding <= 90% PH).
        const availForDia = Math.min(
          availH - (titleH + blockGap + totalBh) - coords.px2mm(40),
          cardMaxH - 2 * coords.px2mm(28) - (titleH + blockGap + totalBh) - coords.px2mm(28));
        if (diaH > availForDia && availForDia > 24) {
          diaH = availForDia;
          diaW = diaH * asp;
        }
        diaGap = coords.px2mm(28);
      } catch (e: any) {
        console.warn(`  diagram embed err (slide ${ctx.n}): ${e.message}`);
        diagramImg = null;
      }
    }

    // LOCAL-PATCH(upstream-request: U-20261105-002) F1 — in-card text-visual:
    // with forceInCard and NO raster diagram, visualTitle/visualDisplay would
    // silently vanish (the legacy full-page C_VIS_BG text panel never fires).
    // Render the checklist text INSIDE the white card under the bullets,
    // parallel to the diagram embed; height included in blockH so vertical
    // centering accounts for it (same pattern as diaH). Ink colors
    // (onCardText), NOT the legacy C_WHITE tuned for the dark C_VIS_BG panel.
    // If both a raster diagram and visual text exist, the diagram wins and
    // text is skipped.
    const visTitleTxt = forceInCard && !diagramRaster ? strip(data.visualTitle) : '';
    const visBodyTxt  = forceInCard && !diagramRaster
      ? strip((visualDisplay ?? '').replace(/<br\s*\/?>/gi, '\n')) : '';
    const visTxtOn    = !!(visTitleTxt || visBodyTxt);
    const visTxtGap   = coords.px2mm(28);   // same spacing as the diagram embed
    const visInnerGap = (visTitleTxt && visBodyTxt) ? 5 : 0;
    const hVt = visTitleTxt ? r.estimateTextHeight(visTitleTxt, drawBulW, T_VIS_T, LH_VIS_TITLE, true) : 0;
    const hVb = visBodyTxt  ? r.estimateTextHeight(visBodyTxt,  drawBulW, T_VIS_B, LH_VIS_BODY, false) : 0;
    const visTxtH = visTxtOn ? hVt + visInnerGap + hVb : 0;

    const blockH   = titleH + blockGap + totalBh + (diagramImg ? diaGap + diaH : 0) + (visTxtH > 0 ? visTxtGap + visTxtH : 0);
    const pageH_mm = coords.PH;
    const cardMinY = pageH_mm * 0.05, cardMaxY = pageH_mm * 0.95;
    // center the card (block + padding) vertically within the 5%..95% band
    const blockY   = Math.max(cardMinY + coords.px2mm(28),
                       Math.min(availStart + Math.max(0, (availH - blockH) * 0.5),
                                cardMaxY - coords.px2mm(28) - blockH));

    // Content "card": a translucent panel behind the title/bullets block,
    // matching the HTML deck's white-bubble .slide-content box (which the PDF
    // previously never drew — text floated directly on the photo). Sized to
    // the text column (not the full slide) like the HTML's fit-content card,
    // clamped to stay inside the printable card area.
    const padX   = coords.px2mm(40);
    const padY   = coords.px2mm(28);
    const cardW0 = hasRight
      ? colW
      : Math.min(titleW + padX * 2, coords.CW - coords.px2mm(8));
    // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.1 — card centered horizontally (HTML parity)
    // Gate 5 patch (see above): two-column slides anchor the card at the text
    // column instead of page-centering it under the right visual panel.
    const cardX  = hasRight ? contentR.x : coords.CX + (coords.CW - cardW0) / 2;
    const cardW  = cardW0;
    const cardY  = Math.max(cardMinY, blockY - padY);
    const cardH  = Math.min(blockH + padY * 2, cardMaxY - cardY);
    logCard(ctx, cardX, cardY, cardW, cardH);
    r.fillRectOverlay(cardX, cardY, cardW, cardH, colors.C_CARD, 0.94);
    const onCardText  = readableTextOn(colors.C_CARD);
    const onCardMuted = readableMutedOn(colors.C_CARD);

    r.setFont(true, T_TITLE); r.setColor(onCardText);
    const afterTitle = r.multiCell(cardW - padX * 2, LH_TITLE, strip(data.title), cardX + padX, blockY, 'C');

    let by = afterTitle + blockGap;
    for (const b of bullets) {
      const txt = strip(b);
      if (!txt) continue;
      if (by > cardBottom) break;
      r.drawEllipse(cardX + padX, by + LH_BULLET * 0.28, 3.2, C_ACCENT);
      r.setFont(false, T_BUL); r.setColor(onCardMuted);
      const afterBul = r.multiCell(drawBulW, LH_BULLET, txt, cardX + padX + 6, by, 'L');
      by = afterBul + LH_BULLET_GAP;
    }

    if (diagramImg) {
      // Center the diagram horizontally in the card, below the bullets; clamp
      // the top edge so a clamped-height diagram can never overlap the text.
      const dx = cardX + (cardW - diaW) / 2;
      const dy = Math.min(by + diaGap, cardY + cardH - padY - diaH);
      r.drawEmbeddedImage(diagramImg, dx, dy, diaW, diaH);
    }

    // LOCAL-PATCH(upstream-request: U-20261105-002) F1 — draw the in-card
    // checklist text (visualTitle accent + visualDisplay ink on-card) under
    // the bullets; top edge clamped so it can never overlap the text above.
    if (visTxtH > 0) {
      let vy = Math.min(by + visTxtGap, cardY + cardH - padY - visTxtH);
      if (visTitleTxt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(drawBulW, LH_VIS_TITLE, visTitleTxt, cardX + padX, vy, 'L') + visInnerGap;
      }
      if (visBodyTxt) {
        r.setFont(false, T_VIS_B); r.setColor(onCardText);
        r.multiCell(drawBulW, LH_VIS_BODY, visBodyTxt, cardX + padX, vy, 'L');
      }
    }
  }

  if (hasRight) {
    const ip = imgPath(data.visualImage, imgDir ?? '');
    if (ip) {
      const pad = visR!.w * 0.052;
      r.fillRect(visR!.x, visR!.y, visR!.w, visR!.h, C_VIS_BG);
      await r.placeImage(doc, ip, visR!.x + pad, visR!.y + pad, visR!.w - pad * 2, visR!.h - pad * 2);
    } else {
      r.fillRect(visR!.x, visR!.y, visR!.w, visR!.h, C_VIS_BG);
      const vt = strip(data.visualTitle);
      const vd = strip((visualDisplay ?? '').replace(/<br\s*\/?>/gi, '\n'));
      const gap = 5;
      // CSS-derived inner padding: read visual_inner_padding_px from spec (e.g. 24px for 1.5rem),
      // with a 2mm minimum floor for readability when CSS padding is 0.
      const visPad = Math.max(2, coords.px2mm(ctx.spec.visual_inner_padding_px ?? 0));
      const hVt = vt ? r.estimateTextHeight(vt, visR!.w - visPad * 2, T_VIS_T, LH_VIS_TITLE, true)  : 0;
      const hVb = vd ? r.estimateTextHeight(vd, visR!.w - visPad * 2, T_VIS_B, LH_VIS_BODY, false) : 0;
      const totalH = hVt + (vt && vd ? gap : 0) + hVb;
      let vy = visR!.y + visPad + Math.max(0, (visR!.h - visPad * 2 - totalH) / 2);
      if (vt) {
        r.setFont(true,  T_VIS_T); r.setColor(C_ACCENT);
        vy = r.multiCell(visR!.w - visPad * 2, LH_VIS_TITLE, vt, visR!.x + visPad, vy, 'L') + gap;
      }
      if (vd) {
        r.setFont(true, T_VIS_B); r.setColor(C_WHITE);
        r.multiCell(visR!.w - visPad * 2, LH_VIS_BODY, vd, visR!.x + visPad, vy, 'L');
      }
    }
  }

  if (metaR && !headerR) {
    // Slide counter — skip when headerR is present since drawHeaderBar already
    // renders the number on the right side of the header bar.
    r.setFont(false, T_NUM); r.setColor(C_MUTED);
    r.cell(metaR.w, metaR.h, `${n} / ${total}`, metaR.x, metaR.y, 'R');
  }

  // Video slide — standing project rule (docs/co-deck.context.md "Video Rules"):
  // HTML plays the local assets/videos/yt-<id>.mp4 file; the PDF export NEVER
  // embeds or references a local video file, regardless of whether one exists
  // on disk. It always draws a play button over the (already full-bleed)
  // thumbnail background and makes that spot a clickable link to the YouTube
  // video — PDF viewers can't play embedded web video, so "click the button
  // to watch on YouTube" is the PDF-appropriate equivalent of the HTML deck's
  // inline local player, not a lesser fallback. Do not add a local-file code
  // path here even if `data.videoLocal` or similar becomes available.
  if (data.videoId) {
    // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks center the
    // play button on the frame, not the page.
    const vg = spec.frame ? frameGeom(spec, coords) : null;
    const diam = vg ? Math.min(vg.fw, vg.fh) * 0.22 : Math.min(coords.CW, coords.CH) * 0.22;
    const cx = vg ? vg.fx + vg.fw / 2 : coords.CX + coords.CW / 2;
    const cy = vg ? vg.fy + vg.fh / 2 : coords.CY + coords.CH / 2;
    // Title pill — HTML video slides show the title in a dark translucent chip
    // at the top center of the thumbnail; reproduce that chip (rounded rect,
    // white text) so the PDF page identifies the video it links to.
    const pillText = strip(data.title);
    if (pillText && spec.frame) {
      // LOCAL-PATCH(upstream-request: U-20261119-010) — Framed: HTML
      // .video-caption — bottom-left line, white 85%, 13.6px.
      const g = frameGeom(spec, coords);
      r.setFont(false, g.pt(13.6)); r.setColor(rgb(0.92, 0.93, 0.95));
      r.cell(g.fw - g.px(46), g.px(20), pillText, g.fx + g.px(23), g.fy + g.fh - g.px(40), 'L');
    } else if (pillText) {
      r.setFont(false, T_BUL);
      const pillPadX  = coords.px2mm(16);
      const pillMaxW  = coords.CW * 0.86;
      const pillLines = r.wrapText(pillText, pillMaxW - pillPadX * 2);
      const pillW     = Math.min(pillMaxW,
        Math.max(...pillLines.map(l => r.stringWidth(l))) + pillPadX * 2);
      const pillH     = pillLines.length * LH_BULLET + coords.px2mm(10);
      const pillX     = coords.CX + (coords.CW - pillW) / 2;
      const pillY     = coords.CY + coords.px2mm(12);
      r.drawRoundedRect(pillX, pillY, pillW, pillH, coords.px2mm(8),
        rgb(0, 0, 0), 0.55);
      r.setFont(false, T_BUL); r.setColor(C_WHITE);
      let py = pillY + coords.px2mm(5);
      for (const line of pillLines) {
        r.cell(pillW, LH_BULLET, line, pillX, py, 'C');
        py += LH_BULLET;
      }
    }
    r.drawPlayButton(cx, cy, diam);
    // HTML .video-stage covers the whole slide (inset: 0) — make the ENTIRE
    // page the clickable link, not just the button pad.
    r.addLinkAnnotation(
      doc, coords.CX, coords.CY, coords.CW, coords.CH,
      `https://www.youtube.com/watch?v=${data.videoId}`
    );
  }
}

// Resolve a region WITHOUT erroring if it's not declared by this slide type.
// Used by renderers to support optional regions (subtitle, meta, header) without
// forcing every theme to declare them.
function tryRegion(ctx: RenderCtx, name: string): ResolvedRegion | null {
  if (!ctx.declared.includes(name)) return null;
  try {
    return ctx.region(name);
  } catch {
    return null;
  }
}

// ── Region resolver (theme-agnostic) ──────────────────────────────────────────

function buildCoords(spec: LayoutSpec) {
  const PW  = spec.page?.width_mm  ?? 338.7;
  const PH  = spec.page?.height_mm ?? 190.5;
  const CM  = spec.page?.margin_mm ?? 0.0;
  const VP  = spec.calibration?.viewport_px ?? 611.4;

  const CX = CM, CY = CM;
  const CW = PW - CM * 2;
  const CH = PH - CM * 2;

  const px2pt = (px: number) => (px / VP) * CH * 2.835;
  const px2mm = (px: number) => (px / VP) * CH;

  const regions       = spec.regions ?? {};
  const typeOverrides = spec.slide_type_overrides ?? {};

  // Resolve a region for a given slide type. Resolution order:
  //   1. slide_type_overrides[type][name]  (per-slide-type value)
  //   2. regions[name]                       (theme-wide value)
  // A null at either level means "this region is not defined for this slide".
  // Throws loudly if both are absent/null (AC-7: no silent empty rendering).
  const region = (name: string, slideType?: string): ResolvedRegion => {
    let raw: Region | null | undefined;
    if (slideType && typeOverrides[slideType]) {
      raw = typeOverrides[slideType][name];
    }
    if (raw === undefined) raw = regions[name] ?? null;
    if (raw === null || raw === undefined) {
      throw new Error(
        `${RESOLVE_ERROR_PREFIX}Required region "${name}"${
          slideType ? ` for slide_type "${slideType}"` : ''
        } is not defined. Check regions.* / slide_type_overrides in pdf_layout_spec.json.`,
      );
    }
    return {
      x: CX + raw.x_pct * CW,
      y: CY + raw.y_pct * CH,
      w: raw.w_pct * CW,
      h: raw.h_pct * CH,
      fit: raw.fit,
    };
  };

  return {
    PW, PH, CM, CX, CY, CW, CH,
    px2pt, px2mm,
    region,
    // Back-compat helpers for code paths that still want page-level constants.
    pageW: PW, pageH: PH,
  };
}

// ── Color builder ─────────────────────────────────────────────────────────────

function buildColors(spec: LayoutSpec) {
// Color key resolution mirrors the pre-rewrite buildColors exactly so pre-rewrite
// rendering is preserved bit-for-bit. The pre-rewrite code looked up short
  // keys (dark, dark2, dark3, text, body, vis_bg, meta); style pdf_color_spec
  // uses long keys (card_dark*, text_*), so most roles fall through to the
  // hardcoded defaults unless a project override provides the short key.
  const c = spec.colors ?? {};
  return {
    C_BG     : toRGB(c.background  ?? [17,  24,  39]),
    C_WHITE  : toRGB(c.white       ?? [255, 255, 255]),
    C_DARK   : toRGB(c.dark        ?? [11,  15,  25]),
    C_TEXT   : toRGB(c.text        ?? [226, 232, 240]),
    C_MUTED  : toRGB(c.text_muted  ?? [156, 163, 175]),
    C_ACCENT : toRGB(c.accent      ?? [217, 119, 6]),
    C_BORDER : toRGB(c.border      ?? [31,  41,  55]),
    // LOCAL-PATCH(upstream-request: U-20261105-002) — C_BODY spec-key fallback:
    // classic/pdf_color_spec.json names the role `text_body`, not `body`, so
    // C_BODY never resolved from the spec and stayed light-slate [203,213,225]
    // (≈1.15:1 on the warm wash) — S1 title subtitle/meta (R1), S59 punchline
    // sub (F4) and S60 contact lines (R2) at full export. Accept both keys;
    // all four C_BODY draw sites are light/wash backgrounds (standard-slide
    // card text uses C_TEXT — no navy-card regression).
    C_BODY   : toRGB(c.body ?? c.text_body ?? [203, 213, 225]),
    C_VIS_BG : toRGB(c.vis_bg      ?? [20,  28,  42]),
    C_DARK2  : toRGB(c.dark2       ?? [10,  14,  22]),
    C_DARK3  : toRGB(c.dark3       ?? [8,   12,  22]),
    C_META   : toRGB(c.meta        ?? [100, 108, 120]),
    // Content "card" background behind title/bullets, matching the HTML
    // deck's .slide-content bubble. pdf_color_spec.json's card_dark already
    // carries this per-style (white for white-bubble, navy for classic) but
    // was unused by the PDF renderer until now.
    C_CARD   : toRGB(c.card_dark   ?? [11,  15,  25]),
  };
}

// ── Unified CSS px → PDF size builder ─────────────────────────────────────────
//
// All font sizes and line heights are specified in CSS px (as rendered in the
// browser). A single ratio `font_px_to_pt` from calibration converts them to
// PDF pt (font sizes) or PDF mm (line heights/gaps).
//
// Legacy _pt keys (title_pt, bullet_pt, etc.) are auto-converted to CSS px
// using the inverse ratio, so existing layout_overrides remain compatible.

// ── Font + LineHeight + Gap sizes (all in PDF units) ──────────────────────────

interface FontSizes {
  // Font sizes (PDF pt)
  T_SECT: number;  T_NUM: number;  T_TITLE: number;  T_BUL: number;
  T_VIS_T: number;  T_VIS_B: number;
  T_TS_EYEBROW: number;  T_TS_TITLE: number;  T_TS_SUB: number;  T_TS_META: number;
  T_DIV_PART: number;  T_DIV_TITLE: number;  T_DIV_DESC: number;
  T_PUNCH_TAG: number;  T_PUNCH_MARK: number;  T_PUNCH_TEXT: number;  T_PUNCH_SUB: number;
  T_PROF_EYEBROW: number;  T_PROF_NAME: number;  T_PROF_AFFIL: number;  T_PROF_BIO: number;
  T_CONT_THANKS: number;  T_CONT_LINE: number;  T_CONT_NOTE: number;
  // Line heights (PDF mm)
  LH_TITLE: number;  LH_BULLET: number;  LH_BULLET_GAP: number;
  LH_VIS_TITLE: number;  LH_VIS_BODY: number;
  LH_TS_EYEBROW: number;  LH_TS_TITLE: number;  LH_TS_SUB: number;  LH_TS_META: number;
  LH_DIV_PART: number;  LH_DIV_TITLE: number;  LH_DIV_DESC: number;
  LH_PUNCH_TAG: number;  LH_PUNCH_MARK: number;  LH_PUNCH_TEXT: number;  LH_PUNCH_SUB: number;
  LH_PROF_EYEBROW: number;  LH_PROF_NAME: number;  LH_PROF_AFFIL: number;  LH_PROF_BIO: number;
  LH_CONT_THANKS: number;  LH_CONT_LINE: number;  LH_CONT_NOTE: number;
  // Gaps (PDF mm)
  GAP_TS_EYE_TTL: number;  GAP_TS_TTL_SUB: number;  GAP_TS_SUB_META: number;
  GAP_DIV_PART_TITLE: number;  GAP_DIV_TITLE_DESC: number;
  GAP_PUNCH_TAG_MARK: number;  GAP_PUNCH_MARK_TEXT: number;  GAP_PUNCH_TEXT_SUB: number;
  GAP_PROF_EYEBROW_NAME: number;  GAP_PROF_NAME_AFFIL: number;  GAP_PROF_AFFIL_BIO: number;
  GAP_CONT_THANKS_LINE: number;  GAP_CONT_LINE_NOTE: number;
}

function buildSizes(spec: LayoutSpec): FontSizes {
  const f = spec.fonts ?? {};
  const lh = spec.line_heights ?? {};
  const gp = spec.gaps_px ?? {};
  const mult = spec.calibration?.font_px_to_pt ?? 0.85;

  // CSS px → PDF pt
  const pt = (cssPx: number | undefined, fallback: number) =>
    ((cssPx ?? fallback) * mult);

  // CSS px → PDF mm (pt / MM_TO_PT)
  const mm = (cssPx: number | undefined, fallback: number) =>
    ((cssPx ?? fallback) * mult) / MM_TO_PT;

  // ── Legacy _pt → CSS px conversion ──
  // If a legacy _pt key exists but no corresponding _px key, convert it.
  const legacyPt2CssPx = (ptVal: number | undefined) =>
    ptVal !== undefined ? ptVal / mult : undefined;

  const sectionPx   = f.section_px   ?? legacyPt2CssPx(f.title_pt !== undefined || f.section_px !== undefined ? undefined : undefined) ?? 11.2;
  const titlePx     = f.title_px     ?? legacyPt2CssPx(f.title_pt) ?? 35.2;
  const bulletPx    = f.bullet_px    ?? legacyPt2CssPx(f.bullet_pt) ?? 15.2;
  const punchPx     = f.punchline_px ?? legacyPt2CssPx(f.punchline_pt) ?? 38.4;
  const punchSubPx  = f.punchline_sub_px ?? legacyPt2CssPx(f.punchline_sub_pt) ?? 16.0;
  const visTitlePx  = f.vis_title_px ?? legacyPt2CssPx(undefined) ?? 18.4;
  const visBodyPx   = f.vis_body_px  ?? legacyPt2CssPx(undefined) ?? 14.72;
  const tsEyebrowPx = f.ts_eyebrow_px ?? 12.8;
  const tsTitlePx   = f.ts_title_px  ?? 48.0;
  const tsSubPx     = f.ts_subtitle_px ?? 20.8;
  const tsMetaPx    = f.ts_meta_px   ?? 12.8;
  const divPartPx   = f.div_part_px  ?? 12.0;
  const divTitlePx  = f.div_title_px ?? legacyPt2CssPx(f.div_title_pt) ?? 36.8;
  const divDescPx   = f.div_desc_px  ?? legacyPt2CssPx(f.div_desc_pt) ?? 16.0;
  const slideNumPx  = f.slide_num_px ?? 11.2;

  return {
    // Font sizes (pt)
    T_SECT:          pt(sectionPx, 11.2),
    T_NUM:           pt(slideNumPx, 11.2),
    T_TITLE:         pt(titlePx, 35.2),
    T_BUL:           pt(bulletPx, 15.2),
    T_VIS_T:         pt(visTitlePx, 18.4),
    T_VIS_B:         pt(visBodyPx, 14.72),
    T_TS_EYEBROW:    pt(tsEyebrowPx, 12.8),
    T_TS_TITLE:      pt(tsTitlePx, 48.0),
    T_TS_SUB:        pt(tsSubPx, 20.8),
    T_TS_META:       pt(tsMetaPx, 12.8),
    T_DIV_PART:      pt(divPartPx, 12.0),
    T_DIV_TITLE:     pt(divTitlePx, 36.8),
    T_DIV_DESC:      pt(divDescPx, 16.0),
    T_PUNCH_TAG:     pt(f.punch_tag_px ?? 16.0, 16.0),   // Amendment A (DEC-20261116-05): own key; 16.0 fallback (CSS px through calibration), NOT the sub size
    T_PUNCH_MARK:    pt(57.6, 57.6),
    T_PUNCH_TEXT:    pt(punchPx, 38.4),
    T_PUNCH_SUB:     pt(punchSubPx, 16.0),
    T_PROF_EYEBROW:  pt(12.0, 12.0),
    T_PROF_NAME:     pt(44.8, 44.8),
    T_PROF_AFFIL:    pt(17.6, 17.6),
    T_PROF_BIO:      pt(16.0, 16.0),
    T_CONT_THANKS:   pt(41.6, 41.6),
    T_CONT_LINE:     pt(15.2, 15.2),
    T_CONT_NOTE:     pt(14.08, 14.08),
    // Line heights (mm)
    LH_TITLE:         mm(lh.title_px, 42.24),
    LH_BULLET:        mm(lh.bullet_px, 22.8),
    LH_BULLET_GAP:    mm(lh.bullet_gap_px, 15.2),
    LH_VIS_TITLE:     mm(lh.vis_title_px, 23.92),
    LH_VIS_BODY:      mm(lh.vis_body_px, 24.32),
    LH_TS_EYEBROW:    mm(lh.ts_eyebrow_px, 16.0),
    LH_TS_TITLE:      mm(lh.ts_title_px, 55.2),
    LH_TS_SUB:        mm(lh.ts_subtitle_px, 33.28),
    LH_TS_META:       mm(lh.ts_meta_px, 19.2),
    LH_DIV_PART:      mm(lh.div_part_px, 16.0),
    LH_DIV_TITLE:     mm(lh.div_title_px, 44.16),
    LH_DIV_DESC:      mm(lh.div_desc_px, 25.6),
    LH_PUNCH_TAG:     mm(lh.punch_tag_px, 16.0),
    LH_PUNCH_MARK:    mm(lh.punch_mark_px, 28.8),
    LH_PUNCH_TEXT:    mm(lh.punch_text_px, 55.68),
    LH_PUNCH_SUB:     mm(lh.punch_sub_px, 27.2),
    LH_PROF_EYEBROW:  mm(lh.prof_eyebrow_px, 18.0),
    LH_PROF_NAME:     mm(lh.prof_name_px, 55.2),
    LH_PROF_AFFIL:    mm(lh.prof_affil_px, 28.0),
    LH_PROF_BIO:      mm(lh.prof_bio_px, 27.2),
    LH_CONT_THANKS:   mm(lh.cont_thanks_px, 49.92),
    LH_CONT_LINE:     mm(lh.cont_line_px, 24.0),
    LH_CONT_NOTE:     mm(lh.cont_note_px, 22.4),
    // Gaps (mm)
    GAP_TS_EYE_TTL:       mm(gp.ts_eye_ttl_px, 24.0),
    GAP_TS_TTL_SUB:       mm(gp.ts_ttl_sub_px, 24.0),
    GAP_TS_SUB_META:      mm(gp.ts_sub_meta_px, 24.0),
    GAP_DIV_PART_TITLE:   mm(gp.div_part_title_px, 24.0),
    GAP_DIV_TITLE_DESC:   mm(gp.div_title_desc_px, 24.0),
    GAP_PUNCH_TAG_MARK:   mm(gp.punch_tag_mark_px, 24.0),
    GAP_PUNCH_MARK_TEXT:  mm(gp.punch_mark_text_px, 24.0),
    GAP_PUNCH_TEXT_SUB:   mm(gp.punch_text_sub_px, 24.0),
    GAP_PROF_EYEBROW_NAME: mm(gp.prof_eyebrow_name_px, 16.0),
    GAP_PROF_NAME_AFFIL:   mm(gp.prof_name_affil_px, 8.0),
    GAP_PROF_AFFIL_BIO:    mm(gp.prof_affil_bio_px, 32.0),
    GAP_CONT_THANKS_LINE:  mm(gp.cont_thanks_line_px, 32.0),
    GAP_CONT_LINE_NOTE:    mm(gp.cont_line_note_px, 32.0),
  };
}

// ── Auto-calibrate: estimate layout_overrides from CSS ───────────────────────
// Reads CSS custom properties (--font-size-title, --bullet-gap, etc.) from the
// project's theme CSS files and computes estimated fonts/line_heights values.
// Prints a YAML block suitable for pasting into lecture-profile.md.
// This is an OPTIONAL utility — existing static theme JSON remains the default.

async function autoCalibrate(workspaceRoot: string, projectArg: string) {
  const projectDir = resolve(workspaceRoot, projectArg);

  // Read lecture-profile.md for theme/style
  const profilePath = join(projectDir, 'lecture-profile.md');
  let theme = 'pitch-enhanced', style = 'premium-dark';
  if (existsSync(profilePath)) {
    const profile = parseFrontmatter(readFileSync(profilePath, 'utf-8'));
    theme = profile.theme ?? 'pitch-enhanced';
    style = profile.style ?? 'premium-dark';
  }

  // CSS files to read (in cascade order: base → theme → style)
  const cssFiles = [
    resolve(workspaceRoot, 'docs/html-themes/styles/base.css'),
    resolve(workspaceRoot, `docs/html-themes/themes/${theme}/theme.css`),
    resolve(workspaceRoot, `docs/html-themes/styles/${style}/style.css`),
  ];

  // Parse CSS custom properties
  const cssVars: Record<string, string> = {};
  for (const cssPath of cssFiles) {
    if (!existsSync(cssPath)) continue;
    const content = readFileSync(cssPath, 'utf-8');
    // Match: --var-name: value; (inside :root or other selectors)
    const varRegex = /--([a-zA-Z0-9-]+)\s*:\s*([^;{}]+)/g;
    let match;
    while ((match = varRegex.exec(content)) !== null) {
      cssVars[match[1]] = match[2].trim();
    }
  }

  // Helper: convert CSS rem value to px (1rem = 16px base)
  const remToPx = (val: string): number => {
    const s = val.replace(/\s/g, '');
    if (s.endsWith('rem')) return parseFloat(s) * 16;
    if (s.endsWith('px')) return parseFloat(s);
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };

  // Helper: round to 1 decimal place
  const r1 = (n: number) => Math.round(n * 10) / 10;

  // Read font_px_to_pt from theme spec (default 0.85)
  const themeSpecPath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  let fontPxToPt = 0.85;
  if (existsSync(themeSpecPath)) {
    const spec = JSON.parse(readFileSync(themeSpecPath, 'utf-8'));
    fontPxToPt = spec.calibration?.font_px_to_pt ?? 0.85;
  }

  // Helper: CSS px → PDF mm (same formula as buildSizes mm())
  const cssPxToMm = (cssPx: number) => (cssPx * fontPxToPt) / MM_TO_PT;
  // Helper: CSS px → PDF pt
  const cssPxToPt = (cssPx: number) => cssPx * fontPxToPt;

  // Extract relevant CSS values
  const titleFontSize   = remToPx(cssVars['font-size-title'] ?? '2rem');        // ~32px
  const subtitleFontSize = remToPx(cssVars['font-size-subtitle'] ?? '1.3rem');  // ~20.8px
  const bodyFontSize    = remToPx(cssVars['font-size-body'] ?? '1rem');         // 16px
  const sectionFontSize = remToPx(cssVars['font-size-section'] ?? '0.7rem');    // ~11.2px
  const bulletGap       = remToPx(cssVars['bullet-gap'] ?? '0.6rem');           // ~9.6px
  const lineHeightBody  = parseFloat(cssVars['line-height-body'] ?? '1.65');     // 1.65
  const lineHeightTitle = parseFloat(cssVars['line-height-title'] ?? '1.2');      // 1.2

  console.log(`\n📐 Auto-Calibrate: ${theme} theme, ${style} style`);
  console.log(`   font_px_to_pt: ${fontPxToPt}\n`);

  console.log('   CSS values read:');
  console.log(`     --font-size-title:    ${cssVars['font-size-title'] ?? '2rem'} = ${titleFontSize}px`);
  console.log(`     --font-size-subtitle: ${cssVars['font-size-subtitle'] ?? '1.3rem'} = ${subtitleFontSize}px`);
  console.log(`     --font-size-body:     ${cssVars['font-size-body'] ?? '1rem'} = ${bodyFontSize}px`);
  console.log(`     --font-size-section:  ${cssVars['font-size-section'] ?? '0.7rem'} = ${sectionFontSize}px`);
  console.log(`     --bullet-gap:         ${cssVars['bullet-gap'] ?? '0.6rem'} = ${bulletGap}px`);
  console.log(`     --line-height-body:   ${lineHeightBody}`);
  console.log(`     --line-height-title:  ${lineHeightTitle}`);
  console.log('');

  // ── Compute CSS px font sizes ──
  // All values are in CSS px — the same unit used in pdf_layout_spec.json fonts.*_px
  const fonts = {
    title_px:     r1(titleFontSize),                          // 32.0
    bullet_px:    r1(bodyFontSize),                            // 16.0
    section_px:   r1(sectionFontSize),                         // 11.2
    div_title_px: r1(titleFontSize * 1.1),                    // 35.2
    div_desc_px:  r1(subtitleFontSize),                        // 20.8
    punchline_px: r1(titleFontSize * 1.2),                     // 38.4
    punchline_sub_px: r1(bodyFontSize),                        // 16.0
  };

  // ── Compute CSS px line heights (font-size × line-height-ratio) ──
  const lineHeights = {
    title_px:       r1(titleFontSize * lineHeightTitle),          // 38.4
    bullet_px:      r1(bodyFontSize * lineHeightBody),            // 26.4
    bullet_gap_px:  r1(bulletGap),                                // 9.6
    div_title_px:   r1(titleFontSize * 1.1 * lineHeightTitle),    // 42.2
    div_desc_px:    r1(subtitleFontSize * lineHeightBody),        // 34.3
  };

  // ── Compute CSS px gaps ──
  const gaps = {
    bullet_gap_px: r1(bulletGap),                                 // 9.6
  };

  console.log('   Estimated layout_overrides for lecture-profile.md:');
  console.log('   ─────────────────────────────────────────────────');

  const yaml = [
    '  layout_overrides:',
    '    fonts:',
    `      title_px: ${fonts.title_px}`,
    `      bullet_px: ${fonts.bullet_px}`,
    `      section_px: ${fonts.section_px}`,
    `      div_title_px: ${fonts.div_title_px}`,
    `      div_desc_px: ${fonts.div_desc_px}`,
    `      punchline_px: ${fonts.punchline_px}`,
    `      punchline_sub_px: ${fonts.punchline_sub_px}`,
    '    line_heights:',
    `      title_px: ${lineHeights.title_px}`,
    `      bullet_px: ${lineHeights.bullet_px}`,
    `      bullet_gap_px: ${lineHeights.bullet_gap_px}`,
    `      div_title_px: ${lineHeights.div_title_px}`,
    `      div_desc_px: ${lineHeights.div_desc_px}`,
    '    gaps_px:',
    `      bullet_gap_px: ${gaps.bullet_gap_px}`,
  ];
  for (const line of yaml) console.log(line);

  // ── Validation: line_mm must exceed font_mm ──
  console.log('');
  console.log('   Validation (CSS px → PDF mm via font_px_to_pt):');

  const checks = [
    { name: 'title',  fontPx: fonts.title_px,  lhPx: lineHeights.title_px },
    { name: 'bullet', fontPx: fonts.bullet_px,  lhPx: lineHeights.bullet_px },
  ];
  let allOk = true;
  for (const c of checks) {
    const fontMm = cssPxToMm(c.fontPx);
    const lineMm = cssPxToMm(c.lhPx);
    const ok = lineMm > fontMm;
    if (!ok) allOk = false;
    console.log(`     ${c.name}:   font_mm=${fontMm.toFixed(2)}, line_mm=${lineMm.toFixed(2)} ${ok ? '✅' : '❌ (line < font!)'}`);
  }

  if (!allOk) {
    console.log('\n   ⚠️  Validation failed — line heights too small for font sizes.');
    console.log('   Increase line_heights values above or decrease fonts.');
  }

  console.log('\n   💡 Copy the YAML block above into your lecture-profile.md frontmatter.');
  console.log('   All values are in CSS px; PDF conversion uses font_px_to_pt ratio.');
  console.log('   Compare with theme defaults in:');
  console.log(`     docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/gen-slides-pdf.ts --project deliverables/<project> [--out name.pdf] [--sample 5] [--font-dir deliverables/assets/fonts/] [--data path/to/slidedata.json]');
    console.error('       bun scripts/gen-slides-pdf.ts --auto-calibrate --project deliverables/<project>');
    process.exit(1);
  }

  // ── --auto-calibrate mode: estimate layout_overrides from CSS ─────────────
  if (args.includes('--auto-calibrate')) {
    await autoCalibrate(workspaceRoot, projectArg);
    return;
  }

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir    = resolve(workspaceRoot, projectArg);
  if (!existsSync(projectDir)) {
    console.error(`Project folder not found: ${projectDir}`); process.exit(1);
  }

  // ── Read lecture-profile.md and parse theme/style ─────────────────────────
  const lectureProfilePath = join(projectDir, 'lecture-profile.md');
  let lectureProfile: Record<string, any> = {};
  let bgImageConfig: BgImageConfig | null = null;
  if (existsSync(lectureProfilePath)) {
    const profileContent = readFileSync(lectureProfilePath, 'utf-8');
    lectureProfile = parseFrontmatter(profileContent);
    bgImageConfig = parseBackgroundImage(profileContent);
  }

  const theme = lectureProfile.theme ?? 'pitch-enhanced';
  const style = lectureProfile.style ?? 'premium-dark';

  // ── Load spec files (4-layer merge: base → theme → style colors → overrides) ──
  // AC-7: missing base/theme spec files are HARD ERRORS (no silent fallback).
  const basePath   = resolve(workspaceRoot, 'docs/html-themes/themes/_shared/layout_base.json');
  const themePath  = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  const stylePath  = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

  for (const [label, p] of [['layout_base', basePath], ['theme spec', themePath]] as const) {
    if (!existsSync(p)) {
      console.error(`${RESOLVE_ERROR_PREFIX}${label} not found: ${p}`);
      process.exit(1);
    }
  }
  // Style color spec is optional-but-warned (themes still have color defaults).
  let styleSpec: any = {};
  if (existsSync(stylePath)) {
    styleSpec = JSON.parse(readFileSync(stylePath, 'utf-8'));
  } else {
    console.warn(`[region-spec] style color spec not found: ${stylePath} — falling back to theme color defaults.`);
  }

  const baseSpec:  LayoutSpec = JSON.parse(readFileSync(basePath,  'utf-8'));
  const themeSpec: LayoutSpec = JSON.parse(readFileSync(themePath, 'utf-8'));

  // Final spec = deepMerge(layout_base, theme_spec, style_colors, project_overrides).
  let layoutSpec: LayoutSpec = deepMerge(baseSpec, themeSpec);
  if (styleSpec.colors) {
    layoutSpec = deepMerge(layoutSpec, { colors: styleSpec.colors });
  }
  if (lectureProfile.layout_overrides) {
    layoutSpec = deepMerge(layoutSpec, lectureProfile.layout_overrides);
  }

  // ── Validate the merged spec has a usable region model ─────────────────────
  if (!layoutSpec.regions || Object.keys(layoutSpec.regions).length === 0) {
    console.error(`${RESOLVE_ERROR_PREFIX}merged spec has no "regions" block (theme=${theme}).`);
    process.exit(1);
  }
  if (!layoutSpec.slide_types || Object.keys(layoutSpec.slide_types).length === 0) {
    console.error(`${RESOLVE_ERROR_PREFIX}merged spec has no "slide_types" block (theme=${theme}).`);
    process.exit(1);
  }

  // ── Build derived geometry, colors, and font sizes ────────────────────────
  const coords = buildCoords(layoutSpec);
  const colors = buildColors(layoutSpec);
  const sizes  = buildSizes(layoutSpec);

  const { PW, PH, CW, CH, CX, CY } = coords;
  const { C_DARK, C_BG } = colors;

  // ── Parse remaining CLI flags ─────────────────────────────────────────────
  const sampleArg   = get('--sample');
  const sampleCount = sampleArg ? parseInt(sampleArg, 10) : null;

  const defaultPdfName = sampleCount != null
    ? `${projectDir.split(/[/\\]/).pop()}_sample${sampleCount}.pdf`
    : `${projectDir.split(/[/\\]/).pop()}.pdf`;

  const outName  = get('--out') ?? defaultPdfName;
  const fontDir  = resolve(workspaceRoot, get('--font-dir') ?? 'deliverables/assets/fonts');
  const dataPath = resolve(get('--data') ?? join(projectDir, 'slidedata.json'));
  const imgDir   = projectDir;  // visualImage paths in slidedata.json are relative to projectDir (imgPath = join(imgDir, src), no prefix strip)
  const outPath  = join(projectDir, outName);

  if (!existsSync(dataPath)) {
    console.error(`slidedata.json not found: ${dataPath}`);
    console.error('   Run bun scripts/extract_slidedata.mjs <html> first.');
    process.exit(1);
  }

  // Resolve font files: prefer project dir, then OS system font directories
  const FONT_FAMILIES: Array<[string, string]> = [
    ['Pretendard-Regular.ttf', 'Pretendard-Bold.ttf'],
    ['MaruBuri-Regular.ttf',   'MaruBuri-Bold.ttf'],
  ];

  // CJK fallback font families: used when primary font lacks glyphs (e.g. 한자).
  // Variable fonts (.ttf with fvar table) are supported by pdf-lib/fontkit.
  const CJK_FALLBACK_FONTS: Array<[string, string]> = [
    ['NotoSansKR-Regular.ttf', 'NotoSansKR-Bold.ttf'],
    ['NotoSansKR-VF.ttf',      'NotoSansKR-VF.ttf'],
    ['NotoSansKR.otf',         'NotoSansKR-Bold.otf'],
  ];

  // Build search order: project fontDir → OS system dirs
  const sysFontDirs: string[] = (() => {
    const p = platform();
    const home = homedir();
    if (p === 'win32') return ['C:/Windows/Fonts'];
    if (p === 'darwin') return [join(home, 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
    return [join(home, '.local/share/fonts'), '/usr/share/fonts/truetype', '/usr/share/fonts'];
  })();

  let fontR = '', fontB = '';
  for (const [r, b] of FONT_FAMILIES) {
    for (const dir of [fontDir, ...sysFontDirs]) {
      const rp = join(dir, r), bp = join(dir, b);
      if (existsSync(rp) && existsSync(bp)) { fontR = rp; fontB = bp; break; }
    }
    if (fontR) break;
  }
  if (!fontR) {
    console.error(`Font files not found in: ${fontDir}`);
    console.error('   Expected Pretendard-Regular/Bold.ttf or MaruBuri-Regular/Bold.ttf');
    process.exit(1);
  }

  // Resolve CJK fallback font (optional — best-effort, no error if not found)
  let cjkFontR = '', cjkFontB = '';
  for (const [r, b] of CJK_FALLBACK_FONTS) {
    // For variable fonts where regular == bold (same file), check that at least regular exists
    const rExists = (dir: string) => existsSync(join(dir, r));
    const bExists = (dir: string) => existsSync(join(dir, b));
    for (const dir of [fontDir, ...sysFontDirs]) {
      if (r === b) {
        // Same file for regular and bold (variable font)
        if (rExists(dir)) { cjkFontR = join(dir, r); cjkFontB = cjkFontR; break; }
      } else if (rExists(dir) && bExists(dir)) {
        cjkFontR = join(dir, r); cjkFontB = join(dir, b); break;
      }
    }
    if (cjkFontR) break;
  }
  if (cjkFontR) {
    console.log(`CJK fallback font: ${cjkFontR}`);
  } else {
    console.log('CJK fallback font: none found (한자 glyphs may not render)');
  }

  console.log(`Project: ${projectDir}`);
  console.log(`Output:  ${outPath}`);
  console.log(`Theme: ${theme}  Style: ${style}`);
  console.log(`Card ${CW.toFixed(1)}x${CH.toFixed(1)}mm`);

  let slideData: SlideData[] = JSON.parse(readFileSync(dataPath, 'utf-8'));
  if (sampleCount != null) slideData = slideData.slice(0, sampleCount);

  const TOTAL = slideData.length;

  // ── Background image setup ──────────────────────────────────────────────
  // Resolve the global background image path from image-manifest.json or slideData.
  let globalBgPath: string | null = null;
  const slideBgEntries = new Map<number, string>();  // slide_index → image path (individual mode)
  if (bgImageConfig) {
    // Try image-manifest.json first (global background_image section)
    const manifestPath = join(projectDir, 'image-manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        if (manifest.background_image?.path) {
          globalBgPath = manifest.background_image.path;
        }
        // Collect individual per-slide background entries. These are keyed
        // by slide_index, but image-manifest.json is sourcing/licensing
        // metadata that isn't regenerated every time the deck is reordered
        // or edited — its slide_index → path map drifts out of sync with
        // the current slidedata.json (e.g. a video slide moved from index 39
        // to 15 left behind a stale index-39 entry that now silently points
        // another, unrelated slide at that old thumbnail). Use these only as
        // a fallback for slides slidedata.json itself has no image for.
        for (const entry of (manifest.slides ?? [])) {
          if (entry.image_role === 'background' && entry.slide_index >= 0) {
            slideBgEntries.set(entry.slide_index, entry.path);
          }
        }
      } catch { /* ignore parse errors — background is optional */ }
    }
    // slideData.backgroundImage is the authoritative, always-current source
    // (rebuilt alongside the deck itself) — let it override any
    // manifest entry rather than the other way around.
    for (let i = 0; i < slideData.length; i++) {
      if (slideData[i].backgroundImage) {
        slideBgEntries.set(i, slideData[i].backgroundImage!);
      }
    }
    if (globalBgPath) {
      console.log(`Background image: ${globalBgPath} (scope: ${bgImageConfig.scope}, overlay: rgba(${bgImageConfig.overlay.color.join(',')},${bgImageConfig.overlay.opacity}))`);
    }
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.1 — pdf-lib's computeWidths()
  // emitted a wrong /W table for this font (':' '-' etc. rendered with huge gaps,
  // e.g. "K-  뷰티"). Replace with a dense per-glyph-id table from fontkit.
  // (subset:true was tried: it drops glyphs — do not use.)
  (CustomFontEmbedder as any).prototype.computeWidths = function () {
    const n = this.font.numGlyphs; const w: number[] = [];
    for (let i = 0; i < n; i++) w.push(this.font.getGlyph(i).advanceWidth * this.scale);
    return [0, w];
  };
  // LOCAL-PATCH(upstream-request: U-20261105-005) v1.14.4 — text extraction fix.
  // Root cause: pdf-lib writes the ToUnicode CMap only for glyphs found via
  // font.characterSet (cmap table), but font.layout() substitutes contextual
  // alternates (Pretendard calt: digit-adjacent '-', ':' '+' '→' '–' ...) whose
  // glyph ids (e.g. 13252) are NOT in that set, so those glyphs got no CMap
  // entry (viewers then guessed CJK-compat code points like U+3395 / U+33C4).
  // Fix: record every glyph id laid out by encodeText() with its code points and
  // write them into the CMap (one preferred code point per glyph; ligatures keep
  // their full sequence). Rendering and widths are unchanged.
  const embProto = (CustomFontEmbedder as any).prototype;
  const origEncodeText = embProto.encodeText;
  embProto.encodeText = function (text: string) {
    const seen: Map<number, number[]> = (this.__laidOut ??= new Map());
    for (const g of this.font.layout(text, this.fontFeatures).glyphs) {
      if (!seen.has(g.id)) seen.set(g.id, [...g.codePoints]);
    }
    return origEncodeText.call(this, text);
  };
  embProto.embedUnicodeCmap = function (context: any) {
    // rank: ASCII < other code points outside the compat ranges < compat; ties -> lowest
    const rank = (cp: number) => cp < 0x80 ? 0 : ((cp >= 0x3000 && cp <= 0x33ff) || cp >= 0xf900 || cp === 0xad) ? 2 : 1;
    const pick = (cps: number[]) => [cps.reduce((a: number, c: number) =>
      (rank(c) < rank(a) || (rank(c) === rank(a) && c < a)) ? c : a)];
    const map = new Map<number, number[]>();
    for (const cp of this.font.characterSet as number[]) {
      const id = this.font.glyphForCodePoint(cp).id;
      map.set(id, pick([...(map.get(id) ?? []), cp]));
    }
    // glyphs actually laid out: their own code points are the true source chars
    const laid: Map<number, number[]> = this.__laidOut ?? new Map();
    for (const [id, cps] of laid) if (cps.length) map.set(id, cps);
    const glyphs = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([id, codePoints]) => ({ id, codePoints }));
    const stream = context.flateStream(pdfLibCreateCmap(glyphs as any, (g: any) => g.id));
    return context.register(stream);
  };
  const regularFont = await pdfDoc.embedFont(readFileSync(fontR));
  const boldFont    = await pdfDoc.embedFont(readFileSync(fontB));

  // Embed CJK fallback font (optional)
  let cjkRegularFont: PDFFont | null = null;
  let cjkBoldFont: PDFFont | null = null;
  if (cjkFontR) {
    try {
      cjkRegularFont = await pdfDoc.embedFont(readFileSync(cjkFontR));
      if (cjkFontB && cjkFontB !== cjkFontR) {
        cjkBoldFont = await pdfDoc.embedFont(readFileSync(cjkFontB));
      } else {
        cjkBoldFont = cjkRegularFont;  // variable font: same file for both weights
      }
    } catch (e: any) {
      console.warn(`CJK fallback font embed failed: ${e.message}`);
    }
  }

  // Build missing-code-point set: scan primary font for characters that the
  // fallback font CAN render but primary CANNOT. This avoids calling
  // hasGlyphForCodePoint per-character at render time.
  const missingCps = new Set<number>();
  if (cjkRegularFont) {
    try {
      const primaryFk  = fontkitCreate(readFileSync(fontR));
      const fallbackFk = fontkitCreate(readFileSync(cjkFontR));
      // Collect all code points from slidedata that are in fallback but not primary.
      // We scan all text fields once at startup.
      const allText = JSON.stringify(slideData);
      for (let i = 0; i < allText.length; i++) {
        const cp = allText.codePointAt(i);
        if (cp === undefined || cp < 0x20) continue;
        // Skip chars > 0xFFFF (surrogate pairs) — rare in Korean text
        if (cp > 0xFFFF) continue;
        if (fallbackFk.hasGlyphForCodePoint(cp) && !primaryFk.hasGlyphForCodePoint(cp)) {
          missingCps.add(cp);
        }
      }
      console.log(`CJK fallback: ${missingCps.size} code points missing in primary font`);
      if (missingCps.size > 0) {
        const sample = [...missingCps].slice(0, 5).map(cp => String.fromCodePoint(cp)).join('');
        console.log(`  Missing chars sample: ${sample}`);
      }
    } catch (e: any) {
      console.warn(`CJK glyph scan failed: ${e.message}`);
    }
  }

  const renderer = new Renderer(regularFont, boldFont, PW, PH, colors.C_WHITE, cjkRegularFont, cjkBoldFont, missingCps);

  let footnoteDrops = 0;                     // v1.14.9 ladder rung (3) counter — must stay 0
  for (let idx = 0; idx < slideData.length; idx++) {
    const data = slideData[idx];
    const page = pdfDoc.addPage([mm(PW), mm(PH)]);
    renderer.setPage(page);

    renderer.fillRect(0, 0, PW, PH, C_DARK);
    renderer.fillRect(CX, CY, CW, CH, C_BG);

    // ── Background image rendering (full-bleed + overlay) ────────────────
    let bgDrawn = false;
    if (bgImageConfig) {
      const bgPath = resolveBgImagePath(data, idx, bgImageConfig, imgDir, globalBgPath, slideBgEntries, workspaceRoot);
      if (bgPath) {
        try {
          // Draw full-bleed background image (cover-crop to entire page)
          // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks cover
          // the frame, not the page.
          const fg = layoutSpec.frame ? frameGeom(layoutSpec, coords) : null;
          const bx = fg ? fg.fx : 0, by = fg ? fg.fy : 0;
          const pageWmm = fg ? fg.fw : PW;  // page width in mm (same as PW from coords)
          const pageHmm = fg ? fg.fh : PH;  // page height in mm
          await renderer.placeImageCover(pdfDoc, bgPath, bx, by, pageWmm, pageHmm);
          // Draw semi-transparent overlay for text readability
          if (bgImageConfig.overlay.opacity > 0) {
            const [or, og, ob] = bgImageConfig.overlay.color;
            renderer.fillRectOverlay(bx, by, pageWmm, pageHmm, rgb(or / 255, og / 255, ob / 255), bgImageConfig.overlay.opacity);
          }
          bgDrawn = true;
        } catch (e: any) {
          console.warn(`  bg image err (slide ${idx + 1}): ${e.message}`);
        }
      }
    }

    // ── Video slide thumbnail (HTML .cdk-video-thumb parity, v1.11.0) ────
    // data.videoThumbnail is the slide's actual CONTENT layer — the full-bleed
    // YouTube thumbnail the HTML deck draws as <img class="cdk-video-thumb">
    // (object-fit: cover, z-index 1). Video slides carry no backgroundImage, so
    // the bgImageConfig step above never fires for them and the play button
    // previously sat on a flat C_BG page. Not gated on bgImageConfig: the
    // thumbnail is slide content, not a deck-wide background preference. No
    // dark wash — HTML shows the raw thumbnail; the play button and title pill
    // carry their own contrast (ADR-0002 layering: thumbnail → play → link →
    // title pill).
    if (data.videoId && data.videoThumbnail) {
      const thumbRaw = data.videoThumbnail;
      const thumbPath = [thumbRaw, resolve(imgDir, thumbRaw), resolve(workspaceRoot, thumbRaw)]
        .find(p => existsSync(p));
      if (thumbPath) {
        // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks cover the
        // frame, not the page.
        const fg = layoutSpec.frame ? frameGeom(layoutSpec, coords) : null;
        if (fg) await renderer.placeImageCover(pdfDoc, thumbPath, fg.fx, fg.fy, fg.fw, fg.fh);
        else await renderer.placeImageCover(pdfDoc, thumbPath, 0, 0, PW, PH);
      } else {
        console.warn(`  video thumbnail not found (slide ${idx + 1}): ${thumbRaw}`);
      }
    }

    const n = idx + 1;

    // AC-2: dispatch is driven by which slide_types the THEME declares, not by
    // theme name. isDividerSlide + declared "divider"  → renderDividerSlide;
    // isPunchline     + declared "punchline" → renderPunchlineSlide;
    // isTitleSlide    + declared "title"      → renderTitleSlide;
    // otherwise                            → "standard".
    const slideTypes = layoutSpec.slide_types ?? {};
    const has        = (t: string) => !!(slideTypes[t] && slideTypes[t].regions);

    let type: 'title' | 'divider' | 'punchline' | 'profile' | 'contact' | 'standard';
    // LOCAL-PATCH(upstream-request: U-20261105-002) F4 — accept both isPunchline
    // and isPunchlineSlide spellings (the slidedata producer emits the latter).
    if (data.isTitleSlide && has('title'))           type = 'title';
    else if (data.isDividerSlide && has('divider'))  type = 'divider';
    else if ((data.isPunchline || data.isPunchlineSlide) && has('punchline')) type = 'punchline';
    else if (data.isProfileSlide && has('profile'))  type = 'profile';
    else if (data.isContactSlide && has('contact'))  type = 'contact';
    else                                             type = 'standard';

    const declared = slideTypes[type]?.regions ?? [];
    // Per-slide-type region resolver: honours slide_type_overrides[type][name].
    const region = (name: string) => coords.region(name, type);

    const ctx: RenderCtx = {
      r: renderer, doc: pdfDoc, data, n, total: TOTAL, imgDir,
      fontDir, spec: layoutSpec, coords, colors, sizes, declared, region,
      // LOCAL-PATCH(upstream-request: U-20261119-010) — Framed cover: HTML shows
      // the text straight on the scrimmed photo (no card).
      bgDrawn: layoutSpec.frame && type === 'title' ? false : bgDrawn,
    };

    // LOCAL-PATCH(upstream-request: U-20261119-010) — framed contact slide with a
    // visual = HTML two-column (plain lines left, image right).
    if (layoutSpec.frame && type === 'contact' && data.visualImage) {
      await renderFramedStandard(ctx, { lines: [data.contactEmail, data.contactLinkedIn].filter(Boolean) as string[] });
    } else if (layoutSpec.frame && type === 'title')   renderFramedTitle(ctx);
    else if (layoutSpec.frame && type === 'divider')   await renderFramedDivider(ctx);
    else if (type === 'title')          await renderTitleSlide(ctx);
    else if (type === 'divider')   await renderDividerSlide(ctx);
    else if (type === 'punchline') renderPunchlineSlide(ctx);
    else if (type === 'profile')   renderProfileSlide(ctx);
    else if (type === 'contact')   renderContactSlide(ctx);
    else                           await renderStandardSlide(ctx);

    // LOCAL-PATCH(upstream-request: U-20261105-002) F3 — footnote source citations
    // (design_spec §3: source line 12px ≈ 9pt, dim/muted) — previously never rendered.
    // Generic loop placement (not renderStandardSlide) so every slide type can
    // carry citations; draw-last guarantees the line sits on top of the
    // background/card layers already painted.
    // LOCAL-PATCH(pm-2026-11-15 footnote-wrap) v1.14.8 — wrap + upward growth + a
    // card-aware clamp (details in the header). Superseded by v1.14.9 below.
    // LOCAL-PATCH(pm-2026-11-15 footnote-scrim) v1.14.9 — the audited 24-slide /
    // 37-gloss deck showed NO absence, NO off-page text and NO card overlap, but
    // the bare C_MUTED grey line was unreadable on EVERY footnote slide: with
    // v1.14.7 actually drawing photos, the grey (~lum 115) sits on backdrops
    // measuring p90 luminance 52–130 — the user-visible "약어 글상자가 사라진다".
    // HTML parity is the deck injector's photo-aware footnote scrim, so:
    // ① when a background was drawn, the band gets a white C_CARD scrim
    //   (rounded, 0.96, hug-width) and its ink switches to body-navy C_BODY —
    //   readable on any photo (worst-case ≈4.9:1 on pure black);
    // ② placement becomes a fit ladder, first fit wins:
    //    (1a) below the card at the legacy anchor (1-line bands land exactly
    //         where they always did);
    //    (1b) shrunk to the 11px floor and re-wrapped;
    //    (1c) on the card's empty bottom padding (scrim over card = seamless
    //         white; kept below the card's title area);
    //    (2) the top margin above the card;
    //    (3) drop — last resort only, with a loud per-gloss ⚠ log and a run
    //         summary (none of the 24 audited slides can reach it).
    // v1.15.0 (U-20261116-008 item 2 / U-20261116-009 item 2, owner decision
    // O-2) — the band merges the authoring split: `notes` (sources/caveats)
    // first, then `footnotes` (abbreviation definitions), one joined band
    // through the existing ladder below — zero drops, zero new placement logic.
    const fns = [...(data.notes ?? []), ...(data.footnotes ?? [])].map(s => strip(s)).filter(Boolean);
    // LOCAL-PATCH(upstream-request: U-20261119-010) — framed decks: HTML puts the
    // footnote inside the frame, bottom-left under the text column, muted.
    if (fns.length > 0 && layoutSpec.frame) {
      const g = frameGeom(layoutSpec, coords);
      const fx0 = g.fx + g.px(g.f.col_x_px), fw0 = g.px(g.f.w_px - 2 * g.f.col_x_px);
      const lh = g.px(g.f.footnote_lh_px);
      renderer.setFont(false, g.pt(g.f.footnote_px)); renderer.setColor(toRGB(g.f.muted_rgb));
      const lines = renderer.wrapText(fns.join('  ·  '), fw0);
      let yy = g.fy + g.fh - g.px(g.f.footnote_bottom_px) - lines.length * lh;
      for (const line of lines) { renderer.cell(fw0, lh, line, fx0, yy, 'L'); yy += lh; }
    } else if (fns.length > 0) {
      const footR = region('content');
      const footText = fns.join('  ·  ');
      const cardEntry = CARD_LOG
        .filter((c) => c.n === idx + 1)
        .sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
      const cardBottomMm = cardEntry ? (cardEntry.y + cardEntry.h) * coords.PH : 0;
      const cardTopMm    = cardEntry ? cardEntry.y * coords.PH : 0;
      const scrimFloorMm = coords.CY + coords.CH - coords.px2mm(2);
      const pageTopMm    = coords.CY + coords.px2mm(4);
      const legacyAnchorBottomMm = coords.CY + coords.CH - coords.px2mm(18) + 4.2;   // v1.14.5-era single-line bottom
      const onCardTopFloorMm = cardTopMm + coords.px2mm(20);                          // stay below the card's title area

      let plan: { top: number; lh: number; sizePt: number; lines: string[]; where: string } | null = null;
      const cardPadMm = coords.px2mm(32);              // card bottom padding (empty white strip)
      const tryPlace = (sizePx: number, mode: 'below-card' | 'on-card' | 'top-margin'): boolean => {
        const sizePt = sizePx * 0.75;
        const lh = 4.2 * (sizePx / 12);
        renderer.setFont(false, sizePt);
        const lines = renderer.wrapText(footText, footR.w);
        const bandH = Math.max(1, lines.length) * lh;
        let top: number;
        if (mode === 'below-card') {
          // Legacy anchor; the band may sit on the card's empty bottom padding
          // (scrim makes the seam invisible) but must stop short of card TEXT,
          // which ends at cardBottom − cardPad.
          top = legacyAnchorBottomMm - bandH;
          const floorMm = cardBottomMm > 0 ? cardBottomMm - cardPadMm + coords.px2mm(3) : coords.CY;
          if (top < floorMm || top + bandH > scrimFloorMm + coords.px2mm(2)) return false;
        } else if (mode === 'on-card') {
          top = cardBottomMm - coords.px2mm(4) - bandH;
          if (cardBottomMm === 0 || top < onCardTopFloorMm) return false;
        } else {
          top = pageTopMm;
          if (cardTopMm > 0 && top + bandH > cardTopMm - coords.px2mm(2)) return false;
        }
        plan = { top: Math.max(coords.CY, top), lh, sizePt, lines, where: mode };
        return true;
      };
      // (1) below the card: design-spec 12px first, then the 11px floor.
      //     (1c)/(2) follow once the below-card rung is exhausted at both sizes.
      if (!tryPlace(12, 'below-card') && !tryPlace(11, 'below-card')) {
        if (!tryPlace(11, 'on-card') && !tryPlace(12, 'on-card')) {
          if (!tryPlace(11, 'top-margin') && !tryPlace(12, 'top-margin')) {
            plan = null;                               // (3) drop — see below
          }
        }
      }

      if (!plan) {
        // (3) last resort: drop, loudly. footnoteDrops is summarised after the loop.
        footnoteDrops++;
        console.log(`  ⚠ footnotes DROPPED (slide ${idx + 1}): ${fns.join(' | ')}`);
      } else {
        renderer.setFont(false, plan.sizePt);
        const maxLineW = Math.max(0, ...plan.lines.map((l) => renderer.stringWidth(l)));
        if (bgDrawn) {
          // Photo-aware scrim (deck injector parity): white pill behind the band.
          const padX = coords.px2mm(14), padY = coords.px2mm(8);
          const sx = Math.max(coords.CX, footR.x - padX);
          const sw = Math.min(maxLineW + padX * 2, coords.CX + coords.CW - sx);
          const sy = Math.max(coords.CY + coords.px2mm(2), plan.top - padY);
          const sh = Math.min(plan.lines.length * plan.lh + padY * 2, scrimFloorMm - sy);
          renderer.drawRoundedRect(sx, sy, sw, sh, coords.px2mm(8), colors.C_CARD, 0.96);
          renderer.setColor(colors.C_BODY);              // navy ink on the white scrim
        } else {
          renderer.setColor(colors.C_MUTED);             // legacy flat-surface ink
        }
        let yy = plan.top;
        for (const line of plan.lines) {
          renderer.cell(footR.w, plan.lh, line, footR.x, yy, 'L');
          yy += plan.lh;
        }
        console.log(`  footnotes (slide ${idx + 1}): ${plan.lines.length} line(s) @${plan.sizePt.toFixed(2)}pt ${plan.where}, band [${plan.top.toFixed(1)}..${(plan.top + plan.lines.length * plan.lh).toFixed(1)}]mm${bgDrawn ? ' + scrim' : ''}`);
      }
    }

    // LOCAL-PATCH(upstream-request: U-20261119-010) — clip every layer to the frame.
    if (layoutSpec.frame) {
      const g = frameGeom(layoutSpec, coords);
      renderer.maskOutsideFrame(g.fx, g.fy, g.fw, g.fh, g.rad, toRGB(g.f.page_rgb));
    }

    if ((idx + 1) % 10 === 0 || idx + 1 === TOTAL) {
      console.log(`  Slide ${idx + 1}/${TOTAL}... [${type}]`);
    }
  }

  if (footnoteDrops > 0) {
    console.warn(`⚠ ${footnoteDrops} slide(s) lost their footnote glosses entirely (see the ⚠ footnotes DROPPED lines above) — PM must be notified`);
  }
  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);
  if (process.env.CARD_RECTS_OUT) writeFileSync(process.env.CARD_RECTS_OUT, JSON.stringify(CARD_LOG));

  const sizeKb = Math.round(statSync(outPath).size / 1024);
  console.log(`\nSaved -> ${outPath}`);
  console.log(`   Size: ${sizeKb}KB`);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
