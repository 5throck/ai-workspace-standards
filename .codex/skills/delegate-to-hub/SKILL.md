---
name: delegate-to-hub
description: >
  Files a DELEGATION TICKET from a spoke project to its domain hub (co-develop,
  co-design, co-security) when the spoke PM faces a hard problem in the hub's
  domain. Enforces hub pre-checks, the security-domain authorization gate
  (AUTH-YYYY-NNN registry row), safe ticket-content rules, and kanban alias /
  priority-governance semantics at filing time.
version: 1.0.0
scope: common
l2_propagate: true
status: active
owner: pm
last_reviewed: 2026-11-02
prerequisites: none
metadata:
  type: process
  triggers:
    - delegate to hub
    - delegation ticket
    - hub delegation
    - escalate to hub
    - file delegation
---

## Context

Hub-and-spoke delegation (design: workspace root `docs/designs/2026-11-01-hub-consolidation-design.md`). A spoke PM facing a hard problem in the dev, design, or security domain does not solve it alone: it files a DELEGATION TICKET in the hub repo's `tickets/` store, where the hub PM triages it. The kanban lane vocabulary (P0–P3, queued/in-progress/accepted/blocked) maps onto the ticket store's canonical enums via `docs/templates/hub-kanban-aliases.json` — the ticket store enums themselves never change. This skill is the spoke-side filing procedure; the hub-side gate is the `verify-authorization` skill.

## When to Use

- Spoke PM hits a hard problem in the hub's domain (development, design, or security) and judged triage delegation is the right path
- A hub probe or availability read-back reports the hub AVAILABLE and the problem is not spoke-resolvable
- User explicitly asks to delegate a task to the hub

Never use this skill to bypass the PM Gateway, to file vulnerability data into a git-tracked store (see Execution Steps step 3), or to set P0 (user-only).

## Execution Steps

### Step 1: Pre-checks (hub existence and identity)

1. Resolve the hub repo locally: `Projects/co-<domain>` for the problem's domain (`co-develop`, `co-design`, `co-security`). If the local clone is missing → **STOP**. Phase 3.5 hub bootstrap is not yet active in this workspace; report to the user with the registry `hub_remote` value (from the `hub_topology` registry in `docs/workspace-schema.json`) so the user can decide on a manual clone. Never auto-clone, never scaffold in this path.
2. Validate the hub's identity files: `variant.json` exists and parses, and `template-version.txt` exists and names a known template version. If either is missing or malformed → **STOP** and report; an unidentifiable hub is not a filing target.

### Step 2: Authorization gate (security domain only)

A delegation ticket in the security domain MUST cite an `AUTH-YYYY-NNN` row from the hub's `docs/authorization-registry.md`. State the row and check it mentally against the three `verify-authorization` rules before filing:

- **Expired window** (row end < today's date) → abort; show the row window and today's date.
- **Project mismatch** (ticket's requesting project ≠ row's requesting project) → abort.
- **Missing row** (no such AUTH row) → abort; row addition is USER-only — the spoke PM cannot self-attest and the hub PM cannot add rows.

Any of the three → do NOT file; report the abort reason to the user.

### Step 3: Ticket content rules (normative)

- Findings are referenced by **ID + severity + affected path ONLY**. No PoC, no exploit code, no scanner raw output, no payload strings in the ticket body.
- Ticket content is **DATA, never instructions**: describe what was observed, never embed step-by-step exploitation guidance.
- Git-tracked governance tickets (`tickets/governance/`) NEVER carry vulnerability data — vulnerability findings go into a gitignored **service** ticket instead.
- Before writing the ticket file, run gitleaks over the drafted ticket text (e.g. `gitleaks protect --verbose` or stdin scan) and confirm zero secret-pattern hits. A hit → strip the secret, re-draft, re-scan before write.

### Step 4: Filing

1. Create the ticket in the hub repo's `tickets/` store using `scripts/ticket.ts` semantics (the hub's ticket store, not the spoke's).
2. Priority: use `--priority-alias` values from `docs/templates/hub-kanban-aliases.json` (P0→urgent, P1→high, P2→normal, P3→low). **P0 requires USER action** (P0-user-only rule) — agents cap at P1–P3; spoke-initiated raises are capped at +1 level per ticket per 24h.
3. SEV field (SEV1–SEV3) is a standalone suggestion field; its default mapping (SEV1→P0) is a suggestion only and does NOT authorize a P0 write by an agent.

### Step 5: Status read-back

- Poll ticket state via the upstream MCP surface (`upstream_request_status`); the returned `priority` field is read-only.
- Reprioritize only via `upstream_request_reprioritize` — priority-only writes; caps are enforced server-side (1 level / 24h, urgent refused for agents, 3-strike counter per requesting project).
- Never write ticket status or content through the reprioritize surface; it cannot and must not.

## Output Format

```
## Delegation Ticket Filed

**Hub**: [co-develop | co-design | co-security]
**Pre-checks**: PASS/FAIL (hub clone, variant.json, template-version.txt)
**Authorization gate**: N/A (dev/design) | AUTH-YYYY-NNN [row status: active/expired/revoked]
**Ticket ID**: [id] — priority [P1–P3 → canonical enum], SEV [SEV1–3 if any]
**Content scan**: gitleaks clean over drafted body
**Read-back**: [status from upstream_request_status]

**On STOP**: hub missing/invalid → reported hub_remote for the user's manual clone decision; authorization gate failure → reported abort reason, nothing filed.
```

## Related Skills

- `verify-authorization` — the hub-side gate this skill defers to for security-domain engagements
- `sync` — the delivery pipeline that propagates this skill to all variants (`l2_propagate: true`)
