# Governance Document Architecture: _shared/ + _platform/ Design

**Status**: Design (P2 — pending implementation)
**Supersedes**: Section marker approach (implemented in P1)
**Created**: 2026-06-02
**Owner**: architect

---

## Problem Statement

CLAUDE.md and GEMINI.md must be maintained across:
- 1 workspace root (L0)
- 1 common template (L1: templates/common/)
- 4 variant templates (L2: templates/co-*)

The P1 section marker approach (`<!-- COMMON-CLAUDE:START/END -->`) handles
propagation but has limits: sections are still duplicated across 10 files,
and the "common" boundary is implicit rather than structural.

## Proposed Architecture

### Directory Structure

```
templates/common/
  _shared/                          ← Engine-agnostic content fragments
    role-declaration.md             ← PM role declaration (both platforms)
    language-policy.md              ← §4 Language policy (both platforms)
    plan-mode.md                    ← §7 Plan mode / planning (both platforms)
    task-tracking.md                ← §8 Task tracking (both platforms)
    workspace-boundary.md           ← §9 Workspace boundary policy (both)
    lifecycle-rules.md              ← §10 Lifecycle management rules (both)
    error-recovery.md               ← §11 Custom command error recovery (both)
    windows-platform.md             ← §12 Windows platform requirement (both)
    git-pr-rules.md                 ← Git & PR rules (both platforms)
  _platform/
    claude/
      CLAUDE.md.template            ← Assembly template with include directives
      hooks-section.md              ← §1 Automated Hooks (Claude-specific)
      mcp-section.md                ← §3 MCP Configurations (Claude-specific)
      slash-commands.md             ← §2 Native Slash Commands
      agent-dispatch.md             ← §5 Agent Dispatch Rules (Claude)
      sub-agents.md                 ← §6 Native Sub-agents (Claude-specific)
    gemini/
      GEMINI.md.template            ← Assembly template with include directives
      antigravity-tools.md          ← §1 Antigravity Tool Suite (Gemini-specific)
      planning-mode.md              ← §2 Planning Mode (Gemini-specific)
      subagent-orchestration.md     ← §3 Subagent Orchestration (Gemini-specific)
      agent-dispatch.md             ← §5 Agent Dispatch Rules (Gemini)
      agent-manager.md              ← §Agent Manager section (Gemini-specific)
      settings-parity.md            ← §Settings File Parity Policy (Gemini)
```

### Template File Format

`.template` files use include directives processed by `publish-to-template.ts`:

```
# CLAUDE.md

> [!include _shared/role-declaration.md]

---

## Claude Code-Specific Behaviors

[!include _platform/claude/hooks-section.md]

[!include _platform/claude/slash-commands.md]

[!include _platform/claude/mcp-section.md]

[!include _shared/language-policy.md]

[!include _platform/claude/agent-dispatch.md]

[!include _platform/claude/sub-agents.md]

[!include _shared/plan-mode.md]

[!include _shared/task-tracking.md]

[!include _shared/workspace-boundary.md]

[!include _shared/lifecycle-rules.md]

[!include _shared/error-recovery.md]

[!include _shared/windows-platform.md]

[!include _shared/git-pr-rules.md]
```

### Assembly Process

`bun run publish-to-template -- --docs` will:
1. Read `.template` files from `_platform/claude/` and `_platform/gemini/`
2. Resolve all `[!include path]` directives
3. Write assembled CLAUDE.md / GEMINI.md to each variant directory
4. Variant-specific sections (Specialist Agent List in §5) are injected via `variant.json` overrides

### Variant-Specific Sections

Sections that differ per variant (§5 Specialist Agent List, Role Declaration variants)
are handled via a `doc_overrides` section in `variant.json`:

```json
"doc_overrides": {
  "CLAUDE.md": {
    "agent-dispatch.md": "agents/pm.md#dispatch-protocol"
  }
}
```

## Migration Plan

### Phase 1 (Current — implemented)
- Section markers `<!-- COMMON-CLAUDE:START/END -->` in existing files
- `publish-to-template.ts --docs` syncs marked sections
- `validate-templates.ts` VA-05 warns on drift

### Phase 2 (This design)
Prerequisites:
1. All common sections are stable for ≥2 weeks (no frequent changes)
2. `new-project.sh` assembly pipeline designed and tested
3. At least one variant migrated as proof-of-concept

Migration steps:
1. Extract common sections from CLAUDE.md into `_shared/` fragments
2. Extract platform-specific sections into `_platform/claude/` and `_platform/gemini/`
3. Create `.template` files with include directives
4. Update `publish-to-template.ts --docs` to support include assembly
5. Update `new-project.sh` to assemble docs at scaffold time
6. Validate all 4 variants produce correct output
7. Remove section markers (no longer needed after migration)

## Open Questions

1. **new-project.sh integration**: When a new project is created, does it copy pre-assembled files or assemble at scaffold time? Assembly at scaffold time is cleaner but adds complexity to the scaffolding pipeline.

2. **Variant customization depth**: How deep can variant overrides go? Currently only §5 Specialist Agent List varies significantly. If deeper customization is needed, the override mechanism must be more powerful.

3. **AGENTS.md**: Currently excluded from propagation (fully variant-specific). If a common AGENTS.md skeleton is ever needed, it would live in `_shared/agents-skeleton.md`.

## Risks

| Risk | Mitigation |
|------|-----------|
| Assembly errors silently produce malformed docs | validate-templates.ts Check VA-05 catches drift |
| new-project.sh assembly adds fragility | Phase 1 marker approach remains as fallback |
| Over-fragmentation reduces readability | Keep fragments at section-level granularity |
