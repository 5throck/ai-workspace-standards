/**
 * Tenant-loop gateway side (design docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 * §4, WP2): loop config types + validation, the tz-aware window check (gateway-side mirror of
 * the workspace `isTenantWithinWindows` helper — gateway code must not import from scripts/ at
 * runtime), the atomic registry export writer, the per-tenant daily upgrade quota, and the
 * upgrade executor (snapshot branch + allowlisted-env subprocess).
 *
 * Export discipline (§4.5): the registry file under
 * `<CO_WORKSPACE_WORKSPACE_DIR>/.pipeline-state/tenant-loop-registry.json` is rewritten after
 * every successful admin mutation and once at gateway boot. A failed write is loud (console
 * error + audit row) and leaves the previous file in place — the workspace reader fails
 * closed on a stale (>24h) export rather than acting on it.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import { HttpError } from "./http";
import { allowlistedEnv } from "./hermes";
import type { TenantRecord } from "./tenant";
import type { GatewayState } from "./state";
import { tail } from "./util";

/** Same shape `genId("gw")` emits (util.ts) — a different namespace from fleet ids (`co-*`). */
export const TENANT_ID_RE = /^gw-[0-9a-f]{12}$/;

export const SCHEMA_VERSION = 1 as const;

export const DEFAULT_LOOP_GROUP = "default";

export interface LoopScopes {
  upgrade: boolean;
  upstreamFile: boolean;
  backportReview: boolean;
  nightlyFleet: boolean;
}

export interface LoopWindows {
  /** IANA tz; "HH:MM" start/end are in this tz. Absent/invalid → deny (fail-closed). */
  tz: string;
  /** 0-6, 0 = Sunday (the `Intl` weekday convention). */
  days: number[];
  start: string;
  end: string;
}

/** Sparse per-tenant override; unset keys inherit the governing group (§4.1). */
export interface TenantLoopOverride {
  scopes?: Partial<LoopScopes>;
  windows?: LoopWindows;
}

/** Group-default loop config (the `groups.loop_config` JSON payload, §4.1). */
export interface LoopGroupConfig {
  groupId: string;
  name: string;
  designatedUsers: string[];
  scopes?: Partial<LoopScopes>;
  windows?: LoopWindows;
}

const SCOPE_KEYS = ["upgrade", "upstreamFile", "backportReview", "nightlyFleet"] as const;

export const DEFAULT_LOOP_SCOPES: LoopScopes = {
  upgrade: false,
  upstreamFile: false,
  backportReview: false,
  nightlyFleet: false,
};

/** Unrestricted default window (all days, KST) — the schema always carries a complete
 * windows object, so the workspace reader never has to improvise one. End-exclusive
 * window math leaves 23:59 itself outside; a one-minute daily gap accepted as the
 * "no real restriction" default (HH:MM has no 24:00 representation). */
export const DEFAULT_LOOP_WINDOWS: LoopWindows = {
  tz: "Asia/Seoul",
  days: [0, 1, 2, 3, 4, 5, 6],
  start: "00:00",
  end: "23:59",
};

const GROUP_ID_RE = /^[\w-]{1,64}$/;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Kill switch (§4.4): any non-empty value disables every tenant-loop route and suspends
 * every tenant in the export. */
export function tenantLoopDisabled(): boolean {
  const v = process.env.CO_WORKSPACE_TENANT_LOOP_DISABLED;
  return typeof v === "string" && v.length > 0;
}

// ── Validation (write-time) ─────────────────────────────────────────────────

export function validateGroupId(groupId: unknown): string {
  if (typeof groupId !== "string" || !GROUP_ID_RE.test(groupId)) {
    throw new HttpError(400, `group id must match ${GROUP_ID_RE}`);
  }
  return groupId;
}

export function validateLoopScopes(value: unknown): Partial<LoopScopes> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "scopes must be a JSON object");
  }
  const out: Partial<LoopScopes> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!(SCOPE_KEYS as readonly string[]).includes(k)) {
      throw new HttpError(400, `unknown scope key "${k}" (allowed: ${SCOPE_KEYS.join(", ")})`);
    }
    if (typeof v !== "boolean") throw new HttpError(400, `scope "${k}" must be a boolean`);
    out[k as keyof LoopScopes] = v;
  }
  return out;
}

