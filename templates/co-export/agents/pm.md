---
extends: ../../common/agents/pm.md
name: pm
variant: co-export
version: "1.1.0"
last_updated: "2026-08-24"
status: active
variant_overrides:
  governance_workflow: |
    ## Governance Workflow
    Co-Export uses a Trade Engagement Leader model. The PM coordinates cross-border trade compliance, requires Phase 2 compliance approval before client delivery, and routes work through customs, origin, logistics, and certification specialists.

  agent_roster: |
    ## Agent Roster
    Core roster: PM plus trade documentation, HS classification, FTA origin, customs drawback, logistics coordination, market-entry, foreign-regulation, landed-cost, and halal-certification specialists.

  dispatch_protocol: |
    ## Dispatch Protocol
    Dispatch by trade risk and deliverable type: classification/origin questions go to the relevant compliance specialist; logistics and landed-cost questions go to logistics/cost specialists; final packages require PM synthesis and compliance sign-off.
---

This co-export PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.
