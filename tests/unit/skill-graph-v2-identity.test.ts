/**
 * Fixture-tree tests for the skill-graph v2 generator: scoped identity, identical-copy collapse,
 * same-name/different-content split, metadata-only diffs, scope-first edge resolution, phase node
 * emission, edge dedupe, E1 impact, E3 usage, E4 suggestions and the "never edits SKILL.md" rule.
 * Design: docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §11.
 * @version 1.0.0
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { computeImpact } from '../../scripts/generate-skill-graph.ts';
import { upgradeSkillGraph } from '../../scripts/lib/skill-graph-compat.ts';
import { parseSkillsUsed } from '../../scripts/lib/skills-used.ts';

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

function snapshotTree(dir: string, acc: Record<string, number> = {}, base = dir): Record<string, number> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) snapshotTree(full, acc, base);
    else acc[full.slice(base.length).replace(/\\/g, '/')] = statSync(full).size;
  }
  return acc;
}

let graph: any;
let md = '';
let skillFilesBefore: Record<string, string> = {};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'sg-v2-'));
  // foo: identical content root/common, differing only by metadata stamps -> ONE node
  write('skills/foo/SKILL.md', skill('foo', 'shared body', '1.0.0', 'scope: common\nlast_updated: 2026-01-01\n'));
  write('templates/common/skills/foo/SKILL.md', skill('foo', 'shared body', '1.2.0', 'scope: common\nlast_updated: 2026-09-09\n'));
  // bar: same name + same version, different content in two variants -> TWO nodes
  write('templates/common/.keep', '');
  write('templates/co-a/skills/bar/SKILL.md', skill('bar', 'variant A flavour'));
  write('templates/co-b/skills/bar/SKILL.md', skill('bar', 'variant B flavour'));
  // baz: no used_by anywhere, owned by an agent only through a procedure step (E4)
  write('templates/co-a/skills/baz/SKILL.md', skill('baz', 'uses `foo` in prose'));
  // pm agents: same name, different content in two variants
  write('templates/co-a/agents/pm.md', '---\nname: pm\nversion: 1.0.0\nrequired_skills:\n  - foo\n  - bar\n---\n# pm A\n');
  write('templates/co-b/agents/pm.md', '---\nname: pm\nversion: 1.0.0\nrequired_skills:\n  - bar\n---\n# pm B\n');
  // manifests: duplicates the required_skills used_by edge (dedupe) and declares phases
  write('templates/co-a/variant.json', JSON.stringify({ skill_manifest: { variant_specific: [{ name: 'bar', used_by_agents: ['pm'], phases: [1, 2] }] } }));
  write('templates/co-b/variant.json', JSON.stringify({ skill_manifest: { variant_specific: [{ name: 'bar', used_by_agents: ['pm'], phases: [1] }] } }));
  write('templates/co-a/docs/phase-definitions.md', '# Phases\n\n| Phase | Name |\n|---|---|\n| 1 | Discovery |\n| 2 | Build |\n');
  // procedure in co-a: step pairs baz with pm (E4 evidence)
  write(
    'templates/co-a/procedures/p1/schema.yaml',
    'procedure_id: co-a-p1\nsteps:\n  - skill_key: baz\n    agent_key: pm\n  - skill_key: bar\n    agent_key: pm\n',
  );
  // E3: usage evidence
  write('memory/2026-10-01.md', '# log\n\n## Skills Used\n\n- skill: foo\n  usage: primary\n  outcome: completed\n');
  write('memory/2026-10-05.md', '# log\n\n## Skills Used\n\n- skill: foo\n  usage: primary\n  outcome: completed\n');

  skillFilesBefore = {};
  for (const rel of ['skills/foo/SKILL.md', 'templates/common/skills/foo/SKILL.md', 'templates/co-a/skills/bar/SKILL.md', 'templates/co-b/skills/bar/SKILL.md', 'templates/co-a/skills/baz/SKILL.md']) {
    skillFilesBefore[rel] = readFileSync(join(root, rel), 'utf-8');
  }

  const res = spawnSync('bun', [GEN], { env: { ...process.env, SKILL_GRAPH_ROOT: root }, encoding: 'utf-8' });
  if (res.status !== 0) throw new Error(`generator failed: ${res.stderr}\n${res.stdout}`);
  graph = JSON.parse(readFileSync(join(root, 'docs', 'skill-graph.json'), 'utf-8'));
  md = readFileSync(join(root, 'docs', 'skill-graph.md'), 'utf-8');
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

const node = (id: string): any => graph.nodes.find((n: any) => n.id === id);

describe('skill-graph v2 identity', () => {
  test('header is schema v2 / deg/v2', () => {
    expect(graph.version).toBe(2);
    expect(graph.graph_profile).toBe('deg/v2');
  });

  test('identical copies (metadata-only diff) collapse to one node scoped to the highest-precedence location', () => {
    const foos = graph.nodes.filter((n: any) => n.type === 'skill' && n.name === 'foo');
    expect(foos).toHaveLength(1);
    expect(foos[0].id).toBe('skill:root/foo');
    expect(foos[0].mirrors).toEqual(['skills/foo/SKILL.md', 'templates/common/skills/foo/SKILL.md']);
    expect(foos[0].capability).toBe('foo');
    expect(foos[0].content_hash).toHaveLength(16);
  });

  test('same name + same version + different content gives one node per hash', () => {
    const bars = graph.nodes.filter((n: any) => n.type === 'skill' && n.name === 'bar');
    expect(bars.map((n: any) => n.id).sort()).toEqual(['skill:co-a/bar', 'skill:co-b/bar']);
    expect(bars[0].content_hash).not.toBe(bars[1].content_hash);
    expect(bars.every((n: any) => n.version === '1.0.0')).toBe(true);
  });

  test('agents are scoped too (one pm per distinct content)', () => {
    const pms = graph.nodes.filter((n: any) => n.type === 'agent' && n.name === 'pm').map((n: any) => n.id).sort();
    expect(pms).toEqual(['agent:co-a/pm', 'agent:co-b/pm']);
  });

  test('edges resolve scope-first: each variant pm uses its own variant bar', () => {
    const usedBy = graph.edges.filter((e: any) => e.type === 'used_by').map((e: any) => `${e.from}>${e.to}`);
    expect(usedBy).toContain('skill:co-a/bar>agent:co-a/pm');
    expect(usedBy).toContain('skill:co-b/bar>agent:co-b/pm');
    expect(usedBy).not.toContain('skill:co-a/bar>agent:co-b/pm');
    expect(usedBy).not.toContain('skill:co-b/bar>agent:co-a/pm');
  });

  test('duplicate (from,to,type) edges are dropped (required_skills + manifest -> one used_by)', () => {
    const keys = graph.edges.map((e: any) => `${e.from}|${e.to}|${e.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.filter((k: string) => k === 'skill:co-a/bar|agent:co-a/pm|used_by')).toHaveLength(1);
  });

  test('phase targets are emitted as scoped phase nodes with labels; no dangling edges', () => {
    expect(node('phase:co-a/1')).toMatchObject({ type: 'phase', scope: 'co-a', ordinal: 1, label: 'Discovery' });
    expect(node('phase:co-a/2')).toBeDefined();
    expect(node('phase:co-b/1')).toBeDefined();
    const ids = new Set(graph.nodes.map((n: any) => n.id));
    for (const e of graph.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  test('every skill/agent id equals type:scope/name', () => {
    for (const n of graph.nodes) {
      if (n.type === 'skill' || n.type === 'agent') expect(n.id).toBe(`${n.type}:${n.scope}/${n.name}`);
    }
  });
});

describe('skill-graph v2 enhancements', () => {
  test('E3: usage joined from memory ## Skills Used (sessions, last_used) via capability', () => {
    expect(node('skill:root/foo').usage).toEqual({ sessions: 2, last_used: '2026-10-05' });
    expect(node('skill:co-a/bar').usage).toBeUndefined();
    expect(md).toContain('## Skill Usage (E3)');
    expect(md).toContain('used-but-unlinked');
  });

  test('E4: required_by suggestion derived from procedure steps, report-only', () => {
    expect(md).toContain('Suggested `required_by` agents (E4, report-only)');
    expect(md).toMatch(/`co-a\/baz` \| co-a\/pm \(co-a\.p1\)/);
  });

  test('G5/G6/E2 sections are rendered; skill catalog prints scope-qualified names', () => {
    expect(md).toContain('## Isolated Nodes (G5)');
    expect(md).toContain('## Skills Without `used_by` (G6)');
    expect(md).toContain('## Same-Name Divergence (E2)');
    expect(md).toContain('`co-a/bar`');
    expect(md).toContain('`co-b/bar`');
    expect(md).toMatch(/`bar` \| skill \| version-drift/);
  });

  test('E1: impact for a bare name expands to every node of that capability', () => {
    const up = upgradeSkillGraph(graph);
    const r = computeImpact(up, 'bar', root);
    expect(r.targets.map((t) => t.id).sort()).toEqual(['skill:co-a/bar', 'skill:co-b/bar']);
    expect(r.agents).toContain('agent:co-a/pm');
    expect(r.agents).toContain('agent:co-b/pm');
    expect(r.variants).toEqual(expect.arrayContaining(['co-a', 'co-b']));
    expect(r.procedures).toContain('procedure.co-a.p1');
    const scoped = computeImpact(up, 'skill:co-b/bar', root);
    expect(scoped.targets).toHaveLength(1);
    expect(scoped.agents).toEqual(['agent:co-b/pm']);
  });

  test('the generator edits no SKILL.md and writes only under docs/', () => {
    for (const [rel, before] of Object.entries(skillFilesBefore)) {
      expect(readFileSync(join(root, rel), 'utf-8')).toBe(before);
    }
    const written = Object.keys(snapshotTree(root)).filter((p) => p.startsWith('/docs/'));
    expect(written.sort()).toEqual(['/docs/skill-graph.json', '/docs/skill-graph.md', '/docs/skill-graph.overrides.json']);
  });
});

describe('parseSkillsUsed (shared parser)', () => {
  test('parses entries and ignores HTML-comment samples', () => {
    const ev = parseSkillsUsed('## Skills Used\n\n<!-- - skill: sample -->\n- skill: real\n  usage: primary\n  outcome: completed\n');
    expect(ev.map((e) => e.skill)).toEqual(['real']);
    expect(ev[0].schemaWarnings).toEqual([]);
  });
});
