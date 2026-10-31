// @version 1.0.0
// generator-manifest.ts — loader + runner for project-authored generator
// manifests (`scripts/<variant>/generators.json`).
//
// Spec: docs/designs/2026-10-31-variant-generators-design.md (U-20261029-004).
// A variant project may declare derived-projection generators that dev-sync
// runs BEFORE the audit gate (the step-3.85 regeneration family precedent,
// wired as dev-sync step 3.86) and stages their outputs as pipeline-generated
// files. Absent or empty manifest = documented no-op (zero behavior change
// for every project that does not adopt the convention). The generator's
// `--check` form REMAINS the audit's drift gate (audit-variant.ts): this
// module regenerates; it never weakens a gate.
//
// Security constraints (design §7 — binding):
//   1. Array-form spawn only (no shell string, no `sh -c`, no `eval`);
//      argv[0] must be exactly `bun`.
//   2. Path containment — command paths, outputs and sources must be
//      project-relative and traversal-free; the script path (argv[1]) must
//      exist and its realpath must stay inside the project root at
//      declaration-load time (symlink escape rejected).
//   3. cwd pinned to the project root for every spawn.
//   4. No environment fabrication — children inherit the pipeline env; this
//      module passes no env.
//   5. Failure output is secret-scrubbed (lines matching
//      key|token|secret|password|credential value assignments are elided)
//      and truncated to the last 20 lines before any log row.
//   6. Bounded manifest — > 16 generators or > 8 outputs per generator is a
//      validation error, never a silent truncation.
//
// Consumed by: scripts/dev-sync.ts (step 3.86),
//              scripts/validate-templates.ts (additive generator-manifest arm).
// Unit-pinned by tests/unit/generator-manifest.test.ts.

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Max generators per manifest (design §7.6 — bounds runaway pipelines). */
export const MAX_GENERATORS = 16;
/** Max declared outputs per generator (design §7.6). */
export const MAX_OUTPUTS = 8;
/** Max lines of combined failure output shown in a FAIL row (design §7.5). */
export const FAILURE_OUTPUT_LINES = 20;
/** Only this argv[0] is accepted (design §7.2). */
export const REQUIRED_ARGV0 = 'bun';

/** Generator name: echoed into `[generator:<name>]` log rows, so the charset is restricted. */
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export interface GeneratorEntry {
  name: string;
  /** argv array; command[0] must be `bun`, command[1] the project-relative script path. */
  command: string[];
  /** Project-relative paths that must exist after a successful run; staged by the pipeline. */
  outputs: string[];
  /** Advisory documentation only (future selective re-runs) — NOT a dependency tracker. */
  sources: string[];
}

export interface GeneratorManifest {
  version: number;
  generators: GeneratorEntry[];
}

export interface LoadedGeneratorManifest {
  /** Absolute path of the generators.json file. */
  manifestPath: string;
  /** Absolute path of the declaring directory (`scripts/<variant>/`). */
  variantDir: string;
  /** The declaring directory name (the variant name by convention). */
  dirName: string;
  manifest: GeneratorManifest;
}

export interface GeneratorManifestError {
  manifestPath: string;
  message: string;
}

export interface GeneratorManifestLoadResult {
  manifests: LoadedGeneratorManifest[];
  errors: GeneratorManifestError[];
}

export type ParseResult =
  | { ok: true; manifest: GeneratorManifest }
  | { ok: false; error: string };

/** Default spawn adapter over Bun.spawnSync (array-form, piped, no env passed). */
export type SpawnSyncFn = (
  cmd: string[],
  opts: { cwd: string },
) => { exitCode: number; stdout: string; stderr: string };

function defaultSpawnSync(cmd: string[], opts: { cwd: string }): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd: opts.cwd, stdout: 'pipe', stderr: 'pipe' });
  return {
    exitCode: proc.exitCode ?? (proc.success ? 0 : 1),
    stdout: proc.stdout ? proc.stdout.toString() : '',
    stderr: proc.stderr ? proc.stderr.toString() : '',
  };
}

// ---------------------------------------------------------------------------
// Pure validation (no fs)
// ---------------------------------------------------------------------------

