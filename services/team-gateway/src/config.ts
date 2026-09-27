/**
 * Team Gateway configuration — three tiers (ADR-0092 D5):
 *   infra   → TEAM_GATEWAY_* / HERMES_BIN env vars (this module)
 *   tenant  → variant / description / country injected at scaffold time (scaffold.ts)
 *   secrets → seeded into each tenant HERMES_HOME (tenant.ts); never echoed by any endpoint
 */

import { resolve } from "node:path";

export interface GatewayConfig {
  host: string;
  port: number;
  dataDir: string;
  workspaceDir: string;
  variants: string[];
  templateVersion?: string;
  hermesBin: string;
  hermesSeedHome?: string;
  /** Model id stamped into every tenant config.yaml (`model.default`); unset = Hermes auto. */
  hermesModel?: string;
  runBudgetSeconds: number;
  maxTurns: number;
  scaffoldTimeoutMs: number;
  hermesExtraArgs: string[];
  /** Phase 2 hardening (design 2026-09-27-team-gateway-phase2-hardening). */
  /** Bearer keys for every non-exempt route; empty = auth disabled (Phase 0 localhost mode). */
  apiKeys: string[];
  /** Per-tenant lifetime turn cap; 0 = off. */
  tenantMaxTurns: number;
  /** Per-tenant lifetime total-token cap; 0 = off. */
  tenantMaxTokens: number;
  /** Comma-separated Hermes toolsets passed as `-t` on every spawn; unset = Hermes default. */
  hermesToolsets?: string;
  /** `process` (default) or `docker` (per-turn ephemeral sibling container). */
  isolation: "process" | "docker";
  runtimeImage: string;
  dockerBin: string;
}

export const SERVICE_ROOT = resolve(import.meta.dir, "..");

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Like `num` but 0 is a meaningful value ("off"), and only non-finite/negative falls back. */
function numOr0(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  let apiKeys: string[] = [];
  if (env.TEAM_GATEWAY_API_KEYS !== undefined) {
    apiKeys = env.TEAM_GATEWAY_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      // Explicit-but-unusable auth config must not silently disable auth (D5 fail-fast).
      throw new Error("TEAM_GATEWAY_API_KEYS is set but parses to zero keys");
    }
  }
  return {
    host: env.TEAM_GATEWAY_HOST ?? "127.0.0.1",
    port: num(env.TEAM_GATEWAY_PORT, 8787),
    dataDir: resolve(env.TEAM_GATEWAY_DATA_DIR ?? resolve(SERVICE_ROOT, "data")),
    workspaceDir: resolve(env.TEAM_GATEWAY_WORKSPACE_DIR ?? resolve(SERVICE_ROOT, "..", "..")),
    variants: (env.TEAM_GATEWAY_VARIANTS ?? "co-consult")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    templateVersion: env.TEAM_GATEWAY_TEMPLATE_VERSION || undefined,
    hermesBin: env.HERMES_BIN ?? "hermes",
    hermesSeedHome: env.TEAM_GATEWAY_HERMES_SEED_HOME || undefined,
    hermesModel: env.TEAM_GATEWAY_HERMES_MODEL || undefined,
    runBudgetSeconds: num(env.TEAM_GATEWAY_RUN_BUDGET_SECONDS, 300),
    maxTurns: num(env.TEAM_GATEWAY_MAX_TURNS, 100),
    scaffoldTimeoutMs: num(env.TEAM_GATEWAY_SCAFFOLD_TIMEOUT_MS, 600_000),
    hermesExtraArgs: (env.TEAM_GATEWAY_HERMES_EXTRA_ARGS ?? "")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean),
    apiKeys,
    tenantMaxTurns: numOr0(env.TEAM_GATEWAY_TENANT_MAX_TURNS),
    tenantMaxTokens: numOr0(env.TEAM_GATEWAY_TENANT_MAX_TOKENS),
    hermesToolsets: env.TEAM_GATEWAY_HERMES_TOOLSETS || undefined,
    isolation: env.TEAM_GATEWAY_ISOLATION === "docker" ? "docker" : "process",
    runtimeImage: env.TEAM_GATEWAY_RUNTIME_IMAGE ?? "team-gateway-runtime:latest",
    dockerBin: env.TEAM_GATEWAY_DOCKER_BIN ?? "docker",
  };
}

/** Fail-fast probe for docker isolation mode (D5): the CLI must answer `docker version`. */
export function dockerProbe(dockerBin: string): { ok: boolean; version?: string; error?: string } {
  try {
    const proc = Bun.spawnSync([dockerBin, "version", "--format", "{{.Server.Version}}"], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    if (proc.exitCode !== 0) {
      return { ok: false, error: new TextDecoder().decode(proc.stderr || proc.stdout).slice(0, 300) };
    }
    return { ok: true, version: new TextDecoder().decode(proc.stdout).trim() };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}
