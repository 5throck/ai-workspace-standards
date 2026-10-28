#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-28, spec 2026-10-28-platform-agent-mirror / DEC-20261028-06,
//          PR-1 root scope): initial. One template-managed generator projecting
//          the platform-neutral agents/*.md SSOT (scalar `tier:` only, NO
//          `model:` field) into the mirror directory of every registry-marked
//          agents-capable platform (docs/workspace-schema.json
//          platform_surfaces; v1 = Claude Code only). Patterns adopted per the
//          design's citations: provenance manifest + atomic writes + PID-stamped
//          advisory lock with stale-lock recovery (sync-skills.ts Phase 1c /
//          T-20260912-017), spawn-if-exists audit arm consumption
//          (validate-model-registry.ts precedent), B-PGW fatal-guard coverage
//          assertion (propagate-to-templates.ts). Stub agents (`extends:`)
//          project as self-contained resolved personas via the scaffold-time
//          composer (scripts/helpers/resolve-pm-stub.ts
//          composeResolvedAgentContent — import-verified pure; the same merge
//          upgrade-project.ts consumes).
/**
 * Agent-persona mirror generator + blocking parity gate.
 *
 * Write mode (default): regenerate <mirrorDir>/<name>.md for every agents/*.md
 *   SSOT persona. Compare-then-write (unchanged mirrors untouched), atomic
 *   writes (temp sibling + rename), provenance manifest records every generated
 *   name. A mirror is REMOVED only when it is recorded in the manifest AND its
 *   SSOT counterpart is gone; unknown/user-added files are never removed, and a
 *   run with no/corrupt manifest removes nothing (the first run adopts an
 *   existing tree by recording the names it generates).
 * Check mode (--check): verify-only — exit 1 on any drift (missing /
 *   extra-managed / differing) with a per-file list and the one-line repair
 *   command. Consumed by the delivered audit arm (spawn-if-exists) and the
 *   dev-sync step; /sync must fail loudly on drift, never silently repair.
 *
 * Root scoping: mirrors are PROJECT-scoped. A target root without variant.json
 *   (the workspace root itself) is a green no-op — root dispatch reads agents/
 *   directly and generates no mirrors by design (§12); adding root mirrors
 *   later is a config change, not a redesign.
 *
 * Registry contract: the registry-adapter coverage guard runs BEFORE any
 *   per-file work — every agents.supported:true row must have an adapter below
 *   and every adapter must name a supported row; a supported:false row without
 *   an evidence string is likewise fatal. A producer that disagrees with the
 *   registry cannot run at all (the anti-U-002 measure).
 *
 * Library entry is unguarded for testability (sync-skills precedent); the
 *   advisory lock is CLI-only.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { die } from './lib/error-handling.ts';
import * as yaml from 'js-yaml';
import { composeResolvedAgentContent } from './helpers/resolve-pm-stub.ts';

// Canonical long literals, declared once and referenced everywhere else
// (grep-pinned by tests/unit/sync-agent-mirrors.test.ts).
const SCRIPT_NAME = 'sync-agent-mirrors.ts';
const DESIGN_SPEC = 'docs/designs/2026-10-28-platform-agent-mirror-design.md';
const REGISTRY_BLOCK = 'platform_surfaces';
const MIRROR_MANIFEST_NAME = '.sync-agent-mirrors-managed.json';
const LOCK_NAME = '.sync-agent-mirrors.lock';
const MIRROR_DIR_DEFAULT = '.claude/agents';
const SCHEMA_REL = join('docs', 'workspace-schema.json');

// Ported verbatim from scripts/hooks/agent-model-gate.ts (v1.2.0 contract): the
// Claude alias is derived from the models.claude registry ID
// (claude-<alias>-<ver> -> <alias>); the tier vocabulary is the ADR-0102 scalar
// form.
const VALID_ALIASES = new Set(['sonnet', 'opus', 'haiku', 'fable']);
const VALID_TIERS = new Set(['high', 'medium', 'low']);


// ── Registry types (docs/workspace-schema.json platform_surfaces) ─────────────

export interface SurfaceCapability {
  supported: boolean;
  /** Required on supported:false rows — why the surface is not generated. */
  evidence?: string;
  /** Required on supported:true agents rows — mirror dir, relative to the project root. */
  mirror_dir?: string;
  /** Frontmatter fields the platform accepts for agent mirrors. */
  allowed_fields?: string[];
  /** How the tier-resolved model identifier renders: registry alias or literal registry ID. */
  model_format?: 'alias' | 'id';
  /** Which models registry the tier resolves through, e.g. "models.claude". */
  model_source?: string;
  note?: string;
}

