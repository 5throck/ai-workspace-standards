/**
 * ADR-0092 Addendum 17 — attach-mode: headless spoke-PM sessions attached to an EXISTING
 * hub/spoke checkout under `<workspaceDir>/Projects/co-*` (design
 * docs/designs/2026-11-01-coworkspace-attach-mode-design.md; implemented in Phase 3b).
 *
 * Trust shape (normative, design §3 — every guard here traces to a verified review finding):
 *  - docker isolation ONLY (Decision 4): process-isolated sessions share the gateway uid and
 *    could read /proc/1/environ + the whole shared data dir — a launch blocker (409), never
 *    a warning;
 *  - mount policy (Decision 5): the attach container mounts ONLY the per-session scratch
 *    (gateway-created, under tenant storage, mounted at the fixed /work/project workdir) and
 *    the hub's ticket-queue subdirectory (the delegation kanban's one write surface). The hub
 *    working tree itself is never mounted — the session cannot read or write it in this
 *    pilot posture; outputs land in scratch/ticket-queue and the hub PM applies them;
 *  - mount DENYLIST (Decision 5, defense-in-depth beneath the allowlist): hub repo root as a
 *    writable mount, `.git/`, `services/`, `Projects/co-security/docs/{findings,evidence,
 *    reports,security}` (the 2026-10-31 data-handling rule — those dirs are the fleet-wide
 *    weakness map / live targeting data), and any `.env*` file. Violations are named 409s at
 *    mount construction;
 *  - identity (Decision 6): the actor derives from the verified key's spoke-id only —
 *    client-asserted identities are ignored (enforced by never reading them);
 *  - per-hub cap + UNAVAILABLE (Decisions 9/10): bounded concurrent sessions per hub;
 *    a hub whose lifecycle state file declares UNAVAILABLE gets its active attach sessions
 *    cancelled and new ones refused until probe re-verification flips it back.
 */

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { HttpError } from "./http";
import type { GatewayState } from "./state";
import type { GatewayConfig } from "./config";
import type { TenantRecord } from "./tenant";

/** Registry `kind` for attach tenants. */
export const ATTACH_KIND = "attached";

/** The hub subdirectory mounted into the attach container — the delegation kanban's drop
 * zone (the variant projects' service-ticket store; hub-consolidation design §5 rides the
 * existing ticket machinery). */
export const ATTACH_TICKET_QUEUE_LEAF = "tickets";
export const ATTACH_TICKET_QUEUE_MOUNT = "/work/ticket-queue";

/** Decision 1: only immediate children of Projects/ named `co-*` (hub or spoke checkouts). */
const ATTACH_HUB_RE = /^co-[A-Za-z0-9][A-Za-z0-9._-]*$/;

// ── Decision 1: the attach_dir contract ─────────────────────────────────────────────────────

/** Resolve + constrain the attach target on the REALPATH: it must be an immediate child of
 * `<workspaceDir>/Projects/` matching `co-*`. No traversal, no symlink escape, no attaching
 * to the gateway's own service directories or to Projects/ itself. 400 on any violation. */
export function resolveAttachDir(cfg: { workspaceDir: string }, raw: string): string {
  let real: string;
  let projectsRoot: string;
  try {
    real = realpathSync(resolve(cfg.workspaceDir, raw));
    projectsRoot = realpathSync(join(realpathSync(cfg.workspaceDir), "Projects"));
  } catch {
    throw new HttpError(400, `attach_dir "${raw}" does not resolve under <workspace>/Projects`);
  }
  if (dirname(real) !== projectsRoot || !ATTACH_HUB_RE.test(basename(real))) {
    throw new HttpError(
      400,
      `attach_dir must be an immediate child of <workspace>/Projects matching co-* (got "${raw}")`,
    );
  }
  return real;
}

// ── Decision 5: mount policy — allowlist + denylist ─────────────────────────────────────────

/** The per-session scratch dir: the tenant folder's `project` leaf in GATEWAY storage (never
 * the hub checkout). Mounted at the fixed /work/project container workdir, so the existing
 * broker bind validation and turn argv builder apply unchanged — an attached session's
 * "project" IS its scratch. Removed at detach with the rest of the tenant folder. */
export function attachScratchDir(rec: TenantRecord): string {
  return resolve(dirname(rec.hermesHome), "project");
}

export interface AttachMountPlan {
  /** Gateway-created per-session scratch (mounted at /work/project). */
  scratch: string;
  /** The hub ticket-queue dir (docker bind source, or its host-side equivalent when
   * workspaceDirHost is set) — the one write surface of the delegation channel. */
  ticketQueueSource: string;
  /** Complete `-v` bind string for the ticket-queue mount (beyond the standard
   * project/home pair built by turnSpawnArgv). */
  ticketQueueBind: string;
}

