// @version 1.2.0 — punchline 2-sentence layout section (design
//   2026-11-16-co-deck-pdf-html-backport §4.2 item 3, U-20261116-009 item 3):
//   the deck-proven punchline CSS patch (white bubble widened to
//   min(1120px, 90%) + title clamped to clamp(2rem, 3.6vw, 3.1rem) so each
//   \n-separated sentence stays on one line) promotes into the P2 override
//   block as this layer's punchline section. This is the template's
//   designated promotion path for the deck patch family (variant.json
//   script_manifest, U-20261114-012); decks built without the patch keep the
//   legacy zen 64px title (the patch layer stays opt-in per deck).
// @version 1.1.0 — template promotion (U-20261114-012, 2026-11-16): the parameterized
// zen x white-bubble patch layer ships in the template so per-deck copies stop
// diverging; deck-local fixes flow back via version bumps at the backport gate.
// Path convention follows the fleet deliverables/ consolidation (doc-only).
// v1.1.0 (2026-11-05, U-20261105-002 phase-2 rebuild): parameterised for any
// zen x white-bubble deck (--project/--version/--accent/--accent-light) so the
// sibling 2026-11-ai-market-research-lecture deck (ink red #B03A2E) is built
// through the same path; cover/punchline/contact white card now lives in
// docs/html-themes/styles/white-bubble/style.css (LOCAL-PATCH), not here.
// patch-zen-white-bubble.ts — html-build Stage 5-8 template extension for
// deliverables/2026-11-consumer-goods-market-shift (design_spec.md §2/§3/§4/§5/§7/§9).
//
// zen v3.0.0 template.html does not render visualImage/visualTitle/visualDisplay
// on standard slides (design_spec §9-2), and its no-photo fallback is a dark
// radial gradient (§9-5). Project-scoped extension, applied to the built HTML
// after build-theme-deck.ts (same pattern as 2026-11-ai-market-research-lecture):
//   P1 <title> fill (builder left empty — profile has no presentation.title)
//   P2 <style data-project-overrides> after the real CSS links:
//        §9-5 warm paper #ece9e3 fallback + overlay suppression on photo-less slides
//        §7/§9-2 zen-visual SVG block styles (caption 14px muted, source 12px dim)
//        §3   visual-heading 24px navy / visualDisplay lines 15px
//        §9-7 footnote dim navy on paper slides
//   P3 buildZenVisual_zen() — renders visualImage SVG or visualTitle+visualDisplay
//        INSIDE the white bubble card (standard branch call added, P4)
//   P5 narration/auto_advance config from lecture-profile.md into initPPT()
// Then re-validates every inline <script> block parses (vm.Script), mirroring
// the builder's own step 11.5.
//
// Usage: bun tests/patch-zen-white-bubble.ts [--project <slug>] [--version v1]
//          [--accent '#B03A2E' --accent-light '#f6e3e0']
//   defaults: project 2026-11-consumer-goods-market-shift, version v1 (orange, style default)
// Idempotency: each patch asserts its anchor appears exactly once and refuses
// to double-apply (checks for prior application first).

import { readFileSync, writeFileSync } from 'fs';
import { Script } from 'vm';

function arg(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}
const PROJECT = arg('--project', '2026-11-consumer-goods-market-shift');
const VERSION = arg('--version', 'v1');
const ACCENT = arg('--accent', '');
const ACCENT_LIGHT = arg('--accent-light', '');
const HTML_PATH = `deliverables/${PROJECT}/lecture_${PROJECT}_${VERSION}.html`;
const PROFILE = readFileSync(`deliverables/${PROJECT}/lecture-profile.md`, 'utf-8');
const TITLE = (PROFILE.match(/^title:\s*"([^"]+)"/m) ?? [])[1] ?? '';
if (!TITLE) throw new Error('lecture-profile.md title not found');

let html = readFileSync(HTML_PATH, 'utf-8');

function replaceOnce(from: string, to: string, label: string): void {
  const count = html.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`P-${label}: anchor found ${count} times (expected exactly 1)`);
  }
  html = html.replace(from, to);
}

// ── P1: title ────────────────────────────────────────────────────────────
if (html.includes(`<title>${TITLE}</title>`)) {
  console.log('P1 title: already applied');
} else {
  replaceOnce('<title></title>', `<title>${TITLE}</title>`, '1-title');
}

