// @version 1.3.0
// v1.1.0: .env.sample reclassified PRESERVE → SYNC/ENV_SAMPLE SYNC (upgrade-project v1.23.0):
//         the upgrade path now re-delivers template env-key changes with scaffold-parity
//         country pruning applied (shared scripts/lib/env-sample-blocks.ts), so template
//         .env.sample additions reach existing projects without re-injecting pruned
//         country blocks.
// upgrade-policy.ts — Upgrade classification SSOT (2026-09-11-upgrade-policy-coverage-design.md)
// Classifies EVERY project-relative path a template can deliver. The fallback claim is
// TEMPLATE TREE SYNC (deliver by default): coverage is deny-list, not an enumeration, so a
// template file added without any governance decision still reaches existing projects.
//
// Consumers:
//   - scripts/upgrade-project.ts — the TEMPLATE TREE SYNC pass delivers every file whose
//     claim.pass === TEMPLATE_TREE_SYNC_PASS (legacy passes keep owning their classified paths).
//   - scripts/check-upgrade-coverage.ts — reports the classification matrix over the whole
//     effective template tree and gates on the strict checks (placeholders, WS-07, JSON health).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Delivery policies. `SYNC` is the default fallback (deliver with conflict warning). */
export type UpgradePolicy =
  | 'LOCKED'
  | 'MERGE_MANAGED'
  | 'OVERWRITE'
  | 'VERSIONED_SYNC'
  | 'HASH_SYNC'
  | 'ADD_IF_MISSING'
  | 'REGENERATED'
  | 'PRESERVE'
  | 'PROJECT_STATE'
  | 'TEMPLATE_ONLY'
  | 'JSON_MERGE'
  | 'WORKSPACE'
  | 'SYNC';

export interface UpgradeClaim {
  policy: UpgradePolicy;
  /** Which upgrade-project.ts pass owns (or, for TEMPLATE_TREE_SYNC_PASS, should deliver) this path. */
  pass: string;
}

/** Pass id of the default-policy delivery pass in scripts/upgrade-project.ts. */
export const TEMPLATE_TREE_SYNC_PASS = 'TEMPLATE TREE SYNC';

// ── Legacy pass inventories (mirrored from scripts/upgrade-project.ts; drift-guarded by tests) ──

/** GOVERNANCE FILES SYNC list (upgrade-project.ts). SECURITY.md added per design D5. */
export const GOVERNANCE_FILES = ['LICENSE', 'SECURITY.md'] as const;

/** docs/ subdirectories that are PROJECT WORKSPACES: template seeds are add-if-missing only;
 *  project artifacts there are never overwritten and never pruned. `specs` (ADR-0074): the
 *  registry seed is what activates the Universal Design Gate in a project — it MUST ride the
 *  TEMPLATE TREE SYNC pass (a named pass with no delivery code is silently never delivered:
 *  the 2026-09-12 DESIGN GATE SEED incident). */
export const WORKSPACE_DOC_DIRS = [
  'designs', 'drafts', 'reports', 'research', 'findings', 'threat-models', 'lifecycle', 'specs',
] as const;

/** Platform settings files merged (not overwritten) by the TEMPLATE TREE SYNC pass. */
export const JSON_MERGE_FILES = ['.claude/settings.json', '.gemini/settings.json'] as const;

/** Files whose scaffold-delivered copy was intentionally left unsubstituted — `{{tokens}}` are
 *  expected content, so the coverage validator's placeholder check must not flag them. */
export const PLACEHOLDER_ALLOWLIST = new Set([
  'docs/README.template.md',
  'docs/README_ko.template.md',
]);

// ── Scaffold-parity facts (mirrored from scripts/new-project.ts) ─────────────────────────────

/** Staging zones the scaffold DELETES after copying (mirrored from scripts/new-project.ts
 *  L1_ONLY_DIRS + the template-only docs removal loop) — template-side only; upgrading them
 *  into a project would resurrect files the scaffold deliberately removed. docs/specs left
 *  this list in ADR-0074 Amendment 2: its registry seed activates the Universal Design Gate
 *  in projects and rides the WORKSPACE seed semantics above. */
