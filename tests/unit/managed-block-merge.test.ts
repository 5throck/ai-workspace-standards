/**
 * Tests for scripts/lib/managed-block-merge.ts (T-20260916-012): the pure
 * managed-block merge core extracted from upgrade-project.ts
 * mergeWorkspaceManaged(), plus the fix for the two compounding defects that
 * destroyed keyed WORKSPACE-MANAGED blocks during the 2026-09-16 co-develop
 * upgrade (the project .gitignore lost its secrets-patterns block — caught by
 * the upgrade's own security gate — and AGENTS.md lost its 43-line graft
 * block):
 *
 *   Defect 1: the project-side occurrence list counted ALL pattern matches
 *   (keyed blocks included) against a template count of UNLABELED blocks
 *   only, so keyed-only project files hit the count-mismatch reconcile and
 *   were sliced first-to-last with an EMPTY replacement.
 *   Defect 2: reconcile/positional offsets were captured BEFORE the keyed
 *   replacements mutated the content (stale offsets).
 *
 * Pins:
 * 1. Keyed merge by key; keyed insert when the project lacks the key.
 * 2. THE BUG: keyed-only project + keyed-only template → keyed content
 *    survives, no WARNING/RECONCILED.
 * 3. Fresh offsets: a length-changing keyed merge must not shift the
 *    unlabeled reconcile/positional spans (PROSE-MID/PROSE-TAIL sentinels).
 * 4. Unlabeled append / count-mismatch reconcile (unlabeled-only span) /
 *    equal-count positional replacement.
 * 5. COMMON-AGENTS zone parity: START/END pair preserved, byte-identical
 *    behavior for the always-unlabeled COMMON classes.
 * 6. Per-key union variant ∪ common.
 * 7. dryRun purity: content unchanged, logs still emitted.
 *
 * Scratch content strings only — no fs, no real templates/.
 *
 * v1.1.0 (2026-09-25, T-20260924-010 — spec
 *         2026-09-25-codex-merge-claim-routing-design.md D4 row 1): COMMON-CODEX
 *         zone parity block — merge/appended/reconciled cases mirroring the
 *         COMMON-CLAUDE/GEMINI coverage. Written BEFORE the MANAGED_PATTERNS
 *         entry landed (house AC5a: the three tests failed pre-fix with
 *         "INFO: Template has no managed markers — skipping CODEX.md").
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import {
  mergeManagedBlocks,
  findManagedBlocks,
  buildMergedTemplateBlocks,
  MANAGED_PATTERNS,
} from '../../scripts/lib/managed-block-merge.ts';

const REL = '.gitignore';

function keyed(key: string, inner: string): string {
  return `<!-- WORKSPACE-MANAGED: ${key} -->\n${inner}\n<!-- /WORKSPACE-MANAGED -->`;
}

function unlabeled(inner: string): string {
  return `<!-- WORKSPACE-MANAGED -->\n${inner}\n<!-- /WORKSPACE-MANAGED -->`;
}

describe('MANAGED_PATTERNS / findManagedBlocks', () => {
  test('extracts keyed and unlabeled blocks with keys', () => {
    const content = `HEAD\n\n${keyed('graft repo context graph', 'graft lines')}\n\n${unlabeled('stale')}\n`;
    const found = findManagedBlocks(content);
    expect(found).toHaveLength(1);
    expect(found[0]!.pattern.label).toBe('WORKSPACE-MANAGED');
    expect(found[0]!.blocks.map((b) => b.key)).toEqual(['graft repo context graph', '']);
  });

  test('COMMON-* zone blocks are always unlabeled (key \'\')', () => {
    const content = '<!-- COMMON-AGENTS:START -->\nzone\n<!-- COMMON-AGENTS:END -->\n';
    const found = findManagedBlocks(content);
    expect(found[0]!.pattern.label).toBe('COMMON-AGENTS');
    expect(found[0]!.blocks.every((b) => b.key === '')).toBe(true);
  });

  test('union of template ∪ common keeps variant blocks and adds common-only keys', () => {
    const tpl = keyed('variant only', 'v') + '\n';
    const common = keyed('common only', 'c') + '\n';
    const merged = buildMergedTemplateBlocks(tpl, common);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.blocks.map((b) => b.key)).toEqual(['variant only', 'common only']);
  });

  test('union dedupes shared keys (variant wins)', () => {
    const tpl = keyed('shared', 'variant version') + '\n';
    const common = keyed('shared', 'common version') + '\n';
    const merged = buildMergedTemplateBlocks(tpl, common);
    expect(merged[0]!.blocks).toHaveLength(1);
    expect(merged[0]!.blocks[0]!.matched).toContain('variant version');
  });

  test('empty template and common → no managed blocks (INFO skip shape)', () => {
    expect(buildMergedTemplateBlocks('no markers', null)).toHaveLength(0);
  });
});

describe('keyed blocks (WORKSPACE-MANAGED / VARIANT-INJECT)', () => {
  test('(a) merges by key: project block replaced by template content', () => {
    const proj = `HEAD\n\n${keyed('k1', 'old-content')}\n\nTAIL\n`;
    const tpl = keyed('k1', 'new-content') + '\n';
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.merged).toBe(true);
    expect(r.content).toContain('new-content');
    expect(r.content).not.toContain('old-content');
    expect(r.content).toContain('HEAD');
    expect(r.content).toContain('TAIL');
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:k1 in: ${REL}`);
    expect(r.log.join('\n')).not.toContain('RECONCILED');
    expect(r.log.join('\n')).not.toContain('WARNING');
  });

  test('(h) project with zero managed blocks + template keyed block → INSERTED', () => {
    const proj = 'just prose\n';
    const tpl = keyed('fresh key', 'fresh content') + '\n';
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.content).toContain('fresh content');
    expect(r.log).toContain(`    INSERTED WORKSPACE-MANAGED:fresh key in: ${REL}`);
  });

  test('(b) THE BUG: keyed-only project + keyed-only template keeps the keyed block', () => {
    // Pre-fix behavior: projOccurrences counted the keyed block, template had
    // 0 unlabeled → count mismatch → RECONCILED with an empty join deleted
    // the whole block (real co-develop .gitignore/AGENTS.md corruption).
    const proj = `HEAD\n\n${keyed('Git ignore patterns. Content outside this block is preserved during project upgrades.', '.env\n*.pem')}\n\nTAIL\n`;
    const tpl = keyed('Git ignore patterns. Content outside this block is preserved during project upgrades.', '.env\n*.pem\nnode_modules/') + '\n';
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.content).toContain('.env');
    expect(r.content).toContain('*.pem');
    expect(r.content).toContain('node_modules/');
    expect(r.content).toContain('HEAD');
    expect(r.content).toContain('TAIL');
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:Git ignore patterns. Content outside this block is preserved during project upgrades. in: ${REL}`);
    expect(r.log.join('\n')).not.toContain('RECONCILED');
    expect(r.log.join('\n')).not.toContain('count mismatch');
  });

  test('keyed VARIANT-INJECT block merges by key too', () => {
    const proj = `<!-- VARIANT-INJECT: section a -->\nold\n<!-- END VARIANT-INJECT -->\n`;
    const tpl = '<!-- VARIANT-INJECT: section a -->\nnew\n<!-- END VARIANT-INJECT -->\n';
    const r = mergeManagedBlocks(proj, tpl, null, 'AGENTS.md', false);
    expect(r.content).toContain('new');
    expect(r.content).not.toContain('old');
    expect(r.log).toContain('    MERGED VARIANT-INJECT:section a in: AGENTS.md');
  });
});

describe('unlabeled blocks (T-20260916-012 fixes)', () => {
  test('(c) mismatch reconcile operates on FRESH offsets after a length-changing keyed merge', () => {
    const longKeyed = keyed('alpha', 'LONG OLD KEYED CONTENT THAT IS DELIBERATELY QUITE LENGTHY');
    const proj = [
      'PROSE-HEAD',
      '',
      longKeyed,
      '',
      'PROSE-MID',
      '',
      unlabeled('STALE UNLABELED'),
      '',
      'PROSE-TAIL',
      '',
    ].join('\n');
    const tpl = [
      keyed('alpha', 'SHORT'),
      '',
      unlabeled('FRESH-UNLABELED-1'),
      '',
      unlabeled('FRESH-UNLABELED-2'),
      '',
    ].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    // keyed merge happened (shrink) and unlabeled reconcile fired
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:alpha in: ${REL}`);
    expect(r.log.join('\n')).toContain('count mismatch');
    expect(r.log).toContain(`    RECONCILED WORKSPACE-MANAGED blocks in: ${REL}`);
    // FRESH offsets: the surrounding prose and the shrunk keyed block survive intact
    expect(r.content).toContain('PROSE-HEAD');
    expect(r.content).toContain('PROSE-MID');
    expect(r.content).toContain('PROSE-TAIL');
    expect(r.content).toContain('SHORT');
    expect(r.content).toContain('FRESH-UNLABELED-1');
    expect(r.content).toContain('FRESH-UNLABELED-2');
    expect(r.content).not.toContain('STALE UNLABELED');
    expect(r.content).not.toContain('LONG OLD KEYED CONTENT');
    // the replacement is exactly the two template blocks joined by a blank line
    expect(r.content).toContain(`${unlabeled('FRESH-UNLABELED-1')}\n\n${unlabeled('FRESH-UNLABELED-2')}`);
  });

  test('(e) reconcile with zero template unlabeled blocks removes ONLY the unlabeled span', () => {
    const proj = [
      'PROSE-HEAD',
      '',
      keyed('keep me', 'keyed content'),
      '',
      'PROSE-MID',
      '',
      unlabeled('STALE UNLABELED'),
      '',
      'PROSE-TAIL',
      '',
    ].join('\n');
    const tpl = keyed('keep me', 'keyed content NEW') + '\n';
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.log).toContain(`    RECONCILED WORKSPACE-MANAGED blocks in: ${REL}`);
    expect(r.content).toContain(keyed('keep me', 'keyed content NEW'));
    expect(r.content).not.toContain('STALE UNLABELED');
    expect(r.content).toContain('PROSE-HEAD');
    expect(r.content).toContain('PROSE-MID');
    expect(r.content).toContain('PROSE-TAIL');
  });

  test('(d) appends unlabeled template blocks when the project has none', () => {
    const proj = 'PROSE only, no markers\n';
    const tpl = unlabeled('brand new block') + '\n';
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.log).toContain(`    APPENDED WORKSPACE-MANAGED block to: ${REL}`);
    expect(r.content.endsWith(`${unlabeled('brand new block')}\n`)).toBe(true);
  });

  test('(f) equal counts replace positionally on fresh offsets', () => {
    const proj = [
      'PROSE-HEAD',
      '',
      keyed('alpha', 'A VERY LONG KEYED BODY INDEED YES QUITE LONG'),
      '',
      'PROSE-MID',
      '',
      unlabeled('old unlabeled body'),
      '',
      'PROSE-TAIL',
      '',
    ].join('\n');
    const tpl = [
      keyed('alpha', 'tiny'),
      '',
      unlabeled('new unlabeled body'),
      '',
    ].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:alpha in: ${REL}`);
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED block in: ${REL}`);
    expect(r.log.join('\n')).not.toContain('RECONCILED');
    expect(r.log.join('\n')).not.toContain('WARNING');
    expect(r.content).toBe([
      'PROSE-HEAD',
      '',
      keyed('alpha', 'tiny'),
      '',
      'PROSE-MID',
      '',
      unlabeled('new unlabeled body'),
      '',
      'PROSE-TAIL',
      '',
    ].join('\n'));
  });
});

describe('COMMON-* zones (always unlabeled — byte-identical behavior)', () => {
  test('(g) COMMON-AGENTS START/END pair preserved across positional merge', () => {
    const proj = [
      '# Header',
      '',
      '<!-- COMMON-AGENTS:START -->',
      'old governance roster',
      '<!-- COMMON-AGENTS:END -->',
      '',
      'footer prose',
      '',
    ].join('\n');
    const tpl = [
      '# Header',
      '',
      '<!-- COMMON-AGENTS:START -->',
      'new governance roster',
      '<!-- COMMON-AGENTS:END -->',
      '',
    ].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, 'AGENTS.md', false);
    expect(r.log).toContain('    MERGED COMMON-AGENTS block in: AGENTS.md');
    expect(r.content).toContain('new governance roster');
    expect(r.content).not.toContain('old governance roster');
    expect(r.content).toContain('<!-- COMMON-AGENTS:START -->');
    expect(r.content).toContain('<!-- COMMON-AGENTS:END -->');
    expect(r.content.split('<!-- COMMON-AGENTS:START -->')).toHaveLength(2);
    expect(r.content).toContain('footer prose');
  });

  test('COMMON-CLAUDE append when the project lacks the zone', () => {
    const proj = 'prose\n';
    const tpl = '<!-- COMMON-CLAUDE:START -->\nzone\n<!-- COMMON-CLAUDE:END -->\n';
    const r = mergeManagedBlocks(proj, tpl, null, 'CLAUDE.md', false);
    expect(r.log).toContain('    APPENDED COMMON-CLAUDE block to: CLAUDE.md');
    expect(r.content).toContain('<!-- COMMON-CLAUDE:START -->');
  });
});

describe('per-key union at merge time (variant ∪ common)', () => {
  test('(i) common-only keyed block merges alongside the variant block', () => {
    const proj = [
      'HEAD',
      '',
      keyed('variant only', 'old v'),
      '',
      keyed('common only', 'old c'),
      '',
      'TAIL',
      '',
    ].join('\n');
    const tpl = keyed('variant only', 'new v') + '\n';
    const common = keyed('common only', 'new c') + '\n';
    const r = mergeManagedBlocks(proj, tpl, common, REL, false);
    expect(r.content).toContain('new v');
    expect(r.content).toContain('new c');
    expect(r.content).not.toContain('old v');
    expect(r.content).not.toContain('old c');
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:variant only in: ${REL}`);
    expect(r.log).toContain(`    MERGED WORKSPACE-MANAGED:common only in: ${REL}`);
  });
});

describe('dryRun purity and API shape', () => {
  test('dryRun=true leaves the computation identical and only tags the logs', () => {
    const proj = `HEAD\n\n${keyed('k1', 'old-content')}\n\n${unlabeled('old unlabeled')}\n`;
    const tpl = [keyed('k1', 'new-content'), '', unlabeled('new unlabeled'), ''].join('\n');
    const dry = mergeManagedBlocks(proj, tpl, null, REL, true);
    const applied = mergeManagedBlocks(proj, tpl, null, REL, false);
    // dryRun affects only the log tag, never the computed content
    expect(dry.content).toBe(applied.content);
    expect(dry.merged).toBe(true);
    expect(dry.log).toContain(`    [DRY RUN] MERGED WORKSPACE-MANAGED:k1 in: ${REL}`);
    expect(dry.log).toContain(`    [DRY RUN] MERGED WORKSPACE-MANAGED block in: ${REL}`);
    expect(applied.log.join('\n')).not.toContain('[DRY RUN]');
  });

  test('template with no managed markers → INFO skip, untouched content', () => {
    const proj = 'project content\n';
    const r = mergeManagedBlocks(proj, 'no markers here', null, REL, false);
    expect(r.content).toBe(proj);
    expect(r.merged).toBe(false);
    expect(r.log).toEqual([`    INFO: Template has no managed markers — skipping ${REL}`]);
  });
});

// ── COMMON-CODEX zone (T-20260924-010 — reproduce-then-fix, spec
//    2026-09-25-codex-merge-claim-routing-design D4 row 1). Pattern parity with
//    the COMMON-CLAUDE/GEMINI cases above: positional (key-less) merge, append
//    when the project lacks the zone, snapshot-guarded reconcile on mismatch.
//    Pre-fix (no MANAGED_PATTERNS entry) every case returned the project
//    content untouched with `INFO: Template has no managed markers`. ──
describe('COMMON-CODEX zone (T-20260924-010)', () => {
  const CODEX_OPEN = '<!-- COMMON-CODEX:START -->';
  const CODEX_CLOSE = '<!-- COMMON-CODEX:END -->';
  const ZONE_RE = /<!-- COMMON-CODEX:START -->[\s\S]*?<!-- COMMON-CODEX:END -->/;

  test('merges the template zone into the project copy; outside prose byte-identical', () => {
    const proj = [
      '# Codex intro',
      '',
      'project-owned prose before the zone',
      '',
      CODEX_OPEN,
      '### 4.5 Skill Resolution Priority (STALE COPY)',
      'old zone content',
      CODEX_CLOSE,
      '',
      'footer prose that must survive',
      '',
    ].join('\n');
    const tpl = [
      '# Codex intro',
      '',
      CODEX_OPEN,
      '### 4.5 Skill Resolution Priority',
      'new zone content from template',
      CODEX_CLOSE,
      '',
    ].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, 'CODEX.md', false);
    expect(r.log).toContain('    MERGED COMMON-CODEX block in: CODEX.md');
    expect(r.merged).toBe(true);
    // ONLY the zone span changed — prose before/after preserved byte-for-byte
    const projZone = proj.match(ZONE_RE)![0];
    const tplZone = tpl.match(ZONE_RE)![0];
    expect(r.content).toBe(proj.replace(projZone, () => tplZone));
    expect(r.content).toContain('project-owned prose before the zone');
    expect(r.content).toContain('footer prose that must survive');
    expect(r.content).not.toContain('STALE COPY');
    expect(r.content).toContain('new zone content from template');
    // equal counts: positional path, no snapshot
    expect(r.snapshots).toEqual([]);
    expect(r.log.join('\n')).not.toContain('count mismatch');
  });

  test('appends the zone when the project copy lacks it (pre-zone project copy)', () => {
    const proj = 'prose only, pre-COMMON-CODEX project copy\n';
    const tpl = `${CODEX_OPEN}\nzone content\n${CODEX_CLOSE}\n`;
    const r = mergeManagedBlocks(proj, tpl, null, 'CODEX.md', false);
    expect(r.log).toContain('    APPENDED COMMON-CODEX block to: CODEX.md');
    expect(r.merged).toBe(true);
    expect(r.content.endsWith(`${CODEX_OPEN}\nzone content\n${CODEX_CLOSE}\n`)).toBe(true);
    expect(r.content).toContain('prose only, pre-COMMON-CODEX project copy');
  });

  test('count-mismatch fires RECONCILED with a snapshot of the exact replaced span', () => {
    const proj = [
      'HEAD',
      '',
      CODEX_OPEN,
      'stale one',
      CODEX_CLOSE,
      '',
      'MID PROSE (between project zones)',
      '',
      CODEX_OPEN,
      'stale two',
      CODEX_CLOSE,
      '',
      'TAIL',
      '',
    ].join('\n');
    const tpl = [CODEX_OPEN, 'fresh zone', CODEX_CLOSE, ''].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, 'CODEX.md', false);
    expect(r.log.join('\n')).toContain('count mismatch');
    expect(r.log).toContain('    RECONCILED COMMON-CODEX blocks in: CODEX.md');
    expect(r.snapshots).toHaveLength(1);
    expect(r.snapshots[0]!.rel).toBe('CODEX.md');
    // the snapshot is the exact project span from the first zone start to the
    // last zone end (the engine's documented destructive reconcile span)
    expect(r.snapshots[0]!.content).toBe(
      proj.slice(proj.indexOf(CODEX_OPEN), proj.lastIndexOf(CODEX_CLOSE) + CODEX_CLOSE.length),
    );
    expect(r.content).toContain('fresh zone');
    expect(r.content).toContain('HEAD');
    expect(r.content).toContain('TAIL');
    expect(r.content).not.toContain('stale one');
    expect(r.content).not.toContain('stale two');
  });
});

describe('reconcile snapshots (T-20260917-010)', () => {
  test('count-mismatch reconcile captures the exact replaced span', () => {
    const proj = [
      'PROSE-HEAD',
      '',
      unlabeled('STALE UNLABELED'),
      '',
      'PROSE-TAIL',
      '',
    ].join('\n');
    const tpl = [unlabeled('FRESH-1'), '', unlabeled('FRESH-2'), ''].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.log.join('\n')).toContain('count mismatch');
    expect(r.snapshots).toHaveLength(1);
    expect(r.snapshots[0]!.rel).toBe(REL);
    // the span is exactly the stale block (markers included), no surrounding prose
    expect(r.snapshots[0]!.content).toBe(unlabeled('STALE UNLABELED'));
    // the merged content moved on, but the snapshot preserves what was replaced
    expect(r.content).not.toContain('STALE UNLABELED');
  });

  test('equal-count positional path captures no snapshot', () => {
    const proj = ['HEAD', '', unlabeled('OLD'), '', 'TAIL', ''].join('\n');
    const tpl = [unlabeled('NEW'), ''].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, REL, false);
    expect(r.merged).toBe(true);
    expect(r.snapshots).toEqual([]);
  });

  test('dry-run still returns snapshot data (purity: the write decision is the caller\u2019s)', () => {
    const proj = ['HEAD', '', unlabeled('STALE'), '', 'TAIL', ''].join('\n');
    const tpl = [unlabeled('A'), '', unlabeled('B'), ''].join('\n');
    const r = mergeManagedBlocks(proj, tpl, null, REL, true);
    expect(r.snapshots).toHaveLength(1);
    expect(r.snapshots[0]!.content).toBe(unlabeled('STALE'));
  });

  test('template with no managed blocks hits the early return with an empty snapshot list', () => {
    const proj = ['HEAD', '', keyed('k', 'v'), '', 'TAIL', ''].join('\n');
    const r = mergeManagedBlocks(proj, 'PLAIN TEMPLATE\n', null, REL, false);
    expect(r.merged).toBe(false);
    expect(r.snapshots).toEqual([]);
    expect(r.content).toBe(proj);
  });
});
