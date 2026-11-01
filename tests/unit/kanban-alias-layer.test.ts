// @version 1.0.0
/**
 * Tests for the delegation kanban alias layer (Phase 3a kanban core, spec
 * docs/designs/2026-11-01-hub-consolidation-design.md §5):
 * - alias table shape (the shipped docs/templates/hub-kanban-aliases.json is pinned)
 * - optional `sev` / `blocked_reason` ticket fields (schema tolerance — no migration)
 * - history[] action entries (transparent to the chaining invariants)
 * - priority governance caps (P0 user-only, spoke +1 level per 24h) and the 3-strike ledger
 * - store reprioritizeTicket / autoReadySev1Ticket (SEV1 bypass positive + SEV2/no-sev negative)
 * - the ticket.ts CLI surface (subprocess, TICKET_WORKSPACE_ROOT seam)
 *
 * @version 1.0.0
 */
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { dump, load, JSON_SCHEMA } from 'js-yaml';
import {
  validateKanbanAliases,
  validateTicket,
  resolvePriorityInput,
  DEFAULT_KANBAN_ALIASES,
  type Ticket,
} from '../../scripts/helpers/ticket-schema.ts';
import {
  createTicket,
  readTicket,
  reprioritizeTicket,
  autoReadySev1Ticket,
  loadKanbanAliases,
} from '../../scripts/helpers/ticket-store.ts';
import {
  checkReprioritize,
  parseActor,
  recordStrike,
  loadStrikes,
  isFrozen,
  ReprioritizeRefusedError,
  FROZEN_THRESHOLD,
  STRIKES_FILE_NAME,
} from '../../scripts/helpers/reprioritize.ts';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const ALIAS_FILE = join(REPO_ROOT, 'docs', 'templates', 'hub-kanban-aliases.json');

let dir: string;
let stateDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kanban-alias-'));
  stateDir = join(dir, '.pipeline-state');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Hand-writes a valid upstream request ticket with optional sev / upstream deltas. */
function writeUpstreamTicket(overrides: Partial<Ticket> & { id: string; upstreamDelta?: Partial<Ticket['upstream']> }): Ticket {
  const { upstreamDelta, ...rest } = overrides;
  const t = {
    schemaVersion: 1,
    id: overrides.id,
    kind: 'manual',
    title: `Upstream report from ${overrides.id}`,
    priority: 'normal',
    status: 'backlog',
    attempts: 0,
    created_at: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), from: null, to: 'backlog' }],
    result: null,
    error: null,
    upstream: {
      project: 'co-test',
      variant: 'co-test',
      template_version: '0.8.3',
      source: 'project/co-test',
      trust: 'untrusted',
      suspected_layer: 'L2',
      symptom: 'The hub delegation kanban lane shows the wrong priority after a reprioritize.',
      affected_paths: ['scripts/ticket.ts'],
      triage: 'inbox',
      flagged: false,
      triage_reasons: [],
      dedupe_key: 'b'.repeat(64),
      duplicates: [],
      ...upstreamDelta,
    },
    ...rest,
  } as unknown as Ticket;
  writeFileSync(join(dir, `${overrides.id}.yaml`), dump(t), 'utf-8');
  return t;
}

// ── alias table ───────────────────────────────────────────────────────────────

