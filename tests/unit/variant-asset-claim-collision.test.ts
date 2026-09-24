/**
 * Fleet static guard for the VARIANT ASSET DIRS claim routing (T-20260924-011,
 * spec docs/designs/2026-09-25-codex-merge-claim-routing-design.md D4 row 6).
 *
 * The VARIANT ASSET DIRS pass (scripts/upgrade-project.ts) walks every top-level
 * template directory outside VARIANT_ASSET_DIR_SKIP and — since upgrade-project
 * v1.48.0 — delivers only files whose resolveClaim pass is the VARIANT ASSET
 * DIRS pass. This guard re-proves the fleet invariant at test time: for ALL
 * variants, every file the walk can visit resolves to either
 *  - VARIANT ASSET DIRS (delivered here, generic asset), or
 *  - PROCEDURES (exactly the procedures/** rels — owned by the dedicated
 *    PROCEDURES pass, add-if-missing per entry).
 *
 * Any future template directory whose name resolves to a foreign claim
 * (ADD_IF_MISSING / TEMPLATE_ONLY / MERGE / …) fails here BEFORE the pass can
 * ever mis-deliver it — the durable form of the "variant assets can never
 * clobber a foreign claim" invariant (design D2/D6).
 *
 * @version 1.0.0
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test, expect } from 'bun:test';
import { resolveClaim, VARIANT_ASSET_DIRS_PASS } from '../../scripts/lib/upgrade-policy.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const templatesDir = join(workspaceRoot, 'templates');

// Mirror of scripts/upgrade-project.ts VARIANT_ASSET_DIR_SKIP, parsed from the
// source so the two cannot drift (the script is a top-level executable and
// cannot be imported — same convention as the upgrade-policy drift guard).
const SKIP_SET: Set<string> = (() => {
  const src = readFileSync(join(workspaceRoot, 'scripts', 'upgrade-project.ts'), 'utf8');
  const m = src.match(/const VARIANT_ASSET_DIR_SKIP = new Set\(\[([^\]]*)\]\)/);
  if (!m) throw new Error('cannot parse VARIANT_ASSET_DIR_SKIP from scripts/upgrade-project.ts');
  return new Set([...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]!));
})();

function* walkFiles(root: string, prefix: string): Generator<string> {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const rel = `${prefix}/${entry.name}`;
    const abs = join(root, entry.name);
    if (statSync(abs).isDirectory()) yield* walkFiles(abs, rel);
    else yield rel;
  }
}

const variants = readdirSync(templatesDir)
  .filter((d) => d.startsWith('co-') && statSync(join(templatesDir, d)).isDirectory())
  .sort();

describe('variant asset-dir claim collision guard (T-20260924-011 fleet static guard)', () => {
  test('fleet size sanity: all 13 variant templates present', () => {
    expect(variants).toHaveLength(13);
  });

  test('every walked asset file resolves to VARIANT ASSET DIRS, except procedures/** → PROCEDURES', () => {
    const foreign: string[] = [];
    const proceduresPassRels: string[] = [];
    for (const variant of variants) {
      const variantDir = join(templatesDir, variant);
      const topDirs = readdirSync(variantDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && !SKIP_SET.has(e.name))
        .map((e) => e.name);
      for (const dirName of topDirs) {
        for (const rel of walkFiles(join(variantDir, dirName), dirName)) {
          const claim = resolveClaim(rel, variant);
          if (claim.pass === VARIANT_ASSET_DIRS_PASS) continue;
          if (claim.pass === 'PROCEDURES') {
            proceduresPassRels.push(`${variant}/${rel}`);
            continue;
          }
          foreign.push(`${variant}/${rel} → pass '${claim.pass}' (policy ${claim.policy})`);
        }
      }
    }
    expect(foreign).toEqual([]);
    // The PROCEDURES-pass set is exactly the procedures/** rels: every rel the
    // guard classifies as PROCEDURES lives under procedures/ (entries carry the
    // "<variant>/" prefix, hence the /procedures/ path-segment match).
    for (const entry of proceduresPassRels) {
      expect(entry.includes('/procedures/')).toBe(true);
    }
    // And the set is non-empty — every variant ships procedures, so a silent
    // regression to zero coverage cannot pass unnoticed.
    expect(proceduresPassRels.length).toBeGreaterThan(0);
  });

  test('every procedures/** file in the walk resolves to the PROCEDURES pass (no under-claim)', () => {
    for (const variant of variants) {
      const procDir = join(templatesDir, variant, 'procedures');
      let checked = 0;
      if (statSync(procDir, { throwIfNoEntry: false })?.isDirectory()) {
        for (const rel of walkFiles(procDir, 'procedures')) {
          expect(resolveClaim(rel, variant)).toEqual({ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' });
          checked++;
        }
      }
      expect(checked).toBeGreaterThan(0);
    }
  });
});
