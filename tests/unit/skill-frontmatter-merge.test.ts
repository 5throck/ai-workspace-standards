/**
 * Pure-function tests for scripts/lib/skill-frontmatter-merge.ts
 * (T-20261128-004, design 2026-11-28-origin-l2-drift-design.md §3.1/§3.5).
 *
 * The lib encodes the origin-L2 authority model: body common-authoritative,
 * frontmatter variant-authoritative (protected keys never overwritten; stamps
 * advance only on strict NUMERIC-newer; absent keys filled), plus body-swap
 * preservation of variant-origin audit_exception markers and WS-05a
 * legalization of the re-synced body.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  compareVersions,
  mergeStaleFrontmatter,
  healSkillFile,
  legalizeVariantBodyWs05a,
  parseTopLevelKeys,
  readVersion,
  splitFrontmatter,
} from '../../scripts/lib/skill-frontmatter-merge.ts';

const FM = (inner: string) => `---\n${inner}\n---\nbody\n`;

describe('compareVersions — numeric semver (the lexicographic trap pin)', () => {
  test('1.10.0 > 1.6.0 numerically (string compare would reverse this)', () => {
    expect(compareVersions('1.10.0', '1.6.0')).toBeGreaterThan(0);
    expect(compareVersions('1.6.0', '1.10.0')).toBeLessThan(0);
    expect('1.10.0' < '1.6.0').toBe(true); // documents the trap the numeric compare must avoid
  });
  test('strictly newer patch/minor/major', () => {
    expect(compareVersions('1.2.3', '1.2.0')).toBeGreaterThan(0);
    expect(compareVersions('1.5.2', '1.5.1')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '1.9.9')).toBeGreaterThan(0);
  });
  test('equal versions compare 0', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });
});

describe('mergeStaleFrontmatter — §3.1 preserve/fill/advance', () => {
  const COMMON = [
    'name: sync',
    'description: common doctrine',
    'version: 1.11.0',
    'last_reviewed: 2026-11-28',
    'status: active',
    'scope: common',
    'owner: automation-engineer',
    'prerequisites: none',
  ].join('\n');

  test('protected variant keys survive byte-for-byte; stamps advance; absent key filled', () => {
    const variant = [
      'name: sync',
      'description: common doctrine',
      'version: 1.6.0',
      'last_reviewed: 2026-09-17',
      'status: active',
      'scope: co-safety',
      'owner: pm',
    ].join('\n');
    const r = mergeStaleFrontmatter(variant, COMMON);
    expect(r.advanced).toBe(true);
    expect(r.changedKeys.sort()).toEqual(['last_reviewed', 'version']);
    expect(r.filledKeys).toEqual(['prerequisites']);
    const merged = r.inner;
    // protected keys preserved verbatim (never overwritten from common)
    expect(merged).toContain('scope: co-safety');
    expect(merged).toContain('owner: pm');
    expect(merged).not.toContain('scope: common');
    expect(merged).not.toContain('owner: automation-engineer');
    // stamps advanced to common's values
    expect(merged).toContain('version: 1.11.0');
    expect(merged).toContain('last_reviewed: 2026-11-28');
    // fill appended
    expect(merged).toContain('prerequisites: none');
    // every untouched variant line kept byte-for-byte
    for (const line of ['name: sync', 'description: common doctrine']) {
      expect(merged.split('\n')).toContain(line);
    }
  });

  test('lang/lang_reason/audit_exception and variant-owned empty-valued keys are never touched', () => {
    const variant = [
      'lang: ko',
      'lang_reason: legal',
      'name: translate',
      'version: 1.0.2',
      'tier:',
      '  claude: medium',
      'lifecycle:',
      'last_reviewed: 2026-08-24',
      'scope: co-safety',
      'audit_exception: safety-os-skill-structure — keep',
    ].join('\n');
    const common = [
      'name: translate',
      'version: 1.0.3',
      'tier: high',
      'lifecycle: full',
      'last_reviewed: 2026-11-08',
      'scope: common',
    ].join('\n');
    const r = mergeStaleFrontmatter(variant, common);
    const merged = r.inner;
    expect(merged).toContain('lang: ko');
    expect(merged).toContain('lang_reason: legal');
    expect(merged).toContain('audit_exception: safety-os-skill-structure — keep');
    // empty-valued variant-owned block keys are NOT overwritten from common
    expect(merged).toContain('tier:\n  claude: medium');
    expect(merged).not.toContain('tier: high');
    expect(merged).toContain('lifecycle:\n');
    expect(merged).not.toContain('lifecycle: full');
    expect(merged).not.toContain('scope: common');
    expect(merged).toContain('version: 1.0.3');
  });

  test('no advance when the common twin is NOT strictly numerically newer', () => {
    const variant = 'version: 2.0.0\nlast_reviewed: 2026-01-01\nscope: co-x';
    const r = mergeStaleFrontmatter(variant, 'version: 1.11.0\nlast_reviewed: 2026-11-28\nscope: common');
    expect(r.advanced).toBe(false);
    expect(r.changedKeys).toEqual([]);
    expect(r.inner).toContain('version: 2.0.0');
    expect(r.inner).toContain('last_reviewed: 2026-01-01');
  });

  test('numeric gate: 1.11.0 common IS strictly newer than 1.6.0 variant (lexicographic would disagree)', () => {
    const r = mergeStaleFrontmatter('version: 1.6.0\nscope: co-safety', 'version: 1.10.0\nscope: common');
    expect(r.advanced).toBe(true);
    expect(r.inner).toContain('version: 1.10.0');
  });

  test('parseTopLevelKeys spans nested block values and readVersion reads scalars', () => {
    const inner = 'name: x\nmetadata:\n  type: t\n  triggers:\n    - a\n    - b\nversion: 1.2.3';
    const keys = parseTopLevelKeys(inner);
    expect(keys.map(([k]) => k)).toEqual(['name', 'metadata', 'version']);
    expect(readVersion(inner)).toBe('1.2.3');
    expect(splitFrontmatter(FM(inner))?.body).toBe('body\n');
  });
});

describe('healSkillFile — body swap + audit_exception + WS-05a legalization', () => {
  test('body replaced by common body; body-embedded audit_exception preserved; idempotent', () => {
    const variant = FM('name: x\nversion: 1.2.0\nlast_reviewed: 2026-05-30\nscope: co-safety\nowner: pm').replace('body\n', [
      'audit_exception: safety-os-skill-structure — Safety OS skills use the SSOT format',
      '',
      '## Old Variant Body',
      'stale doctrine',
    ].join('\n'));
    const common = FM('name: x\nversion: 1.2.3\nlast_reviewed: 2026-11-26\nscope: common\nprerequisites: none').replace('body\n', [
      '## Overview',
      'fresh common doctrine',
    ].join('\n'));
    const r = healSkillFile(variant, common);
    expect(r.changed).toBe(true);
    expect(r.changedKeys.sort()).toEqual(['last_reviewed', 'version'].sort());
    expect(r.filledKeys).toEqual(['prerequisites']);
    expect(r.auditExceptionPreserved).toBe(1);
    // body is common's + the preserved marker line
    expect(r.content).toContain('fresh common doctrine');
    expect(r.content).not.toContain('stale doctrine');
    expect(r.content).toContain('audit_exception: safety-os-skill-structure — Safety OS skills use the SSOT format');
    expect(r.content).toContain('scope: co-safety');
    // idempotent: healing the healed output is a no-op
    const r2 = healSkillFile(r.content, common);
    expect(r2.changed).toBe(false);
  });

  test('WS-05a legalization: forbidden table rows dropped, prose names neutralized', () => {
    const body = [
      '| 4.5 | L0 to L1 Publish | FATAL | Runs via `propagate-to-templates.ts --apply` |',
      '| 4.6 | Skill Sync | non-fatal | Runs `sync-skills.ts` |',
      'validated loudly by `validate-templates.ts` (check `sync-detection`)',
    ].join('\n');
    const r = legalizeVariantBodyWs05a(body);
    expect(r.droppedLines).toBe(1); // only the propagate-to-templates row
    expect(r.rewrittenLines).toBe(1);
    expect(r.body).not.toContain('propagate-to-templates');
    expect(r.body).toContain('| 4.6 | Skill Sync | non-fatal | Runs `sync-skills.ts` |');
    expect(r.body).toContain('the L0 template lifecycle validator');
  });

  test('heal of a byte-identical-after-stamp-advance copy reaches byte-identity with common', () => {
    const variant = FM('name: a\nversion: 1.1.0\nlast_reviewed: 2026-11-08\nscope: common');
    const common = FM('name: a\nversion: 1.1.2\nlast_reviewed: 2026-11-27\nscope: common');
    const r = healSkillFile(variant, common);
    expect(r.content).toBe(common); // stamp-advance-only pair converges fully
  });
});
