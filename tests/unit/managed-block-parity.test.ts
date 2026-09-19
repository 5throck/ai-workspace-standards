/**
 * Tests for scripts/lib/managed-block-parity.ts (T-20260916-009): keyed
 * WORKSPACE-MANAGED block extraction and common↔variant parity comparison —
 * the primitives behind validate-templates.ts's `managed-block-parity` arm
 * (PM-04) and the 2026-09-16 fleet data fix that delivered the current
 * tier-model-mapping blocks to all 13 variant templates/co-* AGENTS.md files.
 *
 * Pins:
 * 1. Extraction: single blocks, duplicate keys (common itself carries two
 *    tier-model-mapping blocks), CRLF input, key whitespace normalization.
 * 2. Unterminated blocks surface as issues, never silently drop.
 * 3. Comparison: missing key / missing content / extra content / full parity.
 * 4. Real-tree invariant: templates/common/AGENTS.md and ALL 13 variant
 *    AGENTS.md are at parity right now (pins the T-009 data fix).
 *
 * 5. COMMON-AGENTS:START/END zone (v1.2.0, ADR-0081 / T-20260919-001):
 *    extraction, missing/mismatch comparison, and the real-tree invariant
 *    that common + all 13 variant AGENTS.md are at parity.
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractKeyedBlocks,
  compareKeyedBlocks,
  normalizeBlockContent,
  parseManagedBlockOpen,
  isExtendsStub,
  extractCommonAgentsBlock,
  compareCommonAgentsBlock,
} from '../../scripts/lib/managed-block-parity.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

// resolve() needs an import — keep the import list clean by using path.resolve here.
import { resolve } from 'node:path';

const BLOCK_A = [
  '<!-- WORKSPACE-MANAGED: tier-model-mapping -->',
  '- **High-tier**: planning (a / b)',
  '<!-- /WORKSPACE-MANAGED -->',
].join('\n');

const BLOCK_B = [
  '<!-- WORKSPACE-MANAGED: tier-model-mapping -->',
  '> **Note**: alias note',
  '<!-- /WORKSPACE-MANAGED -->',
].join('\n');

const BLOCK_GRAFT = [
  '<!-- WORKSPACE-MANAGED: graft repo context graph -->',
  'graft instructions',
  '<!-- /WORKSPACE-MANAGED -->',
].join('\n');

describe('parseManagedBlockOpen', () => {
  test('parses the open marker key', () => {
    expect(parseManagedBlockOpen('<!-- WORKSPACE-MANAGED: tier-model-mapping -->')).toBe('tier-model-mapping');
  });

  test('normalizes whitespace in the key', () => {
    expect(parseManagedBlockOpen('<!--   WORKSPACE-MANAGED:   graft   repo   context graph  -->')).toBe('graft repo context graph');
  });

  test('returns null for close markers and prose', () => {
    expect(parseManagedBlockOpen('<!-- /WORKSPACE-MANAGED -->')).toBeNull();
    expect(parseManagedBlockOpen('The marker <!-- WORKSPACE-MANAGED: x --> is documented here.')).toBeNull();
    expect(parseManagedBlockOpen('<!-- COMMON-AGENTS:START -->')).toBeNull();
  });
});

describe('normalizeBlockContent', () => {
  test('CRLF, per-line trailing whitespace, and outer blank lines are normalized (leading indentation kept)', () => {
    expect(normalizeBlockContent('\r\n  line one  \r\nline two\t\r\n\r\n')).toBe('  line one\nline two');
  });
});

describe('extractKeyedBlocks', () => {
  test('single block per key', () => {
    const result = extractKeyedBlocks(`before\n${BLOCK_GRAFT}\nafter`);
    expect(result.get('graft repo context graph')).toEqual(['graft instructions']);
  });

  test('duplicate keys accumulate contents in document order (the common shape)', () => {
    const result = extractKeyedBlocks(`${BLOCK_A}\n\n${BLOCK_B}`);
    expect(result.get('tier-model-mapping')).toEqual(['- **High-tier**: planning (a / b)', '> **Note**: alias note']);
  });

  test('CRLF input extracts identically', () => {
    const result = extractKeyedBlocks(BLOCK_A.replace(/\n/g, '\r\n'));
    expect(result.get('tier-model-mapping')).toEqual(['- **High-tier**: planning (a / b)']);
  });

  test('unterminated block is reported via issues, not silently dropped', () => {
    const issues: string[] = [];
    const result = extractKeyedBlocks('<!-- WORKSPACE-MANAGED: broken -->\ncontent without close', issues);
    expect(result.size).toBe(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('broken');
  });
});

describe('compareKeyedBlocks', () => {
  const common = new Map<string, string[]>([
    ['k', ['content-1', 'content-2']],
    ['graft', ['g']],
  ]);

  test('full parity yields no violations', () => {
    const variant = new Map<string, string[]>([
      ['k', ['content-2', 'content-1']], // order-insensitive
      ['graft', ['g']],
    ]);
    expect(compareKeyedBlocks(common, variant)).toEqual([]);
  });

  test('missing key', () => {
    const violations = compareKeyedBlocks(common, new Map([['graft', ['g']]]));
    expect(violations).toEqual([{ key: 'k', kind: 'missing-key', content: '' }]);
  });

  test('missing content (key present, one common block absent)', () => {
    const variant = new Map<string, string[]>([['k', ['content-1']], ['graft', ['g']]]);
    expect(compareKeyedBlocks(common, variant)).toEqual([
      { key: 'k', kind: 'missing-content', content: 'content-2' },
    ]);
  });

  test('divergent content in the variant is extra-content (needs adjudication)', () => {
    const variant = new Map<string, string[]>([['k', ['stale-content']], ['graft', ['g']]]);
    const violations = compareKeyedBlocks(common, variant);
    expect(violations).toEqual([
      { key: 'k', kind: 'missing-content', content: 'content-1' },
      { key: 'k', kind: 'missing-content', content: 'content-2' },
      { key: 'k', kind: 'extra-content', content: 'stale-content' },
    ]);
  });
});

describe('real-tree invariant: the T-009 data fix is at parity', () => {
  const commonBlocks = extractKeyedBlocks(
    readFileSync(join(workspaceRoot, 'templates', 'common', 'AGENTS.md'), 'utf-8'),
  );

  test('common carries exactly the two known keys (tier-model-mapping x2, graft x1)', () => {
    expect([...commonBlocks.keys()].sort()).toEqual(['graft repo context graph', 'tier-model-mapping']);
    expect(commonBlocks.get('tier-model-mapping')).toHaveLength(2);
    expect(commonBlocks.get('graft repo context graph')).toHaveLength(1);
  });

  test('the tier-model-mapping block lists 3 models per tier (the T-009 defect shape)', () => {
    const [tierList] = commonBlocks.get('tier-model-mapping')!;
    expect((tierList.match(/gpt-5\.6-/g) ?? []).length).toBe(3);
    expect(tierList).toContain('claude-opus-5-0');
    expect(tierList).toContain('claude-sonnet-5-0');
    expect(tierList).toContain('claude-haiku-4-5');
  });

  test('every templates/co-*/AGENTS.md is at parity with common', () => {
    const templatesDir = join(workspaceRoot, 'templates');
    const variants = readdirSync(templatesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
      .map((e) => e.name);
    expect(variants.length).toBe(13);
    for (const variant of variants) {
      const issues: string[] = [];
      const variantBlocks = extractKeyedBlocks(
        readFileSync(join(templatesDir, variant, 'AGENTS.md'), 'utf-8'),
        issues,
      );
      expect(issues).toEqual([]);
      const violations = compareKeyedBlocks(commonBlocks, variantBlocks);
      expect(violations).toEqual([]);
    }
  });
});

