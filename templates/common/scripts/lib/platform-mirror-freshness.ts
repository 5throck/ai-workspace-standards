#!/usr/bin/env bun
/**
 * Platform Mirror Freshness — pure comparison helpers
 * @version 1.0.1
 *
 * T-20260916-008: the four L1 platform skill mirrors
 * (templates/common/.{claude,gemini,agents,codex}/skills) are propagated
 * from the workspace platform mirrors by propagate-to-templates.ts, and the
 * workspace mirrors are kept current by sync-skills.ts from the skills/
 * SSOT. Until this module existed nothing verified that the chain actually
 * terminated in current copies — templates/common/.claude/skills/
 * upgrade-project sat at 1.4.1 while skills/upgrade-project moved to 1.5.0
 * (the claude/gemini/agents propagation scope-skip; codex had no skip —
 * the asymmetry this batch removes).
 *
 * validate-templates.ts's `platform-mirror-freshness` check consumes
 * `collectMirrorFreshnessDrift` to fail the build when any skill present in
 * BOTH a platform mirror and the skills/ SSOT carries a different
 * `version:` than the SSOT. Skills that exist only in the mirror (L1-only
 * common assets: decision-record, i18n-*, k-*, …) and skills without a
 * parseable version on either side are out of the arm's scope by design.
 *
 * Import-safety: no side effects, no I/O at import time; all reads happen
 * inside functions. Unit tests drive it against scratch dirs in os.tmpdir().
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The four platform skill-mirror dirs under templates/common/. */
export const PLATFORM_MIRROR_DIRS: readonly string[] = [
  '.claude/skills',
  '.gemini/skills',
  '.agents/skills',
  '.codex/skills',
];

/**
 * Extract the `version:` frontmatter value from SKILL.md text.
 * Returns null when absent or unparseable — such skills are skipped by the
 * freshness arm rather than failed (frontmatter richness is B-09's domain).
 */
export function extractSkillVersion(skillMdText: string): string | null {
  // Strip a UTF-8 BOM first — `^` in the multiline regex would not match a
  // `version:` line sitting behind a BOM, silently skipping the skill.
  const m = skillMdText.replace(/^\uFEFF/, '').match(/^version:\s*"?([^"\n]+)"?\s*$/m);
  return m ? m[1].trim() : null;
}

export interface MirrorFreshnessDrift {
  /** Platform mirror dir relative to templates/common/ (e.g. ".claude/skills"). */
  mirror: string;
  /** Skill directory name. */
  skill: string;
  /** SSOT skills/<skill>/SKILL.md version. */
  ssotVersion: string;
  /** Mirror SKILL.md version (differs from ssotVersion by definition). */
  mirrorVersion: string;
}

/**
 * Compare every skill present in BOTH a platform mirror and the skills/
 * SSOT; report version mismatches. Pure over the given directory paths —
 * callers pass real workspace paths, unit tests pass scratch dirs.
 */
export function collectMirrorFreshnessDrift(opts: {
  ssotSkillsDir: string;
  commonDir: string;
  mirrorDirs?: readonly string[];
}): MirrorFreshnessDrift[] {
  const mirrorDirs = opts.mirrorDirs ?? PLATFORM_MIRROR_DIRS;
  const drift: MirrorFreshnessDrift[] = [];

  for (const mirror of mirrorDirs) {
    const mirrorDir = join(opts.commonDir, mirror);
    if (!existsSync(mirrorDir)) continue; // mirror not shipped yet — propagation's concern, not freshness
    let entries: string[] = [];
    try {
      entries = readdirSync(mirrorDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    } catch {
      continue;
    }
    for (const skill of entries) {
      const ssotText = readSkillMd(join(opts.ssotSkillsDir, skill, 'SKILL.md'));
      const mirrorText = readSkillMd(join(mirrorDir, skill, 'SKILL.md'));
      if (ssotText === null || mirrorText === null) continue; // no SSOT counterpart (L1-only) or unreadable
      const ssotVersion = extractSkillVersion(ssotText);
      const mirrorVersion = extractSkillVersion(mirrorText);
      if (ssotVersion === null || mirrorVersion === null) continue;
      if (ssotVersion !== mirrorVersion) {
        drift.push({ mirror, skill, ssotVersion, mirrorVersion });
      }
    }
  }
  return drift;
}

function readSkillMd(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}
