#!/usr/bin/env bun
/**
 * Skill Relationship Graph Generator
 * @version 1.7.1
 *
 * Generates a skill relationship graph from multiple sources:
 * - SKILL.md files (prerequisites, relates_to frontmatter fields)
 * - Agent frontmatter (required_skills)
 * - variant.json skill_manifest (used_by_agents, phases)
 * - Prose backtick references in SKILL.md and agent bodies
 * - Hand-maintained overrides (per scope: docs/skill-graph.overrides.json at L0
 *   and templates/<scope>/docs/skill-graph.overrides.json for scope graphs;
 *   reledgev §3 L-B layer — reason/since required, expires_at, suppress markers)
 *
 * Outputs:
 * - docs/skill-graph.json (machine-readable, committed)
 * - docs/skill-graph.md (human-readable catalog, committed)
 *
 * With --scope <common|co-*>: generates a scope-local graph for a single template
 * layer instead, written to templates/<scope>/docs/skill-graph.json (JSON only —
 * the .md catalog stays L0-exclusive). Scope-local nodes carry the scope's layer
 * tag; relations naming an upstream (L0/common) skill materialize that target as a
 * cross-layer node. See ADR-0060 Amendment 2 (2026-08-28).
 *
 * Run context: at the L0 workspace root (ROOT/templates exists) local assets are
 * tagged L0; inside a project (no templates/ dir) they are tagged L3, so a
 * project-local graph labels its own skills/agents correctly.
 *
 * Typed relation vocabulary (ADR-0060 Amendment 3, 2026-08-29): `relates_to`
 * accepts either a bare string array (legacy, generic `relates_to` edges) or an
 * array of typed `{skill, type}` objects using `composes_with`/`follows`/
 * `enables` (plus the existing generic `relates_to` as an explicit type value).
 * Mixing bare strings and typed objects in the same array is a schema-validation
 * error, not a YAML-parse error. Frontmatter parsing uses `js-yaml`, scoped
 * strictly to the text between the `---`/`---` delimiters — the Markdown body is
 * untouched. See docs/designs/2026-08-28-skill-graph-typed-relations-design.md.
 *
 * Usage: bun scripts/generate-skill-graph.ts [--scope <common|co-*>]
 *
 * Exit codes:
 * - 0: Success
 * - 1: Operational failure (missing files, parse errors, schema-validation errors)
 */

import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const templatesDir = join(ROOT, 'templates');
// Run-context detection: the workspace root is the only context that has a
// templates/ directory. Everywhere else (scaffolded project) local assets are
// the project's own copies and must be tagged L3, not L0.
const localLayer: 'L0' | 'L3' = existsSync(templatesDir) ? 'L0' : 'L3';

// Interfaces for the graph structure
interface GraphNode {
  id: string;
  type: 'skill' | 'agent' | 'decision' | 'adr' | 'procedure' | 'output_type';
  layer: 'L0' | 'L3' | 'common' | 'variant:string';
  /** Opaque input/output labels from SKILL.md frontmatter (skill nodes only). */
  inputs?: string[];
  outputs?: string[];
}

type EdgeType =
  | 'requires' | 'relates_to' | 'used_by' | 'phase' | 'supersedes' | 'references' | 'cites_skill'
  // ADR-0060 Amendment 3 (2026-08-29): typed relation vocabulary
  | 'composes_with' | 'follows' | 'enables'
  // Procedure Schema v1.0 (2026-08-29): procedure-derived edges (canonical
  // source = templates/<variant>/procedures/<name>/schema.yaml — INV-1, see
  // docs/designs/2026-08-29-procedure-schema-design.md)
  | 'step_uses_skill' | 'step_by_agent' | 'produces';

// Typed `relates_to` entry shape is a *forward-open* object: {skill, type} are
// the only two fields Phase 1 interprets. Any additional key (e.g. a future
// `status`/`version`/`confidence`) is preserved unmodified and passed through
// on `extra`, never validated or acted on by this phase. See Amendment 3 §C.
interface EdgeProvenance {
  file: string;
  field: string;
  index?: number;
}

interface GraphEdge {
  type: EdgeType;
  from: string;
  to: string;
  source: string;
  reason?: string;
  /** `composes_with` is symmetric: stored as one directed edge, traversable both ways. */
  symmetric?: true;
  /** Unknown keys on a typed relates_to entry beyond {skill, type} — pass-through, unvalidated. */
  extra?: Record<string, unknown>;
  /** Exactly which frontmatter field/entry produced this edge (JSON-only; not rendered in .md). */
  provenance?: EdgeProvenance;
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
  /** Suppress marker (reledgev §3, L-B layer): remove matching frontmatter-derived
   *  edges instead of adding an edge. `type` optional — omit to suppress all types. */
  suppress?: boolean;
}

interface Overrides {
  edges: OverrideEdge[];
}

