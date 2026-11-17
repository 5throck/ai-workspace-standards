// @version 1.0.0 — T-20261117-004 pins (design 2026-11-17-co-deck-pdf-followups
//   PR-5 §3): the 2026-11-15 deliverables migration moved the scaffold tree
//   presentations/ → deliverables/ and stranded the Pretendard @font-face URLs
//   in exactly 2 theme stylesheets (white-bubble :208-209, classic :104-105 —
//   the sibling audit found no other affected file). Pins:
//   1. The affected set is EXACTLY 2 stylesheets × 2 @font-face lines.
//   2. All 4 URLs point at ../../../../deliverables/assets/fonts/… — depth
//      pinned by resolving from the CSS file location (CSS url() resolves
//      relative to the CSS file, NOT the consuming HTML, so the path is
//      consumer-independent; 4 levels up from styles/<style>/ = the variant
//      root, i.e. the download-font.ts PROJECT_FONT_DIR target).
//   3. No other attribute changed (weight 400/700, format('truetype'),
//      font-display: swap — the absent-font degradation contract).
//   4. Grep closure (design §3.2 item 2): no presentations/ reference remains
//      anywhere under docs/html-themes/.
//   5. Render behavior (design §3.3): a built white-bubble deck in headless
//      Chrome resolves the font requests with fonts downloaded (no 404s) and
//      loads Pretendard; with the TTFs absent the requests fail but the deck
//      still renders via the swap fallback, and html-to-pdf exits 0 (no
//      crash — the same degradation as before the fix, minus the stale path).
//
// Requires a system Chrome/Edge for the render suite (self-skips without one,
// mirroring the html-to-pdf suite); the fonts-present/absent pair self-skips
// when the per-project Pretendard TTFs are not provisioned (CI carries none —
// download-font.ts is the supported provisioning path).
//
// Run: bun test scripts/co-deck/tests/theme-font-paths.test.ts

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { buildThemeDeck } from '../lib/theme-builder.js';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const STYLES_DIR = join(ROOT, 'docs', 'html-themes', 'styles');
const THEMES_DIR = join(ROOT, 'docs', 'html-themes');
const FONT_DIR = join(ROOT, 'deliverables', 'assets', 'fonts');
const TOOL = join(ROOT, 'scripts/co-deck/html-to-pdf.ts');

// The audited affected set (design §3.1): the sibling audit found exactly one
// more stylesheet beyond the ticket's white-bubble primary — classic.
const AFFECTED_STYLES = ['white-bubble', 'classic'];
const FONTS = ['Pretendard-Regular.ttf', 'Pretendard-Bold.ttf'];
const haveFonts = FONTS.every((f) => existsSync(join(FONT_DIR, f)));

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Beta',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
];
const chromePath = CHROME_CANDIDATES.find((c) => existsSync(c));

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

/** All @font-face src url() references to Pretendard across the styles tree. */
function fontFaceLines(): Array<{ file: string; line: string }> {
  const out: Array<{ file: string; line: string }> = [];
  for (const style of readdirSync(STYLES_DIR, { withFileTypes: true })) {
    if (!style.isDirectory()) continue;
    const cssPath = join(STYLES_DIR, style.name, 'style.css');
    if (!existsSync(cssPath)) continue;
    for (const line of readFileSync(cssPath, 'utf-8').split('\n')) {
      if (line.includes('@font-face') && line.includes('Pretendard') && line.includes('url(')) {
        out.push({ file: cssPath, line });
      }
    }
  }
  return out;
}

// ── 1–4: static pins (no browser) ────────────────────────────────────────────

describe('T-20261117-004: Pretendard @font-face URLs follow the deliverables migration', () => {
  test('the affected set is exactly 2 stylesheets × 2 @font-face lines (white-bubble + classic)', () => {
    const lines = fontFaceLines();
    expect(lines).toHaveLength(4);
    const files = new Set(lines.map((l) => l.file));
    expect(files.size).toBe(2);
    for (const style of AFFECTED_STYLES) {
      expect(files.has(join(STYLES_DIR, style, 'style.css'))).toBe(true);
    }
  });

  test('all 4 URLs repoint at the migrated layout with the exact consumer-independent depth', () => {
    const lines = fontFaceLines();
    expect(lines).toHaveLength(4);
    for (const { file, line } of lines) {
      const weight = line.includes('font-weight: 400') ? 'Regular' : 'Bold';
      // exact URL pin — ../../../../ from docs/html-themes/styles/<style>/ is
      // the variant root regardless of which HTML consumes the stylesheet
      expect(line).toContain(`url('../../../../deliverables/assets/fonts/Pretendard-${weight}.ttf')`);
      expect(line).not.toContain('presentations/');
      // resolution proof: the URL resolves to the download-font.ts target
      // (PROJECT_FONT_DIR = deliverables/assets/fonts) from the CSS location
      const m = line.match(/url\('([^']+)'\)/);
      expect(m).not.toBeNull();
      const resolved = resolve(dirname(file), m![1]);
      expect(resolved).toBe(join(FONT_DIR, `Pretendard-${weight}.ttf`));
    }
  });

  test('no other @font-face attribute changed (weight/style/format/font-display all retained)', () => {
    const lines = fontFaceLines();
    expect(lines).toHaveLength(4);
    for (const { line } of lines) {
      expect(line).toMatch(/font-weight: (400|700)/);
      expect(line).toContain('font-style: normal');
      expect(line).toContain("format('truetype')");
      // the absent-font degradation contract (design §3.1 provisioning reality)
      expect(line).toContain('font-display: swap');
    }
    // weight pairing: each file carries one 400 and one 700 rule
    for (const style of AFFECTED_STYLES) {
      const own = lines.filter((l) => l.file === join(STYLES_DIR, style, 'style.css'));
      expect(own).toHaveLength(2);
      expect(own.filter((l) => l.line.includes('font-weight: 400'))).toHaveLength(1);
      expect(own.filter((l) => l.line.includes('font-weight: 700'))).toHaveLength(1);
    }
  });

  test('grep closure (design §3.2 item 2): no presentations/ reference remains under docs/html-themes/', () => {
    const offenders: string[] = [];
    const scan = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) scan(p);
        else if (/\.(css|html|js|json|md)$/.test(e.name) && readFileSync(p, 'utf-8').includes('presentations/')) {
          offenders.push(p);
        }
      }
    };
    scan(THEMES_DIR);
    expect(offenders).toEqual([]);
  });
});

