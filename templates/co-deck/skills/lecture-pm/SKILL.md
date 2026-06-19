---
name: lecture-pm
version: 2.0.0
description: >
  PM Workflow Reference Card for the co-deck lecture production pipeline.
  Quick-reference for stage sequence, approval gates, agent dispatch triggers,
  and impact propagation rules. Not an execution skill — links to agents/pm.md
  for full orchestration logic.
status: active
owner: pm
last_reviewed: 2026-06-19
prerequisites: none
audit_exception: pm-reference-card
---

## Context

The PM Agent orchestrates the 11-stage lecture material production pipeline, dispatching 7 specialist agents and enforcing 3 approval gates. Users interact only with PM; PM reads `project_state.json` and routes to the appropriate skill or agent. This card is a quick-reference summary — full logic lives in `agents/pm.md`.

## Workflow Stages

| Stage | Name | Agent / Skill | Gate |
|-------|------|--------------|------|
| 0 | Project Init | PM | — |
| 1 | Research | Research → `lecture-research` | Gate 1: research approval |
| 2 | Storyline | Storyline → `lecture-storyline` | — |
| 3 | Slide Deck | Storyline → `lecture-storyline` | ★ Gate 2: content approval |
| 4 | Design | Design → `lecture-design` | ★ Gate 3: design approval |
| 5 | HTML Generation | Build → `lecture-html-build` | — |
| 6 | Image Matching | Build → `lecture-html-build` | — |
| 7 | Balance Check | Build → `lecture-html-build` | — |
| 8 | Special Pages | Build → `lecture-html-build` | Gate 4: HTML approval |
| 9 | Layout Measure | Measure → `lecture-measure` | — |
| 10 | Font Download | Measure → `lecture-measure` | — |
| 11 | PDF Export | Export → `lecture-pdf-export` | ★ Gate 5: sample PDF approval |

**Version Agent** (`lecture-version`) is cross-cutting — called before any file edit at any stage.

## Quick Reference

| User says | PM action |
|----------|-----------|
| "Make lecture materials" / "강연 자료 만들어줘" | Start new project from Stage 1 |
| "Next stage" / "Continue" / "다음 단계" | Advance from current stage |
| "Where are we?" / "어디까지 왔어?" | Summarize `project_state.json` |
| "Fix X" / "X 수정해줘" | Impact analysis → dispatch affected stages |
| "Go back to previous version" / "이전 버전으로" | Call `lecture-version` |
| "Start over" / "처음부터 다시" | Restart project or specific stage |

**Impact propagation** (when user requests a change):

| Edited file | Must re-run |
|-------------|------------|
| `research_notes.md` | All downstream stages |
| `storyline.md` / `slide_deck.md` | HTML Build (Stages 5-8), Export (Stage 11) |
| `design_spec.md` | HTML Build, Measure (Stages 9-10), Export |
| HTML (text only) | Export only (Stage 11) |
| HTML (layout change) | Measure (Stages 9-10), Export |

## Related Skills

Pipeline order (each skill links to the next):

1. `lecture-research` — Stage 1: topic research
2. `lecture-storyline` — Stages 2-3: narrative and slide deck
3. `lecture-design` — Stage 4: visual design spec
4. `lecture-html-build` — Stages 5-8: HTML generation + images
5. `lecture-measure` — Stages 9-10: layout measurement + fonts
6. `lecture-pdf-export` — Stage 11: PDF generation
7. `lecture-version` — cross-cutting: snapshot before every edit
