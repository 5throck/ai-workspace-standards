/**
 * Unit tests for the fresh-scaffold skills-registry reconcile machinery
 * (spec 2026-09-24-skills-registry-overlay-reconcile, T-20260924-008):
 *   - pruneSkillRegistryRows (drop rows for skills absent from the delivered tree),
 *   - collectDeliveredSkills (scan one level of skills dirs for SKILL.md frontmatter, version-less skip),
 *   - extractFrontmatterVersionAndReviewed (moved VERBATIM from upgrade-project.ts),
 *   - the seed → prune → reconcile pipeline new-project §6.4 runs, including
 *     idempotency (second run = byte-identical) and the anchor-less-shape
 *     (co-abap) case.
 *
 * @version 1.0.0
 */

import { describe, expect, it, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  alignSkillRegistryRowsWithFrontmatter,
  collectDeliveredSkills,
  extractFrontmatterVersionAndReviewed,
  foldVariantExclusiveRowsIntoWorkspaceSection,
  parseSkillRegistryRows,
  pruneSkillRegistryRows,
  reconcileSkillRegistry,
} from '../../scripts/helpers/skills-registry.ts';

// Common-seed-shaped registry (what templates/common/skills/SKILLS.md delivers
// once the variant overlay skip is in place): anchored rows for skills a
// scaffold may or may not deliver, including k-* and workspace-root-only names.
const SEED_REGISTRY = `# Skills Index

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`accessibility-audit\` | 1.1.0 | active | pm | 2026-09-06 | — | promoted skill |
| \`sync\` | 2.0.0 | active | pm | 2026-09-01 | — | workspace-root-only seed |
| \`k-dart\` | 1.0.0 | active | data-analyst | 2026-09-11 | — | region-scoped |
| \`k-krx\` | 1.0.2 | active | financial-analyst | 2026-09-11 | — | region-scoped |
`;

const KEEP_DELIVERED = new Set(['accessibility-audit']);

// co-abap's overlay shape: a `Skill | Directory | Purpose` table the
// shape-based parser cannot read — zero parseable rows, no anchor.
const ANCHOR_LESS_REGISTRY = `# Skills Index — co-abap

This variant ships the following skills:

| Skill | Directory | Purpose |
|-------|-----------|---------|
| contract-a | skills/contract-a | contract safety |
| process-b | skills/process-b | process work |
`;

describe('pruneSkillRegistryRows', () => {
  test('drops rows for undelivered skills and keeps kept rows intact', () => {
    const { content, pruned } = pruneSkillRegistryRows(SEED_REGISTRY, KEEP_DELIVERED);
    expect(pruned.sort()).toEqual(['k-dart', 'k-krx', 'sync']);
    expect(content).toContain('| `accessibility-audit` | 1.1.0 | active | pm | 2026-09-06 | — | promoted skill |');
    expect(content).not.toContain('`k-dart`');
    expect(content).not.toContain('`k-krx`');
    expect(content).not.toContain('`sync`');
    // header + separator + kept row survive
    expect(content).toContain('| skill | version | status | owner | last_reviewed | removal-date | notes |');
  });

  test('handles category-sectioned tables (co-consult style)', () => {
    const sectioned = `## Process

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`keep-a\` | 1.0.0 | active | pm | 2026-09-01 | — | a |
| \`drop-b\` | 1.0.0 | active | pm | 2026-09-01 | — | b |

## Domain

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`drop-c\` | 2.0.0 | active | pm | 2026-09-02 | — | c |
`;
    const { content, pruned } = pruneSkillRegistryRows(sectioned, new Set(['keep-a']));
    expect(pruned.sort()).toEqual(['drop-b', 'drop-c']);
    expect(content).toContain('`keep-a`');
    expect(content).not.toContain('`drop-b`');
    expect(content).not.toContain('`drop-c`');
    // non-table prose and headings untouched
    expect(content).toContain('## Domain');
  });

  test('removes EVERY duplicate listing of a pruned skill', () => {
    const dupes = `${SEED_REGISTRY}| \`sync\` | 1.0.0 | active | pm | 2026-08-01 | — | duplicate listing |
`;
    const { content, pruned } = pruneSkillRegistryRows(dupes, KEEP_DELIVERED);
    expect(pruned.sort()).toEqual(['k-dart', 'k-krx', 'sync', 'sync']);
    expect(content.match(/`sync`/g)).toBeNull();
  });

  test('anchor-less input (co-abap shape) is a no-op, not a crash', () => {
    const { content, pruned } = pruneSkillRegistryRows(ANCHOR_LESS_REGISTRY, KEEP_DELIVERED);
    expect(pruned).toEqual([]);
    expect(content).toBe(ANCHOR_LESS_REGISTRY);
  });

  test('empty table (header only) is a no-op', () => {
    const empty = `## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
`;
    const { content, pruned } = pruneSkillRegistryRows(empty, new Set<string>());
    expect(pruned).toEqual([]);
    expect(content).toBe(empty);
  });

  test('keep-set is dir-based: a version-less delivered SKILL.md keeps its seed row', () => {
    const { content, pruned } = pruneSkillRegistryRows(SEED_REGISTRY, new Set(['accessibility-audit', 'sync']));
    expect(pruned.sort()).toEqual(['k-dart', 'k-krx']);
    expect(content).toContain('`sync`'); // kept even though not reconcile-collectable
  });
});

