#!/usr/bin/env bun
/**
 * test-variant-readiness.ts — Regression test for the Variant Readiness Gate (VRG)
 *
 * @version 1.0.0
 *
 * Verifies that `validate-variant-readiness.ts`:
 *   1. exits 0 (READY) for a well-formed variant, and
 *   2. exits 1 (NOT READY) for a variant missing PROMOTION_CHECKLIST.md, and
 *   3. exits 1 (NOT READY) for a variant with an unresolved agents[].file path.
 *
 * Uses temporary directories under os.tmpdir(); nothing under templates/ is touched.
 *
 * Usage:
 *   bun scripts/test-variant-readiness.ts
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const gateScript = join(import.meta.dir, 'validate-variant-readiness.ts');

let failures = 0;
function check(label: string, cond: boolean): void {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

function runGate(dir: string): number {
  const res = spawnSync(process.execPath, [gateScript, '--dir', dir], { encoding: 'utf8' });
  return res.status ?? 1;
}

function writeVariant(root: string, opts: { promotionChecklist?: boolean; resolveAgents?: boolean }): void {
  mkdirSync(join(root, 'agents'), { recursive: true });
  mkdirSync(join(root, 'skills', 'sync'), { recursive: true });
  writeFileSync(
    join(root, 'variant.json'),
    JSON.stringify(
      {
        name: 'test-vrg',
        description: 'temp VRG regression fixture',
        status: 'beta',
        agents: [{ name: 'pm', file: opts.resolveAgents === false ? 'agents/missing.md' : 'agents/pm.md' }],
        skills: [{ name: 'sync', file: 'skills/sync/SKILL.md' }],
      },
      null,
      2,
    ),
  );
  writeFileSync(join(root, 'agents', 'pm.md'), '# pm\n\nStub agent file for VRG test.\n');
  writeFileSync(join(root, 'skills', 'sync', 'SKILL.md'), '---\nname: sync\n---\n\nStub skill.\n');
  writeFileSync(join(root, 'README.md'), '# test-vrg\n');
  writeFileSync(
    join(root, 'AGENTS.md'),
    '# AGENTS\n\n<!-- VARIANT-AGENTS-START -->\nroster\n<!-- VARIANT-AGENTS-END -->\n',
  );
  if (opts.promotionChecklist !== false) {
    writeFileSync(join(root, 'PROMOTION_CHECKLIST.md'), '# PROMOTION_CHECKLIST\n');
  }
}

console.log('Variant Readiness Gate — regression test');

// 1. Valid variant -> READY (exit 0)
const validDir = join(tmpdir(), `vrg-valid-${Date.now()}`);
mkdirSync(validDir, { recursive: true });
writeVariant(validDir, { promotionChecklist: true, resolveAgents: true });
check('valid variant exits 0 (READY)', runGate(validDir) === 0);
rmSync(validDir, { recursive: true, force: true });

// 2. Missing PROMOTION_CHECKLIST.md -> NOT READY (exit 1)
const noPcDir = join(tmpdir(), `vrg-nopc-${Date.now()}`);
mkdirSync(noPcDir, { recursive: true });
writeVariant(noPcDir, { promotionChecklist: false, resolveAgents: true });
check('missing PROMOTION_CHECKLIST.md exits 1 (NOT READY)', runGate(noPcDir) === 1);
rmSync(noPcDir, { recursive: true, force: true });

// 3. Unresolved agents[].file -> NOT READY (exit 1)
const badAgentDir = join(tmpdir(), `vrg-badagent-${Date.now()}`);
mkdirSync(badAgentDir, { recursive: true });
writeVariant(badAgentDir, { promotionChecklist: true, resolveAgents: false });
check('unresolved agents[].file exits 1 (NOT READY)', runGate(badAgentDir) === 1);
rmSync(badAgentDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n✗ VRG regression test FAILED (${failures} check(s))`);
  process.exit(1);
}
console.log('\n✓ VRG regression test passed');
process.exit(0);
