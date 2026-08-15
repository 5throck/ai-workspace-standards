# explain-me Skill Design

> **Status**: Approved
> **Date**: 2026-08-03
> **Source**: Based on [beret21/reportme](https://github.com/beret21/reportme) v0.4.1 (MIT license, author: beret21)

## 1. Purpose

Create a workspace-level skill (`explain-me`) that turns a topic or existing materials into a single, self-contained, interactive HTML report. The skill produces files with sticky tabs, clickable reference drawers, dense tables, comparison heatmaps, inline SVG, in-page search, a light/dark theme toggle, and multilingual support.

## 2. Source Attribution

This skill is adapted from [beret21/reportme](https://github.com/beret21/reportme) (MIT license). The original was designed for Claude Code only. This adaptation extends support to all 4 workspace platforms and complies with workspace governance standards.

**What we keep unchanged** (runtime assets, platform-agnostic):
- `templates/report.html` — the single-file interactive HTML template
- `scripts/validate_report.py` — HTML structural validator (stdlib Python)
- `templates/publish/.nojekyll` and `dot-gitignore` — GitHub Pages assets

**What we adapt** (documentation, harness):
- `SKILL.md` — rewritten in English with workspace-standard frontmatter
- `references/BUILD_GUIDE.md` — translated from Korean to English, multi-agent harness made platform-abstract
- `references/PLATFORM_HARNESS.md` — new file for platform-specific subagent dispatch patterns
- `references/loanword-refinements.json` — converted from `.md` to `.json` for §6.7 compliance

## 3. Platform Abstraction Strategy

### 3.1 The Challenge

The original reportme's multi-agent verification harness (§6 content verification, §7 language proofreading) uses Claude Code's `Workflow`/`agent()` API directly. This does not work on Antigravity/Gemini platforms which use `define_subagent`/`invoke_subagent`.

### 3.2 The Solution: Platform-Abstract Harness

BUILD_GUIDE.md describes **what** each subagent must do:
- **§6**: 4 reader personas (executive, practitioner, skeptic, data verifier) + 4 review lenses (factual accuracy, logical consistency, data integrity, source reliability)
- **§7**: 4 proofreader personas (spelling, word order, terminology consistency, readability)
- **§7.5**: SVG specialist designer for diagrams

BUILD_GUIDE.md does **not** prescribe **how** to dispatch them. Instead, it references `PLATFORM_HARNESS.md` which provides platform-specific dispatch patterns:

| Platform | Dispatch Mechanism |
|----------|-------------------|
| Claude CLI / Claude Desktop App | `Agent()` tool with `description`, `prompt`, `subagent_type`, `model` |
| Antigravity (VS Code) / Gemini CLI | `define_subagent` + `invoke_subagent` with `"Workspace": "share"` |
| Fallback (no subagent support) | Single-agent sequential review using the same personas/lenses as checklist |

### 3.3 Model Tier Mapping

| Tier | Claude (alias) | Antigravity/Gemini |
|------|---------------|-------------------|
| High | `opus` | `gemini-3.1-pro` |
| Medium | `sonnet` | `gemini-3.7-flash` |
| Low | `haiku` | `gemini-3.7-flash` |

## 4. Language Policy Compliance

### 4.1 The Challenge

The original BUILD_GUIDE.md (547 lines) and loanword-refinements.md are written in Korean. Per CONSTITUTION §6.7:

> `skills/*.md` is a protected path — the `lang: ko` frontmatter exception **never** applies there.

### 4.2 The Solution

| File | Language | Rationale |
|------|----------|-----------|
| `SKILL.md` | English | Workspace rule — all skills/*.md must be English |
| `BUILD_GUIDE.md` | English | Translated from Korean; Korean terminology in parentheses where ambiguous |
| `PLATFORM_HARNESS.md` | English | New file, English-only |
| `loanword-refinements.json` | Korean data in JSON | §6.7: non-Markdown files in `references/` are exempt from English-only scan |
| `report.html` | Korean comments | Template runtime file, not documentation; comments not user-visible |
| `validate_report.py` | Korean comments | Script runtime file, not documentation |

## 5. Template and Skill Structure

```
skills/explain-me/
├── SKILL.md                              # Skill definition (English)
├── references/
│   ├── BUILD_GUIDE.md                    # Report building engine (English)
│   ├── PLATFORM_HARNESS.md               # Platform-specific subagent dispatch
│   └── loanword-refinements.json         # Korean loanword data (JSON)
├── scripts/
│   └── validate_report.py                # HTML structural validator
└── templates/
    ├── report.html                       # Single-file interactive HTML template
    └── publish/
        ├── .nojekyll                     # GitHub Pages Jekyll bypass
        └── dot-gitignore                  # Gitignore template for publish
```

## 6. Propagation

- `scope: common` — available to all variants
- `l2_propagate: true` — propagated to L1 template and L3 projects (the field is named `l2_propagate` in code/frontmatter but gates L1+L3 reach — see `docs/constitution/06-skill-lifecycle.md`)
- `owner: pm` — avoids orphan detection in variants (§6 common-scope owner pitfall)

## 7. Skill Type

`metadata.type: "process"` — the skill is a workflow process that orchestrates research, writing, verification, and delivery of reports.

## 8. Supported Platforms

| # | Platform | Subagent | Bash | WebSearch | File I/O |
|---|----------|----------|------|-----------|----------|
| 1 | Claude CLI | `Agent()` | `Bash` | Yes | `Read`/`Write`/`Edit` |
| 2 | Claude Desktop App | `Agent()` (limited Teams) | `Bash` | Yes | `Read`/`Write`/`Edit` |
| 3 | Antigravity (VS Code) | `invoke_subagent` | `run_command` | Via MCP | `view_file`/`write_to_file` |
| 4 | Antigravity CLI (Gemini CLI) | `invoke_subagent` | `run_command` | Via MCP | `view_file`/`write_to_file` |

## 9. Risks

| Risk | Mitigation |
|------|-----------|
| BUILD_GUIDE translation loses nuance | Keep Korean terminology in parentheses; reference original repo |
| Platform harness drift | Version-pin to CLAUDE.md/GEMINI.md sections |
| validate_report.py Unix path assumptions | Python stdlib HTMLParser is cross-platform; test on Windows |
| report.html Korean comments | Runtime file, not documentation — keep as-is |