export function validateLoopWindows(value: unknown): LoopWindows {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "windows must be a JSON object {tz, days, start, end}");
  }
  const w = value as Record<string, unknown>;
  const tz = w.tz;
  if (typeof tz !== "string" || !isValidTimeZone(tz)) throw new HttpError(400, `windows.tz must be a valid IANA time zone, got ${JSON.stringify(tz)}`);
  if (!Array.isArray(w.days) || w.days.length === 0 || !w.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
    throw new HttpError(400, "windows.days must be a non-empty array of integers 0-6 (0 = Sunday)");
  }
  if (typeof w.start !== "string" || !HHMM_RE.test(w.start)) throw new HttpError(400, "windows.start must be HH:MM (00:00-23:59)");
  if (typeof w.end !== "string" || !HHMM_RE.test(w.end)) throw new HttpError(400, "windows.end must be HH:MM (00:00-23:59)");
  if (w.start === w.end) throw new HttpError(400, "windows.start and windows.end must differ");
  return { tz, days: [...w.days], start: w.start, end: w.end };
}

export function validateDesignatedUsers(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((u) => typeof u === "string" && u.trim().length > 0 && u.trim().length <= 128)) {
    throw new HttpError(400, "designatedUsers must be an array of principal strings");
  }
  return [...new Set(value.map((u) => u.trim()))];
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ── Effective config resolution ─────────────────────────────────────────────

