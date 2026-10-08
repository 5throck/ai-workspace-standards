#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-08, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md,
//           ADR-0060 Amendment 11): skill-graph v2 identity primitives shared by the generator,
//           verifier, fleet report, graph-delta-log and validate-templates:
//           - loadSkillGraph()/upgradeSkillGraph(): read a v1 OR v2 graph and return a v2 view
//             (scoped ids, capability key, phase nodes, deduped edges) without touching the file.
//           - capabilityOf(): the cross-project grouping key (fleet convergence contract).
//           - contentHash()/normalizeForHash(): metadata-insensitive node content hash.
//           - findCapabilityDivergence(): E2 same-version-different-content detector.
/**
 * skill-graph-compat.ts — v1 -> v2 skill-graph compatibility loader and identity helpers.
 *
 * v2 node identity is `type:scope/name` (skill, agent, phase); `capability` (default: name) is the
 * grouping key that fleet convergence joins on. v1 graphs (bare ids, `layer` only) are upgraded in
 * memory so every reader can assume v2 shape. v1 support is retained for one template minor cycle
 * (ADR-0060 Amendment 11); a follow-up ADR may drop it.
 *
 * Import-safety: no side effects; I/O only inside loadSkillGraph().
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

export interface SkillGraphNodeV2 {
  id: string;
  type: string;
  layer: string;
  name?: string;
  scope?: string;
  capability?: string;
  content_hash?: string | null;
  version?: string | null;
  mirrors?: string[];
  usage?: { sessions: number; last_used: string | null };
  ordinal?: number;
  label?: string;
  inputs?: string[];
  outputs?: string[];
  [key: string]: unknown;
}

export interface SkillGraphEdgeV2 {
  type: string;
  from: string;
  to: string;
  source?: string;
  [key: string]: unknown;
}

export interface SkillGraphV2 {
  version: 2;
  graph_profile?: string;
  nodes: SkillGraphNodeV2[];
  edges: SkillGraphEdgeV2[];
  /** Set (in memory only) when the graph was upgraded from a v1 file. */
  upgradedFrom?: 1;
}

/** Map a node `layer` tag to its v2 scope (`L0`/`L3` -> root, `variant:co-x` -> co-x). */
export function scopeOfLayer(layer: string): string {
  if (layer === 'L0' || layer === 'L3') return 'root';
  if (layer === 'common') return 'common';
  if (layer.startsWith('variant:')) return layer.slice('variant:'.length);
  return 'root';
}

/** Split a v2 id `type:scope/name` -> parts, or null for ids that are not scoped. */
export function splitScopedId(id: string): { type: string; scope: string; name: string } | null {
  const m = id.match(/^(skill|agent|phase):([^/]+)\/(.+)$/);
  return m ? { type: m[1], scope: m[2], name: m[3] } : null;
}

/** Bare name of a skill/agent node (v2 `name`, else parsed from a scoped id, else the v1 bare id). */
export function nameOf(node: Pick<SkillGraphNodeV2, 'id' | 'name'>): string {
  if (typeof node.name === 'string') return node.name;
  return splitScopedId(node.id)?.name ?? node.id;
}

/**
 * Fleet-convergence grouping key. v2 nodes carry `capability` (default = name);
 * v1 nodes have none, so it is derived from the bare id. v1 and v2 graphs therefore
 * join on the same key.
 */
export function capabilityOf(node: Pick<SkillGraphNodeV2, 'id' | 'name' | 'capability'>): string {
  if (typeof node.capability === 'string' && node.capability) return node.capability;
  return nameOf(node);
}

/**
 * Normalize SKILL.md / agent .md content for hashing: CRLF -> LF, drop the frontmatter metadata
 * stamps `version:`, `last_updated:`, `last_reviewed:` and `scope:` (the propagation engine rewrites
 * `scope:` per delivery layer), strip trailing whitespace per line and at EOF. Mirrors that differ
 * only by a metadata stamp therefore collapse to one node.
 */
