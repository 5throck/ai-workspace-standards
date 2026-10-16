#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-10-17, T-20261017-001): the boundary scan stops at the NEXT
//           `## ` heading — v1.1.0's only stop condition (the first `#### \`
//           header) let the scan run through the intermediate ## sections
//           (Layer Classification / Ownership Layers / Lifecycle States),
//           whose rows are also `| \`word\` |`-shaped, so the append index
//           landed inside the Lifecycle States table and the scaffolded
//           co-abap SCRIPTS.md failed verify-scripts (7 unregistered rows).
//           The anchor is now the exact `## Registry` line so a preceding
//           `## Registry Scope` section cannot hijack it.
// v1.1.0 (2026-10-14, T-20261014-002): boundary scan exported as
//           registryAppendIndex and adopted by reconcileScriptRegistry's
//           append arm — one boundary semantics everywhere (## Registry-
//           anchored, bounded by the first `#### \` detail-section header,
//           whose flag tables also contain table-shaped rows). The former
//           "break at the first non-table line" rule is retired.
// v1.0.0 (2026-10-13, T-20261013-001): extracted from new-project.ts §6.6 and
//           upgrade-project.ts VARIANT SCRIPTS SYNC — both carried the same
//           "find the first ## Registry table, splice rows after its last row,
//           write" mechanics; only the row format differed per call site.

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Index AFTER the last table row of the registry region — from the exact
 * `## Registry` heading to the next `## ` heading (the region may contain
 * prose and ### subsections between row groups) or the first `#### \`
 * detail-section header, whichever comes first; rows in later `##` tables
 * (Lifecycle States and friends) are also `| \`word\` |`-shaped and must
 * never win. Returns -1 when the heading or its table is missing.
 */
export function registryAppendIndex(lines: string[]): number {
  const regStart = lines.findIndex((l) => /^## Registry\s*$/.test(l));
  if (regStart < 0) return -1;
  let lastRowIdx = -1;
  for (let i = regStart + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) break;
    if (/^####\s+`/.test(lines[i])) break;
    if (/^\|\s*`/.test(lines[i])) lastRowIdx = i;
  }
  return lastRowIdx >= 0 ? lastRowIdx + 1 : -1;
}

/**
 * Append fully-formatted registry rows at the end of the FIRST `## Registry`
 * table in `regPath`. Returns true when rows were inserted (and written);
 * false when the section or its table is missing (caller decides severity).
 */
export function appendRegistryRows(regPath: string, rows: string[]): boolean {
  if (rows.length === 0) return false;
  const lines = readFileSync(regPath, 'utf-8').split('\n');
  const insertAt = registryAppendIndex(lines);
  if (insertAt <= 0) return false;
  lines.splice(insertAt, 0, ...rows);
  writeFileSync(regPath, lines.join('\n'), 'utf-8');
  return true;
}
