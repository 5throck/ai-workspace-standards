# Design: co-workspace attach-mode — headless spoke-PM sessions inside existing hub repositories (ADR-0092 Addendum 17 scope)

- **Spec ID**: 2026-11-01-coworkspace-attach-mode-design
- **Date**: 2026-11-01
- **Status**: Approved (v7 execution baseline, user-approved 2026-11-01) — design complete in Phase 0; implementation sequenced to Phase 3b
- **Registry status**: `planned` (docs/specs/registry.json) — implementation is gated behind Checkpoint B (adoption evidence from the Phase 3a pilot)
- **Owner**: architect (PM Gateway dispatch, after user approval of the v7 baseline)
- **Source evidence**: memory/meeting-2026-11-01-v6-baseline-review.md (architect G-2/I-2, security-expert verified trust-boundary findings, automation-engineer service-PR scoping, preserved red-team dissent); services/co-workspace source anchors cited inline
- **Sibling design**: docs/designs/2026-11-01-hub-consolidation-design.md (§3 state machine this design's UNAVAILABLE rule consumes; §10 glossary declaring attach-mode)
- **ADR relationship**: lands as **ADR-0092 Addendum 17** + one focused service PR (Phase 3b). Addendum 17's core is §3 of this document (normative security requirements), following the ADR-0092 Addenda 14/15/16 pattern (normative text + verification in the addendum). ADR-0092's References section gains a pointer to this design at implementation time.

## 0. Accessibility exemption statement

This design is a backend service change: gateway routes, lifecycle guards, mount policy, and tests. It produces no user-facing UI beyond the existing gateway API surface. The ADR-0065 accessibility sections and the ADR-0070 preview-verification sections are **exempt** for every artifact in this design.

## 1. Problem

Spoke PMs need to run headless agent sessions **inside an existing hub repository** — reading the hub's real working tree, filing delegation tickets against it, and handing results to the hub PM. Today co-workspace cannot do this:

- **POST /sessions** (`services/co-workspace/src/routes/tenants.ts:30-63`) accepts only `{variant, name?, description?}`; the project directory is always **scaffolded fresh** (Addendum 5 provisioning path: scaffold internally, then relocate) and the tenant's trust boundary pins to that freshly created, tenant-owned project dir. There is no route that accepts an external directory (verified: no attach_dir / existing_project parameter anywhere in the routes or lifecycle).
- The one-active-team-per-(principal, variant) invariant (Addendum 6) and provisioning gate (`assertProvisioningAllowed`) exist for the fresh-scaffold path; attaching a session to a repo the session does not own is a different trust shape that today's guards do not model.
- Running a spoke session by hand outside the gateway (raw hermes/claude invocations against a hub checkout) has no identity binding, no quota, no mount policy, and no audit — the exact surfaces the gateway exists to provide.

The red-team's demand-evidence concern is recorded and respected (§7): this design is completed and spec-registered now (Phase 0, per the user-approved v7 baseline), but **nothing is implemented until Checkpoint B** confirms pilot demand (≥3 delegation tickets/month with hub-PM turnaround bottleneck, or an explicit user request).

## 2. Attach contract

### 2.1 Parameter and constraint

`POST /sessions` gains an optional `attach_dir` (alias `existing_project`) parameter:

- The resolved path MUST be an immediate child matching `<workspaceDir>/Projects/co-*` — a hub or spoke project checkout under the workspace Projects root. Anything else is rejected (400): no paths outside Projects/, no traversal, no symlink escape, no attaching to the gateway's own service directories.
- The constraint is checked on the resolved (realpath) path, not the literal string.

### 2.2 Provisioning semantics

- **Skip scaffold + relocate entirely**: the existing checkout IS the project dir. `startProvisioning` branches: attach path performs only the runtime-home seeding steps that today's path performs (seed Hermes home per Addendum 7's directory-bind posture, tenant config.yaml per Addendum 9), and the tenant registry row's `projectDir` points at the attached checkout.
- **Registry sweep exemption preserved**: `sweepOrphanedScaffolds` (`services/co-workspace/src/lifecycle.ts:87-97`) deletes `gw-<12hex>` dirs without a registry row; the attach path registers the tenant BEFORE any gateway restart can occur, and — because attach never creates a `gw-` dir at all — the sweep never touches attached projects. The exemption logic ("has registry row → skip") is the same predicate, unchanged.
- The one-active-team-per-(principal, variant) invariant (Addendum 6) still applies per (principal, variant); an attach session is a tenant like any other in the registry.

