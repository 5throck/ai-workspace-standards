# Meeting Transcript
**Date**: 2026-05-27
**Topic**: PR document, CHANGELOG, and Memory log format best practices — tool consistency improvement
**Participants**: pm, architect, docs-writer, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Background

Tool inconsistency across Claude App, Claude Code, Antigravity, and Antigravity CLI results in varying documentation quality. Web research was conducted prior to the meeting to gather current best practices (2025/2026).

## Research Findings

### PR Templates
- `.github/pull_request_template.md` auto-populates PR description in GitHub
- Recommended sections: Summary, Changes (What/Why), Test Plan, Checklist
- Title format: `type(scope): description` or `[Type] description`
- Source: GitHub Docs, Microsoft Learn, Sopa, Crystallize

### CHANGELOG
- Keep a Changelog 1.0.0 standard (currently in use) — gold standard
- Common Changelog variant: every entry must reference a PR/commit/issue
- `[Unreleased]` section as pipeline buffer — current practice correct
- ISO date format YYYY-MM-DD — current practice correct
- Source: keepachangelog.com, common-changelog GitHub

### Memory Logs
- File-based Markdown is the dominant AI agent memory pattern (Manus, Claude Code)
- Three memory types: Semantic (durable knowledge), Episodic (session logs), Procedural (rules)
- Structure: always include "Why" not just "What"
- Source: DEV Community, Medium, Databricks

---

## Transcript

### Round 1

**Architect**: The core structural problem is that we have format rules defined in multiple places — CLAUDE.md, GEMINI.md, and partially in CONSTITUTION.md. Each tool reads its own file and diverges. The solution is to make CONSTITUTION.md the single source of truth for all document format specifications, and have CLAUDE.md/GEMINI.md reference it with "See CONSTITUTION.md §X". The PR template specifically should live in `.github/pull_request_template.md` — GitHub loads this automatically regardless of which AI tool triggers `gh pr create`. This removes the tool dependency entirely for PR format.

**Docs-Writer**: Architect's point about single-source-of-truth is correct, and I want to add the specific gap I see: our Memory log files (`memory/YYYY-MM-DD.md`) have no mandatory section schema anywhere. The `/memlog` command guidance is vague, which is why Claude App produces a paragraph narrative while Claude Code produces a bullet list. We need a canonical template with required headings: `## Session`, `## Changes`, `## Decisions`, `## Open Issues`. This template must live in CONSTITUTION.md, not in CLAUDE.md alone, so Antigravity CLI picks it up via GEMINI.md reference.

**Automation-Engineer**: On the CHANGELOG side — the `dev-sync.sh` pipeline currently does not verify that an `[Unreleased]` entry exists before committing. The pre-commit hook only checks that the section header exists, not that it has content. I can add a content check: if `[Unreleased]` section has no bullet items, abort with a message prompting the user to run `/changelog "description"` first. This would prevent empty changelogs from reaching PRs regardless of which tool triggers the sync.

**Auditor**: I want to flag a cross-cutting inconsistency: docs-writer's Memory template proposal and architect's CONSTITUTION.md consolidation are compatible, but A-04 (removing format rules from CLAUDE.md/GEMINI.md) needs to happen *before* A-01 and A-02, or we will have three simultaneous sources for a brief period. Sequencing matters for consistency.

### Round 2

**Architect**: Auditor raises a valid sequencing concern. The ADR I will produce for A-04 should be approved first, establishing which sections move to CONSTITUTION.md and which stay tool-local. Then A-01/A-02/A-03 execute against that approved structure. For the PR template, I recommend four mandatory sections: `## Summary` (1-3 bullets, the "what and why"), `## Changes` (file-level list), `## Test Plan` (bulleted checklist), `## Checklist` (standard items like "audit passes", "CHANGELOG updated"). The Co-Authored-By line that automation-engineer currently appends in the commit should also appear in the PR body as a standard footer.

**Docs-Writer**: I agree with the sequencing. I also want to flag terminology: we currently use "Memory log" and "session log" interchangeably. CONSTITUTION.md should canonicalize one term — I propose "session log" as the standard, since it maps to the episodic memory concept from AI agent research. The file naming (`YYYY-MM-DD.md`) stays, but the internal section label becomes `## Session Summary` to match. This prevents future agents from producing differently-labeled headings.

**Automation-Engineer**: On A-05 implementation detail: the `dev-sync.sh` check should use `grep -A 3 "\[Unreleased\]"` to check if the three lines after the header contain at least one bullet (`-`). If not, print a warning and prompt the user. I will NOT abort hard (exit 1) by default since some releases may legitimately have no user-facing changes — instead it will be a WARN that the user can override with `--force` flag. The `.ps1` parity version will use the same logic.

**Auditor**: Both rounds converge on a coherent picture. The disagreement about hard-abort vs warn-with-override on the CHANGELOG check (automation-engineer's WARN proposal) is a reasonable pragmatic choice — I accept it provided the warning message clearly names the `/changelog` command as the fix. Sequencing: A-04 ADR → A-01/A-02/A-03 execution → A-05 scripting.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | docs-writer | Create `.github/pull_request_template.md` (Summary/Changes/Test Plan/Checklist sections) | Phase 4 |
| A-02 | docs-writer | Add Memory session log mandatory section template to CONSTITUTION.md (## Session Summary, ## Changes, ## Decisions, ## Open Issues) | Phase 4 |
| A-03 | docs-writer | Strengthen CHANGELOG entry format in CONSTITUTION.md — add `(#PR-number)` reference requirement per entry | Phase 4 |
| A-04 | architect | Draft ADR: consolidate document format rules from CLAUDE.md + GEMINI.md into CONSTITUTION.md; remove duplicate definitions | Phase 2 |
| A-05 | automation-engineer | Add `[Unreleased]` content check to dev-sync.sh + dev-sync.ps1 — WARN (not abort) if empty, prompt user to run /changelog | Phase 4 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | PR created from any tool (Claude App, Claude Code, Antigravity) uses same section structure | Manual test: create PR from each tool, compare body |
| AC-2 | Memory log files produced by any tool contain all 4 required sections | Run audit.sh after session log creation from each tool |
| AC-3 | CHANGELOG entries include PR reference numbers | Review last 3 PRs after implementation |
| AC-4 | No duplicate format rules across CLAUDE.md, GEMINI.md, CONSTITUTION.md | grep cross-check for duplicated format guidance |
| AC-5 | dev-sync warns on empty [Unreleased] section | Test by running /sync with empty [Unreleased] |