export interface PlatformSurfaceRow {
  agents: SurfaceCapability;
  skills: SurfaceCapability;
  commands: SurfaceCapability;
  hooks: SurfaceCapability;
}

export interface PlatformSurfacesRegistry {
  description?: string;
  platforms: Record<string, PlatformSurfaceRow>;
}

export type ModelRegistry = Record<string, Record<string, string>>;

export interface WorkspaceSchemaLike {
  version?: string;
  models?: ModelRegistry;
  platform_surfaces?: PlatformSurfacesRegistry;
}

// ── Model resolution (§4.2; shared by the generator, usable by the gate) ──────

/**
 * Resolve the model identifier a platform mirror carries for `tier`.
 *
 * Alias rule (agent-model-gate.ts v1.2.0, ported exactly): the registry ID
 * claude-<alias>-<ver> collapses to <alias> when the alias is one of
 * sonnet/opus/haiku/fable. A model_format "id" row renders the literal registry
 * ID instead. Throws on an unknown platform/tier or an underivable alias —
 * never silently emits a wrong model.
 */
export function resolvePlatformModel(
  platform: string,
  tier: string,
  models: ModelRegistry,
  format: 'alias' | 'id' = 'alias',
): string {
  const tierMap = models?.[platform];
  if (!tierMap || typeof tierMap !== 'object') {
    throw new Error(
      `resolvePlatformModel: models registry has no '${platform}' block — add it to ${SCHEMA_REL} models (repair: extend the models registry, never hardcode)`,
    );
  }
  const registryId = tierMap[tier];
  if (!registryId) {
    throw new Error(
      `resolvePlatformModel: models.${platform} has no entry for tier '${tier}' (known tiers: ${Object.keys(tierMap).join(', ')})`,
    );
  }
  if (format === 'id') return registryId;
  const alias = registryId.split('-')[1];
  if (!alias || !VALID_ALIASES.has(alias)) {
    throw new Error(
      `resolvePlatformModel: no valid alias derivable from models.${platform}.${tier} = '${registryId}' ` +
      `(claude-<alias>-<ver> -> <alias>; known aliases: ${[...VALID_ALIASES].join(', ')})`,
    );
  }
  return alias;
}

// ── Platform adapters (§4.2 output sketch) ────────────────────────────────────

export interface SsotAgent {
  /** Source file name, e.g. "pm.md". */
  file: string;
  /** Frontmatter `name` (the mirror file stem). */
  name: string;
  /** Frontmatter `description` (single line). */
  description: string;
  /** Scalar tier: high|medium|low. */
  tier: string;
  /** Resolved, self-contained body (extends-stubs compose at projection time). */
  body: string;
}

export interface AgentSurfaceAdapter {
  platform: string;
  /** Mirror frontmatter fields this adapter emits, in order. */
  emits: readonly string[];
  /** Render the full mirror file content for a parsed SSOT agent. */
  render: (agent: SsotAgent, resolvedModel: string, sourceRel: string) => string;
}

