// @version 1.1.0
// v1.1.0 (U-20261119-006, batch-2 PR-E1): meta-wording gate pins — the three
// banned pattern families (epistemic bullet prefixes 사실/가능성/해석/추정/전망 +
// —/:/-, parenthetical asides (강연자 해석)/(확정된 사실은 아님)/(확인 필요),
// narration disclaimers 근거는 없습니다 / 독립적인 검증을 거친 것은 아니라는 점)
// FAIL on slide-visible fields; owner decision D3 pins — disclaimers are
// ALLOWED in script fields while prefixes/parentheticals still FAIL there;
// qualifier-in-claim wording (약/추정치 기준) and natural attribution stay
// clean; the wording check fires on constraint-free types (divider) too.
// v1.0.1 (2026-11-15, spec docs/designs/2026-11-15-co-deck-deliverables-migration-design.md): doc-only — usage comments and path constants follow the fleet's deliverables/ consolidation (presentations/ → deliverables/); no logic change.
// estimate-layout-lint.test.ts — pin tests for the --lint minimum content
// checks (U-20261029-006). Runs the real CLI against a synthetic project
// (lecture-profile.md + slidedata.json) under the repo-root deliverables/ tree
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
  const dir = join(ROOT, 'deliverables', name);
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
  return join('deliverables', name);
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

// ── Meta-wording gate (U-20261119-006, batch-2 PR-E1) ────────────────────────
// The pilot deck's defect classes: S11/S15/S17/S18/S20 carried verification
// status as bullet prefixes, caption parentheticals, and narration
// disclaimers. Pins freeze the D3 split: slides never carry them; scripts
// carry disclaimers only.
describe('estimate-layout --lint meta-wording gate (U-20261119-006)', () => {
  const DENSE_CLEAN_BULLETS = [
    '첫 번째 불릿은 충분한 설명을 담고 있습니다',
    '두 번째 불릿도 충분한 설명을 담고 있습니다',
    '세 번째 불릿 역시 충분한 설명을 담고 있습니다',
  ];

  test('epistemic bullet prefix 사실 — in a standard bullet FAILs', () => {
    const proj = fixture([
      // 2 thin bullets → the constraint min-rows fire as well, pinning that
      // the wording rows precede the constraints early-return in the report.
      { type: 'standard', title: '피해 규모', bullets: ['사실 — 재해 복구 비용은 추산과 다르다', '두 번째 불릿입니다'] },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Layout gate FAILED');
    expect(res.stdout).toContain('meta wording: bullet prefix');
    expect(res.stdout).toContain('(bullets[0])');
    expect(res.stdout).toContain('사실 —');
    // wording check runs before the constraints early-return: min rows still emitted too
    expect(res.stdout).toContain('bullet count (min)');
    expect(res.stderr).toContain('Densify content');
    expect(res.stderr).toContain('Rewrite meta wording');
  });

  test('all five epistemic labels and all three dash variants FAIL as bullet prefixes', () => {
    for (const label of ['사실', '가능성', '해석', '추정', '전망']) {
      const proj = fixture([
        { type: 'standard', title: '라벨 핀', bullets: [`${label} — 분류 접두사 핀`] },
      ]);
      const res = runLint(proj);
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('meta wording: bullet prefix');
    }
    for (const sep of ['—', ':', '-']) {
      const proj = fixture([
        { type: 'standard', title: '구분자 핀', bullets: [`해석 ${sep} 구분자 변형 핀`] },
      ]);
      const res = runLint(proj);
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('meta wording: bullet prefix');
    }
  });

  test('parenthetical asides FAIL in caption/notes/visual fields', () => {
    const proj = fixture([
      {
        type: 'standard',
        title: '괄호 유의사항',
        bullets: DENSE_CLEAN_BULLETS,
        visualCaption: '시장 규모 추이 (강연자 해석)',
        notes: ['수치는 보도 기준 집계 (확정된 사실은 아님)'],
        visualDisplay: '체크리스트 (확인 필요)',
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('meta wording: paren aside');
    expect(res.stdout).toContain('(visualCaption)');
    expect(res.stdout).toContain('(notes[0])');
    expect(res.stdout).toContain('(visualDisplay)');
    expect(res.stdout).toContain('강연자 해석');
    expect(res.stdout).toContain('확정된 사실은 아님');
    expect(res.stdout).toContain('확인 필요');
  });

  test('narration disclaimers are banned on slide-visible fields', () => {
    const proj = fixture([
      {
        type: 'standard',
        title: '근거 문구',
        bullets: ['이 수치는 독립적인 검증을 거친 것은 아니라는 점을 유의하십시오', ...DENSE_CLEAN_BULLETS.slice(1)],
        notes: ['공식 검증 자료 부족 — 근거는 없습니다'],
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('meta wording: disclaimer');
    expect(res.stdout).toContain('(bullets[0])');
    expect(res.stdout).toContain('(notes[0])');
    expect(res.stdout).toContain('근거는 없습니다');
    expect(res.stdout).toContain('독립적인 검증을 거친 것은 아니라는 점');
  });

  test('D3 narrowing: narration disclaimers are ALLOWED in script fields', () => {
    const proj = fixture([
      {
        type: 'standard',
        title: '내레이션 핀',
        bullets: DENSE_CLEAN_BULLETS,
        script: '이 수치는 독립적인 검증을 거친 것은 아니라는 점을 미리 말씀드립니다. 별도의 근거는 없습니다. 행정안전부는 원인을 조사 중이라고 밝혔습니다.',
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Layout gate passed');
    expect(res.stdout).not.toContain('meta wording');
  });

  test('script fields still FAIL on bullet prefixes and parenthetical asides', () => {
    const proj = fixture([
      {
        type: 'standard',
        title: '스크립트 핀',
        bullets: DENSE_CLEAN_BULLETS,
        script: '사실 — 이 부분은 강조해 보겠습니다. 시장 규모 추이 (강연자 해석)입니다.',
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('meta wording: bullet prefix (script)');
    expect(res.stdout).toContain('meta wording: paren aside (script)');
  });

  test('wording check fires on constraint-free types (divider)', () => {
    const proj = fixture([
      { type: 'title', title: '표지' },
      { type: 'divider', title: '파트 1', text: '해석 — 전반 동향 요약' },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('meta wording: bullet prefix');
    expect(res.stdout).toContain('(text)');
  });

  test('qualifier-in-claim wording and labelless 사실 stay clean (no false positives)', () => {
    const proj = fixture([
      {
        type: 'standard',
        title: '한정사 핀',
        bullets: [
          '시장 규모는 약 16.3억 달러 추정치 기준으로 산정했습니다',
          '언론 보도 기준으로 집계한 수치입니다',
          '사실과 다르게 비용 구조가 재편되고 있습니다',
        ],
        script: '행정안전부는 원인을 조사 중이라고 밝혔습니다.',
      },
    ]);
    const res = runLint(proj);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Layout gate passed');
    expect(res.stdout).not.toContain('meta wording');
  });
});
