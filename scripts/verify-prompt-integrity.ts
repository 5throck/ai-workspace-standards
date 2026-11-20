#!/usr/bin/env bun
// @version 1.0.0
// verify-prompt-integrity.ts — the prompt-integrity verifier of record for the
// unified 03:00 batch runner (T-20261120-002; T-20261112-003 reopen; design
// docs/designs/2026-11-20-runner-hardening-integrity-design.md §T-20261120-002;
// ADR-0105 §Prompt-Integrity; DEC-20261120-04; spec AC-15).
//
// Hashes the LIVE automation prompt bytes out of the ZCode automation store and
// reconciles them against prompts.manifest.json. Closes the T-20261112-003 false
// closure: until this script existed, committed != ratified drift (the live store
// text ran 5 hunks ahead of the ratified v4 snapshot for 8 days) was undetectable.
//
// v1.0.0 (2026-11-20, runner-hardening PR-2):
//   - READ path is bun:sqlite ONLY. The sqlite3 CLI pipe is NOT byte-faithful:
//     SQL length(prompt) reports 21,967 CHARACTERS while the byte-exact size is
//     22,153 bytes (multibyte UTF-8), and the CLI-piped sha256 (f2e275b9...)
//     differs from the bun:sqlite hash (c91eeb1c...) — measured 2026-11-20
//     (design V3). NEVER shell out to the sqlite3 CLI in this script.
//   - Verdict matrix per manifest entry:
//       match                 live hash == manifest sha256
//       unratified-live-edit  live differs AND the entry's snapshot file still
//                             hashes to the manifest sha256 (store ahead of the
//                             record — the committed snapshot is stale)
//       drift-both            live differs AND the snapshot differs too
//       stale-snapshot        live matches but the snapshot file differs (WARN,
//                             not an alert — the live text is the ratified one)
//       missing-automation    no store row for the entry id (deletion is drift)
//       cannot-verify         store absent / self-test failed / manifest
//                             malformed — cannot-verify is NEVER a pass
//   - On any alert: exit 1, write
//     .pipeline-state/prompt-integrity-alert-<date>.json (entry id, both hashes,
//     verdict class, hunk summary via the snapshot when present), append one
//     line to memory/<today>.md, and — unless --no-ticket — file an urgent
//     governance ticket through `bun scripts/ticket.ts create --manual`
//     (title `prompt-integrity drift on automation-<id8>`; the alert JSON is the
//     evidence body — the manual-ticket store is title-only).
//   - All-match run: append `prompt integrity verify: N/N match` to the day's
//     memory log (ADR-0105 §Prompt-Integrity / AC-15 contract line).
//   - --exec-closure: extract every `bun scripts/*.ts` path the live prompt
//     names as an executed command and require each to be within
//     docs/protected-paths.json protectedPaths[] OR docs/runner-exec-allowlist.json
//     (a new execution surface entering the authority prompt without a governance
//     change set = alert). Design §T-20261119-006 adjacency, third scope item.
//   - --gate: the runner STEP 0 pre-fire wrapper (design §T-20261120-002 3b,
//     defense-in-depth — the 06:00 launchd job is the control). Same checks,
//     same alert JSON + memory line, but ticket filing is DISABLED (--gate
//     implies --no-ticket): the runner session never files tickets about its own
//     authority; the 06:00 out-of-process run owns that.
//
// Usage:
//   bun scripts/verify-prompt-integrity.ts                     # manifest verify
//   bun scripts/verify-prompt-integrity.ts --exec-closure      # + exec closure
//   bun scripts/verify-prompt-integrity.ts --gate              # runner STEP 0
//   bun scripts/verify-prompt-integrity.ts --store <path>      # store override (tests)
//   bun scripts/verify-prompt-integrity.ts --no-ticket         # alert without filing
//
// Exit codes: 0 (all entries match, exec closure green when run) · 1 (any alert:
// drift / missing / cannot-verify / exec-closure violation) · 2 (usage error).
//
// Scheduling (DEC-20261120-04): the control run is OUT-OF-PROCESS — the host
// launchd job ai.workspace.prompt-integrity-verify.plist fires daily 06:00 KST
// (plist + install notes: docs/governance/automation-prompts/, operator-managed
// host state exactly like the 13:00 watchdog). A ZCode automation running the
// same script daily 06:00 remains the documented fallback.
//
// Store-schema risk posture (design Risks): the DB path, table, and column names
// are app-owned by the ZCode store and live in ONE constant block below; a
// schema/migration drift surfaces as the self-test failing → cannot-verify
// alert, visible instead of passing. The store is LIVE operator state — this
// script opens it READ-ONLY and never writes to it.

