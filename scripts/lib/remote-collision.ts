#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-11-21, spec docs/designs/2026-11-21-new-project-remote-collision-guard-design.md,
//          T-20261121-004): new-project remote-collision guard primitives. The 2026-11-20
//          co-work incident — a scaffold into Projects/co-work while github.com/5throck/co-work
//          was live with 52 PRs, the local repo remote-less, the histories diverging silently —
//          gets a pre-scaffold guard. The GitHub owner is derived in-repo from the workspace
//          root's origin URL (every project checkout pushes to 5throck/<name>; the workspace
//          root itself is 5throck/ai-workspace-standards — verified 2026-11-21), so no new
//          configuration surface is introduced.
//
// Ruling (design §2):
//   (a) remote exists AND the target has no origin pointing at it → REFUSE (exit 1, before
//       any write). NO override flag — the fleet-membership B1 refusal precedent (v1.43.0,
//       DEC-20261107-01): a history-integrity guard must not be flappable past. The ticket's
//       original "explicit override flag" wording is superseded by the PM ruling.
//   (b) remote exists AND the target's origin already points at it → WARN + proceed (deliberate
//       checkout shape — the guard must classify, not misfire).
//   (c) the check itself fails (gh missing/unauthenticated, network down) → WARN + proceed —
//       a network probe must never block an offline scaffold. Owner-derivation failure is the
//       same family: inert INFO skip.
//
// Delivery: L0-only (sole consumer is the L0-only scripts/new-project.ts; SCRIPTS.md Tier L0
// keeps propagate-to-templates --prune from shipping it into templates/common/scripts/lib —
// same classification as lib/agent-override-merge.ts / lib/platform-prune.ts). Side-effect-free
// and probe-injectable so tests/unit/remote-collision.test.ts pins all four decision branches
// (incl. the incident-shape fixture reproduction) without network or a full scaffold.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Outcome of one remote-existence probe for `<owner>/<name>`. */
export type RemoteProbeResult = "exists" | "absent" | "unavailable";

export interface RemoteCollisionInput {
  /** Project name as given to new-project (the LEAF segment names the remote repo). */
  projectName: string;
  /** Resolved scaffold target directory (may not exist yet — the normal case). */
  projectDir: string;
  /** Workspace root — its origin URL supplies the GitHub owner. */
  workspaceRoot: string;
  /**
   * Injectable probe (tests). Default spawns `gh repo view <owner>/<name>`.
   * Receives the `owner/name` slug, returns the probe outcome.
   */
  probe?: (repoSlug: string) => RemoteProbeResult;
}

export type RemoteCollisionDecision =
  | { action: "refuse"; remoteUrl: string; targetLabel: string; lines: string[] }
  | { action: "warn"; message: string }
  | { action: "proceed" }
  | { action: "skip"; message: string };

// ── Owner derivation ───────────────────────────────────────────────────────────

/**
 * Extract the GitHub owner from a git remote URL. Accepts the three spellings
 * the convention uses (design §2): https, scp-like ssh, and ssh:// URL form.
 * Returns null for anything not parseable as a GitHub-style host/path pair.
 */
export function githubOwnerFromOrigin(url: string | null | undefined): string | null {
  if (!url) return null;
  const normalized = normalizeRemoteUrl(url);
  if (!normalized) return null;
  const owner = normalized.split("/")[1];
  return owner || null;
}

/**
 * Normalize a git remote URL to `host/owner/repo` (lowercase, no scheme, no
 * user, no trailing `.git` or `/`). https ≡ ssh ≡ scp-form for the same
 * host+path (design §5 R4: the host participates in the comparison, so a
 * non-github workspace origin yields a consistent, self-coherent guard).
 * Returns null when the URL matches no known git-remote spelling.
 */
export function normalizeRemoteUrl(url: string): string | null {
  const u = url.trim();
  // Each spelling yields [host, path]; the normalized form is `host/path`.
  const forms: Array<[string, string] | null> = [
    // https://github.com/owner/repo(.git)
    (() => {
      const m = u.match(/^https?:\/\/([^/]+)\/(.+)$/i);
      return m ? [m[1], m[2]] : null;
    })(),
    // git@github.com:owner/repo(.git)
    (() => {
      const m = u.match(/^git@([^:]+):(.+)$/);
      return m ? [m[1], m[2]] : null;
    })(),
    // ssh://git@github.com/owner/repo(.git)
    (() => {
      const m = u.match(/^ssh:\/\/git@([^/]+)\/(.+)$/i);
      return m ? [m[1], m[2]] : null;
    })(),
  ];
  const hit = forms.find((f) => f !== null);
  if (!hit) return null;
  return `${hit[0]}/${hit[1]}`
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * Derive the GitHub owner from the workspace root's origin remote (the
 * in-repo SSOT of the `owner/<name>` convention). Returns `{ owner: null }`
 * when the workspace has no origin or the URL is not GitHub-parseable — the
 * guard's inert-skip input (design §2 case-c family).
 */
export function workspaceGithubOwner(workspaceRoot: string): { owner: string | null; originUrl: string | null } {
  let originUrl: string | null = null;
  try {
    const r = spawnSync("git", ["-C", workspaceRoot, "remote", "get-url", "origin"], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) originUrl = r.stdout.trim();
  } catch {
    /* git unavailable — treated as no-origin below */
  }
  return { owner: githubOwnerFromOrigin(originUrl), originUrl };
}

