import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTicket,
  listTickets,
  moveTicket,
  nextServiceTicket,
  staleRunningTickets,
  loadCatalog,
  resolveServiceRef,
  DuplicateTicketError,
} from '../../scripts/helpers/ticket-store.ts';
import { kstDate } from '../../scripts/helpers/kst-time.ts';

let dir: string;

/** Minimal VALID ticket file for store seeds — the v1.15.0 duplicate scan in
 * createTicket reads the store with listTickets, which validates every .yaml
 * present, so seed files can no longer be contentless dummies. */
function validSeedTicketYaml(id: string): string {
  const now = new Date().toISOString();
  return [
    'schemaVersion: 1',
    `id: ${id}`,
    'kind: manual',
    'title: seed',
    'priority: low',
    'status: backlog',
    'attempts: 0',
    `created_at: '${now}'`,
    'history:',
    `  - at: '${now}'`,
    '    from: null',
    '    to: backlog',
    'result: null',
    'error: null',
    '',
  ].join('\n');
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ticket-store-test-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('createTicket', () => {
  test('creates a service ticket with backlog status and history entry', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(t.status).toBe('backlog');
    expect(t.history).toHaveLength(1);
    expect(t.history[0].to).toBe('backlog');
    expect(t.id).toMatch(/^T-\d{8}-\d{3}$/);
  });

  test('creates a manual ticket with a title and no service field', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'Fix typo', priority: 'low' });
    expect(t.kind).toBe('manual');
    expect(t.service).toBeUndefined();
  });

  test('assigns non-colliding IDs for rapid successive creates', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const t = createTicket(dir, { kind: 'manual', title: `task ${i}`, priority: 'normal' });
      ids.add(t.id);
    }
    expect(ids.size).toBe(10);
  });

  test('sequences past an existing 4-digit id without wasting collision retries (v1.4.1, review M1)', () => {
    // v1.4.0 read a fixed 3-char slice, so a pre-existing T-<today>-1000.yaml
    // truncated to 1000 -> "100" and the next guess started at 101, colliding
    // its way up; the parse now reads the full digit run. The seed is a VALID
    // ticket file (v1.15.0): createTicket's duplicate scan reads the store with
    // listTickets, which validates every .yaml it finds.
    const prefix = `T-${kstDate().replace(/-/g, '')}`;
    writeFileSync(join(dir, `${prefix}-1000.yaml`), validSeedTicketYaml(`${prefix}-1000`));
    const t = createTicket(dir, { kind: 'manual', title: 'after 4-digit', priority: 'normal' });
    expect(t.id).toBe(`${prefix}-1001`);
  });

  test('allocates an id that does not collide with the governance directory (T-20260912-025)', () => {
    // move/list resolve ids with governance/ precedence, so a same-day id
    // allocated in tickets/ root must not shadow-match one already handed
    // out in tickets/governance/ (the scratch-create incident of 2026-09-12).
    const governance = join(dir, 'governance');
    const gov = createTicket(governance, { kind: 'manual', title: 'governance ticket', priority: 'high' });
    const svc = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(svc.id).not.toBe(gov.id);
    // and the reverse order must hold too
    const gov2 = createTicket(governance, { kind: 'manual', title: 'governance ticket 2', priority: 'normal' });
    const svc2 = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(gov2.id).not.toBe(svc.id);
    expect(svc2.id).not.toBe(gov.id);
    expect(svc2.id).not.toBe(svc.id);
    expect(gov2.id).not.toBe(gov.id);
  });
});

