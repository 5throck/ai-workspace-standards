#!/usr/bin/env bun

/**
 * @version 1.0.0
 *
 * Compute and persist a Graph Delta Log record for the skill graph.
 *
 * Compares the committed skill graph (docs/skill-graph.json) against a freshly
 * built graph, records the structural diff (added/removed nodes and edges per
 * ADR-0084 §5.4), and persists the delta record to docs/graph-deltas/ when
 * the diff is non-empty.
 *
 * **Two-layer delivery** (§5.7):
 * - At workspace root: describes the consolidated graph (L0 + common + variant:co-*)
 * - Inside projects (L3): each project runs its own copy to describe its own graph
 *
 * **Non-blocking writes**: A delta-write failure produces a WARN, never FATAL.
 * Failures are reported but do not fail /sync.
 *
 * Usage:
 *   bun scripts/graph-delta-log.ts [--root <path>] [--scope <scope>]
 *
 *   --root <path>   Override the root directory (default: workspace root)
 *   --scope <scope> Override the scope (default: 'common' at workspace root,
 *                   or derived from project name in L3 context)
 *
 * Implements:
 * - Diff engine comparing committed vs. derived graph
 * - Per-scope, per-commit delta record persistence
 * - ID inclusion with 50-element truncation threshold (design §5.4)
 * - Non-empty delta filtering (design §5.5)
 * - Non-blocking error handling with WARN reporting (design §5.5)
 *
 * Design of record: docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md §5
 * ADR of record: docs/adr/0084-actor-model-evidence-backporting-graph-delta-log.md Decision 7
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { buildGraph, SkillGraph, GraphNode, GraphEdge } from './generate-skill-graph.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

interface DeltaRecord {
  schema_version: '1.0';
  generated_at: string;
  commit: string;
  pr?: number;
  scope: string;
  totals: {
    nodes_added: number;
    nodes_removed: number;
    edges_added: number;
    edges_removed: number;
  };
  by_node_type: Record<string, { added: number; removed: number }>;
  by_edge_type: Record<string, { added: number; removed: number }>;
  ids: {
    nodes_added?: string[];
    nodes_removed?: string[];
    edges_added?: string[];
    edges_removed?: string[];
    truncated: boolean;
  };
}

interface DiffResult {
  missingNodes: GraphNode[];
  extraNodes: GraphNode[];
  missingEdges: GraphEdge[];
  extraEdges: GraphEdge[];
}

/**
 * Compute the diff between two graphs.
 * - missingNodes: in derived but not in committed (added)
 * - extraNodes: in committed but not in derived (removed)
 * - missingEdges: in derived but not in committed (added)
 * - extraEdges: in committed but not in derived (removed)
 */
function computeDiff(derived: SkillGraph, committed: SkillGraph): DiffResult {
  const derivedNodeIds = new Set(derived.nodes.map(n => n.id));
  const committedNodeIds = new Set(committed.nodes.map(n => n.id));

  const missingNodes = derived.nodes.filter(n => !committedNodeIds.has(n.id));
  const extraNodes = committed.nodes.filter(n => !derivedNodeIds.has(n.id));

  // For nodes that exist in both, check if type or layer changed
  for (const derivedNode of derived.nodes) {
    const committedNode = committed.nodes.find(n => n.id === derivedNode.id);
    if (
      committedNode &&
      (derivedNode.type !== committedNode.type || derivedNode.layer !== committedNode.layer)
    ) {
      // Treat as a removal of the old version + addition of new version
      if (!missingNodes.includes(derivedNode)) {
        missingNodes.push(derivedNode);
      }
      if (!extraNodes.includes(committedNode)) {
        extraNodes.push(committedNode);
      }
    }
  }

  // Compare edges by identity: from|to|type|source
  const edgeKey = (e: GraphEdge) => `${e.from}|${e.to}|${e.type}|${e.source}`;
  const derivedEdgeKeys = new Set(derived.edges.map(edgeKey));
  const committedEdgeKeys = new Set(committed.edges.map(edgeKey));

  const missingEdges = derived.edges.filter(e => !committedEdgeKeys.has(edgeKey(e)));
  const extraEdges = committed.edges.filter(e => !derivedEdgeKeys.has(edgeKey(e)));

  return { missingNodes, extraNodes, missingEdges, extraEdges };
}

/**
 * Build the delta record from diff results.
 */
