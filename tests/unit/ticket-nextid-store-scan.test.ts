// @version 1.0.0
// tests/unit/ticket-nextid-store-scan.test.ts — T-20261127-001b (spec
// docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md §4, AC-4):
// the next-id (max-seq) allocation scan must cover BOTH live stores AND BOTH
// archive directories, in both directions (entry via the service store or the
// governance store). Before v1.16.0 a same-day id that had left a live store
// (archiveTickets --days 0, or pending restoreTicket) was invisible to
// nextSeqGuess, so create could mint a colliding id that resurfaced as
// cross-store ambiguity on restore — the U-20261126-003 double-assignment
// shape. Ids here are date-scoped (same KST day), so every seed uses today's
// KST prefix, mirrored arithmetically like tests/unit/mcp-upstream-id-allocation.test.ts.
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTicket, resolveTicketLocation, AmbiguousTicketError } from '../../scripts/helpers/ticket-store.ts';

let root: string;
let serviceDir: string;
let governanceDir: string;
let serviceArchiveDir: string;
let governanceArchiveDir: string;

// Mirrors scripts/helpers/kst-time.ts (the store's id-prefix source). Offset is
// applied arithmetically so the result never depends on the machine TZ.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function kstDate(): string {
  return new Date(Date.now() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
const prefix = `T-${kstDate().replace(/-/g, '')}`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ticket-nextid-scan-'));
  serviceDir = join(root, 'tickets');
  governanceDir = join(root, 'tickets', 'governance');
  serviceArchiveDir = join(serviceDir, 'archive');
  governanceArchiveDir = join(governanceDir, 'archive');
  mkdirSync(serviceDir, { recursive: true });
  mkdirSync(governanceDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Seeds a same-day ticket file into a store/archive dir (existence is all the
 * max-seq scan needs — resolve/create never parses these). */
function seed(dir: string, seq: number): void {
  mkdirSync(dir, { recursive: true });
  const id = `${prefix}-${String(seq).padStart(3, '0')}`;
  writeFileSync(join(dir, `${id}.yaml`), `id: ${id}\n`, 'utf-8');
}

describe('next-id allocation scans both stores AND both archives (T-20261127-001b AC-4)', () => {
  test('governance-only seed: create via the SERVICE store skips past it', () => {
    seed(governanceDir, 2);
    const t = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(t.id).toBe(`${prefix}-003`);
  });

  test('service-only seed: create via the GOVERNANCE store skips past it', () => {
    seed(serviceDir, 4);
    const t = createTicket(governanceDir, { kind: 'manual', title: 'nextid probe', priority: 'low' });
    expect(t.id).toBe(`${prefix}-005`);
  });

  test('both-stores seeds: the max across BOTH live stores is respected', () => {
    // Regression pin of the T-20260912-025 behavior the widened scan must keep:
    // the service -002 twin must not let governance allocate under governance -003.
    seed(serviceDir, 2);
    seed(governanceDir, 3);
    const t = createTicket(governanceDir, { kind: 'manual', title: 'nextid probe 2', priority: 'low' });
    expect(t.id).toBe(`${prefix}-004`);
  });

  test('GOVERNANCE-archive seed (via the service store): allocation skips past it', () => {
    // The blind spot fixed by v1.16.0: the same-day -005 twin lives only in the
    // governance archive; allocating -005 live would double-assign the id and
    // resurface as BOTH-stores ambiguity when the archive twin is restored.
    seed(governanceArchiveDir, 5);
    const t = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(t.id).toBe(`${prefix}-006`);
  });

  test('SERVICE-archive seed (via the governance store): allocation skips past it', () => {
    seed(serviceArchiveDir, 1);
    const t = createTicket(governanceDir, { kind: 'manual', title: 'nextid probe 3', priority: 'low' });
    expect(t.id).toBe(`${prefix}-002`);
  });

  test('archive + live mix: the scan takes the max over all four directories', () => {
    seed(serviceArchiveDir, 7);
    seed(governanceDir, 9);
    seed(governanceArchiveDir, 5);
    const t = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(t.id).toBe(`${prefix}-010`);
  });
});

describe('AmbiguousTicketError typed fields (T-20261127-001a, spec §3.1)', () => {
  test('BOTH-stores throw carries id + both paths + scope "stores"', () => {
    const svc = createTicket(serviceDir, { kind: 'service', service: 'audit', priority: 'normal' });
    mkdirSync(governanceDir, { recursive: true });
    writeFileSync(
      join(governanceDir, `${svc.id}.yaml`),
      `id: ${svc.id}\n`,
      'utf-8',
    );
    let err: unknown;
    try {
      resolveTicketLocation(serviceDir, governanceDir, svc.id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AmbiguousTicketError);
    const amb = err as AmbiguousTicketError;
    expect(amb.id).toBe(svc.id);
    expect(amb.scope).toBe('stores');
    expect(amb.locations).toEqual([join(governanceDir, `${svc.id}.yaml`), join(serviceDir, `${svc.id}.yaml`)]);
    // message contract unchanged (pinned by ticket-id-namespacing.test.ts too)
    expect(amb.message).toContain('ambiguous');
  });

  test('BOTH-archives throw carries scope "archives"', () => {
    const id = `${prefix}-777`;
    seed(serviceArchiveDir, 777);
    mkdirSync(governanceArchiveDir, { recursive: true });
    writeFileSync(join(governanceArchiveDir, `${id}.yaml`), `id: ${id}\n`, 'utf-8');
    let err: unknown;
    try {
      resolveTicketLocation(serviceDir, governanceDir, id);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AmbiguousTicketError);
    const amb = err as AmbiguousTicketError;
    expect(amb.scope).toBe('archives');
    expect(amb.locations).toEqual([
      join(governanceArchiveDir, `${id}.yaml`),
      join(serviceArchiveDir, `${id}.yaml`),
    ]);
  });
});
