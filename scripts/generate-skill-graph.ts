#!/usr/bin/env bun
/**
 * Skill Relationship Graph Generator
 * @version 2.0.0 (2026-10-08, design docs/designs/2026-10-08-skill-graph-v2-scoped-identity-design.md,
 * ADR-0060 Amendment 11): skill-graph schema v2 (`graph_profile: deg/v2`) for the full graph.
 * Skill/agent/phase node ids are `type:scope/name`; copies of the same name with identical
 * normalized content collapse to one node (scope = highest-precedence location, `mirrors[]`
 * lists every path), distinct content under one name yields one node per hash. Every skill/agent
 * node carries name, scope, content_hash, version, capability (frontmatter `capability`, default
 * = name; the fleet-convergence grouping key), mirrors. Edges resolve names scope-first (same
 * variant, then common, then root). `phase:<scope>/<n>` nodes are emitted (G3), duplicate
 * (from,to,type) edges are dropped (G4). New: `--impact <skill>` (E1, read-only), usage attribute
 * from memory `## Skills Used` (E3), report-only required_by suggestions (E4), isolated-node and
 * no-used_by reports (G5/G6) in docs/skill-graph.md. buildScopeGraph (per-template scope graphs)
 * intentionally stays on the v1 shape; all readers go through scripts/lib/skill-graph-compat.ts.
 * @version 1.15.0 (2026-10-06, T-20261005-022 / D8 of
 * docs/designs/2026-10-05-consult-abap-develop-review-remediation-design.md):
 * buildScopeGraph agent discovery now applies the same README- and
 * underscore-prefix exclusion as the full-graph variant pass (v1.13.0) —
 * scope-mode regeneration was still emitting README/README_ko as
 * type:"agent" nodes (co-consult/co-abap/co-develop committed graphs; DH1
 * of the 2026-10-05 scoped review). verify-skill-graph.ts imports
 * buildScopeGraph, so the scope derivation and the verifier share this one
 * rule.
 * @version 1.14.0 (2026-09-23, T-20260923-002 triage): variant citation corpus
 * widened — docs/*.md top-level files, README.md, recursive agents/** and
 * workflows/** added per variant, plus path-fragment and README plain-mention
 * matching, connecting the graph-isolated co-safety/co-price skills that were
 * cited only from user guides, workflow catalogs, and nested agent bodies.
 * @version 1.13.0 (2026-09-23, orphan audit T-20260923-001): variant agent
 * discovery skips README and underscore-prefixed files (co-abap agents/README.md
 * was emitted as an "agent" node); new Source 4.8 workflow-doc citations — a
 * bounded corpus (platform/agent context docs + procedures/ + process/, L0 and
 * per-variant) mints `doc:` nodes and `cites_skill` edges so
 * workflow-dispatched skills are no longer graph-isolated (L0 isolated
 * 12 → 0, variant 48 → 17).
 * @version 1.12.0 (ADR-0084 Actor Model, 2026-09-19): emit human_role nodes
 * from governance/_human-roles.yaml; add actor_type edge attribute to RACI
 * edges (accountable_for, consulted_on, informed_of, step_by_agent); resolve
 * actor type per derivation rule §3.1 (human-roles registry takes precedence
 * over agent files).
 *
 * v1.11.1 (P5 defect fix, 2026-09-19): decides_on edge target now
 * uses the canonical `output_type.<name>` node ID prefix instead of the bare
 * gate.inputs[] string, fixing ghost/unknown-target edges caught by
 * dev-sync's per-scope graph verification (same bug class as the P4
 * procedure-ID mismatch).
 *
 * v1.11.0 (2026-09-19): add DEG (Domain Execution Graph) support per ADR-0083 —
 * emit stage nodes from process/stages.yaml, stage_follows edges between ordered
 * stages, in_stage edges from procedure.stage field, and graph_profile: "deg/v1"
 * marker. Defensively define (zero-instance) node/edge types for decision gates,
 * evidence models, and RACI edges, ready for P4/P5. Exclude DEG sources from
 * skill-graph.overrides.json eligibility per ADR-0060 Amendment 10 (forthcoming).
 * v1.10.0 (2026-09-11): render the term vocabulary in docs/skill-graph.md —
 * a "## Korean Term Vocabulary (terms-ko.json)" table (term | layer |
 * referencing skills) after Decisions & ADRs; Edge Types table's `references`
 * row now mentions term nodes. Resolves the ADR-0072 open question; the JSON
 * remains the machine SSOT.
 * v1.9.0 (2026-09-11): Source 1b — term-node extraction per ADR-0072. Each
 * skill's references/terms-ko.json (non-Markdown asset, CONSTITUTION §6.7)
 * contributes `term:<용어>` nodes plus skill→term `references` edges, making
 * the k-* family's Korean domain vocabulary a first-class graph query. Dual-
 * form entry values (plain glossary string, or object with `en`/`mapsTo` and
 * an optional nested `items` map) are both parsed; malformed JSON files are
 * skipped so the build stays deterministic. GraphNode.type union extended
 * with 'term' (additive; existing consumers unaffected).
 * v1.8.5 (2026-09-09): ignore untracked/ignored workspace-root procedures/
 * directories when deriving the L0 graph. Local disposable procedure fixtures
 * must not make `bun scripts/audit.ts` fail on one checkout while CI stays green;
 * tracked root procedure schemas are still included.
 * v1.8.4 (2026-09-08): fix — variant directory discovery (skill/agent/
 * procedure-derived output_type dedup) now sorts `templates/co-*` names in
 * deterministic ascending lexical order (locale-independent, not
 * `localeCompare`) before the existing first-wins logic runs; previously
 * `readdirSync`'s OS/filesystem-dependent order caused any id duplicated
 * across two or more variants to resolve to a different "owning" variant
 * on different machines (observed: alphabetical on Windows/NTFS, not on
 * the environment that generated the previously-committed graph).
 * v1.8.3 (2026-08-29): upstreams the three co-newbiz fork adaptations so
 * scaffolded projects no longer need a local generator fork:
 * 1. L0/L3 detection keys on `templates/common` (projects may carry content
 *    template dirs like templates/deliverables/ without being the L0 root).
 * 2. Source 3b: a scaffolded project's own variant.json skill_manifest now
 *    yields used_by/phase edges (previously only templates/co-* manifests did).
 * 3. Agent discovery skips README*.md and _*.md files in agents/.
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

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';
import { contentHash, frontmatterVersion, scopeOfLayer, dedupeEdges, splitScopedId, upgradeSkillGraph, capabilityOf, nameOf, findCapabilityDivergence } from './lib/skill-graph-compat.ts';
import type { SkillGraphV2 } from './lib/skill-graph-compat.ts';
import { PLATFORM_MIRROR_DIRS } from './lib/platforms.ts';
import { parseSkillsUsed } from './lib/skills-used.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// SKILL_GRAPH_ROOT overrides the derived workspace root (test fixtures only; never set in pipelines).
const ROOT = process.env.SKILL_GRAPH_ROOT ? resolve(process.env.SKILL_GRAPH_ROOT) : resolve(__dirname, '..');
const templatesDir = join(ROOT, 'templates');
// Run-context detection: the workspace root is the only context that has a
// templates/common (platform template layer) directory. Scaffolded projects may
// carry their own content template dirs (e.g. templates/deliverables/) without
// being the L0 root — key on templates/common so local assets there are tagged
// L3, not L0.
const localLayer: 'L0' | 'L3' = existsSync(join(templatesDir, 'common')) ? 'L0' : 'L3';

function hasTrackedFilesUnder(absDir: string): boolean {
  if (!existsSync(absDir)) return false;
  try {
    const rel = relative(ROOT, absDir).replace(/\\/g, '/');
    const out = execFileSync('git', ['ls-files', '--', rel], {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().length > 0;
  } catch {
    // Non-git or restricted environments should keep the historical behavior.
    return true;
  }
}

// Interfaces for the graph structure
export interface GraphNode {
  id: string;
  // 'term' = Korean vocabulary node extracted from a skill's
  // references/terms-ko.json (ADR-0072); id is namespaced `term:<용어>`.
  // 'stage' = domain execution stage node (DEG, ADR-0083); id form: `stage.<variant>.<id>`
  // 'decision_gate' = decision gate node (DEG, ADR-0083); id form: `gate.<variant>.<id>`
  // 'evidence_model' = evidence schema node (DEG, ADR-0083); id form: `evidence.<variant>.<name>`
  // 'phase' = lifecycle phase node (v2, G3); id form: `phase:<scope>/<n>`
  type: 'skill' | 'agent' | 'decision' | 'adr' | 'procedure' | 'output_type' | 'term' | 'stage' | 'decision_gate' | 'evidence_model' | 'human_role' | 'doc' | 'phase';
  layer: 'L0' | 'L3' | 'common' | `variant:${string}`;
  /** Opaque input/output labels from SKILL.md frontmatter (skill nodes only). */
  inputs?: string[];
  outputs?: string[];
  // ── v2 identity (skill/agent nodes; phase nodes carry scope/ordinal/label) ──
  name?: string;
  scope?: string;
  /** Cross-project grouping key (frontmatter `capability`, default = name). */
  capability?: string;
  /** sha256/16 of the normalized SKILL.md/agent .md; null for synthetic nodes. */
  content_hash?: string | null;
  version?: string | null;
  /** Every tracked path carrying identical content (primary first). */
  mirrors?: string[];
  /** E3: memory `## Skills Used` join (omitted when never used). Excluded from drift comparison. */
  usage?: { sessions: number; last_used: string | null };
  ordinal?: number;
  label?: string;
}

type EdgeType =
  | 'requires' | 'relates_to' | 'used_by' | 'phase' | 'supersedes' | 'references' | 'cites_skill'
  // ADR-0060 Amendment 3 (2026-08-29): typed relation vocabulary
  | 'composes_with' | 'follows' | 'enables'
  // Procedure Schema v1.0 (2026-08-29): procedure-derived edges (canonical
  // source = templates/<variant>/procedures/<name>/schema.yaml — INV-1, see
  // docs/designs/2026-08-29-procedure-schema-design.md)
  | 'step_uses_skill' | 'step_by_agent' | 'produces'
  // Domain Execution Graph (ADR-0083): stage-axis, RACI, decision, evidence edges
  | 'in_stage' | 'stage_follows' | 'accountable_for' | 'consulted_on' | 'informed_of'
  | 'gated_by' | 'decides_on' | 'evidenced_by';

