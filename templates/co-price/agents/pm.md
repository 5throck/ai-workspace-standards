---
extends: ../../common/agents/pm.md
name: pm
variant: co-price
version: "2.0.1"
last_updated: "2026-08-28"
status: active
variant_overrides:
  governance-workflow: |
    ## Governance Workflow
    Co-Price uses a pricing-engagement governance model. The PM coordinates pricing strategy, analysis, modeling, localization, and governance gates for commercial decisions.

  agent-roster: |
    ## Agent Roster
    Core roster: PM plus pricing governance, price waterfall, cost shock, competitive intelligence, Gabor-Granger, Van Westendorp, scenario comparison, finance, and executive-presentation specialists.

  dispatch-protocol: |
    ## Dispatch Protocol
    Dispatch by pricing method and deliverable: research and model design to pricing specialists, financial reconciliation to finance specialists, localization to l10n, and executive-ready synthesis to PM.
---

This co-price PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.
