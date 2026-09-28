/**
 * Team Gateway configuration — three tiers (ADR-0092 D5):
 *   infra   → CO_WORKSPACE_* / HERMES_BIN env vars (this module)
 *   tenant  → variant / description / country injected at scaffold time (scaffold.ts)
 *   secrets → seeded into each tenant HERMES_HOME (tenant.ts); never echoed by any endpoint
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

export interface GatewayConfig {
  host: string;
  port: number;
  dataDir: string;
  workspaceDir: string;
  variants: string[];
  templateVersion?: string;
  hermesBin: string;
  /** Interpreter prefix for hermesBin — Windows CI passes ["bun"]. Production never sets it. */
  hermesBinPrefix?: string[];
  /** Independent Secure cookie flag — set when the deployment serves over HTTPS,
   * regardless of loginRequired (which only gates the web UI). */
  cookieSecure?: boolean;
  hermesSeedHome?: string;
  /** Shared Nous credential store dir handed to every tenant via `HERMES_SHARED_AUTH_DIR`
   * (default: `<hermesSeedHome>/shared`). All tenants + the operator share ONE token store,
   * so a runtime refresh stays valid everywhere — per-tenant auth.json copies go stale and
   * invalidate the shared refresh token (found live, 2026-09-27). */
  hermesAuthDir?: string;
  /** Host-side path of `hermesAuthDir` — sibling-container mount sources resolve on the host
   * when the gateway itself is containerized (same pattern as `dataDirHost`). */
  hermesAuthDirHost?: string;
  /** Model id stamped into every tenant config.yaml (`model.default`); unset = Hermes auto. */
  hermesModel?: string;
  runBudgetSeconds: number;
  maxTurns: number;
  scaffoldTimeoutMs: number;
  hermesExtraArgs: string[];
  /** Phase 2 hardening (design docs/designs/2026-09-27-co-workspace-phase2-hardening-design.md). */
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
  /** P1: catalog beta variants too (`CO_WORKSPACE_VARIANTS_INCLUDE_BETA=true`). */
  includeBeta: boolean;
  /** Web UI requires a signed-in session (`CO_WORKSPACE_LOGIN_REQUIRED=true`); API stays
   * Bearer-key gated. Unset = open web access (Phase 0 mode). */
  loginRequired: boolean;
  /** SEC-09: mutating routes in keyless mode require the `x-requested-with` header (CSRF guard). */
  csrfRequired: boolean;
  /** SEC-05: per-principal tenant cap (`POST /sessions` + lazy creation). 0 = unlimited. */
  tenantMaxPerPrincipal: number;
  /** SEC-05 (remnant): per-principal lifetime token budget ACROSS all their tenants. 0 = off. */
  principalMaxTokens: number;
  /** SEC-10: docker isolation resource caps. */
  containerMemory: string;
  containerCpus: string;
  containerPidsLimit: number;
  /** Session runtime: `hermes` (default), `antigravity` (agy), `claude`, or `codex`.
   * Container isolation requires the hermes runtime (the other binaries are not in the image). */
  runtime: "hermes" | "antigravity" | "claude" | "codex";
  antigravityBin: string;
  claudeBin: string;
  codexBin: string;
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

/** Resolve the variant catalog. `all` (or `*`) auto-discovers every `templates/co-*` whose
 * `variant.json` is `status: stable` — new variants appear without config changes. Explicit
 * comma lists are honored verbatim (and may include non-stable variants deliberately). */
