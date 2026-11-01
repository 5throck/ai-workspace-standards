#!/usr/bin/env bun
// @version 1.0.1
// v1.0.1: stage() normalizes every StagedFile.relPath to forward slashes so
// marker swappedPaths / rollback lists render identically on win32 (repo-
// relative strings follow the isSafeRepoPath convention: backslash-free).
// hub-promotion.ts — asset-level L3→L2 promotion tool for the hub program
// (design docs/designs/2026-11-01-hub-consolidation-design.md §hub-promotion,
// Phase 1; executes the ratified per-suite frame of
// docs/designs/2026-10-27-co-design-suite-promotion-design.md).
//
// The SUITE is the unit of atomicity: either every asset copy, contract
// update, and registry entry of a suite lands, or the previous state is left
// untouched. A failed --apply run restores its backups and writes a rollback
// marker for diagnosis; it never leaves a half-applied suite behind.
//
// ── Suite manifest format (JSON; conventionally docs/hub-suites/<name>.suite.json)
//
// {
//   "suite": "co-security-security-suite",     // required, id-like (^[a-z0-9][a-z0-9._-]*$)
//   "hub_variant": "co-security",              // required, promoting hub (co-* variant)
//   "description": "...",                      // optional
//   "assets": [                                // required, >= 1
//     { "source": "Projects/co-security/skills/foo/SKILL.md",   // L3 project path, repo-relative
//       "dest":   "templates/co-security/skills/foo/SKILL.md",  // L2 template path, repo-relative
//       "kind":   "skill",                     // skill | agent | script | file
//       "name":   "foo" }                      // asset identifier (registry/contract key)
//   ],
//   "contract_updates": [                      // optional; variant.json contract updates
//     { "variant": "co-security", "type": "script_manifest",
//       "entry": { "name": "hub-audit", "path": "scripts/co-security/hub-audit.ts" } },
//     { "variant": "co-security", "type": "roster", "list": "agents",
//       "entry": { "name": "security-monitor", "file": "agents/security-monitor.md" } }
//   ],
//   "registry_entries": [ ...hub_topology.entries[] rows... ]  // optional; written to BOTH
// }                                              // workspace-schema.json copies identically
//
// JSON (not a TS const) because suites are data authored per promotion PR —
// the same reasoning as scripts/<variant>/generators.json; validators and
// reviewers read the manifest without importing this module.
//
// ── Mechanics
//
// 1. Staging: with --apply the complete future state of every touched file
//    (asset copies, re-rendered variant.json, re-rendered root + L1
//    workspace-schema.json) is built under .pipeline-state/hub-promotion/
//    (gitignored local-state convention) BEFORE any target is touched.
//    Dry-run stages under the OS temp dir and writes NOTHING inside the repo.
// 2. Targeted verification runs on the STAGED bytes (JSON parses, staged
//    schema pair canonical parity, entry shape). A pre-swap failure touches
//    nothing and still writes the failure marker.
// 3. Atomic swap: each target file is replaced by tmp+rename on the same
//    volume (atomic per file). Originals are backed up under the staging dir
//    first, so a post-swap failure (the full validate-templates.ts run) rolls
//    every swapped file back before exiting 1.
// 4. Registry writes keep the hand-maintained root + L1 pair byte-identical
//    for the hub_topology section (the schema-hash-parity gate's sanctioned
//    delta is the CONSTITUTION rootAllowlist entry only).
// 5. Idempotency: re-running a completed suite is a no-op reporting
//    "already promoted" (byte-equal asset copies + registry rows + contract
//    entries already present). A failed-run marker for the same suite blocks
//    re-runs until it is diagnosed and removed.
//
// Dry-run is the DEFAULT: no repo writes without --apply.
// Exit codes: 0 = success / dry-run plan / already-promoted; 1 = validation
// or verification failure (marker written); 2 = usage error.
//
// SCRIPTS.md registry note: row text reported to PM (registry edit owned by
// docs-writer per the dispatch brief).
//
// @l2-propagate: false

import {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { die } from './lib/error-handling.ts';
import {
  parseSemver, semverCompare, validateHubTopologyShape,
  type HubTopologyEntry, type HubTopology,
} from './helpers/hub-topology.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');

// ── Types ─────────────────────────────────────────────────────────────────

export type AssetKind = 'skill' | 'agent' | 'script' | 'file';

export interface SuiteAsset {
  source: string;
  dest: string;
  kind: AssetKind;
  name: string;
}

export interface ContractUpdate {
  variant: string;
  type: 'script_manifest' | 'roster';
  list?: 'agents' | 'skills';
  entry: Record<string, unknown>;
}