function minuteOf(hhmm: string): number | null {
  if (!HHMM_RE.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local weekday + minute-of-day as seen in `tz`; null = tz unusable (fail-closed caller). */
function zonedParts(tz: string, now: Date): { day: number; minutes: number } | null {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const wd = parts.find((p) => p.type === "weekday")?.value;
    const day = wd !== undefined ? WEEKDAY_INDEX[wd] : undefined;
    let hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight with hour12:false
    const minute = Number(parts.find((p) => p.type === "minute")?.value);
    if (day === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) return null;
    return { day, minutes: hour * 60 + minute };
  } catch {
    return null;
  }
}

/** tz-aware window verdict — gateway MIRROR of the workspace authority
 * `isTenantWithinWindows` (scripts/lib/fleet.ts, design §4.3's two enforcement points):
 * same boundary math (start inclusive, end EXCLUSIVE, wrap-midnight admits the previous
 * day's tail), same fail-closed refusals. Invalid tz/bounds/days deny; start === end is a
 * zero-length window (never open; also rejected at write time). Windows are always
 * RESOLVED by effectiveLoopConfig before this check on the gateway, so `undefined` here
 * means no restriction was configured anywhere (the workspace side never sees it). */
export function loopWindowVerdict(
  windows: LoopWindows | undefined,
  now: Date = new Date(),
): { ok: boolean; reason: string } {
  if (!windows) return { ok: true, reason: "no windows configured" };
  const startMin = minuteOf(windows.start);
  const endMin = minuteOf(windows.end);
  if (!windows.tz || !isValidTimeZone(windows.tz)) return { ok: false, reason: `invalid time zone ${JSON.stringify(windows.tz)}` };
  if (startMin === null || endMin === null) return { ok: false, reason: `unparseable window bounds ${windows.start}-${windows.end}` };
  if (!Array.isArray(windows.days) || windows.days.length === 0 || windows.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return { ok: false, reason: "invalid window days" };
  }
  const parts = zonedParts(windows.tz, now);
  if (!parts) return { ok: false, reason: "time-zone lookup failed" };
  const inWindow =
    startMin < endMin
      ? windows.days.includes(parts.day) && parts.minutes >= startMin && parts.minutes < endMin
      : startMin === endMin
        ? false // zero-length window — never open (fail-closed)
        : // Wrap-midnight (start > end): the window that opened on `day`, or the tail of
          // the window that opened the previous day.
          (parts.minutes >= startMin && windows.days.includes(parts.day)) ||
            (parts.minutes < endMin && windows.days.includes((parts.day + 6) % 7));
  return inWindow
    ? { ok: true, reason: `in window ${windows.start}-${windows.end} ${windows.tz}` }
    : { ok: false, reason: `outside window ${windows.start}-${windows.end} ${windows.tz}` };
}

/** Merge a group + per-tenant override into the effective config (§4.1): override > group >
 * defaults, scopes merged per key, windows taken whole. */
export function effectiveLoopConfig(
  rec: TenantRecord,
  groups: LoopGroupConfig[],
): { scopes: LoopScopes; windows: LoopWindows; group: LoopGroupConfig | undefined } {
  const group = rec.loopGroup ? groups.find((g) => g.groupId === rec.loopGroup) : undefined;
  const scopes: LoopScopes = {
    ...DEFAULT_LOOP_SCOPES,
    ...(group?.scopes ?? {}),
    ...(rec.loopOverride?.scopes ?? {}),
  };
  const windows = rec.loopOverride?.windows ?? group?.windows ?? DEFAULT_LOOP_WINDOWS;
  return { scopes, windows, group };
}

// ── Registry export (§3.1 schema, §4.5 discipline) ──────────────────────────

export interface TenantLoopTenantRow {
  id: string;
  principal: string;
  variant: string;
  projectDir: string;
  status: "active" | "suspended";
  scopes: LoopScopes;
  windows: LoopWindows;
  gitRemote: string;
}

export interface TenantLoopRegistryExport {
  schemaVersion: typeof SCHEMA_VERSION;
  writtenAt: string;
  tenants: TenantLoopTenantRow[];
}

export function tenantLoopRegistryPath(workspaceDir: string): string {
  return join(workspaceDir, ".pipeline-state", "tenant-loop-registry.json");
}

/** The variant namespace the workspace reader (scripts/lib/fleet.ts validateTenantLoopRegistryPayload,
 * design §3.1) accepts — mirrored here so the writer never emits a row the reader would reject. */
const VARIANT_RE = /^co-[a-z0-9-]{1,40}$/;

type ExportAudit = { record(actor: string, action: string, target?: string, detail?: string): void };

/** [QA F2] Validate one export row against the §3.1 schema — the SAME rules the workspace
 * reader enforces (validateTenantLoopRegistryPayload): id (checked by the caller), principal,
 * variant, absolute projectDir, status, complete four-key boolean scopes, windows shape,
 * non-empty gitRemote. A hand-edited tenants.data row that fails any rule is skipped here
 * instead of flowing into the export, where the reader would hard-fail the WHOLE file as
 * malformed. Returns the failure reason, or null when the row is schema-valid. */
function exportRowSchemaError(row: TenantLoopTenantRow): string | null {
  if (typeof row.principal !== "string" || row.principal.trim().length === 0) return "principal must be a non-empty string";
  if (typeof row.variant !== "string" || !VARIANT_RE.test(row.variant)) return `variant must match ${VARIANT_RE}, got ${JSON.stringify(row.variant)}`;
  if (typeof row.projectDir !== "string" || row.projectDir.length === 0 || !isAbsolute(row.projectDir)) return "projectDir must be an absolute path";
  if (row.status !== "active" && row.status !== "suspended") return `status must be 'active' or 'suspended', got ${JSON.stringify(row.status)}`;
  const scopeKeys = Object.keys(row.scopes).sort();
  const expectedKeys = ["backportReview", "nightlyFleet", "upgrade", "upstreamFile"];
  if (scopeKeys.length !== expectedKeys.length || scopeKeys.some((k, i) => k !== expectedKeys[i])) {
    return `scopes must carry exactly the keys ${expectedKeys.join(", ")}`;
  }
  if (expectedKeys.some((k) => typeof row.scopes[k as keyof LoopScopes] !== "boolean")) return "scopes values must all be booleans";
  if (typeof row.windows.tz !== "string" || row.windows.tz.trim().length === 0) return "windows.tz must be a non-empty IANA tz name";
  if (
    !Array.isArray(row.windows.days) ||
    row.windows.days.length === 0 ||
    row.windows.days.some((d) => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d > 6)
  ) {
    return "windows.days must be a non-empty array of integers 0-6 (0 = Sunday)";
  }
  for (const [label, val] of [["start", row.windows.start], ["end", row.windows.end]] as const) {
    if (typeof val !== "string" || !HHMM_RE.test(val)) return `windows.${label} must be a valid HH:MM (00:00-23:59)`;
  }
  if (typeof row.gitRemote !== "string" || row.gitRemote.trim().length === 0) return "gitRemote must be a non-empty string ('local-only' or an URL)";
  return null;
}

/** Build the exact JSON that would be written. Rows are sorted by id; under the kill switch
 * every row reads suspended (§4.4). Malformed stored rows — bad id (pre-existing) or any
 * §3.1 schema violation (QA F2) — are skipped with a console warn + audit row: one
 * hand-edited row must not take the whole export down (the reader hard-fails malformed
 * files, so a bad row would blind every tenant consumer). `skipped` counts the dropped
 * rows so callers can surface the loss. */
function buildTenantLoopExportDetailed(
  records: TenantRecord[],
  groups: LoopGroupConfig[],
  now: Date,
  audit?: ExportAudit,
): { payload: TenantLoopRegistryExport; skipped: number } {
  const disabled = tenantLoopDisabled();
  const tenants: TenantLoopTenantRow[] = [];
  let skipped = 0;
  for (const rec of records) {
    if (!rec.loopStatus) continue; // not loop-registered
    if (!TENANT_ID_RE.test(rec.tenantId)) {
      console.warn(`[co-workspace] tenant-loop export: skipping malformed tenant id ${rec.tenantId}`);
      audit?.record("system", "tenant.loop.export.row.skipped", rec.tenantId, "tenant id does not match ^gw-[0-9a-f]{12}$");
      skipped += 1;
      continue;
    }
    const { scopes, windows } = effectiveLoopConfig(rec, groups);
    const row: TenantLoopTenantRow = {
      id: rec.tenantId,
      principal: rec.ownerPrincipal ?? "anonymous",
      variant: rec.variant,
      projectDir: rec.projectDir,
      status: disabled ? "suspended" : rec.loopStatus,
      scopes,
      windows,
      gitRemote: rec.loopGitRemote ?? "local-only",
    };
    // [QA F2] same policy as the id case: a schema-invalid row is dropped, not written —
    // the workspace reader treats one malformed row as a malformed FILE (fail-closed).
    const schemaError = exportRowSchemaError(row);
    if (schemaError !== null) {
      console.warn(`[co-workspace] tenant-loop export: skipping schema-invalid tenant ${rec.tenantId}: ${schemaError}`);
      audit?.record("system", "tenant.loop.export.row.skipped", rec.tenantId, schemaError);
      skipped += 1;
      continue;
    }
    tenants.push(row);
  }
  tenants.sort((a, b) => a.id.localeCompare(b.id));
  return { payload: { schemaVersion: SCHEMA_VERSION, writtenAt: now.toISOString(), tenants }, skipped };
}

/** Build the exact JSON that would be written (the audit/count-aware detailed builder,
 * payload only — the admin registry-preview route reads this shape). */
export function buildTenantLoopExport(
  records: TenantRecord[],
  groups: LoopGroupConfig[],
  now: Date = new Date(),
): TenantLoopRegistryExport {
  return buildTenantLoopExportDetailed(records, groups, now).payload;
}

export type TenantLoopExportResult =
  | { ok: true; path: string; tenants: number; skipped: number }
  | { ok: false; path: string; error: string };

/** Atomic (temp + rename, same directory) write of the export. On failure the previous file
 * stays in place and the caller's audit log records the failure (§4.5). [QA H8] the file
 * carries principal PII (loginId), so it is written 0600 — the temp file carries the mode
 * and the same-directory rename preserves it. */
export function writeTenantLoopExport(
  workspaceDir: string,
  records: TenantRecord[],
  groups: LoopGroupConfig[],
  audit?: ExportAudit,
  now: Date = new Date(),
): TenantLoopExportResult {
  const path = tenantLoopRegistryPath(workspaceDir);
  const { payload, skipped } = buildTenantLoopExportDetailed(records, groups, now, audit);
  const tmp = `${path}.${process.pid}.tmp`;
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, path); // atomic within the same directory
    if (skipped > 0) {
      audit?.record("system", "tenant.loop.export.rows.skipped", path, `${skipped} schema-invalid row(s) dropped`);
    }
    return { ok: true, path, tenants: payload.tenants.length, skipped };
  } catch (err) {
    const error = (err as Error).message;
    console.error(`[co-workspace] tenant-loop registry export FAILED (${path}); previous file left in place: ${error}`);
    audit?.record("system", "tenant.loop.export.failed", path, error);
    try {
      if (existsSync(tmp)) renameSync(tmp, `${tmp}.failed`); // keep the temp from accumulating
    } catch {
      /* best effort */
    }
    return { ok: false, path, error };
  }
}

