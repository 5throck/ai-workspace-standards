# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | -       |

## Reporting a Vulnerability

If you discover a security vulnerability in this project, **do not open a public GitHub issue**.

Instead, please report it privately via one of the following channels:

- **GitHub Security Advisory**: [Report a vulnerability](../../security/advisories/new) *(preferred)*
- **Email**: Contact [@5throck](https://github.com/5throck) directly via GitHub

### What to include

- A description of the vulnerability and its potential impact
- Steps to reproduce the issue
- Any suggested fixes or mitigations

### Response timeline

- **Acknowledgement**: within 48 hours
- **Initial assessment**: within 7 days
- **Patch release**: within 30 days for critical issues

We appreciate responsible disclosure and will credit reporters (unless anonymity is requested).

## OS-Level Read-Only Template Enforcement Strategy

All files in `templates/common/` (L1 snapshot) are strictly protected by OS-level read-only locks (`0o444` / `+R`). The only authorized mechanism to modify these files is through the `bun scripts/publish-to-template.ts` lifecycle script, which temporarily lifts the lock, performs the L0->L1 sync, and reapplies the lock. Manual bypasses (e.g., direct `cp` commands or file writes) are structurally prohibited to enforce the Single Source of Truth (SSOT) architecture.
