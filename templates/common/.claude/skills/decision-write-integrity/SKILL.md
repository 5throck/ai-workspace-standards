---
name: decision-write-integrity
version: 1.0.0
description: >
  Process guidance for designing and operating integrity gates around human
  decision writes — any governed record where a named human decision changes
  state: approvals, ticket transitions, ADR acceptances, waivers, sign-offs,
  state transitions. Covers the HARD BLOCK / ACK / DISPLAY enforcement
  taxonomy, off|shadow|enforce staged rollout, server-recomputed
  snapshot-hash propose-then-confirm flow (409 on stale), deterministic
  script-aware rationale substance checks, maker/checker countersign with
  deny-by-default grants, and AI-recommendation divergence recording.
  Use when: designing or reviewing a decision-write gate, planning a gate
  rollout, hardening an approval path, or making human decisions auditable.
status: active
scope: common
l2_propagate: false
owner: pm
last_updated: 2026-10-28
last_reviewed: 2026-10-28
prerequisites: []
relates_to:
  - skill: meeting-facilitation
    type: relates_to
metadata:
  type: process
  triggers:
    - decision write integrity
    - gate integrity
    - approval gate
    - hard block
    - maker checker
    - countersign
    - snapshot hash
    - decision audit
---

# decision-write-integrity

Process skill for designing and operating **integrity gates around human
decision writes** — any governed record where a named human decision changes
state: gate approvals, ticket transitions, ADR acceptances, waivers,
sign-offs. Distilled from the gate-integrity pattern proven in
Projects/co-newbiz (ADR-0186); domain-neutral by design.

The problem it solves: a decision-write path that records whatever a person
types — unconditioned approvals, one-character rationales, self-approval,
no second-person check, no record of what was known at decision time —
produces an audit trail that cannot be trusted or replayed.

## Non-Negotiable Principles

1. **The system never decides.** Gates make conflicts un-skippable and
   permanent; they never choose the outcome or silently veto a human
   decision. A stop decision (reject, hold, kill, withdraw) is never blocked
   by any gate rule.
2. **Hard block only what policy already binds, or what is mechanical
   record hygiene.** Everything involving judgement about the substance
   stays an acknowledgement.
3. **The server recomputes.** The client never supplies compliance state;
   it supplies acknowledgements plus the hash of what it saw.
4. **Snapshot beside the decision.** What was known at decision time is
   stored with the decision — append-only, immutable.
5. **Write-time only.** No already-recorded decision is rewritten or
   invalidated; legacy rows get a label, never a rewrite.

## Enforcement Taxonomy

| Class | Behavior | Use when | Examples |
|---|---|---|---|
| HARD BLOCK | write refused (HTTP 409/422/403) with a stable error code | a governing policy clause already makes the condition binding, or the check is mechanical hygiene with no judgement in it | missing prerequisite state; non-waivable item incomplete; mandatory numeric assumption never human-confirmed; same-person countersign |
| ACK | write accepted only when the recorder explicitly acknowledges each listed item with a substantive reason | the signal involves judgement; the system must not decide, but the conflict must not be skippable | red risk grade; unassessed predicate; open non-waivable item |
| DISPLAY | shown on the brief/panel and stored in the snapshot; no input required | the fact should be visible but demands nothing | data-confidence cap; active waivers; inert rule count |

Rules:

- ACK items carry stable keys (e.g. `predicate:<id>`); the server computes
  the required set — a missing key returns 422 listing the keys, and extra
  or unknown keys are rejected.
- One acknowledgement reason may cover a group of related items, but one
  record per item is stored.
- Silence is never read as pass.

## Staged Rollout (off | shadow | enforce)

Gate every rule family (rationale, snapshot/ack, binding predicates,
sequence ladder, maker/checker, waivers, divergence) behind its own flag:

| Mode | Behavior |
|---|---|
| off | rules dormant; unit-test default |
| shadow | server computes and logs what it would block or require (`would_block:<code>`, de-duplicated per entity, gate, code, day); production default |
| enforce | rules bind |

Flip discipline:

- Production starts in shadow for every family; flip family by family.
- Flip only after a soak window (e.g. 14 or more days in shadow, 10 or more
  observed writes, zero unexplained would-block events), recorded per family
  in a runbook.
- Enforce order: mechanical hygiene first; rules that need a second
  provisioned human (maker/checker) last.
- Rollback is setting the family to off. Schema stays additive — no
  migration rollback is needed for behavior.

## Propose-Then-Confirm Snapshot Flow

1. **Propose** — agent or client submits the decision draft. The proposal
   carries NO human-only fields (no snapshot hash, no acknowledgements);
   the payload validator rejects them outright so no agent can
   pre-acknowledge.
2. **Confirm GET** — the human's confirm view requests a fresh snapshot.
   The server recomputes all gate state (never trusts the client) and
   returns the snapshot plus a `snapshot_hash` (SHA-256 over canonical
   JSON: sorted keys, fixed number format, stable element ordering,
   volatile fields excluded).
3. **Confirm POST** — the human submits `snapshot_hash` plus
   `acknowledgements[]`, each `{key, kind, reason}`.
4. **Server verify** — recompute at write time; a changed hash returns
   **409 snapshot_stale** with the fresh snapshot for re-review. Then
   evaluate hard blocks in a defined order (first failure wins, all
   failures listed), then the `ack_required` check.
5. **Persist atomically** — snapshot, decision, acknowledgements,
   dependent records, and the audit entry in one transaction. Snapshot
   rows are append-only (no UPDATE/DELETE path in code; a trigger forbids
   both).
