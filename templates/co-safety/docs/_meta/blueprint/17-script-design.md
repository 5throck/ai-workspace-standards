# Script Design Standard

## 1. Overview
Automation within Safety OS is driven by a suite of standardized TypeScript (`.ts`) scripts. To ensure maintainability and predictability, all scripts must adhere to one of the six defined functional formats.

## 2. The 6 Script Type Formats

### 1. Verification Scripts (`verify-*.ts`)
- **Purpose**: Read-only scripts that check system state, formatting, or compliance without making any modifications.
- **Output**: Boolean pass/fail, exit code `0` (success) or `1` (failure).
- **Example**: `verify-agents.ts`

### 2. Generator Scripts (`generate-*.ts`)
- **Purpose**: Automates the creation of boilerplate files, documentation, or evidence artifacts based on templates.
- **Output**: Newly created files or updated directories.
- **Example**: `generate-playbook.ts`

### 3. Sync Scripts (`sync-*.ts`)
- **Purpose**: Synchronizes data between external sources (e.g., APIs, repositories) and the local workspace.
- **Output**: Updated local cache or standardized JSON representations.
- **Example**: `sync-legalize-kr.ts` *(removed 2026-08-26 — superseded by the `k-law` skill's live 법제처 Open API queries)*

### 4. Audit Scripts (`audit-*.ts`)
- **Purpose**: Comprehensive validation scripts run during QA gates (Phase 6). They aggregate multiple verifications and produce an audit log.
- **Output**: Audit report generation and an aggregate exit code.
- **Example**: `safety-audit.ts`

### 5. Migration Scripts (`migrate-*.ts`)
- **Purpose**: Updates schemas, data formats, or directory structures across versions.
- **Output**: Modified files reflecting the new structural version.
- **Example**: `migrate-evidence-v2.ts`

### 6. Utility Scripts (`util-*.ts`)
- **Purpose**: Reusable helper modules that do not run independently but are imported by other scripts.
- **Output**: Exported functions and types.
- **Example**: `util-logger.ts`

## 3. Implementation Rules
All scripts must:
- Be written in TypeScript.
- Include a `@version` docblock.
- Be registered in `scripts/SCRIPTS.md`.
- Be executed via `bun run`.
