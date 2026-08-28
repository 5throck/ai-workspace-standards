#!/usr/bin/env bun
/**
 * Skill Relationship Graph Verification Script
 * @version 1.1.0
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
 * - Staleness warnings for overrides (last_reviewed > 12 months)
 *
 * Usage: bun scripts/verify-skill-graph.ts [--scope <common|co-*>]
 *
 * Exit codes:
 * - 0: Verification passed
 * - 1: Drift detected or validation failed
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph, buildScopeGraph } from './generate-skill-graph.ts';

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
  last_reviewed: string;
  expires_at?: string;
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
      const lines = content.split('\n');
      let inFrontmatter = false;
      let frontmatterText = '';

      for (const line of lines) {
        if (line.trim() === '---') {
          if (!inFrontmatter) {
            inFrontmatter = true;
            continue;
          } else {
            inFrontmatter = false;
            break;
          }
        }
        if (inFrontmatter) {
          frontmatterText += line + '\n';
        }
      }

      // Check prerequisites field
      const prereqMatch = frontmatterText.match(/prerequisites:\s*(.+)/);
      if (prereqMatch) {
        const prereqText = prereqMatch[1].trim();
        if (hasCountryMark(prereqText, countryCodes)) {
          countryMarkViolations.push(`skills/${entry.name}/SKILL.md prerequisites field contains country mark`);
        }
      }

      // Check relates_to field (both inline array and YAML list formats)
      const relatesInlineMatch = frontmatterText.match(/relates_to:\s*\[(.+?)\]/);
      const relatesListMatch = frontmatterText.match(/relates_to:\s*\n((?:\s*-\s*[^\n]+\n?)+)/);

      let relatesArray: string[] = [];

      if (relatesInlineMatch) {
        // Inline array format: relates_to: [skill1, skill2]
        relatesArray = relatesInlineMatch[1].split(',').map(s => s.trim().replace(/'/g, '').replace(/"/g, ''));
      } else if (relatesListMatch) {
        // YAML list format: relates_to:\n  - skill1\n  - skill2
        const listText = relatesListMatch[1];
        const itemMatches = listText.matchAll(/-\s*([^\n]+)/g);
        for (const match of itemMatches) {
          relatesArray.push(match[1].trim().replace(/'/g, '').replace(/"/g, ''));
        }
      }

      for (const related of relatesArray) {
        if (hasCountryMark(related, countryCodes)) {
          countryMarkViolations.push(`skills/${entry.name}/SKILL.md relates_to contains country mark: ${related}`);
        }
        if (!allNodeIds.has(related) && related) {
          unknownTargets.push(`skills/${entry.name}/SKILL.md relates_to unknown target: ${related}`);
        }
      }
    }
  }

  // Check overrides file
  const overridesPath = join(ROOT, 'docs', 'skill-graph.overrides.json');
  if (existsSync(overridesPath)) {
    try {
      const overrides: Overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));

      for (const override of overrides.edges) {
        // Check reason field for country marks
        if (hasCountryMark(override.reason, countryCodes)) {
          countryMarkViolations.push(`Override ${override.from} -> ${override.to} reason contains country mark`);
        }

        // Check for unknown targets
        if (override.from && !allNodeIds.has(override.from)) {
          unknownTargets.push(`Override references unknown from node: ${override.from}`);
        }
        if (override.to && !allNodeIds.has(override.to)) {
          unknownTargets.push(`Override references unknown to node: ${override.to}`);
        }

        // Check staleness
        if (isStaleOverride(override)) {
          staleWarnings.push(`Override ${override.from} -> ${override.to} last reviewed ${override.last_reviewed} (> 12 months)`);
        }
      }
    } catch {
      // Invalid overrides JSON, will be caught by graph generation
    }
  }

  return { countryMarkViolations, unknownTargets, staleWarnings };
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

  console.log(`✓ Scope graph verification passed: ${scope}`);
  console.log(`  ${derived.nodes.length} nodes, ${derived.edges.length} edges`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scopeIdx = args.indexOf('--scope');

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