import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STORE_PATH = join(process.env.HOME ?? "", ".zcode", "v2", "tasks-index.sqlite");
const DEFAULT_STATE_DIR = join(WORKSPACE_ROOT, ".pipeline-state");

// App-owned store shape (design Risks: one constant block; a ZCode update that
// moves these fails the self-test below → cannot-verify alert, never a silent pass).
const AUTOMATIONS_TABLE = "automations";
const AUTOMATION_ID_COLUMN = "automation_id";
const PROMPT_COLUMN = "prompt";

// ── Hashing ─────────────────────────────────────────────────────────────────

/** SHA256 of a TEXT value, byte-exact over its UTF-8 encoding. */
export function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** SHA256 of a file's raw bytes (snapshot evidence files). */
export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// ── Manifest ────────────────────────────────────────────────────────────────

export interface ManifestEntry {
  id: string;
  title?: string;
  sha256: string;
  snapshot?: string;
}

export interface PromptManifest {
  generatedAt?: string;
  entries: ManifestEntry[];
}

export function readManifest(path: string): PromptManifest {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { entries?: unknown; generatedAt?: unknown };
  const entries = (parsed as { entries?: unknown }).entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`malformed manifest: entries[] missing or empty (${path})`);
  }
  const out: ManifestEntry[] = [];
  for (const e of entries as unknown[]) {
    const rec = e as Record<string, unknown>;
    if (typeof rec.id !== "string" || typeof rec.sha256 !== "string") {
      throw new Error(`malformed manifest entry (id/sha256 missing): ${JSON.stringify(rec).slice(0, 120)}`);
    }
    out.push({
      id: rec.id,
      title: typeof rec.title === "string" ? rec.title : undefined,
      sha256: rec.sha256,
      snapshot: typeof rec.snapshot === "string" ? rec.snapshot : undefined,
    });
  }
  return { generatedAt: typeof parsed.generatedAt === "string" ? parsed.generatedAt : undefined, entries: out };
}

// ── Live store read (bun:sqlite ONLY — see header V3 note) ──────────────────

export type LivePromptRead =
  | { ok: true; text: string }
  | { ok: false; reason: "store-absent" | "self-test-failed" | "query-failed" };

/**
 * Read the live prompt TEXT for one automation id, byte-exact, via bun:sqlite
 * in READ-ONLY mode. The store is live operator state — never written to.
 */
export function readLivePrompt(storePath: string, automationId: string): LivePromptRead {
  if (!existsSync(storePath)) return { ok: false, reason: "store-absent" };
  let db: Database;
  try {
    db = new Database(storePath, { readonly: true });
  } catch {
    return { ok: false, reason: "store-absent" };
  }
  try {
    // Self-test (design Risks): prove the app-owned table shape before trusting
    // the read. Failure = cannot-verify alert, not a crash.
    db.query(`SELECT 1 FROM ${AUTOMATIONS_TABLE} LIMIT 1`).get();
    const row = db
      .query(`SELECT ${PROMPT_COLUMN} FROM ${AUTOMATIONS_TABLE} WHERE ${AUTOMATION_ID_COLUMN} = ?`)
      .get(automationId) as { [key: string]: unknown } | null;
    if (row === null || row === undefined) return { ok: false, reason: "query-failed" }; // no row — classified upstream
    const text = row[PROMPT_COLUMN];
    return typeof text === "string" ? { ok: true, text } : { ok: false, reason: "query-failed" };
  } catch {
    return { ok: false, reason: "self-test-failed" };
  } finally {
    db.close();
  }
}

