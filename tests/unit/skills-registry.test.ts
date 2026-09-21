import { describe, expect, test } from 'bun:test';
import {
  buildSkillRegistryRow,
  parseSkillRegistryRows,
  reconcileSkillRegistry,
  stripCellQuotes,
} from '../../scripts/helpers/skills-registry.ts';

const REGISTRY_FORMAT = `# Skills Index

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`existing\` | 1.0.0 | active | pm | 2026-09-01 | — | seeded |
`;

const CATEGORY_FORMAT = `# Skills Index — co-abap

## Contract-safety

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`contract-a\` | 1.0.0 | active | pm | 2026-09-01 | — | a |

## Process

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`process-b\` | 2.0.0 | active | pm | 2026-09-02 | — | b |
`;

const DUP_REGISTRY_FORMAT = `## Registry
## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| \`k-krx\` | 1.0.2 | active | financial-analyst | 2026-09-11 | — | KRX data |
`;

describe('stripCellQuotes', () => {
  test('strips symmetric double quotes', () => {
    expect(stripCellQuotes('"2026-09-12"')).toBe('2026-09-12');
  });
  test('strips symmetric single quotes', () => {
    expect(stripCellQuotes("'1.0.0'")).toBe('1.0.0');
  });
  test('leaves unquoted values alone', () => {
    expect(stripCellQuotes('2026-09-12')).toBe('2026-09-12');
  });
});

describe('parseSkillRegistryRows', () => {
  test('parses a ## Registry table', () => {
    const { rows, lastSkillRowIdx } = parseSkillRegistryRows(REGISTRY_FORMAT);
    expect(rows.size).toBe(1);
    expect(rows.get('existing')?.version).toBe('1.0.0');
    expect(lastSkillRowIdx).toBeGreaterThan(0);
  });

  test('parses category-sectioned tables (co-abap style)', () => {
    const { rows } = parseSkillRegistryRows(CATEGORY_FORMAT);
    expect(rows.size).toBe(2);
    expect(rows.get('contract-a')?.version).toBe('1.0.0');
    expect(rows.get('process-b')?.version).toBe('2.0.0');
  });

  test('parses duplicated ## Registry headings (co-newbiz style)', () => {
    const { rows } = parseSkillRegistryRows(DUP_REGISTRY_FORMAT);
    expect(rows.get('k-krx')?.version).toBe('1.0.2');
  });

  test('strips quoted version and date cells', () => {
    const content = REGISTRY_FORMAT.replace('| 1.0.0 |', '| "1.0.0" |').replace(
      '| 2026-09-01 |',
      '| "2026-09-01" |',
    );
    const { rows } = parseSkillRegistryRows(content);
    expect(rows.get('existing')?.version).toBe('1.0.0');
    expect(rows.get('existing')?.lastReviewed).toBe('2026-09-01');
  });
});

describe('reconcileSkillRegistry', () => {
  test('updates version/last_reviewed of existing rows (unquoted)', () => {
    const { content, updated } = reconcileSkillRegistry(REGISTRY_FORMAT, [
      { skill: 'existing', version: '2.5.0', lastReviewed: '2026-09-14' },
    ]);
    expect(updated).toEqual(['existing']);
    expect(content).toContain('| `existing` | 2.5.0 |');
    expect(content).toContain('2026-09-14');
    expect(content).not.toContain('"2.5.0"');
  });

  test('appends missing rows after the last skill row with unquoted dates', () => {
    const { content, added } = reconcileSkillRegistry(REGISTRY_FORMAT, [
      { skill: 'brand-new', version: '1.0.0', status: 'active', lastReviewed: '2026-09-14' },
    ]);
    expect(added).toEqual(['brand-new']);
    const lines = content.split('\n');
    const seededIdx = lines.findIndex((l) => l.includes('`existing`'));
    const addedIdx = lines.findIndex((l) => l.includes('`brand-new`'));
    expect(addedIdx).toBe(seededIdx + 1);
    expect(addedIdx).toBeGreaterThan(0);
    const row = lines[addedIdx];
    expect(row).toContain('| 1.0.0 |');
    expect(row).toContain('active');
    expect(row).not.toContain('"');
  });

  test('appends multiple missing rows in delivery order', () => {
    const { content, added } = reconcileSkillRegistry(CATEGORY_FORMAT, [
      { skill: 'new-x', version: '1.0.0' },
      { skill: 'new-y', version: '1.0.0' },
    ]);
    expect(added).toEqual(['new-x', 'new-y']);
    const lines = content.split('\n');
    const xIdx = lines.findIndex((l) => l.includes('`new-x`'));
    const yIdx = lines.findIndex((l) => l.includes('`new-y`'));
    expect(yIdx).toBe(xIdx + 1);
    const lastProcessIdx = lines.findIndex((l) => l.includes('`process-b`'));
    expect(xIdx).toBeGreaterThan(lastProcessIdx);
  });

  test('leaves content unchanged when everything already matches', () => {
    const { updated, added } = reconcileSkillRegistry(REGISTRY_FORMAT, [
      { skill: 'existing', version: '1.0.0', lastReviewed: '2026-09-01' },
    ]);
    expect(updated).toEqual([]);
    expect(added).toEqual([]);
  });

  test('does not add rows when the file has no skill table at all', () => {
    const noTable = '# Skills\n\nNo table here.\n';
    const { added, content } = reconcileSkillRegistry(noTable, [
      { skill: 'orphan', version: '1.0.0' },
    ]);
    expect(added).toEqual([]);
    expect(content).toBe(noTable);
  });
});

describe('buildSkillRegistryRow', () => {
  test('emits unquoted cells with — for empty optionals', () => {
    const row = buildSkillRegistryRow({ skill: 's', version: '1.0.0', lastReviewed: '2026-09-14' });
    expect(row).toBe('| `s` | 1.0.0 | active | — | 2026-09-14 | — | — |');
  });
});