export function normalizeForHash(content: string): string {
  const lf = content.replace(/\r\n/g, '\n');
  let out = lf;
  const m = lf.match(/^---\n([\s\S]*?)\n---/);
  if (m) {
    const fm = m[1]
      .split('\n')
      .filter((l) => !/^(version|last_updated|last_reviewed|scope)\s*:/.test(l))
      .join('\n');
    out = `---\n${fm}\n---${lf.slice(m[0].length)}`;
  }
  return out
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\s+$/, '');
}

/** sha256 (first 16 hex chars) of the normalized content. */
export function contentHash(content: string): string {
  return createHash('sha256').update(normalizeForHash(content)).digest('hex').slice(0, 16);
}

/** Read the frontmatter `version:` of a markdown file's content as a string, or null. */
export function frontmatterVersion(content: string): string | null {
  const m = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const v = m[1].match(/^version\s*:\s*["']?([^"'\s#]+)/m);
  return v ? v[1] : null;
}

function edgeKey(e: Pick<SkillGraphEdgeV2, 'from' | 'to' | 'type'>): string {
  return `${e.from}\u0000${e.to}\u0000${e.type}`;
}

/** Drop duplicate `(from, to, type)` edges, keeping the first occurrence (G4). */
export function dedupeEdges<T extends Pick<SkillGraphEdgeV2, 'from' | 'to' | 'type'>>(edges: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const e of edges) {
    const k = edgeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}

/**
 * Upgrade an already-parsed graph object to the v2 view. v2 input is returned with edges
 * deduped; v1 input gets scoped ids, `name`/`scope`/`capability`, `content_hash: null`
 * (unknown), materialized phase nodes and deduped edges.
 */
export function upgradeSkillGraph(raw: {
  version?: number;
  graph_profile?: string;
  nodes?: Array<Record<string, any>>;
  edges?: Array<Record<string, any>>;
}): SkillGraphV2 {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  const rawEdges = Array.isArray(raw.edges) ? raw.edges : [];

  if (raw.version === 2) {
    return {
      version: 2,
      graph_profile: raw.graph_profile ?? 'deg/v2',
      nodes: rawNodes as SkillGraphNodeV2[],
      edges: dedupeEdges(rawEdges as SkillGraphEdgeV2[]),
    };
  }

  const idMap = new Map<string, string>();
  const nodeById = new Map<string, SkillGraphNodeV2>();
  const nodes: SkillGraphNodeV2[] = [];

  for (const n of rawNodes) {
    const layer = typeof n.layer === 'string' ? n.layer : 'L0';
    if (n.type === 'skill' || n.type === 'agent') {
      const scope = scopeOfLayer(layer);
      const id = `${n.type}:${scope}/${n.id}`;
      idMap.set(n.id, id);
      const up: SkillGraphNodeV2 = {
        ...n,
        type: n.type,
        layer,
        id,
        name: n.id,
        scope,
        capability: n.id,
        content_hash: null,
        version: null,
        mirrors: [],
      };
      nodes.push(up);
      nodeById.set(id, up);
    } else {
      const copy = { ...n } as SkillGraphNodeV2;
      nodes.push(copy);
      nodeById.set(n.id, copy);
    }
  }

  const phaseNodes = new Map<string, SkillGraphNodeV2>();
  const edges: SkillGraphEdgeV2[] = [];
  for (const e of rawEdges) {
    const from = idMap.get(e.from) ?? e.from;
    let to = idMap.get(e.to) ?? e.to;
    const pm = typeof e.to === 'string' ? e.to.match(/^phase(\d+)$/) : null;
    if (pm && e.type === 'phase') {
      const srcNode = nodeById.get(from);
      const scope = srcNode?.scope ?? 'root';
      to = `phase:${scope}/${pm[1]}`;
      if (!phaseNodes.has(to)) {
        phaseNodes.set(to, {
          id: to,
          type: 'phase',
          layer: srcNode?.layer ?? 'L0',
          scope,
          ordinal: Number(pm[1]),
        });
      }
    }
    edges.push({ ...e, from, to } as SkillGraphEdgeV2);
  }

  const allNodes = [...nodes, ...[...phaseNodes.values()].sort((a, b) => a.id.localeCompare(b.id))];
  return {
    version: 2,
    graph_profile: 'deg/v2',
    nodes: allNodes,
    edges: dedupeEdges(edges),
    upgradedFrom: 1,
  };
}

/** Load a skill-graph JSON file (v1 or v2) as a v2 view; null when absent/unparseable. */
export function loadSkillGraph(path: string): SkillGraphV2 | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    if (!parsed || !Array.isArray(parsed.nodes)) return null;
    return upgradeSkillGraph(parsed);
  } catch {
    return null;
  }
}

