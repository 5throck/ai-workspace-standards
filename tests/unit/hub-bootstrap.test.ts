// @version 1.3.0
// v1.3.0 (2026-11-02, Windows CI fix round 3 — malformed fixture schema):
//          buildFixture wrote docs/workspace-schema.json with a placeholder
//          hub_remote and then re-wrote the FILE TEXT via String.replace
//          ('<RESOLVED-BELOW>' -> bare). On Windows the bare-repo path carries
//          backslashes (C:\Users\...), which landed RAW inside the JSON string
//          literal — \U is an invalid escape, so loadHubTopology failed with
//          "not valid JSON: ... Invalid escape character U" on every fixture
//          test (Windows-only; POSIX tmpdir paths are slash-joined and parse
//          fine). Fix: the schema is written ONCE, after the bare path exists,
//          with hub_remote embedded through JSON.stringify (which escapes
//          backslashes correctly) — the placeholder and the text-level
//          rewrite no longer exist. Regression tests pin both sides: the
//          fixture artifact parses with hub_remote === the bare path, and
//          loadHubTopology round-trips a Windows-style backslash hub_remote
//          while the raw-escape corruption mode fails closed with the typed
//          malformed-JSON error. Fixture-side only — no product writer was
//          affected (hub-state.ts / hub-bootstrap.ts write JSON exclusively
//          through JSON.stringify).
// v1.2.0 (2026-11-02, Windows portability hardening round 2 — self-describing
//          failures): CI round 2 failed the dry-run test blind (exit 1, no
//          stderr in the report), so every exit-code assertion on a spawned
//          CLI now goes through expectExit/expectSilentStderr — on mismatch
//          they throw carrying exit code + stderr + stdout head, making the
//          next CI run self-explaining (original substring assertions kept).
//          Windows hazards removed: deadPid() no longer spawns 'true' (no such
//          binary on Windows; and its -1 fallback reads EPERM=alive on POSIX
//          via kill(-1,0)) — it spawns process.execPath and refuses to return
//          a non-number pid; the CLI runners spawn process.execPath (the bun
//          binary running this suite) instead of re-resolving 'bun' from the
//          ambient PATH, all with windowsHide:true; buildFixture resolves git
//          once via Bun.which (typed throw when absent) and cleans the work
//          tree via rmRfBestEffort (brief retry — a freshly pushed git tree
//          can be EBUSY/EPERM on Windows while handles close). Pairs with
//          hub-bootstrap.ts v1.3.0.
// v1.1.0 (2026-11-02, Windows CI fix): every fixture git op pins
// -c core.autocrlf=false — the fixture seeds LF blobs and must never depend on
// the ambient autocrlf of the machine (a smudged checkout would flip hook
// bytes and mask/mis-detect hook-integrity divergence). Assertion bodies
// unchanged; pairs with hub-bootstrap.ts v1.2.0 (normalized fingerprints +
// best-effort cleanupTemp so the typed gate verdict always reaches stderr).
// hub-bootstrap.test.ts — unit contract for scripts/hub-bootstrap.ts,
// scripts/hub-probe.ts, and the ticket.ts --hub UNAVAILABLE gate
// (spec docs/designs/2026-11-01-hub-consolidation-design.md §3.5/§4/§4.5,
// Phase 3.5).
//
// Coverage (design §14.5 five guarantees + the Phase 3.5 test matrix):
// (d) dry-run writes nothing; (e) full clone→VALIDATED→READY E2E over a LOCAL
// BARE-REPO hub_remote (zero GitHub — pilot-E2E pattern) with idempotent
// re-run and the --yes approval gate; (f) lock concurrency (second bootstrap
// while held → typed refusal); (g) atomicity: moveIntoPlace EEXIST/ENOTEMPTY
// concurrent-claim guard; (h) recovery sweep removes dead-pid/>24h temps;
// (i) probe MATCH/DIVERGENT verdicts (chain, stale lease, chained-probe head)
// + keep-latest-4 retention; (j) ticket.ts create --hub refused on an
// UNAVAILABLE hub (declared or expired lease), allowed when absent.
//
// External VALIDATED checks (gitleaks / bun install+audit / root audit.ts)
// run through the documented HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS seam; the
// hook-integrity diff stays real (the fixture ships the canonical bytes).
import { describe, test, expect, afterAll, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { acquireLock, releaseLock } from '../../scripts/automation-lock.ts';
import { moveIntoPlace } from '../../scripts/hub-bootstrap.ts';
import { applyTransition, initStateFile, readState, stateFilePath, validateChain } from '../../scripts/helpers/hub-state.ts';
import { loadHubTopology } from '../../scripts/helpers/hub-topology.ts';
import { kstDate } from '../../scripts/helpers/kst-time.ts';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const BOOTSTRAP_CLI = join(REPO_ROOT, 'scripts', 'hub-bootstrap.ts');
const PROBE_CLI = join(REPO_ROOT, 'scripts', 'hub-probe.ts');
const TICKET_CLI = join(REPO_ROOT, 'scripts', 'ticket.ts');
const HUB = 'co-fixture';
const NOW = '2026-11-02T12:00:00.000Z';

/** A pid that is DEFINITELY dead: spawn a child with THIS runtime's binary
 * (process.execPath — v1.2.0: 'true' does not exist on Windows, and the old
 * `?? -1` fallback is poison because kill(-1, 0) reads EPERM = ALIVE on
 * POSIX), wait for it, use its pid. A non-number pid throws instead of ever
 * returning a value that could invert the dead/alive verdict. */
function deadPid(): number {
  const p = spawnSync(process.execPath, ['-e', ''], { windowsHide: true });
  if (typeof p.pid !== 'number') {
    throw new Error(`deadPid helper could not spawn a child: ${p.error?.message ?? `status ${p.status}`}`);
  }
  return p.pid;
}

/** rmSync that survives the Windows handle race (v1.2.0): a freshly pushed or
 * freshly cloned tree can be EBUSY/EPERM for a few hundred ms while git/AV
 * handles close. Retries briefly, then gives up — for CLEANUP ONLY (fixtures
 * live under tmpdir; a leftover is cosmetic). Never use where removal is
 * itself asserted. */
function rmRfBestEffort(dir: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch {
      if (attempt >= 4) return;
      Bun.sleepSync(60 * (attempt + 1));
    }
  }
}

