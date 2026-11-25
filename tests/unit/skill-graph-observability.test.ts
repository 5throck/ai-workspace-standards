/**
 * Tests for scripts/skill-graph-fleet-report.ts v2.6.0 (design
 * docs/designs/2026-11-23-skill-graph-observability-design.md §5+§13, AC14 +
 * addendum A5/A6) — the skill-graph observability extension:
 * extractAgentGraph (additive snapshot projection, D-A1),
 * diffAgentGraphs (per-date NEW/VANISHED replay over a legacy counts-only
 * snapshot, D-A2), agentBareName/agentKindOf (scope normalization, §5.3),
 * buildAgentRollup (>=3-project convergence, promotion/reconciliation/
 * relationship/split classes, D-A3), serializeSnapshot (indent-2 legacy
 * scalars + compact agentGraph splice), summarizeBackfill +
 * replayGraphHistory/backfillIsFresh/ensureRootBackfill (deterministic bounded
 * root git-history backfill over a fixture repo incl. a v1-schema blob,
 * staleness skip, cap abort, §13), renderHistoryPage (Agents tab, link card,
 * hostile-name escape, determinism) and renderStructurePage (sections, CSP,
 * zero external refs, hostile node id inert, determinism, in-test budget
 * pins). All fixtures are mkdtemp workspaces — no real memory/, tickets/ or
 * git-history dependency.
 */

import { afterAll, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  AGENT_SAMPLE_CAP,
  BACKFILL_MAX_COMMITS,
  AgentGraphProjection,
  agentBareName,
  agentKindOf,
  backfillIsFresh,
  buildAgentRollup,
  buildHistoryModel,
  buildStructureModel,
  diffAgentGraphs,
  ensureRootBackfill,
  escapeHtml,
  extractAgentGraph,
  readGraphContentSha256,
  readGraphHeadSha,
  readHeadSha,
  renderHistoryPage,
  renderStructurePage,
  replayGraphHistory,
  RootBackfillFile,
  serializeSnapshot,
  summarizeBackfill,
  toGitPath,
} from '../../scripts/skill-graph-fleet-report.ts';
import type { SkillGraphV2 } from '../../scripts/lib/skill-graph-compat.ts';

// Hooks (pre-push) run `bun test` with GIT_DIR exported, and every git spawn
// honors GIT_DIR over cwd-based discovery — the fixture repo would silently
// resolve to the workspace repo. Sanitize for the suite's duration
// (git-aware-scan.test.ts convention).
const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY'];
const savedGitEnv = new Map<string, string | undefined>();
for (const key of GIT_ENV_KEYS) {
  savedGitEnv.set(key, process.env[key]);
  delete process.env[key];
}
afterAll(() => {
  for (const [key, value] of savedGitEnv) {
    if (value !== undefined) process.env[key] = value;
  }
});

// ── graph fixtures ──

function node(id: string, type: string, layer: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, type, layer, ...extra };
}

function edge(type: string, from: string, to: string): { type: string; from: string; to: string } {
  return { type, from, to };
}

function graph(nodes: Array<Record<string, unknown>>, edges: Array<{ type: string; from: string; to: string }>): SkillGraphV2 {
  return {
    version: 2,
    graph_profile: 'deg/v2',
    nodes: nodes as SkillGraphV2['nodes'],
    edges: edges as SkillGraphV2['edges'],
  };
}

/** A small project-shaped graph: 2 agents + 2 skills + 1 phase, agent-touching
 *  edges in both directions, one duplicate tuple, one non-agent edge. */
function fixtureProjectGraph(): SkillGraphV2 {
  return graph(
    [
      node('agent:root/architect', 'agent', 'L3', { content_hash: 'aaaa1111' }),
      node('agent:root/code-writer', 'agent', 'L3', { content_hash: 'bbbb2222' }),
      node('skill:root/meeting-facilitation', 'skill', 'L3'),
      node('skill:root/sync', 'skill', 'L3'),
      node('phase:0', 'phase', 'L3'),
    ],
    [
      edge('used_by', 'agent:root/architect', 'skill:root/meeting-facilitation'),
      edge('used_by', 'agent:root/architect', 'skill:root/meeting-facilitation'), // duplicate tuple
      edge('references', 'skill:root/sync', 'agent:root/code-writer'), // agent as TO endpoint
      edge('step_by_agent', 'phase:0', 'agent:root/architect'),
      edge('cites_skill', 'phase:0', 'skill:root/sync'), // non-agent edge: excluded
    ],
  );
}

// ── D-A1: extractAgentGraph ──

describe('extractAgentGraph (additive projection, D-A1)', () => {
  test('agents first in n with hashes; counterpart rows appended with null hash slot', () => {
    const block = extractAgentGraph(fixtureProjectGraph());
    expect(block.n[0]).toEqual(['agent:root/architect', 'aaaa1111']);
    expect(block.n[1]).toEqual(['agent:root/code-writer', 'bbbb2222']);
    const counterpartIds = block.n.slice(2).map(([id]) => id);
    expect(counterpartIds.sort()).toEqual(['phase:0', 'skill:root/meeting-facilitation', 'skill:root/sync']);
    for (const [, hash] of block.n.slice(2)) expect(hash).toBeNull();
    // every agent row keeps its hash; agents are exactly the `agent:`-prefixed rows
    expect(block.n.filter(([id]) => id.startsWith('agent:')).length).toBe(2);
  });

  test('edge tuples dedupe, keep both directions, exclude non-agent edges, index into n/t', () => {
    const block = extractAgentGraph(fixtureProjectGraph());
    expect(block.e.length).toBe(3); // duplicate tuple collapsed; cites_skill excluded
    const resolved = block.e.map(([ai, oi, ti]) => [block.n[ai]![0], block.n[oi]![0], block.t[ti]]);
    expect(resolved).toContainEqual(['agent:root/architect', 'skill:root/meeting-facilitation', 'used_by']);
    expect(resolved).toContainEqual(['agent:root/code-writer', 'skill:root/sync', 'references']);
    expect(resolved).toContainEqual(['agent:root/architect', 'phase:0', 'step_by_agent']);
  });

  test('a graph with zero agents yields the empty block (uniform shape)', () => {
    const block = extractAgentGraph(graph([node('skill:root/x', 'skill', 'L3')], [edge('composes_with', 'skill:root/x', 'skill:root/x')]));
    expect(block).toEqual({ n: [], t: [], e: [] });
  });

  test('a v1-shaped node without content_hash carries the null hash slot', () => {
    const block = extractAgentGraph(graph([node('agent:root/x', 'agent', 'L3')], []));
    expect(block.n).toEqual([['agent:root/x', null]]);
  });
});

