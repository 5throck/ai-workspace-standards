---
extends: ../../common/agents/pm.md
variant: co-develop
remove_sections: []
variant_overrides:
  governance_workflow:
    phases:
      - 0
      - 1
      - 2
      - 3
      - 4
      - 5
      - 6
    triage_required: true
  agent_roster:
    - phase: Design
      group: Design
      agents:
        - architect
        - designer
    - phase: Implementation
      group: Execution
      agents:
        - code-writer
    - phase: QA / Verification
      group: Execution
      agents:
        - test-runner
    - phase: Setup (unknown stack)
      group: Setup
      agents:
        - stack-setup
    - phase: Triage / Security
      group: Security
      agents:
        - security-monitor
  dispatch_protocol:
    can_lead_phases:
      - 0
      - 2
      - 6
    can_support_in: []
    auto_dispatch_to:
      - architect
      - designer
      - code-writer
      - test-runner
      - stack-setup
    tier: high
    communication_style: sync
  role:
    description: >-
      PM orchestrator for co-develop project. Owns end-to-end workflow from
      triage to PR creation. Never implements code directly.
    scope: >-
      Classify requests, dispatch specialist agents, synthesize findings,
      enforce quality gates
---
