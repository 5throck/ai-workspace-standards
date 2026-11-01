---
status: Accepted
date: 2026-11-02
author: architect
---

# ADR-0103: The Hub-and-Spoke Delegation Channel Is a Narrow, Auto-Expiring Exception to the Upstream-Design N2 Constraint

## Context

The upstream-request MCP design (`docs/designs/2026-10-01-upstream-request-mcp-design.md`,
non-goal **N2**) fixed the direction of cross-project communication: "This is not a
general cross-project messaging bus. Requests flow one way (project to root PM) plus
a status read-back." The v6 hub-and-spoke baseline introduces a channel that crosses
that line: a spoke PM files a **delegation ticket** that a hub PM (another project's
PM, not the workspace-root PM) triages and executes.

At the 2026-11-01 v6 baseline review (`memory/meeting-2026-11-01-v6-baseline-review.md`),
the red-team seat objected that the baseline "pre-builds the end-state the pilot was
supposed to justify": an N2-crossing channel was being specified at production grade
with zero recorded usage. The meeting's agreed discipline for this specific objection:
the exception is written up as its own ADR **AFTER** the pilot, with a pre-declared
success metric and a 90-day auto-expiry — the ADR exists to keep the exception narrow
and falsifiable, not to launder scope inflation.

Phase 3a then ran: the kanban core (PR #1808), the delegation contract (PR #1809),
and the hub operator guide (PR #1810) landed, and the pilot E2E drill completed
(`tickets/governance/T-20261102-001.yaml`, spoke `co-develop` → hub `co-security`).
The pilot proved the **enforcement** layer live: the authorization gate double-aborts
(an expired `AUTH-2026-001` row AND a project mismatch, nothing filed), a P0 raise
from a spoke PM is refused live, the +1-level-per-24h cap is refused live, the
3-strike counter fires, the SEV1 human-bypass path works (positive and negative),
transition guards hold, and zero manual ticket copying was needed. It did **not**
prove adoption — the drill was synthetic.

Three pilot findings are recorded here because they shape the decision:

- **F1** — `scripts/ticket.ts` resolves its store from `import.meta.dir`; the
  workspace-ROOT store is the de-facto delegation substrate, and hub-local ticket
  stores are not built.
- **F2** — the authorization registry is not yet delivered to deployed hubs
  (`docs/authorization-registry.md` rows are authored at the root; hub copies lag).
- **F3** — there is no MCP read-back surface for `T-*` delegation tickets
  (`upstream_request_status` covers `U-*` only), so spokes cannot check their own
  ticket's status remotely.

## Decision

1. **The hub-and-spoke delegation channel is an AUTHORIZED narrow exception to N2.**
   N2's rule ("one-way project→root; no general cross-project messaging bus")
   stands everywhere else; this ADR carves out exactly one path: a spoke PM files a
   delegation ticket, and the hub PM triages and executes it under the kanban
   governance of the hub-consolidation design (Phase 3a).
2. **Scope is TICKET-PATH delegation ONLY.** Interactive session delegation
   (co-workspace attach-mode — a spoke session running inside the hub repo) is
   EXPLICITLY OUT OF SCOPE of this exception. Attach-mode requires its own future
   ADR, gated on adoption evidence (Phase 3b, behind its own demand trigger per
   the design's Checkpoint B). Nothing in this ADR relaxes the Addendum 17 /
   attach-mode gating.
3. **The narrow scoping is what keeps this inside the red-team's discipline** (see
   Status): the exception is one ticket file convention on an already-gated store,
   not a new service capability, not a new identity class, and not a trust-boundary
   change.

## Store topology (F1 resolution)

- **The delegation-ticket store IS the workspace-root `tickets/` store** — the
  existing single store. There is no per-hub local store, no new wiring, and no
  schema migration. Hub-routing is expressed through ticket metadata (hub/domain
  conventions, including the existing `kind: manual` governance-ticket machinery),
  not by store topology.
- **Rationale**: zero new wiring; a single audit surface (git-tracked
  `tickets/governance/`, gitignored service tickets per the existing split); and
  the intake/triage/cap gates already enforce against this store — the pilot
  exercised them live against the root store, so the proven configuration is
  exactly this one.
- **Evolution path (explicitly non-normative)**: hub-local stores MAY be introduced
  later if ticket volume or isolation requirements demand it. That is a future
  design that AMENDS this ADR; until such an amendment lands, the root store is
  the substrate and any per-hub store is a defect, not a feature.
- **Errata note**: the hub-consolidation material describes filing "in the hub
  repo's ticket store (not the spoke's)" — that phrasing appears in the operator
  guide (`docs/guides/hub-operator-guide.md` §2.4, "Filing") and reads as a
  per-hub store. Read it as: file into the delegation-ticket store serving the hub
  — which, per this ADR, is the workspace-root `tickets/` store reached from the
  hub checkout. The design doc itself specifies the alias layer over the EXISTING
  ticket-store enums (design §5) and is consistent with the root-store substrate.
  The operator guide is corrected on its next doc wave; this ADR is the SSOT for
  the store topology in the meantime.

## Success metric and adoption gate (normative)

The channel's continuation is judged on **real usage**, per the design's kill
criterion 4 ("Adoption metric: < N delegation tickets/month after 90 days — the
channel is the finding"; proposed N=3 at design time):

- **Metric**: ≥ **3** delegation tickets per month, averaged over the first 90 days
  after this ADR lands on `main`. N=3 is fixed here (no Checkpoint B re-litigation:
  the pilot generated no adoption data to set it from, so the design's proposal
  stands).
- **What the pilot counts for**: nothing toward the metric. The pilot was a
  synthetic drill; it validated enforcement, not adoption. The 90-day clock starts
  at merge of the PR carrying this ADR.
- Counter examples that do NOT satisfy the metric: drill/rehearsal tickets, test
  fixtures, and re-filings of the same request.

## Auto-expiry (normative)

> **This exception expires 90 days after the date this ADR is merged to `main`
> (the merge commit date of the PR carrying it), UNLESS at expiry (a) the adoption
> metric above is met, or (b) the user explicitly renews it.** On expiry without
> renewal: delegation tickets route back through the standard upstream-request
> path (N2 restored for this path; §3.12 of the PM gateway workflow applies), the
> spoke caps and strike counter lapse with the channel, and the kanban alias
> layer plus the reprioritize governance REMAIN — they are store-internal
> features of the existing ticket store, not the channel exception, and expire
> only under the design's own Kanban kill criterion if ever.

If merged on 2026-11-02, the expiry date is 2027-01-31. The adoption review at
expiry is a Checkpoint-B-style review owned by the PM; the reviewer computes the
metric from the delegation tickets' `created_at` fields in the root store (no new
instrumentation required — the store is the counter, which is a direct benefit of
the F1 resolution).

## Known gaps at approval (recorded, non-blocking)

- **F2 — authorization-registry delivery to deployed hubs.** Hub-local
  `docs/authorization-registry.md` copies are not yet provisioned; the authorization
  gate in the pilot ran against the root-authored registry. Resolves on the next
  upgrade/delivery wave; until then, the gate's negative-test behavior (double
  abort on expired/mismatched rows) is conservative and safe.
