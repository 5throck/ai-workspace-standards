// @version 1.0.0
// estimate-layout-lint.test.ts — pin tests for the --lint minimum content
// checks (U-20261029-006). Runs the real CLI against a synthetic project
// (lecture-profile.md + slidedata.json) under templates/co-deck/presentations/
// because estimate-layout.ts resolves its workspace root relative to the
// script location.
//
// Covers:
//   1. Sparse standard deck (2 bullets, short body) FAILs with exit 1 and
//      prints the "(min)" rows.
//   2. Dense-enough deck passes (exit 0).
//   3. videoId slides are exempt from minimum checks.
//   4. title/divider types are exempt (no minimum declared for them).
//   5. layout_overrides can raise a floor (content_constraints.standard.
//      min_bullets via the 4-layer merge) and flip a passing deck to FAIL.
//
// Run via:
//   bun test scripts/co-deck/tests/estimate-layout-lint.test.ts

import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(import.meta.path), '../../..');
const TOOL = join(ROOT, 'scripts/co-deck/estimate-layout.ts');

const tmpDirs: string[] = [];

function fixture(slides: any[], frontmatterExtra = ''): string {
  const name = `_lint_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const dir = join(ROOT, 'presentations', name);
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  writeFileSync(
    join(dir, 'lecture-profile.md'),
    `---
presentation:
  theme: zen
  style: premium-dark
${frontmatterExtra}
---
# Test profile
`,
  );
  writeFileSync(join(dir, 'slidedata.json'), JSON.stringify(slides));
  return join('presentations', name);
}

function runLint(projectRel: string) {
  return spawnSync('bun', [TOOL, '--project', projectRel, '--lint'], {
    cwd: ROOT,
    encoding: 'utf-8',
  });
}

afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

describe('estimate-layout --lint minimum content checks (U-20261029-006)', () => {
  test('sparse standard deck FAILs with min rows and exit 1', () => {
    const proj = fixture([
      { type: 'title', title: '표지' },
      { type: 'standard', title: '두orem', bullets: ['짧은 첫 불릿', '두 번째 불릿'] },
      { type: 'divider', title: '파트 1' },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Layout gate FAILED');
    expect(res.stdout).toContain('bullet count (min)');
    expect(res.stdout).toContain('body chars (min)');
    expect(res.stdout).toContain('≥ 3');
    expect(res.stdout).toContain('≥ 40');
    // Exempt types emit no min rows for their own slides
    expect(res.stderr).toContain('Densify content');
  });

  test('dense-enough standard deck passes (exit 0)', () => {
    const proj = fixture([
      { type: 'title', title: '표지' },
      {
        type: 'standard',
        title: '밀도 충분',
        bullets: ['첫 번째 불릿은 충분한 설명을 담고 있습니다', '두 번째 불릿도 충분한 설명을 담고 있습니다', '세 번째 불릿 역시 충분한 설명을 담고 있습니다'],
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Layout gate passed');
  });

  test('videoId slides are exempt from minimum checks', () => {
    const proj = fixture([
      { type: 'standard', title: '영상 슬라이드', videoId: 'dQw4w9WgXcQ', bullets: ['한 줄뿐인 불릿'] },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Layout gate passed');
    expect(res.stdout).not.toContain('bullet count (min)');
  });

  test('divider/title types carry no minimum floor', () => {
    const proj = fixture([
      { type: 'title', title: '표지' },
      { type: 'divider', title: '파트 1', desc: '짧은 설명' },
      { type: 'punchline', title: '마무리 한마디' },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(0);
    expect(res.stdout).not.toContain('bullet count (min)');
  });

  test('layout_overrides can raise a floor and flip a passing deck to FAIL', () => {
    const proj = fixture(
      [
        { type: 'standard', title: '세 불릿', bullets: ['첫 번째 불릿입니다', '두 번째 불릿입니다', '세 번째 불릿입니다'] },
      ],
      [
        'layout_overrides:',
        '  content_constraints.standard.min_bullets: 5',
        '',
      ].join('\n'),
    );
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('bullet count (min)');
    expect(res.stdout).toContain('≥ 5');
  });
});