function buildDeltaRecord(
  diff: DiffResult,
  rootDir: string,
  scope: string
): DeltaRecord | null {
  const { missingNodes, extraNodes, missingEdges, extraEdges } = diff;

  // Only persist if there's a non-empty diff (design §5.5)
  const totalChanges =
    missingNodes.length + extraNodes.length + missingEdges.length + extraEdges.length;
  if (totalChanges === 0) {
    return null;
  }

  // Aggregate by type
  const byNodeType: Record<string, { added: number; removed: number }> = {};
  for (const node of missingNodes) {
    if (!byNodeType[node.type]) {
      byNodeType[node.type] = { added: 0, removed: 0 };
    }
    byNodeType[node.type].added++;
  }
  for (const node of extraNodes) {
    if (!byNodeType[node.type]) {
      byNodeType[node.type] = { added: 0, removed: 0 };
    }
    byNodeType[node.type].removed++;
  }

  const byEdgeType: Record<string, { added: number; removed: number }> = {};
  for (const edge of missingEdges) {
    if (!byEdgeType[edge.type]) {
      byEdgeType[edge.type] = { added: 0, removed: 0 };
    }
    byEdgeType[edge.type].added++;
  }
  for (const edge of extraEdges) {
    if (!byEdgeType[edge.type]) {
      byEdgeType[edge.type] = { added: 0, removed: 0 };
    }
    byEdgeType[edge.type].removed++;
  }

  // Determine if IDs should be truncated (design §5.4)
  const ID_THRESHOLD = 50;
  const truncated = totalChanges > ID_THRESHOLD;

  // Build IDs record
  const ids: DeltaRecord['ids'] = {
    truncated,
  };

  if (!truncated) {
    if (missingNodes.length > 0) {
      ids.nodes_added = missingNodes.map(n => n.id);
    }
    if (extraNodes.length > 0) {
      ids.nodes_removed = extraNodes.map(n => n.id);
    }
    if (missingEdges.length > 0) {
      ids.edges_added = missingEdges.map(e => `${e.from}|${e.to}|${e.type}`);
    }
    if (extraEdges.length > 0) {
      ids.edges_removed = extraEdges.map(e => `${e.from}|${e.to}|${e.type}`);
    }
  }

  // Get current commit hash (short form)
  let commit = 'unknown';
  try {
    commit = execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], {
      cwd: rootDir,
      encoding: 'utf-8',
    })
      .trim();
  } catch (e) {
    // Fall back to 'unknown' if not in a git repo
  }

  // Try to get PR number from environment (set by GitHub Actions or similar CI)
  const prNumber = process.env.PR_NUMBER ? parseInt(process.env.PR_NUMBER, 10) : undefined;

  const record: DeltaRecord = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    commit,
    ...(prNumber && { pr: prNumber }),
    scope,
    totals: {
      nodes_added: missingNodes.length,
      nodes_removed: extraNodes.length,
      edges_added: missingEdges.length,
      edges_removed: extraEdges.length,
    },
    by_node_type: byNodeType,
    by_edge_type: byEdgeType,
    ids,
  };

  return record;
}

/**
 * Compute the path for persisting a delta record.
 * Format: docs/graph-deltas/<YYYY>/<YYYY-MM-DD>-<commit-short>-<scope>.json
 */
function getDeltaPath(rootDir: string, record: DeltaRecord): string {
  const date = new Date(record.generated_at);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const dateStr = `${yyyy}-${mm}-${dd}`;

  const filename = `${dateStr}-${record.commit}-${record.scope}.json`;
  const dir = join(rootDir, 'docs', 'graph-deltas', String(yyyy));

  return join(dir, filename);
}

/**
 * Persist a delta record to disk.
 * Returns true on success, false on failure.
 */
function persistDelta(rootDir: string, record: DeltaRecord): boolean {
  try {
    const path = getDeltaPath(rootDir, record);
    const dir = dirname(path);

    // Create directory if needed
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(path, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Main entry point.
 */
async function main() {
  const args = process.argv.slice(2);
  let rootDir = ROOT;
  let scope = 'common';

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && i + 1 < args.length) {
      rootDir = resolve(args[++i]);
    } else if (args[i] === '--scope' && i + 1 < args.length) {
      scope = args[++i];
    }
  }

  // Load committed graph
  const committedPath = join(rootDir, 'docs', 'skill-graph.json');
  let committed: SkillGraph;

  if (!existsSync(committedPath)) {
    // No committed graph exists (first run). Nothing to diff against.
    // Skip delta recording and exit cleanly.
    process.exit(0);
  }

  try {
    committed = JSON.parse(readFileSync(committedPath, 'utf-8'));
  } catch (e) {
    // Failed to load committed graph. Report warning and continue.
    console.warn(
      `⚠ Graph Delta Log: failed to load committed graph (${(e as Error).message})`
    );
    process.exit(0);
  }

  // Build fresh graph
  let derived: SkillGraph;
  try {
    derived = buildGraph();
  } catch (e) {
    // Failed to build graph. Report warning and continue.
    console.warn(
      `⚠ Graph Delta Log: failed to build derived graph (${(e as Error).message})`
    );
    process.exit(0);
  }

  // Compute diff
  const diff = computeDiff(derived, committed);

  // Build delta record (returns null if diff is empty)
  const record = buildDeltaRecord(diff, rootDir, scope);
  if (!record) {
    // No changes, no delta to persist
    process.exit(0);
  }

  // Persist delta (non-blocking on failure)
  const success = persistDelta(rootDir, record);
  if (!success) {
    // Report warning but don't fail
    console.warn(
      `⚠ Graph Delta Log: failed to persist delta record for scope '${scope}'`
    );
  }

  process.exit(0);
}

main().catch(e => {
  console.warn(`⚠ Graph Delta Log: unexpected error (${(e as Error).message})`);
  process.exit(0);
});
