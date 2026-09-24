/**
 * Regression test — platform-parity P1 bug 6 (copyL0CommonSkills platform coverage).
 *
 * Spec: docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md (D6, D8 bug 6)
 *
 * Contract under test: generate-variant.ts's copyL0CommonSkills must seed the
 * four L0-common lifecycle skills into ALL FOUR platform mirrors of a promoted
 * variant (.claude, .gemini, .agents, .codex). Pre-fix the platforms const was
 * ['.claude', '.gemini'] only, so promoted variants' .agents/.codex mirrors
 * lacked the trio (finishing-a-development-branch,
 * platform-command-lifecycle-manager, platform-skill-lifecycle-manager) — the
 * live drift healed by D7 on templates/co-design.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect } from 'bun:test';
// generate-variant.ts is import-safe: its run path is behind import.meta.main.
import { copyL0CommonSkills } from '../../scripts/helpers/generate-variant.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

const L0_COMMON_SKILLS = [
  'agent-lifecycle-manager',
  'finishing-a-development-branch',
  'platform-command-lifecycle-manager',
  'platform-skill-lifecycle-manager',
] as const;

const PLATFORMS = ['.claude', '.gemini', '.agents', '.codex'] as const;

describe('copyL0CommonSkills — four-platform L0-common mirror seeding (P1 bug 6)', () => {
  test('all four L0-common skills land on all four platform mirrors', () => {
    const variantPath = mkdtempSync(join(tmpdir(), 'gen-variant-l0common-'));
    try {
      copyL0CommonSkills(variantPath);

      for (const platform of PLATFORMS) {
        for (const skill of L0_COMMON_SKILLS) {
          const skillMd = join(variantPath, platform, 'skills', skill, 'SKILL.md');
          expect(existsSync(skillMd)).toBe(true);
        }
      }

      // Sources exist in all four templates/common mirrors (verified at design
      // time) — every delivered SKILL.md must be the byte-copy of its mirror
      // source (copyFileUTF8 semantics, no content edits).
      for (const platform of PLATFORMS) {
        for (const skill of L0_COMMON_SKILLS) {
          const src = join(workspaceRoot, 'templates', 'common', platform, 'skills', skill, 'SKILL.md');
          const dst = join(variantPath, platform, 'skills', skill, 'SKILL.md');
          expect(existsSync(src)).toBe(true);
          expect(readFileSync(dst, 'utf-8')).toBe(readFileSync(src, 'utf-8'));
        }
      }
    } finally {
      rmSync(variantPath, { recursive: true, force: true });
    }
  }, 60000);
});
