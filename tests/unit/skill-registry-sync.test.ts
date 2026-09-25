/**
 * Skill registry auto-sync (spec 2026-09-25-registry-policy-completeness-design.md
 * W5/R5.9): fixture coverage for scripts/sync-skill-registries.ts and the
 * skills-registry helper v1.2.0 sync machinery — drift detection/update,
 * ghost-row prune, missing-row append, multi-variant catalog cells,
 * unparseable-version handling, divergent multi-variant frontmatter, CLI
 * gate/apply/idempotency, and the real-tree day-one state (only the 7 known
 * catalog-divergent findings).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  collectRegistryDrift,
  collectWorkspaceRegistryFindings,
  formatCatalogVariantCell,
  parseSkillRegistryRows,
  splitRootRegistry,
  syncVariantExclusiveCatalog,
} from '../../scripts/helpers/skills-registry.ts';

const repoRoot = resolve(import.meta.dir, '..', '..');

// ── Fixture ───────────────────────────────────────────────────────────────────

function skillMd(opts: { name: string; version?: string; lastReviewed?: string; owner?: string }): string {
  const fm = [
    '---',
    `name: ${opts.name}`,
    'description: fixture skill',
    'status: active',
    `owner: ${opts.owner ?? 'pm'}`,
    ...(opts.version ? [`version: ${opts.version}`] : []),
    ...(opts.lastReviewed ? [`last_reviewed: ${opts.lastReviewed}`] : []),
    '---',
    `# ${opts.name}`,
  ].join('\n');
  return fm + '\n';
}

const REGISTRY_HEADER = [
  '# SKILLS.md — Skill Lifecycle Registry',
  '',
  '## Registry',
  '',
  '### Workspace Skills',
  '',
  '| skill | version | status | owner | last_reviewed | removal-date | notes |',
  '|-------|---------|--------|-------|---------------|--------------|-------|',
].join('\n');

const CATALOG_HEADER = [
  '### Variant-Exclusive Skills',
  '',
  'Variant-only skill catalog.',
  '',
  '| skill | version | status | owner | last_reviewed | removal-date | variant |',
  '|-------|---------|--------|-------|---------------|--------------|---------|',
].join('\n');

const tmpRoots: string[] = [];

function makeFixtureRoot(): string {
  const root = mkdtempSync(join(resolve('/tmp'), 'skill-registry-sync-'));
  tmpRoots.push(root);

  // Root skills tree: alpha (stale row), ghost-skill (no dir), broken (no version).
  mkdirSync(join(root, 'skills', 'alpha'), { recursive: true });
  mkdirSync(join(root, 'skills', 'broken'), { recursive: true });
  writeFileSync(join(root, 'skills', 'alpha', 'SKILL.md'), skillMd({ name: 'alpha', version: '1.2.0', lastReviewed: '2026-01-01' }));
  writeFileSync(join(root, 'skills', 'broken', 'SKILL.md'), skillMd({ name: 'broken' }));
  writeFileSync(
    join(root, 'skills', 'SKILLS.md'),
    [
      REGISTRY_HEADER,
      '| `alpha` | 1.0.0 | active | pm | 2025-01-01 | — | stale workspace row |',
      '| `ghost-skill` | 1.0.0 | active | pm | 2025-01-01 | — | ghost row |',
      '| `broken` | 1.0.0 | active | pm | 2025-01-01 | — | unparseable frontmatter |',
      '',
      CATALOG_HEADER,
      '| `oldskill` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '| `ghost-catalog` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '| `epsilon` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '',
    ].join('\n'),
  );

  // Common seed: beta row stale vs frontmatter 1.0.1.
  mkdirSync(join(root, 'templates', 'common', 'skills', 'beta'), { recursive: true });
  writeFileSync(join(root, 'templates', 'common', 'skills', 'beta', 'SKILL.md'), skillMd({ name: 'beta', version: '1.0.1', lastReviewed: '2026-02-02' }));
  writeFileSync(
    join(root, 'templates', 'common', 'skills', 'SKILLS.md'),
    [REGISTRY_HEADER, '| `beta` | 1.0.0 | active | pm | 2025-01-01 | — | stale seed row |', ''].join('\n'),
  );

  // Variant co-x: gamma (stale row), oldskill (stale catalog row + own dir),
  // delta (no row, identical twin in co-y), epsilon (divergent twin in co-y).
  for (const skill of ['gamma', 'oldskill', 'delta', 'epsilon']) {
    mkdirSync(join(root, 'templates', 'co-x', 'skills', skill), { recursive: true });
  }
  writeFileSync(join(root, 'templates', 'co-x', 'skills', 'gamma', 'SKILL.md'), skillMd({ name: 'gamma', version: '1.3.0', lastReviewed: '2026-03-03' }));
  writeFileSync(join(root, 'templates', 'co-x', 'skills', 'oldskill', 'SKILL.md'), skillMd({ name: 'oldskill', version: '1.3.0', lastReviewed: '2026-03-03' }));
  writeFileSync(join(root, 'templates', 'co-x', 'skills', 'delta', 'SKILL.md'), skillMd({ name: 'delta', version: '1.0.0', lastReviewed: '2026-04-04' }));
  writeFileSync(join(root, 'templates', 'co-x', 'skills', 'epsilon', 'SKILL.md'), skillMd({ name: 'epsilon', version: '1.0.0', lastReviewed: '2026-05-05' }));
  writeFileSync(
    join(root, 'templates', 'co-x', 'skills', 'SKILLS.md'),
    [REGISTRY_HEADER, '| `gamma` | 1.2.0 | active | pm | 2025-01-01 | — | co-x only — stale |', ''].join('\n'),
  );

  // Variant co-y: identical delta, divergent epsilon.
  for (const skill of ['delta', 'epsilon']) {
    mkdirSync(join(root, 'templates', 'co-y', 'skills', skill), { recursive: true });
  }
  writeFileSync(join(root, 'templates', 'co-y', 'skills', 'delta', 'SKILL.md'), skillMd({ name: 'delta', version: '1.0.0', lastReviewed: '2026-04-04' }));
  writeFileSync(join(root, 'templates', 'co-y', 'skills', 'epsilon', 'SKILL.md'), skillMd({ name: 'epsilon', version: '2.0.0', lastReviewed: '2026-06-06' }));
  writeFileSync(
    join(root, 'templates', 'co-y', 'skills', 'SKILLS.md'),
    [REGISTRY_HEADER, '| `delta` | 0.9.0 | active | pm | 2025-01-01 | — | co-y only — stale |', ''].join('\n'),
  );

  return root;
}

afterAll(() => {
  for (const root of tmpRoots) rmSync(root, { recursive: true, force: true });
});

// ── Helper-level tests ────────────────────────────────────────────────────────

describe('skill-registry-sync helpers (W5)', () => {
  test('collectRegistryDrift classifies version drift, ghost rows, unparseable dirs, and missing rows', () => {
    const content = [
      REGISTRY_HEADER,
      '| `alpha` | 1.0.0 | active | pm | 2025-01-01 | — | stale |',
      '| `ghost` | 1.0.0 | active | pm | 2025-01-01 | — | ghost |',
      '| `broken` | 1.0.0 | active | pm | 2025-01-01 | — | unparseable |',
    ].join('\n');
    const delivered = [{ skill: 'alpha', version: '1.2.0', status: 'active', owner: 'pm', lastReviewed: '2026-01-01' }];
    const findings = collectRegistryDrift('surface', content, delivered, ['alpha', 'broken']);
    const kinds = findings.map((f) => `${f.kind}:${f.skill}`);
    expect(kinds).toContain('version-drift:alpha');
    expect(kinds).toContain('ghost-row:ghost');
    expect(kinds).toContain('unparseable:broken');
    expect(findings.find((f) => f.skill === 'alpha')!.message).toContain('1.0.0/2025-01-01 != frontmatter 1.2.0/2026-01-01');
  });

  test('splitRootRegistry separates the workspace section from the catalog', () => {
    const content = [REGISTRY_HEADER, '| `alpha` | 1.0.0 | active | pm | — | — | — |', '', CATALOG_HEADER, '| `oldskill` | 0.9.0 | active | pm | — | — | co-x only |'].join('\n');
    const { workspace, catalog } = splitRootRegistry(content);
    expect(parseSkillRegistryRows(workspace).rows.size).toBe(1);
    expect(parseSkillRegistryRows(workspace).rows.has('alpha')).toBe(true);
    expect(parseSkillRegistryRows(catalog).rows.size).toBe(1);
    expect(parseSkillRegistryRows(catalog).rows.has('oldskill')).toBe(true);
  });

  test('formatCatalogVariantCell: singular gets "only", plural is comma-joined', () => {
    expect(formatCatalogVariantCell(['co-x'])).toBe('co-x only');
    expect(formatCatalogVariantCell(['co-develop', 'co-game'])).toBe('co-develop, co-game');
  });

  test('syncVariantExclusiveCatalog: updates, prunes ghosts, appends with owner cells, keeps divergent untouched', () => {
    const catalog = [
      CATALOG_HEADER,
      '| `oldskill` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '| `ghost-catalog` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '| `epsilon` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |',
      '',
    ].join('\n');
    const entries = [
      { skill: 'oldskill', version: '1.3.0', status: 'active', owner: 'pm', lastReviewed: '2026-03-03', variants: ['co-x'] },
      { skill: 'delta', version: '1.0.0', status: 'active', owner: 'pm', lastReviewed: '2026-04-04', variants: ['co-x', 'co-y'] },
      { skill: 'gamma', version: '1.3.0', status: 'active', owner: 'pm', lastReviewed: '2026-03-03', variants: ['co-x'] },
    ];
    const { content, updated, added, pruned } = syncVariantExclusiveCatalog(catalog, entries, new Set(['epsilon']));
    expect(updated).toEqual(['oldskill']);
    expect(added).toEqual(['delta', 'gamma']);
    expect(pruned).toEqual(['ghost-catalog']);
    const rows = parseSkillRegistryRows(content).rows;
    expect(rows.get('oldskill')!.version).toBe('1.3.0');
    expect(rows.get('delta')!.notes).toBe('co-x, co-y');
    expect(rows.get('gamma')!.notes).toBe('co-x only');
    // Divergent row kept byte-identical.
    expect(rows.get('epsilon')!.version).toBe('0.9.0');
    expect(content).toContain('| `epsilon` | 0.9.0 | active | pm | 2025-01-01 | — | co-x only |');
  });
});

// ── CLI integration over the fixture ─────────────────────────────────────────

function runCli(root: string, ...args: string[]): { exitCode: number; stdout: string } {
  const { spawnSync } = require('node:child_process') as typeof import('node:child_process');
  const res = spawnSync('bun', [join(repoRoot, 'scripts', 'sync-skill-registries.ts'), '--root', root, ...args], {
    encoding: 'utf-8',
    cwd: repoRoot,
  });
  return { exitCode: res.status ?? -1, stdout: (res.stdout ?? '') + (res.stderr ?? '') };
}

function readRegistry(root: string, rel: string[]): string {
  return readFileSync(join(root, ...rel), 'utf-8');
}

describe('skill-registry-sync CLI over a fixture root (W5)', () => {
  const root = makeFixtureRoot();

  test('--check exits 1 and reports the fixture drift before any apply', () => {
    const { exitCode, stdout } = runCli(root, '--check');
    expect(exitCode).toBe(1);
    for (const kind of ['version-drift', 'ghost-row', 'unparseable', 'missing-row', 'catalog-divergent']) {
      expect(stdout).toContain(`[${kind}]`);
    }
    expect(stdout).toContain('`ghost-skill`');
    expect(stdout).toContain('`ghost-catalog`');
    expect(stdout).toContain('`epsilon` frontmatter diverges');
  });

  test('apply converges every surface', () => {
    const { exitCode, stdout } = runCli(root);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('4 changed');

    // Workspace rows: alpha refreshed, ghost pruned, unparseable kept.
    const rootRegistry = readRegistry(root, ['skills', 'SKILLS.md']);
    const { workspace, catalog } = splitRootRegistry(rootRegistry);
    const workspaceRows = parseSkillRegistryRows(workspace).rows;
    expect(workspaceRows.get('alpha')!.version).toBe('1.2.0');
    expect(workspaceRows.get('alpha')!.lastReviewed).toBe('2026-01-01');
    expect(workspaceRows.has('ghost-skill')).toBe(false);
    expect(workspaceRows.has('broken')).toBe(true);

    // Catalog: stale refreshed, ghost pruned, multi-variant cell, divergent untouched.
    const catalogRows = parseSkillRegistryRows(catalog).rows;
    expect(catalogRows.get('oldskill')!.version).toBe('1.3.0');
    expect(catalogRows.has('ghost-catalog')).toBe(false);
    expect(catalogRows.get('delta')!.notes).toBe('co-x, co-y');
    expect(catalogRows.get('epsilon')!.version).toBe('0.9.0');

    // Common seed refreshed.
    const commonRows = parseSkillRegistryRows(readRegistry(root, ['templates', 'common', 'skills', 'SKILLS.md'])).rows;
    expect(commonRows.get('beta')!.version).toBe('1.0.1');

    // Variant registries refreshed against their own trees.
    const coXRows = parseSkillRegistryRows(readRegistry(root, ['templates', 'co-x', 'skills', 'SKILLS.md'])).rows;
    expect(coXRows.get('gamma')!.version).toBe('1.3.0');
    expect(coXRows.get('delta')!.version).toBe('1.0.0');
    const coYRows = parseSkillRegistryRows(readRegistry(root, ['templates', 'co-y', 'skills', 'SKILLS.md'])).rows;
    expect(coYRows.get('epsilon')!.version).toBe('2.0.0');
  });

  test('post-apply --check reports only the divergent finding (exit 1)', () => {
    const { exitCode, stdout } = runCli(root, '--check');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('catalog-divergent');
    // `broken` keeps its row (fail-closed) and keeps being reported.
    expect(stdout).toContain('[unparseable]');
    expect(stdout).not.toContain('[version-drift]');
    expect(stdout).not.toContain('[ghost-row]');
    expect(stdout).not.toContain('[missing-row]');
  });

  test('second apply is a byte-identical no-op (idempotency)', () => {
    const before = [
      ['skills', 'SKILLS.md'],
      ['templates', 'common', 'skills', 'SKILLS.md'],
      ['templates', 'co-x', 'skills', 'SKILLS.md'],
      ['templates', 'co-y', 'skills', 'SKILLS.md'],
    ].map((rel) => readRegistry(root, rel));
    const { exitCode, stdout } = runCli(root);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('all converged, 0 changed');
    const after = [
      ['skills', 'SKILLS.md'],
      ['templates', 'common', 'skills', 'SKILLS.md'],
      ['templates', 'co-x', 'skills', 'SKILLS.md'],
      ['templates', 'co-y', 'skills', 'SKILLS.md'],
    ].map((rel) => readRegistry(root, rel));
    expect(after).toEqual(before);
  });
});

// ── Real-tree day-one state ──────────────────────────────────────────────────

describe('real-tree registry sync state (W5)', () => {
  test('the only remaining findings are the 7 known catalog-divergent skills', () => {
    const findings = collectWorkspaceRegistryFindings(repoRoot);
    const unexpected = findings.filter((f) => f.kind !== 'catalog-divergent');
    expect(unexpected).toEqual([]);
    const divergent = new Set(findings.map((f) => f.skill));
    expect(divergent).toEqual(new Set(['competitive-intelligence', 'consulting-report-writing', 'executive-presentation', 'insight-synthesis', 'org-readiness-assessment', 'stakeholder-alignment', 'pdf-export']));
  });
});
