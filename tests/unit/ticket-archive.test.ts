import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import {
  createTicket,
  listTickets,
  moveTicket,
  resolveTicketLocation,
  archiveDirFor,
  archiveCandidates,
  archiveTickets,
  restoreTicket,
  doneAtOf,
  DEFAULT_ARCHIVE_DAYS,
} from '../../scripts/helpers/ticket-store.ts';
import type { Ticket } from '../../scripts/helpers/ticket-schema.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ticket-archive-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Creates a done ticket through the real transition path, then ages the whole
 * ticket (created_at and every history timestamp) into the past with the done
 * transition landing exactly `doneDaysAgo` — modeling a real done ticket, whose
 * creation prefix is necessarily at least as old as its done dwell. */
function makeAgedDoneTicket(dir: string, doneDaysAgo: number, opts: { kind?: 'service' | 'manual'; service?: string; title?: string } = {}): Ticket {
  const input = opts.kind === 'service'
    ? { kind: 'service' as const, service: opts.service ?? 'audit', priority: 'normal' as const }
    : { kind: 'manual' as const, title: opts.title ?? 'archivable work', priority: 'normal' as const };
  const t = createTicket(dir, input);
  const done = moveTicket(dir, t.id, 'done', { force: true, result: 'shipped' });
  const doneAt = new Date(Date.now() - doneDaysAgo * 86_400_000).toISOString();
  const createdAt = new Date(Date.now() - (doneDaysAgo + 1) * 86_400_000).toISOString();
  const aged: Ticket = {
    ...done,
    created_at: createdAt,
    history: done.history.map((h, i) => (i === done.history.length - 1 ? { ...h, at: doneAt } : { ...h, at: createdAt })),
  };
  writeFileSync(join(dir, `${t.id}.yaml`), dump(aged), 'utf-8');
  return aged;
}

describe('doneAtOf', () => {
  test('returns the at of the last done transition', () => {
    const t = makeAgedDoneTicket(dir, 10);
    expect(doneAtOf(t)).toBe(t.history[t.history.length - 1].at);
  });

  test('falls back to the newest history entry when no done transition exists', () => {
    const base: Ticket = {
      schemaVersion: 1, id: 'T-20260901-001', kind: 'manual', title: 'x', priority: 'normal',
      status: 'waiting', attempts: 0, created_at: '2026-09-01T00:00:00.000Z',
      history: [{ at: '2026-09-02T00:00:00.000Z', from: null, to: 'backlog' }, { at: '2026-09-03T00:00:00.000Z', from: 'backlog', to: 'waiting' }],
      result: null, error: null,
    };
    expect(doneAtOf(base)).toBe('2026-09-03T00:00:00.000Z');
  });

  test('falls back to created_at when history is empty', () => {
    const base = { created_at: '2026-09-01T00:00:00.000Z', history: [] } as unknown as Ticket;
    expect(doneAtOf(base)).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('archiveCandidates', () => {
  test('selects only done tickets past the dwell threshold', () => {
    makeAgedDoneTicket(dir, 8, { title: 'old done' });
    makeAgedDoneTicket(dir, 2, { title: 'fresh done' });
    const waiting = createTicket(dir, { kind: 'manual', title: 'not done', priority: 'low' });
    moveTicket(dir, waiting.id, 'waiting');
    const candidates = archiveCandidates(dir, DEFAULT_ARCHIVE_DAYS);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].ticket.title).toBe('old done');
    expect(candidates[0].ageDays).toBeGreaterThanOrEqual(DEFAULT_ARCHIVE_DAYS);
  });

  test('a --days 0 sweep picks up every done ticket including fresh ones', () => {
    makeAgedDoneTicket(dir, 0);
    expect(archiveCandidates(dir, 0)).toHaveLength(1);
  });
});

describe('archiveTickets', () => {
  test('moves the file into <store>/archive with identical, still-valid content', () => {
    const t = makeAgedDoneTicket(dir, 9);
    const moved = archiveTickets(dir, DEFAULT_ARCHIVE_DAYS);
    expect(moved.map(x => x.id)).toEqual([t.id]);
    expect(existsSync(join(dir, `${t.id}.yaml`))).toBe(false);
    const archived = listTickets(archiveDirFor(dir));
    expect(archived.map(x => x.id)).toEqual([t.id]);
    expect(archived[0].status).toBe('done');
    expect(archived[0].result).toBe('shipped');
    expect(archived[0].history).toEqual(t.history);
  });

  test('the live store no longer lists archived tickets', () => {
    makeAgedDoneTicket(dir, 9);
    archiveTickets(dir, DEFAULT_ARCHIVE_DAYS);
    expect(listTickets(dir, { status: 'done' })).toHaveLength(0);
  });

  test('never archives non-done tickets regardless of age', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'stuck in backlog', priority: 'low' });
    const nothing = archiveTickets(dir, 0, { now: Date.now() + 365 * 86_400_000 });
    expect(nothing).toHaveLength(0);
    expect(existsSync(join(dir, `${t.id}.yaml`))).toBe(true);
  });

  test('keeps the two stores independent (service vs governance layout)', () => {
    const governance = join(dir, 'governance');
    mkdirSync(governance, { recursive: true });
    makeAgedDoneTicket(governance, 9, { title: 'governance work' });
    makeAgedDoneTicket(dir, 9, { kind: 'service', service: 'audit' });
    expect(archiveCandidates(governance, DEFAULT_ARCHIVE_DAYS)).toHaveLength(1);
    expect(archiveCandidates(dir, DEFAULT_ARCHIVE_DAYS)).toHaveLength(1);
    archiveTickets(governance, DEFAULT_ARCHIVE_DAYS);
    expect(existsSync(join(archiveDirFor(governance), `${listTickets(archiveDirFor(governance))[0].id}.yaml`))).toBe(true);
    expect(listTickets(dir, { status: 'done' })).toHaveLength(1);
  });
});

