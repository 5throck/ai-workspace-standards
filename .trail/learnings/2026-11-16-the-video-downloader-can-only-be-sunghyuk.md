---
title: The video downloader can only be a declared external because it was relicensed to MIT; the template-level gitignore check failing is expected
author: SungHyuk
date: 2026-11-16
branch: pr/20261116-074445-chore-templates-workspace-sync-66-files
cost: { minutes: 7, tokens: 58483 }
id: l-9b839773
scope: repo
status: active
src: agent
touches:
  - templates/co-deck/external-deps.json
  - docs/designs/2026-11-16-quickdl-external-design.md
  - templates/co-deck/scripts/co-deck/download-videos.ts
---

## Decided
- QuickDL (the deck video downloader) is declared as a co-deck template external, pinned to a release tag. Its owner relicensed it from AGPL-3.0 to MIT first, because the workspace external-deps license policy denies AGPL with no per-manifest override.
- download-videos is the single adapter: it finds QuickDL in an explicit dir, then an env var, then the project's external clone, then the old personal path, and stages downloads outside the clone so the clone stays read-only.

## Tried and ruled out
- Declaring QuickDL while it was still AGPL: denied by policy ("only a reviewed change to the license policy can admit it"). Pinning to a branch or bare sha is not supported either; a release tag is required.

## Watch out
- `external-deps verify --manifest-only` run on a template folder always fails the gitignore-coverage check (V3), for co-work entries too; installs add the ignore rule to each project's .gitignore.
- The manifest install only clones; QuickDL's Python venv is a one-time manual setup.

In the code: templates/co-deck/external-deps.json (id quickdl, pin v1.0.0, commit 228044a); templates/co-deck/scripts/co-deck/download-videos.ts v1.1.0 (`selftest`); docs/designs/2026-11-16-quickdl-external-design.md; QuickDL PR 5throck/QuickDL#45.
