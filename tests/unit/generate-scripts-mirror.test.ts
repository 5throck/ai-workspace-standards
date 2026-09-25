#!/usr/bin/env bun
// @version 1.0.0
// generate-scripts-mirror.test.ts — buildMirrorRegistrySpan builder rules
//
// Spec: docs/designs/2026-09-25-propagation-engine-batch-design.md §6-D6 as
// amended by §14 Amendment 1 (T-20260924-001). Covers AC-10 (L0 rows never in
// the span — including the 81 legacy rows class; non-L0 byte-verbatim;
// synthesized rows from `// @version` headers; hard error on a missing
// header), R4 canonical ordering, R5 second-run byte-stability, the `_`
// fixture exclusion, and extractRegistrySpan/summarize semantics used by the
// CLI and the lifecycle-sync-audit Check B projection arm.

import { describe, test, expect } from 'bun:test';
import {
  buildMirrorRegistrySpan,
  extractRegistrySpan,
  synthesizeMirrorRow,
} from '../../scripts/generate-scripts-mirror.ts';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const HEADER = '| script | source | version | status | removal-date | security-advisory | layer | pair |';
const SEPARATOR = '|--------|--------|---------|--------|--------------|-------------------|-------|------|';

function rootRegistry(rows: string[]): string {
  return [HEADER, SEPARATOR, ...rows].join('\n');
}

