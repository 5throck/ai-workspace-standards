# Agent Governance Record — execution-plan-templates

## Overview

- **Name**: execution-plan-templates
- **Kind**: governance operational reference (not a runtime agent) — lifecycle record maintained for validator parity with `docs/governance/agents/execution-plan-templates.md`
- **Maintained at**: L1 (templates/common) — delivered to every scaffolded project
- **Role**: project-applicable operational guidance for execution-plan authoring: the standard plan template, the Row 0 Design Gate, exemption codes (E1–E5), and worked examples. Companion guidance to the thin-dispatcher sections in `AGENTS.md` (§5); the workspace root maintains its own L0-authored equivalent, and the L0/L1 divergence is intentional (DEC-20261028-05, design 2026-10-28-l0-only-governance-doc-cleanup).

## Phase History

- **2026-11-19**: lifecycle record created. The wave delivery to Projects/co-newbiz seeded an empty record file (no L1 source existed), flagged by validate-agents (missing Phase History / Acceptance Criteria); this record completes both sides (L1 source + delivered copy) so future scaffolds deliver a non-empty record.
- **Pre-2026-11-19**: governance doc content consolidated at L1 per DEC-20261028-05 (l0-only governance doc cleanup): L0-authored equivalent retained at the workspace root, L1 copy is the project-delivered companion.

## Acceptance Criteria

- [x] Load contract present (PM and specialists must Read before executing the workflow; citing without reading is a process violation)
- [x] §5 Execution Plan Templates section present: standard plan table with Row 0 Design Gate (ADR-0074), mandatory Tier column, PM model line, accessibility (ADR-0065) and preview-verification (ADR-0070) requirements, and worked examples
- [x] Exemption codes E1–E5 documented with AGENTS.md §5.1.1 as the machine-consumed SSOT
- [x] L0/L1 divergence recorded as intentional (DEC-20261028-05) — no workspace-root-only content leaked into the L1 copy
- [x] Delivered to every scaffolded project from `templates/common/docs/`
