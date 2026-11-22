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

// T-20261122-004 / U-20261122-010, spec
// docs/designs/2026-11-22-dev-sync-skill-graph-preconvergence-design.md —
// step 3.89 (skill-graph pre-convergence) placement and the step-3.9 hint wiring.
// dev-sync.ts is not import-safe (monolithic top-level-await script), so the
// wiring is asserted textually (house pattern, see dev-sync-empty-index-guard.test.ts);
// the pure parser it relies on is pinned directly by tests/unit/audit-fail-hint.test.ts.
describe('dev-sync step 3.89 pre-convergence and step 3.9 hint (v1.53.0)', () => {
  const firstAuditCommand = 'bun scripts/audit.ts --spec-check --lifecycle-only';
  const step388 = devSyncSource.indexOf('GATE_3_88_ACTIVATED_AT = ');
  const step389 = devSyncSource.indexOf('3.89 Skill-graph pre-convergence');
  const firstAudit = devSyncSource.indexOf('bun scripts/audit.ts --spec-check --lifecycle-only');

  test('step 3.89 exists, sits after 3.88 and before the first 3.9 audit invocation', () => {
    expect(step388).toBeGreaterThan(-1);
    expect(step389).toBeGreaterThan(-1);
    expect(firstAudit).toBeGreaterThan(-1);
    expect(step389).toBeGreaterThan(step388);
    expect(step389).toBeLessThan(firstAudit);
  });

  test('3.89 is guarded on the generator existing — the same probe as step 4.65', () => {
    // Both steps probe scripts/generate-skill-graph.ts (3.89 via the design's
    // path.join const, 4.65 via its literal existsSync), so they can never
    // disagree about applicability (fresh-scaffold no-op).
    expect(devSyncSource).toContain('const preGenGraphTs = path.join("scripts", "generate-skill-graph.ts");');
    expect(devSyncSource).toContain('if (fs.existsSync(preGenGraphTs)) {');
    expect(devSyncSource).toContain('if (fs.existsSync("scripts/generate-skill-graph.ts")) {');
    // Bare invocation only — no --scope loop duplicated into 3.89.
    const step389End = devSyncSource.indexOf('// 3.9 Spec registry check');
    const scopeIn389 = devSyncSource.slice(step389, step389End).includes('--scope');
    expect(scopeIn389).toBe(false);
  });

  test('3.89 failure = WARN naming the step; staging failure = WARN; success logs the pre-convergence line', () => {
    expect(devSyncSource).toContain('⚠️  Step 3.89: skill-graph pre-regeneration failed (exit ${preGraphRes.exitCode}) — Step 3.9 will re-check');
    expect(devSyncSource).toContain('⚠️  Step 3.89: staging docs/skill-graph.json failed (exit ${addRes.exitCode}) — Step 3.9 will re-check');
    expect(devSyncSource).toContain('📋 Step 3.89: skill-graph pre-converged for the 3.9 audit');
    // The staging uses the 3.86 array-form git add idiom.
    expect(devSyncSource).toContain('git add docs/skill-graph.json');
  });

  test('the FIRST audit invocation captures (.quiet) and echoes verbatim; retries keep their form', () => {
    const first = devSyncSource.indexOf(firstAuditCommand);
    const firstBlock = devSyncSource.slice(first, first + 600);
    expect(firstBlock).toContain('.quiet()');
    // Echo right after the await — visible output unchanged.
    const echo = devSyncSource.indexOf('process.stdout.write(specRes.stdout);', first);
    expect(echo).toBeGreaterThan(first);
    expect(devSyncSource.slice(first, echo)).toContain('.nothrow()');
    // The auto-E5 retry and the early-publish heal retry are unchanged (no .quiet, no echo).
    const retry = devSyncSource.indexOf(firstAuditCommand, first + 1);
    const heal = devSyncSource.indexOf(firstAuditCommand, retry + 1);
    expect(retry).toBeGreaterThan(-1);
    expect(heal).toBeGreaterThan(-1);
    expect(devSyncSource.slice(retry, retry + 200)).not.toContain('.quiet()');
    expect(devSyncSource.slice(heal, heal + 200)).not.toContain('.quiet()');
  });

  test('the failing-sub-check hint replaces the static block; Fix lines and fallback stay', () => {
    const hintBlock = devSyncSource.indexOf('failing sub-check(s):');
    expect(hintBlock).toBeGreaterThan(firstAudit);
    expect(devSyncSource).toContain('parseAuditFailLines(String(specRes.stderr ?? ""))');
    expect(devSyncSource).toContain('formatSpecCheckHint(failMessages)');
    // Cap: the formatter carries the cap; the dev-sync side must not unroll it.
    expect(devSyncSource.slice(hintBlock, hintBlock + 400)).not.toContain('slice(0, 10)');
    // Generic fallback for zero parseable FAIL rows.
    expect(devSyncSource).toContain('The diff touches code (scripts/templates/agents) with no relevant spec activity.');
    // The two Fix lines are kept verbatim.
    expect(devSyncSource).toContain('Fix: update docs/specs/ (or docs/designs/) alongside the change, or legitimize the');
    expect(devSyncSource).toContain('--spec-exempt=E1..E5 (docs/governance/agents/execution-plan-templates.md §5.1.1 categories');
    // The no-registry INACTIVE branch is untouched.
    expect(devSyncSource).toContain('the Universal Design Gate spec-check is INACTIVE in this repository');
  });
});