// ── Origin comparison ──────────────────────────────────────────────────────────

/** The canonical remote URL for a scaffold leaf name, per the fleet convention. */
export function expectedRemoteUrl(owner: string, leafName: string): string {
  return `github.com/${owner}/${leafName}`.toLowerCase();
}

/**
 * True when projectDir is a git repo whose `origin` remote points at
 * `<owner>/<leafName>` (normalized compare — design §3 step 2). A missing
 * directory, a non-repo, or any git failure returns false (the caller's
 * refuse path is then driven by the probe, which is the conservative
 * direction: fail toward the guard, never away from it).
 */
export function originPointsAt(projectDir: string, owner: string, leafName: string): boolean {
  if (!existsSync(projectDir)) return false;
  let url: string;
  try {
    const r = spawnSync("git", ["-C", projectDir, "remote", "get-url", "origin"], { encoding: "utf8" });
    if (r.status !== 0) return false;
    url = r.stdout.trim();
  } catch {
    return false;
  }
  if (!url) return false;
  const normalized = normalizeRemoteUrl(url);
  return normalized !== null && normalized === expectedRemoteUrl(owner, leafName);
}

// ── gh probe (default) ─────────────────────────────────────────────────────────

/**
 * Pure classification of one `gh repo view` result (split out so the matrix is
 * pinnable on Windows too — a `.cmd` stub cannot be spawned without a shell, so
 * the spawn wiring itself is POSIX-pinned while this logic is pinned everywhere):
 * spawn error → unavailable; exit 0 → exists; stderr matching /not found/i →
 * GitHub 404 → absent; anything else (auth prompt, rate limit, network) → unavailable.
 */
export function classifyGhProbeResult(r: {
  status?: number | null;
  stderr?: string | Buffer | null;
  error?: Error;
}): RemoteProbeResult {
  if (r.error) return "unavailable";
  if (r.status === 0) return "exists";
  // spawnSync's stderr type is `string | Buffer` even under encoding: "utf8".
  const stderr = typeof r.stderr === "string" ? r.stderr : (r.stderr?.toString("utf8") ?? "");
  if (/not found/i.test(stderr)) return "absent";
  return "unavailable";
}

/**
 * Default probe: `gh repo view <owner>/<name>`, classified by classifyGhProbeResult.
 * exit 0 → exists; GitHub 404 → absent; anything else → unavailable (case c).
 */
export function probeGithubRepo(repoSlug: string): RemoteProbeResult {
  let r: ReturnType<typeof spawnSync>;
  try {
    r = spawnSync("gh", ["repo", "view", repoSlug], { encoding: "utf8" });
  } catch (err) {
    void err;
    return "unavailable";
  }
  return classifyGhProbeResult(r as { status?: number | null; stderr?: string | Buffer | null; error?: Error });
}

// ── Decision primitive ─────────────────────────────────────────────────────────

/**
 * The guard's brain (design §3 evaluation order, first match wins):
 *   1. owner derivation fails → skip (inert INFO);
 *   2. target origin already points at the remote → warn (case b);
 *   3. probe: exists → refuse (case a) / absent → proceed / unavailable → warn (case c).
 * All post-branch messages are assembled here (rendered verbatim by
 * new-project.ts) so the unit suite pins exact text (design §6 pin 7).
 */
export function checkRemoteCollision(input: RemoteCollisionInput): RemoteCollisionDecision {
  const leafName = input.projectName.split("/").pop() ?? input.projectName;
  const { owner } = workspaceGithubOwner(input.workspaceRoot);
  if (!owner) {
    return {
      action: "skip",
      message: "ℹ️  Remote-collision check skipped: no GitHub owner derivable from the workspace origin remote.",
    };
  }
  const remoteUrl = `github.com/${owner}/${leafName}`;
  // Mirror new-project.ts's own resolution: a bare name scaffolds at Projects/<name>,
  // a path-like name is the explicit workspace-relative destination as given.
  const targetLabel = input.projectName.includes("/") ? input.projectName : `Projects/${leafName}`;

  if (originPointsAt(input.projectDir, owner, leafName)) {
    return {
      action: "warn",
      message: `⚠️  Remote-collision guard: ${remoteUrl} exists and the target's origin already points at it — proceeding (deliberate checkout shape).`,
    };
  }

  const probe = input.probe ?? probeGithubRepo;
  const outcome = probe(`${owner}/${leafName}`);
  if (outcome === "exists") {
    const lines = [
      `❌ Remote-collision guard: ${remoteUrl} already exists, but the scaffold target has no origin pointing at it (target: ${targetLabel}).`,
      `   Scaffolding here would create a divergent local history — the 2026-11-20 co-work incident shape (silent divergence from a live remote, recovered only via backup tags).`,
      `   If this IS that repo: clone it instead — gh repo clone ${owner}/${leafName} "${targetLabel}"`,
      `   If the name is a coincidence: choose a different project name.`,
      `   (guard: remote-collision, T-20261121-004 — no override flag, fleet-membership B1 refusal precedent; design docs/designs/2026-11-21-new-project-remote-collision-guard-design.md)`,
    ];
    return { action: "refuse", remoteUrl, targetLabel, lines };
  }
  if (outcome === "absent") {
    return { action: "proceed" };
  }
  return {
    action: "warn",
    message: `⚠️  Remote-collision check unavailable (gh repo view failed for ${remoteUrl}) — proceeding without it. Verify ${remoteUrl} does not already exist before the first push.`,
  };
}
