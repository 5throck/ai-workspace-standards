// @version 1.0.0
// validate-image-manifest.test.ts — pin tests for the background_image section
// rules (U-20261029-007). Runs the real CLI against synthetic workspaces
// (image-manifest.json + tiny generated PNGs + slidedata.json).
//
// Covers:
//   1. Family reuse — global background_image.path serving ≥2 background-scoped
//      slides under scope divider-cover ERRORs (previously 0 errors).
//   2. Single background slide with the global image passes (no reuse).
//   3. Missing coverage — declared divider-cover scope with no global path ERRORs.
//   4. Pathless background entry ERRORs (previously silently skipped).
//   5. Unreadable background_image.path file ERRORs.
//   6. Compliant flow passes: scope individual, one distinct image per
//      background slide.
//   7. background_image.path under scope individual → WARN, exit 0.
//   8. slidedata.json absent → counting rules WARN-skip, exit 0.
//   9. Per-slide background entries sharing one file still ERROR via the
//      pre-existing duplicate-hash rule.
//
// Run via:
//   bun test scripts/co-deck/tests/validate-image-manifest.test.ts

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const TOOL = join(import.meta.dir, '..', 'validate-image-manifest.ts');
const tmpDirs: string[] = [];

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

// ── Tiny valid 1×1 PNG writer (distinct bytes per color triple) ────────────
function writePng(dir: string, rel: string, rgb: [number, number, number]): void {
  const crcTable = (() => {
    const t: number[] = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf: Uint8Array): number => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.from([0, rgb[0], rgb[1], rgb[2]]);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', raw),
    chunk('IEND', new Uint8Array()),
  ]);
  writeFileSync(join(dir, rel), png);
}

/** Build a workspace with real (distinct) image files + manifest + slidedata. */
function workspace(
  background: { enabled: boolean; scope: string; path?: string } | null,
  slides: Array<Record<string, any> & { _file?: string; _rgb?: [number, number, number] }>,
  opts: { withSlidedata?: boolean; slideTypes?: string[] } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), 'cdk-imgman-'));
  tmpDirs.push(dir);
  mkdirSync(join(dir, 'images'), { recursive: true });
  const manifest: any = { generated_at: '2026-10-30T00:00:00Z' };
  if (background !== null) {
    manifest.background_image = {
      enabled: background.enabled,
      scope: background.scope,
      ...(background.path ? { path: join(dir, background.path) } : {}),
    };
    // Materialize the global background file unless the test expects it missing.
    if (background.path && !background.path.includes('missing')) {
      writePng(dir, background.path, [250, 250, 0]);
    }
  }
  manifest.slides = slides.map((s) => {
    const { _file, _rgb, ...rest } = s;
    if (_file) {
      writePng(dir, _file, _rgb ?? [10, 20, 30]);
      return { ...rest, path: join(dir, _file) };
    }
    return rest;
  });
  manifest.missing = [];
  writeFileSync(join(dir, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  if (opts.withSlidedata) {
    const types = opts.slideTypes ?? ['cover', 'standard', 'divider', 'standard'];
    writeFileSync(
      join(dir, 'slidedata.json'),
      JSON.stringify(types.map((t) => ({ type: t, title: `s-${t}` }))),
    );
  }
  return dir;
}

function run(dir: string) {
  return spawnSync('bun', [TOOL, '--workspace', dir], { encoding: 'utf-8' });
}

describe('validate-image-manifest background rules (U-20261029-007)', () => {
  test('family reuse: global background serving 2+ background slides ERRORs', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover', path: 'images/bg.png' },
      [{ slide_index: 1, image_role: 'divider-right', _file: 'images/panel.png', _rgb: [200, 0, 0] }],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider', 'standard', 'divider'] },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('family reuse');
    expect(res.stderr).toContain('scope "individual"');
  });

  test('single background slide with the global image passes', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover', path: 'images/bg.png' },
      [],
      { withSlidedata: true, slideTypes: ['cover', 'standard'] },
    );
    const res = run(dir);
    expect(res.status).toBe(0);
  });

  test('declared divider-cover scope with no global path ERRORs', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover' },
      [{ slide_index: 1, image_role: 'divider-right', _file: 'images/panel.png', _rgb: [0, 200, 0] }],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider'] },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('background_image.path is missing');
  });

  test('pathless background entry ERRORs', () => {
    const dir = workspace(
      null,
      [{ slide_index: 2, image_role: 'background', slide_title: 'divider', slug: 'bg-divider' }],
      { withSlidedata: true },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('has no image path');
  });

  test('unreadable background_image.path file ERRORs', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover', path: 'images/missing.png' },
      [],
      { withSlidedata: true, slideTypes: ['cover'] },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('background_image.path file missing');
  });

  test('compliant individual flow passes (distinct per-slide backgrounds)', () => {
    const dir = workspace(
      { enabled: true, scope: 'individual' },
      [
        { slide_index: 0, image_role: 'background', _file: 'images/bg-cover.png', _rgb: [1, 2, 3] },
        { slide_index: 2, image_role: 'background', _file: 'images/bg-divider.png', _rgb: [4, 5, 6] },
      ],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider'] },
    );
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('validate-image-manifest PASSED');
  });

  test('background_image.path under scope individual warns and exits 0', () => {
    const dir = workspace(
      { enabled: true, scope: 'individual', path: 'images/bg.png' },
      [{ slide_index: 0, image_role: 'background', _file: 'images/slide.png', _rgb: [7, 8, 9] }],
      { withSlidedata: true },
    );
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('scope "individual" ignores the global path');
  });

  test('slidedata.json absent → counting rules WARN-skip, exit 0', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover', path: 'images/bg.png' },
      [],
      { withSlidedata: false },
    );
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain('background coverage/reuse checks skipped');
  });

  test('per-slide background entries sharing one file still ERROR (duplicate hash)', () => {
    const dir = workspace(
      null,
      [
        { slide_index: 0, image_role: 'background', _file: 'images/shared.png', _rgb: [42, 42, 42] },
        { slide_index: 2, image_role: 'background', path: 'dup-of-0' }, // replaced below
        { slide_index: 4, image_role: 'background', _file: 'images/other.png', _rgb: [43, 43, 43] },
      ],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider', 'standard', 'divider'] },
    );
    // Point slide 2 at the same file as slide 0 (same bytes → same hash).
    const mpath = join(dir, 'image-manifest.json');
    const m = JSON.parse(require('node:fs').readFileSync(mpath, 'utf-8'));
    m.slides[1].path = m.slides[0].path;
    writeFileSync(mpath, JSON.stringify(m, null, 2));
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('duplicate image across slides 0, 2');
  });
});
