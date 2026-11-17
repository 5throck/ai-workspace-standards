// @version 1.3.0 — T-20261117-006 (pitch buildBullets template fix): the pitch
//   spot-render blocker is resolved — pitch/template.html now defines
//   buildBullets (the sibling-theme helper shape: ul.slide-bullets + li +
//   appendInline, styled by pitch/theme.css .slide-bullets), so a built pitch
//   deck renders MEASURED page count == slide count through html-to-pdf. The
//   DEC-20261117-04 static fallback pin is swapped for the measured render;
//   the fallback's static selector-safety checks (denylist hooks + template
//   chrome ids) are retained alongside it, and the loud zero-slide blocker pin
//   is removed — it pinned the defect, not the contract.
// @version 1.2.0 — PR-5 folded deferrals (design 2026-11-17-co-deck-pdf-
//   followups §1.3 auditor disposition, DEC-20261117-04 appended entry): the
//   two verification items PR-4 deferred. (a) outlook + pitch spot-render
//   pins — the §1.2 denylist + wrapper reset are theme-safe: a built outlook
//   deck (no ppt-engine wrappers, own nav chrome) and a built pitch deck
//   (carries .presentation-container) each render MEASURED page count ==
//   slide count. (b) first/last page content identity — pdf-lib alone cannot
//   do this (it reads the page tree and counts pages; it has no glyph/text
//   decoder, so page CONTENT is invisible to it), so the identity pins run
//   through pdftotext with the repo's graceful-skip convention
//   (gen-slides-pdf-render.test.ts): page 1 is slide 1 (its title and its
//   in-card notes render; the TOC drawer's later-slide titles do not), the
//   last page is the last slide (its title renders; the notes text that a
//   leaked #script-panel trailing page would carry does not).
// @version 1.1.0 — v1.3.1 pins (design 2026-11-17-co-deck-pdf-followups PR-4,
//   T-20261117-002/-003): MEASURED PDF page counts via pdf-lib (the "Pages:"
//   log is computed, not measured — design §2.1). T-002 chrome-hide denylist:
//   full-deck render page count == slide count (no TOC-drawer page 1, no
//   notes-panel trailing page); source pins for the audited selector set +
//   legacy-retention + no structural body>:not() chain. T-003 --pages class
//   exclusion: --pages 2 renders EXACTLY 2 pages (the v1.2.0-era inline
//   display:none was silently overridden by the print block's flex !important);
//   --pages N >= slide count renders the full deck with no Hidden log; the
//   legacy <section> twin is covered by the same .cdk-page-hidden rule.
// @version 1.0.0 — v1.3.0 pins (design 2026-11-16-co-deck-pdf-html-backport
//   PR-2, U-008 item 1): dual-selector slide discovery + loud zero-slide
//   failure for html-to-pdf.
// html-to-pdf.test.ts — CLI-level regression pins for html-to-pdf.ts.
//
// Pins (design §1.3 fixtures A–C):
//   Fixture A (runtime deck): a built zen deck (div.slide, ppt-engine
//     runtime-rendered — every deck html-build produces today) renders ≥1
//     page, exit 0, and the log names the '.slide' selector with a non-zero
//     count (--pages exercises the limit-hiding branch on the .slide set).
//   Fixture B (selector-less page): a plain HTML page with neither 'section'
//     nor '.slide' exits 1 with the loud zero-slide error naming both
//     selectors and writes NO output PDF (owner decision O-4).
//   Fixture C (legacy static deck): a hand-written <section> deck renders
//     exactly as before (the legacy path's regression pin).
//
// Requires a system Chrome/Edge (the script's own transport); the suite
// self-skips when none is installed (CI), mirroring the font-skip convention.
//
// Run: bun test scripts/co-deck/tests/html-to-pdf.test.ts

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { buildThemeDeck } from '../lib/theme-builder.js';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const TOOL = join(ROOT, 'scripts/co-deck/html-to-pdf.ts');

// Same candidate list as the script's findChrome() — no browser, no suite.
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Beta',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const haveChrome = CHROME_CANDIDATES.some((c) => existsSync(c));

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

