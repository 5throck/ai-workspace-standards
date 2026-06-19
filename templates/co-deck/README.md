---
content_hash: PLACEHOLDER
sync_version: 1
---

# co-deck

> **⚠️ BETA VARIANT** - Status: beta (v0.1.0)
> This variant is in active development and should not be used in production environments.

---

Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF. Includes 8 specialized agents covering research, content, design, HTML build, layout measurement, and PDF export.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Beta Status

This variant is currently in **beta** and requires:

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

## Variant Type

**Type**: design

This variant focuses on lecture and presentation material production — from research to print-ready PDF.

## Agent Roster

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| pm | Orchestrates 11-stage pipeline; single user entry point | High | inherit |
| research | Gathers web sources and writes research_notes.md | Medium | inherit |
| storyline | Writes storyline.md and slide_deck.md from research notes | Medium | inherit |
| design | Locks visual design style into design_spec.md | Medium | inherit |
| html-build | Generates HTML slides from slide_deck.md and design_spec.md | Medium | inherit |
| measure | Auto-measures slide layout with Playwright; downloads TTF fonts | Medium | inherit |
| pdf-export | Generates sample and full PDF from measured layout data | Medium | inherit |
| version | Snapshots files before every edit; restores prior states | Low | inherit |

## Skills

- **research**: Source collection and ideation — confirms topic/audience, performs web research (Korean and English), writes research_notes.md
- **storyline**: Storyline design — given research_notes.md, produces storyline.md and slide_deck.md
- **design**: Visual design lock — decides layout, color palette, font family and saves design_spec.md
- **html-build**: HTML slide generation — produces lecture_vN.html from slide_deck.md and design_spec.md
- **measure**: Layout measurement — runs Playwright to extract coordinates and downloads TTF fonts
- **pdf-export**: PDF generation — generates sample (5 slides) and full PDF via fpdf2
- **version**: Version snapshots — backs up files before edits; restores prior states on demand

---

**Generated**: 2026-06-17T08:35:00.930Z
**MVP Wave 3** - L2-to-Variant Pipeline
