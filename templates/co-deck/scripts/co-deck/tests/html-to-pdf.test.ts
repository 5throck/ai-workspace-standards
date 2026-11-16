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
import { existsSync, mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
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
});
