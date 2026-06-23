// @version 1.0.0
/**
 * spec-register.ts
 *
 * Spec Registry CRUD -- manages docs/specs/registry.json.
 * Called by brainstorming skill, meeting skill, variant-feature.ts, audit.ts.
 *
 * Usage:
 *   bun scripts/spec-register.ts --file docs/designs/foo.md --source brainstorming
 *   bun scripts/spec-register.ts --file docs/designs/foo.md --source meeting --ref memory/meeting-2026-06-24-foo.md
 *   bun scripts/spec-register.ts --update 2026-06-24-foo --status implemented
 *   bun scripts/spec-register.ts --list
 *   bun scripts/spec-register.ts --list --status approved
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REGISTRY_PATH = path.join('docs', 'specs', 'registry.json');

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const CYAN = '[36m';
const RESET = '[0m';

type SpecStatus = 'draft' | 'approved' | 'implemented' | 'drifted';
type SpecSource = 'brainstorming' | 'meeting' | 'manual';

interface SpecEntry {
  id: string;
  title: string;
  file: string;
  status: SpecStatus;
  source: SpecSource;
  meeting_ref?: string;
  created: string;
  last_updated: string;
}

interface Registry {
  version: string;
  specs: SpecEntry[];
}

function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    return { version: '1.0.0', specs: [] };
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

function saveRegistry(registry: Registry): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

function slugFromPath(filePath: string): string {
  return path.basename(filePath, '.md')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleFromPath(filePath: string): string {
  const base = path.basename(filePath, '.md');
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

if (getArg('--file')) {
  const filePath = getArg('--file')!;
  const source = (getArg('--source') ?? 'manual') as SpecSource;
  const meetingRef = getArg('--ref');
  const statusArg = (getArg('--status') ?? (source === 'brainstorming' ? 'approved' : 'draft')) as SpecStatus;

  if (!fs.existsSync(filePath)) {
    console.error(`${RED}File not found: ${filePath}${RESET}`);
    process.exit(1);
  }

  const registry = loadRegistry();
  const id = slugFromPath(filePath);
  const existing = registry.specs.find(s => s.id === id);
  if (existing) {
    existing.last_updated = today();
    if (meetingRef) existing.meeting_ref = meetingRef;
    saveRegistry(registry);
    console.log(`${GREEN}Updated: ${id}${RESET}`);
    process.exit(0);
  }

  const entry: SpecEntry = {
    id,
    title: titleFromPath(filePath),
    file: filePath.split('\\').join('/'),
    status: statusArg,
    source,
    created: today(),
    last_updated: today(),
  };
  if (meetingRef) entry.meeting_ref = meetingRef.split('\\').join('/');
  registry.specs.push(entry);
  saveRegistry(registry);
  console.log(`${GREEN}Registered spec: ${id}${RESET}`);
  process.exit(0);
}

if (getArg('--update')) {
  const id = getArg('--update')!;
  const newStatus = getArg('--status') as SpecStatus | undefined;
  if (!newStatus) { console.error(`${RED}--update requires --status${RESET}`); process.exit(1); }
  const registry = loadRegistry();
  const entry = registry.specs.find(s => s.id === id);
  if (!entry) { console.error(`${RED}Spec not found: ${id}${RESET}`); process.exit(1); }
  const prev = entry.status;
  entry.status = newStatus;
  entry.last_updated = today();
  saveRegistry(registry);
  console.log(`${GREEN}Updated ${id}: ${prev} -> ${newStatus}${RESET}`);
  process.exit(0);
}

if (hasFlag('--list') || args.length === 0) {
  const registry = loadRegistry();
  const filterStatus = getArg('--status') as SpecStatus | undefined;
  const specs = filterStatus ? registry.specs.filter(s => s.status === filterStatus) : registry.specs;
  if (specs.length === 0) {
    console.log(`${CYAN}No specs found${filterStatus ? ` with status: ${filterStatus}` : ''}.${RESET}`);
    process.exit(0);
  }
  console.log(`${CYAN}Spec Registry (${specs.length} entries)${RESET}
`);
  for (const s of specs) {
    const c = s.status === 'implemented' ? GREEN : s.status === 'approved' ? CYAN : s.status === 'drifted' ? RED : YELLOW;
    console.log(`  ${c}[${s.status.padEnd(11)}]${RESET} ${s.id}
             ${s.file}`);
  }
  process.exit(0);
}

console.error('Usage: --file <path> --source <brainstorming|meeting|manual> | --update <id> --status <status> | --list');
process.exit(1);
