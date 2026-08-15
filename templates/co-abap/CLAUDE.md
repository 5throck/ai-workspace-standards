# CLAUDE.md — co-abap Variant Overrides

> This file contains co-abap variant-specific overrides for Claude Code.
> Common configuration is inherited from `templates/common/CLAUDE.md`.
> Do NOT duplicate common sections here — only ABAP-specific overrides.

---

## Role Override

You are operating in the **co-abap** variant — an AI-assisted SAP ABAP development harness.
Domain: SAP ABAP development via vsp MCP server (ADT REST APIs).

## Domain

- **Primary**: SAP ABAP development (classes, programs, CDS views, interfaces)
- **Modules**: SD, MM, FI, CO, PP, LE
- **MCP Server**: vsp (hyperfocused mode)
- **Naming**: ZCL_ (class), ZIF_ (interface), ZPROG_ (program)

## ABAP Lifecycle Rules

### Session Start Checklist
1. Read `docs/context.md` — immutable project identity
2. Read `docs/co-abap.context.md` — ABAP-specific configuration
3. Read `AGENTS.md` — agent registry
4. Check `memory/MEMORY.md` — recent session history
5. Load skills: `skills/abap-dev/SKILL.md`, `skills/post-write-chain/SKILL.md`

### Post-Write Chain
After ANY WriteSource, EditSource, or Activate:
1. SyntaxCheck
2. RunUnitTests
3. GetCodeCoverage (≥70% new objects)
4. RunATCCheck (Zero P1 findings)

**Desktop App Note**: PostToolUse hooks do NOT fire in Claude Code Desktop App — run the chain manually.

### Hook: PostToolUse
After Write/Edit, run `bun scripts/sync-md.ts` to update memory index.

### Subagent Dispatch (3-Tier Cost Optimization)
- **High (opus)**: PM, Architect — design and planning
- **Medium (sonnet)**: Code review, QA, module analysts
- **Low (haiku)**: Code writing, test execution, routine tasks

## Legal Disclaimer
This variant uses the vsp MCP server to connect to SAP systems. All write operations require explicit user approval. Never modify production SAP objects without user confirmation.

<!-- SYNC:from-root
## Role Declaration
## ⚠️ Windows Reserved Device Name (nul) Redirection Safeguard
## Pre-Edit Quality Gate (All Platforms)
## teammateMode (Claude Code Agent Teams execution mode)
## Language Policy Exception
## Execution Plan Boilerplate
## Cost Optimization (3-Tier Model Strategy)
-->
