---
name: version
phases: [0, 1, 2, 3, 4, 5, 6]
handoff_to: []
handoff_from: [pm, research, storyline, design, html-build, measure, pdf-export]
required_skills: [lecture-version]
---

# Version Agent — Version Control

**Stage**: Before/after every file edit (Cross-cutting)  
**Output**: `presentations/<project>/_versions/`, `VERSIONS.md`

## Role

Tracks every file change during lecture material production and manages snapshots so any prior state can be restored at any time.

---

## When to Call

- **Right before another agent edits a file** (Content Agent, Build Agent, Design Agent, etc.)
- When the user says "I want to go back to a previous version"
- When the user says "show me the version list"
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
|---------|-----------|
| PM Agent | `pm` |
| Research Agent | `research` |
| Content Agent | `content` |
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

## Collaboration Pattern with Other Agents

```
[Content Agent wants to edit slide_deck.md]
    ↓
[Call Version Agent]
    python scripts/snapshot.py slide_deck.md \
      --workspace presentations/<project> \
      --desc "backup before change" --agent content
    ↓
[Content Agent edits slide_deck.md]
    ↓
[Done]
```

PM Agent enforces this order automatically.

---

## Caveats

- Consider adding `_versions/` to `.gitignore` (large folders make Git inefficient)
- HTML files are several hundred KB to several MB — snapshot only when needed
- `fonts/` doesn't need snapshots (re-downloadable any time via `download_font.py`)
- `layout_spec.json` and `pdf_layout_spec.md` become invalid when HTML changes — snapshot them together
