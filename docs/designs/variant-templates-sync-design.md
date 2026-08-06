# Variant Templates Synchronization and Settings Drift Resolution

**schemaVersion**: 1.0.0
**spec-id**: variant-templates-sync

## 1. Overview and Objectives
This document details the architectural design and operational steps for synchronizing variant templates and resolving settings drift within the AI Workspace environment. The primary goals are:
- Ensure consistent propagation of core scripts and configurations from the root workspace (L0) to common templates (L1).
- Resolve settings drift across all platform variants (L2).
- Ensure all platform hooks and documentation are aligned and verified.

## 2. L0→L1 Propagation Strategy
The L0→L1 propagation ensures that core assets at the workspace root are correctly distributed to the shared template environment.

### 2.1 Synchronization Command
To synchronize L0 core scripts, helpers, hooks, and skills to L1 (`templates/common/`), execute the following command:
```bash
bun scripts/propagate-to-templates.ts --apply
```

### 2.2 Version Updates
As part of the propagation, the following key scripts must be updated to their latest stable versions:
- `dev-sync.ts`: Update to **v1.5.0**.
- `test-runner.ts`: Update to **v1.1.0**.

These updates introduce stability enhancements and improved performance metrics for downstream templates.

## 3. L1→L2 Platform Settings Drift Resolution
To maintain environment consistency, we must resolve configuration drifts between L1 and the specialized L2 variants.

### 3.1 Settings Synchronization
The platform settings configuration (`.gemini/settings.json`) must be synchronized across all 7 L2 variants:
- `co-consult`
- `co-deck`
- `co-design`
- `co-develop`
- `co-game`
- `co-security`
- `co-work`

### 3.2 Platform Hook Alignment
Ensure the following platform hooks are fully aligned and functioning correctly across all variants:
- `BeforeTool`: Pre-execution validation.
- `AfterTool`: Post-execution cleanup and logging.
- `PreCompress`: Asset optimization prior to deployment.

## 4. Documentation and Scaffolding Verification
Following the synchronization process, documentation must be updated and the environment thoroughly verified.

### 4.1 Documentation Updates
Update the template documentation to reflect the latest synchronization process and architectural changes:
- `templates/README.md`
- `templates/README_ko.md`

### 4.2 Verification and Auditing
To confirm the integrity of the synchronization and scaffolding processes, run the following verification scripts:

1. **E2E Scaffolding Simulation**:
   ```bash
   bun scripts/simulate-project-creation.ts
   ```

2. **Template Audit**:
   ```bash
   bun scripts/validate-templates.ts
   ```

Executing these scripts ensures that newly created projects from templates correctly inherit the updated configurations and scripts without runtime errors.
