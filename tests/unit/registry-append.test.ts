import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRegistryRows, registryAppendIndex } from '../../scripts/helpers/registry-append.ts';

const REG = `# SCRIPTS.md

## Registry

| Script | Layer | Version | Status | Notes | Deps | Delivered | Owner |
|--------|-------|---------|--------|-------|------|-----------|-------|
| \`existing.ts\` | L0 | 1.0.0 | active | first row | — | L0 | — |

## Next Section

body text
`;

describe('appendRegistryRows (T-20261013-001)', () => {
  test('inserts rows after the last table row of the first Registry table', () => {
    const root = mkdtempSync(join(tmpdir(), 'reg-append-'));
    const p = join(root, 'SCRIPTS.md');
    writeFileSync(p, REG);
    expect(appendRegistryRows(p, ['| `added.ts` | L2-only | 2.0.0 | active | new | — | L2-only | — |'])).toBe(true);
    const out = readFileSync(p, 'utf-8');
    const addedIdx = out.indexOf('| `added.ts` |');
    expect(addedIdx).toBeGreaterThan(out.indexOf('| `existing.ts` |'));
    expect(addedIdx).toBeLessThan(out.indexOf('## Next Section'));
    rmSync(root, { recursive: true, force: true });
  });

  test('returns false without writing when the Registry section or table is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'reg-append-'));
    const p1 = join(root, 'no-section.md');
    writeFileSync(p1, '# nothing here\n');
    const p2 = join(root, 'empty-table.md');
    writeFileSync(p2, '## Registry\n\nno table rows\n');
    expect(appendRegistryRows(p1, ['| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |'])).toBe(false);
    expect(appendRegistryRows(p2, ['| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |'])).toBe(false);
    expect(readFileSync(p2, 'utf-8')).toBe('## Registry\n\nno table rows\n');
    rmSync(root, { recursive: true, force: true });
  });

  test('empty rows list is a no-op returning false', () => {
    const root = mkdtempSync(join(tmpdir(), 'reg-append-'));
    const p = join(root, 'SCRIPTS.md');
    writeFileSync(p, REG);
    expect(appendRegistryRows(p, [])).toBe(false);
    expect(readFileSync(p, 'utf-8')).toBe(REG);
    rmSync(root, { recursive: true, force: true });
  });
});

// T-20261014-002: the exported boundary scan — shared by appendRegistryRows
// and reconcileScriptRegistry's append arm (## Registry anchor + #### bound).
describe('registryAppendIndex (T-20261014-002)', () => {
  const DOC = [
    '# scripts',
    '',
    '## Registry',
    '',
    '| Script | Layer | Version | Status | Notes | Deps | Delivered | Owner |',
    '|--------|-------|---------|--------|-------|------|-----------|-------|',
    '| `a.ts` | L0 | 1.0.0 | active | first | — | L0 | — |',
    '| `lib/b.ts` | L0 | 2.0.0 | active | last | — | L0 | — |',
    '',
    '#### `a.ts`',
    '',
    '| `--foo` | enables foo |',
    '',
    '## Another Section',
    '',
    '| `late.ts` | L0 | 3.0.0 | active | — | — | L0 | — |',
  ].join('\n');

  test('stops at the #### detail header — flag-table and later rows never win', () => {
    const lines = DOC.split('\n');
    const idx = registryAppendIndex(lines);
    expect(lines[idx - 1]).toContain('`lib/b.ts`');
  });

  test('skips prose between the heading and the table without breaking', () => {
    const lines = [
      '## Registry',
      '',
      'Scripts are registered here.',
      '',
      '| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |',
    ].join('\n').split('\n');
    expect(lines[registryAppendIndex(lines) - 1]).toContain('`a.ts`');
  });

  test('scans to end of lines when no #### header exists', () => {
    const lines = ['## Registry', '| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |'];
    expect(registryAppendIndex(lines)).toBe(2);
  });

  test('returns -1 without a ## Registry heading', () => {
    expect(registryAppendIndex(['# scripts', '| `a.ts` | L0 |'])).toBe(-1);
  });

  test('returns -1 when the heading has no table rows before the #### bound', () => {
    const lines = ['## Registry', '', '#### `a.ts`', '', '| `--foo` | enables foo |'];
    expect(registryAppendIndex(lines)).toBe(-1);
  });

  // T-20261017-001: the real delivered SCRIPTS.md sits the Registry table in
  // front of other ## sections whose tables are also `| \`word\` |`-shaped
  // (Lifecycle States) — the v1.1.0 scan ran through them and the append
  // landed inside the Lifecycle States table (nightly co-abap 13/14).
  test('stops at the next ## section — backtick rows in later ## tables never win', () => {
    const lines = [
      '# SCRIPTS.md',
      '',
      '## Registry',
      '',
      '| Script | Layer | Version | Status | Notes | Deps | Delivered | Owner |',
      '|--------|-------|---------|--------|-------|------|-----------|-------|',
      '| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |',
      '| `lib/b.ts` | L0 | 2.0.0 | active | — | — | L0 | — |',
      '',
      '## Layer Classification Framework',
      '',
      'L0 is the development SSOT.',
      '',
      '## Lifecycle States',
      '',
      '| Status | Meaning | Action Required |',
      '|--------|---------|-----------------|',
      '| `active` | In production use | — |',
      '| `deprecated` | Scheduled for removal | — |',
      '',
      '## Guide',
      '',
      '#### `a.ts`',
      '',
      '| `--foo` | enables foo |',
    ];
    const idx = registryAppendIndex(lines);
    expect(lines[idx - 1]).toContain('| `lib/b.ts` |');
    expect(idx).toBeLessThan(lines.indexOf('## Lifecycle States'));
  });

  test('anchors on the exact ## Registry heading — ## Registry Scope never wins', () => {
    const lines = [
      '## Registry Scope',
      '',
      'The registry covers top-level scripts.',
      '',
      '## Registry',
      '',
      '| `a.ts` | L0 | 1.0.0 | active | — | — | L0 | — |',
    ];
    const idx = registryAppendIndex(lines);
    expect(lines[idx - 1]).toContain('| `a.ts` | L0 |');
  });
});
