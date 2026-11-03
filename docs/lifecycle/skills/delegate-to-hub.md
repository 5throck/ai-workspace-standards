# Delegate-To-Hub Skill — Lifecycle Record

## Metadata
- **Skill**: delegate-to-hub
- **Status**: active
- **Version**: 1.0.1
- **Created**: 2026-11-02
- **Last Updated**: 2026-11-02 (v1.0.1 — `--hub` flag + lifecycle UNAVAILABLE gate, Phase 3.5 of the hub-consolidation design §4.5. Record authored 2026-11-03 — the SKILLS.md row existed since the Phase 3a delegation contract but this lifecycle record was missing; T-20261103-004.)

## Description
Spoke-side filing procedure for hub-and-spoke delegation (design: workspace root
`docs/designs/2026-11-01-hub-consolidation-design.md`; ADR-0103 authorizes the
ticket-path channel as a narrow N2 exception). A spoke PM facing a hard problem
in the dev, design, or security domain files a DELEGATION TICKET in the hub
repo's `tickets/` store for hub-PM triage. Enforces, at filing time: hub
pre-checks (local clone, `variant.json`, `template-version.txt`), the Phase 3.5
lifecycle UNAVAILABLE gate (hub state file, mechanically enforced by
`ticket.ts create --hub`), the security-domain authorization gate (an
`AUTH-YYYY-NNN` row from the hub's `docs/authorization-registry.md`, checked
against the three `verify-authorization` rules), safe ticket-content rules
(findings by ID + severity + affected path only; content is data, never
instructions; gitleaks scan before filing), and kanban alias /
priority-governance semantics (P0 user-only, +1-level-per-24h spoke cap,
3-strike counter). Frontmatter declares `scope: common`, `l2_propagate: true` —
variant delivery rides the standard sync pipeline.

## Changelog
- 1.0.1 (2026-11-02): `--hub` flag + lifecycle UNAVAILABLE gate (Phase 3.5, design §4.5).
- 1.0.0 (2026-11-02): initial — Phase 3a delegation contract (ADR-0103, commit 0c6ada83f/185d29ba9); registry row added to `skills/SKILLS.md`.

## Dependencies
- Design: `docs/designs/2026-11-01-hub-consolidation-design.md` (§3.5 hub auto-creation, §4 hub bootstrap, §4.5 lifecycle gate)
- ADR-0103 (`docs/adr/0103-hub-delegation-channel-n2-exception.md`) — the N2 exception this skill operationalizes
- `verify-authorization` skill — the hub-side gate for security-domain engagements
- `docs/templates/hub-kanban-aliases.json` + `docs/workspace-schema.json` `hub_topology` registry
- `scripts/hub-bootstrap.ts` — user-approved hub bootstrap (never auto-run by this skill)

## Phase History
- Production (2026-11-02): skill created with the Phase 3a delegation contract (ADR-0103); registry row added to `skills/SKILLS.md`; platform mirror at `.agents/skills/delegate-to-hub/`. Lifecycle record backfilled 2026-11-03 (T-20261103-004) — record creation was missed in the Phase 3a batch.

## Acceptance Criteria
- Registry row present in `skills/SKILLS.md` (skill | 1.0.1 | active | pm)
- Canonical copy `skills/delegate-to-hub/SKILL.md` and platform mirror `.agents/skills/delegate-to-hub/SKILL.md` identical
- `bun scripts/audit.ts` green (skill-graph projection includes the skill node)
- Documentation/procedure-level only — no script surface added by this skill itself
