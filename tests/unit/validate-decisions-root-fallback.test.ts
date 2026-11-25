#!/usr/bin/env bun
// @version 1.0.0
// validate-decisions-root-fallback.test.ts — T-20261124-012 / U-20261123-004
// (design docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.5).
// Check V resolves a cited DEC id against the workspace-root registry
// (<ROOT>/../../, used only when it holds AGENTS.md). Each test spawns the real
// script against a nested fixture tree: <ws>/AGENTS.md, <ws>/docs/decisions,
// <ws>/Projects/<p> as the project root.

import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'validate-decisions.ts');
const TEMP_BASE = join(WORKSPACE_ROOT, 'tests', '.temp');

const ROOT_ID = 'DEC-20261101-01';
const LOCAL_ID = 'DEC-20261102-02';
const NOWHERE_ID = 'DEC-20261103-03';

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

function write(dir: string, rel: string, content: string): void {
  const p = join(dir, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content, 'utf-8');
}

const VALID_RECORD = (id: string): string =>
  ['---', `id: ${id}`, 'date: 2026-11-01', 'agent: docs-writer', 'decision: fixture record', 'alternatives: none', 'status: accepted', 'knowledge_refs:', '  - CHANGELOG.md', '---', '', `# ${id}`, ''].join('\n');

/** Nested fixture: a workspace root (with or without AGENTS.md) holding the root
 *  registry, and a project under Projects/ whose CHANGELOG cites the given ids. */
function fixture(tag: string, opts: { rootHasAgentsMd: boolean; rootIds: string[]; localIds: string[]; cited: string[] }): string {
  mkdirSync(TEMP_BASE, { recursive: true });
  const ws = mkdtempSync(join(TEMP_BASE, `validate-decisions-root-${tag}-`));
  createdDirs.push(ws);
  if (opts.rootHasAgentsMd) write(ws, 'AGENTS.md', '# workspace\n');
  for (const id of opts.rootIds) write(ws, join('docs', 'decisions', `${id}.md`), `# ${id}\n`);
  const project = join(ws, 'Projects', 'co-fixture');
  for (const id of opts.localIds) write(project, join('docs', 'decisions', `${id}.md`), VALID_RECORD(id));
  write(project, 'CHANGELOG.md', `## Notes\n- ruled under ${opts.cited.join(', ')}.\n`);
  return project;
}

function run(cwd: string, json = false): { status: number; stdout: string; body: Record<string, unknown> } {
  const r = spawnSync('bun', json ? [SCRIPT, '--json'] : [SCRIPT], { cwd, encoding: 'utf-8' });
  return {
    status: r.status,
    stdout: r.stdout,
    body: json ? (JSON.parse(r.stdout) as Record<string, unknown>) : {},
  };
}

describe('validate-decisions — workspace-root fallback (design §4.5)', () => {
  test('an id present only at the workspace root passes with an INFO line', () => {
    const project = fixture('root-only', {
      rootHasAgentsMd: true,
      rootIds: [ROOT_ID],
      localIds: [],
      cited: [ROOT_ID],
    });
    const plain = run(project);
    expect(plain.status).toBe(0);
    expect(plain.stdout).toContain(`DEC id "${ROOT_ID}" resolves at the workspace root`);
    expect(plain.stdout).toContain(join('docs', 'decisions', `${ROOT_ID}.md`));
    const asJson = run(project, true);
    expect(asJson.status).toBe(0);
    expect(asJson.body.errors).toEqual([]);
    expect(asJson.body.rootResolved).toEqual([ROOT_ID]);
  });

  test('an id present at both levels resolves locally (no INFO line)', () => {
    const project = fixture('both', {
      rootHasAgentsMd: true,
      rootIds: [LOCAL_ID],
      localIds: [LOCAL_ID],
      cited: [LOCAL_ID],
    });
    const asJson = run(project, true);
    expect(asJson.status).toBe(0);
    expect(asJson.body.rootResolved).toEqual([]);
    expect(run(project).stdout).not.toContain('resolves at the workspace root');
  });

  test('an id present nowhere still fails Check V', () => {
    const project = fixture('nowhere', { rootHasAgentsMd: true, rootIds: [ROOT_ID], localIds: [], cited: [NOWHERE_ID] });
    const asJson = run(project, true);
    expect(asJson.status).toBe(1);
    const errors = asJson.body.errors as Array<{ check: string; message: string }>;
    expect(errors.some((e) => e.message.includes(NOWHERE_ID))).toBe(true);
  });

  test('ROOT/../../ without AGENTS.md is ignored (the id stays unresolved)', () => {
    const project = fixture('no-agents-md', {
      rootHasAgentsMd: false,
      rootIds: [ROOT_ID],
      localIds: [],
      cited: [ROOT_ID],
    });
    const asJson = run(project, true);
    expect(asJson.status).toBe(1);
    expect(asJson.body.rootResolved).toEqual([]);
  });
});
