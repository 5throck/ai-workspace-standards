#!/usr/bin/env bun
/**
 * Shared Scaffold Delivery Contracts
 * @version 1.5.1
 *
 * v1.5.1 (2026-09-24, spec docs/designs/2026-09-24-platform-ssot-constant-design.md):
 *         behavior-neutral constant adoption — the three canonical 5-element
 *         skill-base literals (schema prune, l2_propagate sweep derivation,
 *         legacy-L0 predicate) become PLATFORM_SKILL_BASES (../lib/platforms.ts).
 *         NO behavior change.
 * v1.5.0 (2026-09-24, scaffold identity overview — spec
 *         2026-09-24-scaffold-identity-overview-design): docs/project.template.md
 *         joins NEW_PROJECT_CLEANUP_FILES (new-project §5.2 renders it into
 *         docs/project.md and removes the raw copy, same lifecycle as
 *         docs/variant.context.template.md) and docs/project.md joins
 *         POST_DELIVERY_ARTIFACTS (a scaffold-time render, not a common-tree
 *         relpath — the E2E pinning checks subtract it from actual trees).
 * v1.4.0: PlatformProfile's 'both' renamed to 'all' and its delivery-derivation
 * meaning expanded to include the codex platform (CODEX.md/.codex/), matching
 * the same rename in new-project.ts/upgrade-project.ts/test-new-project.ts —
 * this module's docstring says it mirrors new-project's delivery logic, so it
 * must stay in lockstep or simulate-pipeline's dry-run predictions drift from
 * real scaffold output.
 * v1.3.0 (T-20260916-001): TRANSIENT_TEST_FIXTURE_PREFIXES +
 * isTransientTestFixture — the shared name predicate that lets
 * templates/-scanning validators skip E2E staging dirs
 * (test-l3promo-*, co-e2eguard-*, co-e2p2*) while they exist. The E2E
 * (test-l3-to-variant-promotion.ts) derives its fixture names from the
 * same constants, so producer and skipper cannot drift.
 *
 * v1.2.0 (T-20260916-010): variant templates stopped shipping a stub
 * docs/VERSION_MANIFEST.md (validate-templates `variant-version-manifest`
 * arm retires the stub class); the full generated manifest is scaffold-owned.
 * This module carries the relpath constants and the pure invoke-decision
 * helper the scaffold (new-project.ts §7.8) and the upgrade flow
 * (upgrade-project.ts post-upgrade regeneration) share, so "which file is
 * generated, and what does the generator need to exist" cannot drift between
 * the two delivery paths.
 *
 * v1.1.0 (T-20260915-012 / M12): NEW_PROJECT_L1_ONLY_AGENTS dropped stale
 * entries (`agents/lifecycle-manager.md`, `agents/pm.md.backup` — neither
 * exists under templates/common/, so the exclusions were dead and masked
 * future drift); only the resolving entry `agents/_COMMON.md` remains, and
 * a unit test now asserts every entry resolves.
 *
 * Single source for the string markers, delivery-exclusion data, PM
 * extends-stub contract, and delivery-tree derivations shared by the two
 * scaffold paths (`scripts/create-l3-scaffold.ts`, `scripts/new-project.ts`),
 * the standing validators (`scripts/validate-templates.ts`), the parity
 * harness (`scripts/test-scaffold-delivery-parity.ts`), and the unit tests.
 *
 * Why this module exists: both scaffold scripts execute `main()`
 * unconditionally on import (they are CLI-only), so their inline constants
 * cannot be imported by tests or validators. T-20260915-002 (C3) additionally
 * requires one declarative home for the markers the scaffolders search for in
 * source templates — the graft-block injection once searched for a marker the
 * source file no longer carried, `indexOf` missed, and the block silently
 * never shipped (docs/reports/2026-09-15-project-review-template-fleet.md,
 * finding C3).
 *
 * Import-safety: this module has no side effects and performs no I/O at
 * import time (all reads happen inside functions), so validators and bun test
 * files can import it freely.
 *
 * Consumers:
 * - create-l3-scaffold.ts  — marker constants, L3_COMMON_OVERLAY_EXCLUDE
 * - new-project.ts         — NEW_PROJECT_* delivery constants, isCanonicalPmStubBody
 * - upgrade-project.ts     — VERSION_MANIFEST regeneration constants
 * - validate-templates.ts  — SCAFFOLD_MARKER_SOURCES (scaffold-marker-source
 *                            check), REVIEWED_DELIVERY_EXCLUSIONS helpers,
 *                            isCanonicalPmStubBody (pm-extends-stub-body check)
 * - test-scaffold-delivery-parity.ts / unit tests — derivations + diff
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { includeScriptInL3, parseScriptLayers } from './layer-filter.ts';
import { PLATFORM_SKILL_BASES } from '../lib/platforms.ts';

// ============================================================================
// 1. Scaffold marker constants (T-20260915-002 / C3)
// ============================================================================

/** COMMON-AGENTS Language Policy block — searched in templates/common/AGENTS.md. */
export const COMMON_AGENTS_START = '<!-- COMMON-AGENTS:START -->';
export const COMMON_AGENTS_END = '<!-- COMMON-AGENTS:END -->';

