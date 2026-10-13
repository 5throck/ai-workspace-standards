import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendRegistryRows } from '../../scripts/helpers/registry-append.ts';

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
