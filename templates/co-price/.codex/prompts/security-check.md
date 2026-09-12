---
name: security-check
description: Run security advisory scan (daily mode) or pre-PR advisory check (--pr flag).
argument-hint: "[--pr]"
allowed-tools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch"]
---

# Security Check

Arguments: $ARGUMENTS

Run the security monitor agent.

- **No arguments** (or `--scan`): Run a full daily scan — local vulnerability scan, web advisory lookup, deduplication, save findings to `security/`, Dependabot auto-resolve, age cleanup.
- **`--pr`**: Pre-PR advisory check — read-only. Report existing active advisories from `security/`. No new scan.

Load and follow `agents/security-monitor.md` exactly.

- For default/`--scan` mode: execute Workflow 1 (Daily Scan).
- For `--pr` mode: execute Workflow 2 (Pre-PR Advisory Check).

Report the results clearly to the user.
