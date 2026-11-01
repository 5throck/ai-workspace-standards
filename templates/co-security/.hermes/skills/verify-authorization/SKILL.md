---
name: verify-authorization
scope: co-security
description: >
  Hard gate: confirms a signed authorization document exists and contains all required fields
  before allowing any Phase 1+ (recon, exploitation, patching) activity to proceed.
  BLOCKS work if authorization is missing or incomplete.
version: 1.1.0
last_reviewed: 2026-11-02
status: active
owner: pm
prerequisites: engagement scoping complete — docs/scope.md must exist
relates_to:
  - skill: stride-threat-matrix
    type: follows
---

# 🔒 Skill: verify-authorization

## Context

This skill is the mandatory pre-flight gate for all offensive and remediation activity.
It is invoked automatically by the PM before dispatching any Phase 1+ agent.
No PoC, recon, or patch activity may begin until this skill returns PASS.

## When to Use

- PM Agent dispatches automatically before any Phase 1+ agent (recon, exploitation, patching)
- User attempts to start penetration testing activity without confirmed authorization
- Re-check required after authorization documents are updated or engagement window changes

## Execution Steps

1. **Check for authorization document**
   Look for `docs/authorization.md` or `docs/auth/authorization.md`.
   If neither exists → **BLOCKED ❌** — "No authorization document found. Run engagement-scoping first."

2. **Validate required fields**
   Read the authorization document and confirm ALL of the following fields are present and non-empty:
   - `Authorizing Party` (name, title, organization)
   - `Engagement Start Date` and `End Date`
   - `In-Scope Targets` (at least one IP/CIDR/domain/application listed)
   - `Out-of-Scope Items` (explicit list or "None — all targets in scope")
   - `Rules of Engagement` (approved and prohibited techniques)
   - `Emergency Contact` (name and contact method)
   - `Authorized Signature` or `Authorization Reference Number`

   **M-03 Requirement (2nd review meeting)**: Additionally validate:
   - Signature date must be ≤ engagement start date
   - Signatory title must carry authorization authority

   If any field is missing → **BLOCKED ❌** — list the specific missing fields.

3. **Check scope document**
   Confirm `docs/scope.md` exists.
   If missing → **BLOCKED ❌** — "Scope document not found. Run engagement-scoping to generate docs/scope.md."

4. **Check engagement window**
   If authorization document includes start/end dates, compare against today's date.
   If today is outside the authorized window → **BLOCKED ❌** — state the authorization window and current date.

5. **Return result**
   - All checks pass → **PASS ✅** — "Authorization confirmed. Engagement window active. Phase N may proceed."
   - Any check fails → **BLOCKED ❌** — list all failures. Do NOT proceed to Phase 1+.

## Authorization Registry Check (Hub-Delegated Engagements)

Normative for hub-delegated security work (design: `docs/designs/2026-11-01-hub-consolidation-design.md` §3.2 — the hub is AVAILABLE only when the authorization registry is valid). Before any delegated engagement begins, this skill MUST resolve the `AUTH-YYYY-NNN` row cited by the delegation ticket in the hub's `docs/authorization-registry.md` and enforce ALL three rules:

1. **Expiry check**: the row's window end MUST be ≥ today's date. If the window is expired → **FAIL ❌** — show the row's window AND today's date side by side.
2. **Requesting-project match**: the delegation ticket's requesting project MUST match the row's Requesting-project column. If it does not → **FAIL ❌** — state both the ticket's project and the row's project.
3. **No-registry-row refusal**: if the cited row does not exist (or the ticket cites no row at all) → **FAIL ❌** — the delegation is refused outright. A missing row is NEVER remediated by drafting one: row addition is USER-only (the hub PM cannot self-attest). Direct the requester to the user to add the row.

A row that fails any of the three rules blocks Phase 1+ dispatch exactly like a failed document check — registry failure and document failure are both hard BLOCKED outcomes.

## Output Format

```
## Authorization Gate Result

**Status**: PASS ✅ | BLOCKED ❌

**Authorizing Party**: [name]
**Engagement Window**: [start] – [end]
**In-Scope**: [summary]

**Checks**:
- [x] Authorization document found
- [x] All required fields present
- [x] Signature date ≤ engagement start date (M-03)
- [x] Signatory title carries authorization authority (M-03)
- [x] Scope document exists
- [x] Engagement window active
- [x] Authorization registry row resolved (hub-delegated engagements): window-current, project-matched

**Decision**: Phase [N] MAY proceed | HALT — do not dispatch any Phase 1+ agents
```

## Related Skills

- `stride-threat-matrix` — threat model that defines what verify-authorization checks
- `security-scan` — downstream verification after authorization passes

The original engagement pipeline (scoping, recon surface, finding tracker, patch
automation) never shipped as skills; this skill validates `docs/scope.md` and
`docs/authorization.md` produced by the PM workflow instead.
