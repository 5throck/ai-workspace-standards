/**
 * Variant skills/SKILLS.md registry parseability (T-20260924-009 R3.5, spec
 * docs/designs/2026-09-25-inventory-decisions-batch-design.md).
 *
 * Pins the four curated variant registries authored by the inventory-decisions
 * batch: parseSkillRegistryRows must return one row per variant-exclusive skill
 * directory (co-consult 18, co-deck 10, co-security 6, co-develop 4 — the
 * 38-row batch), every row's version/status/owner/last_reviewed must equal the
 * skill's SKILL.md frontmatter, and no row may name a non-existent directory.
 * co-design/co-game were already clean and are pinned too, so the whole
 * registry-covered variant set cannot silently regress.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { parseSkillRegistryRows } from '../../scripts/helpers/skills-registry.ts';

const templatesDir = resolve(import.meta.dir, '..', '..', 'templates');

const EXPECTED_COUNTS: Record<string, number> = {
  'co-consult': 18,
  'co-deck': 10,
  'co-security': 6,
  'co-develop': 4,
};

function skillDirs(variant: string): string[] {
  const dir = join(templatesDir, variant, 'skills');
  return readdirSync(dir).filter(e => existsSync(join(dir, e, 'SKILL.md'))).sort();
}

function frontmatter(variant: string, skill: string): Record<string, string> {
  const content = readFileSync(join(templatesDir, variant, 'skills', skill, 'SKILL.md'), 'utf-8');
  return (yaml.load(content.match(/^---\n([\s\S]*?)\n---/)![1]) ?? {}) as Record<string, string>;
}

describe('variant SKILLS.md registries (T-20260924-009 R3.5)', () => {
  for (const [variant, expected] of Object.entries(EXPECTED_COUNTS)) {
    test(`${variant}: parseable row count equals skill-dir count (${expected})`, () => {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      const { rows } = parseSkillRegistryRows(content);
      expect(rows.size).toBe(expected);

      const dirNames = skillDirs(variant);
      expect(dirNames.length).toBe(expected);
      // Bijection: every dir has exactly one row, no row names a non-existent dir.
      for (const dirName of dirNames) {
        expect(rows.has(dirName)).toBe(true);
      }
      for (const rowName of rows.keys()) {
        expect(dirNames).toContain(rowName);
      }
    });

    test(`${variant}: every row's version/status/owner/last_reviewed equal the SKILL.md frontmatter`, () => {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      const { rows } = parseSkillRegistryRows(content);
      for (const row of rows.values()) {
        const fm = frontmatter(variant, row.skill);
        expect(row.version).toBe(String(fm.version));
        expect(row.status).toBe(String(fm.status ?? 'active'));
        expect(row.owner).toBe(String(fm.owner ?? '—'));
        expect(row.lastReviewed).toBe(String(fm.last_reviewed ?? '—'));
        expect(row.removalDate).toBe('—');
        expect(row.notes).toContain(`${variant} only`);
      }
    });
  }

  test('co-consult header opts out of legacy verify-skills regeneration', () => {
    const content = readFileSync(join(templatesDir, 'co-consult', 'skills', 'SKILLS.md'), 'utf-8');
    expect(content.startsWith('# SKILLS.md — Skill Lifecycle Registry')).toBe(true);
    expect(content.startsWith('# Skills Index')).toBe(false);
  });

  test('already-clean variants stay clean (co-design 4/4, co-game 5/5)', () => {
    for (const [variant, expected] of [['co-design', 4], ['co-game', 5]] as const) {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      const { rows } = parseSkillRegistryRows(content);
      expect(rows.size).toBe(expected);
      const dirNames = skillDirs(variant);
      for (const dirName of dirNames) expect(rows.has(dirName)).toBe(true);
    }
  });
});
