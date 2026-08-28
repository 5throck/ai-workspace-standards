# slide-layout-gate

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Slide content conformance gate. Runs estimate-layout.ts --lint to check every slide in slidedata.json against the merged 4-layer spec's content_constraints (per slide type: title/subtitle/desc chars, bullet count, body chars). Exit 1 blocks PDF export. Responds to "layout gate", "lint slides", "check slide bounds", "slide content conformance".

- **Scope**: `co-deck`
- **Version**: 1.0.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

html-build

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
