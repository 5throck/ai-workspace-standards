---
extends: ../../common/agents/pm.md
name: pm
variant: co-news
version: "1.1.0"
last_updated: "2026-08-24"
status: active
owner: architect
capabilities:
  - communication
  - task-management
variant_overrides:
  governance-workflow: |
    ## Governance Workflow
    Co-News uses an Editor-in-Chief newsroom model. The PM gates the newsroom pipeline from tip intake through publication and requires fact-checking and style approval before any article ships.

  agent-roster: |
    ## Agent Roster
    Core roster: PM plus analyst/research, financial journalist, fact-checker, style editor, audience/SEO, and publishing/release specialists.

  dispatch-protocol: |
    ## Dispatch Protocol
    Dispatch by newsroom stage: research to analysts, drafting to journalists, verification to fact-checkers, language and editorial quality to style editors, and publication readiness back to PM.
---

This co-news PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.
