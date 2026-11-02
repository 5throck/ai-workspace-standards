#!/usr/bin/env bun
// @version 1.4.0
// v1.4.0 (2026-11-02, Windows CI fix round 4 — concurrent-claim errno):
//          Windows CI failed the 'EEXIST/ENOTEMPTY = concurrent claim' test
//          with "EPERM: operation not permitted, rename '...stage' ->
//          '...Projects\co-x'": renaming a directory onto an EXISTING
//          directory throws EPERM on Windows where POSIX reports
//          ENOTEMPTY/EEXIST — the same operation, a platform errno
//          difference. moveIntoPlace's concurrent-claim catch now includes
//          EPERM (with the errno difference documented at the catch site);
//          the cleanup + typed-notice behavior is identical for all three
//          codes, and the "winner stands" outcome is unchanged. Catching
//          EPERM unconditionally is unreachable on POSIX for this rename
//          shape, so no legitimate failure is masked. No other rename site
//          in the script renames onto a potentially-existing target (the
//          bootstrap-state.json marker is a direct writeFileSync onto a
//          fresh path inside the temp clone).
// v1.3.0 (2026-11-02, Windows portability hardening round 2 — CI round-trip
//          showed the DRY-RUN path itself exiting 1 on Windows after v1.2.0,
//          so the early path is made hazard-free and every external spawn is
//          made diagnosable): (a) run() spawns with windowsHide:true and, when
//          a child cannot be spawned AT ALL (status null + proc.error, e.g.
//          ENOENT for a missing binary), surfaces the spawn error inside the
//          returned output — a missing tool can no longer masquerade as a
//          silent empty-output failure; (b) the gate's bun invocations use
//          process.execPath (the bun binary already running this script)
//          instead of re-resolving the bare name 'bun' from the ambient PATH,
//          which is shim-dependent on Windows CI; (c) gitleaks is existence-
//          gated via Bun.which — a missing scanner is a typed fail-closed
//          message naming the explicit skip seam, never a misread "exit 1 =
//          findings" verdict (spawn ENOENT also reads status null → 1);
//          (d) moveIntoPlace's same-volume check compares only FINITE dev
//          numbers — where a Windows/Bun runtime leaves statSync().dev NaN the
//          check is undecided and skipped with a note instead of false-failing
//          the atomic rename (documented platform guard; shell probes like
//          `stat -f` stay forbidden here); (e) resolvePinnedSha splits
//          ls-remote output on /\r?\n/ so a CRLF-tinged stream still parses.
// v1.2.0 (2026-11-02, Windows CI fix — tests/unit/hub-bootstrap.test.ts
//          'hook-integrity divergence FAILS the gate'): (a) the hook-integrity
//          fingerprint is line-ending-neutral — sha256 over content with CRLF
//          normalized to LF — and its walk keys are explicitly posix-style, so
//          a core.autocrlf=true checkout on Windows cannot false-fail the pass
//          case (every hook "differs" only by line endings); the clone itself
//          pins -c core.autocrlf=false for the same reason (no-op on POSIX).
//          (b) every temp-dir cleanup before a fail() is best-effort
//          (cleanupTemp) — on Windows rmSync can throw EBUSY/EPERM while AV or
//          a lingering git child still holds a handle on a freshly cloned
//          file, which used to replace the typed VALIDATED gate verdict with
//          an opaque cleanup exception (exit 1 without the typed message); the
//          same best-effort rule covers both sweeps (per-dir try/catch — one
//          locked dir no longer aborts the sweep) and the concurrent-claim
//          cleanup in moveIntoPlace.
// v1.1.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §3.5/§4.3.5/§3.4, Phase 3.5 audit completion): (a) the §3.5
//          divergence force — a hub whose LATEST root-side probe report reads
//          DIVERGENT and is newer than its last journal entry cannot declare
//          AVAILABLE; the declaration is auto-forced to DEGRADED (reason notes
//          the forcing report) until a MATCH probe supersedes; reports are read
//          through hub-probe.ts v1.1.0's exported parsers (single derivation).
//          (b) the §4.3.5 boot-time sweep — every --apply bootstrap sweeps
//          dead-pid / >24h temp dirs BEFORE creating its own (crash recovery
//          without a manual --recover); dry-run never sweeps. (c) declare
//          DEGRADED requires --capabilities when the existing degraded set is
//          empty (§3.4: a DEGRADED declaration names its reduced capability
//          set — matches the operator guide §5.3).
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §4 + §3.1, Phase 3.5): hub-bootstrap — creates a local working clone
//          of a hub from the registry `hub_remote` with SHA pinning, the four-
//          check VALIDATED gate (hooks inactive until it passes), an atomic
//          same-volume move, and BOOTSTRAPPED->VALIDATED->READY journal entries
//          in the hub's hash-chained state file (helpers/hub-state.ts).
// hub-bootstrap.ts — the two-cases-one-entry-point hub auto-creation contract.
//
// Cases (design §4.1): remote-exists = clone from hub_remote ONLY (no auto-
// creation, no scaffolding here); remote-missing = typed halt routing to the
// USER decision + scripts/ensure-github-repo.ts / scaffold flow — never
// silently creates a remote from this path.
//
// Five guarantees (§4.5): idempotency (target-exists short-circuit), lock
// (automation-lock.ts `bootstrap-<hub>` verbatim), atomicity (temp dir +
// same-volume rename check), recovery (bootstrap-state.json marker + boot-time
// sweep of dead-pid/>24h temp dirs on every --apply run, plus the manual
// --recover sweep), audit (every transition in the hub state file's
// state_history).
//
// Usage:
//   bun scripts/hub-bootstrap.ts <hub-name> [--apply] [--yes]   # dry-run default
//   bun scripts/hub-bootstrap.ts status <hub-name>
//   bun scripts/hub-bootstrap.ts declare <hub> <AVAILABLE|DEGRADED|UNAVAILABLE|RECOVERY>
//       --actor <user|hub-pm> --reason "<text>" [--capabilities a,b] [--lease-hours N] [--state-dir <dir>]
//   bun scripts/hub-bootstrap.ts --recover [--apply]            # sweep stale temp dirs
//
// Test seams (documented, never set in production):
//   HUB_BOOTSTRAP_ROOT=<dir>          — redirect the workspace root (Projects/,
//                                       docs/workspace-schema.json, .gitleaks.toml).
//   HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS=1 — skip the three external VALIDATED
//                                       checks (gitleaks, bun install+audit,
//                                       root audit.ts). The hook-integrity diff
//                                       stays real. Skips are RECORDED in the
//                                       VALIDATED journal reason.
//   HUB_BOOTSTRAP_NOW=<iso>           — deterministic timestamp for the sweep
//                                       and journal (tests only).
// @l2-propagate: false

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { acquireLock, releaseLock } from './automation-lock.ts';
import { latestProbeReportFile, probeReportVerdict } from './hub-probe.ts';
import { loadHubTopology } from './helpers/hub-topology.ts';
import {
  applyTransition, initStateFile, isLeaseValid, loadRegistryEnums, readState,
  stateFilePath, validateChain, validateDegradedCapabilities,
  HubStateError,
  OPERATIONAL_STATES,
  type HubStateFile,
} from './helpers/hub-state.ts';

