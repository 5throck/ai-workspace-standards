/**
 * Tests for the variant.json `consumption: "adoption-only"` role (spec
 * docs/designs/2026-11-21-co-utility-dedup-and-adoption-role-design.md §2.2/§5.4/§5.9):
 *
 *  1. new-project enumeration excludes adoption-only variants (real repo pin: co-utility
 *     IS adoption-only — the candidate list must not offer it) and an explicit
 *     --variant request fails fast with the adopt-project / project-to-variant pointer
 *     (the message names the field so the intent is discoverable). new-project.ts is a
 *     top-level imperative script, so these run as REAL subprocesses against the repo
 *     scripts (the same discipline as the tenant-guard suite). Both spawn paths exit
 *     BEFORE any scaffolding work (the variant check precedes the readiness gate and
 *     the governance pre-check), so no fixture project is ever materialized.
 *  2. validate-variant-readiness.ts accepts the valid value (real co-utility + a
 *     minimal mkdtemp fixture), rejects unknown values, and rejects the
 *     adoption-only + syncDetection combination (design §5.4: the sync-embedded
 *     backport detector is PROHIBITED for adoption-only variants). The validator takes
 *     --dir, so fixtures live in mkdtemp dirs — no repo writes.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const NEW_PROJECT = join(REPO_ROOT, 'scripts', 'new-project.ts');
const READINESS = join(REPO_ROOT, 'scripts', 'validate-variant-readiness.ts');
const PROBE_NAME = 'co-zz-consumption-probe'; // never materialized — both probes exit before the copy phase

function runNewProject(args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bun', [NEW_PROJECT, PROBE_NAME, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 120_000,
    env: { ...process.env, CI: 'true' }, // non-interactive (beta-confirm parity with documented new-project behavior)
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runReadiness(args: string[]): { status: number; json: any; out: string } {
  const r = spawnSync('bun', [READINESS, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60_000,
  });
  let json: any = null;
  try {
    json = JSON.parse(r.stdout ?? '{}');
  } catch {
    /* non-JSON output — the string assertions below still apply */
  }
  return { status: r.status ?? -1, json, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

/** Minimal-but-complete variant fixture (no agent files → warns only, never errors). */
function makeVariantFixture(manifestExtra: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'variant-consumption-'));
  writeFileSync(
    join(dir, 'variant.json'),
    JSON.stringify({
      name: 'co-fixture',
      description: 'consumption-role fixture variant',
      status: 'beta',
      ...manifestExtra,
    }),
    'utf-8',
  );
  writeFileSync(join(dir, 'PROMOTION_CHECKLIST.md'), '# fixture promotion checklist\n', 'utf-8');
  writeFileSync(join(dir, 'README.md'), '# fixture variant\n', 'utf-8');
  writeFileSync(
    join(dir, 'AGENTS.md'),
    `# fixture AGENTS.md\n\n${'x'.repeat(80)}\n`, // > 50 chars non-stub body
    'utf-8',
  );
  return dir;
}

describe('new-project adoption-only consumption filter (design §2.2)', () => {
  test(
    'explicit --variant co-utility fails fast with the adoption-only message + adopt-project pointer',
    () => {
      const r = runNewProject(['--variant', 'co-utility']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('adoption-only');
      expect(r.stderr).toContain('"consumption": "adoption-only"');
      expect(r.stderr).toContain('adopt-project.ts');
      expect(r.stderr).toContain('project-to-variant.ts');
      // the generic invalid-variant row must NOT fire — the dedicated message replaces it
      expect(r.stderr).not.toContain('Invalid variant');
    },
    120_000,
  );

  test(
    'enumeration omits the adoption-only variant and still offers scaffoldable ones',
    () => {
      const r = runNewProject([]);
      expect(r.status).toBe(1); // "no variant specified" probe — exits before any scaffold
      expect(r.stderr).toContain('No variant specified');
      expect(r.stderr).not.toContain('co-utility');
      expect(r.stderr).toContain('co-work'); // a scaffoldable sibling stays listed
    },
    120_000,
  );
});

describe('validate-variant-readiness consumption checks (design §2.2/§5.4)', () => {
  test('real adoption-only variant passes: co-utility is READY with consumption accepted', () => {
    const r = runReadiness(['--variant', 'co-utility', '--json']);
    expect(r.status).toBe(0);
    expect(r.json?.ready).toBe(true);
    expect(r.json?.variant).toBe('co-utility');
  });

  test('fixture with consumption "adoption-only" is READY (valid value accepted)', () => {
    const dir = makeVariantFixture({ consumption: 'adoption-only' });
    try {
      const r = runReadiness(['--dir', dir, '--json']);
      expect(r.status).toBe(0);
      expect(r.json?.ready).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  test('unknown consumption value is a blocking error (silently ignored misconfiguration defeats the opt-out)', () => {
    const dir = makeVariantFixture({ consumption: 'scaffold' });
    try {
      const r = runReadiness(['--dir', dir, '--json']);
      expect(r.status).toBe(1);
      expect(r.json?.ready).toBe(false);
      expect(r.out).toContain('variant-consumption');
      expect(r.json?.findings.some((f: any) => f.code === 'variant-consumption' && f.message.includes('"scaffold"'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  test('adoption-only + syncDetection together is a blocking error (design §5.4: prohibited)', () => {
    const dir = makeVariantFixture({
      consumption: 'adoption-only',
      syncDetection: { enabled: true },
    });
    try {
      const r = runReadiness(['--dir', dir, '--json']);
      expect(r.status).toBe(1);
      expect(r.json?.ready).toBe(false);
      expect(r.out).toContain('variant-consumption-syncdetection');
      expect(r.out).toContain('must NOT declare a syncDetection block');
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  test('absent consumption key keeps the scaffoldable default (zero behavior change)', () => {
    const dir = makeVariantFixture({});
    try {
      const r = runReadiness(['--dir', dir, '--json']);
      expect(r.status).toBe(0);
      expect(r.json?.ready).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
