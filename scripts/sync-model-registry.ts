#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-10-26, ADR-0102 scalar tier / design
//           2026-10-26-model-registry-platform-coverage-design §7): SURFACES
//           drops the 9 root agents/*.md entries — root agents now declare one
//           scalar `tier:` (no model-ID comments remain), so those sweep
//           entries were no-ops. The 2 L1 agent entries stay until PR-2
//           normalizes templates/common/agents (their tier frontmatter still
//           carries registry-checked model comments).
// v1.1.1 (2026-10-23, design 2026-10-23-zai-tier-floor-support follow-up):
//           SURFACES gains templates/common/agents/pm.md + i18n-specialist.md —
//           the L1 roster tier frontmatter carries registry-checked model
//           comments (the completeness test caught them on PR #1587's CI).
// v1.1.0 (2026-10-23, design 2026-10-23-zai-tier-floor-support): SURFACES gains
//           the 9 root agents/*.md (tier frontmatter gained registry-checked
//           model comments — hermes mirrors the claude tiers, zai carries the
//           GLM mapping). [Retired v1.2.0 — ADR-0102 removed the comments.]
// v1.0.0 (2026-10-11, T-20261011-015): initial release — curated-surface model-ID
//           sweep for the model-migration skill (workspace directive 2026-10-11:
//           model IDs live only in docs/workspace-schema.json `models.*` and the
//           CLAUDE.md §6 / AGENTS.md §3.6 managed prose; skills carry no literals,
//           enforced by skill-lifecycle-audit Check MM via the shared
//           lib/model-literal-patterns.ts pattern set).
// @l2-propagate: false
// sync-model-registry.ts — replace a retired registry model ID across the
// sanctioned prose surfaces after a docs/workspace-schema.json `models.*` bump
// (workspace-root governance tooling, L0-only — same class as ticket.ts /
// write-scripts-snapshot.ts; never delivered to templates or projects).
//
// Usage:
//   bun scripts/sync-model-registry.ts --from <old-registry-id> --to <new-registry-id>
//
// Behavior:
//   1. Validates --to is registered in docs/workspace-schema.json `models.*`,
//      --from != --to, and --from is still registered somewhere (an absent
//      --from means the sweep already ran or the id is a typo/stale — fail
//      closed either way).
//   2. Replaces --from with --to in every curated SURFACES entry (fixed list)
//      plus every templates/<variant>/AGENTS.md (variant glob), writing only
//      files that changed, and prints a per-file replaced-count table.
//   3. Exits 1 if any skills-tree file (skills/**, templates/*/skills/**)
//      still matches the Check MM model-ID patterns — the sweep never edits
//      skills; literals there are Check MM errors.
//   4. Exits 1 if any resolved surface is missing from disk (repo drift).
//
// Deliberately NOT swept: historical records (CHANGELOG.md, docs/adr/**,
// docs/designs/**, docs/lifecycle/**, docs/specs/**, scripts/SCRIPTS.md
// history columns) keep their original IDs as provenance.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { findModelLiterals } from './lib/model-literal-patterns.ts';
import { die } from './lib/error-handling.ts';

const ROOT = join(import.meta.dir, '..');

/** Curated fixed prose surfaces whose model-ID literals must track the registry. */
export const SURFACES: readonly string[] = [
  // Root instruction twins + constitution (managed marker sections carry the tier tables)
  'CONSTITUTION.md',
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'CODEX.md',
  'docs/constitution/05-multi-agent-architecture.md',
  'docs/governance/agents/execution-plan-templates.md',
  // L1 mirrors / common docs
  'templates/common/AGENTS.md',
  'templates/common/CLAUDE.md',
  'templates/common/GEMINI.md',
  'templates/common/CODEX.md',
  // L1 agent roster (tier frontmatter gained registry-checked model comments,
  // same class as the root agents — zai tier-floor follow-up PR)
  'templates/common/agents/pm.md',
  'templates/common/agents/i18n-specialist.md',
  'templates/common/docs/context.md',
  'templates/common/docs/variants/pm-yaml-schema.md',
  'templates/common/docs/governance/agents/execution-plan-templates.md',
  // Variant docs that name concrete models in dispatch tables
  'templates/co-game/docs/phase-definitions.md',
  'templates/co-game/docs/designs/specs/2026-06-26-pacman-agent-team-design.md',
  'templates/co-safety/docs/co-safety.context.md',
  'templates/co-abap/docs/user-guide.md',
  'templates/co-abap/docs/user-guide_ko.md',
  'templates/co-export/docs/user-guide.md',
  'templates/co-export/docs/user-guide_ko.md',
  'templates/co-hr/docs/user-guide.md',
  'templates/co-hr/docs/user-guide_ko.md',
  'templates/co-news/docs/user-guide.md',
  'templates/co-news/docs/user-guide_ko.md',
  // Live test expectation over the AGENTS.md tier list
  'tests/unit/managed-block-parity.test.ts',
];

/** Variant glob expanded at runtime: every templates/<variant>/AGENTS.md. */
export const VARIANT_AGENTS_GLOB = 'templates/*/AGENTS.md';

/** Expand the curated surfaces: fixed entries + the variant glob, deduped. */
export function resolveSurfaces(root: string = ROOT): string[] {
  const resolved = [...SURFACES];
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = join('templates', entry.name, 'AGENTS.md').replace(/\\/g, '/');
      if (!resolved.includes(candidate)) resolved.push(candidate);
    }
  }
  return resolved;
}

