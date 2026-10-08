#!/usr/bin/env bun
/**
 * Skill Relationship Graph Verification Script
 * @version 2.0.0
 *
 * v2.0.0 (2026-10-08, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md §6,
 * ADR-0060 Amendment 11): schema-v2 invariants. New ERRORs (checkGraphInvariants, exported):
 * no dangling edges, no duplicate (from,to,type) edges, unique node ids, unique
 * (name,scope,content_hash) and no two nodes sharing (type,name,content_hash) (failed collapse),
 * id == type:scope/name for skill/agent/phase nodes. New non-blocking reports: isolated nodes by
 * type (G5; adr/decision INFO), skills without used_by with E4 suggestions (G6), E2
 * same-version-different-content (version-drift) and divergence summary. Drift comparison now
 * covers the v2 identity attributes (scope/name/capability/content_hash/version) but never
 * `usage` (memory-derived, volatile) or `mirrors` (checkout-dependent). Name-based relation
 * validation (relates_to / overrides accept bare names or scoped ids).
 *
 * v1.7.0 *
 * v1.7.0 (2026-10-06, T-20261005-022 / D8 of docs/designs/2026-10-05-consult-
 * abap-develop-review-remediation-design.md): scope-mode verification inherits
 * the generator's README- and underscore-prefix agent exclusion —
 * verifyScopeGraph() derives via the imported buildScopeGraph() (no
 * independent re-derivation), so the v1.15.0 generator fix removes the README
 * "agent" nodes from the scope comparison and the regenerated
 * co-consult/co-abap/co-develop artifacts verify.
 *
 * v1.6.0 (2026-09-11): term-node invariants per ADR-0072 — `term:` id
 * namespacing, uniqueness, and every term node must carry at least one
 * skill→term `references` edge (source terms-ko.json). GraphNode.type union
 * mirrors the generator's new 'term' member.
 *
 * Verifies that the committed skill graph files match the current state.
 * Re-derives the graph and compares against docs/skill-graph.json.
 *
 * With --scope <common|co-*>: verifies the scope-local artifact at
 * templates/<scope>/docs/skill-graph.json instead (ADR-0060 Amendment 2).
 *
 * Also validates:
 * - No country marks in relation fields (ADR-0060 invariant)
 * - No unknown targets in relates_to or overrides
 * - Stale override warnings (last_reviewed > 12 months)
 * - Typed `relates_to` schema (ADR-0060 Amendment 3, 2026-08-29): legacy vs.
 *   typed {skill, type} forms via the shared `parseRelatesTo()`, including the
 *   legacy/typed no-mixing rule (a mixed array is a reported finding, not a
 *   silent parse failure).
 * - Procedure-derived graph invariants (Procedure Schema v1.0, 2026-08-29):
 *   orphan procedure detection, invalid procedure relation endpoints, and
 *   `--determinism` mode (two consecutive builds must produce exactly equal
 *   normalized graphs — INV-5 of
 *   docs/designs/2026-08-29-procedure-schema-design.md).
 *
 * Usage: bun scripts/verify-skill-graph.ts [--scope <common|co-*>] [--determinism]
 *
 * Exit codes:
 * - 0: Verification passed
 * - 1: Drift detected or validation failed
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraphWithReport, buildScopeGraph, parseFrontmatter, parseRelatesTo, SkillGraph, GraphNode, GraphEdge } from './generate-skill-graph.ts';
import { findCapabilityDivergence } from './lib/skill-graph-compat.ts';
import type { SkillGraphV2 } from './lib/skill-graph-compat.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

interface OverrideEdge {
  type: string;
  from: string;
  to: string;
  reason: string;
  since?: string;
  last_reviewed?: string;
  expires_at?: string;
  suppress?: boolean;
}

interface Overrides {
  edges: OverrideEdge[];
}

/**
 * Load country codes from workspace-schema.json
 */
function loadCountryCodes(): string[] {
  const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) return [];

  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));
    const countryScopedAssets = schema?.country_scoped_assets;
    if (!countryScopedAssets) return [];

    const codes = new Set<string>();

    const skills = countryScopedAssets.skills || {};
    for (const code of Object.values(skills)) {
      if (typeof code === 'string') codes.add(code);
    }

    const scripts = countryScopedAssets.scripts || {};
    for (const code of Object.values(scripts)) {
      if (typeof code === 'string') codes.add(code);
    }

    const env = countryScopedAssets.env || {};
    for (const code of Object.values(env)) {
      if (typeof code === 'string') codes.add(code);
    }

    return Array.from(codes);
  } catch {
    return [];
  }
}

