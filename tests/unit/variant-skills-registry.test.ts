/**
 * Variant skills/SKILLS.md registry parseability (T-20260924-009 R3.5, spec
 * docs/designs/2026-09-25-inventory-decisions-batch-design.md; extended for
 * the remaining seven variants by spec
 * docs/designs/2026-09-25-registry-policy-completeness-design.md R1.7).
 *
 * Pins the eleven curated variant registries: parseSkillRegistryRows must
 * return one row per skill directory (co-consult 18, co-deck 10, co-security
 * 6, co-develop 4 — the 38-row inventory batch; co-abap 13, co-export 11,
 * co-hr 12, co-news 6, co-price 22, co-safety 60, co-work 1 — the 125-row
 * registry-completeness batch), every row's version/status/owner/last_reviewed
 * must equal the skill's SKILL.md frontmatter, and no row may name a
 * non-existent directory. co-design/co-game were already clean and are pinned
 * too, so the whole registry-covered variant set cannot silently regress.
 *
 * co-safety's inherited/exclusive split is pinned by name: exactly 8 rows are
 * customized forks of common skills (variant-maintained), the other 52 are
 * co-safety-exclusive (design §1 classification, R1.5).
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { parseSkillRegistryRows, splitRootRegistry, collectCatalogEntries, formatCatalogVariantCell, type SkillRegistryRow } from '../../scripts/helpers/skills-registry.ts';

const templatesDir = resolve(import.meta.dir, '..', '..', 'templates');

const EXPECTED_COUNTS: Record<string, number> = {
  'co-consult': 18,
  'co-deck': 10,
  'co-security': 6,
  'co-develop': 4,
  'co-abap': 13,
  'co-export': 11,
  'co-hr': 12,
  'co-news': 6,
  'co-price': 22,
  'co-safety': 60,
  'co-work': 1,
};

// Design §1 audited fork set — the only co-safety rows classified as
// customized inherited forks (fresh diff vs templates/common/skills/).
const CO_SAFETY_FORKS = new Set([
  'agent-lifecycle-manager',
  'meeting-facilitation',
  'project-review',
  'script-lifecycle-manager',
  'skill-lifecycle-manager',
  'sync',
  'team-builder',
  'translate',
]);
const FORK_NOTES_MARKER = 'inherited from common — customized fork (variant-maintained)';

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
        if (variant === 'co-safety' && CO_SAFETY_FORKS.has(row.skill)) {
          expect(row.notes).toBe(FORK_NOTES_MARKER);
        } else {
          expect(row.notes).toContain(`${variant} only`);
        }
      }
    });
  }

  test('curated header opts all 11 registry variants out of legacy verify-skills regeneration', () => {
    for (const variant of Object.keys(EXPECTED_COUNTS)) {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      expect(content.startsWith('# SKILLS.md — Skill Lifecycle Registry')).toBe(true);
      expect(content.startsWith('# Skills Index')).toBe(false);
    }
  });

  test('co-safety: exactly the 8 audited fork names carry the fork notes marker; 52 rows are co-safety only', () => {
    const content = readFileSync(join(templatesDir, 'co-safety', 'skills', 'SKILLS.md'), 'utf-8');
    const { rows } = parseSkillRegistryRows(content);
    const forkRows = [...rows.values()].filter(r => r.notes === FORK_NOTES_MARKER);
    expect(forkRows.length).toBe(8);
    expect(new Set(forkRows.map(r => r.skill))).toEqual(CO_SAFETY_FORKS);
    const exclusiveRows = [...rows.values()].filter(r => r.notes !== FORK_NOTES_MARKER);
    expect(exclusiveRows.length).toBe(52);
    for (const row of exclusiveRows) {
      expect(row.notes).toContain('co-safety only');
    }
  });

  test('kept prose survives: co-work promotion note, co-news/co-safety Usage, co-price guide replaced', () => {
    const coWork = readFileSync(join(templatesDir, 'co-work', 'skills', 'SKILLS.md'), 'utf-8');
    expect(coWork).toContain('were promoted to `templates/common/skills/` (scope: common)');
    expect(coWork).toContain('## Usage');
    for (const variant of ['co-news', 'co-safety']) {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      expect(content).toContain('See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.');
    }
    const coPrice = readFileSync(join(templatesDir, 'co-price', 'skills', 'SKILLS.md'), 'utf-8');
    expect(coPrice).not.toContain('# Agent Skills Guide');
    expect(coPrice).toContain('## Usage');
  });

  test('already-clean variants stay clean (co-design 4/4, co-game 5/5)', () => {
    for (const [variant, expected] of [['co-design', 4], ['co-game', 5]] as const) {
      const content = readFileSync(join(templatesDir, variant, 'skills', 'SKILLS.md'), 'utf-8');
      const { rows } = parseSkillRegistryRows(content);
      expect(rows.size).toBe(expected);
      const dirNames = skillDirs(variant);
      for (const dirName of dirNames) expect(rows.has(dirName)).toBe(true);
      // W5/R5.8: co-design/co-game are inside the value contract too (their
      // accessibility-audit date drift survived count-only coverage).
      for (const row of rows.values()) {
        const fm = frontmatter(variant, row.skill);
        expect(row.version).toBe(String(fm.version));
        expect(row.status).toBe(String(fm.status ?? 'active'));
        expect(row.owner).toBe(String(fm.owner ?? '—'));
        expect(row.lastReviewed).toBe(String(fm.last_reviewed ?? '—'));
      }
    }
  });
});

describe('W5 registry surfaces (skill-registry-sync)', () => {
  const repoRoot = resolve(import.meta.dir, '..', '..');

  function readFileChecked(path: string): string {
    expect(existsSync(path)).toBe(true);
    return readFileSync(path, 'utf-8');
  }

  function expectRowsMatchFrontmatter(rows: SkillRegistryRow[], fmOf: (skill: string) => Record<string, string>): void {
    for (const row of rows) {
      const fm = fmOf(row.skill);
      expect(row.version).toBe(String(fm.version));
      expect(row.status).toBe(String(fm.status ?? 'active'));
      expect(row.owner).toBe(String(fm.owner ?? '—'));
      expect(row.lastReviewed).toBe(String(fm.last_reviewed ?? '—'));
    }
  }

  test('common scaffold seed: bijection + frontmatter equality', () => {
    const content = readFileChecked(join(templatesDir, 'common', 'skills', 'SKILLS.md'));
    const { rows } = parseSkillRegistryRows(content);
    const dirs = skillDirs('common');
    expect(rows.size).toBe(dirs.length);
    for (const dirName of dirs) expect(rows.has(dirName)).toBe(true);
    expectRowsMatchFrontmatter([...rows.values()], (skill) => {
      const raw = readFileChecked(join(templatesDir, 'common', 'skills', skill, 'SKILL.md'));
      return (yaml.load(raw.match(/^---\n([\s\S]*?)\n---/)![1]) ?? {}) as Record<string, string>;
    });
  });

  test('root skills/SKILLS.md workspace section: bijection + frontmatter equality', () => {
    const content = readFileChecked(join(repoRoot, 'skills', 'SKILLS.md'));
    const { workspace } = splitRootRegistry(content);
    const { rows } = parseSkillRegistryRows(workspace);
    const rootSkillsDir = join(repoRoot, 'skills');
    const dirs = readdirSync(rootSkillsDir).filter(e => existsSync(join(rootSkillsDir, e, 'SKILL.md'))).sort();
    expect(rows.size).toBe(dirs.length);
    for (const dirName of dirs) expect(rows.has(dirName)).toBe(true);
    expectRowsMatchFrontmatter([...rows.values()], (skill) => {
      const raw = readFileChecked(join(rootSkillsDir, skill, 'SKILL.md'));
      return (yaml.load(raw.match(/^---\n([\s\S]*?)\n---/)![1]) ?? {}) as Record<string, string>;
    });
  });

  test('root Variant-Exclusive catalog: bijection against variant dirs + values + variant cells', () => {
    const content = readFileChecked(join(repoRoot, 'skills', 'SKILLS.md'));
    const { catalog } = splitRootRegistry(content);
    const rows = [...parseSkillRegistryRows(catalog).rows.values()];
    expect(rows.length).toBeGreaterThan(0);

    // Every variant-exclusive skill dir (not at root) indexed by name.
    const rootSkillNames = new Set(
      readdirSync(join(repoRoot, 'skills')).filter(e => existsSync(join(repoRoot, 'skills', e, 'SKILL.md'))),
    );
    const ownersBySkill = new Map<string, Set<string>>();
    for (const variant of readdirSync(templatesDir).sort()) {
      if (!variant.startsWith('co-')) continue;
      for (const dirName of skillDirs(variant)) {
        if (rootSkillNames.has(dirName)) continue;
        if (!ownersBySkill.has(dirName)) ownersBySkill.set(dirName, new Set());
        ownersBySkill.get(dirName)!.add(variant);
      }
    }
    const { divergentSkills } = collectCatalogEntries(join(templatesDir), rootSkillNames);

    for (const row of rows) {
      const owners = ownersBySkill.get(row.skill);
      expect(owners).toBeDefined();
      if (!owners) continue;
      const sorted = [...owners].sort();
      const isDivergent = divergentSkills.has(row.skill);
      if (!isDivergent) {
        expect(row.notes).toBe(formatCatalogVariantCell(sorted));
        // Value equality against the (identical) owner frontmatter.
        const raw = readFileChecked(join(templatesDir, sorted[0]!, 'skills', row.skill, 'SKILL.md'));
        const fm = (yaml.load(raw.match(/^---\n([\s\S]*?)\n---/)![1]) ?? {}) as Record<string, string>;
        expect(row.version).toBe(String(fm.version));
        expect(row.status).toBe(String(fm.status ?? 'active'));
        expect(row.owner).toBe(String(fm.owner ?? '—'));
        expect(row.lastReviewed).toBe(String(fm.last_reviewed ?? '—'));
      }
    }
    // Bijection the other way: every non-divergent variant-exclusive skill has a row.
    for (const skill of ownersBySkill.keys()) {
      if (divergentSkills.has(skill)) continue; // divergent forks are reported, not cataloged
      expect(rows.some(r => r.skill === skill)).toBe(true);
    }
  });
});
