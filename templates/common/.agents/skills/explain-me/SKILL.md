---
name: explain-me
description: >
  Turn a topic or your own materials into a single self-contained, interactive HTML report —
  top tabs, clickable reference drawers, dense tables, comparison heatmaps, inline SVG,
  in-page search, a light/dark theme toggle, and multilingual support.
  Use when: user says "/explain-me", "/reportme", "make a report", "create report",
  "explain this topic".
  Inspired by beret21/reportme.
version: 1.0.0
last_reviewed: 2026-08-03
status: experimental
scope: common
l2_propagate: true
owner: pm
prerequisites: Python 3 (for validate_report.py), git + gh (for optional publish)
attribution:
  source: https://github.com/beret21/reportme
  license: MIT
  note: "Inspired by beret21/reportme. All code is self-authored."
metadata:
  type: process
  triggers:
    - /explain-me
    - /reportme
    - make a report
    - create report
    - explain this topic
---

# Skill: explain-me

## Context

Generates a **single self-contained interactive HTML report** from a topic (research mode) or existing materials (render mode). The entire output is one HTML file with all CSS, JS, and data inlined — it opens directly from disk (`file://`) with no server or build process required.

Inspired by [beret21/reportme](https://github.com/beret21/reportme) v0.4.1 (MIT license). All code is self-authored. Supports all 4 workspace platforms: Claude CLI, Claude Desktop App, Antigravity (VS Code), and Antigravity CLI (Gemini CLI).

## Subcommands

| Command | Description |
|---------|-------------|
| `new` (default) | Full end-to-end report creation from a topic |
| `render` | Turn existing local or remote data into report format (no research) |
| `add` | Append components (tabs, subtabs, sections, heatmaps, figures, references) to an existing report |
| `update` | Conversationally revise and re-verify an existing report |
| `open` | Launch the report in a browser for manual inspection |
| `verify` | Run structural consistency and content/language reviews |
| `publish` | Optional push to GitHub Pages (requires git + gh) |
| `help` | Show usage information |

## Usage

```
/explain-me [subcommand] [options] "<topic or materials>"
```

### Options

| Option | Description | Example |
|--------|-------------|---------|
| `--lang` | Output language (defaults to user's prompting language) | `--lang en`, `--lang ko` |
| `--langs` | Multilingual output (space-separated, max 5, recommended ≤3) | `--langs ko en ja` |
| `--depth` | Report depth: `brief` / `standard` (default) / `deep` | `--depth deep` |
| `--source` | Source mode: `research` (default) or `data` (auto-detected) | `--source data` |
| `--tabs` | Custom tab list (comma-separated) | `--tabs "Overview,Analysis,References"` |
| `--out` | Output file path | `--out ./reports/market-2026.html` |
| `--no-verify` | Skip verification (discouraged) | `--no-verify` |
| `--no-svg` | Skip inline SVG diagrams | `--no-svg` |
| `--repo` | Publish: repository slug | `--repo ev-report-2026` |
| `--owner` | Publish: GitHub account | `--owner beret21` |
| `--private` | Publish: private repository (requires GitHub Pro) | `--private` |
| `--public` | Publish: public repository | `--public` |

## Safety Model

This skill **only creates and edits** — it never deletes your files or content.

- **Network**: Only used for read-only research (WebSearch/WebFetch). No outbound connections from the output HTML.
- **Git/gh**: Only invoked for the explicit `publish` subcommand, after a secret scan passes.
- **Temporary files**: Confined to OS temp directory.
- **Secrets**: §11 of BUILD_GUIDE scans for API keys, tokens, passwords before delivery.

## Workflow Summary

1. **Parameter confirmation** — confirm TOPIC, LANG, DEPTH, TABS with user
2. **Content acquisition** — research (WebSearch/WebFetch) or data (Read user files)
3. **Structure proposal** — propose tab layout, get user approval
4. **Template copy + fill** — copy `templates/report.html`, replace placeholders
5. **Content writing** — fill tabs with verified facts using design system components
6. **Multi-agent verification** — §6 content (4 personas + 4 lenses), §7 language proofreading, §7.5 SVG diagrams
7. **Structural validation** — `scripts/validate_report.py` (must return 0 errors)
8. **Browser verification** — test tabs, drawer, search, theme, mobile, `file://` self-sufficiency
9. **Delivery** — output single HTML file; optional `publish` to GitHub Pages

## Bundled Assets

| Asset | Location | Purpose |
|-------|----------|---------|
| BUILD_GUIDE.md | `references/BUILD_GUIDE.md` | Complete report building engine (16 sections) |
| PLATFORM_HARNESS.md | `references/PLATFORM_HARNESS.md` | Platform-specific subagent dispatch patterns |
| loanword-refinements.json | `references/loanword-refinements.json` | Korean loanword refinement data for §7 proofreading |
| validate_report.py | `scripts/validate_report.py` | HTML structural validator (stdlib Python) |
| report.html | `templates/report.html` | Single-file interactive HTML template |
| .nojekyll | `templates/publish/.nojekyll` | GitHub Pages Jekyll bypass |
| dot-gitignore | `templates/publish/dot-gitignore` | Gitignore template for published repos |

## Platform Support

All 4 workspace platforms are supported. Tool names differ per platform — see `references/PLATFORM_HARNESS.md` for platform-specific subagent dispatch patterns.

| Platform | Shell | Subagent | File I/O |
|----------|-------|----------|----------|
| Claude CLI | `Bash` | `Agent()` | `Read`/`Write`/`Edit` |
| Claude Desktop App | `Bash` | `Agent()` (limited Teams) | `Read`/`Write`/`Edit` |
| Antigravity (VS Code) | `run_command` | `invoke_subagent` | `view_file`/`write_to_file` |
| Antigravity CLI | `run_command` | `invoke_subagent` | `view_file`/`write_to_file` |

## Kickoff

For new report generation, read `references/BUILD_GUIDE.md` in full first, then follow it exactly. Use `references/PLATFORM_HARNESS.md` for platform-specific subagent dispatch patterns.
