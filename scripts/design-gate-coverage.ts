#!/usr/bin/env bun
/**
 * design-gate-coverage.ts — windowed Design-Gate coverage check (T-20261028-001).
 * @version 1.1.0
 *
 * v1.1.0 (2026-11-06, T-20261106-006 item 4): subject-citation join — a
 *         template-touching commit that cites an EXISTING registered spec by
 *         name ("spec <name>", where <name> is a docs/specs/registry.json id,
 *         equivalently the docs/specs/entries/<name>.json filename) is covered
 *         at the commit level: it no longer lands in unattributedCommits and
 *         is reported under a new specCitedCommits section instead. This
 *         collapses the recurring D8 adjudication row where a closeout commit
 *         references its design by spec name instead of ticket ids (~10 rows/
 *         day over the 3 weeks since D8 shipped, T-20261106-006 item 3's
 *         "cite specs by name" class). Safety rails: an UNKNOWN spec name
 *         never passes (candidates resolve only against the registry's id
 *         set — the SSOT per design §10 Q4); the TICKET-level join is
 *         unchanged (a spec citation does not cover tickets — those rows
 *         still need their own registered-prose or E1–E5 adjudication).
 *
 * v1.0.0 (2026-10-28, T-20261028-001 — spec
 *         docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md
 *         D8): first release. Given a review window, lists commits touching the
 *         template/code surfaces, extracts ticket ids from commit subjects and
 *         bodies, merge-commit PR bodies, and changed ticket files, joins them
 *         against docs/specs/registry.json (registry-join semantics per the
 *         approved design's §10 Q4 default), and emits the uncovered set for the
 *         review to adjudicate E1–E5. Report-only: nothing auto-closes.
 *
 * WHAT IT CHECKS (design D8):
 *   1. Commits in the window whose diff touches the template-path set:
 *      templates/, scripts/, .agents/, docs/governance/, docs/standards/, and
 *      the root instruction surfaces (the five instruction files AGENTS.md /
 *      CLAUDE.md / GEMINI.md / CODEX.md / HERMES.md plus the root agents/
 *      instruction directory — the design's "six root instruction files").
 *   2. Ticket ids (T-/U- <yyyymmdd>-<nnn>) from commit subjects/bodies, merge
 *      commit bodies (PR titles), and changed tickets/ file paths. Commit
 *      identities are reported as canonical 8-char short SHAs (git's
 *      environment-dependent auto-abbrev normalized to the git-default human
 *      form so local runs and CI agree).
 *   3. Coverage join: a ticket is COVERED when any REGISTERED spec (a
 *      docs/specs/registry.json entry) names it anywhere in its design doc —
 *      prose mention counts (the registry is the SSOT; the design-doc mention
 *      is the search path). A design doc that is not registered does NOT count.
 *      A template-touching commit citing no ticket id at all is flagged
 *      unattributed — unless it cites an EXISTING registered spec by name
 *      ("spec <name>", v1.1.0 join: resolved against the registry id set only;
 *      unknown names never pass), in which case the commit row is spec-covered.
 *
 * WHAT IT DOES NOT DO:
 *   - It never mutates the tree (read-only: git log + docs/specs reads).
 *   - It never retro-registers specs, closes tickets, or grants exemptions —
 *     E1–E5 adjudication stays human (ADR-0074 gate semantics).
 *
 * Usage:
 *   bun scripts/design-gate-coverage.ts [--since <rev|date>] [--until <rev|date>]
 *                                       [--json] [--help]
 *
 *   --since <rev|date>  window start (git revision or ISO date). Default: the
 *                       window of the newest docs/reports/*project-review*daily*
 *                       report ("default = the review window"), falling back to
 *                       24 hours ago when no report window parses.
 *   --until <rev|date>  window end (default: HEAD).
 *   --json              print the machine-readable report instead of the table.
 *
 * Exit codes: 0 always (report-only — the uncovered set is the finding, not a
 * gate; consumers surface it, humans adjudicate it), 1 on usage/setup error.
 *
 * Design of record:
 *   docs/designs/2026-10-28-instruction-ownership-backport-hardening-design.md §3 D8, §10 Q4
 * Safety: report-only per ADR-0031 Principle 5.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const workspaceRoot = join(import.meta.dir, '..');
const REGISTRY_PATH = join(workspaceRoot, 'docs', 'specs', 'registry.json');
const REPORTS_DIR = join(workspaceRoot, 'docs', 'reports');

/** Template/code surfaces whose window commits must resolve to Design-Gate
 *  paperwork (design D8 path set). */
const TOUCH_PATH_PREFIXES = [
  'templates/',
  'scripts/',
  '.agents/',
  'docs/governance/',
  'docs/standards/',
  'agents/', // root agents/ instruction directory (agents/pm.md et al.)
];
const ROOT_INSTRUCTION_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'GEMINI.md',
  'CODEX.md',
  'HERMES.md',
]);

