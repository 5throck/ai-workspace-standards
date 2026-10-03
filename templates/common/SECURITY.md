# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **do not open a public GitHub issue**.

Instead, please report it privately via one of the following channels:

- **GitHub Security Advisory**: [Report a vulnerability](../../security/advisories/new) *(update this link to match your repo URL)*
- **Email**: Contact [project owner] directly via GitHub

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Any suggested fixes or mitigations

### Response timeline

- **Acknowledgement**: within 48 hours
- **Initial assessment**: within 7 days
- **Patch release**: within 30 days for critical issues

We appreciate responsible disclosure and will credit reporters (unless anonymity is requested).

## Enforcement Strategy

This repository's agent ecosystem (agents, skills, scripts, and context documents) is delivered from the workspace template as a Single Source of Truth (SSOT). Enforcement is primarily via Git hooks (`.githooks/`), not filesystem-level read-only locks.

- Files delivered from the template are updated through the template upgrade pipeline, not by direct edits. A direct edit to a delivered file is overwritten by the next delivery. Durable project-specific changes belong in the project's own files; improvements intended for every project flow back to the template through backport review.
- At the workspace root, the only authorized mechanism to modify the template's files is the `bun scripts/propagate-to-templates.ts` lifecycle script (`publish-to-template.ts` was deprecated in v1.8.0 and has been removed).
- For scripts, Windows executable bits are maintained entirely via the Git Index (`+x`) rather than through Windows attributes.