export interface SuiteManifest {
  suite: string;
  hub_variant: string;
  description?: string;
  assets: SuiteAsset[];
  contract_updates?: ContractUpdate[];
  registry_entries?: HubTopologyEntry[];
}

export interface StagedFile {
  relPath: string;          // repo-relative target path
  stagedPath: string;       // absolute path of the future bytes
  backupPath: string | null; // absolute path of the original bytes (null = target is new)
}

export interface PromotionPlan {
  manifest: SuiteManifest;
  staged: StagedFile[];
  alreadyPromoted: boolean;
  notes: string[];
}

export interface PromoteResult {
  ok: boolean;
  alreadyPromoted: boolean;
  dryRun: boolean;
  actions: string[];
  errors: string[];
  markerPath?: string;
}

// ── Manifest parsing / validation (pure) ──────────────────────────────────

const SUITE_ID = /^[a-z0-9][a-z0-9._-]*$/;
const HUB_VARIANT = /^co-[a-z]+$/;

/** Repo-relative, traversal-free, non-absolute path check. Rejects Windows
 * drive letters, leading slashes, and any `..` segment — the same containment
 * posture as the generator-manifest loader. */
export function isSafeRepoPath(p: string): boolean {
  if (typeof p !== 'string' || p.length === 0) return false;
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  if (p.includes('\\')) return false;
  const segments = p.split('/');
  if (segments.some(s => s === '' || s === '.' || s === '..')) return false;
  return true;
}