6. **Every outcome snapshots** — not only approvals; a stop decision still
   records what was known.

The snapshot stores, at minimum: binding-predicate outcomes (triggered /
unassessed / passed, plus the inert count), risk-grade state and any
data-confidence cap, completeness-check state, confirmation state of
mandatory numeric assumptions, active and expiring waivers, open tracked
conditions, prerequisite/sequence state, and the AI recommendation.

## Rationale Substance Checks

Deterministic, script-aware, no model call. The check judges **form, not
merit** — whether the reasoning is good stays a human matter.

- Normalize (Unicode NFKC, trim), then apply per profile:
  - decision profile — minimum letter/digit and token floors tuned per
    dominant script (e.g. Latin: 20+ characters, 4+ words; Hangul: 12+
    syllables, 3+ space-separated units); mixed text is judged by its
    dominant script.
  - acknowledgement profile — smaller floors (e.g. 12+ characters,
    3+ tokens).
- Reject: a placeholder denylist (case-folded, ending-normalized,
  multilingual), repetitive runs (one character or syllable over 70
  percent of letters), degenerate fragments, and rationales identical
  (normalized) to another gate's rationale on the same entity.
- Return stable reason codes (`too_short`, `placeholder`, `repetitive`,
  ...); the UI renders localized catalog text; no hard-coded message
  strings.
- Existing rows are never re-checked or rewritten.

## Maker/Checker Countersign

For high-authority decisions (final approvals), the recorder (maker) cannot
approve their own record:

- State: `recorded` -> `pending_countersign` -> `effective`. A pending
  countersign counts as NOT given for all downstream gating (sequence
  ladder, closing, dependencies). Stop decisions take effect immediately —
  no countersign is needed to stop.
- The countersign comes from a different authenticated human holding the
  matching reviewer role; same-person countersign is a 403.
- A checker rejection leaves the maker's record non-effective and puts the
  disagreement on the record (both rows retained); the maker may record a
  new decision.
- **Deny-by-default grants**: an absent or revoked grant means 403 on the
  countersign/approve/clear/override routes only — it changes nothing
  elsewhere. Grants are dated, revocable, admin-issued. Nobody grants
  themselves a role, and agents, MCP calls, and bearer tokens never
  exercise grants (cookie-session humans only).
- Re-read the grant inside the write transaction — a revocation in flight
  invalidates a pending countersign.

## Waiver and Exception Hygiene

- Approval is a separate authenticated act — never a free-text name in the
  request body. Approver differs from requester and must hold the matching
  role (403 otherwise).
- Bounded duration (e.g. 90 days maximum from approval — hard-block a
  longer expiry); no automatic extension; a renewal is a new request. A
  waiver without a recorded approval timestamp never takes effect.
- Non-waivable items refuse waiver requests outright (422).
- Exceptions attached to a conditional approval become tracked objects
  (condition precedent): text, owner role, clear-by milestone, status.
  Clearing requires a different eligible person plus evidence. Open
  conditions block the downstream stage they target.

## AI-Recommendation Divergence Recording

- Persist the AI recommendation (recommended decision, confidence,
  generation reference) beside the human decision, with a link from the
  decision to its brief.
- If a recommendation exists and differs from the human decision, a
  divergence reason meeting the decision rationale profile is required
  (422 otherwise). If no brief was generated, store "none" and require
  nothing.
- The system never changes the human decision. Divergence counts feed
  governance KPIs and base-rate learning — display only; no rate triggers
  any block.

## Design and Operate Checklists

Designing a gate:

- [ ] Classify every rule HARD BLOCK / ACK / DISPLAY against principle 2
- [ ] Stable error codes, defined evaluation order, all failures listed
- [ ] Stop decisions never blocked; every outcome gets a snapshot
- [ ] Flags per family; shadow before enforce; soak criteria written down
- [ ] Grants deny-by-default; agents hold none; second human provisioned
      before maker/checker flips to enforce

Operating a gate:

- [ ] Weekly shadow report; zero unexplained would-blocks before any flip
- [ ] KPIs: acknowledgement counts, unassessed share, divergence rate,
      countersign latency, stale open conditions
- [ ] Legacy rows labelled, never rewritten; audit events for every
      control action (grant issue/revoke, countersign, override, clear)

## Anti-Patterns

- Hard-blocking judgement calls (risk grades, unassessed items) — the
  system would decide.
- Client-supplied compliance state — the recorder self-certifies.
- LLM-judged rationale quality — unreproducible; a deterministic form
  check is the gate rule, and model review stays decision support.
- Silently averaging disagreement — checker rejection and AI divergence
  stay on the record verbatim.
- Bypasses for single-owner deployments — a bypass voids the control;
  provision a second human instead.

## Related Skills

- `meeting-facilitation` — same philosophy one step upstream: synthesized
  meeting outcomes are PROPOSALS for human approval, never decisions.

## References (provenance)

Distilled from the co-newbiz gate-integrity pattern (merged PR #743):

- Projects/co-newbiz/docs/adr/0186-gate-integrity.md — enforcement classes
  (D1), rationale check (D2), ladder (D7), maker/checker (D6), divergence
  (D9), owner decisions.
- Projects/co-newbiz/docs/designs/2026-10-26-gate-integrity-design.md —
  contracts (3.1-3.16), rollout (section 7), security (3.14).

Generalized here: the enforcement taxonomy, staged rollout, snapshot-hash
flow, rationale profiles (per-script thresholds), grant model, and
divergence recording. Project-specific and intentionally NOT carried:
individual predicates, discount-rate semantics, track ladders, and policy
clause numbering.
