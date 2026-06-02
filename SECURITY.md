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

## Template Enforcement Strategy

We have shifted to a 644/755 model, meaning templates are fully writable on the filesystem. The Single Source of Truth (SSOT) architecture is now enforced primarily via Git `pre-commit` hooks that block direct changes to `templates/` instead of filesystem-level read-only locks. The only authorized mechanism to modify these files is through the `bun scripts/publish-to-template.ts` lifecycle script. 

Note that for scripts, Windows executable bits are maintained entirely via the Git Index (`+x`) rather than through Windows attributes.