export function parseSuiteManifest(raw: string): { ok: true; manifest: SuiteManifest } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    return { ok: false, errors: [`manifest is not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const suite = obj['suite'];
  const hubVariant = obj['hub_variant'];
  if (typeof suite !== 'string' || !SUITE_ID.test(suite)) errors.push(`"suite" must match ${SUITE_ID.source}`);
  if (typeof hubVariant !== 'string' || !HUB_VARIANT.test(hubVariant)) errors.push(`"hub_variant" must match ${HUB_VARIANT.source}`);

  const assetsRaw = obj['assets'];
  if (!Array.isArray(assetsRaw) || assetsRaw.length === 0) {
    errors.push('"assets" must be a non-empty array');
  } else {
    assetsRaw.forEach((a, i) => {
      const where = `assets[${i}]`;
      if (!a || typeof a !== 'object' || Array.isArray(a)) {
        errors.push(`${where} must be an object`);
        return;
      }
      const asset = a as Record<string, unknown>;
      for (const field of ['source', 'dest', 'kind', 'name'] as const) {
        if (typeof asset[field] !== 'string' || (asset[field] as string).length === 0) {
          errors.push(`${where} missing required string field "${field}"`);
        }
      }
      if (typeof asset['kind'] === 'string' && !['skill', 'agent', 'script', 'file'].includes(asset['kind'])) {
        errors.push(`${where} kind must be skill | agent | script | file`);
      }
      if (typeof asset['source'] === 'string' && !isSafeRepoPath(asset['source'])) {
        errors.push(`${where} source must be a repo-relative, traversal-free path`);
      }
      if (typeof asset['dest'] === 'string' && !isSafeRepoPath(asset['dest'])) {
        errors.push(`${where} dest must be a repo-relative, traversal-free path`);
      }
      if (typeof asset['dest'] === 'string' && isSafeRepoPath(asset['dest']) && !asset['dest'].startsWith('templates/')) {
        errors.push(`${where} dest must live under templates/ (L2 delivery surface)`);
      }
    });
  }

  const updates = obj['contract_updates'];
  if (updates !== undefined) {
    if (!Array.isArray(updates)) {
      errors.push('"contract_updates" must be an array when present');
    } else {
      updates.forEach((u, i) => {
        const where = `contract_updates[${i}]`;
        if (!u || typeof u !== 'object' || Array.isArray(u)) {
          errors.push(`${where} must be an object`);
          return;
        }
        const update = u as Record<string, unknown>;
        if (typeof update['variant'] !== 'string' || !HUB_VARIANT.test(String(update['variant']))) {
          errors.push(`${where} variant must match ${HUB_VARIANT.source}`);
        }
        if (update['type'] !== 'script_manifest' && update['type'] !== 'roster') {
          errors.push(`${where} type must be "script_manifest" or "roster"`);
        }
        if (update['type'] === 'roster' && update['list'] !== 'agents' && update['list'] !== 'skills') {
          errors.push(`${where} roster updates must declare list: "agents" | "skills"`);
        }
        if (!update['entry'] || typeof update['entry'] !== 'object' || Array.isArray(update['entry'])) {
          errors.push(`${where} entry must be an object`);
        } else if (typeof (update['entry'] as Record<string, unknown>)['name'] !== 'string') {
          errors.push(`${where} entry missing required string field "name" (the upsert key)`);
        }
      });
    }
  }

  // Registry entries are shape-checked against the LIVE registry enums at plan
  // time (buildPlan); here only the minimal row shape is enforced.
  const registry = obj['registry_entries'];
  if (registry !== undefined && !Array.isArray(registry)) {
    errors.push('"registry_entries" must be an array when present');
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    manifest: {
      suite: String(suite),
      hub_variant: String(hubVariant),
      description: typeof obj['description'] === 'string' ? obj['description'] : undefined,
      assets: assetsRaw as SuiteAsset[],
      contract_updates: (updates as ContractUpdate[] | undefined) ?? [],
      registry_entries: (registry as HubTopologyEntry[] | undefined) ?? [],
    },
  };
}

/** Semantic validation that needs the repo: sources exist, dest roots exist,
 * registry entries validate against the live registry enums, and entry
 * versions are semver. Returns violation strings (empty = valid). */
export function validateSuiteAgainstRepo(manifest: SuiteManifest, rootDir: string): string[] {
  const errors: string[] = [];
  for (const [i, asset] of manifest.assets.entries()) {
    const src = join(rootDir, asset.source);
    if (!existsSync(src)) errors.push(`assets[${i}] source does not exist: ${asset.source}`);
    else if (!statSync(src).isFile()) errors.push(`assets[${i}] source is not a file: ${asset.source}`);
    // dest must live under an EXISTING variant template root (the swap creates
    // intermediate asset directories itself; promotions legitimately add new
    // nested skill/agent directories)
    const segments = asset.dest.split('/');
    if (segments[0] === 'templates' && segments[1]) {
      const variantRoot = join(rootDir, 'templates', segments[1]);
      if (!existsSync(variantRoot)) errors.push(`assets[${i}] dest variant template does not exist: templates/${segments[1]}`);
    }
  }
  const loaded = loadRegistry(rootDir);
  if (!loaded.ok) {
    errors.push(`hub_topology registry unreadable: ${loaded.error}`);
    return errors;
  }
  const topology = loaded.topology!;
  const domains = new Set(Array.isArray(topology.domains) ? topology.domains : []);
  const categories = new Set(Array.isArray(topology.categories) ? topology.categories : []);
  for (const [i, row] of (manifest.registry_entries ?? []).entries()) {
    const where = `registry_entries[${i}]`;
    const required: Array<[string, unknown]> = [['asset', row?.asset], ['domain', row?.domain], ['hub_variant', row?.hub_variant], ['category', row?.category], ['canonical_path', row?.canonical_path], ['version', row?.version]];
    for (const [field, value] of required) {
      if (typeof value !== 'string' || value.length === 0) errors.push(`${where} missing required string field "${field}"`);
    }
    if (typeof row?.domain === 'string' && domains.size > 0 && !domains.has(row.domain)) {
      errors.push(`${where} domain "${row.domain}" is not in hub_topology.domains`);
    }
    if (typeof row?.category === 'string' && categories.size > 0 && !categories.has(row.category)) {
      errors.push(`${where} category "${row.category}" is not in hub_topology.categories`);
    }
    if (typeof row?.version === 'string' && !parseSemver(row.version)) {
      errors.push(`${where} version "${row.version}" is not MAJOR.MINOR.PATCH semver`);
    }
    if (typeof row?.hub_variant === 'string' && row.hub_variant !== manifest.hub_variant) {
      errors.push(`${where} hub_variant "${row.hub_variant}" does not match the manifest hub_variant "${manifest.hub_variant}"`);
    }
    if (typeof row?.canonical_path === 'string' && !isSafeRepoPath(row.canonical_path)) {
      errors.push(`${where} canonical_path must be a repo-relative, traversal-free path`);
    }
  }
  return errors;
}

function loadRegistry(rootDir: string): { ok: boolean; topology?: HubTopology; error?: string } {
  const schemaPath = join(rootDir, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) return { ok: false, error: 'docs/workspace-schema.json not found' };
  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const topology = schema['hub_topology'] as HubTopology | undefined;
    if (!topology || typeof topology !== 'object') return { ok: false, error: 'hub_topology section absent' };
    return { ok: true, topology };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── Registry upsert (targeted textual patch — see header §Mechanics 4) ────

function renderEntryRow(row: HubTopologyEntry): string {
  // Rows render expanded (JSON.stringify 2-space) re-indented to sit inside
  // hub_topology.entries at the file's top-level indentation (entries items
  // sit at 6 spaces: "entries": [ ... "      {" ...).
  const rendered = JSON.stringify(row, null, 2);
  return rendered.split('\n').map((l, i) => (i === 0 ? l : '    ' + l)).join('\n');
}

/** Upsert rows into a workspace-schema.json FILE's hub_topology.entries array
 * by targeted textual splice — the rest of the file is preserved byte-for-byte
 * (one-time formatting churn in a 750-line hand-maintained pair is worse than
 * a splice). Returns the new file text. Row identity is (asset, domain). */
export function upsertRegistryEntriesInText(fileText: string, rows: HubTopologyEntry[]): string {
  if (rows.length === 0) return fileText;
  const marker = '"hub_topology": {';
  const start = fileText.indexOf(marker);
  if (start === -1) throw new Error('hub_topology section not found in schema file');
  const trimmed = fileText.replace(/\s+$/, '');
  // Locate the section's MATCHING closing brace (string-aware bracket count) —
  // never assume the section runs to end-of-file: splicing past its real end
  // would silently destroy any member that follows it.
  const open = fileText.indexOf('{', start);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = open; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) throw new Error('hub_topology section is not properly closed');
  // The section is the LAST member of the file by landing convention — the
  // only thing allowed after it is the root object's closing brace.
  const tail = trimmed.slice(end + 1).replace(/\s+/g, '');
  if (tail !== '}') {
    throw new Error('hub_topology must be the last member of the schema file (landing convention) — refusing to splice; reconcile the file layout first');
  }
  const parsed = JSON.parse('{' + trimmed.slice(start, end + 1) + '}') as { hub_topology: HubTopology };
  const topology = parsed.hub_topology;
  const entries = Array.isArray(topology.entries) ? (topology.entries as HubTopologyEntry[]) : [];
  for (const row of rows) {
    const idx = entries.findIndex(e => e && e.asset === row.asset && e.domain === row.domain);
    if (idx >= 0) entries[idx] = row;
    else entries.push(row);
  }
  topology.entries = entries;
  // Re-render: identical technique to the A2 landing (indent every rendered
  // line by 2 except the first). Rendering BOTH copies through this function
  // keeps the hand-maintained pair byte-identical for the section.
  const renderedSection = JSON.stringify({ hub_topology: topology }, null, 2)
    .slice(1, -1) // drop the wrapper braces
    .trim();
  const indented = renderedSection.split('\n').map((l, i) => (i === 0 ? l : '  ' + l)).join('\n');
  return trimmed.slice(0, start) + indented + '\n}\n';
}

// ── Contract updates (variant.json upserts) ───────────────────────────────

/** Upsert a contract entry into a parsed variant.json object. Returns an
 * error string on shape problems, else null. Mutates the object. */
export function upsertContractEntry(variantJson: Record<string, unknown>, update: ContractUpdate): string | null {
  if (update.type === 'script_manifest') {
    const sm = (variantJson['script_manifest'] as Record<string, unknown> | undefined) ?? {};
    const local = Array.isArray(sm['local']) ? (sm['local'] as Array<Record<string, unknown>>) : [];
    const idx = local.findIndex(e => e && e['name'] === update.entry['name']);
    if (idx >= 0) local[idx] = update.entry;
    else local.push(update.entry);
    sm['local'] = local;
    variantJson['script_manifest'] = sm;
    return null;
  }
  // roster
  const listKey = update.list === 'agents' ? 'agents' : 'skills';
  const list = Array.isArray(variantJson[listKey]) ? (variantJson[listKey] as Array<Record<string, unknown>>) : [];
  const idx = list.findIndex(e => e && e['name'] === update.entry['name']);
  if (idx >= 0) list[idx] = update.entry;
  else list.push(update.entry);
  variantJson[listKey] = list;
  return null;
}

/** Is this contract update already present (idempotency check)? */
export function contractEntryPresent(variantJson: Record<string, unknown>, update: ContractUpdate): boolean {
  let list: Array<Record<string, unknown>>;
  if (update.type === 'script_manifest') {
    const sm = variantJson['script_manifest'] as Record<string, unknown> | undefined;
    if (!sm || !Array.isArray(sm['local'])) return false;
    list = sm['local'] as Array<Record<string, unknown>>;
  } else {
    const listKey = update.list === 'agents' ? 'agents' : 'skills';
    if (!Array.isArray(variantJson[listKey])) return false;
    list = variantJson[listKey] as Array<Record<string, unknown>>;
  }
  return list.some(e => e && e['name'] === update.entry['name'] && JSON.stringify(e) === JSON.stringify(update.entry));
}

// ── Plan building ─────────────────────────────────────────────────────────

/** Detect the indentation of a JSON file from its second line (4 for the
 * variant.json family, 2 for the schema pair). */
function detectIndent(text: string): string {
  const m = /\n(\s+)\S/.exec(text);
  return m ? m[1] : '  ';
}

export function buildPlan(manifest: SuiteManifest, rootDir: string): PromotionPlan {
  const notes: string[] = [];
  const staged: StagedFile[] = [];
  let alreadyPromoted = true;

  // Asset copies
  for (const asset of manifest.assets) {
    const destAbs = join(rootDir, asset.dest);
    const destExists = existsSync(destAbs);
    let contentEqual = false;
    if (destExists) {
      const srcBuf = readFileSync(join(rootDir, asset.source));
      contentEqual = srcBuf.equals(readFileSync(destAbs));
    }
    if (!destExists || !contentEqual) alreadyPromoted = false;
    if (!destExists) notes.push(`new file: ${asset.dest}`);
    else if (!contentEqual) notes.push(`content update: ${asset.dest}`);
    else notes.push(`unchanged: ${asset.dest}`);
  }

  // Contract updates
  for (const update of manifest.contract_updates ?? []) {
    const vjPath = join(rootDir, 'templates', update.variant, 'variant.json');
    if (!existsSync(vjPath)) {
      notes.push(`variant.json missing for ${update.variant} — update will create the contract block`);
      alreadyPromoted = false;
      continue;
    }
    const vj = JSON.parse(readFileSync(vjPath, 'utf-8')) as Record<string, unknown>;
    if (contractEntryPresent(vj, update)) notes.push(`contract entry already present: ${update.variant}/${update.type}/${String(update.entry['name'])}`);
    else {
      alreadyPromoted = false;
      notes.push(`contract update: ${update.variant}/${update.type}/${String(update.entry['name'])}`);
    }
  }

  // Registry entries (already registered with identical content?)
  const loaded = loadRegistry(rootDir);
  for (const row of manifest.registry_entries ?? []) {
    let present = false;
    if (loaded.ok) {
      const entries = Array.isArray(loaded.topology!.entries) ? (loaded.topology!.entries as HubTopologyEntry[]) : [];
      const existing = entries.find(e => e && e.asset === row.asset && e.domain === row.domain);
      if (existing && JSON.stringify(existing) === JSON.stringify(row)) present = true;
      else if (existing) notes.push(`registry row version update: ${row.asset} (${String(existing.version)} → ${row.version})`);
    }
    if (present) notes.push(`registry row already present: ${row.asset}`);
    else alreadyPromoted = false;
  }

  return { manifest, staged, alreadyPromoted, notes };
}

// ── Staging + verification + swap ─────────────────────────────────────────

interface Staging {
  root: string;
  payloadDir: string; // mirrors target repo-relative paths
  backupDir: string;
}

function makeStaging(rootDir: string, apply: boolean, suite: string): Staging {
  if (apply) {
    const base = join(rootDir, '.pipeline-state', 'hub-promotion');
    mkdirSync(base, { recursive: true });
    const root = join(base, `${suite}.${process.pid}.${Date.now()}`);
    mkdirSync(root, { recursive: true });
    return { root, payloadDir: join(root, 'payload'), backupDir: join(root, 'backups') };
  }
  // dry-run: stage outside the repo — a dry run writes NOTHING into the workspace
  const root = mkdtempSync(join(tmpdir(), 'hub-promotion-dryrun-'));
  return { root, payloadDir: join(root, 'payload'), backupDir: join(root, 'backups') };
}

function stageAll(manifest: SuiteManifest, rootDir: string, staging: Staging): { staged: StagedFile[]; errors: string[] } {
  const staged: StagedFile[] = [];
  const errors: string[] = [];
  // relPath is a LOGICAL repo-relative locator (marker swappedPaths, rollback
  // lists, verifyStaged comparisons) — always forward slashes regardless of
  // OS, matching the isSafeRepoPath convention. win32 path.join accepts
  // forward-slash segments, so filesystem ops below are unaffected.
  const stage = (rawRelPath: string, content: Buffer | string) => {
    const relPath = rawRelPath.replace(/\\/g, '/');
    const targetAbs = join(staging.payloadDir, relPath);
    mkdirSync(dirname(targetAbs), { recursive: true });
    writeFileSync(targetAbs, content);
    const backupAbs = join(staging.backupDir, relPath);
    const targetInRepo = join(rootDir, relPath);
    let backupPath: string | null = null;
    if (existsSync(targetInRepo)) {
      mkdirSync(dirname(backupAbs), { recursive: true });
      copyFileSync(targetInRepo, backupAbs);
      backupPath = backupAbs;
    }
    staged.push({ relPath, stagedPath: targetAbs, backupPath });
  };

  // 1. asset copies (raw bytes)
  for (const asset of manifest.assets) {
    try {
      stage(asset.dest, readFileSync(join(rootDir, asset.source)));
    } catch (e) {
      errors.push(`failed to stage asset ${asset.source}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 2. contract updates (re-rendered variant.json)
  for (const update of manifest.contract_updates ?? []) {
    const relPath = join('templates', update.variant, 'variant.json');
    try {
      const abs = join(rootDir, relPath);
      const raw = existsSync(abs) ? readFileSync(abs, 'utf-8') : '{\n}';
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const err = upsertContractEntry(obj, update);
      if (err) errors.push(`${update.variant} variant.json: ${err}`);
      else stage(relPath, JSON.stringify(obj, null, detectIndent(raw)) + '\n');
    } catch (e) {
      errors.push(`failed to stage contract update ${relPath}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 3. registry entries (root + L1 pair, byte-identical section)
  if ((manifest.registry_entries ?? []).length > 0) {
    for (const relPath of ['docs/workspace-schema.json', 'templates/common/docs/workspace-schema.json']) {
      try {
        const abs = join(rootDir, relPath);
        if (!existsSync(abs)) {
          errors.push(`schema copy missing: ${relPath}`);
          continue;
        }
        const raw = readFileSync(abs, 'utf-8');
        stage(relPath, upsertRegistryEntriesInText(raw, manifest.registry_entries ?? []));
      } catch (e) {
        errors.push(`failed to stage registry update ${relPath}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  return { staged, errors };
}

/** Targeted verification over the STAGED bytes: every staged JSON parses, and
 * the staged root + L1 schema pair are canonically identical beyond the
 * sanctioned CONSTITUTION rootAllowlist delta (same normalization as
 * validate-templates.ts canonicalWsSchemaForParity — restated here because
 * that validator is not importable without running its top-level body). */
function verifyStaged(staged: StagedFile[]): string[] {
  const errors: string[] = [];
  let rootCanon: string | null = null;
  let l1Canon: string | null = null;
  for (const file of staged) {
    if (!file.relPath.endsWith('.json')) continue;
    try {
      const parsed = JSON.parse(readFileSync(file.stagedPath, 'utf-8')) as Record<string, unknown>;
      if (file.relPath === 'docs/workspace-schema.json') rootCanon = canonicalWsSchema(parsed, 'root');
      if (file.relPath === 'templates/common/docs/workspace-schema.json') l1Canon = canonicalWsSchema(parsed, 'l1');
      const topology = parsed['hub_topology'] as HubTopology | undefined;
      if (topology) {
        for (const e of validateHubTopologyShape(topology)) errors.push(`staged ${file.relPath}: ${e}`);
      }
    } catch (e) {
      errors.push(`staged ${file.relPath} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (rootCanon !== null && l1Canon !== null && rootCanon !== l1Canon) {
    errors.push('staged schema pair diverge beyond the sanctioned L1 delta (CONSTITUTION.md rootAllowlist + _notes.root_allowlist_divergence) — registry writes must keep the pair identical');
  }
  return errors;
}

function canonicalWsSchema(obj: Record<string, unknown>, level: 'root' | 'l1'): string {
  const clone = JSON.parse(JSON.stringify(obj)) as {
    rootAllowlist?: { files?: string[] };
    _notes?: Record<string, unknown>;
  };
  if (level === 'root') {
    const files = clone.rootAllowlist?.files;
    if (Array.isArray(files)) {
      const idx = files.indexOf('CONSTITUTION.md');
      if (idx !== -1) files.splice(idx, 1);
    }
  } else {
    if (clone._notes) delete clone._notes.root_allowlist_divergence;
  }
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>).sort().reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = canon((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
    }
    return v;
  };
  return JSON.stringify(canon(clone));
}

/** Post-swap verification: the full template battery must stay green.
 * Injectable in tests (runValidator) so the unit suite never spawns the real
 * validator against a fixture tree. */
export type ValidatorRunner = (rootDir: string) => { ok: boolean; output: string };

const DEFAULT_VALIDATOR: ValidatorRunner = (rootDir) => {
  const res = spawnSync('bun', ['scripts/validate-templates.ts'], { cwd: rootDir, encoding: 'utf-8', timeout: 300_000 });
  return { ok: res.status === 0, output: (res.stdout ?? '') + (res.stderr ?? '') };
};

function writeFailureMarker(rootDir: string, suite: string, phase: string, errors: string[], swapped: string[]): string {
  const dir = join(rootDir, '.pipeline-state', 'hub-promotion');
  mkdirSync(dir, { recursive: true });
  const markerPath = join(dir, `${suite}.failed.json`);
  writeFileSync(markerPath, JSON.stringify({
    suite,
    phase,
    timestamp: new Date().toISOString(),
    pid: process.pid,
    errors,
    swappedPaths: swapped,
    remedy: 'Diagnose the errors above, fix the suite manifest or the target state, remove this marker, and re-run. Backups (when the phase is post-swap) are named inside swappedPaths under .pipeline-state/hub-promotion/.',
  }, null, 2) + '\n');
  return markerPath;
}

function rollback(staged: StagedFile[], rootDir: string): string[] {
  const restored: string[] = [];
  for (const file of staged) {
    const target = join(rootDir, file.relPath);
    try {
      if (file.backupPath && existsSync(file.backupPath)) {
        copyFileSync(file.backupPath, target); // restore previous content
        restored.push(file.relPath);
      } else if (!file.backupPath && existsSync(target)) {
        rmSync(target); // the swap created a new file — remove it
        restored.push(`${file.relPath} (removed new file)`);
      }
    } catch {
      // best-effort rollback; the marker records what was swapped so a human
      // can finish the restore — never mask a rollback error behind success
    }
  }
  return restored;
}

/** Swap every staged file into place: tmp+rename on the same volume (atomic
 * per file). The staging payload lives under .pipeline-state/ (same volume as
 * the repo), so renames are atomic; the per-target tmp file absorbs a crash
 * mid-copy (a stale tmp never becomes a target). */
function swapIntoPlace(staged: StagedFile[], rootDir: string): string[] {
  const swapped: string[] = [];
  for (const file of staged) {
    const target = join(rootDir, file.relPath);
    mkdirSync(dirname(target), { recursive: true });
    const tmp = `${target}.hubpromo-${process.pid}.tmp`;
    copyFileSync(file.stagedPath, tmp);
    renameSync(tmp, target);
    swapped.push(file.relPath);
  }
  return swapped;
}

// ── Main entry (injectable for tests) ─────────────────────────────────────

export interface PromoteOptions {
  rootDir: string;
  manifestPath: string;
  apply: boolean;
  runValidator?: ValidatorRunner;
}

export function promoteSuite(opts: PromoteOptions): PromoteResult {
  const { rootDir, manifestPath, apply } = opts;
  const runValidator = opts.runValidator ?? DEFAULT_VALIDATOR;
  const actions: string[] = [];
  const errors: string[] = [];

  const raw = readFileSync(join(rootDir, manifestPath), 'utf-8');
  const parsed = parseSuiteManifest(raw);
  if (!parsed.ok) {
    return { ok: false, alreadyPromoted: false, dryRun: !apply, actions, errors: parsed.errors };
  }
  const manifest = parsed.manifest;

  // A previous failed run blocks re-execution until diagnosed.
  const markerPath = join(rootDir, '.pipeline-state', 'hub-promotion', `${manifest.suite}.failed.json`);
  if (existsSync(markerPath)) {
    return {
      ok: false, alreadyPromoted: false, dryRun: !apply, actions,
      errors: [`a failure marker exists for suite "${manifest.suite}": ${markerPath} — diagnose it, resolve, remove the marker, then re-run`],
    };
  }

  const repoErrors = validateSuiteAgainstRepo(manifest, rootDir);
  if (repoErrors.length > 0) {
    return { ok: false, alreadyPromoted: false, dryRun: !apply, actions, errors: repoErrors };
  }

  const plan = buildPlan(manifest, rootDir);
  if (plan.alreadyPromoted) {
    actions.push(`suite "${manifest.suite}" is already promoted (all asset copies byte-equal, registry rows and contract entries present) — no-op`);
    return { ok: true, alreadyPromoted: true, dryRun: !apply, actions, errors };
  }

  const staging = makeStaging(rootDir, apply, manifest.suite);
  try {
    const { staged, errors: stageErrors } = stageAll(manifest, rootDir, staging);
    if (stageErrors.length > 0) {
      if (apply) {
        const mp = writeFailureMarker(rootDir, manifest.suite, 'stage', stageErrors, []);
        return { ok: false, alreadyPromoted: false, dryRun: false, actions, errors: stageErrors, markerPath: mp };
      }
      return { ok: false, alreadyPromoted: false, dryRun: true, actions, errors: stageErrors };
    }

    const verifyErrors = verifyStaged(staged);
    if (verifyErrors.length > 0) {
      if (apply) {
        const mp = writeFailureMarker(rootDir, manifest.suite, 'verify-staged', verifyErrors, []);
        return { ok: false, alreadyPromoted: false, dryRun: false, actions, errors: verifyErrors, markerPath: mp };
      }
      return { ok: false, alreadyPromoted: false, dryRun: true, actions, errors: verifyErrors };
    }

    for (const note of plan.notes) actions.push(note);
    actions.push(`staged ${staged.length} file(s) under ${staging.payloadDir}`);
    if (staged.some(s => s.relPath.endsWith('workspace-schema.json'))) {
      actions.push('registry writes keep the root + L1 schema pair byte-identical for the hub_topology section');
    }

    if (!apply) {
      actions.push('DRY-RUN — no files written (pass --apply to execute). Full validate-templates.ts verification runs after the swap in --apply mode.');
      return { ok: true, alreadyPromoted: false, dryRun: true, actions, errors };
    }

    // Atomic swap
    let swapped: string[] = [];
    try {
      swapped = swapIntoPlace(staged, rootDir);
    } catch (e) {
      const restored = rollback(staged, rootDir);
      const msg = `swap failed: ${e instanceof Error ? e.message : String(e)}; rolled back ${restored.length} file(s)`;
      const mp = writeFailureMarker(rootDir, manifest.suite, 'swap', [msg, ...errors], swapped);
      return { ok: false, alreadyPromoted: false, dryRun: false, actions, errors: [msg], markerPath: mp };
    }

    // Post-swap verification: the full battery on the real tree
    const verdict = runValidator(rootDir);
    if (!verdict.ok) {
      const restored = rollback(staged, rootDir);
      const firstFails = verdict.output.split('\n').filter(l => l.includes('[FAIL]')).slice(0, 10);
      const msg = `post-swap validate-templates.ts failed — rolled back ${restored.length} file(s); validator FAIL lines: ${firstFails.length > 0 ? firstFails.join(' | ') : '(see output below)'}`;
      const mp = writeFailureMarker(rootDir, manifest.suite, 'verify-post-swap', [msg, ...firstFails], swapped);
      return { ok: false, alreadyPromoted: false, dryRun: false, actions, errors: [msg], markerPath: mp };
    }

    actions.push(`swapped ${swapped.length} file(s) into place; validate-templates.ts green after the swap`);
    // success — staging no longer needed; the parent base directory is removed
    // only when empty (rmdirSync fails silently on markers of failed runs)
    rmSync(staging.root, { recursive: true, force: true });
    try { rmdirSync(join(rootDir, '.pipeline-state', 'hub-promotion')); } catch { /* non-empty — failed-run markers live there */ }
    actions.push('Next: review the diff, then land via the per-suite promotion PR frame (2026-10-27 design); SCRIPTS.md/CHANGELOG rows are docs-writer-owned.');
    return { ok: true, alreadyPromoted: false, dryRun: false, actions, errors };
  } finally {
    if (!apply) rmSync(staging.root, { recursive: true, force: true });
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────

const USAGE = `hub-promotion.ts — suite-atomic L3→L2 promotion for the hub program (design 2026-11-01-hub-consolidation §hub-promotion)

Usage:
  bun scripts/hub-promotion.ts <suite-manifest.json> [--apply]

Arguments:
  <suite-manifest.json>   Suite manifest (repo-relative path; conventionally
                          docs/hub-suites/<name>.suite.json — format documented
                          in this script's header comment).
  --apply                 Execute the promotion. WITHOUT this flag the script
                          is a DRY-RUN: it stages, verifies the staged state,
                          and prints the plan — no repo writes.

Exit codes:
  0  success, dry-run plan, or already-promoted no-op
  1  manifest/validation/verification failure (a failure marker is written
     under .pipeline-state/hub-promotion/<suite>.failed.json on --apply runs)
  2  usage error

Examples:
  bun scripts/hub-promotion.ts docs/hub-suites/co-security-security-suite.suite.json          # dry-run
  bun scripts/hub-promotion.ts docs/hub-suites/co-security-security-suite.suite.json --apply  # execute`;

function main(): number {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
    console.log(USAGE);
    return argv.length === 0 && !argv.includes('--help') ? 2 : 0;
  }
  const apply = argv.includes('--apply');
  const positional = argv.filter(a => !a.startsWith('--'));
  if (positional.length !== 1) {
    console.error('Usage: bun scripts/hub-promotion.ts <suite-manifest.json> [--apply]  (see --help)');
    return 2;
  }
  const manifestPath = positional[0]!;
  if (!existsSync(join(WORKSPACE_ROOT, manifestPath))) {
    die(`suite manifest not found: ${manifestPath}`, 1);
  }
  const result = promoteSuite({ rootDir: WORKSPACE_ROOT, manifestPath, apply });

  console.log(`\nhub-promotion: suite manifest ${manifestPath} (${apply ? 'APPLY' : 'DRY-RUN'})`);
  for (const action of result.actions) console.log(`  • ${action}`);
  if (result.alreadyPromoted) console.log('  ✓ already promoted — no-op');
  if (result.errors.length > 0) {
    for (const e of result.errors) console.error(`  ✗ ${e}`);
    if (result.markerPath) console.error(`  ✗ failure marker: ${result.markerPath}`);
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