// Typed `relates_to` entry shape is a *forward-open* object: {skill, type} are
// the only two fields Phase 1 interprets. Any additional key (e.g. a future
// `status`/`version`/`confidence`) is preserved unmodified and passed through
// on `extra`, never validated or acted on by this phase. See Amendment 3 §C.
interface EdgeProvenance {
  file: string;
  field: string;
  index?: number;
}

export interface GraphEdge {
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
  /** Actor type ("human"|"agent") on RACI edges (accountable_for, consulted_on, informed_of, step_by_agent) per ADR-0084. */
  actor_type?: "human" | "agent";
}

export interface SkillGraph {
  version: 1 | 2;
  graph_profile?: 'deg/v1' | 'deg/v2';
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
 * Locale-independent ascending lexical comparator (plain UTF-16 code-unit
 * ordering via `<`/`>`), deliberately not `String.localeCompare` — that API's
 * ordering can vary by ICU version/locale, which would reintroduce exactly
 * the kind of cross-environment non-determinism this comparator exists to
 * eliminate. Exported for direct unit testing.
 */
export function compareVariantNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * List variant template directories (`templates/co-*`) in deterministic
 * ascending lexical order by directory name. The first-wins dedup logic in
 * discoverNodes() and the procedure-derivation loop (Source 4.7) picks an
 * alphabetically-first-variant-as-deterministic-canonical-representative for
 * any skill/agent/output_type id that happens to exist in more than one
 * variant, based on iteration order — `readdirSync`'s own order is
 * unspecified and differs across OS/filesystem (observed: sorted on
 * Windows/NTFS, unsorted on Linux/ext4), so callers must sort explicitly to
 * get a stable, portable result. This is a deterministic tie-break, not a
 * semantic ownership judgment.
 */
export function listVariantDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-'))
    .map(e => e.name)
    .sort(compareVariantNames);
}

/** One on-disk copy of a skill/agent file. */
interface NodeCopy {
  scope: string;
  layer: GraphNode['layer'];
  abs: string;
  rel: string;
  hash: string;
  version: string | null;
  capability: string;
}

/**
 * v2 node registry: skill/agent nodes keyed `type:scope/name`, one per distinct
 * (type, name, content_hash). Identical copies collapse onto the node of the
 * highest-precedence location (root > common > variants alphabetical).
 */
export interface Registry {
  skills: GraphNode[];
  agents: GraphNode[];
  /** `${type}:${name}` -> nodes, in precedence order. */
  byKey: Map<string, GraphNode[]>;
  /** node id -> copies (primary first). */
  copies: Map<string, NodeCopy[]>;
  skillNames: Set<string>;
  agentNames: Set<string>;
  /** `${type}:${name}` keys that were resolved without any scope match (first-wins fallback). */
  ambiguous: Set<string>;
}

function relPath(abs: string): string {
  return relative(ROOT, abs).replace(/\\/g, '/');
}

function frontmatterCapability(content: string, fallback: string): string {
  const fm = parseFrontmatter(content) as Record<string, unknown> | null;
  const cap = fm?.capability;
  return typeof cap === 'string' && cap.trim() ? cap.trim() : fallback;
}

function readCopy(abs: string, scope: string, layer: GraphNode['layer'], name: string): NodeCopy {
  const content = readFileSync(abs, 'utf-8');
  return {
    scope,
    layer,
    abs,
    rel: relPath(abs),
    hash: contentHash(content),
    version: frontmatterVersion(content),
    capability: frontmatterCapability(content, name),
  };
}

/** Is `dir` safe to list as platform mirror evidence (tracked, so CI and local agree)? */
const trackedDirCache = new Map<string, boolean>();
function isTrackedMirrorDir(absDir: string): boolean {
  if (!trackedDirCache.has(absDir)) trackedDirCache.set(absDir, hasTrackedFilesUnder(absDir));
  return trackedDirCache.get(absDir)!;
}

/**
 * Discover all skills and agents in the workspace as v2 nodes (scoped ids,
 * identical-content collapse, capability key). Iteration order is the scope
 * precedence order, so the first copy of a group is its primary location.
 */