- **F3 — no `T-*` MCP read-back surface.** `upstream_request_status` covers `U-*`
  tickets only; a spoke cannot check its delegation ticket's status remotely. This
  is required before spokes get status visibility and is tracked as follow-up work,
  with the ticket-path pilot artifacts (T-20261102-001 plus its reprioritize/
  transition history) as the evidence base for scoping it.

## Governance

- **Gates are unchanged and pilot-proven**: P0 user-only; 24h / +1-level spoke
  priority cap; 3-strike auto-freeze (`.pipeline-state/hub-reprioritize-strikes.json`,
  written by `scripts/helpers/reprioritize.ts`); SEV tiers with SEV1-only human-bypass;
  authorization-registry rows are user-only writes.
- **Anti-abuse**: the 3-strike counter and the workspace's existing three-identical-
  denials rule (AGENTS.md §7) both apply to channel usage; a spoke that games the
  caps loses the channel, not just the raise.
- **PM-gateway surface**: the delegation channel is documented for operators in
  `docs/guides/hub-operator-guide.md` and for governance in
  `docs/governance/agents/pm-gateway-workflow.md` §3.13.

## Consequences

- **Positive**: the red-team's precedent objection is discharged by a written,
  falsifiable exception instead of silent N2 drift; the enforcement layer the
  pilot validated is given a lawful home with a hard sunset; adoption is measured
  by the store itself (no new instrumentation).
- **Cost**: one review cycle at day 90 (adoption review); the operator guide's
  store wording waits for its next doc wave to be corrected; F2/F3 remain open
  follow-ups.
- **Neutral**: N2 itself is unamended — the upstream-request MCP design doc and the
  hub-consolidation design doc are intentionally NOT edited by this ADR; the
  exception and its errata live here.

## Accessibility Impact

No accessibility impact — governance/ticketing channel change, no UI (ADR-0065/0070
posture; CLI output remains plain text).

## References

- Upstream constraint: `docs/designs/2026-10-01-upstream-request-mcp-design.md`
  (§2 Non-Goals, N2)
- Hub program: `docs/designs/2026-11-01-hub-consolidation-design.md` (Phase 3a,
  kanban alias layer §5, kill criteria §8.2 item 4, kill→action mapping §8.3)
- Operator guide: `docs/guides/hub-operator-guide.md` (§2 filing, §3 triage and
  reprioritize; §2.4 store wording subject to the errata above)
- Red-team objection and agreed discipline:
  `memory/meeting-2026-11-01-v6-baseline-review.md` (auditor position, objections
  1–6, "What would change my mind", Minimal Path; synthesis items 3, 9)
- Pilot artifacts: `tickets/governance/T-20261102-001.yaml` (drill ticket with
  full transition + reprioritize history, result field recording F1),
  `tickets/governance/U-20261102-001.yaml`, `U-20261102-002.yaml` (authorization-
  gate negative-path evidence); strike ledger `.pipeline-state/hub-reprioritize-strikes.json`
  (gitignored local state)
- Governance surface: `docs/governance/agents/pm-gateway-workflow.md` §3.13
