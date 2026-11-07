// @version 1.2.0
// v1.2.0 (2026-11-07, U-20261107-001): zero-delta coverage verification — the
// non-merge one-sided state (scripts/*.ts staged, SCRIPTS.md not staged) no
// longer returns 'proxy-fail' (an unconditional FAIL whose own remedy — "stage
// the updated SCRIPTS.md" — is a no-op when the file's content delta is zero).
// It returns 'verify-staged-coverage' instead: the hook verifies each staged
// script's @version against the SCRIPTS.md registry content the commit will
// actually carry (HEAD content when SCRIPTS.md is unstaged — the zero-delta
// case — and staged content when SCRIPTS.md is staged, the latter already
// re-verified by check 6c), failing only when a staged script is NOT covered.
// New exports: extractFileVersionFromContent,
// parseScriptsMdRegistryVersions (content-based parsers, import-safe — the
// lifecycle-sync-audit.ts originals are file-path based and private),
// evaluateStagedScriptCoverage (the coverage decision, pure + testable), and
// ZERO_DELTA_GATE_NOTICE (observable pass notice, mirrors MERGE_GATE_NOTICE).
// v1.1.0 (2026-10-27, T-20261027-010): parseCheckAErrorsDetailed — Check A
// extraction that PRESERVES the fixData payload ({scriptName, fileVersion,
// registryVersion}) so pre-commit check 6c keeps its actionable "→ Fix:"
// output while finally reading the real AuditResult wire shape. History: 6c
// parsed `parsed.results`, a key that never existed on AuditResult
// ({passed, errors, warnings, registry}) — the content gate was silently dead
// (it never blocked anything). parseCheckAErrors now delegates to the detailed
// variant, so both share one extraction.
// v1.0.0 (T-20261027-009): merge-aware SCRIPTS.md gate for pre-commit check 6.
// Import-safe (pure functions + an injectable audit-runner seam) — pre-commit.ts
// itself runs main() at import and is not importable, so unit tests target this
// module (same pattern as helpers/merge-state.ts for dev-sync).
//   - evaluateScriptsMdGate(input): check 6's decision — pass, apply the
//     staged-file-set proxy (non-merge FAIL), or delegate to the content
//     comparison (merge in progress).
//   - MERGE_GATE_NOTICE: the one-line exemption notice (shared string so the
//     hook's output and the tests cannot drift).
//   - parseCheckAErrors(json) / parseCheckAErrorsDetailed(json): extracts
//     Check A errors from `lifecycle-sync-audit.ts --json` output
//     (AuditResult.errors); the detailed variant keeps fixData.
//   - runScriptsMdContentGate(runAudit): gates on the audit exit code and
//     surfaces Check A details; the runner is injectable for tests.

/**
 * The decision check 6 makes when scripts/*.ts are staged:
 *   - 'pass'                  — no gate needed (SCRIPTS.md staged too, or no
 *                               scripts staged; content parity is re-verified
 *                               by check 6c's Check A blocking either way).
 *   - 'verify-staged-coverage' — non-merge commit with SCRIPTS.md unstaged.
 *                               The staged-file-set proxy cannot distinguish
 *                               "SCRIPTS.md forgotten" from "zero legitimate
 *                               delta" (U-20261107-001: a row already at the
 *                               target version in HEAD never appears in the
 *                               cached name list, so the old unconditional
 *                               FAIL was inescapable). The hook verifies each
 *                               staged script's @version against the registry
 *                               content the commit carries (HEAD rows here)
 *                               and fails only on actual non-coverage.
 *   - 'merge-verify'          — merge in progress: rows may pre-exist on the
 *                               receiving branch (zero SCRIPTS.md delta from
 *                               the merged-in side), so the file-set proxy
 *                               does not apply (T-20261027-009: main→PR #1643
 *                               could not conclude after #1644 landed). Verify
 *                               the content invariant the proxy stands for
 *                               instead via the full Check A comparison.
 */
export type ScriptsMdGateAction = 'pass' | 'verify-staged-coverage' | 'merge-verify';

export function evaluateScriptsMdGate(input: {
  scriptsStagedCount: number;
  scriptsMdStaged: boolean;
  mergeInProgress: boolean;
}): ScriptsMdGateAction {
  if (input.scriptsStagedCount === 0) return 'pass';
  if (input.scriptsMdStaged) return 'pass';
  return input.mergeInProgress ? 'merge-verify' : 'verify-staged-coverage';
}

/**
 * Observable one-line notice emitted when check 6 takes the merge path, so the
 * exemption is visible in hook output (T-20261027-009 requirement 2).
 */