// ── serializeSnapshot (AC2: indent-2 legacy scalars, compact agentGraph splice) ──

describe('serializeSnapshot (AC2 additive-only write)', () => {
  test('pre-existing scalars serialize at indent 2; agentGraph splices in compactly; round-trips', () => {
    const block = extractAgentGraph(fixtureProjectGraph());
    const snapshot = {
      date: '2026-11-23',
      projects: { 'co-a': { nodes: 5, edges: 6, skills: 2, agentGraph: block } },
      fleetPresence: {},
      missingFromProjects: {},
      jaccard: {},
    };
    const text = serializeSnapshot(snapshot as never);
    const parsed = JSON.parse(text);
    expect(parsed.projects['co-a'].nodes).toBe(5);
    expect(parsed.projects['co-a'].agentGraph.e.length).toBe(3);
    // the spliced block is one compact line (no nested indent inflation)
    expect(text).toContain('"agentGraph": {"n":');
    expect(text.split('\n').some((line) => line.includes('"nodes": 5'))).toBe(true);
    // scalar-only entry stays untouched
    const scalarOnly = serializeSnapshot({
      ...snapshot,
      projects: { 'co-a': { nodes: 1, edges: 2, skills: 3 } },
    } as never);
    expect(JSON.parse(scalarOnly).projects['co-a']).toEqual({ nodes: 1, edges: 2, skills: 3 });
  });
});

// ── §5.3 normalization ──

describe('agentBareName / agentKindOf (scope normalization §5.3)', () => {
  test('project-graph ids that keep the original scope normalize to the bare name', () => {
    expect(agentBareName('agent:root/architect')).toBe('architect');
    expect(agentBareName('agent:common/k-dart')).toBe('k-dart');
    expect(agentBareName('agent:co-abap/co-analyst')).toBe('co-analyst');
    expect(agentBareName('skill:root/meeting-facilitation')).toBe('meeting-facilitation');
    expect(agentBareName('no-scope-name')).toBe('no-scope-name');
    expect(agentKindOf('agent:root/x')).toBe('agent');
    expect(agentKindOf('skill:root/x')).toBe('skill');
    expect(agentKindOf('phase:0')).toBe('phase');
    expect(agentKindOf('plain')).toBe('');
  });
});

// ── D-A2: diffAgentGraphs ──

function projBlock(agents: Array<[string, string | null]>, tuples: Array<[string, string, string]>): AgentGraphProjection {
  const t = [...new Set(tuples.map(([, , type]) => type))];
  const ids = new Map<string, number>();
  const n: Array<[string, string | null]> = [];
  for (const [id, hash] of agents) {
    ids.set(id, n.length);
    n.push([id, hash]);
  }
  const extras = new Map<string, number>();
  const e: Array<[number, number, number]> = tuples.map(([agentId, otherId, type]) => {
    if (!ids.has(agentId)) {
      ids.set(agentId, n.length);
      n.push([agentId, null]);
    }
    if (!ids.has(otherId) && !extras.has(otherId)) {
      extras.set(otherId, n.length);
      n.push([otherId, null]);
    }
    return [ids.get(agentId)!, (ids.get(otherId) ?? extras.get(otherId))!, t.indexOf(type)];
  });
  return { n, t, e };
}

describe('diffAgentGraphs (per-date replay, D-A2 + AC1 legacy tolerance)', () => {
  test('NEW/VANISHED agent ids and per-edge-type summaries with samples capped and sorted', () => {
    const prev = { 'co-a': projBlock([['agent:root/a', 'h1'], ['agent:root/b', 'h2']], [['agent:root/a', 'skill:root/s1', 'used_by']]) };
    const cur = {
      'co-a': projBlock(
        [['agent:root/a', 'h1'], ['agent:root/c', 'h3']],
        [['agent:root/c', 'skill:root/s2', 'references']], // the used_by tuple vanished
      ),
      'co-b': projBlock([['agent:root/c', 'h3']], [['agent:root/c', 'phase:9', 'step_by_agent']]),
    };
    const diff = diffAgentGraphs(prev, cur);
    expect(diff.agentNodes.added).toEqual(['agent:root/c']);
    expect(diff.agentNodes.removed).toEqual(['agent:root/b']);
    expect(diff.agentEdges.added.map((s) => s.type)).toEqual(['references', 'step_by_agent']);
    expect(diff.agentEdges.added[0]?.count).toBe(1);
    expect(diff.agentEdges.added[0]?.sample[0]).toEqual(['agent:root/c', 'skill:root/s2', 'co-a']);
    expect(diff.agentEdges.removed.map((s) => s.type)).toEqual(['used_by']);
  });

  test('a legacy (counts-only) previous side diffs against the empty set: the honest full baseline', () => {
    const cur = { 'co-a': projBlock([['agent:root/a', 'h1']], [['agent:root/a', 'skill:root/s', 'used_by']]) };
    const diff = diffAgentGraphs({}, cur);
    expect(diff.agentNodes.added).toEqual(['agent:root/a']);
    expect(diff.agentEdges.added[0]?.type).toBe('used_by');
    const back = diffAgentGraphs(cur, {});
    expect(back.agentNodes.removed).toEqual(['agent:root/a']);
  });

  test('sample cap: only AGENT_SAMPLE_CAP tuples listed, count reflects the truth', () => {
    const tuples: Array<[string, string, string]> = Array.from({ length: AGENT_SAMPLE_CAP + 5 }, (_, i) => [
      `agent:root/a${i}`,
      'skill:root/s',
      'used_by',
    ] as [string, string, string]);
    const cur = { 'co-a': projBlock(tuples.map(([a]) => [a, 'h'] as [string, string]), tuples) };
    const diff = diffAgentGraphs({}, cur);
    expect(diff.agentEdges.added[0]?.count).toBe(AGENT_SAMPLE_CAP + 5);
    expect(diff.agentEdges.added[0]?.sample.length).toBe(AGENT_SAMPLE_CAP);
  });
});

