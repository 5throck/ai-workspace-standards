#!/usr/bin/env bun
// @version 1.3.0
// v1.3.0 (2026-11-03, CI determinism fix — deterministic clock seam): the probe
//          now consumes the documented HUB_BOOTSTRAP_NOW seam (same contract as
//          hub-bootstrap.ts nowIso()): when set, TTL-lease expiry is evaluated
//          at THAT instant instead of the real wall clock. Before, probeHub
//          called effectiveOperationalState(state) with the default Date.now(),
//          so the unit fixture's pinned lease (declared at NOW=12:00Z, expires
//          20:00Z) went stale the moment the machine's real clock passed
//          2026-11-02T20:00Z — CI (and any local run after that instant) read
//          the live fixture lease as EXPIRED and flipped 4 MATCH-expected tests
//          to DIVERGENT. The test harness already passed HUB_BOOTSTRAP_NOW for
//          exactly this purpose; the probe just never read it. Lease math
//          itself was already TZ-safe (absolute ms, Z-qualified ISO); the
//          report date stays the explicit-KST kstDate() derivation
//          (scripts/helpers/kst-time.ts) — no host-local time anywhere.
// v1.2.0 (2026-11-02, Phase 4 remediation follow-up — drill false-positive
//          classes): the hooks_integrity quick-check now compares through the
//          SHARED lib/hook-integrity.ts normalization (single derivation with
//          hub-bootstrap's VALIDATED gate) instead of a raw byte diff:
//          (a) the root-only _test-*.ts test fixtures are excluded from BOTH
//          sides — they are never delivered, so their root-only presence read
//          as divergence on every hub probe (the 2026-11-02 drill class); (b)
//          the sanctioned CONSTITUTION.md→context.md comment scrub
//          (§7.5 Non-Propagation) no longer reads as divergence — the L1
//          delivery source ships comment-scrubbed copies (the drill's
//          gateguard-fact-force.ts "one-comment diff"). Real divergence —
//          code, string literals, a missing or extra hook — still reports
//          MISMATCH exactly as before; the "match (N files)" count is over
//          the delivered files after the fixture exclusion. Left unfixed, §3.5
//          would have auto-forced every AVAILABLE declaration to DEGRADED on
//          these non-divergences.
// v1.1.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §3.5, Phase 3.5 audit completion): the report-format knowledge is
//          exported for single-derivation reuse — probeReportFiles /
//          latestProbeReportFile / probeReportVerdict are consumed by
//          hub-bootstrap.ts's declaration-side divergence force (§3.5); no
//          behavior change to the probe itself.
// v1.0.0 (2026-11-02, spec docs/designs/2026-11-01-hub-consolidation-design.md
//          §3.5, Phase 3.5/3-common): hub-probe — the ROOT-SIDE READ-ONLY probe
//          of hub lifecycle state. Reads each hub's local state file plus
//          observable signals (repo present, template-version.txt, hook-dir
//          integrity, ticket-store writability) and records observed vs
//          declared values into docs/reports/YYYY-MM-DD-hub-probe-<hub>.md with
//          a MATCH | DIVERGENT verdict and keep-latest-4 retention per hub.
// hub-probe.ts — the weekly cadence is run manually (or from the weekly health
// check); no cron is wired by design.
//
// Divergence rules (§3.5): (1) the hash chain no longer validates — history
// rewriting is forbidden; (2) a declared operational state stands on an
// EXPIRED TTL lease (stale declaration); (3) the observed head hash does not
// chain from the last probed head (the prior probe's head must still be
// PRESENT in the history — append-only proof; a missing head means the journal
// was rewritten between probes).
//
// The probe NEVER writes hub state and NEVER auto-files tickets: on DIVERGENT
// it prints the SEV ticket command for the operator / lifecycle-manager to
// file (design: "the root is read-only with respect to hub state").
//
// Usage:
//   bun scripts/hub-probe.ts --all          # every registry hub
//   bun scripts/hub-probe.ts co-develop …   # specific hubs
//
// Test seams: HUB_PROBE_ROOT=<dir> (falls back to HUB_BOOTSTRAP_ROOT) redirects
// the workspace root — Projects/, docs/workspace-schema.json, docs/reports/.
// HUB_BOOTSTRAP_NOW=<iso> pins the deterministic clock for TTL-lease evaluation
// (v1.3.0; same contract as hub-bootstrap.ts — unset/unparseable → Date.now()).
// @l2-propagate: false

