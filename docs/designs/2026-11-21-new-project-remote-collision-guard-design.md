# new-project Remote-Collision Guard — Design (Row 0)

- **Spec id**: `2026-11-21-new-project-remote-collision-guard-design`
- **Date**: 2026-11-21
- **Status**: implemented
- **Author**: architect + automation-engineer (PM-dispatched hybrid, ticket T-20261121-004)
- **Related**: T-20261121-004 (governance ticket), DEC-20261107-01 (fleet-membership SSOT — refusal precedent), `scripts/new-project.ts` v1.43.0 fleet name-collision guard, recovery tags `archive/cowork/local-scaffold` and `archive/cowork/scaffold-session-logs`

## 1. Problem

**The incident (2026-11-20)**: a session ran `new-project` scaffolding into `Projects/co-work` while `github.com/5throck/co-work` was live with 52 PRs. The scaffolded local repo had no `origin` remote, so the two histories diverged silently; recovery on 2026-11-21 required realigning the local repo to origin with safety backups.

**Verified facts (origin/main, 2026-11-21)**:

- `scripts/new-project.ts` §7 initializes git (line 2083 `git init`, then `core.hooksPath` + scaffold-bot identity fallback at 2084-2091) and **never adds an `origin` remote** — every scaffold starts remote-less by design. There is no remote/owner concept anywhere in the script today.
- The remote convention is real and uniform: all 18 project checkouts under `Projects/` push to `github.com/5throck/<name>` (verified via `git remote get-url origin` per project, 2026-11-21), and the workspace root itself is `github.com/5throck/ai-workspace-standards.git`. The GitHub owner is therefore derivable in-repo from the workspace origin URL — no new configuration surface is needed.
- Nothing pre-scaffold probes the remote: a same-name live repo plus a fresh remote-less local repo is the exact silent-divergence shape the incident demonstrated.

## 2. Ruling (PM dispatch, 2026-11-21)

| # | Situation | Action | Override |
|---|-----------|--------|----------|
| a | Same-name remote repo **exists** AND the target has no origin pointing at it (incident shape: fresh scaffold, or local repo without/wrong origin) | **HARD REFUSE** (exit 1, before any write) | **None.** Matches the fleet-membership B1 refusal precedent (v1.43.0, DEC-20261107-01 §6.4): a guard that protects history integrity must not be flaggable past. The ticket's original wording ("blocking … unless an explicit override flag is passed") is superseded by this ruling. |
| b | Same-name remote exists AND the target's origin already points at it | **WARN + proceed** (deliberate checkout/re-scaffold shape — the guard must not misclassify it as (a) and print a misleading refusal) | n/a |
| c | The check itself fails (`gh` missing, unauthenticated, network down) | **WARN + proceed** — a network probe must never block an offline scaffold | n/a |

**Rationale for (a) = refuse**: the cost of the false-positive (pick another name / clone instead) is one command; the cost of the false-negative was a 52-PR divergence with backup-tag recovery. Asymmetric in exactly one direction.

**Owner derivation**: `git -C <workspaceRoot> remote get-url origin` → parse the GitHub owner (`https://github.com/<owner>/…`, `git@github.com:<owner>/…`, `ssh://git@github.com/<owner>/…`). If the workspace root has no origin or the URL is not parseable as a GitHub repo, the guard is inert for the run (INFO skip, case-c family: never blocks).

## 3. Guard design

**Placement — pre-flight, fail before any write.** The guard runs immediately after the fleet-membership exclusion guard (new-project.ts, right after the `scaffoldExclusion` block, before provenance resolution, variant validation, tag extraction, readiness gates, and `mkdirSync(projectDir)`). This is deliberately earlier than "after creating the local repo": at pre-flight there is nothing to roll back, no partial-scaffold hook fires, and the cheap refusal happens before any expensive gate. The ticket's ask is a *pre-scaffold* guard; this satisfies it with strictly less blast radius.

**Decision primitive** (`scripts/lib/remote-collision.ts`, L0-only, side-effect-free, probe injectable):

```
checkRemoteCollision({ projectName, projectDir, workspaceRoot, probe? })
  → { action: "refuse" | "warn" | "proceed" | "skip", …, lines: string[] }
```

