#!/usr/bin/env bun
// @version 1.0.0
// @description Retroactively registers docs/designs/*.md files into docs/specs/registry.json
//              that predate spec-register.ts adoption (2026-06-24). Idempotent — skips files
//              already present in the registry. Reuses spec-register.ts's CRUD via subprocess
//              rather than reimplementing it (same pattern as variant-feature.ts).
// @usage bun scripts/spec-backfill.ts [--dry-run] [--check]
//        --dry-run  print planned (file, date, status, id) tuples, write nothing
//        --check    read-only drift report — exit non-zero if any file is unregistered
//                    (intended for the Weekly Health Check cadence, CONSTITUTION.md §9)

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

const WORKSPACE_ROOT = path.resolve(import.meta.dir, '..');
const DESIGNS_DIR = path.join(WORKSPACE_ROOT, 'docs', 'designs');
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'docs', 'specs', 'registry.json');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CHECK_ONLY = args.includes('--check');

interface SpecEntry { id: string; file: string; status: string; }
interface Registry { specs: SpecEntry[]; }

function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) return { specs: [] };
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

function slugFromFilename(filename: string): string {
  return path.basename(filename, '.md')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function dateFromFilename(filename: string): string | undefined {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-/);
  return m ? m[1] : undefined;
}

function dateFromHeader(content: string): string | undefined {
  const head = content.split('\n').slice(0, 20).join('\n');
  const m = head.match(/\*\*(?:Date|Created)\*\*:\s*(\d{4}-\d{2}-\d{2})/i);
  return m ? m[1] : undefined;
}

function dateFromGitLog(absPath: string): string | undefined {
  try {
    const out = execFileSync(
      'git',
      ['log', '--follow', '--format=%ad', '--date=short', '--', absPath],
      { cwd: WORKSPACE_ROOT, encoding: 'utf-8' }
    ).trim();
    if (!out) return undefined;
    const lines = out.split('\n').filter(Boolean);
    return lines[lines.length - 1]; // oldest entry = first commit that touched this file
  } catch {
    return undefined;
  }
}

type MappedStatus = 'draft' | 'proposed' | 'approved' | 'implemented' | 'drifted';

function statusFromHeader(content: string): { status: MappedStatus; defaulted: boolean } {
  const head = content.split('\n').slice(0, 20).join('\n');
  const m = head.match(/\*\*Status\*\*:\s*(.+)/i);
  if (!m) return { status: 'implemented', defaulted: true };
  const raw = m[1].toLowerCase();
  if (/deprecat|supersed|drift/.test(raw)) return { status: 'drifted', defaulted: false };
  if (/draft/.test(raw)) return { status: 'draft', defaulted: false };
  if (/propos/.test(raw)) return { status: 'proposed', defaulted: false };
  if (/approv/.test(raw)) return { status: 'approved', defaulted: false };
  if (/implement|complete|done/i.test(raw)) return { status: 'implemented', defaulted: false };
  // Status field present but unrecognized (e.g. "Active — Wave 2a") — safest default, flagged.
  return { status: 'implemented', defaulted: true };
}

const registry = loadRegistry();
const registeredFiles = new Set(registry.specs.map(s => s.file));

if (!fs.existsSync(DESIGNS_DIR)) {
  console.error(`${RED}docs/designs/ not found${RESET}`);
  if (import.meta.main) process.exit(1);
}

const designFiles = fs.readdirSync(DESIGNS_DIR)
  .filter(f => f.endsWith('.md'))
  .sort();

interface Planned { file: string; date: string; status: MappedStatus; id: string; defaulted: boolean }
const planned: Planned[] = [];

for (const filename of designFiles) {
  const relPath = path.join('docs', 'designs', filename).split(path.sep).join('/');
  if (registeredFiles.has(relPath)) continue;

  const absPath = path.join(DESIGNS_DIR, filename);
  const content = fs.readFileSync(absPath, 'utf-8');

  const date = dateFromFilename(filename) ?? dateFromHeader(content) ?? dateFromGitLog(absPath);
  if (!date) {
    console.error(`${RED}Could not determine a date for ${relPath} — skipping${RESET}`);
    continue;
  }

  const { status, defaulted } = statusFromHeader(content);
  const filenamePrefixed = dateFromFilename(filename) !== undefined;
  const id = filenamePrefixed ? slugFromFilename(filename) : `${date}-${slugFromFilename(filename)}`;

  planned.push({ file: relPath, date, status, id, defaulted });
}

if (planned.length === 0) {
  console.log(`${GREEN}Nothing to backfill — all docs/designs/*.md files are already registered.${RESET}`);
  if (import.meta.main) process.exit(0);
}

if (CHECK_ONLY) {
  console.log(`${YELLOW}${planned.length} unregistered design doc(s):${RESET}`);
  for (const p of planned) console.log(`  ${p.file}`);
  if (import.meta.main) process.exit(1);
}

console.log(`${CYAN}${DRY_RUN ? 'Planned' : 'Registering'} ${planned.length} spec(s):${RESET}\n`);
for (const p of planned) {
  console.log(`  ${p.id}  [${p.status}]  ${p.file}`);
}

const defaultedList = planned.filter(p => p.defaulted);
if (defaultedList.length > 0) {
  console.log(`\n${YELLOW}${defaultedList.length} file(s) defaulted to "implemented" — no **Status** header found or unrecognized value. Spot-check these:${RESET}`);
  for (const p of defaultedList) console.log(`  ${p.file}`);
}

if (DRY_RUN) {
  console.log(`\n${YELLOW}DRY RUN — no changes written.${RESET}`);
  if (import.meta.main) process.exit(0);
}

let registered = 0;
let failed = 0;
for (const p of planned) {
  try {
    execFileSync(
      'bun',
      ['scripts/spec-register.ts', '--file', p.file, '--source', 'manual', '--status', p.status, '--id', p.id],
      { cwd: WORKSPACE_ROOT, stdio: 'pipe' }
    );
    registered++;
  } catch (e) {
    console.error(`${RED}Failed to register ${p.file}: ${e}${RESET}`);
    failed++;
  }
}

console.log(`\n${GREEN}Registered ${registered} spec(s).${RESET}${failed > 0 ? ` ${RED}${failed} failure(s).${RESET}` : ''}`);
if (import.meta.main) {
  process.exit(failed > 0 ? 1 : 0);
}