// ── D-A3: buildAgentRollup ──

function rollupRoot(): SkillGraphV2 {
  return graph(
    [
      node('agent:root/architect', 'agent', 'L0', { content_hash: 'r1' }),
      node('skill:root/meeting-facilitation', 'skill', 'L0'),
      node('skill:root/sync', 'skill', 'L0'),
    ],
    [edge('used_by', 'agent:root/architect', 'skill:root/meeting-facilitation')],
  );
}

describe('buildAgentRollup (D-A3 convergence rollup, threshold 3)', () => {
  test('promotion: single hash in >=3 projects, absent from root', () => {
    const blocks = {
      'co-a': projBlock([['agent:root/newbot', 'hh1']], []),
      'co-b': projBlock([['agent:root/newbot', 'hh1']], []),
      'co-c': projBlock([['agent:root/newbot', 'hh1']], []),
    };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.promotions).toEqual([{ name: 'newbot', hash: 'hh1', projects: ['co-a', 'co-b', 'co-c'] }]);
    expect(rollup.totals.promotions).toBe(1);
  });

  test('a name that also exists in the root graph is NOT a promotion candidate', () => {
    const blocks = {
      'co-a': projBlock([['agent:root/architect', 'zz9']], []),
      'co-b': projBlock([['agent:root/architect', 'zz9']], []),
      'co-c': projBlock([['agent:root/architect', 'zz9']], []),
    };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.promotions).toEqual([]);
  });

  test('reconciliation: >=2 hashes across >=3 carriers, never auto-promoted', () => {
    const blocks = {
      'co-a': projBlock([['agent:root/split', 'hA']], []),
      'co-b': projBlock([['agent:root/split', 'hA']], []),
      'co-c': projBlock([['agent:root/split', 'hB']], []),
    };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.reconciliations[0]?.name).toBe('split');
    expect(rollup.reconciliations[0]?.hashes).toEqual({ hA: ['co-a', 'co-b'], hB: ['co-c'] });
  });

  test('hash-unknown: null hashes surface the analytics third class, not a promotion', () => {
    const blocks = {
      'co-a': projBlock([['agent:root/v1agent', null]], []),
      'co-b': projBlock([['agent:root/v1agent', null]], []),
      'co-c': projBlock([['agent:root/v1agent', null]], []),
    };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.promotions).toEqual([]);
    expect(rollup.hashUnknown).toEqual(['v1agent']);
  });

  test('relationship convergence: >=3 carriers, no root counterpart -> candidate; root counterpart suppresses', () => {
    const newRel = (project: string): AgentGraphProjection =>
      projBlock([['agent:root/auditor', 'h']], [['agent:root/auditor', 'skill:root/sync', 'accountable_for']]);
    const blocks = { 'co-a': newRel('co-a'), 'co-b': newRel('co-b'), 'co-c': newRel('co-c') };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.relationships).toEqual([
      { agent: 'auditor', kind: 'skill', endpoint: 'sync', edgeType: 'accountable_for', projects: ['co-a', 'co-b', 'co-c'] },
    ]);
    // same tuple but the ROOT graph carries it -> suppressed
    const rootWithCounterpart = graph(
      rollupRoot().nodes.concat([node('agent:root/auditor', 'agent', 'L0', { content_hash: 'r2' })]),
      rollupRoot().edges.concat([edge('accountable_for', 'agent:root/auditor', 'skill:root/sync')]),
    );
    expect(buildAgentRollup(blocks, rootWithCounterpart).relationships).toEqual([]);
  });

  test('edge-type splits: same pair under >=2 types across >=2 projects', () => {
    const blocks = {
      'co-a': projBlock([['agent:root/planner', 'h']], [['agent:root/planner', 'skill:root/sync', 'used_by']]),
      'co-b': projBlock([['agent:root/planner', 'h']], [['agent:root/planner', 'skill:root/sync', 'references']]),
    };
    const rollup = buildAgentRollup(blocks, rollupRoot());
    expect(rollup.splits.length).toBe(1);
    expect(Object.keys(rollup.splits[0]?.types ?? {}).sort()).toEqual(['references', 'used_by']);
  });

  test('sub-threshold carriers are ignored; ROLLUP_CAP bounds listed rows with honest totals', () => {
    const blocks: Record<string, AgentGraphProjection> = {};
    for (let i = 0; i < 2; i++) blocks[`co-${i}`] = projBlock([['agent:root/rare', 'h']], []);
    expect(buildAgentRollup(blocks, rollupRoot()).promotions).toEqual([]);
    const many: Record<string, AgentGraphProjection> = {};
    for (let i = 0; i < 45; i++) {
      for (const p of ['co-a', 'co-b', 'co-c']) {
        const name = `agent:root/promo${i}`;
        (many[p] ??= projBlock([], [])).n.push([name, `h${i}`]);
      }
    }
    const rollup = buildAgentRollup(many, rollupRoot());
    expect(rollup.promotions.length).toBeLessThanOrEqual(40);
    expect(rollup.totals.promotions).toBe(45);
  });
});

// ── buildHistoryModel: agent replay + legacy tolerance + backfill summary ──

function snapFixture(date: string, blocks?: Record<string, AgentGraphProjection>): Record<string, unknown> {
  const projects: Record<string, unknown> = {};
  for (const [name, block] of Object.entries(blocks ?? {})) {
    projects[name] = { nodes: 5, edges: 6, skills: 2, agentGraph: block };
  }
  return {
    date,
    projects,
    fleetPresence: { 'skill:x': 1 },
    missingFromProjects: {},
    jaccard: {},
    convergence: { threshold: 3, converged: [], convergenceWithDivergence: [], hashUnknown: [] },
  };
}

const FLEET = { count: 3, members: ['co-a', 'co-b'], transientAbsent: [] };

