/**
 * build-theme-deck.ts post-build video pipeline pins (U-20261105-007).
 *
 * The canonical rebuild order is build → (optional --download-videos) →
 * inject-video-players. The build entry point must run the injector itself so
 * a rebuild cannot silently drop the players. Pins:
 *   - a videoId deck comes out of the CLI with the cdk-video-players block,
 *   - a video-less deck is untouched (no marker),
 *   - a rebuilt (re-injected) deck is idempotent (single marker block).
 *
 * Runs the real CLI against a synthetic project fixture (bun test).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dir, '../../..');
const CLI = join(ROOT, 'scripts', 'co-deck', 'build-theme-deck.ts');

function writeFixture(dir: string, slides: Array<Record<string, unknown>>, title: string): void {
  mkdirSync(join(dir, 'project'), { recursive: true });
  writeFileSync(
    join(dir, 'project', 'lecture-profile.md'),
    ['---', 'presentation:', '  theme: zen', '  style: white-bubble', `  title: ${title}`, '---', ''].join('\n'),
  );
  writeFileSync(join(dir, 'project', 'slidedata.json'), JSON.stringify(slides));
}

function runBuild(projectPath: string, extra: string[] = []) {
  // Pass the absolute project path; build-theme-deck resolves it against ROOT.
  return spawnSync('bun', [CLI, '--project', projectPath, ...extra], { encoding: 'utf-8', cwd: ROOT });
}

describe('build-theme-deck video pipeline (U-20261105-007)', () => {
  test('videoId deck is built AND injected in one command', () => {
    const d = mkdtempSync(join(tmpdir(), 'cdk-buildvid-'));
    writeFixture(d, [{ isTitleSlide: true, title: 'cover' }, { title: 'clip', videoId: 'dQw4w9WgXcQ' }], 'Video Pipeline Test');
    const res = runBuild(join(d, 'project'));
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('inject-video-players: players injected after build');
    const html = readFileSync(join(d, 'project', 'lecture_v1.html'), 'utf8');
    expect(html).toContain('<style id="cdk-video-players">');
    expect(html).toContain('dQw4w9WgXcQ');
    rmSync(d, { recursive: true, force: true });
  });

  test('video-less deck is built untouched (no injection, no warning)', () => {
    const d = mkdtempSync(join(tmpdir(), 'cdk-buildvid-'));
    writeFixture(d, [{ isTitleSlide: true, title: 'cover' }, { title: 'plain', bullets: ['a'] }], 'Plain Deck');
    const res = runBuild(join(d, 'project'));
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain('inject-video-players');
    const html = readFileSync(join(d, 'project', 'lecture_v1.html'), 'utf8');
    expect(html).not.toContain('<style id="cdk-video-players">');
    rmSync(d, { recursive: true, force: true });
  });

  test('rebuild + re-inject stays idempotent (single marker block)', () => {
    const d = mkdtempSync(join(tmpdir(), 'cdk-buildvid-'));
    writeFixture(d, [{ title: 'clip', videoId: 'abc123def45' }], 'Idem Deck');
    const out = join(d, 'project', 'out.html');
    for (let i = 0; i < 2; i++) {
      const res = runBuild(join(d, 'project'), ['--output', out]);
      expect(res.status).toBe(0);
    }
    const html = readFileSync(out, 'utf8');
    expect(html.split('<style id="cdk-video-players">').length - 1).toBe(1);
    rmSync(d, { recursive: true, force: true });
  });
});