### 2.3 Detach semantics (explicit)

`DELETE /tenants/<id>` on an attached tenant means **detach, never delete the project**:

- Drop the seeded runtime homes and the registry row (+ turn history), exactly as `deleteTenantData` does for its own artifacts.
- **Never recurse into the attached project working tree**: the existing storage-root guard (`services/co-workspace/src/lifecycle.ts:311-316` — "a tampered/legacy record must never point any rmSync outside the tenant storage root") is the foundation; the attach path strengthens it with an explicit allowlist of what detach MAY remove (seeded homes, gateway-written scratch) and returns **409 Conflict** if the record's projectDir is an attached checkout and the caller requests full data deletion. Detach is fail-safe in the same order as the existing delete implementation (validate paths first, then quiesce, then remove, then drop registry state) so a corrected detach can be retried.
- The project's git state is untouched by detach — merge-back is the hub PM's act (§5), not the gateway's.

## 3. Security requirements (NORMATIVE — this section is the core of ADR-0092 Addendum 17)

These requirements are binding on the Phase 3b implementation. Each traces to a verified finding from the 2026-11-01 review.

### 3.1 Docker isolation ONLY

Attach-mode sessions launch **only** under `CO_WORKSPACE_ISOLATION=docker`. Process mode is a **launch blocker** for attach tenants: the verified boundary is that process isolation runs tenant agents as same-uid siblings that can read `/proc/1/environ` (gateway secrets: `CO_WORKSPACE_LLM_API_KEY`, `GOOGLE_CLIENT_SECRET`, `CO_WORKSPACE_API_KEYS`) and the whole shared data dir (`services/co-workspace/src/access.ts:158-181`, `isolationPostureWarning`). An attach session reading a hub repo must never share a uid with the gateway. A POST /sessions attach request while isolation=process is rejected (409), not warned.

### 3.2 Mount policy: scratch + ticket-queue ONLY, with denylist

Mounts into the attach session container:

