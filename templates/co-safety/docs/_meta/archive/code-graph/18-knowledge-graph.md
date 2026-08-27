# Knowledge Graph Traceability

## 1. Overview
The Safety OS Knowledge Graph Traceability Model provides a rigorous framework for linking regulatory requirements to operational workflows, agent actions, and generated evidence. This ensures that every action taken within the system can be traced back to a specific legal basis.

## 2. Traceability Model

### 2.1 The Regulatory Foundation
At the core of the graph are regulatory nodes representing specific articles and clauses from OSHA-KR and SAPA. These form the immutable foundation of the traceability tree.

### 2.2 Operational Mapping
Workflows and Playbooks are directly linked to Regulatory Nodes via `SATISFIES_REQUIREMENT` relationships. This guarantees that all operational procedures exist to fulfill a legal mandate.

### 2.3 Agent Execution Trace
When an agent executes a workflow, it generates an Execution Node. This node connects to the Workflow Node and records the agent ID, timestamp, and context.

### 2.4 Evidence Generation
The final output of an execution is an Evidence Node (e.g., an incident report or inspection record). The graph links the Evidence Node back to the Execution Node (`GENERATED_BY`) and ultimately to the Regulatory Node (`EVIDENCES_COMPLIANCE_WITH`).

## 3. Audit Readiness
By traversing the knowledge graph from Evidence -> Execution -> Workflow -> Regulation, auditors can instantaneously verify the compliance status of the organization. The `audit-agent` leverages this graph to automatically compile regulatory inspection readiness reports.
