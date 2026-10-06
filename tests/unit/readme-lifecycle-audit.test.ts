/**
 * readme-lifecycle-audit.ts — localized footer literal acceptance (v1.1.0).
 *
 * Ticket: U-20261006-007 (upstream request from co-develop). The audit matched
 * only the English '/Last Updated:\s*YYYY-MM-DD/' literal, so a README_ko.md
 * ending in the workspace's own Korean footer convention ('*최근 갱신:
 * YYYY-MM-DD*' — the templates README_ko convention — or '*최근 업데이트:
 * YYYY-MM-DD*' as used by project README_ko files) warned
 * 'Missing "Last Updated" date' and projects appended a duplicate English
 * footer as a workaround.
 *
 * Contract under test (v1.1.0 semantics, spawned as a subprocess with cwd set
 * to a fixture directory because the script derives ROOT from cwd()):
 *   1. A Korean footer ('최근 갱신' twin) passes with no missing-footer warning.
 *   2. The '최근 업데이트' twin also passes.
 *   3. A genuinely missing footer still warns, and the warning lists the
 *      accepted literals.
 *   4. The 90-day freshness check EXTRACTS the date from a Korean footer
 *      (an old Korean date warns 'older than 90 days' — proves capture, not
 *      just detection).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const auditScript = join(workspaceRoot, 'scripts', 'readme-lifecycle-audit.ts');

interface AuditIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
}

interface AuditResult {
  readmesScanned: number;
  errors: AuditIssue[];
  warnings: AuditIssue[];
  summary: string;
  summaryClean: string;
}

const created: string[] = [];

afterEach(() => {
  while (created.length > 0) {
    const dir = created.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'readme-lifecycle-audit-'));
  created.push(dir);
  return dir;
}

// Identical H2 structure on both twins so the i18n section-count check stays
// quiet; body text is long enough to clear the empty/minimal error (>= 50
// visible chars after whitespace stripping).
function writeReadmePair(dir: string, enFooter: string | null, koFooter: string | null): void {
  const en = [
    '# Sample Project',
    '',
    '## Overview',
    '',
    'A sample project used by the README lifecycle audit test fixture to verify footer detection behavior across localized literals.',
    '',
  ].join('\n');
  const ko = [
    '# 샘플 프로젝트',
    '',
    '## 개요',
    '',
    'README lifecycle audit 테스트 픽스처가 지역화된 푸터 리터럴의 감지 동작을 검증하기 위해 사용하는 샘플 프로젝트입니다.',
    '',
  ].join('\n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'README.md'), en + (enFooter ?? '') + '\n');
  writeFileSync(join(dir, 'README_ko.md'), ko + (koFooter ?? '') + '\n');
}

function runAudit(dir: string): AuditResult {
  const result = spawnSync('bun', [auditScript, '--json'], {
    encoding: 'utf-8',
    cwd: dir,
    timeout: 120000,
  });
  if (result.status !== 0) {
    console.error('stdout:', (result.stdout ?? '').slice(0, 2000));
    console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
  }
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as AuditResult;
}

const FOOTER_RECENT_EN = '*Maintained by Fixture · Last Updated: 2026-10-06*';
const FOOTER_RECENT_KO_GAJEON = '*최근 갱신: 2026-10-06*';
const FOOTER_RECENT_KO_UPDATE = '*최근 업데이트: 2026-10-06*';
const FOOTER_OLD_KO_GAJEON = '*최근 갱신: 2026-01-01*';

describe('readme-lifecycle-audit.ts localized footer literals (U-20261006-007, v1.1.0)', () => {
  test('Korean footer (최근 갱신 twin) passes without any English literal', () => {
    const dir = makeFixture();
    writeReadmePair(dir, FOOTER_RECENT_EN, FOOTER_RECENT_KO_GAJEON);
    const result = runAudit(dir);
    const footerWarnings = result.warnings.filter((w) => w.message.includes('Missing "Last Updated"'));
    expect(footerWarnings).toEqual([]);
  });

  test('Korean footer (최근 업데이트 twin) passes without any English literal', () => {
    const dir = makeFixture();
    writeReadmePair(dir, FOOTER_RECENT_EN, FOOTER_RECENT_KO_UPDATE);
    const result = runAudit(dir);
    const footerWarnings = result.warnings.filter((w) => w.message.includes('Missing "Last Updated"'));
    expect(footerWarnings).toEqual([]);
  });

  test('a genuinely missing footer still warns, and the warning lists the accepted literals', () => {
    const dir = makeFixture();
    writeReadmePair(dir, null, FOOTER_RECENT_KO_GAJEON);
    const result = runAudit(dir);
    const enWarnings = result.warnings.filter(
      (w) => w.file === 'README.md' && w.message.includes('Missing "Last Updated"')
    );
    expect(enWarnings).toHaveLength(1);
    // The warn message names every accepted literal so the fix is discoverable
    // for both the English and the localized convention.
    expect(enWarnings[0].message).toContain('Last Updated');
    expect(enWarnings[0].message).toContain('최근 갱신');
    expect(enWarnings[0].message).toContain('최근 업데이트');
    // The Korean twin itself is still clean.
    expect(result.warnings.filter((w) => w.file === 'README_ko.md' && w.message.includes('Missing "Last Updated"'))).toEqual([]);
  });

  test('freshness check extracts the date from a Korean footer (old date warns, proving capture)', () => {
    const dir = makeFixture();
    writeReadmePair(dir, FOOTER_RECENT_EN, FOOTER_OLD_KO_GAJEON);
    const result = runAudit(dir);
    const staleKo = result.warnings.filter(
      (w) => w.file === 'README_ko.md' && w.message.includes('older than 90 days')
    );
    expect(staleKo).toHaveLength(1);
    // The recent English twin stays clean — the warning is specific to the
    // stale Korean footer.
    expect(result.warnings.filter((w) => w.file === 'README.md' && w.message.includes('older than 90 days'))).toEqual([]);
  });
});
