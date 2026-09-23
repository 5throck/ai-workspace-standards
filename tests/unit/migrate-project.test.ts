/**
 * Unit tests for scripts/migrate-project.ts pure verification-plan helpers.
 *
 * The migrate-project skill must VERIFY the migration, not assume it: these tests
 * pin the platform-twin expectations (mirroring new-project §2.7 actual behavior),
 * the verification-plan composition, and the artifact evaluation semantics.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildVerificationPlan, evaluateArtifactChecks, expectedPlatformTwins,
  type PlatformProfile,
} from '../../scripts/migrate-project.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'migrate-project-test');

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

describe('expectedPlatformTwins', () => {
  test('mirrors new-project §2.7 platform profiles', () => {
    expect(expectedPlatformTwins('all')).toEqual({ required: ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'], absent: [] });
    expect(expectedPlatformTwins('claude')).toEqual({ required: ['CLAUDE.md'], absent: ['GEMINI.md', 'CODEX.md'] });
    expect(expectedPlatformTwins('antigravity')).toEqual({ required: ['GEMINI.md'], absent: ['CLAUDE.md', 'CODEX.md'] });
    expect(expectedPlatformTwins('codex')).toEqual({ required: ['CLAUDE.md', 'GEMINI.md', 'CODEX.md'], absent: [] });
  });
});

describe('buildVerificationPlan', () => {
  test('includes the variant-named context file and marker line', () => {
    const plan = buildVerificationPlan('co-legal', 'all');
    const targets = plan.map(c => c.target);
    expect(targets).toContain('docs/co-legal.context.md');
    const marker = plan.find(c => c.target === '.claude/template-version.txt' && c.expect);
    expect(marker?.expect).toBe('variant=co-legal');
  });

  test('platform removal expectations differ per profile', () => {
    const claudePlan = buildVerificationPlan('co-work', 'claude');
    expect(claudePlan.some(c => c.kind === 'absent-file' && c.target === 'GEMINI.md')).toBe(true);
    const allPlan = buildVerificationPlan('co-work', 'all');
    expect(allPlan.some(c => c.kind === 'absent-file')).toBe(false);
  });
});

describe('evaluateArtifactChecks', () => {
  test('passes on a satisfied project and fails on missing artifacts and unexpected files', () => {
    const projectDir = path.join(scratchRoot, 'proj');
    fs.mkdirSync(path.join(projectDir, 'docs'), { recursive: true });
    for (const f of ['AGENTS.md', 'docs/context.md', 'docs/co-unit.context.md', '.claude/template-version.txt']) {
      const p = path.join(projectDir, f);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f === '.claude/template-version.txt' ? 'variant=co-unit\nversion=0.6.0\n' : 'x\n');
    }
    fs.writeFileSync(path.join(projectDir, '.gitattributes'), '* text=auto\ndocs/context.md merge=ours\n');

    const plan = buildVerificationPlan('co-unit', 'claude');
    const results = evaluateArtifactChecks(projectDir, plan);

    const failed = results.filter(r => !r.pass).map(r => r.check.label);
    // GEMINI/CODEX absent-checks pass (they are ABSENT, which is required);
    // CLAUDE.md required file was never created — that must fail.
    expect(failed).toContain('CLAUDE.md delivered (platform=claude)');
    expect(results.find(r => r.check.target === 'AGENTS.md')?.pass).toBe(true);
    expect(results.find(r => r.check.target === '.claude/template-version.txt' && r.check.expect)?.pass).toBe(true);
    expect(results.find(r => r.check.target === 'GEMINI.md')?.pass).toBe(true); // absent as required
    expect(results.find(r => r.check.target === '.gitattributes')?.pass).toBe(true);
  });
});
