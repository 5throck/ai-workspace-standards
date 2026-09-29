/**
 * Tenant lifecycle (ADR-0092 D4/D5): registry persistence, relocation target, and per-tenant
 * HERMES_HOME seeding. Secrets live only inside the tenant home; the generated config.yaml
 * carries the ADR-0088 D7 trust posture scoped to the tenant project directory.
 */

import { chmodSync, chownSync, copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genId, readJson, writeJson } from "./util";

/**
 * User-reported 2026-09-29: deleted tenants left unreferenced data on disk. Besides the
 * canonical tree the delete route already removes, legacy layout bugs had written
 * malformed siblings next to it (e.g. `<tenantId>project` with the separator swallowed)
 * that no later delete ever matched. After the canonical folder is removed, sweep
 * the exact malformed shapes (`<tenantId>project`, `<tenantId>hermes-home`) under the principal storage dir. Returns what was removed.
 */
export function sweepTenantStragglers(principalDir: string, tenantId: string, keepFolderName: string): string[] {
  const removed: string[] = [];
  if (!existsSync(principalDir)) return removed;
  for (const entry of readdirSync(principalDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Only the exact legacy malformed shapes (separator swallowed) — never a bare prefix match,
    // which would also hit unrelated siblings such as `<tenantId>-notes`.
    if (entry.name === keepFolderName) continue;
    if (entry.name !== `${tenantId}project` && entry.name !== `${tenantId}hermes-home`) continue;
    rmSync(join(principalDir, entry.name), { recursive: true, force: true });
    removed.push(entry.name);
  }
  return removed;
}

export type TenantStatus = "provisioning" | "ready" | "failed" | "archived";

export interface TenantRecord {
  tenantId: string;
  /** Lookup key for lazy OpenAI-surface tenants: `<variant>::<user>`; unset for native tenants. */
  key?: string;
  variant: string;
  status: TenantStatus;
  createdAt: string;
  projectDir: string;
  hermesHome: string;
  description?: string;
  error?: string;
  /** Completed Hermes turns; > 0 means the thread already exists. */
  sessions: number;
  /** Cumulative token counters from terminal result envelopes (Phase 2 quota input). */
  inputTokens: number;
  outputTokens: number;
  /** Per-UTC-day buckets for windowed quotas (`CO_WORKSPACE_QUOTA_WINDOW=daily`); pruned to
   * the 8 most recent days on write. */
  daily?: Record<string, { turns: number; inputTokens: number; outputTokens: number }>;
  /** Antigravity-runtime conversation id (explicit continuity across turns). */
  conversationId?: string;
  /** Operator/user-facing project name (P7). Falls back to `tenantId` when unset. */
  name?: string;
  /** Trusted principal owning this tenant (P9) — from the key-file label, or "anonymous". */
  ownerPrincipal?: string;
  /** Provisioning progress trail (P8), newest last, capped at 12 entries. */
  progress?: TenantProgressEntry[];
}

export interface TenantProgressEntry {
  stage: string;
  label: string;
  at: string;
}

export function recordProgress(rec: TenantRecord, stage: string, label: string): void {
  const entry: TenantProgressEntry = { stage, label, at: new Date().toISOString() };
  rec.progress = [...(rec.progress ?? []), entry].slice(-12);
}

export function recordTurnUsage(
  rec: TenantRecord,
  dayKey: string,
  tokens: { input: number; output: number },
): void {
  rec.sessions += 1;
  rec.inputTokens += tokens.input;
  rec.outputTokens += tokens.output;
  const daily = (rec.daily ??= {});
  const bucket = (daily[dayKey] ??= { turns: 0, inputTokens: 0, outputTokens: 0 });
  bucket.turns += 1;
  bucket.inputTokens += tokens.input;
  bucket.outputTokens += tokens.output;
  // Prune: keep the 8 most recent day keys so the registry cannot grow unbounded.
  const keys = Object.keys(daily).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - 8))) delete daily[key];
}

/** Credential files copied from the operator's seed home. `auth.json` is deliberately NOT
 * copied (ADR-0092 Addendum 4): a copied OAuth refresh token goes stale the first time another
 * home refreshes it — tenants instead share the operator's token store via
 * `HERMES_SHARED_AUTH_DIR`. `.env` (non-token tuning) is still copied. The operator's
 * config.yaml is never copied — tenants get a generated one. */
const SEED_COPY_FILES = [".env"];

export function tenantPaths(dataDir: string) {
  const tenantsDir = join(dataDir, "tenants");
  return { tenantsDir, registryPath: join(tenantsDir, "registry.json") };
}

/** YAML double-quoted scalar (JSON strings are valid YAML). Newlines/CR are rejected outright. */
function yamlScalar(field: string, value: string): string {
  if (/[\r\n]/.test(value)) throw new Error(`tenant config: ${field} must not contain newline characters`);
  return JSON.stringify(value);
}