function discoverRegistry(): Registry {
  const skillGroups = new Map<string, { name: string; copies: NodeCopy[] }>();
  const agentGroups = new Map<string, { name: string; copies: NodeCopy[] }>();

  const addCopy = (groups: Map<string, { name: string; copies: NodeCopy[] }>, name: string, copy: NodeCopy): void => {
    const key = `${name}\u0000${copy.hash}`;
    if (!groups.has(key)) groups.set(key, { name, copies: [] });
    groups.get(key)!.copies.push(copy);
  };

  const scanSkills = (dir: string, scope: string, layer: GraphNode['layer']): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(dir, entry.name, 'SKILL.md');
      if (existsSync(skillFile)) addCopy(skillGroups, entry.name, readCopy(skillFile, scope, layer, entry.name));
    }
  };
  const scanAgents = (dir: string, scope: string, layer: GraphNode['layer'], skipHandoff: boolean): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      // Exclude folder READMEs and _-prefixed files (directory docs, not agents) —
      // scaffolded projects' agents/ dirs carry them (2026-09-23 orphan audit).
      if (!entry.endsWith('.md') || /^README/.test(entry) || entry.startsWith('_')) continue;
      if (skipHandoff && entry === 'handoff-spec.md') continue;
      const name = entry.replace('.md', '');
      addCopy(agentGroups, name, readCopy(join(dir, entry), scope, layer, name));
    }
  };

  // Precedence order: root, common, variants (alphabetical, locale-independent).
  scanSkills(join(ROOT, 'skills'), 'root', localLayer);
  scanSkills(join(ROOT, 'templates', 'common', 'skills'), 'common', 'common');
  const variants = existsSync(templatesDir) ? listVariantDirs(templatesDir) : [];
  for (const v of variants) scanSkills(join(templatesDir, v, 'skills'), v, `variant:${v}`);

  scanAgents(join(ROOT, 'agents'), 'root', localLayer, true);
  scanAgents(join(ROOT, 'templates', 'common', 'agents'), 'common', 'common', true);
  for (const v of variants) scanAgents(join(templatesDir, v, 'agents'), v, `variant:${v}`, false);

  const copies = new Map<string, NodeCopy[]>();
  const byKey = new Map<string, GraphNode[]>();
  const build = (type: 'skill' | 'agent', groups: Map<string, { name: string; copies: NodeCopy[] }>): GraphNode[] => {
    const nodes: GraphNode[] = [];
    for (const g of groups.values()) {
      const primary = g.copies[0];
      const id = `${type}:${primary.scope}/${g.name}`;
      const mirrors = g.copies.map((c) => c.rel);
      if (type === 'skill') {
        for (const dir of PLATFORM_MIRROR_DIRS) {
          const absDir = join(ROOT, dir);
          if (!isTrackedMirrorDir(absDir)) continue;
          const f = join(absDir, g.name, 'SKILL.md');
          if (!existsSync(f)) continue;
          try {
            if (contentHash(readFileSync(f, 'utf-8')) === primary.hash) mirrors.push(relPath(f));
          } catch { /* unreadable mirror: not evidence */ }
        }
      }
      const node: GraphNode = {
        id,
        type,
        layer: primary.layer,
        name: g.name,
        scope: primary.scope,
        capability: primary.capability,
        content_hash: primary.hash,
        version: primary.version,
        mirrors,
      };
      nodes.push(node);
      copies.set(id, g.copies);
      const key = `${type}:${g.name}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(node);
    }
    return nodes;
  };
  const skills = build('skill', skillGroups);
  const agents = build('agent', agentGroups);

  return {
    skills,
    agents,
    byKey,
    copies,
    skillNames: new Set(skills.map((n) => n.name!)),
    agentNames: new Set(agents.map((n) => n.name!)),
    ambiguous: new Set(),
  };
}

/** Every scope a node's content lives in (primary scope first). */
function scopesOf(reg: Registry, node: GraphNode): string[] {
  const out: string[] = [node.scope ?? scopeOfLayer(node.layer)];
  for (const c of reg.copies.get(node.id) ?? []) if (!out.includes(c.scope)) out.push(c.scope);
  return out;
}

/**
 * Scope-first name resolution: nodes living in any scope of `ctx` (in order), then
 * `common`, then `root`; otherwise the first candidate (recorded as ambiguous when
 * several exist). Unknown names return undefined.
 */
function resolveNode(reg: Registry, type: 'skill' | 'agent', name: string, ctx: string[]): GraphNode | undefined {
  const cands = reg.byKey.get(`${type}:${name}`);
  if (!cands || cands.length === 0) return undefined;
  if (cands.length === 1) return cands[0];
  for (const scope of [...ctx, 'common', 'root']) {
    const hit = cands.find((n) => scopesOf(reg, n).includes(scope));
    if (hit) return hit;
  }
  reg.ambiguous.add(`${type}:${name}`);
  return cands[0];
}

/** Primary on-disk file of a skill/agent node. */
function primaryPath(reg: Registry, node: GraphNode): string {
  return reg.copies.get(node.id)![0].abs;
}

/** Resolution context for edges authored inside a node's content. */
function ctxOfNode(reg: Registry, node: GraphNode): string[] {
  return scopesOf(reg, node);
}

/**
 * Bridges the shared derive* helpers to either the v2 registry (scoped ids) or the
 * v1 bare-id universe used by buildScopeGraph.
 */
interface Linker {
  /** Resolve (or materialize) a skill referenced from `ctx`; returns the node id. */
  skillId(key: string, ctx: string[], layer: GraphNode['layer'], allNodes: Map<string, GraphNode>): string;
  /** Resolve an agent key to a node id, or undefined if no such agent exists. */
  agentId(key: string, ctx: string[], allNodes: Map<string, GraphNode>): string | undefined;
}

const LEGACY_LINKER: Linker = {
  skillId(key, _ctx, layer, allNodes) {
    if (!allNodes.has(key)) allNodes.set(key, { id: key, type: 'skill', layer });
    return key;
  },
  agentId(key, _ctx, allNodes) {
    return allNodes.has(key) ? key : undefined;
  },
};

function registryLinker(reg: Registry): Linker {
  return {
    skillId(key, ctx, layer, allNodes) {
      const hit = resolveNode(reg, 'skill', key, ctx);
      if (hit) return hit.id;
      // Nested skill keys (e.g. co-safety `daily/risk-assessment`) live below the flat
      // discovery depth — materialize a synthetic, hash-less skill node in the caller's scope.
      const scope = ctx[0] ?? 'root';
      const id = `skill:${scope}/${key}`;
      if (!allNodes.has(id)) {
        allNodes.set(id, { id, type: 'skill', layer, name: key, scope, capability: key, content_hash: null, version: null, mirrors: [] });
      }
      return id;
    },
    agentId(key, ctx) {
      return resolveNode(reg, 'agent', key, ctx)?.id;
    },
  };
}

/**
 * Load the human-roles registry for a variant/scope dir, if present
 * (ADR-0084, §3.4). Shared by deriveProceduresFromDir and deriveRACIFromYaml.
 */
function loadHumanRoles(variantDir: string): Set<string> {
  const humanRoles = new Set<string>();
  const humanRolesPath = join(variantDir, 'governance', '_human-roles.yaml');
  if (existsSync(humanRolesPath)) {
    try {
      const hrData = yamlLoad(readFileSync(humanRolesPath, 'utf-8')) as any;
      if (hrData?.human_roles && typeof hrData.human_roles === 'object') {
        for (const key of Object.keys(hrData.human_roles)) {
          humanRoles.add(key);
        }
      }
    } catch {
      // Ignore parse errors for human-roles
    }
  }
  return humanRoles;
}

/** Check if an agent file exists anywhere in the workspace (any variant, or workspace-root agents/). */
function agentFileExists(agentKey: string): boolean {
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const variant of readdirSync(templatesDir)) {
      const agentPath = join(templatesDir, variant, 'agents', `${agentKey}.md`);
      if (existsSync(agentPath)) return true;
    }
  }
  const workspaceAgentPath = join(ROOT, 'agents', `${agentKey}.md`);
  if (existsSync(workspaceAgentPath)) return true;
  return false;
}

/**
 * Resolve actor type for an agent key per derivation rule (ADR-0084, §3.1):
 * human-roles registry membership takes precedence over agent-file existence;
 * omit the attribute entirely (return undefined) if neither matches.
 */
function resolveActorType(agentKey: string, humanRoles: Set<string>): "human" | "agent" | undefined {
  if (humanRoles.has(agentKey)) return "human";
  if (agentFileExists(agentKey)) return "agent";
  return undefined;
}

/** E4 collector: (procedure, skill, agent) triples seen while deriving procedure steps. */
let stepPairSink: Array<{ procedure: string; skill: string; agent: string }> | null = null;

/**
 * Derive procedure/output_type nodes and procedure edges from a directory of
 * procedure schemas (<dir>/<name>/schema.yaml). Shared by buildGraph (variant
 * templates + the root l0 namespace) and buildScopeGraph (per-scope artifacts).
 *
 * Produces-edge rule (INV-4): procedure-level outputs[] → procedure →
 * output_type; a step output_type NOT in outputs[] → the step's skill →
 * output_type. Node ids: `procedure.<namespace>.<name>`,
 * `output_type.<type>`.
 *
 * `variantDir` (optional) is the variant/scope root used to resolve the
 * human-roles registry for `step_by_agent` edge `actor_type` tagging
 * (ADR-0084 §3.4). When omitted, `actor_type` is not attached.
 */
function deriveProceduresFromDir(
  procDir: string,
  namespace: string,
  layer: GraphNode['layer'],
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  variantDir?: string,
  link: Linker = LEGACY_LINKER,
): void {
  if (!existsSync(procDir)) return;

  const humanRoles = variantDir ? loadHumanRoles(variantDir) : new Set<string>();

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
    // Scope context for skill/agent name resolution (v2): the procedure's own variant first.
    const ctx = [ns === 'l0' ? 'root' : ns];
    allNodes.set(procId, { id: procId, type: 'procedure', layer });

    const ensureOutputType = (type: string): void => {
      const id = `output_type.${type}`;
      if (!allNodes.has(id)) {
        allNodes.set(id, { id, type: 'output_type', layer });
      }
    };
    // Resolve a procedure's skill key scope-first; nested skill keys (e.g. co-safety
    // `daily/risk-assessment`) may exist on disk below the flat discovery depth — the
    // linker materializes them as skill nodes so the unknown-target invariant holds.
    const skillRef = (key: string): string => link.skillId(key, ctx, layer, allNodes);

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
        let stepSkillId: string | undefined;
        if (typeof step.skill_key === 'string' && step.skill_key) {
          stepSkillId = skillRef(step.skill_key);
          edges.push({ type: 'step_uses_skill', from: procId, to: stepSkillId, source: 'procedure_schema' });
          if (typeof step.output_type === 'string' && step.output_type && !procedureOutputs.has(step.output_type)) {
            ensureOutputType(step.output_type);
            edges.push({ type: 'produces', from: stepSkillId, to: `output_type.${step.output_type}`, source: 'procedure_schema' });
          }
        }
        const stepAgentId = typeof step.agent_key === 'string' && step.agent_key ? link.agentId(step.agent_key, ctx, allNodes) : undefined;
        // E4 evidence: a step that names both a skill and an owning agent.
        if (stepSkillId && stepAgentId) stepPairSink?.push({ procedure: procId, skill: stepSkillId, agent: stepAgentId });
        if (stepAgentId) {
          const actorType = variantDir ? resolveActorType(step.agent_key, humanRoles) : undefined;
          edges.push({
            type: 'step_by_agent',
            from: procId,
            to: stepAgentId,
            source: 'procedure_schema',
            ...(actorType && { actor_type: actorType }),
          });
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
          edges.push({ type, from: procId, to: skillRef(skillMatch[1]), source: 'procedure_schema' });
        }
      }
    }

    // in_stage edge (ADR-0083): procedure → stage, derived from procedure stage: field
    if (typeof data.stage === 'string' && data.stage) {
      const stageId = `stage.${ns}.${data.stage}`;
      // Materialize stage node if it doesn't exist (deferred variants may not have stages.yaml)
      if (!allNodes.has(stageId)) {
        allNodes.set(stageId, { id: stageId, type: 'stage', layer });
      }
      edges.push({ type: 'in_stage', from: procId, to: stageId, source: 'process_schema' });
    }
  }
}

/**
 * Extract Korean term keys from one category map of a terms-ko.json file
 * (ADR-0072). Category values are either a plain string (glossary-only) or a
 * term object carrying `en`/`mapsTo`; a term object may nest an `items` map
 * (table → item vocabulary) whose keys are terms in their own right.
 * Keys starting with `_` are metadata, never terms.
 */
function extractTermsFromCategory(entries: [string, unknown][], out: Set<string>): void {
  for (const [key, val] of entries) {
    if (key.startsWith('_')) continue;
    if (typeof val === 'string') {
      out.add(key);
      continue;
    }
    if (val === null || typeof val !== 'object') continue;
    const entry = val as Record<string, unknown>;
    if (typeof entry.en === 'string' || entry.mapsTo !== undefined) out.add(key);
    const items = entry.items;
    if (items === null || typeof items !== 'object') continue;
    for (const [itemKey, itemVal] of Object.entries(items as Record<string, unknown>)) {
      if (itemKey.startsWith('_')) continue;
      if (typeof itemVal === 'string') {
        out.add(itemKey);
      } else if (itemVal !== null && typeof itemVal === 'object') {
        const itemEntry = itemVal as Record<string, unknown>;
        if (typeof itemEntry.en === 'string' || itemEntry.mapsTo !== undefined) out.add(itemKey);
      }
    }
  }
}

/**
 * Source 1b (ADR-0072): read each skill's references/terms-ko.json and emit a
 * `term:<용어>` node plus a skill → term `references` edge. JSON-only source —
 * a malformed file is skipped (never fails the build); data freshness is the
 * per-skill drift-check script's job, not the generator's.
 */
function deriveTermNodesAndEdges(
  reg: Registry,
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): void {
  for (const node of reg.skills) {
    const skillDir = dirname(primaryPath(reg, node));
    const termsPath = join(skillDir, 'references', 'terms-ko.json');
    if (!existsSync(termsPath)) continue;

    try {
      const termsJson = JSON.parse(readFileSync(termsPath, 'utf-8')) as Record<string, unknown>;
      // Root level: skip metadata keys (`_note`, `version`, `verified`), walk
      // each category map.
      const terms = new Set<string>();
      for (const [key, val] of Object.entries(termsJson)) {
        if (key.startsWith('_') || key === 'version' || key === 'verified') continue;
        if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
          extractTermsFromCategory(Object.entries(val as Record<string, unknown>), terms);
        }
      }
      for (const term of terms) {
        const termId = `term:${term}`;
        if (!allNodes.has(termId)) {
          allNodes.set(termId, { id: termId, type: 'term', layer: node.layer });
        }
        edges.push({
          type: 'references',
          from: node.id,
          to: termId,
          source: 'terms-ko.json',
          provenance: prov(termsPath, 'terms-ko.json')
        });
      }
    } catch {
      // Malformed terms-ko.json — skip; drift-check scripts own data quality.
    }
  }
}

/**
 * Derive stage nodes and stage_follows edges from process/stages.yaml (ADR-0083).
 * Stages are optional; the function gracefully skips if stages.yaml does not exist.
 * Source: process_schema
 */
function deriveStagesFromYaml(
  stagesPath: string,
  variant: string,
  layer: GraphNode['layer'],
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): void {
  if (!existsSync(stagesPath)) return;

  let data: any;
  try {
    data = yamlLoad(readFileSync(stagesPath, 'utf-8'));
  } catch {
    // Malformed stages.yaml — skip; the validator owns its quality
    return;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.stages)) return;

  const stages = data.stages as Array<{ id: string; order?: number }>;
  const stageMap = new Map<number, string>();

  for (const stage of stages) {
    if (typeof stage.id !== 'string') continue;
    const stageId = `stage.${variant}.${stage.id}`;
    if (!allNodes.has(stageId)) {
      allNodes.set(stageId, { id: stageId, type: 'stage', layer });
    }
    if (typeof stage.order === 'number') {
      stageMap.set(stage.order, stage.id);
    }
  }

  // stage_follows edges: stage with order N → stage with order N+1
  const sortedOrders = Array.from(stageMap.keys()).sort((a, b) => a - b);
  for (let i = 0; i < sortedOrders.length - 1; i++) {
    const fromId = stageMap.get(sortedOrders[i])!;
    const toId = stageMap.get(sortedOrders[i + 1])!;
    edges.push({
      type: 'stage_follows',
      from: `stage.${variant}.${fromId}`,
      to: `stage.${variant}.${toId}`,
      source: 'process_schema',
    });
  }
}

/**
 * Derive RACI edges from raci.yaml (ADR-0083 P4, ADR-0084 §3.4)
 * Creates accountable_for, consulted_on, informed_of, and step_by_agent edges
 * Emits human_role nodes and actor_type edge attributes per ADR-0084
 */
function deriveRACIFromYaml(
  raciPath: string,
  variant: string,
  layer: GraphNode['layer'],
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  variantDir: string,
  link: Linker = LEGACY_LINKER,
): void {
  if (!existsSync(raciPath)) return;

  let data: any;
  try {
    data = yamlLoad(readFileSync(raciPath, 'utf-8'));
  } catch {
    // Malformed raci.yaml — skip; the validator owns its quality
    return;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.rows)) return;

  // Load human-roles registry if present (ADR-0084, §3.4)
  const humanRoles = loadHumanRoles(variantDir);
  const ctx = [variant === 'l0' ? 'root' : variant];
  // Agent key -> node id when an agent file exists, else the bare key (human_role / unknown).
  const actorId = (key: string): string => link.agentId(key, ctx, allNodes) ?? key;

  const rows = data.rows as Array<{
    activity?: string;
    accountable?: string;
    responsible?: string[];
    consulted?: string[];
    informed?: string[];
    actor_types?: Record<string, "human" | "agent">;
  }>;

  for (const row of rows) {
    if (typeof row.activity !== 'string') continue;

    // Ensure procedure node exists
    const procId = row.activity;
    if (!allNodes.has(procId)) {
      allNodes.set(procId, { id: procId, type: 'procedure', layer });
    }

    // Create human_role nodes for any human roles appearing in this row (ADR-0084)
    if (row.actor_types && typeof row.actor_types === 'object') {
      for (const [agentKey, actorType] of Object.entries(row.actor_types)) {
        if (actorType === 'human') {
          const humanRoleId = agentKey;
          if (!allNodes.has(humanRoleId) && link.agentId(humanRoleId, ctx, allNodes) === undefined) {
            allNodes.set(humanRoleId, { id: humanRoleId, type: 'human_role', layer });
          }
        }
      }
    }

    // accountable_for edge: accountable agent → procedure (one per row)
    if (typeof row.accountable === 'string') {
      const actorType = row.actor_types?.[row.accountable];
      edges.push({
        type: 'accountable_for',
        from: actorId(row.accountable),
        to: procId,
        source: 'raci_matrix',
        ...(actorType && { actor_type: actorType }),
      });
    }

    // consulted_on edges: each consulted agent → procedure
    if (Array.isArray(row.consulted)) {
      for (const agent of row.consulted) {
        if (typeof agent === 'string') {
          const actorType = row.actor_types?.[agent];
          edges.push({
            type: 'consulted_on',
            from: actorId(agent),
            to: procId,
            source: 'raci_matrix',
            ...(actorType && { actor_type: actorType }),
          });
        }
      }
    }

    // informed_of edges: each informed agent → procedure
    if (Array.isArray(row.informed)) {
      for (const agent of row.informed) {
        if (typeof agent === 'string') {
          const actorType = row.actor_types?.[agent];
          edges.push({
            type: 'informed_of',
            from: actorId(agent),
            to: procId,
            source: 'raci_matrix',
            ...(actorType && { actor_type: actorType }),
          });
        }
      }
    }
  }
}

/**
 * Derive decision gates from decisions/gates.yaml (ADR-0083 P5)
 * Creates decision_gate nodes, gated_by edges (stage → gate), and decides_on edges (gate → output_type)
 */
function deriveDecisionGatesFromYaml(
  gatesPath: string,
  variant: string,
  layer: GraphNode['layer'],
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
): void {
  if (!existsSync(gatesPath)) return;

  let data: any;
  try {
    data = yamlLoad(readFileSync(gatesPath, 'utf-8'));
  } catch {
    // Malformed gates.yaml — skip; the validator owns its quality
    return;
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.gates)) return;

  const gates = data.gates as Array<{
    id?: string;
    stage?: string;
    inputs?: string[];
  }>;

  for (const gate of gates) {
    if (typeof gate.id !== 'string') continue;

    // Create decision_gate node
    const gateId = `gate.${variant}.${gate.id}`;
    if (!allNodes.has(gateId)) {
      allNodes.set(gateId, { id: gateId, type: 'decision_gate', layer });
    }

    // gated_by edge: stage → decision_gate
    if (typeof gate.stage === 'string') {
      const stageId = `stage.${variant}.${gate.stage}`;
      edges.push({
        type: 'gated_by',
        from: stageId,
        to: gateId,
        source: 'decision_model',
      });
    }

    // decides_on edges: decision_gate → output_type (for each input)
    if (Array.isArray(gate.inputs)) {
      for (const outputType of gate.inputs) {
        if (typeof outputType === 'string') {
          edges.push({
            type: 'decides_on',
            from: gateId,
            to: `output_type.${outputType}`,
            source: 'decision_model',
          });
        }
      }
    }
  }
}

/**
 * Build the skill graph from all sources
 * Exported for use by verify-skill-graph.ts
 */
/**
 * Source 4.8 — Workflow-doc citations (2026-09-23 orphan audit, ticket
 * T-20260923-001). The prose scan (Source 4) only reads SKILL.md and agent
 * bodies, so skills dispatched purely through workflow documents were
 * graph-isolated despite 16–146 doc references each (12 L0 + 48 variant
 * skills). This scan walks a BOUNDED workflow-doc corpus — L0: the four
 * platform/agent context docs + procedures/ + process/; per variant: AGENTS.md,
 * docs/phase-definitions.md, procedures/ + process/ — and for every file that
 * cites at least one known skill (backtick mention or `skills/<name>/` path)
 * mints a `doc:` node and `cites_skill` edges. Doc nodes only materialize when
 * they actually cite a skill, so the node set stays self-limiting.
 */
function deriveWorkflowDocCitations(
  allNodes: Map<string, GraphNode>,
  knownSkillNames: Set<string>,
  edges: GraphEdge[],
  localLayer: GraphNode['layer'],
  resolveSkill: (name: string, ctx: string[]) => string | undefined = (name) => name,
): void {
  const seenCitations = new Set<string>();

  const scanFile = (absPath: string, docId: string, layer: GraphNode['layer']): void => {
    let content: string;
    try {
      content = readFileSync(absPath, 'utf-8');
    } catch {
      return;
    }
    const hits = new Set<string>(extractBacktickReferences(content, knownSkillNames));
    // Path-fragment match: `skills/domains/industry/gdp/{a, b}/` brace-expansion
    // and nested paths (co-safety workflows) — check every path segment against
    // the known skill set instead of requiring `skills/<name>/` exactly.
    for (const m of content.matchAll(/skills\/[a-z0-9][a-z0-9./{} ,-]*/g)) {
      for (const seg of m[0].split(/[^a-z0-9-]+/)) {
        if (knownSkillNames.has(seg)) hits.add(seg);
      }
    }
    // README skill catalogs list skills as plain prose (e.g. `- **excel-export**:`)
    // with no backticks or path — allow word-boundary mentions there, and only
    // there, to keep false positives out of general docs. Hyphenated ids of
    // length >= 8 are specific enough to be safe.
    if (docId.endsWith('/README.md')) {
      for (const name of knownSkillNames) {
        if (name.includes('-') && name.length >= 8 && new RegExp(`\\b${name}\\b`).test(content)) hits.add(name);
      }
    }
    if (hits.size === 0) return;
    if (!allNodes.has(docId)) {
      allNodes.set(docId, { id: docId, type: 'doc', layer });
    }
    const ctx = layer.startsWith('variant:') ? [layer.slice('variant:'.length)] : ['root'];
    for (const skillName of [...hits].sort()) {
      if (skillName === docId) continue;
      const skillId = resolveSkill(skillName, ctx);
      if (!skillId) continue;
      const key = `${docId}->${skillId}`;
      if (seenCitations.has(key)) continue;
      seenCitations.add(key);
      edges.push({ type: 'cites_skill', from: docId, to: skillId, source: 'workflow-doc' });
    }
  };

  const walkDir = (dir: string, docPrefix: string, layer: GraphNode['layer']): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full, docPrefix, layer);
      else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.yaml'))) {
        scanFile(full, `doc:${docPrefix}${entry.name}`, layer);
      }
    }
  };

  // L0 corpus: platform/agent context docs + workflow directories
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md']) {
    if (existsSync(join(ROOT, f))) scanFile(join(ROOT, f), `doc:${f}`, localLayer);
  }
  walkDir(join(ROOT, 'procedures'), 'procedures/', localLayer);
  walkDir(join(ROOT, 'process'), 'process/', localLayer);

  // Variant corpus (L0 graph only — buildScopeGraph has its own node universe).
  // v1.14.0: widened after the T-20260923-002 triage — co-safety's 13 and
  // co-price's 3 isolated skills were cited from docs/*.md top-level files
  // (user guides), the variant README, and NESTED agent bodies
  // (agents/domains/**), none of which the original corpus covered.
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      const layer: GraphNode['layer'] = `variant:${variantName}`;
      const vDir = join(templatesDir, variantName);
      if (existsSync(join(vDir, 'AGENTS.md'))) scanFile(join(vDir, 'AGENTS.md'), `doc:${variantName}/AGENTS.md`, layer);
      if (existsSync(join(vDir, 'README.md'))) scanFile(join(vDir, 'README.md'), `doc:${variantName}/README.md`, layer);
      if (existsSync(join(vDir, 'docs', 'phase-definitions.md'))) {
        scanFile(join(vDir, 'docs', 'phase-definitions.md'), `doc:${variantName}/docs/phase-definitions.md`, layer);
      }
      // Top-level docs/*.md only (user guides etc.) — designs/specs/lifecycle churn stays out.
      const vDocs = join(vDir, 'docs');
      if (existsSync(vDocs)) {
        for (const entry of readdirSync(vDocs, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.endsWith('.md')) {
            scanFile(join(vDocs, entry.name), `doc:${variantName}/docs/${entry.name}`, layer);
          }
        }
      }
      // Nested agent bodies (e.g. co-safety agents/domains/**) cite their skills.
      walkDir(join(vDir, 'agents'), `${variantName}/agents/`, layer);
      // Workflow catalogs (co-safety workflows/domains/**) — same citation shape.
      walkDir(join(vDir, 'workflows'), `${variantName}/workflows/`, layer);
      walkDir(join(vDir, 'procedures'), `${variantName}/procedures/`, layer);
      walkDir(join(vDir, 'process'), `${variantName}/process/`, layer);
    }
  }
}

/** Report-only findings produced alongside the v2 graph (rendered into docs/skill-graph.md). */
export interface BuildReport {
  /** `type:name` keys resolved without a scope match (first-wins fallback). */
  ambiguousRefs: string[];
  /** G5: node ids with no edge, grouped by node type. */
  isolated: Record<string, string[]>;
  /** G6: skill node ids with no outgoing `used_by` edge. */
  skillsWithoutUsedBy: string[];
  /** E4: suggested `required_by` agents for G6 skills (never written to SKILL.md). */
  suggestions: Array<{ skill: string; agents: Array<{ agent: string; procedures: string[] }> }>;
  /** E3: memory-derived usage summary. `asOf` = newest memory log date. */
  usage: { asOf: string | null; windowDays: number; unused: string[]; usedButUnlinked: string[]; usedCount: number };
  /** G4: duplicate (from,to,type) edges dropped. */
  droppedDuplicateEdges: number;
}

const USAGE_WINDOW_DAYS = 90;

/** Normalize a `- skill:` evidence value to a bare skill name. */
function normalizeUsedSkillName(raw: string): string {
  return raw
    .replace(/[`"',;]+/g, '')
    .replace(/^\.?\/?(?:\.?[a-z]+\/)?skills\//, '')
    .replace(/\/SKILL\.md$/, '')
    .replace(/\/$/, '');
}

/**
 * E3: join memory/YYYY-MM-DD.md `## Skills Used` evidence onto skill nodes. Names resolve through
 * `capability` (a session naming `pdf-export` counts for every node of that capability: the log
 * does not say which copy ran). The reference date is the newest memory log, not the wall clock,
 * so the result is a pure function of the repo content.
 */
function attachUsage(reg: Registry): BuildReport['usage'] & { sessionsByNode: Map<string, string[]> } {
  const memDir = join(ROOT, 'memory');
  const sessionsByNode = new Map<string, string[]>();
  const result = { asOf: null as string | null, windowDays: USAGE_WINDOW_DAYS, unused: [] as string[], usedButUnlinked: [] as string[], usedCount: 0, sessionsByNode };
  if (!existsSync(memDir)) return result;

  const byCapability = new Map<string, GraphNode[]>();
  for (const n of reg.skills) {
    for (const key of new Set([n.capability ?? n.name!, n.name!])) {
      if (!byCapability.has(key)) byCapability.set(key, []);
      byCapability.get(key)!.push(n);
    }
  }

  const files = readdirSync(memDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  for (const f of files) {
    const date = f.slice(0, 10);
    let text: string;
    try { text = readFileSync(join(memDir, f), 'utf-8'); } catch { continue; }
    if (!result.asOf || date > result.asOf) result.asOf = date;
    const seen = new Set<string>();
    for (const ev of parseSkillsUsed(text)) {
      for (const node of byCapability.get(normalizeUsedSkillName(ev.skill)) ?? []) seen.add(node.id);
    }
    for (const id of seen) {
      if (!sessionsByNode.has(id)) sessionsByNode.set(id, []);
      sessionsByNode.get(id)!.push(date);
    }
  }
  for (const node of reg.skills) {
    const dates = sessionsByNode.get(node.id);
    if (dates && dates.length > 0) node.usage = { sessions: dates.length, last_used: dates[dates.length - 1] };
  }
  return result;
}

/** Heading/table label for lifecycle phase `n` from a phase-definitions.md file, if present. */
const phaseLabelCache = new Map<string, string>();
function phaseLabel(docPath: string, n: number): string | undefined {
  if (!existsSync(docPath)) return undefined;
  if (!phaseLabelCache.has(docPath)) {
    try { phaseLabelCache.set(docPath, readFileSync(docPath, 'utf-8')); } catch { phaseLabelCache.set(docPath, ''); }
  }
  const text = phaseLabelCache.get(docPath)!;
  const row = text.match(new RegExp(`^\\|\\s*${n}\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm'));
  const heading = row ? null : text.match(new RegExp(`^#{2,4}\\s*Phase\\s+${n}\\b[:\\s\\u2014\\u2013-]*(.+)$`, 'm'));
  const raw = (row ?? heading)?.[1];
  if (!raw) return undefined;
  return raw.replace(/[*`]/g, '').trim().slice(0, 80) || undefined;
}

export function buildGraph(): SkillGraph {
  return buildGraphWithReport().graph;
}

/**
 * Build the v2 skill graph (scoped ids, capability key, phase nodes, deduped edges) from all
 * sources, plus the report-only findings. Exported for verify-skill-graph.ts, graph-delta-log.ts.
 */
export function buildGraphWithReport(): { graph: SkillGraph; report: BuildReport } {
  const reg = discoverRegistry();
  const link = registryLinker(reg);
  const allNodes = new Map<string, GraphNode>();
  for (const n of reg.skills) allNodes.set(n.id, n);
  for (const n of reg.agents) allNodes.set(n.id, n);

  const edges: GraphEdge[] = [];
  const stepPairs: Array<{ procedure: string; skill: string; agent: string }> = [];
  stepPairSink = stepPairs;
  const skillAt = (name: string, ctx: string[]): GraphNode | undefined => resolveNode(reg, 'skill', name, ctx);
  const agentAt = (name: string, ctx: string[]): GraphNode | undefined => resolveNode(reg, 'agent', name, ctx);

  // Phase nodes (G3): `phase:<scope>/<n>`, scoped because numbering is per variant.
  const ensurePhase = (scope: string, layer: GraphNode['layer'], n: number, docPath: string): string => {
    const id = `phase:${scope}/${n}`;
    if (!allNodes.has(id)) {
      const label = phaseLabel(docPath, n);
      allNodes.set(id, { id, type: 'phase', layer, scope, ordinal: n, ...(label ? { label } : {}) });
    }
    return id;
  };

  // Source 1: SKILL.md prerequisites + relates_to (+ inputs/outputs)
  for (const node of reg.skills) {
    const skillPath = primaryPath(reg, node);
    const ctx = ctxOfNode(reg, node);
    const content = readFileSync(skillPath, 'utf-8');
    const frontmatter = parseFrontmatter(content) as SkillFrontmatter;

    if (Array.isArray(frontmatter?.inputs)) node.inputs = frontmatter.inputs.filter((x: unknown) => typeof x === 'string');
    if (Array.isArray(frontmatter?.outputs)) node.outputs = frontmatter.outputs.filter((x: unknown) => typeof x === 'string');

    if (frontmatter?.prerequisites) {
      for (const prereq of parsePrerequisites(frontmatter.prerequisites, reg.skillNames)) {
        const target = skillAt(prereq, ctx);
        if (target) edges.push({ type: 'requires', from: node.id, to: target.id, source: 'prerequisites', provenance: prov(skillPath, 'prerequisites') });
      }
    }

    if (frontmatter?.relates_to) {
      for (const rel of parseRelatesTo(frontmatter.relates_to, skillPath)) {
        const target = reg.skillNames.has(rel.to) ? skillAt(rel.to, ctx) : undefined;
        if (!target) continue;
        edges.push({
          type: rel.type,
          from: node.id,
          to: target.id,
          source: 'relates_to',
          ...(rel.symmetric ? { symmetric: true as const } : {}),
          ...(rel.extra ? { extra: rel.extra } : {}),
          provenance: prov(skillPath, 'relates_to', rel.index)
        });
      }
    }
  }

  // Source 1b: Korean term vocabulary from references/terms-ko.json (ADR-0072)
  deriveTermNodesAndEdges(reg, allNodes, edges);

  // Source 2: Agent required_skills
  for (const node of reg.agents) {
    const agentPath = primaryPath(reg, node);
    const ctx = ctxOfNode(reg, node);
    const frontmatter = parseFrontmatter(readFileSync(agentPath, 'utf-8')) as AgentFrontmatter;

    if (frontmatter?.required_skills && Array.isArray(frontmatter.required_skills)) {
      frontmatter.required_skills.forEach((skill: string, index: number) => {
        const target = reg.skillNames.has(skill) ? skillAt(skill, ctx) : undefined;
        if (target) {
          edges.push({ type: 'used_by', from: target.id, to: node.id, source: 'required_skills', provenance: prov(agentPath, 'required_skills', index) });
        }
      });
    }
  }

  // Source 3 / 3b: variant.json skill_manifest — templates/co-* at the workspace root, or a
  // scaffolded project's own variant.json (scope `root`: the project's local skills/agents).
  const applyManifest = (manifestPath: string, scope: string, layer: GraphNode['layer'], phaseDoc: string): void => {
    if (!existsSync(manifestPath)) return;
    try {
      const variantSpecific = JSON.parse(readFileSync(manifestPath, 'utf-8'))?.skill_manifest?.variant_specific;
      if (!Array.isArray(variantSpecific)) return;
      for (const entry of variantSpecific) {
        const manifest = entry as SkillManifestEntry;
        const skill = skillAt(manifest.name, [scope]);
        if (!skill) continue;

        // used_by_agents edges (skill -> agent)
        if (manifest.used_by_agents && Array.isArray(manifest.used_by_agents)) {
          for (const agentName of manifest.used_by_agents) {
            const agent = agentAt(agentName, [scope]);
            if (agent) edges.push({ type: 'used_by', from: skill.id, to: agent.id, source: 'skill_manifest' });
          }
        }

        // phase edges (skill -> phase node)
        if (manifest.phases && Array.isArray(manifest.phases)) {
          for (const phase of manifest.phases) {
            edges.push({ type: 'phase', from: skill.id, to: ensurePhase(scope, layer, phase, phaseDoc), source: 'skill_manifest' });
          }
        }
      }
    } catch {
      // Invalid JSON, skip this manifest
    }
  };
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      applyManifest(
        join(templatesDir, variantName, 'variant.json'),
        variantName,
        `variant:${variantName}`,
        join(templatesDir, variantName, 'docs', 'phase-definitions.md'),
      );
    }
  }
  applyManifest(join(ROOT, 'variant.json'), 'root', localLayer, join(ROOT, 'docs', 'phase-definitions.md'));

  // Source 4: Prose backtick references
  for (const node of [...reg.skills, ...reg.agents]) {
    const content = readFileSync(primaryPath(reg, node), 'utf-8');
    const bodyParts = content.split('---');
    const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : content;
    const ctx = ctxOfNode(reg, node);
    for (const ref of extractBacktickReferences(body, reg.skillNames)) {
      const target = skillAt(ref, ctx);
      if (!target) continue;
      if (node.type === 'skill' && target.id === node.id) continue; // Skip self-references
      edges.push({ type: 'references', from: node.id, to: target.id, source: 'prose' });
    }
  }

  // Source 4.8: Workflow-doc citations (bounded corpus → doc: nodes + cites_skill
  // edges) — closes the graph-isolation gap for skills dispatched through workflow
  // documents rather than SKILL.md/agent prose (ticket T-20260923-001).
  deriveWorkflowDocCitations(allNodes, reg.skillNames, edges, localLayer, (name, ctx) => skillAt(name, ctx)?.id);

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
          const target = typeof s === 'string' && reg.skillNames.has(s) ? skillAt(s, ['root']) : undefined;
          if (target) edges.push({ type: 'cites_skill', from: docId, to: target.id, source: 'skills_used' });
        }
      }

      const bodyParts = raw.split('---');
      const body = bodyParts.length > 1 ? bodyParts.slice(1).join('---') : raw;

      // references: knowledge_refs[] entries naming an ADR
      const knowledgeRefs = frontmatter['knowledge_refs'];
      if (Array.isArray(knowledgeRefs)) {
        for (const ref of knowledgeRefs) {
          const m = typeof ref === 'string' ? ref.trim().match(/^ADR-(\d{4})$/) : null;
          if (m) {
            edges.push({ type: 'references', from: docId, to: `adr:${m[1]}`, source: 'knowledge_refs' });
          }
        }
      }

      // supersedes/amends via prose labels (exact token match on same line)
      for (const line of body.split('\n')) {
        const m = line.match(/supersedes?:?\s*(ADR-\d{4}|DEC-\d{8}-\d{2})/i);
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
      const m = f.match(/^(\d{4})-.*\.md$/);
      if (!m) continue;
      const adrId = `adr:${m[1]}`;
      allNodes.set(adrId, { id: adrId, type: 'adr', layer: localLayer });

      const content = readFileSync(join(adrsDir, f), 'utf-8');
      for (const ref of extractBacktickReferences(content, reg.skillNames)) {
        const target = skillAt(ref, ['root']);
        if (target) edges.push({ type: 'references', from: adrId, to: target.id, source: 'prose' });
      }
    }
  }

  // Source 4.7: Procedures — derived from templates/<variant>/procedures/<name>/schema.yaml
  // plus the workspace-root l0 namespace (<ROOT>/procedures/). The procedure
  // YAML is the canonical source; these nodes/edges are pure derivation and
  // MUST NOT be hand-maintained (INV-1,
  // docs/designs/2026-08-29-procedure-schema-design.md).
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      deriveProceduresFromDir(
        join(templatesDir, variantName, 'procedures'),
        variantName,
        `variant:${variantName}`,
        allNodes,
        edges,
        join(templatesDir, variantName),
        link,
      );
    }
  }
  // Workspace-root lifecycle procedures (l0 namespace). At the L0 workspace
  // root, only tracked procedure schemas are canonical; ignored local fixture
  // directories must not influence the committed graph projection.
  const rootProceduresDir = join(ROOT, 'procedures');
  if (localLayer !== 'L0' || hasTrackedFilesUnder(rootProceduresDir)) {
    deriveProceduresFromDir(rootProceduresDir, 'l0', localLayer, allNodes, edges, ROOT, link);
  }

  // Source 5.8: Stages — domain execution stages derived from process/stages.yaml (ADR-0083)
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      deriveStagesFromYaml(
        join(templatesDir, variantName, 'process', 'stages.yaml'),
        variantName,
        `variant:${variantName}`,
        allNodes,
        edges,
      );
    }
  }

  // Source 5.9: RACI matrix edges derived from governance/raci.yaml (ADR-0083 P4, ADR-0084 §3.4)
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      deriveRACIFromYaml(
        join(templatesDir, variantName, 'governance', 'raci.yaml'),
        variantName,
        `variant:${variantName}`,
        allNodes,
        edges,
        join(templatesDir, variantName),
        link,
      );
    }
  }

  // Source 5.10: Decision gates derived from decisions/gates.yaml (ADR-0083 P5)
  if (existsSync(templatesDir)) {
    for (const variantName of listVariantDirs(templatesDir)) {
      deriveDecisionGatesFromYaml(
        join(templatesDir, variantName, 'decisions', 'gates.yaml'),
        variantName,
        `variant:${variantName}`,
        allNodes,
        edges,
      );
    }
  }
  stepPairSink = null;

  // Source 5: Overrides (L0) — loaded and applied via shared helper. Bare keys (`skill:<name>`
  // is not required) fan out to every node carrying that name (v2 compat, design §5).
  const { overrides } = loadOverridesFile(join(ROOT, 'docs'));
  const warnedFanOut = new Set<string>();
  applyOverrides(overrides, allNodes, edges, (key) => {
    if (allNodes.has(key)) return [key];
    const hits = [...(reg.byKey.get(`skill:${key}`) ?? []), ...(reg.byKey.get(`agent:${key}`) ?? [])].map((n) => n.id);
    if (hits.length > 1 && !warnedFanOut.has(key)) {
      warnedFanOut.add(key);
      console.warn(`Warning: bare override key "${key}" fans out to ${hits.length} nodes (${hits.join(', ')}); use a scoped key to pin one`);
    }
    return hits;
  });

  // E3: usage attribute from memory `## Skills Used`
  const usage = attachUsage(reg);

  // G4: drop duplicate (from, to, type) edges (first wins; insertion order is deterministic)
  const dedupedEdges = dedupeEdges(edges);
  const droppedDuplicateEdges = edges.length - dedupedEdges.length;

  // Sort deterministically
  const sortedNodes = Array.from(allNodes.values()).sort((a, b) => a.id.localeCompare(b.id));
  const sortedEdges = dedupedEdges.sort((a, b) => {
    const fromCompare = a.from.localeCompare(b.from);
    if (fromCompare !== 0) return fromCompare;
    const toCompare = a.to.localeCompare(b.to);
    if (toCompare !== 0) return toCompare;
    return a.type.localeCompare(b.type);
  });

  const graph: SkillGraph = { version: 2, graph_profile: 'deg/v2', nodes: sortedNodes, edges: sortedEdges };
  return { graph, report: computeReport(graph, reg, stepPairs, usage, droppedDuplicateEdges) };
}

/** G5/G6/E3/E4 findings over a built v2 graph. */
function computeReport(
  graph: SkillGraph,
  reg: Registry,
  stepPairs: Array<{ procedure: string; skill: string; agent: string }>,
  usage: ReturnType<typeof attachUsage>,
  droppedDuplicateEdges: number,
): BuildReport {
  const touched = new Set<string>();
  const usedBy = new Set<string>();
  for (const e of graph.edges) {
    touched.add(e.from);
    touched.add(e.to);
    if (e.type === 'used_by') usedBy.add(e.from);
  }
  const isolated: Record<string, string[]> = {};
  for (const n of graph.nodes) {
    if (touched.has(n.id)) continue;
    (isolated[n.type] ??= []).push(n.id);
  }

  const skillsWithoutUsedBy = graph.nodes.filter((n) => n.type === 'skill' && !usedBy.has(n.id)).map((n) => n.id).sort();
  const withoutSet = new Set(skillsWithoutUsedBy);

  // E4: agents that own a procedure step citing the skill (report-only).
  const bySkill = new Map<string, Map<string, Set<string>>>();
  for (const p of stepPairs) {
    if (!withoutSet.has(p.skill)) continue;
    if (!bySkill.has(p.skill)) bySkill.set(p.skill, new Map());
    const agents = bySkill.get(p.skill)!;
    if (!agents.has(p.agent)) agents.set(p.agent, new Set());
    agents.get(p.agent)!.add(p.procedure);
  }
  const suggestions = [...bySkill.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([skill, agents]) => ({
      skill,
      agents: [...agents.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([agent, procs]) => ({ agent, procedures: [...procs].sort() })),
    }));

  // E3 summary
  let cutoff = '';
  if (usage.asOf) {
    const d = new Date(`${usage.asOf}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - usage.windowDays);
    cutoff = d.toISOString().slice(0, 10);
  }
  const unused: string[] = [];
  const usedButUnlinked: string[] = [];
  let usedCount = 0;
  for (const n of graph.nodes) {
    if (n.type !== 'skill') continue;
    const dates = usage.sessionsByNode.get(n.id) ?? [];
    if (dates.length > 0) usedCount++;
    if (!dates.some((d) => d >= cutoff)) unused.push(n.id);
    if (dates.length > 0 && withoutSet.has(n.id)) usedButUnlinked.push(n.id);
  }

  return {
    ambiguousRefs: [...reg.ambiguous].sort(),
    isolated,
    skillsWithoutUsedBy,
    suggestions,
    usage: { asOf: usage.asOf, windowDays: usage.windowDays, unused: unused.sort(), usedButUnlinked: usedButUnlinked.sort(), usedCount },
    droppedDuplicateEdges,
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
function applyOverrides(
  overrides: Overrides,
  allNodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  /** Expand an override endpoint to node ids (v2: bare names fan out to every node of that name). */
  expand: (key: string) => string[] = (key) => (allNodes.has(key) ? [key] : []),
): void {
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
    const fromIds = override.from ? expand(override.from) : [];
    const toIds = override.to ? expand(override.to) : [];
    if (override.from && fromIds.length === 0) {
      console.warn(`Warning: Override references unknown node: ${override.from}`);
      continue;
    }
    if (override.to && toIds.length === 0) {
      console.warn(`Warning: Override references unknown node: ${override.to}`);
      continue;
    }

    if (override.suppress) {
      const fromSet = new Set(fromIds);
      const toSet = new Set(toIds);
      for (let i = edges.length - 1; i >= 0; i--) {
        const e = edges[i];
        if (e.source === 'override') continue;
        if (fromSet.has(e.from) && toSet.has(e.to) && (!override.type || e.type === override.type)) {
          edges.splice(i, 1);
        }
      }
      continue;
    }

    for (const from of fromIds) {
      for (const to of toIds) {
        edges.push({
          type: override.type as GraphEdge['type'],
          from,
          to,
          source: 'override',
          reason: override.reason
        });
      }
    }
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
 * @version 1.4.0 — agent discovery shares the full-graph pass's README- and
 * underscore-prefix exclusion (v1.15.0); previously scope graphs carried
 * README "agent" nodes.
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
      // Same exclusion rule as the full-graph variant pass (v1.13.0): folder
      // READMEs and _-prefixed files are directory docs, not agents; scope-mode
      // regeneration previously emitted README/README_ko as type:"agent" nodes
      // (DH1 of the 2026-10-05 scoped review, T-20261005-022).
      if (!f.endsWith('.md') || f === 'handoff-spec.md' || /^README/.test(f) || f.startsWith('_')) continue;
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
  deriveProceduresFromDir(join(scopeDir, 'procedures'), scope, layer, allNodes, edges, scopeDir);

  // Source 5.8 (scope): stages owned by this scope (ADR-0083)
  deriveStagesFromYaml(join(scopeDir, 'process', 'stages.yaml'), scope, layer, allNodes, edges);

  // Source 5.9 (scope): RACI matrix edges owned by this scope (ADR-0083 P4, ADR-0084 §3.4)
  deriveRACIFromYaml(join(scopeDir, 'governance', 'raci.yaml'), scope, layer, allNodes, edges, scopeDir);

  // Source 5.10 (scope): decision gates owned by this scope (ADR-0083 P5)
  deriveDecisionGatesFromYaml(join(scopeDir, 'decisions', 'gates.yaml'), scope, layer, allNodes, edges);

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
    graph_profile: 'deg/v1',
    nodes: sortedNodes,
    edges: sortedEdges
  };
}

/** Display form of a scoped id: `skill:co-deck/pdf-export` -> `co-deck/pdf-export`. */
function displayId(id: string): string {
  const sp = splitScopedId(id);
  if (!sp) return id;
  return sp.type === 'phase' ? `${sp.scope}/phase ${sp.name}` : `${sp.scope}/${sp.name}`;
}

const REPORT_LIST_CAP = 40;

function capped(items: string[], cap = REPORT_LIST_CAP): string {
  if (items.length <= cap) return items.join(', ');
  return `${items.slice(0, cap).join(', ')} … and ${items.length - cap} more`;
}

/**
 * Generate human-readable markdown catalog
 */
function generateMarkdown(graph: SkillGraph, report?: BuildReport): string {
  const lines: string[] = [];

  lines.push('# Skill Relationship Graph');
  lines.push('');
  lines.push('> **Generated by `scripts/generate-skill-graph.ts` — do not edit.**');
  lines.push('> ');
  lines.push('> Relations are advisory only (ADR-0060). They do not gate loading, deprecation, or propagation.');
  lines.push('> Node identity is `type:scope/name` (schema v2, ADR-0060 Amendment 11): identical copies collapse to one node,');
  lines.push('> distinct content under one name gets one node per content hash; `capability` is the cross-project grouping key.');
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
      skillRelations.get(edge.from)!.requires.push(displayId(edge.to));
    } else if (edge.type === 'relates_to' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.relates_to.push(displayId(edge.to));
    } else if (TYPED_LABEL[edge.type] && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.relates_to.push(`${displayId(edge.to)} (${TYPED_LABEL[edge.type]})`);
    } else if (edge.type === 'used_by' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.used_by_agents.push(displayId(edge.to));
    } else if (edge.type === 'phase' && skillRelations.has(edge.from)) {
      skillRelations.get(edge.from)!.phases.push(displayId(edge.to));
    }
  }

  // Output per-skill table
  lines.push('| Skill (scope/name) | Layer | Version | Required-by Agents | Phases | Relates-to | Inputs | Outputs |');
  lines.push('|--------------------|-------|---------|-------------------|--------|------------|--------|---------|');

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const allSkills = Array.from(skillRelations.keys()).sort((a, b) => displayId(a).localeCompare(displayId(b)));
  for (const skillId of allSkills) {
    const node = nodeById.get(skillId);
    if (!node) continue;

    const relations = skillRelations.get(skillId)!;
    const agents = relations.used_by_agents.sort().join(', ') || '—';
    const phases = relations.phases.sort().join(', ') || '—';
    const relates = relations.relates_to.sort().join(', ') || '—';
    const inputs = (node.inputs ?? []).join(', ') || '—';
    const outputs = (node.outputs ?? []).join(', ') || '—';

    lines.push(`| \`${displayId(skillId)}\` | ${node.layer} | ${node.version ?? '—'} | ${agents} | ${phases} | ${relates} | ${inputs} | ${outputs} |`);
  }

  lines.push('');
  lines.push('## Lifecycle Phase Grouping');
  lines.push('');
  lines.push('Skills used in specific lifecycle phases (from `variant.json` `skill_manifest`); phase numbering is per scope:');
  lines.push('');

  // Group by phase node
  const phaseSkills = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.type === 'phase' && edge.to.startsWith('phase:')) {
      if (!phaseSkills.has(edge.to)) {
        phaseSkills.set(edge.to, []);
      }
      phaseSkills.get(edge.to)!.push(displayId(edge.from));
    }
  }

  const sortedPhases = Array.from(phaseSkills.keys()).sort((a, b) => {
    const pa = nodeById.get(a), pb = nodeById.get(b);
    return (pa?.scope ?? '').localeCompare(pb?.scope ?? '') || (pa?.ordinal ?? 0) - (pb?.ordinal ?? 0);
  });
  for (const phase of sortedPhases) {
    const pn = nodeById.get(phase);
    const skills = phaseSkills.get(phase)!.sort().join(', ');
    lines.push(`- **${displayId(phase)}**${pn?.label ? ` (${pn.label})` : ''}: ${skills}`);
  }

  lines.push('');
  lines.push('## Edge Types');
  lines.push('');
  lines.push('| Type | Description |');
  lines.push('|------|-------------|');
  lines.push('| `requires` | From SKILL.md `prerequisites` field (skill → skill) |');
  lines.push('| `relates_to` | From SKILL.md `relates_to` field or overrides (skill ↔ skill) |');
  lines.push('| `used_by` | Agent ↔ skill relation (from `required_skills` or `used_by_agents`) |');
  lines.push('| `phase` | Skill used in a lifecycle phase (from `variant.json` `skill_manifest.phases`; target is a `phase:<scope>/<n>` node) |');
  lines.push('| `supersedes` | Supersession — overrides (manual) or decision-record prose labels |');
  lines.push('| `references` | Backtick reference in SKILL.md/agent/ADR body prose, DEC `knowledge_refs[]` naming an ADR, or skill → `term:` node from references/terms-ko.json (ADR-0072) |');
  lines.push('| `cites_skill` | Decision record `skills_used[]` and workflow-doc citations (`doc:` nodes, Source 4.8, ticket T-20260923-001) validated against the skill set |');
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
  const docNodes = graph.nodes.filter(n => n.type === 'decision' || n.type === 'adr' || n.type === 'doc');
  if (docNodes.length > 0) {
    lines.push('## Decisions & ADRs');
    lines.push('');
    lines.push('| Document | Type | Cites skills | References | Supersedes |');
    lines.push('|----------|------|--------------|------------|------------|');
    for (const n of docNodes.sort((a, b) => a.id.localeCompare(b.id))) {
      const cites = graph.edges
        .filter(e => e.type === 'cites_skill' && e.from === n.id)
        .map(e => `\`${displayId(e.to)}\``)
        .join(', ');
      const refs = graph.edges
        .filter(e => e.type === 'references' && e.from === n.id)
        .map(e => displayId(e.to))
        .join(', ');
      const sup = graph.edges
        .filter(e => e.type === 'supersedes' && e.from === n.id)
        .map(e => e.to)
        .join(', ');
      lines.push(`| \`${n.id}\` | ${n.type} | ${cites || '—'} | ${refs || '—'} | ${sup || '—'} |`);
    }
    lines.push('');
  }

  // Term vocabulary section (ADR-0072): term nodes extracted from skill
  // references/terms-ko.json files, with the skills that reference them.
  // Term keys are quoted source-language vocabulary (data, per §6.7), not prose.
  const termNodes = graph.nodes.filter(n => n.type === 'term');
  if (termNodes.length > 0) {
    lines.push('## Korean Term Vocabulary (terms-ko.json)');
    lines.push('');
    lines.push('> Source-language vocabulary quoted from `references/terms-ko.json` data files');
    lines.push('> (CONSTITUTION §6.7 non-Markdown reference assets). Term ids are namespaced');
    lines.push('> `term:<용어>` in `docs/skill-graph.json`.');
    lines.push('');
    lines.push('| Term | Layer | Referencing skills |');
    lines.push('|------|-------|--------------------|');
    for (const n of termNodes.sort((a, b) => a.id.localeCompare(b.id))) {
      const skills = graph.edges
        .filter(e => e.type === 'references' && e.source === 'terms-ko.json' && e.to === n.id)
        .map(e => `\`${displayId(e.from)}\``)
        .join(', ');
      lines.push(`| \`${n.id.replace(/^term:/, '')}\` | ${n.layer} | ${skills || '—'} |`);
    }
    lines.push('');
  }

  // ── v2 report sections (G5/G6/E2/E3/E4) ──
  const divergences = findCapabilityDivergence(graph as unknown as SkillGraphV2);
  lines.push('## Same-Name Divergence (E2)');
  lines.push('');
  if (divergences.length === 0) {
    lines.push('None — every capability has a single content hash.');
  } else {
    lines.push('Capabilities with >= 2 distinct content hashes. `version-drift` = two nodes share a version but differ in content (the version no longer identifies the content); `divergence` = contents and versions both differ (reconciliation candidate).');
    lines.push('');
    lines.push('| Capability | Type | Kind | Nodes (scope@version #hash) |');
    lines.push('|------------|------|------|-----------------------------|');
    for (const d of divergences) {
      const nodes = d.entries.map((e) => `${e.scope}@${e.version ?? '?'} #${e.content_hash.slice(0, 8)}`).join('; ');
      lines.push(`| \`${d.capability}\` | ${d.type} | ${d.kind} | ${nodes} |`);
    }
  }
  lines.push('');

  if (report) {
    lines.push('## Isolated Nodes (G5)');
    lines.push('');
    const isoTypes = Object.keys(report.isolated).sort();
    if (isoTypes.length === 0) {
      lines.push('None.');
    } else {
      lines.push('| Type | Count | Nodes |');
      lines.push('|------|-------|-------|');
      for (const t of isoTypes) {
        const ids = report.isolated[t];
        lines.push(`| ${t} | ${ids.length} | ${t === 'adr' || t === 'decision' ? '(expected until docs `references` edges are mined)' : capped(ids.map(displayId))} |`);
      }
    }
    lines.push('');

    lines.push('## Skills Without `used_by` (G6)');
    lines.push('');
    lines.push(`${report.skillsWithoutUsedBy.length} skill nodes have no \`used_by\` edge (no agent \`required_skills\` / manifest \`used_by_agents\` entry).`);
    lines.push('');
    lines.push('### Suggested `required_by` agents (E4, report-only)');
    lines.push('');
    if (report.suggestions.length === 0) {
      lines.push('No suggestions: no procedure step pairs one of these skills with an owning agent.');
    } else {
      lines.push('Inferred from procedure steps that cite the skill and are owned via `step_by_agent`. This report never edits SKILL.md.');
      lines.push('');
      lines.push('| Skill | Suggested agents (via procedures) |');
      lines.push('|-------|-----------------------------------|');
      for (const sg of report.suggestions) {
        const agents = sg.agents.map((a) => `${displayId(a.agent)} (${a.procedures.map((p) => p.replace(/^procedure\./, '')).join(', ')})`).join('; ');
        lines.push(`| \`${displayId(sg.skill)}\` | ${agents} |`);
      }
    }
    lines.push('');

    lines.push('## Skill Usage (E3)');
    lines.push('');
    if (!report.usage.asOf) {
      lines.push('No memory logs found — usage not computed.');
    } else {
      lines.push(`Joined from memory \`## Skills Used\` sections (names resolve via capability); reference date = newest memory log (${report.usage.asOf}), window ${report.usage.windowDays} days. Skill nodes with usage: ${report.usage.usedCount}.`);
      lines.push('');
      lines.push(`- **used-but-unlinked** (usage > 0, no \`used_by\`) (${report.usage.usedButUnlinked.length}): ${report.usage.usedButUnlinked.length > 0 ? capped(report.usage.usedButUnlinked.map(displayId)) : '—'}`);
      lines.push(`- **unused** (0 sessions in ${report.usage.windowDays} days) (${report.usage.unused.length}): ${report.usage.unused.length > 0 ? capped(report.usage.unused.map(displayId)) : '—'}`);
    }
    lines.push('');

    if (report.ambiguousRefs.length > 0) {
      lines.push('## Ambiguous Name Resolutions');
      lines.push('');
      lines.push('Referenced by bare name from a scope that has no own/common/root copy while several variants define it; the first (alphabetical) node was used.');
      lines.push('');
      lines.push(capped(report.ambiguousRefs));
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── E1: --impact ───────────────────────────────────────────────────────────

export interface ImpactResult {
  query: string;
  targets: Array<{ id: string; scope: string; version: string | null; mirrors: string[] }>;
  agents: string[];
  procedures: string[];
  skills: string[];
  docs: string[];
  variants: string[];
  tests: string[];
  contracts: string[];
}

/** Edge types that do not express "X depends on Y" and are not walked by --impact. */
const IMPACT_SKIP_EDGES = new Set(['produces', 'phase', 'in_stage', 'stage_follows', 'gated_by', 'decides_on', 'evidenced_by']);

function scanFilesFor(dir: string, needles: string[], exts: string[], out: string[], root: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      scanFilesFor(full, needles, exts, out, root);
    } else if (entry.isFile() && exts.some((x) => entry.name.endsWith(x))) {
      let text = '';
      try { text = readFileSync(full, 'utf-8'); } catch { continue; }
      if (needles.some((nd) => text.includes(nd))) out.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
}

/**
 * E1: reverse-edge BFS from a skill/agent (bare name, capability, or scoped id). A bare name
 * expands to every node of that capability. Read-only: operates on the passed graph and scans
 * tests/ and contracts/ for literal references.
 */
export function computeImpact(graphIn: SkillGraphV2, query: string, rootDir: string = ROOT): ImpactResult {
  const graph = graphIn;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const exact = byId.get(query);
  const targets = exact
    ? [exact]
    : graph.nodes.filter((n) => (n.type === 'skill' || n.type === 'agent') && (capabilityOf(n) === query || nameOf(n) === query));

  // Reverse adjacency: who is affected when `key` changes. Direct dependents (depth 1) use every
  // edge type; transitive expansion follows only strong dependency edges so weak prose mentions
  // (`references`, `cites_skill`, relates_to family) do not flood the blast radius.
  const STRONG = new Set(['requires', 'step_uses_skill', 'used_by', 'step_by_agent']);
  const revAll = new Map<string, Set<string>>();
  const revStrong = new Map<string, Set<string>>();
  const addRev = (m: Map<string, Set<string>>, k: string, v: string): void => {
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(v);
  };
  for (const e of graph.edges) {
    if (IMPACT_SKIP_EDGES.has(e.type)) continue;
    // `used_by` runs skill -> agent: the agent is the dependent.
    const [dep, dependent] = e.type === 'used_by' ? [e.from, e.to] : [e.to, e.from];
    addRev(revAll, dep, dependent);
    if (STRONG.has(e.type)) addRev(revStrong, dep, dependent);
    if (e.symmetric) addRev(revAll, e.from, e.to);
  }

  const seen = new Set<string>(targets.map((t) => t.id));
  let frontier = targets.map((t) => t.id);
  let depth = 0;
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const cur of frontier) {
      for (const next of (depth === 0 ? revAll : revStrong).get(cur) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        const nt = byId.get(next)?.type;
        // Walk through skills and procedures; agents, docs, ADRs, decisions are leaves.
        if (nt === 'skill' || nt === 'procedure') nextFrontier.push(next);
      }
    }
    frontier = nextFrontier;
    depth++;
  }
  const targetIds = new Set(targets.map((t) => t.id));
  const hit = [...seen].filter((id) => !targetIds.has(id)).map((id) => byId.get(id)).filter((n): n is SkillGraphV2['nodes'][number] => !!n);
  const idsOf = (pred: (n: SkillGraphV2['nodes'][number]) => boolean): string[] => hit.filter(pred).map((n) => n.id).sort();

  const scopes = new Set<string>();
  const mirrorPaths = new Set<string>();
  for (const t of targets) {
    if (t.scope) scopes.add(t.scope);
    for (const m of t.mirrors ?? []) {
      mirrorPaths.add(m);
      const vm = m.match(/^templates\/(co-[^/]+|common)\//);
      if (vm) scopes.add(vm[1]);
    }
  }
  for (const n of hit) {
    if (n.type === 'skill' || n.type === 'agent') {
      if (n.scope) scopes.add(n.scope);
    } else if (n.type === 'procedure') {
      const pm = n.id.match(/^procedure\.([^.]+)\./);
      if (pm) scopes.add(pm[1] === 'l0' ? 'root' : pm[1]);
    }
  }

  const needles = [...new Set(targets.flatMap((t) => [nameOf(t), capabilityOf(t)]).concat(exact ? [] : [query]))].filter(Boolean);
  const tests: string[] = [];
  const contracts: string[] = [];
  if (needles.length > 0) {
    scanFilesFor(join(rootDir, 'tests'), needles, ['.ts', '.json', '.md', '.yaml'], tests, rootDir);
    scanFilesFor(join(rootDir, 'contracts'), needles, ['.ts', '.json', '.md', '.yaml'], contracts, rootDir);
    const contractFile = join(rootDir, 'docs', 'templates', 'common-contract.json');
    if (existsSync(contractFile)) {
      try {
        const txt = readFileSync(contractFile, 'utf-8');
        if (needles.some((nd) => txt.includes(`"${nd}"`))) contracts.push('docs/templates/common-contract.json');
      } catch { /* unreadable contract file: skip */ }
    }
  }

  return {
    query,
    targets: targets.map((t) => ({ id: t.id, scope: t.scope ?? scopeOfLayer(t.layer), version: t.version ?? null, mirrors: t.mirrors ?? [] })),
    agents: idsOf((n) => n.type === 'agent'),
    procedures: idsOf((n) => n.type === 'procedure'),
    skills: idsOf((n) => n.type === 'skill'),
    docs: idsOf((n) => n.type === 'doc' || n.type === 'adr' || n.type === 'decision'),
    variants: [...scopes].sort(),
    tests: tests.sort(),
    contracts: contracts.sort(),
  };
}

export function formatImpact(r: ImpactResult): string {
  const lines: string[] = [];
  lines.push(`Impact of "${r.query}" — ${r.targets.length} matching node(s)`);
  if (r.targets.length === 0) {
    lines.push('  (no skill/agent node with that id, name or capability)');
    return lines.join('\n');
  }
  lines.push('');
  lines.push('Targets:');
  for (const t of r.targets) lines.push(`  - ${t.id}  [scope ${t.scope}, v${t.version ?? '?'}, ${t.mirrors.length} mirror path(s)]`);
  const section = (title: string, items: string[]): void => {
    lines.push('');
    lines.push(`${title} (${items.length}):`);
    for (const i of items) lines.push(`  - ${i}`);
  };
  section('Agents', r.agents);
  section('Procedures', r.procedures);
  section('Dependent skills', r.skills);
  section('Docs / ADRs / decisions', r.docs);
  section('Variants / scopes', r.variants);
  lines.push('');
  lines.push('Mirror paths:');
  for (const t of r.targets) for (const m of t.mirrors) lines.push(`  - ${m}`);
  section('Tests referencing it', r.tests);
  section('Contracts referencing it', r.contracts);
  return lines.join('\n');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const scopeIdx = args.indexOf('--scope');
  const impactIdx = args.indexOf('--impact');

  // ── E1 impact mode: read-only, writes nothing ──
  if (impactIdx !== -1) {
    const query = args[impactIdx + 1];
    if (!query) {
      console.error('ERROR: --impact requires a skill/agent name, capability or scoped id');
      process.exit(1);
    }
    const committed = join(ROOT, 'docs', 'skill-graph.json');
    let graph: SkillGraphV2 | null = null;
    if (existsSync(committed)) {
      graph = upgradeSkillGraph(JSON.parse(readFileSync(committed, 'utf-8')));
    } else {
      graph = upgradeSkillGraph(buildGraph());
    }
    const result = computeImpact(graph, query);
    console.log(args.includes('--json') ? JSON.stringify(result, null, 2) : formatImpact(result));
    process.exit(result.targets.length === 0 ? 1 : 0);
  }

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

  const { graph, report } = buildGraphWithReport();

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
  const markdown = generateMarkdown(graph, report);
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
