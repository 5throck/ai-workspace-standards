// @version 1.2.0
/**
 * spec-register.ts
 *
 * Spec Registry CRUD -- manages docs/specs/registry.json.
 * Called by brainstorming skill, meeting skill, variant-feature.ts, audit.ts, spec-backfill.ts.
 *
 * Usage:
 *   bun scripts/spec-register.ts --file docs/designs/foo.md --source brainstorming
 *   bun scripts/spec-register.ts --file docs/designs/foo.md --source meeting --ref memory/meeting-2026-06-24-foo.md
 *   bun scripts/spec-register.ts --file docs/designs/foo.md --source manual --status implemented --id 2026-01-02-foo
 *   bun scripts/spec-register.ts --update 2026-06-24-foo --status implemented
 *   bun scripts/spec-register.ts --list
 *   bun scripts/spec-register.ts --list --status approved
 *
 * --id <value> overrides the default slugFromPath(filePath) id. Needed for files without a
 * YYYY-MM-DD- filename prefix, so callers (e.g. spec-backfill.ts) can supply a dated id that
 * matches the convention used by hand-registered entries.
 *
 * v1.2.0 (T-20260912-019): import safety — all CLI dispatch is wrapped in
 *          `if (import.meta.main)`, so importing this module for its helpers
 *          (loadRegistry, saveRegistry, slugFromPath, titleFromPath) no longer
 *          runs CRUD against the registry or prints usage errors. REGISTRY_PATH
 *          resolves from this script's own location (import.meta.dir/..) instead
 *          of process.cwd(), so spawned callers (variant-feature.ts,
 *          project-to-variant.ts, spec-backfill.ts) resolve the workspace
 *          registry regardless of their working directory; CLI behavior is
 *          unchanged for the standard workspace-root invocation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Resolved from the script's own location (scripts/spec-register.ts → workspace
// root), not cwd — spawned callers may run from a different working directory.
export const REGISTRY_PATH = path.resolve(import.meta.dir, '..', 'docs', 'specs', 'registry.json');

// ANSI colors — explicit \x1b escapes produce the exact same output bytes as the
// previous raw-escape-character literals.
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

type SpecStatus = 'draft' | 'proposed' | 'approved' | 'implemented' | 'drifted' | 'archived';
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

export function loadRegistry(): Registry {
  if (!fs.existsSync(REGISTRY_PATH)) {
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    return { version: '1.0.0', specs: [] };
  }
  return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

export function saveRegistry(registry: Registry): void {
  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
}

export function slugFromPath(filePath: string): string {
  return path.basename(filePath, '.md')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function titleFromPath(filePath: string): string {
  const base = path.basename(filePath, '.md');
  return base.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
}

export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** Register (or refresh) a spec entry — the `--file` code path, callable without process.argv. */
export function registerSpec(options: {
  filePath: string;
  source?: SpecSource;
  meetingRef?: string;
  status?: SpecStatus;
  id?: string;
}): { id: string; updated: boolean } {
  const source = (options.source ?? 'manual') as SpecSource;
  const status = (options.status ?? (source === 'brainstorming' ? 'approved' : 'draft')) as SpecStatus;

  if (!fs.existsSync(options.filePath)) {
    console.error(`${RED}File not found: ${options.filePath}${RESET}`);
    if (import.meta.main) {
      process.exit(1);
    }
    throw new Error(`File not found: ${options.filePath}`);
  }

  const registry = loadRegistry();
  const id = options.id ?? slugFromPath(options.filePath);
  const existing = registry.specs.find(s => s.id === id);
  if (existing) {
    existing.last_updated = today();
    if (options.meetingRef) existing.meeting_ref = options.meetingRef;
    saveRegistry(registry);
    console.log(`${GREEN}Updated: ${id}${RESET}`);
    return { id, updated: true };
  }

  const entry: SpecEntry = {
    id,
    title: titleFromPath(options.filePath),
    file: options.filePath.split('\\').join('/'),
    status,
    source,
    created: today(),
    last_updated: today(),
  };
  if (options.meetingRef) entry.meeting_ref = options.meetingRef.split('\\').join('/');
  registry.specs.push(entry);
  saveRegistry(registry);
  console.log(`${GREEN}Registered spec: ${id}${RESET}`);
  return { id, updated: false };
}

/**
 * CLI dispatch. Runs only when executed directly (`bun scripts/spec-register.ts …`).
 * Output and exit codes are byte-identical to the pre-1.2.0 CLI behavior.
 */
function dispatch(): void {
  const args = process.argv.slice(2);

  function getArg(flag: string): string | undefined {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  function hasFlag(flag: string): boolean {
    return args.includes(flag);
  }

  if (getArg('--file')) {
    registerSpec({
      filePath: getArg('--file')!,
      source: (getArg('--source') ?? 'manual') as SpecSource,
      meetingRef: getArg('--ref'),
      status: (getArg('--status') ?? undefined) as SpecStatus | undefined,
      id: getArg('--id'),
    });
    // The old CLI exited immediately after register/update; preserve that contract.
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
}

if (import.meta.main) {
  dispatch();
}