/** Distinguishes "row missing" (verdict class) from infra failures (cannot-verify). */
export function automationRowExists(storePath: string, automationId: string): boolean | "store-error" {
  if (!existsSync(storePath)) return "store-error";
  let db: Database;
  try {
    db = new Database(storePath, { readonly: true });
  } catch {
    return "store-error";
  }
  try {
    db.query(`SELECT 1 FROM ${AUTOMATIONS_TABLE} LIMIT 1`).get();
    const row = db.query(`SELECT 1 FROM ${AUTOMATIONS_TABLE} WHERE ${AUTOMATION_ID_COLUMN} = ?`).get(automationId);
    return row !== null && row !== undefined;
  } catch {
    return "store-error";
  } finally {
    db.close();
  }
}

// ── Verdict classification ──────────────────────────────────────────────────

export type VerdictClass =
  | "match"
  | "unratified-live-edit"
  | "drift-both"
  | "stale-snapshot"
  | "missing-automation"
  | "cannot-verify";

export const ALERT_CLASSES: readonly VerdictClass[] = [
  "unratified-live-edit",
  "drift-both",
  "missing-automation",
  "cannot-verify",
];

export interface EntryVerdict {
  id: string;
  id8: string;
  verdict: VerdictClass;
  isAlert: boolean;
  manifestHash: string;
  liveHash?: string;
  snapshotHash?: string;
  detail: string;
  hunkSummary?: string;
}

/** `automation-dfba3ff1-a1df-...` → `dfba3ff1` (first uuid segment; last-8 fallback). */
export function id8Of(automationId: string): string {
  const tail = automationId.startsWith("automation-") ? automationId.slice("automation-".length) : automationId;
  const first = tail.split("-")[0] ?? "";
  return first.length >= 6 ? first : tail.slice(-8);
}

/**
 * Hunk summary of live vs snapshot text: trim the common line prefix/suffix and
 * report the single remaining differing window (deterministic, bounded).
 */
