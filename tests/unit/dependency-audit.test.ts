/**
 * Dependency-audit waiver-gate tests (T-20261003-011)
 * @version 1.1.0
 *
 * Covers the pure logic of scripts/dependency-audit.ts:
 * - strict waiver-file parsing (fail-closed schema)
 * - expiry (revisit-by) rules
 * - waiver matching, suppression, stale-waiver and version-drift guards
 * - scope contradiction detection
 * - bun audit --json parsing tolerance
 * - manifest-skip: no root package.json passes with a notice (T-20261004-029)
 * - L0 ↔ L1 script pair stays in sync (mirror identity)
 */

import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import {
  GateError,
  expiredWaivers,
  extractGhsa,
  installedVersion,
  matchWaivers,
  normalizeSeverity,
  parseAuditJson,
  parseWaiverFile,
  scopeContradictions,
  type AuditFindings,
  type Waiver,
} from '../../scripts/dependency-audit';

const workspaceRoot = join(import.meta.dir, '..', '..');

const VALID_TOML = `# test waiver file
[[waiver]]
advisory = "GHSA-vfj7-8cjw-p6xm"
package = "braces"
version = "3.0.3"
scope = "dev-only"
reason = "no upstream fix"
decided_by = "T-20261003-011"
revisit_by = "2027-01-03"
`;

function makeWaiver(overrides: Partial<Waiver> = {}): Waiver {
  return {
    advisory: 'GHSA-VFJ7-8CJW-P6XM',
    package: 'braces',
    version: '3.0.3',
    scope: 'dev-only',
    reason: 'no upstream fix',
    decided_by: 'T-20261003-011',
    revisit_by: '2099-01-01',
    ...overrides,
  };
}

function makeFindings(): AuditFindings {
  return {
    braces: [
      {
        id: 1240992,
        url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
        title: 'braces DoS',
        severity: 'high',
        vulnerable_versions: '<=3.0.3',
      },
    ],
    'some-prod-pkg': [
      {
        id: 999,
        url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
        title: 'unrelated critical',
        severity: 'critical',
      },
    ],
  };
}

function tempRepoWithInstalled(pkg: string, version: string): string {
  const root = mkdtempSync(join(tmpdir(), 'dep-audit-test-'));
  mkdirSync(join(root, 'node_modules', ...pkg.split('/')), { recursive: true });
  writeFileSync(
    join(root, 'node_modules', ...pkg.split('/'), 'package.json'),
    JSON.stringify({ name: pkg, version }),
  );
  return root;
}

describe('extractGhsa', () => {
  test('extracts the GHSA id from a bun advisory URL', () => {
    expect(extractGhsa('https://github.com/advisories/GHSA-vfj7-8cjw-p6xm')).toBe(
      'GHSA-VFJ7-8CJW-P6XM',
    );
  });
  test('returns null for missing or non-GHSA urls', () => {
    expect(extractGhsa(undefined)).toBeNull();
    expect(extractGhsa('https://example.com/nothing')).toBeNull();
  });
});

