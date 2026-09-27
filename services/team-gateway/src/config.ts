/**
 * Team Gateway configuration — three tiers (ADR-0092 D5):
 *   infra   → TEAM_GATEWAY_* / HERMES_BIN env vars (this module)
 *   tenant  → variant / description / country injected at scaffold time (scaffold.ts)
 *   secrets → seeded into each tenant HERMES_HOME (tenant.ts); never echoed by any endpoint
 */

import { readFileSync } from "node:fs";
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
  /** Bearer keys for every non-exempt route; empty = auth disabled (Phase 0 localhost mode).
   * Union of env keys + key-file keys; mutated in place by `POST /admin/reload`. */
  apiKeys: string[];
  /** Env-derived portion of `apiKeys` — process-immutable; reload re-unions it with the file. */
  apiKeysEnv: string[];
  /** File with one key per line (lines starting with # are comments). Re-read by
   * `POST /admin/reload` — rotation without restart. */
  apiKeysFile?: string;
  /** Quota window: `lifetime` (default) or `daily` (UTC-day buckets, counters reset per day). */
  quotaWindow: "lifetime" | "daily";
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
  /** Host-side path of `dataDir` — used by docker isolation to mount tenant dirs into sibling
   * containers when the gateway itself runs inside a container (paths must match on the host). */
  dataDirHost?: string;
  /** Session runtime: `hermes` (default) or `antigravity` (agy headless print mode).
   * Container isolation requires the hermes runtime (the agy binary is not in the image). */
  runtime: "hermes" | "antigravity";
  antigravityBin: string;
}

export const SERVICE_ROOT = resolve(import.meta.dir, "..");

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Like `num` but 0 is a meaningful value ("off"), and only non-finite/negative falls back. */
/** Parse a key list: comma-separated (env style) or line-per-key (file style, `#` comments). */
export function parseKeyList(text: string, separator: "," | "lines" = ","): string[] {
  const parts = separator === "," ? text.split(",") : text.split(/\r?\n/);
  return parts
    .map((s) => (separator === "lines" ? s.replace(/#.*/, "").trim() : s.trim()))
    .filter((s) => s.length > 0);
}

/** Read keys from a file (one per line, `#` comments). Missing file = empty. */
export function readKeysFile(path: string | undefined): string[] {
  if (!path) return [];
  try {
    return parseKeyList(readFileSync(path, "utf8"), "lines");
  } catch {
    return [];
  }
}

function numOr0(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  let apiKeys: string[] = [];
  // An empty-string value counts as unset (compose defaults interpolate to ""); only a
  // non-empty value that parses to zero keys is a misconfiguration (D5 fail-fast).
  if (env.TEAM_GATEWAY_API_KEYS !== undefined && env.TEAM_GATEWAY_API_KEYS.trim() !== "") {
    apiKeys = env.TEAM_GATEWAY_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      throw new Error("TEAM_GATEWAY_API_KEYS is set but parses to zero keys");
    }
  }
  const apiKeysFile = env.TEAM_GATEWAY_API_KEYS_FILE || undefined;
  const apiKeysEnv = [...apiKeys];
  apiKeys = [...new Set([...apiKeys, ...readKeysFile(apiKeysFile)])];
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
    apiKeysEnv,
    apiKeysFile,
    quotaWindow: env.TEAM_GATEWAY_QUOTA_WINDOW === "daily" ? "daily" : "lifetime",
    tenantMaxTurns: numOr0(env.TEAM_GATEWAY_TENANT_MAX_TURNS),
    tenantMaxTokens: numOr0(env.TEAM_GATEWAY_TENANT_MAX_TOKENS),
    hermesToolsets: env.TEAM_GATEWAY_HERMES_TOOLSETS || undefined,
    isolation: env.TEAM_GATEWAY_ISOLATION === "docker" ? "docker" : "process",
    runtimeImage: env.TEAM_GATEWAY_RUNTIME_IMAGE ?? "team-gateway-runtime:latest",
    dockerBin: env.TEAM_GATEWAY_DOCKER_BIN ?? "docker",
    dataDirHost: env.TEAM_GATEWAY_DATA_DIR_HOST || undefined,
    runtime: env.TEAM_GATEWAY_RUNTIME === "antigravity" ? "antigravity" : "hermes",
    antigravityBin: env.TEAM_GATEWAY_ANTIGRAVITY_BIN ?? "agy",
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
