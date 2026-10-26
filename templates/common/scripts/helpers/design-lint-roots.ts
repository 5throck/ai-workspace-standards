#!/usr/bin/env bun
// @version 1.0.0
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