// Skill and agent metadata interfaces
interface SkillFrontmatter {
  name?: string;
  prerequisites?: string;
  relates_to?: unknown[];
  /** Opaque input/output labels (ADR-0060 Amendment 3) — not skill references,
   *  not "artifacts". Rendered per-skill in docs/skill-graph.md; not resolved
   *  against any node type in Phase 1 (see Phase 4 roadmap). */
  inputs?: string[];
  outputs?: string[];
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
 * Parse YAML frontmatter from a markdown file.
 *
 * @version 1.4.0 (ADR-0060 Amendment 3, 2026-08-29): backed by `js-yaml` instead
 * of the previous hand-rolled single-line regex parser, so nested typed
 * `relates_to: - skill: ... type: ...` blocks parse correctly. Scoped strictly
 * to the text between the `---`/`---` delimiters — everything after the second
 * delimiter (the Markdown body) is never touched by the YAML parser, matching
 * the original regex parser's boundary exactly. Verified byte-identical output
 * for all pre-existing single-line/inline-array frontmatter across all ~164
 * SKILL.md files (see Verification: parser regression, semantic-equality pass).
 */
export function parseFrontmatter(content: string): Record<string, any> | null {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = content.match(frontmatterRegex);
  if (!match) return null;

  const yamlText = match[1];
  try {
    const parsed = yamlLoad(yamlText);
    if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, any>;
  } catch {
    // Fallback for pre-existing frontmatter blocks that are not strict YAML
    // (e.g. some docs/decisions/DEC-*.md prose values contain unescaped
    // "key: value"-shaped colons) — out of this pass's scope (SKILL.md typed
    // relates_to). Mirrors the previous hand-rolled single-line parser exactly
    // so non-SKILL.md consumers of parseFrontmatter see zero behavior change.
    return legacyParseFrontmatterLines(yamlText);
  }
}

/** Pre-1.4.0 hand-rolled single-line `key: value` / inline `[a, b]` parser (fallback only). */
function legacyParseFrontmatterLines(yamlText: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = yamlText.split('\n');
  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: any = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((v: string) => v.trim()).filter((v: string) => v);
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
 * Schema-validate + normalize a `relates_to` field into typed relation entries.
 *
 * Legacy form (bare string array) → generic `relates_to` edges, unchanged
 * behavior. Typed form (array of `{skill, type, ...}` objects) → the declared
 * edge type, with `composes_with` marked `symmetric: true` and any keys beyond
 * `{skill, type}` preserved on `extra` (forward-open, pass-through, unvalidated
 * — Phase 2's contract to interpret). Mixing bare strings and typed objects in
 * the same array is a schema-validation error (not a YAML-parse error — the
 * array itself is syntactically valid YAML) with the exact message specified
 * in ADR-0060 Amendment 3.
 *
 * @version 1.4.0
 */
const TYPED_RELATION_TYPES = new Set<EdgeType>(['relates_to', 'composes_with', 'follows', 'enables']);

interface ParsedRelation {
  to: string;
  type: EdgeType;
  symmetric?: true;
  extra?: Record<string, unknown>;
  index: number;
}

export function parseRelatesTo(raw: unknown, filePath: string): ParsedRelation[] {
  if (!raw) return [];
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const isStringEntry = (e: unknown): e is string => typeof e === 'string';
  const isTypedEntry = (e: unknown): e is Record<string, unknown> =>
    typeof e === 'object' && e !== null && !Array.isArray(e) && 'skill' in (e as object) && 'type' in (e as object);

  const allStrings = raw.every(isStringEntry);
  const allTyped = raw.every(isTypedEntry);

  if (!allStrings && !allTyped) {
    throw new Error(
      `${filePath}: relates_to must contain either all string entries or all typed relation objects; mixed entries are not allowed`
    );
  }

  if (allStrings) {
    return (raw as string[]).map((to, index) => ({ to, type: 'relates_to' as EdgeType, index }));
  }

  return (raw as Record<string, unknown>[]).map((entry, index) => {
    const { skill, type, ...rest } = entry;
    if (typeof skill !== 'string' || typeof type !== 'string' || !TYPED_RELATION_TYPES.has(type as EdgeType)) {
      throw new Error(
        `${filePath}: relates_to[${index}] is not a valid typed relation object (expected {skill, type} with type one of ${Array.from(TYPED_RELATION_TYPES).join('|')})`
      );
    }
    const parsed: ParsedRelation = { to: skill, type: type as EdgeType, index };
    if (type === 'composes_with') parsed.symmetric = true;
    if (Object.keys(rest).length > 0) parsed.extra = rest;
    return parsed;
  });
}

/** Build the `{file, field, index?}` provenance object for a generated edge. */
function prov(absPath: string, field: string, index?: number): EdgeProvenance {
  const file = relative(ROOT, absPath).split('\\').join('/');
  return index === undefined ? { file, field } : { file, field, index };
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
          skills.set(entry.name, { id: entry.name, type: 'skill', layer: localLayer });
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
        agents.set(name, { id: name, type: 'agent', layer: localLayer });
      }
    }
  }