/** Collapse a frontmatter value into one safely double-quoted YAML scalar. */
function quoteScalar(value: string): string {
  const oneLine = value.replace(/\s+/g, ' ').trim();
  return `"${oneLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

const claudeAdapter: AgentSurfaceAdapter = {
  platform: 'claude',
  emits: ['name', 'description', 'model'],
  render: (agent, resolvedModel, sourceRel) =>
    [
      '---',
      `name: ${agent.name}`,
      `description: ${quoteScalar(agent.description)}`,
      `model: ${resolvedModel}`,
      '---',
      '',
      `<!-- GENERATED from ${sourceRel} by scripts/${SCRIPT_NAME} — do not edit; rerun the script. -->`,
      '',
      agent.body,
    ].join('\n'),
};

/**
 * The generator adapters, keyed by registry platform name. The coverage guard
 * pins this map against the registry before any per-file work: every supported
 * agents row needs an entry here and every entry needs a supported row
 * (B-PGW pattern — a producer that disagrees with the registry fails loud).
 */
export const PLATFORM_AGENT_ADAPTERS: Record<string, AgentSurfaceAdapter> = {
  claude: claudeAdapter,
};

// ── Registry shape + coverage guard (§4.3.3, B-PGW pattern) ───────────────────

/**
 * Structural consistency gate — runs before ANY per-file work. Fatal (throws,
 * with the repair instruction) on: a malformed block; an agents.supported:true
 * row without a generator adapter; an adapter naming a non-supported row; a
 * supported:false row without a non-empty evidence string; or an adapter
 * emitting a field outside the row's allowed_fields.
 */
export function assertRegistryAdapterCoverage(schema: WorkspaceSchemaLike): void {
  const block = schema?.platform_surfaces;
  if (!block || typeof block !== 'object' || !block.platforms || typeof block.platforms !== 'object') {
    throw new Error(
      `${REGISTRY_BLOCK} block missing from ${SCHEMA_REL} — the registry IS the contract ` +
      `(repair: restore the ${REGISTRY_BLOCK} block per ${DESIGN_SPEC} §4.1; never regenerate mirrors without it)`,
    );
  }
  const problems: string[] = [];
  const supportedPlatforms = new Set<string>();
  for (const [platform, row] of Object.entries(block.platforms)) {
    for (const surface of ['agents', 'skills', 'commands', 'hooks'] as const) {
      const cap = (row as unknown as Record<string, SurfaceCapability | undefined>)[surface];
      if (!cap || typeof cap !== 'object' || typeof cap.supported !== 'boolean') {
        problems.push(`platforms.${platform}.${surface}: missing or non-boolean "supported"`);
        continue;
      }
      if (!cap.supported && !(typeof cap.evidence === 'string' && cap.evidence.trim() !== '')) {
        problems.push(`platforms.${platform}.${surface}: supported:false without an "evidence" string (add why, or flip the row deliberately)`);
      }
    }
    const agentsRow = row.agents;
    if (agentsRow?.supported === true) {
      supportedPlatforms.add(platform);
      if (!(typeof agentsRow.mirror_dir === 'string' && agentsRow.mirror_dir.trim() !== '')) {
        problems.push(`platforms.${platform}.agents: supported:true without a "mirror_dir"`);
      }
      if (agentsRow.model_format !== undefined && agentsRow.model_format !== 'alias' && agentsRow.model_format !== 'id') {
        problems.push(`platforms.${platform}.agents: model_format must be "alias" or "id"`);
      }
    }
  }
  for (const platform of Object.keys(PLATFORM_AGENT_ADAPTERS)) {
    if (!supportedPlatforms.has(platform)) {
      problems.push(
        `adapter '${platform}' names no agents.supported:true registry row — remove the adapter or flip the registry row deliberately ` +
        `(repair: keep PLATFORM_AGENT_ADAPTERS and ${REGISTRY_BLOCK} in lockstep; ${DESIGN_SPEC} §4.3.3)`,
      );
    }
  }
  for (const platform of supportedPlatforms) {
    if (!PLATFORM_AGENT_ADAPTERS[platform]) {
      problems.push(
        `registry marks platforms.${platform}.agents supported:true but PLATFORM_AGENT_ADAPTERS has no '${platform}' adapter ` +
        `(repair: add the adapter to scripts/${SCRIPT_NAME}, or set the row to supported:false with evidence)`,
      );
    }
    const allowed = block.platforms[platform]?.agents?.allowed_fields;
    const emits = PLATFORM_AGENT_ADAPTERS[platform]?.emits ?? [];
    if (Array.isArray(allowed)) {
      const outside = emits.filter((f) => !allowed.includes(f));
      if (outside.length > 0) {
        problems.push(
          `adapter '${platform}' emits field(s) [${outside.join(', ')}] outside platforms.${platform}.agents.allowed_fields ` +
          `[${allowed.join(', ')}] (repair: align the adapter's emits with the registry's allowed_fields)`,
        );
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `${REGISTRY_BLOCK} <-> generator adapter coverage guard FAILED (${problems.length}):\n  - ` +
      problems.join('\n  - ') +
      `\nRepair: bring ${SCHEMA_REL} ${REGISTRY_BLOCK} and PLATFORM_AGENT_ADAPTERS back in lockstep before running the generator.`,
    );
  }
}

// ── SSOT parsing ──────────────────────────────────────────────────────────────

/** Hard input-contract error; the message names the offending file. */
export class SsotError extends Error {}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Strip frontmatter from content, returning the body (all of it when none). */
function bodyOf(content: string): string {
  const m = FM_RE.exec(content);
  return m ? content.slice(m[0].length) : content;
}

function readVariantName(root: string): string {
  try {
    const v = JSON.parse(readFileSync(join(root, 'variant.json'), 'utf8')) as { variant?: unknown };
    return typeof v.variant === 'string' ? v.variant : '';
  } catch {
    return '';
  }
}

/**
 * Parse one agents/*.md SSOT file into a projectable agent. Hard-errors naming
 * the file on a missing `name`, `description`, or scalar `tier:` (never a
 * silent skip — the ADR-0102 validator lesson, §4.2). A `model:` field in the
 * SSOT input is itself the sweep's target violation: warn and ignore.
 * `extends:` stubs resolve to self-contained personas via the scaffold-time
 * composer; a stub whose L1 body is unavailable is a hard error (a dead stub
 * must never project into a mirror).
 */
export function parseSsotAgent(filePath: string, root: string, warnings: string[]): SsotAgent {
  const rel = relative(root, filePath).split('\\').join('/');
  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new SsotError(`${rel}: unreadable (${(err as Error).message})`);
  }
  const fmMatch = FM_RE.exec(content);
  if (!fmMatch) {
    throw new SsotError(`${rel}: no YAML frontmatter block — agents/*.md must carry name/description/scalar tier (${DESIGN_SPEC} §4.2)`);
  }
  const fm = fmMatch[1];

  // name/description parse through js-yaml so quoted/escaped values round-trip
  // exactly (quoteScalar re-escapes for the mirror); regex fallback keeps the
  // hard-error contract when the block does not parse as YAML.
  let name = '';
  let description = '';
  try {
    const parsed = yaml.load(fm) as Record<string, unknown> | null;
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.name === 'string') name = parsed.name.trim();
      if (typeof parsed.description === 'string') description = parsed.description.trim();
    }
  } catch {
    // fall through to the regex extraction below
  }
  if (!name) {
    const nameMatch = fm.match(/^name[ \t]*:[ \t]*(.+)$/m);
    name = nameMatch ? nameMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  }
  if (!name) {
    throw new SsotError(`${rel}: frontmatter is missing a usable "name:" field — hard error, never a silent skip (repair: add name to the SSOT frontmatter)`);
  }
  if (!description) {
    const descMatch = fm.match(/^description[ \t]*:[ \t]*(.+)$/m);
    description = descMatch ? descMatch[1].trim().replace(/^["']|["']$/g, '') : '';
  }
  if (!description) {
    throw new SsotError(`${rel}: frontmatter is missing a usable "description:" field — hard error, never a silent skip (repair: add description to the SSOT frontmatter)`);
  }
  // Scalar tier form only (ADR-0102 canonical). A legacy map-form tier block
  // has no scalar match and hard-errors here — exactly the SSOT-shape violation
  // the generator must never project.
  const tierMatch = fm.match(/^tier[ \t]*:[ \t]*([\w-]+)[ \t]*(?:#.*)?$/m);
  const tier = tierMatch ? tierMatch[1].trim().toLowerCase() : '';
  if (!tier || !VALID_TIERS.has(tier)) {
    throw new SsotError(`${rel}: frontmatter has no scalar "tier: high|medium|low" declaration — hard error (ADR-0102; repair: normalize the tier to the scalar form)`);
  }
  if (/^model[ \t]*:/m.test(fm)) {
    warnings.push(`${rel}: carries a "model:" field — the SSOT is platform-neutral (tier only); the field is ignored here and was removed by the sweep (§4.4)`);
  }

  let body = bodyOf(content);
  if (/^extends[ \t]*:/m.test(fm)) {
    const commonPath = join(root, 'templates', 'common', 'agents', basename(filePath));
    const variant = readVariantName(root);
    const composed = composeResolvedAgentContent(filePath, commonPath, variant);
    if (composed.missingL1) {
      throw new SsotError(
        `${rel}: extends-stub but the L1 body is unavailable (${commonPath}) — a stub must never project as a dead mirror ` +
        `(repair: restore templates/common/agents/${basename(filePath)} or inline the body)`,
      );
    }
    if (!composed.composed) {
      throw new SsotError(`${rel}: carries extends: but the composer declined to resolve it — refusing to project a stub body (repair: inline the persona body or fix the extends target)`);
    }
    body = bodyOf(composed.content);
  }
  if (body.trim() === '') {
    throw new SsotError(`${rel}: resolved body is empty — refusing to project an empty mirror`);
  }
  if (!body.endsWith('\n')) body += '\n';
  return { file: basename(filePath), name, description, tier, body };
}

/** Enumerate the SSOT roster: agents/*.md minus README-class and _COMMON.md. */
export function listSsotAgents(root: string): string[] {
  const dir = join(root, 'agents');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !/^README/i.test(f) && f !== '_COMMON.md')
    .sort()
    .map((f) => join(dir, f));
}

