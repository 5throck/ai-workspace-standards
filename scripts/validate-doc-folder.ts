#!/usr/bin/env bun
/**
 * Validate docs/ folder structure compliance
 * @version 1.2.1
 * v1.2.1 (2026-10-04): allowlist aligned with the docs consolidation (guides/ added;
 *           analysis/audits/superpowers removed from the manifest and the gate).
 * v1.2.0 (2026-10-04, spec 2026-10-04-docs-folder-manifest-design): --workspace mode —
 *           enforces the docs/ top-level manifest (docs/README.md): every directory and
 *           loose file must be allowlisted, so folder proliferation fails the audit
 *           instead of accreting. Default mode (no flag) keeps the project-facing
 *           required-folders check unchanged.
 * Ensures required subdirectories exist in docs/ folder
 */

import fs from 'fs';
import path from 'path';
import { resolve } from 'node:path';
import { ErrorPhase, die, withSyncErrorHandling } from './lib/error-handling.ts';

interface ValidationResult {
  success: boolean;
  docsExists: boolean;
  missingFolders: string[];
  presentFolders: string[];
}

// Required subdirectories in docs/
const REQUIRED_FOLDERS = [
  'constitution',
  'governance',
  'lifecycle',
];

// Optional subdirectories (checked but not required)
const OPTIONAL_FOLDERS = [
  'variant',
  'superpowers',
];

// ── Workspace manifest (docs/README.md is the human SSOT; this is the machine gate) ──

/** Allowed top-level DIRECTORIES under docs/ at the workspace root. */
const ALLOWED_DIRS: ReadonlySet<string> = new Set([
  'adr', 'architecture', 'archive', 'constitution', 'decisions',
  'designs', 'evidence', 'examples', 'governance', 'graph-deltas', 'guides', 'lifecycle',
  'reports', 'security', 'specs', 'standards', 'templates',
]);

/** Allowed loose FILES at docs/ root: the two indexes, the version manifest, the
 * machine projections (generator-declared names), and the established top-level
 * guides indexed in docs/index.md. */
const ALLOWED_ROOT_FILES: ReadonlySet<string> = new Set([
  'README.md', 'index.md', 'VERSION_MANIFEST.md',
  'workspace-schema.json', 'self-managed-surfaces.json', 'skill-graph.json',
  'skill-graph.md', 'skill-graph.overrides.json', 'surface-gaps.json',
  'variant-roadmap-2026-q3-q4.md', 'variant-benchmark-backlog.md',
]);

interface WorkspaceFinding {
  entry: string;
  kind: 'unknown-dir' | 'unknown-file';
}

function validateWorkspaceTree(docsPath: string): { findings: WorkspaceFinding[] } {
  const findings: WorkspaceFinding[] = [];
  for (const entry of fs.readdirSync(docsPath, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue;
    if (entry.isDirectory()) {
      if (!ALLOWED_DIRS.has(entry.name)) findings.push({ entry: `${entry.name}/`, kind: 'unknown-dir' });
    } else if (!ALLOWED_ROOT_FILES.has(entry.name)) {
      findings.push({ entry: entry.name, kind: 'unknown-file' });
    }
  }
  return { findings };
}

function validateDocsFolder(docsPath: string): ValidationResult {
  const result: ValidationResult = {
    success: false,
    docsExists: false,
    missingFolders: [],
    presentFolders: [],
  };

  // Check if docs/ directory exists
  if (!fs.existsSync(docsPath)) {
    return result;
  }

  result.docsExists = true;

  // Check required folders
  for (const folder of REQUIRED_FOLDERS) {
    const folderPath = path.join(docsPath, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      result.presentFolders.push(folder);
    } else {
      result.missingFolders.push(folder);
    }
  }

  // Check optional folders (for reporting)
  for (const folder of OPTIONAL_FOLDERS) {
    const folderPath = path.join(docsPath, folder);
    if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
      result.presentFolders.push(folder);
    }
  }

  // Validation passes if all required folders exist
  result.success = result.missingFolders.length === 0;

  return result;
}

function runWorkspaceMode(docsPath: string): void {
  console.log('🔍 Validating docs/ folder manifest (workspace mode)...');
  console.log(`   Path: ${docsPath}`);
  console.log('');

  if (!fs.existsSync(docsPath)) {
    die('docs/ directory does not exist', 1);
  }

  const { findings } = validateWorkspaceTree(docsPath);
  if (findings.length > 0) {
    console.log('❌ Entries not in the docs/ manifest (docs/README.md):');
    for (const f of findings) {
      console.log(`   ❌ docs/${f.entry} — ${f.kind === 'unknown-dir' ? 'unknown directory' : 'unknown root file'}`);
    }
    console.log('');
    console.log('Fix: move the content to its default home (docs/README.md §3 decision table), or —');
    console.log('when no default home fits — add ALL of: a manifest row, a decision reference');
    console.log('(ADR or spec-registered design), and an allowlist entry in validate-doc-folder.ts.');
    die(`${findings.length} unmanifested docs/ entr${findings.length === 1 ? 'y' : 'ies'}`, 1);
  }

  console.log(`✅ docs/ tree matches the manifest (${ALLOWED_DIRS.size} directories, ${ALLOWED_ROOT_FILES.size} root files allowlisted)`);
  process.exit(0);
}

function main(): void {
  const workspaceRoot = resolve(import.meta.dir, '..');
  const docsPath = path.join(workspaceRoot, 'docs');

  // --workspace: enforce the docs/ top-level manifest (L0 folder governance).
  if (process.argv.includes('--workspace')) {
    runWorkspaceMode(docsPath);
  }

  console.log('🔍 Validating docs/ folder structure...');
  console.log(`   Path: ${docsPath}`);
  console.log('');

  const result = validateDocsFolder(docsPath);

  if (!result.docsExists) {
    die('docs/ directory does not exist — please create the docs/ directory structure', 1);
  }

  console.log('✅ docs/ directory exists');
  console.log('');

  // Report required folders
  console.log('Required subdirectories:');
  for (const folder of REQUIRED_FOLDERS) {
    if (result.presentFolders.includes(folder)) {
      console.log(`   ✅ docs/${folder}/ exists`);
    } else {
      console.log(`   ❌ docs/${folder}/ missing`);
    }
  }

  // Report optional folders
  const optionalPresent = OPTIONAL_FOLDERS.filter(f => result.presentFolders.includes(f));
  if (optionalPresent.length > 0) {
    console.log('');
    console.log('Optional subdirectories (present):');
    for (const folder of optionalPresent) {
      console.log(`   ℹ️  docs/${folder}/ exists`);
    }
  }

  console.log('');
  console.log('📊 Validation Summary:');
  console.log(`   Required folders present: ${result.presentFolders.filter(f => REQUIRED_FOLDERS.includes(f)).length}/${REQUIRED_FOLDERS.length}`);
  console.log(`   Missing required folders: ${result.missingFolders.length}`);

  if (result.missingFolders.length > 0) {
    console.log('');
    console.log('⚠️  Missing required folders:');
    for (const folder of result.missingFolders) {
      console.log(`   → docs/${folder}/`);
    }
    console.log('');
    console.log('Please create missing directories:');
    console.log('   mkdir -p docs/constitution docs/governance docs/lifecycle');
    die('Missing required docs/ subdirectories', 1);
  } else {
    console.log('');
    console.log('✅ All required docs/ subdirectories exist');
    process.exit(0);
  }
}

// Run validation
withSyncErrorHandling(ErrorPhase.AUDIT, main);
