import { chownSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { GatewayConfig, resolveLlmProviderKey, resolveLlmProviderName, runtimeProviderKeyEnv } from "./config";
import { interactionAddendum, shouldInjectInteractionAddendum } from "./interaction";
import { recordTurnUsage, runtimeHomeDir, tenantConfigYaml, TenantRecord, writeTenantConfig } from "./tenant";
import { HermesEvent, HermesTurnResult, runHermesTurn, turnContainerName } from "./hermes";
import { runAntigravityTurn } from "./antigravity";
import { runClaudeTurn } from "./claude";
import { runCodexTurn } from "./codex";
import { ATTACH_KIND, attachDockerEnv, attachMountPlan } from "./attach";
import { HttpError } from "./http";
import type { GatewayState } from "./state";
import { hostSidePath, tenantSubpathBase } from "./lifecycle";
import { TurnTiming, turnLogKey } from "./timing";

/** Serialized per tenant: one Hermes session writer per HERMES_HOME (state.db is a per-home
 * SQLite WAL; concurrent writers across processes are unsafe). Attached tenants additionally
 * serialize on a PER-HUB lock (Addendum 17 Decision 11, pilot posture): concurrent sessions on
 * one hub queue their turns, so delegation-ticket writes into the shared hub tickets/ dir
 * never interleave. */
export async function runChat(
  state: GatewayState,
  rec: TenantRecord,
  message: string,
  onEvent?: (evt: HermesEvent) => void,
  onProc?: (proc: { kill: (code?: number) => void }) => void,
): Promise<HermesTurnResult> {
  // Addendum 17 Decision 4: attach sessions launch under docker isolation ONLY — enforced on
  // every turn (the routes gate earlier with the same 409; this covers every surface).
  if (rec.kind === ATTACH_KIND && state.cfg.isolation !== "docker") {
    throw new HttpError(409, "attach tenant requires CO_WORKSPACE_ISOLATION=docker (process isolation would share the gateway uid)", "attach_requires_docker");
  }
  if (rec.kind === ATTACH_KIND && state.cfg.dataVolume) {
    throw new HttpError(409, "attach tenant requires bind-mode docker isolation (volume mode cannot mount the hub ticket-queue)", "attach_requires_bind_mode");
  }
  // ADR-0098: fresh sessions receive the LLM Interaction Standard short form once;
  // session continuity carries the directive to later turns of the same session.
  if (state.cfg.interactionStandard && shouldInjectInteractionAddendum(state.cfg.runtime, Boolean(rec.conversationId), state.turns.list(rec.tenantId).length)) {
    message = `${interactionAddendum()}\n\n---\n\n${message}`;
  }
  // T-20260930-011: per-stage timing, keyed by the turn container name so the
  // chat.ts / hermes.ts / responses.ts lines join on one key (research §4).
  const timing = new TurnTiming(turnLogKey(rec.tenantId));
  timing.mark("t0", { tenant: rec.tenantId, runtime: state.cfg.runtime, isolation: state.cfg.isolation });
  // 2026-10-03 review H1: one registration for every runtime — cancel (POST /tenants/:id/cancel)
  // and delete can kill a running turn whether it runs hermes, agy, claude, or codex.
  const registerProc = (proc: { kill: (code?: number) => void }) => {
    state.activeProcs.set(rec.tenantId, proc);
    onProc?.(proc);
  };
  const prev = state.chatLocks.get(rec.tenantId) ?? Promise.resolve();
  const hubLockKey = rec.kind === ATTACH_KIND && rec.attachHub ? `attach-hub:${resolve(rec.attachHub)}` : null;
  const prevHub = hubLockKey ? (state.chatLocks.get(hubLockKey) ?? Promise.resolve()) : undefined;
  const task = prev
    .catch(() => undefined)
    .then(() => (prevHub ? prevHub.catch(() => undefined) : undefined))
    .then(() => {
      timing.mark("t_lock");
      // 2026-10-03 review M10: a turn queued behind a long chain can start AFTER its tenant
      // was deleted (deleteTenantData's bounded wait gives up after 30s and removes files).
      // Abort without touching the filesystem or re-inserting turn rows for a dead tenant.
      if (!state.registry.get(rec.tenantId)) {
        return {
          exitCode: null,
          finalText: "",
          stderrTail: "tenant deleted while this turn was queued",
        } as HermesTurnResult;
      }
      // Addendum 17 Decision 7: an attached tenant turns with its OWN per-session provider
      // key (never the deployment key) — a per-tenant config view swaps it in everywhere a
      // credential is resolved below. Zero ambient env inheritance is enforced separately by
      // attachDockerEnv (the constructed docker-CLI env for attach turns).
      const turnCfg: GatewayConfig = rec.attachProviderKey ? { ...state.cfg, llmApiKey: rec.attachProviderKey } : state.cfg;
      // Keep the tenant home's credentials current: the containerized hermes (older release
      // lineage) resolves OAuth from its OWN home's auth.json and cannot consult the shared
      // store, so each turn re-copies the operator's CURRENT auth.json (Addendum 4 note).
      // Provider-key mode (design 2026-09-29-co-workspace-provider-key-config) skips this —
      // static provider keys need no OAuth tokens, and copying them was the refresh-token-
      // reuse revocation class (Nous invalid_grant, 2026-09-29).
      const seedAuth = resolveLlmProviderKey(turnCfg)
        ? undefined
        : state.cfg.hermesSeedHome
          ? join(state.cfg.hermesSeedHome, "auth.json")
          : undefined;
      if (seedAuth && existsSync(seedAuth)) {
        copyFileSync(seedAuth, join(rec.hermesHome, "auth.json"));
        if (state.cfg.isolation === "docker" && process.getuid?.() === 0) chownSync(join(rec.hermesHome, "auth.json"), 10000, 10000);
      }
      // Re-stamp the tenant config.yaml every turn: provider/base-url/model changes apply
      // to EXISTING tenants on their next turn (no re-provisioning needed). In legacy mode
      // (no provider key) the stamp carries NO provider lines — stamping `provider: custom`
      // unconditionally would break the OAuth/shared-store tenants.
      const providerKey = resolveLlmProviderKey(turnCfg);
      writeTenantConfig(
        join(rec.hermesHome, "config.yaml"),
        tenantConfigYaml(
          rec.projectDir,
          state.cfg.hermesModel,
          providerKey
            ? {
                providerName: resolveLlmProviderName(turnCfg),
                providerBaseUrl: turnCfg.llmBaseUrl,
                providerApiKey: turnCfg.llmApiKey,
                agentReasoningEffort: state.cfg.hermesReasoningEffort ?? "low",
              }
            : undefined,
        ),
      );
      timing.mark("t_stamp");
      if (state.cfg.runtime === "antigravity") {
        return runAntigravityTurn(
          {
            agyBin: state.cfg.antigravityBin,
            binPrefix: state.cfg.antigravityBinPrefix,
            projectDir: rec.projectDir,
            message,
            conversationId: rec.conversationId,
            printTimeoutSeconds: state.cfg.runBudgetSeconds,
            extraArgs: state.cfg.hermesExtraArgs,
            // 2026-10-03 review H1: uniform cancel/kill + watchdog contract for every runtime.
            timeoutMs: state.cfg.runBudgetSeconds * 1000,
            onSpawn: registerProc,
          },
          onEvent,
        );
      }
      // Addendum 17 Decision 5: the attach mount plan — scratch + hub ticket-queue ONLY.
      // Denylist violations surface HERE, at mount construction (named 409s), and the hub
      // checkout itself is never mounted (pilot posture: outputs land in scratch/tickets).
      const attachPlan = rec.kind === ATTACH_KIND ? attachMountPlan(state.cfg, rec) : null;
      // 2026-10-03 CLI provider-key design (D2): non-hermes turns receive the configured
      // deployment key under the CLI's native env name (claude: ANTHROPIC_API_KEY
      // [+ ANTHROPIC_BASE_URL]; codex: OPENAI_API_KEY) — precedence over interactive
      // logins; nothing is injected when keyless, mismatched, or antigravity. Attach tenants
      // resolve against turnCfg so the PER-SESSION key applies, never the deployment key.
      const cliKeyEnv = runtimeProviderKeyEnv(state.cfg.runtime, turnCfg);
      const cliSecret = Object.entries(cliKeyEnv ?? {}).find(([k]) => k.endsWith("_API_KEY"));
      const cliSecretPair = cliSecret ? { name: cliSecret[0], value: cliSecret[1] } : undefined;
      const cliLiterals = Object.entries(cliKeyEnv ?? {})
        .filter(([k]) => !k.endsWith("_API_KEY"))
        .map(([k, v]) => `${k}=${v}`);
      const cliEnv = cliKeyEnv ? { ...process.env, ...cliKeyEnv } : undefined;
      // 2026-10-03 sibling-turns design (D6): docker-isolated sibling turns for claude/codex
      // — same container contract as hermes turns (name/labels/caps); antigravity stays
      // blocked (fail-fast at boot). Bind mode needs dataDirHost for host-visible sources.
      const cliContainer =
        state.cfg.isolation === "docker" && (state.cfg.runtime === "claude" || state.cfg.runtime === "codex")
          ? {
              image: state.cfg.runtimeImage,
              dockerBin: state.cfg.dockerBin,
              name: turnContainerName(rec.tenantId),
              tenantId: rec.tenantId,
              instance: state.cfg.instanceId,
              ...(state.cfg.dataVolume
                ? { dataVolume: state.cfg.dataVolume, subpathBase: tenantSubpathBase(state.cfg, rec) }
                : {}),
              // Attach tenants mount the per-session SCRATCH as /work/project (never the hub
              // checkout — Addendum 17 Decision 5).
              hostProjectDir: attachPlan
                ? hostSidePath(state.cfg, attachPlan.scratch) ?? attachPlan.scratch
                : hostSidePath(state.cfg, rec.projectDir),
              // Bind mode: the home source must resolve on the HOST when the gateway is
              // itself containerized; the local path is the bare-metal fallback.
              hostRuntimeHome:
                hostSidePath(state.cfg, runtimeHomeDir(rec, state.cfg.runtime)) ??
                runtimeHomeDir(rec, state.cfg.runtime),
              memory: state.cfg.containerMemory,
              cpus: state.cfg.containerCpus,
              pidsLimit: state.cfg.containerPidsLimit,
              ...(attachPlan ? { extraBinds: [attachPlan.ticketQueueBind] } : {}),
            }
          : undefined;
      if (state.cfg.runtime === "claude") {
        return runClaudeTurn(
          {
            claudeBin: state.cfg.claudeBin,
            projectDir: rec.projectDir,
            message,
            sessionId: rec.conversationId,
            // Runtime-neutral model (turn-runtime hot-swap design): hermes stamps it
            // into config.yaml; claude takes `--model` on the argv.
            extraArgs: [
              ...(state.cfg.hermesExtraArgs ?? []),
              ...(state.cfg.hermesModel ? ["--model", state.cfg.hermesModel] : []),
            ],
            timeoutMs: state.cfg.runBudgetSeconds * 1000,
            onSpawn: registerProc,
            // Attach container turns get the CONSTRUCTED env (zero ambient inheritance,
            // Decision 7) instead of the process-env merge used by regular container turns.
            env: cliContainer ? (attachPlan ? attachDockerEnv(cliSecretPair) : undefined) : cliEnv,
            ...(cliContainer
              ? {
                  container: cliContainer,
                  providerKeyEnv: cliSecretPair,
                  extraEnvPairs: cliLiterals,
                }
              : {}),
          },
          onEvent,
        );
      }
      if (state.cfg.runtime === "codex") {
        return runCodexTurn(
          {
            codexBin: state.cfg.codexBin,
            projectDir: rec.projectDir,
            message,
            threadId: rec.conversationId,
            extraArgs: state.cfg.hermesExtraArgs,
            timeoutMs: state.cfg.runBudgetSeconds * 1000,
            onSpawn: registerProc,
            env: cliContainer ? (attachPlan ? attachDockerEnv(cliSecretPair) : undefined) : cliEnv,
            ...(cliContainer
              ? {
                  container: cliContainer,
                  providerKeyEnv: cliSecretPair,
                }
              : {}),
          },
          onEvent,
        );
      }
      return runHermesTurn(
        {
          hermesBin: state.cfg.hermesBin,
          binPrefix: state.cfg.hermesBinPrefix,
          providerKeyEnv: resolveLlmProviderKey(turnCfg) ?? undefined,
          projectDir: rec.projectDir,
          hermesHome: rec.hermesHome,
          message,
          sessionName: `gw-${rec.tenantId}`,
          runBudgetSeconds: state.cfg.runBudgetSeconds,
          maxTurns: state.cfg.maxTurns,
          extraArgs: state.cfg.hermesExtraArgs,
          // §3.5 toolset scoping: attach sessions run the delegation task's declared toolset.
          toolsets: rec.attachToolsets ?? state.cfg.hermesToolsets,
          // One shared timing timeline: hermes stages join the chat.ts t0 line.
          timing,
          // Docker isolation: the tenant home is re-seeded with the CURRENT seed auth.json
          // every turn, so the shared-store bind adds nothing — and empirically flips hermes
          // onto the shared Nous store, failing the turn (exit 111, observed 2026-09-28).
          // Process-mode tenants keep the shared store (single HOME, refreshes stay valid).
          sharedAuthDir: state.cfg.isolation === "docker" ? undefined : resolveAuthDir(state.cfg),
          onSpawn: (proc) => {
            state.activeProcs.set(rec.tenantId, proc);
            onProc?.(proc);
          },
          // Decision 7: attach turns run with the CONSTRUCTED docker-CLI env — no ambient
          // host/gateway variable passes through unlisted, so no gateway secret can reach the
          // container env (the value side of providerKeyEnv rides this env explicitly).
          env: attachPlan ? attachDockerEnv(resolveLlmProviderKey(turnCfg) ?? undefined) : undefined,
          container:
            state.cfg.isolation === "docker"
              ? {
                  image: state.cfg.runtimeImage,
                  dockerBin: state.cfg.dockerBin,
                  name: turnContainerName(rec.tenantId),
                  tenantId: rec.tenantId,
                  instance: state.cfg.instanceId,
                  // Host-side equivalents of the tenant's container paths: record paths live
                  // under <dataDir>/…, remap the prefix onto dataDirHost. (The old
                  // `tenants/<id>/…` hardcode mounted empty dirs — per-user storage moved
                  // tenant files under storage/<principal>/<project>.)
                  // Volume mode (T-20260930-038): no host path is named - the turn mounts
                  // the data volume at storage/<P>/<N>/{project,hermes-home} subpaths.
                  ...(state.cfg.dataVolume
                    ? { dataVolume: state.cfg.dataVolume, subpathBase: tenantSubpathBase(state.cfg, rec) }
                    : attachPlan
                      ? {
                          // Attach: /work/project IS the per-session scratch (gateway-owned);
                          // the hub checkout is never mounted (Decision 5).
                          hostProjectDir: hostSidePath(state.cfg, attachPlan.scratch) ?? attachPlan.scratch,
                          hostHermesHome: hostSidePath(state.cfg, rec.hermesHome),
                        }
                      : {
                          hostProjectDir: hostSidePath(state.cfg, rec.projectDir),
                          hostHermesHome: hostSidePath(state.cfg, rec.hermesHome),
                        }),
                  hostAuthDir: state.cfg.hermesAuthDirHost
                    ?? (state.cfg.dataDirHost
                      ? join(state.cfg.dataDirHost, "shared-auth")
                      : undefined),
                  memory: state.cfg.containerMemory,
                  cpus: state.cfg.containerCpus,
                  pidsLimit: state.cfg.containerPidsLimit,
                  // The hub ticket-queue bind (the one delegation write surface).
                  ...(attachPlan ? { extraBinds: [attachPlan.ticketQueueBind] } : {}),
                }
              : undefined,
        },
        onEvent,
      );
    });
  const tail = task.catch(() => undefined);
  state.chatLocks.set(rec.tenantId, tail);
  // Per-hub attach serialization (Decision 11): the same tail keys the hub chain. Never
  // pruned by the tenant cleanup (a resolved promise chain is GC-cheap; the next turn on the
  // hub replaces the reference).
  if (hubLockKey) state.chatLocks.set(hubLockKey, tail);
  let result: HermesTurnResult;
  try {
    result = await task;
  } finally {
    state.activeProcs.delete(rec.tenantId);
    // Prune only when no later turn has queued behind this one.
    if (state.chatLocks.get(rec.tenantId) === tail) state.chatLocks.delete(rec.tenantId);
  }
  if (result.sessionId) {
    const current = state.registry.get(rec.tenantId) ?? rec;
    if (state.cfg.runtime !== "hermes") current.conversationId = result.sessionId;
    // Auto-title (ChatGPT pattern): a session with no user-provided name takes its title
    // from the first message that drove a completed turn. The interaction addendum
    // (fresh sessions only) is stripped so titles read like the user's own words.
    if (!current.name && message.trim()) {
      const titleSource = message.includes("\n---\n\n") ? message.split("\n---\n\n").pop()! : message;
      current.name = titleSource.replace(/\s+/g, " ").trim().slice(0, 48) || current.tenantId;
    }
    const tokens = (result.tokens ?? {}) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    // Surface any provider cache fields verbatim (cached / cache_read / cache_creation…)
    // so the operator measurement can read prefix-cache hits straight from the log.
    const cacheFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (/cache/i.test(k) && (typeof v === "number" || typeof v === "string")) cacheFields[k] = v;
    }
    timing.mark("turn_done", {
      exitCode: result.exitCode,
      input: n(tokens.input) || undefined,
      output: n(tokens.output) || undefined,
      total: n(tokens.total) || undefined,
      ...cacheFields,
    });
    recordTurnUsage(current, new Date().toISOString().slice(0, 10), {
      input: n(tokens.input),
      output: n(tokens.output),
    });
    state.registry.upsert(current);
    state.turns.record(rec.tenantId, {
      sessionId: result.sessionId,
      exitCode: result.exitCode,
      finalText: result.finalText,
      inputTokens: n(tokens.input),
      outputTokens: n(tokens.output),
    });
  }
  return result;
}

/** Shared credential store for tenant sessions (ADR-0092 Addendum 4): defaults to the seed
 * home's `shared/` dir — the operator's own Nous token store, refreshed in place. */
export function resolveAuthDir(cfg: GatewayConfig): string | undefined {
  return cfg.hermesAuthDir ?? (cfg.hermesSeedHome ? join(cfg.hermesSeedHome, "shared") : undefined);
}

export function usageSummary(result: HermesTurnResult | undefined) {
  const t = (result?.tokens ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const any = n(t.input) ?? n(t.output) ?? n(t.total);
  return any === undefined && !result?.sessionId
    ? null
    : {
        inputTokens: n(t.input),
        outputTokens: n(t.output),
        totalTokens: n(t.total),
      };
}
