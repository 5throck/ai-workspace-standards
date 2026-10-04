/**
 * Team Gateway configuration — three tiers (ADR-0092 D5):
 *   infra   → CO_WORKSPACE_* / HERMES_BIN env vars (this module)
 *   tenant  → variant / description / country injected at scaffold time (scaffold.ts)
 *   secrets → seeded into each tenant HERMES_HOME (tenant.ts); never echoed by any endpoint
 */

import { existsSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
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
  /** Session-cookie Secure flag, independent of loginRequired. true/false force it; "auto"
   * (default) sets Secure on HTTPS requests, or on X-Forwarded-Proto https when trustProxy. */
  cookieSecure?: boolean | "auto";
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
  /** Provider key+base-url mode (design 2026-09-29-co-workspace-provider-key-config):
   * when the key is set, isolated turns inject it as OPENAI_API_KEY and the tenant
   * config stamps model.provider=custom + model.base_url; the per-turn auth.json
   * re-seed is skipped (the copy-based OAuth flow caused the 2026-09-29
   * refresh-token-reuse revocation). Unset = legacy shared-store/auth.json path. */
  llmBaseUrl?: string;
  llmApiKey?: string;
  /** Provider selector mirroring the co-newbiz scheme: `openai | anthropic | gemini | custom`
   * (unset/`none` = off; default `custom` when a key is present). R6 of the provider-key design. */
  llmProvider?: string;
  /** Default reasoning effort stamped into the tenant config (`agent.reasoning_effort`).
   * Some models (e.g. glm-5.3-flash) reject requests without an effort — default "low"
   * in key mode so turns work with zero operator flags; empty string = omit the stamp. */
  hermesReasoningEffort?: string;
  runBudgetSeconds: number;
  maxTurns: number;
  /** LLM Interaction Standard addendum (docs/standards/llm-interaction-standard.md,
   * ADR-0098): prepend the §14 short form to fresh-session turns. Default on;
   * `CO_WORKSPACE_INTERACTION_STANDARD=false` opts the deployment out. */
  interactionStandard: boolean;
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
  /** Label value tagging this gateway's sibling turn containers so the boot reaper only removes its own. */
  instanceId: string;
  /** Host-side path of `dataDir` — used by docker isolation to mount tenant dirs into sibling
   * containers when the gateway itself runs inside a container (paths must match on the host). */
  dataDirHost?: string;
  /** T-20260930-038 volume-subpath mode: named Docker volume holding `storage/<P>/<N>/...`.
   * Set = volume mode (turn containers mount via --mount type=volume,...,volume-subpath=...);
   * unset = bind mode (host paths, unchanged). Validated against Docker's volume-name charset;
   * invalid value fails closed at boot. */
  dataVolume?: string;
  /** P1: catalog beta variants too (`CO_WORKSPACE_VARIANTS_INCLUDE_BETA=true`). */
  includeBeta: boolean;
  /** Web UI requires a signed-in session (`CO_WORKSPACE_LOGIN_REQUIRED=true`); API stays
   * Bearer-key gated. Unset = open web access (Phase 0 mode). */
  loginRequired: boolean;
  /** SEC-09: mutating routes in keyless mode require the `x-requested-with` header (CSRF guard). */
  csrfRequired: boolean;
  /** H7: trust `X-Forwarded-For` (right-most hop) for rate-limit keys. Default false: the
   * socket peer address is used. Enable ONLY behind a reverse proxy that appends the client IP. */
  trustProxy: boolean;
  /** SEC-05: per-principal tenant cap (`POST /sessions` + lazy creation). 0 = unlimited. */
  tenantMaxPerPrincipal: number;
  /** 2026-10-02 gate design (D1/D4): allow UNAUTHENTICATED callers to provision new tenants.
   *  Default false — provisioning is privileged (spawns the scaffold engine inside the
   *  workspace); open mode keeps granting reachability of existing tenants only. */
  allowAnonProvisioning: boolean;
  /** SEC-05 (remnant): per-principal lifetime token budget ACROSS all their tenants. 0 = off. */
  principalMaxTokens: number;
  /** 2026-10-03 session-hardening design (D1): absolute session TTL and idle timeout.
   * Activity slides the idle window but never past the absolute cap. */
  sessionTtlMs: number;
  sessionIdleMs: number;
  /** SEC-10: docker isolation resource caps. */
  containerMemory: string;
  containerCpus: string;
  containerPidsLimit: number;
  /** Session runtime: `hermes` (default), `antigravity` (agy), `claude`, or `codex`.
   * Container isolation requires the hermes runtime (the other binaries are not in the image). */
  runtime: "hermes" | "antigravity" | "claude" | "codex";
  antigravityBin: string;
  /** Interpreter prefix for antigravityBin — Windows CI passes ["bun"]. Production never sets it. */
  antigravityBinPrefix?: string[];
  claudeBin: string;
  codexBin: string;
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

/** Parse a key list: comma-separated (env style) or line-per-key (file style, `#` comments). */
export function parseKeyList(text: string, separator: "," | "lines" = ","): string[] {
  const parts = separator === "," ? text.split(",") : text.split(/\r?\n/);
  return parts
    .map((s) => (separator === "lines" ? s.replace(/#.*/, "").trim() : s.trim()))
    .filter((s) => s.length > 0);
}

const warnedMissingKeyFiles = new Set<string>();

/** Per-request hot-path cache (2026-10-03 review, T-20261003-022): keyPrincipals() ran a
 * synchronous readFileSync on EVERY key-authenticated request. Cached by (mtimeMs, size) —
 * a rotated file gets a new mtime, so `POST /admin/reload` and natural rotation re-read
 * without an explicit invalidation hook. */
let keyEntriesCache: { path: string; mtimeMs: number; size: number; entries: Array<{ key: string; label: string }> } | null = null;

/** Parse key entries from a file with optional labels (key:label format). Returns key and label pairs.
 * A missing OR non-regular file (the compose single-file bind turns a missing host file into a
 * directory — 2026-10-03 review M9's EISDIR boot crash) is the warn-once empty case. */
export function readKeyEntries(path: string | undefined): Array<{ key: string; label: string }> {
  if (!path) return [];
  let st: { isFile: boolean; mtimeMs: number; size: number };
  try {
    const s = statSync(path);
    st = { isFile: s.isFile(), mtimeMs: s.mtimeMs, size: s.size };
  } catch {
    st = { isFile: false, mtimeMs: 0, size: 0 };
  }
  if (!st.isFile) {
    if (!warnedMissingKeyFiles.has(path)) {
      warnedMissingKeyFiles.add(path);
      console.warn(`[co-workspace] API key file not found (or not a regular file): ${path}`);
    }
    return [];
  }
  if (keyEntriesCache && keyEntriesCache.path === path && keyEntriesCache.mtimeMs === st.mtimeMs && keyEntriesCache.size === st.size) {
    return keyEntriesCache.entries;
  }
  try {
    const text = readFileSync(path, "utf8");
    const entries: Array<{ key: string; label: string }> = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      if (!line) continue;
      const idx = line.indexOf(":");
      if (idx > 0) {
        entries.push({
          key: line.slice(0, idx).trim(),
          label: line.slice(idx + 1).trim() || "default",
        });
      } else {
        entries.push({
          key: line,
          label: "default",
        });
      }
    }
    keyEntriesCache = { path, mtimeMs: st.mtimeMs, size: st.size, entries };
    return entries;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    throw new Error(`[co-workspace] cannot read API key file ${path}: ${error.message}`);
  }
}

/** Read keys from a file (one per line, `#` comments). Missing file = empty. */
export function readKeysFile(path: string | undefined): string[] {
  return readKeyEntries(path).map((e) => e.key);
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
  const cfg: GatewayConfig = {
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
    cookieSecure: parseCookieSecure(env.CO_WORKSPACE_COOKIE_SECURE),
    hermesSeedHome: env.CO_WORKSPACE_HERMES_SEED_HOME || undefined,
    hermesAuthDir: env.CO_WORKSPACE_HERMES_AUTH_DIR || undefined,
    hermesAuthDirHost: env.CO_WORKSPACE_HERMES_AUTH_DIR_HOST || undefined,
    hermesModel: (env.CO_WORKSPACE_MODEL ?? env.CO_WORKSPACE_HERMES_MODEL) || undefined,
    llmBaseUrl: env.CO_WORKSPACE_LLM_BASE_URL || undefined,
    llmApiKey: env.CO_WORKSPACE_LLM_API_KEY || undefined,
    llmProvider: env.CO_WORKSPACE_LLM_PROVIDER || undefined,
    hermesReasoningEffort: env.CO_WORKSPACE_HERMES_REASONING_EFFORT,
    runBudgetSeconds: num(env.CO_WORKSPACE_RUN_BUDGET_SECONDS, 300),
    maxTurns: num(env.CO_WORKSPACE_MAX_TURNS, 100),
    interactionStandard: env.CO_WORKSPACE_INTERACTION_STANDARD !== "false",
    scaffoldTimeoutMs: num(env.CO_WORKSPACE_SCAFFOLD_TIMEOUT_MS, 600_000),
    // Neutral aliases (2026-10-04, turn-runtime hot-swap design): the turn params are
    // runtime-shared — the hermes-named envs remain as deprecated aliases.
    hermesExtraArgs: (env.CO_WORKSPACE_TURN_EXTRA_ARGS ?? env.CO_WORKSPACE_HERMES_EXTRA_ARGS ?? "")
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
    instanceId: env.CO_WORKSPACE_INSTANCE_ID || "default",
    dataDirHost: env.CO_WORKSPACE_DATA_DIR_HOST || undefined,
    dataVolume: parseDataVolume(env.CO_WORKSPACE_DATA_VOLUME),
    includeBeta: env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "true" || env.CO_WORKSPACE_VARIANTS_INCLUDE_BETA === "1",
    loginRequired: env.CO_WORKSPACE_LOGIN_REQUIRED === "true",
    csrfRequired: env.CO_WORKSPACE_CSRF_REQUIRED === "true",
    trustProxy: env.CO_WORKSPACE_TRUST_PROXY === "true" || env.CO_WORKSPACE_TRUST_PROXY === "1",
    tenantMaxPerPrincipal: numOr0(env.CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL),
    allowAnonProvisioning: env.CO_WORKSPACE_ALLOW_ANON_PROVISIONING === "true",
    principalMaxTokens: numOr0(env.CO_WORKSPACE_PRINCIPAL_MAX_TOKENS),
    sessionTtlMs: num(env.CO_WORKSPACE_SESSION_TTL_HOURS, 24) * 3600 * 1000,
    sessionIdleMs: num(env.CO_WORKSPACE_SESSION_IDLE_HOURS, 4) * 3600 * 1000,
    containerMemory: env.CO_WORKSPACE_CONTAINER_MEMORY ?? "2g",
    containerCpus: env.CO_WORKSPACE_CONTAINER_CPUS ?? "2",
    containerPidsLimit: numOr0(env.CO_WORKSPACE_CONTAINER_PIDS_LIMIT) || 256,
    runtime: (["antigravity", "claude", "codex"] as const).includes(
      env.CO_WORKSPACE_RUNTIME as "antigravity",
    )
      ? (env.CO_WORKSPACE_RUNTIME as "antigravity" | "claude" | "codex")
      : "hermes",
    antigravityBin: env.CO_WORKSPACE_ANTIGRAVITY_BIN ?? "agy",
    antigravityBinPrefix: env.CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX
      ? env.CO_WORKSPACE_ANTIGRAVITY_BIN_PREFIX.split(" ")
      : undefined,
    claudeBin: env.CO_WORKSPACE_CLAUDE_BIN ?? "claude",
    codexBin: env.CO_WORKSPACE_CODEX_BIN ?? "codex",
  };
  // 2026-10-03 review M6: anonymous provisioning with all quotas off means unmetered
  // provider spend for unauthenticated callers. Fail boot with remediation — consistent
  // with the fail-closed style of the D5 checks above.
  if (cfg.allowAnonProvisioning && (cfg.tenantMaxTurns === 0 || cfg.tenantMaxTokens === 0 || cfg.principalMaxTokens === 0)) {
    throw new Error(
      "CO_WORKSPACE_ALLOW_ANON_PROVISIONING=true requires explicit quotas — set CO_WORKSPACE_TENANT_MAX_TURNS, " +
        "CO_WORKSPACE_TENANT_MAX_TOKENS and CO_WORKSPACE_PRINCIPAL_MAX_TOKENS so anonymous tenants are metered",
    );
  }
  return cfg;
}

/** Volume-subpath mode name validation (design 2026-09-30, section 2): Docker's own
 * volume-name charset. Invalid value fails closed at boot. Empty/undefined = bind mode. */
export const DATA_VOLUME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

function parseDataVolume(raw: string | undefined): string | undefined {
  const v = (raw ?? "").trim();
  if (!v) return undefined;
  if (!DATA_VOLUME_RE.test(v)) throw new Error(`invalid CO_WORKSPACE_DATA_VOLUME: ${v}`);
  return v;
}

/** Fail-fast volume-mode probe (design 2026-09-30, section 6.1): the data volume must already
 * exist (`docker volume create <name>` is operator-run per the runbook); a missing volume
 * fails startup with a remediation message instead of a mid-turn daemon error. */
export function dockerVolumeProbe(dockerBin: string, volume: string): { ok: boolean; error?: string } {
  try {
    const proc = Bun.spawnSync([dockerBin, "volume", "inspect", volume], {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    if (proc.exitCode !== 0) {
      return {
        ok: false,
        error: new TextDecoder().decode(proc.stderr || proc.stdout).slice(0, 300),
      };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}

/** Provider-key mode resolution (R6, design 2026-09-29-co-workspace-provider-key-config):
 * the selector picks which env var carries the key — openai/custom → OPENAI_API_KEY,
 * anthropic → ANTHROPIC_API_KEY, gemini → GOOGLE_API_KEY (an exact name in hermes's env
 * allowlist; the GOOGLE_ prefix is not allowed because GOOGLE_CLIENT_SECRET is a gateway secret), zai → ZAI_API_KEY (hermes's `zai` provider is first-class and
 * preserves dotted model ids on Z.AI's anthropic-compatible endpoint) — mirroring the
 * co-newbiz scheme (`openai | anthropic | gemini | custom`; unset/`none` = off, default
 * `custom` when a key is present). Null = provider-key mode is off → legacy
 * shared-store path. */
export function resolveLlmProviderKey(cfg: GatewayConfig): { name: string; value: string } | null {
  if (!cfg.llmApiKey) return null;
  const name = (cfg.llmProvider || "custom").trim().toLowerCase();
  if (name === "none") return null;
  const keyEnv =
    name === "anthropic" ? "ANTHROPIC_API_KEY"
    : name === "gemini" ? "GOOGLE_API_KEY"
    : name === "zai" ? "ZAI_API_KEY"
    : "OPENAI_API_KEY"; // openai | custom | any OpenAI-compatible provider name
  return { name: keyEnv, value: cfg.llmApiKey };
}

/** The provider name stamped into tenant config.yaml (`model.provider`). */
export function resolveLlmProviderName(cfg: GatewayConfig): string {
  return (cfg.llmProvider || "custom").trim().toLowerCase();
}

/** Protocol families per runtime (design 2026-10-03-coworkspace-cli-provider-key-design,
 * D4): which named providers speak the runtime's wire protocol. `custom` matches BOTH
 * claude and codex — the operator guarantees the base URL speaks that protocol. */
const RUNTIME_PROVIDER_FAMILIES: Record<string, string[]> = {
  claude: ["anthropic", "custom", "zai"], // zai's endpoint is Anthropic-compatible (needs an explicit base URL)
  codex: ["openai", "custom"],
  antigravity: [], // agy is Google-account login-only — the CLI exposes no API-key surface
};

/** Provider-key injection for the NON-hermes runtimes (design
 * 2026-10-03-coworkspace-cli-provider-key-design, D1): when provider-key mode is on and the
 * configured provider speaks the runtime's protocol, return the CLI's native credential env
 * vars so the turn uses the deployment key instead of the operator's interactive login.
 * Null = inject nothing (no key, hermes owns its own path, antigravity is login-only, or
 * family mismatch). Claude additionally carries ANTHROPIC_BASE_URL when a base URL is set;
 * codex base URLs are a config.toml stanza (operator-side, not injectable via env). */
export function runtimeProviderKeyEnv(
  runtime: string,
  cfg: Pick<GatewayConfig, "llmApiKey" | "llmBaseUrl"> & { llmProvider?: string },
): Record<string, string> | null {
  if (!cfg.llmApiKey) return null;
  if (runtime === "hermes") return null; // the existing providerKeyEnv + config.yaml path owns it
  const provider = (cfg.llmProvider || "custom").trim().toLowerCase();
  if (provider === "none") return null;
  const families = RUNTIME_PROVIDER_FAMILIES[runtime];
  if (!families || !families.includes(provider)) return null;
  if (runtime === "claude") {
    // ANTHROPIC_AUTH_TOKEN too (2026-10-04): deployments behind gateways that
    // authenticate with a static bearer token set this instead of an API key —
    // claude sends it as `Authorization: Bearer` alongside the x-api-key header.
    return {
      ANTHROPIC_API_KEY: cfg.llmApiKey,
      ANTHROPIC_AUTH_TOKEN: cfg.llmApiKey,
      ...(cfg.llmBaseUrl ? { ANTHROPIC_BASE_URL: cfg.llmBaseUrl } : {}),
    };
  }
  if (runtime === "codex") {
    return { OPENAI_API_KEY: cfg.llmApiKey };
  }
  return null;
}

/** Human reason when the configured key CANNOT serve the runtime (boot warning, D3). */
export function runtimeProviderKeyGap(
  runtime: string,
  cfg: Pick<GatewayConfig, "llmApiKey" | "llmBaseUrl"> & { llmProvider?: string },
): string | null {
  if (!cfg.llmApiKey) return null;
  if (runtime === "hermes") return null;
  const provider = (cfg.llmProvider || "custom").trim().toLowerCase();
  if (runtime === "antigravity") {
    return `runtime antigravity is login-only (the agy CLI exposes no API-key surface) — the configured provider key cannot apply; teams will use the operator's Google sign-in`;
  }
  const families = RUNTIME_PROVIDER_FAMILIES[runtime];
  if (families && provider !== "none" && !families.includes(provider)) {
    return `provider "${provider}" does not speak the ${runtime} protocol (accepted: ${families.join(", ")}) — no key injected; teams will use the operator's interactive login`;
  }
  return null;
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

function parseCookieSecure(raw: string | undefined): boolean | "auto" {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return "auto";
}

// ── Turn-runtime hot-swap (2026-10-04, spec 2026-10-04-turn-runtime-hotswap-design) ──
// The runtime + credential selection used to be env-only, so switching it meant editing
// .env and recreating the containers. The overlay file (data/turn-config.json) now
// carries the operator's choice: it overrides env at boot AND is written by the admin
// API (PUT /admin/turn-config), which applies it to the running gateway immediately —
// no restart, no compose edit.

export type TurnRuntime = "hermes" | "claude" | "codex" | "antigravity";
export const TURN_RUNTIMES: readonly TurnRuntime[] = ["hermes", "claude", "codex", "antigravity"];

export interface TurnOverrides {
  runtime?: TurnRuntime;
  /** Credential provider family — must speak the runtime's protocol (see
   * RUNTIME_PROVIDER_FAMILIES); "none" disables key injection. */
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  /** Model passed to the runtime (claude: `--model`; hermes: config.yaml stamp). */
  model?: string;
  extraArgs?: string[];
}

export function turnOverridesPath(dataDir: string): string {
  return join(dataDir, "turn-config.json");
}

/** Applies a validated override set to the live config. Returns the applied field
 * names plus non-fatal warnings (protocol-family gaps surface at boot/PUT but do
 * not block — the operator may be preparing a switch). */
export function applyTurnOverrides(
  cfg: GatewayConfig,
  o: TurnOverrides,
): { applied: string[]; warnings: string[] } {
  const applied: string[] = [];
  const warnings: string[] = [];
  if (o.runtime !== undefined) {
    if (!TURN_RUNTIMES.includes(o.runtime)) throw new Error(`turn-config: runtime must be one of ${TURN_RUNTIMES.join(", ")}`);
    cfg.runtime = o.runtime;
    applied.push("runtime");
  }
  if (o.provider !== undefined) {
    if (typeof o.provider !== "string" || !/^([a-z0-9-]+|none)$/.test(o.provider)) {
      throw new Error(`turn-config: provider must match [a-z0-9-]+ or "none"`);
    }
    cfg.llmProvider = o.provider;
    applied.push("provider");
  }
  if (o.apiKey !== undefined) {
    if (typeof o.apiKey !== "string" || o.apiKey.trim() === "") throw new Error("turn-config: apiKey must be a non-empty string (use null removal via the API omitting it)");
    cfg.llmApiKey = o.apiKey.trim();
    applied.push("apiKey");
  }
  if (o.baseUrl !== undefined) {
    if (typeof o.baseUrl !== "string" || !/^https:\/\//.test(o.baseUrl)) throw new Error("turn-config: baseUrl must be an https URL");
    cfg.llmBaseUrl = o.baseUrl;
    applied.push("baseUrl");
  }
  if (o.model !== undefined) {
    if (typeof o.model !== "string" || o.model.trim() === "" || o.model.length > 120) throw new Error("turn-config: model must be 1-120 characters");
    cfg.hermesModel = o.model.trim();
    applied.push("model");
  }
  if (o.extraArgs !== undefined) {
    if (!Array.isArray(o.extraArgs) || !o.extraArgs.every((a) => typeof a === "string")) {
      throw new Error("turn-config: extraArgs must be an array of strings");
    }
    cfg.hermesExtraArgs = o.extraArgs;
    applied.push("extraArgs");
  }
  const gap = runtimeProviderKeyGap(cfg.runtime, cfg);
  if (gap) warnings.push(gap);
  return { applied, warnings };
}

/** Reads + applies the overlay file. Corrupt or invalid files fail LOUD at boot —
 * a silently ignored config would make the gateway run with the wrong credentials. */
export function loadTurnOverrides(cfg: GatewayConfig, dataDir: string): { applied: string[]; warnings: string[] } | null {
  const path = turnOverridesPath(dataDir);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf8");
  let parsed: TurnOverrides;
  try {
    parsed = JSON.parse(raw) as TurnOverrides;
  } catch (err) {
    throw new Error(`turn-config file ${path} is not valid JSON — fix or remove it (boot refused): ${(err as Error).message}`);
  }
  const result = applyTurnOverrides(cfg, parsed);
  return result;
}

/** Atomically persists the merged override set (PUT merges over the previous file). */
export function persistTurnOverrides(dataDir: string, o: TurnOverrides): void {
  const path = turnOverridesPath(dataDir);
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(o, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

/** Reads the previous override file (PUT merges over it), tolerating absence. */
export function readTurnOverrides(dataDir: string): TurnOverrides {
  const path = turnOverridesPath(dataDir);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8")) as TurnOverrides;
  } catch {
    return {}; // a corrupt file fails loudly in loadTurnOverrides at boot; PUT starts clean
  }
}

/** Masked rendering for the admin GET — secrets never leave the process in full. */
export function maskApiKey(key: string | undefined): string | null {
  return key ? `•••${key.slice(-4)}` : null;
}

/** Validates a PUT body into a TurnOverrides patch. Thin + exported for tests. */
export function validateTurnOverridesBody(body: Record<string, unknown>): TurnOverrides {
  const o: TurnOverrides = {};
  if (body.runtime !== undefined) o.runtime = body.runtime as TurnRuntime;
  if (body.provider !== undefined) o.provider = body.provider as string;
  if (body.apiKey !== undefined) o.apiKey = body.apiKey as string;
  if (body.baseUrl !== undefined) o.baseUrl = body.baseUrl as string;
  if (body.model !== undefined) o.model = body.model as string;
  if (body.extraArgs !== undefined) {
    if (typeof body.extraArgs === "string") {
      o.extraArgs = body.extraArgs.split(" ").map((x) => x.trim()).filter(Boolean);
    } else {
      o.extraArgs = body.extraArgs as string[];
    }
  }
  return o;
}