import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync, accessSync, constants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fingerprintHookDir } from './lib/hook-integrity.ts';
import { loadHubTopology } from './helpers/hub-topology.ts';
import { effectiveOperationalState, readState, validateChain, type HubStateFile } from './helpers/hub-state.ts';
import { kstDate } from './helpers/kst-time.ts';

const ROOT = process.env.HUB_PROBE_ROOT
  ? resolve(process.env.HUB_PROBE_ROOT)
  : process.env.HUB_BOOTSTRAP_ROOT
    ? resolve(process.env.HUB_BOOTSTRAP_ROOT)
    : resolve(import.meta.dir, '..');
const PROJECTS_DIR = join(ROOT, 'Projects');
const REPORTS_DIR = join(ROOT, 'docs', 'reports');
const KEEP_LATEST = 4; // design §3.5: keep-latest-N retention per hub (N=4)

interface ProbeSignal {
  name: string;
  observed: string;
}

interface ProbeResult {
  hub: string;
  verdict: 'MATCH' | 'DIVERGENT' | 'NOT-BOOTSTRAPPED';
  divergences: string[];
  observed: ProbeSignal[];
  declared: string[];
  headHash: string | null;
  reportPath: string;
  priorHead: string | null;
}

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

/** The probe's clock for TTL-lease evaluation (v1.3.0): HUB_BOOTSTRAP_NOW=<iso>
 * pins it to a fixed instant (test/CI determinism — a fixture lease seeded
 * relative to NOW must be judged at NOW, not at the runner's wall clock);
 * unset or unparseable → real Date.now(). Absolute ms only — never a
 * host-local calendar parse. */
function probeNowMs(): number {
  const iso = process.env.HUB_BOOTSTRAP_NOW;
  if (!iso) return Date.now();
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Date.now() : ms;
}

/** The probe's hub roster for --all: hubs[] rows by name, plus every distinct
 * entries[].hub_variant. Sorted, de-duplicated. */
function registryHubs(): string[] {
  const loaded = loadHubTopology(ROOT);
  if (!loaded.ok) {
    if (loaded.error === 'absent-file' || loaded.error === 'absent-section') return [];
    fail(`hub_topology registry is malformed: ${loaded.error}`);
  }
  const t = loaded.topology;
  if (!t) return fail('hub_topology registry resolved empty — nothing to probe');
  const names = new Set<string>();
  for (const row of Array.isArray(t.hubs) ? t.hubs : []) {
    const name = row && typeof row === 'object' ? (row as Record<string, unknown>)['name'] : undefined;
    if (typeof name === 'string') names.add(name);
  }
  for (const row of Array.isArray(t.entries) ? t.entries : []) {
    const variant = row && typeof row === 'object' ? (row as Record<string, unknown>)['hub_variant'] : undefined;
    if (typeof variant === 'string') names.add(variant);
  }
  return [...names].sort();
}

function fingerprintDir(dir: string): Map<string, string> | null {
  if (!existsSync(dir)) return null;
  // v1.2.0: the shared normalization (lib/hook-integrity.ts, single derivation
  // with hub-bootstrap's VALIDATED gate) — _test-* fixtures excluded from both
  // sides, sanctioned CONSTITUTION.md→context.md comment scrub applied before
  // hashing. A raw byte diff here reported the drill's two false-positive
  // classes as divergence and would have §3.5-forced AVAILABLE→DEGRADED.
  return fingerprintHookDir(dir);
}

/** The hub's probe-report file names in a reports dir, oldest first (the
 * YYYY-MM-DD filename prefix sorts chronologically). Exported so the report
 * format knowledge (naming, verdict bullet, head_hash bullet) lives in exactly
 * one place — the script that writes the reports (single-derivation
 * discipline); hub-bootstrap.ts's declaration-side divergence force (§3.5)
 * reads reports through these parsers, never by restating the format. */
