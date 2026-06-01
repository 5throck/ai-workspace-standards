---
status: Accepted
date: 2026-06-01
author: PM + scaffolding-expert
---

# ADR 0013: content_hash Field Removal and sync_version Retention

## Context

All variant README.md frontmatter contained a `content_hash: PLACEHOLDER` field intended to track sync state between workspace root documents and variant documents via SHA-based hash comparison. This mechanism was designed but never implemented — the field did nothing.

A `sync_version` integer field already exists and is actively maintained via CHANGELOG entries.

## Decision

Remove `content_hash: PLACEHOLDER` from all variant README frontmatter. Retain `sync_version` as the tracking mechanism. If hash-based sync automation is adopted in the future, the field can be re-added at that time with a working implementation.

## Consequences

- Eliminates confusion for new contributors who might assume content_hash is functional
- sync_version remains the single source of truth for README sync state
- Future hash-based automation is not precluded — this decision can be revisited via a new ADR
