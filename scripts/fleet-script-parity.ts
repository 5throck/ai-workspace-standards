#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §8 Phase 4 verification sweep): fleet-script-parity — hashes the
//          common script set (every file under templates/common/scripts/,
//          relative paths) against each Projects/co-*/scripts/ tree and
//          reports per-script match/mismatch counts plus a per-repo summary.
//          WARN-level by design: mismatches never FAIL — upgrade-project is
//          the delivery vehicle and repos await their next cycle. Extra files
//          in a project tree (variant hooks, project-only tests) are counted
//          as informational, not drift.
//
// Usage: bun scripts/fleet-script-parity.ts [--json]
//
// Output: console table + WARN summary line; always exits 0.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DARKGRAY = '\x1b[90m';
const RESET = '\x1b[0m';

export type ScriptStatus = 'match' | 'mismatch' | 'missing';

export interface ScriptRow {
  script: string;
  status: ScriptStatus;
  project: string;
}

export interface RepoSummary {
  project: string;
  match: number;
  mismatch: number;
  missing: number;
  extra: number;
  parity: boolean;
}

/** Recursively list relative file paths under `dir` (POSIX-style separators). */
export function listRelativeFiles(dir: string): string[] {
  const out: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listRelativeFiles(full));
    else out.push(relative(dir, full).split(sep).join('/'));
  }
  return out.sort();
}

export function sha256File(path: string): string | null {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return null; // transient entry (created/deleted mid-scan) — skipped, not drift
  }
}

/**
 * Pure core: compare the canonical script set against one project tree.
 * Canonical and observed are maps of relative path → sha256.
 */
export function compareScriptSet(
  canonical: Record<string, string>,
  observed: Record<string, string>,
  project: string,
): ScriptRow[] {
  return Object.keys(canonical).sort().map((script) => ({
    script,
    project,
    status: !(script in observed)
      ? 'missing'
      : observed[script] === canonical[script]
        ? 'match'
        : 'mismatch',
  }));
}

export function summarize(project: string, rows: ScriptRow[], extraCount: number): RepoSummary {
  const match = rows.filter((r) => r.status === 'match').length;
  const mismatch = rows.filter((r) => r.status === 'mismatch').length;
  const missing = rows.filter((r) => r.status === 'missing').length;
  return { project, match, mismatch, missing, extra: extraCount, parity: mismatch === 0 && missing === 0 };
}

function main(): void {
  const workspaceRoot = join(import.meta.dir, '..');
  const canonicalDir = join(workspaceRoot, 'templates', 'common', 'scripts');
  const projectsDir = join(workspaceRoot, 'Projects');

  const projects = readdirSync(projectsDir)
    .filter((d) => d.startsWith('co-'))
    .sort();

  const canonicalFiles = listRelativeFiles(canonicalDir);
  const canonical: Record<string, string> = {};
  for (const f of canonicalFiles) {
    const h = sha256File(join(canonicalDir, f));
    if (h !== null) canonical[f] = h;
  }

  const repoSummaries: RepoSummary[] = [];
  const mismatchDetails: string[] = [];

  for (const project of projects) {
    const tree = join(projectsDir, project, 'scripts');
    const observedFiles = listRelativeFiles(tree);
    const observed: Record<string, string> = {};
    for (const f of observedFiles) {
      const h = sha256File(join(tree, f));
      if (h !== null) observed[f] = h;
    }
    const extra = observedFiles.filter((f) => !(f in canonical)).length;

    const rows = compareScriptSet(canonical, observed, project);
    for (const r of rows) {
      if (r.status !== 'match') {
        mismatchDetails.push(`${project}: ${r.script} [${r.status.toUpperCase()}]`);
      }
    }
    repoSummaries.push(summarize(project, rows, extra));
  }

  const json = process.argv.includes('--json');
  if (json) {
    console.log(JSON.stringify({ canonicalCount: canonicalFiles.length, repos: repoSummaries, mismatchDetails }, null, 2));
  } else {
    console.log(`${CYAN}fleet-script-parity — canonical set: templates/common/scripts (${canonicalFiles.length} files)${RESET}`);
    console.log(`${CYAN}projects scanned: ${projects.length}${RESET}\n`);
    console.log(`${CYAN}Per-repo summary${RESET}`);
    for (const s of repoSummaries) {
      const verdict = s.parity ? `${GREEN}FULL${RESET}` : `${YELLOW}DRIFT${RESET}`;
      console.log(`  ${s.project.padEnd(34)} match=${String(s.match).padEnd(4)} mismatch=${String(s.mismatch).padEnd(4)} missing=${String(s.missing).padEnd(4)} extra=${String(s.extra).padEnd(3)} parity=${verdict}`);
    }
    console.log('');
    if (mismatchDetails.length === 0) {
      console.log(`${GREEN}[OK] all ${projects.length} project trees match the canonical script set.${RESET}`);
    } else {
      console.log(`${YELLOW}[WARN] ${mismatchDetails.length} script-level divergence(s) across the fleet (no FAIL — WARN-soak by design):${RESET}`);
      for (const d of mismatchDetails) console.log(`  ${YELLOW}-${RESET} ${d}`);
    }
  }
  process.exit(0);
}

if (import.meta.main) main();