describe('validateKanbanAliases', () => {
  test('the shipped docs/templates/hub-kanban-aliases.json validates and matches the design mapping', () => {
    const raw = JSON.parse(readFileSync(ALIAS_FILE, 'utf-8'));
    expect(() => validateKanbanAliases(raw)).not.toThrow();
    expect(raw.priorityAliases).toEqual({ P0: 'urgent', P1: 'high', P2: 'normal', P3: 'low' });
    expect(raw.statusAliases).toEqual({ queued: 'waiting', 'in-progress': 'running', accepted: 'review', blocked: 'waiting' });
    expect(raw.sevDefaultPriority).toEqual({ SEV1: 'P0', SEV2: 'P1', SEV3: 'P2' });
    expect(raw.blockedSubstate).toEqual({ alias: 'blocked', canonicalStatus: 'waiting', reasonField: 'blocked_reason' });
  });

  test('DEFAULT_KANBAN_ALIASES validates (the loader fallback cannot drift from the schema)', () => {
    expect(() => validateKanbanAliases(DEFAULT_KANBAN_ALIASES)).not.toThrow();
  });

  test('rejects a wrong version, a missing alias key, and a blocked alias that is not waiting', () => {
    expect(() => validateKanbanAliases({ ...DEFAULT_KANBAN_ALIASES, version: 2 })).toThrow(/version/);
    expect(() => validateKanbanAliases({ ...DEFAULT_KANBAN_ALIASES, priorityAliases: { P0: 'urgent', P1: 'high', P2: 'normal' } })).toThrow(/P0,P1,P2,P3/);
    expect(() => validateKanbanAliases({ ...DEFAULT_KANBAN_ALIASES, priorityAliases: { ...DEFAULT_KANBAN_ALIASES.priorityAliases, P0: 'high' } })).toThrow(/distinct/);
    expect(() => validateKanbanAliases({ ...DEFAULT_KANBAN_ALIASES, statusAliases: { ...DEFAULT_KANBAN_ALIASES.statusAliases, blocked: 'backlog' } })).toThrow(/waiting-substate/);
    expect(() => validateKanbanAliases({ ...DEFAULT_KANBAN_ALIASES, sevDefaultPriority: { SEV1: 'urgent', SEV2: 'P1', SEV3: 'P2' } })).toThrow(/P0-P3 alias/);
  });

  test('resolvePriorityInput maps aliases and canonical values, null on garbage', () => {
    for (const [input, want] of [['P0', 'urgent'], ['P1', 'high'], ['P2', 'normal'], ['P3', 'low'], ['low', 'low'], ['urgent', 'urgent']] as const) {
      expect(resolvePriorityInput(input, DEFAULT_KANBAN_ALIASES)).toBe(want);
    }
    expect(resolvePriorityInput('P9', DEFAULT_KANBAN_ALIASES)).toBeNull();
    expect(resolvePriorityInput('', DEFAULT_KANBAN_ALIASES)).toBeNull();
  });

  test('loadKanbanAliases: missing file -> defaults; corrupt file -> loud error', () => {
    expect(loadKanbanAliases(dir)).toEqual(DEFAULT_KANBAN_ALIASES); // no docs/templates here
    const aliasDir = join(dir, 'docs', 'templates');
    mkdirSync(aliasDir, { recursive: true });
    writeFileSync(join(aliasDir, 'hub-kanban-aliases.json'), '{"version": 2}');
    expect(() => loadKanbanAliases(dir)).toThrow(/version/);
  });
});

// ── schema tolerance: sev / blocked_reason / action history ──────────────────

describe('validateTicket v1.10.0 optional fields (no migration)', () => {
  function baseTicket(): Ticket {
    return createTicket(dir, { kind: 'manual', title: 'tolerance probe', priority: 'normal' });
  }

  test('an existing ticket without sev/blocked_reason still parses', () => {
    const t = baseTicket();
    expect(() => validateTicket(readTicket(dir, t.id))).not.toThrow();
    expect((readTicket(dir, t.id) as Ticket).sev).toBeUndefined();
  });

  test('sev accepts SEV1-SEV3, rejects anything else; blocked_reason must be a non-empty <=500 char string', () => {
    for (const sev of ['SEV1', 'SEV2', 'SEV3']) {
      const t = baseTicket();
      writeFileSync(join(dir, `${t.id}.yaml`), dump({ ...readTicket(dir, t.id), sev }), 'utf-8');
      expect((readTicket(dir, t.id) as Ticket).sev).toBe(sev);
    }
    const t = baseTicket();
    writeFileSync(join(dir, `${t.id}.yaml`), dump({ ...readTicket(dir, t.id), sev: 'SEV4' }), 'utf-8');
    expect(() => readTicket(dir, t.id)).toThrow(/ticket\.sev/);

    const t2 = baseTicket();
    writeFileSync(join(dir, `${t2.id}.yaml`), dump({ ...readTicket(dir, t2.id), blocked_reason: 'waiting on user review of the freeze' }), 'utf-8');
    expect(() => readTicket(dir, t2.id)).not.toThrow();
    const t3 = baseTicket();
    writeFileSync(join(dir, `${t3.id}.yaml`), dump({ ...readTicket(dir, t3.id), blocked_reason: '   ' }), 'utf-8');
    expect(() => readTicket(dir, t3.id)).toThrow(/blocked_reason/);
  });
});

