#!/usr/bin/env bun
/**
 * Skill Relationship Graph Verification Script
 * @version 1.5.0
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
import { buildGraph, buildScopeGraph, parseFrontmatter, parseRelatesTo } from './generate-skill-graph.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

interface GraphNode {
  id: string;
  type: 'skill' | 'agent';
  layer: string;
}

interface GraphEdge {
  type: string;
  from: string;
  to: string;
  source: string;
  reason?: string;
}

interface SkillGraph {
  version: 1;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

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
  const lastReviewed = new Date(override.last_reviewed);
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

  // For nodes that exist in both, check layer equality
  for (const derivedNode of derived.nodes) {
    const committedNode = committed.nodes.find(n => n.id === derivedNode.id);
    if (committedNode && (derivedNode.type !== committedNode.type || derivedNode.layer !== committedNode.layer)) {
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
  const derived = buildGraph();

  // ── Determinism check (INV-5): two consecutive builds of the same source set
  // must serialize to exactly the same normalized artifact. Run before any
  // drift comparison — this is a property of the generator, not the committed
  // file.
  if (determinism) {
    const second = buildGraph();
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

  for (const node of derived.nodes) {
    if (node.type === 'skill') {
      skillNames.add(node.id);
    } else if (node.type === 'agent') {
      agentNames.add(node.id);
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
