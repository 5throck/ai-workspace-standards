#!/usr/bin/env bun
/**
 * fleet-list.ts — fleet membership SSOT wrapper CLI (project-resync runner
 * input; design docs/designs/2026-11-07-fleet-membership-ssot-design.md §5, §7).
 * @version 1.0.0
 *
 * v1.0.0 (2026-11-07, spec
 *          docs/designs/2026-11-07-fleet-membership-ssot-design.md §5,
 *          DEC-20261107-01): initial — prints the derived fleet member set.
 *
 * The daily fleet runner derives its project set from THIS script, never
 * from a raw `Projects/co-*` glob (design §7 wording). Membership =
 * Projects/co-* directories minus the exclusions recorded in
 * docs/fleet-membership.json — derived exclusively through lib/fleet.ts.
 *
 * Usage:
 *   bun scripts/fleet-list.ts              # one member path per line (sorted)
 *   bun scripts/fleet-list.ts --json      # {"root",count,projects,excluded}
 *   bun scripts/fleet-list.ts --root <path>  # workspace root override (fixtures / read-only inspection)
 *
 * Exit codes: 0 on success (including the registry-absent historical
 * behavior — zero exclusions); 1 when the registry file is MALFORMED
 * (fail-closed: the runner must STOP Phase II and file an urgent ticket —
 * design §7 — never fall back to a raw glob).
 */

import { resolve } from 'node:path';
import { excludedFleetIds, fleetExclusions, listFleetProjects } from './lib/fleet.ts';

function parseArgs(argv: string[]): { json: boolean; root?: string; help: boolean } {
  const out: { json: boolean; root?: string; help: boolean } = { json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') out.json = true;
    else if (argv[i] === '--root') out.root = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else {
      console.error(`fleet-list.ts: unknown argument '${argv[i]}' (accepted: --json, --root <path>, --help)`);
      process.exit(2);
    }
  }
  return out;
}

function main(): void {
  const { json, root: rootArg, help } = parseArgs(process.argv.slice(2));
  const root = resolve(rootArg ?? resolve(import.meta.dir, '..'));
  if (help) {
    console.log(`fleet-list.ts — fleet membership SSOT (docs/fleet-membership.json)

Usage: bun scripts/fleet-list.ts [--json] [--root <path>]

Prints the fleet member set: Projects/co-* directories minus recorded
exclusions. --json emits {"root","count","projects","excluded"}.`);
    return;
  }
  let projects: string[];
  let excludedIds: Set<string>;
  try {
    projects = listFleetProjects(root);
    excludedIds = excludedFleetIds(root);
  } catch (err) {
    // Fail-closed (design §4/§7): a malformed registry must STOP the runner,
    // never degrade to a raw Projects/co-* glob.
    console.error(`fleet-list.ts: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  if (json) {
    const excluded = fleetExclusions(root).map((e) => ({
      id: e.id,
      decided: e.decided,
      decision_ref: e.decision_ref,
    }));
    console.log(JSON.stringify({ root, count: projects.length, projects, excluded }, null, 2));
    return;
  }
  for (const p of projects) console.log(p);
}

if (import.meta.main) main();