/**
 * Check for country marks in a text field
 */
function hasCountryMark(text: string, countryCodes: string[]): boolean {
  const lower = text.toLowerCase();

  for (const code of countryCodes) {
    const lowerCode = code.toLowerCase();
    const patterns = [
      `(${lowerCode})`,
      `${lowerCode}:`,
      `${lowerCode}-only`,
      `country=${lowerCode}`
    ];

    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if an override entry is stale (> 12 months since last_reviewed)
 */
function isStaleOverride(override: OverrideEdge): boolean {
  // `last_reviewed` is optional; new Date(undefined) yields Invalid Date and the
  // comparison below is false — the cast preserves that exact behavior.
  const lastReviewed = new Date(override.last_reviewed as string);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - lastReviewed.getFullYear()) * 12 +
                     (now.getMonth() - lastReviewed.getMonth());

  return monthsDiff > 12;
}

/**
 * Format a diff for display (capped at 20 lines)
 */
function formatDiff(
  missingNodes: GraphNode[],
  extraNodes: GraphNode[],
  missingEdges: GraphEdge[],
  extraEdges: GraphEdge[]
): string {
  const lines: string[] = [];
  let lineCount = 0;

  const addLines = (newLines: string[]) => {
    for (const line of newLines) {
      if (lineCount >= 20) return;
      lines.push(line);
      lineCount++;
    }
  };

  if (missingNodes.length > 0 && lineCount < 20) {
    addLines(['Missing nodes:']);
    for (const node of missingNodes) {
      if (lineCount >= 20) break;
      addLines([`  - ${node.type}:${node.id} (${node.layer})`]);
    }
    if (missingNodes.length > 10 && lineCount < 20) {
      addLines([`  ... and ${missingNodes.length - 10} more`]);
    }
  }

  if (extraNodes.length > 0 && lineCount < 20) {
    addLines(['Extra nodes:']);
    for (const node of extraNodes) {
      if (lineCount >= 20) break;
      addLines([`  - ${node.type}:${node.id} (${node.layer})`]);
    }
    if (extraNodes.length > 10 && lineCount < 20) {
      addLines([`  ... and ${extraNodes.length - 10} more`]);
    }
  }

  if (missingEdges.length > 0 && lineCount < 20) {
    addLines(['Missing edges:']);
    for (const edge of missingEdges) {
      if (lineCount >= 20) break;
      addLines([`  - ${edge.from} -> ${edge.to} (${edge.type}, from ${edge.source})`]);
    }
    if (missingEdges.length > 10 && lineCount < 20) {
      addLines([`  ... and ${missingEdges.length - 10} more`]);
    }
  }

  if (extraEdges.length > 0 && lineCount < 20) {
    addLines(['Extra edges:']);
    for (const edge of extraEdges) {
      if (lineCount >= 20) break;
      addLines([`  - ${edge.from} -> ${edge.to} (${edge.type}, from ${edge.source})`]);
    }
    if (extraEdges.length > 10 && lineCount < 20) {
      addLines([`  ... and ${extraEdges.length - 10} more`]);
    }
  }

  return lines.join('\n');
}

/**
 * v2 identity attributes that participate in drift comparison. Deliberately excludes
 * `usage` (derived from memory logs, changes every session) and `mirrors` (depends on which
 * platform mirror dirs a checkout carries).
 */
function identityAttrs(n: GraphNode): string {
  return JSON.stringify([n.name ?? null, n.scope ?? null, n.capability ?? null, n.content_hash ?? null, n.version ?? null, n.ordinal ?? null]);
}

/**
 * Compare two graphs for equality
 */
function compareGraphs(derived: SkillGraph, committed: SkillGraph): {
  equal: boolean;
  missingNodes: GraphNode[];
  extraNodes: GraphNode[];
  missingEdges: GraphEdge[];
  extraEdges: GraphEdge[];
} {
  // Compare nodes by id
  const derivedNodeIds = new Set(derived.nodes.map(n => n.id));
  const committedNodeIds = new Set(committed.nodes.map(n => n.id));

  const missingNodes = derived.nodes.filter(n => !committedNodeIds.has(n.id));
  const extraNodes = committed.nodes.filter(n => !derivedNodeIds.has(n.id));

  // For nodes that exist in both, check type/layer and (v2) identity-attribute equality
  const committedById = new Map(committed.nodes.map(n => [n.id, n]));
  for (const derivedNode of derived.nodes) {
    const committedNode = committedById.get(derivedNode.id);
    if (committedNode && (derivedNode.type !== committedNode.type || derivedNode.layer !== committedNode.layer || identityAttrs(derivedNode) !== identityAttrs(committedNode))) {
      // Treat as missing + extra (will show up in diff)
      if (!missingNodes.includes(derivedNode)) {
        missingNodes.push(derivedNode);
      }
      if (!extraNodes.includes(committedNode)) {
        extraNodes.push(committedNode);
      }
    }
  }

  // Compare edges by identity (from+to+type+source)
  const edgeKey = (e: GraphEdge) => `${e.from}|${e.to}|${e.type}|${e.source}`;
  const derivedEdgeKeys = new Set(derived.edges.map(edgeKey));
  const committedEdgeKeys = new Set(committed.edges.map(edgeKey));

  const missingEdges = derived.edges.filter(e => !committedEdgeKeys.has(edgeKey(e)));
  const extraEdges = committed.edges.filter(e => !derivedEdgeKeys.has(edgeKey(e)));

  const equal = missingNodes.length === 0 &&
                extraNodes.length === 0 &&
                missingEdges.length === 0 &&
                extraEdges.length === 0;

  return { equal, missingNodes, extraNodes, missingEdges, extraEdges };
}

/**
 * Validate relation fields for country marks and unknown targets
 */
function validateRelations(
  skillNames: Set<string>,
  agentNames: Set<string>,
  countryCodes: string[]
): { countryMarkViolations: string[], unknownTargets: string[], staleWarnings: string[] } {
  const countryMarkViolations: string[] = [];
  const unknownTargets: string[] = [];
  const staleWarnings: string[] = [];

  const allNodeIds = new Set([...skillNames, ...agentNames]);

  // Check SKILL.md files
  const skillsDir = join(ROOT, 'skills');
  if (existsSync(skillsDir)) {
    const entries = require('node:fs').readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillFile = join(skillsDir, entry.name, 'SKILL.md');
      if (!require('node:fs').existsSync(skillFile)) continue;

      const content = readFileSync(skillFile, 'utf-8');

      // Check prerequisites field (still free text; scanned as raw line, unchanged)
      const frontmatterBlock = content.split('---')[1] ?? '';
      const prereqMatch = frontmatterBlock.match(/prerequisites:\s*(.+)/);
      if (prereqMatch) {
        const prereqText = prereqMatch[1].trim();
        if (hasCountryMark(prereqText, countryCodes)) {
          countryMarkViolations.push(`skills/${entry.name}/SKILL.md prerequisites field contains country mark`);
        }
      }

      // relates_to: parsed via the real YAML parser + schema validator (ADR-0060
      // Amendment 3) so both legacy string-array and typed {skill, type} entries
      // are checked correctly — the previous line-regex scan mis-tokenized typed
      // multi-line entries (only their first `- skill: ...` line matched).
      const frontmatter = parseFrontmatter(content) as { relates_to?: unknown[] } | null;
      if (frontmatter?.relates_to) {
        let relations: ReturnType<typeof parseRelatesTo> = [];
        try {
          relations = parseRelatesTo(frontmatter.relates_to, skillFile);
        } catch (err) {
          unknownTargets.push(`skills/${entry.name}/SKILL.md: ${(err as Error).message}`);
          relations = [];
        }
        for (const rel of relations) {
          if (hasCountryMark(rel.to, countryCodes)) {
            countryMarkViolations.push(`skills/${entry.name}/SKILL.md relates_to contains country mark: ${rel.to}`);
          }
          if (!allNodeIds.has(rel.to)) {
            unknownTargets.push(`skills/${entry.name}/SKILL.md relates_to unknown target: ${rel.to}`);
          }
        }
      }
    }
  }

  // Check overrides file (L0)
  checkOverridesFile(join(ROOT, 'docs', 'skill-graph.overrides.json'), allNodeIds, countryCodes, {
    countryMarkViolations,
    unknownTargets,
    staleWarnings,
  });

  return { countryMarkViolations, unknownTargets, staleWarnings };
}