describe('history[] action entries (v1.10.0)', () => {
  test('a reprioritize action entry parses transparently; attempts derivation unaffected', () => {
    const t = writeUpstreamTicket({
      id: 'U-20261102-101',
      history: [
        { at: '2026-11-01T09:00:00+09:00', from: null, to: 'backlog' },
        { at: '2026-11-01T09:06:00+09:00', action: 'reprioritize', actor: 'spoke-pm:co-test', from: 'normal', to: 'high' },
      ],
      status: 'backlog',
    } as Partial<Ticket> & { id: string });
    expect(() => validateTicket(t)).not.toThrow();
  });

  test('an action entry at history[0], with a blank actor, or with non-string from/to is refused', () => {
    const at = '2026-11-01T09:00:00+09:00';
    expect(() => validateTicket(writeUpstreamTicket({
      id: 'U-20261102-102',
      history: [{ at, action: 'reprioritize', actor: 'user', from: 'low', to: 'normal' }],
      attempts: 0,
    } as Partial<Ticket> & { id: string }))).toThrow(/history\[0\] must be the creation/);

    expect(() => validateTicket(writeUpstreamTicket({
      id: 'U-20261102-103',
      history: [
        { at, from: null, to: 'backlog' },
        { at, action: 'reprioritize', actor: '  ', from: 'low', to: 'normal' },
      ],
      attempts: 0,
    } as Partial<Ticket> & { id: string }))).toThrow(/actor/);
  });

  test('a status entry after an action entry still chains from the last STATUS entry', () => {
    const t = writeUpstreamTicket({
      id: 'U-20261102-104',
      history: [
        { at: '2026-11-01T09:00:00+09:00', from: null, to: 'backlog' },
        { at: '2026-11-01T09:05:00+09:00', action: 'sev1-auto-ready', actor: 'sev-policy', from: 'inbox', to: 'ready' },
        { at: '2026-11-01T09:05:01+09:00', from: 'backlog', to: 'waiting' },
      ],
      status: 'waiting',
      upstreamDelta: { triage: 'ready' },
    } as Partial<Ticket> & { id: string });
    expect(() => validateTicket(t)).not.toThrow();
  });
});

// ── priority governance caps (pure) ──────────────────────────────────────────

describe('checkReprioritize (pure caps, design §5.2)', () => {
  test('user is unrestricted, including urgent/P0', () => {
    expect(checkReprioritize('user', 'low', 'urgent')).toEqual({ allowed: true });
    expect(checkReprioritize('user', 'urgent', 'low')).toEqual({ allowed: true });
  });

  test('P0/urgent is user-only: hub-pm and spoke-pm are refused with a violation', () => {
    for (const actor of ['hub-pm', 'spoke-pm:co-test'] as const) {
      const v = checkReprioritize(actor, 'high', 'urgent');
      expect(v.allowed).toBe(false);
      if (!v.allowed) {
        expect(v.violation).toBe(true);
        expect(v.code).toBe('p0-user-only');
        expect(v.reason).toMatch(/actor=user only/);
      }
    }
  });

  test('hub-pm is unrestricted within P1-P3 in both directions', () => {
    expect(checkReprioritize('hub-pm', 'low', 'high')).toEqual({ allowed: true });
    expect(checkReprioritize('hub-pm', 'high', 'low')).toEqual({ allowed: true });
  });

  test('spoke +1 level is allowed; +2 levels is a violation', () => {
    expect(checkReprioritize('spoke-pm:co-test', 'low', 'normal')).toEqual({ allowed: true });
    expect(checkReprioritize('spoke-pm:co-test', 'normal', 'high')).toEqual({ allowed: true });
    const v = checkReprioritize('spoke-pm:co-test', 'low', 'high');
    expect(v.allowed).toBe(false);
    if (!v.allowed) { expect(v.violation).toBe(true); expect(v.code).toBe('raise-cap'); }
  });

  test('spoke raises inside the 24h window are violations; outside it they are allowed; lowering is never capped', () => {
    const t0 = Date.parse('2026-11-01T09:00:00+09:00');
    const within = checkReprioritize('spoke-pm:co-test', 'normal', 'high', { nowMs: t0, lastRaiseAt: '2026-11-01T08:00:00+09:00' });
    expect(within.allowed).toBe(false);
    if (!within.allowed) { expect(within.violation).toBe(true); expect(within.code).toBe('raise-window'); }
    expect(checkReprioritize('spoke-pm:co-test', 'normal', 'high', { nowMs: t0 + 25 * 3_600_000, lastRaiseAt: '2026-11-01T08:00:00+09:00' })).toEqual({ allowed: true });
    expect(checkReprioritize('spoke-pm:co-test', 'high', 'low', { nowMs: t0, lastRaiseAt: '2026-11-01T08:59:00+09:00' })).toEqual({ allowed: true });
  });

  test('a no-op is a usage error, not an abuse violation', () => {
    const v = checkReprioritize('spoke-pm:co-test', 'normal', 'normal');
    expect(v.allowed).toBe(false);
    if (!v.allowed) expect(v.violation).toBe(false);
  });
});

