// upgrade-lane-coverage.test.ts — §4.1 of design
// docs/designs/2026-11-27-version-advance-lane-coverage-design.md (T-20261127-006):
// the version-advance lane coverage — S1's SYNC_TEMPLATE_ADVANCE attribution
// reaches the agents / docs / scripts lanes. The "template moved without a
// version bump" state is modeled at the delivery manifest exactly as the S1
// fixture does: the project file's (edited) bytes are pinned as the recorded
// baseline while the real template copy differs — the shape an un-bumped
// template-side edit produces. Engine runs execute at DESCRIBE scope
// (upgrade-overwrite-protection pattern); scenes CLONE the committed delivered
// base instead of re-running the wave (windows CI suite-budget discipline).
//
// Scenes:
//   A1 agents  — baseline-clean equal-version drift → SYNC_TEMPLATE_ADVANCE (INFO),
//                delivered with the lifecycle-preserving writer; dry-run parity.
//   A2 agents  — project-moved (baseline negative) → CONFLICT (ERROR), preserved
//                (D2 pin — the extension must NOT have weakened it).
//   A3 docs    — docs/context.md equal-version drift, baseline-clean →
//                SYNC_TEMPLATE_ADVANCE through the ownership/splice chain.
//   A4 docs    — docs/context.md with a project-only section → CONTEXT_PRESERVE
//                (the preserve/splice machinery is intact under the new reason).
//   A5 scripts — baseline-proven equal-version drift → SYNC_TEMPLATE_ADVANCE
//                (the equalVersionRestore verdict rename; unproven forks keep
//                CONFLICT via resolveEqualVersionDisposition — untouched code).
//   B1 docs    — a generic versioned doc (co-consult engagement-orchestration.md,
//                the *<file> version: footer class) — the T-20261001-021 silent
//                strand: baseline-clean → delivered with SYNC_TEMPLATE_ADVANCE;
//                project-moved copy → DRIFT_PRESERVE now visible (was silent).

import { existsSync, cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterAll, describe, expect, test } from 'bun:test';

import { baselineKeyFor } from '../../scripts/lib/upgrade-policy.ts';
import { applySubstitutions } from '../../scripts/helpers/substitute-placeholders.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const AGENT_REL = 'agents/automation-engineer.md';
const CONTEXT_REL = 'docs/context.md';
const DOC_REL = 'docs/engagement-orchestration.md';
const SCRIPT_REL = 'scripts/readme-lifecycle-audit.ts';
const manifestOf = (tmp: string) => join(tmp, '.claude', 'last-upgrade-delivery.json');

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): void {
  spawnSync('git', ['-C', cwd, 'config', '--unset', 'core.hooksPath'], { env: gitCleanEnv(), stdio: 'ignore' });
  const r = spawnSync('git', ['-C', cwd, ...args], { env: gitCleanEnv(), stdio: 'ignore' });
  expect(r.status).toBe(0);
}

function commitAll(tmp: string, msg: string): void {
  const st = spawnSync('git', ['-C', tmp, 'status', '--porcelain'], { encoding: 'utf8', env: gitCleanEnv() });
  if (!(st.stdout ?? '').trim()) return; // nothing to commit
  git(tmp, 'add', '-A');
  git(tmp, 'commit', '-q', '-m', msg);
}

function freshProject(variant: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-lane-coverage-'));
  tmpDirs.push(tmp);
  assertCallerEnvSafeForGitFixtures(tmp);
  spawnSync('git', ['init', '-q'], { cwd: tmp, env: gitCleanEnv(), stdio: 'ignore' });
  assertFixtureGitIdentity(tmp);
  git(tmp, 'config', 'user.email', 'test@example.com');
  git(tmp, 'config', 'user.name', 'Test');
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(join(tmp, '.claude', 'template-version.txt'), `variant=${variant}\nversion=0.0.0\ncountry=none\n`);
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  writeFileSync(join(tmp, 'scripts', 'SCRIPTS.md'), readFileSync(join(workspaceRoot, 'scripts', 'SCRIPTS.md')));
  commitAll(tmp, 'seed');
  return tmp;
}