describe('collectDeliveredSkills', () => {
  let skillsDir: string;

  beforeAll(() => {
    skillsDir = mkdtempSync(join(tmpdir(), 'skills-registry-collect-'));
    mkdirSync(join(skillsDir, 'has-version'));
    writeFileSync(
      join(skillsDir, 'has-version', 'SKILL.md'),
      `---
name: has-version
version: 1.2.3
last_reviewed: 2026-09-20
status: active
owner: pm
---

Body.
`,
    );
    // version-less: the upgrade path's `if (!fm.version) continue` skip
    mkdirSync(join(skillsDir, 'no-version'));
    writeFileSync(join(skillsDir, 'no-version', 'SKILL.md'), '---\nname: no-version\n---\nBody.\n');
    // dir without SKILL.md
    mkdirSync(join(skillsDir, 'no-skill-md'));
    // plain file (SKILLS.md itself) — must not be treated as a skill
    writeFileSync(join(skillsDir, 'SKILLS.md'), '# index\n');
  });

  afterAll(() => {
    rmSync(skillsDir, { recursive: true, force: true });
  });

  test('extracts version/status/owner/last_reviewed from frontmatter', () => {
    const delivered = collectDeliveredSkills(skillsDir);
    expect(delivered).toHaveLength(1);
    expect(delivered[0]).toEqual({
      skill: 'has-version',
      version: '1.2.3',
      status: 'active',
      owner: 'pm',
      lastReviewed: '2026-09-20',
    });
  });

  test('skips version-less skills, SKILL.md-less dirs, and plain files', () => {
    const names = collectDeliveredSkills(skillsDir).map((d) => d.skill);
    expect(names).not.toContain('no-version');
    expect(names).not.toContain('no-skill-md');
    expect(names).not.toContain('SKILLS.md');
  });

  test('returns an empty array for a missing skills directory', () => {
    expect(collectDeliveredSkills(join(tmpdir(), 'definitely-not-there-008'))).toEqual([]);
  });
});

describe('extractFrontmatterVersionAndReviewed (verbatim move from upgrade-project)', () => {
  test('parses version, last_reviewed, status, owner', () => {
    const p = join(tmpdir(), 'fm-full-008.md');
    writeFileSync(p, '---\nname: x\nversion: "2.3.4"\nlast_reviewed: "2026-09-24"\nstatus: active\nowner: pm\n---\n');
    expect(extractFrontmatterVersionAndReviewed(p)).toEqual({
      version: '2.3.4',
      last_reviewed: '2026-09-24',
      status: 'active',
      owner: 'pm',
    });
  });

  test('missing file returns empty version/last_reviewed (upgrade semantics)', () => {
    expect(extractFrontmatterVersionAndReviewed(join(tmpdir(), 'fm-missing-008.md'))).toEqual({
      version: '',
      last_reviewed: '',
    });
  });

  test('quoted values are unwrapped; optional fields are undefined when absent', () => {
    const p = join(tmpdir(), 'fm-partial-008.md');
    writeFileSync(p, '---\nversion: 1.0.0\n---\n');
    expect(extractFrontmatterVersionAndReviewed(p)).toEqual({
      version: '1.0.0',
      last_reviewed: '',
      status: undefined,
      owner: undefined,
    });
  });
});