/** Provider names stay bare for ordinary identifiers (unchanged output); anything else is quoted. */
function providerScalar(v: string): string {
  const q = yamlScalar("provider", v);
  return /^[A-Za-z0-9_.-]+$/.test(v) ? v : q;
}

/** Writes the tenant config.yaml (it carries the provider key) owner-only. The mode applies to
 * new files; an existing file is chmod'ed. Ownership is untouched: in docker mode chownTree
 * hands the file to uid 10000 (its 0600 owner, the uid that runs the turn); per-turn rewrites
 * keep that owner. */
export function writeTenantConfig(path: string, content: string): void {
  writeFileSync(path, content, { mode: 0o600 });
  try { chmodSync(path, 0o600); } catch { /* best effort (not owner) */ }
}

export function tenantConfigYaml(
  projectDir: string,
  model?: string,
  opts?: { providerName?: string; providerBaseUrl?: string; providerApiKey?: string; agentReasoningEffort?: string },
): string {
  const lines = [
    "# Generated by co-workspace (ADR-0092 D6). Trust keys follow ADR-0088 D7:",
    "# project skills load only for the tenant project directory — never blanket.",
    "skills:",
    "  project_discovery: true",
    "  trusted_project_dirs:",
    `    - ${projectDir}`,
    // Isolated turns mount the same project at /work/project — the trust list is still
    // per-tenant (design 2026-09-29-co-workspace-provider-key-config, R3).
    "    - /work/project",
  ];
  // Thinking-mandatory models (e.g. glm-5.3-flash) 400 on effort-less requests; the
  // stamped default effort lets turns work with zero operator flags (R7).
  if (opts?.agentReasoningEffort) {
    lines.push("agent:", `  reasoning_effort: ${opts.agentReasoningEffort}`, "");
  }
  if (model || opts?.providerName || opts?.providerBaseUrl) {
    lines.push("# Model routing stamped by the gateway (CO_WORKSPACE_HERMES_MODEL / CO_WORKSPACE_LLM_*).", "model:");
    if (model) lines.push(`  default: ${yamlScalar("model", model)}`);
    if (opts?.providerName || opts?.providerBaseUrl) {
      lines.push(`  provider: ${providerScalar(opts?.providerName || "custom")}`);
    }
    if (opts?.providerBaseUrl) {
      lines.push(`  base_url: ${yamlScalar("base_url", opts.providerBaseUrl)}`);
    }
    // Live-verified 2026-09-29: hermes agent turns resolve the provider key through the
    // profile secret scope, which deliberately does NOT borrow the ambient env — the key
    // must live in the tenant config (a sibling turn with only the env key 401'd with a
    // placeholder while the config-stamped key authenticated).
    if (opts?.providerApiKey) {
      lines.push(`  api_key: ${yamlScalar("api_key", opts.providerApiKey)}`);
    }
  }
  return lines.join("\n") + "\n";
}

/** Docker isolation runs the turn as the hermes image's unprivileged UID 10000 — align the
 * tenant tree ownership so that user can read/write it. Best-effort: failures tolerated. */
export function chownTree(root: string, uid: number, gid: number): void {
  if (!existsSync(root)) return;
  try {
    chownSync(root, uid, gid);
  } catch { /* best effort */ }
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) chownTree(child, uid, gid);
    else {
      try { chownSync(child, uid, gid); } catch { /* best effort */ }
    }
  }
}

export function seedHermesHome(
  rec: TenantRecord,
  seedHome?: string,
  model?: string,
  provider?: { name?: string; baseUrl?: string; apiKey?: string },
  agentReasoningEffort?: string,
): void {
  mkdirSync(rec.hermesHome, { recursive: true });
  if (seedHome && existsSync(seedHome)) {
    for (const name of SEED_COPY_FILES) {
      const src = join(seedHome, name);
      if (existsSync(src)) copyFileSync(src, join(rec.hermesHome, name));
    }
  }
  writeTenantConfig(
    join(rec.hermesHome, "config.yaml"),
    tenantConfigYaml(rec.projectDir, model, {
      providerName: provider?.name,
      providerBaseUrl: provider?.baseUrl,
      providerApiKey: provider?.apiKey,
      agentReasoningEffort,
    }),
  );
}

/** Public shape for API responses — internal paths stay server-side. */
export function publicTenant(rec: TenantRecord) {
  return {
    tenantId: rec.tenantId,
    key: rec.key,
    variant: rec.variant,
    status: rec.status,
    createdAt: rec.createdAt,
    name: rec.name,
    ownerPrincipal: rec.ownerPrincipal,
    description: rec.description,
    sessions: rec.sessions,
    usage: { inputTokens: rec.inputTokens, outputTokens: rec.outputTokens },
    progress: rec.progress,
    error: rec.error,
  };
}