/** Denylist refusal (Decision 5): `resolvedPath` inside any denylisted class is a named 409.
 * Checked at mount construction for EVERY attach mount source — including the allowlisted
 * ones (defense-in-depth: a tampered registry row must not steer a mount into a denylisted
 * path). Read-only bindings, where any read access is later introduced, hit the same check. */
export function assertAttachMountAllowed(resolvedPath: string, hubDir: string, workspaceDir: string): void {
  const refused = (cls: string): never => {
    throw new HttpError(
      409,
      `attach mount refused: path resolves inside the denylist (${cls})`,
      "attach_mount_denied",
    );
  };
  const p = resolve(resolvedPath);
  const hub = resolve(hubDir);
  if (p === hub) refused("hub repo root as a writable mount");
  const git = resolve(hub, ".git");
  if (p === git || p.startsWith(git + sep)) refused(".git/ directory");
  const services = resolve(workspaceDir, "services");
  if (p === services || p.startsWith(services + sep)) refused("services/ directory");
  // 2026-10-31 data-handling rule: findings/evidence/reports/security are the fleet-wide
  // weakness map and live targeting data — a spoke session never mounts them.
  for (const leaf of ["findings", "evidence", "reports", "security"]) {
    const d = resolve(workspaceDir, "Projects", "co-security", "docs", leaf);
    if (p === d || p.startsWith(d + sep)) refused(`Projects/co-security/docs/${leaf}`);
  }
  if (basename(p).startsWith(".env")) refused(".env* file");
}

/** Build the attach mount plan (Decision 5): scratch + hub ticket-queue, nothing else. Runs
 * the denylist assertion on both sources and fails closed when the ticket-queue dir does not
 * exist (never let a bind-mount root-create directories inside the hub tree). */
export function attachMountPlan(
  cfg: Pick<GatewayConfig, "workspaceDir" | "workspaceDirHost">,
  rec: TenantRecord,
): AttachMountPlan {
  const hub = resolve(rec.attachHub ?? rec.projectDir);
  const scratch = attachScratchDir(rec);
  const queue = resolve(hub, ATTACH_TICKET_QUEUE_LEAF);
  // Allowlist sources still pass the denylist assertion (defense-in-depth, see above).
  assertAttachMountAllowed(scratch, hub, cfg.workspaceDir);
  assertAttachMountAllowed(queue, hub, cfg.workspaceDir);
  if (!existsSync(queue) || !statSync(queue).isDirectory()) {
    throw new HttpError(
      409,
      `attach mount refused: ticket-queue dir ${ATTACH_TICKET_QUEUE_LEAF}/ is missing in ${basename(hub)} — the delegation drop zone must exist before turns run`,
      "attach_ticket_queue_missing",
    );
  }
  // Containerized gateway: mount sources resolve on the HOST (same rule as dataDirHost).
  const source = cfg.workspaceDirHost ? join(cfg.workspaceDirHost, relative(cfg.workspaceDir, queue)) : queue;
  return {
    scratch,
    ticketQueueSource: queue,
    ticketQueueBind: `${source}:${ATTACH_TICKET_QUEUE_MOUNT}:rw`,
  };
}

// ── Decision 7: zero ambient env inheritance ─────────────────────────────────────────────────

/** Exact-name basics an attach turn may receive. Deliberately NARROWER than hermes.ts's
 * allowlistedEnv: NO prefix passthrough (the HERMES_/ANTHROPIC_/OPENAI_/XDG_ families), so
 * no host/gateway ambient credential can reach the attach container env. */
const ATTACH_ENV_EXACT = [
  "PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_ALL", "TZ", "TMPDIR",
  "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY",
];

/** Constructed env for the `docker run` CLI of an attach turn (Decision 7): explicit basics +
 * DOCKER_* (broker reach) + the per-session provider key. Nothing ambient passes through
 * unlisted, and the gateway's own secrets never enter the container env. */
export function attachDockerEnv(
  providerKeyEnv: { name: string; value: string } | undefined,
  base: Record<string, string | undefined> = process.env,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of ATTACH_ENV_EXACT) {
    const v = base[k];
    if (v !== undefined) out[k] = v;
  }
  for (const [k, v] of Object.entries(base)) {
    if (v !== undefined && /^DOCKER_/.test(k)) out[k] = v;
  }
  if (providerKeyEnv) out[providerKeyEnv.name] = providerKeyEnv.value;
  return out;
}

// ── Decision 10: hub lifecycle state (minimal 3.5 subset) ────────────────────────────────────