export function summarizeHunks(liveText: string, snapshotText: string): string {
  const live = liveText.split("\n");
  const snap = snapshotText.split("\n");
  let prefix = 0;
  while (prefix < live.length && prefix < snap.length && live[prefix] === snap[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < live.length - prefix &&
    suffix < snap.length - prefix &&
    live[live.length - 1 - suffix] === snap[snap.length - 1 - suffix]
  ) {
    suffix++;
  }
  const liveSpan = live.length - prefix - suffix;
  const snapSpan = snap.length - prefix - suffix;
  if (liveSpan === 0 && snapSpan === 0) return "no line-level difference";
  const head = live.slice(prefix, prefix + Math.min(liveSpan, 3)).join(" ⏎ ");
  const more = liveSpan > 3 ? ` (+${liveSpan - 3} more live lines)` : "";
  return `live lines ${prefix + 1}-${prefix + liveSpan} (${liveSpan}) vs snapshot lines ${prefix + 1}-${prefix + snapSpan} (${snapSpan}); first live lines: ${head}${more}`;
}

function snapshotText(entry: ManifestEntry, workspaceRoot: string): { present: boolean; hash?: string; text?: string } {
  if (!entry.snapshot) return { present: false };
  const abs = entry.snapshot.startsWith("/") ? entry.snapshot : join(workspaceRoot, entry.snapshot);
  if (!existsSync(abs)) return { present: false };
  const bytes = readFileSync(abs);
  return { present: true, hash: createHash("sha256").update(bytes).digest("hex"), text: bytes.toString("utf8") };
}

export function classifyEntry(
  entry: ManifestEntry,
  live: LivePromptRead,
  workspaceRoot: string = WORKSPACE_ROOT,
): EntryVerdict {
  const base: EntryVerdict = {
    id: entry.id,
    id8: id8Of(entry.id),
    verdict: "cannot-verify",
    isAlert: true,
    manifestHash: entry.sha256,
    detail: "",
  };

  if (!live.ok) {
    if (live.reason === "query-failed") {
      // No row for the id — distinguishable only via a second probe; a missing
      // row IS the missing-automation verdict (deletion is drift).
      return { ...base, verdict: "missing-automation", detail: `no store row for ${entry.id}` };
    }
    return {
      ...base,
      verdict: "cannot-verify",
      detail: `live store unreadable (${live.reason}) — cannot-verify is never a pass`,
    };
  }

  const liveHash = sha256Text(live.text);
  const snap = snapshotText(entry, workspaceRoot);

  if (liveHash === entry.sha256) {
    if (snap.present && snap.hash !== entry.sha256) {
      return {
        ...base,
        verdict: "stale-snapshot",
        isAlert: false,
        liveHash,
        snapshotHash: snap.hash,
        detail: "live matches the manifest but the snapshot evidence file is stale (WARN, not an alert)",
      };
    }
    return {
      ...base,
      verdict: "match",
      isAlert: false,
      liveHash,
      snapshotHash: snap.hash,
      detail: snap.present
        ? "live, manifest, and snapshot agree"
        : "live matches the manifest (no snapshot file to reconcile)",
    };
  }

  // Live differs from the manifest: reconcile via the snapshot.
  const hunkSummary = snap.present && snap.text !== undefined ? summarizeHunks(live.text, snap.text) : undefined;
  if (snap.present && snap.hash === entry.sha256) {
    return {
      ...base,
      verdict: "unratified-live-edit",
      liveHash,
      snapshotHash: snap.hash,
      detail:
        "live store is AHEAD of the ratified record — the snapshot still hashes to the manifest sha256 (store text changed without a governance change set)",
      hunkSummary,
    };
  }
  return {
    ...base,
    verdict: "drift-both",
    liveHash,
    snapshotHash: snap.hash,
    detail: snap.present
      ? "live AND snapshot both differ from the manifest sha256"
      : "live differs from the manifest sha256 and no snapshot evidence file exists to reconcile against",
    hunkSummary,
  };
}

// ── Exec closure (design §T-20261119-006 adjacency, third scope item) ───────

const EXEC_REF_PATTERN = /bun\s+scripts\/[A-Za-z0-9/._-]+\.ts/g;

/**
 * Every `bun scripts/*.ts` path the prompt names as an executed command,
 * normalized to repo-relative form, deduped, sorted.
 */
export function extractExecRefs(promptText: string): string[] {
  const refs = new Set<string>();
  for (const m of promptText.matchAll(EXEC_REF_PATTERN)) {
    const raw = m[0].replace(/^bun\s+/, "").replace(/[.,;)\]]+$/, "");
    refs.add(raw);
  }
  return [...refs].sort();
}

/**
 * Gitignore-style glob → RegExp: `**` crosses separators, `*` stays within one,
 * `?` is one non-separator char; everything else is literal.
 */
export function globToRegExp(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        re += ".*";
        i++;
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

export function pathCoveredByPatterns(relPath: string, patterns: string[]): boolean {
  return patterns.some((p) => globToRegExp(p).test(relPath));
}

export interface ExecClosureVerdict {
  ok: boolean;
  refs: string[];
  violations: { ref: string; reason: string }[];
}

/**
 * Every prompt-referenced script must sit inside protectedPaths[] OR the
 * runner-exec allowlist; anything else is a new execution surface that entered
 * the authority prompt without a governance change set.
 */
export function execClosureCheck(
  promptText: string,
  protectedPatterns: string[],
  allowlistPatterns: string[],
): ExecClosureVerdict {
  const refs = extractExecRefs(promptText);
  const violations = refs
    .filter((r) => !pathCoveredByPatterns(r, protectedPatterns) && !pathCoveredByPatterns(r, allowlistPatterns))
    .map((ref) => ({ ref, reason: "outside protectedPaths[] and docs/runner-exec-allowlist.json" }));
  return { ok: violations.length === 0, refs, violations };
}

function loadJsonStringArray(path: string, key: string): string[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const arr = parsed[key];
  if (!Array.isArray(arr)) throw new Error(`malformed ${path}: ${key}[] missing`);
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v === "string") out.push(v);
    else if (v && typeof v === "object" && typeof (v as { path?: unknown }).path === "string") {
      out.push((v as { path: string }).path);
    }
  }
  return out;
}