/** Fixture project dir under deliverables/ (house convention: rm in afterAll). */
function makeFixtureDir(tag: string): string {
  const dir = join(ROOT, 'deliverables', `_htmlpdf_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  // cssRoot '../../docs/html-themes' resolves to <ROOT>/docs/html-themes only
  // when the wire path reaches the server's serve root; a docs symlink inside
  // the served deck dir keeps the deck styled (and the 404 summary clean).
  try { symlinkSync(join(ROOT, 'docs'), join(dir, 'docs'), 'dir'); } catch { /* best effort */ }
  return dir;
}

function runTool(htmlPath: string, extraArgs: string[] = []) {
  return spawnSync('bun', [TOOL, '--html', htmlPath, ...extraArgs],
    { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
}

/** MEASURED PDF page count via pdf-lib (design §2.1: the "Pages:" log line is
 *  computed, never measured — the pins below must read the actual artifact). */
async function pdfPageCount(pdfPath: string): Promise<number> {
  const doc = await PDFDocument.load(readFileSync(pdfPath));
  return doc.getPageCount();
}

// ── Fixture A: built zen runtime deck (div.slide) ────────────────────────────

const zenRun: {
  dir: string; htmlPath: string; res?: ReturnType<typeof runTool>; pdfPath?: string;
} = (() => {
  const dir = makeFixtureDir('zen');
  const deck = buildThemeDeck({
    root: ROOT,
    projectPath: dir,
    theme: 'zen',
    style: 'white-bubble',
    title: 'HTML-to-PDF Slide Discovery Fixture',
    slideData: [
      { section: 'S1', title: 'Runtime Slide One', bullets: ['one', 'two', 'three'] },
      { section: 'S1', title: 'Runtime Slide Two', bullets: ['four', 'five'] },
      { section: 'S1', title: 'Runtime Slide Three', bullets: ['six'] },
    ],
    outputPath: join(dir, 'lecture_v1.html'),
  });
  expect(deck.errors).toHaveLength(0);
  const htmlPath = join(dir, 'lecture_v1.html');
  // buildThemeDeck returns the HTML — the CLI writes it; write it here
  writeFileSync(htmlPath, deck.html, 'utf-8');
  expect(existsSync(htmlPath)).toBe(true);
  return { dir, htmlPath };
})();

describe.skipIf(!haveChrome)('html-to-pdf v1.3.0 — dual-selector slide discovery', () => {
  beforeAll(() => {
    // Fixture A: the ticket repro shape — a modern runtime deck must render,
    // exit 0. --pages 2 exercises the limit-hiding branch on the .slide set.
    const res = runTool(zenRun.htmlPath, ['--pages', '2']);
    expect(res.status).toBe(0);
    zenRun.res = res;
    zenRun.pdfPath = join(zenRun.dir, 'lecture_v1.pdf');
  }, 240000);

  test('Fixture A: the zen div.slide deck renders with the .slide selector and a non-zero count', () => {
    const out = `${zenRun.res!.stdout ?? ''}${zenRun.res!.stderr ?? ''}`;
    expect(out).toMatch(/Slides: 3 \(selector: '\.slide' — \.slide: 3, section: 0\)/);
    // --pages 2 hides slide 3 and renders exactly 2 pages
    expect(out).toContain('✂️  Hidden 1 slides (keeping first 2)');
    expect(out).toMatch(/Pages: 2 \(total slides: 3\)/);
  });

  test('Fixture A (v1.3.1 T-003): the MEASURED page count is exactly 2 — the --pages exclusion actually hides', async () => {
    // The v1.2.0-era defect: inline display:none was overridden by the print
    // block's `section, .slide { display: flex !important }` twin, so every
    // slide still generated a page. The .cdk-page-hidden rule (0,2,0) fixes it.
    expect(await pdfPageCount(zenRun.pdfPath!)).toBe(2);
  });

  test('Fixture A: the PDF file is written and non-empty', () => {
    expect(existsSync(zenRun.pdfPath!)).toBe(true);
    expect(statSync(zenRun.pdfPath!).size).toBeGreaterThan(0);
  });

  test('Fixture A: the deck CSS is served through the docs symlink (no CSS 404s)', () => {
    const out = `${zenRun.res!.stdout ?? ''}${zenRun.res!.stderr ?? ''}`;
    // The docs symlink keeps the deck styled. Font 404s are a pre-existing
    // stale-path observation (design §8: white-bubble font URLs reference the
    // pre-deliverables-migration presentations/ tree — out of scope here), so
    // only CSS-asset resolution is pinned.
    expect(out).not.toContain('404 (missing): docs/html-themes');
  });
});

// ── Fixture B: selector-less page — loud exit 1, no PDF ──────────────────────

describe.skipIf(!haveChrome)('html-to-pdf v1.3.0 — loud zero-slide failure (O-4)', () => {
  const dir = makeFixtureDir('none');
  const htmlPath = join(dir, 'plain.html');
  const outPath = join(dir, 'custom-out.pdf');

  beforeAll(() => {
    writeFileSync(htmlPath, [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"><title>Not A Deck</title></head>',
      '<body><h1>Plain document — no section, no slide</h1>',
      '<div class="content">Nothing the renderer counts as a slide.</div>',
      '</body></html>',
    ].join('\n'), 'utf-8');
  });

  test('Fixture B: a plain HTML page exits 1 naming the input and both selectors', () => {
    const res = runTool(htmlPath);
    expect(res.status).toBe(1);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(out).toContain('Zero slides found — no PDF written');
    expect(out).toContain(htmlPath);
    expect(out).toContain("'.slide'");
    expect(out).toContain("'section'");
    expect(out).toContain('build-theme-deck.ts');
  });

  test('Fixture B: no output PDF is written (default or explicit --out)', () => {
    expect(existsSync(join(dir, 'plain.pdf'))).toBe(false);
    expect(existsSync(outPath)).toBe(false);
  });

  test('Fixture B: an explicit --out path also stays unwritten', () => {
    const res = runTool(htmlPath, ['--out', outPath]);
    expect(res.status).toBe(1);
    expect(existsSync(outPath)).toBe(false);
  });
});

// ── Fixture C: legacy static <section> deck renders unchanged ────────────────

describe.skipIf(!haveChrome)('html-to-pdf v1.3.0 — legacy section deck unchanged', () => {
  const dir = makeFixtureDir('legacy');
  const htmlPath = join(dir, 'legacy_deck.html');
  let res: ReturnType<typeof runTool> | null = null;

  beforeAll(() => {
    writeFileSync(htmlPath, [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"><title>Legacy Section Deck</title>',
      '<style>',
      '  body { margin: 0; }',
      '  .wrap { display: flex; flex-direction: column; }',
      '  section { height: 100vh; page-break-after: always; }',
      '</style></head>',
      '<body><div class="wrap">',
      '  <section><h1>Legacy Slide One</h1></section>',
      '  <section class="center"><h1>Legacy Cover</h1></section>',
      '  <section><h1>Legacy Slide Three</h1></section>',
      '</div></body></html>',
    ].join('\n'), 'utf-8');
    res = runTool(htmlPath);
  }, 240000);

  test('Fixture C: the section selector is used and all 3 sections render', () => {
    expect(res!.status).toBe(0);
    const out = `${res!.stdout ?? ''}${res!.stderr ?? ''}`;
    expect(out).toMatch(/Slides: 3 \(selector: 'section' — \.slide: 0, section: 3\)/);
    expect(out).toMatch(/Pages: 3 \(total sections: 3\)/);
    expect(existsSync(join(dir, 'legacy_deck.pdf'))).toBe(true);
  });

  test('Fixture C (v1.3.1 T-002): the MEASURED page count equals the section count (chrome-hide additions touch no section rules)', async () => {
    expect(await pdfPageCount(join(dir, 'legacy_deck.pdf'))).toBe(3);
  });
});

// ── v1.3.1 T-002 (design §1.2/§1.3): chrome-hide denylist — pages == slides ──
//
// The legacy hide vocabulary (.footer-bar/.note-panel/.toc) matched none of
// the audited theme chrome, so with overflow:visible + height:auto the fixed
// chrome entered the printed flow: TOC drawer = page 1, speaker-notes panel
// = trailing page (the R-A1 observation: 49 pages for 47 slides). The
// audited denylist makes the MEASURED page count equal the slide count.

describe.skipIf(!haveChrome)('html-to-pdf v1.3.1 T-002 — chrome-hide denylist (pages == slides)', () => {
  const outPath = join(zenRun.dir, 'full.pdf');
  let res: ReturnType<typeof runTool> | null = null;

  beforeAll(() => {
    // Full-deck render, no --pages: the filter branch must not run at all.
    res = runTool(zenRun.htmlPath, ['--out', outPath]);
    expect(res!.status).toBe(0);
  }, 240000);

  test('the MEASURED page count equals the slide count (no drawer/notes pages)', async () => {
    expect(await pdfPageCount(outPath)).toBe(3);
  });

  test('first-run/no-filter unaffected: no Hidden log, output written', () => {
    const out = `${res!.stdout ?? ''}${res!.stderr ?? ''}`;
    expect(out).not.toContain('Hidden');
    expect(out).not.toContain('cdk-page-hidden');
    expect(existsSync(outPath)).toBe(true);
  });

  test('source pin: the audited denylist selectors are present, legacy selectors retained', () => {
    const src = readFileSync(TOOL, 'utf-8');
    for (const sel of ['#toc-drawer', '#toc-overlay', '#script-panel', 'footer,', '.ppt-footer', '.progress-bar-wrap']) {
      expect(src).toContain(sel);
    }
    // legacy vocabulary kept (harmless; the preview fixtures still use some)
    for (const sel of ['.footer-bar', '.note-panel', '.toc-backdrop', '.toc-toggle']) {
      expect(src).toContain(sel);
    }
  });

  test('source pin: no structural body > :not() chain in the injected print CSS (design §1.2 rejection)', () => {
    const src = readFileSync(TOOL, 'utf-8');
    // Pin the injected CSS itself, not doc-comment prose (the v1.3.1 header
    // mentions the rejection in prose).
    const cssStart = src.indexOf('content: `');
    const cssEnd = src.indexOf('`,', cssStart);
    expect(cssStart).toBeGreaterThan(-1);
    expect(cssEnd).toBeGreaterThan(cssStart);
    const css = src.slice(cssStart, cssEnd);
    expect(css).not.toMatch(/body\s*>\s*:not\(/);
  });
});

