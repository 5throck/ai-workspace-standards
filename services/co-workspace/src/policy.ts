/**
 * Group policy resolution (design docs/designs/2026-11-09-gw-admin-console-design.md §5, as
 * amended by docs/designs/2026-11-09-gw-admin-console-round2-plan.md "2026-11-09 unit-model
 * amendment"). A user's effective limits are the strictest of the global cfg value and every
 * NAMED policy assigned (group-only) to one of the user's groups. Groups can only tighten: a
 * missing or zero cfg value means "no cfg limit", and a policy can never loosen it.
 *
 * v4 unit model (binding amendment): policies attach to GROUPS ONLY — there are no per-user
 * targets, and the round-1 `groups.policy` JSON blob is gone. Migration v4 moved every blob
 * into a named policy assigned to its group and NULLed the column; the blob read path below
 * was removed with it (the round-1 M1 rule — "loop groups carry no policy" — is superseded:
 * NO group carries a blob any more).
 */

import type { GatewayConfig } from "./config";
import type { GatewayState } from "./state";
import { HttpError } from "./http";

export interface GroupPolicy {
  maxTenants?: number;
  maxTurns?: number;
  maxTokens?: number;
  maxPrincipalTokens?: number;
  allowedVariants?: string[];
}

/** One contributing named policy: which policy, via which group assignment. */
export interface PolicySourceRef {
  policyId: string;
  policyName: string;
  /** The group id whose assignment pulled the policy in (group-only targets — v4 unit model). */
  via: string;
}

export interface EffectivePolicy {
  /** 0 = unlimited. */
  maxTenants: number;
  maxTurns: number;
  maxTokens: number;
  maxPrincipalTokens: number;
  /** null = no restriction beyond cfg.variants; [] = deny every variant. */
  allowedVariants: string[] | null;
  /** Every named policy contributing through a group assignment, deduplicated by
   * (policyId, via) and sorted by policyId then via. The per-field winners are derivable
   * from the numeric results plus the assignments themselves. */
  sources: PolicySourceRef[];
}

type NumericField = "maxTenants" | "maxTurns" | "maxTokens" | "maxPrincipalTokens";

const NUMERIC_FIELDS: NumericField[] = ["maxTenants", "maxTurns", "maxTokens", "maxPrincipalTokens"];

function cfgValueOf(cfg: GatewayConfig, field: NumericField): number {
  switch (field) {
    case "maxTenants":
      return cfg.tenantMaxPerPrincipal;
    case "maxTurns":
      return cfg.tenantMaxTurns;
    case "maxTokens":
      return cfg.tenantMaxTokens;
    case "maxPrincipalTokens":
      return cfg.principalMaxTokens;
  }
}

const invalidPolicy = (): HttpError => new HttpError(400, "invalid_policy");

/** Validate a policy body WITHOUT the variant-catalog check (the caller may not have the
 * catalog — the v4 data migration runs before config resolution, and stored limits are
 * re-validated on read). Shared by validateGroupPolicy (which adds the catalog check) and
 * by migration v4. Rejects unknown fields, non-positive/non-integer numerics, and a
 * non-string or empty allowedVariants. */
export function validateGroupPolicyShape(raw: unknown): GroupPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalidPolicy();
  const obj = raw as Record<string, unknown>;
  const allowedKeys = new Set<string>([...NUMERIC_FIELDS, "allowedVariants"]);
  if (Object.keys(obj).some((k) => !allowedKeys.has(k))) throw invalidPolicy();
  const out: GroupPolicy = {};
  for (const field of NUMERIC_FIELDS) {
    const value = obj[field];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) throw invalidPolicy();
    out[field] = value;
  }
  if (obj.allowedVariants !== undefined) {
    const list = obj.allowedVariants;
    if (!Array.isArray(list) || list.length === 0 || !list.every((v) => typeof v === "string")) throw invalidPolicy();
    out.allowedVariants = [...new Set(list as string[])];
  }
  return out;
}

/** Validate a policy body and return its canonical form. Rejects 0, negatives, and unknown
 * fields or variants: a policy can tighten a limit but never express "unlimited". */
export function validateGroupPolicy(raw: unknown, cfg: GatewayConfig): GroupPolicy {
  const out = validateGroupPolicyShape(raw);
  if (out.allowedVariants !== undefined && out.allowedVariants.some((v) => !cfg.variants.includes(v))) {
    throw invalidPolicy();
  }
  return out;
}

