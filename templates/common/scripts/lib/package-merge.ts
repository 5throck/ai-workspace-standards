#!/usr/bin/env bun
// @version 1.0.0
// package-merge.ts — scaffold-time package.json merge (T-20261009-002,
// design docs/designs/2026-10-09-scaffold-package-merge-and-baseline-surfacing-design.md D1).
//
// A variant-level package.json must MERGE over the scaffold-generated one
// (scalar keys variant-wins, well-known object keys merge per-key) instead of
// clobbering it: the generated file carries the Tier 2 scripts (audit,
// dev-sync, sync-md) a variant file may not define — the #1432/#1433
// regression class that left nightly scaffold E2E red 2026-10-06..08.
//
// Pure and side-effect-free so tests can exercise the merge without scaffolding.

const OBJECT_KEYS = ['scripts', 'dependencies', 'devDependencies', 'engines', 'peerDependencies'] as const;

export function mergePackageJson(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base, ...overlay };
  for (const key of OBJECT_KEYS) {
    const b = base[key];
    const o = overlay[key];
    if (o === undefined) continue;
    const bothPlainObjects =
      b && o && typeof b === 'object' && typeof o === 'object' && !Array.isArray(b) && !Array.isArray(o);
    const overlayPlainObject = !!o && typeof o === 'object' && !Array.isArray(o);
    if (bothPlainObjects) {
      merged[key] = { ...(b as Record<string, unknown>), ...(o as Record<string, unknown>) };
    } else if (overlayPlainObject) {
      merged[key] = o; // base lacks the key — adopt the overlay object
    } else if (b !== undefined) {
      merged[key] = b; // non-object overlay value (e.g. `scripts: "string"`) — keep the generated value
    }
  }
  return merged;
}

export const TIER2_SCRIPTS = ['audit', 'dev-sync', 'sync-md'] as const;

export function hasTier2Scripts(scripts: unknown): boolean {
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) return false;
  return TIER2_SCRIPTS.every((s) => s in (scripts as Record<string, unknown>));
}

/**
 * VA-08 decision core (T-20261009-002, design D2): simulate the scaffold merge and
 * judge the contract. `variantPkg` is the parsed variant package.json or null when
 * the variant ships none. Pure — validate-templates and the unit pin both call it.
 */
export function evaluateScaffoldPackageContract(
  commonPkg: { scripts?: unknown },
  variantPkg: { scripts?: unknown } | null,
): { ok: boolean; reason?: string } {
  if (!hasTier2Scripts(commonPkg?.scripts)) {
    return { ok: false, reason: 'common package.json lost the Tier 2 trio (audit, dev-sync, sync-md)' };
  }
  if (!variantPkg) return { ok: true };
  if (variantPkg.scripts !== undefined && (typeof variantPkg.scripts !== 'object' || Array.isArray(variantPkg.scripts))) {
    return { ok: false, reason: 'variant scripts must be an object when present — the merge keeps the generated scripts only for object values' };
  }
  const merged = {
    ...((commonPkg.scripts ?? {}) as Record<string, unknown>),
    ...((variantPkg.scripts ?? {}) as Record<string, unknown>),
  };
  if (!hasTier2Scripts(merged)) {
    return { ok: false, reason: 'merged scripts lose the Tier 2 trio' };
  }
  return { ok: true };
}