// ── Seams + constants ────────────────────────────────────────────────────────

const ROOT = process.env.HUB_BOOTSTRAP_ROOT ? resolve(process.env.HUB_BOOTSTRAP_ROOT) : resolve(import.meta.dir, '..');
const PROJECTS_DIR = join(ROOT, 'Projects');
const HUB_NAME_RE = /^co-[a-z0-9-]{1,40}$/;
const SWEEP_MAX_AGE_MS = 24 * 3_600_000; // recovery sweep: age > 24h (design §4.3)

function nowIso(): string {
  return process.env.HUB_BOOTSTRAP_NOW ?? new Date().toISOString();
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function run(cmd: string[], opts: { cwd?: string } = {}): { code: number; out: string } {
  const proc = spawnSync(cmd[0], cmd.slice(1), { cwd: opts.cwd, encoding: 'utf-8', windowsHide: true });
  // status null = the child never ran (spawn error, e.g. ENOENT for a missing
  // binary — v1.3.0): surface the reason in the output instead of returning a
  // silent empty string that callers would report as an opaque tool failure.
  const spawnNote = proc.status === null && proc.error ? ` [spawn failed: ${proc.error.message}]` : '';
  return { code: proc.status ?? 1, out: `${proc.stdout ?? ''}${proc.stderr ?? ''}${spawnNote}` };
}

/** The bun binary running THIS process (v1.3.0): the VALIDATED gate's bun
 * invocations spawn it by absolute path. Re-resolving the bare name 'bun'
 * from the ambient PATH is shim-dependent on Windows CI, and a missed
 * resolution would surface as a tool failure rather than a gate verdict. */
const BUN_BIN = process.execPath;

/** Best-effort temp-dir cleanup that can never mask the typed failure printed
 * after it (v1.2.0): on Windows rmSync can throw EBUSY/EPERM while AV or a
 * lingering git child still holds a handle on a freshly cloned file — the
 * typed verdict must still reach stderr. Returns true when the dir is gone. */
function cleanupTemp(dir: string): boolean {
  try {
    rmSync(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/** Shared tail for every cleanup-then-fail site: the typed message always
 * prints; a failed cleanup is named inside it instead of replacing it. */
function failWithCleanup(msg: string, tempDir: string): never {
  const cleaned = cleanupTemp(tempDir);
  fail(cleaned ? msg : `${msg}\n   ⚠ temp dir cleanup FAILED (${tempDir}) — remove it manually`);
}

// ── Registry resolution (design §4.1) ────────────────────────────────────────

interface HubRemoteResolution {
  remote: string;
  source: string;
}

/** hub_remote comes from the hub_topology registry ONLY. Resolution order:
 * hubs[] row by name, then the unique hub_remote across the hub's entries[]
 * rows. Nothing found -> typed remote-missing error routing to the user
 * decision + ensure-github-repo/scaffold flow (we print the boundary; that
 * flow is deliberately NOT implemented here — §4.1). */
function resolveHubRemote(hub: string): HubRemoteResolution {
  const loaded = loadHubTopology(ROOT);
  if (!loaded.ok) {
    if (loaded.error === 'absent-file' || loaded.error === 'absent-section') {
      return fail(`remote-missing: the hub_topology registry is not available (${loaded.error}) — cannot resolve hub_remote for '${hub}'. ` +
        `This is the REMOTE-MISSING case (design §4.1): it routes to a USER decision — run scripts/ensure-github-repo.ts / the scaffold flow manually. ` +
        `hub-bootstrap NEVER creates a remote from this path.`);
    }
    return fail(`hub_topology registry is malformed: ${loaded.error}`);
  }
  const t = loaded.topology;
  if (!t) {
    return fail(`hub_topology registry resolved empty — cannot resolve hub_remote for '${hub}'`);
  }
  const hubRow = (Array.isArray(t.hubs) ? t.hubs : []).find(
    h => h && typeof h === 'object' && (h as Record<string, unknown>)['name'] === hub,
  ) as Record<string, unknown> | undefined;
  if (hubRow && typeof hubRow['hub_remote'] === 'string' && hubRow['hub_remote'].length > 0) {
    return { remote: hubRow['hub_remote'], source: 'hub_topology.hubs[]' };
  }
  const entryRemotes = new Set<string>();
  for (const row of Array.isArray(t.entries) ? t.entries : []) {
    if (!row || typeof row !== 'object') continue;
    const e = row as Record<string, unknown>;
    if (e['hub_variant'] === hub && typeof e['hub_remote'] === 'string' && e['hub_remote'].length > 0) {
      entryRemotes.add(e['hub_remote']);
    }
  }
  if (entryRemotes.size === 1) return { remote: [...entryRemotes][0], source: 'hub_topology.entries[]' };
  if (entryRemotes.size > 1) {
    return fail(`registry ambiguity: entries[] rows for '${hub}' carry ${entryRemotes.size} distinct hub_remote values — fix the registry before bootstrapping`);
  }
  return fail(`remote-missing: no hub_remote for '${hub}' in the hub_topology registry (hubs[] and entries[]). ` +
    `This is the REMOTE-MISSING case (design §4.1): it routes to a USER decision — run scripts/ensure-github-repo.ts / the scaffold flow manually. ` +
    `hub-bootstrap NEVER creates a remote from this path.`);
}

/** Pinned SHA (design §4.2): ls-remote main, falling back to HEAD. */
function resolvePinnedSha(remote: string): string | null {
  for (const ref of ['main', 'HEAD']) {
    const r = run(['git', 'ls-remote', remote, ref]);
    const line = r.out.split(/\r?\n/).find(l => l.includes(ref));
    if (r.code === 0 && line) return line.split(/\s+/)[0];
  }
  return null;
}

// ── Target pre-checks (design §4.5 idempotency) ──────────────────────────────

interface TargetCheck {
  present: boolean;
  valid: boolean;
  problems: string[];
}

function checkTarget(hubDir: string): TargetCheck {
  if (!existsSync(hubDir)) return { present: false, valid: false, problems: [] };
  const problems: string[] = [];
  if (!existsSync(join(hubDir, '.git'))) problems.push('.git missing — not a git working clone');
  const vj = join(hubDir, 'variant.json');
  if (!existsSync(vj)) problems.push('variant.json missing');
  else {
    try { JSON.parse(readFileSync(vj, 'utf-8')); } catch (e) {
      problems.push(`variant.json does not parse (${e instanceof Error ? e.message : String(e)})`);
    }
  }
  if (!existsSync(join(hubDir, 'template-version.txt'))) problems.push('template-version.txt missing');
  return { present: true, valid: problems.length === 0, problems };
}

function printStatus(hub: string, stateDirOverride?: string): void {
  const dir = stateDirOverride ?? join(PROJECTS_DIR, hub);
  const target = checkTarget(dir);
  console.log(`Hub: ${hub}`);
  console.log(`Local clone: ${dir} ${target.present ? (target.valid ? '(present, valid)' : `(present, INVALID: ${target.problems.join('; ')})`) : '(absent — run: bun scripts/hub-bootstrap.ts ' + hub + ' --apply)'}`);
  let state: HubStateFile | null = null;
  try {
    state = readState(dir, hub);
  } catch (e) {
    console.log(`State file: UNREADABLE (${(e as Error).message})`);
    return;
  }
  if (!state) {
    console.log('State file: absent (never bootstrapped through the Phase 3.5 flow)');
    return;
  }
  const chain = validateChain(state);
  console.log(`Bootstrap state: ${state.bootstrap_state ?? '<init never run>'}`);
  console.log(`Operational state: ${state.operational_state ?? 'null (not yet in service — first declaration is the hub PM\'s)'}`);
  if (state.operational_state) {
    console.log(`TTL lease: ${isLeaseValid(state) ? `valid until ${state.ttl_lease!.expires_at}` : `EXPIRED (was until ${state.ttl_lease?.expires_at ?? '?'}) — consumers read UNAVAILABLE`}`);
    if (state.operational_state === 'DEGRADED') console.log(`Degraded capabilities: [${state.degraded_capabilities.join(', ')}]`);
  }
  console.log(`Approval: ${state.approval ? `${state.approval.actor} @ ${state.approval.sha.slice(0, 12)} (${state.approval.remote}, ${state.approval.at})` : 'none recorded'}`);
  console.log(`Journal: ${state.state_history.length} entr(ies), head ${state.head_hash?.slice(0, 12) ?? 'null'}, chain ${chain.ok ? 'VALID' : `BROKEN at ${chain.at}: ${(chain as { error: string }).error}`}`);
}

// ── VALIDATED gate (design §4.4) ─────────────────────────────────────────────

/** Line-ending-normalized content fingerprint (v1.2.0): sha256 over the utf-8
 * bytes with CRLF normalized to LF. Platform-agnostic BY CONSTRUCTION — on a
 * core.autocrlf=true Windows checkout git smudges LF blobs to CRLF on disk,
 * which must not read as hook divergence; on POSIX (LF-only files) the
 * normalization is a no-op and the fingerprint is the plain byte identity. */
function contentFingerprint(p: string): string {
  const normalized = readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(normalized, 'utf-8').digest('hex');
}

function dirFingerprint(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  const walk = (d: string, prefix: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      // Keys are ALWAYS posix-style ('/' separators, no drive letter) so the
      // comparison is separator-neutral on Windows.
      const key = prefix + e.name;
      if (e.isDirectory()) walk(p, `${key}/`);
      else out.set(key, contentFingerprint(p));
    }
  };
  walk(dir, '');
  return out;
}

/** Hook-integrity diff: the temp clone's scripts/hooks/ must be byte-identical
 * to the canonical scripts/hooks/ (design §4.4 check 2) modulo line endings —
 * v1.2.0 fingerprints sha256-normalize CRLF to LF so a core.autocrlf=true
 * Windows checkout cannot false-fail the pass case. Returns violation strings
 * (empty = clean). */
function hookIntegrityDiff(cloneDir: string): string[] {
  const canonical = join(ROOT, 'scripts', 'hooks');
  const delivered = join(cloneDir, 'scripts', 'hooks');
  const violations: string[] = [];
  if (!existsSync(canonical)) return [`canonical ${canonical} is missing — cannot diff (refusing to validate)`];
  if (!existsSync(delivered)) return [`clone carries no scripts/hooks/ directory — the canonical hooks must ship with the hub`];
  const a = dirFingerprint(canonical);
  const b = dirFingerprint(delivered);
  for (const [f, content] of a) {
    if (!b.has(f)) violations.push(`hook missing in clone: scripts/hooks/${f}`);
    else if (b.get(f) !== content) violations.push(`hook differs from canonical: scripts/hooks/${f}`);
  }
  for (const f of b.keys()) {
    if (!a.has(f)) violations.push(`extra hook not in canonical: scripts/hooks/${f}`);
  }
  return violations;
}

interface ValidationReport {
  ok: boolean;
  reasons: string[];
  skippedExternal: boolean;
}

function runValidatedGate(cloneDir: string): ValidationReport {
  const reasons: string[] = [];
  const skippedExternal = process.env.HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS === '1';

  // Check 2 — hook-integrity diff (always real: pure byte compare, no deps).
  const hookViolations = hookIntegrityDiff(cloneDir);
  if (hookViolations.length > 0) {
    return { ok: false, reasons: hookViolations.map(v => `hook-integrity: ${v}`), skippedExternal };
  }
  reasons.push('hook-integrity: clone scripts/hooks/ byte-identical to canonical scripts/hooks/');

  if (skippedExternal) {
    reasons.push('external checks (gitleaks / bun install+audit / root audit.ts) SKIPPED via HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS=1 — recorded here so a skipped validation is never silent');
    return { ok: true, reasons, skippedExternal };
  }

  // Check 1 — gitleaks with explicit workspace-owned --config (working tree).
  const cfg = join(ROOT, '.gitleaks.toml');
  if (!existsSync(cfg)) return { ok: false, reasons: ['gitleaks: workspace .gitleaks.toml missing — refusing to validate without the owned rules'], skippedExternal };
  // Existence-gated (v1.3.0): a missing gitleaks binary spawns as ENOENT and
  // reads exit 1 — indistinguishable from a FINDING. Gate it explicitly and
  // fail closed with the typed route out (install, or the documented seam).
  const glPath = Bun.which('gitleaks');
  if (!glPath) {
    return { ok: false, reasons: ['gitleaks: not found on PATH — install gitleaks (https://gitleaks.io) or set HUB_BOOTSTRAP_SKIP_EXTERNAL_CHECKS=1 to skip the external checks explicitly (a missing scanner is never read as a clean scan)'], skippedExternal };
  }
  const gl = run([glPath, 'detect', '--source', cloneDir, '--config', cfg, '--no-git', '--redact']);
  if (gl.code === 1) {
    return { ok: false, reasons: [`gitleaks: findings in the clone working tree (exit 1) — review before bootstrapping`], skippedExternal };
  }
  if (gl.code !== 0) {
    return { ok: false, reasons: [`gitleaks: tool failure (exit ${gl.code}) ${gl.out.slice(0, 400)}`], skippedExternal };
  }
  reasons.push('gitleaks: working-tree scan clean (explicit --config .gitleaks.toml)');

  // Check 3 — bun install && bun audit, no advisories (design floor: no
  // high/critical; the gate refuses ANY advisory — fail-closed beyond it).
  if (existsSync(join(cloneDir, 'package.json'))) {
    const install = run([BUN_BIN, 'install'], { cwd: cloneDir });
    if (install.code !== 0) return { ok: false, reasons: [`bun install failed in the clone (exit ${install.code}) ${install.out.slice(0, 400)}`], skippedExternal };
    const audit = run([BUN_BIN, 'audit'], { cwd: cloneDir });
    if (audit.code !== 0) {
      return { ok: false, reasons: [`bun audit reported advisories (exit ${audit.code}) — no high/critical allowed ${audit.out.slice(0, 400)}`], skippedExternal };
    }
    reasons.push('bun install + bun audit: no advisories');
  } else {
    reasons.push('bun install + bun audit: skipped (clone carries no package.json)');
  }

  // Check 4 — root audit.ts green.
  const audit = run([BUN_BIN, 'scripts/audit.ts'], { cwd: ROOT });
  if (audit.code !== 0) {
    return { ok: false, reasons: [`root audit.ts not green (exit ${audit.code}) ${audit.out.slice(-400)}`], skippedExternal };
  }
  reasons.push('root audit.ts: green');

  return { ok: true, reasons, skippedExternal };
}

// ── Bootstrap flow ───────────────────────────────────────────────────────────

export interface MoveOutcome {
  moved: boolean;
  /** true when the rename failed with ENOTEMPTY/EEXIST/EPERM — a concurrent
   * claim won; our temp dir has been cleaned and the caller reports, not
   * errors. (EPERM is Windows' errno for rename-onto-existing-dir — see the
   * comment at the catch site below.) */
  concurrentClaim: boolean;
}

/** Five-guarantee #3 (§4.3): same-volume check then the atomic rename.
 * Exported for tests (deterministic ENOTEMPTY injection — the concurrent
 * window cannot be hit reliably from a subprocess). */
export function moveIntoPlace(tempDir: string, targetDir: string): MoveOutcome {
  // Same-volume check (§4.3.3). fs.statSync().dev is the portable volume id on
  // every documented platform; where a Windows/Bun runtime leaves it NaN (0 is
  // a real drive id and compares fine), the check is UNDECIDABLE — skip it
  // with a note instead of false-failing the atomic rename (v1.3.0 platform
  // guard; shell probes like `stat -f` stay forbidden here).
  const tempDev = statSync(tempDir).dev;
  const targetParentDev = statSync(join(targetDir, '..')).dev;
  const decidable = Number.isFinite(tempDev) && Number.isFinite(targetParentDev);
  if (decidable && tempDev !== targetParentDev) {
    failWithCleanup(`same-volume check failed: temp dir (dev ${tempDev}) and target parent (dev ${targetParentDev}) are on different devices — an atomic rename is impossible; free the cross-volume mount and retry`, tempDir);
  }
  if (!decidable) console.log('   note: same-volume check skipped (fs dev numbers unavailable on this platform) — the rename stays within Projects/ and atomic');
  try {
    renameSync(tempDir, targetDir);
    return { moved: true, concurrentClaim: false };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Platform errno difference for the SAME operation (rename a directory
    // onto an existing directory — the concurrent-claim shape, §4.3.4):
    // POSIX reports ENOTEMPTY/EEXIST; Windows (libuv MoveFileExW) reports
    // EPERM. So EPERM joins the concurrent-claim catch (v1.4.0). Catching it
    // unconditionally is safe on POSIX too: a same-volume rename of this
    // shape never produces EPERM there, so the branch is unreachable on
    // POSIX and no legitimate failure is masked. Cleanup + typed notice are
    // identical for all three codes.
    if (code === 'ENOTEMPTY' || code === 'EEXIST' || code === 'EPERM') {
      // Five-guarantee #3 concurrency clause (§4.3.4): a concurrent claim
      // won — clean OUR temp and report, this is not an error. Cleanup is
      // best-effort (v1.2.0): a Windows EBUSY here must not turn the
      // concurrent-claim report into an opaque exception.
      if (!cleanupTemp(tempDir)) console.log(`   ⚠ temp dir cleanup FAILED (${tempDir}) — remove it manually`);
      return { moved: false, concurrentClaim: true };
    }
    throw err;
  }
}

interface BootstrapPlan {
  hub: string;
  hubDir: string;
  remote: string;
  sha: string | null;
  tempDir: string;
}

function buildPlan(hub: string): BootstrapPlan {
  const { remote, source } = resolveHubRemote(hub);
  const sha = resolvePinnedSha(remote);
  const tempDir = join(PROJECTS_DIR, `.bootstrap-${hub}-${process.pid}-${Date.now()}`);
  console.log(`\n📋 Bootstrap plan for '${hub}' (dry-run — add --apply to execute):`);
  console.log(`   hub_remote: ${remote} (source: ${source})`);
  console.log(`   pinned SHA: ${sha ?? '<unresolved — offline? (apply requires a resolvable SHA)>'}`);
  console.log(`   temp dir:   ${tempDir} (never gw- — that namespace is swept by co-workspace)`);
  console.log(`   gate:       gitleaks(--config .gitleaks.toml) + hook-integrity diff + bun install/audit + root audit.ts`);
  console.log(`   move:       same-volume rename into ${join(PROJECTS_DIR, hub)} after the gate passes`);
  return { hub, hubDir: join(PROJECTS_DIR, hub), remote, sha, tempDir };
}

function bootstrap(hub: string, apply: boolean, yes: boolean): void {
  if (!HUB_NAME_RE.test(hub)) fail(`invalid hub name: ${JSON.stringify(hub)} — expected co-<slug>`);
  const target = checkTarget(join(PROJECTS_DIR, hub));
  if (target.present) {
    // Five-guarantee #1 — idempotency: an existing hub short-circuits to a
    // no-op reporting the existing state. READY is reached ONLY through the
    // VALIDATED gate (§4.4) run by the bootstrap that created the clone —
    // never stamped onto a directory that appeared by other means.
    if (!target.valid) {
      fail(`'${join(PROJECTS_DIR, hub)}' exists but is NOT a valid hub clone: ${target.problems.join('; ')} — repair or remove it manually; hub-bootstrap never deletes or overwrites a target`);
    }
    console.log(`✅ ${hub} is already present at ${join(PROJECTS_DIR, hub)} — nothing to do (idempotent no-op).`);
    console.log(`   Note: READY is only ever reached via the VALIDATED gate (§4.4) run by the bootstrap that created the clone.`);
    printStatus(hub);
    return;
  }

  const plan = buildPlan(hub);

  // Approval gate (design §4.2): the printed plan carries the pinned SHA; the
  // PM asks the user in-session and re-runs with --yes. The FLAG is the
  // recorded approval; it lands in the state file's approval journal record.
  if (!apply) {
    console.log('\nDry run — nothing was written. Re-run with --apply (and --yes to record user approval) to execute.');
    return;
  }
  if (!yes) {
    fail(`approval gate: re-run with --yes after the user approves the plan above (hub + pinned SHA must be shown to the user; the flag IS the recorded approval)`);
  }
  if (!plan.sha) {
    fail(`cannot pin a commit: git ls-remote resolved no SHA for ${plan.remote} — check the remote and retry`);
  }
  if (!existsSync(PROJECTS_DIR)) fail(`Projects/ directory missing at ${PROJECTS_DIR} — nothing to bootstrap into`);

  // Five-guarantee #2 — lock: automation-lock.ts verbatim, key bootstrap-<hub>.
  const lockName = `bootstrap-${hub}`;
  const lock = acquireLock(lockName, { stateDir: join(ROOT, '.pipeline-state') });
  if (!lock.ok) fail(`lock refused: ${lock.message}`);
  try {
    // Five-guarantee #4 — boot-time sweep (§4.3.5): a crashed bootstrap leaves
    // no residue; every --apply run clears dead-pid / >24h temp dirs BEFORE
    // creating its own (the manual --recover sweep shares this detection).
    for (const s of sweepStaleTempDirs(Date.parse(nowIso()))) {
      // Best-effort per dir (v1.2.0): one locked dir (Windows EBUSY) must not
      // abort the whole bootstrap sweep — the next sweep retries it.
      try {
        rmSync(s.dir, { recursive: true, force: true });
        console.log(`   🧹 boot-time sweep removed ${s.dir} — ${s.cause}`);
      } catch (e) {
        console.log(`   ⚠ boot-time sweep could not remove ${s.dir} (${e instanceof Error ? e.message : e}) — left for the next sweep`);
      }
    }
    // Five-guarantee #3 — temp dir + atomic move (§4.3): clone into
    // .bootstrap-<hub>-<pid>-<ts>; the gw- namespace is FORBIDDEN here —
    // sweepOrphanedScaffolds deletes any gw-<12hex> under Projects/ at gateway
    // boot, which would destroy a mid-run bootstrap.
    mkdirSync(plan.tempDir, { recursive: true });

    console.log(`\n cloning ${plan.remote} @ ${plan.sha.slice(0, 12)} …`);
    // -c core.autocrlf=false (v1.2.0): pin a faithful checkout so the hook-
    // integrity byte compare is deterministic on Windows too (no-op on POSIX,
    // where autocrlf already defaults to false).
    const clone = run(['git', '-c', 'core.autocrlf=false', 'clone', '--quiet', plan.remote, plan.tempDir]);
    if (clone.code !== 0) {
      failWithCleanup(`git clone failed (exit ${clone.code}) ${clone.out.slice(0, 400)} — temp dir cleaned`, plan.tempDir);
    }
    // Five-guarantee #4 — recovery marker (§4.3.5), written after the clone
    // (git clone refuses a non-empty target); a crash DURING the clone leaves
    // a markerless dir that the --recover sweep removes via its age fallback.
    writeFileSync(join(plan.tempDir, 'bootstrap-state.json'), JSON.stringify({
      pid: process.pid, url: plan.remote, sha: plan.sha, started_at: nowIso(),
    }, null, 2) + '\n', 'utf-8');
    const head = run(['git', '-C', plan.tempDir, 'rev-parse', 'HEAD']);
    const clonedSha = head.out.trim().split('\n')[0];
    if (head.code !== 0 || clonedSha !== plan.sha) {
      failWithCleanup(`SHA pin mismatch: approved ${plan.sha} but the clone resolved ${clonedSha || '<none>'} — the remote moved between approval and clone; re-approve the new SHA and retry (temp dir cleaned)`, plan.tempDir);
    }
    // Verify inside temp BEFORE any gate: identity files parse, it is a work tree.
    try {
      JSON.parse(readFileSync(join(plan.tempDir, 'variant.json'), 'utf-8'));
    } catch (e) {
      failWithCleanup(`clone verification failed: variant.json does not parse (${e instanceof Error ? e.message : String(e)}) — temp dir cleaned`, plan.tempDir);
    }
    const inside = run(['git', '-C', plan.tempDir, 'rev-parse', '--is-inside-work-tree']);
    if (inside.code !== 0 || !inside.out.includes('true')) {
      failWithCleanup('clone verification failed: not a git work tree — temp dir cleaned', plan.tempDir);
    }
    console.log(`   clone verified at ${clonedSha.slice(0, 12)}; variant.json parses; git work tree ok`);

    // Hooks stay INACTIVE until VALIDATED (§4.3.6): pre-VALIDATED the clone
    // sits in the temp dir — no hook is armed because the gate runs first and
    // the move happens only after every check passes.
    console.log(' VALIDATED gate: gitleaks → hook-integrity → bun audit → root audit.ts …');
    const gate = runValidatedGate(plan.tempDir);
    for (const r of gate.reasons) console.log(`   · ${r}`);
    if (!gate.ok) {
      failWithCleanup(`VALIDATED gate FAILED — temp dir cleaned, nothing moved:\n   ${gate.reasons.join('\n   ')}`, plan.tempDir);
    }

    // State file: init + BOOTSTRAPPED->VALIDATED->READY journal (§3.1), written
    // INSIDE the temp clone so the single atomic move carries state + journal.
    initStateFile(plan.tempDir, hub, { actor: 'user', remote: plan.remote, sha: plan.sha, at: nowIso() });
    const bootstrapEnums = loadRegistryEnums(ROOT, hub);
    const skipNote = gate.skippedExternal ? ' (external checks skipped via test seam — see reason)' : '';
    applyTransition(plan.tempDir, hub, {
      kind: 'bootstrap', to: 'BOOTSTRAPPED', actor: 'hub-bootstrap',
      reason: `cloned ${plan.remote} @ ${plan.sha} with user approval (--yes recorded in approval)${skipNote}`,
      at: nowIso(),
    }, { enums: bootstrapEnums });
    applyTransition(plan.tempDir, hub, {
      kind: 'bootstrap', to: 'VALIDATED', actor: 'hub-bootstrap',
      reason: gate.reasons.join('; '),
      at: nowIso(),
    }, { enums: bootstrapEnums });
    applyTransition(plan.tempDir, hub, {
      kind: 'bootstrap', to: 'READY', actor: 'hub-bootstrap',
      reason: 'infra verified end-to-end (READY says nothing about service capacity — the hub PM declares operational state at session start)',
      at: nowIso(),
    }, { enums: bootstrapEnums });

    // Same-volume check (§4.3.3) then the atomic move.
    const move = moveIntoPlace(plan.tempDir, plan.hubDir);
    if (!move.moved && move.concurrentClaim) {
      console.log(`✅ ${hub} was claimed concurrently while this bootstrap ran — our temp dir is cleaned, the winner's clone stands at ${plan.hubDir}.`);
      printStatus(hub);
      return;
    }
    console.log(`\n✅ ${hub} bootstrapped: BOOTSTRAPPED → VALIDATED → READY (journal hash-chained in ${stateFilePath(plan.hubDir, hub)}).`);
    console.log('   operational_state is intentionally null — the hub PM declares AVAILABLE/DEGRADED at session start (see the hub operator guide §Bootstrap & lifecycle).');
    printStatus(hub);
  } finally {
    releaseLock(lockName, { stateDir: join(ROOT, '.pipeline-state') });
  }
}

// ── Recovery sweep (§4.3.5) ──────────────────────────────────────────────────

interface StaleTemp {
  dir: string;
  cause: string;
}

/** Detect (not remove) stale bootstrap temp dirs under Projects/: a dead
 * recorded PID, an age > 24h, or no readable marker with dir age > 24h.
 * Detection is pure so BOTH consumers share one rule set: the manual --recover
 * sweep and the §4.3.5 boot-time sweep run by every --apply bootstrap. */
function sweepStaleTempDirs(nowMs: number = Date.now()): StaleTemp[] {
  let names: string[] = [];
  try {
    names = readdirSync(PROJECTS_DIR).filter(n => n.startsWith('.bootstrap-'));
  } catch { /* no Projects dir — nothing to sweep */ }
  const stale: StaleTemp[] = [];
  for (const name of names) {
    const dir = join(PROJECTS_DIR, name);
    const markerPath = join(dir, 'bootstrap-state.json');
    let cause: string | null = null;
    try {
      const marker = JSON.parse(readFileSync(markerPath, 'utf-8')) as { pid?: number; started_at?: string };
      const started = marker.started_at ? Date.parse(marker.started_at) : NaN;
      const ageOk = Number.isNaN(started) ? (Date.now() - statSync(dir).mtimeMs > SWEEP_MAX_AGE_MS) : (nowMs - started > SWEEP_MAX_AGE_MS);
      const pidDead = typeof marker.pid === 'number' ? !pidAlive(marker.pid) : true;
      if (pidDead) cause = `pid ${marker.pid ?? '?'} is dead`;
      else if (ageOk) cause = `age > 24h (started_at ${marker.started_at ?? '?'})`;
    } catch {
      // No/unreadable marker: fall back to directory age only.
      if (Date.now() - statSync(dir).mtimeMs > SWEEP_MAX_AGE_MS) cause = 'no readable bootstrap-state.json and dir age > 24h';
    }
    if (cause) stale.push({ dir, cause });
  }
  return stale;
}

function recover(apply: boolean): void {
  const nowMs = Date.parse(process.env.HUB_BOOTSTRAP_NOW ?? new Date().toISOString());
  const stale = sweepStaleTempDirs(nowMs);
  if (stale.length === 0) {
    console.log('✅ no stale bootstrap temp dirs under Projects/');
    return;
  }
  for (const s of stale) console.log(`${apply ? '🧹' : '[dry-run]'}  ${s.dir} — ${s.cause}`);
  if (!apply) {
    console.log(`\n${stale.length} stale temp dir(s). Re-run with --apply to remove.`);
    return;
  }
  let removed = 0;
  for (const s of stale) {
    // Best-effort per dir (v1.2.0): one locked dir must not abort the sweep.
    try {
      rmSync(s.dir, { recursive: true, force: true });
      removed++;
    } catch (e) {
      console.log(`⚠ could not remove ${s.dir} (${e instanceof Error ? e.message : e}) — left in place`);
    }
  }
  console.log(`\n✅ removed ${removed} of ${stale.length} stale bootstrap temp dir(s).`);
}

/** Dead-pid check mirroring automation-lock.ts pidAlive (EPERM = alive). */
function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// ── Operational declaration (hub PM duty; design §3.2/§3.3) ──────────────────

/** Design §3.5 — declared-vs-probed divergence "auto-forces DEGRADED on the
 * next declaration opportunity". Reads the hub's LATEST root-side probe report
 * (READ-ONLY — reports live in the root's docs/reports/); the force stands
 * while that report is DIVERGENT and newer than the hub's last journal entry
 * (i.e. no declaration has followed the probe yet — the next declaration IS
 * the forced opportunity). A MATCH probe supersedes and re-opens AVAILABLE.
 * Returns the forcing report file name, or null. */
function probeDivergenceForce(reportsDir: string, hub: string, lastJournalAt: string | null): string | null {
  let file: string | null = null;
  try {
    file = latestProbeReportFile(reportsDir, hub);
    if (!file) return null;
    const full = join(reportsDir, file);
    if (probeReportVerdict(readFileSync(full, 'utf-8')) !== 'DIVERGENT') return null;
    if (lastJournalAt !== null && Date.parse(lastJournalAt) >= statSync(full).mtimeMs) return null;
  } catch {
    return null; // unreadable/absent reports dir is not a declaration blocker
  }
  return file;
}

function declare(hub: string, to: string, flags: Record<string, string | boolean>): void {
  if (!(OPERATIONAL_STATES as readonly string[]).includes(to)) {
    fail(`declare targets an operational_state only (${OPERATIONAL_STATES.join('|')}) — bootstrap states are machine-declared by hub-bootstrap (design §3.1)`);
  }
  const actor = String(flags.actor ?? '');
  if (actor !== 'user' && actor !== 'hub-pm') {
    fail(`--actor must be user | hub-pm (operational declarations are the hub PM's duty; got: ${actor || '<missing>'})`);
  }
  const reason = String(flags.reason ?? '');
  if (!reason.trim()) fail('--reason is required — every transition is audited with its cause');
  const stateDir = flags['state-dir'] ? resolve(String(flags['state-dir'])) : join(PROJECTS_DIR, hub);
  let current: HubStateFile | null = null;
  try {
    current = readState(stateDir, hub);
  } catch (err) {
    if (err instanceof HubStateError) fail(`cannot declare on an unreadable state file: ${err.message}`);
    throw err;
  }
  // Divergence force (§3.5): a standing DIVERGENT probe report coerces the
  // next AVAILABLE declaration to DEGRADED. More-constrained declarations
  // (DEGRADED / UNAVAILABLE / RECOVERY) pass through untouched.
  const forcedBy = probeDivergenceForce(join(ROOT, 'docs', 'reports'), hub, current?.state_history.at(-1)?.timestamp ?? null);
  let target = to as (typeof OPERATIONAL_STATES)[number];
  let forcedNote = '';
  if (forcedBy !== null && target === 'AVAILABLE') {
    target = 'DEGRADED';
    forcedNote = ` [auto-forced to DEGRADED by probe divergence: ${forcedBy} — design §3.5; a MATCH probe re-opens AVAILABLE]`;
  }
  // §3.4 capability matrix: entering DEGRADED with no existing degraded set
  // names its reduced capability set (operator guide §5.3; the reuse path —
  // re-attesting an existing DEGRADED — and the machine-coerced force are exempt).
  if (target === 'DEGRADED' && flags.capabilities === undefined && forcedNote === ''
    && (current?.degraded_capabilities?.length ?? 0) === 0) {
    fail('--capabilities is required when declaring DEGRADED with no existing degraded set (design §3.4: a DEGRADED declaration names its reduced capability set)');
  }
  const enums = loadRegistryEnums(ROOT, hub);
  let capabilities: string[] | undefined;
  if (flags.capabilities !== undefined) {
    capabilities = String(flags.capabilities).split(',').map(s => s.trim()).filter(Boolean);
    for (const v of validateDegradedCapabilities(capabilities, enums)) fail(`refused: ${v}`);
  }
  const leaseHours = flags['lease-hours'] !== undefined ? Number(flags['lease-hours']) : undefined;
  if (leaseHours !== undefined && (!Number.isFinite(leaseHours) || leaseHours <= 0 || leaseHours > 24 * 7)) {
    fail(`--lease-hours must be a positive number (<= 168), got: ${flags['lease-hours']}`);
  }
  try {
    const state = applyTransition(stateDir, hub, {
      kind: 'operational',
      to: target,
      actor,
      reason: reason + forcedNote,
      leaseMs: leaseHours !== undefined ? leaseHours * 3_600_000 : undefined,
      degradedCapabilities: capabilities,
      replaceCapabilities: flags.capabilities !== undefined || target !== 'DEGRADED',
    }, { enums });
    console.log(`✅ ${hub}: operational_state=${state.operational_state}${state.degraded_capabilities.length ? ` (degraded: ${state.degraded_capabilities.join(', ')})` : ''}, lease until ${state.ttl_lease?.expires_at}${forcedNote}`);
  } catch (err) {
    if (err instanceof HubStateError) fail(err.message);
    throw err;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--') && key !== 'apply' && key !== 'yes' && key !== 'recover') { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(args[i]);
  }
  return { positional, flags };
}

const USAGE = `usage: bun scripts/hub-bootstrap.ts <hub-name> [--apply] [--yes]
       bun scripts/hub-bootstrap.ts status <hub-name>
       bun scripts/hub-bootstrap.ts declare <hub> <AVAILABLE|DEGRADED|UNAVAILABLE|RECOVERY> --actor <user|hub-pm> --reason "<text>" [--capabilities a,b] [--lease-hours N] [--state-dir <dir>]
       bun scripts/hub-bootstrap.ts --recover [--apply]`;

// Import-safe: the exported logic (moveIntoPlace) must not trigger the CLI.
if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--recover')) {
      recover(args.includes('--apply'));
    } else {
      const { positional, flags } = parseFlags(args);
      const [sub, second] = positional;
      if (sub === 'status') {
        if (!second) fail(USAGE);
        printStatus(second, flags['state-dir'] ? resolve(String(flags['state-dir'])) : undefined);
      } else if (sub === 'declare') {
        if (!second || !positional[2]) fail(USAGE);
        declare(second, positional[2], flags);
      } else if (sub && !sub.startsWith('--')) {
        bootstrap(sub, flags.apply === true, flags.yes === true);
      } else {
        console.log(USAGE);
        process.exit(sub ? 1 : 0);
      }
    }
  } catch (err) {
    if (err instanceof HubStateError) fail(err.message);
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}