describe('createTicket durability (v1.15.0, T-20261104-004 item 3 — project-loss-hardening design §5.3)', () => {
  test('creates a fully-formed file in ONE atomic step — no empty-file window, no temp residue', () => {
    // The v1.14 wx-create-then-rename dance left a zero-byte .yaml if the process
    // crashed between the two calls, wedging listTickets and consuming the id.
    // The link-based create materializes the FULLY-FORMED file in one step.
    const t = createTicket(dir, { kind: 'manual', title: 'durable create', priority: 'normal' });
    const raw = readFileSync(join(dir, `${t.id}.yaml`), 'utf-8');
    expect(raw.trim().length).toBeGreaterThan(0);
    expect(raw).toContain(`id: ${t.id}`);
    // the read path parses it without a validation error
    const parsed = listTickets(dir).find((x) => x.id === t.id);
    expect(parsed?.title).toBe('durable create');
    // the temp file is unlinked on the success path — no residue
    const leftovers = readdirSync(dir).filter((n) => n.includes('.tmp-'));
    expect(leftovers).toEqual([]);
  });

  test('duplicate normalized title is refused with DuplicateTicketError naming the existing id', () => {
    const a = createTicket(dir, { kind: 'manual', title: 'Fix  the  Login Bug', priority: 'normal' });
    // case + whitespace-collapsed normalization: same title, different spelling
    expect(() => createTicket(dir, { kind: 'manual', title: 'fix the login bug', priority: 'low' }))
      .toThrow(DuplicateTicketError);
    try {
      createTicket(dir, { kind: 'manual', title: 'FIX THE LOGIN BUG', priority: 'high' });
      throw new Error('unreachable: duplicate was not refused');
    } catch (e) {
      expect(e).toBeInstanceOf(DuplicateTicketError);
      expect((e as DuplicateTicketError).existingId).toBe(a.id);
    }
    // the refusal happens BEFORE any id is allocated — the id namespace is not burned
    const b = createTicket(dir, { kind: 'manual', title: 'different title entirely', priority: 'normal' });
    expect(b.id).not.toBe(a.id);
  });

  test('duplicate detection spans BOTH stores — refusal works in either direction', () => {
    const governance = join(dir, 'governance');
    const gov = createTicket(governance, { kind: 'manual', title: 'cross-store dup', priority: 'normal' });
    expect(() => createTicket(dir, { kind: 'manual', title: 'cross-store dup', priority: 'normal' }))
      .toThrow(DuplicateTicketError);
    const svc = createTicket(dir, { kind: 'manual', title: 'service-side original', priority: 'normal' });
    expect(() => createTicket(governance, { kind: 'manual', title: 'service-side original', priority: 'normal' }))
      .toThrow(DuplicateTicketError);
    expect(gov.id).not.toBe(svc.id);
  });

  test('service tickets carry no title and stay exempt from the title-duplicate check', () => {
    createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    const b = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    expect(b.kind).toBe('service');
  });

  test('corrupt store noise does not wedge create — the tolerant duplicate scan skips invalid files', () => {
    // A corrupt/invalid ticket file is a known store state (readTicketRaw
    // repair path); it carries no trustworthy title, so the duplicate scan
    // must skip it instead of failing every subsequent create with an
    // unrelated schema error — while still catching real duplicates.
    writeFileSync(join(dir, `T-20261105-001.yaml`), 'schemaVersion: 1\nid: T-20261105-001\nsev: SEV4\n');
    const t = createTicket(dir, { kind: 'manual', title: 'created despite noise', priority: 'normal' });
    expect(t.id).not.toBe('T-20261105-001');
    // a real duplicate among the VALID files is still refused
    expect(() => createTicket(dir, { kind: 'manual', title: 'created despite noise', priority: 'low' }))
      .toThrow(DuplicateTicketError);
  });

  test('allowDuplicate override permits the legitimate re-file-after-archive case (DEC-20261104-02 ruling 5)', () => {
    const a = createTicket(dir, { kind: 'manual', title: 're-file me', priority: 'normal' });
    const b = createTicket(dir, { kind: 'manual', title: 're-file me', priority: 'normal' }, { allowDuplicate: true });
    expect(b.id).not.toBe(a.id);
    expect(listTickets(dir)).toHaveLength(2);
  });

  test('collision retry: a pre-existing id file advances the seq instead of colliding the link', () => {
    const prefix = `T-${kstDate().replace(/-/g, '')}`;
    writeFileSync(join(dir, `${prefix}-001.yaml`), validSeedTicketYaml(`${prefix}-001`));
    const t = createTicket(dir, { kind: 'manual', title: 'after seed', priority: 'normal' });
    expect(t.id).toBe(`${prefix}-002`);
  });
});