describe('actor grammar + 3-strike ledger', () => {
  test('parseActor accepts user | hub-pm | spoke-pm:NAME and rejects malformed tokens', () => {
    expect(parseActor('user')).toBe('user');
    expect(parseActor('hub-pm')).toBe('hub-pm');
    expect(parseActor('spoke-pm:co-test')).toBe('spoke-pm:co-test');
    expect(parseActor('spoke-pm:')).toBeNull();
    expect(parseActor('agent')).toBeNull();
    expect(parseActor('')).toBeNull();
  });

  test('recordStrike counts violations, flips frozen at the threshold, and survives a corrupt file', () => {
    for (let i = 1; i <= FROZEN_THRESHOLD; i++) {
      const state = recordStrike(stateDir, 'co-test', { at: '2026-11-02T09:00:00+09:00', actor: 'spoke-pm:co-test', attempted: 'normal -> high', reason: 'test' });
      expect(state.projects['co-test'].violations).toBe(i);
      expect(isFrozen(state, 'co-test')).toBe(i >= FROZEN_THRESHOLD);
    }
    const onDisk = JSON.parse(readFileSync(join(stateDir, STRIKES_FILE_NAME), 'utf-8'));
    expect(onDisk.projects['co-test'].frozen).toBe(true);
    expect(onDisk.projects['co-test'].violations).toBe(FROZEN_THRESHOLD);
    // another project is unaffected
    expect(isFrozen(loadStrikes(stateDir), 'co-other')).toBe(false);
    // corrupt file degrades to fresh
    writeFileSync(join(stateDir, STRIKES_FILE_NAME), 'not json');
    expect(loadStrikes(stateDir).projects).toEqual({});
  });
});

// ── store-level reprioritize / SEV1 bypass ───────────────────────────────────

describe('reprioritizeTicket (store)', () => {
  test('happy path: alias-capable raise appends a history action entry and changes only the priority', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'raise me', priority: 'normal' });
    const after = reprioritizeTicket(dir, t.id, 'high', 'spoke-pm:co-test', { stateDir });
    expect(after.priority).toBe('high');
    expect(after.status).toBe('backlog'); // priority-only: status untouched
    const last = after.history[after.history.length - 1];
    expect(last).toMatchObject({ action: 'reprioritize', actor: 'spoke-pm:co-test', from: 'normal', to: 'high' });
    expect(existsSync(join(stateDir, STRIKES_FILE_NAME))).toBe(false); // no violation, no ledger
  });

  test('P0/urgent by an agent actor is a hard typed error and records a strike; user is allowed', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'p0 probe', priority: 'high' });
    try {
      reprioritizeTicket(dir, t.id, 'urgent', 'hub-pm', { stateDir });
      throw new Error('expected refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(ReprioritizeRefusedError);
      expect((err as ReprioritizeRefusedError).code).toBe('p0-user-only');
    }
    const strikes = loadStrikes(stateDir);
    expect(strikes.projects['hub-pm'].violations).toBe(1);
    // the user can always do it
    const after = reprioritizeTicket(dir, t.id, 'urgent', 'user', { stateDir });
    expect(after.priority).toBe('urgent');
  });

  test('a second spoke raise within 24h is refused and counts a strike', () => {
    const t = writeUpstreamTicket({ id: 'U-20261102-111' }); // priority normal
    reprioritizeTicket(dir, t.id, 'high', 'spoke-pm:co-test', { stateDir });
    // demote back to normal as hub-pm (unrestricted), then raise again as the spoke:
    // the first raise is still inside the 24h window -> refused.
    reprioritizeTicket(dir, t.id, 'normal', 'hub-pm', { stateDir });
    try {
      reprioritizeTicket(dir, t.id, 'high', 'spoke-pm:co-test', { stateDir });
      throw new Error('expected refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(ReprioritizeRefusedError);
      expect((err as ReprioritizeRefusedError).code).toBe('raise-window');
    }
    expect(loadStrikes(stateDir).projects['co-test'].violations).toBe(1);
  });

  test('three violations freeze the project: further raises are refused with the frozen typed error', () => {
    const t = createTicket(dir, { kind: 'manual', title: 'freeze probe', priority: 'high' });
    for (let i = 0; i < FROZEN_THRESHOLD; i++) {
      try {
        reprioritizeTicket(dir, t.id, 'urgent', 'spoke-pm:co-freeze', { stateDir });
      } catch (err) {
        expect((err as ReprioritizeRefusedError).code).toBe('p0-user-only');
      }
    }
    expect(isFrozen(loadStrikes(stateDir), 'co-freeze')).toBe(true);
    // a legal-shaped raise (+1 level) is now refused by the freeze gate
    try {
      reprioritizeTicket(dir, t.id, 'urgent', 'spoke-pm:co-freeze', { stateDir });
      throw new Error('expected refusal');
    } catch (err) {
      expect((err as ReprioritizeRefusedError).code).toBe('frozen');
      expect((err as Error).message).toMatch(/frozen after 3 cap violations/);
    }
  });

  test('ownerProject: another project\'s ticket is "not found" and nothing is mutated', () => {
    const t = writeUpstreamTicket({ id: 'U-20261102-112', upstreamDelta: { project: 'co-other', source: 'project/co-other' } });
    try {
      reprioritizeTicket(dir, t.id, 'high', 'spoke-pm:co-test', { stateDir, ownerProject: 'co-test' });
      throw new Error('expected refusal');
    } catch (err) {
      expect(err).toBeInstanceOf(ReprioritizeRefusedError);
      expect((err as Error).message).toBe('not found');
    }
    expect(readTicket(dir, t.id).priority).toBe('normal');
    // the owning project succeeds through the same check
    const after = reprioritizeTicket(dir, t.id, 'high', 'spoke-pm:co-other', { stateDir, ownerProject: 'co-other' });
    expect(after.priority).toBe('high');
  });
});

