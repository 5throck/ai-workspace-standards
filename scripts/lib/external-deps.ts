// @version 1.2.0
// v1.2.0 (2026-11-08, T-20261108-002 — port of co-work #38 / LOCAL-PATCH
//          U-20261107-002): bounded NON-GIT admission — an `install` template
//          may invoke an allowlisted deterministic non-git tool
//          (NON_GIT_INSTALL_ARGV0: bun/npm/curl/wget) as a single shell-free
//          argv command; non-git pins must be semver-looking
//          (NON_GIT_PIN_RE: npm registry version or GitHub release tag); the
//          optional `checksum` field records the integrity anchor
//          (npm dist-integrity sha512-<base64> or 64-hex sha256).
//          classifyInstallArgv0 is the single admission gate ('git' keeps the
//          v1 semantics byte-identical; multi-step download→verify→extract
//          sequences are still NOT admitted). resolveInstallArgv admits the
//          non-git placeholder rule ({pin}+{dir} required, {repo} optional);
//          installDependency gains the non-git executor arm (shell-free argv
//          spawn, install_dir mkdir'd first, no commit resolution — re-run is
//          idempotent for pinned commands). Git path byte-compatible.
/**
 * external-deps.ts — shared helper for the generic external-dependency machinery
 * (design docs/designs/2026-11-07-external-deps-machinery-design.md, D1/D2/D3/D4/D5)
 * and the external-dependency STANDARD (design
 * docs/designs/2026-11-07-external-deps-standard-design.md, §5 + Addendum;
 * decision DEC-20261107-02).
 *
 * v1.1.0 (2026-11-07, standard design, T-20261107-005): manifest schema v2 —
 *   required `license` / `usage` ("as-is") / `adapter`, optional
 *   `excluded_components` / `license_decision`; v1 still parses (dual parse;
 *   a non-empty v1 document is "license undeclared" and fails the license
 *   gate). EXTERNAL_DEP_LICENSE_POLICY is the single source of truth for the
 *   license classes (allow / review / review-standalone / deny — unknown ids
 *   deny). R3: install_dir collisions are a parse error; a NEW entry (no
 *   recorded commit) whose install_dir is not external/<id> FAILs, an
 *   installed one is grandfathered with a WARN. Verify primitives V1-V9
 *   (verifyProjectExternalDeps) back the project CLI scripts/external-deps.ts;
 *   the scaffold fetch skips a gated entry (E5 — a deny-class dependency is
 *   never cloned). All writers emit schema v2.
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

import { mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ── Types (D1 schema; v2 per the standard design §5.2) ─────────────────────────

/** The schema version every WRITER emits (standard design §5.2: "All writers
 *  … emit v2"). The loader also accepts the legacy v1 (dual parse). */
export const EXTERNAL_DEPS_SCHEMA_VERSION = 2 as const;
export const SUPPORTED_SCHEMA_VERSIONS = [1, 2] as const;
export type ExternalDepsSchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

/** `propagation` enum — "never" is the only value for now (D1). */
export const PROPAGATION_VALUES = ['never'] as const;
export type ExternalDepPropagation = (typeof PROPAGATION_VALUES)[number];

/** `usage` enum (standard §4.3) — single value; a new class needs a design. */
export const USAGE_VALUES = ['as-is'] as const;
export type ExternalDepUsage = (typeof USAGE_VALUES)[number];

/** A deliberately excluded part of the upstream repo (standard §5.2). */
export interface ExcludedComponent {
  name: string;
  license: string;
  reason: string;
}

export interface ExternalDepEntry {
  /** Stable identifier — unique within the manifest (merge key, D1). */
  id: string;
  /** https URL, no credentials. */
  repo: string;
  /** Release tag — the version we run (the contract). */
  pin: string;
  /** Resolved sha, advisory — drift tripwire only, written back at fetch/update. */
  commit?: string;
  /** Integrity anchor (T-20261108-002): npm dist-integrity `sha512-<base64>`
   *  or a 64-hex sha256 of the release asset the pinned install fetches. */
  checksum?: string;
  /** Command template with {pin}/{repo}/{dir} placeholders. */
  install: string;
  /** Project-relative clone destination — MUST be gitignored (D5). */
  install_dir: string;
  /** Free text naming the consuming pipeline (advisory). */
  consumer?: string;
  /** Command run from the project root; exit 0 = pass (advisory until a pin move). */
  compatibility_test?: string;
  propagation: ExternalDepPropagation;
  // ── v2 (standard §5.2) — absent on a parsed v1 entry ──
  /** SPDX id or expression of the pinned repo. REQUIRED in v2. */
  license?: string;
  /** Allowed-use class. REQUIRED in v2; only "as-is". */
  usage?: ExternalDepUsage;
  /** The ONE project file that couples to the clone. REQUIRED in v2. */
  adapter?: string;
  /** Upstream parts we never install (values are dependency-specific facts). */
  excluded_components?: ExcludedComponent[];
  /** DEC-YYYYMMDD-NN or ADR-NNNN; required for review / review-standalone classes. */
  license_decision?: string;
}

