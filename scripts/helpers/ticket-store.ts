#!/usr/bin/env bun
// @version 1.10.1
// v1.10.1 (2026-10-04): provenance comment path updated — docs/superpowers/specs moved under docs/archive/superpowers (docs consolidation).
// v1.10.0 (2026-10-04, spec docs/designs/2026-10-04-ticket-archive-design.md): archive — a done
//           ticket dwells >= DEFAULT_ARCHIVE_DAYS (7) days, then archiveTickets renames it into
//           <store>/archive (tickets/archive for the ephemeral service store,
//           tickets/governance/archive for the tracked governance store) as a pure move with no
//           content change; doneAtOf derives completion from history (never file mtime);
//           restoreTicket reverses one move; resolveTicketLocation falls back to the archive
//           directories so show/move keep finding archived ids.
// v1.9.0 (2026-10-02, T-20261002-010 M10): the upstream resolution walk for kind manual skips the service-runner running hop — backlog -> waiting -> review -> done (design §5.1).
// v1.8.0 (2026-10-02, T-20261002-003/-005): withTicketLock — shared per-directory ticket
//           lock (owner token, fail-closed, atomic stale takeover) wrapping every
//           existing-ticket mutation, closing the H4 lost-update class against the server
//           merge path; setUpstreamTriage/setUpstreamResolution validate the whole
//           operation BEFORE any write and the resolution walk is resumable (H2).
// v1.7.0 (2026-10-01, T-20261001-017): readTicketRaw — parse WITHOUT validateTicket so a
//           corrupt/hand-edited ticket can be rendered for repair (ticket.ts show fallback).
// v1.6.0 (2026-10-01, T-20261001-016): setUpstreamTriage / setUpstreamResolution — PM triage
//           and reply-back for upstream request tickets (design §12); requester-controlled
//           upstream fields are never touched by either function.
// v1.5.0 (2026-10-01): widen ID pattern to accept U-YYYYMMDD-NNN upstream
//           request tickets (design 2026-10-01-upstream-request-mcp-design.md).
// @l2-propagate: false
// ticket-store.ts — Atomic file I/O for the Phase A ticket queue. Every function
// takes an explicit directory/path so callers (CLI, skill, tests) never assume a
// fixed workspace location.
// Design: docs/archive/superpowers/specs/2026-07-16-service-ticket-kanban-design.md,
//         docs/designs/2026-10-02-upstream-review-backlog-remediations-design.md (§A)

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, openSync, closeSync, statSync, rmSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join, dirname, basename, relative, resolve, isAbsolute } from 'node:path';
import { load, dump, JSON_SCHEMA } from 'js-yaml';
import {
  CURRENT_SCHEMA_VERSION,
  canTransition,
  validateCatalog,
  validateTicket,
  type Catalog,
  type Kind,
  type Priority,
  type Status,
  type Ticket,
  type UpstreamBlock,
} from './ticket-schema.ts';

const MAX_YAML_BYTES = 64 * 1024;
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function nowIso(): string {
  return new Date().toISOString();
}

// Same UTC-normalized YYYY-MM-DD convention as spec-register.ts's today() — duplicated
// (not imported) because spec-register.ts is a CLI-only script with top-level argv
// parsing/process.exit side effects, unsafe to import as a module.
function today(): string {
  return new Date().toISOString().split('T')[0];
}

function loadYamlCapped<T>(path: string): T {
  const stat = statSync(path);
  if (stat.size > MAX_YAML_BYTES) throw new Error(`[ticket-store] refusing to parse oversized YAML (${stat.size} bytes): ${path}`);
  return load(readFileSync(path, 'utf-8'), { schema: JSON_SCHEMA }) as T;
}

/** Ticket id shape enforced at the store boundary (T-20260926-026c): ids reach
 * `join(dir, `${id}.yaml`)`, so an unvalidated id is a path-escape class — the
 * MCP governance server already enforces this pattern (mcp-governance-server.ts),
 * the store must not be weaker than its own tool wrapper. Widened in v1.5.0 to
 * accept upstream request IDs (U-YYYYMMDD-NNN; design 2026-10-01). */
