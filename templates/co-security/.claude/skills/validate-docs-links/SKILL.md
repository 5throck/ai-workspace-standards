---
name: validate-docs-links
description: Scans Markdown documentation for dead links and file reference errors.
version: 1.0.0
last_reviewed: 2026-05-30
status: active
owner: docs-writer
prerequisites: Python or grep
metadata:
  type: process
  triggers:
    - validate links
    - check links
    - broken links
    - docs validation
---

# 🛠️ Skill: validate-docs-links

## Context
Used by the `auditor` or `docs-writer` to ensure all cross-references in the workspace are valid.

## Execution Steps

1. Recursively search all `.md` files for URL structures like `[link](path/to/file)` or `file:///path`.
2. Extract the paths and verify they actually point to existing files on disk.
3. Check `AGENTS.md` and verify all linked agent definitions physically exist in the `agents/` directory.
4. Update or remove any dead links found.
