# Skill-Graph Analyst Agent Lifecycle

## Created

2026-09-22

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-22 | - | production | New recurring work type: weekly fleet skill-graph analytics (ADR-0080 gate-moment hiring decision, docs/designs/2026-09-22-skill-graph-fleet-analytics-design.md) | pm |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: fleet skill-graph analytics specialist (triage only)
- [x] Tier assignment: Low-tier (claude-haiku-4-5) — lightweight read-only analyst + ticket filing
- [x] Lifecycle responsibilities specified: weekly report run, convergence/delivery-gap triage, ticket filing, four-section reporting
- [x] Explicit non-goals documented: no skill modification, no promotion execution, tickets only
- [x] Registered in docs/workspace-schema.json `agent_tiers` (SSOT) and AGENTS.md rosters
- [x] `bun scripts/validate-agents.ts` passes

## Dependencies

- pm (sole dispatcher; PM-ONLY invocation)
- scripts/skill-graph-fleet-report.ts (the analytics tool the agent runs)
- skill-graph-analytics skill (the cadence procedure the agent executes)

## Domain

**Fleet Skill-Graph Analytics Specialist** — consolidation, presence triage, and trend interpretation over root + per-project skill-graph projections.

**Phases Supported**: Phase 6 support (analytics input to QA/finalization)

**Key Responsibilities**:
- Weekly fleet report run + snapshot reading
- Consolidation/promotion candidate triage (>= 3-project convergence, absent from root)
- Delivery-gap candidate triage (root skills missing from >= 3 projects)
- NEW/VANISHED fleet-wide diff interpretation
- Four-section reporting (Run / Findings / Tickets / Next)

## Dispatch Protocol

**Can Lead Phases**: [] (analytics support, not a phase lead)
**Can Support In**: [6]
**Tier**: low
**Communication Style**: async

## Non-Goals

No skill modification, no promotion execution, no graph regeneration, no snapshot hand-edits — tickets only.

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-09-22
- **Last Reviewer**: pm
