/**
 * tests/validate-procedures.test.ts
 *
 * Fixture tests for scripts/validate-procedures.ts (Procedure Schema v1.0).
 * Fixtures live in tests/procedures-fixtures/templates/{co-fixt,co-bad}/.
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { validateAll } from '../scripts/validate-procedures.ts';

const ROOT = join(import.meta.dir, 'procedures-fixtures');

function issuesForLayer(root: string, layer: string, fileSuffix: string) {
  return validateAll(root).filter(
    (i) => i.layer === layer && i.file.replaceAll('\\', '/').includes(fileSuffix),
  );
}

describe('validate-procedures (L1–L8)', () => {
  test('valid fixture variant produces no issues', () => {
    const issues = validateAll(ROOT, 'co-fixt');
    expect(issues).toEqual([]);
  });

  test('L2: bad enum values (phase, status) are rejected', () => {
    const issues = issuesForLayer(ROOT, 'L2', 'co-bad/procedures/badfields');
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  test('L3: unregistered output_type is rejected', () => {
    const issues = issuesForLayer(ROOT, 'L3', 'co-bad/procedures/badvocab');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('unknown_type');
  });

  test('L4: unknown agent_key is rejected', () => {
    const issues = issuesForLayer(ROOT, 'L4', 'co-bad/procedures/badagent');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('ghost-agent');
  });

  test('L5: unknown skill_key is rejected', () => {
    const issues = issuesForLayer(ROOT, 'L5', 'co-bad/procedures/badskill');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('ghost-skill');
  });

  test('L6: unknown relation type is rejected', () => {
    const issues = issuesForLayer(ROOT, 'L6', 'co-bad/procedures/badrel');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('loves');
  });

  test('L7: unresolvable relation target is rejected', () => {
    const issues = issuesForLayer(ROOT, 'L7', 'co-bad/procedures/badrel');
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain('co-missing');
  });

  test('L8: duplicate procedure_id across workspace is rejected', () => {
    const issues = validateAll(ROOT).filter(
      (i) => i.layer === 'L8' && i.message.includes('duplicate procedure_id'),
    );
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.file.includes('dup-'))).toBe(true);
  });

  test('exit code path: full run over fixtures fails (invalid variants present)', () => {
    const issues = validateAll(ROOT);
    expect(issues.length).toBeGreaterThan(0);
  });
});