/** Non-throwing read-side canonicalization of STORED policy JSON (2026-11-09 review L3
 * semantics): invalid or non-positive fields are dropped (no opinion), allowedVariants is
 * kept only when it is a string array. Used for the deprecated groups.policy blob reads and
 * by migration v4 when it lifts a legacy blob into a named policy. */
export function sanitizeGroupPolicyShape(raw: unknown): GroupPolicy {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: GroupPolicy = {};
  for (const field of NUMERIC_FIELDS) {
    const value = obj[field];
    if (typeof value === "number" && Number.isInteger(value) && value > 0) out[field] = value;
  }
  const list = obj.allowedVariants;
  if (Array.isArray(list) && list.every((v) => typeof v === "string")) out.allowedVariants = [...(list as string[])];
  return out;
}

/** One named policy pulled in by a group assignment (the resolver's input unit). */
export interface PolicyAssignmentInput {
  policyId: string;
  policyName: string;
  /** Group id the policy is assigned to (the principal is a member of it). */
  via: string;
  policy: GroupPolicy;
}

/** Strictest-wins resolution over the principal's group policy assignments (v4 unit model:
 * group-only targets). Numeric fields take the minimum across cfg + every assigned policy;
 * allowedVariants intersects. The cfg value participates exactly as before, so principals in
 * no policy-bearing group still resolve to the cfg values. */
export function resolveEffectivePolicy(cfg: GatewayConfig, assignments: PolicyAssignmentInput[]): EffectivePolicy {
  const numeric = {} as Record<NumericField, number>;
  for (const field of NUMERIC_FIELDS) {
    const candidates: number[] = [];
    const cfgValue = cfgValueOf(cfg, field);
    if (cfgValue > 0) candidates.push(cfgValue);
    for (const a of assignments) {
      const value = a.policy[field];
      if (value !== undefined) candidates.push(value);
    }
    numeric[field] = candidates.length === 0 ? 0 : Math.min(...candidates);
  }
  let allowed: string[] | null = null;
  for (const a of assignments) {
    const list = a.policy.allowedVariants;
    if (list === undefined) continue;
    allowed = allowed === null ? [...list] : allowed.filter((v) => list.includes(v));
  }
  const seen = new Set<string>();
  const sources: PolicySourceRef[] = [];
  for (const a of assignments) {
    const key = `${a.policyId}\u0000${a.via}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({ policyId: a.policyId, policyName: a.policyName, via: a.via });
  }
  sources.sort((x, y) => (x.policyId === y.policyId ? x.via.localeCompare(y.via) : x.policyId.localeCompare(y.policyId)));
  return {
    maxTenants: numeric.maxTenants,
    maxTurns: numeric.maxTurns,
    maxTokens: numeric.maxTokens,
    maxPrincipalTokens: numeric.maxPrincipalTokens,
    allowedVariants: allowed,
    sources,
  };
}

/** The effective policy for a principal (tenant owner or caller): the named policies
 * assigned (group-only) to the principal's groups, resolved strictest-wins against the cfg
 * baseline. Principals in no policy-bearing group resolve to the cfg values exactly.
 *
 * Round-3 shared teams (D-S6): the SYNTHETIC `group:<id>` owner principal of a shared team
 * resolves through the policies assigned to that group DIRECTLY (no membership join — the
 * group owns the team, it does not "belong" to groups). Every consumer of the owner's policy
 * (assertTenantCap, assertQuota, assertPrincipalQuota) is therefore group-aware without its
 * own branch. */
export function effectivePolicyFor(state: GatewayState, principal: string): EffectivePolicy {
  // v4 unit model: the round-1 `kind==='general'` groups.policy blob read is REMOVED —
  // migration v4 migrated every blob into a named policy assigned to its group and NULLed
  // the column, so the blob can never contribute again (superseding the M1 rule, which
  // existed to keep LOOP blobs out; now NO blob is read, loop or general).
  if (principal.startsWith("group:")) {
    return resolveEffectivePolicy(state.cfg, state.users.policyAssignmentsForGroup(principal.slice("group:".length)));
  }
  return resolveEffectivePolicy(state.cfg, state.users.policyAssignmentsFor(principal));
}
