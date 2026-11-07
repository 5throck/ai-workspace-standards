#!/usr/bin/env bun
// @version 1.0.0
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
// Failure semantics (design §4): registry file ABSENT → zero exclusions,
// historical glob behavior (backward-compatible rollout). Registry file
// MALFORMED → loadFleetRegistry reports {ok:false, error:'malformed'} and the
// fleetExclusions()/listFleetProjects()/excludedFleetIds() wrappers THROW —
// every fleet-iteration tool hard-fails rather than guessing (fail-closed,
// mirroring helpers/hub-topology.ts).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

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