function runUpgrade(tmp: string, extra: string[] = []): { status: number; out: string } {
  const r = spawnSync('bun', [upgradeScript, tmp, '--variant', readVariant(tmp), '--yes', ...extra], {
    encoding: 'utf-8',
    timeout: 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ''}\n${r.stderr ?? ''}` };
}

const readVariant = (tmp: string): string => {
  // The engine rewrites template-version.txt at the project ROOT at post-upgrade
  // (the .claude/ seed is consumed at wave 1); read either location.
  for (const p of [join(tmp, 'template-version.txt'), join(tmp, '.claude', 'template-version.txt')]) {
    if (existsSync(p)) return /variant=(\S+)/.exec(readFileSync(p, 'utf8'))?.[1] ?? 'co-work';
  }
  return 'co-work';
};

interface Row {
  path: string;
  verdict: string;
  severity: string;
  detail?: string;
}
const decisionsOf = (tmp: string): Row[] => {
  expect(existsSync(manifestOf(tmp))).toBe(true); // apply runs only
  return JSON.parse(readFileSync(manifestOf(tmp), 'utf8')).decisions as Row[];
};
const rowsFor = (rows: Row[], path: string): Row[] => rows.filter((r) => r.path === path);

function deliveredBase(variant: string): string {
  const tmp = freshProject(variant);
  runUpgrade(tmp);
  commitAll(tmp, 'wave 1 delivery');
  return tmp;
}

function cloneFixture(source: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-lane-coverage-c-'));
  tmpDirs.push(tmp);
  rmSync(tmp, { recursive: true, force: true });
  cpSync(source, tmp, { recursive: true });
  return tmp;
}

/** Pin the recorded baseline for `rel` at `text` — the manifest state "these bytes
 *  were delivered last wave" that a real template-side edit without a bump produces. */
function forgeBaseline(tmp: string, rel: string, text: string): void {
  const manifest = JSON.parse(readFileSync(manifestOf(tmp), 'utf8')) as {
    baselines: Record<string, { hash: string; templateVersion: string }>;
  };
  expect(manifest.baselines?.[rel]).toBeDefined();
  manifest.baselines[rel] = { ...manifest.baselines[rel]!, hash: baselineKeyFor(rel, text) };
  writeFileSync(manifestOf(tmp), JSON.stringify(manifest, null, 2));
}

// ── Engine scenes (run once, at collection) ──────────────────────────────────

const baseA = deliveredBase('co-work');
const baseB = deliveredBase('co-consult');

// A1 — agents: baseline-clean equal-version drift → SYNC_TEMPLATE_ADVANCE.
const agentBase = (() => {
  const p = join(baseA, AGENT_REL);
  expect(existsSync(p)).toBe(true);
  return readFileSync(p, 'utf8');
})();
const sA1 = (() => {
  const tmp = cloneFixture(baseA);
  const projFile = join(tmp, AGENT_REL);
  const drifted = `${agentBase}\n<!-- fixture: template-side advance, agents lane -->\n`;
  writeFileSync(projFile, drifted);
  forgeBaseline(tmp, AGENT_REL, drifted);
  commitAll(tmp, 'agents copy at its (forged) baseline');
  const dry = runUpgrade(tmp, ['--dry-run']);
  const bytesAfterDry = readFileSync(projFile, 'utf8');
  const apply = runUpgrade(tmp);
  return {
    dry,
    bytesAfterDry,
    apply,
    rows: rowsFor(decisionsOf(tmp), AGENT_REL),
    appliedBytes: readFileSync(projFile, 'utf8'),
    drifted,
  };
})();

// A2 — agents: project moved (unattributable) → CONFLICT (ERROR) preserved.
const sA2 = (() => {
  const tmp = cloneFixture(baseA);
  const projFile = join(tmp, AGENT_REL);
  const moved = `${agentBase}\n<!-- fixture: project-side edit, agents lane -->\n`;
  writeFileSync(projFile, moved);
  commitAll(tmp, 'agents copy moved (project-side)');
  const apply = runUpgrade(tmp);
  return { apply, rows: rowsFor(decisionsOf(tmp), AGENT_REL), bytes: readFileSync(projFile, 'utf8'), moved };
})();

// A3 — docs/context.md equal-version drift, baseline-clean → advance.
const contextBase = readFileSync(join(baseA, CONTEXT_REL), 'utf8');
// The edit must sit BEFORE the version footer: a footer that is no longer the
// final line reads as "no footer" → wholeFileOwned (the ADR-0108 shape), which
// is A4's scene, not this one.
const contextDrift = (() => {
  // The footer shape is `\n---\n\n*context.md version: …*\s*$` (VERSION_FOOTER_RE):
  // the edit must sit BEFORE the `---` separator, or the footer stops matching and
  // the file reads wholeFileOwned (A4's shape, not this one).
  const m = /\n---\n\n\*context\.md version:[^\n]*\*\s*$/.exec(contextBase);
  const tail = m?.[0] ?? '';
  if (!tail) return `${contextBase}\n<!-- fixture: template-side advance, docs lane -->\n`;
  return `${contextBase.slice(0, contextBase.length - tail.length)}\n<!-- fixture: template-side advance, docs lane -->${tail}`;
})();
const sA3 = (() => {
  const tmp = cloneFixture(baseA);
  const projFile = join(tmp, CONTEXT_REL);
  writeFileSync(projFile, contextDrift);
  forgeBaseline(tmp, CONTEXT_REL, contextDrift);
  commitAll(tmp, 'context.md at its (forged) baseline');
  const apply = runUpgrade(tmp);
  return {
    tmp,
    apply,
    rows: rowsFor(decisionsOf(tmp), CONTEXT_REL),
    appliedBytes: readFileSync(projFile, 'utf8'),
  };
})();

// A4 — docs/context.md with a project-only section → CONTEXT_PRESERVE intact.
const sA4 = (() => {
  const tmp = cloneFixture(baseA);
  const projFile = join(tmp, CONTEXT_REL);
  const evolved = `${contextBase}\n## Project Only Section\n\nproject-authored content\n`;
  writeFileSync(projFile, evolved);
  commitAll(tmp, 'context.md evolved (project-only section)');
  const apply = runUpgrade(tmp);
  return { apply, rows: rowsFor(decisionsOf(tmp), CONTEXT_REL), bytes: readFileSync(projFile, 'utf8'), evolved };
})();