  // Common agents (templates/common/agents/) - DEDUP: skip if already in L0
  const commonAgentsDir = join(ROOT, 'templates', 'common', 'agents');
  if (existsSync(commonAgentsDir)) {
    const entries = readdirSync(commonAgentsDir);
    for (const entry of entries) {
      // Exclude non-agent files: handoff-spec.md and underscore-prefixed
      // directory docs (e.g. _COMMON.md is the folder README, not an agent)
      if (entry.endsWith('.md') && entry !== 'handoff-spec.md' && !entry.startsWith('_')) {
        const name = entry.replace('.md', '');
        // Dedup rule: keep L0 node, skip common-layer duplicate
        if (!agents.has(name)) {
          agents.set(name, { id: name, type: 'agent', layer: 'common' });
        }
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
 * Derive procedure/output_type nodes and procedure edges from a directory of
 * procedure schemas (<dir>/<name>/schema.yaml). Shared by buildGraph (variant
 * templates + the root l0 namespace) and buildScopeGraph (per-scope artifacts).
 *
 * Produces-edge rule (INV-4): procedure-level outputs[] → procedure →
 * output_type; a step output_type NOT in outputs[] → the step's skill →
 * output_type. Node ids: `procedure.<namespace>.<name>`,
 * `output_type.<type>`.
 */
function deriveProceduresFromDir(
  procDir: string,
  namespace: string,
  layer: string,
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): void {
  if (!existsSync(procDir)) return;

  for (const entry of readdirSync(procDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const schemaPath = join(procDir, entry.name, 'schema.yaml');
    if (!existsSync(schemaPath)) continue;

    let data: any;
    try {
      data = yamlLoad(readFileSync(schemaPath, 'utf-8'));
    } catch {
      console.warn(`Warning: cannot parse ${schemaPath}, skipping`);
      continue;
    }
    if (!data || typeof data !== 'object') continue;

    // Namespace resolution: prefer the procedure_id's variant/l0 prefix so node ids
    // match the `procedure.<ns>.<name>` targets used in relations[] — critical for
    // project-local runs, where ROOT/procedures is scanned with the fallback 'l0'
    // namespace but the schemas still carry their variant-prefixed procedure_ids
    // (e.g. "co-abap-custom-dev-delivery" → procedure.co-abap.custom-dev-delivery).
    const pidField = typeof data.procedure_id === 'string' ? data.procedure_id : '';
    const ns = pidField.endsWith(`-${entry.name}`)
      ? pidField.slice(0, pidField.length - entry.name.length - 1)
      : namespace;

    const procId: string = `procedure.${ns}.${entry.name}`;
    allNodes.set(procId, { id: procId, type: 'procedure', layer });

    const ensureOutputType = (type: string): void => {
      const id = `output_type.${type}`;
      if (!allNodes.has(id)) {
        allNodes.set(id, { id, type: 'output_type', layer });
      }
    };
    // Nested skill keys (e.g. co-safety `daily/risk-assessment`) may exist on
    // disk below the flat discovery depth — materialize them as skill nodes so
    // the unknown-target invariant holds.
    const ensureSkill = (key: string): void => {
      if (!allNodes.has(key)) {
        allNodes.set(key, { id: key, type: 'skill', layer });
      }
    };

    const procedureOutputs = new Set<string>();
    if (Array.isArray(data.outputs)) {
      for (const o of data.outputs) {
        const type = o && typeof o === 'object' ? o.type : o;
        if (typeof type === 'string' && type) {
          procedureOutputs.add(type);
          ensureOutputType(type);
          edges.push({ type: 'produces', from: procId, to: `output_type.${type}`, source: 'procedure_schema' });
        }
      }
    }

    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (!step || typeof step !== 'object') continue;
        if (typeof step.skill_key === 'string' && step.skill_key) {
          ensureSkill(step.skill_key);
          edges.push({ type: 'step_uses_skill', from: procId, to: step.skill_key, source: 'procedure_schema' });
          if (typeof step.output_type === 'string' && step.output_type && !procedureOutputs.has(step.output_type)) {
            ensureOutputType(step.output_type);
            edges.push({ type: 'produces', from: step.skill_key, to: `output_type.${step.output_type}`, source: 'procedure_schema' });
          }
        }
        if (typeof step.agent_key === 'string' && step.agent_key && allNodes.has(step.agent_key)) {
          edges.push({ type: 'step_by_agent', from: procId, to: step.agent_key, source: 'procedure_schema' });
        }
      }
    }

    if (Array.isArray(data.relations)) {
      for (const rel of data.relations) {
        if (!rel || typeof rel !== 'object') continue;
        const { type, target } = rel;
        if (type !== 'follows' && type !== 'enables' && type !== 'composes_with') continue;
        if (typeof target !== 'string' || !target) continue;
        const procMatch = /^procedure\.([a-z0-9-]+)\.([a-z0-9-]+)$/.exec(target);
        const skillMatch = /^skill\.(.+)$/.exec(target);
        if (procMatch) {
          if (!allNodes.has(target)) {
            allNodes.set(target, {
              id: target,
              type: 'procedure',
              layer: procMatch[1] === 'l0' ? 'L0' : `variant:${procMatch[1]}`,
            });
          }
          edges.push({ type, from: procId, to: target, source: 'procedure_schema' });
        } else if (skillMatch) {
          ensureSkill(skillMatch[1]);
          edges.push({ type, from: procId, to: skillMatch[1], source: 'procedure_schema' });
        }
      }
    }
  }
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
    const skillPath = node.layer === 'common' ? join(ROOT, 'templates', 'common', 'skills', skillName, 'SKILL.md')
      : node.layer.startsWith('variant:') ? join(templatesDir, node.layer.replace('variant:', ''), 'skills', skillName, 'SKILL.md')
      : join(ROOT, 'skills', skillName, 'SKILL.md');

    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as SkillFrontmatter;

    if (Array.isArray(frontmatter?.inputs) || Array.isArray(frontmatter?.outputs)) {
      const skillNode = allNodes.get(skillName);
      if (skillNode) {
        if (Array.isArray(frontmatter.inputs)) skillNode.inputs = frontmatter.inputs.filter((x: unknown) => typeof x === 'string');
        if (Array.isArray(frontmatter.outputs)) skillNode.outputs = frontmatter.outputs.filter((x: unknown) => typeof x === 'string');
      }
    }

    if (frontmatter?.prerequisites) {
      const prereqs = parsePrerequisites(frontmatter.prerequisites, skillNames);
      for (const prereq of prereqs) {
        if (skillNames.has(prereq)) {
          edges.push({ type: 'requires', from: skillName, to: prereq, source: 'prerequisites', provenance: prov(skillPath, 'prerequisites') });
        }
      }
    }

    if (frontmatter?.relates_to) {
      for (const rel of parseRelatesTo(frontmatter.relates_to, skillPath)) {
        if (skillNames.has(rel.to)) {
          edges.push({
            type: rel.type,
            from: skillName,
            to: rel.to,
            source: 'relates_to',
            ...(rel.symmetric ? { symmetric: true as const } : {}),
            ...(rel.extra ? { extra: rel.extra } : {}),
            provenance: prov(skillPath, 'relates_to', rel.index)
          });
        }
      }
    }
  }

  // Source 2: Agent required_skills
  for (const [agentName, node] of agents) {
    const agentPath = node.layer === 'common' ? join(ROOT, 'templates', 'common', 'agents', `${agentName}.md`)
      : node.layer.startsWith('variant:') ? join(templatesDir, node.layer.replace('variant:', ''), 'agents', `${agentName}.md`)
      : join(ROOT, 'agents', `${agentName}.md`);

    if (!existsSync(agentPath)) continue;

    const content = readFileSync(agentPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as AgentFrontmatter;

    if (frontmatter?.required_skills && Array.isArray(frontmatter.required_skills)) {
      frontmatter.required_skills.forEach((skill: string, index: number) => {
        if (skillNames.has(skill)) {
          edges.push({ type: 'used_by', from: skill, to: agentName, source: 'required_skills', provenance: prov(agentPath, 'required_skills', index) });
        }
      });
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
    const skillPath = node.layer === 'common' ? join(ROOT, 'templates', 'common', 'skills', skillName, 'SKILL.md')
      : node.layer.startsWith('variant:') ? join(templatesDir, node.layer.replace('variant:', ''), 'skills', skillName, 'SKILL.md')
      : join(ROOT, 'skills', skillName, 'SKILL.md');

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
    const agentPath = node.layer === 'common' ? join(ROOT, 'templates', 'common', 'agents', `${agentName}.md`)
      : node.layer.startsWith('variant:') ? join(templatesDir, node.layer.replace('variant:', ''), 'agents', `${agentName}.md`)
      : join(ROOT, 'agents', `${agentName}.md`);

    if (!existsSync(agentPath)) continue;

    const content = readFileSync(agentPath, 'utf-8');
    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;

    const refs = extractBacktickReferences(body, skillNames);
    for (const ref of refs) {
      edges.push({ type: 'references', from: agentName, to: ref, source: 'prose' });
    }
  }

  // Source 4.5: Document layer — decision records + ADRs (ADR-0060 amendment
  // 2026-08-25, generalizing the co-newbiz multi-element pilot). Decision
  // records (docs/decisions/DEC-*.md) and ADRs become graph nodes so the
  // Agent -> Skill -> Knowledge -> Evidence -> Rule -> Decision chain of
  // ADR-0061 is queryable from the same projection. All edges advisory.
  const decisionsDir = join(ROOT, 'docs', 'decisions');
  if (existsSync(decisionsDir)) {
    for (const f of readdirSync(decisionsDir)) {
      if (!/^DEC-\d{8}-\d{2}\.md$/.test(f)) continue;
      const docId = `dec:${f.replace(/\.md$/, '')}`;
      allNodes.set(docId, { id: docId, type: 'decision', layer: localLayer });

      const raw = readFileSync(join(decisionsDir, f), 'utf-8');
      const frontmatter = parseFrontmatter(raw) as Record<string, unknown>;

      // cites_skill: skills_used[] entries validated against the known skill set
      const skillsUsed = frontmatter['skills_used'];
      if (Array.isArray(skillsUsed)) {
        for (const s of skillsUsed) {
          if (typeof s === 'string' && skillNames.has(s)) {
            edges.push({ type: 'cites_skill', from: docId, to: s, source: 'skills_used' });
          }
        }
      }

      const bodyParts = raw.split('---');
      const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : raw;

      // references: knowledge_refs[] entries naming an ADR
      const knowledgeRefs = frontmatter['knowledge_refs'];
      if (Array.isArray(knowledgeRefs)) {
        for (const ref of knowledgeRefs) {
          const m = typeof ref === 'string' ? /^ADR-(\d{4})$/.exec(ref.trim()) : null;
          if (m) {
            edges.push({ type: 'references', from: docId, to: `adr:${m[1]}`, source: 'knowledge_refs' });
          }
        }
      }

      // supersedes/amends via prose labels (exact token match on same line)
      for (const line of body.split('\n')) {
        const m = /supersedes?:?\s*(ADR-\d{4}|DEC-\d{8}-\d{2})/i.exec(line);
        if (m) {
          const targetId = m[1].startsWith('ADR') ? `adr:${m[1].slice(4)}` : `dec:${m[1]}`;
          if (targetId !== docId) {
            edges.push({ type: 'supersedes', from: docId, to: targetId, source: 'prose' });
          }
        }
      }
    }
  }

  const adrsDir = join(ROOT, 'docs', 'adr');
  if (existsSync(adrsDir)) {
    for (const f of readdirSync(adrsDir)) {
      const m = /^(\d{4})-.*\.md$/.exec(f);
      if (!m) continue;
      const adrId = `adr:${m[1]}`;
      allNodes.set(adrId, { id: adrId, type: 'adr', layer: localLayer });

      const content = readFileSync(join(adrsDir, f), 'utf-8');
      const refs = extractBacktickReferences(content, skillNames);
      for (const ref of refs) {
        edges.push({ type: 'references', from: adrId, to: ref, source: 'prose' });
      }
    }
  }

  // Source 4.7: Procedures — derived from templates/<variant>/procedures/<name>/schema.yaml
  // plus the workspace-root l0 namespace (<ROOT>/procedures/). The procedure
  // YAML is the canonical source; these nodes/edges are pure derivation and
  // MUST NOT be hand-maintained (INV-1,
  // docs/designs/2026-08-29-procedure-schema-design.md).
  if (existsSync(templatesDir)) {
    const variants = readdirSync(templatesDir, { withFileTypes: true });
    for (const variant of variants) {
      if (!variant.isDirectory() || !variant.name.startsWith('co-')) continue;
      deriveProceduresFromDir(
        join(templatesDir, variant.name, 'procedures'),
        variant.name,
        `variant:${variant.name}`,
        allNodes,
        edges,
      );
    }
  }
  // Workspace-root lifecycle procedures (l0 namespace).
  deriveProceduresFromDir(join(ROOT, 'procedures'), 'l0', localLayer, allNodes, edges);

  // Source 5: Overrides (L0) — loaded and applied via shared helper
  const { overrides } = loadOverridesFile(join(ROOT, 'docs'));
  applyOverrides(overrides, allNodes, edges);

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
 * Load (and seed, if missing) a skill-graph.overrides.json from the given docs dir.
 * reledgev §3 L-B layer: each scope (L0 docs/ or templates/<scope>/docs/) owns its
 * own experimental-relation file.
 */
function loadOverridesFile(docsDir: string): { path: string; overrides: Overrides } {
  const overridesPath = join(docsDir, 'skill-graph.overrides.json');
  let overrides: Overrides = { edges: [] };

  if (existsSync(overridesPath)) {
    try {
      overrides = JSON.parse(readFileSync(overridesPath, 'utf-8'));
    } catch {
      console.warn(`Warning: Failed to parse ${overridesPath}, using empty overrides`);
    }
  } else if (docsDir === join(ROOT, 'docs') || existsSync(docsDir)) {
    if (!existsSync(docsDir)) mkdirSync(docsDir, { recursive: true });
    writeFileSync(overridesPath, JSON.stringify({ edges: [] }, null, 2));
    console.log(`Created seed file: ${overridesPath}`);
  }

  return { path: overridesPath, overrides };
}

/**
 * Apply override edges: add non-suppress entries (expiry + unknown-node guarded),
 * and honor `suppress: true` entries by removing matching frontmatter-derived edges
 * (source !== 'override'; override-vs-override suppression is not supported).
 * reledgev §3 L-B layer.
 */
function applyOverrides(overrides: Overrides, allNodes: Map<string, GraphNode>, edges: GraphEdge[]): void {
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

    // Validate endpoint nodes exist
    if (override.from && !allNodes.has(override.from)) {
      console.warn(`Warning: Override references unknown node: ${override.from}`);
      continue;
    }
    if (override.to && !allNodes.has(override.to)) {
      console.warn(`Warning: Override references unknown node: ${override.to}`);
      continue;
    }

    if (override.suppress) {
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i];
        if (e.source === 'override') continue;
        if (e.from === override.from && e.to === override.to && (!override.type || e.type === override.type)) {
          edges.splice(i, 1);
        }
      }
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
}

/**
 * Build a scope-local graph for a single template layer (templates/<scope>).
 *
 * Scope-local nodes carry the scope's own layer tag (`common` / `variant:<scope>`).
 * Relations that name a skill defined upstream (L0 or common) resolve as
 * cross-layer edges and the referenced target is materialized as a node with its
 * upstream layer, keeping the verifier's unknown-target invariant intact without
 * pulling the whole upstream catalog into the scope file. The document layer is an
 * L0-only concern; overrides are per-scope (templates/<scope>/docs/) since the
 * reledgev addendum. Phase targets (`phase<N>`) are pseudo-nodes, matching full-graph
 * behavior.
 *
 * ADR-0060 Amendment 2 (2026-08-28).
 * @version 1.3.0
 */
export function buildScopeGraph(scope: string): SkillGraph {
  const scopeDir = join(templatesDir, scope);
  const layer: GraphNode['layer'] = scope === 'common' ? 'common' : `variant:${scope}`;

  // Upstream skill names (L0 first, then common) available as cross-layer targets
  const upstream = new Map<string, GraphNode['layer']>();
  const upstreamDirs: Array<[string, GraphNode['layer']]> = [
    [join(ROOT, 'skills'), 'L0'],
    [join(ROOT, 'templates', 'common', 'skills'), 'common'],
  ];
  for (const [dir, upstreamLayer] of upstreamDirs) {
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !upstream.has(e.name) && existsSync(join(dir, e.name, 'SKILL.md'))) {
        upstream.set(e.name, upstreamLayer);
      }
    }
  }

  const allNodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const scopeSkills = new Set<string>();
  const scopeAgents = new Set<string>();
  // Every name an edge may legally point at: scope-local + upstream skills
  const targetSkills = new Set<string>(upstream.keys());

  const skillsDir = join(scopeDir, 'skills');
  if (existsSync(skillsDir)) {
    for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!e.isDirectory() || !existsSync(join(skillsDir, e.name, 'SKILL.md'))) continue;
      allNodes.set(e.name, { id: e.name, type: 'skill', layer });
      scopeSkills.add(e.name);
      targetSkills.add(e.name);
    }
  }