/** In-memory template tree: { 'relative/key.ts': 'file content' }. */
function makeTemplateTree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'gen-mirror-test-'));
  for (const [key, content] of Object.entries(files)) {
    const full = join(dir, key);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

/** Canonical builder invocation with cleanup. */
function build(rootRows: string[], treeFiles: Record<string, string>): { span: string; cleanup: () => void } {
  const dir = makeTemplateTree(treeFiles);
  return {
    span: buildMirrorRegistrySpan(rootRegistry(rootRows), dir),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

const row = (key: string, layer: string, version = '1.0.0', annotation = '—') =>
  `| \`${key}\` | L0 | ${version} | active | ${annotation}| —| ${layer} | —|`;

describe('buildMirrorRegistrySpan — R1/R2 (byte-verbatim non-L0; L0 never in span)', () => {
  test('AC-10: L0+L1 root row appears byte-verbatim, all columns including annotation', () => {
    const line = row('audit.ts', 'L0+L1', '2.44.0', 'v2.44.0 did things. ');
    const { span, cleanup } = build([line], {});
    cleanup();
    expect(span).toContain(line);
  });

  test('AC-10: a root L0 row never appears in the generated span (R2-rule)', () => {
    const { span, cleanup } = build([row('ticket.ts', 'L0'), row('audit.ts', 'L0+L1')], {});
    cleanup();
    expect(span).not.toContain('`ticket.ts`');
    expect(span).toContain('`audit.ts`');
  });

  test('AC-10: L0-only layer value is excluded exactly like L0', () => {
    const { span, cleanup } = build([row('hooks/_test-module.ts', 'L0-only'), row('dev-sync.ts', 'L0+L1')], {});
    cleanup();
    expect(span).not.toContain('`hooks/_test-module.ts`');
  });

  test('surviving rows keep root file order (R4 first clause)', () => {
    const a = row('alpha.ts', 'L0+L1');
    const b = row('beta.ts', 'L0+L1');
    const c = row('gamma.ts', 'L0+L1');
    const { span, cleanup } = build([c, a, b], {});
    cleanup();
    const ia = span.indexOf('`alpha.ts`');
    const ib = span.indexOf('`beta.ts`');
    const ic = span.indexOf('`gamma.ts`');
    expect(ic < ia && ia < ib).toBe(true);
  });
});

describe('buildMirrorRegistrySpan — R3 (synthesis from // @version headers)', () => {
  test('template-tree file with no root row gets the exact synthesized row format', () => {
    const { span, cleanup } = build([row('audit.ts', 'L0+L1')], {
      'handbook/check-links.ts': '#!/usr/bin/env bun\n// @version 1.4.2\nexport {};\n',
    });
    cleanup();
    expect(span).toContain(synthesizeMirrorRow('handbook/check-links.ts', '1.4.2'));
    expect(span).toContain('| `handbook/check-links.ts` | L0 | 1.4.2 | active | — | — | common | — |');
  });

  test('AC-10: unparseable/missing @version header throws (hard error)', () => {
    const dir = makeTemplateTree({ 'handbook/no-version.ts': 'export {};\n' });
    try {
      expect(() => buildMirrorRegistrySpan(rootRegistry([row('audit.ts', 'L0+L1')]), dir)).toThrow(/no parseable .*@version/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('R17: `_`-prefixed basenames are excluded from the mirror-only scan', () => {
    const { span, cleanup } = build([row('audit.ts', 'L0+L1')], {
      'hooks/_test-module.ts': '// @version 1.0.0\nexport {};\n',
      'hooks/real.ts': '// @version 2.0.0\nexport {};\n',
    });
    cleanup();
    expect(span).not.toContain('`hooks/_test-module.ts`');
    expect(span).toContain(synthesizeMirrorRow('hooks/real.ts', '2.0.0'));
  });

  test('keys are relative to the template scripts dir (recursive walk)', () => {
    const { span, cleanup } = build([], {
      'lib/deep/nested.ts': '// @version 0.9.1\nexport {};\n',
    });
    cleanup();
    expect(span).toContain(synthesizeMirrorRow('lib/deep/nested.ts', '0.9.1'));
  });

  test('a template-tree file WITH a root row is not double-registered (R1 wins, no synthesis)', () => {
    const line = row('audit.ts', 'L0+L1', '2.0.0');
    const { span, cleanup } = build([line], { 'audit.ts': '// @version 9.9.9\n' });
    cleanup();
    expect(span.split('\n').filter((l) => l.includes('`audit.ts`'))).toHaveLength(1);
    expect(span).toContain(line);
  });
});

describe('buildMirrorRegistrySpan — R4 (canonical ordering)', () => {
  test('R3 group is sorted and inserts before the first R1 row with a greater key', () => {
    // Root order: validators/types.ts is the first row greater than the
    // group's max key ('tests/deploy-readme-patch.test.ts').
    const r1 = [row('validators/types.ts', 'L0+L1'), row('audit.ts', 'L0+L1')];
    const { span, cleanup } = build(r1, {
      'handbook/b.ts': '// @version 1.0.0\n',
      'handbook/a.ts': '// @version 1.0.0\n',
      'tests/z.test.ts': '// @version 1.0.0\n',
    });
    cleanup();
    const lines = span.split('\n').filter((l) => l.startsWith('| `'));
    const keys = lines.map((l) => l.split('|')[1].trim().replace(/`/g, ''));
    // Sorted group block: handbook/a, handbook/b, tests/z — then validators/types.
    expect(keys).toEqual(['handbook/a.ts', 'handbook/b.ts', 'tests/z.test.ts', 'validators/types.ts', 'audit.ts']);
    expect(keys.indexOf('validators/types.ts')).toBe(keys.indexOf('tests/z.test.ts') + 1);
  });

  test('group with no greater R1 row appends at the end of the table', () => {
    const { span, cleanup } = build([row('aaa.ts', 'L0+L1')], {
      'zzz/last.ts': '// @version 1.0.0\n',
    });
    cleanup();
    const keys = span.split('\n').filter((l) => l.startsWith('| `')).map((l) => l.split('|')[1].trim());
    expect(keys[keys.length - 1]).toBe('`zzz/last.ts`');
  });
});

describe('buildMirrorRegistrySpan — R5/R18 (determinism, second-run byte-stability)', () => {
  test('identical inputs produce byte-identical output (build twice)', () => {
    const rootRows = [row('migrate-project.ts', 'L0'), row('audit.ts', 'L0+L1', '2.0.0', 'note. ')];
    const tree = { 'handbook/x.ts': '// @version 1.0.0\n' };
    const first = build(rootRows, tree);
    const second = build(rootRows, tree);
    expect(first.span).toBe(second.span);
    first.cleanup();
    second.cleanup();
  });

  test('splicing the span into a mirror and regenerating is a no-op (normalization converges)', () => {
    const rootRows = [row('audit.ts', 'L0+L1', '2.0.0'), row('legacy.ts', 'L0')];
    const tree = { 'handbook/x.ts': '// @version 1.0.0\n' };
    const dir = makeTemplateTree(tree);
    const generated = buildMirrorRegistrySpan(rootRegistry(rootRows), dir);
    // Simulate a stale mirror carrying the legacy L0 row ahead of the group.
    const staleMirror = ['# MIRROR', '', '## Registry', '', HEADER, SEPARATOR, row('legacy.ts', 'L0'), row('handbook/x.ts', 'L0', '1.0.0', ' '), '', '## Next'].join('\n');
    const span = extractRegistrySpan(staleMirror)!;
    expect(span).not.toBe(generated); // pending normalization IS drift
    // Splice (the CLI's write path): replace the span inside the mirror.
    const normalized = staleMirror.replace(span, generated);
    // A second generation pass over the normalized tree state is byte-stable.
    expect(extractRegistrySpan(normalized)).toBe(generated);
    expect(generated).toBe(buildMirrorRegistrySpan(rootRegistry(rootRows), dir));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('extractRegistrySpan (R15 span definition)', () => {
  test('span = | script | header row through the last consecutive table row', () => {
    const content = ['# Title', '', '## Registry', '', HEADER, SEPARATOR, row('a.ts', 'L0+L1'), row('b.ts', 'L0'), '', '---', '', '## Next'].join('\n');
    const span = extractRegistrySpan(content)!;
    expect(span).toBe([HEADER, SEPARATOR, row('a.ts', 'L0+L1'), row('b.ts', 'L0')].join('\n'));
  });

  test('null when no | script | header row exists', () => {
    expect(extractRegistrySpan('# nothing here\n')).toBeNull();
  });
});

describe('live tree invariants (post-normalization)', () => {
  test('the generator itself (L0-only) has no registry row in the mirror span (R2 proves itself)', () => {
    const mirror = readFileSync(join(import.meta.dir, '..', '..', 'templates', 'common', 'scripts', 'SCRIPTS.md'), 'utf-8');
    const span = extractRegistrySpan(mirror)!;
    const rowKeys = span.split('\n')
      .filter((l) => l.startsWith('| `'))
      .map((l) => l.split('|')[1].trim().replace(/`/g, ''));
    expect(rowKeys).not.toContain('generate-scripts-mirror.ts');
    expect(rowKeys).toHaveLength(133); // post-normalization invariant: rows == template .ts files (W5 follow-up: +6 delivered helpers, -1 generate-variant demoted to L0)
  });
});