export function probeReportFiles(reportsDir: string, hub: string): string[] {
  if (!existsSync(reportsDir)) return [];
  return readdirSync(reportsDir)
    .filter(f => f.endsWith(`-hub-probe-${hub}.md`))
    .sort();
}

/** The hub's LATEST probe report file name, or null. */
export function latestProbeReportFile(reportsDir: string, hub: string): string | null {
  const files = probeReportFiles(reportsDir, hub);
  return files.length > 0 ? files[files.length - 1] : null;
}

/** Parse the rendered verdict bullet ("- **Verdict**: DIVERGENT"). Returns the
 * verdict token or null when the report carries no verdict line. */
export function probeReportVerdict(text: string): string | null {
  const m = /^\s*-\s*\*\*Verdict\*\*:\s*(\S+)/m.exec(text);
  return m ? m[1] : null;
}

/** The most recent prior probe report's head_hash for this hub (chained-probe
 * rule §3.5: the observed head must chain from the last probed head). Today's
 * report INCLUDES when it already exists — at read time it is the previous
 * RUN's output (this run writes its own report only after reading), so
 * same-day re-probes still anchor on the prior run's head. */
function priorProbeHead(hub: string): { file: string | null; head: string | null } {
  const latest = latestProbeReportFile(REPORTS_DIR, hub);
  if (!latest) return { file: null, head: null };
  const text = readFileSync(join(REPORTS_DIR, latest), 'utf-8');
  // The report renders the head as a markdown bullet: "- **head_hash**: <hex|null>".
  const m = /^\s*-\s*\*\*head_hash\*\*:\s*(\S+)/m.exec(text);
  return { file: latest, head: m ? m[1] : null };
}

