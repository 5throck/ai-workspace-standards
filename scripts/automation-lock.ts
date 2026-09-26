#!/usr/bin/env bun
// @version 1.0.0
// automation-lock.ts — file-based exclusivity lock for unattended local
// automations (T-20260926-021; design docs/designs/2026-09-26-runner-lock-retry-enforcement-design.md D1).
//
// v1.0.0 (2026-09-26): the 01:30 fleet-review and 03:00 governance-ticket
// runners documented collision safety as prompt prose only. This script makes
// exclusivity mechanical: a lock records pid + hostname + acquired-at under
// .pipeline-state/ (gitignored), `acquire` fails while a LIVE same-host holder
// exists, and a dead-pid / foreign-host / corrupt record is reported and —
// with --break-stale — removed atomically so an unattended run can recover
// without a human.
//
// Usage:
//   bun scripts/automation-lock.ts acquire <name> [--break-stale]
//   bun scripts/automation-lock.ts release <name> [--force]
//   bun scripts/automation-lock.ts status [name]
//
// Exit codes: 0 (acquired / released / reported), 1 (lock held, stale lock
// without --break-stale, or usage error). Runners wire the empty-queue fast
// path lock-free and call `acquire` right before batch work; a non-zero exit
// means "defer this run, report only".
//
// Non-goals (design D4): no cross-host advisory locking — a foreign-host
// record is treated as stale and breakable, matching the single-operator
// workspace reality.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_STATE_DIR = join(WORKSPACE_ROOT, '.pipeline-state');

export interface LockRecord {
  name: string;
  pid: number;
  hostname: string;
  acquiredAt: string;
}

export interface LockOptions {
  /** Override the state directory (tests). Defaults to <workspace>/.pipeline-state. */
  stateDir?: string;
  breakStale?: boolean;
  force?: boolean;
}

export type LockOutcome =
  | { ok: true; state: 'acquired' | 'broke-stale' | 'released' | 'free' | 'held' | 'missing' | 'stale'; record?: LockRecord; message: string }
  | { ok: false; state: 'held-live' | 'stale' | 'corrupt' | 'foreign' | 'error'; record?: LockRecord; message: string };

function lockPath(name: string, stateDir: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(name)) throw new Error(`invalid lock name: ${name}`);
  return join(stateDir, `automation-${name}.lock`);
}

/** True when `pid` refers to a live process (EPERM = alive but not ours). */
export function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function readLock(name: string, opts: LockOptions = {}): LockRecord | null {
  try {
    const raw = readFileSync(lockPath(name, opts.stateDir ?? DEFAULT_STATE_DIR), 'utf-8');
    const parsed = JSON.parse(raw) as LockRecord;
    if (typeof parsed.pid !== 'number' || typeof parsed.hostname !== 'string') return null; // corrupt shape
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    return null; // unparseable → corrupt
  }
}

