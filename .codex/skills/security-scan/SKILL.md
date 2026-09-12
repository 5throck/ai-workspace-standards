---
name: security-scan
description: Runs static analysis, secret detection (via gitleaks), and dependency vulnerability auditing (via bun audit) across the workspace.
version: 1.2.0
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
2. Check dependency vulnerabilities (on-demand CVE gate):
   - Run `bun audit` in the repo root (and in any project directory under review).
   - Fail on **high or critical** vulnerabilities — same threshold as the CI gate
     (`.github/workflows/test.yml` "Security audit - dependency vulnerabilities").
     Low/moderate findings are reported as a summary without failing.
   - Remediation path: dispatch `update-bun-packages` (do not hand-edit lockfiles).
   - This complements CI: CI catches regressions at PR time, this step gives
     immediate visibility when a newly disclosed CVE arrives between runs.
3. Verify `.githooks/` permissions (should be executable on Unix-like systems).
4. Verify `.gitignore` rules effectively exclude `memory/`, `scripts/temp/`, and `.env` files.
5. Report any security violations immediately.