function probeHub(hub: string): ProbeResult {
  const hubDir = join(PROJECTS_DIR, hub);
  const observed: ProbeSignal[] = [];
  const divergences: string[] = [];
  const declared: string[] = [];

  // Observable signal 1 — repo present + identity files.
  const repoPresent = existsSync(join(hubDir, '.git'));
  observed.push({ name: 'repo_present', observed: String(repoPresent) });
  if (!repoPresent) {
    return {
      hub,
      verdict: 'NOT-BOOTSTRAPPED',
      divergences: [],
      observed,
      declared: ['(no local clone — nothing declared to compare)'],
      headHash: null,
      reportPath: '',
      priorHead: null,
    };
  }
  const vjPath = join(hubDir, 'variant.json');
  let vjOk = false;
  try {
    JSON.parse(readFileSync(vjPath, 'utf-8'));
    vjOk = true;
  } catch { /* reported below */ }
  observed.push({ name: 'variant_json_parses', observed: String(vjOk) });
  observed.push({ name: 'template_version_txt', observed: existsSync(join(hubDir, 'template-version.txt')) ? 'present' : 'MISSING' });

  // Observable signal 2 — hooks dir integrity quick-check (byte compare vs canonical).
  const canonical = fingerprintDir(join(ROOT, 'scripts', 'hooks'));
  const delivered = fingerprintDir(join(hubDir, 'scripts', 'hooks'));
  if (canonical === null) {
    observed.push({ name: 'hooks_integrity', observed: 'canonical scripts/hooks/ absent — quick-check skipped' });
  } else if (delivered === null) {
    observed.push({ name: 'hooks_integrity', observed: 'hub carries no scripts/hooks/ — MISMATCH' });
    divergences.push('observable: hub scripts/hooks/ directory is absent but the canonical hooks exist');
  } else {
    let mismatches = 0;
    for (const [f, content] of canonical) if (delivered.get(f) !== content) mismatches++;
    for (const f of delivered.keys()) if (!canonical.has(f)) mismatches++;
    observed.push({ name: 'hooks_integrity', observed: mismatches === 0 ? `match (${delivered.size} files)` : `MISMATCH (${mismatches} file(s) differ)` });
    if (mismatches > 0) divergences.push(`observable: ${mismatches} hook file(s) differ from canonical scripts/hooks/`);
  }

  // Observable signal 3 — ticket store writability (access check, no write:
  // the probe is read-only with respect to hub state and content).
  const ticketsDir = join(hubDir, 'tickets');
  let writable = 'absent';
  if (existsSync(ticketsDir)) {
    try {
      accessSync(ticketsDir, constants.W_OK);
      writable = 'writable';
    } catch {
      writable = 'NOT writable';
      divergences.push('observable: hub tickets/ store is not writable by the root process');
    }
  }
  observed.push({ name: 'tickets_store', observed: writable });

  // Declared values — the hub's state file.
  let state: HubStateFile | null = null;
  try {
    state = readState(hubDir, hub);
  } catch (e) {
    divergences.push(`declared: state file UNREADABLE (${(e as Error).message})`);
    declared.push(`state file: UNREADABLE`);
    return finishProbe(hub, observed, declared, null, divergences);
  }
  if (!state) {
    declared.push('state file: absent (never bootstrapped through the Phase 3.5 flow)');
    // Absent state with a present repo: pre-Phase-3.5 clone — a fact, not a
    // divergence (the probe compares declared vs probed state; there is none).
    return finishProbe(hub, observed, declared, null, divergences);
  }
  const chain = validateChain(state);
  declared.push(`bootstrap_state: ${state.bootstrap_state ?? '<init never run>'}`);
  declared.push(`operational_state (declared): ${state.operational_state ?? 'null (not yet in service)'}`);
  if (state.operational_state === 'DEGRADED') declared.push(`degraded_capabilities: [${state.degraded_capabilities.join(', ')}]`);
  if (state.ttl_lease) declared.push(`ttl_lease: ${state.ttl_lease.declared_at} → ${state.ttl_lease.expires_at}`);
  declared.push(`head_hash: ${state.head_hash ?? 'null'}`);
  declared.push(`journal: ${state.state_history.length} entr(ies), chain ${chain.ok ? 'VALID' : 'BROKEN'}`);

  // Divergence rule 1 — hash chain (§3.5: history rewriting is forbidden).
  if (!chain.ok) {
    divergences.push(`declared: hash chain BROKEN at entry ${(chain as { at: number }).at}: ${(chain as { error: string }).error}`);
  }

  // Divergence rule 2 — stale declaration (§3.3/§3.5: beyond TTL reads UNAVAILABLE).
  // v1.3.0: evaluated at the pinned HUB_BOOTSTRAP_NOW instant when set — the
  // wall-clock default made verdicts depend on when the machine happened to run.
  const effective = effectiveOperationalState(state, probeNowMs());
  if (state.operational_state !== null && effective === 'UNAVAILABLE' && state.operational_state !== 'UNAVAILABLE') {
    divergences.push(`declared: operational_state ${state.operational_state} stands on an EXPIRED TTL lease (until ${state.ttl_lease?.expires_at ?? '?'}) — consumers read UNAVAILABLE until re-attest`);
  }

  // Divergence rule 3 — chained probes: the prior probe's head must still be
  // present in the history (append-only proof across probes).
  const prior = priorProbeHead(hub);
  if (prior.head && prior.head !== 'null') {
    const stillPresent = state.state_history.some(e => e.hash === prior.head);
    if (!stillPresent) {
      divergences.push(`declared: prior probe head ${prior.head.slice(0, 12)}… (${prior.file}) is NOT in the current history — the journal was rewritten between probes`);
    }
  }

  return finishProbe(hub, observed, declared, state.head_hash, divergences);
}

