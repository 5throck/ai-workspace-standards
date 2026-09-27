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
}

export const SERVICE_ROOT = resolve(import.meta.dir, "..");

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
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
  };
}
