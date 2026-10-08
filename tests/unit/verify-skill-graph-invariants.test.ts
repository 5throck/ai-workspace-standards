/**
 * Each schema-v2 ERROR invariant of verify-skill-graph.ts fails on a crafted bad graph, and a
 * clean graph passes. Design: docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §6.
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { checkGraphInvariants } from '../../scripts/verify-skill-graph.ts';

const skill = (scope: string, name: string, hash: string | null = `h-${scope}-${name}`): any => ({
  id: `skill:${scope}/${name}`, type: 'skill', layer: scope === 'root' ? 'L0' : `variant:${scope}`, name, scope, capability: name, content_hash: hash, version: '1.0.0', mirrors: [],
});
const agent = (scope: string, name: string): any => ({
  id: `agent:${scope}/${name}`, type: 'agent', layer: `variant:${scope}`, name, scope, capability: name, content_hash: `a-${scope}-${name}`, version: '1.0.0', mirrors: [],
});
const edge = (from: string, to: string, type = 'used_by'): any => ({ from, to, type, source: 't' });

describe('checkGraphInvariants', () => {
  test('clean graph has no errors', () => {
    const r = checkGraphInvariants({
      nodes: [skill('co-a', 'x'), agent('co-a', 'pm'), { id: 'phase:co-a/1', type: 'phase', layer: 'variant:co-a', scope: 'co-a', ordinal: 1 }],
      edges: [edge('skill:co-a/x', 'agent:co-a/pm'), edge('skill:co-a/x', 'phase:co-a/1', 'phase')],
    });
    expect(r.errors).toEqual([]);
  });

  test('1. dangling edge endpoints are errors', () => {
    const r = checkGraphInvariants({ nodes: [skill('co-a', 'x')], edges: [edge('skill:co-a/x', 'agent:co-a/ghost'), edge('skill:co-a/missing', 'skill:co-a/x')] });
    expect(r.errors.filter((e) => e.startsWith('dangling edge'))).toHaveLength(2);
  });

  test('2. duplicate (from,to,type) edges are errors', () => {
    const r = checkGraphInvariants({ nodes: [skill('co-a', 'x'), agent('co-a', 'pm')], edges: [edge('skill:co-a/x', 'agent:co-a/pm'), edge('skill:co-a/x', 'agent:co-a/pm')] });
    expect(r.errors.some((e) => e.startsWith('duplicate edge'))).toBe(true);
  });

  test('3a. duplicate node ids are errors', () => {
    const r = checkGraphInvariants({ nodes: [skill('co-a', 'x'), skill('co-a', 'x')], edges: [] });
    expect(r.errors.some((e) => e.startsWith('duplicate node id'))).toBe(true);
  });

  test('3b. duplicate (name, scope, content_hash) is an error even under different ids', () => {
    const a = skill('co-a', 'x', 'same');
    const b = { ...skill('co-a', 'x', 'same'), id: 'skill:co-a/x-alias' };
    const r = checkGraphInvariants({ nodes: [a, b], edges: [] });
    expect(r.errors.some((e) => e.startsWith('duplicate (name, scope, content_hash)'))).toBe(true);
  });

  test('4. id/attribute mismatch is an error', () => {
    const bad = { ...skill('co-a', 'x'), id: 'skill:co-b/x' };
    const r = checkGraphInvariants({ nodes: [bad], edges: [] });
    expect(r.errors.some((e) => e.startsWith('id/attribute mismatch'))).toBe(true);
    const phaseBad = { id: 'phase:co-a/2', type: 'phase', layer: 'variant:co-a', scope: 'co-a', ordinal: 1 } as any;
    expect(checkGraphInvariants({ nodes: [phaseBad], edges: [] }).errors.some((e) => e.startsWith('id/attribute mismatch'))).toBe(true);
  });

  test('5. two nodes sharing (name, content_hash) = failed collapse', () => {
    const r = checkGraphInvariants({ nodes: [skill('co-a', 'x', 'same'), skill('co-b', 'x', 'same')], edges: [] });
    expect(r.errors.some((e) => e.startsWith('failed collapse'))).toBe(true);
  });

  test('hash-less synthetic nodes do not trip uniqueness; warnings/info are non-blocking', () => {
    const r = checkGraphInvariants({
      nodes: [skill('co-a', 'daily/x', null), skill('co-b', 'daily/x', null), agent('co-a', 'lonely'), { id: 'adr:0001', type: 'adr', layer: 'L0' } as any],
      edges: [],
    });
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes('isolated agent'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('no used_by'))).toBe(true);
    expect(r.info.some((i) => i.includes('isolated adr'))).toBe(true);
  });
});
