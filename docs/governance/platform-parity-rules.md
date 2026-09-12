# Platform Parity Rules

## Overview

This document defines the parity rules between L0 workspace files and their L1/L2 counterparts. The shared/claude-only/gemini-only tier model follows the classification established in ADR-0021 (originally written for platform settings, applied here to platform documents); enforcement is automated by `validate-templates.ts` (P-01 parity check, see ADR-0028) and `scripts/audit.ts`.

## Tier Classifications

### Shared Tier
Sections marked as **shared** MUST be identical across:
- L0 → L1 (`templates/common/`)
- L0 → All L2 variants (`templates/co-*/`)

**Rule**: When a shared section is modified in L0, the change MUST propagate to L1 and all L2 variants.

### Claude-Only Tier
Sections marked as **claude-only** appear only in `CLAUDE.md` and its L1/L2 counterparts. These sections are Claude Code-specific and have no equivalent in GEMINI.md.

**Rule**: These sections are platform-specific and should NOT be expected to match between CLAUDE.md and GEMINI.md.

### Gemini-Only Tier
Sections marked as **gemini-only** appear only in `GEMINI.md` and its L1/L2 counterparts. These sections are Antigravity-specific and have no equivalent in CLAUDE.md.

**Rule**: These sections are platform-specific and should NOT be expected to match between CLAUDE.md and GEMINI.md.

## File Mappings

### CLAUDE.md

| Source | L1 Target | L2 Targets |
|--------|-----------|-------------|
| `CLAUDE.md` | `templates/common/CLAUDE.md` | All 5 variant `CLAUDE.md` files |

### GEMINI.md

| Source | L1 Target | L2 Targets |
|--------|-----------|-------------|
| `GEMINI.md` | `templates/common/GEMINI.md` | All 5 variant `GEMINI.md` files |

### agents/pm.md

| Source | L1 Target | L2 Targets |
|--------|-----------|-------------|
| `agents/pm.md` | `templates/common/agents/pm.md` | All 5 variant `agents/pm.md` files |

## Section Rules

### CLAUDE.md / GEMINI.md Shared Sections

| Section | Tier | Description |
|---------|------|-------------|
| Project Overview | shared | General project description and workspace structure |
| Development Guidelines | shared | Core principles, workflow standards, and code review standards |
| File Management | shared | Tool preferences and file handling rules |
| Language Policy | shared | Documentation language requirements |
| Git Practices | shared | Git workflow and commit standards |
| Claude Code-Specific Behaviors | shared | Shared configuration sections (hooks, commands, MCP) |
| Agent Dispatch Rules | shared | PM Gateway and multi-agent workflow |

### CLAUDE.md Claude-Only Sections

| Section | Tier | Description |
|---------|------|-------------|
| teammateMode | claude-only | Claude Code Agent Teams execution mode |
| hooks.TeammateIdle | claude-only | Claude Code-specific lifecycle hooks |
| hooks.TaskCompleted | claude-only | Claude Code-specific lifecycle hooks |

### GEMINI.md Gemini-Only Sections

| Section | Tier | Description |
|---------|------|-------------|
| Antigravity Security Configuration | gemini-only | Antigravity-specific settings |

## Testing

Run the platform parity test:

```bash
# Run parity test
bun scripts/test-platform-parity.ts

# Run with verbose output
bun scripts/test-platform-parity.ts --verbose
```

## Integration with Audit Script

The platform parity test is integrated into `scripts/audit.ts`. Run:

```bash
bun scripts/audit.ts
```

This will automatically check platform parity as part of the full workspace audit.

## References

- [ADR-0021: Platform Settings Parity Policy — 3-Tier Classification](../adr/0021-platform-settings-parity-policy.md) — origin of the shared/claude-only/gemini-only tier model
- [ADR-0028: Promotion Checklist Universality Criteria](../adr/0028-promotion-checklist-universality-criteria.md) — row 5 defines the CLAUDE.md ↔ GEMINI.md parity check (`validate-templates.ts` P-01)
- [ADR-0077: OpenAI Codex as a Fourth Platform Directory](../adr/0077-codex-platform-support.md) — extends the parity scheme to `.codex/`
- [CONSTITUTION.md §10: Terminology → Canonical Definitions](../../CONSTITUTION.md#10-terminology--canonical-definitions) — Platform Profile and canonical platform terminology
- [CONSTITUTION.md §5.6: Agent Lifecycle Management](../../CONSTITUTION.md#56-agent-lifecycle-management)

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.1 | 2026-09-12 | Corrected references: removed phantom ADR-0033 attribution (ADR-0033 covers variant-specific skills/scripts, not parity); repointed to ADR-0021/0028/0077; fixed CONSTITUTION.md anchors |
| 0.1.0 | 2026-06-07 | Initial version |
