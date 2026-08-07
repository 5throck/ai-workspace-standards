---
name: update-bun-packages
status: active
scope: common
description: >
  Scans, updates, and upgrades Bun dependencies and packages across the AI workspace,
  templates/common, and template variants while ensuring lockfile consistency and security compliance.
  Use when: updating bun dependencies, upgrading packages, checking outdated packages in workspace or templates.
owner: pm
version: 1.0.0
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

This skill provides a structured methodology for auditing, updating, and upgrading Bun packages and dependencies across all layers of the workspace hierarchy:
- **Tier 1 (Workspace Root)**: `package.json` and `bun.lock` in the workspace root (`c:\git\ai_workspace\`).
- **Tier 2 (Common Template)**: `templates/common/package.json`.
- **Tier 2 Variant Overlays**: `templates/co-*/package.json` (e.g. `templates/co-deck/package.json`).
- **Tier 3 (Generated Projects)**: `Projects/*/package.json`.

It ensures non-breaking semver updates pass through smoothly, major version upgrades undergo compatibility review, and security/license compliance is maintained throughout the update cycle.

---

## When to Use This Skill

- **Routine Maintenance**: Regular dependency updates (patch & minor releases).
- **Security Patches**: Upgrading vulnerable packages reported by security advisories (`gitleaks`, `bun audit`, CVEs).
- **Template Synchronization**: Aligning package versions between workspace root (`package.json`) and `templates/common/package.json`.
- **Bun Version Upgrades**: Refreshing `@types/bun` or `bun-types` after upgrading Bun runtime.

---

## Step 1: Scan & Audit Outdated Packages

1. **Locate Target `package.json` Files**:
   - Workspace Root: `package.json`
   - Common Template: `templates/common/package.json`
   - Variant Overlays: `templates/co-*/package.json`

2. **Check for Outdated Dependencies**:
   Run `bun outdated` in the workspace root or inspect target directories:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun outdated
   ```

3. **Categorize Update Types**:
   - **Patch updates** (`x.y.Z` → `x.y.Z+1`): Bug fixes, non-breaking. Auto-approved.
   - **Minor updates** (`x.Y.z` → `x.Y+1.z`): New features, backward-compatible. Auto-approved after testing.
   - **Major updates** (`X.y.z` → `X+1.y.z`): Breaking API changes. Require manual review and code updates.

---

## Step 2: Security & Compatibility Assessment

1. **License Audit**:
   Ensure all new or updated packages use OSI-approved licenses (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0, LGPL-2.1+). Avoid GPL-3.0/AGPL-3.0/SSPL unless explicitly authorized per Coding Guidelines §8.5.

2. **Core Workspace Contracts**:
   Preserve essential workspace dependencies:
   - `bun-types` / `@types/node` (TypeScript type safety)
   - `js-yaml` (YAML frontmatter parsing)
   - `gitleaks` (Secret scanning)

3. **Breaking Change Verification**:
   If upgrading major versions, search the codebase for imports of the target package using `grep_search` to verify function signatures and API compatibility before editing `package.json`.

---

## Step 3: Execute Package Updates & Lockfile Sync

1. **Execute Bun Update**:
   - For workspace root:
     ```bash
     $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun update
     ```
   - For specific package upgrades:
     ```bash
     $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun add <package-name>@latest
     ```

2. **Sync `templates/common/package.json`**:
   Ensure dependencies shared between workspace root and `templates/common/package.json` maintain version alignment.

3. **Propagate to Templates**:
   Run the propagation tool to copy updated scripts and settings to `templates/common/`:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun run propagate:apply
   ```

---

## Step 4: Verification & Quality Gate

1. **Run Workspace Audit**:
   Verify documentation, script versions, and platform parity:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/audit.ts
   ```

2. **Run Template Validation**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/validate-templates.ts
   ```

3. **Run Integration Tests**:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun test
   ```

4. **Execute `/sync` Pipeline**:
   Commit, push, and open a PR for the package updates:
   ```bash
   $OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; bun scripts/dev-sync.ts --body-file ".git/sync-pr-body.md" "chore(deps): update bun packages and sync templates"
   ```
