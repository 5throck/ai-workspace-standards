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

  test('step 4.51 governance-l1 runs with --apply plus the --docs injection (T-20260929-015)', () => {
    const invocation = devSyncSource.indexOf('propagate-to-templates.ts --apply --governance-l1 --docs');
    expect(invocation).toBeGreaterThan(-1);
    // The deployment precedes sync-skills.ts in the pipeline (4.51 < 4.6).
    const syncSkillsIndex = devSyncSource.indexOf('bun scripts/sync-skills.ts');
    expect(invocation).toBeLessThan(syncSkillsIndex);
    // A dry-run verification must follow the apply: it exits 1 when L1 stays
    // out of sync, failing the step instead of silently skipping the publish.
    const verify = devSyncSource.indexOf('propagate-to-templates.ts --governance-l1 --docs`', invocation);
    expect(verify).toBeGreaterThan(invocation);
  });

  // T-20261028-012, spec docs/designs/2026-10-28-dev-sync-staged-count-design.md
  // (D4: step 6.9 is a pure insertion between the step-6.5 staging block and the
  // sync-context tmp-file write / commit).
  test('step 6.9 final-message composition sits after step 6.5 staging and before the commit (T-20261028-012)', () => {
    const step69 = devSyncSource.indexOf('Step 6.9 — final message composition');
    const stagingEnd = devSyncSource.indexOf('git add -A`.nothrow()'); // WARN-soak branch closes step 6.5
    const commit = devSyncSource.indexOf('git commit -m ${msg}');
    expect(step69).toBeGreaterThan(-1);
    expect(stagingEnd).toBeGreaterThan(-1);
    expect(commit).toBeGreaterThan(-1);
    expect(step69).toBeGreaterThan(stagingEnd);
    expect(step69).toBeLessThan(commit);
    // D2: the re-derivation consumes the retained caller message (originalMsg),
    // not the early-composed msg — weak-message replacement semantics preserved.
    expect(devSyncSource).toContain('composeCommitMessage(originalMsg, finalStagedPaths)');
    // The no-op early exit stays first and unchanged: it precedes the step-1
    // composition block.
    const noopExit = devSyncSource.indexOf('nothing to sync');
    const step1Composition = devSyncSource.indexOf('composeCommitMessage(msg, stagedPaths)');
    expect(noopExit).toBeGreaterThan(-1);
    expect(step1Composition).toBeGreaterThan(-1);
    expect(noopExit).toBeLessThan(step1Composition);
  });
});
