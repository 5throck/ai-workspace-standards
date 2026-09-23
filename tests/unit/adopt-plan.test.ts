/**
 * Unit tests for scripts/helpers/adopt-plan.ts — pure scan/plan logic for the
 * adopt-project conversion (external project → workspace standard, in place).
 *
 * Coverage focus (PM meeting 2026-09-23 P0s): the delivered-path derivation must
 * match the upgrade-policy deny-list inversion (a path missed here is a path the
 * engine clobbers), collisions must include ALL delivered trees (scripts/, agents/,
 * skills/, docs/, root), and the refusal-grade scans (secrets, hook managers) must
 * fire on the shapes the security review named.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildAdoptionPlan, deriveDeliveredPaths, detectHookManagerConflicts,
  findSecretShapedFiles, listForeignSkills, scanCollisions, scanRetainedForeignScripts,
  scanWorkflowTraces,
} from '../../scripts/helpers/adopt-plan.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'adopt-plan-test');
const COMMON_DIR = path.resolve(import.meta.dir, '..', '..', 'templates', 'common');

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

function mkdirp(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function write(p: string, content = 'x\n'): void {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, content);
}

describe('deriveDeliveredPaths', () => {
  test('delivers the union of common + variant with variant precedence and no docs/context.md from the variant', () => {
    const variantDir = path.join(scratchRoot, 'templates', 'co-unit');
    write(path.join(variantDir, 'AGENTS.md'));
    write(path.join(variantDir, 'docs', 'co-unit.context.md'));
    write(path.join(variantDir, 'docs', 'context.md')); // must be ignored (WS-07)

    const delivered = deriveDeliveredPaths(COMMON_DIR, variantDir);

    expect(delivered.has('AGENTS.md')).toBe(true);
    expect(delivered.get('AGENTS.md')?.source).toBe('variant');
    expect(delivered.has('docs/co-unit.context.md')).toBe(true);
    // The variant's docs/context.md is skipped; the common one (if shipped) wins.
    if (delivered.has('docs/context.md')) expect(delivered.get('docs/context.md')?.source).toBe('common');
    // Common files are in the delivered set
    expect(delivered.has('CLAUDE.md')).toBe(true);
    expect(delivered.has('scripts/audit.ts')).toBe(true);
  });
});

describe('scanCollisions', () => {
  test('flags every delivered path that exists in the project, across trees', () => {
    const variantDir = path.join(scratchRoot, 'templates', 'co-unit');
    write(path.join(variantDir, 'agents', 'reviewer.md'));
    const projectDir = path.join(scratchRoot, 'project');
    write(path.join(projectDir, 'AGENTS.md')); // common-owned collision
    write(path.join(projectDir, 'agents', 'reviewer.md')); // variant-owned collision
    write(path.join(projectDir, 'tools', 'build.sh')); // NOT delivered — stays

    const delivered = deriveDeliveredPaths(COMMON_DIR, variantDir);
    const collisions = scanCollisions(projectDir, delivered);

    expect(collisions.some(c => c.rel === 'AGENTS.md')).toBe(true);
    expect(collisions.some(c => c.rel === 'agents/reviewer.md')).toBe(true);
    expect(collisions.some(c => c.rel === 'tools/build.sh')).toBe(false);
  });
});

describe('scanRetainedForeignScripts', () => {
  test('lists foreign scripts/*.ts not delivered, excluding test-* harnesses', () => {
    const projectDir = path.join(scratchRoot, 'project');
    write(path.join(projectDir, 'scripts', 'build.ts'));
    write(path.join(projectDir, 'scripts', 'test-something.ts'));
    write(path.join(projectDir, 'scripts', 'lib', 'nested.ts'));
    const delivered = deriveDeliveredPaths(COMMON_DIR, null);
    delivered.set('scripts/audit.ts', { rel: 'scripts/audit.ts', source: 'common', claimPass: 'x' });

    const retained = scanRetainedForeignScripts(projectDir, delivered);
    expect(retained).toContain('scripts/build.ts');
    expect(retained).not.toContain('scripts/test-something.ts');
    expect(retained).not.toContain('scripts/audit.ts'); // delivered — collision, not retained
    expect(retained).not.toContain('scripts/lib/nested.ts'); // top-level scan only (registry is top-level)
  });
});

describe('findSecretShapedFiles', () => {
  test('matches the security-review shapes and nothing benign', () => {
    const files = [
      '.env',
      'config/.env.production',
      'certs/server.pem',
      'id_rsa.key',
      'vault.p12',
      'service-account-prod.json',
      'aws-credentials.txt',
      'secrets.yaml',
      'README.md',
      'src/main.ts',
      'envelope.md', // contains 'velope' not 'secret' — must NOT match
    ];
    const hits = findSecretShapedFiles(files);
    expect(hits).toContain('.env');
    expect(hits).toContain('config/.env.production');
    expect(hits).toContain('certs/server.pem');
    expect(hits).toContain('id_rsa.key');
    expect(hits).toContain('vault.p12');
    expect(hits).toContain('service-account-prod.json');
    expect(hits).toContain('aws-credentials.txt');
    expect(hits).toContain('secrets.yaml');
    expect(hits).not.toContain('README.md');
    expect(hits).not.toContain('src/main.ts');
    expect(hits).not.toContain('envelope.md');
  });
});

describe('detectHookManagerConflicts', () => {
  test('detects husky/simple-git-hooks/lefthook via package.json, .husky/, and pre-commit config', () => {
    const projectDir = path.join(scratchRoot, 'proj-husky');
    write(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'foreign',
      scripts: { prepare: 'husky install' },
      devDependencies: { husky: '^9.0.0' },
    }));
    mkdirp(path.join(projectDir, '.husky'));
    write(path.join(projectDir, '.pre-commit-config.yaml'));

    const kinds = detectHookManagerConflicts(projectDir).map(f => f.kind);
    expect(kinds).toContain('husky');
    expect(kinds).toContain('pre-commit-config');
  });

  test('flags non-governed files inside an existing .githooks/ directory', () => {
    const projectDir = path.join(scratchRoot, 'proj-githooks');
    write(path.join(projectDir, '.githooks', 'post-merge'), '#!/bin/sh\n');
    const findings = detectHookManagerConflicts(projectDir);
    expect(findings.some(f => f.kind === 'custom-githooks' && f.detail.includes('post-merge'))).toBe(true);
  });

  test('clean project yields no findings', () => {
    const projectDir = path.join(scratchRoot, 'proj-clean');
    write(path.join(projectDir, 'package.json'), JSON.stringify({ name: 'clean', scripts: { build: 'tsc' } }));
    expect(detectHookManagerConflicts(projectDir)).toEqual([]);
  });
});

describe('scanWorkflowTraces / listForeignSkills', () => {
  test('traces existing workflow artifacts', () => {
    const projectDir = path.join(scratchRoot, 'proj-traces');
    write(path.join(projectDir, 'CONTRIBUTING.md'));
    write(path.join(projectDir, '.github', 'workflows', 'ci.yml'));
    const traces = scanWorkflowTraces(projectDir);
    expect(traces.some(t => t.rel === 'CONTRIBUTING.md' && t.kind === 'docs')).toBe(true);
    expect(traces.some(t => t.rel === '.github/workflows/ci.yml' && t.kind === 'ci')).toBe(true);
  });

  test('foreign skills = project skills absent from both template trees', () => {
    const variantDir = path.join(scratchRoot, 'templates', 'co-unit');
    write(path.join(variantDir, 'skills', 'variant-skill', 'SKILL.md'));
    const projectDir = path.join(scratchRoot, 'proj-skills');
    write(path.join(projectDir, 'skills', 'proj-own-skill', 'SKILL.md'));
    write(path.join(projectDir, 'skills', 'meeting-facilitation', 'SKILL.md')); // common-owned
    const foreign = listForeignSkills(projectDir, COMMON_DIR, variantDir);
    expect(foreign).toContain('proj-own-skill');
    expect(foreign).not.toContain('meeting-facilitation');
    expect(foreign).not.toContain('variant-skill');
  });
});

describe('buildAdoptionPlan', () => {
  test('assembles the full plan with refusal-grade and mapping sections', () => {
    const variantDir = path.join(scratchRoot, 'templates', 'co-unit');
    write(path.join(variantDir, 'agents', 'reviewer.md'));
    write(path.join(variantDir, 'variant.json'), JSON.stringify({ name: 'co-unit', status: 'stable' }));
    const projectDir = path.join(scratchRoot, 'proj-full');
    write(path.join(projectDir, 'AGENTS.md'));
    write(path.join(projectDir, 'scripts', 'build.ts'));
    write(path.join(projectDir, 'skills', 'proj-own-skill', 'SKILL.md'));
    write(path.join(projectDir, '.env'), 'SECRET=1\n');
    write(path.join(projectDir, '.git', 'HEAD'), 'ref: refs/heads/main\n'); // fake repo for ls-files parity

    const plan = buildAdoptionPlan({
      variant: 'co-unit',
      platform: 'all',
      projectName: 'proj-full',
      commonDir: COMMON_DIR,
      variantDir,
      projectDir,
      trackedFiles: ['.env', 'README.md'],
    });

    expect(plan.planVersion).toBe(1);
    expect(plan.variant).toBe('co-unit');
    expect(plan.collisions.some(c => c.rel === 'AGENTS.md')).toBe(true);
    expect(plan.retainedForeignScripts).toContain('scripts/build.ts');
    expect(plan.foreignSkills).toContain('proj-own-skill');
    expect(plan.secretShapedTrackedFiles).toEqual(['.env']);
    expect(plan.roster).toContain('reviewer');
    expect(plan.deliveredThenRemoved).toContain('variant.json');
    expect(plan.deliveredPathCount).toBeGreaterThan(100); // real templates/common tree
  });
});
