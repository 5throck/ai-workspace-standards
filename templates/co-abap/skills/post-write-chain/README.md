# Post-Write Mandatory Chain

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Use after ANY WriteSource, EditSource, or Activate operation on SAP ABAP objects. Enforces the mandatory quality gate: SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck. Trigger automatically after every ABAP write operation.'

- **Scope**: `co-abap`
- **Version**: 1.1.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

vsp MCP server

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
