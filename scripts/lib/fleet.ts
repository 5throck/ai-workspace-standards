#!/usr/bin/env bun
// @version 1.2.0
// v1.2.0 (2026-11-09, CI fix PR #1935): tenantLoopRegistryPath() honors the
//          CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE env seam (absolute path to
//          the registry FILE) — single resolution point so tests can point
//          fixture registries at mkdtemp dirs instead of writing the real
//          repo's gitignored .pipeline-state (T-20261104-003 discipline; the
//          sibling-suite pollution incident that red PR #1935). Unset → the
//          v1.1.0 default path, behavior unchanged.
// v1.1.0 (2026-11-08, spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
//          §3.1/§3.2, WP1): tenant-loop registry helpers added ALONGSIDE the fleet
//          SSOT. Tenant ids (^gw-[0-9a-f]{12}$) are a DIFFERENT namespace from fleet
//          ids (^co-...): nothing here lets a tenant id enter a fleet enumeration or
//          vice versa — FLEET_ID_RE/isFleetMember/listFleetProjects/isFleetProjectPath
//          semantics are unchanged from v1.0.0. The tenant registry lives under
//          <root>/.pipeline-state/ (gitignored runtime state written by the gateway,
//          design §3.1) and is read FAIL-CLOSED with the deliberate inversion of the
//          fleet registry's absent-file rule: for tenants there is no historical
//          behavior to fall back to, so absent/stale(>24h)/schema-major → zero
//          tenants, while malformed → throw (design §6). Tenant enumeration NEVER
//          readdirs Projects/ — the only source is the registry file.
// v1.0.0 (2026-11-07, spec docs/designs/2026-11-07-fleet-membership-ssot-design.md
//          §4-§5, DEC-20261107-01): fleet membership SSOT helpers. The default
//          rule — every directory under Projects/ whose name starts with 'co-' —
//          is narrowed by the exclusions recorded in docs/fleet-membership.json
//          (L0-only, never propagated). This module is the SOLE code path
//          allowed to derive fleet membership: no script outside it may filter
//          a Projects/ readdir by the 'co-' prefix (enforced mechanically by
//          tests/unit/fleet-iteration-routing.test.ts, design §9.3). Consumers
//          restate nothing — the same one-derivation discipline as
//          helpers/hub-topology.ts and lib/git-aware-scan.ts. File reads are
//          injected via root; every exported function is deterministic given
//          its inputs, which keeps the unit suite on mkdtempSync fixtures fast.
//
// DELIVERY RULING (QA finding F1, 2026-11-09 — recorded, no code change; design
// docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §9 addendum):
// this file — INCLUDING the v1.1.0 tenant-loop helpers — is intentionally
// delivered L0+L1 byte-identical (templates/common/scripts/lib/fleet.ts):
// variants consume the same helper, and the IC-01 l1-import-closure gate forces
// the leaf pure-module into the delivered closure (ADR-0073 Amendment 4;
// DEC-20261107-01 condition 7 precedent). A delivered copy reads the PROJECT's
// own registry (absent/stale → zero tenants), so no workspace tenant state
// reaches L1/L2. Pinned by tests/unit/fleet-iteration-routing.test.ts (delivery-
// deviation pin) and the generate-scripts-mirror registry row.
//
// Failure semantics (design §4): registry file ABSENT → zero exclusions,
// historical glob behavior (backward-compatible rollout). Registry file
// MALFORMED → loadFleetRegistry reports {ok:false, error:'malformed'} and the
// fleetExclusions()/listFleetProjects()/excludedFleetIds() wrappers THROW —
// every fleet-iteration tool hard-fails rather than guessing (fail-closed,
// mirroring helpers/hub-topology.ts).

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** Repo root when a caller omits one: scripts/lib/ → the checkout root. */
function defaultRoot(): string {
  return resolve(import.meta.dir, '..', '..');
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface FleetExclusion {
  /** Directory name under Projects/, ^co-[a-z0-9-]{1,40}$ (design §4). */
  id: string;
  /** Non-empty human reason — decision provenance. */
  reason: string;
  /** Gate-moment date, YYYY-MM-DD. */
  decided: string;
  /** Gate-moment decision record id, DEC-YYYYMMDD-NN (ADR-0061). */
  decision_ref: string;
}

export interface FleetRegistry {
  version: number;
  excluded: FleetExclusion[];
}

export type LoadFleetRegistryResult =
  | { ok: true; registry: FleetRegistry }
  /** File absent → zero exclusions, historical glob behavior (design §4). */
  | { ok: false; error: 'absent-file' }
  /** File malformed → callers hard-fail, never guess (fail-closed). */
  | { ok: false; error: 'malformed'; detail: string };

// ── Validation ─────────────────────────────────────────────────────────────

const FLEET_ID_RE = /^co-[a-z0-9-]{1,40}$/; // same shape as the upstream-server requester rule
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DECISION_REF_RE = /^DEC-\d{8}-\d{2,4}$/;

/** Real-calendar check behind the YYYY-MM-DD shape (rejects 2026-02-31). */
function isValidCalendarDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Validate a parsed docs/fleet-membership.json payload (design §4 validation
 * rules). Returns the cleaned registry, or a fail-closed detail string.
 * Unknown keys are ignored forward-compatibly.
 */
export function validateFleetRegistryPayload(payload: unknown): { ok: true; registry: FleetRegistry } | { ok: false; detail: string } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, detail: 'top-level payload must be a JSON object' };
  }
  const raw = payload as Record<string, unknown>;
  if (raw.version !== 1) {
    return { ok: false, detail: `version must be 1, got ${JSON.stringify(raw.version)}` };
  }
  if (!Array.isArray(raw.excluded)) {
    return { ok: false, detail: `'excluded' must be an array, got ${typeof raw.excluded}` };
  }
  const seen = new Set<string>();
  const excluded: FleetExclusion[] = [];
  for (let i = 0; i < raw.excluded.length; i++) {
    const row = raw.excluded[i] as Record<string, unknown>;
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      return { ok: false, detail: `excluded[${i}] must be an object` };
    }
    const id = row.id;
    if (typeof id !== 'string' || !FLEET_ID_RE.test(id)) {
      return {
        ok: false,
        detail: `excluded[${i}].id must match ^co-[a-z0-9-]{1,40}$, got ${JSON.stringify(id)}`,
      };
    }
    if (typeof row.reason !== 'string' || row.reason.trim().length === 0) {
      return { ok: false, detail: `excluded[${i}] (${id}).reason must be a non-empty string` };
    }
    if (typeof row.decided !== 'string' || !isValidCalendarDate(row.decided)) {
      return {
        ok: false,
        detail: `excluded[${i}] (${id}).decided must be a valid YYYY-MM-DD date, got ${JSON.stringify(row.decided)}`,
      };
    }
    if (typeof row.decision_ref !== 'string' || !DECISION_REF_RE.test(row.decision_ref)) {
      return {
        ok: false,
        detail: `excluded[${i}] (${id}).decision_ref must match DEC-YYYYMMDD-NN, got ${JSON.stringify(row.decision_ref)}`,
      };
    }
    if (seen.has(id)) {
      return { ok: false, detail: `duplicate exclusion id '${id}'` };
    }
    seen.add(id);
    excluded.push({ id, reason: row.reason, decided: row.decided, decision_ref: row.decision_ref });
  }
  return { ok: true, registry: { version: 1, excluded } };
}

