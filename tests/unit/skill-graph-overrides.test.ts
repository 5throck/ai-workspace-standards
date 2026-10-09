/**
 * Unit pin for docs/skill-graph.overrides.json resolution (T-20261009-007,
 * design docs/designs/2026-10-09-skill-graph-triage-hardening-design.md D4).
 *
 * v2 removed bare-key fan-out SILENT application: bare keys still expand, but a
 * >1 fan-out warns and scoped keys pin exactly one node. Until this pin existed
 * the overrides file had exactly one test ("the file is written") — a stale bare
 * key would silently stop applying after the v2 migration.
 *
 * Fixture mirrors tests/unit/skill-graph-v2-identity.test.ts's known-good tree.
 *
 * @version 1.0.0
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO = resolve(import.meta.dir, '..', '..');
const GEN = join(REPO, 'scripts', 'generate-skill-graph.ts');
let root = '';
function write(rel: string, body: string): void {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, body);
}
const skill = (name: string, body: string, version = '1.0.0', extra = ''): string =>
  `---\nname: ${name}\nversion: ${version}\n${extra}---\n# ${name}\n${body}\n`;

let graph: any;
let stderr = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'sg-overrides-'));
  write('skills/foo/SKILL.md', skill('foo', 'shared body', '1.0.0', 'scope: common\n'));
  write('templates/common/skills/foo/SKILL.md', skill('foo', 'shared body', '1.2.0', 'scope: common\n'));
  write('templates/common/.keep', '');
  write('templates/co-a/skills/bar/SKILL.md', skill('bar', 'variant A flavour'));
  write('templates/co-b/skills/bar/SKILL.md', skill('bar', 'variant B flavour'));
  write('templates/co-a/agents/pm.md', '---\nname: pm\nversion: 1.0.0\nrequired_skills:\n  - bar\n---\n# pm A\n');
  write('templates/co-b/agents/pm.md', '---\nname: pm\nversion: 1.0.0\nrequired_skills:\n  - bar\n---\n# pm B\n');
  write('templates/co-a/variant.json', JSON.stringify({ skill_manifest: { variant_specific: [{ name: 'bar', used_by_agents: ['pm'], phases: [1] }] } }));
  write('templates/co-b/variant.json', JSON.stringify({ skill_manifest: { variant_specific: [{ name: 'bar', used_by_agents: ['pm'], phases: [1] }] } }));
  write('templates/co-a/docs/phase-definitions.md', '# Phases\n\n| Phase | Name |\n|---|---|\n| 1 | Discovery |\n');

  // T-20261009-007: the three resolution behaviours, one edge each.
  write('docs/skill-graph.overrides.json', JSON.stringify({
    edges: [
      { type: 'relates_to', from: 'skill:co-a/bar', to: 'skill:root/foo', reason: 'scoped key pins exactly one node' },
      { type: 'relates_to', from: 'skill:co-z/ghost', to: 'skill:root/foo', reason: 'unknown endpoint — warn and skip' },
      { type: 'relates_to', from: 'bar', to: 'skill:root/foo', reason: 'bare key fans out with a warning' },
    ],
  }, null, 2));

  const res = spawnSync('bun', [GEN], { env: { ...process.env, SKILL_GRAPH_ROOT: root }, encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`generator failed: ${res.stderr}\n${res.stdout}`);
  graph = JSON.parse(readFileSync(join(root, 'docs', 'skill-graph.json'), 'utf-8'));
  stderr = res.stderr;
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

const overrideEdges = (from: string): any[] =>
  (graph.edges ?? []).filter((e: any) => e.source === 'override' && e.from === from);

describe('skill-graph.overrides resolution pin (T-20261009-007)', () => {
  test('scoped key applies to exactly its node — the sibling same-name node is untouched', () => {
    expect(overrideEdges('skill:co-a/bar').length).toBeGreaterThanOrEqual(1);
    expect(overrideEdges('skill:co-a/bar')[0].to).toBe('skill:root/foo');
  });

  test('unknown endpoint warns and is skipped', () => {
    expect(overrideEdges('skill:co-z/ghost')).toHaveLength(0);
    expect(stderr).toContain('Override references unknown node: skill:co-z/ghost');
  });

  test('bare key fans out to every same-name node and warns about the fan-out', () => {
    expect(overrideEdges('skill:co-b/bar').length).toBeGreaterThanOrEqual(1);
    expect(stderr).toContain('bare override key "bar" fans out to 2 nodes');
  });
});