/** Gateway-state convenience: export from the live stores (used by admin routes + boot). */
export function exportTenantLoopRegistry(state: GatewayState, now: Date = new Date()): TenantLoopExportResult {
  return writeTenantLoopExport(state.cfg.workspaceDir, state.registry.list(), state.users.listGroups(), state.audit, now);
}

/** Preview-only read of the CURRENT export file (the GET /admin/tenant-loop/registry route
 * shows the live file when present; the route falls back to a fresh build otherwise). */
export function readTenantLoopExport(workspaceDir: string): TenantLoopRegistryExport | null {
  const path = tenantLoopRegistryPath(workspaceDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as TenantLoopRegistryExport;
  } catch {
    return null;
  }
}

// ── Daily upgrade quota (§4.4) ──────────────────────────────────────────────

/** Per-tenant daily upgrade cap, UTC-day bucket (default 1/day/tenant; 0 = off). */
export const TENANT_LOOP_UPGRADE_DAILY_CAP = 1;

export function upgradeDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function upgradesUsedToday(rec: TenantRecord, day: string): number {
  return rec.loopState && rec.loopState.upgradesDay === day ? rec.loopState.upgradesToday : 0;
}

export function assertUpgradeQuota(rec: TenantRecord, now: Date = new Date(), cap = TENANT_LOOP_UPGRADE_DAILY_CAP): void {
  if (cap <= 0) return;
  const day = upgradeDayKey(now);
  const used = upgradesUsedToday(rec, day);
  if (used >= cap) {
    throw new HttpError(429, `tenant upgrade quota exhausted (${used}/${cap} today, UTC day ${day})`);
  }
}

