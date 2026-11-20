/**
 * T-20261120-003 (spec docs/designs/2026-11-20-upgrade-adopt-row-truthfulness-design.md):
 * the VARIANT SCRIPTS walk must not abort on the first evolvedDeliveryGuard
 * conflict-skip. The versioned and unversioned arms used to `return` out of the
 * recursive walk, so every scripts/<variant>/ file visited after the first
 * conflict-skip got NO decision row, NO CONFLICT/SKIP line and NO copy from the
 * variant channel — and for the .mjs/.json surfaces the common scripts pass
 * never collects (collectScriptFiles is .ts only), no channel at all. A grant
 * parsed for those paths was honored right up to the abort: accepted, then
 * dropped on the variant channel (the 2026-11-19 co-deck 0.30.0 wave under-
 * delivered 20 scripts while the log read clean).
 *
 * Pinned here with the real co-deck template set: a conflict-class .ts that
 * sorts first (auto-calibrate.ts, the wave's actual abort point) plus a
 * variant-walk-only .mjs (extract_slidedata.mjs — unversioned, so the common
 * pass never sees it). Order-independent invariant: every walked variant
 * template file ends the run with at least one decision row; the .mjs is
 * delivered; the conflicted .ts carries exactly one CONFLICT row per channel
 * (sole-increment — no double count).
 *
 * Engine runs spawn scripts/upgrade-project.ts against a temp project and the
 * real workspace templates (the upgrade-project-disposition-grants pattern).
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { baselineKeyFor } from '../../scripts/lib/upgrade-policy.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-deck';
const WALK_ROOT = join(workspaceRoot, 'templates', VARIANT, 'scripts', VARIANT);

/** The evolved conflict file — sorts first in the walk (the wave's abort point). */
const CONFLICT_TS = `scripts/${VARIANT}/auto-calibrate.ts`;
/** The variant-walk-only .mjs (unversioned — the common scripts pass never collects it). */
const PROBE_MJS = `scripts/${VARIANT}/extract_slidedata.mjs`;

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(tmp: string, ...args: string[]): string {
  const r = spawnSync('git', ['-C', tmp, ...args], { env: gitCleanEnv(), encoding: 'utf8' });
  return `${r.stdout ?? ''}`;
}

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-variant-walk-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`);
  return tmp;
}

function runUpgrade(tmp: string, extraArgs: string[] = []): { status: number; out: string } {
  const result = spawnSync('bun', [upgradeScript, tmp, '--variant', VARIANT, '--yes', ...extraArgs], {
    encoding: 'utf-8',
    timeout: 300000,
    env: { ...process.env, LC_ALL: 'C', LANG: 'C', LANGUAGE: 'en' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: result.status ?? -1, out: `${result.stdout ?? ''}\n${result.stderr ?? ''}` };
}

function write(tmp: string, rel: string, content: string): void {
  mkdirSync(dirname(join(tmp, rel)), { recursive: true });
  writeFileSync(join(tmp, rel), content);
}
const read = (tmp: string, rel: string): string => readFileSync(join(tmp, rel), 'utf8');
const templateBytes = (rel: string): string => readFileSync(join(workspaceRoot, rel.replace(/^scripts\//, `templates/${VARIANT}/scripts/`)), 'utf8');

interface Decision {
  path: string;
  pass: string;
  verdict: string;
  severity: string;
  detail: string;
}
const readManifest = (tmp: string): { decisions: Decision[]; files: string[] } =>
  JSON.parse(read(tmp, '.claude/last-upgrade-delivery.json'));

/** Every file the variant walk owns (.ts/.mjs/.json under templates/<variant>/scripts/<variant>/). */
function walkedVariantRels(): string[] {
  const found: string[] = [];
  const walk = (dir: string, rel: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules' || e.name === 'temp') continue;
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), childRel);
      else if (e.isFile() && /\.(ts|mjs|json)$/.test(e.name)) found.push(`scripts/${VARIANT}/${childRel}`);
    }
  };
  walk(WALK_ROOT, '');
  return found.sort();
}

/**
 * Seed: auto-calibrate.ts project-evolved at a LOWER version against a stale
 * baseline (template also changed) → PROJECT_EVOLVED → CONFLICT (ERROR) with no
 * grant — the abort point (it sorts first, as in the wave). extract_slidedata.mjs
 * holds its last-delivered bytes (baseline-untouched, version behind the
 * template) — the version-gated arm → plain UPDATE/ADOPT delivery. No grants.
 */
function seed(): string {
  const tmp = makeTempProject();
  const templateTs = templateBytes(CONFLICT_TS);
  const staleTs = `${templateTs.trimEnd()}\n// stale delivered line (pre-0.30.0 baseline)\n`;
  const evolvedTs = `${templateTs.replace('// @version 1.0.1', '// @version 1.0.0').trimEnd()}\n// project-only calibration tweak (LOCAL-PATCH-free deliberate divergence)\n`;
  const templateMjs = templateBytes(PROBE_MJS);
  const deliveredMjs = `${templateMjs.replace('// @version 1.3.0', '// @version 1.2.0').trimEnd()}\n// stale delivered tail (pre-update baseline bytes)\n`;

  const manifest = {
    schemaVersion: 2,
    timestamp: 'test',
    project: 'fixture',
    templateVersion: '0.0.0',
    templateSha: '',
    baseSha: '',
    files: [CONFLICT_TS, PROBE_MJS],
    baselines: {
      [CONFLICT_TS]: { hash: baselineKeyFor(CONFLICT_TS, staleTs), templateVersion: '0.0.0' },
      [PROBE_MJS]: { hash: baselineKeyFor(PROBE_MJS, deliveredMjs), templateVersion: '0.0.0' },
    },
    decisions: [],
  };
  write(tmp, CONFLICT_TS, evolvedTs);
  write(tmp, PROBE_MJS, deliveredMjs); // baseline-untouched; template has moved since
  write(tmp, '.claude/last-upgrade-delivery.json', `${JSON.stringify(manifest, null, 2)}\n`);
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', 'seed evolved variant script');
  return tmp;
}