describe('buildHistoryModel agent replay (AC1: tracking-begins, legacy rows null)', () => {
  test('legacy rows carry agents:null; the first agentGraph row establishes tracking; diffs replay pairwise', () => {
    const legacy = snapFixture('2026-11-20') as never; // counts-only projects
    const s1 = snapFixture('2026-11-22', { 'co-a': projBlock([['agent:root/a', 'h']], [['agent:root/a', 'skill:root/s', 'used_by']]) }) as never;
    const s2 = snapFixture('2026-11-23', {
      'co-a': projBlock([['agent:root/a', 'h'], ['agent:root/b', 'h']], [['agent:root/a', 'skill:root/s', 'used_by'], ['agent:root/b', 'skill:root/s', 'references']]),
    }) as never;
    const model = buildHistoryModel([legacy, s1, s2] as never[], FLEET as never, [], {});
    expect(model.agentTrackingBegins).toBe('2026-11-22');
    expect(model.series[0]?.agents).toBeNull();
    // first agentGraph row: full baseline (everything NEW vs the legacy side)
    expect(model.series[1]?.agents?.agentNodes.added).toEqual(['agent:root/a']);
    expect(model.series[1]?.agents?.agentEdges.added[0]?.type).toBe('used_by');
    // second row: real pairwise diff
    expect(model.series[2]?.agents?.agentNodes.added).toEqual(['agent:root/b']);
    expect(model.series[2]?.agents?.agentEdges.added.map((x) => x.type)).toEqual(['references']);
    // agentsLatest derives from the latest snapshot
    expect(model.agentsLatest?.perProject['co-a']).toBe(2);
    expect(model.agentsLatest?.relationshipByType).toEqual({ references: 1, used_by: 1 });
  });

  test('an all-legacy corpus: agentTrackingBegins null, no fabricated dates', () => {
    const model = buildHistoryModel([snapFixture('2026-11-01') as never, snapFixture('2026-11-02') as never], FLEET as never, [], {});
    expect(model.agentTrackingBegins).toBeNull();
    expect(model.agentsLatest).toBeNull();
    expect(model.series.every((r) => r.agents === null)).toBe(true);
  });

  test('summarizeBackfill: rows condensed with bare-name NEW/VANISHED diffs (schema-crossing)', () => {
    const file: RootBackfillFile = {
      provenance: 'git-backfill',
      graphHeadSha: 'a'.repeat(40),
      path: 'docs/skill-graph.json',
      rows: [
        { date: '2026-08-24', commitCount: 2, schema: 1, agents: projBlock([['agent:root/old', 'h']], [['agent:root/old', 'skill:root/s', 'used_by']]) },
        { date: '2026-08-25', commitCount: 1, schema: 2, agents: projBlock([['agent:root/new', 'h']], []) },
      ],
    };
    const summary = summarizeBackfill(file);
    expect(summary?.rows.length).toBe(2);
    expect(summary?.rows[0]).toMatchObject({ date: '2026-08-24', commitCount: 2, schema: 1, agents: 1, edges: 1 });
    // v1 -> v2 crossing uses bare-name normalization only (§13.3)
    expect(summary?.rows[1]?.newAgents).toEqual(['new']);
    expect(summary?.rows[1]?.removedAgents).toEqual(['old']);
    expect(summarizeBackfill(null)).toBeNull();
    expect(summarizeBackfill({ ...file, rows: [] })).toBeNull(); // empty corpus -> honest note, not an empty table
  });
});

// ── renderHistoryPage: Agents tab, link card, hostile fixtures, determinism ──

describe('renderHistoryPage v2.6.0 (Agents tab + link card + safety)', () => {
  const rollup = buildAgentRollup(
    {
      'co-a': projBlock([['agent:root/newbot', 'hh1']], [['agent:root/newbot', 'skill:root/sync', 'used_by']]),
      'co-b': projBlock([['agent:root/newbot', 'hh1']], []),
      'co-c': projBlock([['agent:root/newbot', 'hh1']], []),
    },
    rollupRoot(),
  );
  const backfill: RootBackfillFile = {
    provenance: 'git-backfill',
    graphHeadSha: 'b'.repeat(40),
    path: 'docs/skill-graph.json',
    rows: [
      { date: '2026-08-24', commitCount: 3, schema: 1, agents: projBlock([['agent:root/old', 'h']], []) },
      { date: '2026-08-25', commitCount: 1, schema: 2, agents: projBlock([['agent:root/old', 'h'], ['agent:root/new', 'h']], []) },
    ],
  };

  function pageOf(snapshots: never[], extras: { rollup?: unknown; backfill?: unknown } = {}): string {
    return renderHistoryPage(buildHistoryModel(snapshots, FLEET as never, [], extras as never));
  }

  test('sixth tab renders: nav button, tracking-begins note, backfill provenance marker, rollup callout', () => {
    const page = pageOf(
      [
        snapFixture('2026-11-20') as never,
        snapFixture('2026-11-22', { 'co-a': projBlock([['agent:root/newbot', 'hh1']], [['agent:root/newbot', 'skill:root/sync', 'used_by']]) }) as never,
      ],
      { rollup, backfill },
    );
    expect(page).toContain('data-tab="agents"');
    expect(page).toContain('id="tab-agents"');
    expect(page).toContain('"agentTrackingBegins":"2026-11-22"');
    expect(page).toContain('backfilled from git history');
    expect(page).toContain('"backfill":{"graphHeadSha":"' + 'b'.repeat(40) + '"');
    expect(page).toContain('"rollup":{"threshold":3');
    expect(page).toContain('"promotions":[{"name":"newbot"');
    // relationship feed + the server-computed relative snapshot link (AC1)
    expect(page).toContain('Newest relationship changes');
    expect(page).toContain('"snapshotHref":"../memory/skill-graph-metrics/snapshot-2026-11-22.json"');
    // structure-page link card (AC12)
    expect(page).toContain('href="skill-graph-structure.html"');
  });

  test('no-rollup/no-backfill callouts render honest negatives (no fabricated data)', () => {
    const page = pageOf([snapFixture('2026-01-01') as never]);
    expect(page).toContain('No backfilled root history available');
    expect(page).toContain('"rollup":null');
    expect(page).toContain('"agentTrackingBegins":null');
  });

  test('hostile agent ids in agentGraph render inert (escaped in the data block)', () => {
    const hostile = projBlock([['<img src=x onerror=alert(1)>', 'h']], [
      ['<img src=x onerror=alert(1)>', '<script>alert(2)</script>', 'used_by'],
    ]);
    const page = pageOf([snapFixture('2026-01-01', { 'co-a': hostile }) as never], { rollup, backfill });
    expect(page).not.toContain('<img');
    expect(page).toContain('\\u003cimg src=x onerror=alert(1)>');
    expect(page).toContain('\\u003cscript>alert(2)\\u003c/script>');
  });

  test('snapshot href guard: a hostile date never becomes an href (regex-guarded server side)', () => {
    const hostileDate = snapFixture('"><script src=x>' as never) as never;
    const page = pageOf([hostileDate]);
    expect(page).not.toContain('"><script src=x>');
    expect(page).toContain('"snapshotHref":null'); // guard nulls the href instead
  });

  test('determinism: two renders of identical inputs are byte-identical (AC13)', () => {
    const snapshots = [
      snapFixture('2026-11-20') as never,
      snapFixture('2026-11-22', { 'co-a': projBlock([['agent:root/a', 'h']], []) }) as never,
    ];
    expect(pageOf(snapshots, { rollup, backfill }) === pageOf(snapshots, { rollup, backfill })).toBe(true);
  });

  test('in-test budget pin: the fixture page stays under the 300 KB history budget', () => {
    const page = pageOf(
      [
        snapFixture('2026-11-20') as never,
        snapFixture('2026-11-22', { 'co-a': projBlock([['agent:root/newbot', 'hh1']], [['agent:root/newbot', 'skill:root/sync', 'used_by']]) }) as never,
      ],
      { rollup, backfill },
    );
    expect(Buffer.byteLength(page, 'utf8')).toBeLessThanOrEqual(300 * 1024);
  });
});

