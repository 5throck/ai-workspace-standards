#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-13, T-20261013-001): extracted from new-project.ts §6.6 and
//           upgrade-project.ts VARIANT SCRIPTS SYNC — both carried the same
//           "find the first ## Registry table, splice rows after its last row,
//           write" mechanics; only the row format differed per call site.

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Append fully-formatted registry rows at the end of the FIRST `## Registry`
 * table in `regPath`. Returns true when rows were inserted (and written);
 * false when the section or its table is missing (caller decides severity).
 */
export function appendRegistryRows(regPath: string, rows: string[]): boolean {
  if (rows.length === 0) return false;
  const lines = readFileSync(regPath, 'utf-8').split('\n');
  const regStart = lines.findIndex((l) => /^## Registry/.test(l));
  if (regStart < 0) return false;
  let insertAt = -1;
  for (let i = regStart; i < lines.length; i++) {
    if (/^\|\s*`/.test(lines[i])) insertAt = i + 1;
    else if (insertAt >= 0 && !/^\|/.test(lines[i])) break;
  }
  if (insertAt <= 0) return false;
  lines.splice(insertAt, 0, ...rows);
  writeFileSync(regPath, lines.join('\n'), 'utf-8');
  return true;
}
