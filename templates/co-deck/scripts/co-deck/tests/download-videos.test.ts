/**
 * download-videos.ts pins (U-20261105-007).
 *
 * Offline video fetch step for lecture decks. Pins the idempotency contract:
 * skip-if-exists (never re-downloads a good file), --check-only reports
 * without downloading, no-videoId slidedata is a clean no-op, and missing
 * QuickDL with pending downloads is a clear fatal (exit 1) — not a crash.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOL = join(import.meta.dir, '..', 'download-videos.ts');

function makeProject(slides: Array<Record<string, unknown>>): string {
  const dir = mkdtempSync(join(tmpdir(), 'cdk-dlvid-'));
  mkdirSync(join(dir, 'project'), { recursive: true });
  writeFileSync(join(dir, 'project', 'slidedata.json'), JSON.stringify(slides));
  return dir;
}

function run(dir: string, extra: string[] = []) {
  // Isolate QuickDL: point it at a guaranteed-nonexistent dir so tests never
  // reach the real downloader (or the network) even on hosts that have it.
  return spawnSync(
    'bun',
    [TOOL, '--project', join(dir, 'project'), '--assets-dir', join(dir, 'assets', 'videos'), '--quickdl-dir', join(dir, 'no-quickdl-here'), ...extra],
    { encoding: 'utf-8' },
  );
}

describe('download-videos (U-20261105-007)', () => {

  test('no videoId in slidedata is a clean no-op (exit 0)', () => {
    const d = makeProject([{ title: 'cover' }, { title: 'text' }]);
    const res = run(d);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('nothing to do');
    rmSync(d, { recursive: true, force: true });
  });

  test('--check-only reports missing videos without downloading (no QuickDL needed)', () => {
    const d = makeProject([{ videoId: 'abc12345678' }]);
    const res = run(d, ['--check-only']);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('MISS yt-abc12345678.mp4');
    rmSync(d, { recursive: true, force: true });
  });

  test('skip-if-exists: a present video above the size floor short-circuits (exit 0, no QuickDL)', () => {
    const d = makeProject([{ videoId: 'goodvid1234' }]);
    const videos = join(d, 'assets', 'videos');
    mkdirSync(videos, { recursive: true });
    writeFileSync(join(videos, 'yt-goodvid1234.mp4'), Buffer.alloc(200_000, 'x'));
    const res = run(d);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('already present');
    rmSync(d, { recursive: true, force: true });
  });

  test('undersized or missing local file with QuickDL absent is a clear fatal (exit 1)', () => {
    const d = makeProject([{ videoId: 'needdl9999' }]);
    const res = run(d);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('QuickDL not found');
    rmSync(d, { recursive: true, force: true });
  });

  test('mixed deck: present video skipped, missing one still requires QuickDL (exit 1)', () => {
    const d = makeProject([{ videoId: 'present01' }, { videoId: 'present02' }, { videoId: 'missing1' }]);
    const videos = join(d, 'assets', 'videos');
    mkdirSync(videos, { recursive: true });
    writeFileSync(join(videos, 'yt-present01.mp4'), Buffer.alloc(200_000, 'x'));
    writeFileSync(join(videos, 'yt-present02.mp4'), Buffer.alloc(50, 'x')); // undersized → pending
    const res = run(d);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('2 video(s) remain missing');
    rmSync(d, { recursive: true, force: true });
  });

  test('missing slidedata is a fatal with a clear message', () => {
    const d = mkdtempSync(join(tmpdir(), 'cdk-dlvid-empty-'));
    const res = spawnSync('bun', [TOOL, '--project', join(d, 'project')], { encoding: 'utf-8' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('slidedata not found');
    rmSync(d, { recursive: true, force: true });
  });
});