// ── Provenance manifest (sync-skills Phase 1c pattern) ────────────────────────

export interface ManagedManifest {
  version: number;
  generated: string[];
}

/**
 * Read the provenance manifest. Returns null when it is missing or corrupt —
 * "no/corrupt manifest removes nothing" (the first run adopts an existing tree
 * by recording the names this run generates; unknown files are never touched).
 */
export function readManagedManifest(mirrorDir: string): ManagedManifest | null {
  const p = join(mirrorDir, MIRROR_MANIFEST_NAME);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf8')) as { version?: unknown; generated?: unknown };
    if (!Array.isArray(parsed.generated) || parsed.generated.some((n) => typeof n !== 'string')) return null;
    return { version: typeof parsed.version === 'number' ? parsed.version : 1, generated: parsed.generated as string[] };
  } catch {
    return null;
  }
}

function writeManifestAtomic(mirrorDir: string, generated: string[]): void {
  const payload = `${JSON.stringify({ version: 1, generated: [...generated].sort() }, null, 2)}\n`;
  atomicWriteFile(join(mirrorDir, MIRROR_MANIFEST_NAME), payload);
}

/** Atomic file write: temp sibling + rename (the defaultCopyDir durability pattern). */
function atomicWriteFile(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  writeFileSync(tmp, content, 'utf8');
  renameSync(tmp, filePath);
}

