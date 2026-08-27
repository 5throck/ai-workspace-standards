# Appendix A: Agent Definitions

> **⚠️ Historical v4.0 design note (updated 2026-06):** The **CodeGraph** MCP and **Neo4j Knowledge Graph** described here were **NOT IMPLEMENTED** and have been archived (see [`_meta/archive/code-graph/README.md`](../../archive/code-graph/README.md)). Live regulatory traceability uses `evidence-models/*.json` + workflow `legal_basis` fields + `regulations/KR/legal-glossary.yaml` SSOT. Graph references below are design history only.

This appendix provides a summary of the 15 agents comprising the Safety OS system. Each agent has a distinct operational boundary and regulatory mandate under South Korean EHS laws.

## 1. Orchestration

### PM / Chief Safety Officer (CSO)
**Tier**: High
**Role**: Escalation gateway and primary orchestration agent. Enforces the `legal_basis` gate on all EHS workflows to ensure compliance with OSHA-KR and SAPA. 

## 2. Safety Management

### Safety Governance Manager
**Tier**: High
**Role**: Establishes high-level strategy, safety targets, and SAPA compliance objectives. Operates annually and quarterly.

### Safety Workflow Manager
**Tier**: Medium
**Role**: Operational dispatch agent. Coordinates daily workflows and manages the agent teams operating on the manufacturing floor.

### Training Agent
**Tier**: Medium
**Role**: Tracks safety training requirements and generates training curricula. Logs worker compliance into the knowledge graph.

### PSM Agent
**Tier**: Medium
**Role**: Oversees the 12 elements of Process Safety Management under OSHA-KR Article 44. Approves Management of Change (MOC) and supports HAZOP.

### Asset Integrity Agent
**Tier**: Medium
**Role**: Manages preventative maintenance schedules and oversees the safe operation of aging equipment to prevent mechanical failures.

### Contractor Safety Agent
**Tier**: Medium
**Role**: Facilitates onboarding and safety monitoring for external workers, ensuring contractors adhere to site safety protocols.

## 3. Compliance & Risk

### Compliance Agent
**Tier**: Medium
**Role**: Monitors site conditions and administrative records against OSHA-KR and SAPA requirements, flagging non-compliance immediately.

### Legal Agent
**Tier**: Medium
**Role**: Analyzes text from South Korean EHS legislation, providing real-time interpretation for the other agents.

### Risk Assessment Agent
**Tier**: Medium
**Role**: Executes structured daily risk assessments, identifies workplace hazards, and updates the centralized risk register.

### Reporting Agent
**Tier**: Medium
**Role**: Calculates safety KPIs (e.g., TRIR, LTIR, near-misses) and generates structured safety performance reports.

## 4. Emergency & Audit

### Emergency Agent
**Tier**: High
**Role**: Activates critical response protocols during a crisis (e.g., fire, spill, injury) and manages incident escalation workflows.

### Disaster Response Agent
**Tier**: High
**Role**: Handles protocols specific to natural disasters such as typhoons, floods, or earthquakes.

### Incident Investigation Agent
**Tier**: Medium
**Role**: Conducts root cause analysis (RCA), including 5-Why analysis, following any reported incident or near-miss.

### Audit Agent
**Tier**: Medium
**Role**: Prepares audit trails, validates the integrity of evidence records, and ensures regulatory inspection readiness.
