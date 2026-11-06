// @version 1.0.0
// lib-slide-type.test.ts — pin slideTypeOf() schema detection (U-20261105-001)
// plus one CLI e2e: a boolean-flag deck must NOT produce false standard-slide
// min-content FAILs in the layout gate. Before the fix, estimate-layout read
// `s.type ?? 'standard'`, so every isCover/isDivider/isPunchline/isContact/
// isProfile slide ran the STANDARD min checks and falsely failed.
//
// Run: bun test scripts/co-deck/tests/lib-slide-type.test.ts

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { slideTypeOf } from '../lib/slide-type';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const TOOL = join(ROOT, 'scripts/co-deck/estimate-layout.ts');

describe('slideTypeOf (U-20261105-001)', () => {
  test('legacy `type` string still wins when present', () => {
    expect(slideTypeOf({ type: 'divider' })).toBe('divider');
    expect(slideTypeOf({ type: 'title' })).toBe('title');
  });

  test('boolean flags (short + long forms) map to slide_types keys', () => {
    expect(slideTypeOf({ isCover: true })).toBe('title');
    expect(slideTypeOf({ isTitleSlide: true })).toBe('title');
    expect(slideTypeOf({ isDivider: true })).toBe('divider');
    expect(slideTypeOf({ isDividerSlide: true })).toBe('divider');
    expect(slideTypeOf({ isPunchline: true })).toBe('punchline');
    expect(slideTypeOf({ isPunchlineSlide: true })).toBe('punchline');
    expect(slideTypeOf({ isContact: true })).toBe('contact');
    expect(slideTypeOf({ isContactSlide: true })).toBe('contact');
    expect(slideTypeOf({ isProfile: true })).toBe('profile');
    expect(slideTypeOf({ isProfileSlide: true })).toBe('profile');
  });

  test('flag-less slides fall back to standard', () => {
    expect(slideTypeOf({ title: 'x', bullets: ['a'] })).toBe('standard');
    expect(slideTypeOf({})).toBe('standard');
  });
});

// ── CLI e2e: gate must not false-FAIL boolean-flag special slides ──────────
const tmpDirs: string[] = [];
afterAll(() => { for (const d of tmpDirs) rmSync(d, { recursive: true, force: true }); });

function fixture(slides: any[]): string {
  const name = `_boolflag_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(ROOT, 'presentations', name);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  writeFileSync(join(dir, 'lecture-profile.md'),
    '---\npresentation:\n  theme: zen\n  style: white-bubble\n---\n# t\n');
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify(slides));
  return join('presentations', name);
}

describe('layout gate e2e (U-20261105-001)', () => {
  test('boolean-flag special slides are exempt from standard minimums', () => {
    const proj = fixture([
      { title: 'Cover', isCover: true, subtitle: 'sub' },
      { title: 'Div', isDivider: true },
      { title: 'Punch', isPunchline: true, sub: 's' },
      { title: 'Contact', isContact: true },
      { title: 'Profile', isProfile: true },
      { title: 'Standard', bullets: ['one two three four', 'five six seven eight', 'nine ten eleven twelve'] },
    ]);
    const res = spawnSync('bun', [TOOL, '--project', proj, '--lint'], { cwd: ROOT, encoding: 'utf-8' });
    const out = res.stdout + res.stderr;
    // Special slides must be WARN (no constraints), not FAIL.
    expect(out).not.toMatch(/\| \d+ \| (title|divider|punchline|contact|profile) \| .*min.*FAIL/);
    expect(out).not.toMatch(/\| \d+ \| standard \| .*min/); // only slide 6 is standard
    if (res.status !== 0) console.error('[gate e2e] lint output:\n' + out);
    expect(res.status).toBe(0);
    expect(out).toContain('Layout gate passed.');
  });
});
