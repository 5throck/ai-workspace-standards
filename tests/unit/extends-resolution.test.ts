#!/usr/bin/env bun
// @version 1.0.0
// extends-resolution.test.ts — U-20261128-003 (spec
// docs/designs/2026-11-28-sync-worktree-robustness-design.md §3.3).
//
// Pins the shared canonical extends resolver and the worktree parity
// criterion (parity-invariance across layouts, not per-layout pass/fail):
//   - pure resolver: naive for non-`../` pointers; canonical (strip the `../`
//     run, anchor at the discovered workspace root) for `../` pointers;
//     canonical-over-naive precedence when both exist (design §3.2 item 4,
//     owner-approved); legacy naive backward-compat arm; convention fallback;
//     unresolvable → null target with EVERY candidate + searched ancestors;
//   - three-layout fixture (canonical Projects/<n>, Projects/<n>-sync-wt,
//     Projects/<n>-worktrees/<slug>): byte-identical sync-agent-mirrors
//     projections, sourced from the L0 roster body (the pre-fix worktree
//     layout silently fell back to the L1 convention body for pm.md);
//   - CLI --check passes in the worktrees layout after a write run (the
//     dev-sync 4.61 blocking-gate contract);
//   - audit.ts source contract: checkVariantAgentSections uses the shared
//     resolver and emits a WARN naming the searched candidates on an
//     unresolved target (the silent-skip is gone). In-process assertion is
//     impossible without running the whole audit CLI, so the WARN path is
//     grep-pinned the same way audit-mirror-parity-gate.test.ts pins its
//     wrapper, while the resolution semantics behind it are pinned by the
//     pure-function tests in this file.

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveExtendsTarget, discoverTemplatesRootFrom } from '../../scripts/lib/extends-resolution.ts';
import { syncAgentMirrors } from '../../scripts/sync-agent-mirrors.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');
const GENERATOR_SRC = path.join(REPO_ROOT, 'scripts', 'sync-agent-mirrors.ts');
const AUDIT_SRC = path.join(REPO_ROOT, 'scripts', 'audit.ts');
const TEMP_BASE = path.join(REPO_ROOT, 'tests', '.temp');
const SCRATCH = path.join(TEMP_BASE, 'extends-resolution-test');

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs.splice(0)) rmRf(dir);
});
function rmRf(dir: string) {
  fs.rmSync(dir, { recursive: true, force: true });
}

const L0_PM = '---\nname: pm\ntier: medium\ndescription: "L0 roster PM"\n---\n\n## Role\n\nL0 roster body — pm.\n';
const L0_DW = '---\nname: docs-writer\ntier: low\ndescription: "L0 roster docs writer"\n---\n\n## Role\n\nL0 roster body — docs-writer.\n';
const L1_PM = '---\nname: pm\ntier: medium\ndescription: "Common PM"\n---\n\n## Role\n\nL1 common body — pm (DIFFERENT from L0).\n';
const L1_DW = '---\nname: docs-writer\ntier: low\ndescription: "Common docs writer"\n---\n\n## Role\n\nL1 common body — docs-writer (DIFFERENT from L0).\n';
const stub = (name: string) => `---\nname: ${name}\ntier: ${name === 'pm' ? 'medium' : 'low'}\ndescription: Stub ${name}\nextends: ../../../agents/${name}.md\n---\n`;

/** Synthetic workspace with the three documented layouts, each holding the
 * same two ADR-0033 stubs; the L0 roster and the L1 common bodies are
 * deliberately distinct so a wrong source is visible in the mirror bytes. */
