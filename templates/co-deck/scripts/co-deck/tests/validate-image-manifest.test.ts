// @version 1.3.0
// v1.3.0 (validator v1.4.0 LOCAL-PATCH — deck-wide photo background doctrine):
// Rule A amended — scope all/divider-cover with a REGISTERED global background
// (background_image.path + matching slides[] entry at slide_index -1) passes;
// an unregistered global path serving ≥2 in-scope slides still ERRORs.
// v1.2.0 (consolidation spec Follow-up 3): pool-wide duplicate content pin
// flipped WARN/exit-0 → ERROR/exit-1, matching validator v1.3.0.
// validate-image-manifest.test.ts — pin tests for the background_image section
// rules (U-20261029-007) and the shared-pool enforcement rules (U-20261114-005).
// Runs the real CLI against synthetic workspaces (image-manifest.json + tiny
// generated PNGs + slidedata.json).
//
// Synthetic workspaces mirror the repo layout: temp root doubles as --root, the
// shared pool lives at <root>/deliverables/assets/images/, and manifest paths use
// repo-root-relative pool paths (validator v1.2.0 path-style rule).
//
// Covers (U-20261029-007):
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
// Covers (U-20261114-005):
//  10. Legacy presentations/… path → path-style ERROR with migration hint.
//  11. Absolute path → path-style ERROR.
//  12. background_image.path outside the pool convention → path-style ERROR.
//  13. Sibling diagram-manifest.json with pool-style paths + existing files passes.
//  14. Sibling diagram-manifest.json with a deck-local diagrams/… path ERRORs.
//  15. Sibling diagram-manifest.json entry pointing at a missing file ERRORs.
//  16. Pool-wide duplicate content (same sha256, two pool files) → ERROR, exit 1
//      (v1.3.0 promotion — WARN/exit 0 before).
// Covers (v1.4.0 LOCAL-PATCH — deck-wide backdrop doctrine):
//  17. Scope all + registered global (path + slides[] slide_index -1 entry with
//      the same path) serving ≥2 in-scope slides PASSES (approved design).
//  18. Scope all + global path with NO matching -1 registration entry still
//      ERRORs (family reuse, unregistered).
//  19. Registered global background whose file is missing still ERRORs.
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