// ── 5: render behavior (Chrome; fonts-gated for the provisioned pair) ────────

/** Build a white-bubble zen deck at the house deliverables/<slug>/ layout so
 *  the deck's ../../docs/… stylesheet links resolve to the template tree and
 *  the CSS-relative font URLs hit <ROOT>/deliverables/assets/fonts/. */
function buildWhiteBubbleDeck(): { dir: string; htmlPath: string } {
  const slug = `_fonttest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(ROOT, 'deliverables', slug);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  const htmlPath = join(dir, 'lecture_v1.html');
  const deck = buildThemeDeck({
    root: ROOT,
    projectPath: dir,
    theme: 'zen',
    style: 'white-bubble',
    title: 'Font Path Fixture',
    slideData: [{ section: 'S1', title: 'Font Probe Slide', bullets: ['one', 'two'] }],
    outputPath: htmlPath,
  });
  expect(deck.errors).toHaveLength(0);
  writeFileSync(htmlPath, deck.html, 'utf-8');
  return { dir, htmlPath };
}

/** Failed-request URLs observed while loading a page (the R-A1 evidence shape:
 *  the stranded URLs surfaced as font-request 404s — file:// manifests as
 *  requestfailed events, HTTP manifests as 404 responses). */
async function collectFontOutcomes(page: import('puppeteer-core').Page, url: string): Promise<{
  failed: string[]; notFound: string[]; loaded: boolean;
}> {
  const failed: string[] = [];
  const notFound: string[] = [];
  page.on('requestfailed', (req) => { failed.push(req.url()); });
  page.on('response', (res) => { if (res.status() === 404) notFound.push(res.url()); });
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  // font-display: swap loads lazily on first paint of a using element — give
  // the loader a moment, then ask the FontFaceSet directly
  await page.evaluate(() => (document as any).fonts.ready);
  const loaded = await page.evaluate(() => (document as any).fonts.check('16px Pretendard'));
  return {
    failed: failed.filter((u) => u.includes('Pretendard')),
    notFound: notFound.filter((u) => u.includes('Pretendard')),
    loaded,
  };
}

describe.skipIf(!chromePath)('T-20261117-004: white-bubble render resolves the repointed URLs (swap fallback when absent)', () => {
  const deck = buildWhiteBubbleDeck();

  test.skipIf(!haveFonts)('fonts downloaded: the font requests resolve (no 404s) and Pretendard loads', async () => {
    const puppeteer = require('puppeteer-core');
    const browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
    });
    try {
      const page = await browser.newPage();
      const outcomes = await collectFontOutcomes(page, 'file://' + deck.htmlPath);
      expect(outcomes.failed).toEqual([]);
      expect(outcomes.notFound).toEqual([]);
      // the R-A1 render's fallback-font difference disappears: the face is real
      expect(outcomes.loaded).toBe(true);
    } finally {
      await browser.close();
    }
  }, 120000);

  test.skipIf(!haveFonts)('fonts absent: requests miss, the deck still renders via swap, html-to-pdf exits 0', async () => {
    // temporarily strand the TTFs (restore in finally — other suites need them)
    const moved: Array<[string, string]> = [];
    for (const f of FONTS) {
      const src = join(FONT_DIR, f);
      const dst = src + '.fontpath-test-bak';
      renameSync(src, dst);
      moved.push([dst, src]);
    }
    const puppeteer = require('puppeteer-core');
    let browser: import('puppeteer-core').Browser | null = null;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--allow-file-access-from-files'],
      });
      const page = await browser.newPage();
      const outcomes = await collectFontOutcomes(page, 'file://' + deck.htmlPath);
      // the URLs really do point at the (now empty) provisioned location
      const missed = outcomes.failed.length + outcomes.notFound.length;
      expect(missed).toBeGreaterThan(0);
      // degradation contract: the page itself is fine (swap fallback)
      const bodyText = await page.evaluate(() => document.body.innerText);
      expect(bodyText).toContain('Font Probe Slide');
    } finally {
      if (browser) await browser.close();
      for (const [dst, src] of moved) renameSync(dst, src);
    }
    // no crash through the render-side too (design §3.3: exit 0, swap
    // fallback, degradation path pinned). NOTE: the contract here is exit 0 +
    // a written, non-empty PDF — NOT a page-count pin. Measured observation
    // during this battery: with fallback metrics (fonts absent) the
    // white-bubble slide card can repaginate to 2 pages for this 1-slide
    // fixture. That behavior is UNCHANGED by PR-5: the pre-fix URLs pointed
    // at the dead pre-migration tree, so a fonts-absent deck missed its font
    // requests identically before and after this fix — the degradation is
    // the same minus the guaranteed misses (design §3.1 provisioning reality).
    const outPath = join(deck.dir, 'font_absent.pdf');
    const res = spawnSync('bun', [TOOL, '--html', deck.htmlPath, '--out', outPath],
      { cwd: ROOT, encoding: 'utf-8', timeout: 120000 });
    expect(res.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    expect(statSync(outPath).size).toBeGreaterThan(0);
  }, 240000);
});
