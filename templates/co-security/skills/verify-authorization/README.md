# verify-authorization

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Hard gate: confirms a signed authorization document exists and contains all required fields before allowing any Phase 1+ (recon, exploitation, patching) activity to proceed. BLOCKS work if authorization is missing or incomplete.

- **Scope**: `co-security`
- **Version**: 1.0.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

engagement-scoping must have been run (docs/scope.md must exist)

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
