---
name: version
scope: co-deck
version: 1.3.0
description: >
  Manages version snapshots of lecture files. Auto-backs up files before edits
  and restores prior versions on demand. Must be called before any file
  modification by any agent. Responds to "go back to previous version", "show
  version list".
  Cross-cutting — applies to all workflow stages.
status: active
owner: version
last_reviewed: 2026-06-20
prerequisites: none
---

## Context

Tracks every file change and manages snapshots so any prior state can be restored at any time. This is a cross-cutting skill — it must be called **before any file modification by any other agent**, without exception. PM Agent enforces this order automatically.

## When to Use

- Before another agent edits a file (Storyline, Design, Build, Measure, Export, etc.)
- User says "go back to previous version"
- User says "show version list"
- PM Agent is about to perform a destructive (overwrite) change

---

## Execution Steps

### Step 1: Create Snapshot (before any edit)

Always create a snapshot **before** editing a file. `--workspace` is required.

```bash
# Single file
bun scripts/co-deck/snapshot.ts slide_deck.md \
  --workspace presentations/<project> \
  --desc "shrink chapter 3 slide count" \
  --agent content

# Multiple files
bun scripts/co-deck/snapshot.ts slide_deck.md storyline.md \
  --workspace presentations/<project> \
  --desc "full chapter restructure" \
  --agent content

# HTML file (large — snapshot only when layout changes)
bun scripts/co-deck/snapshot.ts lecture_v1.html \
  --workspace presentations/<project> \
  --desc "backup before image swap" \
  --agent build

# Diagram assets (shared pool)
bun scripts/co-deck/snapshot.ts ../assets/diagrams/ \
  --workspace presentations/<project> \
  --desc "backup before diagram regeneration" \
  --agent build
```

> File paths are relative to `--workspace`.

**`--agent` value rules:**

| Agent | `--agent` value |
|-------|----------------|
| PM Agent | `pm` |
| Research Agent | `research` |
| Storyline Agent | `storyline` |
| Design Agent | `design` |
| Build Agent | `build` |
| Measure Agent | `measure` |
| Export Agent | `export` |
| Manual backup | `manual` |

---

### Step 2: List Versions

```bash
bun scripts/co-deck/snapshot.ts --workspace presentations/<project> --list
```

Example output:

```
──────────────────────────────────────────────────────────
  Stored versions (5, newest first)
──────────────────────────────────────────────────────────
  [ 1] 2026-06-17_16-00_build_image-swap-backup
        Files: 3 / Size: 2.4MB
  [ 2] 2026-06-17_14-30_content_chapter-adjust
        Files: 2 / Size: 45KB
```

---

### Step 3: Restore a Version

```bash
# Full version ID
bun scripts/co-deck/snapshot.ts \
  --workspace presentations/<project> \
  --restore 2026-06-17_14-30_content_chapter-adjust

# Partial version ID (if uniquely matched)
bun scripts/co-deck/snapshot.ts \
  --workspace presentations/<project> \
  --restore 2026-06-17_14-30
```

> Restore **automatically backs up the current file** before restoring. If you regret the restore, run `--restore` again on the new backup.

---

## Output Format

Snapshots are stored under `presentations/<project>/_versions/`:

```
presentations/<project>/
└── _versions/
    └── 2026-06-17_14-30_content_chapter-adjust/
        ├── slide_deck.md
        └── storyline.md
```

Each snapshot auto-appends an entry to `presentations/<project>/VERSIONS.md` with date, agent, description, file sizes, and restore command.

**Caveats:**
- Add `_versions/` to `.gitignore` — large folders make Git inefficient
- HTML files are 100KB–several MB; snapshot only on layout changes
- `presentations/assets/fonts/` does not need snapshots — re-downloadable any time via `download-font.ts`
- Snapshot `layout_spec.json` + `pdf_layout_spec.md` together when HTML layout changes (they become invalid if HTML changes)

## Related Skills

- `html-build` — must call this skill before editing the HTML file
- `storyline` — must call this skill before editing `slide_deck.md` or `storyline.md`
- `measure` — must call this skill before re-running measurement (snapshots `layout_spec.json`)
