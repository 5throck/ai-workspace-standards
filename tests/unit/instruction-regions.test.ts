/**
 * Unit tests for the instruction-file region taxonomy + census (design
 * docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 * D1/D2): scanInstructionRegions classifies I1 managed zones +
 * skeleton-registry sections, I2 VARIANT-* project-state marker sections, and
 * I3 free-form template-echo spans; censusInstructionRegions diffs the
 * out-of-zone content and emits the D2 verdict matrix (EVOLVED_REGION for
 * project-authored blocks, TEMPLATE_AHEAD_REGION for template-absent blocks,
 * ZERO rows for an in-sync file, REGION_IN_SYNC summary row only alongside
 * divergence); spanCarriesProjectAuthoredLines is the write-channel
 * predicate; the census gates on mergeManagedBlocks and mergeSkeletonSections
 * block an adapted-span replace without an explicit --disposition grant and
 * proceed (snapshot + adaptedReplaces) under one.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  INSTRUCTION_FILE_RELS,
  scanInstructionRegions,
  censusInstructionRegions,
  spanCarriesProjectAuthoredLines,
} from '../../scripts/lib/upgrade-policy.ts';
import {
  mergeManagedBlocks,
  type ManagedBlockMergeResult,
} from '../../scripts/lib/managed-block-merge.ts';
import {
  mergeSkeletonSections,
  MANAGED_SKELETON_SECTIONS,
  type SkeletonSectionEntry,
} from '../../scripts/lib/platform-skeleton-merge.ts';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const AGENTS_LIKE = [
  '# Title',
  '',
  '<!-- COMMON-AGENTS:START -->',
  'zone body line',
  '<!-- COMMON-AGENTS:END -->',
  '',
  '## §1 Heading',
  '',
  'template echo line',
  'project adaptation row',
  '',
  '<!-- VARIANT-AGENTS-START -->',
  '| agent | tier |',
  '<!-- VARIANT-AGENTS-END -->',
  '',
  '## §4 Mapping',
  '',
  '| task | agent |',
].join('\n') + '\n';

describe('INSTRUCTION_FILE_RELS (D1 surface)', () => {
  test('is exactly the five instruction files', () => {
    expect([...INSTRUCTION_FILE_RELS].sort()).toEqual(
      ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md', 'HERMES.md'],
    );
  });
});

describe('scanInstructionRegions (D1 taxonomy)', () => {
  test('classifies I1 managed zones, I2 VARIANT-* sections, and I3 free-form spans', () => {
    const regions = scanInstructionRegions(AGENTS_LIKE, 'AGENTS.md');
    const kinds = regions.map((r) => r.kind);
    expect(kinds).toContain('I1');
    expect(kinds).toContain('I2');
    expect(kinds).toContain('I3');
    const zone = regions.find((r) => r.kind === 'I1' && r.name === 'COMMON-AGENTS')!;
    expect(AGENTS_LIKE.split('\n')[zone.start]).toContain('COMMON-AGENTS:START');
    const marker = regions.find((r) => r.kind === 'I2')!;
    expect(marker.name).toBe('VARIANT-AGENTS');
    expect(AGENTS_LIKE.split('\n')[marker.start]).toContain('VARIANT-AGENTS-START');
    // The project adaptation line lives in an I3 span, NOT in I1/I2.
    const allI3Lines = regions.filter((r) => r.kind === 'I3')
      .flatMap((r) => AGENTS_LIKE.split('\n').slice(r.start, r.end));
    expect(allI3Lines).toContain('project adaptation row');
  });

  test('I2 sections are the scaffold VARIANT markers, distinct from MANAGED_PATTERNS', () => {
    // The marker pair syntax (`<!-- NAME-START -->`) is NOT a managed pattern —
    // the COMMON-AGENTS zone around it proves zones claim their own lines.
    const regions = scanInstructionRegions(AGENTS_LIKE, 'AGENTS.md');
    const claimed = regions.filter((r) => r.kind !== 'I3');
    for (const r of claimed) {
      for (const other of claimed) {
        if (r === other) continue;
        const overlaps = r.start < other.end && other.start < r.end;
        expect(overlaps).toBe(false);
      }
    }
  });

  test('a skeleton-registry heading in CLAUDE.md classifies I1 (D3 widening makes registry sections first-class regions)', () => {
    const claudeLike = [
      '# CLAUDE.md',
      '',
      'free prose between sections',
      '### 2.5 Native Slash Commands',
      'registry section body',
    ].join('\n');
    const regions = scanInstructionRegions(claudeLike, 'CLAUDE.md');
    const section = regions.find((r) => r.name === 'claude-s2');
    expect(section).toBeDefined();
    expect(section!.kind).toBe('I1');
    // The registry section's lines are claimed — the surrounding prose is I3.
    expect(claudeLike.split('\n').slice(section!.start, section!.end)).toContain('registry section body');
    const i3 = regions.filter((r) => r.kind === 'I3').flatMap((r) => claudeLike.split('\n').slice(r.start, r.end));
    expect(i3).toContain('free prose between sections');
  });
});

describe('censusInstructionRegions (D2 verdict matrix)', () => {
  test('project-authored block → EVOLVED_REGION (WARN)', () => {
    const tpl = '# T\n\ntemplate line\n';
    const proj = '# T\n\ntemplate line\nproject adaptation row\n';
    const c = censusInstructionRegions('AGENTS.md', proj, tpl);
    expect(c.divergent).toBe(true);
    expect(c.rows.filter((r) => r.verdict === 'EVOLVED_REGION')).toHaveLength(1);
    expect(c.rows.find((r) => r.verdict === 'EVOLVED_REGION')!.severity).toBe('WARN');
    expect(c.rows.find((r) => r.verdict === 'EVOLVED_REGION')!.detail).toContain('port candidate');
    expect(c.rows.find((r) => r.verdict === 'EVOLVED_REGION')!.detail).toContain('adjudicated-port procedure');
  });

  test('template block absent from the project → TEMPLATE_AHEAD_REGION (WARN; Q1 — never silently reverted)', () => {
    const tpl = '# T\n\ntemplate line\ntemplate line two\n';
    const proj = '# T\n\ntemplate line\n';
    const c = censusInstructionRegions('AGENTS.md', proj, tpl);
    const row = c.rows.find((r) => r.verdict === 'TEMPLATE_AHEAD_REGION')!;
    expect(row).toBeDefined();
    expect(row.severity).toBe('WARN');
    expect(row.detail).toContain('never silently reverted');
    expect(row.detail).toContain('deliberate project deletion');
  });

  test('an in-sync file produces ZERO census rows (§6 dry-run-parity guarantee)', () => {
    const same = '# T\n\n<!-- COMMON-AGENTS:START -->\nz\n<!-- COMMON-AGENTS:END -->\n\nprose\n';
    expect(censusInstructionRegions('AGENTS.md', same, same).rows).toEqual([]);
    expect(censusInstructionRegions('AGENTS.md', same, same).divergent).toBe(false);
  });

  test('a divergent file carries the REGION_IN_SYNC summary row naming the in-sync share', () => {
    const tpl = '# T\n\nkeep one\nkeep two\ndropped by project\n';
    const proj = '# T\n\nkeep one\nkeep two\nproject added\n';
    const c = censusInstructionRegions('AGENTS.md', proj, tpl);
    expect(c.rows[0]!.verdict).toBe('REGION_IN_SYNC');
    expect(c.rows[0]!.severity).toBe('INFO');
    expect(c.rows[0]!.detail).toContain('3 of 4');
  });

  test('I2 VARIANT-* content is census-only — project-side roster rows never diff', () => {
    const tpl = '# T\n\n<!-- VARIANT-AGENTS-START -->\n<!-- VARIANT-AGENTS-END -->\n\nshared prose\n';
    const proj = '# T\n\n<!-- VARIANT-AGENTS-START -->\n| co-design agent | high |\n| another | med |\n<!-- VARIANT-AGENTS-END -->\n\nshared prose\n';
    const c = censusInstructionRegions('AGENTS.md', proj, tpl);
    expect(c.divergent).toBe(false);
    expect(c.rows).toEqual([]);
  });
});

describe('spanCarriesProjectAuthoredLines (write-channel predicate)', () => {
  const tpl = '# T\n\nzone prose alpha\nzone prose beta\n';
  test('a span with a line the template never contained is adapted', () => {
    expect(spanCarriesProjectAuthoredLines('zone prose alpha\nproject-authored table row', tpl)).toBe(true);
  });
  test('a span of pure template vocabulary (stale older wording, zone interiors, blanks) is not adapted', () => {
    expect(spanCarriesProjectAuthoredLines('zone prose beta\n\nzone prose alpha', tpl)).toBe(false);
    expect(spanCarriesProjectAuthoredLines('', tpl)).toBe(false);
    // Zone interiors are stripped before the check: a marker line absent from
    // this small fixture's template still never counts as adaptation.
    expect(spanCarriesProjectAuthoredLines('<!-- COMMON-CONTEXT:START -->\n<!-- COMMON-CONTEXT:END -->', tpl)).toBe(false);
  });
});

describe('mergeManagedBlocks census gate (D2 §4.2 — unlabeled reconcile channel)', () => {
  const template = '<!-- COMMON-CONTEXT:START -->\ntemplate block\n<!-- COMMON-CONTEXT:END -->\n';
  const projectAdapted = [
    '<!-- COMMON-CONTEXT:START -->',
    'project block one',
    '<!-- COMMON-CONTEXT:END -->',
    'project-authored prose between blocks',
    '<!-- COMMON-CONTEXT:START -->',
    'project block two',
    '<!-- COMMON-CONTEXT:END -->',
  ].join('\n');
  const gate = (overrides: Partial<{ divergent: boolean; adapted: boolean; granted: boolean }> = {}) => ({
    divergent: overrides.divergent ?? true,
    isSpanAdapted: () => overrides.adapted ?? true,
    dispositionGranted: overrides.granted ?? false,
  });

  test('count mismatch over an adapted span, no grant → BLOCKED (escalated, no replace, no snapshot)', () => {
    const r: ManagedBlockMergeResult = mergeManagedBlocks(projectAdapted, template, null, 'AGENTS.md', false, gate());
    expect(r.escalated).toHaveLength(1);
    expect(r.escalated[0]!.content).toContain('project-authored prose between blocks');
    expect(r.snapshots).toEqual([]);
    expect(r.adaptedReplaces).toBe(0);
    expect(r.content).toBe(projectAdapted); // span untouched
    expect(r.log.some((l) => l.includes('RECONCILE BLOCKED'))).toBe(true);
    expect(r.log.some((l) => l.includes('adjudicated-port procedure'))).toBe(true);
  });

  test('count mismatch over an adapted span WITH --disposition grant → proceeds (snapshot + adaptedReplaces)', () => {
    const r = mergeManagedBlocks(projectAdapted, template, null, 'AGENTS.md', false, gate({ granted: true }));
    expect(r.escalated).toEqual([]);
    expect(r.adaptedReplaces).toBe(1);
    expect(r.snapshots).toHaveLength(1);
    expect(r.snapshots[0]!.content).toContain('project-authored prose between blocks');
    expect(r.content).not.toBe(projectAdapted);
    expect(r.log.some((l) => l.includes('--disposition adopt-template'))).toBe(true);
  });

  test('the gate is closed for an in-sync file (divergent=false) — reconcile proceeds as today', () => {
    const r = mergeManagedBlocks(projectAdapted, template, null, 'AGENTS.md', false, gate({ divergent: false }));
    expect(r.escalated).toEqual([]);
    expect(r.content).not.toBe(projectAdapted);
    expect(r.log.some((l) => l.includes('RECONCILED'))).toBe(true);
  });

  test('a clean span (no project-authored lines) in a divergent file is never gated', () => {
    const cleanProject = [
      '<!-- COMMON-CONTEXT:START -->',
      'project block one',
      '<!-- COMMON-CONTEXT:END -->',
      'template-echo prose line', // a line the template side knows
      '<!-- COMMON-CONTEXT:START -->',
      'project block two',
      '<!-- COMMON-CONTEXT:END -->',
    ].join('\n');
    const templateWithEcho = `${template}
template-echo prose line
`;
    // The REAL predicate (not the stub): zone interiors are stripped, and the
    // only out-of-zone span line is template vocabulary → not adapted.
    const r = mergeManagedBlocks(cleanProject, templateWithEcho, null, 'AGENTS.md', false, {
      divergent: true,
      isSpanAdapted: (s) => spanCarriesProjectAuthoredLines(s, templateWithEcho),
      dispositionGranted: false,
    });
    expect(r.escalated).toEqual([]);
    expect(r.log.some((l) => l.includes('RECONCILED'))).toBe(true);
  });
});

describe('mergeSkeletonSections D3 widening + census gate (skeleton replace channel)', () => {
  const entry: SkeletonSectionEntry = {
    id: 'agents-s1',
    rel: 'AGENTS.md',
    heading: '## Ported Instruction Section',
    anchor: { kind: 'beforeZoneContaining', heading: '## Anchor Heading' },
  };
  const template = [
    '# AGENTS.md',
    '',
    '## Ported Instruction Section',
    'template section body line',
    '',
    '<!-- COMMON-AGENTS:START -->',
    '## Anchor Heading',
    '<!-- COMMON-AGENTS:END -->',
  ].join('\n');

  test('the rel union admits AGENTS.md — a missing registered section INSERTS (D3 acceptance)', () => {
    const project = ['# AGENTS.md', '', '<!-- COMMON-AGENTS:START -->', '## Anchor Heading', '<!-- COMMON-AGENTS:END -->'].join('\n');
    const r = mergeSkeletonSections(project, template, 'AGENTS.md', false, [entry]);
    expect(r.merged).toBe(true);
    expect(r.log.some((l) => l.includes('SKELETON INSERTED agents-s1'))).toBe(true);
    expect(r.content).toContain('template section body line');
    expect(r.escalated).toEqual([]);
  });

  test('a drifted section span carrying project-authored content is BLOCKED without a grant (D2)', () => {
    const project = [
      '# AGENTS.md',
      '',
      '## Ported Instruction Section',
      'project rewrote this body entirely',
      '',
      '<!-- COMMON-AGENTS:START -->',
      '## Anchor Heading',
      '<!-- COMMON-AGENTS:END -->',
    ].join('\n');
    const gate = { divergent: true, isSpanAdapted: () => true, dispositionGranted: false };
    const r = mergeSkeletonSections(project, template, 'AGENTS.md', false, [entry], gate);
    expect(r.escalated).toHaveLength(1);
    expect(r.escalated[0]!.content).toContain('project rewrote this body entirely');
    expect(r.content).toBe(project);
    expect(r.snapshots).toEqual([]);
    expect(r.log.some((l) => l.includes('SKELETON REPLACE BLOCKED'))).toBe(true);
  });

  test('the same adapted span under a grant proceeds with its snapshot (ADOPT path)', () => {
    const project = [
      '# AGENTS.md',
      '',
      '## Ported Instruction Section',
      'project rewrote this body entirely',
      '',
      '<!-- COMMON-AGENTS:START -->',
      '## Anchor Heading',
      '<!-- COMMON-AGENTS:END -->',
    ].join('\n');
    const gate = { divergent: true, isSpanAdapted: () => true, dispositionGranted: true };
    const r = mergeSkeletonSections(project, template, 'AGENTS.md', false, [entry], gate);
    expect(r.escalated).toEqual([]);
    expect(r.adaptedReplaces).toBe(1);
    expect(r.snapshots).toHaveLength(1);
    expect(r.content).toContain('template section body line');
  });

  test('guards G1/G2 run BEFORE the census — a project-local heading still skips first (guards unchanged)', () => {
    const project = [
      '# AGENTS.md',
      '',
      '## Ported Instruction Section',
      'template section body line',
      '<!-- LOCAL-PATCH(co-design: note) --> project-local comment',
      '',
      '<!-- COMMON-AGENTS:START -->',
      '## Anchor Heading',
      '<!-- COMMON-AGENTS:END -->',
    ].join('\n');
    const gate = { divergent: true, isSpanAdapted: () => true, dispositionGranted: false };
    const r = mergeSkeletonSections(project, template, 'AGENTS.md', false, [entry], gate);
    expect(r.log.some((l) => l.includes('SKELETON REPLACE SKIPPED (project-local content)'))).toBe(true);
    expect(r.escalated).toEqual([]);
    expect(r.content).toBe(project);
  });

  test('the production registry still carries zero AGENTS.md entries — widening is protective-by-default (D3, never big-bang)', () => {
    expect(MANAGED_SKELETON_SECTIONS.filter((e) => e.rel === 'AGENTS.md')).toEqual([]);
    expect(MANAGED_SKELETON_SECTIONS.filter((e) => e.rel === 'CODEX.md')).toEqual([]);
    expect(MANAGED_SKELETON_SECTIONS.filter((e) => e.rel === 'HERMES.md')).toEqual([]);
    // ...and a no-entries merge on a widened rel is a silent no-op.
    const r = mergeSkeletonSections('# AGENTS.md\n', '# AGENTS.md\n', 'AGENTS.md', false);
    expect(r.merged).toBe(false);
  });
});
