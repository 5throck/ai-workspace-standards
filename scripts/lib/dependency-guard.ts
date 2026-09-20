#!/usr/bin/env bun
// @version 1.0.1
// v1.0.0 (2026-09-20, T-20260920-001): dependency guard for upgrade-project —
//           scan delivered scripts' bare-package imports against the project
//           package.json and report missing packages. Report-only (no network,
//           no lockfile churn); design docs/designs/2026-09-20-upgrade-hardening-tickets-design.md D1.
// v1.0.1 (2026-09-20, smoke-test fixes): same-line specifier matching only
//           (\s+ crossed newlines into prose), skip ${…}-interpolated specifiers,
//           and filter runtime builtins (node builtins imported without the
//           `node:` prefix, and the `bun` runtime module) — they are provided by
//           the runtime, never package.json dependencies.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Specifier position: `from '…'`, `import '…'` (side-effect), `import( '…' )`
// (dynamic), `require('…')` — same line only, so prose wrapping can't match.
const IMPORT_RE = /(?:\bfrom[ \t]+|\bimport[ \t]+|\bimport\s*\(\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g;

// Node builtins are importable with or without the `node:` prefix; `bun` is
// the Bun runtime module. None of these are package.json dependencies.
const RUNTIME_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module', 'net',
  'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers', 'tls',
  'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads',
  'zlib', 'bun',
]);

/** Collapse an import specifier to its package name: `js-yaml` → `js-yaml`,
 *  `@scope/pkg/sub` → `@scope/pkg`. Returns null for non-bare specifiers
 *  (relative paths, `node:`/`bun:` prefixes, runtime builtins, interpolated
 *  or otherwise non-package-looking strings). */
export function barePackageName(spec: string): string | null {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('node:') || spec.startsWith('bun:')) {
    return null;
  }
  if (/[$\s{}]/.test(spec)) return null; // `${…}` interpolation, wrapped prose
  let pkg: string;
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    if (parts.length < 2) return null;
    pkg = `${parts[0]}/${parts[1]}`;
  } else {
    const slash = spec.indexOf('/');
    pkg = slash === -1 ? spec : spec.slice(0, slash);
  }
  if (RUNTIME_BUILTINS.has(pkg)) return null;
  return pkg;
}

/** Extract the set of bare package names imported by one source file. */
export function barePackageImports(code: string): Set<string> {
  const pkgs = new Set<string>();
  for (const m of code.matchAll(IMPORT_RE)) {
    const pkg = barePackageName(m[1]);
    if (pkg) pkgs.add(pkg);
  }
  return pkgs;
}

/** Sorted bare imports that the project package.json does not declare. */
export function missingDependencies(pkgDeps: Set<string>, imports: Iterable<string>): string[] {
  const out: string[] = [];
  for (const imp of imports) {
    if (!pkgDeps.has(imp)) out.push(imp);
  }
  return out.sort();
}

export interface DeliveredImport {
  pkg: string;
  importedBy: string[];
}

/** Walk delivered-script roots and aggregate bare imports per package with
 *  the files that import them (paths relative to `baseDir` for stable logs). */
export function scanDeliveredScripts(scriptsRoots: string[], baseDir: string): DeliveredImport[] {
  const byPkg = new Map<string, Set<string>>();
  const seen = new Set<string>();
  const walk = (dir: string): void => {
    if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        walk(full);
      } else if (entry.name.endsWith('.ts') && !seen.has(full)) {
        seen.add(full);
        const rel = relative(baseDir, full).split('\\').join('/');
        for (const pkg of barePackageImports(readFileSync(full, 'utf8'))) {
          if (!byPkg.has(pkg)) byPkg.set(pkg, new Set());
          byPkg.get(pkg)!.add(rel);
        }
      }
    }
  };
  for (const root of scriptsRoots) walk(root);
  return [...byPkg.entries()]
    .map(([pkg, files]) => ({ pkg, importedBy: [...files].sort() }))
    .sort((a, b) => a.pkg.localeCompare(b.pkg));
}
