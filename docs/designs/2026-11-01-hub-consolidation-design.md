# Design: Hub-and-spoke consolidation — hub topology registry, hub lifecycle state machine, hub-bootstrap contract, delegation kanban alias layer, and promotion-pipeline conformance

- **Spec ID**: 2026-11-01-hub-consolidation-design
- **Date**: 2026-11-01
- **Status**: Approved (v7 execution baseline, user-approved 2026-11-01) — pending implementation
- **Registry status**: `planned` (docs/specs/registry.json) — implementation lands in Phases 1–3a; the design and its spec entry land now (Phase 0), so ADR-0074's Design Gate is satisfied before any Phase 1 landing
- **Owner**: architect (PM Gateway dispatch, after user approval of the v7 baseline)
- **Source evidence**: memory/meeting-2026-10-31-hub-spoke-consolidation-review.md (12-item synthesis + user decisions), memory/meeting-2026-11-01-v6-baseline-review.md (verified code anchors, all synthesis items 1–11, preserved red-team dissent)
- **Sibling design**: docs/designs/2026-11-01-coworkspace-attach-mode-design.md (attach-mode service change, ADR-0092 Addendum 17 — designed in the same Phase 0)
- **Precedent**: docs/designs/2026-10-27-co-design-suite-promotion-design.md (the ratified per-suite promotion frame adopted for Phase 1 PRs); docs/designs/2026-10-31-variant-generators-design.md (same-day design — see §11.4 de-confliction note)
- **Tier**: L0 (registry schema + validator legs + pipeline scripts) with L2 delivery conventions (hub variants) and L1 reconciliation (hand-maintained schema pair)

## 0. Accessibility exemption statement

This design is backend/governance work: a registry schema section, validator legs, a bootstrap script contract, an alias-configuration file, and pipeline conformance rules. It produces no user-facing UI. The ADR-0065 accessibility sections and the ADR-0070 preview-verification sections are **exempt** for every artifact in this design. The only human-facing artifact in later phases (docs/guides/hub-operator-guide.md, a Phase 3 common item) carries its own accessibility treatment at that phase.

## 1. Context and goal

The workspace is a service-oriented AI operations platform: a root repository (L0) publishes templates (L1) that instantiate variant projects (L2), each running its own PM-led agent team. The Template/Hub/Variant concept model extends this:

- **Template** — L0/L1 delivery SSOT; what scaffold and upgrade ship.
- **Hub** — a variant project that carries the canonical, richest copies of domain assets shared by other projects, and is responsible for their delivery quality. **A hub is a delivery responsibility, NOT an authority**: the Spoke PM owns the spoke project; the Hub PM owns domain service quality (keeping canonical assets correct, current, and promotable); final adjudication of any spoke-PM vs hub-PM disagreement stays with the workspace-root PM. This principle was the explicit resolution of the 2026-10-31 red-team objection that hub tiers "quietly reintroduce a hierarchy the L3 architecture deliberately flattened" (transcript §Round 2, concession 7).
- **Spoke** — a variant project that consumes hub canonical assets through the normal template/promotion machinery and contributes improvements back through promotion PRs, not through direct cross-repo writes.

**Roster (pinned, 2026-11-01)**: 16 projects = **3 hubs** (co-develop, co-design, co-security) + **13 spokes**. Two template-less projects are dispositioned: **co-architect** — template creation proceeds (Phase 1.5 validation case, §6.3); **co-newbiz** — excluded from the hub program (manual-sync ticket; it remains the first adopter of the unrelated generators.json convention, see §11.4).

Hub selection is **provisional on data** (§9), not a permanent institutional fact: co-safety and co-consult hold the largest asset rosters but are not hubs under the fan-in rule unless measured data shows cross-suite consumption.

Goal: make hub ownership **machine-readable and validator-enforced** (ending the class of silent drift exemplified by the co-develop/co-security security-suite fork), give hubs a declared lifecycle so consumers can distinguish "repo exists" from "service ready", provide a safe auto-bootstrap path for new hub clones, and give spoke→hub delegation a priority vocabulary that rides existing ticket machinery unchanged.

## 2. Hub topology registry (`hub_topology` in docs/workspace-schema.json)

### 2.1 Placement and scope

A new top-level `hub_topology` section in `docs/workspace-schema.json` (currently v1.8.0). It is **static-only**: identity, classification, canonical paths, versions, consumers, and pointers. Per-hub operational state NEVER lives here (§3.6).

The L1 copy `templates/common/docs/workspace-schema.json` is reconciled **in the same commit** — the pair is hand-maintained (ADR-0069; DEC-20261028-05) and the hash-parity gate fails on divergence.

### 2.2 Why dynamic state can never live here — the hash-parity gate