/** Flatten docs/workspace-schema.json `models.*` values into a list of IDs. */
export function parseSchemaModels(schemaJson: string): string[] {
  const schema = JSON.parse(schemaJson) as { models?: Record<string, Record<string, string>> };
  const models = schema.models ?? {};
  const ids: string[] = [];
  for (const platform of Object.keys(models)) {
    for (const tier of Object.keys(models[platform])) {
      const id = models[platform][tier];
      if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * Pure migration validation. Returns null when the migration may proceed,
 * otherwise a human-readable refusal reason.
 */
export function validateMigration(from: string, to: string, registryModels: string[]): string | null {
  if (!from || !to) return 'both --from and --to are required';
  if (from === to) return `--from and --to are identical ("${to}") — nothing to migrate`;
  if (!registryModels.includes(to)) {
    return `--to "${to}" is not registered in docs/workspace-schema.json models.* — edit the registry first`;
  }
  if (!registryModels.includes(from)) {
    return `--from "${from}" is not registered in docs/workspace-schema.json models.* — stale sweep (already migrated?) or a typo`;
  }
  return null;
}

/** Pure content sweep: replace every `from` occurrence, report the count. */
export function sweepContent(content: string, from: string, to: string): { content: string; count: number } {
  if (!content.includes(from)) return { content, count: 0 };
  const count = content.split(from).length - 1;
  return { content: content.split(from).join(to), count };
}

const SKILL_TEXT_EXT = /\.(md|markdown|txt|json|jsonc|yaml|yml|html|htm|ts|js|mjs|cjs|css|svg)$/i;

/**
 * Walk the workspace skills trees (skills/ plus every templates/<variant>/skills
 * and templates/common/skills tree) for model-ID literals — the same pattern
 * set as skill-lifecycle-audit Check MM. Returns one entry per offending file.
 * Exported for tests.
 */
export function scanSkillsTreesForModelLiterals(root: string = ROOT): Array<{ file: string; literals: string[] }> {
  const bases = [join(root, 'skills')];
  const templatesDir = join(root, 'templates');
  if (existsSync(templatesDir)) {
    for (const entry of readdirSync(templatesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && (entry.name.startsWith('co-') || entry.name === 'common')) {
        bases.push(join(templatesDir, entry.name, 'skills'));
      }
    }
  }
  const hits: Array<{ file: string; literals: string[] }> = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walk(full, depth + 1);
      } else if (SKILL_TEXT_EXT.test(entry.name)) {
        try {
          const literals = findModelLiterals(readFileSync(full, 'utf-8'));
          if (literals.length > 0) hits.push({ file: full, literals });
        } catch {
          // unreadable file — skip
        }
      }
    }
  };
  for (const base of bases) {
    if (existsSync(base)) walk(base, 0);
  }
  return hits;
}

function main(): void {
  const args = process.argv.slice(2);
  const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : '';
  const to = args.includes('--to') ? args[args.indexOf('--to') + 1] : '';

  const schemaPath = join(ROOT, 'docs', 'workspace-schema.json');
  // Definite-assignment assertion: `die()` exits in main mode.
  let schemaRaw!: string;
  try {
    schemaRaw = readFileSync(schemaPath, 'utf-8');
  } catch (err) {
    die(`Could not read docs/workspace-schema.json at ${schemaPath}: ${String(err)}`, 1);
  }
  const registryModels = parseSchemaModels(schemaRaw);

  const refusal = validateMigration(from, to, registryModels);
  if (refusal) die(`refused: ${refusal}`, 1);

  const surfaces = resolveSurfaces(ROOT);
  const missing = surfaces.filter((rel) => !existsSync(join(ROOT, rel)));
  if (missing.length > 0) {
    die(`resolved surfaces missing from disk:\n  ${missing.join('\n  ')}`, 1);
  }

  let totalFiles = 0;
  let totalReplacements = 0;
  const changed: Array<{ rel: string; count: number }> = [];
  for (const rel of surfaces) {
    const abs = join(ROOT, rel);
    // Definite-assignment assertion: `die()` exits in main mode.
    let swept!: { content: string; count: number };
    try {
      swept = sweepContent(readFileSync(abs, 'utf-8'), from, to);
    } catch (err) {
      die(`could not read surface ${rel}: ${String(err)}`, 1);
    }
    if (swept.count === 0) continue;
    writeFileSync(abs, swept.content);
    changed.push({ rel, count: swept.count });
    totalFiles += 1;
    totalReplacements += swept.count;
  }

  console.log(`Model registry sweep: ${from} -> ${to}`);
  console.log('--------------------------------------------------');
  if (changed.length === 0) {
    console.log('  (no surface contained the old ID — nothing written)');
  }
  for (const { rel, count } of changed) {
    console.log(`  ${String(count).padStart(3)}x  ${rel}`);
  }
  console.log('--------------------------------------------------');
  console.log(`${totalReplacements} replacement(s) across ${totalFiles} file(s)`);

  const skillHits = scanSkillsTreesForModelLiterals(ROOT);
  if (skillHits.length > 0) {
    console.error('');
    console.error('FAIL: skills trees still contain model-ID literals (Check MM) —');
    for (const hit of skillHits) {
      console.error(`  ${relative(ROOT, hit.file).replace(/\\/g, '/')}: ${hit.literals.join(', ')}`);
    }
    console.error('Skills must reference the registry (docs/workspace-schema.json → models.<platform>.<tier>) or tier aliases.');
    process.exit(1);
  }

  console.log('Skills trees clean (Check MM patterns).');
}

if (import.meta.main) {
  main();
}
