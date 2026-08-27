# Knowledge Graph Ingestion Architecture

## Overview
This document describes the process of parsing and ingesting `Legalize KR` Markdown files into the Safety OS Knowledge Graph. The graph consists of 8 core node types: `Regulation`, `Requirement`, `Control`, `Workflow`, `Incident`, `IndustryProfile`, `Worker`, and `TrainingRecord`.

## Ingestion Process

### 1. Document Parsing
The `Legalize KR` Markdown files contain structured legal basis and regulatory information for South Korea EHS compliance (OSHA-KR, SAPA).
- The Markdown is parsed to extract sections based on headers, such as **Section A — Legal Basis**.
- Metadata such as enforcement agency and law articles are extracted.

### 2. Node Extraction
Nodes are instantiated based on the extracted entities:
- **Regulation**: Core laws like OSHA-KR and SAPA.
- **Requirement**: Specific articles and clauses extracted from regulations.
- **Control**: Controls put in place to meet requirements.
- **Workflow**: Automated workflows dispatched for safety, linking to `legal_basis`.
- **Incident**: Logged incidents.
- **IndustryProfile**: Relevant industry requirements.
- **Worker / TrainingRecord**: Personnel data linked to requirements.

### 3. Edge Resolution
Relationships are dynamically constructed:
- `Requirement` -> `Regulation` (belongs to)
- `Control` -> `Requirement` (satisfies)
- `Workflow` -> `Requirement` (implements)
- `Incident` -> `Workflow` (triggers)
- `Worker` -> `TrainingRecord` (has)
- `TrainingRecord` -> `Requirement` (fulfills)

## Technologies
- Parsing: Custom AST parser for Markdown.
- Graph DB: Neo4j or lightweight local graph store for graph nodes and relationships.
