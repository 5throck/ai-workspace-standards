/**
 * Tests for scripts/lib/trail-block-parity.ts (TB-01 primitives) and the
 * real-template fixture sweep (design docs/designs/2026-11-08-trail-fleet-standard-design.md
 * §5.4/§7; DEC-20261108-01 R1/R3; governing ticket T-20261108-001).
 *
 * The AGENTS.md trail block (`<!-- trail:start -->…<!-- trail:end -->`) is
 * TOOL-OWNED (trail init's reconcileWiring re-appends it) but its presence and
 * bytes across the template tree are workspace-pinned: root (tool-written
 * reference) == templates/common (canonical L1 seed) == every variant copy.
 * The block sits outside every COMMON-zoned / WORKSPACE-MANAGED zone, so the
 * PM-04b/VA-05 machinery cannot see it — before TB-01 the state was 2 of 16
 * template files carrying it, unvalidated.
 *
 * Real-file sweep pins the 2026-11-08 single-wave landing (DEC-20261108-01 R1):
 * root + common + all 15 variant AGENTS.md byte-identical.
 */

import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  extractTrailBlock,
  countTrailBlocks,
  compareTrailBlock,
  extractGraftBlock,
  countGraftBlocks,
  swapGraftForTrail,
} from '../../scripts/lib/trail-block-parity.ts';

const ROOT = resolve(__dirname, '../..');

const BLOCK = `<!-- trail:start -->
## Trail — repo context graph

This repo is indexed in \`.trail/cache/\`.
<!-- trail:end -->`;

const OTHER = '## Unrelated section\n\nBody text.\n';

describe('extractTrailBlock', () => {
  test('extracts the whole marker-inclusive block', () => {
    const content = `${OTHER}\n${BLOCK}\n`;
    expect(extractTrailBlock(content)).toBe(BLOCK);
  });

  test('returns null when the block is absent', () => {
    expect(extractTrailBlock(OTHER)).toBeNull();
  });

  test('returns null on an unterminated block (start without end)', () => {
    const unterminated = `<!-- trail:start -->\n## Trail — repo context graph\n`;
    expect(extractTrailBlock(unterminated)).toBeNull();
  });

  test('extracts the FIRST block when several exist (countTrailBlocks is the duplicate detector)', () => {
    const two = `${BLOCK}\n\n${BLOCK}\n`;
    expect(extractTrailBlock(two)).toBe(BLOCK);
  });
});

describe('countTrailBlocks', () => {
  test('counts zero, one, and duplicates', () => {
    expect(countTrailBlocks(OTHER)).toBe(0);
    expect(countTrailBlocks(`x\n${BLOCK}\ny`)).toBe(1);
    expect(countTrailBlocks(`${BLOCK}\n${BLOCK}`)).toBe(2);
  });
});

describe('compareTrailBlock', () => {
  test('missing when the candidate has no block', () => {
    expect(compareTrailBlock(BLOCK, OTHER)).toBe('missing');
  });

  test('duplicate when the candidate has two blocks', () => {
    expect(compareTrailBlock(BLOCK, `${BLOCK}\n${BLOCK}`)).toBe('duplicate');
  });

  test('null when byte-identical', () => {
    expect(compareTrailBlock(BLOCK, `head\n${BLOCK}\ntail\n`)).toBeNull();
  });

  test('mismatch on prose divergence (vendor text changed template-side)', () => {
    const diverged = BLOCK.replace('indexed in', 'indexed at');
    expect(compareTrailBlock(BLOCK, diverged)).toBe('mismatch');
  });

  test('CRLF and trailing-whitespace differences normalize to parity (PM-04b contract)', () => {
    const crlf = BLOCK.split('\n').join('\r\n').replace('<!-- trail:end -->', '<!-- trail:end -->   ');
    expect(compareTrailBlock(BLOCK, crlf)).toBeNull();
  });

  test('leading/trailing blank-line differences normalize to parity', () => {
    expect(compareTrailBlock(BLOCK, `\n\n${BLOCK}\n\n\n`)).toBeNull();
  });
});