/**
 * Lexical path containment check (design §7.2): the declared path must be
 * non-empty, project-relative (no absolute forms), traversal-free (no `..`
 * segments under either separator), and must not resolve to the project root
 * itself. Pure — no fs access.
 *
 * @returns an error message, or null when the path is contained.
 */
export function pathContainmentError(projectRoot: string, declared: string): string | null {
  if (typeof declared !== 'string' || declared.trim().length === 0) {
    return 'path is empty or not a string';
  }
  if (path.isAbsolute(declared)) {
    return `absolute path rejected: ${declared}`;
  }
  const segments = declared.split(/[\\/]+/);
  if (segments.some((s) => s === '..')) {
    return `path traversal ('..') rejected: ${declared}`;
  }
  const resolved = path.resolve(projectRoot, declared);
  const rootResolved = path.resolve(projectRoot);
  if (resolved === rootResolved) {
    return `path resolves to the project root itself: ${declared}`;
  }
  if (!resolved.startsWith(rootResolved + path.sep)) {
    return `path escapes the project root: ${declared}`;
  }
  return null;
}

function validateStringArray(value: unknown, field: string): string | null {
  if (!Array.isArray(value)) {
    return `${field} must be an array`;
  }
  for (const item of value) {
    if (typeof item !== 'string' || item.length === 0) {
      return `${field} must contain only non-empty strings`;
    }
  }
  return null;
}

/**
 * Strict pure parse of a generators.json manifest (design §3/§7). The empty
 * object `{}` is the canonical EMPTY manifest (valid, zero generators — the
 * documented no-op form, design §5). Everything else must carry
 * `version: 1` and a well-formed `generators` array.
 *
 * @param content raw file text
 * @returns the parsed manifest, or a validation error naming the violation
 */