export interface DivergenceEntry {
  id: string;
  scope: string;
  version: string | null;
  content_hash: string;
}

export interface CapabilityDivergence {
  capability: string;
  type: 'skill' | 'agent';
  entries: DivergenceEntry[];
  /**
   * `version-drift`: >= 2 entries share a version but differ in content (E2, the dangerous case:
   * the version no longer identifies the content). `divergence`: contents differ and versions
   * differ too (reconciliation candidate, not drift).
   */
  kind: 'version-drift' | 'divergence';
  /** Pairs of entry ids that share a version but not a hash (version-drift only). */
  sameVersionPairs: Array<[string, string]>;
}

/**
 * E2 detector: capabilities whose nodes carry >= 2 distinct content hashes (root/common-only
 * groups excluded, see below). Nodes without a
 * hash (v1 upgrades, synthetic nodes) are ignored — divergence is only computable where hashes
 * exist. Result is sorted by type then capability for deterministic output.
 */
export function findCapabilityDivergence(
  graph: Pick<SkillGraphV2, 'nodes'>,
  types: Array<'skill' | 'agent'> = ['skill', 'agent'],
): CapabilityDivergence[] {
  const groups = new Map<string, { type: 'skill' | 'agent'; capability: string; entries: DivergenceEntry[] }>();
  for (const n of graph.nodes) {
    if ((n.type !== 'skill' && n.type !== 'agent') || !types.includes(n.type)) continue;
    if (typeof n.content_hash !== 'string' || !n.content_hash) continue;
    const cap = capabilityOf(n);
    const key = `${n.type}:${cap}`;
    if (!groups.has(key)) groups.set(key, { type: n.type, capability: cap, entries: [] });
    groups.get(key)!.entries.push({
      id: n.id,
      scope: n.scope ?? scopeOfLayer(n.layer),
      version: n.version ?? null,
      content_hash: n.content_hash,
    });
  }
  const out: CapabilityDivergence[] = [];
  // root and common copies differ by design (the propagation engine scrubs workspace-only text
  // when delivering root -> common), so a root/common pair alone is never divergence.
  const platform = (e: DivergenceEntry): boolean => e.scope === 'root' || e.scope === 'common';
  for (const g of groups.values()) {
    if (new Set(g.entries.map((e) => e.content_hash)).size < 2) continue;
    if (g.entries.every(platform)) continue;
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < g.entries.length; i++) {
      for (let j = i + 1; j < g.entries.length; j++) {
        const a = g.entries[i];
        const b = g.entries[j];
        if (platform(a) && platform(b)) continue;
        if (a.version !== null && a.version === b.version && a.content_hash !== b.content_hash) pairs.push([a.id, b.id]);
      }
    }
    out.push({
      capability: g.capability,
      type: g.type,
      entries: g.entries.sort((a, b) => a.id.localeCompare(b.id)),
      kind: pairs.length > 0 ? 'version-drift' : 'divergence',
      sameVersionPairs: pairs,
    });
  }
  return out.sort((a, b) => a.type.localeCompare(b.type) || a.capability.localeCompare(b.capability));
}
