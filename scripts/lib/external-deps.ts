// @version 1.0.0
/**
 * external-deps.ts — shared helper for the generic external-dependency machinery
 * (design docs/designs/2026-11-07-external-deps-machinery-design.md, D1/D2/D3/D4/D5).
 *
 * One library for everything the two consumers (scripts/new-project.ts scaffold
 * fetch, scripts/upgrade-project.ts EXTERNAL DEPS pass) and the unit tests need:
 *
 *   - manifest parsing + strict validation (D1 schema; unknown fields rejected,
 *     propagation enum-checked, install_dir path-checked, placeholders resolved)
 *   - install (git clone --depth 1 --branch <pin> into install_dir; refreshes an
 *     existing clone via fetch + checkout — the D2 retry path is idempotent)
 *   - update-pass core (git ls-remote tag compare → compatibility test → pin
 *     move + re-fetch, or hold + report — D3)
 *   - gitignore coverage validation (D5)
 *   - vendoring-guard detection (D4 — install_dir paths inside template trees)
 *
 * Safety posture: EVERY subprocess uses the argv-array spawnSync form with a
 * tokenized command — no shell is ever involved, so no shell-escape surface
 * exists (the audit's bun-shell-compound-interpolation / subprocess-spawn-
 * string-build heuristics have nothing to fire on). The `install` and
 * `compatibility_test` command templates are validated to be free of shell
 * metacharacters BEFORE tokenization, so even a hostile manifest cannot inject
 * into the (absent) shell.
 *
 * Windows note (design §3): the machinery shells out to `git` — hosts need git
 * on PATH. No code-level workaround (documented in the consumers' WARN text).
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ── Types (D1 schema) ──────────────────────────────────────────────────────────

export const EXTERNAL_DEPS_SCHEMA_VERSION = 1 as const;

/** `propagation` enum — "never" is the only value for now (D1). */
export const PROPAGATION_VALUES = ['never'] as const;
export type ExternalDepPropagation = (typeof PROPAGATION_VALUES)[number];

export interface ExternalDepEntry {
  /** Stable identifier — unique within the manifest (merge key, D1). */
  id: string;
  /** https URL, no credentials. */
  repo: string;
  /** Release tag — the version we run (the contract). */
  pin: string;
  /** Resolved sha, advisory — drift tripwire only, written back at fetch/update. */
  commit?: string;
  /** Command template with {pin}/{repo}/{dir} placeholders. */
  install: string;
  /** Project-relative clone destination — MUST be gitignored (D5). */
  install_dir: string;
  /** Free text naming the consuming pipeline (advisory). */
  consumer?: string;
  /** Command run from the project root; exit 0 = pass (advisory until a pin move). */
  compatibility_test?: string;
  propagation: ExternalDepPropagation;
}

export interface ExternalDepsManifest {
  schema_version: typeof EXTERNAL_DEPS_SCHEMA_VERSION;
  dependencies: ExternalDepEntry[];
}

// ── Validation (D1: strict — unknown fields rejected, enum checked) ────────────

/** Doc-comment key tolerated at the manifest top level (the seeds document the
 *  schema inline; JSON has no comments). Any OTHER unknown key is rejected. */
const ALLOWED_TOP_LEVEL_DOC_KEY = '$comment';

