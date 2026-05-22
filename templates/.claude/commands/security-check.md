Run the security monitor agent to scan for CVE/advisory updates for this project's stacks.

Arguments: $ARGUMENTS

## What this command does

1. Reads `docs/context.md` and detects manifest files to identify tech stacks
2. Web-searches for recent CVEs and security advisories (MEDIUM+ severity)
3. Saves new findings to `security/YYYY-MM-DD-{slug}.md`
4. Deletes `status: resolved` entries older than 7 days
5. Prints a summary of findings

## Usage

| Invocation | Behavior |
|------------|---------|
| `/security-check` | Run a one-time scan now (default) |
| `/security-check --pr` | Pre-PR advisory mode: scan `security/` and report active CRITICAL/HIGH |

**Recommended schedule**: run `/security-check` once a day, or use your OS task scheduler:
- **macOS/Linux**: `crontab -e` → `0 9 * * * cd /path/to/project && claude /security-check`
- **Windows**: Task Scheduler → trigger daily at 09:00

## Instructions

Invoke the `security-monitor` agent as defined in `agents/security-monitor.md`.

**If `$ARGUMENTS` contains `--pr`:**

Run **Workflow 2 — Pre-PR Advisory Check** from `agents/security-monitor.md`.
Do NOT run a new web search — only read existing `security/*.md` files.
Present findings and let the user decide whether to proceed or stop.

**Otherwise (default):**

Run **Workflow 1 — Daily Scan** from `agents/security-monitor.md`.