export const MERGE_GATE_NOTICE =
  'check 6: merge in progress — verified via lifecycle Check A content comparison';

/**
 * Observable one-line notice emitted when check 6's zero-delta coverage
 * verification passes (U-20261107-001): scripts were staged without a
 * SCRIPTS.md delta, and every staged script's @version is covered by the HEAD
 * registry rows the commit carries.
 */
export const ZERO_DELTA_GATE_NOTICE =
  'check 6: SCRIPTS.md zero delta — staged script @versions verified against HEAD registry rows';

/**
 * Extract `@version X.Y.Z` from script CONTENT (U-20261107-001).
 * Content-based counterpart of lifecycle-sync-audit.ts's private
 * extractFileVersion — the hook must read the STAGED blob (`git show :path`),
 * not the working-tree file, so the parser has to accept a string.
 * Returns the matched version string, or null when no version header exists.
 */
export function extractFileVersionFromContent(content: string): string | null {
  const match = content.match(/@version\s+([\d.]+)/);
  return match ? match[1] : null;
}

/**
 * Parse the `## Registry` table of a SCRIPTS.md document from CONTENT
 * (U-20261107-001): filename (the backtick-wrapped first column) → version.
 * Content-based counterpart of lifecycle-sync-audit.ts's private
 * parseScriptsMdRegistry, reduced to the one comparison the coverage gate
 * makes (row presence + version). Any row status counts — coverage is about
 * the row existing at the right version, not its lifecycle stage.
 * Same table grammar as the audit-side parser: `## Registry` section, pipe
 * rows, header row with a `script` column, backtick-wrapped filenames,
 * `version` column detected by header name (defaulting to index 3).
 */
