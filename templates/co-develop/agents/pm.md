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
        - name: architect
          responsibility: Software architecture and design
        - name: designer
          responsibility: Software design and technical specifications
    - phase: Implementation
      group: Execution
      agents:
        - name: code-writer
          responsibility: Code implementation and development
    - phase: QA / Verification
      group: Execution
      agents:
        - name: test-runner
          responsibility: Testing and quality assurance
    - phase: Setup (unknown stack)
      group: Setup
      agents:
        - name: stack-setup
          responsibility: Development environment setup
    - phase: Triage / Security
      group: Security
      agents:
        - name: security-monitor
          responsibility: Security monitoring and vulnerability triage
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

## Dispatch Protocol

**Can Lead Phases**: [0, 2, 6]
**Auto-Dispatch To**: `architect`, `designer`, `code-writer`, `test-runner`, `stack-setup`
**Tier**: high
**Communication Style**: sync
