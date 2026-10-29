#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-29, U-20261028-014): project-override validation — pure
// validateDesignLintOverride() checks the shape of a variant.json `designLint`
// block ({ enabled: boolean (required), scanRoots?: string[], allowlist?:
// string[] }) so audit.ts checkDesignLint can treat a valid block as the gate's
// effective config (order: variant.json > workspace-schema) and fail loud with
// a named violation on an invalid one. Pure + injected-free so both the audit
// gate and validate-templates' variant-designlint shape check state one rule.
// v1.0.0 (2026-10-26, U-20261026-006): design-lint scan-root resolution — pure
// helper consumed by audit.ts's checkDesignLint. The L1-delivered
// docs/workspace-schema.json configures designLint.scanRoots as
// ["templates/co-design/playground/src"], a workspace-root path that never
// exists in an instantiated project, so the gate silently skipped. Fix option
// (b) per the ticket: when no CONFIGURED scan root exists on disk, fall back to
// design-lint.ts's conventional uiSourceRoots default ("playground/src", "src")
// so audit.ts agrees with the standalone lint on the same schema; if neither
// set exists, the caller still Skips — but with an explicit reason naming both.

/** Conventional UI-source roots — mirrors design-lint.ts's uiSourceRoots default. */
export const CONVENTIONAL_DESIGN_LINT_ROOTS: readonly string[] = ['./playground/src', './src'];

/** Shape of a variant.json `designLint` override block (U-20261028-014). */
export interface DesignLintOverride {
    enabled: boolean;
    scanRoots?: string[];
    allowlist?: string[];
}

export type DesignLintOverrideResult =
    | { ok: true; config: DesignLintOverride }
    | { ok: false; error: string };

function isStringArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

/**
 * Validate the shape of a variant.json `designLint` block (U-20261028-014).
 * `enabled` is required and must be a boolean (no partial-merge ambiguity: the
 * block replaces the workspace-schema block wholesale or does not speak);
 * `scanRoots` and `allowlist` are optional string arrays. Unknown keys are
 * tolerated (forward-compatible), wrong-typed known keys are named errors.
 */
export function validateDesignLintOverride(raw: unknown): DesignLintOverrideResult {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return { ok: false, error: `variant.json designLint must be an object with a required boolean "enabled" (got ${Array.isArray(raw) ? 'array' : raw === null ? 'null' : typeof raw})` };
    }
    const block = raw as Record<string, unknown>;
    if (typeof block.enabled !== 'boolean') {
        return { ok: false, error: `variant.json designLint.enabled must be a boolean (got ${JSON.stringify(block.enabled ?? null)})` };
    }
    // Validate into typed locals — narrowing through the Record index does not
    // persist, and the conditional spread below needs the array types.
    let scanRoots: string[] | undefined;
    let allowlist: string[] | undefined;
    for (const key of ['scanRoots', 'allowlist'] as const) {
        if (block[key] === undefined) continue;
        if (!isStringArray(block[key])) {
            return { ok: false, error: `variant.json designLint.${key} must be an array of strings (got ${JSON.stringify(block[key])})` };
        }
        if (key === 'scanRoots') scanRoots = block[key];
        else allowlist = block[key];
    }
    return {
        ok: true,
        config: {
            enabled: block.enabled,
            ...(scanRoots !== undefined ? { scanRoots } : {}),
            ...(allowlist !== undefined ? { allowlist } : {}),
        },
    };
}

export type DesignLintRootsResult =
  | { status: 'scan'; roots: string[]; source: 'configured' | 'conventional-fallback' }
  | { status: 'skip'; message: string };

/**
 * Resolve the effective design-lint scan roots for audit.ts's gate.
 * `configuredScanRoots` is the schema's designLint.scanRoots (may be empty or
 * carry paths that do not exist in this checkout); `exists` is injected so
 * tests can drive temp fixtures without a real tree.
 *
 * - Configured roots that exist win (source: 'configured').
 * - Otherwise the conventional roots that exist are used
 *   (source: 'conventional-fallback') — repairs instantiated projects whose
 *   delivered schema still names workspace-root template paths.
 * - Otherwise: skip with a reason naming BOTH the configured roots and the
 *   conventional candidates, so the skip is never silent.
 */
export function resolveDesignLintRoots(
  configuredScanRoots: string[],
  exists: (p: string) => boolean,
): DesignLintRootsResult {
  const configured = (configuredScanRoots ?? []).filter(
    (r) => typeof r === 'string' && r.length > 0 && exists(r),
  );
  if (configured.length > 0) {
    return { status: 'scan', roots: configured, source: 'configured' };
  }
  const conventional = CONVENTIONAL_DESIGN_LINT_ROOTS.filter((r) => exists(r));
  if (conventional.length > 0) {
    return { status: 'scan', roots: conventional, source: 'conventional-fallback' };
  }
  return {
    status: 'skip',
    message: `no configured scan roots present (${JSON.stringify(configuredScanRoots ?? [])}) and no conventional roots (${CONVENTIONAL_DESIGN_LINT_ROOTS.join(', ')}) exist — skipped`,
  };
}
