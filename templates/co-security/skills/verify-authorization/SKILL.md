---
name: verify-authorization
description: >
  Hard gate: confirms a signed authorization document exists and contains all required fields
  before allowing any Phase 1+ (recon, exploitation, patching) activity to proceed.
  BLOCKS work if authorization is missing or incomplete.
version: 1.0.0
last_reviewed: 2026-06-13
status: active
owner: pm
prerequisites: engagement-scoping must have been run (docs/scope.md must exist)
security-gate: true
---

# 🔒 Skill: verify-authorization

## Context

This skill is the mandatory pre-flight gate for all offensive and remediation activity.
It is invoked automatically by the PM before dispatching any Phase 1+ agent.
No PoC, recon, or patch activity may begin until this skill returns PASS.

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

**Decision**: Phase [N] MAY proceed | HALT — do not dispatch any Phase 1+ agents
```

## Related Skills

- `engagement-scoping` — creates the authorization document this skill validates
- `recon-surface` — must pass verify-authorization before executing
- `finding-tracker` — must pass verify-authorization before Phase 3
- `patch-automation` — must pass verify-authorization before applying patches