// ── Core sync (library entry; CLI owns the lock) ─────────────────────────────

export interface MirrorDrift {
  kind: 'missing' | 'extra-managed' | 'differing';
  file: string;
  detail: string;
}

export interface SyncAgentMirrorsResult {
  ok: boolean;
  /** true when the target root is not a project root — mirrors are project-scoped (green no-op). */
  skipped: boolean;
  targetRoot: string;
  mirrorDir: string | null;
  agents: number;
  written: string[];
  removed: string[];
  unchanged: number;
  userFiles: string[];
  drifts: MirrorDrift[];
  warnings: string[];
  notes: string[];
}

/** Load docs/workspace-schema.json from the target root (registry + models). */
export function loadWorkspaceSchema(root: string): WorkspaceSchemaLike {
  const p = join(root, SCHEMA_REL);
  if (!existsSync(p)) {
    // R8: a half-delivered state (script present, schema block absent) fails
    // visibly — the same posture as validate-model-registry's missing-models fatal.
    throw new SsotError(`${SCHEMA_REL} not found under ${root} — the platform registry is the generator's contract (repair: deliver the schema, or run this script only in delivered roots)`);
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as WorkspaceSchemaLike;
  } catch (err) {
    throw new SsotError(`${SCHEMA_REL} is not valid JSON (${(err as Error).message})`);
  }
}

