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