function tryCreate(name: string, stateDir: string): boolean {
  try {
    const record: LockRecord = { name, pid: process.pid, hostname: hostname(), acquiredAt: new Date().toISOString() };
    // 'wx' = fail if the file exists → atomic-enough create on a local FS.
    writeFileSync(lockPath(name, stateDir), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw err;
  }
}

export function acquireLock(name: string, opts: LockOptions = {}): LockOutcome {
  const stateDir = opts.stateDir ?? DEFAULT_STATE_DIR;
  mkdirSync(stateDir, { recursive: true });
  if (tryCreate(name, stateDir)) {
    return { ok: true, state: 'acquired', message: `lock '${name}' acquired (pid ${process.pid})` };
  }
  const record = readLock(name, opts);
  if (record === null) {
    // Corrupt record: a real holder cannot be proven — breakable per design R2.
    if (opts.breakStale) {
      rmSync(lockPath(name, stateDir));
      if (tryCreate(name, stateDir)) return { ok: true, state: 'broke-stale', message: `corrupt lock '${name}' broken and re-acquired` };
    }
    return { ok: false, state: 'corrupt', message: `lock '${name}' is corrupt — re-run with --break-stale to recover` };
  }
  const sameHost = record.hostname === hostname();
  if (sameHost && pidAlive(record.pid)) {
    return { ok: false, state: 'held-live', record, message: `lock '${name}' is HELD by live pid ${record.pid} (since ${record.acquiredAt}) — defer this run` };
  }
  if (sameHost) {
    if (!opts.breakStale) {
      return { ok: false, state: 'stale', record, message: `lock '${name}' is STALE (pid ${record.pid} is dead, since ${record.acquiredAt}) — re-run with --break-stale` };
    }
  } else if (!opts.breakStale) {
    return { ok: false, state: 'foreign', record, message: `lock '${name}' was left by foreign host ${record.hostname} — re-run with --break-stale` };
  }
  rmSync(lockPath(name, stateDir));
  if (tryCreate(name, stateDir)) {
    return { ok: true, state: 'broke-stale', record, message: `stale lock '${name}' broken (dead pid ${record.pid}${sameHost ? '' : `, host ${record.hostname}`}) and re-acquired` };
  }
  return { ok: false, state: 'error', message: `lock '${name}' could not be re-acquired after break` };
}

export function releaseLock(name: string, opts: LockOptions = {}): LockOutcome {
  const stateDir = opts.stateDir ?? DEFAULT_STATE_DIR;
  const record = readLock(name, opts);
  if (record === null) {
    return { ok: true, state: 'missing', message: `no lock '${name}' to release` };
  }
  const sameHost = record.hostname === hostname();
  if (!opts.force && sameHost && pidAlive(record.pid) && record.pid !== process.pid) {
    return { ok: false, state: 'held-live', record, message: `lock '${name}' is held by another live process (pid ${record.pid}) — not releasing without --force` };
  }
  rmSync(lockPath(name, stateDir));
  return { ok: true, state: 'released', record, message: `lock '${name}' released` };
}

export function lockStatus(name: string, opts: LockOptions = {}): LockOutcome {
  const record = readLock(name, opts);
  if (record === null) return { ok: true, state: 'free', message: `lock '${name}' is free` };
  const alive = record.hostname === hostname() && pidAlive(record.pid);
  return {
    ok: true,
    state: alive ? 'held' : 'stale',
    record,
    message: `lock '${name}' ${alive ? 'HELD' : 'STALE'} — pid ${record.pid} on ${record.hostname}, since ${record.acquiredAt}`,
  };
}

// ── CLI (import-safe: logic is exported for tests) ───────────────────────────

function print(outcome: LockOutcome): number {
  const icon = outcome.ok ? '✅' : '❌';
  console.log(`${icon} ${outcome.message}`);
  return outcome.ok ? 0 : 1;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const name = args.find(a => !a.startsWith('--') && a !== cmd);
  const breakStale = args.includes('--break-stale');
  const force = args.includes('--force');
  if ((cmd === 'acquire' || cmd === 'release') && !name) {
    console.error(`usage: bun scripts/automation-lock.ts ${cmd} <name> ${cmd === 'acquire' ? '[--break-stale]' : '[--force]'}`);
    process.exit(1);
  }
  if (cmd === 'acquire' && name) process.exit(print(acquireLock(name, { breakStale })));
  if (cmd === 'release' && name) process.exit(print(releaseLock(name, { force })));
  if (cmd === 'status') {
    if (name) process.exit(print(lockStatus(name)));
    // No name → report every lock file in the state dir.
    const { readdirSync, existsSync } = await import('node:fs');
    if (!existsSync(DEFAULT_STATE_DIR)) process.exit(0);
    const locks = readdirSync(DEFAULT_STATE_DIR).filter(f => f.startsWith('automation-') && f.endsWith('.lock'));
    if (locks.length === 0) { console.log('✅ no automation locks present'); process.exit(0); }
    let code = 0;
    for (const f of locks) {
      const outcome = lockStatus(f.replace(/^automation-/, '').replace(/\.lock$/, ''));
      console.log(outcome.ok ? `ℹ️  ${outcome.message}` : `❌ ${outcome.message}`);
    }
    process.exit(code);
  }
  console.error('usage: bun scripts/automation-lock.ts <acquire|release|status> [name] [--break-stale|--force]');
  process.exit(1);
}