export function parseScriptsMdRegistryVersions(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const registryMatch = content.match(/## Registry\r?\n([\s\S]*?)(?:\r?\n## |\s*$)/);
  if (!registryMatch) return result;
  const lines = registryMatch[1].split('\n');

  let versionColIdx = 3;
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((c) => c.trim());
    if (cols[1] === 'script') {
      for (let i = 1; i < cols.length; i++) {
        if (cols[i].toLowerCase() === 'version') versionColIdx = i;
      }
      break;
    }
  }

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 5) continue;
    const rawName = cols[1];
    if (rawName === 'script' || rawName.startsWith('-')) continue;
    if (!rawName.startsWith('`')) continue;
    const filename = rawName.replace(/`/g, '').trim();
    if (!filename) continue;
    const version = cols[versionColIdx] ?? '';
    result.set(filename, version);
  }
  return result;
}

/** Why one staged script failed the coverage check (U-20261107-001). */
export type CoverageFailureReason = 'no-version-header' | 'no-registry-row' | 'version-mismatch';

/** Per-script coverage outcome for one staged script. */
export interface StagedScriptCoverageEntry {
  script: string;
  /** @version from the staged script content; null when no header exists. */
  fileVersion: string | null;
  /** Row version found in the registry content (absent when no row matched). */
  registryVersion?: string;
  covered: boolean;
  reason?: CoverageFailureReason;
}

/**
 * Coverage decision for check 6's zero-delta path (U-20261107-001): every
 * staged script's @version must be covered by the SCRIPTS.md registry content
 * the commit will carry — the STAGED content when SCRIPTS.md is staged, the
 * HEAD content otherwise (a zero-delta file's staged content == HEAD content).
 * The caller supplies that content as `scriptsMdContent` (null when SCRIPTS.md
 * does not exist in the compared source at all) and each staged script's
 * @version (extracted from the staged blob) as `scriptVersions`.
 *
 * Fails only when a staged script is NOT covered: missing @version header,
 * missing registry row (the old proxy's registration invariant, preserved —
 * the whole-registry Check A comparison cannot see unregistered scripts since
 * it iterates rows, not files), or a row at a different version.
 */
export function evaluateStagedScriptCoverage(input: {
  stagedScripts: string[];
  scriptsMdContent: string | null;
  scriptVersions: Record<string, string | null>;
}): { allCovered: boolean; covered: string[]; uncovered: StagedScriptCoverageEntry[] } {
  const rows = input.scriptsMdContent !== null ? parseScriptsMdRegistryVersions(input.scriptsMdContent) : new Map<string, string>();
  const covered: string[] = [];
  const uncovered: StagedScriptCoverageEntry[] = [];

  for (const script of input.stagedScripts) {
    // SCRIPTS.md keys are repo-relative-within-scripts/ (e.g. `hooks/pre-commit.ts`).
    const registryKey = script.replace(/\\/g, '/').replace(/^scripts\//, '');
    const fileVersion = input.scriptVersions[script] ?? null;
    if (fileVersion === null) {
      uncovered.push({ script, fileVersion: null, covered: false, reason: 'no-version-header' });
      continue;
    }
    const registryVersion = rows.get(registryKey);
    if (registryVersion === undefined) {
      uncovered.push({ script, fileVersion, covered: false, reason: 'no-registry-row' });
      continue;
    }
    if (registryVersion !== fileVersion) {
      uncovered.push({
        script,
        fileVersion,
        registryVersion,
        covered: false,
        reason: 'version-mismatch',
      });
      continue;
    }
    covered.push(script);
  }

  return { allCovered: uncovered.length === 0, covered, uncovered };
}

interface RawAuditIssue {
  level?: unknown;
  file?: unknown;
  message?: unknown;
  fixData?: unknown;
}

/** fixData payload lifecycle-sync-audit attaches to Check A mismatch rows. */
export interface CheckAFixData {
  scriptName: string;
  fileVersion: string;
  registryVersion: string;
}

/** One Check A error as surfaced to pre-commit check 6c. */
export interface CheckAIssue {
  file: string;
  message: string;
  fixData?: CheckAFixData;
}

function toFixData(raw: unknown): CheckAFixData | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.scriptName === 'string' &&
    typeof r.fileVersion === 'string' &&
    typeof r.registryVersion === 'string'
  ) {
    return { scriptName: r.scriptName, fileVersion: r.fileVersion, registryVersion: r.registryVersion };
  }
  return undefined;
}

/**
 * Extract Check A errors from `bun scripts/lifecycle-sync-audit.ts --json`
 * output, preserving the fixData payload for actionable output (T-20261027-010).
 * The JSON shape is AuditResult — `{ passed, errors, warnings, registry }`
 * where each issue carries `{ level, file, message, fixData? }` and Check A
 * errors are the ones whose message includes 'Check A:'. Non-Check-A errors
 * are ignored here (the exit code gate in runScriptsMdContentGate covers them).
 *
 * THIS is the extraction pre-commit check 6c must use: its pre-T-20261027-010
 * implementation read `parsed.results`, a key that never exists on AuditResult,
 * so the version-mismatch gate never fired (silent dead gate).
 */
export function parseCheckAErrorsDetailed(jsonRaw: string): CheckAIssue[] {
  const parsed = JSON.parse(jsonRaw) as { errors?: RawAuditIssue[] } | null;
  const errors = Array.isArray(parsed?.errors) ? parsed.errors : [];
  return errors
    .filter(
      (e): e is RawAuditIssue & { message: string } =>
        e?.level === 'error' && typeof e.message === 'string' && e.message.includes('Check A:'),
    )
    .map((e) => ({
      file: typeof e.file === 'string' ? e.file : '',
      message: e.message,
      fixData: toFixData(e.fixData),
    }));
}

/**
 * Extract Check A errors from `bun scripts/lifecycle-sync-audit.ts --json`
 * output (AuditResult.errors) — the file/message subset without fixData.
 * Delegates to parseCheckAErrorsDetailed so the two cannot drift.
 */
export function parseCheckAErrors(jsonRaw: string): Array<{ file: string; message: string }> {
  return parseCheckAErrorsDetailed(jsonRaw).map(({ file, message }) => ({ file, message }));
}

/** Result of one `lifecycle-sync-audit.ts --json` invocation. */
export interface LifecycleAuditRun {
  exitCode: number;
  stdout: string;
}

export type LifecycleAuditRunner = () => Promise<LifecycleAuditRun>;

/**
 * Content gate for the merge path of check 6 (T-20261027-009). The caller
 * shells out to `bun scripts/lifecycle-sync-audit.ts --json` — the narrowest
 * flag the script offers (there is no Check-A-only mode) — and this gate holds
 * on the exit code, which is 0 only when the lifecycle sync audit found no
 * errors (the Check A rows == @version-headers comparison among them; the
 * script resolves everything from its cwd, i.e. the merged working tree).
 *
 * JSON parsing only enriches the failure message with the offending Check A
 * rows; unparseable output with a non-zero exit still fails closed.
 */
export async function runScriptsMdContentGate(
  runAudit: LifecycleAuditRunner,
): Promise<{ pass: boolean; checkAErrors: Array<{ file: string; message: string }> }> {
  const run = await runAudit();
  let checkAErrors: Array<{ file: string; message: string }> = [];
  try {
    checkAErrors = parseCheckAErrors(run.stdout);
  } catch {
    // Unparseable output — the exit code remains the gate (fail-closed).
  }
  return { pass: run.exitCode === 0, checkAErrors };
}