/**
 * Policy checks for one skill-graph.overrides.json file (reledgev §3 L-B layer):
 * - `reason` required (fail) + country-mark scan
 * - `since` required and must be a date (fail) — the experimental-layer admission date
 * - `since` older than 90 days → warning (overrides are a waiting room, not a home:
 *   promote to frontmatter or drop)
 * - unknown endpoints → fail
 * - legacy `last_reviewed` staleness (> 12 months) → warning (kept for pre-reledgev entries)
 */
function checkOverridesFile(
  overridesPath: string,
  allNodeIds: Set<string>,
  countryCodes: string[],
  sink: { countryMarkViolations: string[]; unknownTargets: string[]; staleWarnings: string[] }
): void {
  if (!existsSync(overridesPath)) return;
  let overrides: Overrides;
  try {
    overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
  } catch {
    // Invalid overrides JSON, will be caught by graph generation
    return;
  }

  const NOW = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

  for (const override of overrides.edges) {
    const label = `Override ${override.from} -> ${override.to}`;

    // reason is required (fail) + country-mark scan
    if (!override.reason || typeof override.reason !== 'string') {
      sink.unknownTargets.push(`${overridesPath}: ${label} is missing required field "reason"`);
    } else if (hasCountryMark(override.reason, countryCodes)) {
      sink.countryMarkViolations.push(`${label} reason contains country mark`);
    }

    // since is required (fail) + 90-day review warning
    if (!override.since || Number.isNaN(new Date(override.since).getTime())) {
      sink.unknownTargets.push(`${overridesPath}: ${label} is missing required field "since" (YYYY-MM-DD)`);
    } else if (NOW - new Date(override.since).getTime() > NINETY_DAYS) {
      sink.staleWarnings.push(`${label} has been in overrides since ${override.since} (> 90 days) — promote to frontmatter relates_to or drop it`);
    }

    // Check for unknown endpoints
    if (override.from && !allNodeIds.has(override.from)) {
      sink.unknownTargets.push(`Override references unknown from node: ${override.from}`);
    }
    if (override.to && !allNodeIds.has(override.to)) {
      sink.unknownTargets.push(`Override references unknown to node: ${override.to}`);
    }

    // Legacy staleness (pre-reledgev entries carrying last_reviewed)
    if (override.last_reviewed && isStaleOverride(override)) {
      sink.staleWarnings.push(`${label} last reviewed ${override.last_reviewed} (> 12 months)`);
    }
  }
}