describe('parseWaiverFile (strict schema)', () => {
  test('parses a valid file', () => {
    const waivers = parseWaiverFile(VALID_TOML);
    expect(waivers).toHaveLength(1);
    expect(waivers[0]).toEqual({
      advisory: 'GHSA-VFJ7-8CJW-P6XM',
      package: 'braces',
      version: '3.0.3',
      scope: 'dev-only',
      reason: 'no upstream fix',
      decided_by: 'T-20261003-011',
      revisit_by: '2027-01-03',
    });
  });

  test('a file with no [[waiver]] entries is valid (channel present, nothing waived)', () => {
    expect(parseWaiverFile('# only a comment\n')).toEqual([]);
  });

  test('malformed TOML fails closed', () => {
    expect(() => parseWaiverFile('this is [ not toml')).toThrow(/not valid TOML/);
  });

  test('unknown top-level key fails closed', () => {
    expect(() => parseWaiverFile(`${VALID_TOML}\n[extend]\nuseDefault = true\n`)).toThrow(
      /unknown top-level key "extend"/,
    );
  });

  test('unknown entry key fails closed', () => {
    expect(() =>
      parseWaiverFile(VALID_TOML.replace('revisit_by = "2027-01-03"', 'revisit_by = "2027-01-03"\nextra = 1')),
    ).toThrow(/unknown key "extra"/);
  });

  test('missing required key fails closed', () => {
    const withoutReason = VALID_TOML.split('\n')
      .filter((l) => !l.startsWith('reason'))
      .join('\n');
    expect(() => parseWaiverFile(withoutReason)).toThrow(/"reason" is required/);
  });

  test('empty string value fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML.replace('reason = "no upstream fix"', 'reason = ""'))).toThrow(
      /"reason" is required/,
    );
  });

  test('non-GHSA advisory id fails closed', () => {
    expect(() =>
      parseWaiverFile(VALID_TOML.replace('GHSA-vfj7-8cjw-p6xm', 'CVE-2024-4068')),
    ).toThrow(/"advisory" must be a GHSA id/);
  });

  test('invalid scope fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML.replace('scope = "dev-only"', 'scope = "dev"'))).toThrow(
      /"scope" must be/,
    );
  });

  test('malformed revisit_by date fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML.replace('2027-01-03', '2027/01/03'))).toThrow(
      /"revisit_by" must be a valid YYYY-MM-DD/,
    );
  });

  test('impossible calendar date fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML.replace('2027-01-03', '2027-02-30'))).toThrow(
      /"revisit_by" must be a valid YYYY-MM-DD/,
    );
  });

  test('non-semver version pin fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML.replace('version = "3.0.3"', 'version = "latest"'))).toThrow(
      /"version" must be an exact semver pin/,
    );
  });

  test('duplicate advisory/package fails closed', () => {
    expect(() => parseWaiverFile(VALID_TOML + VALID_TOML)).toThrow(/duplicate waiver/);
  });
});

describe('expiry (revisit-by)', () => {
  test('past date is expired', () => {
    expect(expiredWaivers([makeWaiver({ revisit_by: '2020-01-01' })], '2026-10-03')).toHaveLength(1);
  });
  test('revisit date itself is still valid (not yet past)', () => {
    expect(expiredWaivers([makeWaiver({ revisit_by: '2026-10-03' })], '2026-10-03')).toHaveLength(0);
  });
  test('future date is not expired', () => {
    expect(expiredWaivers([makeWaiver({ revisit_by: '2027-01-03' })], '2026-10-03')).toHaveLength(0);
  });
});

describe('matchWaivers', () => {
  test('suppresses a matching finding and keeps the rest', () => {
    const repo = tempRepoWithInstalled('braces', '3.0.3');
    const result = matchWaivers(makeFindings(), [makeWaiver()], repo);
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0].pkg).toBe('braces');
    expect(result.stale).toHaveLength(0);
    expect(result.versionDrift).toHaveLength(0);
    // the unrelated critical finding must survive suppression
    expect(result.remaining).toHaveLength(1);
    expect(result.remaining[0].pkg).toBe('some-prod-pkg');
  });

  test('waiver whose advisory no longer appears is stale (fail-closed guard)', () => {
    const repo = tempRepoWithInstalled('braces', '3.0.3');
    const fixed = makeFindings();
    delete fixed.braces; // advisory got patched away
    const result = matchWaivers(fixed, [makeWaiver()], repo);
    expect(result.stale).toHaveLength(1);
    expect(result.suppressed).toHaveLength(0);
  });

  test('different advisory under the same package does not satisfy the waiver', () => {
    const repo = tempRepoWithInstalled('braces', '3.0.3');
    const other = makeFindings();
    other.braces[0].url = 'https://github.com/advisories/GHSA-zzzz-yyyy-xxxx';
    const result = matchWaivers(other, [makeWaiver()], repo);
    expect(result.stale).toHaveLength(1);
  });

  test('version drift between pin and installed version is flagged (fail-closed guard)', () => {
    const repo = tempRepoWithInstalled('braces', '3.0.2');
    const result = matchWaivers(makeFindings(), [makeWaiver()], repo);
    expect(result.versionDrift).toHaveLength(1);
    expect(result.versionDrift[0].installed).toBe('3.0.2');
    expect(result.suppressed).toHaveLength(0);
  });

  test('missing node_modules downgrades to a warning, matching proceeds on advisory+package', () => {
    const repo = mkdtempSync(join(tmpdir(), 'dep-audit-test-')); // no node_modules
    const result = matchWaivers(makeFindings(), [makeWaiver()], repo);
    expect(result.suppressed).toHaveLength(1);
    expect(result.versionDrift).toHaveLength(0);
  });
});

