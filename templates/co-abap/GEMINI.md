# GEMINI.md — co-abap Variant Overrides

> This file contains co-abap variant-specific overrides for Gemini CLI / Antigravity.
> Common configuration is inherited from `templates/common/GEMINI.md`.
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

### Session Start
```
@docs/co-abap.context.md @AGENTS.md @memory/MEMORY.md
```

### Recommended Mode
`--mode hyperfocused` (single sap_execute entry point for all 101 MCP operations)

### Post-Write Chain
After ANY WriteSource, EditSource, or Activate, run the mandatory QA gate in order:
1. SyntaxCheck
2. RunUnitTests
3. GetCodeCoverage (≥70% new objects)
4. RunATCCheck (Zero P1 findings)

**Desktop App Note**: PostToolUse hooks do NOT fire in Claude Code Desktop App — run the chain manually.

### Memory Index Sync
After Write/Edit, run `bun scripts/sync-md.ts` to update the memory index.

### Subagent Orchestration
- `define_subagent` / `invoke_subagent` / `send_message` for multi-agent workflows
- 3-Tier Model: gemini-3.1-pro (design), gemini-3.5-flash (review/coding)

## Legal Disclaimer
This variant uses the vsp MCP server to connect to SAP systems. All write operations require explicit user approval.

<!-- SYNC:from-root
## Role Declaration
## ⚠️ Windows Reserved Device Name (nul) Redirection Safeguard
## Cost Optimization (3-Tier Model Strategy)
## Language Policy Exception
## Execution Plan Boilerplate
## Pre-Edit Quality Gate (All Platforms)
## teammateMode (Claude Code Agent Teams execution mode)
-->
