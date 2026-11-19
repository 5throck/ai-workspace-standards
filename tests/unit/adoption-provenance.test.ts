/**
 * Unit tests for scripts/helpers/adoption-provenance.ts — source-variant
 * adoption-residue selection (T-20261120-001, design
 * docs/designs/2026-11-20-adoption-gaps-batch-design.md; U-20261119-002 gap 3).
 *
 * Coverage focus: the fail-safe contract — a skill reaches `prune` only through the
 * six-way conjunction (source-declared + present + not PROJECT_STATE-authored + not a
 * recorded foreign skill + not target-declared + not common-owned), and every missing
 * or malformed input collapses to "no candidates" (never guess). The identity-flip
 * gate is exercised across all three states (flipped / not flipped / unknowable).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  declaredSkillNames,
  isAdoptionIdentityFlipped,
  listSkillDirNames,
  loadAdoptionProvenance,
  selectSourceVariantPruneCandidates,
  type ResidueSelectionInputs,
} from '../../scripts/helpers/adoption-provenance.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'adoption-provenance-test');

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

function mkdirp(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function baseInputs(overrides: Partial<ResidueSelectionInputs> = {}): ResidueSelectionInputs {
  return {
    provenance: { sourceVariant: 'co-develop', foreignSkills: ['quickdl-core'] },
    projectVariantName: 'co-utility',
    targetVariant: 'co-utility',
    projectManifestSkills: new Set(['post-write-check']),
    presentSkills: new Set(['code-review', 'refactoring', 'swe-solve', 'test-driven-development', 'post-write-check', 'quickdl-core']),
    sourceDeclaredSkills: new Set(['code-review', 'refactoring', 'swe-solve', 'test-driven-development']),
    targetDeclaredSkills: new Set(['post-write-check']),
    commonSkills: new Set(['sync']),
    ...overrides,
  };
}

describe('isAdoptionIdentityFlipped', () => {
  test('flipped / not flipped / unknowable', () => {
    expect(isAdoptionIdentityFlipped('co-utility', 'co-develop')).toBe(true);
    expect(isAdoptionIdentityFlipped('co-develop', 'co-develop')).toBe(false);
    expect(isAdoptionIdentityFlipped(null, 'co-develop')).toBeNull();
    expect(isAdoptionIdentityFlipped('', 'co-develop')).toBeNull();
  });
});

describe('declaredSkillNames', () => {
  test('unions skills[] and skill_manifest.variant_specific[]; malformed → []', () => {
    const json = JSON.stringify({
      skills: [{ name: 'code-review' }, { file: 'skills/x/SKILL.md' }],
      skill_manifest: { variant_specific: [{ name: 'code-review' }, { name: 'swe-solve' }] },
    });
    expect(declaredSkillNames(json)).toEqual(['code-review', 'swe-solve']);
    expect(declaredSkillNames('{ broken')).toEqual([]);
    expect(declaredSkillNames('{}')).toEqual([]);
  });
});

describe('selectSourceVariantPruneCandidates', () => {
  test('the QuickDL shape: all four source-variant skills prune after the flip', () => {
    const sel = selectSourceVariantPruneCandidates(baseInputs());
    expect(sel.prune).toEqual(['code-review', 'refactoring', 'swe-solve', 'test-driven-development']);
  });

  test('each filter independently blocks pruning (kept with the blocking reason)', () => {
    const expectKept = (overrides: Partial<ResidueSelectionInputs>, skill: string, reasonFragment: string) => {
      const sel = selectSourceVariantPruneCandidates(baseInputs(overrides));
      expect(sel.prune).not.toContain(skill);
      const kept = sel.keep.find((k) => k.skill === skill);
      expect(kept?.reason).toContain(reasonFragment);
    };
    expectKept({ presentSkills: new Set(['sync']) }, 'code-review', 'not present');
    expectKept({ projectManifestSkills: new Set(['post-write-check', 'swe-solve']) }, 'swe-solve', 'PROJECT_STATE-authored');
    expectKept({ provenance: { sourceVariant: 'co-develop', foreignSkills: ['quickdl-core', 'code-review'] } }, 'code-review', 'foreign skill');
    expectKept({ targetDeclaredSkills: new Set(['post-write-check', 'code-review']) }, 'code-review', 'target variant');
    expectKept({ commonSkills: new Set(['sync', 'code-review']) }, 'code-review', 'common-owned');
    // Empty source declaration: nothing enters the loop at all — prune and keep both empty.
    const empty = selectSourceVariantPruneCandidates(baseInputs({ sourceDeclaredSkills: new Set() }));
    expect(empty.prune).toEqual([]);
    expect(empty.keep).toEqual([]);
  });

  test('empty/unparsable source declaration → nothing pruned (fail-safe)', () => {
    expect(selectSourceVariantPruneCandidates(baseInputs({ sourceDeclaredSkills: new Set() })).prune).toEqual([]);
  });

  test('prune list is sorted; keep entries carry the skill name', () => {
    const sel = selectSourceVariantPruneCandidates(
      baseInputs({ presentSkills: new Set(['test-driven-development', 'code-review']) }),
    );
    expect(sel.prune).toEqual(['code-review', 'test-driven-development']);
    expect(sel.keep.every((k) => k.skill.length > 0 && k.reason.length > 0)).toBe(true);
  });
});

describe('loadAdoptionProvenance', () => {
  test('reads the decisions file carrier (variant + plan.foreignSkills)', () => {
    const project = path.join(scratchRoot, 'proj-a');
    mkdirp(path.join(project, '.claude'));
    fs.writeFileSync(
      path.join(project, '.claude', 'adopt-project-decisions.json'),
      JSON.stringify({ variant: 'co-develop', plan: { foreignSkills: ['quickdl-core'] } }),
    );
    expect(loadAdoptionProvenance(project)).toEqual({ sourceVariant: 'co-develop', foreignSkills: ['quickdl-core'] });
  });
  test('absent / malformed / wrong-shape → null (never guess)', () => {
    expect(loadAdoptionProvenance(path.join(scratchRoot, 'proj-missing'))).toBeNull();
    const project = path.join(scratchRoot, 'proj-b');
    mkdirp(path.join(project, '.claude'));
    fs.writeFileSync(path.join(project, '.claude', 'adopt-project-decisions.json'), '{ broken');
    expect(loadAdoptionProvenance(project)).toBeNull();
    const projectC = path.join(scratchRoot, 'proj-c');
    mkdirp(path.join(projectC, '.claude'));
    fs.writeFileSync(path.join(projectC, '.claude', 'adopt-project-decisions.json'), JSON.stringify({ variant: 42 }));
    expect(loadAdoptionProvenance(projectC)).toBeNull();
    const projectD = path.join(scratchRoot, 'proj-d');
    mkdirp(path.join(projectD, '.claude'));
    fs.writeFileSync(
      path.join(projectD, '.claude', 'adopt-project-decisions.json'),
      JSON.stringify({ variant: 'co-develop', plan: { foreignSkills: ['ok', 7, null, 'also-ok'] } }),
    );
    expect(loadAdoptionProvenance(projectD)).toEqual({ sourceVariant: 'co-develop', foreignSkills: ['ok', 'also-ok'] });
  });
});

describe('listSkillDirNames', () => {
  test('lists directory names only, sorted; missing dir → []', () => {
    const base = path.join(scratchRoot, 'skills-root');
    mkdirp(path.join(base, 'zebra'));
    mkdirp(path.join(base, 'alpha'));
    fs.writeFileSync(path.join(base, 'file.md'), 'x');
    expect(listSkillDirNames(base)).toEqual(['alpha', 'zebra']);
    expect(listSkillDirNames(path.join(scratchRoot, 'nope'))).toEqual([]);
  });
});