export function resolveVariants(
  raw: string,
  workspaceDir: string,
  includeBeta = false,
): string[] {
  const names = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!(names.length === 1 && (names[0] === "all" || names[0] === "*"))) return names;
  const templatesDir = join(workspaceDir, "templates");
  if (!existsSync(templatesDir)) return [];
  const out: string[] = [];
  for (const dir of readdirSync(templatesDir).filter((d) => d.startsWith("co-")).sort()) {
    try {
      const variant = JSON.parse(readFileSync(join(templatesDir, dir, "variant.json"), "utf8")) as {
        status?: string;
      };
      if (variant.status === "stable" || (includeBeta && variant.status === "beta")) out.push(dir);
    } catch {
      /* unreadable variant.json — not catalog-eligible */
    }
  }
  return out;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  let apiKeys: string[] = [];
  // An empty-string value counts as unset (compose defaults interpolate to ""); only a
  // non-empty value that parses to zero keys is a misconfiguration (D5 fail-fast).
  if (env.CO_WORKSPACE_API_KEYS !== undefined && env.CO_WORKSPACE_API_KEYS.trim() !== "") {
    apiKeys = env.CO_WORKSPACE_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
      throw new Error("CO_WORKSPACE_API_KEYS is set but parses to zero keys");
    }
  }
  const apiKeysFile = env.CO_WORKSPACE_API_KEYS_FILE || undefined;
  const apiKeysEnv = [...apiKeys];
  apiKeys = [...new Set([...apiKeys, ...readKeysFile(apiKeysFile)])];
  return {
    host: env.CO_WORKSPACE_HOST ?? "127.0.0.1",
    port: num(env.CO_WORKSPACE_PORT, 9030),
    dataDir: resolve(env.CO_WORKSPACE_DATA_DIR ?? resolve(SERVICE_ROOT, "data")),
    workspaceDir: resolve(env.CO_WORKSPACE_WORKSPACE_DIR ?? resolve(SERVICE_ROOT, "..", "..")),
    variants: resolveVariants(env.CO_WORKSPACE_VARIANTS ?? "co-consult", resolve(
      env.CO_WORKSPACE_WORKSPACE_DIR ?? resolve(SERVICE_ROOT, "..", ".."),
    ), env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "true" || env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "1"),
    templateVersion: env.CO_WORKSPACE_TEMPLATE_VERSION || undefined,
    hermesBin: env.HERMES_BIN ?? "hermes",
    hermesBinPrefix: env.HERMES_BIN_PREFIX ? env.HERMES_BIN_PREFIX.split(" ") : undefined,
    cookieSecure: env.CO_WORKSPACE_COOKIE_SECURE === "true",
    hermesSeedHome: env.CO_WORKSPACE_HERMES_SEED_HOME || undefined,
    hermesAuthDir: env.CO_WORKSPACE_HERMES_AUTH_DIR || undefined,
    hermesAuthDirHost: env.CO_WORKSPACE_HERMES_AUTH_DIR_HOST || undefined,
    hermesModel: env.CO_WORKSPACE_HERMES_MODEL || undefined,
    runBudgetSeconds: num(env.CO_WORKSPACE_RUN_BUDGET_SECONDS, 300),
    maxTurns: num(env.CO_WORKSPACE_MAX_TURNS, 100),
    scaffoldTimeoutMs: num(env.CO_WORKSPACE_SCAFFOLD_TIMEOUT_MS, 600_000),
    hermesExtraArgs: (env.CO_WORKSPACE_HERMES_EXTRA_ARGS ?? "")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean),
    apiKeys,
    apiKeysEnv,
    apiKeysFile,
    quotaWindow: env.CO_WORKSPACE_QUOTA_WINDOW === "daily" ? "daily" : "lifetime",
    tenantMaxTurns: numOr0(env.CO_WORKSPACE_TENANT_MAX_TURNS),
    tenantMaxTokens: numOr0(env.CO_WORKSPACE_TENANT_MAX_TOKENS),
    hermesToolsets: env.CO_WORKSPACE_HERMES_TOOLSETS || undefined,
    isolation: env.CO_WORKSPACE_ISOLATION === "docker" ? "docker" : "process",
    runtimeImage: env.CO_WORKSPACE_RUNTIME_IMAGE ?? "co-workspace-runtime:latest",
    dockerBin: env.CO_WORKSPACE_DOCKER_BIN ?? "docker",
    dataDirHost: env.CO_WORKSPACE_DATA_DIR_HOST || undefined,
    includeBeta: env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "true" || env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "1",
    loginRequired: env.CO_WORKSPACE_LOGIN_REQUIRED === "true",
    csrfRequired: env.CO_WORKSPACE_CSRF_REQUIRED === "true",
    tenantMaxPerPrincipal: numOr0(env.CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL),
    principalMaxTokens: numOr0(env.CO_WORKSPACE_PRINCIPAL_MAX_TOKENS),
    containerMemory: env.CO_WORKSPACE_CONTAINER_MEMORY ?? "2g",
    containerCpus: env.CO_WORKSPACE_CONTAINER_CPUS ?? "2",
    containerPidsLimit: numOr0(env.CO_WORKSPACE_CONTAINER_PIDS_LIMIT) || 256,
    runtime: (["antigravity", "claude", "codex"] as const).includes(
      env.CO_WORKSPACE_RUNTIME as "antigravity",
    )
      ? (env.CO_WORKSPACE_RUNTIME as "antigravity" | "claude" | "codex")
      : "hermes",
    antigravityBin: env.CO_WORKSPACE_ANTIGRAVITY_BIN ?? "agy",
    claudeBin: env.CO_WORKSPACE_CLAUDE_BIN ?? "claude",
    codexBin: env.CO_WORKSPACE_CODEX_BIN ?? "codex",
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
