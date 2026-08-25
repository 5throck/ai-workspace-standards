/**
 * Pipeline order enforcement tests for dev-sync.ts
 * Validates step sequencing invariants (e.g., cascade re-publish must follow skill sync).
 *
 * @version 1.0.0
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const devSyncPath = resolve(workspaceRoot, 'scripts', 'dev-sync.ts');
const devSyncSource = readFileSync(devSyncPath, 'utf-8');

describe('dev-sync pipeline step ordering', () => {
  // Regex matches the exact --apply invocation (not dry-run or --check-drift variants).
  // The step-4.55 marker-rewrite block uses --marker-rewrite BEFORE --apply, so its
  // command string differs and this regex correctly skips it.
  const applyInvocation = /propagate-to-templates\.ts --apply/g;

  test('at least two propagate-to-templates.ts --apply invocations exist', () => {
    const matches = devSyncSource.match(applyInvocation);
    expect(matches).toBeTruthy();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  test('last --apply invocation occurs after sync-skills.ts (4.62 heals 4.6 cascade)', () => {
    const syncSkillsIndex = devSyncSource.indexOf('bun scripts/sync-skills.ts');
    expect(syncSkillsIndex).toBeGreaterThan(-1);

    const matches = Array.from(devSyncSource.matchAll(applyInvocation));
    expect(matches.length).toBeGreaterThan(0);

    const lastApplyIndex = matches[matches.length - 1].index;
    expect(lastApplyIndex).toBeGreaterThan(syncSkillsIndex);
  });

  test('first --apply invocation occurs before sync-skills.ts (4.5 order preserved)', () => {
    const syncSkillsIndex = devSyncSource.indexOf('bun scripts/sync-skills.ts');
    expect(syncSkillsIndex).toBeGreaterThan(-1);

    const matches = Array.from(devSyncSource.matchAll(applyInvocation));
    expect(matches.length).toBeGreaterThan(0);

    const firstApplyIndex = matches[0].index;
    expect(firstApplyIndex).toBeLessThan(syncSkillsIndex);
  });
});
