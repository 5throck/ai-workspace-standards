#!/usr/bin/env bun
/**
 * test-l3-to-variant-promotion.ts — E2E smoke test for the L3 scaffold → variant promotion path
 *
 * @version 1.5.0
 * @last_updated 2026-09-16
 *
 * v1.5.0: T-20260916-005 — Test 7 absorbs the project-to-variant.ts
 *         subprocess enforcement assertions that briefly lived in
 *         tests/unit/variant-overlay-guard.test.ts: the parallel unit runner
 *         must not stage templates/co-* fixtures while other files' invariants
 *         scan the same tree; this sequential harness owns that staging.
 * v1.4.0: T-20260916-005 — Test 6 pins the variant-ization overlay guard
 *         (docs/designs/2026-09-16-variant-ization-overlay-guard-design.md):
 *         a second promotion run against an already-promoted beta variant
 *         template slot (templates/co-e2eguard-*) refuses with the documented
 *         OVERLAY GUARD message naming --overlay-variant; a stable-status slot
 *         refuses even WITH overlayVariant (no bypass); and no stray
 *         .overlay-backup-* snapshot remains in templates/ after the green
 *         Test 3 run. Tests 3–5 stay green on the explicit --output path —
 *         they double as the design §6 guard-exemption assertion (the
 *         destination is named, not derived, so the guard does not apply).
 *
 * v1.3.0: T-20260915-003 — new Test 1b pins the static L3 delivery derivation
 *         (helpers/scaffold-markers.ts deriveL3ScaffoldDelivery) against the
 *         real scaffolded fixture tree, mirroring test-new-project.ts Test 26
 *         for the other scaffold path (delivery-tree parity harness input).
 *
 * v1.2.0: Tests 2.7 / 5d / 5e — context purification regression bait
 *         (docs/designs/2026-09-10-context-purification-design.md D6): a project-only
 *         section injected into the fixture's docs/context.md must be merged into the
 *         promoted docs/co-e2etest.context.md, and a fleet-legacy `## Procedures` stub
 *         must be dropped as superseded boilerplate.
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
 * on exit (success or failure) — nothing is written to templates/, except the
 * Test 6 disposable guard fixtures (templates/co-e2eguard-*, variant.json
 * only), which are staged and removed by the same cleanup path.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { $ } from 'bun';
import { spawnSync } from 'node:child_process';
import { verifyActualTreeMatchesDerivation } from './helpers/scaffold-markers.ts';
import { OVERLAY_GUARD_PREFIX } from './lib/variant-overlay-guard.ts';

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
// Test 6 guard fixtures (T-20260916-005): disposable already-promoted variant
// slots in templates/ — variant.json only, staged and removed by cleanup().
const GUARD_FIXTURE_BETA = `co-e2eguard-beta-${RUN_ID}`;
const GUARD_FIXTURE_STABLE = `co-e2eguard-stable-${RUN_ID}`;
// Test 7 (v1.5.0): project-to-variant.ts subprocess enforcement fixtures —
// same slot shape, staged/removed by the same sequential cleanup() path.
const P2V_FIX_BETA = `co-e2p2b-${RUN_ID}`;
const P2V_FIX_STABLE = `co-e2p2s-${RUN_ID}`;
const P2V_FIX_CORRUPT = `co-e2p2c-${RUN_ID}`;
const P2V_FIXTURES = [P2V_FIX_BETA, P2V_FIX_STABLE, P2V_FIX_CORRUPT];
// Trivial L3 source (2 files, below the complexity-routing thresholds) — the
// dry-run-proceed assertion must reach the copy pipeline, not the
// full-pipeline recommendation abort a real scaffold triggers.
const P2V_SRC = join(WORKSPACE_ROOT, 'tests', '.temp', `e2eguard-p2v-src-${RUN_ID}`);

// ── Helpers ─────────────────────────────────────────────────────────────────

let testsRun = 0, testsPassed = 0;
let allPassed = true;

function pass(label: string) { console.log(`  ✅ ${label}`); testsPassed++; testsRun++; }
function fail(label: string, reason: string) { console.error(`  ❌ ${label}: ${reason}`); allPassed = false; testsRun++; }

function cleanup(): void {
  for (const p of [L3_FIXTURE_PATH, PIPELINE_OUTPUT_PATH, AGENTS_MD_STAGING_PATH,
    join(WORKSPACE_ROOT, 'templates', GUARD_FIXTURE_BETA),
    join(WORKSPACE_ROOT, 'templates', GUARD_FIXTURE_STABLE),
    ...P2V_FIXTURES.map((name) => join(WORKSPACE_ROOT, 'templates', name)),
    P2V_SRC]) {
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
    // ── Test 1b: L3 delivery derivation pinning [T-20260915-003] ────────────
    // The static derivation of what create-l3-scaffold delivers FROM
    // templates/common/ (helpers/scaffold-markers.ts deriveL3ScaffoldDelivery)
    // must match the REAL scaffolded fixture tree — the mirror of
    // test-new-project.ts Test 26. The fast delivery-tree parity harness
    // (scripts/test-scaffold-delivery-parity.ts) compares the two scaffold
    // paths using these derivations, so a drift between derivation and actual
    // scaffold behavior fails here first. Post-delivery artifacts (bun install
    // lockfiles, node_modules, .git, graft/) are excluded by the helper.
    console.log('\nTest 1b: L3 delivery derivation vs actual fixture');
    try {
      const verdict = verifyActualTreeMatchesDerivation({
        which: 'l3-scaffold',
        actualRoot: L3_FIXTURE_PATH,
        commonDir: join(WORKSPACE_ROOT, 'templates', 'common'),
        workspaceRoot: WORKSPACE_ROOT,
      });
      if (!verdict.ok) {
        const detail = [
          ...verdict.missing.map((p) => `derived but absent from fixture: ${p}`),
          ...verdict.extra.map((p) => `in fixture but not derived: ${p}`),
        ];
        fail('Test 1b', `delivery derivation drifted from actual scaffold (${detail.length} path(s)): ${detail.slice(0, 10).join('; ')}${detail.length > 10 ? '…' : ''}`);
      } else {
        pass('Test 1b PASSED: actual L3 fixture matches deriveL3ScaffoldDelivery exactly');
      }
    } catch (e) { fail('Test 1b', String(e)); }

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

    // ── Test 2.7: Inject context-purification bait (W1) ─────────────────────
    // docs/designs/2026-09-10-context-purification-design.md D1/D6. The promoted
    // variant must NOT silently lose project-only content from the L3 source's
    // docs/context.md (SKIP_IN_COPY drops that file). Inject (a) a clearly
    // project-only section that MUST be merged into the promoted
    // docs/co-e2etest.context.md, and (b) a `## Procedures` stub copied verbatim
    // from the real fleet (Projects/co-abap/docs/context.md:301-303) that MUST be
    // dropped as superseded boilerplate — its content is already carried by the
    // common template's `### Procedure Graph` and the stub shares no exact line
    // with it (token-overlap 0.600 >= W1_SUPERSEDED_THRESHOLD 0.55).
    console.log('\nTest 2.7: Inject purification-bait sections into fixture docs/context.md');
    try {
      const fixtureContextPath = join(L3_FIXTURE_PATH, 'docs', 'context.md');
      if (!existsSync(fixtureContextPath)) {
        fail('Test 2.7', `docs/context.md not found at ${fixtureContextPath}`);
      } else {
        const original = readFileSync(fixtureContextPath, 'utf8');
        const bait = [
          '## Domain Configuration Notes',
          '',
          'Fixture-unique project-only content: the co-e2etest domain enables the `e2e-fixture-mode` runtime flag (declared in `docs/e2e-config.json`) and ships a bespoke `fixtures/seeds/*.json` corpus that exists nowhere in the common template.',
          '',
          '## Procedures',
          '',
          'Structured workflows live in `procedures/<name>/schema.yaml` (ADR-0063, canonical workflow source). Validate with `bun scripts/validate-procedures.ts`; the skill graph derives procedure/output_type nodes and step edges from them.',
          '',
        ].join('\n');
        // Insert before the trailing version footer when present, else append.
        const footerMatch = original.match(/\n---\n\n\*[^*\n]+version:[^*\n]*\*\s*$/);
        const updated = footerMatch && footerMatch.index !== undefined
          ? original.slice(0, footerMatch.index).trimEnd() + '\n\n' + bait + original.slice(footerMatch.index)
          : original.trimEnd() + '\n\n' + bait;
        writeFileSync(fixtureContextPath, updated, 'utf8');
        pass('Test 2.7 PASSED: project-only section + Procedures stub injected into fixture docs/context.md');
      }
    } catch (e) { fail('Test 2.7', String(e)); }

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

    // ── Test 5: docs/context.md survives scaffold → promotion ───────────────
    // Regression guard for the class of bug this test suite originally had no
    // coverage for: create-l3-scaffold.ts silently failing to copy the common
    // docs/context.md (or l3-to-variant-pipeline.ts failing to carry it / the
    // generated docs/<variant>.context.md forward) went undetected for a real
    // scaffolded project (co-news) until a user noticed the file was missing.
    console.log('\nTest 5: docs/context.md survives scaffold and promotion');
    try {
      const scaffoldContextMd = join(L3_FIXTURE_PATH, 'docs', 'context.md');
      if (!existsSync(scaffoldContextMd)) {
        fail('Test 5a', `docs/context.md not found in scaffolded L3 fixture at ${scaffoldContextMd}`);
      } else {
        pass('Test 5a PASSED: docs/context.md present in scaffolded L3 fixture');
      }

      // generate-variant.ts's SKIP_IN_COPY deliberately excludes docs/context.md from
      // the promoted variant *template* output (templates/co-*/ never carries its own
      // docs/context.md — it's generated fresh from templates/common/docs/context.md
      // only when a real project is instantiated via new-project.ts). Assert the
      // exclusion holds rather than expecting the file to be there.
      const promotedContextMd = join(PIPELINE_OUTPUT_PATH, 'docs', 'context.md');
      const promotedVariantContextMd = join(PIPELINE_OUTPUT_PATH, 'docs', 'co-e2etest.context.md');
      if (existsSync(promotedContextMd)) {
        fail('Test 5b', `docs/context.md unexpectedly present in promoted variant TEMPLATE output at ${promotedContextMd} — should only exist in templates/common/, generated fresh at project-instantiation time`);
      } else {
        pass('Test 5b PASSED: docs/context.md correctly absent from promoted variant template output (SKIP_IN_COPY)');
      }
      if (!existsSync(promotedVariantContextMd)) {
        fail('Test 5c', `docs/co-e2etest.context.md not found in promoted variant output at ${promotedVariantContextMd}`);
      } else {
        pass('Test 5c PASSED: docs/co-e2etest.context.md generated in promoted variant output');
      }

      // Test 5d (W1 purification, D6): the project-only section injected in Test 2.7
      // must have been rescued from the convention-excluded docs/context.md into the
      // promoted <variant>.context.md (generate-variant seam + Phase 4.7 gate).
      try {
        const promotedVariantContext = existsSync(promotedVariantContextMd)
          ? readFileSync(promotedVariantContextMd, 'utf8')
          : '';
        if (
          !promotedVariantContext.includes('## Domain Configuration Notes') ||
          !promotedVariantContext.includes('e2e-fixture-mode')
        ) {
          fail('Test 5d', 'project-only section did not survive promotion into docs/co-e2etest.context.md — W1 purification lost content');
        } else {
          pass('Test 5d PASSED: project-only section merged into promoted co-e2etest.context.md (W1 purification)');
        }
      } catch (e) { fail('Test 5d', String(e)); }

      // Test 5e (W1 purification, D6): the fleet-legacy Procedures stub injected in
      // Test 2.7 is superseded boilerplate (covered by the common template's
      // Procedure Graph) and must be DROPPED, not migrated.
      try {
        const promotedVariantContext = existsSync(promotedVariantContextMd)
          ? readFileSync(promotedVariantContextMd, 'utf8')
          : '';
        const stubMarker = 'the skill graph derives procedure/output_type nodes and step edges from them';
        if (promotedVariantContext.includes(stubMarker)) {
          fail('Test 5e', 'superseded Procedures stub leaked into promoted co-e2etest.context.md — expected dropped as superseded');
        } else {
          pass('Test 5e PASSED: Procedures stub correctly dropped as superseded boilerplate');
        }
      } catch (e) { fail('Test 5e', String(e)); }
    } catch (e) { fail('Test 5', String(e)); }

    // ── Test 6: Variant-ization overlay guard (T-20260916-005) ──────────────
    // docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §6: a
    // second promotion run against an ALREADY-PROMOTED variant template slot
    // must refuse instead of silently overwriting the live tree. The harness
    // stages disposable templates/co-e2eguard-* slots (variant.json only) and
    // removes them in cleanup(), so the assertion is non-destructive to the
    // rest of the suite. The refusal happens in the pipeline's Phase 0.6 —
    // before Phase 1 — so these runs are fast and write nothing.
    console.log('\nTest 6: overlay guard — second promotion run against an occupied slot');
    try {
      const stageGuardFixture = (name: string, status: string): string => {
        const dir = join(WORKSPACE_ROOT, 'templates', name);
        mkdirSync(dir, { recursive: true });
        const manifest = JSON.stringify({ name, extends: 'common', status, version: '0.1.0', agents: [], skills: [] }, null, 2) + '\n';
        writeFileSync(join(dir, 'variant.json'), manifest, 'utf8');
        return manifest;
      };
      const { executeL3ToVariantPipeline } = await import('./l3-to-variant-pipeline.ts');

      // 6a: beta slot WITHOUT overlay authorization → refuse, naming the flag.
      const betaManifest = stageGuardFixture(GUARD_FIXTURE_BETA, 'beta');
      const betaRun = await executeL3ToVariantPipeline({
        l3ProjectPath: L3_FIXTURE_PATH,
        variantName: GUARD_FIXTURE_BETA,
        variantType: 'collaboration',
        variantDescription: 'Test 6 guard fixture — second-run refusal probe',
        skipParityValidation: true,
        skipIntegration: true,
      });
      const betaRefusal = betaRun.errors.find(e => e.phase === 'overlay-guard');
      if (
        betaRun.success !== false ||
        !betaRefusal ||
        !betaRefusal.error.includes(OVERLAY_GUARD_PREFIX) ||
        !betaRefusal.error.includes('--overlay-variant')
      ) {
        fail('Test 6a', `expected an overlay-guard refusal naming --overlay-variant, got: success=${betaRun.success}, errors=${JSON.stringify(betaRun.errors)}`);
      } else {
        pass('Test 6a PASSED: second run against an already-promoted BETA slot refuses and names --overlay-variant');
      }
      if (readFileSync(join(WORKSPACE_ROOT, 'templates', GUARD_FIXTURE_BETA, 'variant.json'), 'utf8') !== betaManifest) {
        fail('Test 6a', 'the guard refusal modified the pre-existing variant.json');
      } else {
        pass('Test 6a PASSED: refusal is non-destructive — pre-existing variant.json untouched');
      }

      // 6b: stable slot refuses EVEN WITH overlayVariant — no bypass flag exists.
      stageGuardFixture(GUARD_FIXTURE_STABLE, 'stable');
      const stableRun = await executeL3ToVariantPipeline({
        l3ProjectPath: L3_FIXTURE_PATH,
        variantName: GUARD_FIXTURE_STABLE,
        variantType: 'collaboration',
        variantDescription: 'Test 6 guard fixture — stable no-bypass probe',
        skipParityValidation: true,
        skipIntegration: true,
        overlayVariant: true,
      });
      const stableRefusal = stableRun.errors.find(e => e.phase === 'overlay-guard');
      if (
        stableRun.success !== false ||
        !stableRefusal ||
        !stableRefusal.error.includes(OVERLAY_GUARD_PREFIX) ||
        !stableRefusal.error.includes('"stable"') ||
        !stableRefusal.error.includes('no bypass flag')
      ) {
        fail('Test 6b', `expected a stable no-bypass refusal, got: success=${stableRun.success}, errors=${JSON.stringify(stableRun.errors)}`);
      } else {
        pass('Test 6b PASSED: stable slot refuses even with overlayVariant authorized (no bypass)');
      }

      // 6c: no stray .overlay-backup-* snapshot may remain under templates/.
      // The green Test 3 run uses the guard-exempt explicit --output path
      // (design §6: existing harness flow stays green = exemption proof), so
      // nothing on this suite's success path may ever snapshot into templates/.
      // Snapshots live at the templates/ top level by construction, so a plain
      // top-level readdir suffices (a recursive glob walk over the whole
      // template tree would be needlessly slow).
      const templatesDir = join(WORKSPACE_ROOT, 'templates');
      const strays = existsSync(templatesDir)
        ? readdirSync(templatesDir).filter((name) => name.startsWith('.overlay-backup-'))
        : [];
      if (strays.length > 0) {
        fail('Test 6c', `stray overlay snapshot(s) in templates/: ${strays.join(', ')}`);
      } else {
        pass('Test 6c PASSED: no .overlay-backup-* snapshot strays in templates/');
      }
    } catch (e) { fail('Test 6', String(e)); }
  }

  // ── Test 7: project-to-variant.ts overlay guard (subprocess) ─────────────
  // T-20260916-005: prove the SECOND enforcement point end-to-end via the real
  // CLI — flag parsing, exit codes, and the stable no-bypass rule. Sequential
  // here so the templates/co-* staging never overlaps another process's scan.
  console.log('\nTest 7: project-to-variant overlay guard (subprocess)');
  try {
    const stageP2vFixture = (name: string, variantJson: string): string => {
      const dir = join(WORKSPACE_ROOT, 'templates', name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'variant.json'), variantJson);
      return variantJson;
    };
    const p2vBetaManifest = stageP2vFixture(P2V_FIX_BETA, JSON.stringify({ name: P2V_FIX_BETA, extends: 'common', status: 'beta', version: '0.1.0', agents: [], skills: [] }));
    stageP2vFixture(P2V_FIX_STABLE, JSON.stringify({ name: P2V_FIX_STABLE, extends: 'common', status: 'stable', version: '1.0.0', agents: [], skills: [] }));
    stageP2vFixture(P2V_FIX_CORRUPT, '{ this is not json');
    mkdirSync(join(P2V_SRC, 'docs'), { recursive: true });
    writeFileSync(join(P2V_SRC, 'README.md'), `# e2eguard p2v fixture ${RUN_ID}\n`);
    writeFileSync(join(P2V_SRC, 'docs', 'fixture-note.md'), 'disposable overlay-guard fixture\n');
    const runP2v = (target: string, extraArgs: string[] = []): { status: number | null; out: string } => {
      const res = spawnSync('bun', ['scripts/project-to-variant.ts', '--source', P2V_SRC, '--target', target, ...extraArgs],
        { cwd: WORKSPACE_ROOT, encoding: 'utf-8', timeout: 60000 });
      return { status: res.status, out: (res.stdout ?? '') + (res.stderr ?? '') };
    };

    // 7a: beta refuses WITHOUT --overlay-variant; names the flag; non-destructive.
    const r7a = runP2v(P2V_FIX_BETA);
    const betaJson = join(WORKSPACE_ROOT, 'templates', P2V_FIX_BETA, 'variant.json');
    if (r7a.status === 1 && r7a.out.includes('OVERLAY GUARD') && r7a.out.includes('--overlay-variant')
        && existsSync(betaJson) && readFileSync(betaJson, 'utf8') === p2vBetaManifest) {
      pass('Test 7a PASSED: project-to-variant refuses an occupied BETA slot, names --overlay-variant, leaves the slot untouched');
    } else {
      fail('Test 7a', `expected exit 1 + OVERLAY GUARD + --overlay-variant + untouched fixture, got status=${r7a.status}, out=${r7a.out.slice(0, 400)}`);
    }

    // 7b: stable refuses EVEN WITH --overlay-variant (no bypass).
    const r7b = runP2v(P2V_FIX_STABLE, ['--overlay-variant']);
    if (r7b.status === 1 && r7b.out.includes('OVERLAY GUARD') && r7b.out.includes('"stable"') && r7b.out.includes('no bypass flag')) {
      pass('Test 7b PASSED: stable slot refuses even with --overlay-variant (no bypass)');
    } else {
      fail('Test 7b', `expected stable no-bypass refusal, got status=${r7b.status}, out=${r7b.out.slice(0, 400)}`);
    }

    // 7c: corrupt (unparseable variant.json) target refuses.
    const r7c = runP2v(P2V_FIX_CORRUPT, ['--overlay-variant']);
    if (r7c.status === 1 && r7c.out.includes('OVERLAY GUARD') && r7c.out.includes('missing or unparseable')) {
      pass('Test 7c PASSED: corrupt slot refuses (missing or unparseable variant.json)');
    } else {
      fail('Test 7c', `expected corrupt refusal, got status=${r7c.status}, out=${r7c.out.slice(0, 400)}`);
    }

    // 7d: beta + --overlay-variant + --dry-run proceeds — exit 0, no refusal,
    // no writes (the pre-existing tree stays byte-identical).
    const r7d = runP2v(P2V_FIX_BETA, ['--overlay-variant', '--dry-run']);
    const readmeAfter = join(WORKSPACE_ROOT, 'templates', P2V_FIX_BETA, 'README.md');
    if (r7d.status === 0 && !r7d.out.includes('OVERLAY GUARD') && r7d.out.includes('[DRY]')
        && readFileSync(betaJson, 'utf8') === p2vBetaManifest && !existsSync(readmeAfter)) {
      pass('Test 7d PASSED: authorized overlay dry-run proceeds without touching the pre-existing tree');
    } else {
      fail('Test 7d', `expected dry-run proceed (exit 0, [DRY], untouched fixture), got status=${r7d.status}, out=${r7d.out.slice(0, 400)}`);
    }
  } catch (e) { fail('Test 7', String(e)); }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(50));
  console.log('📊 Test Summary');
  console.log(`   Tests run:    ${testsRun}`);
  console.log(`   Tests passed: ${testsPassed}`);
  console.log(`   Result: ${allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);
} finally {
  if (!process.env.KEEP_FIXTURES) cleanup();
  cleanup();
}

if (import.meta.main) {
  process.exit(allPassed ? 0 : 1);
}
