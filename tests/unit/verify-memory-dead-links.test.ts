#!/usr/bin/env bun
// @version 1.0.0
// verify-memory-dead-links.test.ts — T-20260909-002 reverse dead-link guard
//
// parseSessionsSection() must scope extraction to the `## Sessions` section only
// (Meetings/ADRs sections and prose links are out of scope), and every flat
// session-log link it returns must exist on disk in the live memory/ dir —
// regression guard for the 72 dangling-row prune of 2026-09-09.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { parseSessionsSection } from '../../scripts/verify-memory.ts';

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