/**
 * Graft repo-context-graph instruction block (ADR-0076), wrapped in
 * WORKSPACE-MANAGED markers so upgrade-project's MERGE pass keeps it in sync.
 * Searched in templates/common/AGENTS.md by create-l3-scaffold.ts.
 */
export const GRAFT_BLOCK_OPEN = '<!-- WORKSPACE-MANAGED: graft repo context graph -->';
/** Generic WORKSPACE-MANAGED close marker (upgrade-project.ts shares this shape). */
export const WORKSPACE_MANAGED_CLOSE = '<!-- /WORKSPACE-MANAGED -->';

/**
 * Base names of the VARIANT-* injection markers the L3 scaffold emits into the
 * generated AGENTS.md (`<!-- <name>-START -->` / `<!-- <name>-END -->` pairs).
 * The empty marker structure mirrors templates/common/AGENTS.md so
 * l3-to-variant-pipeline.ts Phase 3.5 passes without auto-regeneration on a
 * fresh scaffold.
 */
export const VARIANT_SCAFFOLD_MARKER_NAMES = [
  'VARIANT-AGENTS',
  'VARIANT-AGENT-DETAILS',
  'VARIANT-DISPATCH-TRIGGERS',
  'VARIANT-PHASE-GATE',
  'VARIANT-SUBAGENT-ROSTER',
  'VARIANT-ROLE-BOUNDARY',
] as const;

// ============================================================================
// 2. Declarative (marker → source files) mapping (T-20260915-002 / C3)
// ============================================================================
// ONE object listing every (marker, source template) pair the scaffolders
// depend on. Adding a marker constant that a scaffolder searches for REQUIRES
// an entry here; validate-templates.ts's `scaffold-marker-source` check fails
// when a declared marker is missing from a declared source, and the unit tests
// fail when a marker constant has no mapping entry at all.

export interface ScaffoldMarkerSource {
  /** The literal marker string the scaffolder searches for (or emits). */
  marker: string;
  /** What the scaffolder uses this marker for (human context for failures). */
  purpose: string;
  /** Repo-relative source template files that must carry the marker. */
  sources: string[];
}

export const SCAFFOLD_MARKER_SOURCES: readonly ScaffoldMarkerSource[] = [
  {
    marker: COMMON_AGENTS_START,
    purpose: 'create-l3-scaffold extracts the COMMON-AGENTS Language Policy block from this file',
    sources: ['templates/common/AGENTS.md'],
  },
  {
    marker: COMMON_AGENTS_END,
    purpose: 'create-l3-scaffold extracts the COMMON-AGENTS Language Policy block from this file',
    sources: ['templates/common/AGENTS.md'],
  },
  {
    marker: GRAFT_BLOCK_OPEN,
    purpose: 'create-l3-scaffold extracts the graft repo-context-graph block (ADR-0076) from this file',
    sources: ['templates/common/AGENTS.md'],
  },
  {
    marker: WORKSPACE_MANAGED_CLOSE,
    purpose: 'closes the WORKSPACE-MANAGED graft block create-l3-scaffold extracts',
    sources: ['templates/common/AGENTS.md'],
  },
  ...VARIANT_SCAFFOLD_MARKER_NAMES.map(
    (name): ScaffoldMarkerSource => ({
      marker: `<!-- ${name}-START -->`,
      purpose: 'create-l3-scaffold emits this marker pair into the scaffolded AGENTS.md; the L1 baseline carries the same structure',
      sources: ['templates/common/AGENTS.md'],
    }),
  ),
];

// ============================================================================
// 2.5 Version-manifest generation contract (T-20260916-010)
// ============================================================================
// A scaffolded project is a standalone repo whose steady-state
// docs/VERSION_MANIFEST.md is the FULL generated manifest (the project's own
// scripts/generate-version-manifest.ts output). Variant templates no longer
// ship a stub — the file is generated post-delivery (new-project.ts §7.8) and
// regenerated post-upgrade (upgrade-project.ts), never template-delivered
// (lib/upgrade-policy.ts REGENERATED_FILES). These constants are the single
// declaration of the generated relpaths and the generator dependency so both
// delivery paths and the validators cannot drift.

