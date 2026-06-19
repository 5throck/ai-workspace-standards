---
name: version
version: 1.0.0
description: >
  Manages version snapshots of lecture files. Auto-backs up files before
  edits and restores prior versions on demand. Must be invoked by any other
  agent before modifying a file. Use for version history, restore, comparison.
  (Korean triggers: "이전 버전으로 돌아가고 싶어", "버전 목록 보여줘".)
---
# Version Agent — Version Control

**Stage**: Before/after every file edit (Cross-cutting)  
**Output**: `presentations/<project>/_versions/`, `VERSIONS.md`  
**Full instructions**: `agents/version.md`

## Role

Tracks every file change and manages snapshots so any prior state can be restored at any time.
**Must be called before any file modification by any agent — no exceptions.**

## When to Invoke

- Before another agent edits a file (always, without exception)
- When the user says "go back to previous version" / "이전 버전으로 돌아가고 싶어"
- When the user says "show version list" / "버전 목록 보여줘"
- Before any destructive (overwrite) change

## Quick Reference

```bash
# Snapshot before editing (required before every file change)
python scripts/snapshot.py <file> \
  --workspace presentations/<project> \
  --desc "<what is about to change>" \
  --agent <agent>

# List versions
python scripts/snapshot.py --workspace presentations/<project> --list

# Restore to a previous version
python scripts/snapshot.py \
  --workspace presentations/<project> \
  --restore <version_id>
```

**`--agent` values**: `pm` · `research` · `content` · `design` · `build` · `measure` · `export` · `manual`

**File paths** are relative to `--workspace` (e.g., `slide_deck.md`, not the full path).

**Caveats**: HTML files are large — snapshot only when needed. `fonts/` doesn't need snapshots (re-downloadable). `layout_spec.json` and `pdf_layout_spec.md` become invalid when HTML changes — snapshot them together.

→ Storage layout, VERSIONS.md format, restore examples: see `agents/version.md`