// ── P2: project override style block (after the real CSS links) ─────────
if (html.includes('data-project-overrides')) {
  console.log('P2 style overrides: already applied');
} else {
  const accentBlock = ACCENT
    ? `    /* deck-specific accent slot (design_spec §2): single colour swap, no new highlight colour */
    :root, [data-theme="zen"] {
      --accent: ${ACCENT};
      --accent-color: ${ACCENT};
      --bullet-color: ${ACCENT};
      ${ACCENT_LIGHT ? `--accent-light: ${ACCENT_LIGHT};` : ''}
    }
`
    : '';
  const styleBlock = `  <style data-project-overrides="design_spec.md §2 §3 §4 §5 §7 §9 — white-bubble (zen × white-bubble)">
${accentBlock}    /* design_spec §4 — project-fixed variables (diagram/chart + warm-paper fallback) */
    :root {
      --vis-bg: #ece9e3;             /* warm paper — diagram backdrop + no-image fallback (§7, §9-5) */
      --vis-ink: #1f2a44;            /* SVG label/axis text */
      --vis-sub: rgba(31, 42, 68, 0.72);
      --vis-series-2: #1f2a44;       /* chart series 2 (comparison/past) */
      --vis-series-3: #6e7687;       /* chart series 3 (pdf_color_spec text_muted) */
    }

    /* design_spec §9-5 — warm paper fallback for photo-less slides (the 21
       visual_spec slides). Overrides zen's dark radial fallback (#1a1a2e →
       #0a0a14); matches pdf_color_spec background #ece9e3. */
    [data-theme="zen"] .slide:not([data-bg]) {
      background: var(--vis-bg, #ece9e3);
    }
    /* §2 — the faint dark photo wash applies to photos only; paper slides stay clean */
    [data-theme="zen"] .slide:not([data-bg]) .zen-overlay { display: none; }

    /* design_spec §7/§9-2 — diagram/chart SVG inside the white bubble card
       (zen has no right panel; visualImage renders in the content area) */
    [data-theme="zen"] .zen-visual-wrap { width: min(760px, 72vw); }
    [data-theme="zen"] .zen-visual {
      display: block;
      width: 100%;
      max-height: 40vh;
      object-fit: contain;
    }
    [data-theme="zen"] .zen-visual-caption {
      font-size: 0.875rem;                       /* §3 caption 14px muted */
      color: rgba(31, 42, 68, 0.55);
      margin-top: 0.25rem;
    }
    [data-theme="zen"] .zen-visual-source {
      font-size: 0.75rem;                        /* §3 source line 12px --text-dim */
      color: var(--text-dim, rgba(31, 42, 68, 0.4));
      margin-top: 0.15rem;
    }
    [data-theme="zen"] .zen-visual-panel { width: min(640px, 70vw); }

    /* design_spec §3 — visualTitle 24px/700 navy; visualDisplay lines 15px */
    [data-theme="zen"] .visual-heading {
      color: var(--vis-ink, #1f2a44);
      font-size: 1.5rem;
      border-bottom-color: rgba(31, 42, 68, 0.12);
    }
    [data-theme="zen"] .visual-item,
    [data-theme="zen"] .visual-paragraph {
      color: rgba(31, 42, 68, 0.82);
      font-size: 0.9375rem;                      /* 15px */
      text-align: left;
    }

    /* design_spec §9-7 — ⚠️ footnote lines: dim navy on paper slides;
       photo slides keep the ppt-engine default (white + shadow) */
    [data-theme="zen"] .slide:not([data-bg]) .slide-footnote {
      color: rgba(31, 42, 68, 0.55);
      text-shadow: none;
    }

    /* punchline 2-sentence layout (v1.2.0, U-20261116-009 item 3 promotion,
       design §4.2 item 3 — deck-patch parity): widen the white bubble card
       and clamp the punchline title so each \n-separated sentence stays on
       one line. Decks built WITHOUT this patch keep the legacy zen
       calc(--font-size-title * 2) = 64px title (the patch layer is opt-in
       per deck, unchanged contract). */
    [data-theme="zen"] .slide[data-type="punchline"] .slide-content {
      width: min(1120px, 90%);
    }
    [data-theme="zen"] .slide[data-type="punchline"] .slide-title {
      font-size: clamp(2rem, 3.6vw, 3.1rem);
    }
  </style>
`;
  const anchor = `  <link rel="stylesheet" href="../../docs/html-themes/styles/white-bubble/style.css">
`;
  replaceOnce(anchor, anchor + styleBlock, '2-style-overrides');
}