function makeWorkspace(tag: string): { ws: string; projects: string[] } {
  mkdirSync(TEMP_BASE);
  const ws = path.join(SCRATCH, tag);
  rmRf(ws);
  createdDirs.push(ws);
  for (const rel of ['agents', 'templates/common/agents', 'docs']) fs.mkdirSync(path.join(ws, rel), { recursive: true });
  fs.writeFileSync(path.join(ws, 'agents', 'pm.md'), L0_PM);
  fs.writeFileSync(path.join(ws, 'agents', 'docs-writer.md'), L0_DW);
  fs.writeFileSync(path.join(ws, 'templates', 'common', 'agents', 'pm.md'), L1_PM);
  fs.writeFileSync(path.join(ws, 'templates', 'common', 'agents', 'docs-writer.md'), L1_DW);
  const schema = fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8');
  const layouts = ['Projects/alpha', 'Projects/alpha-sync-wt', 'Projects/alpha-worktrees/slug-1'];
  const projects: string[] = [];
  for (const layout of layouts) {
    const project = path.join(ws, layout);
    fs.mkdirSync(path.join(project, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(project, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(project, 'docs', 'workspace-schema.json'), schema);
    fs.writeFileSync(path.join(project, 'variant.json'), JSON.stringify({ variant: 'co-alpha' }, null, 2));
    fs.writeFileSync(path.join(project, 'agents', 'pm.md'), stub('pm'));
    fs.writeFileSync(path.join(project, 'agents', 'docs-writer.md'), stub('docs-writer'));
    projects.push(project);
  }
  return { ws, projects };
}

function mkdirSync(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

describe('resolveExtendsTarget — pure resolver semantics (design §3.2)', () => {
  const ws = path.join(SCRATCH, 'pure');
  beforeEach(() => {
    rmRf(ws);
    mkdirSync(ws);
    createdDirs.push(ws);
    // Discovery-walk boundary: this scratch root sits INSIDE the real
    // workspace, so without a fixture-local templates/common/agents the walk
    // would escape to the repo's own templates/ and anchor candidates at the
    // real workspace root. The boundary makes every pure test deterministic.
    mkdirSync(path.join(ws, 'templates', 'common', 'agents'));
  });
  afterEach(() => rmRf(ws));

  test('non-`../` pointer resolves naive, no discovery on hit', () => {
    mkdirSync(path.join(ws, 'proj', 'agents'));
    fs.writeFileSync(path.join(ws, 'proj', 'agents', 'pm.md'), stub('pm'));
    fs.writeFileSync(path.join(ws, 'proj', 'agents', 'body.md'), 'local body');
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'proj', 'agents', 'pm.md'), extendsRaw: './body.md', projectRoot: path.join(ws, 'proj') });
    expect(r.target).toBe(path.resolve(path.join(ws, 'proj', 'agents'), 'body.md'));
    expect(r.source).toBe('naive');
    expect(r.searchedAncestors).toEqual([]);
  });

  test('`../` pointer at depth 2: canonical candidate equals the legacy naive path', () => {
    mkdirSync(path.join(ws, 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    fs.writeFileSync(path.join(ws, 'agents', 'pm.md'), L0_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), extendsRaw: '../../../agents/pm.md', projectRoot: path.join(ws, 'Projects', 'p') });
    expect(r.source).toBe('canonical');
    expect(r.target).toBe(path.join(ws, 'agents', 'pm.md'));
  });

  test('`../` pointer in the worktrees/<slug> layout anchors at the workspace root (the U-003 bug)', () => {
    mkdirSync(path.join(ws, 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'repo-worktrees', 's1', 'agents'));
    fs.writeFileSync(path.join(ws, 'agents', 'pm.md'), L0_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'repo-worktrees', 's1', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({
      stubPath: path.join(ws, 'Projects', 'repo-worktrees', 's1', 'agents', 'pm.md'),
      extendsRaw: '../../../agents/pm.md',
      projectRoot: path.join(ws, 'Projects', 'repo-worktrees', 's1'),
    });
    // Pre-fix math landed one ancestor short: <ws>/Projects/agents/pm.md (missing).
    expect(r.target).toBe(path.join(ws, 'agents', 'pm.md'));
    expect(r.source).toBe('canonical');
  });

  test('precedence: when both canonical and naive exist (different files), canonical wins (design §3.2 item 4)', () => {
    mkdirSync(path.join(ws, 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    // `../../agents/pm.md` from Projects/p/agents: canonical anchors the
    // remainder at <ws> (L0 roster), naive lands at <ws>/Projects/agents
    // (the layout artifact). Both exist → canonical must win.
    fs.writeFileSync(path.join(ws, 'agents', 'pm.md'), L0_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'agents', 'pm.md'), L1_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), extendsRaw: '../../agents/pm.md', projectRoot: path.join(ws, 'Projects', 'p') });
    expect(r.source).toBe('canonical');
    expect(r.target).toBe(path.join(ws, 'agents', 'pm.md'));
    expect(fs.readFileSync(r.target!, 'utf8')).toContain('L0 roster body');
  });

  test('legacy naive arm: naive target exists, canonical does not → naive resolves', () => {
    mkdirSync(path.join(ws, 'Projects', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    fs.writeFileSync(path.join(ws, 'Projects', 'agents', 'pm.md'), L1_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    // `../../agents/pm.md`: canonical (<ws>/agents/pm.md) missing, naive
    // (<ws>/Projects/agents/pm.md) present — the backward-compat arm.
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), extendsRaw: '../../agents/pm.md', projectRoot: path.join(ws, 'Projects', 'p') });
    expect(r.source).toBe('naive');
    expect(r.target).toBe(path.join(ws, 'Projects', 'agents', 'pm.md'));
  });

  test('convention fallback: canonical and naive miss, templates/common body exists', () => {
    mkdirSync(path.join(ws, 'templates', 'common', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    fs.writeFileSync(path.join(ws, 'templates', 'common', 'agents', 'pm.md'), L1_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), extendsRaw: '../../../agents/pm.md', projectRoot: path.join(ws, 'Projects', 'p') });
    expect(r.source).toBe('convention');
    expect(r.target).toBe(path.join(ws, 'templates', 'common', 'agents', 'pm.md'));
  });

  test('truly missing name: null target, candidates list ALL chain steps, ancestors searched', () => {
    mkdirSync(path.join(ws, 'templates', 'common', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({ stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), extendsRaw: '../../../agents/ghost.md', projectRoot: path.join(ws, 'Projects', 'p') });
    expect(r.target).toBeNull();
    expect(r.source).toBeNull();
    // canonical + naive + convention — the error message names every candidate.
    expect(r.candidates.length).toBe(3);
    expect(r.candidates.some((c) => c.endsWith(`${path.sep}agents${path.sep}ghost.md`))).toBe(true);
    expect(r.searchedAncestors.length).toBeGreaterThan(0);
  });

  test('discovery walk mirrors sync-agent-mirrors semantics (templates/common/agents anchor)', () => {
    mkdirSync(path.join(ws, 'templates', 'common', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p'));
    const d = discoverTemplatesRootFrom(path.join(ws, 'Projects', 'p'));
    expect(d.templatesRoot).toBe(path.join(ws, 'templates'));
    expect(d.searched).toContain(path.join(ws, 'Projects', 'p'));
  });

  test('templatesRootOverride supplies the workspace anchor without a walk', () => {
    mkdirSync(path.join(ws, 'elsewhere', 'templates', 'common', 'agents'));
    mkdirSync(path.join(ws, 'elsewhere', 'agents'));
    mkdirSync(path.join(ws, 'Projects', 'p', 'agents'));
    fs.writeFileSync(path.join(ws, 'elsewhere', 'agents', 'pm.md'), L0_PM);
    fs.writeFileSync(path.join(ws, 'Projects', 'p', 'agents', 'pm.md'), stub('pm'));
    const r = resolveExtendsTarget({
      stubPath: path.join(ws, 'Projects', 'p', 'agents', 'pm.md'),
      extendsRaw: '../../../agents/pm.md',
      projectRoot: path.join(ws, 'Projects', 'p'),
      templatesRootOverride: path.join(ws, 'elsewhere', 'templates'),
    });
    expect(r.source).toBe('canonical');
    expect(r.target).toBe(path.join(ws, 'elsewhere', 'agents', 'pm.md'));
    expect(r.searchedAncestors).toEqual([]);
  });
});

describe('three-layout parity (design §3.3 — the regression criterion)', () => {
  let handles: { ws: string; projects: string[] };
  beforeEach(() => {
    handles = makeWorkspace('parity');
  });
  afterEach(() => rmRf(handles.ws));

  test('projections are byte-identical across canonical / -sync-wt / -worktrees/<slug>, sourced from the L0 roster', () => {
    const mirrors: Record<string, Record<string, string>> = {};
    for (const project of handles.projects) {
      const res = syncAgentMirrors(project);
      expect(res.ok, JSON.stringify(res)).toBe(true);
      mirrors[project] = {
        pm: fs.readFileSync(path.join(project, '.claude', 'agents', 'pm.md'), 'utf8'),
        'docs-writer': fs.readFileSync(path.join(project, '.claude', 'agents', 'docs-writer.md'), 'utf8'),
      };
    }
    const [canonical, syncWt, worktree] = handles.projects;
    // Parity invariance: the criterion is identical bytes, not per-layout pass/fail.
    expect(mirrors[worktree]['pm']).toBe(mirrors[canonical]['pm']);
    expect(mirrors[syncWt]['pm']).toBe(mirrors[canonical]['pm']);
    expect(mirrors[worktree]['docs-writer']).toBe(mirrors[canonical]['docs-writer']);
    expect(mirrors[syncWt]['docs-writer']).toBe(mirrors[canonical]['docs-writer']);
    // Sourced from the L0 roster (the pre-fix worktree run silently fell back
    // to the L1 convention body for pm.md).
    expect(mirrors[worktree]['pm']).toContain('L0 roster body — pm.');
    expect(mirrors[worktree]['pm']).not.toContain('L1 common body');
    expect(mirrors[worktree]['docs-writer']).toContain('L0 roster body — docs-writer.');
    expect(mirrors[worktree]['docs-writer']).not.toContain('L1 common body');
  });

  test('CLI --check passes 2/2 in the worktrees layout after a write run (dev-sync 4.61 contract)', () => {
    const worktree = handles.projects[2];
    const write = spawnSync(process.execPath, [GENERATOR_SRC, '--dir', worktree], { encoding: 'utf8' });
    expect(write.status).toBe(0);
    const check = spawnSync(process.execPath, [GENERATOR_SRC, '--check', '--dir', worktree], { encoding: 'utf8' });
    expect(check.status, check.stdout + check.stderr).toBe(0);
    expect(check.stdout).toContain('0 differing');
    expect(check.stdout).toContain('2 agent(s) in parity');
    expect(check.stdout).not.toContain('[differing]');
    expect(check.stdout).not.toContain('UnresolvableStubError');
  });
});

describe('audit.ts source contract — no more silent skip (design §3.1 audit row)', () => {
  const auditSrc = fs.readFileSync(AUDIT_SRC, 'utf8');

  test('checkVariantAgentSections uses the shared canonical resolver', () => {
    expect(auditSrc).toContain('import { resolveExtendsTarget } from "./lib/extends-resolution.ts"');
    expect(auditSrc).toContain('projectRoot: path.dirname(filePath)');
  });

  test('unresolved target emits a WARN naming the searched candidates (silent skip removed)', () => {
    expect(auditSrc).toContain('searched candidates');
    expect(auditSrc).toContain('section check skipped for this stub');
  });
});