/** Project-relative path of the generated manifest. */
export const VERSION_MANIFEST_RELPATH = 'docs/VERSION_MANIFEST.md';

/** Project-relative path of the generator the project itself ships. */
export const VERSION_MANIFEST_GENERATOR_RELPATH = 'scripts/generate-version-manifest.ts';

/** The decision new-project §7.8 / upgrade-project regeneration implement. */
export type ManifestGenerationDecision =
  | { action: 'generate' }
  | { action: 'skip-missing-generator' }
  | { action: 'skip-no-bun' };

/**
 * Pure invoke semantics for the post-delivery manifest generation. The
 * generator must exist in the PROJECT (it is shipped by templates/common —
 * verified by a unit test) and bun must be available; everything else about
 * the step is warn-and-continue, because the post-scaffold audit's
 * VERSION_MANIFEST gates catch a missing/stale manifest either way.
 */
export function decideManifestGeneration(
  generatorExists: boolean,
  bunAvailable: boolean,
): ManifestGenerationDecision {
  if (!generatorExists) return { action: 'skip-missing-generator' };
  if (!bunAvailable) return { action: 'skip-no-bun' };
  return { action: 'generate' };
}

// ============================================================================
// 3. PM extends-stub contract (T-20260915-010 / H12)
// ============================================================================

/**
 * The canonical body of a variant pm.md extends-stub (T-20260912-004 fleet
 * convention). Single source — new-project.ts's scaffold-time warning, the
 * validate-templates.ts `pm-extends-stub-body` check, and the unit tests all
 * compare against this sentence; no duplicated literals.
 */
export function canonicalPmStubBody(variantSlug: string): string {
  return (
    `This ${variantSlug} PM override inherits the common PM body and ` +
    'supplies only variant-specific governance, roster, and dispatch deltas.'
  );
}

/**
 * True when a variant pm.md body is a canonical extends-stub body: empty, or
 * exactly the canonical stub prose for the variant (whitespace-trimmed).
 * Anything else under `extends:` is treated as real variant content that the
 * scaffold-time resolution would discard — the H12 failure shape.
 */
export function isCanonicalPmStubBody(body: string, variantSlug: string): boolean {
  const trimmed = body.trim();
  if (trimmed === '') return true;
  return trimmed === canonicalPmStubBody(variantSlug);
}

// ============================================================================
// 4. Delivery-exclusion constants (T-20260915-003 / H13)
// ============================================================================
// Both scaffold paths model "default include, explicit exclude" over
// templates/common/. The constants below are the single source both scripts
// import back, so the parity derivations cannot drift from the scripts'
// actual behavior.

/**
 * Top-level templates/common/ entries create-l3-scaffold's overlay must NOT
 * blanket-copy into an L3 scaffold (workspace-only artifacts; items handled by
 * a dedicated step — docs/, agents/, scripts/, skills/, memory/, package.json —
 * that needs L3-specific filtering or stub generation; items synced by a
 * separate mechanism — .agents/ via scripts/sync-skills.ts; and files that
 * must stay Phase-A-specific stubs — README/AGENTS/SECURITY).
 */
export const L3_COMMON_OVERLAY_EXCLUDE: readonly string[] = [
  '.agents', '.gateguard-state', '.DS_Store', 'node_modules', 'bun.lock', 'propagation-map.json',
  'docs', 'agents', 'scripts', 'skills', 'memory', 'package.json',
  'README.md', 'README_ko.md', 'AGENTS.md', 'SECURITY.md',
];

/** Entries new-project's copyDir skips at every level (plus .DS_Store by name). */
export const NEW_PROJECT_COPY_SKIP_ENTRIES: readonly string[] = ['node_modules', '.gateguard-state'];

/** Workspace-only files new-project removes after the common copy. */
export const NEW_PROJECT_WORKSPACE_ONLY_FILES: readonly string[] = [
  'package.json', 'scripts/package.json', 'package-lock.json', 'bun.lock', 'bun.lockb', 'variant.json',
];

/** L1-only agent files new-project removes (workspace governance machinery).
 *  T-20260915-012 (M12): every entry must resolve to a real templates/common/
 *  path — stale entries silently mask future drift, so a unit test asserts
 *  resolution. `agents/lifecycle-manager.md` (L0-only agent, never shipped in
 *  templates) and `agents/pm.md.backup` (never present in templates/common)
 *  were dropped; only `agents/_COMMON.md` — the shared-sections include file
 *  that copies but must not ship — remains. */
export const NEW_PROJECT_L1_ONLY_AGENTS: readonly string[] = [
  'agents/_COMMON.md',
];

