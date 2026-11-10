/**
 * inject-video-players.ts pin (T-20261007-008, design
 * docs/designs/2026-10-09-co-deck-injector-promotion-design.md): idempotent
 * marker-based injection, triple fallback wiring, no-video hard exit.
 *
 * v1.2.0 (T-20261110-005, design
 * docs/designs/2026-11-10-co-deck-root-tooling-design.md): --slidedata default
 * anchored beside the deck HTML (runs from an unrelated CWD need no flag),
 * missing-slidedata named-path failure, warn-only project-local injector WARNING.
 *
 * Runs the real CLI against a synthetic deck fixture (bun test scripts/co-deck/tests/).
 *
 * @version 1.2.0
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOL = join(import.meta.dir, '..', 'inject-video-players.ts');
// An empty directory unrelated to any deck — the CWD for the default-resolution
// cases, so a CWD-relative 'slidedata.json' default could never resolve there.
let root = '';
let deck = '';

interface FixtureOpts { omitSlidedata?: boolean; withLocalInjector?: boolean }

function fixture(withVideos: boolean, withLocal: boolean, opts: FixtureOpts = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'cdk-inject-'));
  const slides = withVideos
    ? [
        { title: 'cover' },
        { title: 'talk', videoId: 'dQw4w9WgXcQ' },
        { title: 'local-clip', videoId: 'abc123defg', ...(withLocal ? { videoLocal: 'clip-local.mp4' } : {}) },
      ]
    : [{ title: 'cover' }, { title: 'no media' }];
  if (!opts.omitSlidedata) writeFileSync(join(dir, 'slidedata.json'), JSON.stringify(slides));
  if (opts.withLocalInjector) {
    writeFileSync(join(dir, 'inject_video_players.py'), '"""REBUILD ORDER: build -> patch -> this script."""\n');
  }
  writeFileSync(
    join(dir, 'deck.html'),
    '<html><body><div id="presentation"><div id="slide-0"></div><div id="slide-1"></div><div id="slide-2"></div></div></body></html>',
  );
  if (withVideos && withLocal) {
    mkdirSync(join(dir, 'assets', 'videos'), { recursive: true });
    writeFileSync(join(dir, 'assets', 'videos', 'clip-local.mp4'), 'fake-mp4-bytes');
  }
  return dir;
}

function run(dir: string) {
  return spawnSync('bun', [TOOL, join(dir, 'deck.html'), '--slidedata', join(dir, 'slidedata.json'), '--assets-dir', join(dir, 'assets', 'videos')], { encoding: 'utf-8' });
}

// v1.2.0: no --slidedata, CWD = an unrelated empty directory.
function runDefault(dir: string) {
  return spawnSync('bun', [TOOL, join(dir, 'deck.html')], { encoding: 'utf-8', cwd: root });
}

describe('inject-video-players (T-20261007-008 promotion pin)', () => {
  let d1: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'cdk-inject-cwd-'));
    d1 = fixture(true, true);
    deck = join(d1, 'deck.html');
  });
  afterAll(() => {
    for (const d of [root, d1].filter(Boolean)) rmSync(d, { recursive: true, force: true });
  });

  test('injects the marker block and wires both fallbacks', () => {
    const res = run(d1);
    expect(res.status).toBe(0);
    const out = readFileSync(deck, 'utf8');
    expect(out).toContain('<style id="cdk-video-players">');
    expect(out).toContain('assets/videos/clip-local.mp4'); // local fallback: deck-relative (portable)
    expect(out).toContain('youtube.com/embed/'); // inline iframe fallback present
    expect(out).toContain('MutationObserver'); // stop-on-slide-change observer present
    expect(out.indexOf('<style id="cdk-video-players">')).toBeLessThan(out.indexOf('</body>'));
  });

  test('re-injection is byte-identical (idempotency contract)', () => {
    const before = readFileSync(deck, 'utf8');
    const res = run(d1);
    expect(res.status).toBe(0);
    expect(readFileSync(deck, 'utf8')).toBe(before);
  });

  test('deck without video slides exits non-zero without writing', () => {
    const d2 = fixture(false, false);
    const before = readFileSync(join(d2, 'deck.html'), 'utf8');
    const res = run(d2);
    expect(res.status).toBe(1);
    expect(readFileSync(join(d2, 'deck.html'), 'utf8')).toBe(before);
    rmSync(d2, { recursive: true, force: true });
  });

  // U-20261029-005: slides the template rendered natively (ppt-engine
  // VideoSlide marks them data-video="1") must not receive an overlay stage —
  // the injected binding loop skips them client-side.
  test('native video slides (data-video="1") are skipped by the binding loop', () => {
    const d3 = fixture(true, false);
    const deck3 = join(d3, 'deck.html');
    // Mark slide-1 as natively rendered by the template's VideoSlide.
    const html = readFileSync(deck3, 'utf8')
      .replace('<div id="slide-1"></div>', '<div id="slide-1" class="video-slide" data-video="1"></div>');
    writeFileSync(deck3, html);
    const res = run(d3);
    expect(res.status).toBe(0);
    const out = readFileSync(deck3, 'utf8');
    // The injected script carries the native-slide skip guard...
    expect(out).toContain('el.dataset.video');
    // ...and the vids array still lists the video (skip happens at binding time).
    expect(out).toContain('dQw4w9WgXcQ');
    rmSync(d3, { recursive: true, force: true });
  });

  // T-20261110-005 (v1.2.0): the --slidedata default is anchored to the deck
  // HTML's own directory — a manual re-run from the repo root (or any other
  // CWD) needs no flag and no longer ENOENTs on a CWD-relative default.
  test('default --slidedata resolves beside the deck HTML from an unrelated CWD', () => {
    const d4 = fixture(true, false);
    const res = runDefault(d4);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('ENOENT');
    expect(res.stderr).not.toContain('WARNING'); // no local injector -> no warning
    expect(readFileSync(join(d4, 'deck.html'), 'utf8')).toContain('<style id="cdk-video-players">');
    rmSync(d4, { recursive: true, force: true });
  });

  test('missing slidedata exits 1 with a named-path error and leaves the deck untouched', () => {
    const d5 = fixture(true, false, { omitSlidedata: true });
    const deck5 = join(d5, 'deck.html');
    const before = readFileSync(deck5, 'utf8');
    const res = runDefault(d5);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('slidedata not found at');
    expect(res.stderr).toContain(join(d5, 'slidedata.json')); // names the attempted path
    expect(res.stderr).toContain('--slidedata'); // names the remedy
    expect(res.stderr).not.toContain('ENOENT'); // no raw stack
    expect(readFileSync(deck5, 'utf8')).toBe(before);
    rmSync(d5, { recursive: true, force: true });
  });

  test('project-local injector in the deck dir triggers a warn-only stderr WARNING', () => {
    const d6 = fixture(true, false, { withLocalInjector: true });
    const res = runDefault(d6);
    expect(res.status).toBe(0); // warn-only: exit code unchanged
    expect(res.stderr).toContain('WARNING: project-local injector(s) found: inject_video_players.py');
    expect(res.stderr).toContain('REBUILD ORDER');
    expect(res.stderr).toContain('VERSIONS.md');
    // Output unchanged by the warning: the generic injection still lands.
    expect(readFileSync(join(d6, 'deck.html'), 'utf8')).toContain('<style id="cdk-video-players">');
    rmSync(d6, { recursive: true, force: true });
  });
});
