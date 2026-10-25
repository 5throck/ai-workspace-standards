/**
 * Tests for validate-templates.ts l1-import-closure (IC-01, T-20261026-011,
 * spec docs/designs/2026-10-26-project-review-remediation-design.md D4).
 *
 * Pins the pure helper collectL1ImportClosureIssues against a temp fixture
 * tree (one resolving import, one dangling import — exactly the A1 shape:
 * an L1-delivered script statically importing an undelivered module) and
 * against the real delivered tree (day-one green: after the remediation
 * delivered lib/platform-skeleton-merge.ts as L0+L1, zero unresolved
 * relative imports exist under templates/common/scripts/).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectL1ImportClosureIssues } from '../../scripts/validate-templates.ts';

let fixtureRoot: string | null = null;

function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'ic01-fixture-'));
  fixtureRoot = root;
  return root;
}

afterEach(() => {
  if (fixtureRoot) {
    rmSync(fixtureRoot, { recursive: true, force: true });
    fixtureRoot = null;
  }
});

describe('collectL1ImportClosureIssues (IC-01)', () => {
  test('flags exactly the dangling relative import in a mixed fixture tree', () => {
    const root = makeFixture();
    const scriptsDir = join(root, 'scripts');
    mkdirSync(join(scriptsDir, 'lib'), { recursive: true });

    // Resolving: exact-path specifier into a delivered lib module.
    writeFileSync(join(scriptsDir, 'lib', 'dep.ts'), 'export const dep = 1;\n');
    writeFileSync(
      join(scriptsDir, 'good.ts'),
      "import { dep } from './lib/dep.ts';\nexport const good = dep;\n",
    );
    // Dangling: the A1 shape — static relative import with no delivered target.
    writeFileSync(
      join(scriptsDir, 'broken.ts'),
      "import { missing } from './lib/missing.ts';\nexport const broken = missing;\n",
    );

    const issues = collectL1ImportClosureIssues(scriptsDir);
    expect(issues).toEqual([{ file: 'broken.ts', specifier: './lib/missing.ts' }]);
  });

  test('resolves every sanctioned Bun-style specifier shape (exact, +.ts, /index.ts)', () => {
    const root = makeFixture();
    const scriptsDir = join(root, 'scripts');
    mkdirSync(join(scriptsDir, 'mod'), { recursive: true });

    writeFileSync(join(scriptsDir, 'exact.ts'), 'export const a = 1;\n');
    writeFileSync(join(scriptsDir, 'extensionless.ts'), 'export const b = 2;\n');
    writeFileSync(join(scriptsDir, 'mod', 'index.ts'), 'export const c = 3;\n');
    writeFileSync(
      join(scriptsDir, 'consumer.ts'),
      [
        "import { a } from './exact.ts';",       // exact path
        "import { b } from './extensionless';",   // +.ts resolution
        "import { c } from './mod/index.ts';",    // explicit index
        "import { c as d } from './mod';",        // /index.ts resolution
        "export { a } from './exact.ts';",        // export-from
        "import './exact.ts';",                   // side-effect
        "import type { a } from './exact.ts';",   // type-only
      ].join('\n') + '\n',
    );

    expect(collectL1ImportClosureIssues(scriptsDir)).toEqual([]);
  });

  test('excludes _-prefixed fixture files/dirs and node_modules; flags a tree-escaping resolution', () => {
    const root = makeFixture();
    const scriptsDir = join(root, 'scripts');
    mkdirSync(join(scriptsDir, '_fixtures'), { recursive: true });
    mkdirSync(join(scriptsDir, 'node_modules', 'pkg'), { recursive: true });

    // Dangling imports in excluded locations must NOT be flagged.
    writeFileSync(
      join(scriptsDir, '_fixtures', 'dangling.ts'),
      "import { nope } from './nope.ts';\n",
    );
    writeFileSync(
      join(scriptsDir, 'node_modules', 'pkg', 'dangling.ts'),
      "import { nope } from './nope.ts';\n",
    );
    // A relative import that only resolves OUTSIDE the tree is the A1 class
    // (exists at L0, absent in every delivered project) and must be flagged.
    mkdirSync(join(root, 'outside'), { recursive: true });
    writeFileSync(join(root, 'outside', 'l0-only.ts'), 'export const l0 = 1;\n');
    writeFileSync(
      join(scriptsDir, 'escapee.ts'),
      "import { l0 } from '../outside/l0-only.ts';\nexport const e = l0;\n",
    );

    const issues = collectL1ImportClosureIssues(scriptsDir);
    expect(issues).toEqual([{ file: 'escapee.ts', specifier: '../outside/l0-only.ts' }]);
  });

  test('real delivered tree is day-one green: zero unresolved relative imports', () => {
    // The §1 sweep of the remediation design re-run as a pin: after D1
    // delivered lib/platform-skeleton-merge.ts as L0+L1 and D2 removed the
    // L1 engine mirror, the delivered import closure resolves completely.
    const issues = collectL1ImportClosureIssues(
      join(import.meta.dir, '..', '..', 'templates', 'common', 'scripts'),
    );
    expect(issues).toEqual([]);
  });
});
