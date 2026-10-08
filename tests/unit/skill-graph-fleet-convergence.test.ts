/**
 * Fleet convergence by capability over a mixed v1/v2 fleet (threshold 3 preserved):
 * converged / convergence-with-divergence / hash-unknown classification.
 * Design: docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §3.3.
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { CONVERGENCE_THRESHOLD, classifyConvergence, skillCapabilities } from '../../scripts/skill-graph-fleet-report.ts';
import { upgradeSkillGraph } from '../../scripts/lib/skill-graph-compat.ts';

const v1 = (names: string[]): any => ({
  version: 1,
  nodes: names.map((n) => ({ id: n, type: 'skill', layer: 'L3' })),
  edges: [],
});
const v2 = (entries: Array<[string, string, string?]>): any => ({
  version: 2,
  nodes: entries.map(([name, hash, capability]) => ({
    id: `skill:root/${name}`, type: 'skill', layer: 'L3', name, scope: 'root', content_hash: hash, version: '1.0.0', mirrors: [], ...(capability ? { capability } : {}),
  })),
  edges: [],
});

const caps = (g: any) => skillCapabilities(upgradeSkillGraph(g));

describe('classifyConvergence', () => {
  test('threshold stays at 3 projects', () => {
    expect(CONVERGENCE_THRESHOLD).toBe(3);
    const out = classifyConvergence(new Map([['p1', caps(v2([['a', 'h1']]))], ['p2', caps(v2([['a', 'h1']]))]]));
    expect(out.converged).toEqual([]);
  });

  test('all-v2 with one hash is converged; two hashes is convergence-with-divergence', () => {
    const fleet = new Map([
      ['p1', caps(v2([['same', 'h1'], ['split', 'hA']]))],
      ['p2', caps(v2([['same', 'h1'], ['split', 'hB']]))],
      ['p3', caps(v2([['same', 'h1'], ['split', 'hA']]))],
    ]);
    const out = classifyConvergence(fleet);
    expect(out.converged).toEqual(['same']);
    expect(out.convergenceWithDivergence).toHaveLength(1);
    expect(out.convergenceWithDivergence[0].capability).toBe('split');
    expect(Object.keys(out.convergenceWithDivergence[0].hashes).sort()).toEqual(['hA', 'hB']);
    expect(out.hashUnknown).toEqual([]);
  });

  test('a v1 project (no hashes) makes presence hash-unknown; v1+v2 join on the same capability', () => {
    const fleet = new Map([
      ['p1', caps(v1(['k', 'only-v1']))],
      ['p2', caps(v2([['k', 'h1']]))],
      ['p3', caps(v2([['k', 'h1']]))],
    ]);
    const out = classifyConvergence(fleet);
    expect(out.hashUnknown).toEqual(['k']);
    expect(out.converged).toEqual([]);
  });

  test('a divergence among the known hashes wins over the unknown ones', () => {
    const fleet = new Map([
      ['p1', caps(v1(['k']))],
      ['p2', caps(v2([['k', 'h1']]))],
      ['p3', caps(v2([['k', 'h2']]))],
    ]);
    expect(classifyConvergence(fleet).convergenceWithDivergence.map((d) => d.capability)).toEqual(['k']);
  });

  test('explicit capability groups renamed siblings', () => {
    const fleet = new Map([
      ['p1', caps(v2([['old-name', 'h1', 'shared']]))],
      ['p2', caps(v2([['new-name', 'h1', 'shared']]))],
      ['p3', caps(v2([['third-name', 'h1', 'shared']]))],
    ]);
    expect(classifyConvergence(fleet).converged).toEqual(['shared']);
  });

  test('union of all categories equals plain >=3 presence on an all-v1 fleet (regression shape)', () => {
    const fleet = new Map([
      ['p1', caps(v1(['a', 'b', 'c']))],
      ['p2', caps(v1(['a', 'b']))],
      ['p3', caps(v1(['a', 'b', 'd']))],
      ['p4', caps(v1(['a']))],
    ]);
    const out = classifyConvergence(fleet);
    expect([...out.converged, ...out.hashUnknown, ...out.convergenceWithDivergence.map((d) => d.capability)].sort()).toEqual(['a', 'b']);
  });
});
