#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-10-10, eight-platform coverage — spec docs/designs/2026-10-10-eight-platform-coverage-design.md):
//           PLATFORM_PROFILES, PlatformProfile, PROFILE_OWNED_PATHS (SSOT for per-profile
//           prunable files) and parsePlatformList() (comma-separated --platform / platform=
//           parser, legacy `both` = `all`). Pure: no I/O.
// v1.1.0 (2026-09-25, ADR-0088 W1): fifth platform mirror `.hermes/skills` added to
//           PLATFORM_SKILL_BASES and PLATFORM_MIRROR_DIRS (NousResearch Hermes Agent;
//           source-verified project skill path, agent/skill_utils.py
//           PROJECT_SKILLS_SUBDIRS at 59004a6). Adoption rule unchanged: sites adopt
//           the constant only where it replaces the literal with zero change to
//           values, order, or types.
// v1.0.0: initial — PLATFORM_SKILL_BASES (the 5 project skill bases, skills/
//           SSOT first) and PLATFORM_MIRROR_DIRS (the 4 platform skill-mirror
//           dirs; definition moved here from lib/platform-mirror-freshness.ts,
//           which re-exports it for back-compat). Step 1 of the platform-parity
//           program (spec: docs/designs/2026-09-24-platform-ssot-constant-design.md).
/**
 * platforms.ts — platform-list SSOT constants
 *
 * Single source of truth for the agent-platform directory lists. Before this
 * module the two lists existed only as duplicated inline literals across
 * scripts (11 five-element + 6 variant-shaped sites at c4afd8); the drift
 * audit recorded three live incidents caused by that duplication. Adoption
 * rule: a site adopts the constant only where it replaces the literal with
 * zero change to values, order, or types.
 *
 * Import-safety: no imports, no side effects, no I/O (mirrors the freshness
 * module's contract).
 */

/**
 * The six project skill bases: the platform-neutral skills/ SSOT first, then
 * the five platform mirrors. Order is load-bearing and pinned by
 * tests/unit/platforms.test.ts.
 */
export const PLATFORM_SKILL_BASES: readonly string[] = [
  'skills',
  '.claude/skills',
  '.gemini/skills',
  '.agents/skills',
  '.codex/skills',
  '.hermes/skills',
];

/**
 * The five platform skill-mirror dirs (no skills/ SSOT element). Definition
 * home; re-exported by lib/platform-mirror-freshness.ts for back-compat.
 */
export const PLATFORM_MIRROR_DIRS: readonly string[] = [
  '.claude/skills',
  '.gemini/skills',
  '.agents/skills',
  '.codex/skills',
  '.hermes/skills',
];

/** The four platform profiles, in canonical order. Names are frozen (no aliases). */
export const PLATFORM_PROFILES = ['claude', 'antigravity', 'codex', 'hermes'] as const;
export type PlatformProfile = typeof PLATFORM_PROFILES[number];

/**
 * Files/dirs owned by each profile. A profile that is NOT selected has these
 * removed at scaffold/adopt time; shared files (AGENTS.md, skills/, .agents/) are
 * never listed here and are always kept.
 */
export const PROFILE_OWNED_PATHS: Record<PlatformProfile, readonly string[]> = {
  claude: ['CLAUDE.md'],
  antigravity: ['GEMINI.md'],
  codex: ['CODEX.md', '.codex'],
  hermes: ['HERMES.md', '.hermes'],
};

const CANONICAL_ORDER = PLATFORM_PROFILES;
const VALID_TOKENS = [...PLATFORM_PROFILES, 'all'];

/**
 * Parse a comma-separated platform list (`claude,codex`, `all`, `both` legacy).
 * Throws an Error naming the bad token and the valid set on unknown or empty input.
 * Warnings (not errors) are returned for `all` mixed with other tokens and for the
 * legacy `both` alias.
 */
export function parsePlatformList(raw: string): { profiles: PlatformProfile[]; canonical: string; warnings: string[] } {
  const warnings: string[] = [];
  const tokens = raw.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
  if (tokens.length === 0) {
    throw new Error(`empty --platform list (valid: ${VALID_TOKENS.join(', ')})`);
  }
  const selected = new Set<PlatformProfile>();
  let sawAll = false;
  for (const tok of tokens) {
    if (tok === 'both') {
      warnings.push("legacy platform value 'both' is treated as 'all'");
      sawAll = true;
    } else if (tok === 'all') {
      sawAll = true;
    } else if ((PLATFORM_PROFILES as readonly string[]).includes(tok)) {
      selected.add(tok as PlatformProfile);
    } else {
      throw new Error(`unknown platform '${tok}' (valid: ${VALID_TOKENS.join(', ')})`);
    }
  }
  if (sawAll) {
    if (tokens.some(t => t !== 'all' && t !== 'both')) {
      warnings.push("'all' combined with other platforms; normalized to 'all'");
    }
    return { profiles: [...CANONICAL_ORDER], canonical: 'all', warnings };
  }
  const profiles = CANONICAL_ORDER.filter(p => selected.has(p));
  const canonical = profiles.length === CANONICAL_ORDER.length ? 'all' : profiles.join(',');
  return { profiles, canonical, warnings };
}

/** Owned paths of the given profiles (union, canonical order, no duplicates). */
export function ownedPathsForProfiles(profiles: readonly PlatformProfile[]): string[] {
  const out: string[] = [];
  for (const p of CANONICAL_ORDER) {
    if (!profiles.includes(p)) continue;
    for (const rel of PROFILE_OWNED_PATHS[p]) if (!out.includes(rel)) out.push(rel);
  }
  return out;
}

/** Instruction files (root *.md) of the given profiles, for merge-file selection. */
export function instructionFilesForProfiles(profiles: readonly PlatformProfile[]): string[] {
  return ownedPathsForProfiles(profiles).filter(rel => rel.endsWith('.md'));
}
