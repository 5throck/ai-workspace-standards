/**
 * write-scripts-snapshot helper tests (U-20261006-001)
 * @version 1.0.0
 *
 * parseScriptRegistry is the shared registry parser behind the scaffold/adopt/
 * upgrade scripts-snapshot.json writers and upgrade-project's script version
 * comparison. Line-shape scan over 8-column registry rows — no section
 * slicing (the old lazy-lookahead capture stopped at the first `###`
 * subsection and saw only a slice of the table).
 */

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseScriptRegistry } from '../../scripts/helpers/write-scripts-snapshot.ts';

const REGISTRY = `# SCRIPTS.md — Script Lifecycle Registry

## Registry

### Workspace Scripts

| skill | source | version | status | notes | removal | layer | pair |
|-------|--------|---------|--------|-------|---------|-------|------|
| \`audit.ts\` | L0 | 2.48.1 | active | core gate | —| L0+L1 | —|
| \`ticket.ts\` | L0 | 1.9.1 | active | tickets | —| L0 | —|
| \`deprecated-tool.ts\` | L0 | 0.9.0 | deprecated | sunset | 2027-01-01 | L0 | —|
| \`unversioned.ts\` | L0 | N/A | active | no semver | —| L0 | —|
| \`skill-lifecycle-audit.ts\` | L0 | 1.5.2 |

### Variant-Exclusive Scripts

| \`co-tool.ts\` | L0 | 3.0.0 | active | variant tool | —| L0 | —|
`;

describe('parseScriptRegistry (U-20261006-001)', () => {
  test('scans rows across ### subsections — no section-slicing blindness', () => {
    const scripts = parseScriptRegistry(REGISTRY);
    expect(scripts['audit.ts'].version).toBe('2.48.1');
    expect(scripts['ticket.ts'].version).toBe('1.9.1');
    expect(scripts['co-tool.ts'].version).toBe('3.0.0');
  });

  test('records status verbatim (deprecated detection stays working)', () => {
    const scripts = parseScriptRegistry(REGISTRY);
    expect(scripts['deprecated-tool.ts'].status).toBe('deprecated');
    expect(scripts['audit.ts'].status).toBe('active');
  });

  test('non-semver version cells and truncated fragment rows are filtered', () => {
    const scripts = parseScriptRegistry(REGISTRY);
    expect(scripts['unversioned.ts']).toBeUndefined();
    // the last line has only 3 cells (name/layer/version) — a doc-tail fragment
    expect(scripts['skill-lifecycle-audit.ts']).toBeUndefined();
  });

  test('last write wins on duplicate names (embedded mirror copies)', () => {
    const dup = '| `x.ts` | L0 | 1.0.0 | active | a | —| L0 | —|\n| `x.ts` | L0 | 2.0.0 | active | b | —| L0 | —|\n';
    expect(parseScriptRegistry(dup)['x.ts'].version).toBe('2.0.0');
  });

  test('non-row lines never match', () => {
    expect(parseScriptRegistry('# header\nplain text\n|---|---|---|\n| skill | source | version | status |\n')).toEqual({});
  });
});

describe('CLI l1-source resolution (v1.1.1 — absolute paths must not fall back to L0)', () => {
  test('absolute common/scripts path selects the L1 registry, not the L0 fallback', () => {
    const ws = mkdtempSync(join(tmpdir(), 'wss-abs-'));
    try {
      // L0 fallback registry: only a workspace-only tool the project never receives
      mkdirSync(join(ws, 'scripts'), { recursive: true });
      writeFileSync(join(ws, 'scripts', 'SCRIPTS.md'),
        '| `ticket.ts` | L0 | 1.9.1 | active | tickets | —| L0 | —|\n');
      // L1 delivered registry: the script the project actually receives
      const l1dir = join(ws, 'templates', 'common', 'scripts');
      mkdirSync(l1dir, { recursive: true });
      writeFileSync(join(l1dir, 'SCRIPTS.md'),
        '| `audit.ts` | L0+L1 | 2.51.0 | active | standards | —| L0+L1 | —|\n');
      const project = join(ws, 'project');
      mkdirSync(project, { recursive: true });

      const r = spawnSync('bun', [
        resolve('scripts/helpers/write-scripts-snapshot.ts'),
        project, '2026-10-07', 'co-test',
        l1dir, // ABSOLUTE l1-source — the adopt/upgrade call shape
      ], { cwd: ws, encoding: 'utf-8' });
      expect(r.stderr).toBe('');

      const snap = JSON.parse(readFileSync(join(project, 'scripts-snapshot.json'), 'utf-8'));
      expect(snap.scripts['audit.ts']).toBeDefined();   // L1 delivered script present
      expect(snap.scripts['ticket.ts']).toBeUndefined(); // L0 fallback NOT used
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  });
});