const TEMPLATE_ONLY_DIRS = [
  'docs/_common', 'docs/_templates', 'docs/_examples', 'docs/variants', 'docs/adr',
];

const TEMPLATE_ONLY_FILES = new Set([
  'docs/variant.context.template.md',
  'agents/lifecycle-manager.md',
  'agents/_COMMON.md',
  'agents/pm.md.backup',
  'scripts/propagation-map.json',
]);

/** Project runtime / generated state — exists in projects but is never template-delivered. */
const PROJECT_STATE_FILES = new Set([
  'package.json', 'bun.lock', 'bun.lockb', 'package-lock.json',
  'variant.json', 'scripts-snapshot.json',
]);

const PRESERVE_FILES = new Set([
  'README.md', 'README_ko.md', 'CHANGELOG.md', 'docs/README.md', 'docs/README_ko.md',
]);

const REGENERATED_FILES = new Set(['docs/skill-graph.json', '.claude/template-version.txt']);

const LOCKED_FILES = new Set(['.gitattributes', '.gitleaks.toml']);

const MERGE_MANAGED_FILES = new Set(['CLAUDE.md', 'GEMINI.md', '.gitignore', 'AGENTS.md', 'agents/pm.md']);

const OVERWRITE_FILES = new Set(['docs/phase-definitions.md', 'docs/security.md']);

const TRAVERSAL_SKIP_DIRS = new Set(['node_modules', '.git', '.gateguard-state']);

/** Top-level dirs claimed by dedicated upgrade passes / platform machinery (everything else at
 *  top level belongs to the generic VARIANT ASSET DIRS pass). */
const KNOWN_TOP_DIRS = new Set([
  'agents', 'skills', 'scripts', 'docs', 'procedures',
  '.claude', '.gemini', '.agents', '.githooks', '.github', '.git', 'memory', 'node_modules',
]);

function underDir(rel: string, dir: string): boolean {
  return rel === dir || rel.startsWith(`${dir}/`);
}

/**
 * Resolve the upgrade claim for a project-relative path (forward slashes, no leading './').
 * `variant` enables the `docs/<variant>.context.md` DOCS_MERGE classification.
 * Never returns null — the fallback is the default-policy delivery claim by design.
 */