describe('real-template fixture sweep (single-wave landing, DEC-20261108-01 R1)', () => {
  const ref = extractTrailBlock(readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8'));
  test('root AGENTS.md carries the block (tool-written reference)', () => {
    expect(ref).not.toBeNull();
    expect(countTrailBlocks(readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8'))).toBe(1);
  });

  const templatesDir = join(ROOT, 'templates');
  const variants = readdirSync(templatesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
    .map((e) => e.name)
    .sort();

  test('templates/common carries exactly one block, byte-identical to root', () => {
    const commonPath = join(templatesDir, 'common', 'AGENTS.md');
    expect(existsSync(commonPath)).toBe(true);
    const content = readFileSync(commonPath, 'utf-8');
    expect(countTrailBlocks(content)).toBe(1);
    expect(compareTrailBlock(ref!, content)).toBeNull();
  });

  test(`every variant AGENTS.md (${variants.length} files) carries exactly one byte-identical block`, () => {
    expect(variants.length).toBeGreaterThanOrEqual(15);
    for (const v of variants) {
      const p = join(templatesDir, v, 'AGENTS.md');
      expect(existsSync(p)).toBe(true);
      const content = readFileSync(p, 'utf-8');
      expect(countTrailBlocks(content)).toBe(1);
      expect(compareTrailBlock(ref!, content)).toBeNull();
    }
  });
});

describe('graft-era block primitives (v1.1.0, U-20261112-010)', () => {
  const variants = readdirSync(join(ROOT, 'templates'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
    .map((e) => e.name)
    .sort();
  const GRAFT = `<!-- graft:start -->
## Graft — repo context graph

This repo is indexed in \`graft/\`.
<!-- graft:end -->`;

  test('extractGraftBlock extracts the marker-inclusive graft block', () => {
    expect(extractGraftBlock(`before\n${GRAFT}\nafter`)).toBe(GRAFT);
    expect(extractGraftBlock('no block here')).toBeNull();
  });

  test('countGraftBlocks counts graft blocks', () => {
    expect(countGraftBlocks(`${GRAFT}\nmid\n${GRAFT}`)).toBe(2);
    expect(countGraftBlocks(BLOCK)).toBe(0);
  });

  test('swapGraftForTrail replaces the graft block with the trail block', () => {
    const swapped = swapGraftForTrail(`head\n\n${GRAFT}\n\ntail`, `x\n${BLOCK}\ny`, BLOCK);
    expect(swapped).toBe(`head\n\n${BLOCK}\n\ntail`);
  });

  test('swapGraftForTrail is idempotent (no graft block → null)', () => {
    expect(swapGraftForTrail(`a\n${BLOCK}\nb`, `x\n${BLOCK}\ny`, BLOCK)).toBeNull();
  });

  test('swapGraftForTrail refuses when the template still carries a graft block', () => {
    expect(swapGraftForTrail(GRAFT, GRAFT, BLOCK)).toBeNull();
  });

  test('swapGraftForTrail replaces every graft block when several exist', () => {
    const swapped = swapGraftForTrail(`${GRAFT}\n${GRAFT}`, BLOCK, BLOCK);
    expect(swapped).toBe(`${BLOCK}\n${BLOCK}`);
  });

  test('real-template sweep: no instruction file in common or any variant carries a graft-era block', () => {
    const templatesDir = join(ROOT, 'templates');
    const roots = ['common', ...variants];
    const rels = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md'];
    for (const rootName of roots) {
      for (const rel of rels) {
        const p = join(templatesDir, rootName, rel);
        if (!existsSync(p)) continue;
        expect(countGraftBlocks(readFileSync(p, 'utf-8'))).toBe(0);
      }
    }
  });

  test('real-template sweep: every variant HERMES.md/CODEX.md trail block matches common', () => {
    const templatesDir = join(ROOT, 'templates');
    for (const rel of ['HERMES.md', 'CODEX.md']) {
      const commonPath = join(templatesDir, 'common', rel);
      if (!existsSync(commonPath)) continue;
      const commonBlock = extractTrailBlock(readFileSync(commonPath, 'utf-8'))!;
      for (const v of variants) {
        const p = join(templatesDir, v, rel);
        if (!existsSync(p)) continue;
        expect(compareTrailBlock(commonBlock, readFileSync(p, 'utf-8'))).toBeNull();
      }
    }
  });
});
