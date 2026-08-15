#!/usr/bin/env bun
/**
 * test-l3-to-variant-promotion.ts — E2E smoke test for the L3 scaffold → variant promotion path
 *
 * @version 1.0.2
 * @last_updated 2026-08-09
 *
 * Backs the `simulate-l3-to-variant-promotion` skill (skills/simulate-l3-to-variant-promotion/SKILL.md).
 * Exercises `scripts/create-l3-scaffold.ts` + `scripts/l3-to-variant-pipeline.ts`
 * end-to-end against a disposable fixture, as a lightweight regression guard for
 * the class of bug fixed on 2026-08-09 (see docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md,
 * Issue Set A / C):
 *
 *   - A.1: README_ko.md incorrectly scanned as an agent file by Phase 4.5
 *   - A.2: `_pipeline_report.json` reporting a nonexistent `extraSections` field
 *          instead of the real `missingOptionalSections` field
 *   - A.3: `process.exit(1)` inside `executeL3ToVariantPipeline()` killing the
 *          host process instead of returning a failure result to programmatic callers
 *
 * This is a smoke test, not a full test suite — it does NOT re-validate every
 * pipeline phase (parity/integration are skipped). It only asserts the three
 * regression classes above plus basic scaffold → pipeline plumbing.
 *
 * Usage:
 *   bun scripts/test-l3-to-variant-promotion.ts
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
const SCAFFOLD_VARIANT_NAME = `test-l3promo-${RUN_ID}`;
// create-l3-scaffold.ts hardcodes its output to Projects/<variant-name> — not
// overridable via CLI flag, so we let it do that and clean up afterward.
const L3_FIXTURE_PATH = join(WORKSPACE_ROOT, 'Projects', SCAFFOLD_VARIANT_NAME);
// l3-to-variant-pipeline.ts's --output= IS the exact variant directory (not a
// parent), so this must live inside the workspace root (path-traversal guard)
// but well away from templates/.
const PIPELINE_OUTPUT_PATH = join(WORKSPACE_ROOT, 'tests', '.temp', `l3-promotion-pipeline-${RUN_ID}`);
// regenerate-agents-md.ts hardcodes its lookup to templates/<variant>/ (no --path
// flag), so to regenerate the fixture's AGENTS.md we stage its variant.json under
// a disposable templates/ subdirectory, run the script against that, then copy
// the regenerated AGENTS.md back onto the fixture (see Test 2.5 below).
const AGENTS_MD_STAGING_NAME = `${SCAFFOLD_VARIANT_NAME}-agentsmd-stage`;
const AGENTS_MD_STAGING_PATH = join(WORKSPACE_ROOT, 'templates', AGENTS_MD_STAGING_NAME);

// ── Helpers ─────────────────────────────────────────────────────────────────

let testsRun = 0, testsPassed = 0;
let allPassed = true;

function pass(label: string) { console.log(`  ✅ ${label}`); testsPassed++; testsRun++; }
function fail(label: string, reason: string) { console.error(`  ❌ ${label}: ${reason}`); allPassed = false; testsRun++; }

function cleanup(): void {
  for (const p of [L3_FIXTURE_PATH, PIPELINE_OUTPUT_PATH, AGENTS_MD_STAGING_PATH]) {
    if (existsSync(p)) {
      try { rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log(`\n🧪 E2E Smoke Test — L3 scaffold → variant promotion`);
console.log(`   Scaffold variant : ${SCAFFOLD_VARIANT_NAME}`);
console.log(`   L3 fixture path  : ${L3_FIXTURE_PATH}`);
console.log(`   Pipeline output  : ${PIPELINE_OUTPUT_PATH}\n`);

cleanup(); // in case a prior crashed run left artifacts behind

try {
  // ── Test 1: Scaffold a disposable L3 fixture ───────────────────────────────
  console.log('Test 1: create-l3-scaffold.ts');
  try {
    const res = await $`bun scripts/create-l3-scaffold.ts ${SCAFFOLD_VARIANT_NAME}`.cwd(WORKSPACE_ROOT).nothrow();
    if (res.exitCode !== 0 || !existsSync(L3_FIXTURE_PATH)) {
      fail('Test 1', `exit code ${res.exitCode} / fixture directory not found at ${L3_FIXTURE_PATH}`);
    } else {
      pass('Test 1 PASSED: L3 fixture scaffolded');
    }
  } catch (e) { fail('Test 1', String(e)); }

  if (!existsSync(L3_FIXTURE_PATH)) {
    console.error('\n❌ L3 fixture not found — remaining tests skipped.');
  } else {
    // ── Test 2: Inject regression bait (A.1 / A.2 triggers) ─────────────────
    console.log('\nTest 2: Inject regression-bait fixture files');
    const agentsDir = join(L3_FIXTURE_PATH, 'agents');
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

    // ── Test 2.5: Regenerate AGENTS.md with VARIANT-* marker structure ──────
    // create-l3-scaffold.ts's stub AGENTS.md doesn't have the VARIANT-*-START/END
    // marker structure l3-to-variant-pipeline.ts's Phase 3.5 "AGENTS.md
    // §-Structure Pre-flight Check" requires — it BLOCKS before the pipeline
    // ever reaches the assertions this harness cares about (Test 4). In the real
    // template-based promotion flow, the pipeline's autoFixAgentsMd option
    // auto-regenerates via regenerate-agents-md.ts, but only when the L3 path is
    // under templates/ (isInTemplates check). This fixture lives under Projects/,
    // so that auto-fix doesn't apply; regenerate explicitly here to mirror what
    // the real flow would do.
    console.log('\nTest 2.5: regenerate-agents-md.ts AGENTS.md marker regeneration');
    try {
      mkdirSync(AGENTS_MD_STAGING_PATH, { recursive: true });
      const variantJsonSrc = join(L3_FIXTURE_PATH, 'variant.json');
      if (!existsSync(variantJsonSrc)) {
        fail('Test 2.5', `variant.json not found at ${variantJsonSrc} — cannot stage for regeneration`);
      } else {
        writeFileSync(
          join(AGENTS_MD_STAGING_PATH, 'variant.json'),
          readFileSync(variantJsonSrc, 'utf8'),
          'utf8',
        );
        const res = await $`bun scripts/regenerate-agents-md.ts --variant ${AGENTS_MD_STAGING_NAME}`.cwd(WORKSPACE_ROOT).nothrow();
        const stagedAgentsMd = join(AGENTS_MD_STAGING_PATH, 'AGENTS.md');
        if (res.exitCode !== 0 || !existsSync(stagedAgentsMd)) {
          fail('Test 2.5', `regenerate-agents-md.ts exit code ${res.exitCode} / AGENTS.md not generated at ${stagedAgentsMd}`);
        } else {
          const regenerated = readFileSync(stagedAgentsMd, 'utf8');
          writeFileSync(join(L3_FIXTURE_PATH, 'AGENTS.md'), regenerated, 'utf8');
          pass('Test 2.5 PASSED: fixture AGENTS.md regenerated with VARIANT-* marker structure');
        }
      }
    } catch (e) { fail('Test 2.5', String(e)); }

    // ── Test 2.6: Inject capability-coverage fixture agent (Phase 3.7) ──────
    // l3-to-variant-pipeline.ts's Phase 3.7 "Plugin-Based Type Validation" runs
    // a per-variantType plugin (scripts/helpers/plugins/collaboration-plugin.ts
    // for variantType: 'collaboration', used below in Test 3) that BLOCKS
    // unless some agent's frontmatter `capabilities:` list collectively covers
    // the type's required capabilities. The scaffolded fixture's only real
    // agent (agents/pm.md) carries no `capabilities:` frontmatter, so without
    // this, Phase 3.7 would block before the pipeline ever writes
    // _pipeline_report.json — the same class of problem Test 2.5 fixes for
    // Phase 3.5, just one phase later. Inject a disposable fixture agent that
    // satisfies the four required collaboration capabilities so the harness
    // can actually reach Test 4's assertions.
    console.log('\nTest 2.6: Inject capability-coverage fixture agent for Phase 3.7');
    try {
      writeFileSync(
        join(agentsDir, 'e2e-fixture-collab-agent.md'),
        [
          '---',
          'name: e2e-fixture-collab-agent',
          'capabilities: [communication, task-management, documentation, knowledge-sharing]',
          '---',
          '',
          '# e2e-fixture-collab-agent',
          '',
          'Disposable fixture agent — Phase 3.7 collaboration capability-coverage bait, not a real agent.',
          '',
        ].join('\n'),
        'utf8',
      );
      pass('Test 2.6 PASSED: capability-coverage fixture agent injected');
    } catch (e) { fail('Test 2.6', String(e)); }

    // ── Test 3: Run the pipeline programmatically (A.3 regression check) ────
    // Importing executeL3ToVariantPipeline() directly (rather than shelling out)
    // is the point: before the A.3 fix, a BLOCKING Phase 3.5/4.5 failure called
    // process.exit(1) inside the exported function, killing this test harness's
    // own process before it ever reached this line's follow-up assertions.
    console.log('\nTest 3: executeL3ToVariantPipeline() programmatic invocation');
    let pipelineResult: Awaited<ReturnType<typeof import('./l3-to-variant-pipeline.ts').executeL3ToVariantPipeline>> | undefined;
    try {
      const { executeL3ToVariantPipeline } = await import('./l3-to-variant-pipeline.ts');
      pipelineResult = await executeL3ToVariantPipeline({
        l3ProjectPath: L3_FIXTURE_PATH,
        variantName: 'co-e2etest',
        variantType: 'collaboration',
        variantDescription: 'Disposable E2E fixture for simulate-l3-to-variant-promotion regression checks',
        skipParityValidation: true,
        skipIntegration: true,
        outputPath: PIPELINE_OUTPUT_PATH,
      });
      if (!pipelineResult || typeof pipelineResult.success !== 'boolean') {
        fail('Test 3', 'executeL3ToVariantPipeline() did not resolve to a PipelineResult');
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
