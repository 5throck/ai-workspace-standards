# Graph Schema

## 1. Overview
This document defines the formal schema for the Safety OS Knowledge Graph, including node types, allowed relationships, and governance rules.

## 2. Node Types

- **RegulationNode**: Represents a specific article or clause from OSHA-KR or SAPA.
  - Properties: `ArticleID`, `Law`, `Description`, `EffectiveDate`
- **WorkflowNode**: Represents a standard operating procedure or automated playbook.
  - Properties: `WorkflowID`, `Name`, `Version`, `OwnerAgent`
- **AgentNode**: Represents a designated AI agent within Safety OS.
  - Properties: `AgentID`, `Role`, `Tier`
- **ExecutionNode**: Represents a specific instance of a workflow being run.
  - Properties: `ExecutionID`, `Timestamp`, `Status`
- **EvidenceNode**: Represents a generated artifact proving compliance.
  - Properties: `EvidenceID`, `Type`, `Hash`, `Location`

## 3. Relationships

- `(WorkflowNode)-[:SATISFIES_REQUIREMENT]->(RegulationNode)`
- `(AgentNode)-[:OWNS_WORKFLOW]->(WorkflowNode)`
- `(AgentNode)-[:EXECUTED]->(ExecutionNode)`
- `(ExecutionNode)-[:INSTANCE_OF]->(WorkflowNode)`
- `(ExecutionNode)-[:GENERATED_EVIDENCE]->(EvidenceNode)`
- `(EvidenceNode)-[:EVIDENCES_COMPLIANCE_WITH]->(RegulationNode)`

## 4. Governance Rules

1. **Orphan Prevention**: No WorkflowNode may exist without a `SATISFIES_REQUIREMENT` relationship to at least one RegulationNode.
2. **Evidence Integrity**: EvidenceNodes are immutable. Any correction requires a new ExecutionNode and a new EvidenceNode, linked to the previous one via an `UPDATES` relationship.
3. **Agent Authorization**: An AgentNode can only create an ExecutionNode for a WorkflowNode it is explicitly authorized to execute.