/**
 * L1-only docs/ directories new-project removes — once after the common copy
 * (§ L1-only dirs) and again after the variant overlay (§ template-only dirs;
 * the variant may re-add them). Same list, two passes.
 */
export const NEW_PROJECT_L1_ONLY_DIRS: readonly string[] = [
  'docs/_templates', 'docs/_examples', 'docs/adr', 'docs/variants',
];

/** Workspace-only files new-project's final cleanup removes. */
export const NEW_PROJECT_CLEANUP_FILES: readonly string[] = [
  'scripts/propagation-map.json', 'variant.json', 'agents/pm.md.backup',
  'docs/variant.context.template.md',
  // Rendered into docs/project.md at scaffold time (§5.2), then the raw copy is
  // removed — same copy-then-remove lifecycle as docs/variant.context.template.md.
  // (spec 2026-09-24-scaffold-identity-overview-design)
  'docs/project.template.md',
];

/** Legacy hardcoded L0-only skills new-project removes as a safety net. */
export const NEW_PROJECT_LEGACY_L0_SKILLS: readonly string[] = ['simulate-project-creation'];

/**
 * templates/common/ relpaths create-l3-scaffold delivers through dedicated
 * steps rather than the overlay (stubs / governance record), which collide
 * with relpaths the common tree also carries. The L3 delivery derivation adds
 * these so set comparisons see them as delivered.
 */
export const L3_DEDICATED_STEP_DELIVERIES: readonly string[] = [
  'AGENTS.md', 'README.md', 'README_ko.md', 'SECURITY.md', 'package.json',
  'agents/pm.md', 'memory/MEMORY.md', 'docs/lifecycle/agents/pm.md', 'docs/context.md',
  // Copied explicitly alongside docs/context.md (2026-09-21 review M-22): keeps the
  // project-side language validator out of its degraded ko-only locale mode.
  'docs/workspace-schema.json',
];

// ============================================================================
// 5. Reviewed delivery-gap constant (T-20260915-003 / H13)
// ============================================================================
// The reviewed difference between what new-project delivers from
// templates/common/ and what create-l3-scaffold delivers. `diffDeliveryTrees`
// computes newProject \ l3; the parity harness asserts that gap equals the
// expansion of these rules exactly (see reviewedExclusionCoverage):
//   - an entry WITHOUT a trailing "/" matches exactly one relpath;
//   - an entry WITH a trailing "/" is a directory-prefix rule.
// A new gap file must either be fixed in delivery logic or consciously added
// here with a reason — the H13 "silent widening" class made loud.

export interface ReviewedDeliveryExclusion {
  /** Exact relpath, or directory prefix (trailing "/"). */
  path: string;
  /** Why this gap is reviewed and accepted (cited in parity failures). */
  reason: string;
}

export const REVIEWED_DELIVERY_EXCLUSIONS: readonly ReviewedDeliveryExclusion[] = [
  {
    path: '.agents/',
    reason: 'L0-only platform skill mirror; re-synced by scripts/sync-skills.ts (COMMON_OVERLAY_EXCLUDE: synced by a separate mechanism)',
  },
  {
    path: 'agents/i18n-specialist.md',
    reason: 'agents/ is stub-generated for L3 drafts (dedicated step); fleet agents reach real projects via the common copy at new-project instantiation',
  },
  {
    path: 'docs/README.template.md',
    reason: 'consumed by the L3 README renderer (generate-variant.ts), not delivered as a file',
  },
  {
    path: 'docs/README_ko.template.md',
    reason: 'consumed by the L3 README renderer (generate-variant.ts), not delivered as a file',
  },
  {
    path: 'docs/country-profiles.md',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/design-foundation.md',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/design-tokens.template.css',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/phase-definitions.md',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/procedure-schema-spec.md',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/screen-patterns.template.md',
    reason: 'top-level docs/ beyond _common excluded by COMMON_OVERLAY_EXCLUDE (H13 reviewed gap)',
  },
  {
    path: 'docs/skill-graph.json',
    reason: 'regenerated on first /sync (dev-sync step 4.65); a stale common copy would be overwritten at first generation',
  },
  {
    path: 'docs/skill-graph.overrides.json',
    reason: 'companion of docs/skill-graph.json; regenerated/managed on first /sync',
  },
  {
    path: 'docs/lifecycle/skills/i18n-audit.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/decision-record.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/evidence-ledger.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/handbook.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/i18n-formatting.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/i18n-layout.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/lifecycle/skills/i18n-locale-config.md',
    reason: 'L3 delivers only its own docs/lifecycle/agents/pm.md governance record; the rest of docs/lifecycle/ is not copied (H13 reviewed gap)',
  },
  {
    path: 'docs/specs/registry.json',
    reason: 'the L3 draft seeds docs/specs/ via scripts/spec-register.ts at first spec activity, not from a copied tree',
  },
];

