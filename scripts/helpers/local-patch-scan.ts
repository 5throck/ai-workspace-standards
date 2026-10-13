#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-13, T-20261013-006): noise filter — inline-code spans (`…`) are
//          stripped before matching and the marker's defining/registry surfaces are
//          skipped (scripts/hooks/pre-commit.ts, this file, scripts/upgrade-project.ts,
//          scripts/SCRIPTS.md); protocol documentation no longer drowns real patches.
// v1.0.0 (2026-10-02, T-20261002-015): scan a project tree for upstream
//           LOCAL-PATCH markers — `LOCAL-PATCH(upstream-request: <id>)` (id may be
//           `pending`) — so an upgrade can report which local patches it is about to
//           overwrite instead of silently removing them (upstream design Phase 3).
// v1.0.1 (2026-10-13, U-20261012-001): drop @l2-propagate:false — upgrade-project
//           imports this helper, so scaffolds must deliver it; the header made the
//           delivery derivation skip it while the scaffold copied it (Test 26 drift)
//           and projects failed typecheck TS2307.
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

/** Marker-definition/registry surfaces whose own text legitimately contains the
 * marker string — skipped so protocol documentation never drowns real patches
 * (co-abap reported 27 markers, instruction-text class dominated, and the noise
 * is how real patches got dismissed during the 0.18.0 wave — T-20261013-006). */
const SKIP_FILES = new Set([
  'scripts/hooks/pre-commit.ts',
  'scripts/helpers/local-patch-scan.ts',
  'scripts/upgrade-project.ts',
  'scripts/SCRIPTS.md',
]);

/** Inline-code spans (`…`) carry protocol documentation, never live markers —
 * patches mark real content lines as plain comments. */
function stripInlineCode(line: string): string {
  return line.replace(/`[^`\n]*`/g, '``');
}

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
      if (SKIP_FILES.has(rel)) continue;
      for (const line of content.split('\n')) {
        for (const m of stripInlineCode(line).matchAll(LOCAL_PATCH_RE)) {
          findings.push({ file: rel, id: m[1] });
        }
      }
    }
  };
  walk(rootDir);
  return findings;
}