// ── Loading ────────────────────────────────────────────────────────────────

/** Registry path relative to the workspace root. L0-only — never propagated. */
export function fleetRegistryPath(root: string = defaultRoot()): string {
  return join(root, 'docs', 'fleet-membership.json');
}

/**
 * Read + validate docs/fleet-membership.json under root.
 * - File absent → {ok:false, error:'absent-file'} — consumers proceed with
 *   zero exclusions (historical glob behavior; design §4).
 * - File malformed (bad JSON, bad shape, bad row) → {ok:false, error:'malformed'}
 *   with a useful detail — consumers MUST hard-fail, never guess (fail-closed).
 */
export function loadFleetRegistry(root: string = defaultRoot()): LoadFleetRegistryResult {
  const path = fleetRegistryPath(root);
  if (!existsSync(path)) return { ok: false, error: 'absent-file' };
  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    return {
      ok: false,
      error: 'malformed',
      detail: `${path} is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    };
  }
  const validated = validateFleetRegistryPayload(payload);
  if (!validated.ok) return { ok: false, error: 'malformed', detail: validated.detail };
  return { ok: true, registry: validated.registry };
}

/**
 * Exclusion rows ([] when the registry file is absent — historical behavior;
 * THROWS with the malformed detail when the file exists but fails validation,
 * the fail-closed contract of design §4).
 */
export function fleetExclusions(root: string = defaultRoot()): FleetExclusion[] {
  const result = loadFleetRegistry(root);
  if (result.ok) return result.registry.excluded;
  if (result.error === 'absent-file') return [];
  throw new Error(`Malformed fleet registry (docs/fleet-membership.json): ${result.detail}`);
}

/** Set of excluded ids (convenience for hot loops). Same failure semantics as fleetExclusions(). */
export function excludedFleetIds(root: string = defaultRoot()): Set<string> {
  return new Set(fleetExclusions(root).map((e) => e.id));
}

// ── Membership ─────────────────────────────────────────────────────────────

/**
 * Membership test for a directory NAME under Projects/ (not a path): starts
 * with 'co-' and is not in the exclusion set. Exclusions default to the
 * loaded registry; callers iterating in a hot loop may pass their own set.
 */
export function isFleetMember(name: string, exclusions: ReadonlySet<string> = excludedFleetIds()): boolean {
  return name.startsWith('co-') && !exclusions.has(name);
}

/**
 * Fleet member paths, sorted: Projects/<name> for every co-* directory under
 * Projects/ minus the registry exclusions. Projects/ absent → []. Does NOT
 * filter transient PR working checkouts — compose with
 * lib/git-aware-scan.ts filterTransientCheckouts() where that behavior
 * already exists (skill-graph-fleet-report.ts); transient semantics are
 * unchanged by this module (design §5).
 */
export function listFleetProjects(root: string = defaultRoot()): string[] {
  const exclusions = excludedFleetIds(root);
  const dir = join(root, 'Projects');
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && isFleetMember(e.name, exclusions)) {
      // Forward-slash normalized (design §5 "Projects/<name>"): every node fs
      // API accepts '/' on Windows, and platform-independent output keeps the
      // CLI/JSON contracts and consumer string handling deterministic.
      out.push(join('Projects', e.name).replace(/\\/g, '/'));
    }
  }
  return out.sort();
}

/**
 * Path-form guard for single-project tools (design §6 B-class refusals):
 * true when <path> resolves to a fleet member directory — i.e. exactly
 * <root>/Projects/<member-name>. Relative paths resolve against root (the
 * way a tool running with cwd=root would); a bare name ('co-hr') is
 * rejected: this is a path guard, not a name guard.
 */
export function isFleetProjectPath(path: string, root: string = defaultRoot()): boolean {
  const base = resolve(root);
  const target = resolve(base, path);
  const rel = relative(base, target);
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) return false;
  const parts = rel.split(/[\\/]/);
  if (parts.length !== 2 || parts[0] !== 'Projects') return false;
  return isFleetMember(parts[1], excludedFleetIds(root));
}

/**
 * One-line operator notice for an explicitly-named excluded member (the
 * A1–A3 `--project` WARN of design §6.7), or null when the path is not an
 * excluded fleet member. Relative paths resolve against root, matching the
 * A1–A3 tools' own relative-path handling. Single-source for the exact
 * wording so every read-only tool warns identically:
 * "co-abap-plugin is not a fleet member (docs/fleet-membership.json) — proceeding read-only".
 */
export function exclusionNotice(projectPath: string, root: string = defaultRoot()): string | null {
  const base = resolve(root);
  const target = resolve(base, projectPath);
  const rel = relative(base, target);
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) return null;
  const parts = rel.split(/[\\/]/);
  if (parts.length !== 2 || parts[0] !== 'Projects') return null;
  const name = parts[1];
  if (!name.startsWith('co-')) return null;
  const exclusions = fleetExclusions(root);
  const row = exclusions.find((e) => e.id === name);
  if (!row) return null;
  return `${name} is not a fleet member (docs/fleet-membership.json) — proceeding read-only`;
}

/**
 * Exclusion record for a project NAME under Projects/, or null. Used by the
 * B-class creation guards (new-project / create-l3-scaffold refuse a name
 * matching an exclusion record, design §6.4) and adopt-project (§6.3).
 */
export function exclusionForName(name: string, root: string = defaultRoot()): FleetExclusion | null {
  return fleetExclusions(root).find((e) => e.id === name) ?? null;
}

// ── Tenant loop (design docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §3.1/§3.2) ──
//
// Gateway tenants are variant projects relocated OUT of Projects/ into gateway
// storage. Their loop participation is governed by an export file the gateway
// writes (<root>/.pipeline-state/tenant-loop-registry.json) — the tenant SSOT.
// Everything below reads ONLY that file (never a Projects/ or storage readdir).

export const TENANT_ID_RE = /^gw-[0-9a-f]{12}$/;

/** Registry staleness bound (design §3.1): a writtenAt older than 24h means the
 * gateway export was not refreshed — the whole file acts as absent. */
export const TENANT_LOOP_STALE_MS = 24 * 3_600_000;

export interface TenantLoopScopes {
  upgrade: boolean;
  upstreamFile: boolean;
  backportReview: boolean;
  nightlyFleet: boolean;
}

export interface TenantLoopWindows {
  /** IANA tz name the start/end clock times are expressed in. */
  tz: string;
  /** Weekdays the window opens on, 0-6 (0 = Sunday, the Intl convention). */
  days: number[];
  /** HH:MM in tz; start > end wraps midnight (22:00-06:00 spans the night). */
  start: string;
  end: string;
}

export interface TenantLoopTenant {
  id: string;
  principal: string;
  /** Fleet-namespace variant the tenant was scaffolded from (^co-[a-z0-9-]{1,40}$). */
  variant: string;
  /** Absolute path of the tenant's project root in gateway storage. */
  projectDir: string;
  status: 'active' | 'suspended';
  scopes: TenantLoopScopes;
  windows: TenantLoopWindows;
  /** 'local-only' or an URL (design §3.1 field rules). */
  gitRemote: string;
}

export interface TenantLoopRegistry {
  schemaVersion: 1;
  writtenAt: string;
  tenants: TenantLoopTenant[];
}

export type LoadTenantLoopRegistryResult =
  | { ok: true; registry: TenantLoopRegistry }
  /** File absent → zero tenants (no historical behavior to fall back to, §3.1). */
  | { ok: false; error: 'absent-file' }
  /** writtenAt older than 24h → zero tenants; a WARN row is emitted for the log. */
  | { ok: false; error: 'stale'; detail: string }
  /** schemaVersion >= 2 → treat the ENTIRE file as absent (never misread a newer
   * format with v1 code); a WARN row is emitted for the log. */
  | { ok: false; error: 'schema-major'; detail: string }
  /** Malformed JSON / invalid row → callers hard-fail, never guess (fail-closed). */
  | { ok: false; error: 'malformed'; detail: string };

const TENANT_HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Registry path under the workspace root. Gitignored runtime state — L0-only.
 * v1.2.0 seam: CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE (an ABSOLUTE path to the
 * registry FILE, not a directory) replaces the repo-root path entirely when
 * set — single resolution point for every consumer (upgrade-project guard,
 * backport-diff, mcp-upstream-server identity). Tests use it to keep fixture
 * registries in mkdtemp dirs and never write the real repo's gitignored state
 * (T-20261104-003 relative-path pollution discipline). Unset → default path,
 * byte-identical behavior to v1.1.0.
 */
export function tenantLoopRegistryPath(root: string = defaultRoot()): string {
  const override = process.env.CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE;
  if (override !== undefined && override.trim().length > 0) return resolve(override);
  return join(root, '.pipeline-state', 'tenant-loop-registry.json');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validate a parsed tenant-loop-registry.json payload (design §3.1 schema,
 * schemaVersion 1). Pure: `nowMs` makes the 24h staleness decision deterministic.
 * Unknown row keys are ignored forward-compatibly, EXCEPT `scopes`, which must
 * carry exactly the four boolean keys (design §3.1 field rules). Returns the
 * cleaned registry, or the fail-closed failure kind with a useful detail.
 */
export function validateTenantLoopRegistryPayload(
  payload: unknown,
  nowMs: number = Date.now(),
): { ok: true; registry: TenantLoopRegistry } | { ok: false; kind: 'malformed' | 'schema-major' | 'stale'; detail: string } {
  if (!isPlainObject(payload)) {
    return { ok: false, kind: 'malformed', detail: 'top-level payload must be a JSON object' };
  }
  const raw = payload;
  const sv = raw.schemaVersion;
  if (typeof sv !== 'number' || !Number.isInteger(sv)) {
    return { ok: false, kind: 'malformed', detail: `schemaVersion must be an integer, got ${JSON.stringify(sv)}` };
  }
  if (sv >= 2) {
    return { ok: false, kind: 'schema-major', detail: `schemaVersion ${sv} is a major bump over 1 — treat the file as absent and rebuild on the gateway side` };
  }
  if (sv !== 1) {
    return { ok: false, kind: 'malformed', detail: `schemaVersion must be 1, got ${sv}` };
  }
  if (typeof raw.writtenAt !== 'string' || Number.isNaN(Date.parse(raw.writtenAt))) {
    return { ok: false, kind: 'malformed', detail: `writtenAt must be an ISO-8601 timestamp, got ${JSON.stringify(raw.writtenAt)}` };
  }
  const ageMs = nowMs - Date.parse(raw.writtenAt);
  if (ageMs > TENANT_LOOP_STALE_MS) {
    return { ok: false, kind: 'stale', detail: `writtenAt ${raw.writtenAt} is older than 24h — restart or touch the gateway export` };
  }
  if (!Array.isArray(raw.tenants)) {
    return { ok: false, kind: 'malformed', detail: `'tenants' must be an array, got ${typeof raw.tenants}` };
  }
  const seen = new Set<string>();
  const tenants: TenantLoopTenant[] = [];
  for (let i = 0; i < raw.tenants.length; i++) {
    const row = raw.tenants[i];
    const at = `tenants[${i}]`;
    if (!isPlainObject(row)) return { ok: false, kind: 'malformed', detail: `${at} must be an object` };
    const { id, principal, variant, projectDir, status, scopes, windows, gitRemote } = row;
    if (typeof id !== 'string' || !TENANT_ID_RE.test(id)) {
      return { ok: false, kind: 'malformed', detail: `${at}.id must match ^gw-[0-9a-f]{12}$, got ${JSON.stringify(id)}` };
    }
    if (typeof principal !== 'string' || principal.trim().length === 0) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).principal must be a non-empty string` };
    }
    if (typeof variant !== 'string' || !FLEET_ID_RE.test(variant)) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).variant must match ^co-[a-z0-9-]{1,40}$, got ${JSON.stringify(variant)}` };
    }
    if (typeof projectDir !== 'string' || projectDir.length === 0 || !isAbsolute(projectDir)) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).projectDir must be an absolute path, got ${JSON.stringify(projectDir)}` };
    }
    if (status !== 'active' && status !== 'suspended') {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).status must be 'active' or 'suspended', got ${JSON.stringify(status)}` };
    }
    if (!isPlainObject(scopes)) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).scopes must be an object` };
    }
    const scopeKeys = Object.keys(scopes).sort();
    const expectedKeys = ['backportReview', 'nightlyFleet', 'upgrade', 'upstreamFile'];
    if (scopeKeys.length !== expectedKeys.length || scopeKeys.some((k, j) => k !== expectedKeys[j])) {
      return {
        ok: false, kind: 'malformed',
        detail: `${at} (${id}).scopes must carry exactly the keys ${expectedKeys.join(', ')} (design §3.1), got [${Object.keys(scopes).join(', ')}]`,
      };
    }
    if (expectedKeys.some((k) => typeof scopes[k] !== 'boolean')) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).scopes values must all be booleans` };
    }
    if (!isPlainObject(windows)) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).windows must be an object` };
    }
    const { tz, days, start, end } = windows;
    if (typeof tz !== 'string' || tz.trim().length === 0) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).windows.tz must be a non-empty IANA tz name` };
    }
    if (!Array.isArray(days) || days.length === 0 || days.some((d) => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6)) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).windows.days must be a non-empty array of integers 0-6 (0 = Sunday), got ${JSON.stringify(days)}` };
    }
    for (const [label, val] of [['start', start], ['end', end]] as const) {
      if (typeof val !== 'string' || !TENANT_HHMM_RE.test(val)) {
        return { ok: false, kind: 'malformed', detail: `${at} (${id}).windows.${label} must be a valid HH:MM (00:00-23:59), got ${JSON.stringify(val)}` };
      }
    }
    if (typeof start !== 'string' || typeof end !== 'string') {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).windows.start/end must be valid HH:MM strings` };
    }
    if (typeof gitRemote !== 'string' || gitRemote.trim().length === 0) {
      return { ok: false, kind: 'malformed', detail: `${at} (${id}).gitRemote must be a non-empty string ('local-only' or an URL)` };
    }
    if (seen.has(id)) return { ok: false, kind: 'malformed', detail: `duplicate tenant id '${id}'` };
    seen.add(id);
    tenants.push({
      id,
      principal,
      variant,
      projectDir,
      status,
      scopes: { upgrade: scopes.upgrade as boolean, upstreamFile: scopes.upstreamFile as boolean, backportReview: scopes.backportReview as boolean, nightlyFleet: scopes.nightlyFleet as boolean },
      windows: { tz, days: [...days], start, end },
      gitRemote,
    });
  }
  return { ok: true, registry: { schemaVersion: 1, writtenAt: raw.writtenAt, tenants } };
}

/**
 * Read + validate .pipeline-state/tenant-loop-registry.json under root
 * (design §3.1). Each read is a fresh stat+parse of a small gitignored file —
 * deliberately UNCACHED so the fail-closed decision is always made on the bytes
 * on disk (tests mutate fixtures between calls; the 24h staleness bound, not a
 * cache, is the design's freshness mechanism).
 * - File absent → {ok:false, error:'absent-file'} — zero tenants (§3.1: no
 *   historical tenant behavior exists to fall back to).
 * - writtenAt older than 24h, or schemaVersion >= 2 → zero tenants with the
 *   distinct detail, plus a WARN row on console.error for the operator log.
 * - Malformed (bad JSON / invalid row) → {ok:false, error:'malformed'} with a
 *   useful detail — consumers MUST hard-fail, never guess (fail-closed, §6).
 */
export function loadTenantLoopRegistry(root: string = defaultRoot()): LoadTenantLoopRegistryResult {
  const path = tenantLoopRegistryPath(root);
  if (!existsSync(path)) return { ok: false, error: 'absent-file' };
  let payload: unknown;
  try {
    payload = JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    return {
      ok: false,
      error: 'malformed',
      detail: `${path} is not valid JSON (${err instanceof Error ? err.message : String(err)})`,
    };
  }
  const validated = validateTenantLoopRegistryPayload(payload, Date.now());
  if (validated.ok) return { ok: true, registry: validated.registry };
  if (validated.kind === 'schema-major') {
    console.error(`[fleet] WARN: tenant-loop registry (${path}) ${validated.detail} — proceeding with zero tenants`);
    return { ok: false, error: 'schema-major', detail: validated.detail };
  }
  if (validated.kind === 'stale') {
    console.error(`[fleet] WARN: tenant-loop registry (${path}) ${validated.detail} — proceeding with zero tenants`);
    return { ok: false, error: 'stale', detail: validated.detail };
  }
  return { ok: false, error: 'malformed', detail: validated.detail };
}

/**
 * Registered tenant-loop projects, sorted by id: ONLY tenants with
 * scopes.nightlyFleet=true and status=active (design §3.2). Reads the registry
 * under <root>/.pipeline-state/ (injected root, deterministic,
 * mkdtemp-fixture-friendly). Absent/stale/schema-major → [] (fail-closed,
 * §3.1); malformed → THROWS with the detail so a run aborts instead of guessing
 * (§6). Never readdirs — this is the ONLY tenant enumeration path loop
 * consumers may use.
 */
export function listTenantLoopProjects(root: string = defaultRoot()): TenantLoopTenant[] {
  const result = loadTenantLoopRegistry(root);
  if (result.ok) {
    return result.registry.tenants
      .filter((t) => t.status === 'active' && t.scopes.nightlyFleet)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }
  if (result.error === 'malformed') {
    throw new Error(`Malformed tenant-loop registry (${tenantLoopRegistryPath(root)}): ${result.detail}`);
  }
  return []; // absent-file / stale / schema-major — the loader already WARNed where useful
}

/** Minutes since midnight for a validated HH:MM string. */
function tenantWindowMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

const TENANT_WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Local weekday (0=Sun) + minutes-since-midnight for `at` rendered in `tz`;
 * null when the tz is unknown/unrepresentable (fail-closed deny, design §6). */
function tenantTzParts(tz: string, at: Date): { day: number; minutes: number } | null {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const parts = dtf.formatToParts(at);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const day = TENANT_WEEKDAY_INDEX[get('weekday')];
    const h = Number(get('hour'));
    const m = Number(get('minute'));
    if (day === undefined || !Number.isInteger(h) || !Number.isInteger(m)) return null;
    return { day, minutes: (h % 24) * 60 + m };
  } catch {
    return null; // unknown IANA tz throws RangeError → deny
  }
}

/**
 * tz-aware window check for a tenant (design §3.2): start-inclusive,
 * end-exclusive, evaluated in windows.tz. Wrap-midnight windows (start > end)
 * are supported: minutes after midnight attribute to the PREVIOUS calendar day
 * (the day the window opened on) for the days[] match. Any invalid input —
 * unknown/absent tz, empty days, unparseable HH:MM — denies (false),
 * fail-closed per design §6.
 */
export function isTenantWithinWindows(tenant: TenantLoopTenant, now: Date = new Date()): boolean {
  const windows = tenant?.windows;
  if (!windows) return false;
  const { tz, days, start, end } = windows;
  if (typeof tz !== 'string' || tz.trim().length === 0) return false;
  if (!Array.isArray(days) || days.length === 0 || days.some((d) => typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 6)) return false;
  if (typeof start !== 'string' || typeof end !== 'string' || !TENANT_HHMM_RE.test(start) || !TENANT_HHMM_RE.test(end)) return false;
  const parts = tenantTzParts(tz, now);
  if (!parts) return false;
  const { day, minutes } = parts;
  const startM = tenantWindowMinutes(start);
  const endM = tenantWindowMinutes(end);
  if (startM === endM) return false; // zero-length window — never open (fail-closed)
  if (startM < endM) {
    return days.includes(day) && minutes >= startM && minutes < endM;
  }
  // Wrap-midnight (start > end): either still inside the window that opened on
  // `day`, or inside the tail of the window that opened the previous day.
  return (minutes >= startM && days.includes(day)) || (minutes < endM && days.includes((day + 6) % 7));
}

/**
 * Registered tenant for a path, or null: the path is the tenant's registered
 * projectDir itself or a descendant of it, matched directly against the
 * registry entries (no walk-up discovery, design §3.3.2). Symlinks are
 * resolved on BOTH sides: the target resolves through its deepest EXISTING
 * ancestor (realpath), with any not-yet-existing remainder appended
 * lexically — so a registered tenant path matches before its contents are
 * created, while an existing symlinked path always compares by real identity.
 * When several entries nest, the DEEPEST matching projectDir wins. Entries
 * whose projectDir no longer exists, or that resolve to the workspace root
 * itself (a tenant is never the root), never match. Registry absent/stale/
 * schema-major → null (zero tenants); malformed → THROWS (fail-closed, same
 * contract as listTenantLoopProjects).
 */
export function tenantForProjectPath(path: string, root: string = defaultRoot()): TenantLoopTenant | null {
  const realTarget = realTargetWithLexicalTail(path);
  if (realTarget === null) return null;
  const load = loadTenantLoopRegistry(root);
  if (!load.ok) {
    if (load.error === 'malformed') {
      throw new Error(`Malformed tenant-loop registry (${tenantLoopRegistryPath(root)}): ${load.detail}`);
    }
    return null;
  }
  const baseReal = realpathSafe(root) ?? resolve(root);
  let best: { tenant: TenantLoopTenant; realDir: string } | null = null;
  for (const tenant of load.registry.tenants) {
    const realDir = realpathSafe(tenant.projectDir);
    if (realDir === null) continue;
    if (realDir === baseReal) continue; // a tenant is never the workspace root itself
    const inside = realTarget === realDir || realTarget.startsWith(realDir + sep);
    if (!inside) continue;
    if (best === null || realDir.length > best.realDir.length) best = { tenant, realDir };
  }
  return best?.tenant ?? null;
}

/** realpath of the deepest existing ancestor of `p`, plus the lexical
 * remainder; null only when no ancestor resolves (drive-root gone / race). */
function realTargetWithLexicalTail(p: string): string | null {
  let cur = resolve(p);
  let tail = '';
  for (;;) {
    try {
      return realpathSync(cur) + tail;
    } catch {
      const parent = dirname(cur);
      if (parent === cur) return null;
      tail = sep + basename(cur) + tail;
      cur = parent;
    }
  }
}

/** realpath that reports failure as null instead of throwing. */
function realpathSafe(p: string): string | null {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Path-form guard for single-project tools (the twin of isFleetProjectPath,
 * tenant edition — design §3.2): true when <path> resolves to a registered
 * tenant projectDir or a descendant of one. NOTE the namespace asymmetry with
 * the fleet twin: isFleetProjectPath matches EXACTLY Projects/<name>, while a
 * tenant match is a prefix match (an agent's cwd inside the tenant's storage
 * layout is still that tenant). Status/scope gating is the CALLER's job — this
 * is identity only.
 */
export function isTenantLoopProjectPath(path: string, root: string = defaultRoot()): boolean {
  return tenantForProjectPath(path, root) !== null;
}
