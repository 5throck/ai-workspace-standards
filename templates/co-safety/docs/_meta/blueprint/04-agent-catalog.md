# Part IV — Agent Architecture

> **⚠️ Historical v4.0 design note (updated 2026-06):** The **CodeGraph** MCP and **Neo4j Knowledge Graph** described here were **NOT IMPLEMENTED** and have been archived (see [`_meta/archive/code-graph/README.md`](../archive/code-graph/README.md)). Live regulatory traceability uses `evidence-models/*.json` + workflow `legal_basis` fields + `regulations/KR/legal-glossary.yaml` SSOT. Graph references below are design history only.

## Document Control

| Property | Value |
|----------|-------|
| Document ID | 04-agent-catalog.md |
| Status | Draft |
| Date | 2026-06-05 |
| Classification | Internal |

## 15 Agent Catalog

The Safety OS agent ecosystem is composed of specialized agents, each designed to handle specific domains of the Environmental Health & Safety lifecycle. The rollout is structured across multiple priorities to ensure foundational capabilities are stabilized before introducing advanced functionalities.

### Priority 1 (MVP Scope)

These agents form the core of Safety OS and are essential for basic regulatory compliance and operational governance.

1.  **PM / Chief Safety Officer (CSO)**: The overarching orchestrator and gateway. Enforces the legal basis gate, manages permissions, and coordinates the entire agent ecosystem.
2.  **Safety Governance Manager (SGM)**: Responsible for EHS strategy, setting compliance objectives, defining KPIs, and tracking long-term SAPA/OSHA-KR goals.
3.  **Safety Workflow Manager (SWM)**: Handles operational dispatch, coordinates daily workflows on the manufacturing floor, and manages execution-level agent teams.
4.  **Compliance Agent**: Monitors regulatory changes, tracks specific OSHA-KR and SAPA requirements, and flags potential non-compliance in real-time.
5.  **Risk Assessment Agent**: Executes daily and periodic risk assessments, identifies hazards, scores risks, and maintains the centralized risk register.
6.  **Emergency Agent**: Coordinates emergency response protocols, manages incident escalations, and ensures immediate action during fires, spills, or injuries.
7.  **Audit Agent**: Validates evidence records, prepares audit trails, and ensures the organization is ready for regulatory inspections.

### Priority 2 (Phase 1)

These agents build upon the MVP to provide deeper operational control and incident management.

8.  **Process Safety Management (PSM) Agent**: Specializes in highly hazardous processes, managing Management of Change (MOC) workflows and Pre-Startup Safety Reviews (PSSR).
9.  **Incident Investigation Agent**: Conducts root cause analysis following an incident, interviewing data sources and generating comprehensive investigation reports.
10. **Contractor Safety Agent**: Manages the safety compliance of external vendors and contractors, ensuring their certifications and safety plans meet organizational standards.
11. **Asset & Maintenance Agent**: Tracks the safety status of physical machinery, schedules preventative maintenance, and links asset health to risk assessments.

### Priority 3 (Phase 2)

These agents introduce advanced capabilities for proactive learning, comprehensive reporting, and legal foresight.

12. **Training & Certification Agent**: Monitors employee safety training requirements, schedules sessions, and ensures no worker performs a task without valid certification.
13. **Reporting & Analytics Agent**: Aggregates data from all other agents to generate executive dashboards, predictive safety trends, and automated regulatory filings.
14. **Knowledge Graph Agent**: Constructs and queries a semantic knowledge graph of all safety entities (hazards, locations, personnel, regulations) to identify hidden systemic risks. *(NOT IMPLEMENTED — graph subsystem archived 2026-06; see [`_meta/archive/code-graph/README.md`](../archive/code-graph/README.md))*
15. **Legal Intelligence Agent**: Monitors proposed legislative changes, analyzes case law related to SAPA, and advises the SGM on future compliance strategies.
