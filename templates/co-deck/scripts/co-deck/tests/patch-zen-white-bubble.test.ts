// @version 1.0.0 — v1.2.0 pins (design 2026-11-16-co-deck-pdf-html-backport
//   §4.2 item 3, U-20261116-009 item 3): the punchline 2-sentence layout
//   section in the patch-zen-white-bubble patch layer.
// patch-zen-white-bubble.test.ts — patch-layer regression pins for
// patch-zen-white-bubble.ts, run against a REAL built zen x white-bubble
// fixture deck (buildThemeDeck output), not hand-written HTML:
//   1. A freshly built deck keeps the legacy zen punchline title
//      (calc(--font-size-title * 2) = 64px) — no punchline patch rules.
//   2. Running the patch layer injects the two punchline rules (white bubble
//      widened to min(1120px, 90%) + title clamped to clamp(2rem, 3.6vw,
//      3.1rem)) — the deck-proven 2-sentence layout, deck-patch parity.
//   3. The patch layer stays opt-in per deck: the rules live in the
//      data-project-overrides block, not in any theme/style CSS file.
//   4. Re-running the patch is idempotent (single copy of the section).
//
// Run: bun test scripts/co-deck/tests/patch-zen-white-bubble.test.ts

import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { buildThemeDeck } from '../lib/theme-builder.js';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const TOOL = join(ROOT, 'scripts/co-deck/patch-zen-white-bubble.ts');

const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

// Fixture project matching the patch script's path convention:
//   deliverables/<slug>/lecture-profile.md
//   deliverables/<slug>/lecture_<slug>_v1.html
const SLUG = `_patchtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const dir = join(ROOT, 'deliverables', SLUG);
tmpDirs.push(dir);
const htmlPath = join(dir, `lecture_${SLUG}_v1.html`);

// A real built deck: zen template runtime + white-bubble style — exactly the
// deck shape the patch layer targets (P1 title already applied by the builder).
mkdirSync(dir, { recursive: true });
const build = buildThemeDeck({
  root: ROOT,
  projectPath: dir,
  theme: 'zen',
  style: 'white-bubble',
  title: 'Patch Layer Fixture Deck',
  slideData: [
    { section: 'S1', title: 'Standard Slide', bullets: ['one', 'two'] },
    { isPunchlineSlide: true, title: 'Statement one\nstatement two' },
  ],
  outputPath: htmlPath,
});
expect(build.errors).toHaveLength(0);
// buildThemeDeck returns the HTML — the CLI writes it; write it here
writeFileSync(htmlPath, build.html, 'utf-8');
expect(existsSync(htmlPath)).toBe(true);
writeFileSync(join(dir, 'lecture-profile.md'), 'title: "Patch Layer Fixture Deck"\n', 'utf-8');

function runPatch() {
  return spawnSync('bun', [TOOL, '--project', SLUG, '--version', 'v1'],
    { cwd: ROOT, encoding: 'utf-8', timeout: 60000 });
}

describe('patch-zen-white-bubble punchline 2-sentence layout (v1.2.0)', () => {
  test('a freshly built deck keeps the legacy zen punchline title (patch layer opt-in per deck)', () => {
    const pristine = readFileSync(htmlPath, 'utf-8');
    expect(pristine).not.toContain('min(1120px, 90%)');
    expect(pristine).not.toContain('clamp(2rem, 3.6vw, 3.1rem)');
    // legacy zen punchline sizing is untouched in theme.css (the built deck
    // links it, not inlines it — the 64px calc lives there)
    expect(readFileSync(join(ROOT, 'docs/html-themes/themes/zen/theme.css'), 'utf-8'))
      .toMatch(/\.slide\[data-type="punchline"\] \.slide-title \{\s*font-size: calc\(var\(--font-size-title, 2rem\) \* 2\);/);
  });

  test('the patch injects both punchline rules (widened card + clamped title)', () => {
    const res = runPatch();
    expect(res.status).toBe(0);
    const patched = readFileSync(htmlPath, 'utf-8');
    expect(patched).toContain('min(1120px, 90%)');
    expect(patched).toContain('clamp(2rem, 3.6vw, 3.1rem)');
    // both rules target the punchline slide kind
    expect(patched).toMatch(/\[data-theme="zen"\] \.slide\[data-type="punchline"\] \.slide-content \{\s*width: min\(1120px, 90%\);/);
    expect(patched).toMatch(/\[data-theme="zen"\] \.slide\[data-type="punchline"\] \.slide-title \{\s*font-size: clamp\(2rem, 3\.6vw, 3\.1rem\);/);
    // the rules ride the project-override block (deck-local, not theme CSS)
    expect(patched).toContain('data-project-overrides');
    expect(patched).toContain('punchline 2-sentence layout');
  });

  test('no theme/style CSS file gains the punchline patch (promotion goes to the patch layer only)', () => {
    for (const f of [
      join(ROOT, 'docs/html-themes/themes/zen/theme.css'),
      join(ROOT, 'docs/html-themes/styles/white-bubble/style.css'),
      join(ROOT, 'docs/html-themes/themes/_shared/ppt-engine.css'),
    ]) {
      expect(readFileSync(f, 'utf-8')).not.toContain('min(1120px, 90%)');
    }
  });

  test('re-running the patch is idempotent (single copy of the punchline section)', () => {
    const res = runPatch();
    expect(res.status).toBe(0);
    const patched = readFileSync(htmlPath, 'utf-8');
    expect(patched.split('punchline 2-sentence layout').length - 1).toBe(1);
    expect(patched.split('min(1120px, 90%)').length - 1).toBe(1);
    // every inline <script> block still parses (the patch's own post-validation ran)
    expect(res.stdout ?? '').toContain('inline script blocks validated');
  });
});
