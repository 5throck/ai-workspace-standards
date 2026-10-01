// @version 1.0.0
/**
 * spec-hygiene-sweep.ts
 *
 * Weekly spec-hygiene sweep (T-20261001-011) — detects specs registered in
 * docs/specs/registry.json with status "approved" whose created date is older
 * than 14 days and that show no progression (the entry is still "approved";
 * an implemented/superseded/archived transition would have changed the status).
 *
 * Detection only: adjudication (implement / supersede / re-confirm) is human/PM
 * work, so --fix is deliberately unsupported and this script never writes.
 *
 * Usage:
 *   bun scripts/spec-hygiene-sweep.ts            # human-readable report
 *   bun scripts/spec-hygiene-sweep.ts --json     # machine-readable report
 *
 * Exit codes:
 *   0 — no stale approved specs (nothing to adjudicate)
 *   1 — at least one stale approved spec found (gate for a weekly job/CI)
 *
 * Output per finding: id, age-in-days, title, doc path.
 */

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const REGISTRY_PATH = resolve(import.meta.dir, '..', 'docs', 'specs', 'registry.json');
export const MAX_AGE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Registry {
  version: string;
  specs: SpecEntry[];
}

interface SpecEntry {
  id: string;
  title: string;
  file: string;
  status: string;
  created: string;
  [key: string]: unknown;
}

export interface StaleFinding {
  id: string;
  ageDays: number;
  title: string;
  file: string;
  created: string;
}

/**
 * Pure core of the sweep: entries with status "approved" whose created date is
 * more than maxAgeDays before `today`. Dates are compared as UTC calendar
 * dates (created is a YYYY-MM-DD string), so the result is timezone- and
 * platform-independent.
 */
export function findStaleApprovedSpecs(
  entries: SpecEntry[],
  today: Date,
  maxAgeDays: number = MAX_AGE_DAYS,
): StaleFinding[] {
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const findings: StaleFinding[] = [];
  for (const entry of entries) {
    if (entry.status !== 'approved') continue;
    const createdMs = Date.parse(`${entry.created}T00:00:00Z`);
    if (Number.isNaN(createdMs)) continue;
    const ageDays = Math.floor((todayUtc - createdMs) / DAY_MS);
    if (ageDays > maxAgeDays) {
      findings.push({
        id: entry.id,
        ageDays,
        title: entry.title,
        file: entry.file,
        created: entry.created,
      });
    }
  }
  return findings.sort((a, b) => b.ageDays - a.ageDays);
}

function loadRegistry(): Registry {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8')) as Registry;
}

function main(): number {
  const json = process.argv.includes('--json');
  const registry = loadRegistry();
  const findings = findStaleApprovedSpecs(registry.specs, new Date());

  if (json) {
    console.log(
      JSON.stringify(
        {
          registryVersion: registry.version,
          maxAgeDays: MAX_AGE_DAYS,
          staleCount: findings.length,
          findings,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`spec-hygiene-sweep: docs/specs/registry.json (window: ${MAX_AGE_DAYS} days)`);
    if (findings.length === 0) {
      console.log('OK — no approved specs older than the adjudication window.');
      return 0;
    }
    console.log(`STALE — ${findings.length} approved spec(s) beyond the adjudication window:`);
    for (const f of findings) {
      console.log(`  - ${f.id}  (${f.ageDays} days, created ${f.created})`);
      console.log(`      title: ${f.title}`);
      console.log(`      doc:   ${f.file}`);
    }
    console.log('Adjudication is human/PM work: implement, supersede, or re-confirm each.');
  }
  return findings.length > 0 ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main());
}