/**
 * Generate/verify agent mirrors for one target root.
 *
 * Write mode (check: false): compare-then-write every projected mirror, remove
 *   manifest-recorded mirrors whose SSOT counterpart is gone (manifest-gated),
 *   and rewrite the manifest to the generated set. Never removes unknown files.
 * Check mode (check: true): no writes — report missing / extra-managed /
 *   differing drift; the caller turns a non-empty drift list into exit 1.
 */
export function syncAgentMirrors(targetRoot: string, opts: { check?: boolean } = {}): SyncAgentMirrorsResult {
  const root = resolve(targetRoot);
  const result: SyncAgentMirrorsResult = {
    ok: true,
    skipped: false,
    targetRoot: root,
    mirrorDir: null,
    agents: 0,
    written: [],
    removed: [],
    unchanged: 0,
    userFiles: [],
    drifts: [],
    warnings: [],
    notes: [],
  };

  // The registry is the contract: load + coverage-guard BEFORE any per-file work.
  const schema = loadWorkspaceSchema(root);
  assertRegistryAdapterCoverage(schema);
  const models = schema.models ?? {};

  // Project scoping: a root without variant.json (the workspace root itself) is
  // mirror-less by design (root dispatch reads agents/ directly, §12) — green
  // no-op. Adding root mirrors later is a config change, not a redesign.
  if (!existsSync(join(root, 'variant.json'))) {
    result.skipped = true;
    result.notes.push(`${root} has no variant.json — mirrors are project-scoped; root rosters are read directly and generate no mirrors by design (${DESIGN_SPEC} §12)`);
    return result;
  }

  // Parse the SSOT roster (hard errors throw, naming the file).
  const ssotPaths = listSsotAgents(root);
  const agents: SsotAgent[] = ssotPaths.map((p) => parseSsotAgent(p, root, result.warnings));
  result.agents = agents.length;

  // v1 emits exactly the registry's supported rows (today: Claude Code only).
  const adapterEntries = Object.entries(PLATFORM_AGENT_ADAPTERS).filter(([platform]) =>
    schema.platform_surfaces?.platforms?.[platform]?.agents?.supported === true,
  );
  if (adapterEntries.length !== 1) {
    // Unreachable while the coverage guard holds (the pinned v1 set is exactly
    // one row); kept as a belt-and-braces invariant against multi-platform
    // surprises — extend the projection loop deliberately (§3) if it ever fires.
    throw new SsotError(`expected exactly one supported agents adapter in v1, found ${adapterEntries.length} — extend the projection loop deliberately (${DESIGN_SPEC} §3)`);
  }
  const [adapterPlatform, adapter] = adapterEntries[0]!;
  const agentsRow = schema.platform_surfaces!.platforms![adapterPlatform]!.agents;
  const mirrorDir = join(root, agentsRow.mirror_dir ?? '.claude/agents');
  result.mirrorDir = mirrorDir;
  const modelFormat = agentsRow.model_format ?? 'alias';

  // Projection set: name -> content.
  const projections = new Map<string, string>();
  for (const agent of agents) {
    const model = resolvePlatformModel(adapterPlatform, agent.tier, models, modelFormat);
    projections.set(agent.name, adapter.render(agent, model, `agents/${agent.file}`));
  }

  const prior = readManagedManifest(mirrorDir);
  if (prior === null) {
    result.notes.push(
      `no readable ${MIRROR_MANIFEST_NAME} under ${mirrorDir} — removals are disabled this run; ` +
      `existing mirrors with generated names are adopted by rewrite, unknown files stay untouched`,
    );
  }

  if (opts.check) {
    for (const [name, content] of projections) {
      const mirrorPath = join(mirrorDir, `${name}.md`);
      if (!existsSync(mirrorPath)) {
        result.drifts.push({ kind: 'missing', file: relative(root, mirrorPath), detail: `SSOT agents/${name}.md has no mirror` });
        continue;
      }
      const existing = readFileSync(mirrorPath, 'utf8');
      if (existing !== content) {
        result.drifts.push({ kind: 'differing', file: relative(root, mirrorPath), detail: 'mirror content differs from the registry-resolved projection' });
      }
    }
    if (prior !== null) {
      for (const name of prior.generated) {
        if (!projections.has(name) && existsSync(join(mirrorDir, `${name}.md`))) {
          result.drifts.push({ kind: 'extra-managed', file: relative(root, join(mirrorDir, `${name}.md`)), detail: 'recorded in the provenance manifest but its SSOT counterpart is gone' });
        }
      }
    }
    result.ok = result.drifts.length === 0;
    return result;
  }

  // Write mode.
  mkdirSync(mirrorDir, { recursive: true });
  for (const [name, content] of projections) {
    const mirrorPath = join(mirrorDir, `${name}.md`);
    if (existsSync(mirrorPath)) {
      const existing = readFileSync(mirrorPath, 'utf8');
      if (existing === content) {
        result.unchanged += 1;
        continue;
      }
    }
    atomicWriteFile(mirrorPath, content);
    result.written.push(relative(root, mirrorPath));
  }

  // Removals: manifest-gated (recorded AND SSOT gone). Never removes unknown
  // or user-added files; no/corrupt manifest removes nothing.
  if (prior !== null) {
    for (const name of prior.generated) {
      if (projections.has(name)) continue;
      const mirrorPath = join(mirrorDir, `${name}.md`);
      if (existsSync(mirrorPath)) {
        rmSync(mirrorPath, { force: true });
        result.removed.push(relative(root, mirrorPath));
      }
    }
  }

  // Files we neither generated nor recorded stay untouched (user-owned).
  for (const f of readdirSync(mirrorDir)) {
    if (!f.endsWith('.md')) continue;
    const stem = f.replace(/\.md$/, '');
    if (!projections.has(stem)) result.userFiles.push(relative(root, join(mirrorDir, f)));
  }
  if (result.userFiles.length > 0) {
    result.notes.push(`${result.userFiles.length} unmanaged mirror file(s) left untouched (never removed): ${result.userFiles.join(', ')}`);
  }

  writeManifestAtomic(mirrorDir, [...projections.keys()]);
  result.ok = true;
  return result;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { check: boolean; dir: string | null } {
  let check = false;
  let dir: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--check') {
      check = true;
    } else if (arg === '--dir') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        die(`--dir requires a path argument (got ${value ?? 'nothing'}) — usage: bun scripts/${SCRIPT_NAME} [--check] [--dir <path>]`);
      }
      dir = value;
      i += 1;
    } else {
      die(`unknown argument '${arg}' — usage: bun scripts/${SCRIPT_NAME} [--check] [--dir <path>]`);
    }
  }
  return { check, dir };
}