const TICKET_ID_PATTERN = /^[TU]-\d{8}-\d{3,4}$/;

function ticketPath(dir: string, id: string): string {
  if (!TICKET_ID_PATTERN.test(id)) {
    throw new Error(`[ticket-store] invalid ticket id: ${JSON.stringify(id)} — expected T-YYYYMMDD-NNN or U-YYYYMMDD-NNN`);
  }
  return join(dir, `${id}.yaml`);
}

function writeTicketAtomic(dir: string, ticket: Ticket): void {
  mkdirSync(dir, { recursive: true });
  const finalPath = ticketPath(dir, ticket.id);
  const tmpPath = `${finalPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, dump(ticket), 'utf-8');
  renameSync(tmpPath, finalPath);
}

// ——— T-20261002-005 (H4): shared ticket lock ———
// The server's merge path and this store's read-modify-write mutations previously
// used different (or no) locks, so concurrent processes could silently drop each
// other's writes (lost triage, lost duplicates entry, lost resolution). Every
// existing-ticket mutation now runs under ONE per-directory mkdir lock, shared
// with the server by import. Fail-CLOSED on timeout: ticket mutations are
// sub-second, and a silent fail-open is exactly the lost-update class this closes.
const TICKET_LOCK_STALE_MS = 30_000;
const TICKET_LOCK_POLL_MS = 20;

function ticketLockTimeoutMs(): number {
  const raw = process.env.TICKET_LOCK_TIMEOUT_MS;
  if (raw === undefined || raw === '') return 5000;
  if (/^\d{1,6}$/.test(raw.trim())) return parseInt(raw, 10);
  return 5000;
}

function readLockOwner(lockDir: string): string {
  try {
    const owner = JSON.parse(readFileSync(join(lockDir, 'owner'), 'utf-8')) as { pid?: number; holder?: string };
    return `pid ${owner.pid ?? '?'} (${owner.holder ?? 'unknown'})`;
  } catch {
    return 'unknown holder';
  }
}

/** Runs `fn` while holding the per-directory ticket lock (`<dir>/.ticket-lock`).
 * Stale locks (>30s, crashed holder) are taken over by ATOMIC RENAME — exactly one
 * waiter wins the rename, so two waiters can never both "remove" the same lock.
 * Release only removes a lock whose owner token still matches ours, so a holder
 * whose lock was stolen after a pathological >30s operation cannot delete the
 * new holder's lock. NOT re-entrant: nested calls deadlock on the timeout. */
export function withTicketLock<T>(dir: string, holder: string, fn: () => T): T {
  mkdirSync(dir, { recursive: true });
  const lockDir = join(dir, '.ticket-lock');
  const token = randomBytes(8).toString('hex');
  const deadline = Date.now() + ticketLockTimeoutMs();
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      // Stale takeover ONLY for a lock older than TICKET_LOCK_STALE_MS — a fresh
      // lock belongs to an active holder, and renaming it away would break the
      // mutual exclusion this lock exists to provide.
      let stale = false;
      try {
        stale = Date.now() - statSync(lockDir).mtimeMs > TICKET_LOCK_STALE_MS;
      } catch { /* vanished between EEXIST and stat — loop and retry mkdir */ }
      if (stale) {
        try {
          // Atomic takeover: the rename succeeds for exactly one waiter.
          const stalePath = `${lockDir}.stale-${process.pid}-${Date.now()}`;
          renameSync(lockDir, stalePath);
          rmSync(stalePath, { recursive: true, force: true });
          continue;
        } catch { /* another waiter won the rename, or already removed it — wait */ }
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `[ticket-store] could not acquire the ticket lock at ${lockDir} within ${ticketLockTimeoutMs()}ms ` +
          `(held by ${readLockOwner(lockDir)}) — retry, and check for a stuck server process`,
        );
      }
      Bun.sleepSync(TICKET_LOCK_POLL_MS);
    }
  }
  try {
    writeFileSync(join(lockDir, 'owner'), JSON.stringify({ pid: process.pid, token, holder, at: nowIso() }), 'utf-8');
  } catch { /* the lock was stolen between mkdir and owner write — release below is a no-op */ }
  try {
    return fn();
  } finally {
    try {
      const owner = JSON.parse(readFileSync(join(lockDir, 'owner'), 'utf-8')) as { token?: string };
      if (owner.token === token) rmSync(lockDir, { recursive: true, force: true });
    } catch { /* lock already gone (stale-taken) — nothing to release */ }
  }
}

/** T-20261001-017 — raw parse WITHOUT validateTicket. The repair path for a corrupt or
 * hand-edited ticket: `ticket.ts show` falls back to this when validation fails, so the PM
 * can see (and hand-fix) the file instead of hitting a schema error. Returns the parsed
 * object as-is; the caller owns the untrusted-rendering duty. */
export function readTicketRaw(dir: string, id: string): Ticket {
  const path = ticketPath(dir, id);
  if (!existsSync(path)) throw new Error(`[ticket-store] ticket not found: ${id}`);
  return loadYamlCapped<Ticket>(path);
}

export function readTicket(dir: string, id: string): Ticket {
  const path = ticketPath(dir, id);
  if (!existsSync(path)) throw new Error(`[ticket-store] ticket not found: ${id}`);
  const obj = loadYamlCapped<unknown>(path);
  validateTicket(obj);
  return obj;
}

export function listTickets(dir: string, filter?: { status?: Status; kind?: Kind; ready?: boolean }): Ticket[] {
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.yaml') && !f.includes('.tmp-'));
  const tickets = files.map(f => {
    const obj = loadYamlCapped<unknown>(join(dir, f));
    validateTicket(obj);
    return obj;
  });
  const READY_STATUSES: Status[] = ['backlog', 'waiting'];
  return tickets.filter(t =>
    (filter?.status === undefined || t.status === filter.status) &&
    (filter?.kind === undefined || t.kind === filter.kind) &&
    (filter?.ready !== true || (READY_STATUSES.includes(t.status) && (t.not_before === undefined || t.not_before <= today())))
  );
}

/** UTC-normalized (T-20261004-015): ids, created_at and the --ready not_before
 * filter all read as UTC dates, so a 00:30 KST ticket cannot carry a local date
 * that disagrees with its own created_at day. Mirrors today() above. */
function todayPrefix(): string {
  return `T-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
}

