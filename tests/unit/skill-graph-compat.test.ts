/**
 * Unit tests for scripts/lib/skill-graph-compat.ts (skill-graph v2 compat loader and helpers).
 * Design: docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §5, §11.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  capabilityOf,
  contentHash,
  dedupeEdges,
  findCapabilityDivergence,
  nameOf,
  normalizeForHash,
  scopeOfLayer,
  splitScopedId,
  upgradeSkillGraph,
} from '../../scripts/lib/skill-graph-compat.ts';

const V1 = {
  version: 1,
  graph_profile: 'deg/v1',
  nodes: [
    { id: 'pdf-export', type: 'skill', layer: 'variant:co-deck' },
    { id: 'sync', type: 'skill', layer: 'L0' },
    { id: 'pm', type: 'agent', layer: 'common' },
    { id: 'adr:0001', type: 'adr', layer: 'L0' },
  ],
  edges: [
    { type: 'used_by', from: 'pdf-export', to: 'pm', source: 'skill_manifest' },
    { type: 'used_by', from: 'pdf-export', to: 'pm', source: 'required_skills' },
    { type: 'phase', from: 'pdf-export', to: 'phase3', source: 'skill_manifest' },
    { type: 'phase', from: 'pdf-export', to: 'phase4', source: 'skill_manifest' },
    { type: 'references', from: 'adr:0001', to: 'sync', source: 'prose' },
  ],
};

describe('upgradeSkillGraph (v1 -> v2)', () => {
  const up = upgradeSkillGraph(V1);

  test('scopes skill and agent ids from the layer; other ids untouched', () => {
    const ids = up.nodes.map((n) => n.id);
    expect(ids).toContain('skill:co-deck/pdf-export');
    expect(ids).toContain('skill:root/sync');
    expect(ids).toContain('agent:common/pm');
    expect(ids).toContain('adr:0001');
  });

  test('derives name/scope/capability and unknown hash', () => {
    const n = up.nodes.find((x) => x.id === 'skill:co-deck/pdf-export')!;
    expect(n.name).toBe('pdf-export');
    expect(n.scope).toBe('co-deck');
    expect(capabilityOf(n)).toBe('pdf-export');
    expect(n.content_hash).toBeNull();
    expect(up.upgradedFrom).toBe(1);
    expect(up.version).toBe(2);
  });

  test('rewrites edge endpoints, drops duplicate (from,to,type) edges', () => {
    const usedBy = up.edges.filter((e) => e.type === 'used_by');
    expect(usedBy).toHaveLength(1);
    expect(usedBy[0].from).toBe('skill:co-deck/pdf-export');
    expect(usedBy[0].to).toBe('agent:common/pm');
  });

  test('materializes dangling phase targets as scoped phase nodes', () => {
    const phases = up.nodes.filter((n) => n.type === 'phase').map((n) => n.id).sort();
    expect(phases).toEqual(['phase:co-deck/3', 'phase:co-deck/4']);
    const ids = new Set(up.nodes.map((n) => n.id));
    for (const e of up.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  test('v2 input passes through (edges deduped)', () => {
    const v2 = { version: 2, nodes: up.nodes, edges: [...up.edges, ...up.edges] };
    const again = upgradeSkillGraph(v2);
    expect(again.edges).toHaveLength(up.edges.length);
    expect(again.upgradedFrom).toBeUndefined();
  });
});

describe('identity helpers', () => {
  test('scopeOfLayer', () => {
    expect(scopeOfLayer('L0')).toBe('root');
    expect(scopeOfLayer('L3')).toBe('root');
    expect(scopeOfLayer('common')).toBe('common');
    expect(scopeOfLayer('variant:co-abap')).toBe('co-abap');
  });

  test('splitScopedId / nameOf / capabilityOf handle nested names and v1 bare ids', () => {
    expect(splitScopedId('skill:co-safety/daily/risk-assessment')).toEqual({ type: 'skill', scope: 'co-safety', name: 'daily/risk-assessment' });
    expect(splitScopedId('adr:0001')).toBeNull();
    expect(nameOf({ id: 'skill:root/sync' })).toBe('sync');
    expect(nameOf({ id: 'bare-name' })).toBe('bare-name');
    expect(capabilityOf({ id: 'skill:root/sync', capability: 'lifecycle-sync' })).toBe('lifecycle-sync');
    expect(capabilityOf({ id: 'skill:root/sync' })).toBe('sync');
  });

  test('contentHash ignores version/last_updated/last_reviewed/scope stamps and trailing whitespace', () => {
    const a = '---\nname: x\nversion: 1.0.0\nscope: common\nlast_updated: 2026-01-01\n---\n# Body\ntext  \n';
    const b = '---\nname: x\nversion: 2.3.4\nscope: co-deck\nlast_updated: 2026-09-09\n---\n# Body\ntext\n\n';
    const c = '---\nname: x\nversion: 1.0.0\n---\n# Body\nchanged\n';
    expect(contentHash(a)).toBe(contentHash(b));
    expect(contentHash(a)).not.toBe(contentHash(c));
    expect(normalizeForHash('a\r\nb')).toBe('a\nb');
    expect(contentHash(a)).toHaveLength(16);
  });

  test('dedupeEdges keeps the first of each (from,to,type)', () => {
    const out = dedupeEdges([
      { from: 'a', to: 'b', type: 't', source: 'one' },
      { from: 'a', to: 'b', type: 't', source: 'two' },
      { from: 'a', to: 'b', type: 'u', source: 'three' },
    ]);
    expect(out.map((e) => (e as any).source)).toEqual(['one', 'three']);
  });
});

describe('findCapabilityDivergence (E2)', () => {
  const node = (id: string, scope: string, version: string, hash: string | null, cap?: string) => ({
    id, type: 'skill', layer: scope === 'root' ? 'L0' : `variant:${scope}`, name: id.split('/')[1], scope, version, content_hash: hash, ...(cap ? { capability: cap } : {}),
  });

  test('same version, different hash = version-drift; different versions = divergence', () => {
    const out = findCapabilityDivergence({
      nodes: [
        node('skill:co-a/x', 'co-a', '1.0.0', 'h1'),
        node('skill:co-b/x', 'co-b', '1.0.0', 'h2'),
        node('skill:co-a/pdf', 'co-a', '2.1.1', 'h3'),
        node('skill:co-b/pdf', 'co-b', '1.1.0', 'h4'),
      ],
    });
    expect(out.find((d) => d.capability === 'x')!.kind).toBe('version-drift');
    expect(out.find((d) => d.capability === 'pdf')!.kind).toBe('divergence');
  });

  test('ignores hash-less nodes, identical hashes and root/common-only groups', () => {
    const out = findCapabilityDivergence({
      nodes: [
        node('skill:co-a/y', 'co-a', '1.0.0', null),
        node('skill:co-b/y', 'co-b', '1.0.0', null),
        node('skill:co-a/z', 'co-a', '1.0.0', 'same'),
        node('skill:co-b/z', 'co-b', '1.0.0', 'same'),
        node('skill:root/w', 'root', '1.0.0', 'h1'),
        { ...node('skill:common/w', 'common', '1.0.0', 'h2'), layer: 'common' },
      ],
    });
    expect(out).toHaveLength(0);
  });

  test('capability overrides name for grouping', () => {
    const out = findCapabilityDivergence({
      nodes: [node('skill:co-a/old-name', 'co-a', '1.0.0', 'h1', 'shared'), node('skill:co-b/new-name', 'co-b', '1.0.0', 'h2', 'shared')],
    });
    expect(out).toHaveLength(1);
    expect(out[0].capability).toBe('shared');
  });
});