// Advisory PID-stamped lock (sync-skills T-20260912-017 pattern): PID-validated
// stale-lock recovery, signal-safe release. CLI-only — the library entry stays
// unguarded for testability.
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === 'EPERM';
  }
}

function acquireLock(root: string): void {
  const lockPath = join(root, LOCK_NAME);
  const writeLock = (): void => {
    writeFileSync(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, { flag: 'wx' });
  };
  const release = (): void => {
    try { rmSync(lockPath, { force: true }); } catch { /* best effort */ }
  };
  try {
    writeLock();
  } catch {
    let lockPid = NaN;
    try {
      lockPid = parseInt(readFileSync(lockPath, 'utf8').split('\n')[0]!.trim(), 10);
    } catch { /* unreadable lock treated as stale below */ }
    if (Number.isInteger(lockPid) && lockPid !== process.pid && pidAlive(lockPid)) {
      console.error(`ERROR: another ${SCRIPT_NAME} run appears active (pid ${lockPid}; lock: ${lockPath}).`);
      console.error('   Wait for it to finish, or remove the lock file if that process is gone.');
      process.exit(1);
    }
    console.warn(`WARNING: removing stale ${LOCK_NAME} (pid ${Number.isNaN(lockPid) ? 'unknown' : lockPid} is gone).`);
    try { rmSync(lockPath, { force: true }); } catch { /* fall through to retry */ }
    try {
      writeLock();
    } catch {
      console.error(`ERROR: could not acquire the ${LOCK_NAME} lock (${lockPath}) after stale-lock recovery — another run may be starting right now.`);
      process.exit(1);
    }
  }
  process.on('exit', release);
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      release();
      process.exit(1);
    });
  }
}