export function resolveClaim(relPath: string, variant = ''): UpgradeClaim {
  const rel = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!rel || rel === '.') return { policy: 'PROJECT_STATE', pass: '(none)' };

  // Platform-machinery artifacts the scaffold strips or generates
  if (rel.endsWith('.cmd')) return { policy: 'TEMPLATE_ONLY', pass: '(platform profile)' };

  if (PROJECT_STATE_FILES.has(rel)) return { policy: 'PROJECT_STATE', pass: '(project state)' };
  if (underDir(rel, 'memory')) return { policy: 'PROJECT_STATE', pass: '(project memory)' };
  if (rel === 'docs/countries/ACTIVE.md') return { policy: 'PROJECT_STATE', pass: '(country runtime state)' };

  // Universal Design Gate seed (ADR-0074): docs/specs/* claims fall through to the
  // WORKSPACE branch below (add-if-missing seed, never overwrite/prune project entries).

  if (TEMPLATE_ONLY_FILES.has(rel)) return { policy: 'TEMPLATE_ONLY', pass: '(scaffold-removed)' };
  for (const dir of TEMPLATE_ONLY_DIRS) {
    if (underDir(rel, dir)) return { policy: 'TEMPLATE_ONLY', pass: '(scaffold-removed)' };
  }

  if (REGENERATED_FILES.has(rel)) return { policy: 'REGENERATED', pass: '(regenerated in place)' };
  // .env.sample delivery is country-aware (ENV_SAMPLE SYNC pass): scaffold-time pruning
  // (prune-country-scoped-assets.ts, shared lib/env-sample.ts) strips country-scoped env
  // blocks from the project copy, so upgrades must re-deliver with the same pruning
  // applied — never a wholesale copy (that would re-inject pruned country profiles). The
  // pass MERGES (lib/env-sample.ts): template keys updated, project-only keys preserved.
  if (rel === '.env.sample') return { policy: 'SYNC', pass: 'ENV_SAMPLE SYNC' };
  if (PRESERVE_FILES.has(rel)) return { policy: 'PRESERVE', pass: '(project-owned)' };
  if ((GOVERNANCE_FILES as readonly string[]).includes(rel)) {
    return { policy: 'ADD_IF_MISSING', pass: 'GOVERNANCE FILES' };
  }

  if (LOCKED_FILES.has(rel) || underDir(rel, '.githooks')) return { policy: 'LOCKED', pass: 'LOCKED' };
  if (MERGE_MANAGED_FILES.has(rel)) return { policy: 'MERGE_MANAGED', pass: 'MERGE' };
  if (variant && rel === `docs/${variant}.context.md`) {
    return { policy: 'MERGE_MANAGED', pass: 'DOCS_MERGE' };
  }
  if (OVERWRITE_FILES.has(rel)) return { policy: 'OVERWRITE', pass: 'DOCS_OVERWRITE' };
  // The former VARIANT_DOCS_SYNC pass (docs/context.md and friends) was folded into the
  // TEMPLATE TREE SYNC pass in v1.22.0 — these files carry inline `*<file> version: X.Y`
  // footers (or hash fallback) and the default SYNC policy reproduces the old semantics
  // exactly, so no explicit claim is needed (deny-list inversion).

  if (underDir(rel, '.claude/commands') || underDir(rel, '.gemini/commands')) {
    return { policy: 'HASH_SYNC', pass: 'COMMANDS_SYNC' };
  }
  if ((JSON_MERGE_FILES as readonly string[]).includes(rel)) {
    return { policy: 'JSON_MERGE', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  if (underDir(rel, 'procedures')) return { policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' };

  // Platform skill mirrors are distributed by the post-upgrade sync-skills.ts run, not file passes
  if (underDir(rel, '.claude/skills') || underDir(rel, '.gemini/skills') || underDir(rel, '.agents/skills')) {
    return { policy: 'SYNC', pass: 'sync-skills.ts (platform mirror)' };
  }
  // Registration pointers + platform settings extras: default sync (static today, format may evolve)
  if (underDir(rel, '.claude') || underDir(rel, '.gemini') || underDir(rel, '.agents')) {
    return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  if (underDir(rel, 'agents')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: agents/' };
  if (underDir(rel, 'skills')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: skills/' };
  if (underDir(rel, 'scripts')) return { policy: 'SYNC', pass: 'SYNC_IF_NEWER: scripts/' };

  if (underDir(rel, 'docs')) {
    const second = rel.split('/')[1] ?? '';
    if ((WORKSPACE_DOC_DIRS as readonly string[]).includes(second)) {
      return { policy: 'WORKSPACE', pass: TEMPLATE_TREE_SYNC_PASS };
    }
    return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
  }

  // Any other top-level directory (e.g. co-safety's workflows/, regulations/) is the
  // generic VARIANT ASSET DIRS pass's territory. A path deeper than one segment can only
  // get here from such a directory (all known tops are claimed above).
  const top = rel.split('/')[0];
  if (!KNOWN_TOP_DIRS.has(top) && rel.includes('/')) {
    return { policy: 'SYNC', pass: 'VARIANT ASSET DIRS' };
  }

  // Root-level files with no dedicated pass (.editorconfig, …): the inversion —
  // deliver by default instead of silently dropping.
  return { policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS };
}

/** True when a claim's policy delivers file content into the project (validator placeholder check scope). */
export function isDeliveryPolicy(policy: UpgradePolicy): boolean {
  return ['LOCKED', 'MERGE_MANAGED', 'OVERWRITE', 'VERSIONED_SYNC', 'HASH_SYNC',
    'ADD_IF_MISSING', 'JSON_MERGE', 'WORKSPACE', 'SYNC'].includes(policy);
}

// ── Effective template tree (scaffold parity: variant overlay over common) ────────────────────

export interface EffectiveFile {
  rel: string;
  source: 'variant' | 'common';
  abs: string;
}

function* walkFiles(root: string, prefix = ''): Generator<string> {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (TRAVERSAL_SKIP_DIRS.has(entry.name) || entry.name === '.DS_Store') continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = join(root, entry.name);
    if (statSync(abs).isDirectory()) yield* walkFiles(abs, rel);
    else yield rel;
  }
}

/**
 * Walk the effective template tree for a project: the variant template overlaid on
 * templates/common (variant wins), replicating scaffold overlay facts — the variant never
 * provides docs/context.md (VARIANT_OVERLAY_SKIP / WS-07).
 */
export function* iterEffectiveTemplateFiles(
  commonDir: string,
  variantDir: string | null,
): Generator<EffectiveFile> {
  const seen = new Set<string>();
  if (variantDir && existsSync(variantDir)) {
    for (const rel of walkFiles(variantDir)) {
      if (rel === 'docs/context.md') continue; // WS-07: common is the SSOT
      seen.add(rel);
      yield { rel, source: 'variant', abs: join(variantDir, rel) };
    }
  }
  for (const rel of walkFiles(commonDir)) {
    if (seen.has(rel)) continue;
    yield { rel, source: 'common', abs: join(commonDir, rel) };
  }
}

// ── JSON_MERGE (platform settings) ────────────────────────────────────────────────────────────

export interface JsonMergeResult {
  changed: boolean;
  merged: string;
  /** Project-only keys/entries the merge preserved (logged by the caller). */
  preserved: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge template settings over project settings (design D4):
 *  - objects recurse (template wins conflicts),
 *  - arrays are unioned — project-only entries survive (protects project permission grants),
 *  - scalars: template wins.
 *  Project-only keys anywhere in the tree are preserved and reported (dot paths from the root). */
export function mergeSettingsData(template: unknown, project: unknown, path = ''): { merged: unknown; preserved: string[] } {
  const preserved: string[] = [];
  const childPath = (key: string) => (path ? `${path}.${key}` : key);

  if (isPlainObject(template) && isPlainObject(project)) {
    const out: Record<string, unknown> = { ...project };
    for (const [key, tVal] of Object.entries(template)) {
      if (!(key in project)) {
        out[key] = tVal;
        continue;
      }
      const sub = mergeSettingsData(tVal, project[key], childPath(key));
      out[key] = sub.merged;
      preserved.push(...sub.preserved);
    }
    for (const key of Object.keys(project)) {
      if (!(key in template)) preserved.push(childPath(key));
    }
    return { merged: out, preserved };
  }

  if (Array.isArray(template) && Array.isArray(project)) {
    // Union with template first: template entries present, project-only entries kept.
    const merged = [...template];
    for (const item of project) {
      if (!merged.some(m => JSON.stringify(m) === JSON.stringify(item))) {
        merged.push(item);
        preserved.push(`${path}[]`);
      }
    }
    return { merged, preserved };
  }

  return { merged: template, preserved };
}

/** Merge the template settings file over the project's copy on disk. Read-only on the template. */
export function mergeSettingsJson(projectFile: string, templateFile: string): JsonMergeResult {
  const template = JSON.parse(readFileSync(templateFile, 'utf8'));
  const projectRaw = readFileSync(projectFile, 'utf8');
  const project = JSON.parse(projectRaw);
  const { merged, preserved } = mergeSettingsData(template, project);
  const out = `${JSON.stringify(merged, null, 2)}\n`;
  return { changed: out !== projectRaw, merged: out, preserved };
}
