/**
 * Unit tests for verify-prompt-integrity.ts (T-20261120-002; T-20261112-003 reopen;
 * design docs/designs/2026-11-20-runner-hardening-integrity-design.md §T-20261120-002;
 * ADR-0105 §Prompt-Integrity; AC-15).
 *
 * Pins the five verdict classes over a fixture sqlite store, the bun:sqlite
 * byte-faithfulness regression (the sqlite3 CLI pipe mangles multibyte TEXT —
 * 21,967 chars vs 22,153 bytes, measured 2026-11-20), the exec-closure check
 * (protectedPaths ∪ runner-exec-allowlist), and the alert contract (alert JSON,
 * memory-log line, urgent-ticket filing, --no-ticket / --gate suppression,
 * exit codes).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runVerification,
  readLivePrompt,
  readManifest,
  sha256Text,
  sha256File,
  classifyEntry,
  id8Of,
  summarizeHunks,
  extractExecRefs,
  globToRegExp,
  pathCoveredByPatterns,
  execClosureCheck,
  alertJsonPath,
  type ManifestEntry,
  type TicketFiler,
  type TicketFileResult,
} from '../../scripts/verify-prompt-integrity.ts';

const root = mkdtempSync(join(tmpdir(), 'prompt-integrity-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const RUNNER_ID = 'automation-dfba3ff1-a1df-42e3-b358-7c641f974648';

/** Multibyte fixture prompt — char count ≠ byte count, the CLI-mangling shape. */
const LIVE_PROMPT = [
  'You are the UNIFIED 03:00 KST batch runner for /Users/techcross/git/ai_workspace — 통합 배치 러너 (매일 오전 3시). 🛡️',
  'STEP 0 — INVARIANTS: acquire the lock via `bun scripts/automation-lock.ts acquire unified-automation`.',
  '한글 멀티바이트 본문: 이 프롬프트는 문자 수(21,967자)와 바이트 수(22,153바이트)가 다르다 — 🔑 emoji push the delta.',
  'STEP J — FINAL SWEEP: merge every CLEAN PR this run produced (`bun scripts/run-manifest.ts verify --require-merged`).',
].join('\n');

interface FixtureOptions {
  livePrompt?: string;
  manifestEntries: ManifestEntry[];
  storePath?: string;
  withAutomationsTable?: boolean;
}

interface FixturePaths {
  workspace: string;
  storePath: string;
  manifestPath: string;
  stateDir: string;
  memoryDir: string;
}

function writeStore(storePath: string, prompts: Map<string, string>, withTable = true): void {
  const db = new Database(storePath);
  try {
    if (withTable) {
      db.exec(`DROP TABLE IF EXISTS automations`);
      db.exec(`CREATE TABLE automations (automation_id TEXT PRIMARY KEY, prompt TEXT)`);
      const ins = db.query(`INSERT INTO automations (automation_id, prompt) VALUES (?, ?)`);
      for (const [id, prompt] of prompts) ins.run(id, prompt);
    }
  } finally {
    db.close();
  }
}

function makeFixture(opts: FixtureOptions): FixturePaths {
  const workspace = mkdtempSync(join(root, 'fixture-'));
  const stateDir = join(workspace, 'state');
  const memoryDir = join(workspace, 'memory');
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(memoryDir, { recursive: true });
  const storePath = opts.storePath ?? join(workspace, 'tasks-index.sqlite');
  if (existsSync(storePath)) rmSync(storePath);
  const prompts = new Map<string, string>();
  prompts.set(RUNNER_ID, opts.livePrompt ?? LIVE_PROMPT);
  writeStore(storePath, prompts, opts.withAutomationsTable ?? true);
  const manifestPath = join(workspace, 'prompts.manifest.json');
  writeFileSync(manifestPath, JSON.stringify({ generatedAt: '2026-11-20T15:40:00+09:00', entries: opts.manifestEntries }, null, 2), 'utf8');
  return { workspace, storePath, manifestPath, stateDir, memoryDir };
}

