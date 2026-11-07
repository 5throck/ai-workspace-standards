#!/usr/bin/env bun
// @version 1.0.0
/**
 * external-deps.ts — project-side CLI for the external-dependency standard
 * (design docs/designs/2026-11-07-external-deps-standard-design.md §5.3;
 * decision DEC-20261107-02). A thin wrapper over scripts/lib/external-deps.ts
 * — no git logic of its own. Byte-identical at L0 and templates/common, so
 * every delivered project can list, install, and verify its own clones
 * without the workspace root.
 *
 * Usage:
 *   bun scripts/external-deps.ts list          [--json] [--project <dir>]
 *   bun scripts/external-deps.ts install       [--id <id>] [--project <dir>]
 *   bun scripts/external-deps.ts verify        [--manifest-only] [--json] [--project <dir>]
 *   bun scripts/external-deps.ts check-updates [--json] [--project <dir>]
 *
 * Subcommands:
 *   list           print id, pin, commit, license, usage, adapter, install state. Offline.
 *   install        clone (or fetch + checkout) each entry at its pin, write the
 *                  resolved commit back, ensure .gitignore coverage. Idempotent.
 *                  NEVER moves a pin (only the upgrade pass does, after the
 *                  compatibility test). The pre-install gate (license policy +
 *                  external/<id> convention, R3) refuses a gated entry. Network.
 *   verify         checks V1-V9 (standard §5.3); `--manifest-only` runs the
 *                  offline manifest checks only (V1-V5 + V3a — the commit-time
 *                  and CI legs). Exit 1 on any FAIL.
 *   check-updates  git ls-remote per entry; REPORTS newer release tags, never
 *                  writes the manifest. Network. Exit 0 (1 only when the
 *                  manifest itself is invalid).
 *
 * Exit codes: 0 ok · 1 failure (see subcommand) · 2 usage error.
 *
 * Test hook: EXTERNAL_DEPS_ALLOW_LOCAL_REPOS=1 accepts file:// and local-path
 * repos (unit tests use tiny local fixture repos — design machinery §4). It
 * only widens WHERE a clone may come from; the license gate and every other
 * check still apply.
 *
 * Windows: the library shells out to git (argv arrays, no shell) — git must be
 * on PATH.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  parseExternalDepsManifest,
  fetchProjectExternalDeps,
  verifyProjectExternalDeps,
  checkUpstreamTags,
  type ExternalDepsManifest,
} from './lib/external-deps.ts';

const SUBCOMMANDS = ['list', 'install', 'verify', 'check-updates'] as const;
type Subcommand = (typeof SUBCOMMANDS)[number];

interface CliOptions {
  sub: Subcommand;
  json: boolean;
  manifestOnly: boolean;
  id: string | null;
  projectDir: string;
}

function usage(msg?: string): never {
  if (msg) console.error(`external-deps: ${msg}`);
  console.error('Usage: bun scripts/external-deps.ts <list|install|verify|check-updates> [--json] [--manifest-only] [--id <id>] [--project <dir>]');
  process.exit(2);
}

export function parseArgs(argv: string[]): CliOptions {
  const sub = argv[0];
  if (!sub || !(SUBCOMMANDS as readonly string[]).includes(sub)) usage(sub ? `unknown subcommand '${sub}'` : 'missing subcommand');
  const opts: CliOptions = { sub: sub as Subcommand, json: false, manifestOnly: false, id: null, projectDir: process.cwd() };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--manifest-only') opts.manifestOnly = true;
    else if (a === '--id') { opts.id = argv[++i] ?? usage('--id needs a value'); }
    else if (a === '--project') { opts.projectDir = resolve(argv[++i] ?? usage('--project needs a value')); }
    else usage(`unknown flag '${a}'`);
  }
  if (opts.manifestOnly && opts.sub !== 'verify') usage('--manifest-only applies to verify only');
  if (opts.id && opts.sub !== 'install') usage('--id applies to install only');
  return opts;
}

const allowLocalRepos = process.env.EXTERNAL_DEPS_ALLOW_LOCAL_REPOS === '1';

function loadManifest(projectDir: string): { manifest: ExternalDepsManifest | null; present: boolean; error?: string } {
  const p = join(projectDir, 'external-deps.json');
  if (!existsSync(p)) return { manifest: null, present: false };
  try {
    return { manifest: parseExternalDepsManifest(readFileSync(p, 'utf8'), 'external-deps.json', { allowLocalRepos }), present: true };
  } catch (err) {
    return { manifest: null, present: true, error: (err as Error).message };
  }
}

function cmdList(o: CliOptions): number {
  const { manifest, present, error } = loadManifest(o.projectDir);
  if (error) { console.error(`❌ ${error}`); return 1; }
  const rows = (manifest?.dependencies ?? []).map((d) => ({
    id: d.id,
    pin: d.pin,
    commit: d.commit ?? null,
    license: d.license ?? null,
    usage: d.usage ?? null,
    adapter: d.adapter ?? null,
    install_dir: d.install_dir,
    installed: existsSync(join(o.projectDir, d.install_dir, '.git')),
  }));
  if (o.json) {
    console.log(JSON.stringify({ manifestPresent: present, schemaVersion: manifest?.schema_version ?? null, dependencies: rows }, null, 2));
    return 0;
  }
  if (!present) { console.log('No external-deps.json — no external dependencies declared.'); return 0; }
  if (rows.length === 0) { console.log(`external-deps.json (schema v${manifest!.schema_version}): no dependencies declared.`); return 0; }
  for (const r of rows) {
    console.log(`${r.id}  pin=${r.pin}  commit=${r.commit?.slice(0, 12) ?? '-'}  license=${r.license ?? 'UNDECLARED'}  usage=${r.usage ?? '-'}  adapter=${r.adapter ?? '-'}  ${r.installed ? 'installed' : 'NOT installed'} (${r.install_dir})`);
  }
  return 0;
}

function cmdInstall(o: CliOptions): number {
  const { manifest, present, error } = loadManifest(o.projectDir);
  if (error) { console.error(`❌ ${error}`); return 1; }
  if (!present) { console.log('No external-deps.json — nothing to install.'); return 0; }
  if (o.id && !manifest!.dependencies.some((d) => d.id === o.id)) {
    console.error(`❌ no dependency with id '${o.id}' in external-deps.json`);
    return 1;
  }
  const r = fetchProjectExternalDeps(o.projectDir, { allowLocalRepos, onlyIds: o.id ? [o.id] : undefined });
  let failed = 0;
  for (const dep of r.results) {
    if (dep.ok) console.log(`✅ ${dep.id}: ${dep.status} at ${dep.commit?.slice(0, 12) ?? '<unknown commit>'}`);
    else { failed++; console.error(`❌ ${dep.id}: ${dep.status} — ${dep.error}`); }
  }
  for (const d of r.gitignoreAppended) console.log(`   .gitignore: appended ${d}/`);
  if (r.results.length === 0) console.log('No dependencies declared — nothing to install.');
  return failed > 0 ? 1 : 0;
}

function cmdVerify(o: CliOptions): number {
  const { findings, manifestPresent } = verifyProjectExternalDeps(o.projectDir, { manifestOnly: o.manifestOnly, allowLocalRepos });
  const fails = findings.filter((f) => f.severity === 'fail');
  const warns = findings.filter((f) => f.severity === 'warn');
  if (o.json) {
    console.log(JSON.stringify({ manifestPresent, manifestOnly: o.manifestOnly, ok: fails.length === 0, findings }, null, 2));
    return fails.length > 0 ? 1 : 0;
  }
  for (const f of findings) {
    const tag = f.severity === 'fail' ? '[FAIL]' : f.severity === 'warn' ? '[WARN]' : '[PASS]';
    console.log(`${tag} ${f.check} ${f.message}`);
  }
  console.log(`external-deps verify${o.manifestOnly ? ' --manifest-only' : ''}: ${fails.length} fail, ${warns.length} warn`);
  return fails.length > 0 ? 1 : 0;
}

function cmdCheckUpdates(o: CliOptions): number {
  const { manifest, present, error } = loadManifest(o.projectDir);
  if (error) { console.error(`❌ ${error}`); return 1; }
  const rows = (manifest?.dependencies ?? []).map((d) => {
    const u = checkUpstreamTags(d);
    return { id: d.id, pin: d.pin, ok: u.ok, newer: u.newer ?? null, error: u.error ?? null };
  });
  if (o.json) {
    console.log(JSON.stringify({ manifestPresent: present, updates: rows }, null, 2));
    return 0;
  }
  if (rows.length === 0) { console.log('No dependencies declared — nothing to check.'); return 0; }
  for (const r of rows) {
    if (!r.ok) console.log(`[WARN] ${r.id}: upstream check failed — ${r.error}`);
    else if (r.newer) console.log(`[UPDATE] ${r.id}: ${r.pin} → ${r.newer} available (pin moves only via the upgrade pass after compatibility_test)`);
    else console.log(`[OK] ${r.id}: ${r.pin} is current`);
  }
  return 0;
}

export function run(argv: string[]): number {
  const o = parseArgs(argv);
  switch (o.sub) {
    case 'list': return cmdList(o);
    case 'install': return cmdInstall(o);
    case 'verify': return cmdVerify(o);
    case 'check-updates': return cmdCheckUpdates(o);
  }
}

if (import.meta.main) {
  process.exit(run(process.argv.slice(2)));
}
