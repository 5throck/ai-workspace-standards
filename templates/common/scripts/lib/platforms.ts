#!/usr/bin/env bun
// @version 1.1.0
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