/** The hub-local lifecycle state file (hub-consolidation design §3.6). */
export function hubStatePath(hubDir: string): string {
  return join(resolve(hubDir), ".pipeline-state", `hub-${basename(hubDir)}.state.json`);
}

export interface HubLifecycle {
  present: boolean;
  operationalState?: string;
  unavailable: boolean;
}

/** Read the hub's declared operational state. Absent file or any state other than
 * UNAVAILABLE → allow (the full state machine lands in Phase 3.5; this is the Addendum 17
 * subset). `operational_state` is the design's field name; `lifecycle_state` is accepted as
 * the declared alias. An unreadable/corrupt file carries no UNAVAILABLE evidence → allow. */
export function readHubLifecycleState(hubDir: string): HubLifecycle {
  let text: string;
  try {
    text = readFileSync(hubStatePath(hubDir), "utf8");
  } catch {
    return { present: false, unavailable: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { present: true, unavailable: false };
  }
  const o = (parsed ?? {}) as Record<string, unknown>;
  const st =
    typeof o.operational_state === "string" ? o.operational_state
    : typeof o.lifecycle_state === "string" ? o.lifecycle_state
    : undefined;
  return { present: true, ...(st ? { operationalState: st } : {}), unavailable: st === "UNAVAILABLE" };
}

/** Kill every running turn of an attached session bound to this hub (Decision 10: sessions —
 * which hold compute and read access — do not linger while the hub is UNAVAILABLE). */
export function cancelHubAttachedSessions(state: GatewayState, hubDir: string, actor: string): string[] {
  const hub = resolve(hubDir);
  const cancelled: string[] = [];
  for (const rec of state.registry.list()) {
    if (rec.kind !== ATTACH_KIND || resolve(rec.attachHub ?? "") !== hub) continue;
    const proc = state.activeProcs.get(rec.tenantId);
    if (!proc) continue;
    try {
      proc.kill();
    } catch {
      /* already gone */
    }
    cancelled.push(rec.tenantId);
    state.audit.record(actor, "attach.session.cancelled", rec.tenantId, `hub ${basename(hub)} UNAVAILABLE`);
  }
  return cancelled;
}

/** Attach admission gate for one hub (Decisions 9/10), run at POST /sessions attach time:
 *  - hub UNAVAILABLE → cancel its active attach sessions, then refuse the new one (409);
 *  - per-hub concurrent-session cap → 409. The cancel path runs at cap-check time by design
 *    (the UNAVAILABLE flip is observed no later than the next attach attempt). */
export function assertAttachHubAdmittable(state: GatewayState, hubDir: string, actor: string): void {
  const hub = resolve(hubDir);
  if (readHubLifecycleState(hub).unavailable) {
    const cancelled = cancelHubAttachedSessions(state, hub, actor);
    throw new HttpError(
      409,
      `hub ${basename(hub)} is UNAVAILABLE — attach refused until probe re-verification returns it to AVAILABLE` +
        (cancelled.length > 0 ? ` (${cancelled.length} active attach session(s) cancelled)` : ""),
      "hub_unavailable",
    );
  }
  const cap = state.cfg.attachHubMaxSessions;
  if (cap > 0) {
    const held = state.registry.list().filter((r) => r.kind === ATTACH_KIND && resolve(r.attachHub ?? "") === hub).length;
    if (held >= cap) {
      throw new HttpError(
        409,
        `per-hub attach cap reached (${held}/${cap} attached sessions on ${basename(hub)}) — detach a session or raise CO_WORKSPACE_ATTACH_HUB_MAX_SESSIONS`,
        "attach_hub_cap_reached",
      );
    }
  }
}

// ── Decision 7: per-session low-limit provider keys ──────────────────────────────────────────

/** Allocate ONE pool key to this attach session (Decision 7: one key per session). Keys held
 * by live attached rows are not re-allocated. Pool exhausted → 409 (add keys or detach).
 * The key is "killed at session end" by the gateway releasing it at detach — provider-side
 * revocation stays an operator act, audited at release time. Empty pool = the deployment
 * provider key applies (Addendum 9 posture). */
export function allocateAttachProviderKey(state: GatewayState): string | undefined {
  const pool = state.cfg.attachLlmApiKeys;
  if (pool.length === 0) return undefined;
  const held = new Set(
    state.registry.list().filter((r) => r.kind === ATTACH_KIND && r.attachProviderKey).map((r) => r.attachProviderKey!),
  );
  const free = pool.find((k) => !held.has(k));
  if (!free) {
    throw new HttpError(
      409,
      `attach provider key pool exhausted (${pool.length} key(s), all in use) — add CO_WORKSPACE_ATTACH_LLM_API_KEYS entries or detach sessions`,
      "attach_provider_key_pool_exhausted",
    );
  }
  return free;
}