Evaluation order (first match wins):

1. **Owner derivation fails** (no workspace origin / non-GitHub URL) → `skip` (INFO line, inert).
2. **Target exists as a git repo whose origin points at `github.com/<owner>/<leaf>`** (normalized compare: host+path, scheme- and `.git`-insensitive, https ≡ ssh) → `warn` (case b).
3. **Probe `gh repo view <owner>/<leaf>`**:
   - exit 0 → repo exists → target has no conforming origin (step 2 already ruled that out) → **`refuse`** (case a).
   - non-zero exit with stderr matching `not found` (GitHub 404) → `proceed` (silent — the common new-project case).
   - anything else (spawn ENOENT, auth prompt, rate limit, network) → `warn` (case c).

**Exact messages** (rendered by the lib, printed by new-project.ts verbatim — unit-pinned):

Case (a) REFUSE (exit 1):

```
❌ Remote-collision guard: github.com/5throck/co-work already exists, but the scaffold target has no origin pointing at it (target: Projects/co-work).
   Scaffolding here would create a divergent local history — the 2026-11-20 co-work incident shape (silent divergence from a live remote, recovered only via backup tags).
   If this IS that repo: clone it instead — gh repo clone 5throck/co-work "Projects/co-work"
   If the name is a coincidence: choose a different project name.
   (guard: remote-collision, T-20261121-004 — no override flag, fleet-membership B1 refusal precedent; design docs/designs/2026-11-21-new-project-remote-collision-guard-design.md)
```

Case (b) WARN (continue):

```
⚠️  Remote-collision guard: github.com/5throck/co-work exists and the target's origin already points at it — proceeding (deliberate checkout shape).
```

Case (c) WARN (continue):

```
⚠️  Remote-collision check unavailable (gh repo view failed: <reason>) — proceeding without it. Verify github.com/5throck/co-work does not already exist before the first push.
```

Owner-derivation skip (INFO, continue):

```
ℹ️  Remote-collision check skipped: no GitHub owner derivable from the workspace origin remote.
```

## 4. Interaction with existing guards

Existing pre-flight order, and where this guard slots in:

| Order | Guard | Interaction |
|-------|-------|-------------|
| 1 | Arg validation, containment guard (`workspaceRoot` escape), `MANAGED_TOP_LEVEL_DIRS` | Unaffected — path-shape guards, run earlier |
| 2 | Fleet-membership exclusion refusal (v1.43.0) | **Runs first** — local-only, cheapest; an excluded name never reaches the network probe |
| 3 | **Remote-collision guard (NEW)** | Slots here; network call only when owner derivation succeeds |
| 4 | Existing-directory refusal (`existsSync(projectDir)` → exit 1) | **Dominance note**: when the target directory already exists, this later refusal still fires — even in case (b). The guard's case (b) exists so the *classification* stays correct (no misleading collision message); it does not, and must not, weaken the existing-directory refusal. When the target exists *without* a conforming origin and the remote exists, case (a) fires first with the more informative collision message — strictly better diagnostics for the same outcome (refuse). |
| 5 | Provenance fail-loud, variant validation, readiness gate, hub preflight, governance precheck | Unaffected — all run after the guard refused or passed |

No conflicts: every earlier guard refuses before the network call; the guard never relaxes any existing refusal; no existing refusal depends on state the guard mutates (it mutates nothing).

## 5. Change spec

| File | Action | Description |
|------|--------|-------------|
| `scripts/lib/remote-collision.ts` | create | v1.0.0 — `githubOwnerFromOrigin`, `workspaceGithubOwner`, `probeGithubRepo` (gh spawn), `normalizeRemoteUrl`, `originPointsAt`, `checkRemoteCollision`, `renderRemoteCollisionDecision`; probe injectable for tests; L0-only (sole consumer is the L0-only new-project.ts) |
| `scripts/new-project.ts` | modify | v1.47.0 — import + wire the guard after the fleet exclusion block (§ pre-flight), print `lines`, exit 1 on `refuse`; header changelog entry |
| `tests/unit/remote-collision.test.ts` | create | Pins: (a) remote-exists + no-origin → refuse; (b) remote-exists + conforming origin → warn; (c) probe unavailable → warn; (d) remote-absent → proceed; owner-derivation matrix (https/ssh/ssh-url/no-origin/non-github); URL normalization matrix; exact message text; **incident-shape reproduction** — a scratch git repo fixture (workspace with `5throck/co-work` origin + target absent or remote-less) reproducing the 2026-11-20 shape end-to-end through the primitive |
| `scripts/SCRIPTS.md` | modify | New row `lib/remote-collision.ts` (L0, active) — L0 rows keep the propagation prune from shipping it to L1; `new-project.ts` row version → 1.47.0 with change summary |

