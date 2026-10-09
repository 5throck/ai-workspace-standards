/**
 * inject-video-players.ts pin (T-20261007-008, design
 * docs/designs/2026-10-09-co-deck-injector-promotion-design.md): idempotent
 * marker-based injection, triple fallback wiring, no-video hard exit.
 *
 * Runs the real CLI against a synthetic deck fixture (bun test scripts/co-deck/tests/).
 *
 * @version 1.0.0
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOL = join(import.meta.dir, '..', 'inject-video-players.ts');
let root = '';
let deck = '';

function fixture(withVideos: boolean, withLocal: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'cdk-inject-'));
  const slides = withVideos
    ? [
        { title: 'cover' },
        { title: 'talk', videoId: 'dQw4w9WgXcQ' },
        { title: 'local-clip', videoId: 'abc123defg', ...(withLocal ? { videoLocal: 'clip-local.mp4' } : {}) },
      ]
    : [{ title: 'cover' }, { title: 'no media' }];
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify(slides));
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

describe('inject-video-players (T-20261007-008 promotion pin)', () => {
  let d1: string;
  beforeAll(() => {
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
});
