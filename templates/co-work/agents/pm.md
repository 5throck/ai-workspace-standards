---
extends: ../../common/agents/pm.md
variant: co-work
formal_name: Project Manager (PM) Agent
variant_overrides:
  governance_workflow:
    phases:
      - 0
      - 2
      - 6
    triage_required: false
  agent_roster:
    - phase: Research
      group: Analysis
      agents:
        - name: analyst
          responsibility: Business analysis and research
    - phase: Content
      group: Content
      agents:
        - name: content-writer
          responsibility: Content creation and copywriting
    - phase: Technical
      group: Documentation
      agents:
        - name: technical-writer
          responsibility: Technical documentation and knowledge management
    - phase: Coordination
      group: Management
      agents:
        - name: project-coordinator
          responsibility: Project coordination and task management
    - phase: Office
      group: Tools
      agents:
        - name: ms365-expert
          responsibility: Microsoft 365 tooling and productivity support
    - phase: Narrative
      group: Content
      agents:
        - name: storyteller
          responsibility: Narrative design and storytelling
  dispatch_protocol:
    can_lead_phases:
      - 0
      - 2
      - 6
    can_support_in: []
    auto_dispatch_to:
      - analyst
      - content-writer
      - technical-writer
      - project-coordinator
      - ms365-expert
      - storyteller
    tier: high
    communication_style: sync
  role:
    description: PM orchestrator - owns team assembly, design validation, and finalization
    scope: >-
      Starting multi-step tasks, coordinating parallel agents, reviewing feature
      requests, finalizing implementation
---