- **Allowed**: (a) a **per-session scratch directory** (gateway-created, session-scoped, removed at detach); (b) the **ticket-queue subdirectory** of the hub (the delegation kanban's drop zone — the one write surface the delegation channel needs).
- Nothing else is mounted. The session **cannot write the hub repo** — outputs land in scratch/ticket-queue and the hub PM applies them (the red-team's "expensive read-only context loader" characterization is accepted as the pilot posture; §5 covers the merge-back model and §7 the demand gate that justifies or kills this shape).
- **Denylist** (defense-in-depth beneath the allowlist; any resolved path inside these is refused at mount construction): the hub repo root itself (as a writable mount), `.git/`, `services/`, `Projects/co-security/docs/findings`, `Projects/co-security/docs/evidence`, `Projects/co-security/docs/reports`, `Projects/co-security/docs/security`, and any `.env*` file. The co-security exclusions implement the 2026-10-31 data-handling rule: findings/evidence/reports are a fleet-wide weakness map (live targeting data — deferred criticals, pending MCP decisions); a spoke session must not read them. Read-only bindings, where any read access is later introduced, still never mount denylisted paths.

### 3.3 Per-spoke key identity

- The `apiKeysFile` entry schema extends from `key:label` to **`key:label,expires,spoke-id`** (extending the P9 principal-label mechanism, `services/co-workspace/src/auth.ts:50-58`). `expires` adds revocation-by-expiry (today's keys are immortal); `spoke-id` scopes the key to one spoke.
- **The actor is gateway-derived from the verified key, never client-asserted.** A request body claiming a different spoke identity than the presented key's `spoke-id` is ignored — attribution in state_history and kanban entries is exactly as trustworthy as the key, which is why §3.5's floors and the audit chain matter.
- Rotation = new file entry + expiry of the old; no key-outlives-its-spoke state.

### 3.4 Provider keys: dedicated, low-limit, per-session; zero ambient inheritance

- Attach sessions use a **per-session dedicated low-limit provider key** (extends Addendum 9's accepted risk: the key is stamped plaintext into tenant config.yaml under docker isolation, so the blast radius must be capped by quota, not by hiding it). One key per session, killed at session end.
- **Zero ambient env inheritance**: the session container's env is constructed explicitly (existing env allowlist); no host/gateway ambient variable passes through unlisted. `/proc/1/environ` is not reachable under docker isolation (§3.1), and the constructed env carries only what the turn needs.

### 3.5 Egress: host-side posture stands; gateway contributes scoping + ceilings only

Egress enforcement remains **host-side** per Addendum 2's settled decision — this design does **NOT** re-open it (the red-team flagged re-opening as net-new gateway work with weak justification; accepted). The gateway's contribution is: (a) **toolset scoping** — the attach session's available tools are declared per session (the delegation task's toolset), not the full default set; (b) **run ceilings** — turn/token caps per §3.6. Host-side network policy (default-deny posture per the security-expert recommendation) is an operator deployment concern, documented in Addendum 17, not implemented by the gateway.

### 3.6 Per-hub concurrent-session cap and ceilings

- A **per-hub concurrent-session cap** (new config, default 2) gates attach sessions per hub project. Reuse of the existing quota machinery: `CO_WORKSPACE_TENANT_MAX_TURNS` / `CO_WORKSPACE_TENANT_MAX_TOKENS` (`services/co-workspace/src/config.ts:293-294`) apply per-tenant as today; the per-hub cap is enforced at attach time alongside `assertTenantCap`.
- The **boot reaper precedent** (`services/co-workspace/src/reaper.ts` — boot-time removal of orphaned sibling turn containers labeled by gateway instance) extends to attach sessions: crashed attach containers are reaped at boot under the same label discipline.

### 3.7 Hub UNAVAILABLE interaction

When the target hub's declared operational state is UNAVAILABLE (hub-consolidation design §3.4), attach sessions are **cancelled** (quiesce like deleteTenantData's bounded waits) and new attach requests are rejected until the hub returns to AVAILABLE via probe re-verification. In-flight delegation tickets are not auto-cancelled — they queue; sessions (which hold compute and read access) do not linger.

## 4. never-in-DEGRADED floor

Defined ONCE here; the hub-consolidation design's capability enum and every later surface CITES this section rather than restating it. The following may **never** execute against, or within, a hub whose operational state is DEGRADED (or UNAVAILABLE):

1. **Pentest execution** (any offensive-security task against any target);
2. **verify-authorization issuance/renewal** (the authorization chain's gate — a degraded hub must not mint authorizations);
3. **Threat modeling on authentication surfaces**;
4. **Hub bootstrap/validation** (the §4.4 VALIDATED gate of the hub-bootstrap contract — a degraded hub cannot validate another).

Rationale: these are the operations where a reduced-capability hub's failure mode is silent (partial scans, stale authorization data, mis-scoped threat models). DEGRADED hubs may continue: triage of routine tickets, non-auth threat modeling, documentation work, probe responses.

## 5. Concurrency posture

Two models, both designed now; the choice is per-deployment:

- **Target model — git worktree per session**: each attach session works in a `git worktree` of the hub repo (isolated branch), so concurrent sessions never touch one working tree; merge-back into the hub's mainline is performed by the **hub PM** (the 2-writer rule's actor, hub-consolidation design §7.4), reviewing worktree diffs as normal PRs.
- **Pilot-simple alternative — serialized per-hub session lock**: one attach session per hub at a time (the per-hub cap set to 1), reusing the `scripts/automation-lock.ts` pattern for the session lock. No worktree machinery, no merge conflicts between sessions.

**Recommendation**: serialized lock for the Phase 3b pilot (matches the pilot's 1-hub scale and keeps the service PR small); worktree-per-session post-pilot if concurrent demand appears. The red-team's observation that scratch-dir-only mounts make sessions read-only context loaders is answered by the same sequencing: the pilot measures whether ticket-queue + scratch suffices before any worktree write-path investment.

## 6. Verification

1. **Gateway-secret non-exposure test (docker mode)**: attach session container must not reach `CO_WORKSPACE_LLM_API_KEY` / `CO_WORKSPACE_API_KEYS` / the shared data dir — asserted by exec-ing into the turn container and probing env + paths (extends the access.ts warning's contractual claims into tests).
2. **Mount-denylist refusal test**: constructing an attach session whose requested mount set intersects the denylist (hub root, `.git/`, `services/`, co-security docs/{findings,evidence,reports,security}, `.env*`) is refused with a named violation; the allowlist-only path (scratch + ticket-queue) mounts exactly those two.
3. **Attach/detach lifecycle test**: attach → registry row present with attached projectDir → detach drops homes + registry row and leaves the project working tree byte-identical → detach-with-delete on an attached checkout returns 409 → re-attach is idempotent per the (principal, variant) key. Includes the storage-root guard regression: a tampered record pointing outside storage still refuses (lifecycle.ts:311-316).
4. **UNAVAILABLE interaction test**: hub state UNAVAILABLE → in-flight attach session cancelled, new attach 409 → probe re-verification → AVAILABLE → attach accepted.
5. **E2E patterns** (existing seams, zero new infrastructure): in-process co-workspace server harness (no socket), stub hermes binary (turn execution without a real runtime), `TICKET_WORKSPACE_ROOT` / `UPSTREAM_WORKSPACE_ROOT` env seams, mkdtempSync fixtures, and a **local bare repository as `hub_remote`** (no GitHub dependency in tests).

## 7. Phase gating

- **Phase 0 (now)**: this design + the ADR-0092 Addendum 17 draft (whose core is §3 above) completed and spec-registered. No code changes.
- **Phase 3a pilot (ticket+kanban)** runs first; its adoption data feeds **Checkpoint B**.
- **Phase 3b (implementation)** starts only behind Checkpoint B evidence: ≥3 delegation tickets/month with a hub-PM turnaround bottleneck (the demand trigger the red-team demanded), or an explicit user request for interactive attach sessions. If Checkpoint B fails the adoption metric, this design is sunset per the kill→action mapping (session-path kill: supersede Addendum 17; kanban and registry unaffected).
- The service PR itself is one focused change: route parameter + lifecycle guards + mount policy + tests (FILE_TIME_BUDGETS rows at implementation), landed as ADR-0092 Addendum 17 with this design as its design doc.

## References

- memory/meeting-2026-11-01-v6-baseline-review.md — verified findings this design encodes (G-2/I-2; security-expert trust-boundary findings; red-team objections 2 and demand trigger)
- docs/designs/2026-11-01-hub-consolidation-design.md — §3 state machine (UNAVAILABLE semantics), §7.4 (2-writer rule / merge-back actor), §10 glossary (attach-mode declaration)
- services/co-workspace/src/routes/tenants.ts:30-63 — POST /sessions (today's contract)
- services/co-workspace/src/lifecycle.ts:87-97 (sweepOrphanedScaffolds), :311-316 (storage-root guard)
- services/co-workspace/src/access.ts:158-181 — process-isolation boundary (isolationPostureWarning)
- services/co-workspace/src/auth.ts:50-58 — P9 key:label mechanism (schema extension base)
- services/co-workspace/src/config.ts:293-294 — tenant quota env (ceiling reuse)
- services/co-workspace/src/reaper.ts — boot-reaper precedent
- ADR-0092 Addenda 2, 5, 6, 7, 9, 14, 15, 16 — posture this addendum extends or preserves