const okFiler: TicketFiler = () => ({ filed: true, alreadyFiled: false, detail: 'created' });

describe('id8Of', () => {
  test('takes the first uuid segment after the automation- prefix', () => {
    expect(id8Of(RUNNER_ID)).toBe('dfba3ff1');
    expect(id8Of('automation-1234567890-abc')).toBe('1234567890');
  });

  test('falls back to the last 8 chars for non-automation ids', () => {
    expect(id8Of('some-short-id')).toBe('short-id'); // slice(-8)
  });
});

describe('readLivePrompt — bun:sqlite byte-faithfulness (V3 regression pin)', () => {
  test('the bun:sqlite read round-trips multibyte TEXT byte-exact (never the CLI pipe)', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    const read = readLivePrompt(fx.storePath, RUNNER_ID);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    // Byte-exact round trip: the hash of the read text equals the hash of the fixture text.
    expect(sha256Text(read.text)).toBe(sha256Text(LIVE_PROMPT));
    expect(read.text).toBe(LIVE_PROMPT);
    // The fixture IS the mangled shape: chars ≠ utf8 bytes (21,967 vs 22,153 in the live store).
    const chars = [...read.text].length;
    const bytes = Buffer.byteLength(read.text, 'utf8');
    expect(chars).not.toBe(bytes);
    expect(bytes).toBeGreaterThan(chars);
  });

  test('a missing store file reads as store-absent', () => {
    const read = readLivePrompt(join(root, 'absent.sqlite'), RUNNER_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toBe('store-absent');
  });

  test('a store without the automations table fails the self-test (cannot-verify, not crash)', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: 'x' }], withAutomationsTable: false });
    const read = readLivePrompt(fx.storePath, RUNNER_ID);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.reason).toBe('self-test-failed');
  });
});