/** Ticket ids in commit messages, PR bodies, and tickets/ file paths. */
const TICKET_ID_RE = /\b([TU]-\d{8}-\d{2,3})\b/g;

/** Spec-name citation candidates in commit subjects/bodies (v1.1.0): the word
 *  "spec" (optionally colon-suffixed, case-insensitive) followed by a
 *  dash/alnum slug. Candidates resolve ONLY against the registered spec id
 *  set — an unknown name is discarded (never silently passes). */
const SPEC_CITE_RE = /\bspec:?\s+([a-z0-9][a-z0-9-]*[a-z0-9])/gi;

interface CommitRecord {
  sha: string;
  subject: string;
  body: string;
  paths: string[];
}

interface TicketCoverage {
  id: string;
  covered: boolean;
  /** Registered specs whose design doc names the ticket (the join path). */
  specs: Array<{ id: string; status: string; file: string }>;
}

interface CoverageReport {
  window: { since: string; until: string };
  scannedCommits: number;
  touchingCommits: number;
  commits: Array<{ sha: string; subject: string; tickets: string[]; touching: boolean; specs: string[] }>;
  tickets: TicketCoverage[];
  /** Ticket ids cited by template-touching commits with no registered-spec coverage. */
  uncovered: string[];
  /** Template-touching commits that cite no ticket id at all. */
  unattributedCommits: Array<{ sha: string; subject: string }>;
  /** v1.1.0: template-touching commits covered by a registered spec-name
   *  citation ("spec <name>") — previously unattributed adjudication rows. */
  specCitedCommits: Array<{ sha: string; subject: string; specs: string[] }>;
}

function usage(): never {
  console.error('Usage: bun scripts/design-gate-coverage.ts [--since <rev|date>] [--until <rev|date>] [--json]');
  process.exit(1);
}

function git(args: string[]): string {
  const proc = Bun.spawnSync(['git', ...args], { cwd: workspaceRoot, stdout: 'pipe', stderr: 'pipe' });
  if (proc.exitCode !== 0) {
    console.error(`git ${args.join(' ')} failed (exit ${proc.exitCode}): ${new TextDecoder().decode(proc.stderr).trim()}`);
    process.exit(1);
  }
  return new TextDecoder().decode(proc.stdout);
}

/** Parse the "Window:" line of the newest project-review daily report — the
 *  "default = the review window" rule. Returns '' when nothing parses. */
function defaultSinceFromReports(): string {
  if (!existsSync(REPORTS_DIR)) return '';
  const candidates = readdirSync(REPORTS_DIR)
    .filter((f) => f.includes('project-review') && f.endsWith('.md'))
    .sort();
  for (const name of candidates.reverse()) {
    const text = readFileSync(join(REPORTS_DIR, name), 'utf8');
    const m = text.match(/\*\*Window\*\*:\s*(\S+)\s*(?:→|->)\s*(\S+)/);
    if (m) return normalizeGitDate(m[1]);
  }
  return '';
}

/** git accepts +0900; normalize a report timestamp so --since parses. */
function normalizeGitDate(ts: string): string {
  return ts.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
}

export function extractTicketIds(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(TICKET_ID_RE)) out.add(m[1]);
  return [...out];
}

/** Resolve "spec <name>" citation candidates against the registered spec id
 *  set (pure; exported for tests). A candidate joins ONLY when it is exactly a
 *  registry id — the docs/specs/entries/<name>.json filename is the same id —
 *  so an unknown/typo'd name resolves to nothing and the commit stays
 *  uncovered (v1.1.0: no silent pass). Order-stable, deduplicated. */
export function resolveSpecCitations(text: string, specIds: Iterable<string>): string[] {
  const known = new Set(specIds);
  const out: string[] = [];
  for (const m of text.matchAll(SPEC_CITE_RE)) {
    const name = m[1].toLowerCase();
    if (known.has(name) && !out.includes(name)) out.push(name);
  }
  return out;
}

/** Commit-level attribution for one template-touching commit (pure; exported
 *  for tests; v1.1.0 wiring shared with buildReport so the CLI and the unit
 *  pin cannot diverge). A commit citing ticket ids joins through the
 *  ticket-level prose join as before — a spec citation never covers tickets.
 *  A commit citing NO ticket id and NO resolvable spec stays unattributed;
 *  one citing a resolvable spec is spec-covered (leaves unattributedCommits,
 *  reported under specCitedCommits). */