// A5 — scripts: baseline-proven equal-version drift → SYNC_TEMPLATE_ADVANCE.
const scriptBase = (() => {
  const p = join(baseA, SCRIPT_REL);
  expect(existsSync(p)).toBe(true);
  return readFileSync(p, 'utf8');
})();
const sA5 = (() => {
  const tmp = cloneFixture(baseA);
  const projFile = join(tmp, SCRIPT_REL);
  const drifted = `${scriptBase}\n// fixture: template-side advance, scripts lane\n`;
  writeFileSync(projFile, drifted);
  forgeBaseline(tmp, SCRIPT_REL, drifted);
  commitAll(tmp, 'script at its (forged) baseline');
  const apply = runUpgrade(tmp);
  return { apply, rows: rowsFor(decisionsOf(tmp), SCRIPT_REL), appliedBytes: readFileSync(projFile, 'utf8') };
})();

// B1 — generic versioned doc: the silent strand closes both ways.
const docBase = readFileSync(join(baseB, DOC_REL), 'utf8');
const sB1advance = (() => {
  const tmp = cloneFixture(baseB);
  const projFile = join(tmp, DOC_REL);
  const drifted = `${docBase}\n<!-- fixture: template-side advance, versioned doc -->\n`;
  writeFileSync(projFile, drifted);
  forgeBaseline(tmp, DOC_REL, drifted);
  commitAll(tmp, 'versioned doc at its (forged) baseline');
  const apply = runUpgrade(tmp);
  return { apply, rows: rowsFor(decisionsOf(tmp), DOC_REL), appliedBytes: readFileSync(projFile, 'utf8') };
})();
const sB1preserve = (() => {
  const tmp = cloneFixture(baseB);
  const projFile = join(tmp, DOC_REL);
  const moved = `${docBase}\n<!-- fixture: project-side edit, versioned doc -->\n`;
  writeFileSync(projFile, moved);
  commitAll(tmp, 'versioned doc moved (project-side)');
  const apply = runUpgrade(tmp);
  return { apply, rows: rowsFor(decisionsOf(tmp), DOC_REL), bytes: readFileSync(projFile, 'utf8'), moved };
})();