// ── §13: root git-history backfill (fixture repo) ──

describe('root git-history backfill (§13.2-§13.3, AC-A2/A3/A5/A6)', () => {
  // v1-schema blob: ids are BARE NAMES without the kind prefix (the v1
  // convention) — the compat upgrader scopes them to `agent:root/legacy` /
  // `skill:root/legacy-skill` (ADR-0060), with content_hash null (§13.3
  // best-effort extraction: cross-schema rows diff on bare names only).
  const V1_GRAPH = JSON.stringify({
    nodes: [
      { id: 'legacy', type: 'agent', layer: 'L0' },
      { id: 'legacy-skill', type: 'skill', layer: 'L0' },
    ],
    edges: [{ type: 'used_by', from: 'legacy', to: 'legacy-skill' }],
  });
  const V2_GRAPH = JSON.stringify({
    version: 2,
    nodes: [
      { id: 'agent:root/legacy', type: 'agent', layer: 'L0', content_hash: 'aa11' },
      { id: 'skill:root/legacy-skill', type: 'skill', layer: 'L0' },
    ],
    edges: [{ type: 'used_by', from: 'agent:root/legacy', to: 'skill:root/legacy-skill' }],
  });
  const V2_GRAPH_2 = JSON.stringify({
    version: 2,
    nodes: [
      { id: 'agent:root/legacy', type: 'agent', layer: 'L0', content_hash: 'aa11' },
      { id: 'agent:root/second', type: 'agent', layer: 'L0', content_hash: 'bb22' },
      { id: 'skill:root/legacy-skill', type: 'skill', layer: 'L0' },
    ],
    edges: [{ type: 'used_by', from: 'agent:root/legacy', to: 'skill:root/legacy-skill' }],
  });

  // Windows CI regression (PR #2164): git pathspecs are always POSIX-shaped —
  // `path.join('docs', 'skill-graph.json')` yields `docs\skill-graph.json` on
  // Windows, which git cannot resolve in `-- <pathspec>` or `<rev>:<path>`.
  test('toGitPath: every git operand is POSIX-shaped on any OS', () => {
    expect(toGitPath('docs\\skill-graph.json')).toBe('docs/skill-graph.json');
    expect(toGitPath(join('docs', 'skill-graph.json'))).toBe('docs/skill-graph.json');
    expect(toGitPath('docs/skill-graph.json')).toBe('docs/skill-graph.json'); // idempotent
    expect(toGitPath('a\\\\b/c')).toBe('a/b/c'); // mixed + doubled separators
    expect(toGitPath('skill-graph.json')).toBe('skill-graph.json'); // no separator
  });

  /** Fixture repo: 4 commits over docs/skill-graph.json — two on one date
   *  (collapse check), one v1-schema blob (schema drift), one growth blob. */
  function fixtureRepo(): string {
    const repo = mkdtempSync(join(tmpdir(), 'sgfr-backfill-'));
    const git = (args: Array<string>, env: Record<string, string> = {}): void => {
      const res = spawnSync('git', ['-C', repo, ...args], {
        encoding: 'utf8',
        env: { ...process.env, ...env },
      });
      if (res.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${res.stderr}`);
    };
    writeFileSync(join(repo, 'docsagg'), '');
    rmSync(join(repo, 'docsagg'));
    mkdirSync(join(repo, 'docs'));
    git(['init', '-q']);
    git(['config', 'user.email', 'fixture@test']);
    git(['config', 'user.name', 'fixture']);
    writeFileSync(join(repo, 'docs', 'skill-graph.json'), V1_GRAPH);
    git(['add', '.']);
    git(['commit', '-qm', 'v1 birth'], { GIT_COMMITTER_DATE: '2026-08-24 09:00:00 +0900', GIT_AUTHOR_DATE: '2026-08-24 09:00:00 +0900' });
    writeFileSync(join(repo, 'docs', 'skill-graph.json'), V2_GRAPH);
    git(['add', '.']);
    git(['commit', '-qm', 'v2 same day'], { GIT_COMMITTER_DATE: '2026-08-24 15:00:00 +0900', GIT_AUTHOR_DATE: '2026-08-24 15:00:00 +0900' });
    writeFileSync(join(repo, 'docs', 'skill-graph.json'), V2_GRAPH_2);
    git(['add', '.']);
    git(['commit', '-qm', 'second agent'], { GIT_COMMITTER_DATE: '2026-08-25 10:00:00 +0900', GIT_AUTHOR_DATE: '2026-08-25 10:00:00 +0900' });
    // an unrelated later commit (HEAD moves without touching the graph)
    writeFileSync(join(repo, 'README.md'), 'x');
    git(['add', '.']);
    git(['commit', '-qm', 'unrelated'], { GIT_COMMITTER_DATE: '2026-08-26 10:00:00 +0900', GIT_AUTHOR_DATE: '2026-08-26 10:00:00 +0900' });
    return repo;
  }

  test('replayGraphHistory: commit-granularity rows, same-day collapse, v1 schema recorded', async () => {
    const repo = fixtureRepo();
    try {
      const rows = await replayGraphHistory(repo, join('docs', 'skill-graph.json'));
      expect(rows.map((r) => r.date)).toEqual(['2026-08-24', '2026-08-25']);
      expect(rows[0]?.commitCount).toBe(2); // two same-day commits collapse, newest wins
      expect(rows[0]?.schema).toBe(1); // v1 blob (no version field -> 1)
      expect(rows[0]?.agents.n[0]).toEqual(['agent:root/legacy', null]); // upgraded id, hash unknown
      expect(rows[0]?.agents.n.filter(([id]) => id.startsWith('agent:')).length).toBe(1);
      expect(rows[0]?.agents.e.length).toBe(1);
      expect(rows[1]?.schema).toBe(2);
      expect(rows[1]?.agents.n.filter(([id]) => id.startsWith('agent:')).length).toBe(2);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('replayGraphHistory: a backslash-shaped (Windows-native) relPath still reaches git', async () => {
    const repo = fixtureRepo();
    try {
      // Literal backslash so this asserts on macOS/Linux too — the helper, not
      // the host OS, must produce the POSIX operand git needs.
      const rows = await replayGraphHistory(repo, 'docs\\skill-graph.json');
      expect(rows.map((r) => r.date)).toEqual(['2026-08-24', '2026-08-25']);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('cap abort: exceeding maxCommits throws (the island turns it into a WARN)', async () => {
    const repo = fixtureRepo();
    try {
      await expect(replayGraphHistory(repo, join('docs', 'skill-graph.json'), { maxCommits: 2 })).rejects.toThrow(/cap exceeded/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('BACKFILL_MAX_COMMITS is the documented 1000-commit safety cap', () => {
    expect(BACKFILL_MAX_COMMITS).toBe(1000);
  });

  /** Commit one file in the fixture repo (advances HEAD without touching the
   *  graph, or with `graph: true` it rewrites docs/skill-graph.json). */
  function commitFile(repo: string, name: string, body: string, graph = false): void {
    if (graph) writeFileSync(join(repo, 'docs', 'skill-graph.json'), body);
    else writeFileSync(join(repo, name), body);
    const res = spawnSync('git', ['-C', repo, 'add', '.'], { encoding: 'utf8' });
    if (res.status !== 0) throw new Error(res.stderr);
    const commit = spawnSync('git', ['-C', repo, 'commit', '-qm', name], {
      encoding: 'utf8',
      env: { ...process.env, GIT_COMMITTER_DATE: '2026-08-27 10:00:00 +0900', GIT_AUTHOR_DATE: '2026-08-27 10:00:00 +0900' },
    });
    if (commit.status !== 0) throw new Error(commit.stderr);
  }

  test('readGraphHeadSha + backfillIsFresh: stale/missing/malformed states never read as fresh', async () => {
    const repo = fixtureRepo();
    try {
      const graphHead = readGraphHeadSha(repo, join('docs', 'skill-graph.json'));
      expect(graphHead).toMatch(/^[0-9a-f]{40}$/);
      // v2.6.2: the key is the graph commit, which is NOT the repo HEAD here
      // (the fixture ends with an unrelated README commit).
      expect(graphHead).not.toBe(readHeadSha(repo));
      expect(backfillIsFresh({ graphHeadSha: graphHead! }, graphHead)).toBe(true);
      expect(backfillIsFresh({ graphHeadSha: '0'.repeat(40) }, graphHead)).toBe(false);
      expect(backfillIsFresh(null, graphHead)).toBe(false);
      expect(backfillIsFresh({ graphHeadSha: graphHead! }, null)).toBe(false);
      expect(backfillIsFresh(undefined, graphHead)).toBe(false);
      // a legacy file (headSha only) has no graphHeadSha -> never fresh
      expect(backfillIsFresh({ headSha: graphHead! } as never, graphHead)).toBe(false);
      expect(readGraphHeadSha(repo, 'docs/does-not-exist.json')).toBeNull();
      expect(readHeadSha(mkdtempSync(join(tmpdir(), 'sgfr-nonrepo-')))).toBeNull();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('readGraphContentSha256 hashes the blob at the commit and nulls on a bad read', async () => {
    const repo = fixtureRepo();
    try {
      const graphHead = readGraphHeadSha(repo, join('docs', 'skill-graph.json'));
      const digest = readGraphContentSha256(repo, join('docs', 'skill-graph.json'), graphHead!);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(readGraphContentSha256(repo, join('docs', 'skill-graph.json'), 'f'.repeat(40))).toBeNull();
      // the same bytes at the same commit hash the same on a second read
      expect(readGraphContentSha256(repo, join('docs', 'skill-graph.json'), graphHead!)).toBe(digest);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test('ensureRootBackfill: writes the file; a fresh graphHeadSha skips the rebuild (sentinel proves it)', async () => {
    const repo = fixtureRepo();
    const dir = mkdtempSync(join(tmpdir(), 'sgfr-ensure-'));
    const target = join(dir, 'root-backfill.json');
    try {
      const first = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(first.rebuilt).toBe(true);
      expect(first.file.provenance).toBe('git-backfill');
      expect(first.file.graphHeadSha).toBe(readGraphHeadSha(repo, join('docs', 'skill-graph.json')));
      expect(existsSync(target)).toBe(true);
      // deterministic content at the same graph commit (AC-A2): byte-identical bytes
      const bytes = readFileSync(target, 'utf-8');
      const second = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(second.rebuilt).toBe(false); // graphHeadSha match -> skip
      expect(second.file).toEqual(first.file);
      // a sentinel in the file survives a fresh-skip (no rebuild clobbered it)
      const tampered = JSON.parse(bytes) as { rows: Array<Record<string, unknown>> };
      tampered.rows.push({ date: '9999-01-01', commitCount: 1, schema: 2, agents: { n: [], t: [], e: [] } });
      writeFileSync(target, JSON.stringify(tampered));
      const third = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(third.rebuilt).toBe(false);
      expect(third.file.rows.some((r) => r.date === '9999-01-01')).toBe(true);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ensureRootBackfill rebuilds when the GRAPH commit advanced (staleness path)', async () => {
    const repo = fixtureRepo();
    const dir = mkdtempSync(join(tmpdir(), 'sgfr-stale-'));
    const target = join(dir, 'root-backfill.json');
    try {
      const first = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      // v2.7.0: a stale graphHeadSha over EQUAL content is fresh (the content key)
      const sameContent = { ...first.file, graphHeadSha: '1'.repeat(40) };
      writeFileSync(target, JSON.stringify(sameContent));
      const untouched = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(untouched.rebuilt).toBe(false);
      // a stale graphContentSha256 -> the next call must replay
      const stale = { ...first.file, graphContentSha256: '1'.repeat(64) };
      writeFileSync(target, JSON.stringify(stale));
      const second = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(second.rebuilt).toBe(true);
      expect(second.file.graphHeadSha).toBe(readGraphHeadSha(repo, join('docs', 'skill-graph.json')));
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  // ── v2.6.2 regression: the fixed-point proof (loop #2162 → #2164 → #2165) ──
  test('REGRESSION: an unrelated commit advancing HEAD does NOT invalidate the backfill', async () => {
    const repo = fixtureRepo();
    const dir = mkdtempSync(join(tmpdir(), 'sgfr-fixedpoint-'));
    const target = join(dir, 'root-backfill.json');
    try {
      const first = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(first.rebuilt).toBe(true);
      const bytesBefore = readFileSync(target, 'utf-8');
      const headBefore = readHeadSha(repo);
      // commit a file that does NOT touch the replayed graph path
      commitFile(repo, 'OTHER.md', 'unrelated change\n');
      const headAfter = readHeadSha(repo);
      expect(headAfter).not.toBe(headBefore); // HEAD really advanced
      const second = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(second.rebuilt).toBe(false); // graph commit unchanged -> skip
      expect(second.file.graphHeadSha).toBe(first.file.graphHeadSha);
      expect(readFileSync(target, 'utf-8')).toBe(bytesBefore); // bytes untouched
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a commit that DOES touch docs/skill-graph.json invalidates (graphHeadSha advances)', async () => {
    const repo = fixtureRepo();
    const dir = mkdtempSync(join(tmpdir(), 'sgfr-touch-'));
    const target = join(dir, 'root-backfill.json');
    try {
      const first = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      // a genuinely different blob (same bytes would be a no-op commit)
      const V2_GRAPH_3 = JSON.stringify({
        version: 2,
        nodes: [
          { id: 'agent:root/legacy', type: 'agent', layer: 'L0', content_hash: 'aa11' },
          { id: 'agent:root/second', type: 'agent', layer: 'L0', content_hash: 'bb22' },
          { id: 'agent:root/third', type: 'agent', layer: 'L0', content_hash: 'cc33' },
          { id: 'skill:root/legacy-skill', type: 'skill', layer: 'L0' },
        ],
        edges: [{ type: 'used_by', from: 'agent:root/legacy', to: 'skill:root/legacy-skill' }],
      });
      commitFile(repo, 'graph', V2_GRAPH_3, true);
      const second = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(second.rebuilt).toBe(true);
      expect(second.file.graphHeadSha).not.toBe(first.file.graphHeadSha);
      expect(second.file.graphHeadSha).toBe(readGraphHeadSha(repo, join('docs', 'skill-graph.json')));
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a legacy file carrying only headSha is stale exactly once', async () => {
    const repo = fixtureRepo();
    const dir = mkdtempSync(join(tmpdir(), 'sgfr-legacy-'));
    const target = join(dir, 'root-backfill.json');
    try {
      const graphHead = readGraphHeadSha(repo, join('docs', 'skill-graph.json'))!;
      // Pre-v2.6.2 artifact: headSha only, no graphHeadSha.
      writeFileSync(
        target,
        JSON.stringify({ provenance: 'git-backfill', headSha: graphHead, path: 'docs/skill-graph.json', rows: [] }),
      );
      const first = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(first.rebuilt).toBe(true); // legacy shape -> one rebuild
      const migrated = JSON.parse(readFileSync(target, 'utf-8')) as Record<string, unknown>;
      expect(migrated.graphHeadSha).toBe(graphHead);
      expect(migrated).not.toHaveProperty('headSha');
      const second = await ensureRootBackfill(repo, join('docs', 'skill-graph.json'), target);
      expect(second.rebuilt).toBe(false); // stable thereafter
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── D-C: structure page ──

function structureModelFixture(backfillFile: RootBackfillFile | null = null): ReturnType<typeof buildStructureModel> {
  const root = graph(
    [
      node('agent:root/architect', 'agent', 'L0', { content_hash: 'r1' }),
      node('skill:root/meeting-facilitation', 'skill', 'L0'),
      node('skill:root/sync', 'skill', 'L0'),
      node('agent:co-x/planner', 'agent', 'variant:co-x', { content_hash: 'p1' }),
      node('skill:co-x/local-skill', 'skill', 'variant:co-x'),
      node('doc:guide', 'doc', 'common'),
    ],
    [
      edge('used_by', 'agent:root/architect', 'skill:root/meeting-facilitation'),
      edge('used_by', 'agent:co-x/planner', 'skill:root/meeting-facilitation'),
      edge('composes_with', 'skill:root/sync', 'skill:co-x/local-skill'),
      edge('references', 'doc:guide', 'skill:root/meeting-facilitation'),
    ],
  );
  const template = graph(
    [
      node('agent:co-x/planner', 'agent', 'variant:co-x', { content_hash: 'p1' }),
      node('skill:co-x/local-skill', 'skill', 'variant:co-x'),
    ],
    [],
  );
  const project = graph(
    [
      node('agent:co-x/planner', 'agent', 'L3', { content_hash: 'p1' }),
      node('skill:co-x/local-skill', 'skill', 'L3'),
      node('skill:co-x/project-only', 'skill', 'L3'),
    ],
    [edge('used_by', 'agent:co-x/planner', 'skill:co-x/local-skill')],
  );
  return buildStructureModel(root, { 'co-x': template }, { 'co-x': project }, backfillFile);
}

describe('renderStructurePage (D-C: sections, safety, determinism, budget)', () => {
  const backfillFile: RootBackfillFile = {
    provenance: 'git-backfill',
    graphHeadSha: 'c'.repeat(40),
    path: 'docs/skill-graph.json',
    rows: [
      { date: '2026-08-24', commitCount: 2, schema: 1, agents: projBlock([['agent:root/a', 'h']], [['agent:root/a', 'skill:root/s', 'used_by']]) },
      { date: '2026-08-25', commitCount: 1, schema: 2, agents: projBlock([['agent:root/a', 'h'], ['agent:root/b', 'h']], [['agent:root/a', 'skill:root/s', 'used_by']]) },
    ],
  };

  test('all four sections present; CSP with script-src; zero external references', () => {
    const page = renderStructurePage(structureModelFixture(backfillFile));
    expect(page).toContain('Layer composition');
    expect(page).toContain('<svg'); // no-JS visible bars
    expect(page).toContain('Ego-graph explorer');
    expect(page).toContain('Layer juxtaposition');
    expect(page).toContain("default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
    expect(page).not.toContain('http://');
    expect(page).not.toContain('https://');
    expect(page).toContain('href="skill-graph-history.html"');
  });

  test('model facts land: layer matrix order, hubs by degree, edge distribution, per-hop vocab', () => {
    const model = structureModelFixture(backfillFile);
    expect(model.layerMatrix.map((l) => l.layer)).toEqual(['L0', 'common', 'variant:co-x']);
    expect(model.hubs[0]).toEqual({ id: 'skill:root/meeting-facilitation', degree: 3 });
    expect(model.edgeDistribution[0]?.count).toBeGreaterThanOrEqual(model.edgeDistribution[model.edgeDistribution.length - 1]!.count);
    expect(model.variants[0]?.variant).toBe('co-x');
    expect(model.variants[0]?.root.nodes).toBe(2); // slice only
    expect(model.variants[0]?.root.edges).toBe(0); // induced edges within the slice
    expect(model.variants[0]?.template?.vocabulary).toContain('variant:co-x');
    expect(model.variants[0]?.project?.vocabulary).toBe('L3');
    expect(model.variants[0]?.projectOnly.names).toEqual(['project-only']);
    expect(model.variants[0]?.templateOnly.names).toEqual([]);
    expect(model.root.nodes).toBe(6);
    expect(model.adj.length).toBe(4);
    // backfill condensed for the page
    expect(model.backfill?.rows[0]).toMatchObject({ date: '2026-08-24', agents: 1, edges: 1 });
  });

  test('hostile node id renders inert (data block \\u003c-escaped; server text escaped)', () => {
    const root = graph(
      [
        node('<img src=x onerror=alert(1)>', 'agent', 'L0', { content_hash: 'h' }),
        node('skill:root/<script>alert(2)</script>', 'skill', 'L0'),
        node('skill:root/ok', 'skill', 'L0'),
      ],
      [edge('used_by', '<img src=x onerror=alert(1)>', 'skill:root/<script>alert(2)</script>')],
    );
    const page = renderStructurePage(buildStructureModel(root, {}, {}, null));
    expect(page).not.toContain('<img');
    // the \\u003c-escaping contract covers `<` only — a bare `>` inside the JSON
    // block is inert (same assertion shape as the history-page suite)
    expect(page).toContain('\\u003cimg src=x onerror=alert(1)>');
    expect(page).toContain('&lt;img src=x onerror=alert(1)&gt;'); // server-rendered hub row fully escaped
    expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
  });

  test('data-block purity: no literal </script inside the JSON block', () => {
    const page = renderStructurePage(structureModelFixture(backfillFile));
    const start = page.indexOf('<script id="structure-data"');
    expect(start).toBeGreaterThanOrEqual(0);
    const block = page.slice(start, page.indexOf('</script>', start));
    expect(block).not.toContain('</script');
  });

  test('backfill trend section: present with rows, honest note without', () => {
    const withRows = renderStructurePage(structureModelFixture(backfillFile));
    expect(withRows).toContain('Root agent/edge counts over time');
    expect(withRows).toContain('backfilled from git history');
    const without = renderStructurePage(structureModelFixture(null));
    expect(without).toContain('No backfilled root history available');
  });

  test('determinism: two renders byte-identical (AC13)', () => {
    expect(
      renderStructurePage(structureModelFixture(backfillFile)) === renderStructurePage(structureModelFixture(backfillFile)),
    ).toBe(true);
  });

  test('in-test budget pin: the fixture page is far under the 800 KB structure budget', () => {
    expect(Buffer.byteLength(renderStructurePage(structureModelFixture(backfillFile)), 'utf8')).toBeLessThanOrEqual(800 * 1024);
  });
});

// v2.7.0 (T-20261124-001, design 2026-11-25-upgrade-runner-machinery-batch §4.1):
// the staleness key is the graph CONTENT hash, not the graph commit.
describe('backfillIsFresh — content key (v2.7.0)', () => {
  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);
  const sha1 = '1'.repeat(40);
  const sha2 = '2'.repeat(40);

  test('same content hash and a different graph commit returns true', () => {
    expect(backfillIsFresh({ graphHeadSha: sha1, graphContentSha256: A }, sha2, A)).toBe(true);
  });

  test('a different content hash returns false', () => {
    expect(backfillIsFresh({ graphHeadSha: sha1, graphContentSha256: A }, sha2, B)).toBe(false);
    expect(backfillIsFresh({ graphHeadSha: sha1, graphContentSha256: A }, sha1, B)).toBe(false);
  });

  test('a legacy file without the field is stale once', () => {
    expect(backfillIsFresh({ graphHeadSha: sha1 }, sha1, A)).toBe(false);
    expect(backfillIsFresh({ graphHeadSha: sha1, graphContentSha256: A }, sha1, A)).toBe(true);
  });

  test('without a content hash the graph commit is still compared (v2.6.2 behaviour)', () => {
    expect(backfillIsFresh({ graphHeadSha: sha1 }, sha1, null)).toBe(true);
    expect(backfillIsFresh({ graphHeadSha: sha1 }, sha2, undefined)).toBe(false);
  });

});