`scripts/validate-templates.ts:1240-1257` (T-20261026-017) requires the root and L1 schema copies to be identical after normalizing exactly ONE sanctioned delta (the L1 copy drops the CONSTITUTION.md rootAllowlist entry and carries `_notes.root_allowlist_divergence`; the comparison is `canonicalWsSchemaForParity`, `scripts/validate-templates.ts:3117`). Any per-session state churn (state_history appends, timestamps) would permanently fail parity and force a full template audit on every session-start write. This is the structural reason the registry carries only static data.

### 2.3 Entry schema

Each `hub_topology.entries[]` row:

| Field | Type | Meaning |
|---|---|---|
| `asset` | string | Asset identifier (skill/agent/script name or path) that the hub owns canonically |
| `domain` | enum | Owning domain: `co-develop` \| `co-design` \| `co-security` |
| `hub_variant` | string | The variant project acting as hub for this domain |
| `category` | enum | `variant-identity` \| `hub-doctrine` \| `hub-escalation` \| `incident-escalation` (definitions in §10) |
| `verticals[]` | string[] | Consumer variant names (the fan-in set) |
| `origin` | string | Where the asset originated (hub project, L1 common, template) |
| `canonical_path` | string | Hub-side canonical path of the asset |
| `version` | semver string | Current canonical version (semantics in §7.1) |
| `consumers[]` | array of `{variant, minimum_version}` | Who consumes it and the oldest acceptable version (enforced by the audit.ts hub-resolve checker, §2.4) |
| `hub_remote` | string | Git remote URL for hub-bootstrap clone (§4.1) |
| `state_ref` | string | Pointer to the hub-local state file (§3.6). **`state_ref` is hub-local and unresolvable from the root by design** — the root repo cannot read another project's local `.pipeline-state/` directory, and this is intentional: dynamic state is write-owned by the hub, and the root observes it via the probe only (§3.5). The field exists so root-side tooling can *name* the expected state location and so the probe can report which file it read; a dangling `state_ref` at the root is normal operation, not an error. |

A `hub_topology.hubs[]` array carries per-hub static facts (name, `hub_remote`, declared capabilities enum, `minimum_version` policy).

### 2.4 Validator legs (all FAIL-closed)