describe('new-project §6.4 pipeline: seed → fold → prune → reconcile → align', () => {
  // Mirrors the real seed's section structure: the audit's parser
  // (skill-lifecycle-audit.ts) reads ONLY the `### Workspace Skills` section —
  // rows under `### Variant-Exclusive Skills` are invisible to it.
  const SECTIONED_SEED = `# SKILLS.md — Skill Lifecycle Registry

## Registry

### Workspace Skills

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`accessibility-audit\` | 1.1.0 | active | pm | 2026-09-06 | — | promoted skill |
| \`sync\` | 2.0.0 | active | pm | 2026-09-01 | — | workspace-root-only seed |

### Variant-Exclusive Skills

Skills registered in the catalog but without a \`skills/<name>/\` directory in the workspace root.

| skill | version | status | owner | last_reviewed | removal-date | variant |
|-------|---------|--------|-------|---------------|--------------|---------|
| \`service-design\` | 1.1.0 | active | pm | 2026-07-19 | — | co-design only |
| \`stakeholder-alignment\` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |
`;

  const DELIVERED = [
    { skill: 'accessibility-audit', version: '1.1.0', status: 'active', owner: 'pm', lastReviewed: '2026-09-06' },
    { skill: 'service-design', version: '1.1.0', status: 'active', owner: 'pm', lastReviewed: '2026-07-19' },
    // owner drifts from the seed row (pm) — the align pass must rewrite it
    { skill: 'stakeholder-alignment', version: '1.0.0', status: 'active', owner: 'change-management-partner', lastReviewed: '2026-06-06' },
  ];

  function runSectionedPipeline(seed: string) {
    const keep = new Set(['accessibility-audit', 'service-design', 'stakeholder-alignment']);
    const folded = foldVariantExclusiveRowsIntoWorkspaceSection(seed);
    const { content: prunedContent, pruned } = pruneSkillRegistryRows(folded.content, keep);
    const { content: reconciledContent, updated, added } = reconcileSkillRegistry(prunedContent, DELIVERED);
    const { content: finalContent, aligned } = alignSkillRegistryRowsWithFrontmatter(reconciledContent, DELIVERED);
    return { content: finalContent, moved: folded.moved, pruned, updated, added, aligned };
  }

  it('folds variant-exclusive rows into the Workspace section, dropping the section shell', () => {
    const { content, moved } = foldVariantExclusiveRowsIntoWorkspaceSection(SECTIONED_SEED);
    expect(moved).toBe(2);
    // rows keep every cell verbatim (variant annotation lands in notes)
    expect(content).toContain('| `service-design` | 1.1.0 | active | pm | 2026-07-19 | — | co-design only |');
    expect(content).toContain('| `stakeholder-alignment` | 1.0.0 | active | pm | 2026-06-06 | — | co-consult only |');
    // the section shell (heading, prose, VE table header) is gone
    expect(content).not.toMatch(/Variant-Exclusive Skills/i);
    expect(content).not.toContain('| skill | version | status | owner | last_reviewed | removal-date | variant |');
    // workspace rows and heading untouched
    expect(content).toContain('### Workspace Skills');
    expect(content).toContain('| `accessibility-audit` | 1.1.0 |');
  });

  it('fold is a byte-identical no-op without the heading (idempotency)', () => {
    const { content, moved } = foldVariantExclusiveRowsIntoWorkspaceSection(SEED_REGISTRY);
    expect(moved).toBe(0);
    expect(content).toBe(SEED_REGISTRY);
  });

  it('delivered rows are audit-visible: every row sits in the Workspace section', () => {
    const { content } = runSectionedPipeline(SECTIONED_SEED);
    const wsIdx = content.indexOf('### Workspace Skills');
    for (const line of content.split('\n')) {
      if (line.includes('| `service-design`') || line.includes('| `stakeholder-alignment`')) {
        expect(content.indexOf(line)).toBeGreaterThan(wsIdx);
      }
    }
    expect(content).not.toContain('`sync`'); // pruned: not delivered
    expect(parseSkillRegistryRows(content).rows.size).toBe(3);
  });

  it('align pass rewrites drifted status/owner from delivered frontmatter', () => {
    const { content, aligned } = runSectionedPipeline(SECTIONED_SEED);
    expect(aligned).toEqual(['stakeholder-alignment']);
    expect(content).toContain(
      '| `stakeholder-alignment` | 1.0.0 | active | change-management-partner | 2026-06-06 | — | co-consult only |',
    );
  });

  it('whole pipeline is idempotent: second run is byte-identical with zero actions', () => {
    const first = runSectionedPipeline(SECTIONED_SEED);
    const second = runSectionedPipeline(first.content);
    expect(second.content).toBe(first.content);
    expect(second.moved).toBe(0);
    expect(second.pruned).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.added).toEqual([]);
    expect(second.aligned).toEqual([]);
  });
});