function nextSeqGuess(dir: string, prefix: string): number {
  // T-20260912-025: ids live in ONE namespace across both ticket directories —
  // move/list resolve an id with governance/ precedence, so a seq guessed from
  // the target directory alone can mint an id that shadows (or is shadowed by)
  // a same-day ticket in the other directory. Always scan both.
  const dirs = basename(dir) === 'governance'
    ? [dir, dirname(dir)]
    : [dir, join(dir, 'governance')];
  let max = 0;
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      if (!f.startsWith(prefix) || !f.endsWith('.yaml')) continue;
      // v1.4.1 (2026-10-01 review M1): read to the end of the digit run — the
      // fixed 3-char slice truncated 4-digit ids (e.g. T-20260912-1000.yaml)
      // to their first 3 digits, so max-seq guesses started over low and
      // burned collision retries. (Collisions still self-corrected via the
      // `wx` retry; this just stops wasting scans.)
      const seqMatch = /^T-\d{8}-(\d+)\.yaml$/.exec(f);
      const n = seqMatch ? parseInt(seqMatch[1], 10) : NaN;
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max + 1;
}

export interface CreateTicketInput {
  kind: Kind;
  service?: string;
  title?: string;
  inputs?: Record<string, string>;
  priority: Priority;
  not_before?: string;
}

/** Creates a ticket file with a collision-safe ID: computes a candidate seq from a
 * directory scan, then attempts an exclusive (`wx`) create, retrying on EEXIST. */
