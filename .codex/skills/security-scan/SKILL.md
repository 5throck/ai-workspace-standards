---
name: security-scan
description: Runs static analysis, secret detection (via gitleaks), dependency vulnerability auditing (via bun audit), and auth-surface auditing (unauthenticated signup endpoints) across the workspace.
version: 1.3.0
last_reviewed: 2026-11-04
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
5. Auth-surface audit — unauthenticated registration/signup endpoints (added v1.3.0, T-20261103-006):
   - Sweep each web app under review (variant templates and `Projects/<co-x>/app`
     web trees) for account-creation endpoints reachable WITHOUT an authenticated
     session (register / signup / self-service invite acceptance), and determine
     which authenticated role a successful signup grants.
   - **Flag as a finding any unauthenticated signup endpoint that grants ANY
     authenticated role** — a default-open auth surface lets anyone who can reach
     the login page mint an account and inherit everything that role can read
     (business pipelines, MNPI-adjacent material). Default-open is the finding;
     the granted role's privilege only sets the severity.
   - Reference remediation shape (co-newbiz #796,
     `Projects/co-newbiz/app/web-next/app/api/auth/register/route.ts`, owner
     decision 2026-11-02):
     1. **Default-closed**: registration refused unless an explicit environment
        flag enables it (co-newbiz: `CO_NEWBIZ_ALLOW_REGISTER === "1"`, read per
        request so an operator can flip it without a code change);
     2. **Refusal BEFORE body-parse and throttle**: while closed the endpoint
        returns one uniform 403 at the door — no request-shape oracle, no
        rate-limit quota consumption by closed-surface traffic;
     3. **Dated owner-decision comment** in the route source (who closed it,
        when, why, and which provisioning paths are unaffected);
     4. **Admin-provisioned accounts** as the default identity path (CLI or
        admin-session-gated flows, never public signup);
     5. **Documented reversibility**: the enabling flag recorded in the env
        sample so reopening is a deliberate operator action.
6. Report any security violations immediately.