// ── P3: buildZenVisual_zen() ────────────────────────────────────────────
if (html.includes('function buildZenVisual_zen(')) {
  console.log('P3 buildZenVisual_zen: already applied');
} else {
  const fnBlock = `
    // ── Project extension (html-build; design_spec.md §5/§7/§9-2) ──────────
    // zen v3.0.0 has no right image panel, so per the locked design spec the
    // remaining visual kinds render INSIDE the white bubble card:
    //   visualImage  → diagram/chart SVG from the shared diagram pool
    //                  (+ visualCaption 14px muted, + visualSource 12px dim)
    //   visualTitle + visualDisplay → text panel via the shared
    //                  renderVisualDisplay() from ppt-engine.js
    function buildZenVisual_zen(parent, data, slideTitle) {
      if (data.visualImage) {
        var wrap = el("div", "zen-visual-wrap");
        var img = imgEl(data.visualImage, escapeText(data.visualCaption || data.visualTitle || slideTitle));
        img.className = "zen-visual";
        img.loading = "lazy";
        wrap.appendChild(img);
        parent.appendChild(wrap);
        if (data.visualCaption) parent.appendChild(el("p", "zen-visual-caption", data.visualCaption));
        if (data.visualSource) parent.appendChild(el("p", "zen-visual-source", data.visualSource));
        return;
      }
      if (data.visualDisplay) {
        var panel = el("div", "zen-visual-panel");
        if (data.visualTitle) panel.appendChild(el("div", "visual-heading", data.visualTitle));
        renderVisualDisplay(panel, data.visualDisplay);
        parent.appendChild(panel);
      }
    }
`;
  replaceOnce(
    `    // Titles support **keyword** markup like bullets, plus explicit line`,
    fnBlock + `    // Titles support **keyword** markup like bullets, plus explicit line`,
    '3-buildzenvisual',
  );
}

// ── P4: standard-branch call ────────────────────────────────────────────
if (html.includes('buildZenVisual_zen(content, data, title);')) {
  console.log('P4 standard-branch call: already applied');
} else {
  replaceOnce(
    `      buildBullets_zen(content, data.bullets);
      card.appendChild(content);
      // NO right-panel / visualImage rendering — zen is fullscreen background`,
    `      buildBullets_zen(content, data.bullets);
      buildZenVisual_zen(content, data, title);
      card.appendChild(content);
      // zen has no right panel — visualImage/visualDisplay render in the bubble card (see buildZenVisual_zen)`,
    '4-standard-branch',
  );
}

// ── P5: narration + auto_advance config ─────────────────────────────────
if (html.includes('initPPT({ transition: "fade", showTimer: true, narration: narrationConfig')) {
  console.log('P5 narration/autoAdvance config: already applied');
} else {
  replaceOnce(
    `    // ── Init ───────────────────────────────────────
    function initAll() {
      initSlides();
      showSlide(0);
      initPPT({ transition: "fade", showTimer: true });
    }`,
    `    // ── Init ───────────────────────────────────────
    // narration + auto_advance configs from lecture-profile.md:
    // narration.enabled true / auto_play false / ko primary;
    // auto_advance.enabled true / start_as_auto false / interval 8s.
    function initAll() {
      initSlides();
      showSlide(0);
      var narrationConfig = {
        enabled: true,
        autoPlay: false,
        defaultLanguage: "ko",
        scriptLanguage: "ko",
        languages: ["ko"]
      };
      var autoAdvanceConfig = {
        enabled: true,
        startAsAuto: false,
        interval: 8
      };
      initPPT({ transition: "fade", showTimer: true, narration: narrationConfig, autoAdvance: autoAdvanceConfig });
    }`,
    '5-init-config',
  );
}

// ── Post-validation: every inline <script> block must parse ─────────────
// Mirrors build-theme-deck.ts step 11.5 (vm.Script syntax-only compile).
const htmlWithoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
const scriptBlockRe = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
let m: RegExpExecArray | null;
let blocks = 0;
while ((m = scriptBlockRe.exec(htmlWithoutComments)) !== null) {
  const content = m[1];
  if (!content.trim()) continue;
  blocks += 1;
  try {
    new Script(content);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`inline <script> block #${blocks} has a JS syntax error: ${message}`);
  }
}

writeFileSync(HTML_PATH, html, 'utf-8');
console.log(`patched OK: ${HTML_PATH} (${blocks} inline script blocks validated)`);