export function createTicket(dir: string, input: CreateTicketInput): Ticket {
  mkdirSync(dir, { recursive: true });
  const prefix = todayPrefix();
  const MAX_ATTEMPTS = 50;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seq = nextSeqGuess(dir, prefix) + attempt;
    const id = `${prefix}-${String(seq).padStart(3, '0')}`;
    const path = ticketPath(dir, id);
    let fd: number;
    try {
      fd = openSync(path, 'wx');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    closeSync(fd);
    const ticket: Ticket = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id,
      kind: input.kind,
      service: input.kind === 'service' ? input.service : undefined,
      title: input.title,
      inputs: input.inputs,
      priority: input.priority,
      not_before: input.not_before,
      status: 'backlog',
      attempts: 0,
      created_at: nowIso(),
      history: [{ at: nowIso(), from: null, to: 'backlog' }],
      result: null,
      error: null,
    };
    validateTicket(ticket);
    writeTicketAtomic(dir, ticket); // overwrite the empty wx-created file with real content
    return ticket;
  }
  throw new Error(`[ticket-store] could not allocate a ticket id after ${MAX_ATTEMPTS} attempts`);
}

/** Maps a CLI-level id to the store that owns it (T-20261001-009). Service and
 * governance tickets share the `T-YYYYMMDD-NNN` id format but live in different
 * directories, so a bare id can be ambiguous. Accepts the explicit forms
 * `service/<id>` and `governance/<id>`; a bare id resolves only when it exists
 * in exactly one store, and throws naming both paths otherwise.
 * v1.10.0: when the live stores miss, the two archive directories
 * (`<store>/archive`) are searched — an archived ticket resolves to its owning
 * store with `archived: true`, so `show`/`move` keep working after archiving. */
export interface TicketLocation {
  dir: string;
  kind: Kind;
  id: string;
  archived: boolean;
}

export function resolveTicketLocation(
  serviceDir: string,
  governanceDir: string,
  id: string,
): TicketLocation {
  const explicit = /^(service|governance)\/([TU]-\d{8}-\d{3,4})$/.exec(id);
  if (explicit) {
    // T-20261001-016: upstream request tickets (U-) are kind: manual by schema —
    // an explicit service/ prefix on a U- id is a caller error, not a lookup miss.
    if (explicit[1] === 'service' && explicit[2].startsWith('U-')) {
      throw new Error(`[ticket-store] upstream request tickets (${explicit[2]}) are kind: manual — use 'governance/${explicit[2]}' or the bare id`);
    }
    const dir = explicit[1] === 'governance' ? governanceDir : serviceDir;
    const kind: Kind = explicit[1] === 'governance' ? 'manual' : 'service';
    if (existsSync(join(dir, `${explicit[2]}.yaml`))) {
      return { dir, kind, id: explicit[2], archived: false };
    }
    if (existsSync(join(archiveDirFor(dir), `${explicit[2]}.yaml`))) {
      return { dir: archiveDirFor(dir), kind, id: explicit[2], archived: true };
    }
    throw new Error(`[ticket-store] ticket not found: ${explicit[2]} (looked in ${join(dir, explicit[2] + '.yaml')} and ${join(archiveDirFor(dir), explicit[2] + '.yaml')})`);
  }
  if (!TICKET_ID_PATTERN.test(id)) {
    throw new Error(`[ticket-store] invalid ticket id: ${JSON.stringify(id)} — expected T-YYYYMMDD-NNN (optionally prefixed service/<id> or governance/<id>)`);
  }
  const servicePath = join(serviceDir, `${id}.yaml`);
  const governancePath = join(governanceDir, `${id}.yaml`);
  const serviceArchivePath = join(archiveDirFor(serviceDir), `${id}.yaml`);
  const governanceArchivePath = join(archiveDirFor(governanceDir), `${id}.yaml`);
  const inService = existsSync(servicePath);
  const inGovernance = existsSync(governancePath);
  if (inService && inGovernance) {
    throw new Error(
      `[ticket-store] ambiguous ticket id ${id}: it exists in BOTH stores — ` +
      `${governancePath} and ${servicePath}. ` +
      `Re-run with 'governance/${id}' or 'service/${id}' to pick one.`,
    );
  }
  if (inGovernance) return { dir: governanceDir, kind: 'manual', id, archived: false };
  if (inService) return { dir: serviceDir, kind: 'service', id, archived: false };
  const inServiceArchive = existsSync(serviceArchivePath);
  const inGovernanceArchive = existsSync(governanceArchivePath);
  if (inServiceArchive && inGovernanceArchive) {
    throw new Error(
      `[ticket-store] ambiguous ticket id ${id}: it exists in BOTH archives — ` +
      `${governanceArchivePath} and ${serviceArchivePath}. ` +
      `Re-run with 'governance/${id}' or 'service/${id}' to pick one.`,
    );
  }
  // Archived ids resolve to the ARCHIVE directory as the containing dir, so
  // readTicket/moveTicket operate on the real file (review C1, 2026-10-04).
  if (inGovernanceArchive) return { dir: archiveDirFor(governanceDir), kind: 'manual', id, archived: true };
  if (inServiceArchive) return { dir: archiveDirFor(serviceDir), kind: 'service', id, archived: true };
  throw new Error(`[ticket-store] ticket not found: ${id} (looked in ${servicePath}, ${governancePath}, ${serviceArchivePath} and ${governanceArchivePath})`);
}

