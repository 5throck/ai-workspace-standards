/**
 * Check MM — model-ID literal ban in skill trees (T-20261011-015)
 * @version 1.0.0
 *
 * Covers the pure detection surfaces behind skill-lifecycle-audit Check MM:
 * findModelLiterals (shared lib) and the exported skill-tree walk. The
 * error-emission comparison itself lives in the audit loop, as with Check MV.
 *
 * Workspace directive (2026-10-11): registry model IDs live ONLY in
 * docs/workspace-schema.json (`models.*`) and the CLAUDE.md §6 / AGENTS.md
 * §3.6 managed prose — never in skills.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findModelLiterals } from '../../scripts/lib/model-literal-patterns.ts';
import { scanSkillTreeForModelLiterals } from '../../scripts/skill-lifecycle-audit.ts';

describe('findModelLiterals (Check MM detection patterns)', () => {
  test('detects a Claude registry literal', () => {
    expect(findModelLiterals('High tier runs `claude-opus-5-5`.')).toEqual(['claude-opus-5-5']);
    expect(findModelLiterals('claude-sonnet-5-5 and claude-haiku-5-5')).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
  });

  test('detects Gemini and Codex registry literals', () => {
    expect(findModelLiterals('dispatch to gemini-3.1-pro')).toEqual(['gemini-3.1-pro']);
    expect(findModelLiterals('gemini-3.8-flash / gpt-5.6-sol / gpt-5.6-terra / gpt-5.6-luna'))
      .toEqual(['gemini-3.8-flash', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna']);
  });

  test('matching is case-insensitive', () => {
    expect(findModelLiterals('Claude-Opus-5-5')).toEqual(['Claude-Opus-5-5']);
  });

  test('alias-only content is clean ("opus", "sonnet", "haiku")', () => {
    expect(findModelLiterals('model = "opus"; fallback "sonnet"; lint with "haiku"')).toEqual([]);
  });

  test('registry pointers are clean (docs/workspace-schema.json → models.claude.high)', () => {
    expect(findModelLiterals('`docs/workspace-schema.json → models.claude.high`')).toEqual([]);
    expect(findModelLiterals('see models.gemini.medium and models.gpt tier keys')).toEqual([]);
  });

  test('platform names without version digits are clean (gemini-cli, claude)', () => {
    expect(findModelLiterals('Claude Code CLI and gemini-cli are platforms, not models')).toEqual([]);
  });

  test('duplicates collapse to the first occurrence', () => {
    expect(findModelLiterals('claude-opus-5-5 then claude-opus-5-5 again')).toEqual(['claude-opus-5-5']);
  });

  test('plain text without IDs is clean', () => {
    expect(findModelLiterals('# Platform Harness\n\nNo models here, just dispatch guidance.\n')).toEqual([]);
  });
});

describe('scanSkillTreeForModelLiterals (Check MM skill-tree walk)', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'skill-mm-audit-'));

  test('a literal in references/** is reported per file; alias-only SKILL.md is clean', () => {
    const skillDir = join(tmpRoot, 'dirty-skill');
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: dirty-skill\n---\n\nUse the High tier alias `opus`.\n');
    writeFileSync(join(skillDir, 'references', 'HARNESS.md'), 'Tier table: `claude-sonnet-5-5`\n');
    writeFileSync(join(skillDir, 'references', 'clean.json'), '{"pointer": "docs/workspace-schema.json → models.claude.high"}\n');

    const hits = scanSkillTreeForModelLiterals(skillDir);
    expect(hits.length).toBe(1);
    expect(hits[0].file).toBe(join(skillDir, 'references', 'HARNESS.md'));
    expect(hits[0].literals).toEqual(['claude-sonnet-5-5']);
  });

  test('a fully clean skill tree yields no hits', () => {
    const skillDir = join(tmpRoot, 'clean-skill');
    mkdirSync(join(skillDir, 'references'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: clean-skill\n---\n\nmodel = "haiku"\n');
    writeFileSync(join(skillDir, 'references', 'TIERS.md'), '| High | `docs/workspace-schema.json → models.claude.high` |\n');
    expect(scanSkillTreeForModelLiterals(skillDir)).toEqual([]);
  });

  test('hidden directories and node_modules are skipped', () => {
    const skillDir = join(tmpRoot, 'skip-skill');
    mkdirSync(join(skillDir, '.hidden'), { recursive: true });
    mkdirSync(join(skillDir, 'node_modules'), { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'clean\n');
    writeFileSync(join(skillDir, '.hidden', 'x.md'), 'claude-opus-5-5\n');
    writeFileSync(join(skillDir, 'node_modules', 'dep.md'), 'gemini-3.8-flash\n');
    expect(scanSkillTreeForModelLiterals(skillDir)).toEqual([]);
  });

  test('literals inside SKILL.md itself are reported', () => {
    const skillDir = join(tmpRoot, 'self-skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: self-skill\n---\n\nHigh → `gpt-5.6-sol`\n');
    const hits = scanSkillTreeForModelLiterals(skillDir);
    expect(hits.length).toBe(1);
    expect(hits[0].literals).toEqual(['gpt-5.6-sol']);
  });

  rmSync(tmpRoot, { recursive: true, force: true });
});