describe('restoreTicket', () => {
  test('round-trips an archived ticket back into the live store', () => {
    const t = makeAgedDoneTicket(dir, 9);
    archiveTickets(dir, DEFAULT_ARCHIVE_DAYS);
    const restored = restoreTicket(dir, t.id);
    expect(restored.id).toBe(t.id);
    expect(existsSync(join(archiveDirFor(dir), `${t.id}.yaml`))).toBe(false);
    expect(listTickets(dir, { status: 'done' }).map(x => x.id)).toEqual([t.id]);
  });

  test('refuses to restore an id that is not archived', () => {
    expect(() => restoreTicket(dir, 'T-20260901-001')).toThrow(/no archived ticket/);
  });

  test('refuses when a live ticket already occupies the id', () => {
    const t = makeAgedDoneTicket(dir, 9);
    archiveTickets(dir, DEFAULT_ARCHIVE_DAYS);
    // hand-place a copy back into the live store; the restore must not clobber it
    writeFileSync(join(dir, `${t.id}.yaml`), dump(t), 'utf-8');
    expect(() => restoreTicket(dir, t.id)).toThrow(/already exists/);
  });
});

describe('resolveTicketLocation with archives', () => {
  test('falls back to the archive directory and flags archived: true', () => {
    const governance = join(dir, 'governance');
    mkdirSync(governance, { recursive: true });
    const t = makeAgedDoneTicket(governance, 9);
    archiveTickets(governance, DEFAULT_ARCHIVE_DAYS);
    const bare = resolveTicketLocation(dir, governance, t.id);
    expect(bare).toEqual({ dir: governance, kind: 'manual', id: t.id, archived: true });
    const explicit = resolveTicketLocation(dir, governance, `governance/${t.id}`);
    expect(explicit.archived).toBe(true);
    expect(explicit.dir).toBe(governance);
  });

  test('still throws ticket-not-found when live and archive both miss', () => {
    expect(() => resolveTicketLocation(dir, join(dir, 'governance'), 'T-20260901-001')).toThrow(/ticket not found/);
  });

  test('a live ticket still resolves with archived: false', () => {
    const t = makeAgedDoneTicket(dir, 9);
    const loc = resolveTicketLocation(dir, join(dir, 'governance'), t.id);
    expect(loc.archived).toBe(false);
    expect(loc.dir).toBe(dir);
  });
});