export function recordUpgradeQuota(rec: TenantRecord, now: Date = new Date()): void {
  const day = upgradeDayKey(now);
  rec.loopState = { upgradesDay: day, upgradesToday: upgradesUsedToday(rec, day) + 1 };
}

// ── Upgrade plan + executor (§4.4) ──────────────────────────────────────────

export interface TenantUpgradePlan {
  tenantId: string;
  variant: string;
  projectDir: string;
  templateVersion: string | null;
  snapshotBranch: string;
  /** true when gitRemote is "local-only" — the backup branch has no remote safety net. */
  localOnlyBackup: boolean;
  window: { ok: boolean; reason: string };
  quota: { day: string; used: number; cap: number };
  command: string[];
  envAllowlistKeys: string[];
  scriptPresent: boolean;
  dryRun: true;
}

export interface TenantUpgradeExecution {
  plan: TenantUpgradePlan;
  snapshot: { ok: boolean; branch: string; detail: string };
  exitCode: number;
  stdoutTail: string;
  stderrTail: string;
}

export interface TenantLoopExecDeps {
  spawn?: (argv: string[], cwd: string, env: Record<string, string | undefined>) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  git?: (argv: string[], cwd: string) => { exitCode: number; stdout: string; stderr: string };
  now?: Date;
}

