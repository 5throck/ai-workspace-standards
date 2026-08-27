# Appendix H: Knowledge Graph Examples

This appendix provides illustrative examples of how Safety OS data is structured within a graph database (e.g., Neo4j).

## 1. Compliance Traceability Subgraph

```cypher
// Worker completing training
(:Worker {id: "W-104"})-[:COMPLETED]->(:TrainingModule {id: "TM-05", name: "Confined Space Entry"})
(:TrainingModule {id: "TM-05"})-[:SATISFIES]->(:Regulation {act: "OSHA-KR", article: "Article 31"})

// Equipment linked to risk assessment
(:Equipment {id: "EQ-890", type: "Boiler"})-[:SUBJECT_TO]->(:RiskAssessment {id: "RA-2026-05"})
(:RiskAssessment {id: "RA-2026-05"})-[:IDENTIFIES]->(:Hazard {type: "Thermal", severity: "High"})
(:Hazard {type: "Thermal"})-[:MITIGATED_BY]->(:Control {type: "Engineering", description: "Pressure Relief Valve"})
```

## 2. Incident Causality Graph

```cypher
(:Incident {id: "INC-2026-004"})-[:OCCURRED_AT]->(:Location {zone: "Sector 7G"})
(:Incident {id: "INC-2026-004"})-[:INVOLVED]->(:Equipment {id: "EQ-112"})
(:Equipment {id: "EQ-112"})-[:FAILED_DUE_TO]->(:RootCause {category: "Maintenance Deficit"})
```

## Usage

Knowledge graphs are utilized by the `audit-agent` to rapidly query traceability paths between site activities and corresponding regulatory requirements.