// ============================================================================
// 6. Delivery-tree derivation (T-20260915-003 / H13)
// ============================================================================

export type PlatformProfile = 'claude' | 'antigravity' | 'all' | 'codex';

/**
 * Relpaths (forward slashes) of files under templates/common/ that are NOT
 * delivered into a scaffolded project because scaffold-time steps run after
 * delivery: dependency install, git init, graft index build, lockfile
 * regeneration. The E2E pinning checks subtract these from ACTUAL scaffolded
 * trees before comparing against the derivations. docs/project.md joins as the
 * scaffold-time RENDER of the delivered docs/project.template.md raw copy
 * (removed post-render; not a common-tree relpath, so it can never join the
 * derivation universe — spec 2026-09-24-scaffold-identity-overview-design).
 */
export const POST_DELIVERY_ARTIFACTS: { exact: readonly string[]; prefixes: readonly string[] } = {
  exact: ['bun.lock', 'bun.lockb', 'package-lock.json', 'docs/project.md'],
  prefixes: ['node_modules/', '.git/', 'graft/'],
};

/** Walk all files under a directory as forward-slash relpaths from that directory. */
export function walkRelFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  const visit = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) visit(join(abs, entry.name), childRel);
      else out.push(childRel);
    }
  };
  visit(dir, '');
  return out;
}

/**
 * Map a templates/common/ relpath into its delivered relpath: new-project
 * flattens docs/_common/* into docs/* (§2.6); create-l3-scaffold copies
 * docs/_common content into docs/ the same way (Step 6). Identity otherwise.
 */
export function flattenCommonRelPath(rel: string): string {
  if (rel.startsWith('docs/_common/')) return `docs/${rel.slice('docs/_common/'.length)}`;
  return rel;
}

/** The set of delivered relpaths a derivation models, as a sorted array. */
function sorted(set: Set<string>): string[] {
  return [...set].sort();
}

interface CountryScopedAssets {
  skills?: Record<string, string>;
  dirs?: Record<string, string>;
}

/**
 * Region-neutral prune (T: prune-country-scoped-assets.ts runs with country
 * "none" on BOTH scaffold paths), modeled from docs/workspace-schema.json →
 * country_scoped_assets: skills (from the four skill bases), scripts, and
 * whole asset dirs scoped to a country other than "none" are removed.
 */
function pruneRegionNeutral(rels: Set<string>, workspaceRoot: string): void {
  const schemaPath = join(workspaceRoot, 'docs', 'workspace-schema.json');
  if (!existsSync(schemaPath)) return;
  let scoped: CountryScopedAssets | undefined;
  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as { country_scoped_assets?: CountryScopedAssets };
    scoped = schema?.country_scoped_assets;
  } catch {
    return; // unparseable schema — model nothing (the prune helper fails loud at runtime)
  }
  const skillBases = PLATFORM_SKILL_BASES;
  const prunedSkillNames = Object.keys(scoped?.skills ?? {});
  const pruneDirs = Object.keys(scoped?.dirs ?? {});
  for (const rel of [...rels]) {
    for (const base of skillBases) {
      for (const name of prunedSkillNames) {
        if (rel.startsWith(`${base}/${name}/`)) rels.delete(rel);
      }
    }
    for (const dir of pruneDirs) {
      if (rel.startsWith(`${dir}/`)) rels.delete(rel);
    }
  }
}

/** True when `rel` is covered by POST_DELIVERY_ARTIFACTS. */
export function isPostDeliveryArtifact(rel: string): boolean {
  if (POST_DELIVERY_ARTIFACTS.exact.includes(rel)) return true;
  return POST_DELIVERY_ARTIFACTS.prefixes.some((p) => rel.startsWith(p));
}

/** Restrict an iterable of relpaths to the flattened common universe. */
export function restrictToUniverse(rels: Iterable<string>, universe: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const rel of rels) {
    if (universe.has(rel)) out.add(rel);
  }
  return out;
}

/**
 * Derive the file set new-project.ts delivers FROM templates/common/
 * (forward-slash relpaths, docs/_common flattened). Mirrors new-project's
 * copyDir skips, workspace-only/L1-only removals, memory clear, .gitkeep
 * removal, platform profile (default "all"), L0-only script removal (same
 * layer-filter source the script shells out to), the l2_propagate:false
 * safety nets, and the region-neutral country-scoped prune.
 */