export interface InvariantResult {
  errors: string[];
  warnings: string[];
  info: string[];
}

/**
 * Schema-v2 graph invariants (design §6). Pure: operates on any graph object so tests can feed
 * crafted bad graphs. ERRORs block; warnings/info are reported counts.
 */
export function checkGraphInvariants(graph: Pick<SkillGraph, 'nodes' | 'edges'>): InvariantResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  // 3a. node id uniqueness
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) errors.push(`duplicate node id: ${n.id}`);
    ids.add(n.id);
  }

  // 1. no dangling edges
  for (const e of graph.edges) {
    if (!ids.has(e.from)) errors.push(`dangling edge ${e.type}: unknown source ${e.from} (-> ${e.to})`);
    if (!ids.has(e.to)) errors.push(`dangling edge ${e.type}: unknown target ${e.to} (from ${e.from})`);
  }

  // 2. no duplicate (from, to, type) edges
  const edgeKeys = new Set<string>();
  for (const e of graph.edges) {
    const k = `${e.from}|${e.to}|${e.type}`;
    if (edgeKeys.has(k)) errors.push(`duplicate edge: ${e.from} -> ${e.to} (${e.type})`);
    edgeKeys.add(k);
  }

  // 3b/4/5. skill/agent/phase identity
  const triples = new Set<string>();
  const nameHashes = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type !== 'skill' && n.type !== 'agent' && n.type !== 'phase') continue;
    // 4. id/attribute consistency
    const label = n.type === 'phase' ? String(n.ordinal ?? '') : (n.name ?? '');
    const expected = `${n.type}:${n.scope}/${label}`;
    if (n.scope === undefined || label === '' || n.id !== expected) {
      errors.push(`id/attribute mismatch: node "${n.id}" expected "${expected}"`);
    }
    if (n.type === 'phase') continue;
    if (typeof n.content_hash !== 'string' || !n.content_hash) continue; // synthetic nodes carry no hash
    const triple = `${n.type}|${n.name}|${n.scope}|${n.content_hash}`;
    if (triples.has(triple)) errors.push(`duplicate (name, scope, content_hash): ${n.id}`);
    triples.add(triple);
    // 5. same (type, name, content_hash) on two nodes = failed collapse
    const nh = `${n.type}|${n.name}|${n.content_hash}`;
    const prior = nameHashes.get(nh);
    if (prior) errors.push(`failed collapse: ${prior} and ${n.id} share name and content_hash`);
    else nameHashes.set(nh, n.id);
  }

  // G5: isolated nodes by type (adr/decision INFO; everything else WARN)
  const touched = new Set<string>();
  const usedBy = new Set<string>();
  for (const e of graph.edges) {
    touched.add(e.from);
    touched.add(e.to);
    if (e.type === 'used_by') usedBy.add(e.from);
  }
  const isolated = new Map<string, string[]>();
  for (const n of graph.nodes) {
    if (touched.has(n.id)) continue;
    if (!isolated.has(n.type)) isolated.set(n.type, []);
    isolated.get(n.type)!.push(n.id);
  }
  for (const [type, list] of [...isolated.entries()].sort()) {
    const msg = `${list.length} isolated ${type} node(s)${type === 'agent' || type === 'skill' ? `: ${list.slice(0, 5).join(', ')}${list.length > 5 ? ', …' : ''}` : ''}`;
    (type === 'adr' || type === 'decision' ? info : warnings).push(msg);
  }

  // G6: skills with no used_by
  const noUsedBy = graph.nodes.filter((n) => n.type === 'skill' && !usedBy.has(n.id));
  if (noUsedBy.length > 0) warnings.push(`${noUsedBy.length} skill node(s) have no used_by edge`);

  return { errors, warnings, info };
}

