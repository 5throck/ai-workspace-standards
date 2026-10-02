#!/usr/bin/env bun
// @version 1.7.0
// v1.7.0 (2026-10-02, T-20261002-004/-008): upstream_request_status audit-logs every
//           call (outcome: status, identity cwd|declared) and REDACTS resolution
//           content (summary/pr_url) when identity was self-declared project_root —
//           a declared caller learns ids + status/triage only (review H3; design §6
//           addendum). serverInfo.version now derives from the single SERVER_VERSION
//           constant pinned to the @version header (review M1).
// v1.6.0 (2026-10-02, T-20261002-005): the merge path's ticket read-modify-write runs
//           under the SHARED ticket lock from helpers/ticket-store.ts (nested inside
//           the intake lock), so it can no longer silently overwrite a concurrent PM
//           triage/resolve write (review H4 lost-update class).
// v1.5.0 (2026-10-01, T-20261001-017): intake critical section (cap read -> audit append)
//           runs under a mkdir lock with stale-takeover and fail-open deadline (parallel server
//           instances can no longer double-spend the caps); daily audit logs prune after 90
//           days at startup (retention decision, design Q6 — known-projects.json survives);
//           UPSTREAM_LOCK_TIMEOUT_MS is a test seam.
// v1.4.0 (2026-10-01, self-declared identity fallback): GUI clients (Claude Desktop App)
//          spawn this server with cwd=/ and no project env, so cwd-based identity cannot
//          work there (diagnosed 2026-10-01: audit cwd_hash matched "/" exactly). Both
//          tools now accept an optional project_root parameter used only when
//          resolveProject(cwd) fails; it goes through the identical filesystem checks,
//          and a ticket filed this way is forced flagged=true with triage_reasons
//          "identity:self_declared" so PM sees that identity was not client-attested.
//          Audit lines carry identity: "cwd" | "declared". REGISTRATION_RULE and the
//          server instructions name the fallback.
// v1.2.0 (2026-10-01, security review): identity no longer spawns git (core.worktree spoof); pure
//          filesystem walk, .git must be a real directory, nested repos rejected. Heuristics and dedupe
//          run on an NFKC-folded copy. Governance-path heuristic case-insensitive. Status id accepts a
//          3-4 digit sequence. Cross-project merge returns a generic acknowledgement.
// v1.1.0 (2026-10-01, hardening against spec docs/designs/2026-10-01-upstream-request-mcp-design.md):
//          sanitize() now uses Unicode-property filtering on code points (tag chars
//          U+E0000-E007F were never removed by the old UTF-16 code-unit filter) and runs
//          on every string field BEFORE length/pattern validation and injection
//          heuristics; UPSTREAM_WORKSPACE_ROOT test-only env seam; propagation-map
//          template-managed check (§7.3); dedupe merge now persists the duplicate and only
//          matches open tickets; merges count toward the hard cap; audit log carries the
//          §9 L4 fields; strict env cap parsing; first-seen state fail-safe; heuristics
//          corrected (merge/URL/role-spoof families); status input validation and
//          not-found semantics; internal errors answer with -32603 instead of silence.
// v1.0.0 (2026-10-01): Stdio MCP server (newline-delimited JSON-RPC 2.0, zero dependencies)
//          exposing two tools: upstream_request_create and upstream_request_status.

