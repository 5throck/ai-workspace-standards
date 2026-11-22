/**
 * audit-fail-hint.ts — parse audit.ts FAIL lines for dev-sync step 3.9's
 * failing-sub-check hint (T-20261122-004 / U-20261122-010, design
 * docs/designs/2026-11-22-dev-sync-skill-graph-preconvergence-design.md D2).
 *
 * The parse surface is audit.ts's existing output contract, consumed as-is —
 * audit.ts is NOT modified: `Fail(msg)` prints to STDERR as
 * `<RED>[FAIL] <msg><RESET>` with UNCONDITIONAL ANSI constants (no TTY
 * detection), so stderr lines, ANSI-stripped, prefix `[FAIL] ` are the stable
 * FAIL channel. stdout's `[PASS]`/`[WARN]` rows are not failures by
 * construction.
 *
 * Pure, side-effect-free module (no fs, no spawn) so unit tests run it
 * directly — same convention as lib/git-status.ts.
 *
 * @version 1.0.0
 */

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const FAIL_LINE_RE = /^\[FAIL\] (.+)$/;

/** Strip ANSI SGR sequences (audit's colors are unconditional constants). */
export function stripAnsi(text: string): string {
  return text.replace(ANSI_RE, "");
}

/** Failing sub-check messages from an audit run's captured stderr, in order.
 * Never throws; non-FAIL lines (progress, blanks, escapes) are ignored. */
export function parseAuditFailLines(stderr: string): string[] {
  const out: string[] = [];
  for (const line of stripAnsi(stderr).split("\n")) {
    const m = FAIL_LINE_RE.exec(line.trimEnd());
    if (m) out.push(m[1]);
  }
  return out;
}

/** Display name for a FAIL message: the text before the first " — " or ": "
 * separator ("Skill-graph drift detected: docs/… — run …" -> "Skill-graph
 * drift detected"). Presentation only — a separator drift in audit.ts can only
 * cosmeticize the name, never lose information (the remainder is printed right
 * beneath; see failSubCheckBody). */
export function failSubCheckName(message: string): string {
  return splitFailSubCheck(message).name;
}

/** The remainder of a FAIL message after its display name and separator
 * ("docs/skill-graph.json is stale — run …"). With no separator, the whole
 * message. */
export function failSubCheckBody(message: string): string {
  return splitFailSubCheck(message).body;
}

function splitFailSubCheck(message: string): { name: string; body: string } {
  const dash = message.indexOf(" — ");
  const colon = message.indexOf(": ");
  const cut = dash >= 0 && (colon < 0 || dash < colon) ? dash : colon >= 0 && (dash < 0 || colon < dash) ? colon : -1;
  if (cut === -1) return { name: message, body: message };
  return {
    name: message.slice(0, cut),
    body: message.slice(cut).replace(/^\s*(?::\s*|—\s*)/, ""),
  };
}

const MAX_HINT_LINES = 10;

/** The step-3.9 error-block body lines: one `- <name>` bullet plus the
 * indented remainder per FAIL, capped at 10 with an "… +N more" tail. */
export function formatSpecCheckHint(failMessages: string[]): string[] {
  const lines: string[] = [];
  for (const msg of failMessages.slice(0, MAX_HINT_LINES)) {
    const { name, body } = splitFailSubCheck(msg);
    lines.push(`    - ${name}`);
    lines.push(`        ${body}`);
  }
  if (failMessages.length > MAX_HINT_LINES) {
    lines.push(`    … +${failMessages.length - MAX_HINT_LINES} more`);
  }
  return lines;
}