// Legacy test fixtures name pool files "images/<name>"; strip the prefix so the
// manifest paths land in the v1.2.0 pool convention.
const poolName = (f: string): string => f.replace(/^images\//, '');

/**
 * Build a synthetic workspace mirroring the repo layout: temp root doubles as
 * --root (shared pool at <root>/deliverables/assets/images/), and the deck
 * workspace is <root>/deliverables/proj — so repo-root-relative
 * "deliverables/assets/images/…" and deck-relative "../assets/images/…"
 * bindings resolve to the same pool file, exactly as in the real tree.
 */
function workspace(
  background: { enabled: boolean; scope: string; path?: string } | null,
  slides: Array<Record<string, any> & { _file?: string; _rgb?: [number, number, number] }>,
  opts: { withSlidedata?: boolean; slideTypes?: string[] } = {},
): string {
  const root = mkdtempSync(join(tmpdir(), 'cdk-imgman-'));
  tmpDirs.push(root);
  const ws = join(root, 'deliverables', 'proj');
  mkdirSync(join(root, 'deliverables', 'assets', 'images'), { recursive: true });
  mkdirSync(ws, { recursive: true });
  const manifest: any = { generated_at: '2026-10-30T00:00:00Z' };
  if (background !== null) {
    manifest.background_image = {
      enabled: background.enabled,
      scope: background.scope,
      ...(background.path ? { path: `deliverables/assets/images/${poolName(background.path)}` } : {}),
    };
    // Materialize the global background file unless the test expects it missing.
    if (background.path && !background.path.includes('missing')) {
      writePng(root, `deliverables/assets/images/${poolName(background.path)}`, [250, 250, 0]);
    }
  }
  manifest.slides = slides.map((s) => {
    const { _file, _rgb, ...rest } = s;
    if (_file) {
      writePng(root, `deliverables/assets/images/${poolName(_file)}`, _rgb ?? [10, 20, 30]);
      return { ...rest, path: `deliverables/assets/images/${poolName(_file)}` };
    }
    return rest;
  });
  manifest.missing = [];
  writeFileSync(join(ws, 'image-manifest.json'), JSON.stringify(manifest, null, 2));
  if (opts.withSlidedata) {
    const types = opts.slideTypes ?? ['cover', 'standard', 'divider', 'standard'];
    writeFileSync(
      join(ws, 'slidedata.json'),
      JSON.stringify(types.map((t) => ({ type: t, title: `s-${t}` }))),
    );
  }
  return ws;
}

function run(ws: string) {
  // ws = <root>/deliverables/proj → root is two levels up (the --root instance).
  return spawnSync('bun', [TOOL, '--workspace', ws, '--root', join(ws, '..', '..')], { encoding: 'utf-8' });
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

describe('validate-image-manifest deck-wide backdrop rules (v1.4.0 LOCAL-PATCH)', () => {
  test('scope all + registered global background passes (deck-wide backdrop design)', () => {
    const dir = workspace(
      { enabled: true, scope: 'all', path: 'images/bg.png' },
      [
        // The deliberate-registration marker: the global entry at slide_index -1
        // carrying the SAME path as background_image.path.
        { slide_index: -1, image_role: 'background', slug: 'bg-deck', _file: 'images/bg.png', _rgb: [250, 250, 0] },
        { slide_index: 0, image_role: 'background', _file: 'images/cover.png', _rgb: [11, 12, 13] },
      ],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider', 'standard', 'divider'] },
    );
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain('family reuse');
    expect(res.stdout).toContain('global background registered');
    expect(res.stdout).toContain('validate-image-manifest PASSED');
  });

  test('scope all with an unregistered global path still ERRORs (family reuse)', () => {
    const dir = workspace(
      { enabled: true, scope: 'all', path: 'images/bg.png' },
      [{ slide_index: 0, image_role: 'illustrative', _file: 'images/panel.png', _rgb: [21, 22, 23] }],
      { withSlidedata: true, slideTypes: ['cover', 'standard', 'divider', 'standard', 'divider'] },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('family reuse');
    expect(res.stderr).toContain('no registered global entry');
    expect(res.stderr).toContain('scope "individual"');
  });

  test('registered global background with a missing file still ERRORs', () => {
    const dir = workspace(
      { enabled: true, scope: 'all', path: 'images/missing.png' },
      [
        { slide_index: -1, image_role: 'background', slug: 'bg-deck', path: 'deliverables/assets/images/missing.png' },
      ],
      { withSlidedata: true, slideTypes: ['cover', 'standard'] },
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('background_image.path file missing');
  });
});

describe('validate-image-manifest pool rules (U-20261114-005)', () => {
  test('legacy presentations/… slide path ERRORs with migration hint', () => {
    const dir = workspace(
      null,
      [{ slide_index: 0, image_role: 'illustrative', slide_title: 'legacy', path: 'presentations/deck/images/x.png' }],
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared-pool convention');
    expect(res.stderr).toContain('migrate legacy deck-local');
  });

  test('absolute slide path ERRORs with migration hint', () => {
    const dir = workspace(
      null,
      [{ slide_index: 0, image_role: 'illustrative', slide_title: 'abs' }],
    );
    // Rewrite the slide path to an absolute path (forbidden by the pool convention).
    const mpath = join(dir, 'image-manifest.json');
    const m = JSON.parse(require('node:fs').readFileSync(mpath, 'utf-8'));
    m.slides[0].path = join(dir, 'deliverables/assets/images/x.png');
    writeFileSync(mpath, JSON.stringify(m, null, 2));
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('shared-pool convention');
  });

  test('deck-relative ../assets/… path resolves against the workspace and passes', () => {
    const dir = workspace(null, [{ slide_index: 0, image_role: 'illustrative', slide_title: 'rel', _file: 'x.png' }]);
    // Rebind as deck-relative: <ws>/../assets/images/x.png → the same pool file.
    const mpath = join(dir, 'image-manifest.json');
    const m = JSON.parse(require('node:fs').readFileSync(mpath, 'utf-8'));
    m.slides[0].path = '../assets/images/x.png';
    writeFileSync(mpath, JSON.stringify(m, null, 2));
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('validate-image-manifest PASSED');
  });

  test('background_image.path outside the pool convention ERRORs', () => {
    const dir = workspace(
      { enabled: true, scope: 'divider-cover' },
      [],
      { withSlidedata: true, slideTypes: ['cover'] },
    );
    const mpath = join(dir, 'image-manifest.json');
    const m = JSON.parse(require('node:fs').readFileSync(mpath, 'utf-8'));
    m.background_image.path = 'images/bg.png';
    writeFileSync(mpath, JSON.stringify(m, null, 2));
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('background_image.path: path violates the shared-pool convention');
  });

  test('sibling diagram-manifest.json with pool-style paths and existing files passes', () => {
    const dir = workspace(null, []);
    const diagrams = join(dir, '..', 'assets', 'diagrams'); // <root>/deliverables/assets/diagrams
    mkdirSync(diagrams, { recursive: true });
    writeFileSync(join(diagrams, 'fig-one.svg'), '<svg viewBox="0 0 10 10"/>');
    writeFileSync(join(diagrams, 'fig-one.png'), 'png-bytes');
    writeFileSync(join(diagrams, 'fig-svg-only.svg'), '<svg viewBox="0 0 10 10"/>');
    writeFileSync(
      join(dir, 'diagram-manifest.json'),
      JSON.stringify({
        entries: [
          { slug: 'fig-one', type: 'diagram', svg: 'deliverables/assets/diagrams/fig-one.svg', png: 'deliverables/assets/diagrams/fig-one.png' },
          { slug: 'fig-svg-only', type: 'diagram', svg: 'deliverables/assets/diagrams/fig-svg-only.svg', png: null },
        ],
      }, null, 2),
    );
    const res = run(dir);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('validate-image-manifest PASSED');
  });

  test('sibling diagram-manifest.json with a deck-local diagrams/… path ERRORs', () => {
    const dir = workspace(null, []);
    writeFileSync(
      join(dir, 'diagram-manifest.json'),
      JSON.stringify({
        entries: [{ slug: 'legacy', type: 'diagram', svg: 'assets/diagrams/legacy.svg', png: null }],
      }, null, 2),
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('diagram entry "legacy"');
    expect(res.stderr).toContain('shared-pool convention');
  });

  test('sibling diagram-manifest.json entry pointing at a missing file ERRORs', () => {
    const dir = workspace(null, []);
    writeFileSync(
      join(dir, 'diagram-manifest.json'),
      JSON.stringify({
        entries: [{ slug: 'ghost', type: 'diagram', svg: 'deliverables/assets/diagrams/ghost.svg', png: null }],
      }, null, 2),
    );
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('diagram entry "ghost": svg file missing');
  });

  test('pool-wide duplicate content ERRORs and fails the gate (v1.3.0 promotion)', () => {
    const dir = workspace(
      null,
      [{ slide_index: 0, image_role: 'illustrative', _file: 'a.png', _rgb: [99, 99, 99] }],
    );
    // Same bytes as a.png under a second pool filename → consolidation debt.
    writePng(join(dir, '..', '..'), 'deliverables/assets/images/b.png', [99, 99, 99]);
    const res = run(dir);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('ERROR: duplicate image content in the shared pool');
    expect(res.stderr).toContain('deliverables/assets/images/a.png');
    expect(res.stderr).toContain('deliverables/assets/images/b.png');
    expect(res.stdout).not.toContain('validate-image-manifest PASSED');
    expect(res.stderr).toContain('validate-image-manifest FAILED');
  });
});
