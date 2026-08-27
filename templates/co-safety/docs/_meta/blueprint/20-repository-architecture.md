# Repository Architecture

## 1. Overview
The Safety OS repository is structured to separate regulatory data, agent logic, workflow definitions, and generated evidence. This clean architecture ensures security, maintainability, and auditability.

## 2. Directory Structure

### `agents/`
Contains markdown files defining the roles, permissions, and operational protocols of all Safety OS agents.

### `skills/`
Houses specialized execution modules. Each subdirectory contains a `SKILL.md` file adhering to the 3-section standard.

### `workflows/`
Contains markdown-based playbooks and standard operating procedures (SOPs). Every workflow must reference a `legal_basis`.

### `scripts/`
Contains TypeScript automation utilities, including validation gates, generators, and audit scripts.

### `memory/`
The local datastore for generated evidence, session logs, and compliance artifacts. Files here are treated as immutable records.

### `regulations/KR/`
Local cache of South Korean EHS regulations (OSHA-KR, SAPA) used for legal basis validation.

### `docs/`
System documentation, blueprints, and architectural decision records (ADRs).

## 3. Immutability and State
- **Stateless Components**: `agents/`, `skills/`, `workflows/`, and `scripts/` are considered stateless definitions.
- **Stateful Components**: `memory/` holds the state.
This separation allows the system logic to be updated without affecting historical compliance evidence.