describe('autoReadySev1Ticket (SEV1 bypass-triage, design §5.1)', () => {
  test('SEV1 ticket: triage -> ready, backlog -> waiting, history marker appended', () => {
    writeUpstreamTicket({ id: 'U-20261102-121', sev: 'SEV1' } as Partial<Ticket> & { id: string });
    const t = autoReadySev1Ticket(dir, 'U-20261102-121');
    expect(t.upstream!.triage).toBe('ready');
    expect(t.status).toBe('waiting');
    const actions = t.history.filter((h) => 'action' in h);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action: 'sev1-auto-ready', actor: 'sev-policy', from: 'inbox', to: 'ready' });
  });

  test('NEGATIVE: an SEV2 or no-sev ticket does NOT bypass triage', () => {
    writeUpstreamTicket({ id: 'U-20261102-122', sev: 'SEV2' } as Partial<Ticket> & { id: string });
    expect(() => autoReadySev1Ticket(dir, 'U-20261102-122')).toThrow(/not SEV1/);
    expect(readTicket(dir, 'U-20261102-122').upstream!.triage).toBe('inbox');
    expect(readTicket(dir, 'U-20261102-122').status).toBe('backlog');

    writeUpstreamTicket({ id: 'U-20261102-123' });
    expect(() => autoReadySev1Ticket(dir, 'U-20261102-123')).toThrow(/not SEV1/);
    expect(readTicket(dir, 'U-20261102-123').upstream!.triage).toBe('inbox');
  });

  test('idempotent on an already-ready SEV1 ticket', () => {
    writeUpstreamTicket({ id: 'U-20261102-124', sev: 'SEV1', status: 'waiting', upstreamDelta: { triage: 'ready' }, history: [{ at: new Date().toISOString(), from: null, to: 'backlog' }, { at: new Date().toISOString(), from: 'backlog', to: 'waiting' }] } as Partial<Ticket> & { id: string });
    const before = readTicket(dir, 'U-20261102-124');
    const t = autoReadySev1Ticket(dir, 'U-20261102-124');
    expect(t.history).toHaveLength(before.history.length);
  });
});

// ── CLI surface (subprocess, TICKET_WORKSPACE_ROOT seam) ─────────────────────

