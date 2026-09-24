#!/usr/bin/env bun
/**
 * mirror-hygiene.ts — platform skill-mirror hygiene scanner (shared helper).
 * @version 1.0.0
 *
 * Spec: docs/designs/2026-09-25-verifier-platform-expansion-design.md (R6/AC-8).
 * A platform skill mirror (e.g. .agents/skills/, .codex/skills/) contains ONLY
 * skill directories — one directory per skill, each holding a SKILL.md. Any
 * other entry (stray files like SKILLS.md/README*.md, or directories without a
 * SKILL.md) is drift: mirrors are produced by sync-skills (directories only),
 * so nothing legitimate can ever re-emit a file entry, and a directory without
 * SKILL.md is not a deliverable skill.
 *
 * Pure + side-effect-free: takes a mirror directory path, returns findings.
 * Callers own severity (WARN during the ADR-0055 soak; promotion ticket flips
 * to fail). Finding-B class (11 stray files in 9 variants, 2026-09-25) is the
 * motivating capture this check exists to catch.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface MirrorHygieneFinding {
  /** Entry name inside the mirror (e.g. "SKILLS.md"). */
  entry: string;
  /** Entry class: a file, or a directory without SKILL.md. */
  kind: 'stray-file' | 'stray-dir';
}

/**
 * Scan one mirror directory. Returns one finding per non-skill entry.
 * A missing mirror directory is not a finding (mirrors are optional per
 * platform); an unreadable directory is treated as clean here (callers that
 * need strictness can layer their own existsSync gate).
 */
export function scanMirrorHygiene(mirrorDir: string): MirrorHygieneFinding[] {
  if (!existsSync(mirrorDir)) return [];
  const findings: MirrorHygieneFinding[] = [];
  for (const entry of readdirSync(mirrorDir, { withFileTypes: true })) {
    if (entry.isFile()) {
      findings.push({ entry: entry.name, kind: 'stray-file' });
      continue;
    }
    if (!entry.isDirectory()) continue; // symlinks and specials are not mirror entries
    if (existsSync(join(mirrorDir, entry.name, 'SKILL.md'))) continue; // skill directory — clean
    findings.push({ entry: entry.name, kind: 'stray-dir' });
  }
  return findings;
}