// ── Alert side effects ──────────────────────────────────────────────────────

export function localDateString(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function alertJsonPath(stateDir: string, date: string): string {
  return join(stateDir, `prompt-integrity-alert-${date}.json`);
}

/** Latest-run-wins daily snapshot of the alert state (idempotent per day). */
export function writeAlertJson(
  stateDir: string,
  date: string,
  payload: {
    alerts: EntryVerdict[];
    sideAlerts?: { kind: string; detail: string; refs?: string[] }[];
    execClosure?: ExecClosureVerdict;
    generatedAt: string;
  },
): string {
  mkdirSync(stateDir, { recursive: true });
  const path = alertJsonPath(stateDir, date);
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return path;
}

export function appendMemoryLine(memoryDir: string, date: string, line: string): string {
  mkdirSync(memoryDir, { recursive: true });
  const path = join(memoryDir, `${date}.md`);
  appendFileSync(path, `${line}\n`, "utf8");
  return path;
}

export interface TicketFileResult {
  filed: boolean;
  alreadyFiled: boolean;
  detail: string;
}

export type TicketFiler = (title: string) => TicketFileResult;

/** Default filer: `bun scripts/ticket.ts create --manual <title> --priority urgent`. */
export const spawnTicketFiler: TicketFiler = (title) => {
  const proc = Bun.spawnSync(["bun", "scripts/ticket.ts", "create", "--manual", title, "--priority", "urgent"], {
    cwd: WORKSPACE_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = `${proc.stdout.toString()}${proc.stderr.toString()}`;
  // v1.15.0 duplicate-title refusal: a same-day repeat drift on the same
  // automation must not crash the verifier — treat as already-filed evidence.
  if (proc.exitCode === 0) return { filed: true, alreadyFiled: false, detail: out.trim() };
  if (/duplicate/i.test(out)) return { filed: false, alreadyFiled: true, detail: out.trim() };
  return { filed: false, alreadyFiled: false, detail: `ticket create exited ${proc.exitCode}: ${out.trim()}` };
};

// ── Orchestration ───────────────────────────────────────────────────────────

export interface VerifyOptions {
  manifestPath?: string;
  storePath?: string;
  stateDir?: string;
  memoryDir?: string;
  workspaceRoot?: string;
  noTicket?: boolean;
  gate?: boolean;
  execClosure?: boolean;
  now?: Date;
  ticketFiler?: TicketFiler;
}

export interface VerifyReport {
  exitCode: number;
  clean: boolean;
  total: number;
  matchCount: number;
  entries: EntryVerdict[];
  execClosure?: ExecClosureVerdict;
  alertJson?: string;
  memoryLines: string[];
  tickets: { title: string; result: TicketFileResult }[];
  manifestError?: string;
}

/** Non-entry alert kinds: unreadable manifest, exec-closure violation. */
interface SideAlert {
  kind: "manifest" | "exec-closure";
  detail: string;
  refs?: string[];
}

export function runVerification(opts: VerifyOptions = {}): VerifyReport {
  const workspaceRoot = opts.workspaceRoot ?? WORKSPACE_ROOT;
  const manifestPath = opts.manifestPath ?? join(workspaceRoot, "prompts.manifest.json");
  const storePath = opts.storePath ?? DEFAULT_STORE_PATH;
  const stateDir = opts.stateDir ?? DEFAULT_STATE_DIR;
  const memoryDir = opts.memoryDir ?? join(workspaceRoot, "memory");
  const now = opts.now ?? new Date();
  const date = localDateString(now);
  const memoryLines: string[] = [];
  const tickets: VerifyReport["tickets"] = [];
  const report: VerifyReport = {
    exitCode: 1,
    clean: false,
    total: 0,
    matchCount: 0,
    entries: [],
    memoryLines,
    tickets,
  };

  // Manifest read failure is a cannot-verify alert (the authority record itself
  // is unreadable — never a pass).
  let manifest: PromptManifest;
  try {
    manifest = readManifest(manifestPath);
  } catch (err) {
    const side: SideAlert = { kind: "manifest", detail: `manifest unreadable: ${(err as Error).message}` };
    report.manifestError = (err as Error).message;
    return finishWithAlerts(report, [side], [], stateDir, memoryDir, date, now, opts);
  }

  report.total = manifest.entries.length;

  // One read-only connection per entry keeps a corrupt row from poisoning the
  // others (each read is independent; the self-test re-runs per entry).
  const sideAlerts: SideAlert[] = [];
  let liveTextForClosure: string | undefined;

  for (const entry of manifest.entries) {
    const live = readLivePrompt(storePath, entry.id);
    const verdict = classifyEntry(entry, live, workspaceRoot);
    report.entries.push(verdict);
    if (verdict.verdict === "match" || verdict.verdict === "stale-snapshot") report.matchCount++;
    if (live.ok && liveTextForClosure === undefined) liveTextForClosure = live.text;
  }

  let closure: ExecClosureVerdict | undefined;
  if (opts.execClosure) {
    const protectedPatterns = existsSync(join(workspaceRoot, "docs/protected-paths.json"))
      ? loadJsonStringArray(join(workspaceRoot, "docs/protected-paths.json"), "protectedPaths")
      : [];
    const allowlistPatterns = existsSync(join(workspaceRoot, "docs/runner-exec-allowlist.json"))
      ? loadJsonStringArray(join(workspaceRoot, "docs/runner-exec-allowlist.json"), "allowedScripts")
      : [];
    closure = execClosureCheck(liveTextForClosure ?? "", protectedPatterns, allowlistPatterns);
    report.execClosure = closure;
    if (!closure.ok) {
      sideAlerts.push({
        kind: "exec-closure",
        detail: `${closure.violations.length} prompt-referenced script(s) outside protectedPaths[] ∪ docs/runner-exec-allowlist.json — new execution surface(s) in the authority prompt without a governance change set`,
        refs: closure.violations.map((v) => v.ref),
      });
    }
  }

  const entryAlerts = report.entries.filter((e) => e.isAlert);
  if (entryAlerts.length > 0 || sideAlerts.length > 0) {
    return finishWithAlerts(report, sideAlerts, entryAlerts, stateDir, memoryDir, date, now, opts);
  }

  // All-match run: the ADR-0105 §Prompt-Integrity / AC-15 contract line.
  const line =
    `prompt integrity verify: ${report.matchCount}/${report.total} match` +
    (closure?.ok ? ` (exec-closure ok: ${closure.refs.length} scripts)` : "");
  memoryLines.push(line);
  appendMemoryLine(memoryDir, date, line);
  report.exitCode = 0;
  report.clean = true;
  return report;
}

function finishWithAlerts(
  report: VerifyReport,
  sideAlerts: SideAlert[],
  entryAlerts: EntryVerdict[],
  stateDir: string,
  memoryDir: string,
  date: string,
  now: Date,
  opts: VerifyOptions,
): VerifyReport {
  const alertPath = writeAlertJson(stateDir, date, {
    alerts: entryAlerts,
    sideAlerts,
    execClosure: report.execClosure,
    generatedAt: now.toISOString(),
  });
  report.alertJson = alertPath;
  for (const a of entryAlerts) {
    const line =
      `prompt-integrity ALERT: ${a.verdict} on ${a.id}` +
      (a.liveHash ? ` — live ${a.liveHash.slice(0, 12)}` : "") +
      ` vs manifest ${a.manifestHash.slice(0, 12)}` +
      ` (alert: ${alertPath})`;
    report.memoryLines.push(line);
    appendMemoryLine(memoryDir, date, line);
  }
  for (const s of sideAlerts) {
    const line = `prompt-integrity ALERT: ${s.kind} — ${s.detail} (alert: ${alertPath})`;
    report.memoryLines.push(line);
    appendMemoryLine(memoryDir, date, line);
  }
  if (!opts.noTicket && !opts.gate) {
    const filer = opts.ticketFiler ?? spawnTicketFiler;
    for (const a of entryAlerts) {
      const title = `prompt-integrity drift on automation-${a.id8} (${a.verdict})`;
      report.tickets.push({ title, result: filer(title) });
    }
    for (const s of sideAlerts) {
      const refs =
        s.refs && s.refs.length > 0 ? ` (${s.refs.slice(0, 3).join(", ")}${s.refs.length > 3 ? ", ..." : ""})` : "";
      const title = `prompt-integrity ${s.kind === "manifest" ? "manifest cannot-verify" : "exec-closure violation"}${refs}`;
      report.tickets.push({ title, result: filer(title) });
    }
  }
  report.exitCode = 1;
  report.clean = false;
  return report;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const USAGE = `usage: bun scripts/verify-prompt-integrity.ts [--store <path>] [--exec-closure] [--gate] [--no-ticket]
  Verifies the live automation prompt bytes against prompts.manifest.json (bun:sqlite read-only — never the sqlite3 CLI).
  Exit 0 all match · 1 any alert (drift / missing / cannot-verify / exec-closure) · 2 usage error.`;

const main = (): number => {
  const args = process.argv.slice(2);
  const flags = {
    store: undefined as string | undefined,
    execClosure: false,
    gate: false,
    noTicket: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--store") flags.store = args[++i];
    else if (a?.startsWith("--store=")) flags.store = a.slice("--store=".length);
    else if (a === "--exec-closure") flags.execClosure = true;
    else if (a === "--gate") flags.gate = true;
    else if (a === "--no-ticket") flags.noTicket = true;
    else if (a === "--help" || a === "-h") {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    } else {
      process.stderr.write(`unknown argument: ${a}\n${USAGE}\n`);
      return 2;
    }
  }

  const report = runVerification({
    storePath: flags.store,
    execClosure: flags.execClosure,
    gate: flags.gate,
    noTicket: flags.noTicket,
  });

  const host = hostname();
  for (const e of report.entries) {
    const mark = e.isAlert ? "✗" : e.verdict === "stale-snapshot" ? "⚠️" : "✓";
    process.stdout.write(`${mark} ${e.id} — ${e.verdict}: ${e.detail}\n`);
    if (e.hunkSummary) process.stdout.write(`   hunks: ${e.hunkSummary}\n`);
  }
  if (report.execClosure) {
    process.stdout.write(
      report.execClosure.ok
        ? `✓ exec-closure: ${report.execClosure.refs.length} prompt-referenced script(s) inside protectedPaths ∪ runner-exec-allowlist\n`
        : `✗ exec-closure: ${report.execClosure.violations.length} script(s) outside the sanctioned set:\n${report.execClosure.violations.map((v) => `   - ${v.ref}`).join("\n")}\n`,
    );
  }
  if (report.tickets.length > 0) {
    for (const t of report.tickets) {
      process.stdout.write(
        t.result.filed || t.result.alreadyFiled
          ? `⚠️ ticket (${t.result.alreadyFiled ? "already filed" : "filed"}): ${t.title}\n`
          : `✗ ticket filing failed: ${t.title}\n     ${t.result.detail}\n`,
      );
    }
  }
  const mode = flags.gate ? "gate" : "scheduled";
  if (report.clean) {
    process.stdout.write(`✓ prompt integrity: ${report.matchCount}/${report.total} match (${mode}, host ${host})\n`);
  } else {
    process.stdout.write(
      `✗ prompt integrity ALERT (${mode}, host ${host}): exit 1${report.alertJson ? ` — alert JSON ${report.alertJson}` : ""}${flags.gate ? " — gate: graceful abort, no merges" : ""}\n`,
    );
  }
  return report.exitCode;
};

if (import.meta.main) {
  process.exit(main());
}
