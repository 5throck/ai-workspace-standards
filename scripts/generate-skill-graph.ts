#!/usr/bin/env bun
/**
 * Skill Relationship Graph Generator
 * @version 1.0.1
 *
 * Generates a skill relationship graph from multiple sources:
 * - SKILL.md files (prerequisites, relates_to frontmatter fields)
 * - Agent frontmatter (required_skills)
 * - variant.json skill_manifest (used_by_agents, phases)
 * - Prose backtick references in SKILL.md and agent bodies
 * - Hand-maintained overrides in docs/skill-graph.overrides.json
 *
 * Outputs:
 * - docs/skill-graph.json (machine-readable, committed)
 * - docs/skill-graph.md (human-readable catalog, committed)
 *
 * Usage: bun scripts/generate-skill-graph.ts
 *
 * Exit codes:
 * - 0: Success
 * - 1: Operational failure (missing files, parse errors)
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const templatesDir = join(ROOT, 'templates');

// Interfaces for the graph structure
interface GraphNode {
  id: string;
  type: 'skill' | 'agent';
  layer: 'L0' | 'common' | 'variant:string';
}

interface GraphEdge {
  type: 'requires' | 'relates_to' | 'used_by' | 'phase' | 'supersedes' | 'references';
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

// Skill and agent metadata interfaces
interface SkillFrontmatter {
  name?: string;
  prerequisites?: string;
  relates_to?: string[];
}

interface AgentFrontmatter {
  name?: string;
  required_skills?: string[];
}

interface SkillManifestEntry {
  name: string;
  layer: string;
  used_by_agents?: string[];
  phases?: number[];
}

/**
 * Parse YAML frontmatter from a markdown file
 */
function parseFrontmatter(content: string): Record<string, any> | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);
  if (!match) return null;

  const yamlText = match[1];
  const result: Record<string, any> = {};

  const lines = yamlText.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle array values
    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map(v => v.trim()).filter(v => v);
    } else if (value === 'true') {
      value = true;
    } else if (value === 'false') {
      value = false;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Extract backtick-quoted skill names from prose
 */
function extractBacktickReferences(content: string, knownSkillNames: Set<string>): Set<string> {
  const references = new Set<string>();
  // Strip fenced code blocks first — their ``` delimiters would otherwise be
  // consumed as inline backtick pairs, swallowing fenced content and misaligning
  // pairing for every backtick reference after the first fence.
  const proseOnly = content.replace(/^```[\s\S]*?^```/gm, '');
  const backtickRegex = /`([^`]+)`/g;
  let match;

  while ((match = backtickRegex.exec(proseOnly)) !== null) {
    const name = match[1];
    if (knownSkillNames.has(name)) {
      references.add(name);
    }
  }

  return references;
}

/**
 * Parse skill names from prerequisites field (free text)
 * Handles: "skill-name", "skill1, skill2", backtick-wrapped names
 */
function parsePrerequisites(prerequisites: string | string[] | undefined, knownSkillNames: Set<string>): string[] {
  if (!prerequisites) return [];

  const names: string[] = [];

  // If already an array, just validate each element
  if (Array.isArray(prerequisites)) {
    for (const item of prerequisites) {
      const strItem = String(item).trim();
      if (knownSkillNames.has(strItem)) {
        names.push(strItem);
      }
    }
    return names;
  }

  // Convert to string if not already
  const prereqString = String(prerequisites);

  // Try backtick extraction first
  const backtickRegex = /`([^`]+)`/g;
  let match;
  while ((match = backtickRegex.exec(prereqString)) !== null) {
    const name = match[1];
    if (knownSkillNames.has(name)) {
      names.push(name);
    }
  }

  // Fall back to comma-separated if no backticks found
  if (names.length === 0) {
    const parts = prereqString.split(',').map(p => p.trim()).filter(p => p);
    for (const part of parts) {
      if (knownSkillNames.has(part)) {
        names.push(part);
      }
    }
  }

  // Fallback to single skill name if no commas found
  if (names.length === 0 && knownSkillNames.has(prereqString.trim())) {
    names.push(prereqString.trim());
  }

  return names;
}

/**
 * Discover all skills and agents in the workspace
 */
function discoverNodes(): { skills: Map<string, GraphNode>, agents: Map<string, GraphNode> } {
  const skills = new Map<string, GraphNode>();
  const agents = new Map<string, GraphNode>();

  // L0 skills (workspace root)
  const skillsDir = join(ROOT, 'skills');
  if (existsSync(skillsDir)) {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(skillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile)) {
          skills.set(entry.name, { id: entry.name, type: 'skill', layer: 'L0' });
        }
      }
    }
  }

  // Common skills (templates/common)
  const commonSkillsDir = join(ROOT, 'templates', 'common', 'skills');
  if (existsSync(commonSkillsDir)) {
    const entries = readdirSync(commonSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillFile = join(commonSkillsDir, entry.name, 'SKILL.md');
        if (existsSync(skillFile) && !skills.has(entry.name)) {
          skills.set(entry.name, { id: entry.name, type: 'skill', layer: 'common' });
        }
      }
    }
  }

  // Variant skills
  if (existsSync(templatesDir)) {
    const variants = readdirSync(templatesDir, { withFileTypes: true });
    for (const variant of variants) {
      if (!variant.isDirectory() || !variant.name.startsWith('co-')) continue;

      const variantSkillsDir = join(templatesDir, variant.name, 'skills');
      if (existsSync(variantSkillsDir)) {
        const entries = readdirSync(variantSkillsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillFile = join(variantSkillsDir, entry.name, 'SKILL.md');
            if (existsSync(skillFile) && !skills.has(entry.name)) {
              skills.set(entry.name, { id: entry.name, type: 'skill', layer: `variant:${variant.name}` });
            }
          }
        }
      }
    }
  }

  // L0 agents
  const agentsDir = join(ROOT, 'agents');
  if (existsSync(agentsDir)) {
    const entries = readdirSync(agentsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md') && entry !== 'handoff-spec.md') {
        const name = entry.replace('.md', '');
        agents.set(name, { id: name, type: 'agent', layer: 'L0' });
      }
    }
  }

  // Variant agents
  if (existsSync(templatesDir)) {
    const variants = readdirSync(templatesDir, { withFileTypes: true });
    for (const variant of variants) {
      if (!variant.isDirectory() || !variant.name.startsWith('co-')) continue;

      const variantAgentsDir = join(templatesDir, variant.name, 'agents');
      if (existsSync(variantAgentsDir)) {
        const entries = readdirSync(variantAgentsDir);
        for (const entry of entries) {
          if (entry.endsWith('.md')) {
            const name = entry.replace('.md', '');
            if (!agents.has(name)) {
              agents.set(name, { id: name, type: 'agent', layer: `variant:${variant.name}` });
            }
          }
        }
      }
    }
  }

  return { skills, agents };
}