describe('installedVersion', () => {
  test('reads the installed version from node_modules', () => {
    const repo = tempRepoWithInstalled('@scope/pkg', '1.2.3');
    expect(installedVersion('@scope/pkg', repo)).toBe('1.2.3');
  });
  test('returns null when the package is absent', () => {
    const repo = mkdtempSync(join(tmpdir(), 'dep-audit-test-'));
    expect(installedVersion('braces', repo)).toBeNull();
  });
});

describe('scopeContradictions', () => {
  test('dev-only waiver for a production dependency is a contradiction', () => {
    const pkg = { dependencies: { braces: '^3.0.3' } };
    expect(scopeContradictions([makeWaiver({ scope: 'dev-only' })], pkg)).toHaveLength(1);
  });
  test('production-scope waiver for the same tree is fine', () => {
    const pkg = { dependencies: { braces: '^3.0.3' } };
    expect(scopeContradictions([makeWaiver({ scope: 'production' })], pkg)).toHaveLength(0);
  });
  test('dev-only waiver for a package only in devDependencies is fine', () => {
    const pkg = { devDependencies: { braces: '^3.0.3' } };
    expect(scopeContradictions([makeWaiver({ scope: 'dev-only' })], pkg)).toHaveLength(0);
  });
});

describe('normalizeSeverity', () => {
  test('unknown severity fails closed as high', () => {
    expect(normalizeSeverity(undefined)).toBe('high');
    expect(normalizeSeverity('weird')).toBe('high');
  });
  test('known severities pass through', () => {
    expect(normalizeSeverity('LOW')).toBe('low');
    expect(normalizeSeverity('moderate')).toBe('moderate');
  });
});

describe('parseAuditJson', () => {
  test('parses plain JSON', () => {
    expect(parseAuditJson('{"braces":[]}')).toEqual({ braces: [] });
  });
  test('parses JSON with a prefixed noise line', () => {
    expect(parseAuditJson('[0.06ms] ".env"\n{"braces":[]}\n')).toEqual({ braces: [] });
  });
  test('garbage fails closed via GateError', () => {
    expect(() => parseAuditJson('not json at all')).toThrow(GateError);
  });
});

describe('manifest-skip (T-20261004-029)', () => {
  test('a repo with no root package.json exits 0 with a SKIP notice (docs-only projects)', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'dep-audit-bare-')); // no package.json
    const proc = Bun.spawn(['bun', join(workspaceRoot, 'scripts', 'dependency-audit.ts')], {
      cwd: bare,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    expect(proc.exitCode).toBe(0);
    expect(stdout).toContain('[SKIP] no package.json at repo root');
  });

  test('a repo with a package.json does not take the skip path', async () => {
    const withPkg = mkdtempSync(join(tmpdir(), 'dep-audit-pkg-'));
    writeFileSync(join(withPkg, 'package.json'), JSON.stringify({ name: 'probe', version: '1.0.0' }));
    const proc = Bun.spawn(['bun', join(workspaceRoot, 'scripts', 'dependency-audit.ts')], {
      cwd: withPkg,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    expect(stdout).not.toContain('[SKIP]');
  });
});

describe('L0 ↔ L1 mirror identity', () => {
  test('templates/common/scripts/dependency-audit.ts is byte-identical to the L0 script', () => {
    const l0 = readFileSync(join(workspaceRoot, 'scripts', 'dependency-audit.ts'), 'utf-8');
    const l1 = readFileSync(
      join(workspaceRoot, 'templates', 'common', 'scripts', 'dependency-audit.ts'),
      'utf-8',
    );
    expect(l1).toBe(l0);
  });
});