const defaultSpawn = async (
  argv: string[],
  cwd: string,
  env: Record<string, string | undefined>,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const proc = Bun.spawn(argv, { cwd, env: env as Record<string, string>, stdout: "pipe", stderr: "pipe", stdin: "ignore" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stdout, stderr };
};

const defaultGit = (argv: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } => {
  const proc = Bun.spawnSync(["git", ...argv], { cwd, stdout: "pipe", stderr: "pipe" });
  return { exitCode: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
};

/** Git-ref-safe timestamp for the backup branch: `tenant-backup/20261108T120000Z`. */
export function snapshotBranchName(now: Date = new Date()): string {
  return `tenant-backup/${now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "")}`;
}

function readTemplateVersion(projectDir: string): string | null {
  try {
    const text = readFileSync(join(projectDir, "template-version.txt"), "utf8").trim();
    return text || null;
  } catch {
    return null;
  }
}

/** [QA H7] Namespaces denied ON TOP of the scaffold allowlist for THIS executor only. The
 * hermes.ts allowlistedEnv legitimately passes ANTHROPIC_* / OPENAI_* (the turn runtime needs
 * its provider keys) — the upgrade subprocess is workspace TOOLING, not a turn, so provider
 * credentials must never reach it. GOOGLE_CLIENT_* is already denied by allowlistedEnv's
 * ENV_DENY; restated here so this executor's deny list is self-contained. */
const EXECUTOR_ENV_DENY = /^(ANTHROPIC_|OPENAI_|GEMINI_|GOOGLE_CLIENT_)/i;

/** Env of the upgrade subprocess (QA H7): scaffold-child allowlist (hermes.ts
 * allowlistedEnv — CO_WORKSPACE_* gateway secrets never pass) MINUS the provider-key
 * namespaces, plus CI=1 (scaffold.ts:56 pattern). Pure over `base` so tests assert the
 * builder without spawning. */
export function tenantUpgradeEnv(base: Record<string, string | undefined> = process.env): Record<string, string | undefined> {
  const env = allowlistedEnv(base);
  for (const k of Object.keys(env)) {
    if (EXECUTOR_ENV_DENY.test(k)) delete env[k];
  }
  env.CI = "1";
  return env;
}

/** The exact argv + env the executor would use (env = tenantUpgradeEnv — allowlist minus
 * provider keys, QA H7; the gateway env is never passed wholesale). */
export function tenantUpgradeCommand(workspaceDir: string, rec: TenantRecord): { command: string[]; env: Record<string, string | undefined>; cwd: string } {
  const script = join(workspaceDir, "scripts", "upgrade-project.ts");
  return {
    command: [process.execPath, script, rec.projectDir, "--confirm"],
    env: tenantUpgradeEnv(process.env),
    cwd: workspaceDir,
  };
}

/** Dry-run-first upgrade evaluation shared by the admin route and tests (deterministic via
 * `opts.now`). Refusals are typed HttpErrors; success returns the plan (no confirm) or
 * executes (snapshot → allowlisted-env subprocess) and records the quota + audit rows. */
export async function evaluateTenantUpgrade(
  state: GatewayState,
  rec: TenantRecord,
  opts: { confirm?: boolean; now?: Date; cap?: number; deps?: TenantLoopExecDeps } = {},
): Promise<{ plan: TenantUpgradePlan } | { execution: TenantUpgradeExecution }> {
  const now = opts.now ?? new Date();
  const groups = state.users.listGroups();
  const { scopes, windows } = effectiveLoopConfig(rec, groups);
  if (!rec.loopStatus) {
    throw new HttpError(409, "tenant is not registered in the tenant loop", "tenant_loop_not_registered");
  }
  if (rec.loopStatus === "suspended") {
    throw new HttpError(409, "tenant loop participation is suspended", "tenant_loop_suspended");
  }
  if (scopes.upgrade !== true) {
    throw new HttpError(403, "tenant scopes.upgrade is false", "tenant_loop_scope_off");
  }
  const window = loopWindowVerdict(windows, now);
  if (!window.ok) {
    throw new HttpError(403, `tenant is outside its loop windows (${window.reason})`, "tenant_loop_out_of_window");
  }
  // Drain consideration: never start an upgrade under a live turn child (QA-07 cancel map).
  if (state.activeProcs.has(rec.tenantId)) {
    throw new HttpError(409, "tenant has an active turn — upgrade refused until it finishes", "tenant_busy");
  }
  // [QA H5] Executor containment: the spawn target must be gateway-owned storage. A
  // hand-edited registry row pointing anywhere else (another checkout, the workspace root,
  // a nonexistent dir) is refused BEFORE any git call or spawn — the upgrade engine would
  // otherwise run arbitrary workspace code against an attacker-chosen directory.
  // Attached tenants (projectDir outside storage by design) are out of loop scope here.
  // A nested FUNCTION DECLARATION (not a const arrow) so TS propagates `never` at the
  // call site (access.ts deny() precedent).
  function refuseDir(detail: string): never {
    state.audit.record("system", "tenant.loop.upgrade.refused", rec.tenantId, detail);
    throw new HttpError(403, `tenant projectDir outside gateway storage — upgrade refused (${detail})`, "tenant_dir_outside_storage");
  }
  let realProjectDir: string;
  try {
    realProjectDir = realpathSync(rec.projectDir);
  } catch (err) {
    refuseDir(`projectDir does not resolve: ${(err as Error).message}`);
  }
  const realDataDir = realpathSync(state.cfg.dataDir);
  const storageRoot = join(realDataDir, "storage");
  if (!(realProjectDir === storageRoot || realProjectDir.startsWith(storageRoot + sep))) {
    refuseDir(`${realProjectDir} is not under ${storageRoot}`);
  }
  if (realProjectDir === realpathSync(state.cfg.workspaceDir)) {
    refuseDir(`${realProjectDir} is the workspace root`);
  }
  assertUpgradeQuota(rec, now, opts.cap);

  const { command, env, cwd } = tenantUpgradeCommand(state.cfg.workspaceDir, rec);
  const scriptPresent = existsSync(command[1]);
  if (!scriptPresent) {
    throw new HttpError(500, `upgrade engine not found: ${command[1]} (workspaceDir misconfigured?)`, "upgrade_script_missing");
  }
  const day = upgradeDayKey(now);
  const plan: TenantUpgradePlan = {
    tenantId: rec.tenantId,
    variant: rec.variant,
    projectDir: rec.projectDir,
    templateVersion: readTemplateVersion(rec.projectDir),
    snapshotBranch: snapshotBranchName(now),
    localOnlyBackup: (rec.loopGitRemote ?? "local-only") === "local-only",
    window,
    quota: { day, used: upgradesUsedToday(rec, day), cap: opts.cap ?? TENANT_LOOP_UPGRADE_DAILY_CAP },
    command,
    envAllowlistKeys: Object.keys(env).sort(),
    scriptPresent,
    dryRun: true,
  };
  if (opts.confirm !== true) return { plan };

  // ── Execute: quota slot FIRST (QA H6) → snapshot branch (best-effort) → spawn the
  // workspace upgrade engine.
  const deps = opts.deps ?? {};
  const git = deps.git ?? defaultGit;
  const spawn = deps.spawn ?? defaultSpawn;
  // [QA H6] The quota slot is recorded BEFORE the spawn, in the same synchronous block as
  // the assertUpgradeQuota check above (no await in between): JS cannot interleave two
  // callers inside that block, so two concurrent confirms can no longer both pass the
  // check-then-record race (the old code recorded AFTER `await spawn`, leaving both
  // callers under the cap). Rollback on spawn failure is deliberately NOT implemented —
  // a burned slot on a failed spawn is acceptable and simpler than undo semantics.
  recordUpgradeQuota(rec, now);
  state.registry.upsert(rec);

  const snapshot = git(["branch", plan.snapshotBranch], rec.projectDir);
  const snapshotDetail = snapshot.exitCode === 0
    ? `branch ${plan.snapshotBranch} created`
    : `git branch failed (exit ${snapshot.exitCode}): ${tail((snapshot.stderr || snapshot.stdout).trim(), 200)}`;
  // Best-effort: a failed snapshot is audited but does not block the upgrade (§4.4).
  state.audit.record("system", "tenant.loop.snapshot", rec.tenantId, snapshotDetail);

  const result = await spawn(command, cwd, env);
  const execution: TenantUpgradeExecution = {
    plan,
    snapshot: { ok: snapshot.exitCode === 0, branch: plan.snapshotBranch, detail: snapshotDetail },
    exitCode: result.exitCode,
    stdoutTail: tail(result.stdout),
    stderrTail: tail(result.stderr),
  };
  state.audit.record(
    "system",
    result.exitCode === 0 ? "tenant.loop.upgrade.executed" : "tenant.loop.upgrade.failed",
    rec.tenantId,
    `exit=${result.exitCode} branch=${plan.snapshotBranch}`,
  );
  return { execution };
}
