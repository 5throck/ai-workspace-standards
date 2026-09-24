/**
 * Regression test — platform-parity P1 bug 6 (copyL0CommonSkills platform coverage)
 * + variant hygiene batch R6 (WS-05a adaptation at the delivery seam).
 *
 * Specs:
 * - docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md (D6, D8 bug 6)
 * - docs/designs/2026-09-25-variant-hygiene-batch-design.md (R6 / AC-8)
 *
 * Contract under test: generate-variant.ts's copyL0CommonSkills must seed the
 * four L0-common lifecycle skills into ALL FOUR platform mirrors of a promoted
 * variant (.claude, .gemini, .agents, .codex). Pre-fix the platforms const was
 * ['.claude', '.gemini'] only, so promoted variants' .agents/.codex mirrors
 * lacked the trio (finishing-a-development-branch,
 * platform-command-lifecycle-manager, platform-skill-lifecycle-manager) — the
 * live drift healed by D7 on templates/co-design.
 *
 * R6 extension: delivered SKILL.md content passes through adaptL0ToolingReferences
 * — a copy whose source carries the raw `bun scripts/validate-templates.ts` line
 * is delivered with the WS-05a workspace-only comment instead; content without
 * the line stays byte-identical to its source.
 *
 * @version 1.1.0
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect } from 'bun:test';
// generate-variant.ts is import-safe: its run path is behind import.meta.main.
import { copyL0CommonSkills, adaptL0ToolingReferences } from '../../scripts/helpers/generate-variant.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

const L0_COMMON_SKILLS = [
  'agent-lifecycle-manager',
  'finishing-a-development-branch',
  'platform-command-lifecycle-manager',
  'platform-skill-lifecycle-manager',
] as const;

const PLATFORMS = ['.claude', '.gemini', '.agents', '.codex'] as const;

const FORBIDDEN_LINE = 'bun scripts/validate-templates.ts';
const ADAPTED_COMMENT =
  '# Workspace-only template validator: run it from the workspace root (L0-only\n' +
  '# tooling — not shipped inside projects), never inside a variant/project.';

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
      // time). Delivery is canonical-except-adapted (R6): content whose source
      // carries the forbidden L0-only command line is delivered with the WS-05a
      // workspace-only comment; every other line — and every source without the
      // line — is the byte-copy (copyFileUTF8 semantics, no content edits).
      for (const platform of PLATFORMS) {
        for (const skill of L0_COMMON_SKILLS) {
          const src = join(workspaceRoot, 'templates', 'common', platform, 'skills', skill, 'SKILL.md');
          const dst = join(variantPath, platform, 'skills', skill, 'SKILL.md');
          expect(existsSync(src)).toBe(true);
          const srcContent = readFileSync(src, 'utf-8');
          const dstContent = readFileSync(dst, 'utf-8');
          expect(dstContent).toBe(adaptL0ToolingReferences(srcContent));
          if (!srcContent.includes(FORBIDDEN_LINE)) {
            expect(dstContent).toBe(srcContent); // byte-preserving path
          }
        }
      }

      // AC-8: the seeded platform-command-lifecycle-manager copies (whose common
      // sources carry the raw line) are adapted — no actionable L0-only command,
      // workspace-only comment present, in all four mirrors.
      for (const platform of PLATFORMS) {
        const src = join(workspaceRoot, 'templates', 'common', platform, 'skills', 'platform-command-lifecycle-manager', 'SKILL.md');
        const dstContent = readFileSync(join(variantPath, platform, 'skills', 'platform-command-lifecycle-manager', 'SKILL.md'), 'utf-8');
        expect(readFileSync(src, 'utf-8')).toContain(FORBIDDEN_LINE); // precondition: source is raw
        expect(dstContent).not.toContain(FORBIDDEN_LINE);
        expect(dstContent).toContain(ADAPTED_COMMENT);
      }
    } finally {
      rmSync(variantPath, { recursive: true, force: true });
    }
  }, 60000);
});

describe('adaptL0ToolingReferences — WS-05a seam adaptation (R6 / AC-8)', () => {
  test('content WITH the forbidden line is adapted to the workspace-only comment', () => {
    const raw = '## Verification\n\n```bash\nbun scripts/verify-platform-lifecycle.ts\nbun scripts/validate-templates.ts\n```\n';
    const adapted = adaptL0ToolingReferences(raw);
    expect(adapted).not.toContain(FORBIDDEN_LINE);
    expect(adapted).toContain(ADAPTED_COMMENT);
    expect(adapted).toContain('bun scripts/verify-platform-lifecycle.ts'); // untouched line survives
  });

  test('content WITHOUT the forbidden line is byte-preserved', () => {
    const clean = '---\nname: x\nversion: 1.0.0\n---\n\nRun `bun run check` locally.\n';
    expect(adaptL0ToolingReferences(clean)).toBe(clean);
  });
});
