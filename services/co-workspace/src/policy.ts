/**
 * Group policy resolution (design docs/designs/2026-11-09-gw-admin-console-design.md §5).
 * A user's effective limits are the strictest of the global cfg value and every group policy
 * that user belongs to. Groups can only tighten: a missing or zero cfg value means "no cfg
 * limit", and a group value can never loosen it. With no policy-bearing group, every result
 * equals the cfg value, so existing deployments are unaffected.
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

export interface EffectivePolicy {
  /** 0 = unlimited. */
  maxTenants: number;
  maxTurns: number;
  maxTokens: number;
  maxPrincipalTokens: number;
  /** null = no restriction beyond cfg.variants; [] = deny every variant. */
  allowedVariants: string[] | null;
  /** "cfg" and/or group ids that set the winning value. */
  sources: Record<keyof GroupPolicy, string[]>;
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

/** Validate a group policy body and return its canonical form. Rejects 0, negatives, and
 * unknown fields or variants: a group can tighten a limit but never express "unlimited". */
export function validateGroupPolicy(raw: unknown, cfg: GatewayConfig): GroupPolicy {
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
    const unique = [...new Set(list as string[])];
    if (unique.some((v) => !cfg.variants.includes(v))) throw invalidPolicy();
    out.allowedVariants = unique;
  }
  return out;
}

/** Strictest-wins resolution over the principal's policy-bearing groups. */
export function resolveEffectivePolicy(
  cfg: GatewayConfig,
  groups: Array<{ groupId: string; policy: GroupPolicy }>,
): EffectivePolicy {
  const numeric = {} as Record<NumericField, number>;
  const sources: Record<keyof GroupPolicy, string[]> = {
    maxTenants: [],
    maxTurns: [],
    maxTokens: [],
    maxPrincipalTokens: [],
    allowedVariants: [],
  };
  for (const field of NUMERIC_FIELDS) {
    const candidates: Array<{ value: number; source: string }> = [];
    const cfgValue = cfgValueOf(cfg, field);
    if (cfgValue > 0) candidates.push({ value: cfgValue, source: "cfg" });
    for (const group of groups) {
      const value = group.policy[field];
      if (value !== undefined) candidates.push({ value, source: group.groupId });
    }
    if (candidates.length === 0) {
      numeric[field] = 0;
      continue;
    }
    const min = Math.min(...candidates.map((c) => c.value));
    numeric[field] = min;
    sources[field] = candidates.filter((c) => c.value === min).map((c) => c.source);
  }
  let allowed: string[] | null = null;
  for (const group of groups) {
    const list = group.policy.allowedVariants;
    if (list === undefined) continue;
    allowed = allowed === null ? [...list] : allowed.filter((v) => list.includes(v));
    sources.allowedVariants.push(group.groupId);
  }
  return {
    maxTenants: numeric.maxTenants,
    maxTurns: numeric.maxTurns,
    maxTokens: numeric.maxTokens,
    maxPrincipalTokens: numeric.maxPrincipalTokens,
    allowedVariants: allowed,
    sources,
  };
}

/** The effective policy for a principal (tenant owner or caller). Principals in no
 * policy-bearing general group resolve to the cfg values exactly. Loop groups never carry
 * policy (2026-11-09 admin-console review M1), so they are ignored even if a row holds one. */
export function effectivePolicyFor(state: GatewayState, principal: string): EffectivePolicy {
  const groups = state.users
    .groupsOf(principal)
    .filter((g): g is typeof g & { policy: GroupPolicy } => g.kind === "general" && g.policy !== null)
    .map((g) => ({ groupId: g.groupId, policy: g.policy }));
  return resolveEffectivePolicy(state.cfg, groups);
}