import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync,
  renameSync, appendFileSync, linkSync, unlinkSync, statSync, lstatSync, rmSync,
} from 'node:fs';
import { join, dirname, resolve, basename, isAbsolute, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { load, dump, JSON_SCHEMA } from 'js-yaml';
import { withTicketLock } from './helpers/ticket-store.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** T-20261002-008 (M1): single version constant — the @version header above and
 * serverInfo.version must stay identical; a unit test pins the two literals. */
export const SERVER_VERSION = '1.7.0';

// TEST-ONLY SEAM: UPSTREAM_WORKSPACE_ROOT overrides the workspace root that is otherwise
// derived from this script's path. It exists so tests can run the real server against a
// temp fake workspace (design §13). Read once at start; must be an absolute path.
// WORKSPACE_ROOT, PROJECTS_DIR, TICKETS_DIR, LOGS_DIR, templates/ and
// scripts/propagation-map.json all derive from it. Production client configs never set it.
function resolveWorkspaceRoot(): string {
  const override = process.env.UPSTREAM_WORKSPACE_ROOT;
  if (override !== undefined && override !== '') {
    if (isAbsolute(override)) return resolve(override);
    console.error('[mcp-upstream-server] UPSTREAM_WORKSPACE_ROOT must be an absolute path; ignoring');
  }
  return resolve(SCRIPT_DIR, '..');
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const FALLBACK_PROTOCOL_VERSION = '2024-11-05';

const REQUESTER_NAME_RE = /^co-[a-z0-9-]{1,40}$/;
// Identity marker is platform-independent: the canonical location is the project root,
// with the pre-2026-10-01 `.claude/template-version.txt` kept as a legacy fallback so
// projects scaffolded before the move keep filing without a migration (fixed order,
// first hit wins).
const IDENTITY_PATHS = ['template-version.txt', join('.claude', 'template-version.txt')] as const;
const REGISTRATION_RULE = `unregistered working directory: requester must be a direct child of Projects/ matching ^co-[a-z0-9-]{1,40}$ with template-version.txt at the project root (legacy .claude/template-version.txt accepted) (only co-* projects may file in v1)`;
const PROJECTS_DIR = resolve(WORKSPACE_ROOT, 'Projects');
const TEMPLATES_DIR = resolve(WORKSPACE_ROOT, 'templates');
const PROPAGATION_MAP = resolve(WORKSPACE_ROOT, 'scripts', 'propagation-map.json');

function readCap(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (/^\d{1,6}$/.test(raw.trim()) && parseInt(raw, 10) > 0) return parseInt(raw, 10);
  console.error(`[mcp-upstream-server] invalid ${name}=${JSON.stringify(raw)}; using default ${fallback}`);
  return fallback;
}

const UPSTREAM_SOFT_CAP = readCap('UPSTREAM_SOFT_CAP', 10);
const UPSTREAM_HARD_CAP = readCap('UPSTREAM_HARD_CAP', 30);
const UPSTREAM_GLOBAL_READY_CAP = readCap('UPSTREAM_GLOBAL_READY_CAP', 40);

const TICKETS_DIR = join(WORKSPACE_ROOT, 'tickets', 'governance');
const LOGS_DIR = join(WORKSPACE_ROOT, 'logs', 'upstream-intake');
const KNOWN_PROJECTS_FILE = join(LOGS_DIR, 'known-projects.json');

const PATH_RE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-/]+$/;
const MAX_TOTAL_BYTES = 16 * 1024;

// Design §9 L1: sanitization. Removes format (Cf: zero-width, bidi, BOM, tag characters
// U+E0000-E007F), control (Cc), private-use (Co), surrogate (Cs) and unassigned (Cn) code
// points, plus soft hyphen and Arabic letter mark. "\n" and "\t" are kept. The 'u' flag makes
// the regex operate on code points, so astral characters are matched as one unit.
const STRIP_RE = /[\p{Cf}\p{Cc}\p{Co}\p{Cs}\p{Cn}\u00AD\u061C]/gu;

// Heuristic families (§9 L1). Matching flags the request for human review; it never rejects.
// `scope: 'diff'` patterns apply only to local_workaround_diff; `outsideDiff` only to prose.
const HEURISTICS: Array<{ pattern: RegExp; scope?: 'diff' | 'prose' }> = [
  // instruction override
  { pattern: /\bignore\s+(?:all|any|previous|prior|above|the)\b[\w\s,]{0,40}\b(?:instructions?|rules?)\b/i },
  { pattern: /\bdisregard\b/i },
  { pattern: /\bnew\s+instructions\b/i },
  { pattern: /\byou\s+are\s+now\b/i },
  // role spoof
  { pattern: /^\s*(?:system|assistant|developer)\s*:/im },
  { pattern: /<\/?\s*(?:system|instructions|untrusted-upstream-request)\b/i },
  { pattern: /\[\/?INST\]/i },
  { pattern: /<\|im_(?:start|end)\|>/i },
  // tool-call lure
  { pattern: /\bcall\s+(?:the\s+)?\w+\s+tool\b/i },
  { pattern: /\brun\s+(?:bun|bash|sh|git|curl|npm)\b/i },
  { pattern: /--no-verify\b/i },
  { pattern: /SYNC_ACTIVE/i },
  { pattern: /\bgit\s+push\b/i },
  { pattern: /\bmerge\s+(?:this|the)\s+PR\b/i },
  { pattern: /\bgh\s+pr\s+merge\b/i },
  // exfil / urgency
  { pattern: /https?:\/\//i, scope: 'prose' },
  { pattern: /\b(?:curl|wget)\b/i },
  { pattern: /\bbase64\b/i },
  { pattern: /\b(?:urgent|immediately|pre-?authori[sz]ed)\b/i },
  // governance-control paths touched by a diff
  { pattern: /\.githooks\/|\.claude\/settings\.json|scripts\/hooks\/|CONSTITUTION\.md|agents\/pm\.md/i, scope: 'diff' },
];

function sanitize(s: string): string {
  return s.normalize('NFC').replace(STRIP_RE, (ch) => (ch === '\n' || ch === '\t' ? ch : ''));
}

/** NFKC-folded copy (fullwidth/compatibility forms) for matching only; storage stays NFC. */
function fold(s: string): string {
  return s.normalize('NFKC').replace(STRIP_RE, (ch) => (ch === '\n' || ch === '\t' ? ch : ''));
}

function checkInjection(raw: { symptom: string; repro?: string; diff?: string }): boolean {
  const fields = { symptom: fold(raw.symptom), repro: raw.repro === undefined ? undefined : fold(raw.repro), diff: raw.diff === undefined ? undefined : fold(raw.diff) };
  const prose = [fields.symptom, fields.repro ?? ''];
  const diff = fields.diff ?? '';
  return HEURISTICS.some((h) => {
    if (h.scope === 'diff') return h.pattern.test(diff);
    if (h.scope === 'prose') return prose.some((t) => h.pattern.test(t));
    return prose.some((t) => h.pattern.test(t)) || h.pattern.test(diff);
  });
}

interface UpstreamRequest {
  suspected_layer: 'L1' | 'L2' | 'unsure';
  symptom: string;
  affected_paths: string[];
  local_workaround_diff?: string;
  repro?: string;
  project_root?: string;
}

type KnownProjects = Map<string, { first_seen: string; first_id: string }>;

function loadKnownProjects(): KnownProjects {
  if (!existsSync(KNOWN_PROJECTS_FILE)) return new Map();
  try {
    const data = JSON.parse(readFileSync(KNOWN_PROJECTS_FILE, 'utf-8'));
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return new Map();
    return new Map(Object.entries(data));
  } catch {
    return new Map();
  }
}

function saveKnownProjects(m: KnownProjects): void {
  mkdirSync(dirname(KNOWN_PROJECTS_FILE), { recursive: true });
  const tmpPath = `${KNOWN_PROJECTS_FILE}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(Object.fromEntries(m)), 'utf-8');
  renameSync(tmpPath, KNOWN_PROJECTS_FILE);
}

interface ProjectIdentity { name: string; path: string; variant: string; version: string | null }

function resolveProject(cwd: string): ProjectIdentity | string {
  try {
    // Identity is derived from the filesystem only. git is never consulted: `git rev-parse` honors
    // the repo's own core.worktree, which the project agent controls.
    const realCwd = realpathSync(cwd);
    const realProjectsDir = realpathSync(PROJECTS_DIR);
    if (!realCwd.startsWith(realProjectsDir + sep)) return REGISTRATION_RULE;

    // Walk up from cwd to the direct child of Projects/. Any .git on the way (cwd inclusive,
    // project root exclusive) is a nested repo or worktree: reject.
    let dir = realCwd;
    while (dirname(dir) !== realProjectsDir) {
      if (existsSync(join(dir, '.git'))) return REGISTRATION_RULE;
      const parent = dirname(dir);
      if (parent === dir) return REGISTRATION_RULE;
      dir = parent;
    }
    const root = dir;
    const name = basename(root);
    if (!REQUESTER_NAME_RE.test(name)) return REGISTRATION_RULE;
    // .git must be a real directory (a .git file means worktree/submodule).
    const g = lstatSync(join(root, '.git'));
    if (!g.isDirectory()) return REGISTRATION_RULE;

    let text: string | null = null;
    for (const rel of IDENTITY_PATHS) {
      const tvFile = join(root, rel);
      if (existsSync(tvFile)) {
        text = readFileSync(tvFile, 'utf-8');
        break;
      }
    }
    if (text === null) return REGISTRATION_RULE;
    const vm = /^variant=([a-z0-9-]+)\s*$/m.exec(text);
    if (!vm) return REGISTRATION_RULE;
    const verm = /^version=(\S+)\s*$/m.exec(text);
    return { name, path: root, variant: vm[1], version: verm ? verm[1] : null };
  } catch {
    return REGISTRATION_RULE;
  }
}

/** True when `candidate` is a regular file strictly inside `base` (symlinks resolved). */
function isFileInside(base: string, candidate: string): boolean {
  try {
    const realBase = realpathSync(base);
    const real = realpathSync(candidate);
    if (!real.startsWith(realBase + sep)) return false;
    return statSync(real).isFile();
  } catch {
    return false;
  }
}

function globToRegex(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*' && glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; }
    else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

interface PropagationDomain {
  source?: string; target?: string; include_pattern?: string; recursive?: boolean;
  exclude?: unknown; disabled?: boolean;
}

/** §7.3: returns the L0 source path when `path` falls under a propagation-map target. */
function propagationOrigin(path: string): string | null {
  let map: { domains?: Record<string, PropagationDomain> };
  try { map = JSON.parse(readFileSync(PROPAGATION_MAP, 'utf-8')); } catch { return null; }
  const commonPrefix = 'templates/common/';
  for (const dom of Object.values(map.domains ?? {})) {
    if (!dom || dom.disabled || typeof dom.source !== 'string' || typeof dom.target !== 'string' || typeof dom.include_pattern !== 'string') continue;
    if (!dom.target.startsWith(commonPrefix)) continue;
    const targetRel = dom.target.slice(commonPrefix.length);
    if (!path.startsWith(targetRel + '/')) continue;
    const rest = path.slice(targetRel.length + 1);
    if (!dom.recursive && rest.includes('/')) continue;
    if (!globToRegex(dom.include_pattern).test(rest)) continue;
    const excludes = Array.isArray(dom.exclude) ? dom.exclude.filter((e): e is string => typeof e === 'string') : [];
    if (excludes.includes(rest) || excludes.includes(rest.split('/')[0])) continue;
    return `${dom.source}/${rest}`;
  }
  return null;
}

/** §7 checks in order: L2 template file, L1 template file, L0->L1 propagation target. */
function templateManagement(path: string, variant: string): { managed: boolean; l0Origin: string | null } {
  if (existsSync(join(TEMPLATES_DIR, variant)) && isFileInside(join(TEMPLATES_DIR, variant), resolve(TEMPLATES_DIR, variant, path))) return { managed: true, l0Origin: null };
  if (isFileInside(join(TEMPLATES_DIR, 'common'), resolve(TEMPLATES_DIR, 'common', path))) return { managed: true, l0Origin: null };
  const origin = propagationOrigin(path);
  return origin ? { managed: true, l0Origin: origin } : { managed: false, l0Origin: null };
}

function deliveredFiles(projectPath: string): Set<string> {
  try {
    const d = JSON.parse(readFileSync(join(projectPath, '.claude', 'last-upgrade-delivery.json'), 'utf-8'));
    return new Set(Array.isArray(d.files) ? d.files.filter((f: unknown): f is string => typeof f === 'string') : []);
  } catch {
    return new Set();
  }
}

function dedupeKey(paths: string[], symptom: string): string {
  const sorted = [...new Set(paths)].sort().join('\n');
  const normalized = fold(symptom).toLowerCase().replace(/\s+/g, ' ')
    .replace(/\b[0-9a-f]{7,}\b/g, '').replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(`${sorted}\n${normalized}`, 'utf-8').digest('hex');
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayPrefix(): string {
  return `U-${todayStr().replace(/-/g, '')}`;
}

function nextSeqForToday(): number {
  if (!existsSync(TICKETS_DIR)) return 1;
  const prefix = todayPrefix();
  let max = 0;
  for (const f of readdirSync(TICKETS_DIR)) {
    if (!f.startsWith(prefix)) continue;
    const m = /^U-\d{8}-(\d+)\.yaml$/.exec(f);
    const n = m ? parseInt(m[1], 10) : NaN;
    if (!isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

function appendAuditLog(entry: Record<string, unknown>): void {
  mkdirSync(LOGS_DIR, { recursive: true });
  appendFileSync(join(LOGS_DIR, `${todayStr()}.jsonl`), JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n', 'utf-8');
}

function readTodayAudit(): Array<{ project?: string; outcome?: string; triage?: string }> {
  const todayLog = join(LOGS_DIR, `${todayStr()}.jsonl`);
  if (!existsSync(todayLog)) return [];
  const out: Array<{ project?: string; outcome?: string; triage?: string }> = [];
  for (const line of readFileSync(todayLog, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip torn line */ }
  }
  return out;
}

/** T-20261001-017 — intake lock. The daily-cap counters, the known-projects first-seen
 * state and the audit append are read-then-write, so two parallel server instances could
 * double-spend the caps or double-record the first-seen gate. A mkdir-based lock is atomic
 * on every filesystem; a crashed server's stale lock is taken over after 30s, and a deadline
 * of UPSTREAM_LOCK_TIMEOUT_MS (default 5s, 0 disables waiting) falls OPEN to the previous
 * single-instance behavior rather than refusing service. */
const INTAKE_LOCK_DIR = join(LOGS_DIR, '.intake-lock');
const INTAKE_LOCK_STALE_MS = 30_000;

function intakeLockTimeoutMs(): number {
  // NOT readCap: the caps must stay positive, but a 0 lock deadline is the
  // documented fail-open switch (tests / operators who prefer availability).
  const raw = process.env.UPSTREAM_LOCK_TIMEOUT_MS;
  if (raw === undefined || raw === '') return 5000;
  if (/^\d{1,6}$/.test(raw.trim())) return parseInt(raw, 10);
  console.error(`[mcp-upstream-server] invalid UPSTREAM_LOCK_TIMEOUT_MS=${JSON.stringify(raw)}; using default 5000`);
  return 5000;
}

function withIntakeLock<T>(fn: () => T): T {
  mkdirSync(LOGS_DIR, { recursive: true });
  const deadline = Date.now() + intakeLockTimeoutMs();
  for (;;) {
    try {
      mkdirSync(INTAKE_LOCK_DIR);
      break;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      try {
        if (Date.now() - statSync(INTAKE_LOCK_DIR).mtimeMs > INTAKE_LOCK_STALE_MS) {
          rmSync(INTAKE_LOCK_DIR, { recursive: true, force: true });
        }
      } catch { /* racer removed it first — loop and retry */ }
      if (Date.now() >= deadline) {
        // Fail-open: proceed unlocked (single-instance behavior). The window this
        // leaves open is the pre-lock race the design accepted for v1.4.0.
        return fn();
      }
      Bun.sleepSync(25);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(INTAKE_LOCK_DIR, { recursive: true, force: true });
  }
}

/** T-20261001-017 — audit-log retention (design Q6 decision): daily `.jsonl` audit
 * files are pruned after 90 days at server startup; `known-projects.json` (first-seen
 * state) and the lock dir are never touched. Non-fatal by design. */
const LOG_RETENTION_DAYS = 90;

function pruneOldLogs(now = Date.now()): number {
  let pruned = 0;
  try {
    if (!existsSync(LOGS_DIR)) return 0;
    for (const f of readdirSync(LOGS_DIR)) {
      const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(f);
      if (!m) continue;
      const ageDays = (now - Date.parse(`${m[1]}T00:00:00Z`)) / 86_400_000;
      if (ageDays > LOG_RETENTION_DAYS) {
        unlinkSync(join(LOGS_DIR, f));
        pruned++;
      }
    }
  } catch { /* retention is best-effort — never block intake */ }
  return pruned;
}

const ALLOWED_KEYS = new Set(['suspected_layer', 'symptom', 'affected_paths', 'local_workaround_diff', 'repro', 'project_root']);

type Validation = { valid: false; error: string } | { valid: true; req: UpstreamRequest };

/** Shape check, then sanitization of EVERY string field, then length/pattern/cap checks
 * against the sanitized text (so hidden characters cannot pad or evade a limit). */
function validateUpstreamRequest(params: unknown): Validation {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) return { valid: false, error: 'invalid params: arguments must be an object' };
  const p = params as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!ALLOWED_KEYS.has(key)) return { valid: false, error: `invalid params: extra key "${key}"` };
  }

  if (p.suspected_layer !== 'L1' && p.suspected_layer !== 'L2' && p.suspected_layer !== 'unsure') return { valid: false, error: 'invalid params: suspected_layer' };
  if (typeof p.symptom !== 'string') return { valid: false, error: 'invalid params: symptom' };
  if (!Array.isArray(p.affected_paths) || p.affected_paths.some((x) => typeof x !== 'string')) return { valid: false, error: 'invalid params: affected_paths' };
  if (p.local_workaround_diff !== undefined && typeof p.local_workaround_diff !== 'string') return { valid: false, error: 'invalid params: local_workaround_diff' };
  if (p.repro !== undefined && typeof p.repro !== 'string') return { valid: false, error: 'invalid params: repro' };

  const symptom = sanitize(p.symptom);
  const paths = (p.affected_paths as string[]).map(sanitize);
  const diff = p.local_workaround_diff === undefined ? undefined : sanitize(p.local_workaround_diff as string);
  const repro = p.repro === undefined ? undefined : sanitize(p.repro as string);
  const projectRoot = p.project_root === undefined ? undefined : sanitize(p.project_root as string);

  if (symptom.length < 20 || symptom.length > 2000) return { valid: false, error: 'invalid params: symptom' };
  if (paths.length < 1 || paths.length > 10) return { valid: false, error: 'invalid params: affected_paths' };
  for (const path of paths) {
    if (path.length > 200 || !PATH_RE.test(path)) return { valid: false, error: 'invalid params: affected_paths' };
  }
  if (diff !== undefined && diff.length > 8000) return { valid: false, error: 'invalid params: local_workaround_diff' };
  if (repro !== undefined && repro.length > 2000) return { valid: false, error: 'invalid params: repro' };
  if (projectRoot !== undefined && (projectRoot.length === 0 || projectRoot.length > 200)) return { valid: false, error: 'invalid params: project_root' };

  const totalBytes = Buffer.byteLength(symptom + paths.join('') + (diff ?? '') + (repro ?? '') + (projectRoot ?? ''), 'utf-8');
  if (totalBytes > MAX_TOTAL_BYTES) return { valid: false, error: 'invalid params: total request exceeds 16 KB' };

  return { valid: true, req: { suspected_layer: p.suspected_layer, symptom, affected_paths: paths, local_workaround_diff: diff, repro, project_root: projectRoot } };
}

function writeYamlAtomic(path: string, obj: unknown): void {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, dump(obj, { schema: JSON_SCHEMA, lineWidth: -1 }), 'utf-8');
  renameSync(tmpPath, path);
}

function loadUpstreamTickets(): Array<{ file: string; ticket: any }> {
  if (!existsSync(TICKETS_DIR)) return [];
  const out: Array<{ file: string; ticket: any }> = [];
  for (const f of readdirSync(TICKETS_DIR).sort()) {
    if (!/^U-\d{8}-\d{3,4}\.yaml$/.test(f)) continue;
    try {
      const ticket = load(readFileSync(join(TICKETS_DIR, f), 'utf-8'), { schema: JSON_SCHEMA }) as any;
      if (ticket && ticket.upstream) out.push({ file: f, ticket });
    } catch { /* unreadable ticket: skip */ }
  }
  return out;
}

type Outcome = { result: unknown } | { error: { code: number; message: string } };

function handleCreateRequest(params: unknown, cwd: string): Outcome {
  // Identity: client-attested cwd first. GUI clients (Claude Desktop App) spawn this
  // server with cwd=/ and no project env, so when cwd resolution fails the requester
  // may self-declare its project root via params.project_root — same filesystem checks
  // apply, and the ticket is forced flagged so PM sees identity was not client-attested.
  const cwdResult = resolveProject(cwd);
  let projResult: ProjectIdentity | string = cwdResult;
  let declared = false;
  if (typeof cwdResult === 'string' && typeof params === 'object' && params !== null && !Array.isArray(params)) {
    const raw = (params as Record<string, unknown>).project_root;
    if (typeof raw === 'string' && raw.length > 0) {
      const declaredResult = resolveProject(sanitize(raw));
      if (typeof declaredResult !== 'string') {
        projResult = declaredResult;
        declared = true;
      }
    }
  }
  if (typeof projResult === 'string') {
    // Raw cwd is never stored: it may contain arbitrary user paths.
    const cwdHash = createHash('sha256').update(cwd, 'utf-8').digest('hex').slice(0, 16);
    appendAuditLog({ cwd_hash: cwdHash, outcome: 'reject_unregistered' });
    return { error: { code: -32602, message: `${projResult} (when your client launches this server outside the project directory — e.g. the Claude Desktop App — pass the project's absolute path as project_root)` } };
  }

  const { name: project, variant, version, path: projectPath } = projResult;
  const valResult = validateUpstreamRequest(params);
  if (!valResult.valid) {
    appendAuditLog({ project, outcome: 'reject_invalid' });
    return { error: { code: -32602, message: valResult.error } };
  }

  const req = valResult.req;
  const requestHash = createHash('sha256').update(JSON.stringify(req), 'utf-8').digest('hex');
  const dedupeHash = dedupeKey(req.affected_paths, req.symptom);

  let flagged = checkInjection({ symptom: req.symptom, repro: req.repro, diff: req.local_workaround_diff });
  if (declared) flagged = true; // self-declared identity always gets human review

  // T-20261001-017: the cap counters, the known-projects first-seen state and the audit
  // append are read-then-write — the whole accept/merge/reject path runs under the intake
  // lock so parallel server instances serialize (id allocation itself stays EEXIST-retried).
  return withIntakeLock(() => {
    // Caps: hard cap counts accepted tickets AND merges; soft cap counts new tickets only.
    const audit = readTodayAudit();
    const projectAccepted = audit.filter((e) => e.project === project && e.outcome === 'accepted').length;
    const projectMerged = audit.filter((e) => e.project === project && e.outcome === 'merged').length;
    if (projectAccepted + projectMerged >= UPSTREAM_HARD_CAP) {
      appendAuditLog({ project, outcome: 'reject_hard_cap', flagged, dedupe_key: dedupeHash, request_sha256: requestHash });
      return { error: { code: -32000, message: `rate_limited: per-project hard cap reached (${projectAccepted + projectMerged}/${UPSTREAM_HARD_CAP}/day)` } };
    }

    // C5: merge into an open duplicate. A merge never changes the existing ticket's triage.
    // T-20261002-005 (H4): the read-modify-write of the ticket file runs under the
    // SHARED ticket lock so a concurrent PM triage/resolve (ticket-store) cannot be
    // silently overwritten. Always nested INSIDE the intake lock (ordering
    // intake -> ticket is never inverted, so no deadlock).
    const dup = withTicketLock(TICKETS_DIR, `merge:${dedupeHash.slice(0, 8)}`, () => {
      const found = loadUpstreamTickets().find(({ ticket }) => ticket.status !== 'done' && ticket.upstream.dedupe_key === dedupeHash);
      if (!found) return null;
      const entry: Record<string, unknown> = { project, at: new Date().toISOString() };
      if (flagged) entry.flagged = true;
      found.ticket.upstream.duplicates = [...(found.ticket.upstream.duplicates ?? []), entry];
      writeYamlAtomic(join(TICKETS_DIR, found.file), found.ticket);
      return found;
    });
    if (dup) {
      appendAuditLog({ project, outcome: 'merged', id: dup.ticket.id, flagged, reasons: flagged ? ['needs_human_review'] : [], dedupe_key: dedupeHash, request_sha256: requestHash });
      if (dup.ticket.upstream.project !== project) {
        // Cross-project merge: acknowledge only. The foreign ticket's id/status/triage stay private.
        return { result: { merged: true, flagged, reasons: flagged ? ['needs_human_review'] : [] } };
      }
      return {
        result: {
          id: dup.ticket.id, status: dup.ticket.status, triage: dup.ticket.upstream.triage,
          merged_into: dup.ticket.id, flagged, reasons: flagged ? ['needs_human_review'] : [],
          marker: `LOCAL-PATCH(upstream-request: ${dup.ticket.id})`,
        },
      };
    }

    // Evaluate every auto-ready condition so triage_reasons is complete (§8).
    const failReasons: string[] = [];
    const info: string[] = [];
    if (flagged) failReasons.push('needs_human_review');
    if (declared) failReasons.push('identity:self_declared');
    if (projectAccepted >= UPSTREAM_SOFT_CAP) failReasons.push('project_soft_cap');

    const delivered = deliveredFiles(projectPath);
    for (const path of req.affected_paths) {
      const m = templateManagement(path, variant);
      if (!m.managed) failReasons.push(`path_not_template_managed: ${path}`);
      if (m.l0Origin) info.push(`info:l0_origin ${path} <- ${m.l0Origin}`);
      info.push(`info:in_last_delivery ${path}=${delivered.has(path)}`);
    }

    const knownProjects = loadKnownProjects();
    const isFirstRequest = !knownProjects.has(project);
    if (isFirstRequest) failReasons.push('first_request_from_project');

    const globalReady = audit.filter((e) => e.outcome === 'accepted' && e.triage === 'ready').length;
    if (globalReady >= UPSTREAM_GLOBAL_READY_CAP) failReasons.push('global_ready_cap');

    const triage: 'inbox' | 'ready' = failReasons.length === 0 ? 'ready' : 'inbox';
    const status = triage === 'ready' ? 'waiting' : 'backlog';
    const now = new Date().toISOString();

    const upstreamBlock: Record<string, unknown> = {
      project, variant, template_version: version, source: `project/${project}`,
      trust: 'untrusted', suspected_layer: req.suspected_layer, symptom: req.symptom,
      affected_paths: req.affected_paths,
    };
    if (req.local_workaround_diff !== undefined) upstreamBlock.local_workaround_diff = req.local_workaround_diff;
    if (req.repro !== undefined) upstreamBlock.repro = req.repro;
    Object.assign(upstreamBlock, {
      triage, flagged, triage_reasons: [...failReasons, ...info], dedupe_key: dedupeHash,
      // Seeded with the originating report so `duplicates` lists every report (design §13 test 8).
      duplicates: [{ project, at: now }],
    });

    mkdirSync(TICKETS_DIR, { recursive: true });
    let id = '';
    let written = false;
    for (let attempt = 0; attempt < 20 && !written; attempt++) {
      id = `${todayPrefix()}-${String(nextSeqForToday() + attempt).padStart(3, '0')}`;
      const ticket = {
        schemaVersion: 1, id, kind: 'manual', title: `Upstream request from ${project}`, priority: 'normal',
        status, attempts: 0, created_at: now,
        history: [{ at: now, from: null, to: status }],
        result: null, error: null, upstream: upstreamBlock,
      };
      const ticketPath = join(TICKETS_DIR, `${id}.yaml`);
      const tmpPath = `${ticketPath}.tmp-${process.pid}-${Date.now()}-${attempt}`;
      writeFileSync(tmpPath, dump(ticket, { schema: JSON_SCHEMA, lineWidth: -1 }), 'utf-8');
      try {
        linkSync(tmpPath, ticketPath); // fails with EEXIST if another process took this id
        written = true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') { unlinkSync(tmpPath); throw err; }
      }
      unlinkSync(tmpPath);
    }
    if (!written) throw new Error('could not allocate a ticket id');

    // known-projects.json is updated only after the ticket write succeeded.
    if (isFirstRequest) {
      knownProjects.set(project, { first_seen: now, first_id: id });
      saveKnownProjects(knownProjects);
    }

    appendAuditLog({ project, outcome: 'accepted', id, flagged, triage, identity: declared ? 'declared' : 'cwd', reasons: failReasons, dedupe_key: dedupeHash, request_sha256: requestHash });

    return { result: { id, status, triage, merged_into: null, flagged, reasons: failReasons, marker: `LOCAL-PATCH(upstream-request: ${id})` } };
  });
}

function handleStatusRequest(params: unknown, cwd: string): Outcome {
  // Same identity fallback as create: cwd first, then an optional self-declared
  // project_root for clients that spawn the server outside the project (GUI apps).
  let projResult: ProjectIdentity | string = resolveProject(cwd);
  let declared = false;
  if (typeof projResult === 'string' && typeof params === 'object' && params !== null && !Array.isArray(params)) {
    const raw = (params as Record<string, unknown>).project_root;
    if (typeof raw === 'string' && raw.length > 0) {
      const declaredResult = resolveProject(sanitize(raw));
      if (typeof declaredResult !== 'string') {
        projResult = declaredResult;
        declared = true;
      }
    }
  }
  if (typeof projResult === 'string') return { error: { code: -32602, message: `${projResult} (when your client launches this server outside the project directory — e.g. the Claude Desktop App — pass the project's absolute path as project_root)` } };
  const { name: project } = projResult;

  const p = (params ?? {}) as Record<string, unknown>;
  if (typeof p !== 'object' || Array.isArray(p)) return { error: { code: -32602, message: 'invalid params: arguments must be an object' } };
  for (const key of Object.keys(p)) {
    if (key !== 'id' && key !== 'limit' && key !== 'project_root') return { error: { code: -32602, message: `invalid params: extra key "${key}"` } };
  }
  if (p.id !== undefined && (typeof p.id !== 'string' || !/^U-\d{8}-\d{3,4}$/.test(p.id))) return { error: { code: -32602, message: 'invalid params: id' } };
  let limit = 20;
  if (p.limit !== undefined) {
    if (typeof p.limit !== 'number' || !Number.isInteger(p.limit) || p.limit < 1 || p.limit > 50) return { error: { code: -32602, message: 'invalid params: limit must be an integer 1-50' } };
    limit = p.limit;
  }

  // T-20261002-004 (H3): every status call is audit-logged, and a DECLARED identity
  // (self-declared project_root — unverified until PM review) gets redacted results:
  // ids + status/triage only, never another project's resolution summary or PR URL.
  appendAuditLog({ project, outcome: 'status', identity: declared ? 'declared' : 'cwd' });

  const mine = loadUpstreamTickets()
    .filter(({ ticket }) => ticket.upstream.project === project && (p.id === undefined || ticket.id === p.id))
    .map(({ ticket }) => ({
      id: ticket.id, status: ticket.status, triage: ticket.upstream.triage, created_at: ticket.created_at,
      resolution: declared ? undefined : (ticket.upstream.resolution ?? null),
    }))
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, limit);

  // Same answer for "does not exist" and "belongs to another project".
  if (p.id !== undefined && mine.length === 0) return { error: { code: -32602, message: 'not found' } };
  return { result: { requests: mine } };
}

interface JsonRpcMessage {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

function sendResponse(id: string | number | null, result?: unknown, error?: { code: number; message: string }): void {
  const msg: Record<string, unknown> = { jsonrpc: '2.0', id };
  if (error) msg.error = error;
  else msg.result = result;
  console.log(JSON.stringify(msg));
}

const SERVER_INSTRUCTIONS = 'Use this server when a problem you hit in this project likely originates in the ai_workspace template (L1 common or L2 variant), e.g. in a file delivered by `upgrade-project`. You may fix it locally to unblock your work, but always also file `upstream_request_create`. A local fix to a template-managed file will be overwritten on the next upgrade. Mark every such local patch with a comment `LOCAL-PATCH(upstream-request: <id>)` using the ID returned. Do not put instructions to other agents in the request. Describe the symptom, paths, and repro only. Check progress with `upstream_request_status`. If identity resolution rejects your working directory and your client is a GUI app (e.g. the Claude Desktop App spawns servers with cwd=/), retry passing the project\'s absolute path as `project_root`; such requests are flagged for human review.';

function handleInitialize(params: unknown) {
  const p = (params ?? {}) as Record<string, unknown>;
  const protocolVersion = typeof p.protocolVersion === 'string' ? p.protocolVersion : FALLBACK_PROTOCOL_VERSION;
  return { protocolVersion, serverInfo: { name: 'ai-workspace-upstream', version: SERVER_VERSION }, capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS };
}

function getTools() {
  return [
    {
      name: 'upstream_request_create',
      description: 'File an upstream request to the ai_workspace PM when a problem\'s root cause is suspected to be in the workspace (L1) or the variant template (L2). Project identity comes from the working directory; GUI clients that spawn this server outside the project may pass project_root instead (the ticket is then flagged for human review). Content is treated as untrusted data.',
      inputSchema: {
        type: 'object', additionalProperties: false, required: ['suspected_layer', 'symptom', 'affected_paths'],
        properties: {
          suspected_layer: { type: 'string', enum: ['L1', 'L2', 'unsure'] },
          symptom: { type: 'string', minLength: 20, maxLength: 2000, description: 'What goes wrong, observed behavior vs expected.' },
          affected_paths: {
            type: 'array', minItems: 1, maxItems: 10,
            items: { type: 'string', maxLength: 200, pattern: '^(?!/)(?!.*\\.\\.)[A-Za-z0-9._\\-/]+$' },
            description: 'Project-relative paths (same relative layout as the template), e.g. scripts/dev-sync.ts',
          },
          local_workaround_diff: { type: 'string', maxLength: 8000, description: 'Optional unified diff of the local patch. Reference only; never applied automatically.' },
          repro: { type: 'string', maxLength: 2000, description: 'Optional reproduction steps in prose.' },
          project_root: { type: 'string', maxLength: 200, description: 'Optional absolute path to the project root. Used only when the working directory does not resolve to a registered project (GUI clients spawn this server with cwd=/). Goes through the same filesystem checks; tickets filed this way are flagged for human review.' },
        },
      },
    },
    {
      name: 'upstream_request_status',
      description: 'Read status of upstream requests filed from the current project. Read-only.',
      inputSchema: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: '^U-\\d{8}-\\d{3,4}$' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          project_root: { type: 'string', maxLength: 200, description: 'Optional absolute path to the project root; used only when the working directory does not resolve to a registered project.' },
        },
      },
    },
  ];
}