function finishProbe(hub: string, observed: ProbeSignal[], declared: string[], headHash: string | null, divergences: string[]): ProbeResult {
  const verdict: ProbeResult['verdict'] = divergences.length > 0 ? 'DIVERGENT' : 'MATCH';
  const prior = priorProbeHead(hub);
  const date = kstDate();
  const reportPath = join(REPORTS_DIR, `${date}-hub-probe-${hub}.md`);

  const lines: string[] = [];
  lines.push(`# Hub Probe — ${hub} (${date})`);
  lines.push('');
  lines.push('- **Probe**: root-side, READ-ONLY (design docs/designs/2026-11-01-hub-consolidation-design.md §3.5)');
  lines.push(`- **Verdict**: ${verdict}`);
  lines.push(`- **Hub dir**: Projects/${hub}`);
  lines.push(`- **head_hash**: ${headHash ?? 'null'}`);
  lines.push(`- **Prior probed head**: ${prior.head ?? 'none'}${prior.file ? ` (${prior.file})` : ''}`);
  lines.push('');
  lines.push('## Observed (root-side signals)');
  lines.push('');
  for (const s of observed) lines.push(`- ${s.name}: ${s.observed}`);
  lines.push('');
  lines.push('## Declared (hub state file)');
  lines.push('');
  for (const d of declared) lines.push(`- ${d}`);
  lines.push('');
  if (divergences.length > 0) {
    lines.push('## Divergences');
    lines.push('');
    for (const d of divergences) lines.push(`- ${d}`);
    lines.push('');
  }
  lines.push('## References');
  lines.push('');
  lines.push('- Design §3.5 (probe contract, keep-latest-4 retention, divergence → SEV ticket)');
  lines.push('- Runbook: docs/guides/hub-operator-guide.md §Bootstrap & lifecycle');
  lines.push('');

  const result: ProbeResult = { hub, verdict, divergences, observed, declared, headHash, reportPath, priorHead: prior.head };

  // Report + retention live in the ROOT's own docs/reports/ — the only thing
  // this script writes; hub state is never touched.
  if (!existsSync(REPORTS_DIR)) fail(`docs/reports/ missing at ${REPORTS_DIR} — the probe records its observations there`);
  writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  pruneReports(hub);
  return result;
}

/** keep-latest-N retention per hub (N=4), oldest-first prune. Today's freshly
 * written report always survives (it is the newest). */
function pruneReports(hub: string): number {
  if (!existsSync(REPORTS_DIR)) return 0;
  const reports = readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith(`-hub-probe-${hub}.md`))
    .sort(); // YYYY-MM-DD prefix sorts chronologically
  let pruned = 0;
  for (const f of reports.slice(0, Math.max(0, reports.length - KEEP_LATEST))) {
    rmSync(join(REPORTS_DIR, f));
    pruned++;
  }
  return pruned;
}

// ── CLI (import-safe: probeHub/pruneReports are exported for tests) ─────────

export { probeHub, pruneReports, registryHubs };

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const all = args.includes('--all');
    const hubs = all ? registryHubs() : args.filter(a => !a.startsWith('--'));
    if (hubs.length === 0) {
      console.log('usage: bun scripts/hub-probe.ts [--all | <hub>...]');
      process.exit(all ? 0 : 1);
    }
    let divergent = 0;
    for (const hub of hubs) {
      if (!/^co-[a-z0-9-]{1,40}$/.test(hub)) fail(`invalid hub name: ${hub}`);
      const r = probeHub(hub);
      const icon = r.verdict === 'MATCH' ? '✅' : r.verdict === 'DIVERGENT' ? '🚨' : 'ℹ️ ';
      console.log(`${icon} ${hub}: ${r.verdict} — report ${r.reportPath}`);
      for (const d of r.divergences) console.log(`     · ${d}`);
      if (r.verdict === 'DIVERGENT') {
        divergent++;
        // Design §3.5: divergence auto-forces DEGRADED on the next declaration
        // opportunity and files a SEV ticket. The probe is READ-ONLY: it prints
        // the command; the operator / lifecycle-manager files it.
        console.log(`\n     File the SEV ticket (SEV2 → P1 per hub-kanban-aliases.json — the probe does NOT auto-file):`);
        console.log(`     bun scripts/ticket.ts create --manual "SEV2: hub probe divergence — ${hub}" --priority-alias P1 --hub ${hub} --inputs '{"sev":"SEV2","probe":"${r.reportPath}"}'`);
        console.log('');
      }
    }
    if (divergent > 0) process.exit(2); // distinct code so the weekly check can branch on it
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}