export function attributeTouchingCommit(
  subjectBody: string,
  pathTicketIds: Iterable<string>,
  specIds: Iterable<string>,
): { tickets: string[]; specCites: string[]; unattributed: boolean; specCovered: boolean } {
  const tickets = new Set<string>([...extractTicketIds(subjectBody), ...pathTicketIds]);
  const specCites = resolveSpecCitations(subjectBody, specIds);
  const noTickets = tickets.size === 0;
  return {
    tickets: [...tickets],
    specCites,
    unattributed: noTickets && specCites.length === 0,
    specCovered: noTickets && specCites.length > 0,
  };
}

/** Registry-join over the window's cited tickets (pure; exported for tests).
 *  A cited ticket is COVERED when any registered spec's design doc names it —
 *  prose mention counts (design §10 Q4: the registry is the SSOT, the
 *  design-doc mention is the search path); an unregistered design doc does
 *  not count. The join matches FULL ticket ids only: the slash shorthand a
 *  review report writes ("T-20261027-009/-010") covers the first id, never
 *  the truncated tail. */
export function joinCoverage(
  citedIds: Iterable<string>,
  specDocs: Map<string, { status: string; file: string; text: string }>,
): TicketCoverage[] {
  const coverageByTicket = new Map<string, TicketCoverage>();
  for (const id of citedIds) {
    coverageByTicket.set(id, { id, covered: false, specs: [] });
  }
  if (coverageByTicket.size > 0) {
    for (const [specId, doc] of specDocs) {
      for (const id of extractTicketIds(doc.text)) {
        const entry = coverageByTicket.get(id);
        if (entry && !entry.specs.some((s) => s.id === specId)) {
          entry.specs.push({ id: specId, status: doc.status, file: doc.file });
          entry.covered = true;
        }
      }
    }
  }
  return [...coverageByTicket.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Template/code surfaces whose window commits must resolve to Design-Gate
 *  paperwork (design D8 path set; exported pure for tests). */
export function touchesTemplateSurface(paths: string[]): boolean {
  for (const p of paths) {
    if (TOUCH_PATH_PREFIXES.some((pre) => p.startsWith(pre))) return true;
    if (ROOT_INSTRUCTION_FILES.has(p)) return true;
  }
  return false;
}

/** Read the spec registry (the coverage SSOT). Exits 1 on an unparseable
 *  registry — both joins depend on it. */
function loadRegistry(): Array<{ id: string; status: string; file: string }> {
  let registry: { specs?: Array<{ id: string; status: string; file: string }> };
  try {
    registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    console.error(`unreadable spec registry (${REGISTRY_PATH}): ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  return registry.specs ?? [];
}

/** Collect registered-spec design-doc text keyed by spec id (the coverage SSOT
 *  is the registry entry; the doc text is the mention search path). */
function loadRegisteredDocTexts(): Map<string, { status: string; file: string; text: string }> {
  const docs = new Map<string, { status: string; file: string; text: string }>();
  for (const spec of loadRegistry()) {
    if (!spec?.file) continue;
    const abs = join(workspaceRoot, spec.file);
    if (!existsSync(abs)) continue; // registered but file pruned — contributes nothing to the join
    let text = '';
    try {
      text = readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    docs.set(spec.id, { status: spec.status ?? 'unknown', file: spec.file, text });
  }
  return docs;
}

function buildReport(since: string, until: string): CoverageReport {
  // 1. Non-merge commits with changed paths (the merge commits carry no diff of
  //    their own; their PR-title bodies are scanned separately below). Format:
  //    \x1e starts a record, \x1f separates sha/subject/body, and the trailing
  //    \x1f marks where the --name-only path list begins.
  const log = git([
    'log',
    '--no-merges',
    `--since=${since}`,
    `--until=${until}`,
    '--name-only',
    '--format=%x1e%h%x1f%s%x1f%b%x1f',
  ]);
  const commits: CommitRecord[] = [];
  for (const block of log.split('\x1e')) {
    if (!block.trim()) continue;
    const lastSep = block.lastIndexOf('\x1f');
    if (lastSep < 0) continue;
    const headAndBody = block.slice(0, lastSep);
    const pathsPart = block.slice(lastSep + 1);
    const [sha, subject, ...bodyLines] = headAndBody.split('\x1f');
    if (!sha) continue;
    commits.push({
      // Canonical report SHA: 8-char short SHA (the git-default human form).
      // git's auto-abbrev length is repository-size dependent — CI printed 9
      // chars for the same commit a local run printed 8 for — so the report
      // normalizes to exactly 8 to stay comparable across environments.
      sha: sha.trim().slice(0, 8),
      subject: (subject ?? '').trim(),
      body: bodyLines.join('\x1f').trim(),
      paths: pathsPart.split('\n').map((s) => s.trim()).filter(Boolean),
    });
  }
  // 2. Merge-commit bodies (PR titles ride the merge body in this repo's history).
  const merges = git(['log', '--merges', `--since=${since}`, `--until=${until}`, '--format=%B']);
  const mergeTickets = new Set<string>(extractTicketIds(merges));

  // 3′. Registered spec docs (coverage SSOT = the registry; the docs are the
  //     mention search path). Read once; the join below is scoped to the
  //     window's cited tickets. The registry's id set also drives the v1.1.0
  //     spec-name citation join (a subject "spec <name>" resolves only against
  //     these ids).
  const specDocs = loadRegisteredDocTexts();
  const specIds = loadRegistry().map((s) => s.id.toLowerCase());

  // 3. Window attribution first: the ticket ids this window's template-touching
  //    commits and merge-commit PR bodies actually cite. Only THESE join against
  //    the registry — the check reports the window's coverage, not the spec
  //    corpus's whole ticket history.
  const report: CoverageReport = {
    window: { since, until },
    scannedCommits: commits.length,
    touchingCommits: 0,
    commits: [],
    tickets: [],
    uncovered: [],
    unattributedCommits: [],
    specCitedCommits: [],
  };
  const citedTickets = new Set<string>(mergeTickets);
  for (const c of commits) {
    const touching = touchesTemplateSurface(c.paths);
    const attributed = attributeTouchingCommit(
      `${c.subject}\n${c.body}`,
      c.paths.filter((p) => p.startsWith('tickets/')).flatMap((p) => extractTicketIds(p)),
      specIds,
    );
    report.commits.push({ sha: c.sha, subject: c.subject, tickets: attributed.tickets, touching, specs: attributed.specCites });
    if (!touching) continue;
    report.touchingCommits++;
    if (attributed.specCovered) {
      report.specCitedCommits.push({ sha: c.sha, subject: c.subject, specs: attributed.specCites });
      continue;
    }
    if (attributed.unattributed) {
      report.unattributedCommits.push({ sha: c.sha, subject: c.subject });
      continue;
    }
    for (const id of attributed.tickets) citedTickets.add(id);
  }

  // 4. Registry-join (design §10 Q4 default) over the window's cited tickets.
  report.tickets = joinCoverage(citedTickets, specDocs);
  report.uncovered = report.tickets.filter((t) => !t.covered).map((t) => t.id);
  return report;
}

function printReport(r: CoverageReport): void {
  console.log(`Design-Gate coverage — window ${r.window.since} → ${r.window.until}`);
  console.log(`commits scanned: ${r.scannedCommits} (non-merge), template-touching: ${r.touchingCommits}`);
  console.log('');
  if (r.tickets.length > 0) {
    console.log('Ticket coverage (registry-join over docs/specs/registry.json — registered design doc names the ticket):');
    for (const t of r.tickets) {
      if (t.covered) {
        const specs = t.specs.map((s) => `${s.id} [${s.status}]`).join(', ');
        console.log(`  ✅ ${t.id}  covered-by-spec: ${specs}`);
      } else {
        console.log(`  ❌ ${t.id}  UNCOVERED — no registered spec names this ticket (exemption candidate E1–E5 for the review to adjudicate)`);
      }
    }
    console.log('');
  }
  if (r.specCitedCommits.length > 0) {
    console.log('Template-touching commits covered by a registered spec-name citation (v1.1.0 join):');
    for (const c of r.specCitedCommits) console.log(`  ✅ ${c.sha}  ${c.subject}  spec: ${c.specs.join(', ')}`);
    console.log('');
  }
  if (r.unattributedCommits.length > 0) {
    console.log('Template-touching commits citing no ticket id (and no registered spec name):');
    for (const c of r.unattributedCommits) console.log(`  ❌ ${c.sha}  ${c.subject}`);
    console.log('');
  }
  const uncoveredCount = r.uncovered.length + r.unattributedCommits.length;
  if (uncoveredCount === 0) {
    console.log('Result: fully covered — every template-touching commit resolves to a registered spec.');
  } else {
    console.log(`Result: ${uncoveredCount} uncovered row(s) — for review adjudication (E1–E5); nothing auto-closes (design D8).`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();
  const json = args.includes('--json');
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const sinceArg = get('--since');
  const untilArg = get('--until');
  if (args.includes('--since') && !sinceArg) usage();
  let since = sinceArg ?? '';
  if (!since) {
    // "default = the review window" (design D8): the newest project-review
    // daily report's declared window; last 24 hours when nothing parses.
    since = defaultSinceFromReports();
  }
  if (!since) {
    since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    console.error(`no --since given and no review-report window parsed — defaulting to ${since}`);
  }
  const until = untilArg ?? 'HEAD';
  const report = buildReport(since, until);
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  // Report-only by design (D8: "nothing auto-closes") — exit 0 even with an
  // uncovered set; consumers (review-baseline battery) surface the WARN.
  process.exit(0);
}

if (import.meta.main) main();
