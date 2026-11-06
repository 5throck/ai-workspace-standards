# Vendor Notice — security-audit

This directory contains content vendored from an upstream open-source project. The vendored files are third-party work, not co-security original content.

| Field | Value |
|-------|-------|
| Upstream repository | https://github.com/cloudflare/security-audit-skill |
| Pinned upstream SHA | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` (2026-09-14, "Clarify guidance and full audit modes") |
| Vendored on | 2026-11-07 |
| License | MIT — Copyright (c) 2025-2026 Cloudflare, Inc. |
| Design doc | `docs/designs/2026-11-07-security-audit-skill-adoption-design.md` |
| Decision record | `docs/decisions/DEC-20261107-01.md` (vendoring), `docs/decisions/DEC-20261107-02.md` (L2 promotion + version alignment) |
| Workspace adoption version | 1.1.0 (SKILL.md frontmatter; bumped from 1.0.0 after hub_topology consumer-floor alignment, DEC-20261107-02 — upstream content unchanged) |

## License attribution

The upstream project is licensed under the MIT License (Copyright (c) 2025-2026 Cloudflare, Inc.). Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction, including the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies, subject to the copyright and permission notice being included in all copies or substantial portions of the software. The full license text is available in the upstream repository (`LICENSE`, repo root) and is carried here by reference per the design doc's decision not to copy repo-root files into the skill folder.

## Body-unmodified rule

All upstream files in this folder are byte-for-byte copies of the pinned SHA, with exactly one exception: `SKILL.md`'s YAML frontmatter block was extended with hub-required metadata (`version`, `status`, `owner`, `scope`, `last_reviewed`, `prerequisites`, `upstream`, `relates_to`, `metadata`). The body below the frontmatter is unmodified.

**Never hand-edit upstream file bodies.** Future upstream updates must re-vendor from a freshly pinned, reviewed SHA (clone, verify `rev-parse HEAD` against the new pin, copy, re-diff, re-run the verification plan) — see the design doc's "Upstream refresh policy" follow-up. `VENDOR-NOTICE.md` is the only added file in this folder and lives outside upstream's namespace so future re-vendor diffs stay clean.

## Files

All 20 files under this directory other than this notice are upstream content at the pinned SHA: `SKILL.md` (frontmatter extended, body verbatim), 14 phase/attack-class guides, `report-schema.json`, 2 validators (`validate-findings.cjs`, `validate-coverage-ledger.cjs`), and their 2 test files.