interface Fixture {
  root: string;
  bare: string;
  sha: string;
}

/** Builds a zero-network fixture workspace: a registry naming a LOCAL BARE
 * repo as hub_remote, a canonical scripts/hooks/ tree, and the seeded hub
 * repo content (variant.json, template-version.txt, .gitleaks.toml, the same
 * hooks bytes, one benign file). */
function buildFixture(name = HUB): Fixture {
  const root = mkdtempSync(join(tmpdir(), 'hub-bootstrap-fix-'));
  const projects = join(root, 'Projects');
  mkdirSync(projects, { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'scripts', 'hooks'), { recursive: true });

  const hookFiles: Record<string, string> = {
    'pre-commit.ts': `// fixture canonical hook\nexport const CANONICAL = true;\n`,
    'README.md': `# fixture canonical hooks\n`,
  };
  for (const [f, content] of Object.entries(hookFiles)) writeFileSync(join(root, 'scripts', 'hooks', f), content, 'utf-8');

  writeFileSync(join(root, '.gitleaks.toml'), '[extend]\nuseDefault = true\n', 'utf-8');
  // The bare-repo path is needed by the schema below; it is a pure path join,
  // computable before the repo itself is created. The schema is written ONCE
  // with the REAL path through JSON.stringify (v1.3.0): the previous two-phase
  // write (placeholder + String.replace on the file text) embedded Windows
  // backslash paths raw into the JSON — \U invalid escape — and made every
  // fixture test read the registry as malformed JSON on Windows only.
  const bare = join(root, 'fixture-remote.git');
  writeFileSync(join(root, 'docs', 'workspace-schema.json'), JSON.stringify({
    hub_topology: {
      bootstrap_states: ['BOOTSTRAPPED', 'VALIDATED', 'READY'],
      operational_states: ['AVAILABLE', 'DEGRADED', 'UNAVAILABLE', 'RECOVERY'],
      capability_enum: { documentation: { never_in_degraded: false } },
      hubs: [{ name, hub_remote: bare, capabilities: [] }],
      entries: [],
    },
  }), 'utf-8');
  // git resolved ONCE (v1.2.0): a missing binary is a typed fixture-setup
  // error naming the cause, not a cryptic per-command failure downstream.
  const GIT = Bun.which('git');
  if (!GIT) throw new Error('fixture setup: git not found on PATH — the fixture clones a local bare repo');
  // All fixture git ops pin -c core.autocrlf=false (v1.1.0): the fixture seeds
  // LF blobs and the assertions must not depend on the machine's autocrlf
  // (Windows checkouts would otherwise smudge the hook bytes). No-op on POSIX.
  const run = (cmd: string[], cwd?: string) => {
    const p = spawnSync(GIT, ['-c', 'core.autocrlf=false', ...cmd.slice(1)], { cwd, encoding: 'utf-8', windowsHide: true });
    if ((p.status ?? 1) !== 0) throw new Error(`fixture git failed: ${cmd.join(' ')}\n${p.stdout}${p.stderr}`);
  };
  run(['git', 'init', '--quiet', '--bare', '--initial-branch=main', bare]);
  const wt = join(root, 'fixture-wt');
  run(['git', 'clone', '--quiet', bare, wt]);
  writeFileSync(join(wt, 'variant.json'), JSON.stringify({ name, version: '1.0.0' }), 'utf-8');
  writeFileSync(join(wt, 'template-version.txt'), 'common 1.0.0\n', 'utf-8');
  writeFileSync(join(wt, '.gitleaks.toml'), '[extend]\nuseDefault = true\n', 'utf-8');
  writeFileSync(join(wt, 'README.md'), `# ${name} fixture hub — one benign file\n`, 'utf-8');
  mkdirSync(join(wt, 'scripts', 'hooks'), { recursive: true });
  for (const [f, content] of Object.entries(hookFiles)) writeFileSync(join(wt, 'scripts', 'hooks', f), content, 'utf-8');
  run(['git', 'add', '.'], wt);
  run(['git', '-c', 'user.email=fixture@test', '-c', 'user.name=fixture', 'commit', '--quiet', '-m', 'fixture hub seed'], wt);
  run(['git', 'push', '--quiet', 'origin', 'main'], wt);
  const sha = spawnSync(GIT, ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf-8', windowsHide: true }).stdout.trim();

  rmRfBestEffort(wt); // v1.2.0 — cleanup only; a leftover fixture-wt is harmless
  return { root, bare, sha };
}

const fixtures: Fixture[] = [];
function makeFixture(name = HUB): Fixture {
  const f = buildFixture(name);
  fixtures.push(f);
  return f;
}

afterAll(() => {
  for (const f of fixtures) rmRfBestEffort(f.root);
});

function runBootstrap(args: string[], root: string, extraEnv: Record<string, string> = {}) {
  // process.execPath (v1.2.0): spawn the bun binary already running this
  // suite — re-resolving the bare name 'bun' from the ambient PATH is
  // shim-dependent on Windows CI. windowsHide kills console flashes.
  const proc = spawnSync(process.execPath, [BOOTSTRAP_CLI, ...args], {
    env: { ...process.env, HUB_BOOTSTRAP_ROOT: root, HUB_BOOTSTRAP_NOW: NOW, ...extraEnv },
    encoding: 'utf-8',
    windowsHide: true,
  });
  return { code: proc.status ?? 1, out: `${proc.stdout ?? ''}`, err: `${proc.stderr ?? ''}` };
}

/** Self-describing exit-code assertion (v1.2.0): on mismatch it throws BEFORE
 * the bare expect, carrying exit code + stderr + stdout head — a CI-only
 * failure becomes legible from the report alone. All original substring
 * assertions stay untouched after it. */
function expectExit(r: { code: number; out: string; err: string }, want: number, what: string): void {
  if (r.code !== want) {
    throw new Error(
      `${what}: expected exit ${want}, got ${r.code}\n` +
      `--- stderr ---\n${r.err.trim() ? r.err.slice(0, 800) : '<empty>'}\n` +
      `--- stdout (head 500) ---\n${r.out.slice(0, 500) || '<empty>'}`,
    );
  }
  expect(r.code).toBe(want);
}

/** Same discipline for the exact-empty-stderr assertion (success paths). */
function expectSilentStderr(r: { code: number; out: string; err: string }, what: string): void {
  if (r.err !== '') {
    throw new Error(
      `${what}: expected EMPTY stderr, got:\n${r.err.slice(0, 800)}\n--- stdout (head 500) ---\n${r.out.slice(0, 500)}`,
    );
  }
  expect(r.err).toBe('');
}

// ── (d) dry-run zero-write ───────────────────────────────────────────────────

describe('dry-run writes nothing (design §4.5 audit/idempotency frame)', () => {
  test('plan printed, no target, no temp dirs, no lock residue', () => {
    const f = makeFixture();
    const r = runBootstrap([HUB], f.root);
    expectExit(r, 0, 'dry-run plan');
    expect(r.out).toMatch(new RegExp(`hub_remote: ${f.bare.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    expect(r.out).toMatch(new RegExp(`pinned SHA: ${f.sha.slice(0, 12)}`));
    expect(r.out).toMatch(/dry-run/i);
    expect(existsSync(join(f.root, 'Projects', HUB))).toBe(false);
    expect(readdirSync(join(f.root, 'Projects')).filter(n => n.startsWith('.bootstrap-'))).toEqual([]);
    expect(existsSync(join(f.root, '.pipeline-state'))).toBe(false); // never locked in dry-run
  });

  test('remote-missing routes to the user-decision boundary and never creates a remote', () => {
    const f = makeFixture('co-other');
    const r = runBootstrap(['co-nowhere'], f.root);
    expectExit(r, 1, 'remote-missing halt');
    expect(r.err).toMatch(/REMOTE-MISSING case/);
    expect(r.err).toMatch(/ensure-github-repo/);
    expect(r.err).toMatch(/NEVER creates a remote/);
    expect(existsSync(join(f.root, 'Projects', 'co-nowhere'))).toBe(false);
  });
});

// ── fixture schema integrity (v1.3.0 round-3 regression) ─────────────────────

describe('fixture schema integrity (Windows CI round-3 regression: malformed registry)', () => {
  test('the fixture workspace-schema.json parses and carries the exact bare path as hub_remote', () => {
    // Pins the v1.3.0 writer mechanics: the schema must be a single
    // JSON.stringify artifact whose hub_remote equals the bare-repo path
    // verbatim. On Windows a re-introduced text-level interpolation would
    // embed C:\Users\... raw (\U = invalid escape) and fail THIS parse —
    // the fixture can never again ship a registry the product reads as
    // malformed JSON.
    const f = makeFixture();
    const schema = JSON.parse(readFileSync(join(f.root, 'docs', 'workspace-schema.json'), 'utf-8')) as {
      hub_topology: { hubs: Array<{ name: string; hub_remote: string }> };
    };
    expect(schema.hub_topology.hubs[0]).toMatchObject({ name: HUB, hub_remote: f.bare });
  });

  test('loadHubTopology round-trips a Windows backslash hub_remote; the raw-escape corruption mode fails closed', () => {
    // Product contract under the exact CI round-3 conditions: (1) a
    // hub_remote like C:\Users\... written via JSON.stringify parses back
    // intact (backslashes escaped in the file text); (2) the historical
    // corruption mode — the same path interpolated RAW into the JSON text —
    // is the typed fail-closed malformed-JSON error, never a silent mis-load.
    const root = mkdtempSync(join(tmpdir(), 'hub-schema-regr-'));
    mkdirSync(join(root, 'docs'), { recursive: true });
    const schemaPath = join(root, 'docs', 'workspace-schema.json');
    const winPath = 'C:\\Users\\runneradmin\\AppData\\Local\\Temp\\hub-bootstrap-fix-x\\fixture-remote.git';
    writeFileSync(schemaPath, JSON.stringify({
      hub_topology: { hubs: [{ name: HUB, hub_remote: winPath, capabilities: [] }], entries: [] },
    }), 'utf-8');
    const ok = loadHubTopology(root);
    expect(ok.ok).toBe(true);
    const hubs = (ok.topology as { hubs: Array<Record<string, unknown>> }).hubs;
    expect(hubs[0]['hub_remote']).toBe(winPath);

    // Corruption mode: identical object graph, but the path lands in the file
    // text with unescaped backslashes (what String.replace used to produce).
    writeFileSync(
      schemaPath,
      `{"hub_topology":{"hubs":[{"name":"${HUB}","hub_remote":"${winPath}","capabilities":[]}],"entries":[]}}`,
      'utf-8',
    );
    const broken = loadHubTopology(root);
    expect(broken.ok).toBe(false);
    expect(broken.error).toMatch(/not valid JSON/);
    expect(broken.error).toMatch(/Invalid escape/);
    rmSync(root, { recursive: true, force: true });
  });
});

// ── (e) full E2E: clone → VALIDATED → READY ──────────────────────────────────

describe('E2E bootstrap (bare-repo remote, external checks via documented skip seam)', () => {
  test('clone lands READY with approval + 3 chained journal entries; hooks verified; no residue', () => {
    const f = makeFixture();
    const r = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectSilentStderr(r, 'E2E bootstrap (clone→VALIDATED→READY)');
    expectExit(r, 0, 'E2E bootstrap (clone→VALIDATED→READY)');
    const hubDir = join(f.root, 'Projects', HUB);
    expect(existsSync(join(hubDir, 'variant.json'))).toBe(true);
    expect(existsSync(join(hubDir, '.git'))).toBe(true);

    const state = readState(hubDir, HUB)!;
    expect(state.bootstrap_state).toBe('READY');
    expect(state.operational_state).toBeNull(); // declaration is the hub PM's duty
    expect(state.approval).toMatchObject({ actor: 'user', remote: f.bare, sha: f.sha });
    expect(state.state_history.map(e => e.to)).toEqual(['BOOTSTRAPPED', 'VALIDATED', 'READY']);
    expect(state.state_history.every(e => e.actor === 'hub-bootstrap')).toBe(true);
    expect(state.state_history[1].reason).toMatch(/SKIPPED via HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS/); // skips are never silent
    expect(validateChain(state).ok).toBe(true);

    expect(readdirSync(join(f.root, 'Projects')).filter(n => n.startsWith('.bootstrap-'))).toEqual([]); // temp moved, not copied
    expect(existsSync(join(f.root, '.pipeline-state', `automation-bootstrap-${HUB}.lock`))).toBe(false); // released in finally
  });

  test('idempotent re-run on the valid hub is a no-op reporting existing state', () => {
    const f = makeFixture();
    const first = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(first, 0, 'idempotency setup bootstrap');
    const again = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(again, 0, 'idempotent re-run');
    expect(again.out).toMatch(/already present.*nothing to do/s);
    expect(again.out).toMatch(/Bootstrap state: READY/);
  });

  test('approval gate: --apply without --yes is refused before any clone', () => {
    const f = makeFixture();
    const r = runBootstrap([HUB, '--apply'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(r, 1, 'approval gate refusal');
    expect(r.err).toMatch(/approval gate/);
    expect(r.err).toMatch(/--yes/);
    expect(existsSync(join(f.root, 'Projects', HUB))).toBe(false);
    expect(readdirSync(join(f.root, 'Projects')).filter(n => n.startsWith('.bootstrap-'))).toEqual([]);
  });

  test('status subcommand renders the state file', () => {
    const f = makeFixture();
    const boot = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(boot, 0, 'status-test setup bootstrap');
    const s = runBootstrap(['status', HUB], f.root);
    expectExit(s, 0, 'status subcommand');
    expect(s.out).toMatch(/Bootstrap state: READY/);
    expect(s.out).toMatch(/Operational state: null/);
    expect(s.out).toMatch(/chain VALID/);
    expect(s.out).toMatch(new RegExp(f.sha.slice(0, 12)));
  });

  test('hook-integrity divergence FAILS the gate and cleans the temp dir', () => {
    const f = makeFixture();
    // Sabotage the canonical hooks AFTER the remote was seeded: the clone now
    // differs from the (sabotaged) canonical tree the gate diffs against.
    writeFileSync(join(f.root, 'scripts', 'hooks', 'pre-commit.ts'), '// TAMPERED\n', 'utf-8');
    const r = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(r, 1, 'hook-integrity divergence gate');
    expect(r.err).toMatch(/VALIDATED gate FAILED/);
    expect(r.err).toMatch(/hook differs from canonical/);
    expect(existsSync(join(f.root, 'Projects', HUB))).toBe(false);
    expect(readdirSync(join(f.root, 'Projects')).filter(n => n.startsWith('.bootstrap-'))).toEqual([]);
  });
});

// ── (f) lock concurrency ─────────────────────────────────────────────────────

describe('lock concurrency (automation-lock bootstrap-<hub>)', () => {
  test('a held lock refuses the second bootstrap with a typed message', () => {
    const f = makeFixture();
    const lock = acquireLock(`bootstrap-${HUB}`, { stateDir: join(f.root, '.pipeline-state') });
    expect(lock.ok).toBe(true);
    try {
      const r = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
      expectExit(r, 1, 'held-lock refusal');
      expect(r.err).toMatch(/lock refused/);
      expect(r.err).toMatch(/bootstrap-co-fixture/);
      expect(existsSync(join(f.root, 'Projects', HUB))).toBe(false);
    } finally {
      releaseLock(`bootstrap-${HUB}`, { stateDir: join(f.root, '.pipeline-state') });
    }
  });
});

// ── (g) atomicity: concurrent-claim guard ────────────────────────────────────

describe('moveIntoPlace (same-volume rename + ENOTEMPTY guard, design §4.3.3/4.3.4)', () => {
  test('clean rename moves the whole tree; the temp path no longer exists', () => {
    const base = mkdtempSync(join(tmpdir(), 'hub-move-ok-'));
    const temp = join(base, 'stage');
    const target = join(base, 'Projects', 'co-x');
    mkdirSync(join(base, 'Projects'), { recursive: true });
    mkdirSync(join(temp, 'inner'), { recursive: true });
    writeFileSync(join(temp, 'inner', 'f.txt'), 'x', 'utf-8');
    const out = moveIntoPlace(temp, target);
    expect(out).toEqual({ moved: true, concurrentClaim: false });
    expect(readFileSync(join(target, 'inner', 'f.txt'), 'utf-8')).toBe('x');
    expect(existsSync(temp)).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });

  test('EEXIST/ENOTEMPTY = concurrent claim: temp cleaned, winner stands, not an error', () => {
    const base = mkdtempSync(join(tmpdir(), 'hub-move-claim-'));
    const temp = join(base, 'stage');
    const target = join(base, 'Projects', 'co-x');
    mkdirSync(temp, { recursive: true });
    writeFileSync(join(temp, 'ours.txt'), 'loser', 'utf-8');
    // The concurrent winner appeared between the target check and the rename.
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'theirs.txt'), 'winner', 'utf-8');
    const out = moveIntoPlace(temp, target);
    expect(out).toEqual({ moved: false, concurrentClaim: true });
    expect(existsSync(temp)).toBe(false); // the loser cleans its own temp
    expect(readFileSync(join(target, 'theirs.txt'), 'utf-8')).toBe('winner'); // winner untouched
    rmSync(base, { recursive: true, force: true });
  });
});

// ── (h) recovery sweep ───────────────────────────────────────────────────────

describe('recovery sweep (--recover, design §4.3.5)', () => {
  test('removes dead-pid and >24h temp dirs; keeps a live fresh one; dry-run default', () => {
    const f = makeFixture();
    const mk = (name: string, marker: Record<string, unknown>): string => {
      const d = join(f.root, 'Projects', name);
      mkdirSync(d, { recursive: true });
      writeFileSync(join(d, 'bootstrap-state.json'), JSON.stringify(marker), 'utf-8');
      return d;
    };
    const dead = mk('.bootstrap-co-dead', { pid: deadPid(), url: 'x', sha: 's', started_at: NOW });
    const aged = mk('.bootstrap-co-aged', { pid: process.pid, url: 'x', sha: 's', started_at: '2026-11-01T00:00:00.000Z' });
    const fresh = mk('.bootstrap-co-fresh', { pid: process.pid, url: 'x', sha: 's', started_at: NOW });

    const dry = runBootstrap(['--recover'], f.root);
    expectExit(dry, 0, 'recover dry-run');
    expect(dry.out).toMatch(/pid \d+ is dead/);
    expect(dry.out).toMatch(/age > 24h/);
    expect(dry.out).toMatch(/Re-run with --apply/);
    expect(existsSync(dead)).toBe(true);
    expect(existsSync(aged)).toBe(true);
    expect(existsSync(fresh)).toBe(true);

    const applied = runBootstrap(['--recover', '--apply'], f.root);
    expectExit(applied, 0, 'recover --apply sweep');
    expect(existsSync(dead)).toBe(false);
    expect(existsSync(aged)).toBe(false);
    expect(existsSync(fresh)).toBe(true); // live pid + fresh age survives
  });
});

// ── (i) probe: verdicts + retention ──────────────────────────────────────────

function seedProbeHub(root: string, hooksContent: Record<string, string>): string {
  const hubDir = join(root, 'Projects', 'co-probe');
  mkdirSync(join(hubDir, '.git'), { recursive: true });
  mkdirSync(join(hubDir, 'scripts', 'hooks'), { recursive: true });
  mkdirSync(join(hubDir, 'tickets'), { recursive: true });
  writeFileSync(join(hubDir, 'variant.json'), '{"name":"co-probe"}', 'utf-8');
  writeFileSync(join(hubDir, 'template-version.txt'), 'common 1.0.0\n', 'utf-8');
  for (const [f, content] of Object.entries(hooksContent)) writeFileSync(join(hubDir, 'scripts', 'hooks', f), content, 'utf-8');
  return hubDir;
}

describe('hub-probe (read-only, design §3.5)', () => {
  function runProbe(args: string[], root: string) {
    const proc = spawnSync(process.execPath, [PROBE_CLI, ...args], {
      env: { ...process.env, HUB_PROBE_ROOT: root, HUB_BOOTSTRAP_NOW: NOW },
      encoding: 'utf-8',
      windowsHide: true,
    });
    return { code: proc.status ?? 1, out: `${proc.stdout ?? ''}`, err: `${proc.stderr ?? ''}` };
  }

  let root: string;
  let hubDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hub-probe-'));
    mkdirSync(join(root, 'scripts', 'hooks'), { recursive: true });
    mkdirSync(join(root, 'docs', 'reports'), { recursive: true });
    const hooks = { 'a.ts': 'canonical-a\n', 'b.ts': 'canonical-b\n' };
    for (const [f, c] of Object.entries(hooks)) writeFileSync(join(root, 'scripts', 'hooks', f), c, 'utf-8');
    hubDir = seedProbeHub(root, hooks);
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('MATCH: valid chain, live lease, intact hooks → verdict MATCH with report + head_hash', () => {
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-bootstrap', reason: 'clone', at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'session start', at: NOW });

    const r = runProbe(['co-probe'], root);
    expectExit(r, 0, 'probe MATCH');
    expect(r.out).toMatch(/MATCH/);
    const report = join(root, 'docs', 'reports', `${kstDate()}-hub-probe-co-probe.md`);
    expect(existsSync(report)).toBe(true);
    const text = readFileSync(report, 'utf-8');
    expect(text).toMatch(/Verdict\*\*: MATCH/);
    expect(text).toMatch(/hooks_integrity: match \(2 files\)/);
    expect(text).toMatch(/tickets_store: writable/);
    expect(text).toMatch(/head_hash: [0-9a-f]{64}/);
    expect(text).toMatch(/operational_state \(declared\): AVAILABLE/);
  });

  test('DIVERGENT: tampered hash chain → exit 2, divergence named, SEV command printed (never auto-filed)', () => {
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: NOW });
    const path = stateFilePath(hubDir, 'co-probe');
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    state.state_history[0].reason = 'REWRITTEN HISTORY';
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');

    const r = runProbe(['co-probe'], root);
    expectExit(r, 2, 'probe chain-tamper DIVERGENT');
    expect(r.out).toMatch(/DIVERGENT/);
    expect(r.out).toMatch(/hash chain BROKEN/);
    expect(r.out).toMatch(/ticket\.ts create --manual "SEV2: hub probe divergence — co-probe"/); // printed, not filed
  });

  test('DIVERGENT: declared state standing on an expired TTL lease (stale declaration)', () => {
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-10-31T00:00:00.000Z' });
    const r = runProbe(['co-probe'], root);
    expectExit(r, 2, 'probe expired-lease DIVERGENT');
    expect(r.out).toMatch(/EXPIRED TTL lease/);
    expect(r.out).toMatch(/consumers read UNAVAILABLE/);
  });

  test('DIVERGENT: prior probe head missing from the history (journal rewritten between probes)', () => {
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: NOW });
    const head = runProbe(['co-probe'], root);
    expectExit(head, 0, 'first probe records head'); // first probe records the head

    // Rewrite the whole journal (the forbidden history rewrite): new hashes.
    rmSync(stateFilePath(hubDir, 'co-probe'));
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r2', sha: 'b'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 're-written', at: NOW });
    const r = runProbe(['co-probe'], root);
    expectExit(r, 2, 'probe rewritten-journal DIVERGENT');
    expect(r.out).toMatch(/is NOT in the current history/);
    expect(r.out).toMatch(/rewritten between probes/);
  });

  test('NOT-BOOTSTRAPPED (no local clone) and absent state file are facts, not divergences', () => {
    const absent = runProbe(['co-probe'], root);
    // seedProbeHub ran in beforeEach — remove the clone to hit the no-repo path.
    rmSync(hubDir, { recursive: true, force: true });
    const noRepo = runProbe(['co-probe'], root);
    expectExit(noRepo, 0, 'probe NOT-BOOTSTRAPPED');
    expect(noRepo.out).toMatch(/NOT-BOOTSTRAPPED/);
    void absent;

    seedProbeHub(root, { 'a.ts': 'canonical-a\n', 'b.ts': 'canonical-b\n' });
    const noState = runProbe(['co-probe'], root);
    expectExit(noState, 0, 'probe absent-state MATCH');
    expect(noState.out).toMatch(/MATCH/); // signals clean; nothing declared to compare
  });

  test('retention: keep-latest-4 per hub — the newest report always survives', () => {
    const reportsDir = join(root, 'docs', 'reports');
    for (const d of ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']) {
      writeFileSync(join(reportsDir, `${d}-hub-probe-co-probe.md`), `head_hash: null\n`, 'utf-8');
    }
    initStateFile(hubDir, 'co-probe', { actor: 'user', remote: 'r', sha: 'a'.repeat(40), at: NOW });
    applyTransition(hubDir, 'co-probe', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: NOW });
    const probeRun = runProbe(['co-probe'], root);
    expectExit(probeRun, 0, 'probe retention run');
    const files = readdirSync(reportsDir).filter(f => f.endsWith('-hub-probe-co-probe.md')).sort();
    expect(files).toHaveLength(4); // 3 newest fakes + today's
    expect(files.some(f => f.startsWith('2026-10-20'))).toBe(false); // oldest pruned
    expect(files.some(f => f.startsWith(kstDate()))).toBe(true); // today's survives
  });
});

// ── (j) ticket.ts create --hub: the UNAVAILABLE gate ─────────────────────────

describe('ticket.ts create --hub (UNAVAILABLE refusal, design §4.5)', () => {
  function runTicket(args: string[], root: string) {
    const proc = spawnSync(process.execPath, [TICKET_CLI, ...args], {
      env: { ...process.env, TICKET_WORKSPACE_ROOT: root },
      encoding: 'utf-8',
      windowsHide: true,
    });
    return { code: proc.status ?? 1, out: `${proc.stdout ?? ''}`, err: `${proc.stderr ?? ''}` };
  }

  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hub-ticket-'));
    mkdirSync(join(root, 'tickets', 'governance'), { recursive: true });
    mkdirSync(join(root, 'Projects'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('UNAVAILABLE hub → typed refusal, no ticket written', () => {
    const hubDir = join(root, 'Projects', 'co-dead');
    mkdirSync(hubDir, { recursive: true });
    applyTransition(hubDir, 'co-dead', { kind: 'operational', to: 'UNAVAILABLE', actor: 'hub-pm', reason: 'down' });
    const r = runTicket(['create', '--manual', 'delegation attempt', '--hub', 'co-dead'], root);
    expectExit(r, 1, 'ticket UNAVAILABLE refusal');
    expect(r.err).toMatch(/refused: hub 'co-dead' is UNAVAILABLE/);
    expect(r.err).toMatch(/blocked \(design §3\.4\)/);
    expect(readdirSync(join(root, 'tickets', 'governance')).filter(f => f.endsWith('.yaml'))).toEqual([]);
  });

  test('expired lease on a declared AVAILABLE hub reads UNAVAILABLE and refuses', () => {
    const hubDir = join(root, 'Projects', 'co-stale');
    mkdirSync(hubDir, { recursive: true });
    applyTransition(hubDir, 'co-stale', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-10-31T00:00:00.000Z' });
    const r = runTicket(['create', '--manual', 'delegation attempt', '--hub', 'co-stale'], root);
    expectExit(r, 1, 'ticket expired-lease refusal');
    expect(r.err).toMatch(/EXPIRED TTL lease/);
  });

  test('absent state file allows; the ticket carries the hub metadata field', () => {
    mkdirSync(join(root, 'Projects', 'co-alive'), { recursive: true }); // no state file
    const r = runTicket(['create', '--manual', 'delegation ok', '--hub', 'co-alive'], root);
    expectExit(r, 0, 'ticket absent-state allow');
    expect(r.out).toMatch(/\(hub co-alive\)/);
    const file = readdirSync(join(root, 'tickets', 'governance')).find(f => f.endsWith('.yaml'))!;
    expect(readFileSync(join(root, 'tickets', 'governance', file), 'utf-8')).toMatch(/hub: co-alive/);
  });

  test('a live AVAILABLE declaration allows filing; a malformed hub name is a usage error', () => {
    const hubDir = join(root, 'Projects', 'co-open');
    mkdirSync(hubDir, { recursive: true });
    applyTransition(hubDir, 'co-open', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up' });
    const r = runTicket(['create', '--manual', 'delegation ok', '--hub', 'co-open'], root);
    expectExit(r, 0, 'ticket AVAILABLE allow');

    const bad = runTicket(['create', '--manual', 'x', '--hub', 'not-a-hub-name'], root);
    expectExit(bad, 1, 'ticket malformed hub name');
    expect(bad.err).toMatch(/--hub must match co-<slug>/);
  });
});

// ── (k) declare: divergence force (§3.5) + capability matrix (§3.4) ──────────

describe('hub-bootstrap declare — divergence force + capability requirement', () => {
  function runDeclare(args: string[], root: string) {
    const proc = spawnSync(process.execPath, [BOOTSTRAP_CLI, 'declare', ...args], {
      env: { ...process.env, HUB_BOOTSTRAP_ROOT: root },
      encoding: 'utf-8',
      windowsHide: true,
    });
    return { code: proc.status ?? 1, out: `${proc.stdout ?? ''}`, err: `${proc.stderr ?? ''}` };
  }

  let root: string;
  let hubDir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hub-declare-'));
    mkdirSync(join(root, 'docs', 'reports'), { recursive: true });
    hubDir = join(root, 'Projects', 'co-decl');
    mkdirSync(hubDir, { recursive: true });
    // Seed: operational AVAILABLE with a journal entry older than any report
    // mtime (so a fresh report always counts as "newer than the last journal").
    applyTransition(hubDir, 'co-decl', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-10-30T00:00:00.000Z' });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function writeReport(date: string, verdict: 'MATCH' | 'DIVERGENT'): void {
    writeFileSync(
      join(root, 'docs', 'reports', `${date}-hub-probe-co-decl.md`),
      `# Hub Probe — co-decl (${date})\n\n- **Verdict**: ${verdict}\n- **head_hash**: null\n`,
      'utf-8',
    );
  }

  test('a standing DIVERGENT probe report auto-forces the next AVAILABLE declaration to DEGRADED (design §3.5)', () => {
    writeReport('2026-11-01', 'DIVERGENT');
    const r = runDeclare(['co-decl', 'AVAILABLE', '--actor', 'hub-pm', '--reason', 'business as usual'], root);
    expectExit(r, 0, 'declare auto-forced DEGRADED');
    expect(r.out).toMatch(/operational_state=DEGRADED/);
    expect(r.out).toMatch(/auto-forced to DEGRADED by probe divergence/);
    const s = readState(hubDir, 'co-decl')!;
    expect(s.operational_state).toBe('DEGRADED');
    expect(s.state_history.at(-1)!.reason).toMatch(/probe divergence/); // the force is journaled, never silent
  });

  test('the force stands only for the next declaration opportunity; a MATCH report never forces', () => {
    writeReport('2026-11-01', 'DIVERGENT');
    expect(runDeclare(['co-decl', 'AVAILABLE', '--actor', 'hub-pm', '--reason', 'first'], root).out).toMatch(/DEGRADED/);
    // The forced declaration WAS the next opportunity — AVAILABLE re-opens after it.
    const again = runDeclare(['co-decl', 'AVAILABLE', '--actor', 'hub-pm', '--reason', 'second'], root);
    expectExit(again, 0, 'declare re-attest AVAILABLE');
    expect(again.out).toMatch(/operational_state=AVAILABLE/);
    expect(again.out).not.toMatch(/auto-forced/);

    // A fresh MATCH report supersedes: no force even with a stale journal.
    const d2 = join(root, 'Projects', 'co-decl2');
    mkdirSync(d2, { recursive: true });
    applyTransition(d2, 'co-decl2', { kind: 'operational', to: 'AVAILABLE', actor: 'hub-pm', reason: 'up', at: '2026-10-30T00:00:00.000Z' });
    writeFileSync(
      join(root, 'docs', 'reports', '2026-11-02-hub-probe-co-decl2.md'),
      '# Hub Probe — co-decl2 (2026-11-02)\n\n- **Verdict**: MATCH\n- **head_hash**: null\n',
      'utf-8',
    );
    expect(runDeclare(['co-decl2', 'AVAILABLE', '--actor', 'hub-pm', '--reason', 're-attest'], root).out).toMatch(/operational_state=AVAILABLE/);
  });

  test('DEGRADED without --capabilities on an empty degraded set is refused (design §3.4, guide §5.3)', () => {
    const r = runDeclare(['co-decl', 'DEGRADED', '--actor', 'hub-pm', '--reason', 'reduce'], root);
    expectExit(r, 1, 'declare DEGRADED without --capabilities');
    expect(r.err).toMatch(/--capabilities is required/);
  });
});

// ── (l) boot-time sweep (§4.3.5): every --apply bootstrap sweeps stale temps ──

describe('boot-time sweep (design §4.3.5)', () => {
  test('--apply removes a dead-pid temp dir before cloning; dry-run never sweeps', () => {
    const f = makeFixture();
    const staleDir = join(f.root, 'Projects', '.bootstrap-co-stale-999-1');
    mkdirSync(staleDir, { recursive: true });
    writeFileSync(join(staleDir, 'bootstrap-state.json'), JSON.stringify({ pid: deadPid(), url: 'x', sha: 's', started_at: NOW }), 'utf-8');

    const dry = runBootstrap([HUB], f.root); // dry-run default — zero-write guarantee holds
    expectExit(dry, 0, 'boot-time sweep dry-run');
    expect(existsSync(staleDir)).toBe(true);

    const applied = runBootstrap([HUB, '--apply', '--yes'], f.root, { HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS: '1' });
    expectExit(applied, 0, 'boot-time sweep --apply');
    expect(applied.out).toMatch(/boot-time sweep removed/);
    expect(existsSync(staleDir)).toBe(false);
  });
});