describe('§4.1 lane coverage — agents lane', () => {
  test('A1: baseline-clean equal-version drift → SYNC_TEMPLATE_ADVANCE (INFO), delivered, dry-run parity', () => {
    expect(sA1.dry.out).toContain(`ADVANCE ${AGENT_REL}`);
    expect(sA1.bytesAfterDry).toBe(sA1.drifted); // dry-run wrote nothing
    expect(sA1.apply.out).toContain(`ADVANCE ${AGENT_REL}`);
    const advance = sA1.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.severity).toBe('INFO');
    expect(sA1.appliedBytes).toBe(agentBase); // template copy verbatim (rendered equal)
    const restored = rowsFor(sA1.rows, AGENT_REL).find((r) => r.verdict === 'DRIFT_RESTORED');
    expect(restored).toBeUndefined(); // the DRIFT_RESTORED (WARN) mislabel is gone
  });

  test('A2: project-moved agents drift stays CONFLICT (ERROR), preserved — the D2 pin holds', () => {
    expect(sA2.apply.status).not.toBe(0); // ERROR severity exits non-zero
    const conflict = sA2.rows.find((r) => r.verdict === 'CONFLICT');
    expect(conflict).toBeDefined();
    expect(conflict!.severity).toBe('ERROR');
    expect(sA2.bytes).toBe(sA2.moved);
    expect(sA2.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
  });
});

describe('§4.1 lane coverage — docs lane (TEMPLATE TREE SYNC)', () => {
  test('A3: context.md equal-version drift, baseline-clean → SYNC_TEMPLATE_ADVANCE through the guard chain', () => {
    const advance = sA3.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.severity).toBe('INFO');
    // The ADVANCE write renders the scaffold placeholder map first (the documented
    // one-time token normalization — T-20260930-025 class; wave-1 NEW delivers raw).
    const renderedTemplate = applySubstitutions(
      readFileSync(join(workspaceRoot, 'templates', 'common', CONTEXT_REL), 'utf8'),
      {
        // basename() (node:path) — NOT split('/'): a win32 temp path carries
        // backslashes, so a manual forward-slash split hands the WHOLE
        // C:\... path to the placeholder map (the engine itself renders
        // basename(projectDir) — PR #2202 win32 leg; #2189/#2201 precedent).
        projectName: basename(sA3.tmp),
        description: '',
        characteristics: '',
        variantName: 'co-work',
        countryDisplayName: '',
      },
    );
    expect(sA3.appliedBytes).toBe(renderedTemplate);
    expect(sA3.rows.find((r) => r.verdict === 'CONTEXT_PRESERVE')).toBeUndefined();
  });

  test('A4: context.md with a project-only section → CONTEXT_PRESERVE (preserve/splice intact)', () => {
    expect(sA4.rows.find((r) => r.verdict === 'CONTEXT_PRESERVE')).toBeDefined();
    expect(sA4.bytes).toBe(sA4.evolved);
    expect(sA4.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
  });

  test('B1 advance: versioned doc, baseline-clean → delivered with SYNC_TEMPLATE_ADVANCE (the silent strand closes)', () => {
    const advance = sB1advance.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.severity).toBe('INFO');
    expect(sB1advance.appliedBytes).toBe(docBase);
  });

  test('B1 preserve: versioned doc, project-moved → visible DRIFT_PRESERVE (was a silent skip)', () => {
    const preserved = sB1preserve.rows.find((r) => r.verdict === 'DRIFT_PRESERVE');
    expect(preserved).toBeDefined();
    expect(sB1preserve.bytes).toBe(sB1preserve.moved);
    expect(sB1preserve.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE')).toBeUndefined();
  });
});

describe('§4.1 lane coverage — scripts lane (equalVersionRestore vocabulary)', () => {
  test('A5: baseline-proven equal-version drift → SYNC_TEMPLATE_ADVANCE (INFO), delivered', () => {
    const advance = sA5.rows.find((r) => r.verdict === 'SYNC_TEMPLATE_ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.severity).toBe('INFO');
    expect(advance!.detail ?? '').toContain('baseline');
    expect(sA5.appliedBytes).toBe(scriptBase);
    expect(sA5.rows.find((r) => r.path === SCRIPT_REL && r.verdict === 'DRIFT_RESTORED')).toBeUndefined();
  });
});