describe('ticket.ts CLI — alias layer (subprocess)', () => {
  const ticketCli = join(REPO_ROOT, 'scripts', 'ticket.ts');

  function runCli(args: string[], root: string) {
    const proc = Bun.spawnSync(['bun', ticketCli, ...args], {
      env: { ...process.env, TICKET_WORKSPACE_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
  }

  test('create --priority-alias P1 maps to high through the alias JSON; the flags are mutually exclusive', () => {
    const root = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      const ok = runCli(['create', '--manual', 'alias probe', '--priority-alias', 'P1'], root);
      expect(ok.code).toBe(0);
      const created = readdirTickets(gov)[0];
      expect((load(readFileSync(join(gov, created), 'utf-8'), { schema: JSON_SCHEMA }) as Ticket).priority).toBe('high');

      const both = runCli(['create', '--manual', 'x', '--priority', 'low', '--priority-alias', 'P1'], root);
      expect(both.code).toBe(1);
      expect(both.err).toMatch(/mutually exclusive/);

      const bad = runCli(['create', '--manual', 'x', '--priority-alias', 'P9'], root);
      expect(bad.code).toBe(1);
      expect(bad.err).toMatch(/--priority-alias must be one of P0\|P1\|P2\|P3/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reprioritize: spoke alias raise succeeds; P0 by an agent is a hard error (exit 1)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      writeFileSync(join(gov, 'U-20261102-131.yaml'), dump(writeUpstreamTicket({ id: 'U-20261102-131' })), 'utf-8');

      const ok = runCli(['reprioritize', 'U-20261102-131', '--priority', 'P1', '--actor', 'spoke-pm:co-test'], root);
      expect(ok.code).toBe(0);
      expect(ok.out).toMatch(/priority high/);
      const t = load(readFileSync(join(gov, 'U-20261102-131.yaml'), 'utf-8'), { schema: JSON_SCHEMA }) as Ticket;
      expect(t.priority).toBe('high');
      expect(t.history[t.history.length - 1]).toMatchObject({ action: 'reprioritize', actor: 'spoke-pm:co-test', from: 'normal', to: 'high' });

      const p0 = runCli(['reprioritize', 'U-20261102-131', '--priority', 'P0', '--actor', 'hub-pm'], root);
      expect(p0.code).toBe(1);
      expect(p0.err).toMatch(/reprioritize refused \[p0-user-only\]/);
      expect(p0.err).toMatch(/actor=user only/);

      const badActor = runCli(['reprioritize', 'U-20261102-131', '--priority', 'P2', '--actor', 'wizard'], root);
      expect(badActor.code).toBe(1);
      expect(badActor.err).toMatch(/--actor must be/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('triage: SEV1 bypasses to ready; SEV2 and no-sev do NOT bypass (negative)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kanban-cli-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      writeFileSync(join(gov, 'U-20261102-141.yaml'), dump(writeUpstreamTicket({ id: 'U-20261102-141', sev: 'SEV1' } as Partial<Ticket> & { id: string })), 'utf-8');
      writeFileSync(join(gov, 'U-20261102-142.yaml'), dump(writeUpstreamTicket({ id: 'U-20261102-142', sev: 'SEV2' } as Partial<Ticket> & { id: string })), 'utf-8');
      writeFileSync(join(gov, 'U-20261102-143.yaml'), dump(writeUpstreamTicket({ id: 'U-20261102-143' })), 'utf-8');

      const bypass = runCli(['triage', 'U-20261102-141', 'inbox'], root);
      expect(bypass.code).toBe(0);
      expect(bypass.out).toMatch(/sev=SEV1 bypass-triage/);
      const t = load(readFileSync(join(gov, 'U-20261102-141.yaml'), 'utf-8'), { schema: JSON_SCHEMA }) as Ticket;
      expect(t.upstream.triage).toBe('ready');
      expect(t.status).toBe('waiting');

      const normal = runCli(['triage', 'U-20261102-142', 'inbox'], root);
      expect(normal.code).toBe(0);
      expect(normal.out).toMatch(/upstream\.triage=inbox/); // NO bypass
      const t2 = load(readFileSync(join(gov, 'U-20261102-142.yaml'), 'utf-8'), { schema: JSON_SCHEMA }) as Ticket;
      expect(t2.upstream.triage).toBe('inbox');
      expect(t2.status).toBe('backlog');

      const plain = runCli(['triage', 'U-20261102-143', 'inbox'], root);
      expect(plain.code).toBe(0);
      expect(plain.out).toMatch(/upstream\.triage=inbox/); // NO bypass
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function readdirTickets(gov: string): string[] {
  return readdirSync(gov).filter((f: string) => f.endsWith('.yaml'));
}
