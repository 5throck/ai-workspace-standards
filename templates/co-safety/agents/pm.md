---
extends: ../../common/agents/pm.md
name: pm
variant: co-safety
version: "1.0.0"
last_updated: "2026-08-28"
status: active
owner: architect
lifecycle:
  phase: production
  created: "2026-06-04"
  last_updated: "2026-08-28"
  governance: docs/lifecycle/agents/pm.md
variant_overrides:
  governance_workflow: |
    ## Governance Workflow
    Co-Safety uses a safety-governance model. Every workflow must pass legal_basis evidence gates, Korean regulatory source requirements, and PM approval before safety deliverables are finalized.

  agent_roster: |
    ## Agent Roster
    Core roster: PM plus safety governance, compliance/legal/risk, documentation, training, workflow, and domain agents under agents/domains/.

  dispatch_protocol: |
    ## Dispatch Protocol
    Dispatch by safety domain first, then by functional expertise. TBM/PTW/PSM/MSDS requests go to matching domain or workflow specialists; legal-basis and compliance evidence return to PM for closeout approval.
---

This co-safety PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.
