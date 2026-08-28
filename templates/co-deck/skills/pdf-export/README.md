# pdf-export

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Generates PDF from slide data using pdf-lib. Extracts slidedata.json, runs sample (5-slide) then full PDF generation scripts, reviews results. Reads the 4-layer spec merge (base → theme → style → overrides) directly — no Playwright measurement required. Responds to "make PDF", "export PDF", "convert to PDF". Stage 11 of the lecture workflow.

- **Scope**: `co-deck`
- **Version**: 2.1.1

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

prep-pdf

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
