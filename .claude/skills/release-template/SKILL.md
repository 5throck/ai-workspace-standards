---
name: release-template
status: active
version: 1.0.0
description: >
  Automates template releases by bumping templates/VERSION, cutting templates/CHANGELOG.md,
  and creating the template git tag via tag-template.ts. Use when preparing or publishing a new template-vX.Y.Z release.
owner: pm
scope: workspace
l2_propagate: false
last_reviewed: 2026-09-09
metadata:
  type: release
  triggers:
    - release template
    - template release
    - bump templates version
    - tag template
    - publish template version
---

# Release Template

Use this skill only from the workspace root when preparing a template release.

## Procedure

1. Review pending template changes and decide the next semantic version.
2. Dry-run the atomic release helper:
   ```bash
   bun scripts/release-template.ts --version X.Y.Z --dry-run
   ```
   Use `--bump patch|minor|major` instead of `--version` when the current `templates/VERSION` should be incremented mechanically.
3. Prepare the release without publishing the tag remotely:
   ```bash
   bun scripts/release-template.ts --version X.Y.Z
   ```
   This updates `templates/VERSION`, moves `templates/CHANGELOG.md` `[Unreleased]` content into `## [X.Y.Z] - YYYY-MM-DD`, and creates the local `template-vX.Y.Z` tag through `tag-template.ts --no-push`.
4. Verify:
   ```bash
   bun scripts/validate-templates.ts
   bun scripts/verify-scripts.ts --verify
   ```
5. Publish only after the release commit is ready:
   ```bash
   git push origin template-vX.Y.Z
   ```
   Or run the helper with `--push` when remote publication should be part of the same operation.

## Safety Rules

- Do not edit `templates/VERSION`, `templates/CHANGELOG.md`, and template tags as separate manual steps.
- Use `--no-tag` only when testing changelog/version output in a temporary branch.
- If `tag-template.ts` fails, `release-template.ts` restores `templates/VERSION` and `templates/CHANGELOG.md` and deletes the local release tag.