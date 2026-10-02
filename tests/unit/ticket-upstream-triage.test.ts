/**
 * Tests for the T-20261001-016 upstream triage/resolution commands:
 * store-level `setUpstreamTriage` / `setUpstreamResolution` (ticket-store.ts)
 * and the `ticket.ts triage|resolve` CLI surface (pm-gateway-workflow §3.12).
 *
 * The store functions are the contract; the CLI cases validate argument
 * handling through a real subprocess against a temp TICKET_WORKSPACE_ROOT
 * (the test seam added with this ticket). Requester-controlled upstream
 * fields must be untouched by both operations.
 *
 * @version 1.0.0
 */
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import {
  createTicket,
  readTicket,
  moveTicket,
  setUpstreamTriage,
  setUpstreamResolution,
} from '../../scripts/helpers/ticket-store.ts';
import type { Ticket } from '../../scripts/helpers/ticket-schema.ts';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ticket-upstream-triage-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Hand-writes a valid upstream request ticket (the MCP server's intake shape). */
function writeUpstreamTicket(overrides: Partial<Ticket> & { id: string; flagged?: boolean }): Ticket {
  const { upstream: upstreamOverride, ...rest } = overrides;
  const t: Ticket = {
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
      symptom: 'AGENTS.md skill table drifts from the SKILL.md frontmatter after every sync run.',
      affected_paths: ['skills/SKILLS.md'],
      triage: 'inbox',
      flagged: overrides.flagged ?? false,
      triage_reasons: [],
      dedupe_key: 'a'.repeat(64),
      duplicates: [],
      ...upstreamOverride,
    } as Ticket['upstream'],
    ...rest,
  } as Ticket;
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${overrides.id}.yaml`), dump(t), 'utf-8');
  return t;
}

describe('setUpstreamTriage (store)', () => {
  test('promotes inbox -> ready and moves backlog -> waiting', () => {
    writeUpstreamTicket({ id: 'U-20261001-901' });
    const t = setUpstreamTriage(dir, 'U-20261001-901', 'ready');
    expect(t.upstream!.triage).toBe('ready');
    expect(t.status).toBe('waiting');
  });

  test('demotes to inbox and moves back to backlog', () => {
    writeUpstreamTicket({ id: 'U-20261001-902' });
    setUpstreamTriage(dir, 'U-20261001-902', 'ready');
    const t = setUpstreamTriage(dir, 'U-20261001-902', 'inbox');
    expect(t.upstream!.triage).toBe('inbox');
    expect(t.status).toBe('backlog');
  });

  test('refuses to promote a flagged ticket without confirmReviewed', () => {
    writeUpstreamTicket({ id: 'U-20261001-903', flagged: true });
    expect(() => setUpstreamTriage(dir, 'U-20261001-903', 'ready'))
      .toThrow(/flagged for human review/);
    const t = setUpstreamTriage(dir, 'U-20261001-903', 'ready', { confirmReviewed: true });
    expect(t.upstream!.triage).toBe('ready');
    expect(t.status).toBe('waiting');
  });

  test('fails on a non-upstream ticket', () => {
    const plain = createTicket(dir, { kind: 'manual', title: 'plain backlog item', priority: 'low' });
    expect(() => setUpstreamTriage(dir, plain.id, 'ready')).toThrow(/not an upstream ticket/);
    expect(() => setUpstreamResolution(dir, plain.id, { outcome: 'fixed', summary: 'x' }, 'x'))
      .toThrow(/not an upstream ticket/);
  });
});

describe('setUpstreamResolution (store)', () => {
  test('writes resolution + result and walks the legal path to done', () => {
    writeUpstreamTicket({ id: 'U-20261001-911' });
    const t = setUpstreamResolution(
      dir,
      'U-20261001-911',
      { outcome: 'fixed', pr_url: 'https://github.com/x/pull/1', template_version: '0.9.0', summary: 'delivered in 0.9.0' },
      'delivered in 0.9.0',
    );
    expect(t.status).toBe('done');
    expect(t.upstream!.resolution!.outcome).toBe('fixed');
    expect(t.result).toBe('delivered in 0.9.0');
    // legal adjacency walk: backlog -> waiting -> running -> review -> done
    const hops = t.history.map(h => h.to);
    expect(hops).toEqual(['backlog', 'waiting', 'running', 'review', 'done']);
  });

  test('resolution is write-once', () => {
    writeUpstreamTicket({ id: 'U-20261001-912' });
    setUpstreamResolution(dir, 'U-20261001-912', { outcome: 'rejected', summary: 'works as designed' }, 'works as designed');
    expect(() =>
      setUpstreamResolution(dir, 'U-20261001-912', { outcome: 'fixed', summary: 'second' }, 'second'),
    ).toThrow(/never re-resolved/);
  });

  test('requester-controlled fields are untouched by triage + resolve', () => {
    const original = writeUpstreamTicket({ id: 'U-20261001-913' });
    setUpstreamTriage(dir, 'U-20261001-913', 'ready');
    setUpstreamResolution(dir, 'U-20261001-913', { outcome: 'local-only', summary: 'project-local quirk' }, 'project-local quirk');
    const after = readTicket(dir, 'U-20261001-913');
    expect(after.upstream!.symptom).toBe(original.upstream!.symptom);
    expect(after.upstream!.project).toBe(original.upstream!.project);
    expect(after.upstream!.affected_paths).toEqual(original.upstream!.affected_paths);
    expect(after.upstream!.dedupe_key).toBe(original.upstream!.dedupe_key);
  });
});

describe('setUpstreamTriage / setUpstreamResolution validate-before-write (T-20261002-003, H2)', () => {
  test('refuses both triage values on a done ticket — a closed request is never re-triaged', () => {
    writeUpstreamTicket({ id: 'U-20261002-951' });
    setUpstreamResolution(dir, 'U-20261002-951', { outcome: 'fixed', summary: 'shipped' }, 'shipped');
    expect(() => setUpstreamTriage(dir, 'U-20261002-951', 'inbox')).toThrow(/never re-triaged/);
    expect(() => setUpstreamTriage(dir, 'U-20261002-951', 'ready')).toThrow(/never re-triaged/);
    const t = readTicket(dir, 'U-20261002-951');
    expect(t.status).toBe('done'); // inbox-on-done no longer reopens the ticket
    expect(t.upstream!.triage).toBe('inbox'); // unchanged by the refused call
  });

  test('ready promotion from review throws BEFORE anything is written (old code could strand triage=ready on status=review)', () => {
    // hand-write a ticket sitting in review, already triaged ready (legal pair) —
    // a SECOND ready promotion has no forward edge from review and must refuse pre-write
    const t = writeUpstreamTicket({
      id: 'U-20261002-952',
      status: 'review',
      history: [
        { at: new Date().toISOString(), from: null, to: 'backlog' },
        { at: new Date().toISOString(), from: 'backlog', to: 'waiting' },
        { at: new Date().toISOString(), from: 'waiting', to: 'review' },
      ],
      upstream: { triage: 'ready' },
    } as Partial<Ticket> & { id: string });
    expect(t.upstream!.triage).toBe('ready');
    expect(() => setUpstreamTriage(dir, 'U-20261002-952', 'ready'))
      .toThrow(/ready promotion refused, nothing written/);
    const after = readTicket(dir, 'U-20261002-952');
    expect(after.status).toBe('review'); // nothing moved
    expect(after.history).toHaveLength(3); // no history entry appended
  });

  test('resolution walk is resumable: resolution present + status review completes to done', () => {
    // simulate a crash mid-walk (old code wrote resolution before walking and then
    // refused every retry): resolution present, status stopped at review
    writeUpstreamTicket({
      id: 'U-20261002-953',
      status: 'review',
      history: [
        { at: new Date().toISOString(), from: null, to: 'backlog' },
        { at: new Date().toISOString(), from: 'backlog', to: 'waiting' },
        { at: new Date().toISOString(), from: 'waiting', to: 'running' },
        { at: new Date().toISOString(), from: 'running', to: 'review' },
      ],
      upstream: { triage: 'ready', resolution: { outcome: 'fixed', pr_url: 'https://github.com/x/pull/9', summary: 'crash-test' } },
    } as Partial<Ticket> & { id: string });
    const t = setUpstreamResolution(dir, 'U-20261002-953', { outcome: 'fixed', summary: 'resumed' }, 'resumed');
    expect(t.status).toBe('done');
    expect(t.upstream!.resolution!.summary).toBe('crash-test'); // original resolution preserved
    expect(t.result).toBe('resumed'); // done hop stamps the completing call's summary
  });

  test('done + resolution is still refused as "never re-resolved"', () => {
    writeUpstreamTicket({ id: 'U-20261002-954' });
    setUpstreamResolution(dir, 'U-20261002-954', { outcome: 'rejected', summary: 'wontfix' }, 'wontfix');
    expect(() =>
      setUpstreamResolution(dir, 'U-20261002-954', { outcome: 'fixed', summary: 'second' }, 'second'),
    ).toThrow(/never re-resolved/);
  });
});

describe('withTicketLock (T-20261002-005, H4)', () => {
  test('mutations release the lock on success', () => {
    writeUpstreamTicket({ id: 'U-20261002-961' });
    setUpstreamTriage(dir, 'U-20261002-961', 'ready');
    expect(existsSync(join(dir, '.ticket-lock'))).toBe(false);
  });

  test('a held lock fails CLOSED within the timeout and the mutation is refused', () => {
    const t = writeUpstreamTicket({ id: 'U-20261002-962' });
    mkdirSync(join(dir, '.ticket-lock'), { recursive: true });
    writeFileSync(join(dir, '.ticket-lock', 'owner'), JSON.stringify({ pid: 999999, token: 'other', holder: 'test-simulation' }), 'utf-8');
    const prev = process.env.TICKET_LOCK_TIMEOUT_MS;
    process.env.TICKET_LOCK_TIMEOUT_MS = '60';
    try {
      expect(() => moveTicket(dir, t.id, 'waiting')).toThrow(/could not acquire the ticket lock/);
      expect(() => setUpstreamTriage(dir, t.id, 'ready')).toThrow(/could not acquire the ticket lock/);
    } finally {
      if (prev === undefined) delete process.env.TICKET_LOCK_TIMEOUT_MS;
      else process.env.TICKET_LOCK_TIMEOUT_MS = prev;
    }
    expect(readTicket(dir, t.id).status).toBe('backlog'); // untouched
  });

  test('a STALE lock (>30s) is taken over atomically and the mutation proceeds', () => {
    const t = writeUpstreamTicket({ id: 'U-20261002-963' });
    const lockDir = join(dir, '.ticket-lock');
    mkdirSync(lockDir, { recursive: true });
    writeFileSync(join(lockDir, 'owner'), JSON.stringify({ pid: 999999, token: 'crashed', holder: 'crashed-process' }), 'utf-8');
    const old = new Date(Date.now() - 60_000);
    utimesSync(lockDir, old, old);
    const moved = moveTicket(dir, t.id, 'waiting');
    expect(moved.status).toBe('waiting');
    expect(existsSync(lockDir)).toBe(false);
  });
});

describe('ticket.ts CLI (subprocess, TICKET_WORKSPACE_ROOT seam)', () => {
  const workspaceRoot = join(import.meta.dir, '..', '..');
  const ticketCli = join(workspaceRoot, 'scripts', 'ticket.ts');

  function runCli(args: string[], root: string) {
    const proc = Bun.spawnSync(['bun', ticketCli, ...args], {
      env: { ...process.env, TICKET_WORKSPACE_ROOT: root },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    return { code: proc.exitCode, out: proc.stdout.toString(), err: proc.stderr.toString() };
  }

  test('triage ready promotes; resolve closes with resolution', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-root-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      writeFileSync(join(gov, 'U-20261001-921.yaml'), dump(writeUpstreamTicket({ id: 'U-20261001-921' })), 'utf-8');
      const triaged = runCli(['triage', 'governance/U-20261001-921', 'ready'], root);
      expect(triaged.code).toBe(0);
      expect(triaged.out).toMatch(/upstream\.triage=ready, status=waiting/);
      const resolved = runCli(
        ['resolve', 'governance/U-20261001-921', '--outcome', 'fixed', '--summary', 'shipped', '--pr-url', 'https://github.com/x/pull/2'],
        root,
      );
      expect(resolved.code).toBe(0);
      expect(resolved.out).toMatch(/outcome=fixed, status=done/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('resolve rejects a bad outcome and an empty summary', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-root-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      writeFileSync(join(gov, 'U-20261001-922.yaml'), dump(writeUpstreamTicket({ id: 'U-20261001-922' })), 'utf-8');
      const badOutcome = runCli(['resolve', 'governance/U-20261001-922', '--outcome', 'wip', '--summary', 'x'], root);
      expect(badOutcome.code).toBe(1);
      expect(badOutcome.err).toMatch(/--outcome must be/);
      const noSummary = runCli(['resolve', 'governance/U-20261001-922', '--outcome', 'fixed'], root);
      expect(noSummary.code).toBe(1);
      expect(noSummary.err).toMatch(/--summary/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('ticket.ts show — corrupt ticket fallback (T-20261001-017)', () => {
  const workspaceRoot = join(import.meta.dir, '..', '..');
  test('renders a corrupt ticket with a loud banner instead of a schema error', () => {
    const root = mkdtempSync(join(tmpdir(), 'ticket-cli-root-'));
    try {
      const gov = join(root, 'tickets', 'governance');
      mkdirSync(gov, { recursive: true });
      writeFileSync(
        join(gov, 'U-20261001-941.yaml'),
        [
          'schemaVersion: 1',
          'id: U-20261001-941',
          'kind: manual',
          'title: hand-edited',
          'status: backlog',
          'upstream:',
          '  project: co-test',
          '  trust: untrusted',
          '  symptom: too short',
          '  triage: bogus-value',
          '',
        ].join('\n'),
        'utf-8',
      );
      const proc = Bun.spawnSync(
        ['bun', join(workspaceRoot, 'scripts', 'ticket.ts'), 'show', 'governance/U-20261001-941'],
        { env: { ...process.env, TICKET_WORKSPACE_ROOT: root }, stdout: 'pipe', stderr: 'pipe' },
      );
      expect(proc.exitCode).toBe(0);
      const out = proc.stdout.toString();
      expect(out).toMatch(/CORRUPT TICKET/);
      expect(out).toMatch(/triage: bogus-value/); // raw YAML visible for hand-repair
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
