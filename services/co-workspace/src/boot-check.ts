/**
 * D3.2 boot validation (spec docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §5.2):
 * refuse a silent-empty variant catalog or a missing scaffold engine BEFORE listening.
 *
 * Both misconfigurations start "successfully" today and fail later in confusing ways:
 *   - `CO_WORKSPACE_VARIANTS=all|*` with a missing/unreadable `<workspaceDir>/templates/`
 *     resolves to a zero-length catalog (config.ts resolveVariants), and
 *   - a workspaceDir without `scripts/new-project.ts` breaks the scaffold subprocess
 *     (scaffold.ts spawns `bun scripts/new-project.ts` with cwd=workspaceDir) on the
 *     first tenant create, long after boot.
 *
 * The decision is a PURE function (inputs: resolved config + env + an injectable
 * exists predicate) so the unit suite exercises it without spawning the server;
 * server.ts calls it right after createState() and exits on ok:false. The escape
 * env `CO_WORKSPACE_ALLOW_EMPTY_CATALOG` is for deliberately headless deployments
 * (e.g. contract tests) — truthy per the codebase convention ("true" | "1", the
 * CO_WORKSPACE_VARIANTS_INCLUDE_BETA pattern).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export const ALLOW_EMPTY_CATALOG_ENV = "CO_WORKSPACE_ALLOW_EMPTY_CATALOG";

export interface BootCheckInput {
  /** Resolved variant catalog (state.cfg.variants). */
  variants: string[];
  /** workspaceDir searched for templates/ and the scaffold engine (state.cfg.workspaceDir). */
  workspaceDir: string;
  /** Process env (injectable — never read process.env inside the pure function). */
  env: Record<string, string | undefined>;
  /** Injectable existence predicate (defaults to node:fs existsSync) — keeps tests fs-free. */
  exists?: (path: string) => boolean;
}

export type BootCheckResult = { ok: true; warnings: string[] } | { ok: false; reasons: string[] };

/** Codebase truthiness convention ("true" | "1" — parseCookieSecure/INCLUDE_BETA style). */
function envTruthy(v: string | undefined): boolean {
  return v === "true" || v === "1";
}

export function validateBootRequirements(input: BootCheckInput): BootCheckResult {
  const exists = input.exists ?? existsSync;
  const escaped = envTruthy(input.env[ALLOW_EMPTY_CATALOG_ENV]);
  const reasons: string[] = [];

  if (input.variants.length === 0 && !escaped) {
    reasons.push(
      `[co-workspace] resolved variant catalog is EMPTY — refusing to boot. ` +
        `Searched workspaceDir: ${input.workspaceDir}; expected at least one ` +
        `${join("templates", "co-*")} directory with a variant.json under it (got none). ` +
        `Fix CO_WORKSPACE_WORKSPACE_DIR / CO_WORKSPACE_VARIANTS, or set ` +
        `${ALLOW_EMPTY_CATALOG_ENV}=true to boot a deliberately empty catalog.`,
    );
  }

  const scaffoldEngine = join(input.workspaceDir, "scripts", "new-project.ts");
  if (!escaped && !exists(scaffoldEngine)) {
    reasons.push(
      `[co-workspace] scaffold engine not found: ${scaffoldEngine} — refusing to boot. ` +
        `The gateway shells out to scripts/new-project.ts under workspaceDir ` +
        `(${input.workspaceDir}); point CO_WORKSPACE_WORKSPACE_DIR at a checkout of this ` +
        `repository, or set ${ALLOW_EMPTY_CATALOG_ENV}=true to boot without scaffolding.`,
    );
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const warnings: string[] = [];
  if (input.variants.length === 0 && escaped) {
    warnings.push(
      `[co-workspace] variant catalog is empty and ${ALLOW_EMPTY_CATALOG_ENV} is set — ` +
        `booting headless: tenant creation will fail until a catalog exists.`,
    );
  }
  return { ok: true, warnings };
}