describe('T-20261120-003: the VARIANT SCRIPTS walk survives a conflict-skip', () => {
  const tmp = seed();
  const r = runUpgrade(tmp);

  test('the conflicted .ts is preserved and carries exactly one CONFLICT row per channel', () => {
    expect(read(tmp, CONFLICT_TS)).toContain('project-only calibration tweak');
    const rows = readManifest(tmp).decisions.filter((d) => d.path === CONFLICT_TS && d.verdict === 'CONFLICT');
    const passes = new Set(rows.map((d) => d.pass));
    expect(passes.has('SYNC_IF_NEWER: scripts/')).toBe(true);
    expect(passes.has('VARIANT SCRIPTS')).toBe(true);
    expect(rows).toHaveLength(2); // sole-increment: one row per channel, no double count
  });

  test('the variant-walk-only .mjs is still reached and delivered after the conflict-skip', () => {
    expect(read(tmp, PROBE_MJS)).toBe(templateBytes(PROBE_MJS));
    const adoptRows = readManifest(tmp).decisions.filter(
      (d) => d.path === PROBE_MJS && d.pass === 'VARIANT SCRIPTS' && d.verdict === 'ADOPT',
    );
    expect(adoptRows).toHaveLength(1);
  });

  test('every walked variant template file carries a row or reached template parity (no silent swallow)', () => {
    const decisions = readManifest(tmp).decisions;
    const rowedPaths = new Set(decisions.map((d) => d.path));
    const missing = walkedVariantRels().filter((rel) => {
      if (rowedPaths.has(rel)) return false;
      // delivered-to-parity files take the OK arm (noteParity, no row) — covered
      try {
        return read(tmp, rel) !== templateBytes(rel);
      } catch {
        return true; // absent and unrowed — swallowed
      }
    });
    expect(missing).toEqual([]);
  });

  test('the run exits non-zero on the unresolved CONFLICT (ERROR) — the report is the truth', () => {
    expect(r.status).toBe(1);
    expect(r.out).toContain('CONFLICT');
  });

  test('dry-run parity: the .mjs is reported as would-delivered past the conflict-skip', () => {
    const dry = runUpgrade(seed(), ['--dry-run']);
    expect(dry.status).toBe(1);
    expect(dry.out).toContain(`UPDATE ${PROBE_MJS}`); // walked past the .ts conflict-skip
    expect(dry.out).toContain(`CONFLICT DISPOSITION (SKIP): ${CONFLICT_TS}`);
  });
});