export interface MoveOptions {
  force?: boolean;
  error?: string;
  /** Outcome summary written to the ticket's `result` field on a `done` transition.
   * The CLI requires a non-empty value for `move <id> done` (T-20260912-023). */
  result?: string;
}

/**
 * Retry budget: a failed ticket may be re-queued (`failed -> waiting`) at most
 * this many times before the store refuses and demands escalation
 * (T-20260926-021, design docs/designs/2026-09-26-runner-lock-retry-enforcement-design.md D2).
 * Previously attempts incremented forever and the "one retry, then escalate"
 * rule lived only in runner-prompt prose. `--force` remains the documented
 * escape; `ticket.ts doctor` surfaces tickets at/over the cap.
 */
export const DEFAULT_ATTEMPTS_CAP = 2;

export function moveTicket(dir: string, id: string, to: Status, opts: MoveOptions = {}): Ticket {
  return withTicketLock(dir, `move:${id}`, () => moveTicketUnlocked(dir, id, to, opts));
}

/** Core transition — caller MUST already hold the ticket lock (see withTicketLock). */
function moveTicketUnlocked(dir: string, id: string, to: Status, opts: MoveOptions = {}): Ticket {
  const ticket = readTicket(dir, id);
  const from = ticket.status;
  if (!opts.force && !canTransition(from, to)) {
    throw new Error(`[ticket-store] transition ${from} -> ${to} is not allowed for ${id} (use --force to override)`);
  }
  const isRetry = from === 'failed' && to === 'waiting';
  const nextAttempts = isRetry ? ticket.attempts + 1 : ticket.attempts;
  if (isRetry && nextAttempts > DEFAULT_ATTEMPTS_CAP && !opts.force) {
    throw new Error(
      `[ticket-store] ${id} has exhausted its retry budget (this would be attempt ${nextAttempts}, cap ${DEFAULT_ATTEMPTS_CAP}) — escalate to a human instead of re-queuing (use --force to override)`,
    );
  }
  ticket.status = to;
  ticket.history.push({ at: nowIso(), from, to });
  if (isRetry) ticket.attempts = nextAttempts;
  if (to === 'failed' && opts.error !== undefined) ticket.error = opts.error;
  if (to === 'done' && opts.result !== undefined) ticket.result = opts.result;
  writeTicketAtomic(dir, ticket);
  return ticket;
}

/** T-20261001-016 — PM triage of an upstream request (pm-gateway-workflow §3.12).
 * Sets `upstream.triage` and moves the status in step: inbox -> backlog, ready -> waiting.
 * Human-in-the-loop: a `flagged: true` ticket is never promoted to ready without
 * `confirmReviewed` (the CLI surfaces this as --confirm-reviewed). Only the triage
 * field and the status change — every requester-controlled upstream field is immutable.
 * T-20261002-003 (H2): the whole operation is validated BEFORE anything is written —
 * a done ticket refuses both triage values, and a ready promotion from a status
 * without a forward edge to waiting (e.g. review) throws with nothing mutated.
 * T-20261002-007 (M2): triage + status + history hop land in ONE atomic write so the
 * file never rests in a state the schema invariants reject (e.g. ready+backlog). */
