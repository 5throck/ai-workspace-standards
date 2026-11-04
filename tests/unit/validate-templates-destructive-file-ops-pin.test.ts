#!/usr/bin/env bun
// @version 1.0.0
// validate-templates-destructive-file-ops-pin.test.ts — §7 destructive-file-operations baseline pin
//
// Asserts the T-20261104-004 item 4 propagation wave (design
// docs/designs/2026-11-04-project-loss-hardening-design §5.4): every AGENTS.md §7
// surface (root, templates/common, every templates/co-* variant) carries the
// "Destructive File Operations" baseline bullet, HERMES.md §6 essentials carries the
// condensed copy inside the COMMON-HERMES marker zone, and the validate-templates
// WARN arm `agents-md-destructive-file-ops-pin` pins the phrase machine-side.

import { test, expect, describe } from 'bun:test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const ROOT = cwd();
const MARKER = 'Destructive File Operations';

/** Extract the §7 Universal Baseline Behaviors section body from an AGENTS.md string. */
function section7(content: string): string | null {
  const m = content.match(/^## §7: Universal Baseline Behaviors\n([\s\S]*?)(?=^## )/m);
  return m ? m[1] : null;
}

describe('validate-templates-destructive-file-ops-pin (design 2026-11-04-project-loss-hardening-design §5.4)', () => {
  const variantDirs = existsSync(join(ROOT, 'templates'))
    ? readdirSync(join(ROOT, 'templates'), { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('co-'))
        .map(e => e.name)
        .sort()
    : [];

  test('every template co-* variant AGENTS.md §7 carries the Destructive File Operations bullet', () => {
    expect(variantDirs.length).toBeGreaterThan(0);
    for (const v of variantDirs) {
      const content = readFileSync(join(ROOT, 'templates', v, 'AGENTS.md'), 'utf-8');
      const s7 = section7(content);
      expect(s7).toBeTruthy();
      expect(s7!.includes(MARKER), `${v}/AGENTS.md §7 missing "${MARKER}"`).toBe(true);
    }
  });

  test('templates/common/AGENTS.md §7 carries the Destructive File Operations bullet', () => {
    const s7 = section7(readFileSync(join(ROOT, 'templates', 'common', 'AGENTS.md'), 'utf-8'));
    expect(s7).toBeTruthy();
    expect(s7!.includes(MARKER)).toBe(true);
  });

  test('root AGENTS.md §7 carries the Destructive File Operations bullet', () => {
    const s7 = section7(readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8'));
    expect(s7).toBeTruthy();
    expect(s7!.includes(MARKER)).toBe(true);
  });

  test('root and common §7 carry the identical bullet text (design: identical text on all surfaces)', () => {
    const bullet = (p: string): string => {
      const s7 = section7(readFileSync(join(ROOT, p), 'utf-8'));
      const line = s7!.split('\n').find(l => l.includes(MARKER));
      expect(line).toBeTruthy();
      return line!;
    };
    expect(bullet(join('AGENTS.md'))).toBe(bullet(join('templates', 'common', 'AGENTS.md')));
  });

  test('the bullet records the incident lesson verbatim elements', () => {
    const s7 = section7(readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8'));
    const line = s7!.split('\n').find(l => l.includes(MARKER));
    expect(line).toBeTruthy();
    expect(line).toContain('Never run recursive deletes');
    expect(line).toContain('dry-run list the exact resolved target first');
    expect(line).toContain('`.git` children');
    expect(line).toContain('`Projects/**` first among them');
    expect(line).toContain('`ALLOW_RECURSIVE_DELETE=1`');
  });

  test('HERMES.md §6 essentials carries the condensed copy inside the COMMON-HERMES zone', () => {
    const content = readFileSync(join(ROOT, 'HERMES.md'), 'utf-8');
    const zoneMatch = content.match(/<!-- COMMON-HERMES:START -->([\s\S]*?)<!-- COMMON-HERMES:END -->/);
    expect(zoneMatch).toBeTruthy();
    expect(zoneMatch![1].includes(MARKER)).toBe(true);
    // the condensed copy keeps the lesson's core elements
    const line = zoneMatch![1].split('\n').find(l => l.includes(MARKER));
    expect(line).toBeTruthy();
    expect(line).toContain('Never run recursive deletes');
    expect(line).toContain('`.git` children');
    expect(line).toContain('`ALLOW_RECURSIVE_DELETE=1`');
  });

  test('validate-templates.ts declares the WARN arm agents-md-destructive-file-ops-pin', () => {
    const content = readFileSync(join(ROOT, 'scripts', 'validate-templates.ts'), 'utf-8');
    expect(content).toContain('checkAgentsMdDestructiveFileOpsPin');
    expect(content).toContain("'agents-md-destructive-file-ops-pin'");
    expect(content).toContain(`'${MARKER}'`);
    // the arm warns (never fails) — severity is WARN per design
    const fn = content.match(/function checkAgentsMdDestructiveFileOpsPin\(\): void \{([\s\S]*?)\n\}\n/);
    expect(fn).toBeTruthy();
    expect(fn![1]).toContain('warn(');
    expect(fn![1]).not.toContain('fail(');
  });
});
