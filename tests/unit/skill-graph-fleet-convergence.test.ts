/**
 * Fleet convergence by capability over a mixed v1/v2 fleet (threshold 3 preserved):
 * converged / convergence-with-divergence / hash-unknown classification.
 * Design: docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §3.3.
 *
 * v1.1.0 (2026-11-01, design docs/designs/2026-11-01-hub-consolidation-design.md §9):
 * pins the additive fan-in classification (classifyFanIn2, threshold 2, skills+agents
 * only — scripts are not graph nodes) and hubQualifyingAssets.
 * @version 1.1.0
 */
import { describe, expect, test } from 'bun:test';
import {
  CONVERGENCE_THRESHOLD,
  FAN_IN_THRESHOLD,
  classifyConvergence,
  classifyFanIn2,
  fanInCapabilityKeys,
  hubQualifyingAssets,
  skillCapabilities,
} from '../../scripts/skill-graph-fleet-report.ts';
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
const v2agents = (names: string[]): any => ({
  version: 2,
  nodes: names.map((name) => ({
    id: `agent:root/${name}`, type: 'agent', layer: 'L3', name, scope: 'root', version: '1.0.0',
  })),
  edges: [],
});
const v2phases = (names: string[]): any => ({
  version: 2,
  nodes: names.map((name) => ({
    id: `phase:root/${name}`, type: 'phase', layer: 'L3', name, scope: 'root',
  })),
  edges: [],
});

const caps = (g: any) => skillCapabilities(upgradeSkillGraph(g));
const fanKeys = (g: any) => fanInCapabilityKeys(upgradeSkillGraph(g));

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

// v1.1.0 — fan-in classification (hub-consolidation design §9): the hub-candidacy
// substrate. ADDITIVE to convergence: threshold 2, skills + agents, carriers distinct.
describe('classifyFanIn2 (2026-11-01-hub-consolidation §9)', () => {
  test('threshold is pinned at 2 and stays independent of the convergence threshold', () => {
    expect(FAN_IN_THRESHOLD).toBe(2);
    expect(CONVERGENCE_THRESHOLD).toBe(3);
  });

  test('a capability in 1 project is excluded; in 2 projects it qualifies with sorted carriers', () => {
    const fleet = new Map([
      ['co-b', fanKeys(v2([['shared', 'h1'], ['lonely', 'h1']]))],
      ['co-a', fanKeys(v2([['shared', 'h2']]))],
      ['co-c', fanKeys(v2([['shared', 'h3']]))],
    ]);
    const out = classifyFanIn2(fleet);
    expect(out.threshold).toBe(2);
    expect(out.capabilities).toHaveLength(1);
    expect(out.capabilities[0].capability).toBe('skill:shared');
    expect(out.capabilities[0].fanIn).toBe(3);
    expect(out.capabilities[0].projects).toEqual(['co-a', 'co-b', 'co-c']);
  });

  test('v1 bare ids and v2 scoped ids join on the same skill capability key', () => {
    const fleet = new Map([
      ['v1p', fanKeys(v1(['sync']))],
      ['v2p', fanKeys(v2([['sync', 'h1']]))],
    ]);
    const out = classifyFanIn2(fleet);
    expect(out.capabilities.map((c) => c.capability)).toEqual(['skill:sync']);
    expect(out.capabilities[0].projects).toEqual(['v1p', 'v2p']);
  });

  test('agents count alongside skills under their own key namespace', () => {
    const v1agent = (names: string[]): any => ({
      version: 1,
      nodes: names.map((n) => ({ id: n, type: 'agent', layer: 'L3' })),
      edges: [],
    });
    const fleet = new Map([
      ['p1', fanKeys(v2agents(['docs-writer']))],
      ['p2', fanKeys(v2agents(['docs-writer']))],
      ['p3', fanKeys(v1agent(['docs-writer']))],
    ]);
    const out = classifyFanIn2(fleet);
    expect(out.capabilities).toHaveLength(1);
    expect(out.capabilities[0].capability).toBe('agent:docs-writer');
    expect(out.capabilities[0].fanIn).toBe(3);
    // skill keys and agent keys never collide even for the same name
    const both = new Map([
      ['p1', new Set([...fanKeys(v2([['x', 'h1']])), ...fanKeys(v2agents(['x']))])],
      ['p2', new Set([...fanKeys(v2([['x', 'h1']])), ...fanKeys(v2agents(['x']))])],
    ]);
    expect(classifyFanIn2(both).capabilities.map((c) => c.capability).sort()).toEqual(['agent:x', 'skill:x']);
  });

  test('phases and non-capability nodes never enter the fan-in key set (scripts are not graph nodes)', () => {
    const g = upgradeSkillGraph(v2phases(['setup', 'teardown']));
    expect(fanInCapabilityKeys(g as any).size).toBe(0);
  });

  test('hubQualifyingAssets lists a hub project\'s fan-in-qualifying assets, sorted', () => {
    const fleet = new Map([
      ['co-develop', fanKeys(v2([['merge-xlsx', 'h1'], ['solo', 'h1']]))],
      ['co-design', fanKeys(v2([['merge-xlsx', 'h2'], ['deck-flow', 'h9']]))],
      ['co-security', fanKeys(v2agents(['vuln-triage']))],
      ['co-news', fanKeys(v2agents(['vuln-triage']))],
    ]);
    const out = classifyFanIn2(fleet);
    expect(hubQualifyingAssets('co-develop', out)).toEqual(['skill:merge-xlsx']);
    expect(hubQualifyingAssets('co-security', out)).toEqual(['agent:vuln-triage']);
    expect(hubQualifyingAssets('co-design', out)).toEqual(['skill:merge-xlsx']);
    expect(hubQualifyingAssets('co-nonexistent', out)).toEqual([]);
  });
});
