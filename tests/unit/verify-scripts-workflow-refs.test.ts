/**
 * Unit tests for the verify-scripts.ts Check 10 workflow-reference scanner
 * (v1.15.0, U-20261112-014): every `bun scripts/<name>.ts` reference in
 * .github/workflows/*.yml|*.yaml must resolve to an existing file under the
 * context root — the T-20261108-008 prune-recurrence class (a deleted script
 * left ci.yml invoking it and no gate scanned workflow files).
 *
 * The scanner is pure; the filesystem existence check is exercised by the
 * --verify run, the extraction/dedup contract here.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { findDanglingWorkflowScriptRefs } from '../../scripts/verify-scripts.ts';

describe('findDanglingWorkflowScriptRefs (U-20261112-014)', () => {
  test('extracts every bun scripts/*.ts reference across workflows', () => {
    const refs = findDanglingWorkflowScriptRefs([
      {
        name: 'ci.yml',
        content: [
          'jobs:',
          '  audit:',
          '    steps:',
          '      - run: bun scripts/audit.ts',
          '      - run: bun scripts/verify-scripts.ts --verify',
        ].join('\n'),
      },
    ]);
    expect(refs).toEqual([
      { workflow: 'ci.yml', script: 'scripts/audit.ts' },
      { workflow: 'ci.yml', script: 'scripts/verify-scripts.ts' },
    ]);
  });

  test('matches .yml and .yaml and handles multiline run blocks', () => {
    const refs = findDanglingWorkflowScriptRefs([
      { name: 'a.yml', content: 'run: |\n  bun scripts/typecheck.ts\n  echo done\n' },
      { name: 'b.yaml', content: 'script: bun scripts/ticket.ts list --ready\n' },
    ]);
    expect(refs.map((r) => r.script).sort()).toEqual(['scripts/ticket.ts', 'scripts/typecheck.ts']);
  });

  test('ignores non-bun invocations and non-.ts targets', () => {
    const refs = findDanglingWorkflowScriptRefs([
      {
        name: 'ci.yml',
        content: 'run: node scripts/hooks/legacy.cjs && npx some-tool && bun scripts/audit.ts',
      },
    ]);
    expect(refs).toEqual([{ workflow: 'ci.yml', script: 'scripts/audit.ts' }]);
  });

  test('deduplicates repeated references within one workflow', () => {
    const refs = findDanglingWorkflowScriptRefs([
      { name: 'ci.yml', content: 'run: bun scripts/audit.ts\nother: bun scripts/audit.ts\n' },
    ]);
    expect(refs).toEqual([{ workflow: 'ci.yml', script: 'scripts/audit.ts' }]);
  });

  test('empty workflow list → no refs', () => {
    expect(findDanglingWorkflowScriptRefs([])).toEqual([]);
  });
});