describe('isExtendsStub (T-20260917-001)', () => {
  test('detects a variant pm.md extends-stub frontmatter', () => {
    const stub = [
      '---',
      "extends: ../../common/agents/pm.md",
      'name: pm',
      'variant: co-abap',
      '---',
      '',
    ].join('\n');
    expect(isExtendsStub(stub)).toBe(true);
  });

  test('rejects a full body without frontmatter', () => {
    expect(isExtendsStub('# PM\n\nBody prose.\n')).toBe(false);
  });

  test('ignores an extends key outside frontmatter', () => {
    const body = ['# PM', '', 'extends: ../../common/agents/pm.md', ''].join('\n');
    expect(isExtendsStub(body)).toBe(false);
  });

  test('rejects frontmatter without an extends field', () => {
    const notStub = ['---', 'name: pm', '---', 'body'].join('\n');
    expect(isExtendsStub(notStub)).toBe(false);
  });
});

// ── COMMON-AGENTS zone (v1.2.0, ADR-0081 / T-20260919-001) ──────────────────

const CA_OPEN = '<!-- COMMON-AGENTS:START -->';
const CA_CLOSE = '<!-- COMMON-AGENTS:END -->';
const CA_BODY = [
  '## Language Policy',
  'english-only rule',
  '',
  '### PM Team-Management Authority (ADR-0080)',
  'authority text',
];
const CA_BLOCK = [CA_OPEN, ...CA_BODY, CA_CLOSE].join('\n');

