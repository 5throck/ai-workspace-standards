---
name: update-bun-packages
status: active
scope: common
description: >
  Scans, updates, and upgrades Bun dependencies and packages across the AI workspace (L0)
  or standalone project (L1/L2) while ensuring lockfile consistency and security compliance.
  Use when: updating bun dependencies, upgrading packages, checking outdated packages in workspace or templates.
owner: pm
version: 1.1.0
last_reviewed: 2026-08-07
metadata:
  type: process
  triggers:
    - update bun packages
    - upgrade bun packages
    - bun update
    - update dependencies
    - upgrade dependencies
---

## Overview

This skill provides a layer-aware methodology for auditing, updating, and upgrading Bun packages and dependencies. It automatically detects whether it is running in **L0 (Workspace Maintainer)** or **L1/L2 (Standalone Project)** context and adapts its scope accordingly:

- **L0 Mode (Workspace Maintainer)**: Audits workspace root `package.json`, `templates/common/package.json`, and variant overlay `templates/co-*/package.json`, then propagates changes via `bun run propagate:apply`.
- **L1/L2 Mode (Standalone Project)**: Audits local project `./package.json` (and `./scripts/package.json` if present) without referencing non-existent template paths or attempting L0-only template propagation.

---

## When to Use This Skill

- **Routine Maintenance**: Regular dependency updates (patch & minor releases).
- **Security Patches**: Upgrading vulnerable packages reported by security advisories (`gitleaks`, `bun audit`, CVEs).
- **Template Synchronization (L0 Mode)**: Aligning package versions between workspace root (`package.json`) and `templates/common/package.json`.
- **Project Dependency Refresh (L1/L2 Mode)**: Refreshing dependencies in scaffolded or variant-based projects.

---

## Step 0: Layer Context Auto-Detection

Before scanning, determine the execution context by checking for the existence of `templates/common/`:

```bash
# Check execution layer
if [ -d "templates/common" ]; then
  MODE="L0_WORKSPACE_ROOT"
else
  MODE="L1_L2_STANDALONE_PROJECT"
fi
```

- **If `MODE == L0_WORKSPACE_ROOT`**: Follow L0 Workspace Root steps below.
- **If `MODE == L1_L2_STANDALONE_PROJECT`**: Follow L1/L2 Standalone Project steps below.

---

## Step 1: Scan & Audit Outdated Packages

### L0 Workspace Root Mode
1. **Target Locations**:
   - Workspace Root: `./package.json`
   - Common Template: `./templates/common/package.json`
   - Variant Overlays: `./templates/co-*/package.json`

2. **Run Outdated Scan**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun outdated
   ```

### L1/L2 Standalone Project Mode
1. **Target Locations**:
   - Project Root: `./package.json`
   - Script Subdirectory (if present): `./scripts/package.json`

2. **Run Outdated Scan**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun outdated
   ```

3. **Categorize Update Types**:
   - **Patch updates** (`x.y.Z` → `x.y.Z+1`): Bug fixes, non-breaking. Auto-approved.
   - **Minor updates** (`x.Y.z` → `x.Y+1.z`): New features, backward-compatible. Auto-approved after testing.
   - **Major updates** (`X.y.z` → `X+1.y.z`): Breaking API changes. Require manual code compatibility review.

---

## Step 2: Security & Compatibility Assessment

1. **License Audit**:
   Ensure all new or updated packages use OSI-approved licenses (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, LGPL-2.1+). Avoid GPL-3.0/AGPL-3.0/SSPL per Coding Guidelines §8.5.

2. **Core System Contracts**:
   Preserve essential type safety and build tooling:
   - `bun-types` / `@types/node` (TypeScript type safety)
   - `js-yaml` (YAML frontmatter parsing)
   - `gitleaks` (Secret scanning)

3. **Breaking Change Verification**:
   If upgrading major versions, search for target package imports using `grep_search` to verify API compatibility before modifying `package.json`.

---

## Step 3: Execute Package Updates & Lockfile Sync

### L0 Workspace Root Mode
1. **Execute Bun Update**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun update
   ```
2. **Align Common Template**:
   Sync shared dependency version strings in `./templates/common/package.json`.
3. **Propagate to Templates**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun run propagate:apply
   ```

### L1/L2 Standalone Project Mode
1. **Execute Bun Update**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun update
   ```
2. **Lockfile Refresh**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun install
   ```
3. *(Skip L0 `propagate:apply` — L1/L2 projects operate independently).*

---

## Step 4: Verification & Quality Gate

### L0 Workspace Root Mode
1. Run full workspace audit:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/audit.ts
   ```
2. Validate template integrity:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/validate-templates.ts
   ```
3. Run integration test suite:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun test
   ```
4. Execute `/sync` pipeline:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/dev-sync.ts --body-file ".git/sync-pr-body.md" "chore(deps): update bun packages and sync templates"
   ```

### L1/L2 Standalone Project Mode
1. Run local project QA gate / tests:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun test
   ```
2. Execute local `/sync` pipeline:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/dev-sync.ts --body-file ".git/sync-pr-body.md" "chore(deps): update bun packages"
   ```