export const ENTRY_FIELDS = [
  'id', 'repo', 'pin', 'commit', 'install', 'install_dir', 'consumer',
  'compatibility_test', 'propagation',
] as const;
const REQUIRED_ENTRY_FIELDS: ReadonlyArray<Exclude<typeof ENTRY_FIELDS[number], 'commit' | 'consumer' | 'compatibility_test'>> = [
  'id', 'repo', 'pin', 'install', 'install_dir', 'propagation',
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeErr(origin: string, msg: string): Error {
  return new Error(`external-deps manifest${origin ? ` (${origin})` : ''}: ${msg}`);
}

/** https URL, no credentials (D1: "https URL, no credentials"). `allowLocalRepos`
 *  accepts file:// and plain local paths — TEST manifests only (design §4:
 *  unit/E2E tests use tiny local fixture repos so tests never touch the
 *  network; the production scripts never enable this flag). */
function validateRepoUrl(repo: string, origin: string, allowLocalRepos = false): void {
  let url: URL;
  try {
    url = new URL(repo);
  } catch {
    if (allowLocalRepos && !repo.includes('://') && !repo.startsWith('//')) return; // plain local path
    throw typeErr(origin, `repo '${repo}' is not a valid URL`);
  }
  if (url.protocol === 'file:') {
    if (allowLocalRepos) return;
    throw typeErr(origin, `repo '${repo}' uses file:// — local repos are accepted only from test manifests (design §4)`);
  }
  if (url.protocol !== 'https:') {
    throw typeErr(origin, `repo '${repo}' must be an https:// URL (got '${url.protocol}') — private-repo auth is out of scope (design §6)`);
  }
  if (url.username || url.password) {
    throw typeErr(origin, `repo '${repo}' embeds credentials — not allowed (D1)`);
  }
}

/** Project-relative, forward slashes, no traversal, not empty (D1). */
export function validateInstallDir(installDir: string, origin: string): void {
  if (!installDir || typeof installDir !== 'string') {
    throw typeErr(origin, `install_dir must be a non-empty string`);
  }
  if (installDir.includes('\\')) {
    throw typeErr(origin, `install_dir '${installDir}' must use forward slashes (project-relative POSIX form)`);
  }
  if (isAbsolute(installDir) || installDir.startsWith('/')) {
    throw typeErr(origin, `install_dir '${installDir}' must be project-relative, not absolute`);
  }
  const parts = installDir.split('/').filter((p) => p.length > 0);
  if (parts.length === 0) throw typeErr(origin, `install_dir is empty`);
  if (parts.some((p) => p === '..' || p === '.')) {
    throw typeErr(origin, `install_dir '${installDir}' must not contain '.' or '..' segments`);
  }
}

/** Shell metacharacters — the command templates are tokenized and executed as an
 *  argv array with NO shell, so any of these would either be inert or hostile;
 *  reject them outright (design §5: tests never need them, manifests never carry
 *  them legitimately). */
// `{`/`}` are deliberately NOT metacharacters here — the {pin}/{repo}/{dir}
// placeholders need them. `(`/`)`/`[`/`]` are inert in the shell-free argv
// form (no shell ever parses them); the genuinely dangerous shapes — command
// separators, redirects, and expansion (`$`, backtick) — are all rejected.
const SHELL_META_RE = /[;&|><`$\n\r]/;

/**
 * Tokenize a validated command template into an argv array (whitespace-split,
 * single/double-quote aware). The caller validates metacharacter-freeness first.
 */
export function tokenizeCommand(cmd: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasToken = false;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) { quote = null; continue; }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; hasToken = true; continue; }
    if (/\s/.test(ch)) {
      if (hasToken || current) { tokens.push(current); current = ''; hasToken = false; }
      continue;
    }
    current += ch;
    hasToken = true;
  }
  if (current || hasToken) tokens.push(current);
  return tokens;
}

function validateCommandTemplate(cmd: string, field: string, origin: string): void {
  if (!cmd || typeof cmd !== 'string') throw typeErr(origin, `${field} must be a non-empty string`);
  if (SHELL_META_RE.test(cmd)) {
    throw typeErr(origin, `${field} contains shell metacharacters — commands run as a shell-free argv array; remove ';|&><\`$()[]{}' and whitespace-free quoting hacks`);
  }
}

/**
 * Resolve the {pin}/{repo}/{dir} placeholders of an `install` template into an
 * argv array (D1: "placeholders resolved"). `dir` becomes the ABSOLUTE install
 * path under projectDir. argv[0] must be `git` — validation, pin checks and the
 * update pass are git-semantics only this round (design §6).
 */
export function resolveInstallArgv(entry: Pick<ExternalDepEntry, 'id' | 'install' | 'pin' | 'repo' | 'install_dir'>, projectDir: string): string[] {
  validateCommandTemplate(entry.install, 'install', entry.id);
  const dirAbs = resolve(projectDir, entry.install_dir);
  const argv = tokenizeCommand(entry.install).map((tok) => tok
    .replace(/\{pin\}/g, entry.pin)
    .replace(/\{repo\}/g, entry.repo)
    .replace(/\{dir\}/g, dirAbs));
  if (argv.length === 0 || argv[0] !== 'git') {
    throw typeErr(entry.id, `install must invoke git (argv[0]='git', got '${argv[0] ?? '<empty>'}') — non-git sources are out of scope (design §6)`);
  }
  if (!/\{pin\}/.test(entry.install) || !/\{repo\}/.test(entry.install) || !/\{dir\}/.test(entry.install)) {
    throw typeErr(entry.id, `install template must contain {pin}, {repo} and {dir} placeholders (got: '${entry.install}')`);
  }
  return argv;
}

/** Tokenize + validate a `compatibility_test` template into an argv array. */
export function resolveCompatTestArgv(entry: Pick<ExternalDepEntry, 'compatibility_test' | 'id'>, origin = ''): string[] {
  const cmd = entry.compatibility_test ?? '';
  if (!cmd) throw typeErr(origin || entry.id || '', 'compatibility_test is not set');
  validateCommandTemplate(cmd, 'compatibility_test', origin || entry.id || '');
  return tokenizeCommand(cmd);
}

/**
 * Parse + strictly validate a manifest document (D1). Throws with a precise
 * message on any schema drift — upgrade validates before running the pass.
 */
export function parseExternalDepsManifest(raw: string, origin = '', opts: { allowLocalRepos?: boolean } = {}): ExternalDepsManifest {
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (err) {
    throw typeErr(origin, `invalid JSON — ${(err as Error).message}`);
  }
  if (!isPlainObject(doc)) throw typeErr(origin, 'top level must be a JSON object');

  const unknownTop = Object.keys(doc).filter((k) => k !== 'schema_version' && k !== 'dependencies' && k !== ALLOWED_TOP_LEVEL_DOC_KEY);
  if (unknownTop.length > 0) {
    throw typeErr(origin, `unknown top-level field(s): ${unknownTop.join(', ')} (allowed: schema_version, dependencies${ALLOWED_TOP_LEVEL_DOC_KEY ? `, ${ALLOWED_TOP_LEVEL_DOC_KEY}` : ''})`);
  }
  if (doc.schema_version !== EXTERNAL_DEPS_SCHEMA_VERSION) {
    throw typeErr(origin, `schema_version must be ${EXTERNAL_DEPS_SCHEMA_VERSION} (got: ${JSON.stringify(doc.schema_version)})`);
  }
  if (!Array.isArray(doc.dependencies)) throw typeErr(origin, 'dependencies must be an array');

  const seen = new Set<string>();
  const dependencies: ExternalDepEntry[] = doc.dependencies.map((rawEntry, i) => {
    const at = `entry[${i}]`;
    if (!isPlainObject(rawEntry)) throw typeErr(origin, `${at} must be an object`);
    const unknown = Object.keys(rawEntry).filter((k) => !(ENTRY_FIELDS as readonly string[]).includes(k));
    if (unknown.length > 0) {
      throw typeErr(origin, `${at}: unknown field(s): ${unknown.join(', ')} (allowed: ${ENTRY_FIELDS.join(', ')})`);
    }
    for (const f of REQUIRED_ENTRY_FIELDS) {
      if (typeof rawEntry[f] !== 'string' || (rawEntry[f] as string).length === 0) {
        throw typeErr(origin, `${at}: field '${f}' must be a non-empty string`);
      }
    }
    const id = rawEntry.id as string;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) {
      throw typeErr(origin, `${at}: id '${id}' must match [A-Za-z0-9][A-Za-z0-9._-]*`);
    }
    if (seen.has(id)) throw typeErr(origin, `${at}: duplicate id '${id}' (merge key must be unique)`);
    seen.add(id);
    if (rawEntry.propagation !== 'never') {
      throw typeErr(origin, `${at}: propagation must be one of [${PROPAGATION_VALUES.join(', ')}] (got: ${JSON.stringify(rawEntry.propagation)})`);
    }
    validateRepoUrl(rawEntry.repo as string, `${at} (${id})`, opts.allowLocalRepos === true);
    validateInstallDir(rawEntry.install_dir as string, `${at} (${id})`);
    validateCommandTemplate(rawEntry.install as string, 'install', `${at} (${id})`);
    if (rawEntry.commit !== undefined && (typeof rawEntry.commit !== 'string' || !/^[0-9a-f]{40}$/.test(rawEntry.commit))) {
      throw typeErr(origin, `${at}: commit must be a 40-hex sha (got: ${JSON.stringify(rawEntry.commit)})`);
    }
    if (rawEntry.compatibility_test !== undefined && rawEntry.compatibility_test !== null) {
      if (typeof rawEntry.compatibility_test !== 'string' || rawEntry.compatibility_test.length === 0) {
        throw typeErr(origin, `${at}: compatibility_test must be a non-empty string when present`);
      }
      validateCommandTemplate(rawEntry.compatibility_test, 'compatibility_test', `${at} (${id})`);
    }
    const entry: ExternalDepEntry = {
      id,
      repo: rawEntry.repo as string,
      pin: rawEntry.pin as string,
      install: rawEntry.install as string,
      install_dir: rawEntry.install_dir as string,
      propagation: rawEntry.propagation as ExternalDepPropagation,
    };
    if (typeof rawEntry.commit === 'string') entry.commit = rawEntry.commit;
    if (typeof rawEntry.consumer === 'string' && rawEntry.consumer.length > 0) entry.consumer = rawEntry.consumer;
    if (typeof rawEntry.compatibility_test === 'string' && rawEntry.compatibility_test.length > 0) entry.compatibility_test = rawEntry.compatibility_test;
    return entry;
  });

  return { schema_version: EXTERNAL_DEPS_SCHEMA_VERSION, dependencies };
}

/**
 * Variant seeds EXTEND the common seed (D1): merge on `id`, variant may add
 * entries, not redefine L1 semantics. File-level overlay (variant file wins)
 * already happened upstream of this function for delivered manifests; this
 * merge exists for the seed-composition path and tests. On an id collision the
 * variant entry wins (the variant's template file is authoritative for that id).
 */
export function mergeExternalDepsManifests(common: ExternalDepsManifest, variant: ExternalDepsManifest | null): ExternalDepsManifest {
  if (!variant) return { schema_version: EXTERNAL_DEPS_SCHEMA_VERSION, dependencies: [...common.dependencies] };
  const byId = new Map<string, ExternalDepEntry>();
  for (const dep of common.dependencies) byId.set(dep.id, dep);
  for (const dep of variant.dependencies) byId.set(dep.id, dep);
  return { schema_version: EXTERNAL_DEPS_SCHEMA_VERSION, dependencies: [...byId.values()] };
}

// ── Git subprocess helpers (argv-array only — no shell, ever) ──────────────────

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/** Run git with an argv array; never a shell. `timeoutMs` guards network calls. */
export function git(args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): GitResult {
  const r = spawnSync('git', args, { cwd: opts.cwd, encoding: 'utf8', timeout: opts.timeoutMs ?? 120_000 });
  return {
    ok: r.status === 0 && !r.error,
    stdout: (r.stdout ?? '').trim(),
    stderr: (r.stderr ?? (r.error ? String(r.error) : '')).trim(),
  };
}

// ── Install (D2) ───────────────────────────────────────────────────────────────

export interface InstallOutcome {
  status: 'installed' | 'refreshed' | 'failed';
  commit?: string;
  error?: string;
}

/**
 * Run a dependency's `install` (D2). Idempotent: an existing clone (a retry
 * after a partial scaffold, or the upgrade refresh path) is UPDATED to the pin
 * via `git fetch --depth 1 --force origin refs/tags/<pin>` + forced checkout
 * instead of a re-clone. Returns the resolved HEAD sha.
 */
export function installDependency(entry: ExternalDepEntry, projectDir: string): InstallOutcome {
  let argv: string[];
  try {
    argv = resolveInstallArgv(entry, projectDir);
  } catch (err) {
    return { status: 'failed', error: (err as Error).message };
  }
  const dest = resolve(projectDir, entry.install_dir);
  const gitDir = join(dest, '.git');
  const preExisting = existsSync(gitDir);
  if (preExisting) {
    const fetch = git(['fetch', '--depth', '1', '--force', 'origin', `refs/tags/${entry.pin}:refs/tags/${entry.pin}`], { cwd: dest });
    if (!fetch.ok) return { status: 'failed', error: `git fetch (refresh to ${entry.pin}) failed: ${fetch.stderr}` };
    const checkout = git(['checkout', '--force', entry.pin], { cwd: dest });
    if (!checkout.ok) return { status: 'failed', error: `git checkout ${entry.pin} failed: ${checkout.stderr}` };
  } else {
    const clone = git(argv.slice(1), { cwd: projectDir });
    if (!clone.ok) return { status: 'failed', error: `install failed: ${clone.stderr || clone.stdout}` };
  }
  const head = git(['rev-parse', 'HEAD'], { cwd: dest });
  if (!head.ok) return { status: 'failed', error: `clone done but 'git rev-parse HEAD' failed: ${head.stderr}` };
  return { status: preExisting ? 'refreshed' : 'installed', commit: head.stdout };
}

// ── Update-pass core (D3) ──────────────────────────────────────────────────────

/** Tag with an `v?MAJOR.MINOR.PATCH` shape (pre-release suffix tolerated). */
const SEMVER_TAG_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function parseSemverTag(tag: string): { major: number; minor: number; patch: number; pre: string | null } | null {
  const m = SEMVER_TAG_RE.exec(tag);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ?? null };
}

/** True when `candidate` is a strictly newer semver release than `current` (D3:
 *  "a tag that is not newer than pin short-circuits to current"). */
export function isNewerTag(candidate: string, current: string): boolean {
  const c = parseSemverTag(candidate);
  const k = parseSemverTag(current);
  if (!c || !k) return false; // non-semver tags are never auto-promoted
  if (c.major !== k.major) return c.major > k.major;
  if (c.minor !== k.minor) return c.minor > k.minor;
  if (c.patch !== k.patch) return c.patch > k.patch;
  // Same numeric version: a release beats a pre-release of itself.
  if (c.pre === null && k.pre !== null) return true;
  return false;
}

export interface UpstreamTagCheck {
  ok: boolean;
  error?: string;
  tags: string[];
  /** Newest tag strictly newer than the pin, if any. */
  newer?: string;
}

/** `git ls-remote --tags --refs <repo>` + semver-aware compare against the pin. */
export function checkUpstreamTags(entry: Pick<ExternalDepEntry, 'repo' | 'pin'>): UpstreamTagCheck {
  const ls = git(['ls-remote', '--tags', '--refs', entry.repo], { timeoutMs: 60_000 });
  if (!ls.ok) return { ok: false, error: `git ls-remote failed: ${ls.stderr || ls.stdout}`, tags: [] };
  const tags = ls.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/\t/)[1]?.replace(/^refs\/tags\//, '') ?? '')
    .filter((t) => t.length > 0 && !t.endsWith('^{}'));
  const newer = tags
    .filter((t) => isNewerTag(t, entry.pin))
    .sort((a, b) => (isNewerTag(a, b) ? 1 : isNewerTag(b, a) ? -1 : 0))[0];
  return { ok: true, tags, newer };
}

/**
 * Pin-drift tripwire (design §5): compare the recorded advisory `commit` with
 * the sha the pinned tag currently resolves to. `null` when the check cannot
 * run (no clone / no tag) — the pin tag remains authoritative either way.
 */
export function checkPinDrift(entry: ExternalDepEntry, projectDir: string): { checked: boolean; drifted: boolean; resolved?: string; error?: string } {
  const dest = resolve(projectDir, entry.install_dir);
  if (!existsSync(join(dest, '.git'))) return { checked: false, drifted: false, error: 'no clone present' };
  const head = git(['rev-parse', 'HEAD'], { cwd: dest });
  if (!head.ok) return { checked: false, drifted: false, error: `git rev-parse failed: ${head.stderr}` };
  if (!entry.commit) return { checked: true, drifted: false, resolved: head.stdout };
  return { checked: true, drifted: head.stdout !== entry.commit, resolved: head.stdout };
}

export interface CompatTestOutcome {
  ran: boolean;
  ok: boolean;
  error?: string;
}

/** Run the dependency's compatibility_test from the project root (D3). */
export function runCompatibilityTest(entry: ExternalDepEntry, projectDir: string): CompatTestOutcome {
  if (!entry.compatibility_test) return { ran: false, ok: false, error: 'no compatibility_test declared — a pin move requires one (design §5)' };
  let argv: string[];
  try {
    argv = resolveCompatTestArgv(entry, entry.id);
  } catch (err) {
    return { ran: false, ok: false, error: (err as Error).message };
  }
  const r = spawnSync(argv[0], argv.slice(1), { cwd: projectDir, encoding: 'utf8', timeout: 600_000 });
  if (r.error) return { ran: false, ok: false, error: `failed to start '${argv[0]}': ${String(r.error)}` };
  return { ran: true, ok: r.status === 0, error: r.status === 0 ? undefined : `exit ${r.status}` };
}

// ── Gitignore coverage (D5) ────────────────────────────────────────────────────

/**
 * True when `installDir` is covered by the given .gitignore content. Coverage =
 * an un-commented, non-negated line whose pattern (after stripping a leading
 * and/or trailing '/') equals the install_dir or one of its ancestor
 * directories. Anchor and glob nuances are intentionally conservative: a false
 * NEGATIVE (uncovered) is safe — the caller appends an exact line; a false
 * POSITIVE would skip the append, so only exact/ancestor lines count.
 */
export function isGitignoreCovered(gitignoreContent: string, installDir: string): boolean {
  const ancestors = new Set<string>();
  const parts = installDir.split('/').filter(Boolean);
  for (let i = 1; i <= parts.length; i++) {
    ancestors.add(parts.slice(0, i).join('/'));
    ancestors.add(parts.slice(0, i).join('/') + '/');
  }
  for (const rawLine of gitignoreContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('!')) continue; // negation — never counted as coverage
    let pattern = line;
    while (pattern.startsWith('/')) pattern = pattern.slice(1);
    if (pattern.startsWith('**/')) pattern = pattern.slice(3);
    if (ancestors.has(pattern) || pattern === installDir) return true;
  }
  return false;
}

/** Read the project's .gitignore (empty string when absent — the caller creates it). */
export function readGitignore(projectDir: string): string {
  const p = join(projectDir, '.gitignore');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

/**
 * Ensure every manifest install_dir is covered by the project .gitignore (D5).
 * Returns the dirs that were (or in dry-run, would be) appended.
 */
export function ensureGitignoreCoverage(projectDir: string, installDirs: string[], opts: { dryRun?: boolean } = {}): { appended: string[] } {
  const appended: string[] = [];
  if (installDirs.length === 0) return { appended };
  let content = readGitignore(projectDir);
  const missing = installDirs.filter((d) => !isGitignoreCovered(content, d));
  if (missing.length === 0) return { appended };
  if (opts.dryRun) return { appended: missing };
  if (content.length > 0 && !content.endsWith('\n')) content += '\n';
  if (content.length === 0) content = '# External-dependency install dirs (design 2026-11-07-external-deps-machinery, D5) — never commit an external clone\n';
  for (const d of missing) content += `${d}/\n`;
  writeFileSync(join(projectDir, '.gitignore'), content, 'utf8');
  return { appended: missing };
}

// ── Scaffold-fetch core (D2/D5 — consumed by new-project §7.9 and the tests) ───

export interface FetchDepResult {
  id: string;
  ok: boolean;
  status: InstallOutcome['status'] | 'skipped';
  commit?: string;
  error?: string;
}

export interface FetchProjectResult {
  /** false only when strict mode must hard-fail (a dependency failed). */
  ok: boolean;
  manifestPresent: boolean;
  results: FetchDepResult[];
  gitignoreAppended: string[];
  /** Set when the manifest itself is missing or invalid (non-strict → WARN). */
  manifestError?: string;
}

/**
 * D2 scaffold fetch for a materialized project: read the project's
 * external-deps.json (delivered by the template seeds), install every entry
 * (WARN posture — failures never abort the scaffold unless `strict`), append
 * gitignore coverage (D5), and write the resolved commit back into the
 * manifest (advisory field).
 */
export function fetchProjectExternalDeps(projectDir: string, opts: { strict?: boolean; dryRun?: boolean; allowLocalRepos?: boolean } = {}): FetchProjectResult {
  const manifestPath = join(projectDir, 'external-deps.json');
  const result: FetchProjectResult = { ok: true, manifestPresent: existsSync(manifestPath), results: [], gitignoreAppended: [] };
  if (!result.manifestPresent) return result;

  let manifest: ExternalDepsManifest;
  try {
    manifest = parseExternalDepsManifest(readFileSync(manifestPath, 'utf8'), 'external-deps.json', { allowLocalRepos: opts.allowLocalRepos === true });
  } catch (err) {
    result.manifestError = (err as Error).message;
    if (opts.strict) result.ok = false;
    return result;
  }

  const outcomes: InstallOutcome[] = [];
  for (const dep of manifest.dependencies) {
    const outcome = installDependency(dep, projectDir);
    outcomes.push(outcome);
    result.results.push({
      id: dep.id,
      ok: outcome.status !== 'failed',
      status: outcome.status,
      commit: outcome.commit,
      error: outcome.error,
    });
    if (outcome.status === 'failed') {
      if (opts.strict) result.ok = false;
      continue;
    }
    // Write the resolved commit back (advisory drift tripwire, D1/D2).
    if (!opts.dryRun && outcome.commit) {
      try {
        const doc = JSON.parse(readFileSync(manifestPath, 'utf8')) as { dependencies?: Array<Record<string, unknown>> };
        const row = doc.dependencies?.find((d) => d['id'] === dep.id);
        if (row && row['commit'] !== outcome.commit) {
          row['commit'] = outcome.commit;
          writeFileSync(manifestPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
        }
      } catch { /* non-fatal — the pin tag remains the contract */ }
    }
  }

  result.gitignoreAppended = ensureGitignoreCoverage(projectDir, manifest.dependencies.map((d) => d.install_dir), { dryRun: opts.dryRun }).appended;
  return result;
}

// ── Vendoring guard (D4) ───────────────────────────────────────────────────────

/**
 * D4 vendoring guard: return the install_dirs that exist as real paths INSIDE
 * the given template tree (the fastest way to detect a `presentations/
 * ppt-master/` accidentally committed into a template). Matches the directory
 * itself AND any file below it.
 */
export function findVendoredInstallDirs(templateDir: string, installDirs: string[]): string[] {
  const hits: string[] = [];
  for (const dir of installDirs) {
    const asDir = join(templateDir, dir);
    if (existsSync(asDir)) { hits.push(dir); continue; }
    // Any FILE below the install_dir path inside the template tree also vendors.
    const parent = join(templateDir, dir.split('/').slice(0, -1).join('/') || '.');
    const leaf = dir.split('/').pop() ?? dir;
    if (existsSync(parent)) {
      try {
        const entries = readdirSync(parent);
        if (entries.includes(leaf)) hits.push(dir);
      } catch { /* unreadable parent — the directory check above is the guard */ }
    }
  }
  return [...new Set(hits)];
}

/** True when a project-relative path lives under (or equals) any install_dir. */
export function isUnderAnyInstallDir(relPath: string, installDirs: string[]): boolean {
  const rel = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  return installDirs.some((dir) => rel === dir || rel.startsWith(`${dir}/`));
}

/**
 * Best-effort install_dir extraction from an UNVALIDATED manifest document —
 * used by the propagation-exclusion guards (D4), which must work even when the
 * manifest is a legacy/interim shape (the co-work pre-machinery instance used
 * `install_path`) or otherwise schema-drifted. Strict validation is the pass's
 * job; the guard only needs the directory list.
 */
export function extractInstallDirsLoose(raw: string): string[] {
  try {
    const doc = JSON.parse(raw) as { dependencies?: Array<Record<string, unknown>> };
    if (!Array.isArray(doc.dependencies)) return [];
    const dirs: string[] = [];
    for (const dep of doc.dependencies) {
      for (const key of ['install_dir', 'install_path']) {
        const v = dep?.[key];
        if (typeof v === 'string' && v.length > 0 && !v.includes('..') && !v.startsWith('/')) {
          dirs.push(v.replace(/\\/g, '/').replace(/\/+$/, ''));
          break;
        }
      }
    }
    return [...new Set(dirs)];
  } catch {
    return [];
  }
}