function printReport(res: SyncAgentMirrorsResult, check: boolean): number {
  if (res.skipped) {
    console.log(`sync-agent-mirrors: ${res.notes[0] ?? 'skipped (non-project root)'}`);
    return 0;
  }
  for (const w of res.warnings) console.warn(`  WARN: ${w}`);
  if (check) {
    if (res.drifts.length === 0) {
      console.log(`sync-agent-mirrors --check: ${res.agents} agent(s) in parity at ${res.mirrorDir} (0 missing / 0 extra-managed / 0 differing)`);
      return 0;
    }
    console.error(`Agent-mirror parity check FAILED — ${res.drifts.length} drift(s) at ${res.targetRoot}:`);
    for (const d of res.drifts) {
      console.error(`  [${d.kind}] ${d.file} — ${d.detail}`);
    }
    const dirArg = process.cwd() === res.targetRoot ? '' : ` --dir ${res.targetRoot}`;
    console.error(`Repair (one deliberate, reviewable write — /sync never auto-repairs): bun scripts/${SCRIPT_NAME}${dirArg}`);
    return 1;
  }
  console.log(
    `sync-agent-mirrors: ${res.agents} agent(s) -> ${res.mirrorDir} — ` +
    `${res.written.length} written, ${res.removed.length} removed, ${res.unchanged} unchanged`,
  );
  for (const f of res.written) console.log(`  wrote ${f}`);
  for (const f of res.removed) console.log(`  removed stale managed mirror ${f}`);
  for (const n of res.notes) console.log(`  note: ${n}`);
  return 0;
}

if (import.meta.main) {
  const { check, dir } = parseArgs(process.argv.slice(2));
  const rootArg = dir ?? process.cwd();
  const root = isAbsolute(rootArg) ? resolve(rootArg) : resolve(process.cwd(), rootArg);
  if (!existsSync(root)) {
    die(`Target root does not exist: ${root} (rejecting before any write)`);
  }
  let res: SyncAgentMirrorsResult;
  try {
    if (!check) acquireLock(root);
    res = syncAgentMirrors(root, { check });
  } catch (err) {
    console.error(`ERROR ${SCRIPT_NAME}: ${(err as Error).message}`);
    process.exit(1);
  }
  process.exit(printReport(res, check));
}