export function setUpstreamTriage(
  dir: string,
  id: string,
  triage: 'inbox' | 'ready',
  opts: { confirmReviewed?: boolean } = {},
): Ticket {
  return withTicketLock(dir, `triage:${id}`, () => {
    const ticket = readTicket(dir, id);
    if (!ticket.upstream) throw new Error(`[ticket-store] ${id} is not an upstream ticket (no upstream block)`);
    if (ticket.status === 'done') {
      throw new Error(`[ticket-store] ${id} is done — a closed request is never re-triaged`);
    }
    if (triage === 'ready' && ticket.upstream.flagged && !opts.confirmReviewed) {
      throw new Error(`[ticket-store] ${id} is flagged for human review — promote to ready only with confirmReviewed (--confirm-reviewed)`);
    }
    const target: Status = triage === 'ready' ? 'waiting' : 'backlog';
    if (ticket.status !== target && triage === 'ready' && !canTransition(ticket.status, target)) {
      throw new Error(
        `[ticket-store] transition ${ticket.status} -> ${target} is not allowed for ${id} (ready promotion refused, nothing written)`,
      );
    }
    ticket.upstream.triage = triage;
    if (ticket.status !== target) {
      // The adjacency map has no backward edge, so an inbox demotion from a
      // waiting/review ticket needs --force. This is a demotion (never skips a
      // forward gate) and the triage field + this history entry carry the audit trail.
      ticket.history.push({ at: nowIso(), from: ticket.status, to: target });
      ticket.status = target;
    }
    writeTicketAtomic(dir, ticket);
    return readTicket(dir, id);
  });
}

/** T-20261001-016 — record the PM's resolution on an upstream request and close the
 * ticket (pm-gateway-workflow §3.12 step 8). Walks the LEGAL adjacency path to done
 * (backlog -> waiting -> running -> review -> done; failed re-enters at waiting) —
 * never a --force jump, so every hop lands in the history. Writes the outcome into
 * `upstream.resolution` AND the ticket `result` field (the done-transition summary
 * the CLI requires). Requester-controlled upstream fields stay untouched.
 * T-20261002-003 (H2): the full hop chain is validated with canTransition BEFORE
 * anything is written, and the whole walk lands in ONE atomic write — a crash can no
 * longer strand a resolution on a not-done ticket. A ticket that ALREADY carries a
 * resolution but is not yet done (legacy hand-edit or pre-1.8.0 crash) resumes the
 * walk instead of being refused; only status done + existing resolution is
 * "never re-resolved". */
