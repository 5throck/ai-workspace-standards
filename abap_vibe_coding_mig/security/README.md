# Security Advisories

This directory contains active and recently-resolved security advisories for this project.

## File Format

Each advisory is stored as `YYYY-MM-DD-{slug}.md` with the following frontmatter:

```
---
date: YYYY-MM-DD
package: <package-name>
severity: CRITICAL | HIGH
cve: CVE-YYYY-NNNNN
status: active | resolved
source: local-scan | web-advisory
---
```

## Lifecycle

| Status | Meaning | Retention |
|--------|---------|-----------|
| `active` | Unfixed — upgrade required | Kept indefinitely |
| `resolved` | Fixed (upgraded or Dependabot merged) | Deleted after 7 days |

## Usage

- Run `/security-check` for a full daily scan.
- Run `/security-check --pr` for a pre-PR read-only advisory report.
- The security-monitor agent auto-resolves entries when Dependabot merges matching PRs.
