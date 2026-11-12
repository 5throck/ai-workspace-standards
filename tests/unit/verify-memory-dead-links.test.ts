#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (U-20261112-007): findMissingIndexLinks() whole-index link-integrity guard —
//           every flat .md link in ANY index section must resolve in the memory/ dir;
//           archive/… and ../docs/… escapes and fragment anchors are out of scope;
//           live MEMORY.md Sessions regression retained from v1.0.0.
//
// verify-memory-dead-links.test.ts — T-20260909-002 reverse dead-link guard
//
// parseSessionsSection() must scope extraction to the `## Sessions` section only
// (Meetings/ADRs sections and prose links are out of scope), and every flat
// session-log link it returns must exist on disk in the live memory/ dir —
// regression guard for the 72 dangling-row prune of 2026-09-09.

import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, describe, afterEach } from 'bun:test';
import { parseSessionsSection, findMissingIndexLinks } from '../../scripts/verify-memory.ts';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');

const FIXTURE = `# Memory Index

## Sessions

| Date | Summary |
|------|---------|
| [2026-09-09](2026-09-09.md) | latest |
| [2026-06-05](archive/2026-06-05.md) | archived row |
| [2026-01-01](2026-01-01.md) | dead flat row |

## Meetings

- [2026-08-07](meeting-2026-08-07.md)
- [archived](archive/meeting-2026-08-07-prevent-nul-file-creation.md)

## ADRs

- [ADR-0065](../docs/adr/0065-accessibility.md)
`;

describe('parseSessionsSection (T-20260909-002)', () => {
  test('extracts all .md links from the Sessions section', () => {
    const links = parseSessionsSection(FIXTURE);
    expect(links).toContain('2026-09-09.md');
    expect(links).toContain('archive/2026-06-05.md');
    expect(links).toContain('2026-01-01.md');
    expect(links).toHaveLength(3);
  });

  test('stops at the next section — Meetings/ADR links are excluded', () => {
    const links = parseSessionsSection(FIXTURE);
    expect(links.some((l) => l.includes('meeting-'))).toBe(false);
    expect(links.some((l) => l.includes('../docs/adr/'))).toBe(false);
  });

  test('returns empty when there is no Sessions section', () => {
    expect(parseSessionsSection('# Index\n\n## Meetings\n\n- [x](a.md)\n')).toEqual([]);
  });

  test('ignores prose lines without .md links inside Sessions', () => {
    const content = '## Sessions\n\n| Date | Summary |\n|------|---------|\nplain text row\n';
    expect(parseSessionsSection(content)).toEqual([]);
  });

  test('live memory/MEMORY.md: every flat session link exists on disk (regression)', () => {
    const content = readFileSync(join(WORKSPACE_ROOT, 'memory', 'MEMORY.md'), 'utf-8');
    const flatLinks = parseSessionsSection(content).filter((l) => !l.includes('/'));
    expect(flatLinks.length).toBeGreaterThan(0);
    for (const href of flatLinks) {
      expect(existsSync(join(WORKSPACE_ROOT, 'memory', href))).toBe(true);
    }
  });
});

describe('findMissingIndexLinks (U-20261112-007 whole-index link integrity)', () => {
  // Isolated temp memory dir — present targets are created on disk so only genuinely
  // dead rows surface in the expectations.
  const tmpRoot = join(import.meta.dir, '.tmp-verify-memory-fixture');
  const tmpMem = join(tmpRoot, 'memory');

  const INDEX_FIXTURE = `# Memory Index

## Sessions

| Date | Summary |
|------|---------|
| [2026-09-09](2026-09-09.md) | latest |

## Meetings

- [2026-08-07](meeting-2026-08-07.md)
- [2026-11-01](meeting-2026-11-01-dead-meeting.md)

## ADRs

- [ADR-0065](adr-2026-01-01-dead-adr.md)
- [ADR-archived](../docs/adr/0065-accessibility.md)
`;

  function seedFixture(content: string): string {
    rmSync(tmpRoot, { recursive: true, force: true });
    mkdirSync(tmpMem, { recursive: true });
    for (const file of ['2026-09-09.md', 'meeting-2026-08-07.md']) {
      writeFileSync(join(tmpMem, file), '# stub\n');
    }
    return content;
  }

  test('flags flat links missing from disk in Meetings and ADRs sections, not just Sessions', () => {
    const content = seedFixture(INDEX_FIXTURE);
    const missing = findMissingIndexLinks(content, tmpMem);
    expect(missing).toEqual(['meeting-2026-11-01-dead-meeting.md', 'adr-2026-01-01-dead-adr.md']);
  });

  test('returns empty when every flat link resolves', () => {
    const content = seedFixture(
      '# Index\n\n## Sessions\n\n| [2026-09-09](2026-09-09.md) | ok |\n\n## Meetings\n\n- [m](meeting-2026-08-07.md)\n',
    );
    expect(findMissingIndexLinks(content, tmpMem)).toEqual([]);
  });

  test('archive and out-of-dir escapes are out of scope — never false positives', () => {
    const content = seedFixture(
      '# Index\n\n## Sessions\n\n| [2026-06-05](archive/2026-06-05.md) | archived |\n\n## ADRs\n\n- [ADR](../docs/adr/0065-x.md)\n',
    );
    expect(findMissingIndexLinks(content, tmpMem)).toEqual([]);
  });

  test('fragment anchors are stripped before the existence check', () => {
    const content = seedFixture(
      '# Index\n\n## Sessions\n\n| [2026-09-09](2026-09-09.md#session-summary) | ok |\n',
    );
    expect(findMissingIndexLinks(content, tmpMem)).toEqual([]);
  });

  test('dedupes repeated dead rows — one entry per missing target', () => {
    const content = seedFixture(
      '# Index\n\n## Sessions\n\n| [x](2026-01-01-dead.md) | dead |\n\n## Meetings\n\n- [x](2026-01-01-dead.md)\n- [x](2026-01-01-dead.md)\n',
    );
    expect(findMissingIndexLinks(content, tmpMem)).toEqual(['2026-01-01-dead.md']);
  });

  test('live memory/MEMORY.md whole-index scan is deterministic and flat-only (shape)', () => {
    const content = readFileSync(join(WORKSPACE_ROOT, 'memory', 'MEMORY.md'), 'utf-8');
    const missing = findMissingIndexLinks(content, join(WORKSPACE_ROOT, 'memory'));
    // Every reported target must be a flat .md filename (no dir escape) — scope guard.
    for (const href of missing) {
      expect(href).not.toContain('/');
      expect(href.endsWith('.md')).toBe(true);
    }
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});
