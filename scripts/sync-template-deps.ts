#!/usr/bin/env bun
// @version 1.0.0
/**
 * sync-template-deps.ts — Automatic dependency version sync
 *
 * Aligns shared dependency versions from root package.json to templates/common/package.json,
 * then regenerates bun.lock. Root package.json is the SSOT for dependency versions.
 *
 * Usage:
 *   bun scripts/sync-template-deps.ts [--check|--apply]
 *
 * Modes:
 *   --check (default): Report drift without modifying files (exit 1 if drift found)
 *   --apply: Align versions and regenerate bun.lock
 *
 * Sync policy:
 *   - Shared deps (present in both root and template): aligned to root version
 *   - Root-only deps: NOT auto-added to template (e.g., semver, @types/js-yaml)
 *   - Template-only deps: NOT auto-removed (manual decision required)
 *   - engines: aligned if shared fields differ
 *
 * Runs automatically in dev-sync step 4.52 (after propagate step 4.5, before audit step 4.9).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// TYPES
// ============================================================================

export interface DepDrift {
  key: string;
  section: 'dependencies' | 'devDependencies';
  rootVersion: string;
  templateVersion: string;
}

export interface DepReportEntry {
  key: string;
  section: string;
}

export interface AlignResult {
  changed: DepDrift[];
  rootOnly: DepReportEntry[];
  templateOnly: DepReportEntry[];
  enginesChanged: boolean;
}

// ============================================================================
// CORE ALIGNMENT LOGIC (unit-testable, no fs/CLI)
// ============================================================================

/**
 * Aligns template package.json dependencies to root package.json.
 * Mutates templatePkg in place for shared keys; preserves key order.
 *
 * @param rootPkg - Root package.json object
 * @param templatePkg - Template package.json object (mutated in place)
 * @returns Alignment result with drift lists and change flag
 */
export function alignTemplateDeps(rootPkg: any, templatePkg: any): AlignResult {
  const result: AlignResult = {
    changed: [],
    rootOnly: [],
    templateOnly: [],
    enginesChanged: false,
  };

  const sections: Array<'dependencies' | 'devDependencies'> = ['dependencies', 'devDependencies'];

  for (const section of sections) {
    const rootSection = rootPkg[section] || {};
    const templateSection = templatePkg[section] || {};

    // Find shared keys and report drift
    for (const key of Object.keys(templateSection)) {
      if (key in rootSection) {
        const rootVersion = rootSection[key];
        const templateVersion = templateSection[key];

        // Exact string comparison — range format differences count as drift
        if (rootVersion !== templateVersion) {
          result.changed.push({ key, section, rootVersion, templateVersion });
          templateSection[key] = rootVersion; // Align in place (preserves order)
        }
      } else {
        result.templateOnly.push({ key, section });
      }
    }

    // Report root-only keys (informational only, never added)
    for (const key of Object.keys(rootSection)) {
      if (!(key in templateSection)) {
        result.rootOnly.push({ key, section });
      }
    }
  }

  // Compare engines fields if both present
  if (rootPkg.engines && templatePkg.engines) {
    for (const field of Object.keys(rootPkg.engines)) {
      if (field in templatePkg.engines && templatePkg.engines[field] !== rootPkg.engines[field]) {
        result.enginesChanged = true;
        templatePkg.engines[field] = rootPkg.engines[field];
      }
    }
  }

  return result;
}

// ============================================================================
// CLI BEHAVIOR (guarded by import.meta.main)
// ============================================================================

if (import.meta.main) {
  const mode = process.argv.includes('--apply') ? 'apply' : 'check';

  // Resolve paths relative to script directory
  const workspaceRoot = path.resolve(import.meta.dir, '..');
  const rootPkgPath = path.join(workspaceRoot, 'package.json');
  const templatePkgPath = path.join(workspaceRoot, 'templates', 'common', 'package.json');

  // L1/L3 context check: skip if template package.json doesn't exist
  if (!fs.existsSync(templatePkgPath)) {
    console.log('ℹ️  templates/common/package.json not found (L1/L3 context) — skipping');
    process.exit(0);
  }

  // Load and parse package.json files
  let rootPkg: any;
  let templatePkg: any;

  try {
    rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    templatePkg = JSON.parse(fs.readFileSync(templatePkgPath, 'utf-8'));
  } catch (err) {
    console.error('❌ Failed to parse package.json files');
    console.error(String(err));
    process.exit(1);
  }

  if (mode === 'check') {
    // Check mode: report drift only
    const result = alignTemplateDeps(rootPkg, { ...templatePkg }); // Clone to avoid mutation

    if (result.changed.length === 0 && !result.enginesChanged) {
      console.log('✓ Template dependencies are in sync with root package.json');
      process.exit(0);
    }

    // Print drift table
    console.log('⚠️  Dependency drift detected:\n');
    for (const drift of result.changed) {
      console.log(`  ${drift.section}.${drift.key}: "${drift.templateVersion}" → "${drift.rootVersion}"`);
    }
    if (result.enginesChanged) {
      console.log('  engines: values differ');
    }

    // Print informational lists (INFO level, no exit code impact)
    if (result.rootOnly.length > 0) {
      console.log('\nℹ️  Root-only dependencies (not auto-added to template):');
      for (const entry of result.rootOnly) {
        console.log(`  ${entry.section}.${entry.key}`);
      }
    }
    if (result.templateOnly.length > 0) {
      console.log('\nℹ️  Template-only dependencies (not auto-removed):');
      for (const entry of result.templateOnly) {
        console.log(`  ${entry.section}.${entry.key}`);
      }
    }

    process.exit(1); // Drift found → fail check
  }

  if (mode === 'apply') {
    // Apply mode: align and regenerate lock
    const result = alignTemplateDeps(rootPkg, templatePkg);

    if (result.changed.length === 0 && !result.enginesChanged) {
      console.log('✓ Template dependencies already in sync — no install needed');
      process.exit(0);
    }

    // Write aligned package.json
    try {
      const written = fs.writeFileSync(
        templatePkgPath,
        JSON.stringify(templatePkg, null, 2) + '\n',
        'utf-8'
      );
      console.log(`✓ Wrote ${templatePkgPath}`);
    } catch (err) {
      console.error('❌ Failed to write template package.json');
      console.error(String(err));
      process.exit(1);
    }

    // Regenerate bun.lock
    const templateDir = path.dirname(templatePkgPath);
    console.log('📦 Regenerating templates/common/bun.lock...');

    try {
      const install = Bun.spawn(['bun', 'install'], {
        cwd: templateDir,
        stdout: 'inherit',
        stderr: 'inherit',
      });

      const exitCode = await install.exited;
      if (exitCode !== 0) {
        console.error(`\n❌ bun install failed (exit ${exitCode})`);
        console.error('   Run manually: cd templates/common && bun install');
        process.exit(1);
      }

      console.log('✓ bun install completed');
    } catch (err) {
      console.error('❌ Failed to spawn bun install');
      console.error(String(err));
      console.error('   Run manually: cd templates/common && bun install');
      process.exit(1);
    }

    // Print summary
    console.log('\n✓ Aligned dependencies:');
    for (const drift of result.changed) {
      console.log(`  ${drift.section}.${drift.key}: "${drift.templateVersion}" → "${drift.rootVersion}"`);
    }
    if (result.enginesChanged) {
      console.log('  engines: aligned');
    }

    process.exit(0);
  }
}
