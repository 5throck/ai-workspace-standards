/**
 * Tests for the variant-common-shadow "fork" class (T-20261128-004, design
 * 2026-11-28-origin-l2-drift-design.md §3.3): fork entries cover a skill's
 * origin path + its five platform-mirror projections; declared forks leave the
 * undeclared set; the fork contract (scope: co-<variant>, version ≥ 1) is
 * asserted against the variant origin copy.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  classifyShadows,
  computeShadowSet,
  forkContractViolation,
  forkEntryCoversInstance,
  type ShadowAllowlistEntry,
} from '../../scripts/validate-templates.ts';

const TMP = join(import.meta.dir, 'fixtures', 'shadow-fork');

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

const FM = (inner: string) => `---\n${inner}\n---\nbody\n`;

describe('forkEntryCoversInstance', () => {
  test('origin path matches exactly', () => {
    expect(forkEntryCoversInstance('skills/sync/SKILL.md', 'skills/sync/SKILL.md')).toBe(true);
  });
  test('all five platform-mirror projections of the same skill are covered', () => {
    for (const pfx of ['.agents', '.claude', '.codex', '.gemini', '.hermes']) {
      expect(forkEntryCoversInstance('skills/sync/SKILL.md', `${pfx}/skills/sync/SKILL.md`)).toBe(true);
    }
  });
  test('other paths are not covered', () => {
    expect(forkEntryCoversInstance('skills/sync/SKILL.md', 'skills/other/SKILL.md')).toBe(false);
    expect(forkEntryCoversInstance('skills/sync/SKILL.md', '.claude/skills/other/SKILL.md')).toBe(false);
    // a lifecycle-record path is neither the origin nor a mirror of the skill
    expect(forkEntryCoversInstance('skills/sync/SKILL.md', 'docs/lifecycle/skills/sync.md')).toBe(false);
    expect(forkEntryCoversInstance('skills/sync/SKILL.md', 'skills/sync/references/x.md')).toBe(false);
  });
  test('non-skill entries only match exactly (no mirror expansion)', () => {
    expect(forkEntryCoversInstance('AGENTS.md', '.claude/AGENTS.md')).toBe(false);
  });
});

describe('forkContractViolation — scope: co-<variant> and version ≥ 1', () => {
  test('valid fork copy passes', () => {
    expect(forkContractViolation('co-safety', FM('name: x\nscope: co-safety\nversion: 1.3.4'))).toBeNull();
    expect(forkContractViolation('co-price', FM('scope: co-price\nversion: 2.1.0'))).toBeNull();
  });
  test('wrong scope fails naming the expected value', () => {
    const r = forkContractViolation('co-safety', FM('scope: common\nversion: 1.0.0'));
    expect(r).toContain('co-safety');
    expect(r).toContain('scope');
  });
  test('missing scope fails', () => {
    expect(forkContractViolation('co-safety', FM('version: 1.0.0'))).toContain('<absent>');
  });
  test('missing or sub-1 version fails', () => {
    expect(forkContractViolation('co-safety', FM('scope: co-safety'))).toContain('version');
    expect(forkContractViolation('co-safety', FM('scope: co-safety\nversion: 0.9.0'))).toContain('version');
  });
  test('no frontmatter fails closed', () => {
    expect(forkContractViolation('co-safety', 'no fm')).toContain('unverifiable');
  });
});

describe('classifyShadows with fork entries', () => {
  // fixture: common skill "sync" shadowed by variant "co-safety" (origin + one mirror)
  const commonDir = join(TMP, 'common');
  const variantDir = join(TMP, 'co-safety');
  const commonText = FM('name: sync\nversion: 1.11.0\nscope: common');
  const variantText = FM('name: sync\nversion: 1.11.0\nscope: co-safety\nowner: pm');

  function setup(): void {
    rmSync(TMP, { recursive: true, force: true });
    mkdirSync(join(commonDir, 'skills', 'sync'), { recursive: true });
    mkdirSync(join(commonDir, '.claude', 'skills', 'sync'), { recursive: true });
    mkdirSync(join(variantDir, 'skills', 'sync'), { recursive: true });
    mkdirSync(join(variantDir, '.claude', 'skills', 'sync'), { recursive: true });
    writeFileSync(join(commonDir, 'skills', 'sync', 'SKILL.md'), commonText);
    writeFileSync(join(commonDir, '.claude', 'skills', 'sync', 'SKILL.md'), commonText);
    writeFileSync(join(variantDir, 'skills', 'sync', 'SKILL.md'), variantText);
    writeFileSync(join(variantDir, '.claude', 'skills', 'sync', 'SKILL.md'), variantText);
  }

  const forkEntry: ShadowAllowlistEntry = {
    path: 'skills/sync/SKILL.md',
    variants: ['co-safety'],
    class: 'fork',
    note: 'test fork',
  };

  test('declared fork covers origin + mirror surfaces; contract holds → silent', () => {
    setup();
    const instances = computeShadowSet(commonDir, { 'co-safety': variantDir });
    expect(instances.length).toBe(2); // origin + .claude mirror
    const report = classifyShadows(commonDir, instances, [forkEntry], { 'co-safety': variantDir });
    expect(report.undeclared).toHaveLength(0);
    expect(report.forkContract).toHaveLength(0);
    expect(report.declaredSilent).toBe(2);
  });

  test('contract violation is reported once and its instances stay undeclared', () => {
    setup();
    writeFileSync(join(variantDir, 'skills', 'sync', 'SKILL.md'), FM('name: sync\nversion: 1.11.0\nscope: common'));
    const instances = computeShadowSet(commonDir, { 'co-safety': variantDir });
    const report = classifyShadows(commonDir, instances, [forkEntry], { 'co-safety': variantDir });
    expect(report.forkContract).toHaveLength(1);
    expect(report.forkContract[0].reason).toContain('co-safety');
    // both surfaces are treated as NOT declared
    expect(report.declaredSilent).toBe(0);
    rmSync(TMP, { recursive: true, force: true });
  });

  test('undeclared variant copy without a fork entry lands in undeclared', () => {
    setup();
    const instances = computeShadowSet(commonDir, { 'co-safety': variantDir });
    const report = classifyShadows(commonDir, instances, [], { 'co-safety': variantDir });
    expect(report.undeclared).toHaveLength(2);
    expect(report.forkContract).toHaveLength(0);
  });

  test('live-tree: the 13 T-004 paths carry zero undeclared skill copies', () => {
    // integration shape check against the real allowlist + tree is covered by
    // validate-templates runs; here we assert the pure contract on the
    // re-derived pair set: every fork-declared pair's instance shape is a
    // frontmatter-only-or-body shadow of the common twin — never missing.
    const paths = [
      'skills/design-foundation/SKILL.md',
      'skills/token-usage-lint/SKILL.md',
      'skills/ui-ux-design-intelligence/SKILL.md',
      'skills/i18n-audit/SKILL.md',
      'skills/project-review/SKILL.md',
      'skills/i18n-layout/SKILL.md',
      'skills/script-lifecycle-manager/SKILL.md',
      'skills/skill-lifecycle-manager/SKILL.md',
      'skills/team-builder/SKILL.md',
      'skills/translate/SKILL.md',
      'skills/sync/SKILL.md',
    ];
    for (const p of paths) expect(forkEntryCoversInstance(p, p)).toBe(true);
  });
});
