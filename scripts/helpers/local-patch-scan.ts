#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-02, T-20261002-015): scan a project tree for upstream
//           LOCAL-PATCH markers — `LOCAL-PATCH(upstream-request: <id>)` (id may be
//           `pending`) — so an upgrade can report which local patches it is about to
//           overwrite instead of silently removing them (upstream design Phase 3).
// @l2-propagate: false
// Pure and import-safe: no side effects, explicit root argument.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface LocalPatchFinding {
  /** Project-relative path (forward slashes). */
  file: string;
  /** Ticket id from the marker, or `pending`. */
  id: string;
}

export const LOCAL_PATCH_RE = /LOCAL-PATCH\(upstream-request:\s*([A-Za-z0-9][A-Za-z0-9-]*)\)/g;

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.venv', 'venv', '__pycache__',
  'dist', 'build', 'coverage', 'Projects', '.sandbox', 'test-project',
]);

const TEXT_EXTS = new Set([
  '.md', '.ts', '.js', '.mjs', '.cjs', '.jsx', '.tsx', '.json', '.yaml', '.yml',
  '.toml', '.sh', '.ps1', '.txt', '.sample', '.html', '.css', '.py', '.rb', '.go', '.rs',
]);

const MAX_FILE_BYTES = 1_000_000;

/** Every LOCAL-PATCH marker in the tree at `rootDir` (one finding per marker
 * occurrence; a file with two patches reports twice). Deterministic order:
 * path, then position in file. */
export function scanLocalPatches(rootDir: string): LocalPatchFinding[] {
  const findings: LocalPatchFinding[] = [];
  const walk = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable subtree — skip silently (report is best-effort)
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = entry.name.slice(entry.name.lastIndexOf('.')).toLowerCase();
      if (!TEXT_EXTS.has(ext)) continue;
      let content: string;
      try {
        if (statSync(full).size > MAX_FILE_BYTES) continue;
        content = readFileSync(full, 'utf-8');
      } catch {
        continue;
      }
      const rel = relative(rootDir, full).replace(/\\/g, '/');
      for (const m of content.matchAll(LOCAL_PATCH_RE)) {
        findings.push({ file: rel, id: m[1] });
      }
    }
  };
  walk(rootDir);
  return findings;
}