export function deriveNewProjectDelivery(
  commonDir: string,
  opts: { platform?: PlatformProfile; workspaceRoot?: string } = {},
): Set<string> {
  const platform: PlatformProfile = opts.platform ?? 'all';
  const workspaceRoot = opts.workspaceRoot ?? join(commonDir, '..', '..');
  const l0OnlyScripts = new Set(
    [...parseScriptLayers().entries()].filter(([, v]) => v === 'L0').map(([k]) => k),
  );
  const l2PropagateFalseSkills = collectL2PropagateFalseSkills(commonDir);
  const out = new Set<string>();

  for (const rawRel of walkRelFiles(commonDir)) {
    const rel = flattenCommonRelPath(rawRel);
    const top = rel.split('/')[0];
    if (NEW_PROJECT_COPY_SKIP_ENTRIES.includes(top)) continue;
    if (basename(rel) === '.DS_Store') continue;
    if (NEW_PROJECT_WORKSPACE_ONLY_FILES.includes(rel)) continue;
    if (NEW_PROJECT_L1_ONLY_AGENTS.includes(rel)) continue;
    if (isUnderAny(rel, NEW_PROJECT_L1_ONLY_DIRS)) continue;
    if (NEW_PROJECT_CLEANUP_FILES.includes(rel)) continue;
    if (top === 'memory' && rel.endsWith('.md')) continue; // §memory clear
    if (basename(rel) === '.gitkeep') continue;
    if (platform !== 'codex' && platform !== 'all' && (rel === 'CODEX.md' || rel.startsWith('.codex/'))) continue;
    if (platform === 'claude' && rel === 'GEMINI.md') continue;
    if (platform === 'antigravity' && rel === 'CLAUDE.md') continue;
    if (isL2PropagateFalseSkillRel(rel, l2PropagateFalseSkills)) continue;
    if (isLegacyL0SkillRel(rel)) continue;
    // §L0-only script removal: the script shells out to layer-filter
    // --scripts-l0-only, whose list keys are SCRIPTS.md registry names
    // (sub-path keys included) removed via join(scripts, name).
    if (l0OnlyScripts.has(rel.slice('scripts/'.length)) && rel.startsWith('scripts/')) continue;
    if (rel.startsWith('scripts/') && rel.endsWith('.ts') && hasL2PropagateFalseHeader(join(commonDir, rawRel))) continue;
    out.add(rel);
  }

  // package.json: the workspace-only copy is removed (WORKSPACE_ONLY_FILES)
  // but §2.5c regenerates a root package.json at the SAME relpath — the file
  // exists in the final tree, so the delivery set models it as present.
  if (existsSync(join(commonDir, 'package.json'))) out.add('package.json');

  // memory/MEMORY.md: the §memory clear removes every memory/*.md, then the
  // M-13 seed step writes the canonical empty index at that relpath — model
  // it as present (2026-09-21 review M-13, mirrors create-l3-scaffold).
  out.add('memory/MEMORY.md');

  pruneRegionNeutral(out, workspaceRoot);
  return out;
}

/**
 * Derive the file set create-l3-scaffold.ts delivers FROM templates/common/
 * (forward-slash relpaths, docs/_common flattened): the overlay (top-level
 * entries not in L3_COMMON_OVERLAY_EXCLUDE), the full skills/ copy (Step 4 —
 * note: no l2_propagate filtering on this path), the L3-filtered scripts/
 * copy, the docs/_common flatten + docs/context.md, the dedicated-step
 * deliveries that collide with common relpaths, and the region-neutral
 * country-scoped prune.
 */
export function deriveL3ScaffoldDelivery(
  commonDir: string,
  opts: { workspaceRoot?: string } = {},
): Set<string> {
  const workspaceRoot = opts.workspaceRoot ?? join(commonDir, '..', '..');
  const out = new Set<string>();

  const addTree = (absDir: string, relPrefix: string): void => {
    for (const rel of walkRelFiles(absDir)) {
      if (basename(rel) === '.DS_Store') continue;
      out.add(`${relPrefix}/${rel}`);
    }
  };

  // Overlay: top-level entries not excluded (mirrors copyCommonOverlay).
  for (const entry of readdirSync(commonDir, { withFileTypes: true })) {
    if (L3_COMMON_OVERLAY_EXCLUDE.includes(entry.name)) continue;
    if (basename(entry.name) === '.DS_Store') continue;
    if (entry.isDirectory()) addTree(join(commonDir, entry.name), entry.name);
    else out.add(entry.name);
  }

  // Step 4: full skills/ copy.
  if (existsSync(join(commonDir, 'skills'))) addTree(join(commonDir, 'skills'), 'skills');

  // Step 3 dedicated scripts/ loop: L3-filtered top-level entries.
  const scriptsDir = join(commonDir, 'scripts');
  if (existsSync(scriptsDir)) {
    for (const entry of readdirSync(scriptsDir, { withFileTypes: true })) {
      if (!includeScriptInL3(entry.name)) continue;
      if (entry.isDirectory()) addTree(join(scriptsDir, entry.name), `scripts/${entry.name}`);
      else out.add(`scripts/${entry.name}`);
    }
  }

  // Step 6: docs/_common flatten + docs/context.md.
  const commonDocs = join(commonDir, 'docs', '_common');
  if (existsSync(commonDocs)) addTree(commonDocs, 'docs');

  // Dedicated-step deliveries (stubs / governance record) that collide with
  // common relpaths.
  for (const rel of L3_DEDICATED_STEP_DELIVERIES) {
    if (existsSync(join(commonDir, rel))) out.add(rel);
  }

  pruneRegionNeutral(out, workspaceRoot);
  return out;
}