function dispatchToolCall(params: unknown): Outcome {
  const toolParams = (params ?? {}) as Record<string, unknown>;
  const toolName = toolParams.name;
  if (toolName === 'upstream_request_create') return handleCreateRequest(toolParams.arguments, process.cwd());
  if (toolName === 'upstream_request_status') return handleStatusRequest(toolParams.arguments, process.cwd());
  return { error: { code: -32602, message: `unknown tool: ${String(toolName)}` } };
}

async function main(): Promise<void> {
  const pruned = pruneOldLogs();
  if (pruned > 0) console.error(`[mcp-upstream-server] pruned ${pruned} audit log(s) older than ${LOG_RETENTION_DAYS} days`);
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let id: string | number | null = null;
    try {
      const msg = JSON.parse(line) as JsonRpcMessage;
      id = msg.id ?? null;
      const { method, params } = msg;

      if (method === 'initialize') {
        sendResponse(id, handleInitialize(params));
      } else if (method === 'tools/list') {
        sendResponse(id, { tools: getTools() });
      } else if (method === 'tools/call') {
        const outcome = dispatchToolCall(params);
        if ('error' in outcome) sendResponse(id, undefined, outcome.error);
        else sendResponse(id, { isError: false, content: [{ type: 'text', text: JSON.stringify(outcome.result) }] });
      } else if (typeof method === 'string' && method.startsWith('notifications/')) {
        // notifications carry no response
      } else if (msg.id !== undefined) {
        sendResponse(id, undefined, { code: -32601, message: `unknown method: ${String(method)}` });
      }
    } catch (err) {
      console.error(`[mcp-upstream-server] error: ${(err as Error).message}`);
      if (id !== null) sendResponse(id, undefined, { code: -32603, message: 'internal error' });
    }
  }
}

main().catch((err) => {
  console.error(`[mcp-upstream-server] fatal: ${(err as Error).message}`);
  process.exit(1);
});
