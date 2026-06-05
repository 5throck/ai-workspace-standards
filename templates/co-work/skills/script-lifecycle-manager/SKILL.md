---
name: script-lifecycle-manager
status: active
scope: common
description: >
  Manages the creation, versioning, deprecation, and maintenance of automation scripts
  across the workspace and templates. Use when: creating new scripts, updating script versions,
  deprecating scripts, or managing script dependencies in SCRIPTS.md.
owner: pm
version: 1.2.0
last_reviewed: 2026-05-30
metadata:
  type: process
  triggers:
    - create script
    - update script
    - deprecate script
    - script lifecycle
    - manage scripts
---

## Overview

This skill provides a systematic approach to managing the lifecycle of automation scripts (`scripts/*.sh`, `scripts/*.ps1`, `scripts/*.ts`) in accordance with CONSTITUTION.md §6.5. It ensures scripts are properly registered in `SCRIPTS.md`, have strict version bumps, handle dependencies, and follow deprecation protocols (90-day notice).

## When to Use This Skill

**Create New Script:**
- Trigger: "Create a new script for X"
- Action: Generate `.ts` or paired `.sh/.ps1` files, add execution permissions, and register in `SCRIPTS.md` as `active` version `1.0.0`.

**Update Existing Script:**
- Trigger: "Update the build script"
- Action: Modify the script, bump the version in `SCRIPTS.md`, and update `README.md` via `generate-scripts-readme.ts`.

**Deprecate Script:**
- Trigger: "Deprecate the old sync script"
- Action: Set `status: deprecated` and `removal-date` (current date + 90 days) in `SCRIPTS.md`.

## Lifecycle Management Rules

1. **Ownership Layers**:
   - L0 (SSOT): `scripts/` (workspace root). All development and registry (`SCRIPTS.md`) live here.
   - L1 (Template snapshot): `templates/common/scripts/`. Publish explicitly: `bun scripts/publish-to-template.ts`.
   - L2 (Project): `<project>/scripts/`. Snapshot of L1 at `new-project` creation time.
   - Never edit L1 directly; edit L0 and publish.
2. **State Management**:
   - `active`: In production use, bump version on change.
   - `deprecated`: Scheduled for removal, requires `removal-date`.
   - `experimental`: Unstable, not auto-propagated.
3. **Dependency Tracking**:
   - Must explicitly list dependencies in the `depends_on` column of `SCRIPTS.md`.
4. **Encoding & Compatibility**:
   - All `.ps1` files must include UTF-8 encoding safeguard: `$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;`
   - This assignment must be placed **after** the `param()` block. PowerShell rejects any executable statement before `param()` with `UnexpectedAttribute`, aborting the entire script.
5. **PS5.1 Error Propagation**:
   - When a `.ps1` script invokes another script with the `&` operator, `ErrorActionPreference=Stop` is inherited by the child. Git writes informational output to stderr even on success, which triggers `NativeCommandError` under `Stop`. All `git` calls (`clone`, `pull`, `add`, `commit`, `rev-parse`, etc.) must use:
     ```powershell
     try { git <command> 2>&1 | Out-Null } catch { }
     ```

## Step-by-Step Execution

### Step 1: Script Implementation
Implement the requested logic in the appropriate script file. If adding a new script, ensure both `.sh` and `.ps1` pairs are created (or use `.ts` for cross-platform). Apply the UTF-8 safeguard to `.ps1` files.

### Step 2: Update Registry
Update the `scripts/SCRIPTS.md` registry (L0 SSOT) with the new version, status, and any dependencies. After making changes, run `bun scripts/publish-to-template.ts` to propagate to L1.

### Step 3: Auto-generate Documentation
Run the `generate-scripts-readme.ts` script to ensure `README.md` is synchronized with `SCRIPTS.md`.

### Step 4: Verification
Run `bun scripts/verify-scripts.ts` (if available) to ensure dependencies are valid and no circular dependencies exist.