/** The flattened universe: every templates/common/ relpath in delivered form. */
export function buildCommonUniverse(commonDir: string): Set<string> {
  return new Set(walkRelFiles(commonDir).map(flattenCommonRelPath));
}

/** newProject \ l3 — the delivery gap the parity harness pins. */
export function diffDeliveryTrees(newProjectSet: Set<string>, l3Set: Set<string>): Set<string> {
  const gap = new Set<string>();
  for (const rel of newProjectSet) {
    if (!l3Set.has(rel)) gap.add(rel);
  }
  return gap;
}

// ============================================================================
// 7. Reviewed-exclusion matching (T-20260915-003 / H13)
// ============================================================================

/** The reviewed rule covering `rel`, or null. Prefix rules end with "/". */
export function matchReviewedExclusion(
  rel: string,
  rules: readonly ReviewedDeliveryExclusion[] = REVIEWED_DELIVERY_EXCLUSIONS,
): ReviewedDeliveryExclusion | null {
  for (const rule of rules) {
    if (rule.path.endsWith('/')) {
      if (rel.startsWith(rule.path)) return rule;
    } else if (rule.path === rel) {
      return rule;
    }
  }
  return null;
}

/**
 * Strict "equals exactly the reviewed exclusions (nothing more)" verdict:
 *   - uncovered: gap files no rule covers (a NEW silent gap — H13 class);
 *   - staleExact: exact rules matching no gap file (a dead exemption);
 *   - stalePrefix: prefix rules covering no gap file (a dead exemption).
 * The gap is exactly the reviewed set iff all three arrays are empty.
 */
export function reviewedExclusionCoverage(
  gapSet: Set<string>,
  rules: readonly ReviewedDeliveryExclusion[] = REVIEWED_DELIVERY_EXCLUSIONS,
): { uncovered: string[]; staleExact: string[]; stalePrefix: string[] } {
  const uncovered: string[] = [];
  for (const rel of gapSet) {
    if (!matchReviewedExclusion(rel, rules)) uncovered.push(rel);
  }
  const staleExact: string[] = [];
  const stalePrefix: string[] = [];
  for (const rule of rules) {
    const hits = [...gapSet].filter((rel) =>
      rule.path.endsWith('/') ? rel.startsWith(rule.path) : rel === rule.path,
    );
    if (hits.length === 0) {
      if (rule.path.endsWith('/')) stalePrefix.push(rule.path);
      else staleExact.push(rule.path);
    }
  }
  return { uncovered: uncovered.sort(), staleExact: staleExact.sort(), stalePrefix: stalePrefix.sort() };
}

// ============================================================================
// 8. Actual-tree verification (E2E pinning for the derivations)
// ============================================================================

export interface ActualTreeVerdict {
  ok: boolean;
  /** In the derived delivery but missing from the actual tree. */
  missing: string[];
  /** In the actual tree (post-artifact, universe-restricted) but not derived. */
  extra: string[];
}

/**
 * Pin a derivation against a REAL scaffolded tree: walk `actualRoot`,
 * subtract POST_DELIVERY_ARTIFACTS, restrict to the common universe, and
 * compare against the derived set. Used by test-new-project.ts (Test 26) and
 * test-l3-to-variant-promotion.ts (Test 1b) so the static derivations cannot
 * drift from the scripts' actual behavior.
 */
