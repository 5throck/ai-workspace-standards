---
extends: ../../common/agents/pm.md
variant: co-security
remove_sections: []
variant_overrides:
  governance_workflow:
    phases:
      - 0
      - 2
      - 6
    triage_required: false
  agent_roster:
    - phase: Threat Modeling
      group: Red Team
      agents:
        - name: red-team-lead
          responsibility: Red team operations and adversarial simulation
    - phase: Penetration Testing
      group: Red Team
      agents:
        - name: pentester
          responsibility: Penetration testing and vulnerability exploitation
    - phase: Threat Analysis
      group: Analysis
      agents:
        - name: threat-modeler
          responsibility: Threat modeling and risk assessment
    - phase: Remediation
      group: Blue Team
      agents:
        - name: patch-engineer
          responsibility: Vulnerability remediation and patch deployment
    - phase: Reporting
      group: Documentation
      agents:
        - name: report-writer
          responsibility: Security reporting and documentation
  dispatch_protocol:
    can_lead_phases:
      - 0
      - 2
      - 6
    can_support_in: []
    auto_dispatch_to:
      - red-team-lead
      - pentester
      - threat-modeler
      - patch-engineer
      - report-writer
    tier: high
    communication_style: sync
  role:
    description: PM orchestrator for security engagements
    scope: >-
      Authorization verification, threat modeling, security findings management,
      engagement closure
---
