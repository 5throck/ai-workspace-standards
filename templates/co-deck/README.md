---
content_hash: PLACEHOLDER
sync_version: 1
---

# co-deck

> **⚠️ BETA VARIANT** - Status: beta (v0.2.0)
> This variant is in active development and should not be used in production environments.

---

Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage pipeline for handbook/course-site production. Includes 12 specialized agents covering research, source verification, content, design, image curation, diagram/chart generation, HTML build (5 themes), layout measurement, PDF export, and handbook document production.

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

**Type**: lecture

This variant focuses on lecture and presentation material production — from research to print-ready PDF — and searchable, themed handbooks as static sites (standalone, companion, or full course site).

## Agent Roster

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| pm | Orchestrates 11-stage pipeline + H-Stage handbook pipeline; single user entry point | High | inherit |
| research | Gathers web sources; loads lecture-profile.md | Medium | inherit |
| source-verifier | Validates research URLs → source-verification.md + Trust Score | Medium | inherit |
| storyline | Writes storyline.md and slide_deck.md with image_role/image_query fields | Medium | inherit |
| design | Locks visual design style into design_spec.md | Medium | inherit |
| image-curator | Searches and downloads commercial-use images (Pixabay/Unsplash/Pexels) | Medium | inherit |
| diagram-specialist | Generates SVG concept diagrams and data charts from visual_spec; SVG primary for HTML, PNG optional for PDF | Medium | inherit |
| html-build | Generates HTML slides with theme injection (`data-theme`); 5 themes | Medium | inherit |
| measure | Auto-measures slide layout with Playwright; downloads TTF fonts | Medium | inherit |
| pdf-export | Generates sample and full PDF from measured layout data | Medium | inherit |
| version | Snapshots files before every edit; restores prior states | Low | inherit |
| handbook-writer | Writes handbook content — chapter structure, prose, course materials (H-2~H-4) | Medium | inherit |
| handbook-reviewer | Quality gate — runs handbook-doctor, check-authoring, applies fixes (H-5) | Medium | inherit |

## Skills

- **research**: Source collection and ideation — confirms topic/audience, loads lecture-profile.md, writes research_notes.md
- **source-verifier**: URL validation — Level 1 HTTP check + Level 2 content cross-check; outputs Trust Score
- **storyline**: Storyline design — produces storyline.md and slide_deck.md with image_role/image_query; handles cover/divider confirmation
- **design**: Visual design lock — decides layout, color palette, font family and saves design_spec.md
- **image-curator**: Image acquisition — Pixabay (keyless), Unsplash URL, Pexels/Unsplash API; all sources commercial-use unlimited
- **diagram-specialist**: Diagram and chart generation — 6 concept diagram types (cycle/flow/matrix/pyramid/timeline/comparison) + 3 SVG chart types (bar/line/pie); SVG is primary delivery format for HTML; PNG is optional, required only for PDF export
- **html-build**: HTML slide generation — applies `data-theme` attribute; injects base.css + override CSS; 5 themes (outline, pitch, pitch-enhanced, vertical, zen)
- **measure**: Layout measurement (deprecated) — runs Playwright to extract coordinates and downloads TTF fonts; superseded by **prep-pdf**
- **prep-pdf**: Playwright-free PDF preparation — resolves the 4-layer spec merge (base → theme → style → overrides), validates fonts, outputs a layout summary; replaces `measure` for Stages 9-10
- **pdf-export**: PDF generation — generates sample (5 slides) and full PDF via pdf-lib
- **version**: Version snapshots — backs up files before edits; restores prior states on demand
- **handbook**: Handbook document production — H-Stage pipeline (H-0~H-7); standalone, companion, or full course site; dark mode (3-layer CSS), i18n, 6 section types, 5 built-in themes
- **theme-authoring**: Entry point for creating a new co-deck theme (T-Stage, 5 steps) or style (lightweight, 3 steps); updates `docs/html-themes/THEMES.md` registry

---

**Generated**: 2026-06-17T08:35:00.930Z
**MVP Wave 3** - L2-to-Variant Pipeline