describe('id allocation after archiving', () => {
  test('createTicket keeps allocating cleanly once done tickets are archived', () => {
    // A real archived ticket carries its original (old) creation-date prefix —
    // ids are allocated at creation and never rewritten by archiving — so seed
    // one by hand instead of allocating it today.
    const doneAt = new Date(Date.now() - 9 * 86_400_000).toISOString();
    const aged: Ticket = {
      schemaVersion: 1, id: 'T-20260925-001', kind: 'manual', title: 'old closed work', priority: 'normal',
      status: 'done', attempts: 0, created_at: doneAt,
      history: [{ at: doneAt, from: 'review', to: 'done' }],
      result: 'closed', error: null,
    };
    writeFileSync(join(dir, 'T-20260925-001.yaml'), dump(aged), 'utf-8');
    archiveTickets(dir, DEFAULT_ARCHIVE_DAYS);
    const fresh = createTicket(dir, { kind: 'manual', title: 'new work', priority: 'normal' });
    expect(fresh.id).not.toBe(aged.id);
    expect(existsSync(join(dir, `${fresh.id}.yaml`))).toBe(true);
    expect(existsSync(join(archiveDirFor(dir), 'T-20260925-001.yaml'))).toBe(true);
    expect(listTickets(dir).map(x => x.id)).toContain(fresh.id);
  });
});

describe('ticket.ts CLI (subprocess, TICKET_WORKSPACE_ROOT seam)', () => {
  const ticketCli = join(import.meta.dir, '..', '..', 'scripts', 'ticket.ts');

  function runCli(args: string[], root: string) {
    const proc = Bun.spawnSync(['bun', ticketCli, ...args], {
      env: { ...process.env, TICKET_WORKSPACE_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
  }

  function seedAgedGovernanceDone(root: string, id: string, doneDaysAgo: number): void {
    const gov = join(root, 'tickets', 'governance');
    mkdirSync(gov, { recursive: true });
    const doneAt = new Date(Date.now() - doneDaysAgo * 86_400_000).toISOString();
    const ticket: Ticket = {
      schemaVersion: 1, id, kind: 'manual', title: 'old closed work', priority: 'normal',
      status: 'done', attempts: 0, created_at: doneAt,
      history: [{ at: doneAt, from: 'review', to: 'done' }],
      result: 'closed', error: null,
    };
    writeFileSync(join(gov, `${id}.yaml`), dump(ticket), 'utf-8');
  }

  test('dry-run is the default and --apply moves into tickets/governance/archive', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-archive-'));
    try {
      seedAgedGovernanceDone(root, 'T-20260901-001', 10);
      seedAgedGovernanceDone(root, 'T-202609280001', 1);
      const plan = runCli(['archive'], root);
      expect(plan.code).toBe(0);
      expect(plan.out).toContain('[dry-run]');
      expect(plan.out).toContain('T-20260901-001');
      expect(plan.out).not.toContain('T-202609280001');
      expect(existsSync(join(root, 'tickets', 'governance', 'T-20260901-001.yaml'))).toBe(true);
      expect(plan.out).toMatch(/1 ticket\(s\) eligible/);

      const applied = runCli(['archive', '--apply'], root);
      expect(applied.code).toBe(0);
      expect(applied.out).toContain('archived 1 ticket(s)');
      expect(existsSync(join(root, 'tickets', 'governance', 'T-20260901-001.yaml'))).toBe(false);
      expect(existsSync(join(root, 'tickets', 'governance', 'archive', 'T-20260901-001.yaml'))).toBe(true);
      expect(existsSync(join(root, 'tickets', 'governance', 'T-202609280001.yaml'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('--restore moves an archived id back; show resolves it afterwards', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-restore-'));
    try {
      seedAgedGovernanceDone(root, 'T-20260901-002', 10);
      expect(runCli(['archive', '--apply'], root).code).toBe(0);
      const restored = runCli(['archive', '--restore', 'T-20260901-002'], root);
      expect(restored.code).toBe(0);
      expect(restored.out).toMatch(/restored/);
      expect(existsSync(join(root, 'tickets', 'governance', 'T-20260901-002.yaml'))).toBe(true);
      const shown = runCli(['show', 'T-20260901-002'], root);
      expect(shown.code).toBe(0);
      expect(shown.out).toContain('old closed work');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('list --archived prints the archive scan with the [ARCHIVED] marker', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-list-'));
    try {
      seedAgedGovernanceDone(root, 'T-20260901-003', 10);
      expect(runCli(['archive', '--apply'], root).code).toBe(0);
      const listed = runCli(['list', '--archived'], root);
      expect(listed.code).toBe(0);
      expect(listed.out).toContain('T-20260901-003');
      expect(listed.out).toContain('[ARCHIVED]');
      const live = runCli(['list'], root);
      expect(live.out).not.toContain('T-20260901-003');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('--days must be a non-negative integer', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-days-'));
    try {
      const bad = runCli(['archive', '--days', 'week'], root);
      expect(bad.code).toBe(1);
      expect(bad.err).toContain('--days must be a non-negative integer');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
