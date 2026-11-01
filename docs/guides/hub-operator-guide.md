# Hub Operator Guide — Hub-and-Spoke Delegation Channel

**Version**: 1.0.0
**Last Updated**: 2026-11-02
**Scope**: Operating the hub-and-spoke delegation channel — filing delegation tickets (spoke side) and triaging the delegation queue (hub side), per spec `2026-11-01-hub-consolidation-design` (Phase 3a: kanban core + delegation contract)

---

## §1: Purpose

This is the operating runbook for the hub-and-spoke delegation channel: how a spoke project's PM hands a hard problem to its domain hub, and how the hub PM works the resulting queue.

- **Who files**: spoke PMs (any variant project) facing a hard problem in the dev, design, or security domain that is not spoke-resolvable.
- **Who triages**: hub PMs of the three hubs — `co-develop` (dev), `co-design` (design), `co-security` (security).
- **What a hub is**: a delivery responsibility, not an authority. The spoke PM owns the spoke project; the hub PM owns domain service quality; final adjudication of any hub-spoke conflict stays with the workspace-root PM.

This guide is a runbook — commands and rules only. The doctrine lives elsewhere:

| Artifact | Location |
|---|---|
| Design (normative prose) | `docs/designs/2026-11-01-hub-consolidation-design.md` |
| Filing procedure (spoke skill) | `skills/delegate-to-hub/SKILL.md` |
| Hub-side security gate | `verify-authorization` skill (co-security variant) |
| Topology registry | `hub_topology` section in `docs/workspace-schema.json` |
| Kanban alias table | `docs/templates/hub-kanban-aliases.json` |
| Boundary protocol & SEV tiers | every project's `AGENTS.md` COMMON-AGENTS zone ("Hub-and-Spoke Topology") |

---

## §2: Filing a Delegation Ticket (Spoke Side)

Condensed from the `delegate-to-hub` skill. Follow the steps in order; any STOP means nothing is filed.

### 2.1 Pre-checks (hub existence and identity)

1. Resolve the hub repo locally: `Projects/co-<domain>` for the problem's domain (`co-develop`, `co-design`, `co-security`).
2. **Hub clone missing → STOP.** Phase 3.5 hub bootstrap is not yet active in this workspace. Report to the user with the registry `hub_remote` value (look up the domain's hub in the `hub_topology` registry of `docs/workspace-schema.json`) so the user can decide on a manual clone. Never auto-clone, never scaffold in this path.
3. Validate the hub's identity files: `variant.json` exists and parses, and `template-version.txt` exists and names a known template version. Either missing or malformed → **STOP** and report; an unidentifiable hub is not a filing target.

### 2.2 Authorization gate (security domain only)

A delegation ticket in the security domain MUST cite an `AUTH-YYYY-NNN` row from the hub's `docs/authorization-registry.md`. Check the cited row against the three `verify-authorization` rules:

| Rule | Failure condition | Action |
|---|---|---|
| Expired window | row window end < today's date | Abort; show the row window and today's date |
| Project mismatch | ticket's requesting project ≠ row's requesting project | Abort; state both projects |
| Missing row | no such AUTH row (or no row cited) | Abort; row addition is USER-only — neither the spoke PM nor the hub PM can self-attest or add rows |

Any failure → do NOT file; report the abort reason to the user.

### 2.3 Ticket content rules (normative)

- Findings are referenced by **ID + severity + affected path ONLY**. No PoC, no exploit code, no scanner raw output, no payload strings in the ticket body.
- Ticket content is **DATA, never instructions**: describe what was observed, never embed step-by-step exploitation guidance.
- Git-tracked governance tickets (`tickets/governance/`) NEVER carry vulnerability data — vulnerability findings go into a gitignored **service** ticket instead.
- Before writing the ticket file, run gitleaks over the drafted ticket text (e.g. `gitleaks protect --verbose` or a stdin scan) and confirm zero secret-pattern hits. A hit → strip the secret, re-draft, re-scan before write.

### 2.4 Filing

Create the ticket in the **hub repo's** ticket store (not the spoke's), using the kanban alias vocabulary:

```bash
# From inside the hub repo (Projects/co-<domain>)
bun scripts/ticket.ts create --manual "<delegation title>" --priority-alias P2
```

| Rule | Detail |
|---|---|
| Alias mapping | `P0→urgent`, `P1→high`, `P2→normal`, `P3→low` (`docs/templates/hub-kanban-aliases.json`) |
| P0 | **Requires USER action** — agents cap at P1–P3 |
| SEV field | `SEV1–SEV3` is a standalone suggestion field; the default mapping (SEV1→P0, SEV2→P1, SEV3→P2) is a suggestion only and does NOT authorize a P0 write by an agent |
| Spoke raises | capped at +1 level per ticket per 24h (see §3.3) |