/**
 * Build the skill graph from all sources
 * Exported for use by verify-skill-graph.ts
 */
export function buildGraph(): SkillGraph {
  const { skills, agents } = discoverNodes();
  const allNodes = new Map<string, GraphNode>();

  // Collect all nodes
  for (const [id, node] of skills) {
    allNodes.set(id, node);
  }
  for (const [id, node] of agents) {
    allNodes.set(id, node);
  }

  const edges: GraphEdge[] = [];
  const skillNames = new Set(skills.keys());
  const agentNames = new Set(agents.keys());

  // Source 1: SKILL.md prerequisites field
  for (const [skillName, node] of skills) {
    const skillPath = node.layer === 'L0' ? join(ROOT, 'skills', skillName, 'SKILL.md')
      : node.layer === 'common' ? join(ROOT, 'templates', 'common', 'skills', skillName, 'SKILL.md')
      : join(templatesDir, node.layer.replace('variant:', ''), 'skills', skillName, 'SKILL.md');

    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as SkillFrontmatter;

    if (frontmatter?.prerequisites) {
      const prereqs = parsePrerequisites(frontmatter.prerequisites, skillNames);
      for (const prereq of prereqs) {
        if (skillNames.has(prereq)) {
          edges.push({ type: 'requires', from: skillName, to: prereq, source: 'prerequisites' });
        }
      }
    }

    if (frontmatter?.relates_to && Array.isArray(frontmatter.relates_to)) {
      for (const related of frontmatter.relates_to) {
        if (skillNames.has(related)) {
          edges.push({ type: 'relates_to', from: skillName, to: related, source: 'relates_to' });
        }
      }
    }
  }

  // Source 2: Agent required_skills
  for (const [agentName, node] of agents) {
    const agentPath = node.layer === 'L0' ? join(ROOT, 'agents', `${agentName}.md`)
      : join(templatesDir, node.layer.replace('variant:', ''), 'agents', `${agentName}.md`);

    if (!existsSync(agentPath)) continue;

    const content = readFileSync(agentPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as AgentFrontmatter;

    if (frontmatter?.required_skills && Array.isArray(frontmatter.required_skills)) {
      for (const skill of frontmatter.required_skills) {
        if (skillNames.has(skill)) {
          edges.push({ type: 'used_by', from: skill, to: agentName, source: 'required_skills' });
        }
      }
    }
  }

  // Source 3: variant.json skill_manifest
  if (existsSync(templatesDir)) {
    const variants = readdirSync(templatesDir, { withFileTypes: true });
    for (const variant of variants) {
      if (!variant.isDirectory() || !variant.name.startsWith('co-')) continue;

      const variantJsonPath = join(templatesDir, variant.name, 'variant.json');
      if (!existsSync(variantJsonPath)) continue;

      try {
        const variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
        const variantSpecific = variantJson?.skill_manifest?.variant_specific;

        if (Array.isArray(variantSpecific)) {
          for (const entry of variantSpecific) {
            const manifest = entry as SkillManifestEntry;
            if (!skillNames.has(manifest.name)) continue;

            // used_by_agents edges (skill -> agent)
            if (manifest.used_by_agents && Array.isArray(manifest.used_by_agents)) {
              for (const agent of manifest.used_by_agents) {
                if (agentNames.has(agent)) {
                  edges.push({ type: 'used_by', from: manifest.name, to: agent, source: 'skill_manifest' });
                }
              }
            }

            // phase edges (skill -> phase string)
            if (manifest.phases && Array.isArray(manifest.phases)) {
              for (const phase of manifest.phases) {
                edges.push({ type: 'phase', from: manifest.name, to: `phase${phase}`, source: 'skill_manifest' });
              }
            }
          }
        }
      } catch {
        // Invalid JSON, skip this variant
      }
    }
  }

  // Source 4: Prose backtick references
  for (const [skillName, node] of skills) {
    const skillPath = node.layer === 'L0' ? join(ROOT, 'skills', skillName, 'SKILL.md')
      : node.layer === 'common' ? join(ROOT, 'templates', 'common', 'skills', skillName, 'SKILL.md')
      : join(templatesDir, node.layer.replace('variant:', ''), 'skills', skillName, 'SKILL.md');

    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf-8');
    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;

    const refs = extractBacktickReferences(body, skillNames);
    for (const ref of refs) {
      if (ref !== skillName) { // Skip self-references
        edges.push({ type: 'references', from: skillName, to: ref, source: 'prose' });
      }
    }
  }

  for (const [agentName, node] of agents) {
    const agentPath = node.layer === 'L0' ? join(ROOT, 'agents', `${agentName}.md`)
      : join(templatesDir, node.layer.replace('variant:', ''), 'agents', `${agentName}.md`);

    if (!existsSync(agentPath)) continue;

    const content = readFileSync(agentPath, 'utf-8');
    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;

    const refs = extractBacktickReferences(body, skillNames);
    for (const ref of refs) {
      edges.push({ type: 'references', from: agentName, to: ref, source: 'prose' });
    }
  }

  // Source 5: Overrides
  const overridesPath = join(ROOT, 'docs', 'skill-graph.overrides.json');
  let overrides: Overrides = { edges: [] };

  if (existsSync(overridesPath)) {
    try {
      overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
    } catch {
      console.warn(`Warning: Failed to parse ${overridesPath}, using empty overrides`);
    }
  } else {
    // Create seed file
    const docsDir = join(ROOT, 'docs');
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }
    writeFileSync(overridesPath, JSON.stringify({ edges: [] }, null, 2));
    console.log(`Created seed file: ${overridesPath}`);
  }

  const now = new Date();
  for (const override of overrides.edges) {
    // Check expiration
    if (override.expires_at) {
      const expiresAt = new Date(override.expires_at);
      if (expiresAt < now) {
        console.log(`Note: Override ${override.from} -> ${override.to} expired on ${override.expires_at}, skipping`);
        continue;
      }
    }

    // Validate target nodes exist
    if (override.from && !allNodes.has(override.from)) {
      console.warn(`Warning: Override references unknown node: ${override.from}`);
      continue;
    }
    if (override.to && !allNodes.has(override.to)) {
      console.warn(`Warning: Override references unknown node: ${override.to}`);
      continue;
    }

    edges.push({
      type: override.type as GraphEdge['type'],
      from: override.from,
      to: override.to,
      source: 'override',
      reason: override.reason
    });
  }

  // Sort deterministically
  const sortedNodes = Array.from(allNodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = edges.sort((a, b) => {
    const fromCompare = a.from.localeCompare(b.from);
    if (fromCompare !== 0) return fromCompare;
    const toCompare = a.to.localeCompare(b.to);
    if (toCompare !== 0) return toCompare;
    return a.type.localeCompare(b.type);
  });

  return {
    version: 1,
    nodes: sortedNodes,
    edges: sortedEdges
  };
}

/**
 * Generate human-readable markdown catalog
 */
function generateMarkdown(graph: SkillGraph): string {
  const lines: string[] = [];

  lines.push('# Skill Relationship Graph');
  lines.push('');
  lines.push('> **Generated by `scripts/generate-skill-graph.ts` — do not edit.**');
  lines.push('> ');
  lines.push('> Relations are advisory only (ADR-0060). They do not gate loading, deprecation, or propagation.');
  lines.push('');
  lines.push('## Skill Catalog');
  lines.push('');

  // Build skill relation lookup
  const skillRelations = new Map<string, {
    requires: string[];
    relates_to: string[];
    used_by_agents: string[];
    phases: string[];
  }>();

  for (const node of graph.nodes) {
    if (node.type !== 'skill') continue;
    skillRelations.set(node.id, { requires: [], relates_to: [], used_by_agents: [], phases: [] });
  }

  for (const edge of graph.edges) {
    if (edge.type === 'requires' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.requires.push(edge.to);
    } else if (edge.type === 'relates_to' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.relates_to.push(edge.to);
    } else if (edge.type === 'used_by' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.used_by_agents.push(edge.to);
    } else if (edge.type === 'phase' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.phases.push(edge.to);
    }
  }

  // Output per-skill table
  lines.push('| Skill | Layer | Required-by Agents | Phases | Relates-to |');
  lines.push('|-------|-------|-------------------|--------|------------|');

  const allSkills = Array.from(skillRelations.keys()).sort();
  for (const skillId of allSkills) {
    const node = graph.nodes.find(n => n.id === skillId && n.type === 'skill');
    if (!node) continue;

    const relations = skillRelations.get(skillId)!;
    const agents = relations.used_by_agents.sort().join(', ') || '—';
    const phases = relations.phases.sort().join(', ') || '—';
    const relates = relations.relates_to.sort().join(', ') || '—';

    lines.push(`| \`${skillId}\` | ${node.layer} | ${agents} | ${phases} | ${relates} |`);
  }

  lines.push('');
  lines.push('## Lifecycle Phase Grouping');
  lines.push('');
  lines.push('Skills used in specific lifecycle phases (from `variant.json` `skill_manifest`):');
  lines.push('');

  // Group by phase
  const phaseSkills = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type === 'phase' && edge.to.startsWith('phase')) {
      if (!phaseSkills.has(edge.to)) {
        phaseSkills.set(edge.to, []);
      }
      phaseSkills.get(edge.to)!.push(edge.from);
    }
  }

  const sortedPhases = Array.from(phaseSkills.keys()).sort();
  for (const phase of sortedPhases) {
    const skills = phaseSkills.get(phase)!.sort().join(', ');
    lines.push(`- **${phase}**: ${skills}`);
  }

  lines.push('');
  lines.push('## Edge Types');
  lines.push('');
  lines.push('| Type | Description |');
  lines.push('|------|-------------|');
  lines.push('| `requires` | From SKILL.md `prerequisites` field (skill → skill) |');
  lines.push('| `relates_to` | From SKILL.md `relates_to` field or overrides (skill ↔ skill) |');
  lines.push('| `used_by` | Agent ↔ skill relation (from `required_skills` or `used_by_agents`) |');
  lines.push('| `phase` | Skill used in a lifecycle phase (from `variant.json` `skill_manifest.phases`) |');
  lines.push('| `supersedes` | From overrides only (manual declaration of supersession) |');
  lines.push('| `references` | Backtick reference in SKILL.md or agent body prose |');
  lines.push('');

  return lines.join('\n');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log('Generating skill relationship graph...');

  const graph = buildGraph();

  // Ensure docs directory exists
  const docsDir = join(ROOT, 'docs');
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  // Write JSON output
  const jsonPath = join(docsDir, 'skill-graph.json');
  writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
  console.log(`✓ Generated: ${jsonPath}`);

  // Write Markdown output
  const mdPath = join(docsDir, 'skill-graph.md');
  const markdown = generateMarkdown(graph);
  writeFileSync(mdPath, markdown);
  console.log(`✓ Generated: ${mdPath}`);

  // Statistics
  const skillNodes = graph.nodes.filter(n => n.type === 'skill');
  const agentNodes = graph.nodes.filter(n => n.type === 'agent');

  console.log('');
  console.log('Statistics:');
  console.log(`  Nodes: ${graph.nodes.length} total (${skillNodes.length} skills, ${agentNodes.length} agents)`);

  const nodesByLayer = new Map<string, number>();
  for (const node of graph.nodes) {
    nodesByLayer.set(node.layer, (nodesByLayer.get(node.layer) || 0) + 1);
  }
  for (const [layer, count] of Array.from(nodesByLayer.entries()).sort()) {
    console.log(`    - ${layer}: ${count}`);
  }

  console.log(`  Edges: ${graph.edges.length} total`);

  const edgesByType = new Map<string, number>();
  for (const edge of graph.edges) {
    edgesByType.set(edge.type, (edgesByType.get(edge.type) || 0) + 1);
  }

  for (const [type, count] of Array.from(edgesByType.entries()).sort()) {
    console.log(`    - ${type}: ${count}`);
  }
}

if (import.meta.main) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
