// @version 1.0.0
// v1.0.0 (T-20261027-009): merge-aware SCRIPTS.md gate for pre-commit check 6.
// Import-safe (pure functions + an injectable audit-runner seam) — pre-commit.ts
// itself runs main() at import and is not importable, so unit tests target this
// module (same pattern as helpers/merge-state.ts for dev-sync).
//   - evaluateScriptsMdGate(input): check 6's decision — pass, apply the
//     staged-file-set proxy (non-merge FAIL), or delegate to the content
//     comparison (merge in progress).
//   - MERGE_GATE_NOTICE: the one-line exemption notice (shared string so the
//     hook's output and the tests cannot drift).
//   - parseCheckAErrors(json): extracts Check A errors from
//     `lifecycle-sync-audit.ts --json` output (AuditResult.errors).
//   - runScriptsMdContentGate(runAudit): gates on the audit exit code and
//     surfaces Check A details; the runner is injectable for tests.

/**
 * The decision check 6 makes when scripts/*.ts are staged:
 *   - 'pass'         — no gate needed (SCRIPTS.md staged too, or no scripts staged).
 *   - 'proxy-fail'   — non-merge commit: the staged-file-set proxy trips (today's
 *                      FAIL — "SCRIPTS.md was not updated").
 *   - 'merge-verify' — merge in progress: rows may pre-exist on the receiving
 *                      branch (zero SCRIPTS.md delta from the merged-in side),
 *                      so the file-set proxy does not apply (T-20261027-009:
 *                      main→PR #1643 could not conclude after #1644 landed).
 *                      Verify the content invariant the proxy stands for instead.
 */
export type ScriptsMdGateAction = 'pass' | 'proxy-fail' | 'merge-verify';

export function evaluateScriptsMdGate(input: {
  scriptsStagedCount: number;
  scriptsMdStaged: boolean;
  mergeInProgress: boolean;
}): ScriptsMdGateAction {
  if (input.scriptsStagedCount === 0) return 'pass';
  if (input.scriptsMdStaged) return 'pass';
  return input.mergeInProgress ? 'merge-verify' : 'proxy-fail';
}

/**
 * Observable one-line notice emitted when check 6 takes the merge path, so the
 * exemption is visible in hook output (T-20261027-009 requirement 2).
 */
export const MERGE_GATE_NOTICE =
  'check 6: merge in progress — verified via lifecycle Check A content comparison';

interface RawAuditIssue {
  level?: unknown;
  file?: unknown;
  message?: unknown;
}

/**
 * Extract Check A errors from `bun scripts/lifecycle-sync-audit.ts --json`
 * output. The JSON shape is AuditResult — `{ passed, errors, warnings,
 * registry }` where each issue carries `{ level, file, message }` and Check A
 * errors are the ones whose message includes 'Check A:'. Non-Check-A errors
 * are ignored here (the exit code gate below covers them).
 */
export function parseCheckAErrors(jsonRaw: string): Array<{ file: string; message: string }> {
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
    }));
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
