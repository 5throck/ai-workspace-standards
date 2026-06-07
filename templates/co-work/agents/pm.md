---
extends: ../../common/agents/pm.md
variant: co-work
variant_overrides:
  updated_role:
    description: "PM orchestrator - owns team assembly, design validation, and finalization"
    scope: "Starting multi-step tasks, coordinating parallel agents, reviewing feature requests, finalizing implementation"
  governance_workflow:
    phases: [0, 2, 6]
    triage_required: false
  agent_roster:
    - phase: "Research"
      group: "Analysis"
      agents: ["analyst"]
    - phase: "Content"
      group: "Content"
      agents: ["content-writer"]
    - phase: "Technical"
      group: "Documentation"
      agents: ["technical-writer"]
    - phase: "Coordination"
      group: "Management"
      agents: ["project-coordinator"]
    - phase: "Office"
      group: "Tools"
      agents: ["ms365-expert"]
    - phase: "Narrative"
      group: "Content"
      agents: ["storyteller"]
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    can_support_in: []
    auto_dispatch_to: ["analyst", "content-writer", "technical-writer", "project-coordinator", "ms365-expert", "storyteller"]
    tier: "high"
    communication_style: "sync"
---