1. **Unregistered cross-variant duplication** — FAIL: the duplicate-detection legs of `scripts/validate-templates.ts` plus the audit legs report cross-variant asset copies that have no `hub_topology` row. Undeclared forks are exactly the failure mode this design exists to end (the co-develop/co-security security-suite fork went unnoticed until the 2026-10-31 audit).
2. **Variant-identity unauthorized promotion** — FAIL: an asset categorized `variant-identity` may only change canonical ownership through the explicit promotion flow (§6); a template wave that would overwrite a registered variant-identity asset with a thinner copy fails validation (the PR #61 clobber class).
3. **Consumer minimum_version** — FAIL: the **audit.ts hub-resolve checker** resolves each `consumers[]` row against the consuming project's actual installed version (from its variant.json / delivered skill headers) and fails when a consumer sits below `minimum_version`.
4. **Scheduled drift detector** — `scripts/validators/duplicate-validator.ts` (duplicate agent definitions at filesystem + manifest level) is designated as the scheduled drift detector: run on the weekly cadence, it re-checks that on-disk copies still match the registry's declared topology, catching silent divergence between scheduled registry edits.

### 2.5 Machine-readable vs prose split

Schema enums (categories, states, capability keys) and the alias table (§5.1) are machine-readable; the state-machine narrative (§3) and this document's normative prose carry the semantics. The registry is the declared expected state that every skew check compares against — this was the red-team's own concession in the 2026-10-31 meeting ("the red-team's skew-check proposal requires a declared expected state, which IS the registry").

## 3. Hub lifecycle state machine

Two separate enums, so the machine distinguishes who may write which (docs-writer proposal, 2026-11-01 meeting). State names are SCREAMING_SNAKE to keep them visually distinct from the lowercase ticket/spec/variant vocabularies.

### 3.1 bootstrap_states (machine-declared, linear)

```
BOOTSTRAPPED → VALIDATED → READY
```

Declared by `hub-bootstrap.ts` infra verification only (§4) — a hub PM cannot self-declare these. BOOTSTRAPPED = cloned at the pinned SHA; VALIDATED = the four security checks passed (§4.4); READY = infra verified end-to-end.

### 3.2 operational_states (hub-PM-declared at session start)

```
AVAILABLE / DEGRADED / UNAVAILABLE / RECOVERY
```

Declared by the hub PM at session start. Declaration authority and judgment criteria are split explicitly:

- **READY** (bootstrap) = infrastructure verified: clone integrity, hook integrity, audit green. It says nothing about service capacity.
- **AVAILABLE** (operational) = the hub PM judges triage capacity exists (the hub PM can process delegation tickets this session) AND the authorization registry is valid (verify-authorization accepts it: window-current, project-matched, non-empty user rows).

### 3.3 Journaling and lease

Every transition appends `{from, to, actor, timestamp, reason}` to the state file's `state_history`. Declarations are **TTL leases**: an operational declaration carries an expiry (default: the session length); a hub that does not re-attest before expiry is treated as UNAVAILABLE by consumers until the next declaration or probe.

### 3.4 DEGRADED semantics

DEGRADED carries `degraded_capabilities[]`: hub-authored, but constrained by a **root-schema capability enum** (declared in `hub_topology.hubs[].capabilities`) and validated as a subset of the hub's declared capabilities. A hub cannot degrade into a capability it never declared, and cannot invent capability names the schema does not know. The never-in-DEGRADED floor is defined once in docs/designs/2026-11-01-coworkspace-attach-mode-design.md §4 and cited normatively by this registry's capability enum.

### 3.5 Integrity: hash chain + root-side probe

- **Hub-local hash chain**: each `state_history` entry carries `prev_hash` (hash of the previous entry). History rewriting on a lifecycle chain is forbidden (the repair-history precedent on service tickets must NOT extend here).
- **ROOT-SIDE PROBE** (not root-side writes): the weekly health check / audit schedule gains a hub-probe step, operated by **lifecycle-manager**, which READS each hub's state file and records the observed state values + observed head hash into `docs/reports/YYYY-MM-DD-hub-probe-<hub>.md`. The root is read-only with respect to hub state — this resolves the red-team objection "root head-anchor: who writes it, under what authority?" (nobody writes to the root; the root only records what it observed).
- Probe reports follow the `docs/reports/` convention with **keep-latest-N retention per hub** (N=4) to bound accumulation.
- **Declared-vs-probed divergence** (probed state disagrees with the last declared state beyond TTL, or the observed head hash does not chain from the last probed head) **auto-forces DEGRADED** on the next declaration opportunity and files a SEV ticket. This is the named consumer action wiring the state machine to the kill criteria (§8): repeated divergence events are "new silent drift" evidence.

### 3.6 State file

`.pipeline-state/hub-<name>.state.json` in the hub repo, following the gitignored local-state convention (`.pipeline-state/` is local-only; service tickets are gitignored by the same design family). Written atomically (tmp + rename). The file holds: current bootstrap_state, current operational_state, `degraded_capabilities[]`, TTL lease expiry, `state_history[]` (hash-chained).

### 3.7 State-name collision check (ADR-0083 procedure — result recorded)

Per the ADR-0083 naming rule (vocabulary must not collide with live terminology — the "DOM vs Document Object Model" precedent, docs/adr/0083-domain-execution-graph-and-stage-axis.md:24-25), the seven new state names were checked against every live status vocabulary:

| Vocabulary | Values | Collision with the 7 new names |
|---|---|---|
| Ticket statuses (scripts/helpers/ticket-schema.ts:45) | backlog, waiting, running, review, done, failed | none |
| Ticket priorities (scripts/helpers/ticket-schema.ts:47) | low, normal, high, urgent | none |
| Variant status (scripts/validate-templates.ts:500) | stable, planned, deprecated, draft, beta | none |
| Spec statuses (scripts/spec-register.ts, SPEC_STATUSES) | draft, proposed, approved, planned, implemented, superseded, drifted, archived | none |
| variant_lifecycle current_status (docs/workspace-schema.json) | green, yellow, red | none |

**Result: PASS — no collisions.** The SCREAMING_SNAKE casing further distinguishes lifecycle states from the lowercase vocabularies. `RECOVERY` vs ticket `review` is the closest pair and is textually distinct.

## 4. hub-bootstrap contract

A new `scripts/hub-bootstrap.ts` (L0) creates a local working clone of a hub. It is **two cases, one entry point** (the red-team objection that the cases were "collapsed into one name" is resolved by making the split explicit):

### 4.1 Case split

- **remote-exists** (the body of auto-creation): the registry `hub_remote` exists → `git clone` from `hub_remote` ONLY. No auto-creation of remotes, no scaffolding in this path.
- **remote-missing** (separate explicit flow): halts and routes to a user decision + `scripts/ensure-github-repo.ts` / scaffold — the same machinery a human would drive. Never silently creates a remote from the bootstrap path.

### 4.2 Pinned approval

The user-approval prompt displays the **target hub name and the resolved commit SHA**. The SHA is pinned: the clone is verified against it after fetch (supply-chain posture per the security-expert finding that "user approves a prompt, not a pinned commit" — git had no digest-pinning precedent, unlike the docker side).

### 4.3 Mechanics

1. **Temp directory**: `Projects/.bootstrap-<name>-<pid>-<ts>`. The `gw-` namespace is FORBIDDEN for bootstrap temp dirs: `sweepOrphanedScaffolds` (services/co-workspace/src/lifecycle.ts:87-97) deletes any `gw-<12hex>` directory under Projects/ lacking a registry row at gateway boot — a bootstrap temp dir in that namespace would be destroyed mid-run.
2. **Lock**: reuses `scripts/automation-lock.ts` verbatim with key `bootstrap-<hub>`.
3. **Atomicity**: same-volume rename check (temp dir and target must share a device) then atomic move into place.
4. **Concurrency**: `ENOTEMPTY` on the rename = a concurrent claim won; the loser cleans its temp dir and exits with a pointer to the winner. This is the concurrent-claim resolution, not an error.
5. **Recovery**: a `bootstrap-state.json` recovery marker inside the temp dir records progress; a boot-time sweep removes temp dirs whose recorded PID is dead (crash recovery).
6. **Hooks stay inactive until VALIDATED** — the cloned repo's git hooks are not armed until the validation gate (§4.4) passes, so a compromised clone cannot execute hook code pre-validation.

### 4.4 VALIDATED gate (all four required)

1. gitleaks scan with explicit `--config` (workspace-owned rules);
2. hook-integrity diff vs canonical `scripts/hooks/`;
3. `bun audit` — no high/critical;
4. `bun scripts/audit.ts` green.

### 4.5 Five guarantees

| Guarantee | Mechanism |
|---|---|
| **Idempotency** | Target-exists check up front: an existing, healthy hub clone short-circuits to a no-op reporting the existing state |
| **Lock** | `automation-lock.ts` `bootstrap-<hub>` — one bootstrap per hub at a time; concurrent invocations queue or exit cleanly |
| **Atomicity** | Temp dir + same-volume rename check + atomic move; the target path never holds a partial clone |
| **Recovery** | `bootstrap-state.json` marker + boot-time sweep of dead-PID temp dirs; a crashed bootstrap leaves no residue and is re-runnable |
| **Audit** | Every phase transition (clone→verify→validate→activate) appends to the hub state file's `state_history` (hash-chained), so the audit trail survives in the same integrity domain as lifecycle state |

## 5. Delegation kanban alias schema

### 5.1 Machine-readable alias table

A separate file `docs/templates/hub-kanban-aliases.json` (referenced from this design; delivered with the common tree like other L1 docs assets) maps the delegation kanban's lane vocabulary onto the EXISTING ticket store enums — **no schema-version bump, no migration** (a migration would ripple into qa-gate, doctor, upstream-server, and ticket-run; `scripts/ticket.ts` is `@l2-propagate: false`, so the alias layer is the cross-repo substrate):

| Delegation kanban | Ticket store (canonical) | Note |
|---|---|---|
| P0 | urgent | P0 settable by USER only (§5.2) |
| P1 | high | |
| P2 | normal | |
| P3 | low | |
| queued | waiting | |
| in-progress | running | |
| accepted | review | |
| blocked | waiting (+ `blocked_reason` field) | blocked is a waiting-substate, not a new status |

SEV (incident severity, SEV1–SEV3) is a **separate ticket field**, not a priority alias, with a default P0–P3 mapping (SEV1→P0, SEV2→P1, SEV3→P2) used only for initial suggestion; the field stands alone so incident routing does not fight the priority model. The ticket store enums stay `low|normal|high|urgent` × `backlog|waiting|running|review|done|failed` (scripts/helpers/ticket-schema.ts:45,47) unchanged.

### 5.2 Priority governance

- **P0 is settable by USER only.** Agents (spoke PMs, hub PMs) can set P1–P3.
- **Spoke-initiated raises are capped at 1 level per ticket per 24h** (P3→P2 today, P2→P1 tomorrow at the earliest).
- **Violations feed the 3-strike counter** (the 2026-10-31 trust-model rule): three cap violations freeze the offending spoke's priority-raising for the hub (auto-P3 submissions) pending user review.

### 5.3 Upstream MCP extension (minimal)

- `upstream_request_status` gains `priority` in its output (read-only).
- New **read-limited** `upstream_request_reprioritize`: priority-only writes, never status/content; every change appends to the ticket's `history[]` (the existing audit trail). It cannot move tickets between stores or edit fields — the narrow surface the alias layer needs, riding the existing per-directory mkdir lock with owner token.

## 6. Variant-ization/promotion pipeline conformance (Phase 1.5)

### 6.1 Classification rules (`l3-to-variant-pipeline.ts` arm)

When the promotion pipeline classifies assets for a hub promotion wave:

| Classification | Rule |
|---|---|
| **hub-doctrine** asset | NOT copied into other variants or the template; consumers get a **consume declaration** (variant.json `consumes` entry) and read the canonical from the hub |
| **variant-identity** asset | Kept in the variant AND registered in `hub_topology` (it is identity, not doctrine — promotion must never overwrite it with a thinner copy) |
| **Generic duplicate** (same asset in ≥3 variants, no domain semantics) | **L1 commonization** per the ≥3-convergence rule (fleet report classification; WARN-soak → blocking) |
| **Unregistered asset** | Never silently dropped: a classification report goes to the PM agenda for disposition |

Phase 1 ships this as preflight/FAIL-only; the full classification transform is Phase 1.5 (the 2026-11-01 meeting's accepted change #8, protecting the Phase 1 promotion PRs from 1,712-line pipeline churn).

### 6.2 promote/create-variant preflight

`promote-variant` and `create-variant` gain a preflight gate: `consumes`/`minimum_version` declarations are mandatory for any variant declaring hub consumption, and an unregistered hub-doctrine duplication FAILs the preflight.

### 6.3 Validation case: co-architect template creation

co-architect template creation is the first exercised consumer of the pipeline conformance rules: its template starts with explicit `consumes` declarations for the design-domain assets it adopts from the co-design hub, demonstrating the declare-first pattern without inheriting any stale copies.

## 7. Versioning and operations

### 7.1 Hub asset semver

- **major** = requires consumer action (breaking change; the hub-resolve checker will fail consumers below it until they act)
- **minor** = additive, backward-compatible
- **patch** = silent sync (consumers pick it up at the next wave with no action)

### 7.2 Security-domain out-of-band SLA

Security-domain **patch** versions ship out-of-band (not waiting for the wave), with an SLA of same-week propagation to consuming spokes — a security patch sitting on a wave calendar is the SEV2 class from the 2026-10-31 incident-tier discussion.

### 7.3 Consumer pinning

Each consuming variant's `variant.json` carries `consumes[]` with `minimum_version` per hub asset; the audit.ts hub-resolve checker (§2.4 leg 3) enforces it.

### 7.4 Write discipline

- **2-writer rule**: only the hub PM adopts changes INTO the hub canonical assets. Spokes contribute via promotion PRs; a spoke PM editing hub canonicals directly is the violation class the 2-writer rule names.
- **Stale-read allowed**: a spoke may proceed on its last-synced canonical copy (availability over freshness) — the skew check reports divergence, it does not block work.
- **Pre-plan adoption amnesty-and-absorb**: when a promotion wave finds a spoke has independently improved an asset beyond the canonical (the PR #61 inverse), the wave absorbs the improvement into the canonical first (amnesty: no blame, no reversion) rather than clobbering it. Absorption is judged by the same both-directions measure as the 2026-10-27 promotion frame.

## 8. Rollback (3 axes) and kill criteria

### 8.1 Rollback axes

| Axis | Scope | Default? |
|---|---|---|
| **Topology Rollback** | Remove the `hub_topology` registry block (1 file, root + L1 pair in the same commit); validator legs stop firing; spokes keep working as today. The skew check keeps reporting as a passive report. | **DEFAULT** — the escape hatch is always available |
| **Asset Rollback** | Revert promoted asset content (per-suite, using the 2026-10-27 frame in reverse). Separate procedure, EXPLICIT decision only — never bundled with a topology rollback, because assets may be load-bearing beyond the hub program. | Explicit only |
| **Service PR Rollback** | The attach-mode change (sibling design) is a deployed co-workspace service PR: rollback = container image rollback + ADR-0092 addendum supersession (a superseding addendum, not a silent edit). | Explicit only |

### 8.2 Kill criteria (any one triggers the review; mapped actions differ)

1. **Pilot failure** — Phase 3a pilot (1 hub + 2 spokes, ticket+kanban path) misses its pre-declared success metric at Checkpoint B.
2. **≥1 new silent drift post-registry** — the scheduled drift detector (§2.4) or a probe divergence (§3.5) finds a cross-variant fork that the registry should have prevented.
3. **≥2 re-promotions of the same suite within 6 months** — the promotion frame keeps needing to fix the same suite (measures the pipeline, per the red-team's point — hence it is one criterion among four, not the only one).
4. **Adoption metric: < N delegation tickets/month after 90 days** — the channel is the finding (nobody uses it). N is set at Checkpoint B from pilot data; **proposed N=3**.

### 8.3 Kill → action mapping

| Kill scope | Action |
|---|---|
| **Session-path kill** (attach-mode demanded but pilot says self-service sessions fail security/usability bars) | Supersede Addendum 17; keep the delegation kanban + registry (they are independent); attach API image rolled back per §8.1 axis 3 |
| **Kanban kill** (adoption metric fails: nobody files delegation tickets) | Retire the alias layer + upstream MCP extension; registry and topology rollback remain available separately; the hub program's promotion value is judged on its own criteria |
| **Full sunset** (pilot failure + drift + re-promotion evidence agree the topology adds no value) | Topology Rollback (default, 1 file) + return to per-suite promotion PRs as the standing mechanism (the red-team minimal path, which remains documented in the transcripts as the fallback) |

**Non-negotiable under ANY kill**: technical-identity assets and existing project functionality are unharmed — kill actions remove declarations, alias tables, and optionally one service PR; they never revert project working trees to thinner copies (the PR #61 guarantee, learned the hard way).

## 9. Hub selection rule (fan-in, provisional)

Hubs are selected by measured **fan-in**: an asset is fan-in-qualifying when it is consumed by **≥2 other variants** (not counting its own). Measurement substrate: the skill-graph fleet report (`scripts/skill-graph-fleet-report.ts`) gains a **fanIn2 classification row** (capabilities consumed by ≥2 projects) — skills/agents fan-in IS derivable from the graph; **script fan-in is NOT** (scripts are not graph nodes — automation-engineer's verified finding), so script consumption is tracked via the registry's `consumers[]` as it is declared, not measured, in Phase 0.

- Hubs are **provisional on data**: the Phase 0 fan-in report is the evidence; if it contradicts the pinned roster, the roster is re-pinned before Phase 1 lands (the registry is data-driven, not name-driven).
- **Suite-internal depth never qualifies**: many assets within one suite consumed by variants of the same suite chain does not make a hub — only cross-suite, cross-variant consumption counts.
- co-safety and co-consult are excluded under the rule today (their asset counts are large but consumption is suite-internal); they enter only if future fleet reports show cross-suite consumption.

## 10. Glossary (the registry ADR-0098 §2.5 references)

This table is the terminology registry that ADR-0098 §2.5 ("One term, one meaning, per the workspace registries (AGENTS.md glossary roles, …)") points at. The §2.5 text currently dangles — "AGENTS.md glossary roles" does not exist as a registry. **Fixing the pointer is part of this landing** (§11.5): the follow-up task below edits the standard to cite this design's glossary; this document does not edit `docs/standards/llm-interaction-standard.md` itself.

| Term | Definition | Declared by | Normative home |
|---|---|---|---|
| Template | L0/L1 delivery SSOT instantiated into projects by scaffold/upgrade | ADR-0039 | CONSTITUTION.md layer model |
| Hub | Variant project carrying canonical shared domain assets; a delivery responsibility, not an authority | This design | §1; `hub_topology` registry |
| Spoke | Variant project consuming hub canonical assets via promotion machinery; never writes cross-repo | This design | §1 |
| Variant | A project instance of a template with its own PM, repo, and lifecycle | ADR-0039/ADR-0048 | variant.json schema |
| hub-doctrine | Asset category: canonical content owned by the hub; consumers declare consumption, never hold copies | This design | §2.3, §6.1 |
| variant-identity | Asset category: variant-specific identity asset; kept locally AND registered; promotion may not overwrite | This design | §2.3, §6.1 |
| hub-escalation | Asset category: cross-project escalation procedure content owned by the hub domain | This design | §2.3 |
| incident-escalation | Asset category: incident tiers (SEV1–3) triggerable locally without pre-authorization | This design | §2.3; 2026-10-31 synthesis item 8 |
| BOOTSTRAPPED | bootstrap_states[0]: hub cloned at pinned SHA, pre-validation | This design | §3.1 |
| VALIDATED | bootstrap_states[1]: four security checks passed, hooks may arm | This design | §3.1, §4.4 |
| READY | bootstrap_states[2]: infra verified end-to-end (says nothing about service capacity) | This design | §3.1, §3.2 |
| AVAILABLE | operational state: hub PM declares triage capacity + valid authorization registry | This design | §3.2 |
| DEGRADED | operational state: reduced capability set, governed by `degraded_capabilities[]` | This design | §3.4 |
| UNAVAILABLE | operational state: blocks new tickets + session spawns; cancels in-flight sessions | This design | §3.4; 2026-11-01 synthesis item 10 |
| RECOVERY | operational state: post-unavailability; returning to AVAILABLE requires probe re-verification | This design | §3.4 |
| state_ref | Registry pointer to hub-local state file; unresolvable from root by design | This design | §2.3 |
| TTL lease | Expiry-bounded operational declaration; stale declarations read as UNAVAILABLE | This design | §3.3 |
| attach-mode | co-workspace capability: run a session inside an existing hub repo instead of a fresh scaffold | Sibling design | docs/designs/2026-11-01-coworkspace-attach-mode-design.md §2 |
| stack-profile | Per-hub declared technology/capability profile constraining `degraded_capabilities[]` | This design | §3.4 |
| SEV | Incident severity field (SEV1–SEV3), separate from ticket priority | This design | §5.1; 2026-10-31 synthesis item 8 |
| fan-in | Count of OTHER variants consuming an asset; ≥2 qualifies for hub candidacy | This design | §9 |

**Follow-up task (owned by docs-writer, NOT executed in this design's change set)**: amend `docs/standards/llm-interaction-standard.md` §2.5 to replace the dangling "AGENTS.md glossary roles" phrase with a citation of this glossary ("the hub-consolidation design glossary, docs/designs/2026-11-01-hub-consolidation-design.md §10, plus the skill/script name registries"), keeping the sentence's original intent. One-sentence amendment; lands with this design's implementation PR.

## 11. ADR compatibility and precedent

### 11.1 ADR compatibility

| ADR | Relationship |
|---|---|
| **ADR-0039** (L0→L1→L2 hierarchy and extends) | L0 specialists and assets do not propagate into variants; hub promotion is **L2→L2 asset promotion** — the registry records it, the 2026-10-27 frame executes it; no new propagation domain is created |
| **ADR-0040** (L0→L1 deployment strategy) | The L1 workspace-schema copy is hand-maintained (existing DEC-20261028-05 posture); this design adds a section to that pair, reconciled same-commit |
| **ADR-0048** (variant PM architecture; AGENTS.md as workflow SSOT) | Hub/spoke workflow duties are declared in the affected variants' AGENTS.md via pointer-style additions only |
| **ADR-0090** (thin dispatcher) | AGENTS.md additions are pointer-style ONLY — the size budget already overflows; no normative body text lands in any AGENTS.md from this design |
| **ADR-0097** (supported-surface registry) | New hub surfaces (probe reports, the alias JSON, the hub-resolve checker output) are registered in the supported-surfaces registry at implementation time |

### 11.2 Precedent citations

- **2026-05-27 CONSTITUTION.md hub-and-spoke restructure proposal** — ⚠️ Unverified: local archive only (memory/MEMORY.md:139, marked "archived — local only"). Cited as prior art for the topology idea; no claim in this design depends on its content.
- **2026-08-29 hub↔spoke checker obligation** (docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md:166-168, "future") — **DEFERRED, not fulfilled**: the CONSTITUTION hub↔spoke heading-summary checker was never implemented (audit.ts checks one direction only). This design's validator legs (§2.4) do not fulfill it either; it remains a separate deferred item, unaffected.
- **2026-10-27 co-design suite promotion design** (status: implemented) — **adopted** as the per-suite promotion mechanism for Phase 1's three promotion PRs and as the both-directions measure reused by the amnesty-and-absorb procedure (§7.4).

### 11.3 Forward pointer — N2-exception ADR

The N2-exception ADR (ratifying the hub-program exception under the ≥3-convergence rule with pre-declared success metric and 90-day auto-expiry) is written **only after pilot success** (2026-10-31 synthesis item 5). It does not exist yet; when written it must carry an "Amends" header relationship to this design's registry section. This design creates no exception; it creates the registry that makes the exception measurable.

### 11.4 De-confliction note vs docs/designs/2026-10-31-variant-generators-design.md

Same-day design; surfaces are disjoint and the interaction points are declared:

1. **Different concern**: the generators design covers project-authored regeneration of derived projections inside ONE project's `/sync` (scripts/<variant>/generators.json, dev-sync step). This design covers CROSS-variant asset ownership (registry, promotion, lifecycle). Nothing in this design adds or modifies a dev-sync step.
2. **Both add validate-templates.ts arms — independent**: the generators design's arm fires only when a variant template's generators.json exists; this design's arms fire only on `hub_topology` content. No shared code paths, no ordering dependency.
3. **hub-promotion.ts is a new script**, not part of the generator-manifest loader family; it consumes registry entries, not generators.json.
4. **co-newbiz appears in both, on different planes**: excluded from the hub roster here (§1) while remaining the first generators.json adopter there — roster membership and pipeline capability are orthogonal; no reconciliation needed.

### 11.5 Landing note

The §2.5 pointer fix (§10 follow-up) and the AGENTS.md pointer-style additions (§11.1) are **specified here, executed by docs-writer in the implementation change set** — this design's own change set contains only this document (plus its registry entry).

## 12. Phasing summary (v7 execution model)

This document and docs/designs/2026-11-01-coworkspace-attach-mode-design.md are the **Phase 0 deliverables**.

| Phase | Content | Gate |
|---|---|---|
| **0** (now) | Meeting minutes; this design + attach-mode design (spec-registered); ADR-0092 Addendum 17 draft; fan-in measurement (fleet report fanIn2 row data); sync-variant-settings VARIANTS hardcode fix | ADR-0074 Design Gate satisfied for Phase 1 landings |
| **1** | `hub_topology` registry (root + L1 same-commit) + validator legs; hub-promotion.ts (suite-atomic); bootstrap skeleton; **3 per-suite promotion PRs** using the 2026-10-27 frame | Preflight/FAIL-only pipeline classification |
| **1.5** | Pipeline classification transform; reconciliation wave (security-suite semantic merge with parameterization BEFORE promotion); co-architect template creation (§6.3 validation case); script fan-in graphs | Convergence WARN-soak → blocking |
| **Checkpoint A** | User review of registry + promotion PR outcomes before Phase 2 | user |
| **2** | project-resync wave with per-repo dry-run gates (Phase 2 rides existing fleet tooling; never a batched push) | per-repo dry-run green |
| **Checkpoint B** | Adoption evidence review; sets N (§8.2); go/no-go for 3b | user |
| **3a** | Delegation pilot: ticket+kanban alias layer live, 1 hub + 2 spokes | pilot success metric |
| **3b** | co-workspace attach-mode implementation (sibling design) + Addendum 17 landing | behind Checkpoint B |
| **3 (common)** | Delegation runtime common items: docs/guides/hub-operator-guide.md; probe report cadence steady-state | — |
| **3.5** | **Hub auto-creation** (delegate-to-hub target absent): delegate-to-hub pre-checks (hub existence / `.git` / variant.json / template-version); user-approved clone from registry `hub_remote` with SHA pinning — remote-exists = the body case, remote-missing = separate user-decision flow (§4.1); `scripts/hub-bootstrap.ts` five guarantees (§4.5); VALIDATED 4-check gate with hooks inactive (§4.4); state transitions BOOTSTRAPPED→VALIDATED→READY (§3.1) | bootstrap VALIDATED gate green |
| **4** | N2-exception ADR (post-pilot only, §11.3); full formalization review | user |

## 13. Accessibility and Preview exemption statement

All artifacts specified by this design (registry section, validator legs, bootstrap script, alias JSON, MCP extension, pipeline rules) are non-UI backend/governance work: **exempt** from ADR-0065 accessibility sections and ADR-0070 preview-verification sections. The Phase 3 operator guide carries its own accessibility review at that phase (it is a docs surface, and verify-readme-sync bilingual parity applies if a KO edition is cut).

## 14. Verification — what proves this design

1. **Fan-in report exists and is data-bearing**: the skill-graph fleet report fanIn2 classification produces the consumption table that justifies ( or re-pins) the 3-hub roster before Phase 1.
2. **Registry validator legs green**: after the Phase 1 registry lands, `bun scripts/validate-templates.ts` passes with the hub_topology legs active, and a deliberately seeded unregistered duplication + a below-minimum consumer each FAIL (negative tests).
3. **State-name collision check recorded** — done in this document (§3.7, PASS) per the ADR-0083 procedure; re-run if any new status vocabulary joins the workspace.
4. **Spec entries registered**: both this design and the attach-mode design appear in docs/specs/registry.json with status `planned` and matching docs/specs/entries/ files, in canonical id order.
5. **Bootstrap five guarantees** each have a test at implementation time (idempotent re-run, lock contention, atomic-move failure injection, dead-PID sweep, state_history audit rows).

## References

- memory/meeting-2026-10-31-hub-spoke-consolidation-review.md — first meeting: 12-item synthesis, user decisions, hub=delivery-responsibility principle, fan-in rule
- memory/meeting-2026-11-01-v6-baseline-review.md — second meeting: verified code anchors, synthesis items 1–11, preserved red-team dissent
- docs/designs/2026-10-27-co-design-suite-promotion-design.md — ratified per-suite promotion frame
- docs/designs/2026-10-31-variant-generators-design.md — same-day design (§11.4 de-confliction)
- docs/designs/2026-11-01-coworkspace-attach-mode-design.md — sibling design (attach-mode)
- scripts/validate-templates.ts:1240-1257, :3117 — hash-parity gate + canonicalization
- scripts/helpers/ticket-schema.ts:45,47 — ticket status/priority enums (unchanged)
- scripts/validators/duplicate-validator.ts — designated scheduled drift detector
- scripts/automation-lock.ts, scripts/ensure-github-repo.ts — bootstrap lock + remote-missing flow
- scripts/skill-graph-fleet-report.ts — fan-in measurement substrate
- services/co-workspace/src/lifecycle.ts:87-97 — sweepOrphanedScaffolds (gw- namespace constraint)
- docs/adr/0039, 0040, 0048, 0090, 0092, 0097 — compatibility set (§11.1)
- docs/adr/0083-domain-execution-graph-and-stage-axis.md:24-25 — naming-rule precedent for the collision check
- docs/standards/llm-interaction-standard.md:97-99 — §2.5 dangling pointer this glossary resolves (amendment owned by docs-writer)