  const agentsDir = join(scopeDir, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir)) {
      if (!f.endsWith('.md') || f === 'handoff-spec.md') continue;
      const name = f.replace(/\.md$/, '');
      allNodes.set(name, { id: name, type: 'agent', layer });
      scopeAgents.add(name);
    }
  }

  // Materialize an upstream node on first reference (cross-layer edge support)
  const reference = (name: string): void => {
    if (allNodes.has(name)) return;
    const upstreamLayer = upstream.get(name);
    if (upstreamLayer) allNodes.set(name, { id: name, type: 'skill', layer: upstreamLayer });
  };

  // Source 1 + 4 (skills): prerequisites, relates_to, prose backtick references
  for (const name of scopeSkills) {
    const skillPath = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const content = readFileSync(skillPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as SkillFrontmatter;

    if (Array.isArray(frontmatter?.inputs) || Array.isArray(frontmatter?.outputs)) {
      const skillNode = allNodes.get(name);
      if (skillNode) {
        if (Array.isArray(frontmatter.inputs)) skillNode.inputs = frontmatter.inputs.filter((x: unknown) => typeof x === 'string');
        if (Array.isArray(frontmatter.outputs)) skillNode.outputs = frontmatter.outputs.filter((x: unknown) => typeof x === 'string');
      }
    }

    if (frontmatter?.prerequisites) {
      const prereqs = parsePrerequisites(frontmatter.prerequisites, targetSkills);
      for (const prereq of prereqs) {
        if (prereq !== name && targetSkills.has(prereq)) {
          reference(prereq);
          edges.push({ type: 'requires', from: name, to: prereq, source: 'prerequisites', provenance: prov(skillPath, 'prerequisites') });
        }
      }
    }

    if (frontmatter?.relates_to) {
      for (const rel of parseRelatesTo(frontmatter.relates_to, skillPath)) {
        if (rel.to !== name && targetSkills.has(rel.to)) {
          reference(rel.to);
          edges.push({
            type: rel.type,
            from: name,
            to: rel.to,
            source: 'relates_to',
            ...(rel.symmetric ? { symmetric: true as const } : {}),
            ...(rel.extra ? { extra: rel.extra } : {}),
            provenance: prov(skillPath, 'relates_to', rel.index)
          });
        }
      }
    }

    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;
    for (const ref of extractBacktickReferences(body, targetSkills)) {
      if (ref !== name) {
        reference(ref);
        edges.push({ type: 'references', from: name, to: ref, source: 'prose' });
      }
    }
  }

  // Source 2 + 4 (agents): required_skills, prose backtick references
  for (const name of scopeAgents) {
    const agentPath = join(agentsDir, `${name}.md`);
    if (!existsSync(agentPath)) continue;
    const content = readFileSync(agentPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as AgentFrontmatter;

    if (frontmatter?.required_skills && Array.isArray(frontmatter.required_skills)) {
      for (const skill of frontmatter.required_skills) {
        if (typeof skill === 'string' && targetSkills.has(skill)) {
          reference(skill);
          edges.push({ type: 'used_by', from: skill, to: name, source: 'required_skills' });
        }
      }
    }

    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;
    for (const ref of extractBacktickReferences(body, targetSkills)) {
      reference(ref);
      edges.push({ type: 'references', from: name, to: ref, source: 'prose' });
    }
  }

  // Source 3: variant.json skill_manifest (variant scopes only)
  const variantJsonPath = join(scopeDir, 'variant.json');
  if (scope.startsWith('co-') && existsSync(variantJsonPath)) {
    try {
      const variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
      const variantSpecific = variantJson?.skill_manifest?.variant_specific;
      if (Array.isArray(variantSpecific)) {
        for (const entry of variantSpecific) {
          const manifest = entry as SkillManifestEntry;
          if (!targetSkills.has(manifest.name)) continue;
          reference(manifest.name);

          if (manifest.used_by_agents && Array.isArray(manifest.used_by_agents)) {
            for (const agent of manifest.used_by_agents) {
              if (scopeAgents.has(agent)) {
                edges.push({ type: 'used_by', from: manifest.name, to: agent, source: 'skill_manifest' });
              }
            }
          }

          if (manifest.phases && Array.isArray(manifest.phases)) {
            for (const phase of manifest.phases) {
              edges.push({ type: 'phase', from: manifest.name, to: `phase${phase}`, source: 'skill_manifest' });
            }
          }
        }
      }
    } catch {
      // Invalid JSON, skip manifest
    }
  }

  // Source 4.7 (scope): procedures owned by this scope.
  deriveProceduresFromDir(join(scopeDir, 'procedures'), scope, layer, allNodes, edges);

  // Source 5 (scope): overrides from templates/<scope>/docs/skill-graph.overrides.json
  // (reledgev addendum — previously L0-only; each scope now owns its experimental layer)
  const { overrides: scopeOverrides } = loadOverridesFile(join(scopeDir, 'docs'));
  applyOverrides(scopeOverrides, allNodes, edges);

  // Sort deterministically (same ordering as buildGraph)
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
    relates_to: string[]; // includes generic relates_to + typed composes_with/follows/enables (labeled)
    used_by_agents: string[];
    phases: string[];
  }>();

  for (const node of graph.nodes) {
    if (node.type !== 'skill') continue;
    skillRelations.set(node.id, { requires: [], relates_to: [], used_by_agents: [], phases: [] });
  }

  const TYPED_LABEL: Partial<Record<EdgeType, string>> = {
    composes_with: 'composes_with', follows: 'follows', enables: 'enables'
  };

  for (const edge of graph.edges) {
    if (edge.type === 'requires' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.requires.push(edge.to);
    } else if (edge.type === 'relates_to' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.relates_to.push(edge.to);
    } else if (TYPED_LABEL[edge.type] && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.relates_to.push(`${edge.to} (${TYPED_LABEL[edge.type]})`);
    } else if (edge.type === 'used_by' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.used_by_agents.push(edge.to);
    } else if (edge.type === 'phase' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.phases.push(edge.to);
    }
  }

  // Output per-skill table
  lines.push('| Skill | Layer | Required-by Agents | Phases | Relates-to | Inputs | Outputs |');
  lines.push('|-------|-------|-------------------|--------|------------|--------|---------|');

  const allSkills = Array.from(skillRelations.keys()).sort();
  for (const skillId of allSkills) {
    const node = graph.nodes.find(n => n.id === skillId && n.type === 'skill');
    if (!node) continue;

    const relations = skillRelations.get(skillId)!;
    const agents = relations.used_by_agents.sort().join(', ') || '—';
    const phases = relations.phases.sort().join(', ') || '—';
    const relates = relations.relates_to.sort().join(', ') || '—';
    const inputs = ((node as GraphNode).inputs ?? []).join(', ') || '—';
    const outputs = ((node as GraphNode).outputs ?? []).join(', ') || '—';

    lines.push(`| \`${skillId}\` | ${node.layer} | ${agents} | ${phases} | ${relates} | ${inputs} | ${outputs} |`);
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
  lines.push('| `supersedes` | Supersession — overrides (manual) or decision-record prose labels |');
  lines.push('| `references` | Backtick reference in SKILL.md/agent/ADR body prose, or DEC `knowledge_refs[]` naming an ADR |');
  lines.push('| `cites_skill` | Decision record `skills_used[]` validated against the skill set (ADR-0061 amendment 2026-08-25) |');
  lines.push('| `composes_with` | Typed `relates_to` entry — symmetric, used together in the same phase/workflow (ADR-0060 Amendment 3) |');
  lines.push('| `follows` | Typed `relates_to` entry — sequential/ordering relation, no dependency implication (ADR-0060 Amendment 3) |');
  lines.push('| `enables` | Typed `relates_to` entry — this skill\'s output unlocks another skill/workflow (ADR-0060 Amendment 3) |');
  lines.push('| `step_uses_skill` | Procedure step → skill, derived from procedure schema.yaml (Procedure Schema v1.0) |');
  lines.push('| `step_by_agent` | Procedure step → agent, derived from procedure schema.yaml (Procedure Schema v1.0) |');
  lines.push('| `produces` | Procedure or skill → output_type node, derived per the INV-4 rule (Procedure Schema v1.0) |');
  lines.push('');
  lines.push('`composes_with` edges carry `symmetric: true` in the JSON and are stored once');
  lines.push('(source→target as declared); consumers MUST treat them as traversable both ways.');
  lines.push('Every edge additionally carries a JSON-only `provenance: {file, field, index?}`');
  lines.push('object recording exactly which frontmatter field/entry produced it (not rendered');
  lines.push('in this table). `inputs`/`outputs` are opaque per-skill labels, shown in the Skill');
  lines.push('Catalog table above — not skill references and not yet resolved as graph edges.');
  lines.push('');

  // Decisions & ADRs section (ADR-0060 amendment 2026-08-25)
  const docNodes = graph.nodes.filter(n => n.type === 'decision' || n.type === 'adr');
  if (docNodes.length > 0) {
    lines.push('## Decisions & ADRs');
    lines.push('');
    lines.push('| Document | Type | Cites skills | References | Supersedes |');
    lines.push('|----------|------|--------------|------------|------------|');
    for (const n of docNodes.sort((a, b) => a.id.localeCompare(b.id))) {
      const cites = graph.edges
        .filter(e => e.type === 'cites_skill' && e.from === n.id)
        .map(e => `\`${e.to}\``)
        .join(', ');
      const refs = graph.edges
        .filter(e => e.type === 'references' && e.from === n.id)
        .map(e => e.to)
        .join(', ');
      const sup = graph.edges
        .filter(e => e.type === 'supersedes' && e.from === n.id)
        .map(e => e.to)
        .join(', ');
      lines.push(`| \`${n.id}\` | ${n.type} | ${cites || '—'} | ${refs || '—'} | ${sup || '—'} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scopeIdx = args.indexOf('--scope');

  // ── Scope mode: single template layer → templates/<scope>/docs/skill-graph.json ──
  if (scopeIdx !== -1) {
    const scope = args[scopeIdx + 1];
    if (!scope || (scope !== 'common' && !scope.startsWith('co-')) || !existsSync(join(templatesDir, scope))) {
      console.error(`ERROR: --scope must be 'common' or an existing templates/co-* directory (got: ${scope ?? '(missing)'})`);
      process.exit(1);
    }

    console.log(`Generating skill relationship graph for scope: ${scope}`);
    const graph = buildScopeGraph(scope);

    const outDir = join(templatesDir, scope, 'docs');
    if (!existsSync(outDir)) {
      mkdirSync(outDir, { recursive: true });
    }
    const jsonPath = join(outDir, 'skill-graph.json');
    writeFileSync(jsonPath, JSON.stringify(graph, null, 2));
    console.log(`✓ Generated: ${jsonPath}`);

    const skillNodes = graph.nodes.filter(n => n.type === 'skill');
    console.log('');
    console.log('Statistics:');
    console.log(`  Nodes: ${graph.nodes.length} total (${skillNodes.length} skills, ${graph.nodes.length - skillNodes.length} agents)`);
    const nodesByLayer = new Map<string, number>();
    for (const node of graph.nodes) {
      nodesByLayer.set(node.layer, (nodesByLayer.get(node.layer) || 0) + 1);
    }
    for (const [nodeLayer, count] of Array.from(nodesByLayer.entries()).sort()) {
      console.log(`    - ${nodeLayer}: ${count}`);
    }
    return;
  }

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
