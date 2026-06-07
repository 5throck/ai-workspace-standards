---
extends: ../../common/agents/pm.md
variant: co-consult
variant_overrides:
  updated_role:
    description: "Orchestrates Phases 0, 2, 5, 6. Enforces quality gates."
    scope: "Managing workflow, coordinating multi-phase tasks, PM orchestration"
  governance_workflow:
    phases: [0, 1, 2, 5, 6]
    triage_required: false
  agent_roster:
    - phase: "Triage / Analysis"
      group: "Analysis"
      agents: ["auditor"]
    - phase: "Consulting"
      group: "Client"
      agents: ["engagement-leader"]
    - phase: "Consulting"
      group: "Strategy"
      agents: ["strategy-analyst"]
    - phase: "Consulting"
      group: "Domain"
      agents: ["industry-expert"]
    - phase: "Consulting"
      group: "Change"
      agents: ["change-management-partner"]
    - phase: "Consulting"
      group: "Comm"
      agents: ["communications-lead"]
    - phase: "Technology"
      group: "Architecture"
      agents: ["solutions-architect"]
    - phase: "Delivery"
      group: "PMO"
      agents: ["workstream-lead", "delivery-manager"]
    - phase: "Subject Matter"
      group: "SME"
      agents: ["sme"]
    - phase: "Analysis"
      group: "Data"
      agents: ["data-analyst"]
    - phase: "Technology"
      group: "Tech"
      agents: ["technology-specialist"]
  dispatch_protocol:
    can_lead_phases: [0, 1, 2, 5, 6]
    can_support_in: []
    auto_dispatch_to: []
    tier: "high"
    communication_style: "sync"
---