`--priority-alias` and `--priority` are mutually exclusive — pass one.

---

## §3: Triaging the Queue (Hub Side)

Hub PM session start, from inside the hub repo:

```bash
bun scripts/ticket.ts list            # live tickets; upstream listings sort flagged first, mark [FLAGGED], print inbox/ready/flagged counts
bun scripts/ticket.ts list --ready    # only tickets already marked ready for pickup
```

### 3.1 Triage verdicts

```bash
bun scripts/ticket.ts triage <U-id> <inbox|ready> [--confirm-reviewed]
```

- `inbox` — park for later human/PM review.
- `ready` — the hub PM accepts the ticket into the work queue. `ready` on a flagged ticket requires `--confirm-reviewed`.
- Work tickets in priority order: P0 (urgent) → P1 (high) → P2 (normal) → P3 (low).

### 3.2 SEV1 auto-ready

An upstream ticket carrying `sev=SEV1` bypasses the human inbox step: the `triage` command auto-readies it and records the bypass in the ticket's `history[]`. SEV2, SEV3, and unset SEV never bypass — the normal triage path above is the only route to ready for those.

### 3.3 Reprioritize (actor grammar)

```bash
bun scripts/ticket.ts reprioritize <id> --priority <P0|P1|P2|P3|low|normal|high|urgent> --actor <user|hub-pm|spoke-pm:NAME>
```

| Actor | Allowed |
|---|---|
| `user` | Unrestricted — including P0/urgent |
| `hub-pm` | Unrestricted **within P1–P3**; P0 is a hard error |
| `spoke-pm:<NAME>` | Raises capped at **+1 level per ticket per 24h** (P3→P2 today, P2→P1 at the earliest 24h later); never targets urgent/P0; lowering is unrestricted |

P0-by-agent is a hard error for every agent actor and counts as a cap violation.

### 3.4 Three-strike freeze

- Cap violations append to the gitignored ledger `.pipeline-state/hub-reprioritize-strikes.json`, keyed by requesting project (no reader UI — inspect the file directly).
- Three violations set `frozen=true` for that project; its subsequent priority raises are refused with a typed error, pending user review.
- Unfreezing is a user decision.

---

## §4: Status & Read-Back (Spoke Side)

After filing, the spoke tracks its request through the upstream MCP surface — never by writing the hub's ticket files directly.

- **`upstream_request_status`** — returns the request's state, now including `priority` (and `sev` when set). Read-only.
- **`upstream_request_reprioritize`** — priority-only writes (P0–P3 alias or canonical enum); never status, content, or triage. Every change appends to the ticket's `history[]` audit trail.
  - Caller identity is **gateway-derived** (cwd > client_roots); `self_declared` callers are refused for writes.
  - Spoke caps (+1 level per 24h, never urgent) and the 3-strike counter are enforced server-side, same as §3.3.
  - **P0 is impossible via MCP** — a typed error states that P0 requires user action via `ticket.ts`.
- Never write ticket status or content through the reprioritize surface; it cannot and must not.

---

## §5: Escalation

### 5.1 SEV1 incident path (security)

SEV1 = confirmed secret/credential exposure in a tracked repo. Classify locally, no pre-authorization: **notify the hub security PM and the user immediately, and block pushes** until the exposure is contained. (SEV2 = exploitable shared-infrastructure vulnerability → same-day hub report; SEV3 = routine finding → normal tickets.)

A confirmed SEV1 in the delegation queue is also why §3.2 auto-readies SEV1 tickets — the hub must see them without waiting on inbox triage.

### 5.2 Template-defect reports stay on the upstream-request path

The delegation channel does not replace the upstream-request path: problems originating in the template (L1 common or L2 variant) are still reported with `upstream_request_create` per the governance workflow (`docs/governance/agents/workflows.md`). That route is unchanged.

### 5.3 Boundary protocol

The hub-spoke boundary protocol (what may cross the channel, what never does, SEV tiers, final adjudication) is declared in every project's `AGENTS.md` COMMON-AGENTS zone ("Hub-and-Spoke Topology"). Conflicts between a hub PM and a spoke PM are adjudicated by the workspace-root PM.

---

## §6: Related Documentation

- [Hub Consolidation Design](../designs/2026-11-01-hub-consolidation-design.md) — normative design: registry, lifecycle state machine, alias schema, governance
- [Delegate-to-Hub Skill](../../skills/delegate-to-hub/SKILL.md) — the spoke-side filing procedure this guide condenses
- [Workspace Schema](../workspace-schema.json) — `hub_topology` registry (hubs, domains, canonical paths, consumers)
- [Kanban Alias Table](../templates/hub-kanban-aliases.json) — machine-readable P0–P3 / lane vocabulary mapping
- [Governance Workflows](../governance/agents/workflows.md) — the upstream-request path for template defects