describe('extractCommonAgentsBlock', () => {
  test('returns the normalized inner content', () => {
    const content = ['before', CA_BLOCK, 'after'].join('\n');
    expect(extractCommonAgentsBlock(content)).toBe(CA_BODY.join('\n'));
  });

  test('returns null when the block is absent', () => {
    expect(extractCommonAgentsBlock('no block here')).toBeNull();
  });

  test('unterminated block is reported via issues and returns null', () => {
    const issues: string[] = [];
    const content = [CA_OPEN, 'orphan content'].join('\n');
    expect(extractCommonAgentsBlock(content, issues)).toBeNull();
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain('unterminated COMMON-AGENTS');
  });

  test('CRLF input extracts identically', () => {
    const content = [CA_OPEN, ...CA_BODY, CA_CLOSE].join('\n').split('\n').join('\r\n');
    expect(extractCommonAgentsBlock(content)).toBe(CA_BODY.join('\n'));
  });
});

describe('compareCommonAgentsBlock', () => {
  test('identical content → null (parity)', () => {
    expect(compareCommonAgentsBlock(CA_BODY.join('\n'), CA_BODY.join('\n'))).toBeNull();
  });

  test('variant without the block → missing', () => {
    expect(compareCommonAgentsBlock(CA_BODY.join('\n'), null)).toBe('missing');
  });

  test('divergent content → mismatch', () => {
    expect(compareCommonAgentsBlock(CA_BODY.join('\n'), 'stale policy text')).toBe('mismatch');
  });

  test('line-ending and whitespace differences are normalized away', () => {
    expect(compareCommonAgentsBlock(CA_BODY.join('\n'), CA_BODY.join('\r\n'))).toBeNull();
  });
});

describe('real-tree invariant: COMMON-AGENTS parity (ADR-0081 / T-20260919-001)', () => {
  test('common AGENTS.md and ALL variant AGENTS.md are at parity', () => {
    const common = readFileSync(join(workspaceRoot, 'templates', 'common', 'AGENTS.md'), 'utf-8');
    const commonBlock = extractCommonAgentsBlock(common);
    expect(commonBlock).not.toBeNull();
    const variants = readdirSync(join(workspaceRoot, 'templates'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
      .map((e) => e.name)
      .sort();
    expect(variants.length).toBeGreaterThanOrEqual(13);
    for (const v of variants) {
      const content = readFileSync(join(workspaceRoot, 'templates', v, 'AGENTS.md'), 'utf-8');
      expect(compareCommonAgentsBlock(commonBlock as string, extractCommonAgentsBlock(content))).toBeNull();
    }
  });
});

