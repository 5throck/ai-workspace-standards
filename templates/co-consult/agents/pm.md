---
extends: ../../common/agents/pm.md
variant: co-consult
remove_sections: []
variant_overrides:
  governance_workflow:
    phases:
      - 0
      - 1
      - 2
      - 5
      - 6
    triage_required: false
  agent_roster:
    - phase: Triage / Analysis
      group: Analysis
      agents:
        - name: auditor
          responsibility: Quality assurance and compliance validation
    - phase: Consulting
      group: Client
      agents:
        - name: engagement-leader
          responsibility: Client relationship management and engagement coordination
    - phase: Consulting
      group: Strategy
      agents:
        - name: strategy-analyst
          responsibility: Strategic analysis and planning
    - phase: Consulting
      group: Domain
      agents:
        - name: industry-expert
          responsibility: Domain expertise and business analysis
    - phase: Consulting
      group: Change
      agents:
        - name: change-management-partner
          responsibility: Change management and organizational transformation
    - phase: Consulting
      group: Comm
      agents:
        - name: communications-lead
          responsibility: Communication strategy and stakeholder engagement
    - phase: Technology
      group: Architecture
      agents:
        - name: solutions-architect
          responsibility: Technical architecture and solution design
    - phase: Delivery
      group: PMO
      agents:
        - name: workstream-lead
          responsibility: Project management and workstream coordination
        - name: delivery-manager
          responsibility: Delivery management and project execution
    - phase: Subject Matter
      group: SME
      agents:
        - name: sme
          responsibility: Subject matter expertise and consultation
    - phase: Analysis
      group: Data
      agents:
        - name: data-analyst
          responsibility: Data analysis and business intelligence
    - phase: Technology
      group: Tech
      agents:
        - name: technology-specialist
          responsibility: Technology consulting and technical guidance
  dispatch_protocol:
    can_lead_phases:
      - 0
      - 1
      - 2
      - 5
      - 6
    can_support_in: []
    auto_dispatch_to: []
    tier: high
    communication_style: sync
  role:
    description: Orchestrates Phases 0, 2, 5, 6. Enforces quality gates.
    scope: Managing workflow, coordinating multi-phase tasks, PM orchestration
---
