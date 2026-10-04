/** Gateway state: configuration, registries, and rate limiters. */

import { mkdirSync } from "node:fs";
import { GatewayConfig, loadConfig, loadTurnOverrides } from "./config";
import { TenantRegistry } from "./registry-db";
import { TurnStore } from "./tenant-files";
import { UserStore } from "./users";
import { AuditLog, RateLimiter } from "./hardening";

export interface GatewayState {
  /** Turn-runtime overlay result (null = no overlay file). */
  turnOverrides: { applied: string[]; warnings: string[] } | null;
  cfg: GatewayConfig;
  registry: TenantRegistry;
  turns: TurnStore;
  users: UserStore;
  audit: AuditLog;
  loginLimiter: RateLimiter;
  signupLimiter: RateLimiter;
  sessionLimiter: RateLimiter;
  provisioning: Map<string, Promise<void>>;
  chatLocks: Map<string, Promise<unknown>>;
  /** QA-07: live child processes per tenant, killable via POST /tenants/:id/cancel. */
  activeProcs: Map<string, { kill: (code?: number) => void }>;
}

export function createState(cfg: GatewayConfig = loadConfig()): GatewayState {
  mkdirSync(cfg.dataDir, { recursive: true });
  // Turn-runtime hot-swap (spec 2026-10-04-turn-runtime-hotswap-design): the operator's
  // persisted overlay (data/turn-config.json) overrides env at boot — loud on invalid.
  const turnOverrides = loadTurnOverrides(cfg, cfg.dataDir);
  return {
    turnOverrides,
    cfg,
    turns: new TurnStore(cfg.dataDir),
    users: new UserStore(cfg.dataDir, cfg.sessionTtlMs, cfg.sessionIdleMs),
    audit: new AuditLog(cfg.dataDir),
    loginLimiter: new RateLimiter(10, 15 * 60 * 1000),
    signupLimiter: new RateLimiter(5, 3600 * 1000),
    sessionLimiter: new RateLimiter(10, 3600 * 1000),
    registry: new TenantRegistry(cfg.dataDir),
    provisioning: new Map(),
    chatLocks: new Map(),
    activeProcs: new Map(),
  };
}