describe('listTickets ready filter (not_before boundary cases)', () => {
  // KST calendar day, the same convention ticket-store.ts uses for --ready not_before.
  function today(): string {
    return kstDate();
  }
  function isoDaysFromToday(delta: number): string {
    return kstDate(new Date(Date.now() + delta * 86_400_000));
  }

  test('not_before unset is always ready', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'unset', priority: 'normal' });
    const ready = listTickets(dir, { ready: true }).map(x => x.id);
    expect(ready).toContain(t.id);
  });

  test('not_before in the past is ready', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'past', priority: 'normal', not_before: isoDaysFromToday(-7) });
    const ready = listTickets(dir, { ready: true }).map(x => x.id);
    expect(ready).toContain(t.id);
  });

  test('not_before exactly equal to today is ready (boundary: <=, not <)', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'today', priority: 'normal', not_before: today() });
    const ready = listTickets(dir, { ready: true }).map(x => x.id);
    expect(ready).toContain(t.id);
  });

  test('not_before in the future is not ready', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'future', priority: 'normal', not_before: isoDaysFromToday(7) });
    const ready = listTickets(dir, { ready: true }).map(x => x.id);
    expect(ready).not.toContain(t.id);
  });

  test('ready filter still excludes done/failed tickets regardless of not_before', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'done-past', priority: 'normal', not_before: isoDaysFromToday(-7) });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'review', { force: false });
    moveTicket(dir, t.id, 'done', { force: false });
    const ready = listTickets(dir, { ready: true }).map(x => x.id);
    expect(ready).not.toContain(t.id);
  });
});

describe('moveTicket', () => {
  test('allows an adjacent transition without --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    const moved = moveTicket(dir, t.id, 'waiting', { force: false });
    expect(moved.status).toBe('waiting');
    expect(moved.history).toHaveLength(2);
  });

  test('rejects a non-adjacent transition without --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    expect(() => moveTicket(dir, t.id, 'done', { force: false })).toThrow();
  });

  test('allows a non-adjacent transition with --force', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    const moved = moveTicket(dir, t.id, 'done', { force: true });
    expect(moved.status).toBe('done');
  });

  test('failed -> waiting increments attempts', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    moveTicket(dir, t.id, 'failed', { force: false });
    const retried = moveTicket(dir, t.id, 'waiting', { force: false });
    expect(retried.attempts).toBe(1);
  });

  test('sets the error field when moving to failed with an error message', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    const failed = moveTicket(dir, t.id, 'failed', { error: 'boom' });
    expect(failed.error).toBe('boom');
  });

  test('writes the result field when moving to done with a result (T-20260912-023)', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'review', { force: false });
    const done = moveTicket(dir, t.id, 'done', { force: false, result: 'implemented and verified' });
    expect(done.status).toBe('done');
    expect(done.result).toBe('implemented and verified');
  });

  test('store leaves result null when no result option is passed — the non-empty --result requirement is enforced at the CLI layer, not here', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'x', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'review', { force: false });
    const done = moveTicket(dir, t.id, 'done', { force: false });
    expect(done.status).toBe('done');
    expect(done.result).toBeNull();
  });
});

