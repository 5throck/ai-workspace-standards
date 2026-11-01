# Authorization Registry — Hub-Delegated Security Engagements

**Version**: 1.0.0
**Last updated**: 2026-11-02
**Design**: `docs/designs/2026-11-01-hub-consolidation-design.md` (§3.2 AVAILABLE state, §5 delegation kanban)
**Consumer**: `verify-authorization` skill (Authorization Registry Check) and `delegate-to-hub` skill (Authorization Gate)

> **Template note**: This is the template copy maintained in `templates/co-security`.
> Scaffolded co-security projects receive it at `docs/authorization-registry.md` on the
> next delivery wave. The engagement record for the seeded row lives in the deployed
> workspace at `Projects/co-security/docs/authorization.md`; consult it there when a
> template-local path does not resolve.

## Purpose

One row per authorized engagement for hub-delegated security work. When a spoke
project delegates a security task to the co-security hub via a delegation ticket,
the ticket MUST cite a registry row (`AUTH-YYYY-NNN`) from this file, and the
`verify-authorization` skill MUST validate that row before any Phase 1+ activity.

**Row-addition authority (normative)**: THE USER is the ONLY authority who can add
rows to this registry. Neither the hub PM nor any agent may self-attest, self-issue,
or renew an engagement row. An agent-drafted row without explicit user direction is
invalid and MUST be treated as a missing row by every consumer of this registry.
This mirrors the P0-user-only priority rule of the delegation kanban
(design §5.2): authorization and urgency both terminate at the user.

## Registry

| Registry ID | Requesting project | Scope targets | Window (start → end) | Signatory | Status | Notes |
|-------------|--------------------|---------------|----------------------|-----------|--------|-------|
| AUTH-2026-001 | co-security (hub, direct engagement — 5throck / BizKnights) | `assessment.bizknights.org` (domain / web application; subpaths served by this hostname only; resolved IPs in scope only insofar as they serve this application) | 2026-09-01 → 2026-09-30 (KST) | SungHyuk Park, Partner — authorization ref 2026-09-01 | expired | Historical record of the 2026-09 BIZKNIGHTS engagement; full authorization document: `Projects/co-security/docs/authorization.md`. Window has elapsed — kept as record, not as live authorization. |

**Status vocabulary**: `active` (window includes today's date), `expired` (window
has elapsed), `revoked` (withdrawn by the user or signatory before expiry). Status
is descriptive bookkeeping — the binding check is always the window-vs-today
comparison performed by `verify-authorization`, never this column alone.

## Validation Rules (normative)

Enforced by the `verify-authorization` skill before any hub-delegated engagement
begins (design §3.2: the hub is AVAILABLE only when the authorization registry is
valid — window-current, project-matched, non-empty user rows):

1. **Registry-row reference required**: a delegation ticket in the security domain
   MUST cite an existing `AUTH-YYYY-NNN` row from this registry. A ticket without a
   row reference is refused.
2. **Expiry check**: the row's window end MUST be ≥ today's date. An expired window
   is a FAIL, and the failure output MUST show today's date alongside the window.
3. **Requesting-project match**: the delegation ticket's requesting project MUST
   match the row's Requesting-project column. A mismatch is a FAIL.
4. **No-row refusal**: if no registry row exists for the requested engagement, the
   delegation is refused outright. Absence of a row is never remediated by the hub
   PM drafting one — the correct path is the user adding a row (see Row-addition
   authority above).
5. **User-only row addition**: rows are added (and existing rows renewed or revoked)
   by the USER only. Agent-originated rows are invalid regardless of content.

## Supersession Note

The legacy ⚠️ TODO rows in `docs/authorization.md` (out-of-scope confirmation,
testing-team contact) are **superseded by this registry for engagement
authorization**: the binding authorization decision for hub-delegated work is a
registry row, not the per-engagement document's TODO state. The old document
remains in place as the engagement RECORD (signed authorization text, rules of
engagement, emergency contacts) and its TODO items must still be resolved with the
authorizing party as part of any future re-engagement — but they no longer gate
registry-level authorization decisions.

## Related Documents

- `Projects/co-security/docs/authorization.md` — per-engagement authorization record (seed-row source)
- `docs/designs/2026-11-01-hub-consolidation-design.md` — hub-and-spoke design (§3.2, §5)
- `skills/verify-authorization/SKILL.md` — enforcement procedure
- `templates/common/skills/delegate-to-hub/SKILL.md` — delegation-ticket filing procedure
