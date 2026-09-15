#!/usr/bin/env bun
/**
 * test-scaffold-delivery-parity.ts — Delivery-tree parity between the two scaffold paths
 *
 * @version 1.0.0
 * @last_updated 2026-09-16
 *
 * T-20260915-003 (H13): create-l3-scaffold.ts excludes top-level docs/ beyond
 * _common and all of .agents/ via COMMON_OVERLAY_EXCLUDE, while new-project.ts
 * delivers them — every new templates/common/docs file silently widened the
 * gap. This harness makes the gap LOUD and bounded:
 *
 *   1. Derive both delivery trees statically from templates/common/ via the
 *      shared helpers in scripts/helpers/scaffold-markers.ts (fast — no
 *      scaffolding; the derivations are pinned against REAL scaffolded trees
 *      by test-new-project.ts Test 26 and test-l3-to-variant-promotion.ts
 *      Test 1b, so static here does not mean unverified).
 *   2. Compute the gap: newProject \ l3.
 *   3. Assert the gap equals REVIEWED_DELIVERY_EXCLUSIONS exactly — every gap
 *      file covered by a reviewed rule (nothing more), no stale exact rule,
 *      no stale prefix rule.
 *
 * A new file under templates/common/docs/ (or any other not-yet-reviewed gap
 * location) fails this harness until the gap is fixed in delivery logic or
 * consciously added to REVIEWED_DELIVERY_EXCLUSIONS with a reason.
 *
 * Usage:
 *   bun scripts/test-scaffold-delivery-parity.ts
 *
 * Spec: docs/designs/2026-09-16-scaffold-delivery-validation-design.md
 */

import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCommonUniverse,
  deriveNewProjectDelivery,
  deriveL3ScaffoldDelivery,
  diffDeliveryTrees,
  reviewedExclusionCoverage,
} from './helpers/scaffold-markers.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, '..');
const COMMON_DIR = join(WORKSPACE_ROOT, 'templates', 'common');

let failures = 0;

function fail(msg: string): void {
  console.error(`❌ ${msg}`);
  failures++;
}

function pass(msg: string): void {
  console.log(`✅ ${msg}`);
}

console.log('🧪 Scaffold delivery-tree parity (new-project vs create-l3-scaffold)');
console.log(`   templates/common: ${COMMON_DIR}\n`);

if (!require('node:fs').existsSync(COMMON_DIR)) {
  fail(`templates/common/ not found at ${COMMON_DIR}`);
  process.exit(1);
}

const newProjectSet = deriveNewProjectDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT });
const l3Set = deriveL3ScaffoldDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT });
const universe = buildCommonUniverse(COMMON_DIR);

console.log(`   new-project delivers: ${newProjectSet.size} common file(s)`);
console.log(`   l3 scaffold delivers: ${l3Set.size} common file(s) (of ${universe.size} common file(s))\n`);

// ── Check 1: gap ⊆ reviewed (nothing more) ─────────────────────────────────────
const gap = diffDeliveryTrees(newProjectSet, l3Set);
const coverage = reviewedExclusionCoverage(gap);

if (coverage.uncovered.length > 0) {
  fail(`delivery gap contains ${coverage.uncovered.length} file(s) NOT covered by REVIEWED_DELIVERY_EXCLUSIONS — a new silent gap (H13 class). Fix the delivery logic in create-l3-scaffold.ts, or consciously add the file(s) with a review reason:`);
  for (const rel of coverage.uncovered) console.error(`     - ${rel}`);
} else {
  pass(`delivery gap fully covered by REVIEWED_DELIVERY_EXCLUSIONS (${gap.size} gap file(s))`);
}

// ── Check 2: no stale exact rules ─────────────────────────────────────────────
if (coverage.staleExact.length > 0) {
  fail(`${coverage.staleExact.length} exact REVIEWED_DELIVERY_EXCLUSIONS rule(s) match no actual gap file — dead exemptions must be pruned:`);
  for (const rel of coverage.staleExact) console.error(`     - ${rel}`);
} else {
  pass('no stale exact exclusion rules');
}

// ── Check 3: no stale prefix rules ────────────────────────────────────────────
if (coverage.stalePrefix.length > 0) {
  fail(`${coverage.stalePrefix.length} prefix REVIEWED_DELIVERY_EXCLUSIONS rule(s) cover no actual gap file — dead exemptions must be pruned:`);
  for (const rel of coverage.stalePrefix) console.error(`     - ${rel}`);
} else {
  pass('no stale prefix exclusion rules');
}

// ── Check 4 (informational): gap listing for review ───────────────────────────
if (process.argv.includes('--verbose')) {
  console.log('\n   Current reviewed gap (newProject \\ l3):');
  for (const rel of [...gap].sort()) {
    const covered = coverage.uncovered.includes(rel) ? 'UNCOVERED' : 'reviewed';
    console.log(`     [${covered}] ${rel}`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`❌ delivery-tree parity FAILED (${failures} problem(s)) — see docs/designs/2026-09-16-scaffold-delivery-validation-design.md §5`);
  process.exit(1);
}
console.log('✅ delivery-tree parity holds: gap == REVIEWED_DELIVERY_EXCLUSIONS exactly');