export interface ExternalDepsManifest {
  schema_version: ExternalDepsSchemaVersion;
  dependencies: ExternalDepEntry[];
}

/** True for a v1 document that declares dependencies — license undeclared
 *  (standard §5.2: parses with a WARN, fails the license gate in verify). */
export function isLegacyV1WithEntries(m: ExternalDepsManifest): boolean {
  return m.schema_version === 1 && m.dependencies.length > 0;
}

// ── Validation (D1: strict — unknown fields rejected, enum checked) ────────────

/** Doc-comment key tolerated at the manifest top level (the seeds document the
 *  schema inline; JSON has no comments). Any OTHER unknown key is rejected. */
const ALLOWED_TOP_LEVEL_DOC_KEY = '$comment';

/** v1 entry fields (machinery D1). */
export const ENTRY_FIELDS_V1 = [
  'id', 'repo', 'pin', 'commit', 'checksum', 'install', 'install_dir', 'consumer',
  'compatibility_test', 'propagation',
] as const;
/** v2 entry fields (standard §5.2) — the v1 set plus the contract fields. */
export const ENTRY_FIELDS_V2 = [
  ...ENTRY_FIELDS_V1, 'license', 'usage', 'adapter', 'excluded_components', 'license_decision',
] as const;
/** The CURRENT (writer) schema's field set. */
export const ENTRY_FIELDS = ENTRY_FIELDS_V2;
/** v2 fields a v1 → v2 migration takes from the template seed (standard §5.6). */
export const V2_CONTRACT_FIELDS = ['license', 'usage', 'adapter', 'excluded_components', 'license_decision'] as const;
const REQUIRED_ENTRY_FIELDS: ReadonlyArray<string> = [
  'id', 'repo', 'pin', 'install', 'install_dir', 'propagation',
];
const REQUIRED_ENTRY_FIELDS_V2_EXTRA: ReadonlyArray<string> = ['license', 'usage', 'adapter'];
const LICENSE_DECISION_RE = /^(DEC-\d{8}-\d{2}|ADR-\d{4})$/;

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

// T-20261108-002 (port of co-work #38 / LOCAL-PATCH U-20261107-002): bounded
// non-git admission — deterministic package-manager/download tools only, so
// no interpreter (`-c`-style code) injection surface opens. Multi-step
// sequences (download → checksum-verify → extract) are NOT admitted this
// round; the optional `checksum` field records the integrity anchor such
// installs are verified against. Every git-based rule below is unchanged.
const NON_GIT_INSTALL_ARGV0 = ['bun', 'npm', 'curl', 'wget'] as const;

/** Semver-looking pin for non-git entries: npm registry versions (`4.24.51`)
 *  and GitHub release tags (`v0.8.7`) share the v?MAJOR.MINOR.PATCH shape. */
const NON_GIT_PIN_RE = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** npm dist-integrity form (`sha512-<base64>`) or a 64-hex sha256 (release asset). */
const CHECKSUM_RE = /^(?:sha512-[A-Za-z0-9+/]+={0,2}|[0-9a-f]{64})$/;

function validateChecksum(checksum: string, origin: string): void {
  if (!CHECKSUM_RE.test(checksum)) {
    throw typeErr(origin, `checksum must be an npm dist-integrity string ('sha512-<base64>') or a 64-hex sha256 (got: ${JSON.stringify(checksum)})`);
  }
}

/** Classify an install template's argv[0]: 'git' (v1 semantics, unchanged) or
 *  'non-git' (allowlisted deterministic tool). Anything else is rejected — this
 *  is the extension's single admission gate (v1 rejected all non-git outright). */
