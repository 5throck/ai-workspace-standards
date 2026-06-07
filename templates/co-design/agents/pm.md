---
extends: ../../common/agents/pm.md
variant: co-design
remove_sections:
  - "## Role"
  - "## ⚠️ ROLE CLARIFICATION"
  - "## 🚨 YOU ARE THE SINGLE ENTRY POINT"
  - "## ?좑툘 YOU ARE THE SINGLE ENTRY POINT"
  - "## ⚠️ CRITICAL: PM Direct Execution Constraints"
variant_overrides:
  updated_role:
    description: "PM orchestrator - owns team assembly, design validation, and finalization"
    scope: "Multi-step task coordination, parallel agent dispatch, feature request review, implementation finalization"
  governance_workflow:
    phases: [0, 2, 6]
    triage_required: false
  agent_roster:
    - phase: "Research"
      group: "Research"
      agents: ["ux-researcher"]
    - phase: "Direction"
      group: "Design"
      agents: ["design-lead"]
    - phase: "Visual"
      group: "Design"
      agents: ["visual-designer"]
    - phase: "Prototype"
      group: "Execution"
      agents: ["prototype-engineer"]
    - phase: "Service"
      group: "Design"
      agents: ["service-designer"]
    - phase: "Typography"
      group: "Design"
      agents: ["typography-expert"]
    - phase: "Narrative"
      group: "Content"
      agents: ["storyteller"]
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    can_support_in: []
    auto_dispatch_to: ["ux-researcher", "design-lead", "visual-designer", "prototype-engineer", "service-designer", "typography-expert", "storyteller"]
    tier: "high"
    communication_style: "sync"
---