export function setUpstreamResolution(
  dir: string,
  id: string,
  resolution: NonNullable<UpstreamBlock['resolution']>,
  summary: string,
): Ticket {
  return withTicketLock(dir, `resolve:${id}`, () => {
    const ticket = readTicket(dir, id);
    if (!ticket.upstream) throw new Error(`[ticket-store] ${id} is not an upstream ticket (no upstream block)`);
    if (ticket.status === 'done') {
      if (ticket.upstream.resolution) {
        throw new Error(`[ticket-store] ${id} already carries a resolution — a closed request is never re-resolved`);
      }
      throw new Error(`[ticket-store] ${id} is already done`);
    }
    // M10 (T-20261002-010): kind manual never enters the service-runner 'running' hop —
    // design §5.1 maps investigation to review, reached directly from waiting.
    const order: Status[] = ticket.kind === 'manual'
      ? ['backlog', 'waiting', 'review', 'done']
      : ['backlog', 'waiting', 'running', 'review', 'done'];
    let hop: Status = ticket.status;
    const chain: Status[] = [];
    while (hop !== 'done') {
      const next: Status = hop === 'failed' ? 'waiting' : order[order.indexOf(hop) + 1];
      if (!next || !canTransition(hop, next)) {
        throw new Error(`[ticket-store] ${id}: no legal hop from ${hop} toward done (nothing written)`);
      }
      chain.push(next);
      hop = next;
    }
    // Preserve moveTicket's retry-budget rule for the failed -> waiting hop.
    if (ticket.status === 'failed' && ticket.attempts + 1 > DEFAULT_ATTEMPTS_CAP) {
      throw new Error(
        `[ticket-store] ${id} has exhausted its retry budget (attempts ${ticket.attempts}, cap ${DEFAULT_ATTEMPTS_CAP}) — escalate to a human instead of re-queuing (use --force to override)`,
      );
    }
    if (!ticket.upstream.resolution) {
      ticket.upstream.resolution = resolution;
    }
    let from: Status = ticket.status;
    for (const to of chain) {
      ticket.history.push({ at: nowIso(), from, to });
      from = to;
    }
    ticket.status = 'done';
    ticket.result = summary;
    // Keep attempts equal to its definition (failed → waiting hop count) — a failed
    // ticket re-entering through waiting adds one hop, same as moveTicket does.
    ticket.attempts = ticket.history.filter(h => h.from === 'failed' && h.to === 'waiting').length;
    writeTicketAtomic(dir, ticket);
    return readTicket(dir, id);
  });
}

/** Pulls the highest-priority waiting service ticket (urgent > high > normal > low,
 * then creation order) and atomically moves it to `running`. Never returns a manual ticket. */
export function nextServiceTicket(dir: string): Ticket | null {
  const candidates = listTickets(dir, { status: 'waiting', kind: 'service' })
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at));
  if (candidates.length === 0) return null;
  return moveTicket(dir, candidates[0].id, 'running', { force: false });
}

export function staleRunningTickets(dir: string, thresholdMinutes: number): Ticket[] {
  const now = Date.now();
  return listTickets(dir, { status: 'running' }).filter(t => {
    const runningSince = [...t.history].reverse().find(h => h.to === 'running')?.at ?? t.created_at;
    const ageMinutes = (now - new Date(runningSince).getTime()) / 60000;
    return ageMinutes > thresholdMinutes;
  });
}

// ─── v1.10.0 archive (spec docs/designs/2026-10-04-ticket-archive-design.md) ───

/** renameSync with a bounded retry for transient Windows locks (Defender/indexer
 * holding the yaml — review M6; same lesson as 6725f7bb's EBUSY close-before-delete).
 * POSIX EXDEV is impossible here: the archive dir is a child of the store dir. */
function renameWithRetry(src: string, dst: string, attempts = 3): void {
  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(src, dst);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (attempt >= attempts || !["EBUSY", "EPERM", "EACCES"].includes(code ?? "")) throw err;
      Bun.sleepSync(100 * attempt);
    }
  }
}

// ——— v1.10.0 archive (spec docs/designs/2026-10-04-ticket-archive-design.md) ———

/** Dwell time before a done ticket becomes archivable. Requirement: done for at
 * least one week. `--days` overrides per invocation; 0 archives every done ticket. */
export const DEFAULT_ARCHIVE_DAYS = 7;

/** Archive directory of a store: the service store `tickets/` archives into
 * `tickets/archive/` (gitignored — service tickets are ephemeral), the governance
 * store `tickets/governance/` into `tickets/governance/archive/` (git-tracked —
 * the audit trail survives). */
export function archiveDirFor(dir: string): string {
  return join(dir, 'archive');
}

/** Resolves when a done ticket became done: the `at` of the last history entry
 * with `to: 'done'`. Fallbacks for a hand-edited legacy ticket whose history
 * lacks the done entry: the newest history entry's `at`, then `created_at`.
 * File mtime is deliberately never used — it resets on every clone and would
 * mis-age candidates on a fresh checkout. */
export function doneAtOf(ticket: Ticket): string {
  const doneEntry = [...ticket.history].reverse().find(h => h.to === 'done');
  if (doneEntry) return doneEntry.at;
  const last = ticket.history[ticket.history.length - 1];
  return last?.at ?? ticket.created_at;
}