export function verifyActualTreeMatchesDerivation(opts: {
  which: 'new-project' | 'l3-scaffold';
  actualRoot: string;
  commonDir: string;
  platform?: PlatformProfile;
  workspaceRoot?: string;
}): ActualTreeVerdict {
  const universe = buildCommonUniverse(opts.commonDir);
  const actual = restrictToUniverse(
    walkRelFiles(opts.actualRoot).filter((rel) => !isPostDeliveryArtifact(rel)),
    universe,
  );
  const derived =
    opts.which === 'new-project'
      ? deriveNewProjectDelivery(opts.commonDir, { platform: opts.platform, workspaceRoot: opts.workspaceRoot })
      : deriveL3ScaffoldDelivery(opts.commonDir, { workspaceRoot: opts.workspaceRoot });
  const missing = sorted(new Set([...derived].filter((rel) => !actual.has(rel))));
  const extra = sorted(new Set([...actual].filter((rel) => !derived.has(rel))));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

// ============================================================================
// 9. Transient test-fixture predicate (T-20260916-001)
// ============================================================================
// test-l3-to-variant-promotion.ts stages disposable fixture dirs under the
// REAL templates/ tree for the duration of an E2E run. Any validator that
// enumerates templates/ while such an E2E is in flight must skip these
// names (defense in depth against VERSION_REGISTRY.json pollution and
// fixture-shaped variant failures). ONE prefix list here is the contract
// between the E2E producer (which builds its dir names from these exact
// constants) and the validators (which filter with isTransientTestFixture).

/** Directory-name prefixes owned by templates/-staging E2E fixtures. */
export const TRANSIENT_TEST_FIXTURE_PREFIXES: readonly string[] = [
  'test-l3promo-', // l3-to-variant-promotion E2E: scaffold variant + agentsmd stage
  'co-e2eguard-', // l3-to-variant-promotion E2E: overlay-guard variant.json-only slots
  'co-e2p2b-', // l3-to-variant-promotion E2E: p2v guard fixture (beta)
  'co-e2p2s-', // l3-to-variant-promotion E2E: p2v guard fixture (stable)
  'co-e2p2c-', // l3-to-variant-promotion E2E: p2v guard fixture (corrupt)
];

/**
 * True when a templates/ entry name is a transient E2E test fixture
 * (never a real variant). Pure — no I/O, safe to import anywhere.
 */
export function isTransientTestFixture(name: string): boolean {
  return TRANSIENT_TEST_FIXTURE_PREFIXES.some((p) => name.startsWith(p));
}

// ============================================================================
// 10. Internal helpers
// ============================================================================

function isUnderAny(rel: string, dirs: readonly string[]): boolean {
  return dirs.some((d) => rel === d || rel.startsWith(`${d}/`));
}

/** skill dir name → l2_propagate:false, collected from the common tree. */
function collectL2PropagateFalseSkills(commonDir: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  // All five skill bases — the runtime sweep in new-project.ts must stay in sync.
  // .agents/skills was missing here, so flagged skills leaked via that mirror
  // while the derivation (and Test 26) stayed green (2026-09-21 review C-1).
  const bases = PLATFORM_SKILL_BASES;
  for (const base of bases) {
    const baseDir = join(commonDir, base);
    const names = new Set<string>();
    if (existsSync(baseDir)) {
      for (const entry of readdirSync(baseDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = join(baseDir, entry.name, 'SKILL.md');
        if (!existsSync(skillMd)) continue;
        try {
          if (/^l2_propagate:\s*false\b/m.test(readFileSync(skillMd, 'utf-8'))) names.add(entry.name);
        } catch {
          /* unreadable — treat as not-flagged (the runtime safety net would still sweep it) */
        }
      }
    }
    result.set(base, names);
  }
  return result;
}

function isL2PropagateFalseSkillRel(
  rel: string,
  flagged: Map<string, Set<string>>,
): boolean {
  for (const [base, names] of flagged) {
    if (names.size === 0) continue;
    if (rel.startsWith(`${base}/`)) {
      const rest = rel.slice(base.length + 1);
      const skillName = rest.split('/')[0];
      if (names.has(skillName)) return true;
    }
  }
  return false;
}

function isLegacyL0SkillRel(rel: string): boolean {
  const bases = PLATFORM_SKILL_BASES;
  for (const base of bases) {
    if (rel.startsWith(`${base}/`)) {
      const skillName = rel.slice(base.length + 1).split('/')[0];
      if (NEW_PROJECT_LEGACY_L0_SKILLS.includes(skillName)) return true;
    }
  }
  return false;
}

/** The @l2-propagate:false script header new-project's safety net sweeps. */
function hasL2PropagateFalseHeader(absPath: string): boolean {
  try {
    return /^\/\/ @l2-propagate:\s*false\b/m.test(readFileSync(absPath, 'utf-8'));
  } catch {
    return false;
  }
}