/**
 * Main verification logic
 */
/**
 * Verify a scope-local graph artifact (templates/<scope>/docs/skill-graph.json)
 * against a re-derived buildScopeGraph(). Same drift-diff semantics as the L0
 * check; invariants reduced to what a scope graph can express: unknown targets
 * (phase* pseudo-targets exempt) and country marks in relation fields.
 * @version 1.1.0
 */
async function verifyScopeGraph(scope: string): Promise<void> {
  const committedPath = join(ROOT, 'templates', scope, 'docs', 'skill-graph.json');
  if (!existsSync(committedPath)) {
    console.log(`✓ No committed scope graph found for ${scope} (first run)`);
    console.log(`  Run: bun scripts/generate-skill-graph.ts --scope ${scope}`);
    process.exit(0);
  }

  const committed: SkillGraph = JSON.parse(readFileSync(committedPath, 'utf-8'));
  const derived = buildScopeGraph(scope);

  const { equal, missingNodes, extraNodes, missingEdges, extraEdges } = compareGraphs(derived, committed);
  if (!equal) {
    console.log('');
    console.log(`❌ Scope graph drift detected for ${scope}`);
    console.log('');
    const diff = formatDiff(missingNodes, extraNodes, missingEdges, extraEdges);
    console.log(diff);
    console.log('');
    console.log(`Remedy: run \`bun scripts/generate-skill-graph.ts --scope ${scope}\`, then commit`);
    process.exit(1);
  }

  // Unknown-target invariant: every edge endpoint must be a node in the graph
  // (phase<N> pseudo-targets exempt — same carve-out as the L0 check).
  const nodeIds = new Set(derived.nodes.map(n => n.id));
  const unknownTargets: string[] = [];
  for (const edge of derived.edges) {
    if (edge.type === 'phase') continue;
    if (!nodeIds.has(edge.from)) unknownTargets.push(`${edge.type}: ${edge.from} -> ${edge.to} (unknown source)`);
    if (!nodeIds.has(edge.to)) unknownTargets.push(`${edge.type}: ${edge.from} -> ${edge.to} (unknown target)`);
  }
  if (unknownTargets.length > 0) {
    console.log('');
    console.log(`❌ Unknown targets found in scope ${scope}:`);
    for (const target of unknownTargets.slice(0, 20)) {
      console.log(`   ${target}`);
    }
    if (unknownTargets.length > 20) {
      console.log(`   ... and ${unknownTargets.length - 20} more`);
    }
    process.exit(1);
  }

  // Country-mark invariant over the scope's relation fields (ADR-0060)
  const countryCodes = loadCountryCodes();
  const violations: string[] = [];
  const scopeSkillsDir = join(ROOT, 'templates', scope, 'skills');
  if (existsSync(scopeSkillsDir)) {
    for (const e of readdirSync(scopeSkillsDir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const skillPath = join(scopeSkillsDir, e.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;
      const content = readFileSync(skillPath, 'utf-8');
      const frontmatterBlock = content.split('---')[1] ?? '';
      for (const line of frontmatterBlock.split('\n')) {
        if (/^\s*(prerequisites|relates_to):/i.test(line) && hasCountryMark(line, countryCodes)) {
          violations.push(`templates/${scope}/skills/${e.name}: relation field contains country mark`);
        }
      }
    }
  }
  if (violations.length > 0) {
    console.log('');
    console.log(`❌ Country-mark violations found in scope ${scope}:`);
    for (const violation of violations) {
      console.log(`   ${violation}`);
    }
    console.log('');
    console.log('   Country marks must ONLY be in docs/workspace-schema.json country_scoped_assets (ADR-0060).');
    process.exit(1);
  }

  // Scope overrides policy checks (reledgev §3 L-B layer): reason/since required,
  // 90-day review warning, country marks, endpoint existence
  const scopeOverridesPath = join(ROOT, 'templates', scope, 'docs', 'skill-graph.overrides.json');
  if (existsSync(scopeOverridesPath)) {
    const scopeSink = { countryMarkViolations: [] as string[], unknownTargets: [] as string[], staleWarnings: [] as string[] };
    checkOverridesFile(scopeOverridesPath, new Set(derived.nodes.map(n => n.id)), countryCodes, scopeSink);
    if (scopeSink.unknownTargets.length > 0) {
      console.log('');
      console.log(`❌ Override violations in templates/${scope}/docs/skill-graph.overrides.json:`);
      for (const t of scopeSink.unknownTargets.slice(0, 20)) console.log(`   ${t}`);
      process.exit(1);
    }
    if (scopeSink.staleWarnings.length > 0) {
      for (const w of scopeSink.staleWarnings) console.log(`⚠️  ${w}`);
    }
  }

  console.log(`✓ Scope graph verification passed: ${scope}`);
  console.log(`  ${derived.nodes.length} nodes, ${derived.edges.length} edges`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scopeIdx = args.indexOf('--scope');
  const determinism = args.includes('--determinism');

  if (scopeIdx !== -1) {
    const scope = args[scopeIdx + 1];
    if (!scope || (scope !== 'common' && !scope.startsWith('co-'))) {
      console.error(`ERROR: --scope must be 'common' or a co-* variant name (got: ${scope ?? '(missing)'})`);
      process.exit(1);
    }
    await verifyScopeGraph(scope);
    return;
  }

  console.log('Verifying skill relationship graph...');

  const committedPath = join(ROOT, 'docs', 'skill-graph.json');
  if (!existsSync(committedPath)) {
    console.log('✓ No committed skill graph found (first run)');
    console.log('  Run: bun scripts/generate-skill-graph.ts');
    process.exit(0);
  }

  // Load committed graph
  const committed: SkillGraph = JSON.parse(readFileSync(committedPath, 'utf-8'));

  // Derive current graph from sources
  const { graph: derived, report: buildReport } = buildGraphWithReport();

  // ── Determinism check (INV-5): two consecutive builds of the same source set
  // must serialize to exactly the same normalized artifact. Run before any
  // drift comparison — this is a property of the generator, not the committed
  // file.
  if (determinism) {
    const second = buildGraphWithReport().graph;
    const first = JSON.stringify(derived);
    const secondJson = JSON.stringify(second);
    if (first !== secondJson) {
      console.error('❌ Determinism check failed: two consecutive graph builds differ.');
      // Show a bounded, useful hint about where they diverge.
      const a = derived.edges.length, b = second.edges.length;
      console.error(`   Edges: build#1=${a}, build#2=${b}; Nodes: build#1=${derived.nodes.length}, build#2=${second.nodes.length}`);
      process.exit(1);
    }
    console.log('✓ Determinism check passed: two consecutive builds are exactly equal');
  }

  // ── Schema-v2 invariants (design §6): referential integrity + uniqueness ──
  const invariants = checkGraphInvariants(derived);
  if (invariants.errors.length > 0) {
    console.log('');
    console.log('❌ Skill-graph v2 invariant violations:');
    for (const err of invariants.errors.slice(0, 20)) console.log(`   ${err}`);
    if (invariants.errors.length > 20) console.log(`   ... and ${invariants.errors.length - 20} more`);
    process.exit(1);
  }
  console.log(`  v2 invariants: ${derived.nodes.length} nodes, ${derived.edges.length} edges (no dangling/duplicate edges, ids unique, collapse consistent)`);

  // ── Procedure-derived graph invariants (Procedure Schema v1.0) ──
  // The procedure YAML is the canonical source; these checks only assert that
  // the derivation is well-formed (INV-1: repair procedures, never the graph).
  const nodeIds = new Set(derived.nodes.map(n => n.id));
  const procedureErrors: string[] = [];

  const PROC_DERIVED_EDGE_TYPES = new Set([
    'step_uses_skill', 'step_by_agent', 'produces', 'follows', 'enables', 'composes_with',
  ]);
  for (const edge of derived.edges) {
    if (edge.source !== 'procedure_schema' && !PROC_DERIVED_EDGE_TYPES.has(edge.type as never)) continue;
    if (edge.source === 'procedure_schema') {
      if (!nodeIds.has(edge.from)) procedureErrors.push(`${edge.type}: unknown source node ${edge.from}`);
      if (!nodeIds.has(edge.to)) procedureErrors.push(`${edge.type}: unknown target node ${edge.to}`);
    }
  }

  const orphanProcedures = derived.nodes
    .filter(n => n.type === 'procedure')
    .filter(p => !derived.edges.some(e => e.from === p.id && (e.type === 'step_uses_skill' || e.type === 'step_by_agent')));
  for (const orphan of orphanProcedures) {
    procedureErrors.push(`orphan procedure "${orphan.id}" has no step_uses_skill/step_by_agent edges`);
  }

  if (procedureErrors.length > 0) {
    console.log('');
    console.log('❌ Procedure graph invariant violations:');
    for (const err of procedureErrors.slice(0, 20)) {
      console.log(`   ${err}`);
    }
    if (procedureErrors.length > 20) {
      console.log(`   ... and ${procedureErrors.length - 20} more`);
    }
    console.log('');
    console.log('   Fix the procedure schema files (canonical source), never skill-graph.json (INV-1).');
    process.exit(1);
  }
  if (derived.nodes.some(n => n.type === 'procedure')) {
    console.log(`  Procedure invariants: ${derived.nodes.filter(n => n.type === 'procedure').length} procedures checked (orphans/endpoints OK)`);
  }

  // Term-node invariants (ADR-0072): unique `term:<용어>` ids, every term node
  // referenced by at least one skill edge, and term ids namespaced correctly.
  const termNodes = derived.nodes.filter(n => n.type === 'term');
  const termErrors: string[] = [];
  {
    const seen = new Set<string>();
    for (const node of termNodes) {
      if (!node.id.startsWith('term:')) {
        termErrors.push(`term node id not namespaced: "${node.id}"`);
      }
      if (seen.has(node.id)) {
        termErrors.push(`duplicate term node: "${node.id}"`);
      }
      seen.add(node.id);
    }
    const skillTermEdges = new Set(
      derived.edges.filter(e => e.type === 'references' && e.source === 'terms-ko.json').map(e => e.to),
    );
    for (const node of termNodes) {
      if (!skillTermEdges.has(node.id)) {
        termErrors.push(`orphan term node "${node.id}" — no skill references edge`);
      }
    }
  }
  if (termErrors.length > 0) {
    console.log('');
    console.log('❌ Term-node invariant violations:');
    for (const err of termErrors.slice(0, 20)) {
      console.log(`   ${err}`);
    }
    console.log('');
    console.log('   Term nodes come from references/terms-ko.json (ADR-0072); fix the data files, never skill-graph.json (INV-1).');
    process.exit(1);
  }
  if (termNodes.length > 0) {
    console.log(`  Term invariants: ${termNodes.length} term nodes checked (unique, all skill-referenced)`);
  }

  // Compare graphs
  const { equal, missingNodes, extraNodes, missingEdges, extraEdges } = compareGraphs(derived, committed);

  if (!equal) {
    console.log('');
    console.log('❌ Graph drift detected');
    console.log('');
    const diff = formatDiff(missingNodes, extraNodes, missingEdges, extraEdges);
    console.log(diff);
    console.log('');
    console.log('Remedy: run `bun scripts/generate-skill-graph.ts`, then commit');
    process.exit(1);
  }

  // Extract skill and agent names for validation
  const skillNames = new Set<string>();
  const agentNames = new Set<string>();

  // v2 relation fields name skills by bare name (or scoped id) — accept both.
  for (const node of derived.nodes) {
    if (node.type === 'skill') {
      skillNames.add(node.id);
      skillNames.add(node.name ?? node.id);
    } else if (node.type === 'agent') {
      agentNames.add(node.id);
      agentNames.add(node.name ?? node.id);
    }
  }

  // Load country codes for validation
  const countryCodes = loadCountryCodes();

  // Validate relations
  const { countryMarkViolations, unknownTargets, staleWarnings } =
    validateRelations(skillNames, agentNames, countryCodes);

  let hasErrors = false;

  // Report country mark violations (FAIL)
  if (countryMarkViolations.length > 0) {
    console.log('');
    console.log('❌ Country-mark violations found:');
    for (const violation of countryMarkViolations) {
      console.log(`   ${violation}`);
    }
    console.log('');
    console.log('   Country marks must ONLY be in docs/workspace-schema.json country_scoped_assets.');
    console.log('   Relation fields in SKILL.md or overrides must NOT contain country codes (ADR-0060).');
    hasErrors = true;
  }

  // Report unknown targets (FAIL)
  if (unknownTargets.length > 0) {
    console.log('');
    console.log('❌ Unknown targets found:');
    for (const target of unknownTargets.slice(0, 20)) {
      console.log(`   ${target}`);
    }
    if (unknownTargets.length > 20) {
      console.log(`   ... and ${unknownTargets.length - 20} more`);
    }
    hasErrors = true;
  }

  // Report stale warnings (WARN only)
  if (staleWarnings.length > 0) {
    console.log('');
    console.log('⚠️  Stale override warnings:');
    for (const warning of staleWarnings) {
      console.log(`   ${warning}`);
    }
  }

  if (hasErrors) {
    console.log('');
    console.log('❌ Verification failed');
    console.log('   Fix the issues above, then run: bun scripts/generate-skill-graph.ts');
    process.exit(1);
  }

  // Non-blocking reports (G5/G6/E2/E4)
  for (const w of invariants.warnings) console.log(`⚠️  ${w}`);
  for (const i of invariants.info) console.log(`  ℹ ${i}`);
  if (buildReport.suggestions.length > 0) {
    console.log(`  E4: ${buildReport.suggestions.length} skill(s) lacking used_by have a suggested required_by agent (report-only; see docs/skill-graph.md)`);
  }
  const skillDivergence = findCapabilityDivergence(derived as unknown as SkillGraphV2, ['skill']);
  const drift = skillDivergence.filter((d) => d.kind === 'version-drift');
  if (skillDivergence.length > 0) {
    console.log(`⚠️  E2: ${drift.length} skill capabilit${drift.length === 1 ? 'y' : 'ies'} with same-version-different-content (version-drift), ${skillDivergence.length - drift.length} with divergent versions`);
    for (const d of drift) {
      console.log(`     version-drift: ${d.capability} — ${d.entries.map((e) => `${e.scope}@${e.version ?? '?'}`).join(', ')}`);
    }
  }

  console.log('✓ Skill graph verification passed');
  console.log(`  ${derived.nodes.length} nodes, ${derived.edges.length} edges`);

  if (staleWarnings.length > 0) {
    console.log(`  (${staleWarnings.length} stale override warnings)`);
  }

  process.exit(0);
}

if (import.meta.main) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
