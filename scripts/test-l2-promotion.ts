#!/usr/bin/env bun
/**
 * test-l2-promotion.ts — E2E smoke test for the L2 scaffold → variant promotion path
 *
 * @version 1.0.0
 * @last_updated 2026-08-09
 *
 * Backs the `simulate-l2-promotion` skill (skills/simulate-l2-promotion/SKILL.md).
 * Exercises `scripts/create-l2-scaffold.ts` + `scripts/l2-to-variant-pipeline.ts`
 * end-to-end against a disposable fixture, as a lightweight regression guard for
 * the class of bug fixed on 2026-08-09 (see docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md,
 * Issue Set A / C):
 *
 *   - A.1: README_ko.md incorrectly scanned as an agent file by Phase 4.5
 *   - A.2: `_pipeline_report.json` reporting a nonexistent `extraSections` field
 *          instead of the real `missingOptionalSections` field
 *   - A.3: `process.exit(1)` inside `executeL2ToVariantPipeline()` killing the
 *          host process instead of returning a failure result to programmatic callers
 *
 * This is a smoke test, not a full test suite — it does NOT re-validate every
 * pipeline phase (parity/integration are skipped). It only asserts the three
 * regression classes above plus basic scaffold → pipeline plumbing.
 *
 * Usage:
 *   bun scripts/test-l2-promotion.ts
 *
 * All fixture output is written under Projects/ and tests/.temp/ and removed
 * on exit (success or failure) — nothing is written to templates/.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { $ } from 'bun';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, '..');

// ── Fixture paths (disposable, timestamp-scoped to avoid collisions) ──────────

const RUN_ID = Date.now();
const SCAFFOLD_VARIANT_NAME = `test-l2promo-${RUN_ID}`;
// create-l2-scaffold.ts hardcodes its output to Projects/<variant-name> — not
// overridable via CLI flag, so we let it do that and clean up afterward.
const L2_FIXTURE_PATH = join(WORKSPACE_ROOT, 'Projects', SCAFFOLD_VARIANT_NAME);
// l2-to-variant-pipeline.ts's --output= IS the exact variant directory (not a
// parent), so this must live inside the workspace root (path-traversal guard)
// but well away from templates/.
const PIPELINE_OUTPUT_PATH = join(WORKSPACE_ROOT, 'tests', '.temp', `l2-promotion-pipeline-${RUN_ID}`);

// ── Helpers ─────────────────────────────────────────────────────────────────

let testsRun = 0, testsPassed = 0;
let allPassed = true;

function pass(label: string) { console.log(`  ✅ ${label}`); testsPassed++; testsRun++; }
function fail(label: string, reason: string) { console.error(`  ❌ ${label}: ${reason}`); allPassed = false; testsRun++; }

function cleanup(): void {
  for (const p of [L2_FIXTURE_PATH, PIPELINE_OUTPUT_PATH]) {
    if (existsSync(p)) {
      try { rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log(`\n🧪 E2E Smoke Test — L2 scaffold → variant promotion`);
console.log(`   Scaffold variant : ${SCAFFOLD_VARIANT_NAME}`);
console.log(`   L2 fixture path  : ${L2_FIXTURE_PATH}`);
console.log(`   Pipeline output  : ${PIPELINE_OUTPUT_PATH}\n`);

cleanup(); // in case a prior crashed run left artifacts behind

try {
  // ── Test 1: Scaffold a disposable L2 fixture ───────────────────────────────
  console.log('Test 1: create-l2-scaffold.ts');
  try {
    const res = await $`bun scripts/create-l2-scaffold.ts ${SCAFFOLD_VARIANT_NAME}`.cwd(WORKSPACE_ROOT).nothrow();
    if (res.exitCode !== 0 || !existsSync(L2_FIXTURE_PATH)) {
      fail('Test 1', `exit code ${res.exitCode} / fixture directory not found at ${L2_FIXTURE_PATH}`);
    } else {
      pass('Test 1 PASSED: L2 fixture scaffolded');
    }
  } catch (e) { fail('Test 1', String(e)); }

  if (!existsSync(L2_FIXTURE_PATH)) {
    console.error('\n❌ L2 fixture not found — remaining tests skipped.');
  } else {
    // ── Test 2: Inject regression bait (A.1 / A.2 triggers) ─────────────────
    console.log('\nTest 2: Inject regression-bait fixture files');
    const agentsDir = join(L2_FIXTURE_PATH, 'agents');
    try {
      mkdirSync(agentsDir, { recursive: true });

      // A.1 bait: a Korean README that has none of the required agent sections.
      // Before the fix, Phase 4.5 scanned this as an agent file and always failed it.
      writeFileSync(
        join(agentsDir, 'README_ko.md'),
        '# 테스트 README\n\n이 파일은 에이전트 파일이 아닙니다.\n',
        'utf8',
      );

      // Intentionally incomplete agent file: only `## Role` present, missing the
      // other 6 required Layer-1 sections. Real regression bait for the
      // missingSections / missingOptionalSections reporting path (A.2), and for
      // exercising a genuine Phase 4.5 non-passing gap report entry.
      writeFileSync(
        join(agentsDir, 'incomplete-agent.md'),
        '# incomplete-agent\n\n## Role\n\nDisposable fixture agent — intentionally missing required sections.\n',
        'utf8',
      );

      pass('Test 2 PASSED: README_ko.md and incomplete-agent.md injected');
    } catch (e) { fail('Test 2', String(e)); }

    // ── Test 3: Run the pipeline programmatically (A.3 regression check) ────
    // Importing executeL2ToVariantPipeline() directly (rather than shelling out)
    // is the point: before the A.3 fix, a BLOCKING Phase 3.5/4.5 failure called
    // process.exit(1) inside the exported function, killing this test harness's
    // own process before it ever reached this line's follow-up assertions.
    console.log('\nTest 3: executeL2ToVariantPipeline() programmatic invocation');
    let pipelineResult: Awaited<ReturnType<typeof import('./l2-to-variant-pipeline.ts').executeL2ToVariantPipeline>> | undefined;
    try {
      const { executeL2ToVariantPipeline } = await import('./l2-to-variant-pipeline.ts');
      pipelineResult = await executeL2ToVariantPipeline({
        l2ProjectPath: L2_FIXTURE_PATH,
        variantName: 'co-e2etest',
        variantType: 'collaboration',
        variantDescription: 'Disposable E2E fixture for simulate-l2-promotion regression checks',
        skipParityValidation: true,
        skipIntegration: true,
        outputPath: PIPELINE_OUTPUT_PATH,
      });
      if (!pipelineResult || typeof pipelineResult.success !== 'boolean') {
        fail('Test 3', 'executeL2ToVariantPipeline() did not resolve to a PipelineResult');
      } else {
        pass(`Test 3 PASSED: pipeline call returned without killing the host process (success=${pipelineResult.success})`);
      }
    } catch (e) { fail('Test 3', String(e)); }

    // ── Test 4: _pipeline_report.json regression checks (A.1 / A.2) ─────────
    console.log('\nTest 4: _pipeline_report.json regression checks');
    const reportPath = join(PIPELINE_OUTPUT_PATH, '_pipeline_report.json');
    if (!existsSync(reportPath)) {
      fail('Test 4', `_pipeline_report.json not found at ${reportPath}`);
    } else {
      try {
        const raw = readFileSync(reportPath, 'utf8');
        const report = JSON.parse(raw) as {
          gaps: Array<{
            filePath: string;
            passed: boolean;
            missingSections: string[];
            missingOptionalSections: string[];
          }>;
        };

        // A.1: README_ko.md must never appear in the agent-file gap scan.
        const readmeKoGap = report.gaps.find(g => g.filePath.replace(/\\/g, '/').endsWith('README_ko.md'));
        if (readmeKoGap) {
          fail('Test 4a (A.1)', `README_ko.md was scanned as an agent file (regression!): ${JSON.stringify(readmeKoGap)}`);
        } else {
          pass('Test 4a PASSED: README_ko.md not scanned as an agent file (A.1 regression check)');
        }

        // A.2: field name must be missingOptionalSections; the raw JSON must
        // never contain the old, always-empty `extraSections` field name.
        if (raw.includes('extraSections')) {
          fail('Test 4b (A.2)', '_pipeline_report.json still contains the stale `extraSections` field name');
        } else {
          pass('Test 4b PASSED: no stale `extraSections` field in report (A.2 regression check)');
        }

        // Sanity: the intentionally incomplete agent file should show up as a
        // genuine, non-passing gap with populated missingSections — proves the
        // parsing/classification path actually ran, not just skipped everything.
        const incompleteGap = report.gaps.find(g => g.filePath.replace(/\\/g, '/').endsWith('incomplete-agent.md'));
        if (!incompleteGap) {
          fail('Test 4c', 'incomplete-agent.md not found in gap report at all');
        } else if (incompleteGap.passed || incompleteGap.missingSections.length === 0) {
          fail('Test 4c', `incomplete-agent.md expected to fail with missing sections, got: ${JSON.stringify(incompleteGap)}`);
        } else {
          pass(`Test 4c PASSED: incomplete-agent.md correctly flagged (${incompleteGap.missingSections.length} missing sections)`);
        }
      } catch (e) { fail('Test 4', String(e)); }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Test Summary');
  console.log(`   Tests run:    ${testsRun}`);
  console.log(`   Tests passed: ${testsPassed}`);
  console.log(`   Result: ${allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);
} finally {
  cleanup();
}

if (import.meta.main) {
  process.exit(allPassed ? 0 : 1);
}
