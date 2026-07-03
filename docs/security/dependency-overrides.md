# Dependency Security Overrides

This document explains the `overrides` section in `package.json` and the CVEs each override addresses.

---

## hono >= 4.12.25

| Field | Value |
|-------|-------|
| **Package** | `hono` |
| **Override** | `>= 4.12.25` |
| **CVE** | CVE-2026-54286 / CVE-2026-54289 |
| **Severity** | Moderate–High |
| **Type** | Path Traversal |

### Description

Hono versions prior to 4.12.25 are affected by path traversal vulnerabilities in the `serveStatic` functionality. These allow an attacker to access files outside the intended serve directory by crafting requests with malformed URL paths.

The core issue relates to insufficient path normalization in the URL request handler. Raw incoming URLs were not properly sanitized before being used to resolve static file paths, enabling directory traversal attacks.

### References

- [GHSA-wgpf-jwqj-8h8p](https://github.com/honojs/hono/security/advisories/GHSA-wgpf-jwqj-8h8p)
- [CVE-2024-23340: Path Traversal in @hono/node-server](https://nvd.nist.gov/vuln/detail/CVE-2024-23340)
- [CVE-2024-32869: Restricted Directory Traversal in serveStatic with Deno](https://github.com/advisories/GHSA-3mpf-rcc7-5347)

---

## esbuild >= 0.28.1

| Field | Value |
|-------|-------|
| **Package** | `esbuild` |
| **Override** | `>= 0.28.1` |
| **Advisory** | GHSA-g7r4-m6w7-qqqr |
| **Severity** | High |
| **Type** | Directory Traversal (Windows) |

### Description

esbuild versions prior to 0.28.1 contain a **directory traversal vulnerability on Windows** when running the development server with `servedir`. The vulnerability arises because esbuild used `path.Clean()`, which only normalizes Unix-style paths. An attacker could traverse outside the serve directory on Windows by using the `\\` backslash character in HTTP requests, allowing arbitrary file reads from the host filesystem.

This was fixed in [esbuild v0.28.1](https://github.com/evanw/esbuild/blob/main/CHANGELOG.md) by properly sanitizing paths before serving files.

### References

- [GHSA-g7r4-m6w7-qqqr: Arbitrary file read via path traversal on Windows](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr)
- [esbuild CHANGELOG.md](https://github.com/evanw/esbuild/blob/main/CHANGELOG.md)

---

## Review Cadence

These overrides should be reviewed quarterly or whenever:
- A new release of the overridden package is published
- A new CVE is announced for these packages
- The dependency tree is significantly updated

Last reviewed: 2026-07-03