describe('classifyEntry — the five verdict classes', () => {
  test('1. match: live == manifest (snapshot agreeing)', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    const live = readLivePrompt(fx.storePath, RUNNER_ID);
    const v = classifyEntry({ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }, live, fx.workspace);
    expect(v.verdict).toBe('match');
    expect(v.isAlert).toBe(false);
    expect(v.liveHash).toBe(sha256Text(LIVE_PROMPT));
  });

  test('2. unratified-live-edit: live differs, snapshot still hashes to the manifest', () => {
    const ratified = LIVE_PROMPT + '\n ratified tail';
    const liveNow = LIVE_PROMPT + '\n live-ahead hunk (meeting-agreed control)';
    const fx = makeFixture({ livePrompt: liveNow, manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(ratified) }] });
    const snapshotAbs = join(fx.workspace, 'snapshot.txt');
    writeFileSync(snapshotAbs, ratified, 'utf8');
    const live = readLivePrompt(fx.storePath, RUNNER_ID);
    const v = classifyEntry({ id: RUNNER_ID, sha256: sha256Text(ratified), snapshot: snapshotAbs }, live, fx.workspace);
    expect(v.verdict).toBe('unratified-live-edit');
    expect(v.isAlert).toBe(true);
    expect(v.snapshotHash).toBe(sha256Text(ratified));
    expect(v.hunkSummary).toBeDefined();
    expect(v.hunkSummary).toContain('live-ahead hunk');
  });

  test('3. drift-both: live AND snapshot both differ from the manifest', () => {
    const snapshot = 'old snapshot text\n';
    const liveNow = 'completely drifted live text\n';
    const fx = makeFixture({ livePrompt: liveNow, manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text('neither') }] });
    const snapshotAbs = join(fx.workspace, 'snapshot.txt');
    writeFileSync(snapshotAbs, snapshot, 'utf8');
    const live = readLivePrompt(fx.storePath, RUNNER_ID);
    const v = classifyEntry({ id: RUNNER_ID, sha256: sha256Text('neither'), snapshot: snapshotAbs }, live, fx.workspace);
    expect(v.verdict).toBe('drift-both');
    expect(v.isAlert).toBe(true);
  });

  test('4. stale-snapshot: live matches but the snapshot differs — WARN, not an alert', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    const snapshotAbs = join(fx.workspace, 'snapshot.txt');
    writeFileSync(snapshotAbs, 'stale snapshot body\n', 'utf8');
    const live = readLivePrompt(fx.storePath, RUNNER_ID);
    const v = classifyEntry({ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT), snapshot: snapshotAbs }, live, fx.workspace);
    expect(v.verdict).toBe('stale-snapshot');
    expect(v.isAlert).toBe(false);
  });

  test('5. missing-automation: no store row for the entry id — deletion is drift', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    const live = readLivePrompt(fx.storePath, 'automation-00000000-0000-0000-0000-000000000000');
    const v = classifyEntry({ id: 'automation-00000000-0000-0000-0000-000000000000', sha256: 'x' }, live, fx.workspace);
    expect(v.verdict).toBe('missing-automation');
    expect(v.isAlert).toBe(true);
  });

  test('summarizeHunks trims the common frame and names the differing window', () => {
    const snap = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const live = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`)
      .map((l, i) => (i === 4 ? 'line 5 CHANGED' : l))
      .join('\n');
    const s = summarizeHunks(live, snap);
    expect(s).toContain('live lines 5-5');
    expect(s).toContain('line 5 CHANGED');
    expect(summarizeHunks(snap, snap)).toBe('no line-level difference');
  });
});

describe('exec closure (protectedPaths ∪ runner-exec-allowlist)', () => {
  test('extractExecRefs pulls every bun scripts/*.ts command, normalized and deduped', () => {
    const refs = extractExecRefs(
      'run `bun scripts/automation-lock.ts acquire` then `bun scripts/run-manifest.ts init` and again bun scripts/run-manifest.ts verify; also bun scripts/lib/helper.ts (not a command shape but same prefix).',
    );
    expect(refs).toContain('scripts/automation-lock.ts');
    expect(refs).toContain('scripts/run-manifest.ts');
    expect(refs).toContain('scripts/lib/helper.ts');
    expect(refs.filter((r) => r === 'scripts/run-manifest.ts').length).toBe(1);
  });

  test('glob matcher covers exact paths, ** trees, and * segments', () => {
    expect(pathCoveredByPatterns('scripts/stop-gate.ts', ['scripts/stop-gate.ts'])).toBe(true);
    expect(pathCoveredByPatterns('scripts/hooks/pre-commit', ['scripts/hooks/**'])).toBe(true);
    expect(pathCoveredByPatterns('Projects/co-deck/external-deps.json', ['Projects/*/external-deps.json'])).toBe(true);
    expect(pathCoveredByPatterns('scripts/rogue.ts', ['scripts/stop-gate.ts', 'scripts/hooks/**'])).toBe(false);
    expect(globToRegExp('scripts/a*b.ts').test('scripts/axxb.ts')).toBe(true);
    expect(globToRegExp('scripts/a*b.ts').test('scripts/a/x/b.ts')).toBe(false); // * stays in one segment
  });

  test('execClosureCheck: the sanctioned set passes; an unknown script is a violation', () => {
    const protectedPatterns = ['scripts/stop-gate.ts', 'scripts/ticket.ts'];
    const allowlist = ['scripts/automation-lock.ts', 'scripts/fleet-list.ts'];
    const okPrompt = 'STEP 0: bun scripts/automation-lock.ts acquire; STEP B: bun scripts/ticket.ts; gate: bun scripts/stop-gate.ts --run-start';
    expect(execClosureCheck(okPrompt, protectedPatterns, allowlist).ok).toBe(true);

    const rogue = okPrompt + ' then bun scripts/rogue-tool.ts for convenience';
    const v = execClosureCheck(rogue, protectedPatterns, allowlist);
    expect(v.ok).toBe(false);
    expect(v.violations.map((x) => x.ref)).toEqual(['scripts/rogue-tool.ts']);
  });
});

describe('runVerification — alert file, memory line, ticket, exit-code contract', () => {
  let filerCalls: string[] = [];
  const recordingFiler: TicketFiler = (title) => {
    filerCalls.push(title);
    return { filed: true, alreadyFiled: false, detail: 'created' } satisfies TicketFileResult;
  };
  beforeEach(() => {
    filerCalls = [];
  });

  test('clean run: exit 0 and the ADR-0105 contract line in the day memory log', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    const report = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      noTicket: true,
      now: new Date('2026-11-21T12:00:00Z'), // same calendar date in KST and UTC
    });
    expect(report.exitCode).toBe(0);
    expect(report.clean).toBe(true);
    expect(report.memoryLines.join('\n')).toContain('prompt integrity verify: 1/1 match');
    const mem = readFileSync(join(fx.memoryDir, '2026-11-21.md'), 'utf8');
    expect(mem).toContain('prompt integrity verify: 1/1 match');
    expect(existsSync(alertJsonPath(fx.stateDir, '2026-11-21'))).toBe(false);
  });

  test('drift: exit 1, alert JSON carries both hashes + hunk summary, memory ALERT line, urgent ticket filed', () => {
    const ratified = LIVE_PROMPT + '\n ratified tail';
    const liveNow = LIVE_PROMPT + '\n live-ahead hunk';
    const fx = makeFixture({ livePrompt: liveNow, manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(ratified) }] });
    const snapshotAbs = join(fx.workspace, 'snapshot.txt');
    writeFileSync(snapshotAbs, ratified, 'utf8');
    const entry: ManifestEntry = { id: RUNNER_ID, sha256: sha256Text(ratified), snapshot: snapshotAbs };
    writeFileSync(fx.manifestPath, JSON.stringify({ entries: [entry] }, null, 2), 'utf8');

    const report = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      ticketFiler: recordingFiler,
      now: new Date('2026-11-21T12:00:00Z'), // same calendar date in KST and UTC
    });
    expect(report.exitCode).toBe(1);
    expect(report.clean).toBe(false);
    const alertPath = alertJsonPath(fx.stateDir, '2026-11-21');
    expect(existsSync(alertPath)).toBe(true);
    const alert = JSON.parse(readFileSync(alertPath, 'utf8')) as { alerts: { verdict: string; manifestHash: string; liveHash?: string }[] };
    expect(alert.alerts[0]?.verdict).toBe('unratified-live-edit');
    expect(alert.alerts[0]?.manifestHash).toBe(sha256Text(ratified));
    expect(alert.alerts[0]?.liveHash).toBe(sha256Text(liveNow));
    const mem = readFileSync(join(fx.memoryDir, '2026-11-21.md'), 'utf8');
    expect(mem).toContain('prompt-integrity ALERT: unratified-live-edit on automation-dfba3ff1');
    expect(filerCalls).toEqual([`prompt-integrity drift on automation-dfba3ff1 (unratified-live-edit)`]);
  });

  test('--no-ticket suppresses filing; a duplicate-title refusal from the store is tolerated', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: 'not-the-live-hash' }] });
    const noTicket = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      noTicket: true,
    });
    expect(noTicket.exitCode).toBe(1);
    expect(noTicket.tickets).toEqual([]);

    const dupFiler: TicketFiler = () => ({ filed: false, alreadyFiled: true, detail: 'DuplicateTicketError: T-20261121-001' });
    const dup = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      ticketFiler: dupFiler,
    });
    expect(dup.exitCode).toBe(1);
    expect(dup.tickets[0]?.result.alreadyFiled).toBe(true);
  });

  test('--gate behaves like a scheduled run but NEVER files tickets (the 06:00 launchd job owns that)', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: 'drifted-manifest-hash' }] });
    const report = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      gate: true,
      ticketFiler: recordingFiler,
    });
    expect(report.exitCode).toBe(1);
    expect(filerCalls).toEqual([]);
  });

  test('store absent → cannot-verify alert (cannot-verify is never a pass)', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    rmSync(fx.storePath);
    const report = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      noTicket: true,
    });
    expect(report.exitCode).toBe(1);
    expect(report.entries[0]?.verdict).toBe('cannot-verify');
  });

  test('malformed manifest → cannot-verify alert with manifestError, exit 1', () => {
    const fx = makeFixture({ manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(LIVE_PROMPT) }] });
    writeFileSync(fx.manifestPath, '{"entries": []}', 'utf8');
    const report = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      noTicket: true,
    });
    expect(report.exitCode).toBe(1);
    expect(report.manifestError).toContain('entries[] missing or empty');
  });

  test('exec-closure integration: a sanctioned prompt passes with the closure flag; a rogue script alerts + files its own ticket title', () => {
    const prompt = 'gate: bun scripts/automation-lock.ts acquire; wall: bun scripts/stop-gate.ts --run-start X';
    const fx = makeFixture({ livePrompt: prompt, manifestEntries: [{ id: RUNNER_ID, sha256: sha256Text(prompt) }] });
    mkdirSync(join(fx.workspace, 'docs'), { recursive: true });
    writeFileSync(
      join(fx.workspace, 'docs', 'protected-paths.json'),
      JSON.stringify({ protectedPaths: ['scripts/stop-gate.ts'] }),
      'utf8',
    );
    writeFileSync(
      join(fx.workspace, 'docs', 'runner-exec-allowlist.json'),
      JSON.stringify({ allowedScripts: [{ path: 'scripts/automation-lock.ts' }] }),
      'utf8',
    );
    const clean = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      execClosure: true,
      noTicket: true,
    });
    expect(clean.exitCode).toBe(0);
    expect(clean.execClosure?.ok).toBe(true);
    expect(clean.execClosure?.refs.length).toBe(2);
    expect(clean.memoryLines.join('\n')).toContain('(exec-closure ok: 2 scripts)');

    const roguePrompt = prompt + '\n surprise: bun scripts/rogue.ts';
    writeStore(fx.storePath, new Map([[RUNNER_ID, roguePrompt]]));
    writeFileSync(
      fx.manifestPath,
      JSON.stringify({ entries: [{ id: RUNNER_ID, sha256: sha256Text(roguePrompt) }] }),
      'utf8',
    );
    const bad = runVerification({
      manifestPath: fx.manifestPath,
      storePath: fx.storePath,
      stateDir: fx.stateDir,
      memoryDir: fx.memoryDir,
      workspaceRoot: fx.workspace,
      execClosure: true,
      ticketFiler: recordingFiler,
    });
    expect(bad.exitCode).toBe(1);
    expect(bad.execClosure?.violations.map((v) => v.ref)).toEqual(['scripts/rogue.ts']);
    expect(bad.tickets.map((t) => t.title)).toEqual(['prompt-integrity exec-closure violation (scripts/rogue.ts)']);
  });
});

describe('readManifest', () => {
  test('parses entries and tolerates snapshot-less entries', () => {
    const p = join(root, 'manifest-only.json');
    writeFileSync(p, JSON.stringify({ entries: [{ id: 'a', sha256: 'h1' }] }), 'utf8');
    const m = readManifest(p);
    expect(m.entries.length).toBe(1);
    expect(m.entries[0]?.snapshot).toBeUndefined();
  });

  test('rejects a malformed entry', () => {
    const p = join(root, 'manifest-bad.json');
    writeFileSync(p, JSON.stringify({ entries: [{ id: 'a' }] }), 'utf8');
    expect(() => readManifest(p)).toThrow(/sha256 missing/);
  });
});

describe('sha256File', () => {
  test('hashes raw bytes (snapshot evidence path)', () => {
    const p = join(root, 'evidence.txt');
    writeFileSync(p, 'bytes\n', 'utf8');
    expect(sha256File(p)).toBe(sha256Text('bytes\n'));
  });
});