export interface ArchiveCandidate {
  ticket: Ticket;
  doneAt: string;
  ageDays: number;
}

/** Done tickets of one store whose done-dwell reached `days`. Non-done tickets
 * never qualify, regardless of age. Sorted by id for stable output. */
export function archiveCandidates(dir: string, days: number, now: number = Date.now()): ArchiveCandidate[] {
  const dwellMs = days * 86_400_000;
  return listTickets(dir, { status: 'done' })
    .map(ticket => {
      const doneAt = doneAtOf(ticket);
      return { ticket, doneAt, ageDays: (now - new Date(doneAt).getTime()) / 86_400_000 };
    })
    .filter(c => now - new Date(c.doneAt).getTime() >= dwellMs)
    .sort((a, b) => a.ticket.id.localeCompare(b.ticket.id));
}

/** Moves every eligible done ticket of one store into its archive directory.
 * Each move is a rename under the store's ticket lock — the file content is
 * never modified (the archive state lives in the path, not in the YAML). A
 * ticket that vanishes between scan and lock is skipped; an existing archive
 * file with the same id is never overwritten. */
export function archiveTickets(dir: string, days: number, opts: { now?: number; candidates?: ArchiveCandidate[] } = {}): Ticket[] {
  const moved: Ticket[] = [];
  // Single-scan contract (review M3): callers that already ran archiveCandidates
  // (the CLI plan) pass them here, so the summary reports exactly what was scanned.
  const candidates = opts.candidates ?? archiveCandidates(dir, days, opts.now);
  for (const c of candidates) {
    withTicketLock(dir, `archive:${c.ticket.id}`, () => {
      const src = ticketPath(dir, c.ticket.id);
      if (!existsSync(src)) return; // moved concurrently between scan and lock
      const archiveDir = archiveDirFor(dir);
      const dst = ticketPath(archiveDir, c.ticket.id);
      if (existsSync(dst)) {
        throw new Error(`[ticket-store] refusing to overwrite an existing archived ticket: ${dst}`);
      }
      mkdirSync(archiveDir, { recursive: true });
      renameWithRetry(src, dst);
      moved.push(c.ticket);
    });
  }
  return moved;
}

/** Moves one archived ticket back into its live store. Idempotence guard: a
 * live file with the same id refuses the restore. */
export function restoreTicket(dir: string, id: string): Ticket {
  withTicketLock(dir, `restore:${id}`, () => {
    const src = ticketPath(archiveDirFor(dir), id);
    if (!existsSync(src)) {
      throw new Error(`[ticket-store] no archived ticket ${id} in ${archiveDirFor(dir)}`);
    }
    const dst = ticketPath(dir, id);
    if (existsSync(dst)) {
      throw new Error(`[ticket-store] a live ticket ${id} already exists — nothing to restore`);
    }
    renameWithRetry(src, dst);
  });
  return readTicket(dir, id);
}

export function loadCatalog(catalogPath: string): Catalog {
  const obj = loadYamlCapped<unknown>(catalogPath);
  validateCatalog(obj);
  return obj;
}

export interface ResolvedService {
  type: 'skill' | 'script';
  ref: string;
  absPath: string;
}

/** Looks up a service by id in an already-loaded, already-validated catalog and
 * re-asserts the resolved path stays under `workspaceRoot` (defense in depth —
 * validateCatalog already enforced the ref pattern at load time). */
export function resolveServiceRef(catalog: Catalog, serviceId: string, workspaceRoot: string): ResolvedService {
  const svc = catalog.services.find(s => s.id === serviceId);
  if (!svc) throw new Error(`[ticket-store] unknown service id: ${serviceId}`);
  const base = svc.run.type === 'script' ? svc.run.ref : join('skills', svc.run.ref);
  const root = resolve(workspaceRoot);
  const absPath = resolve(root, base);
  const rel = relative(root, absPath);
  if (rel === '' ? false : rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`[ticket-store] resolved service ref escapes workspace root: ${absPath}`);
  }
  return { type: svc.run.type, ref: svc.run.ref, absPath };
}
