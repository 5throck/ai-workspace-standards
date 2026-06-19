---
name: lecture-version
version: 1.1.0
description: >
  Manages version snapshots of lecture files. Auto-backs up files before
  edits and restores prior versions on demand. Must be invoked by any other
  agent before modifying a file. Use for version history, restore, comparison.
  (Korean triggers: "이전 버전으로 돌아가고 싶어", "버전 목록 보여줘".)
---

## Role

Tracks every file change and manages snapshots so any prior state can be restored at any time.
**Must be called before any file modification by any agent — no exceptions.**

## When to Invoke

- **Right before another agent edits a file** (Storyline, Design, Build, Measure, Export, etc.)
- When the user says "go back to previous version" / "이전 버전으로 돌아가고 싶어"
- When the user says "show version list" / "버전 목록 보여줘"
- When PM Agent is about to do a destructive (overwrite) change

---

## Snapshot Creation

Always create a snapshot **before** editing a file.
**`--workspace` is required to scope to the project folder.**

```bash
# Single file
python scripts/snapshot.py slide_deck.md \
  --workspace presentations/<project> \
  --desc "shrink chapter 3 slide count" \
  --agent content

# Multiple files
python scripts/snapshot.py slide_deck.md storyline.md \
  --workspace presentations/<project> \
  --desc "full chapter restructure" \
  --agent content

# HTML file (large, snapshot only when needed)
python scripts/snapshot.py lecture_v1.html \
  --workspace presentations/<project> \
  --desc "backup before image swap" \
  --agent build

# Entire folder
python scripts/snapshot.py images/ \
  --workspace presentations/<project> \
  --desc "backup before image set swap" \
  --agent build
```

> File paths are relative to `--workspace`.

### --agent Value Rules

| Agent | --agent value |
|-------|--------------|
| PM Agent | `pm` |
| Research Agent | `research` |
| Storyline Agent | `storyline` |
| Design Agent | `design` |
| Build Agent | `build` |
| Measure Agent | `measure` |
| Export Agent | `export` |
| Manual backup | `manual` |

---

## Version List

```bash
python scripts/snapshot.py --workspace presentations/<project> --list
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
  ...
```

---

## Restore

```bash
# Restore to a specific version
python scripts/snapshot.py \
  --workspace presentations/<project> \
  --restore 2026-06-17_14-30_content_chapter-adjust

# Partial version ID also works (if uniquely matched)
python scripts/snapshot.py \
  --workspace presentations/<project> \
  --restore 2026-06-17_14-30
```

⚠️ Restore **automatically backs up the current file** before restoring. Regret after restore? Just restore again.

---

## Storage Layout

Snapshots live inside the **project folder** under `_versions/`.

```
presentations/<project>/
└── _versions/
    └── 2026-06-17_14-30_content_chapter-adjust/
        ├── slide_deck.md   # pre-edit original
        └── storyline.md    # pre-edit original
```

---

## VERSIONS.md Manifest

Each snapshot auto-appends an entry to the project's `VERSIONS.md`.

```markdown
## 2026-06-17_14-30_content_chapter-adjust

| Field | Value |
|------|------|
| Date | 2026-06-17 14:30 |
| Agent | content |
| Description | Shrink chapter 3 slide count |

Stored files:
  - `slide_deck.md` (45KB)

Restore command:
```bash
python scripts/snapshot.py \
  --workspace presentations/<project> \
  --restore 2026-06-17_14-30_content_chapter-adjust
```
```

---

## Collaboration Pattern

```
[Any agent wants to edit a file]
    ↓
[Call Version Agent first]
    python scripts/snapshot.py <file> \
      --workspace presentations/<project> \
      --desc "backup before change" --agent <agent>
    ↓
[Agent edits the file]
    ↓
[Done]
```

PM Agent enforces this order automatically.

---

## Caveats

- Consider adding `_versions/` to `.gitignore` (large folders make Git inefficient)
- HTML files are several hundred KB to several MB — snapshot only when layout changes
- `fonts/` doesn't need snapshots (re-downloadable any time via `download_font.py`)
- `layout_spec.json` and `pdf_layout_spec.md` become invalid when HTML changes — snapshot them together

---

## Tools

- `bash` — `scripts/snapshot.py`