describe('pre-fold pipeline (prune + reconcile on an unsectioned seed)', () => {
  // The delivered SKILL.md frontmatter for the shadow case: the seed row
  // (2026-09-06) already matches; the variant overlay's stale 2026-09-12 must
  // never enter delivery (overlay skip) — and if a seed row DID drift, the
  // reconcile rewrites it from this frontmatter.
  const deliveredFrontmatter = [
    { skill: 'accessibility-audit', version: '1.2.0', status: 'active', owner: 'pm', lastReviewed: '2026-09-20' },
    { skill: 'service-design', version: '1.1.0', status: 'active', owner: 'pm', lastReviewed: '2026-07-19' },
  ];

  function runPipeline(seed: string, keep: Set<string>) {
    const { content: prunedContent, pruned } = pruneSkillRegistryRows(seed, keep);
    const { content: reconciled, updated, added } = reconcileSkillRegistry(prunedContent, deliveredFrontmatter);
    return { content: reconciled, pruned, updated, added };
  }

  test('delivered row set equals the delivered tree; frontmatter wins; missing row appended', () => {
    const keep = new Set(['accessibility-audit', 'service-design']);
    const { content, pruned, updated, added } = runPipeline(SEED_REGISTRY, keep);

    expect(pruned.sort()).toEqual(['k-dart', 'k-krx', 'sync']);
    expect(updated).toEqual(['accessibility-audit']); // seed 1.1.0/2026-09-06 → frontmatter 1.2.0/2026-09-20
    expect(added).toEqual(['service-design']); // variant-exclusive append

    const { rows } = parseSkillRegistryRows(content);
    expect([...rows.keys()].sort()).toEqual(['accessibility-audit', 'service-design']);
    expect(rows.get('accessibility-audit')?.version).toBe('1.2.0');
    expect(rows.get('accessibility-audit')?.lastReviewed).toBe('2026-09-20');
    expect(rows.get('service-design')?.version).toBe('1.1.0');
    expect(rows.get('service-design')?.lastReviewed).toBe('2026-07-19');
    expect(rows.get('service-design')?.status).toBe('active');
  });

  test('idempotent: a second pipeline run is byte-identical with no actions', () => {
    const keep = new Set(['accessibility-audit', 'service-design']);
    const first = runPipeline(SEED_REGISTRY, keep);
    const second = runPipeline(first.content, keep);
    expect(second.content).toBe(first.content);
    expect(second.pruned).toEqual([]);
    expect(second.updated).toEqual([]);
    expect(second.added).toEqual([]);
  });

  test('anchor-less variant overlay never reaches delivery: the seed supplies the anchor (D1c)', () => {
    // Design D1(c): the variant SKILLS.md is SKIPPED in the overlay walk, so
    // even a co-abap-shaped (anchor-less) variant delivers the anchored common
    // seed. The helper-level truth this pins: reconcile against an anchor-less
    // file appends NOTHING (lastSkillRowIdx guard) — correctness comes from the
    // seed, not from reconciling a clobbered file.
    const noAnchor = runPipeline(ANCHOR_LESS_REGISTRY, new Set(['contract-a']));
    expect(noAnchor.pruned).toEqual([]);
    expect(noAnchor.added).toEqual([]);
    expect(noAnchor.content).toBe(ANCHOR_LESS_REGISTRY);
    // …and with the real anchored seed the same variant reconciles cleanly:
    const seeded = runPipeline(SEED_REGISTRY, new Set(['accessibility-audit', 'service-design']));
    const { rows } = parseSkillRegistryRows(seeded.content);
    expect(rows.size).toBe(2);
  });
});