**Version/delivery notes**: `remote-collision.ts` is L0-only by the same classification as `lib/agent-override-merge.ts` / `lib/platform-prune.ts` (sole importer is an L0-only script; SCRIPTS.md Tier `L0` keeps `propagate-to-templates --prune` from shipping it into `templates/common/scripts/lib/`). No template, agent, skill, or doc-template changes.

**Risks**:

- **R1 — probe latency**: one `gh repo view` per scaffold when the workspace origin is parseable and gh is authenticated (~hundreds of ms). Accepted: the fleet guard precedent accepted a registry read; this is one network round trip on an interactive command.
- **R2 — CI/E2E behavior**: nightly scaffold E2E runs inside the real workspace root, so the guard probes `5throck/<temp-name>`. On GH runners gh is unauthenticated → case (c) WARN → proceed; if ever authenticated, random temp names → 404 → proceed. Non-fatal by construction in both paths.
- **R3 — false refusal for a genuinely-new name that someone squatted on GitHub**: case (a) fires; the message names the remediation (clone instead / different name). Accepted per the §2 asymmetry argument.
- **R4 — non-github.com hosts (GHES)**: owner derivation accepts any host for the owner segment, but `originPointsAt` compares full normalized host+path, so a non-github workspace origin still yields a consistent guard; a parse failure degrades to the inert skip.

## 6. Test plan (unit pins — `tests/unit/remote-collision.test.ts`)

1. **(a)** remote exists (injected probe) + target absent → `refuse`; target exists without origin → `refuse` (incident shape, scratch fixture repo).
2. **(b)** remote exists + target repo with conforming origin (https and ssh spellings) → `warn`.
3. **(c)** probe returns `unavailable` → `warn` with the remediation line; probe fn throwing/ENOENT equivalent.
4. **(d)** probe returns `absent` → `proceed` (silent).
5. Owner derivation: https / `git@` / `ssh://` forms; absent origin; non-GitHub URL → skip.
6. Normalization: `.git` suffix, trailing slash, host case, scheme/user differences → equal.
7. Exact message text for refuse/warn/skip (pins the design §3 strings).
8. Probe classification matrix, split for cross-platform reach: `classifyGhProbeResult` (pure — status/stderr/error in, verdict out) is pinned on every platform including Windows, while the real `gh` spawn wiring is POSIX-guarded (`test.skipIf(win32)`) because a `.cmd` stub cannot be spawned without a shell. CI covers both halves (windows + ubuntu/macos runners).

## 7. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — script behavior only | N/A |
| Antigravity (GEMINI.md) | None — no instruction-file, agent, or skill surface changes; guard is invisible to platform instruction layers | N/A (justification: `scripts/` are platform-neutral tooling delivered identically to all harnesses) |
| templates/common | None — L0-only script + L0-only lib; propagation prune keeps both out of L1 | N/A |

## 8. Trade-offs considered

| Option | Pro | Con | Decision |
|--------|-----|-----|----------|
| Pre-flight refuse (chosen) | Nothing written before refusal; no rollback interplay; cheapest failure point | Remote checked even when a later local guard would refuse anyway | Chosen |
| Post-`git init` check (PM parenthetical alternative) | Literal "after creating the local repo" | Half-scaffold on refusal, M13 rollback interplay, wasted gates/tag extraction | Rejected — strictly worse |
| Override flag `--allow-remote-collision` | Escape hatch | A divergence guard with a flag is a guard with a footgun; B1 precedent | Rejected (no override for (a)) |
| Probe via `gh api repos/<owner>/<name>` | Same info | Ticket and convention name `gh repo view`; no benefit | Rejected |
