---
name: security-scan
description: Runs static analysis and secret detection (via gitleaks) across the workspace.
version: 1.0.0
last_reviewed: 2026-05-30
status: active
scope: common
owner: security-expert
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
   - If not available, manually check `.env` patterns using regex search across all tracked files.
2. Verify `.githooks/` permissions (should be executable on Unix-like systems).
3. Verify `.gitignore` rules effectively exclude `memory/`, `scripts/temp/`, and `.env` files.
4. Report any security violations immediately.
