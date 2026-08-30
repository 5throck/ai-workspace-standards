---
name: security-scan
description: Runs static analysis and secret detection (via gitleaks) across the workspace.
version: 1.1.0
last_reviewed: 2026-08-30
status: active
scope: common
owner: pm
prerequisites: gitleaks
metadata:
  type: process
  triggers:
    - security scan
    - scan for vulnerabilities
    - security check
    - run security
---

# 🛠️ Skill: security-scan

## Context
Used by the `security-expert` agent to ensure that no hardcoded credentials or malicious scripts exist in the `ai-workspace-standards` repository.

## Execution Steps

1. Execute the built-in secret scan hook:
   - Check if `gitleaks` is available. If so, run `gitleaks detect -v`.
   - **Always pass the workspace config explicitly**: `gitleaks detect -v --config .gitleaks.toml`.
     Gitleaks only auto-discovers `.gitleaks.toml` in the scan target directory — a
     subdirectory scan (e.g. `--source templates`) without `--config` silently falls
     back to the upstream default ruleset, losing every workspace allowlist entry and
     reporting documentation placeholders as leaks (observed 2026-08-30).
   - For working-tree / untracked scans, add `--no-git` (config still required).
   - If not available, manually check `.env` patterns using regex search across all tracked files.
2. Verify `.githooks/` permissions (should be executable on Unix-like systems).
3. Verify `.gitignore` rules effectively exclude `memory/`, `scripts/temp/`, and `.env` files.
4. Report any security violations immediately.