describe('nextServiceTicket', () => {
  test('returns the highest-priority waiting service ticket and moves it to running', () => {
    const low = createTicket(dir, { kind: 'service', service: 'audit', priority: 'low' });
    moveTicket(dir, low.id, 'waiting', { force: false });
    const urgent = createTicket(dir, { kind: 'service', service: 'audit', priority: 'urgent' });
    moveTicket(dir, urgent.id, 'waiting', { force: false });

    const picked = nextServiceTicket(dir);
    expect(picked?.id).toBe(urgent.id);
    expect(picked?.status).toBe('running');
  });

  test('never returns a manual ticket, even if waiting', () => {
    const manual = createTicket(dir, { kind: 'manual', title: 'x', priority: 'urgent' });
    moveTicket(dir, manual.id, 'waiting', { force: false });
    expect(nextServiceTicket(dir)).toBeNull();
  });

  test('returns null when no waiting service tickets exist', () => {
    expect(nextServiceTicket(dir)).toBeNull();
  });

  test('never returns an upstream (U-) ticket, even when it is waiting with high priority in the same directory', () => {
    writeFileSync(join(dir, 'U-20261001-001.yaml'), [
      'schemaVersion: 1', 'id: U-20261001-001', 'kind: manual', 'title: Upstream request from co-test', 'priority: urgent',
      'status: waiting', 'attempts: 0', 'created_at: "2026-10-01T00:00:00.000Z"',
      'history:', '  - at: "2026-10-01T00:00:00.000Z"', '    from: null', '    to: waiting', 'result: null', 'error: null',
      'upstream:', '  project: co-test', '  variant: co-test', '  template_version: 0.1.0', '  source: project/co-test', '  trust: untrusted',
      '  suspected_layer: L1', '  symptom: "a symptom that is long enough here"', '  affected_paths: [scripts/a.ts]',
      '  triage: ready', '  flagged: false', '  triage_reasons: []', '  dedupe_key: abc', '  duplicates: []', '',
    ].join('\n'));
    expect(listTickets(dir).map(t => t.id)).toEqual(['U-20261001-001']);
    expect(nextServiceTicket(dir)).toBeNull();
    expect(listTickets(dir, { status: 'waiting', kind: 'service' })).toEqual([]);
  });
});

describe('staleRunningTickets', () => {
  test('flags a running ticket older than the threshold', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    // Threshold of -1 minute makes every running ticket immediately "stale" for test purposes.
    const stale = staleRunningTickets(dir, -1);
    expect(stale.map(s => s.id)).toContain(t.id);
  });

  test('does not flag a fresh running ticket against a generous threshold', () => {
    const t = createTicket(dir, { kind: 'service', service: 'audit', priority: 'normal' });
    moveTicket(dir, t.id, 'waiting', { force: false });
    moveTicket(dir, t.id, 'running', { force: false });
    const stale = staleRunningTickets(dir, 60);
    expect(stale.map(s => s.id)).not.toContain(t.id);
  });
});

describe('loadCatalog + resolveServiceRef', () => {
  test('resolves a valid catalog service to an in-root path', () => {
    const catalogPath = join(dir, 'services.yaml');
    writeFileSync(catalogPath, [
      'schemaVersion: 1',
      'services:',
      '  - id: audit',
      '    name: Workspace Audit',
      '    run: { type: script, ref: scripts/audit.ts }',
      '',
    ].join('\n'));
    const catalog = loadCatalog(catalogPath);
    const resolved = resolveServiceRef(catalog, 'audit', dir);
    expect(resolved.absPath.startsWith(dir)).toBe(true);
    expect(resolved.type).toBe('script');
  });

  test('throws for a service id not present in the catalog', () => {
    const catalogPath = join(dir, 'services.yaml');
    writeFileSync(catalogPath, 'schemaVersion: 1\nservices: []\n');
    const catalog = loadCatalog(catalogPath);
    expect(() => resolveServiceRef(catalog, 'nonexistent', dir)).toThrow();
  });

  test('throws when a service ref resolves to a sibling directory outside workspaceRoot', () => {
    // Construct the Catalog object directly (bypassing validateCatalog / the YAML
    // allowlist regex) so this test isolates what resolveServiceRef itself catches.
    // A bare `absPath.startsWith(resolve(workspaceRoot))` string check would wrongly
    // accept this: resolve(dir, '../<basename(dir)>_evil/hack.ts') is a sibling
    // directory whose path happens to start with the same string prefix as `dir`.
    const catalog = {
      schemaVersion: 1,
      services: [
        { id: 'evil', name: 'Evil', run: { type: 'script' as const, ref: '../' + join(dir).split(/[\\/]/).pop() + '_evil/hack.ts' } },
      ],
    };
    expect(() => resolveServiceRef(catalog, 'evil', dir)).toThrow();
  });
});