// ── v1.3.1 T-003 (design §2.2/§2.3): --pages class exclusion ─────────────────

describe.skipIf(!haveChrome)('html-to-pdf v1.3.1 T-003 — --pages class-based exclusion', () => {
  test('--pages N >= slide count renders the full deck (no filter branch, no Hidden log)', async () => {
    const outPath = join(zenRun.dir, 'pages5.pdf');
    const res = runTool(zenRun.htmlPath, ['--pages', '5', '--out', outPath]);
    expect(res.status).toBe(0);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(out).not.toContain('Hidden');
    expect(await pdfPageCount(outPath)).toBe(3);
  });

  test('legacy <section> deck with --pages 2 renders exactly 2 pages (the section twin is covered by the same class rule)', async () => {
    const dir = makeFixtureDir('legacy-pages');
    const htmlPath = join(dir, 'legacy_pages.html');
    writeFileSync(htmlPath, [
      '<!DOCTYPE html>',
      '<html><head><meta charset="utf-8"><title>Legacy Pages Deck</title>',
      '<style>',
      '  body { margin: 0; }',
      '  .wrap { display: flex; flex-direction: column; }',
      '  section { height: 100vh; page-break-after: always; }',
      '</style></head>',
      '<body><div class="wrap">',
      '  <section><h1>Legacy Page One</h1></section>',
      '  <section><h1>Legacy Page Two</h1></section>',
      '  <section><h1>Legacy Page Three</h1></section>',
      '</div></body></html>',
    ].join('\n'), 'utf-8');
    const outPath = join(dir, 'legacy_pages.pdf');
    const res = runTool(htmlPath, ['--pages', '2', '--out', outPath]);
    expect(res.status).toBe(0);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(out).toContain('✂️  Hidden 1 slides (keeping first 2)');
    expect(await pdfPageCount(outPath)).toBe(2);
  });

  test('source pin: the filter adds .cdk-page-hidden and the print block honors it at 0,2,0 for both selectors', () => {
    const src = readFileSync(TOOL, 'utf-8');
    expect(src).toContain("classList.add('cdk-page-hidden')");
    // the exclusion rule carries both compound selectors (section twin covered too)
    expect(src).toMatch(/section\.cdk-page-hidden, \.slide\.cdk-page-hidden \{/);
    // and it resets the trailing break as designed (§2.2 item 2)
    expect(src).toMatch(/section\.cdk-page-hidden, \.slide\.cdk-page-hidden \{[\s\S]{0,300}?page-break-after: auto !important;[\s\S]{0,200}?break-after: auto !important;/);
    // the cdk namespace matches the injector marker convention; no theme CSS
    // declares the class (design R-B1 collision check)
    const cssDir = join(ROOT, 'docs', 'html-themes');
    const offenders: string[] = [];
    const scan = (d: string) => {
      for (const e of require('node:fs').readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) scan(p);
        else if (e.name.endsWith('.css') && readFileSync(p, 'utf-8').includes('cdk-page-hidden')) offenders.push(p);
      }
    };
    scan(cssDir);
    expect(offenders).toEqual([]);
  });
});

// ── v1.2.0 (PR-5): folded PR-4 deferrals — theme-safety spot renders +
//    first/last page content identity (DEC-20261117-04 appended entry) ───────
//
// Design §1.3's theme-safety pin ("spot-render an outlook and a pitch deck
// fixture: page count == slide count") and content-identity pin ("first page
// is slide 1, last page is the last slide") were deferred from PR-4's battery
// into this batch. Both run here against BUILT decks — no outlook/pitch HTML
// fixtures existed in the template test env, and buildThemeDeck produces them
// at test time (the video-slide suite builds all six themes the same way).

const havePdftotext = spawnSync('pdftotext', ['-v'], { encoding: 'utf-8' }).status !== null;

/** Single-page text extraction (poppler -f/-l). pdf-lib cannot do this — it
 *  reads the page tree (counts, boxes) but has no glyph/text decoder; this
 *  mirrors the graceful-skip convention of gen-slides-pdf-render.test.ts.
 *  Exit check reads `status` (bun's spawnSync leaves `exitCode` undefined on
 *  success — the sibling file's exitCode-based check silently vacates its
 *  null-guarded pins under bun). */
function pdfPageText(pdfPath: string, page: number): string | null {
  if (!havePdftotext) return null;
  const bin = spawnSync('pdftotext', ['-f', String(page), '-l', String(page), pdfPath, '-'],
    { encoding: 'utf-8' });
  return bin.status === 0 || bin.exitCode === 0 ? bin.stdout : null;
}

/** Build a full ppt-engine deck of a non-zen theme at the house deliverables
 *  layout (style: classic — the proven generic pairing, video-slide suite). */
function buildSpotDeck(theme: string): { dir: string; htmlPath: string } {
  const dir = makeFixtureDir(`spot-${theme}`);
  const htmlPath = join(dir, 'lecture_v1.html');
  const deck = buildThemeDeck({
    root: ROOT,
    projectPath: dir,
    theme,
    style: 'classic',
    title: 'Theme Safety Spot Fixture',
    slideData: [
      { section: 'S1', title: `${theme} Spot One`, bullets: ['one', 'two'] },
      { section: 'S1', title: `${theme} Spot Two`, bullets: ['three'] },
      { section: 'S1', title: `${theme} Spot Three`, bullets: ['four'] },
    ],
    outputPath: htmlPath,
  });
  expect(deck.errors).toHaveLength(0);
  writeFileSync(htmlPath, deck.html, 'utf-8');
  return { dir, htmlPath };
}

describe.skipIf(!haveChrome)('html-to-pdf PR-5 folded deferrals — outlook/pitch spot renders (pages == slides)', () => {
  test('a built outlook deck renders MEASURED page count == slide count (own nav chrome, no ppt-engine wrappers)', async () => {
    const deck = buildSpotDeck('outlook');
    const outPath = join(deck.dir, 'spot.pdf');
    const res = runTool(deck.htmlPath, ['--out', outPath]);
    expect(res.status).toBe(0);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(out).toMatch(/Slides: 3/);
    expect(await pdfPageCount(outPath)).toBe(3);
  }, 240000);

  // Pitch spot-render (T-20261117-006): the DEC-20261117-04 fallback is
  // retired. pitch/template.html now defines buildBullets (the sibling-theme
  // helper shape — ul.slide-bullets + li + appendInline, styled by pitch's
  // theme.css), so a built pitch deck renders like the other ppt-engine
  // themes: measured page count == slide count. Pitch carries
  // .presentation-container (the §1.2 wrapper reset), so this render also
  // exercises the wrapper-reset coverage the DEC-04 fallback delegated to the
  // zen decks.
  test('a built pitch deck renders MEASURED page count == slide count (ppt-engine wrapper reset measured)', async () => {
    const deck = buildSpotDeck('pitch');
    const outPath = join(deck.dir, 'spot.pdf');
    const res = runTool(deck.htmlPath, ['--out', outPath]);
    expect(res.status).toBe(0);
    const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
    expect(out).toMatch(/Slides: 3/);
    expect(await pdfPageCount(outPath)).toBe(3);
    expect(existsSync(outPath)).toBe(true);
  }, 240000);

  test('source pin: pitch/template.html defines the helper it calls + carries the chrome hooks the denylist targets', () => {
    const pitchSrc = readFileSync(join(ROOT, 'docs', 'html-themes', 'themes', 'pitch', 'template.html'), 'utf-8');
    // the T-20261117-006 defect shape (call without definition) pinned closed
    expect(pitchSrc).toContain('buildBullets(leftCol');
    expect(pitchSrc).toMatch(/function\s+buildBullets\b/);
    // static selector safety retained from the DEC-04 fallback pin:
    // pitch's chrome ids + wrapper are all covered
    const src = readFileSync(TOOL, 'utf-8');
    for (const sel of ['#toc-drawer', '#toc-overlay', '.ppt-footer', 'footer']) {
      expect(src).toContain(sel);
    }
    expect(src).toContain('.ppt-main, .presentation-container');
    // and the template itself carries exactly those chrome hooks
    for (const id of ['toc-drawer', 'toc-overlay', 'presentation']) {
      expect(pitchSrc).toContain(`id="${id}"`);
    }
    expect(pitchSrc).toContain('ppt-footer');
  });
});

describe.skipIf(!haveChrome)('html-to-pdf PR-5 folded deferrals — first/last page content identity', () => {
  // Own fixture (PR-4 pins keep their deck untouched): notes on slide 1 make
  // the identity pins two-sided — the notes text legitimately renders IN the
  // slide-1 card, and a leaked #script-panel would also put it on a trailing
  // page. Unique titles catch a leaked TOC drawer on page 1.
  const idDir = makeFixtureDir('identity');
  const idHtmlPath = join(idDir, 'identity_v1.html');
  const idPdfPath = join(idDir, 'identity_v1.pdf');
  beforeAll(() => {
    const deck = buildThemeDeck({
      root: ROOT,
      projectPath: idDir,
      theme: 'zen',
      style: 'white-bubble',
      title: 'Page Identity Fixture',
      slideData: [
        { section: 'S1', title: 'Identity Slide One First', bullets: ['alpha'],
          notes: ['Source: Identity Notes Panel Probe Line'] },
        { section: 'S1', title: 'Identity Slide Two Middle', bullets: ['beta'] },
        { section: 'S1', title: 'Identity Slide Three Last', bullets: ['gamma'] },
      ],
      outputPath: idHtmlPath,
    });
    expect(deck.errors).toHaveLength(0);
    writeFileSync(idHtmlPath, deck.html, 'utf-8');
    const res = runTool(idHtmlPath, ['--out', idPdfPath]);
    expect(res.status).toBe(0);
  }, 240000);

  test.skipIf(!havePdftotext)('MEASURED count == 3 and page 1 is slide 1 (title + in-card notes, no drawer titles)', async () => {
    expect(await pdfPageCount(idPdfPath)).toBe(3);
    const first = pdfPageText(idPdfPath, 1);
    expect(first).not.toBeNull();
    // normalize — wrapped slide titles extract with internal newlines
    const flat = first!.replace(/\s+/g, ' ');
    expect(flat).toContain('Identity Slide One First');
    // the in-card notes band renders on slide 1's page
    expect(flat).toContain('Identity Notes Panel Probe Line');
    // a leaked TOC drawer page would carry the later slides' titles
    expect(flat).not.toContain('Identity Slide Three Last');
    expect(flat).not.toContain('Identity Slide Two Middle');
  }, 120000);

  test.skipIf(!havePdftotext)('the last page is the last slide (its title, no notes-panel text, no slide-1 content)', async () => {
    const last = pdfPageText(idPdfPath, 3);
    expect(last).not.toBeNull();
    const flat = last!.replace(/\s+/g, ' ');
    expect(flat).toContain('Identity Slide Three Last');
    // a leaked #script-panel trailing page would carry the notes text
    expect(flat).not.toContain('Identity Notes Panel Probe Line');
    expect(flat).not.toContain('Identity Slide One First');
  }, 120000);
});