export function classifyInstallArgv0(cmd: string, origin: string): 'git' | 'non-git' {
  const argv0 = tokenizeCommand(cmd)[0] ?? '';
  if (argv0 === 'git') return 'git';
  if ((NON_GIT_INSTALL_ARGV0 as readonly string[]).includes(argv0)) return 'non-git';
  throw typeErr(origin, `install must invoke git or an allowlisted deterministic non-git tool [${NON_GIT_INSTALL_ARGV0.join(', ')}] (argv[0]='${argv0 || '<empty>'}')`);
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
  if (argv.length === 0) {
    throw typeErr(entry.id, `install template resolves to an empty command`);
  }
  if (classifyInstallArgv0(entry.install, entry.id) === 'git') {
    if (!/\{pin\}/.test(entry.install) || !/\{repo\}/.test(entry.install) || !/\{dir\}/.test(entry.install)) {
      throw typeErr(entry.id, `install template must contain {pin}, {repo} and {dir} placeholders (got: '${entry.install}')`);
    }
  } else if (!/\{pin\}/.test(entry.install) || !/\{dir\}/.test(entry.install)) {
    throw typeErr(entry.id, `non-git install template must contain {pin} and {dir} placeholders ({repo} is optional for registry pins; got: '${entry.install}')`);
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
 * Parse + strictly validate a manifest document (D1; v2 per standard §5.2).
 * Throws with a precise message on any schema drift — upgrade validates before
 * running the pass. Accepts schema v1 (legacy; the v2 contract fields are
 * rejected as unknown there) and v2 (contract fields required). R3 (standard
 * Addendum A.2): an install_dir collision between entries is a parse error.
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
  if (!(SUPPORTED_SCHEMA_VERSIONS as readonly unknown[]).includes(doc.schema_version)) {
    throw typeErr(origin, `schema_version must be one of [${SUPPORTED_SCHEMA_VERSIONS.join(', ')}] (got: ${JSON.stringify(doc.schema_version)})`);
  }
  const schemaVersion = doc.schema_version as ExternalDepsSchemaVersion;
  const allowedFields: readonly string[] = schemaVersion === 2 ? ENTRY_FIELDS_V2 : ENTRY_FIELDS_V1;
  if (!Array.isArray(doc.dependencies)) throw typeErr(origin, 'dependencies must be an array');

  const seen = new Set<string>();
  const dependencies: ExternalDepEntry[] = doc.dependencies.map((rawEntry, i) => {
    const at = `entry[${i}]`;
    if (!isPlainObject(rawEntry)) throw typeErr(origin, `${at} must be an object`);
    const unknown = Object.keys(rawEntry).filter((k) => !allowedFields.includes(k));
    if (unknown.length > 0) {
      throw typeErr(origin, `${at}: unknown field(s) for schema v${schemaVersion}: ${unknown.join(', ')} (allowed: ${allowedFields.join(', ')})`);
    }
    const required = schemaVersion === 2 ? [...REQUIRED_ENTRY_FIELDS, ...REQUIRED_ENTRY_FIELDS_V2_EXTRA] : REQUIRED_ENTRY_FIELDS;
    for (const f of required) {
      if (typeof rawEntry[f] !== 'string' || (rawEntry[f] as string).length === 0) {
        throw typeErr(origin, `${at}: field '${f}' must be a non-empty string${REQUIRED_ENTRY_FIELDS_V2_EXTRA.includes(f) ? ' (required since schema v2 — standard §5.2)' : ''}`);
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
    // T-20261108-002 pin check: non-git pins must be semver-looking (npm
    // registry version or GitHub release tag); git entries keep the v1
    // free-form tag pin (their drift tripwire is the 40-hex commit below).
    if (classifyInstallArgv0(rawEntry.install as string, `${at} (${id})`) === 'non-git'
        && !NON_GIT_PIN_RE.test(rawEntry.pin as string)) {
      throw typeErr(origin, `${at}: non-git pin '${rawEntry.pin}' must look like an npm registry version or a GitHub release tag (v?MAJOR.MINOR.PATCH)`);
    }
    if (rawEntry.commit !== undefined && (typeof rawEntry.commit !== 'string' || !/^[0-9a-f]{40}$/.test(rawEntry.commit))) {
      throw typeErr(origin, `${at}: commit must be a 40-hex sha (got: ${JSON.stringify(rawEntry.commit)})`);
    }
    if (rawEntry.checksum !== undefined && rawEntry.checksum !== null) {
      if (typeof rawEntry.checksum !== 'string' || rawEntry.checksum.length === 0) {
        throw typeErr(origin, `${at}: checksum must be a non-empty string when present`);
      }
      validateChecksum(rawEntry.checksum, `${at} (${id})`);
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
    if (typeof rawEntry.checksum === 'string') entry.checksum = rawEntry.checksum;
    if (typeof rawEntry.consumer === 'string' && rawEntry.consumer.length > 0) entry.consumer = rawEntry.consumer;
    if (typeof rawEntry.compatibility_test === 'string' && rawEntry.compatibility_test.length > 0) entry.compatibility_test = rawEntry.compatibility_test;

    if (schemaVersion === 2) {
      // license: any non-empty string parses — the POLICY (evaluateLicensePolicy)
      // classifies it, and unknown ids deny (fail closed, standard §5.4).
      entry.license = (rawEntry.license as string).trim();
      if (rawEntry.usage !== 'as-is') {
        throw typeErr(origin, `${at}: usage must be one of [${USAGE_VALUES.join(', ')}] (got: ${JSON.stringify(rawEntry.usage)}) — the clone is read-only (standard §4.3)`);
      }
      entry.usage = 'as-is';
      validateInstallDir(rawEntry.adapter as string, `${at} (${id}) adapter`);
      entry.adapter = rawEntry.adapter as string;
      if (rawEntry.excluded_components !== undefined) {
        if (!Array.isArray(rawEntry.excluded_components)) throw typeErr(origin, `${at}: excluded_components must be an array`);
        entry.excluded_components = rawEntry.excluded_components.map((c, j) => {
          if (!isPlainObject(c)) throw typeErr(origin, `${at}: excluded_components[${j}] must be an object`);
          const keys = Object.keys(c).sort();
          if (keys.join(',') !== 'license,name,reason') {
            throw typeErr(origin, `${at}: excluded_components[${j}] must have exactly name, license, reason (got: ${keys.join(', ')})`);
          }
          for (const k of ['name', 'license', 'reason']) {
            if (typeof c[k] !== 'string' || (c[k] as string).trim().length === 0) {
              throw typeErr(origin, `${at}: excluded_components[${j}].${k} must be a non-empty string`);
            }
          }
          return { name: c.name as string, license: c.license as string, reason: c.reason as string };
        });
      }
      if (rawEntry.license_decision !== undefined) {
        if (typeof rawEntry.license_decision !== 'string' || !LICENSE_DECISION_RE.test(rawEntry.license_decision)) {
          throw typeErr(origin, `${at}: license_decision must match DEC-YYYYMMDD-NN or ADR-NNNN (got: ${JSON.stringify(rawEntry.license_decision)})`);
        }
        entry.license_decision = rawEntry.license_decision;
      }
    }
    return entry;
  });

  // Cross-entry rules: adapter outside every install_dir; R3 collisions.
  const installDirs = dependencies.map((d) => normalizeRel(d.install_dir));
  for (const dep of dependencies) {
    if (dep.adapter && isUnderAnyInstallDir(normalizeRel(dep.adapter), installDirs)) {
      throw typeErr(origin, `entry '${dep.id}': adapter '${dep.adapter}' sits under an install_dir — the adapter is OUR file and must live outside every external clone (standard §5.2)`);
    }
  }
  const collision = findInstallDirCollision(dependencies);
  if (collision) throw typeErr(origin, collision);

  return { schema_version: schemaVersion, dependencies };
}

function normalizeRel(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * R3 collision rule (standard Addendum A.2) — returns a message for the FIRST
 * collision, or null. Two entries collide when their install_dirs are equal or
 * nested, or when one entry's install_dir sits on (or under / over) another
 * entry's conventional path `external/<other-id>`.
 */
export function findInstallDirCollision(deps: ReadonlyArray<Pick<ExternalDepEntry, 'id' | 'install_dir'>>): string | null {
  const overlaps = (a: string, b: string): boolean => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
  for (let i = 0; i < deps.length; i++) {
    const a = normalizeRel(deps[i].install_dir);
    for (let j = 0; j < deps.length; j++) {
      if (i === j) continue;
      const b = normalizeRel(deps[j].install_dir);
      if (j > i && overlaps(a, b)) {
        return `install_dir collision: '${deps[i].id}' (${a}) and '${deps[j].id}' (${b}) overlap — registration refused (R3, DEC-20261107-02)`;
      }
      const conventional = `external/${deps[j].id}`;
      if (overlaps(a, conventional) && b !== conventional) {
        return `install_dir collision: '${deps[i].id}' (${a}) occupies '${conventional}', the conventional path of entry '${deps[j].id}' — registration refused (R3, DEC-20261107-02)`;
      }
    }
  }
  return null;
}

/**
 * Variant seeds EXTEND the common seed (D1): merge on `id`, variant may add
 * entries, not redefine L1 semantics. File-level overlay (variant file wins)
 * already happened upstream of this function for delivered manifests; this
 * merge exists for the seed-composition path and tests. On an id collision the
 * variant entry wins (the variant's template file is authoritative for that id).
 * The merged schema version is the higher of the two inputs.
 */
export function mergeExternalDepsManifests(common: ExternalDepsManifest, variant: ExternalDepsManifest | null): ExternalDepsManifest {
  if (!variant) return { schema_version: common.schema_version, dependencies: [...common.dependencies] };
  const byId = new Map<string, ExternalDepEntry>();
  for (const dep of common.dependencies) byId.set(dep.id, dep);
  for (const dep of variant.dependencies) byId.set(dep.id, dep);
  const schema_version = (Math.max(common.schema_version, variant.schema_version) as ExternalDepsSchemaVersion);
  return { schema_version, dependencies: [...byId.values()] };
}

// ── License policy (standard §5.4 + Addendum A.1 — R2, DEC-20261107-02) ───────

/**
 * THE single source of truth for the license gate. Ids are matched
 * case-insensitively. Anything not listed is DENY (fail closed). A change here
 * is a reviewed L1 release with a decision record — never a per-project edit.
 */
export const EXTERNAL_DEP_LICENSE_POLICY = {
  allow: [
    'MIT', 'MIT-0', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', '0BSD',
    'Zlib', 'Unlicense', 'CC0-1.0', 'PSF-2.0', 'BSL-1.0',
  ],
  review: [
    'MPL-2.0', 'LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only',
    'LGPL-3.0-or-later', 'EPL-2.0',
  ],
  /** GPL used ONLY as a separate process — admitted only with a decision record
   *  attesting standalone use; without one it is linking GPL (deny). */
  reviewStandalone: [
    'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
  ],
  /** Named for clarity in messages; every unlisted id is deny regardless. */
  denyExamples: ['AGPL-3.0-only', 'AGPL-3.0-or-later', 'SSPL-1.0', 'BUSL-1.1', 'NOASSERTION'],
} as const;

export type LicenseClass = 'allow' | 'review' | 'review-standalone' | 'deny';
const CLASS_RANK: Record<LicenseClass, number> = { allow: 0, review: 1, 'review-standalone': 2, deny: 3 };

/** Classify ONE SPDX id (no operators). */
export function classifyLicenseId(id: string): LicenseClass {
  const k = id.trim().toLowerCase();
  const inList = (list: readonly string[]) => list.some((x) => x.toLowerCase() === k);
  if (inList(EXTERNAL_DEP_LICENSE_POLICY.allow)) return 'allow';
  if (inList(EXTERNAL_DEP_LICENSE_POLICY.review)) return 'review';
  if (inList(EXTERNAL_DEP_LICENSE_POLICY.reviewStandalone)) return 'review-standalone';
  return 'deny';
}

/**
 * Classify an SPDX id or expression (standard §5.4): `OR` takes the MOST
 * permissive member; `AND` / `WITH` (or a mix) take the STRICTEST member. The
 * token after `WITH` is an exception id, not a license, and is not classified.
 */
export function classifyLicenseExpression(expr: string): { class: LicenseClass; members: string[] } {
  const tokens = expr.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
  const members: string[] = [];
  const ops = new Set<string>();
  for (let i = 0; i < tokens.length; i++) {
    const up = tokens[i].toUpperCase();
    if (up === 'OR' || up === 'AND' || up === 'WITH') {
      ops.add(up);
      if (up === 'WITH') i++; // skip the exception id
      continue;
    }
    members.push(tokens[i]);
  }
  if (members.length === 0) return { class: 'deny', members };
  const classes = members.map(classifyLicenseId);
  const onlyOr = ops.size === 1 && ops.has('OR');
  const pick = onlyOr
    ? classes.reduce((a, b) => (CLASS_RANK[a] <= CLASS_RANK[b] ? a : b))
    : classes.reduce((a, b) => (CLASS_RANK[a] >= CLASS_RANK[b] ? a : b));
  return { class: pick, members };
}

export type GateSeverity = 'pass' | 'warn' | 'fail';

export interface LicenseVerdict {
  id: string;
  license: string | null;
  class: LicenseClass | null;
  severity: GateSeverity;
  message: string;
}

/** Apply the license gate to one entry (standard §5.4 / Addendum A.1). */
export function evaluateLicensePolicy(entry: Pick<ExternalDepEntry, 'id' | 'license' | 'license_decision'>): LicenseVerdict {
  if (!entry.license) {
    return { id: entry.id, license: null, class: null, severity: 'fail', message: `${entry.id}: license undeclared — migrate the manifest to schema v2 and declare the SPDX license (standard §5.2)` };
  }
  const { class: cls } = classifyLicenseExpression(entry.license);
  const decided = typeof entry.license_decision === 'string' && entry.license_decision.length > 0;
  switch (cls) {
    case 'allow':
      return { id: entry.id, license: entry.license, class: cls, severity: 'pass', message: `${entry.id}: ${entry.license} — allow` };
    case 'review':
      return decided
        ? { id: entry.id, license: entry.license, class: cls, severity: 'pass', message: `${entry.id}: ${entry.license} — review class, admitted by ${entry.license_decision}` }
        : { id: entry.id, license: entry.license, class: cls, severity: 'warn', message: `${entry.id}: ${entry.license} — review class without license_decision (record a decision and set license_decision)` };
    case 'review-standalone':
      return decided
        ? { id: entry.id, license: entry.license, class: cls, severity: 'pass', message: `${entry.id}: ${entry.license} — standalone-process GPL, admitted by ${entry.license_decision}` }
        : { id: entry.id, license: entry.license, class: cls, severity: 'fail', message: `${entry.id}: ${entry.license} — GPL without a license_decision attesting separate-process use is treated as linking GPL (deny; R2, DEC-20261107-02)` };
    default:
      return { id: entry.id, license: entry.license, class: 'deny', severity: 'fail', message: `${entry.id}: ${entry.license} — deny class (AGPL / linking GPL / SSPL / BUSL / NOASSERTION / unknown id); no manifest override — only a reviewed change to EXTERNAL_DEP_LICENSE_POLICY can admit it` };
  }
}

/**
 * R3 install-dir convention (standard Addendum A.2): install_dir must be
 * exactly `external/<id>`. A NEW entry (no recorded commit) that breaks it
 * FAILs (registration refused); an installed entry is grandfathered (WARN).
 */
export function evaluateInstallDirConvention(entry: Pick<ExternalDepEntry, 'id' | 'install_dir' | 'commit'>): { severity: GateSeverity; message: string } {
  const expected = `external/${entry.id}`;
  if (normalizeRel(entry.install_dir) === expected) return { severity: 'pass', message: `${entry.id}: install_dir ${expected}` };
  if (entry.commit) {
    return { severity: 'warn', message: `${entry.id}: install_dir '${entry.install_dir}' is not ${expected} — grandfathered (already installed); move it on the next pin change` };
  }
  return { severity: 'fail', message: `${entry.id}: install_dir '${entry.install_dir}' is not ${expected} — a new entry must use the convention; registration refused (R3, DEC-20261107-02)` };
}

/**
 * E5 pre-install gate (standard §5.4): the license gate and the R3 convention
 * combined. `ok=false` means the entry must NOT be cloned.
 */
export function preInstallGate(entry: ExternalDepEntry): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const lic = evaluateLicensePolicy(entry);
  if (lic.severity === 'fail') reasons.push(lic.message);
  const conv = evaluateInstallDirConvention(entry);
  if (conv.severity === 'fail') reasons.push(conv.message);
  return { ok: reasons.length === 0, reasons };
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
  // T-20261108-002 non-git executor arm (port of co-work #38): the same
  // shell-free argv-array spawnSync as every other subprocess here; no shell
  // is ever involved, so the v1 safety posture holds unchanged. The
  // install_dir is created first; there is no .git refresh analogue — a
  // re-run simply re-executes the pinned command (idempotent) and no commit
  // is resolved.
  if (argv[0] !== 'git') {
    mkdirSync(resolve(projectDir, entry.install_dir), { recursive: true });
    const run = spawnSync(argv[0], argv.slice(1), { cwd: projectDir, encoding: 'utf8', timeout: 600_000 });
    if (run.error || run.status !== 0) {
      return { status: 'failed', error: `install failed: ${run.stderr || (run.error ? String(run.error) : `exit ${run.status}`)}` };
    }
    return { status: 'installed' };
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
export function fetchProjectExternalDeps(projectDir: string, opts: { strict?: boolean; dryRun?: boolean; allowLocalRepos?: boolean; onlyIds?: string[] } = {}): FetchProjectResult {
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
  const selected = opts.onlyIds && opts.onlyIds.length > 0
    ? manifest.dependencies.filter((d) => opts.onlyIds!.includes(d.id))
    : manifest.dependencies;
  for (const dep of selected) {
    // E5 (standard §5.4): license gate + R3 convention BEFORE any clone — a
    // deny-class (or license-undeclared) dependency never reaches the disk.
    const gate = preInstallGate(dep);
    if (!gate.ok) {
      result.results.push({ id: dep.id, ok: false, status: 'skipped', error: `not cloned — pre-install gate: ${gate.reasons.join('; ')}` });
      if (opts.strict) result.ok = false;
      continue;
    }
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

  result.gitignoreAppended = ensureGitignoreCoverage(projectDir, selected.map((d) => d.install_dir), { dryRun: opts.dryRun }).appended;
  return result;
}

// ── Verify (standard §5.3 — V1-V9; backs scripts/external-deps.ts verify) ─────

export interface VerifyFinding {
  check: 'V1' | 'V2' | 'V3' | 'V3a' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9';
  id: string | null;
  severity: GateSeverity;
  message: string;
}

/** V8 (as-is): tracked upstream files unmodified. Untracked files are ignored —
 *  consumers may write run artifacts into the clone (standard §5.3). */
export function checkAsIs(entry: ExternalDepEntry, projectDir: string): { checked: boolean; clean: boolean; modified: string[]; error?: string } {
  const dest = resolve(projectDir, entry.install_dir);
  if (!existsSync(join(dest, '.git'))) return { checked: false, clean: true, modified: [], error: 'no clone present' };
  const st = git(['status', '--porcelain', '--untracked-files=no'], { cwd: dest });
  if (!st.ok) return { checked: false, clean: true, modified: [], error: `git status failed: ${st.stderr}` };
  const modified = st.stdout.split('\n').map((l) => l.trim()).filter(Boolean);
  return { checked: true, clean: modified.length === 0, modified };
}

/** V9: upstream LICENSE* / COPYING* kept at the clone root (DEC-20261106-04 cond. 3). */
export function checkUpstreamLicenseFile(entry: ExternalDepEntry, projectDir: string): { checked: boolean; present: boolean; files: string[] } {
  const dest = resolve(projectDir, entry.install_dir);
  if (!existsSync(dest)) return { checked: false, present: false, files: [] };
  let names: string[] = [];
  try { names = readdirSync(dest); } catch { return { checked: false, present: false, files: [] }; }
  const files = names.filter((n) => /^(LICENSE|LICENCE|COPYING)/i.test(n));
  return { checked: true, present: files.length > 0, files };
}

/** V7 tag half: `refs/tags/<pin>` resolves inside the clone. */
export function checkPinTag(entry: ExternalDepEntry, projectDir: string): { checked: boolean; resolves: boolean } {
  const dest = resolve(projectDir, entry.install_dir);
  if (!existsSync(join(dest, '.git'))) return { checked: false, resolves: false };
  const r = git(['rev-parse', '--verify', '--quiet', `refs/tags/${entry.pin}^{commit}`], { cwd: dest });
  return { checked: true, resolves: r.ok };
}

function stripHashComments(text: string): string {
  return text.split(/\r?\n/).map((l) => l.replace(/(^|\s)#.*$/, '')).join('\n');
}

function stripSlashComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').split(/\r?\n/).map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * V5 (⚠️ heuristic, name match only): excluded components must stay absent
 * from project-owned install surfaces — root requirements*.txt, pyproject.toml,
 * package.json dependency maps, and the adapter file. Comments are stripped
 * first (the adapter documents its own exclusion in prose).
 */
export function scanExcludedComponents(entry: ExternalDepEntry, projectDir: string): Array<{ component: string; file: string }> {
  const hits: Array<{ component: string; file: string }> = [];
  const comps = entry.excluded_components ?? [];
  if (comps.length === 0) return hits;
  const surfaces: Array<{ rel: string; text: string }> = [];
  let rootNames: string[] = [];
  try { rootNames = readdirSync(projectDir); } catch { /* unreadable root */ }
  for (const n of rootNames) {
    if (/^requirements.*\.txt$/i.test(n) || n === 'pyproject.toml') {
      try { surfaces.push({ rel: n, text: stripHashComments(readFileSync(join(projectDir, n), 'utf8')) }); } catch { /* skip */ }
    }
  }
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      const keys: string[] = [];
      for (const k of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        const v = pkg[k];
        if (isPlainObject(v)) keys.push(...Object.keys(v));
      }
      surfaces.push({ rel: 'package.json', text: keys.join('\n') });
    } catch { /* malformed package.json — not this check's concern */ }
  }
  if (entry.adapter) {
    const ap = join(projectDir, entry.adapter);
    if (existsSync(ap)) {
      try {
        const raw = readFileSync(ap, 'utf8');
        surfaces.push({ rel: entry.adapter, text: /\.(py|sh|toml|txt)$/i.test(entry.adapter) ? stripHashComments(raw) : stripSlashComments(raw) });
      } catch { /* skip */ }
    }
  }
  for (const c of comps) {
    const re = new RegExp(`(^|[^A-Za-z0-9_-])${escapeRe(c.name)}($|[^A-Za-z0-9_-])`, 'im');
    for (const s of surfaces) if (re.test(s.text)) hits.push({ component: c.name, file: s.rel });
  }
  return hits;
}

/**
 * Run the standard §5.3 verify checks over a project. `manifestOnly` limits
 * the run to the offline manifest checks (V1-V5 + V3a) — the commit-time and
 * CI legs (E3/E4). Never touches the network.
 */
export function verifyProjectExternalDeps(projectDir: string, opts: { manifestOnly?: boolean; allowLocalRepos?: boolean } = {}): { findings: VerifyFinding[]; manifest: ExternalDepsManifest | null; manifestPresent: boolean } {
  const findings: VerifyFinding[] = [];
  const manifestPath = join(projectDir, 'external-deps.json');
  if (!existsSync(manifestPath)) {
    return { findings: [{ check: 'V1', id: null, severity: 'pass', message: 'no external-deps.json — nothing to verify' }], manifest: null, manifestPresent: false };
  }
  let manifest: ExternalDepsManifest;
  try {
    manifest = parseExternalDepsManifest(readFileSync(manifestPath, 'utf8'), 'external-deps.json', { allowLocalRepos: opts.allowLocalRepos === true });
  } catch (err) {
    findings.push({ check: 'V1', id: null, severity: 'fail', message: (err as Error).message });
    return { findings, manifest: null, manifestPresent: true };
  }
  findings.push(isLegacyV1WithEntries(manifest)
    ? { check: 'V1', id: null, severity: 'warn', message: 'schema v1 with dependencies — license undeclared; migrate to v2 (the next upgrade visit migrates it)' }
    : { check: 'V1', id: null, severity: 'pass', message: `manifest parses (schema v${manifest.schema_version}, ${manifest.dependencies.length} dependenc${manifest.dependencies.length === 1 ? 'y' : 'ies'})` });

  const gitignore = readGitignore(projectDir);
  for (const dep of manifest.dependencies) {
    const lic = evaluateLicensePolicy(dep);
    findings.push({ check: 'V2', id: dep.id, severity: lic.severity, message: lic.message });
    findings.push(isGitignoreCovered(gitignore, dep.install_dir)
      ? { check: 'V3', id: dep.id, severity: 'pass', message: `${dep.id}: ${dep.install_dir} covered by .gitignore` }
      : { check: 'V3', id: dep.id, severity: 'fail', message: `${dep.id}: ${dep.install_dir} is NOT covered by .gitignore — an external clone must never be committed (D5)` });
    const conv = evaluateInstallDirConvention(dep);
    findings.push({ check: 'V3a', id: dep.id, severity: conv.severity, message: conv.message });
    if (dep.adapter) {
      findings.push(existsSync(join(projectDir, dep.adapter))
        ? { check: 'V4', id: dep.id, severity: 'pass', message: `${dep.id}: adapter ${dep.adapter} present` }
        : { check: 'V4', id: dep.id, severity: 'fail', message: `${dep.id}: adapter ${dep.adapter} is missing — the single coupling file must exist (standard §5.2)` });
    }
    const hits = scanExcludedComponents(dep, projectDir);
    if ((dep.excluded_components ?? []).length > 0) {
      findings.push(hits.length === 0
        ? { check: 'V5', id: dep.id, severity: 'pass', message: `${dep.id}: excluded components absent from project install surfaces` }
        : { check: 'V5', id: dep.id, severity: 'fail', message: `${dep.id}: excluded component(s) named on a project install surface (heuristic name match): ${hits.map((h) => `${h.component} in ${h.file}`).join(', ')}` });
    }
    if (opts.manifestOnly) continue;

    const dest = resolve(projectDir, dep.install_dir);
    if (!existsSync(join(dest, '.git'))) {
      findings.push({ check: 'V6', id: dep.id, severity: 'warn', message: `${dep.id}: no clone at ${dep.install_dir} — run: bun scripts/external-deps.ts install --id ${dep.id}` });
      continue;
    }
    findings.push({ check: 'V6', id: dep.id, severity: 'pass', message: `${dep.id}: clone present at ${dep.install_dir}` });
    const drift = checkPinDrift(dep, projectDir);
    const tag = checkPinTag(dep, projectDir);
    if (!tag.resolves) {
      findings.push({ check: 'V7', id: dep.id, severity: 'fail', message: `${dep.id}: refs/tags/${dep.pin} does not resolve in the clone — pin must be a release tag` });
    } else if (drift.checked && drift.drifted) {
      findings.push({ check: 'V7', id: dep.id, severity: 'fail', message: `${dep.id}: clone HEAD ${drift.resolved?.slice(0, 12)} != recorded commit ${dep.commit?.slice(0, 12)}` });
    } else {
      findings.push({ check: 'V7', id: dep.id, severity: 'pass', message: `${dep.id}: HEAD at ${dep.pin}${dep.commit ? ` (${dep.commit.slice(0, 12)})` : ''}` });
    }
    const asIs = checkAsIs(dep, projectDir);
    findings.push(asIs.clean
      ? { check: 'V8', id: dep.id, severity: 'pass', message: `${dep.id}: no tracked upstream file modified (as-is)` }
      : { check: 'V8', id: dep.id, severity: 'fail', message: `${dep.id}: tracked upstream files modified — the clone must be consumed as-is: ${asIs.modified.slice(0, 5).join(', ')}${asIs.modified.length > 5 ? ` (+${asIs.modified.length - 5} more)` : ''}` });
    const lf = checkUpstreamLicenseFile(dep, projectDir);
    findings.push(lf.present
      ? { check: 'V9', id: dep.id, severity: 'pass', message: `${dep.id}: upstream ${lf.files.join(', ')} present` }
      : { check: 'V9', id: dep.id, severity: 'fail', message: `${dep.id}: no LICENSE*/COPYING* at the clone root — the upstream license file must be kept (DEC-20261106-04 condition 3)` });
  }
  return { findings, manifest, manifestPresent: true };
}

/**
 * v1 → v2 migration of a PARSED v1 manifest (standard §5.6): for an id in the
 * seed, take the v2 contract fields from the seed and keep everything else
 * (the project's pin/commit are its facts); an id not in the seed keeps its
 * entry with NO license (never invent an attestation — verify FAILs until a
 * human adds it). Returns the raw document to write (schema_version 2).
 */
export function migrateManifestV1ToV2(projectRaw: string, seed: ExternalDepsManifest): { document: Record<string, unknown>; migrated: string[]; unattested: string[] } {
  const doc = JSON.parse(projectRaw) as Record<string, unknown>;
  const deps = Array.isArray(doc['dependencies']) ? doc['dependencies'] as Array<Record<string, unknown>> : [];
  const seedById = new Map(seed.dependencies.map((d) => [d.id, d] as const));
  const migrated: string[] = [];
  const unattested: string[] = [];
  for (const dep of deps) {
    const id = typeof dep['id'] === 'string' ? dep['id'] : '';
    const s = seedById.get(id);
    if (s && s.license) {
      for (const f of V2_CONTRACT_FIELDS) {
        const v = (s as unknown as Record<string, unknown>)[f];
        if (v !== undefined) dep[f] = v;
      }
      migrated.push(id);
    } else {
      unattested.push(id || '<no id>');
    }
  }
  const out: Record<string, unknown> = {};
  if (typeof doc['$comment'] === 'string') out['$comment'] = doc['$comment'];
  out['schema_version'] = EXTERNAL_DEPS_SCHEMA_VERSION;
  out['dependencies'] = deps;
  return { document: out, migrated, unattested };
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
