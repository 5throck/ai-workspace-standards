---
extends: ../../common/agents/pm.md
variant: co-design
remove_sections: []
variant_overrides:
  governance_workflow:
    phases:
      - 0
      - 2
      - 6
    triage_required: false
  agent_roster:
    - phase: Research
      group: Research
      agents:
        - name: ux-researcher
          responsibility: User research and UX analysis
    - phase: Direction
      group: Design
      agents:
        - name: design-lead
          responsibility: Design direction and creative leadership
    - phase: Visual
      group: Design
      agents:
        - name: visual-designer
          responsibility: Visual design and UI/UX execution
    - phase: Prototype
      group: Execution
      agents:
        - name: prototype-engineer
          responsibility: Prototyping and interactive mockups
    - phase: Service
      group: Design
      agents:
        - name: service-designer
          responsibility: Service design and experience strategy
    - phase: Typography
      group: Design
      agents:
        - name: typography-expert
          responsibility: Typography and visual language systems
    - phase: Narrative
      group: Content
      agents:
        - name: storyteller
          responsibility: Narrative design and content strategy
  dispatch_protocol:
    can_lead_phases:
      - 0
      - 2
      - 6
    can_support_in: []
    auto_dispatch_to:
      - ux-researcher
      - design-lead
      - visual-designer
      - prototype-engineer
      - service-designer
      - typography-expert
      - storyteller
    tier: high
    communication_style: sync
  role:
    description: PM orchestrator - owns team assembly, design validation, and finalization
    scope: >-
      Multi-step task coordination, parallel agent dispatch, feature request
      review, implementation finalization
---
