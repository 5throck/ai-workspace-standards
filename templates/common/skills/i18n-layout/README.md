# i18n-layout

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Text layout and encoding guidance: character encoding (UTF-8, legacy Korean code pages, BOM hazards), line endings, RTL/bidi handling, and script-specific font selection (Hangul focus). Use when: encoding is corrupted or mojibake appears, an RTL locale must render correctly, fonts must be chosen for a script, or CRLF/BOM issues surface.

- **Scope**: `common`
- **Version**: 1.0.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

(none)

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
