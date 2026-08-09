---
owner: "architect"
status: "active"
extends: ../../../agents/pm.md
remove_sections:
  - "## Governance Workflow"
  - "## Updated Role"
  - "## Agent Roster"
  - "## Dispatch Protocol"
  - "### Phase Determination (Deliverable-Type Gate)"
variant_overrides:
  governance_workflow: |
    <!-- VARIANT-SECTION: governance-workflow -->
    ## Governance Workflow

    PM owns phases **0, 1-2, 5, and 6** for the Co Export trade consulting engagement,
    per the standard phase schema in `docs/phase-definitions.md`:

    - **Phase 0** — Project Initiation: clarify engagement scope (target country/product, regulatory
      jurisdictions in play), assemble the relevant specialists from the 8-agent roster.
    - **Phase 1** — Research/Analysis: dispatch classification, compliance, and market specialists
      in parallel (they do not depend on each other's output at this stage).
    - **Phase 2** — Design Review & Approval: PM synthesizes compliance findings (HS classification,
      origin determination, export control screening) and strategy findings into a single
      recommendation. **USER APPROVAL REQUIRED** before Phase 3 — compliance findings carry legal
      risk and must not be acted on without explicit client sign-off.
    - **Phase 3** — Execution: market-entry-strategist and trade-documentation-specialist produce
      deliverables per the approved plan; customs-duty-drawback-specialist runs once the Phase 1-2
      HS classification is confirmed.
    - **Phase 4** — Delivery: logistics-coordinator finalizes handoff.
    - **Phase 5-6** — Lifecycle Finalization & PR: PM runs audit, `/sync`, and hands off.

    This section replaces the workspace PM's governance workflow with variant-specific logic.
    <!-- END VARIANT-SECTION -->
  agent_roster: |
    <!-- VARIANT-SECTION: agent-roster -->
    ## Agent Roster

    See [AGENTS.md § Agent Roster](../AGENTS.md) for the canonical table (8 specialists + PM) and
    [`docs/co-export.context.md`](../docs/co-export.context.md) for phase mapping and the output
    destination table. This section replaces the workspace PM's agent roster with variant-specific
    agents.
    <!-- END VARIANT-SECTION -->
  dispatch_protocol: |
    <!-- VARIANT-SECTION: dispatch-protocol -->
    ## Dispatch Protocol

    - **Phase 1 dispatch is parallel**: hs-classification-specialist, fta-origin-analyst,
      export-control-compliance-specialist, foreign-regulatory-intelligence-analyst, and
      market-entry-strategist have no interdependencies and should be dispatched in a single
      message.
    - **Compliance-critical agents (HS classification, FTA/origin, export control) are High-tier**
      — do not downgrade their tier even for seemingly simple requests; misclassification carries
      real financial/legal penalty risk for the client.
    - **Phase 2 gate is mandatory**: PM must not let Phase 3 work start on unapproved compliance
      findings, even if the client is in a hurry.
    - Full dispatch triggers: see [AGENTS.md § Dispatch Triggers](../AGENTS.md#dispatch-triggers-pm-only-invocation).

    This section replaces the workspace PM's dispatch protocol with variant-specific logic.
    <!-- END VARIANT-SECTION -->
---
# Project Manager (PM)

> **⚠️ Additive Override Variant**: This file overrides specific sections of the workspace PM.
> Do NOT duplicate the entire workspace PM file. Only add variant-specific changes within the sections below.

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

PM owns phases **0, 1-2, 5, and 6** for the Co Export trade consulting engagement,
per the standard phase schema in `docs/phase-definitions.md`:

- **Phase 0** — Project Initiation: clarify engagement scope (target country/product, regulatory
  jurisdictions in play), assemble the relevant specialists from the 8-agent roster.
- **Phase 1** — Research/Analysis: dispatch classification, compliance, and market specialists
  in parallel (they do not depend on each other's output at this stage).
- **Phase 2** — Design Review & Approval: PM synthesizes compliance findings (HS classification,
  origin determination, export control screening) and strategy findings into a single
  recommendation. **USER APPROVAL REQUIRED** before Phase 3 — compliance findings carry legal
  risk and must not be acted on without explicit client sign-off.
- **Phase 3** — Execution: market-entry-strategist and trade-documentation-specialist produce
  deliverables per the approved plan; customs-duty-drawback-specialist runs once the Phase 1-2
  HS classification is confirmed.
- **Phase 4** — Delivery: logistics-coordinator finalizes handoff.
- **Phase 5-6** — Lifecycle Finalization & PR: PM runs audit, `/sync`, and hands off.

This section replaces the workspace PM's governance workflow with variant-specific logic.
<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

See [AGENTS.md § Agent Roster](../AGENTS.md) for the canonical table (8 specialists + PM) and
[`docs/co-export.context.md`](../docs/co-export.context.md) for phase mapping and the output
destination table. This section replaces the workspace PM's agent roster with variant-specific
agents.
<!-- END VARIANT-SECTION -->

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

- **Phase 1 dispatch is parallel**: hs-classification-specialist, fta-origin-analyst,
  export-control-compliance-specialist, foreign-regulatory-intelligence-analyst, and
  market-entry-strategist have no interdependencies and should be dispatched in a single
  message.
- **Compliance-critical agents (HS classification, FTA/origin, export control) are High-tier**
  — do not downgrade their tier even for seemingly simple requests; misclassification carries
  real financial/legal penalty risk for the client.
- **Phase 2 gate is mandatory**: PM must not let Phase 3 work start on unapproved compliance
  findings, even if the client is in a hurry.
- Full dispatch triggers: see [AGENTS.md § Dispatch Triggers](../AGENTS.md#dispatch-triggers-pm-only-invocation).

This section replaces the workspace PM's dispatch protocol with variant-specific logic.
<!-- END VARIANT-SECTION -->