export function parseGeneratorManifest(content: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (e) {
    return { ok: false, error: `malformed JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'manifest must be a JSON object' };
  }
  const keys = Object.keys(raw as Record<string, unknown>);
  if (keys.length === 0) {
    // Empty manifest = documented no-op (design §5).
    return { ok: true, manifest: { version: 1, generators: [] } };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return { ok: false, error: `unsupported manifest version: ${JSON.stringify(obj.version)} (expected 1)` };
  }
  if (!Array.isArray(obj.generators)) {
    return { ok: false, error: 'generators must be an array' };
  }
  if (obj.generators.length > MAX_GENERATORS) {
    return { ok: false, error: `too many generators: ${obj.generators.length} (max ${MAX_GENERATORS})` };
  }
  const seenNames = new Set<string>();
  const generators: GeneratorEntry[] = [];
  for (let i = 0; i < obj.generators.length; i++) {
    const entry = obj.generators[i];
    const label = `generators[${i}]`;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: `${label} must be an object` };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== 'string' || !NAME_PATTERN.test(e.name)) {
      return {
        ok: false,
        error: `${label}.name must match ${NAME_PATTERN.source} (got ${JSON.stringify(e.name)})`,
      };
    }
    if (seenNames.has(e.name)) {
      return { ok: false, error: `duplicate generator name: ${e.name}` };
    }
    seenNames.add(e.name);
    if (!Array.isArray(e.command) || e.command.length < 2) {
      return { ok: false, error: `${label}.command must be a non-empty argv array (["bun", "<script>", ...])` };
    }
    const cmdErr = validateStringArray(e.command, `${label}.command`);
    if (cmdErr) return { ok: false, error: `${label}: ${cmdErr}` };
    if (e.command[0] !== REQUIRED_ARGV0) {
      return { ok: false, error: `${label}.command argv[0] must be "${REQUIRED_ARGV0}" (got ${JSON.stringify(e.command[0])})` };
    }
    // Script path (argv[1]) lexical containment (design §7.2): absolute paths
    // and `..` traversal are rejected in the pure parse; existence + symlink
    // containment are the loader's fs-bound checks (validateManifestAgainstRoot).
    const scriptPathErr = pathContainmentError('.', e.command[1]);
    if (scriptPathErr) {
      return { ok: false, error: `${label}.command script path: ${scriptPathErr}` };
    }
    if (!Array.isArray(e.outputs) || e.outputs.length === 0) {
      return { ok: false, error: `${label}.outputs must be a non-empty array of project-relative paths` };
    }
    if (e.outputs.length > MAX_OUTPUTS) {
      return { ok: false, error: `${label}: too many outputs: ${e.outputs.length} (max ${MAX_OUTPUTS})` };
    }
    const outputs: string[] = e.outputs as string[];
    for (const o of outputs) {
      const err = pathContainmentError('.', o);
      if (err) return { ok: false, error: `${label}.outputs: ${err}` };
    }
    if (e.sources === undefined) {
      return { ok: false, error: `${label}.sources is required (use [] when the generator has no declared sources)` };
    }
    const srcErr = validateStringArray(e.sources, `${label}.sources`);
    if (srcErr) return { ok: false, error: `${label}: ${srcErr}` };
    const sources = e.sources as string[];
    for (const s of sources) {
      const err = pathContainmentError('.', s);
      if (err) return { ok: false, error: `${label}.sources: ${err}` };
    }
    generators.push({
      name: e.name,
      command: e.command as string[],
      outputs,
      sources,
    });
  }
  return { ok: true, manifest: { version: 1, generators } };
}

// ---------------------------------------------------------------------------
// Loader (fs-bound: discovery, containment vs root, existence, realpath)
// ---------------------------------------------------------------------------

function realpathSafe(p: string): string | null {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * fs-bound per-generator checks the pure parser cannot do (design §7.2):
 * the script path (argv[1]) must exist and its realpath must stay inside the
 * project root (symlink escape rejected at declaration-load time). Outputs
 * and sources are re-checked lexically against the concrete root; an output
 * that already exists on disk also gets the realpath containment check.
 *
 * @returns violation messages (empty array = clean)
 */
export function validateManifestAgainstRoot(projectRoot: string, manifest: GeneratorManifest): string[] {
  const errors: string[] = [];
  const rootReal = realpathSafe(projectRoot) ?? path.resolve(projectRoot);
  for (const gen of manifest.generators) {
    const scriptDeclared = gen.command[1];
    const scriptLexErr = pathContainmentError(projectRoot, scriptDeclared);
    if (scriptLexErr) {
      errors.push(`[${gen.name}] command script path: ${scriptLexErr}`);
      continue;
    }
    const scriptAbs = path.resolve(projectRoot, scriptDeclared);
    if (!fs.existsSync(scriptAbs)) {
      errors.push(`[${gen.name}] command script does not exist: ${scriptDeclared}`);
      continue;
    }
    const scriptReal = realpathSafe(scriptAbs);
    if (scriptReal && !scriptReal.startsWith(rootReal + path.sep)) {
      errors.push(`[${gen.name}] command script escapes the project root through a symlink: ${scriptDeclared}`);
    }
    for (const o of gen.outputs) {
      const lexErr = pathContainmentError(projectRoot, o);
      if (lexErr) {
        errors.push(`[${gen.name}] output: ${lexErr}`);
        continue;
      }
      const abs = path.resolve(projectRoot, o);
      const real = realpathSafe(abs);
      if (real && !real.startsWith(rootReal + path.sep)) {
        errors.push(`[${gen.name}] output escapes the project root through a symlink: ${o}`);
      }
    }
    for (const s of gen.sources) {
      const lexErr = pathContainmentError(projectRoot, s);
      if (lexErr) errors.push(`[${gen.name}] source: ${lexErr}`);
    }
  }
  return errors;
}

/**
 * Discover and load every `scripts/<dir>/generators.json` manifest under the
 * project root (immediate subdirectories; the canonical location is
 * `scripts/<variant>/generators.json`). Generator names must be unique
 * across ALL discovered manifests (they label the pipeline's FAIL rows).
 *
 * Absent manifest → `{ manifests: [], errors: [] }` — the documented no-op.
 * Any validation error is returned in `errors` and must be surfaced loudly
 * by the caller (strict parse — never silently skipped).
 */
export function loadGeneratorManifests(projectRoot: string): GeneratorManifestLoadResult {
  const scriptsDir = path.join(projectRoot, 'scripts');
  if (!fs.existsSync(scriptsDir)) {
    return { manifests: [], errors: [] };
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  } catch {
    return { manifests: [], errors: [] };
  }
  const manifests: LoadedGeneratorManifest[] = [];
  const errors: GeneratorManifestError[] = [];
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
  for (const dirName of dirs) {
    const variantDir = path.join(scriptsDir, dirName);
    const manifestPath = path.join(variantDir, 'generators.json');
    if (!fs.existsSync(manifestPath)) continue;
    let content: string;
    try {
      content = fs.readFileSync(manifestPath, 'utf-8');
    } catch (e) {
      errors.push({ manifestPath, message: `unreadable: ${e instanceof Error ? e.message : String(e)}` });
      continue;
    }
    const parsed = parseGeneratorManifest(content);
    if (!parsed.ok) {
      errors.push({ manifestPath, message: parsed.error });
      continue;
    }
    const rootErrors = validateManifestAgainstRoot(projectRoot, parsed.manifest);
    if (rootErrors.length > 0) {
      // Strict: a manifest with any containment/existence violation is not
      // loaded at all (the caller fails loudly on errors — nothing from it runs).
      for (const message of rootErrors) {
        errors.push({ manifestPath, message });
      }
      continue;
    }
    manifests.push({ manifestPath, variantDir, dirName, manifest: parsed.manifest });
  }
  // Cross-manifest duplicate-name rejection (names label FAIL rows — ambiguity is a config error).
  const owner = new Map<string, string>();
  for (const m of manifests) {
    for (const gen of m.manifest.generators) {
      const prior = owner.get(gen.name);
      if (prior && prior !== m.manifestPath) {
        errors.push({
          manifestPath: m.manifestPath,
          message: `duplicate generator name "${gen.name}" across manifests (${prior} and ${m.manifestPath})`,
        });
      } else {
        owner.set(gen.name, m.manifestPath);
      }
    }
  }
  return { manifests, errors };
}

// ---------------------------------------------------------------------------
// Secret scrubbing (design §7.5)
// ---------------------------------------------------------------------------

const SECRET_WORD_RE = /(?:^|[^a-zA-Z])(?:key|token|secret|password|credential)(?![a-zA-Z])/i;
const VALUE_ASSIGNMENT_RE = /[=:]|=>/;

/**
 * Elide lines that look like secret value assignments (design §7.5): a line
 * mentioning key/token/secret/password/credential AND carrying a value
 * assignment (`=`, `:` or `=>`) is dropped entirely — a failing generator
 * must not become a secret-leak vector in CI logs or PR bodies. Fail-closed:
 * ambiguous lines are dropped, not kept.
 */
export function scrubSecretLines(text: string): { lines: string[]; redacted: number } {
  const lines: string[] = [];
  let redacted = 0;
  for (const line of text.split('\n')) {
    if (SECRET_WORD_RE.test(line) && VALUE_ASSIGNMENT_RE.test(line)) {
      redacted++;
      continue;
    }
    lines.push(line);
  }
  return { lines, redacted };
}

/** Combined stdout+stderr, truncated to the last N lines and secret-scrubbed. */
export function failureOutputDetail(combined: string): { detail: string; redacted: number } {
  const { lines, redacted } = scrubSecretLines(combined);
  const kept = lines.slice(-FAILURE_OUTPUT_LINES);
  return { detail: kept.join('\n'), redacted };
}

// ---------------------------------------------------------------------------
// Runner (design §4/§5 — the dev-sync step body)
// ---------------------------------------------------------------------------

export interface GeneratorRunFailure {
  generator: string;
  /** 'manifest' | 'exit' | 'output-missing' | 'stage' */
  reason: string;
  /** Secret-scrubbed, truncated detail for the FAIL row. */
  detail: string;
}

export interface GeneratorRunResult {
  ok: boolean;
  /** Generators actually executed (excludes runs skipped due to an earlier abort). */
  ran: number;
  /** Project-relative paths staged via git add. */
  staged: string[];
  failures: GeneratorRunFailure[];
}

export interface GeneratorRunOptions {
  projectRoot: string;
  /** Injectable for tests; defaults to Bun.spawnSync (array-form, no shell). */
  spawnSync?: SpawnSyncFn;
  /** Injectable for tests; defaults to array-form `git add <path>` (cwd = projectRoot). */
  stage?: (projectRoot: string, relPath: string) => { exitCode: number; stderr?: string };
  /** Injectable log sink; defaults to console.log. */
  log?: (line: string) => void;
}

function defaultStage(projectRoot: string, relPath: string): { exitCode: number; stderr?: string } {
  const proc = Bun.spawnSync(['git', 'add', relPath], { cwd: projectRoot, stdout: 'pipe', stderr: 'pipe' });
  return {
    exitCode: proc.exitCode ?? (proc.success ? 0 : 1),
    stderr: proc.stderr ? proc.stderr.toString() : '',
  };
}

/**
 * Run every declared generator from every discovered manifest, in order,
 * then verify + stage declared outputs (design §4). Loud semantics:
 *
 * - Manifest load/validation errors → FAIL rows (reason 'manifest'), ok=false,
 *   nothing executes.
 * - Non-zero generator exit → `[generator:<name>]` FAIL row naming the
 *   generator and exit code plus the last 20 secret-scrubbed lines of combined
 *   output; the step aborts immediately — no partial staging from the failed
 *   generator and later generators never run.
 * - A declared output missing after a successful exit → same loud FAIL
 *   (staging integrity, design §5).
 * - Absent or empty manifest → clean no-op (ok=true, ran=0).
 */
export function runDeclaredGenerators(options: GeneratorRunOptions): GeneratorRunResult {
  const { projectRoot } = options;
  const spawn = options.spawnSync ?? defaultSpawnSync;
  const stage = options.stage ?? defaultStage;
  const log = options.log ?? ((line: string) => console.log(line));

  const result: GeneratorRunResult = { ok: true, ran: 0, staged: [], failures: [] };
  const fail = (f: GeneratorRunFailure): void => {
    result.ok = false;
    result.failures.push(f);
    log(`[generator:${f.generator}] FAIL (${f.reason})${f.detail ? `\n${f.detail}` : ''}`);
  };

  const load = loadGeneratorManifests(projectRoot);
  for (const e of load.errors) {
    fail({ generator: 'manifest', reason: 'manifest', detail: `${e.manifestPath}: ${e.message}` });
  }
  if (!result.ok) return result;
  if (load.manifests.length === 0) return result; // absent/empty = documented no-op

  for (const loaded of load.manifests) {
    for (const gen of loaded.manifest.generators) {
      // Defense in depth: re-verify the script path containment at spawn time
      // (the fs may have changed since the load).
      const scriptErrors = validateManifestAgainstRoot(projectRoot, {
        version: loaded.manifest.version,
        generators: [gen],
      });
      if (scriptErrors.length > 0) {
        fail({ generator: gen.name, reason: 'manifest', detail: scriptErrors.join('\n') });
        return result;
      }
      log(`[generator:${gen.name}] running: ${gen.command.join(' ')} (cwd=${projectRoot})`);
      const proc = spawn(gen.command, { cwd: projectRoot });
      result.ran++;
      if (proc.exitCode !== 0) {
        const combined = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
        const { detail, redacted } = failureOutputDetail(combined);
        const suffix = redacted > 0 ? ` (${redacted} line(s) redacted)` : '';
        fail({
          generator: gen.name,
          reason: 'exit',
          detail: `exit code ${proc.exitCode}${suffix}\n${detail}`,
        });
        return result; // abort — no partial staging, later generators never run
      }
      // Staging integrity: every declared output must exist after a successful exit.
      for (const out of gen.outputs) {
        const abs = path.resolve(projectRoot, out);
        if (!fs.existsSync(abs)) {
          fail({ generator: gen.name, reason: 'output-missing', detail: `declared output missing after exit 0: ${out}` });
          return result;
        }
      }
      for (const out of gen.outputs) {
        const st = stage(projectRoot, out);
        if (st.exitCode !== 0) {
          const { detail } = failureOutputDetail(st.stderr ?? '');
          fail({ generator: gen.name, reason: 'stage', detail: `git add failed for ${out}\n${detail}` });
          return result;
        }
        result.staged.push(out);
      }
      log(`[generator:${gen.name}] OK (staged ${gen.outputs.length} output(s))`);
    }
  }
  return result;
}
