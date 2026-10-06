#!/usr/bin/env bun
/**
 * write-scripts-snapshot.ts — Write scripts-snapshot.json with the DELIVERED
 * script version map
 * @version 1.1.0
 *
 * Usage:
 *   bun scripts/helpers/write-scripts-snapshot.ts <project-dir> <date> <variant> <l1-source>
 *
 * v1.1.0 (2026-10-07, U-20261006-001): two root causes fixed —
 *  - Inventory: the map now comes from the L1 registry the delivery actually
 *    uses (<cwd>/<l1-source>/SCRIPTS.md, e.g. templates/common/scripts), plus
 *    the variant overlay registry (templates/<variant>/scripts/<variant>/)
 *    when present — not the L0 root registry, which lists workspace-only tools
 *    (new-project.ts, ticket.ts, …) the project never receives and omitted
 *    delivered scripts. Falls back to the L0 registry when the L1 file is
 *    absent (pre-l1-mirror layouts).
 *  - Parsing: a line-shape scan over 8-column registry rows replaces the
 *    `## Registry` + lazy-lookahead section capture, which stopped at the
 *    first `###` subsection and saw only a slice of the table. Truncated
 *    doc-tail fragment rows (< 4 cells) filter out naturally.
 *
 * Callers: new-project §5.5c (scaffold), adopt-project §15 (adopt),
 * upgrade-project post-upgrade regeneration (U-20261006-001). CLI import-guarded
 * so tests can import parseScriptRegistry.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ScriptSnapshotEntry {
  version: string;
  status: string;
}

/**
 * Extract `name -> {version, status}` from one SCRIPTS.md registry. A row is
 * self-identifying by shape: `| \`name\` | layer | semver | status | …` — the
 * version cell (parts[2]) must be exact semver or the row is not a versioned
 * script entry. Last write wins on duplicate names.
 */
export function parseScriptRegistry(content: string): Record<string, ScriptSnapshotEntry> {
  const scripts: Record<string, ScriptSnapshotEntry> = {};
  for (const line of content.split('\n')) {
    if (!/^\|\s*`[A-Za-z0-9][A-Za-z0-9._/-]*`\s*\|/.test(line)) continue;
    const parts = line.split('|').map(p => p.trim()).filter(p => p);
    if (parts.length < 4) continue;
    const name = parts[0].replace(/`/g, '');
    const version = parts[2];
    const status = parts[3];
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
    scripts[name] = { version, status };
  }
  return scripts;
}

function main(): void {
  const args = process.argv.slice(2);
  const projectDir = args[0];
  const date = args[1];
  const variant = args[2];
  const l1Source = args[3];

  if (!projectDir || !date || !variant || !l1Source) {
    console.error('Usage: bun write-scripts-snapshot.ts <project-dir> <date> <variant> <l1-source>');
    process.exit(1);
  }

  const l1RegistryPath = join(process.cwd(), l1Source, 'SCRIPTS.md');
  const registryPath = existsSync(l1RegistryPath)
    ? l1RegistryPath
    : join(process.cwd(), 'scripts', 'SCRIPTS.md');
  const scripts = parseScriptRegistry(readFileSync(registryPath, 'utf-8'));

  // Variant overlay scripts (delivered to scripts/<variant>/ in the project)
  // carry their own registry alongside the overlay sources.
  const variantRegistryPath = join(process.cwd(), 'templates', variant, 'scripts', variant, 'SCRIPTS.md');
  if (existsSync(variantRegistryPath)) {
    Object.assign(scripts, parseScriptRegistry(readFileSync(variantRegistryPath, 'utf-8')));
  }

  const snapshot = {
    created: date,
    variant,
    l1_source: l1Source,
    scripts,
  };

  writeFileSync(join(projectDir, 'scripts-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(`  ✅ scripts-snapshot.json written (${Object.keys(scripts).length} scripts) from ${registryPath}`);
}

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
}
