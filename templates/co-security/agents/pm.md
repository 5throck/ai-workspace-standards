---
extends: ../../common/agents/pm.md
variant: co-security
remove_sections:
  - "## Role"
  - "## ⚠️ ROLE CLARIFICATION"
  - "## 🚨 YOU ARE THE SINGLE ENTRY POINT"
  - "## ?좑툘 YOU ARE THE SINGLE ENTRY POINT"
  - "## ⚠️ CRITICAL: PM Direct Execution Constraints"
variant_overrides:
  updated_role:
    description: "PM orchestrator for security engagements"
    scope: "Authorization verification, threat modeling, security findings management, engagement closure"
  governance_workflow:
    phases: [0, 2, 6]
    triage_required: false
  agent_roster:
    - phase: "Threat Modeling"
      group: "Red Team"
      agents: ["red-team-lead"]
    - phase: "Penetration Testing"
      group: "Red Team"
      agents: ["pentester"]
    - phase: "Threat Analysis"
      group: "Analysis"
      agents: ["threat-modeler"]
    - phase: "Remediation"
      group: "Blue Team"
      agents: ["patch-engineer"]
    - phase: "Reporting"
      group: "Documentation"
      agents: ["report-writer"]
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    can_support_in: []
    auto_dispatch_to: ["red-team-lead", "pentester", "threat-modeler", "patch-engineer", "report-writer"]
    tier: "high"
    communication_style: "sync"
---
