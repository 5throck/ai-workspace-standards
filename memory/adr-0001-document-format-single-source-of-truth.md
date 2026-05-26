# ADR 0001: Document Format Rules — Single Source of Truth

**Date**: 2026-05-27
**Status**: Accepted
**Authors**: Template Architect, PM

---

## Context

Documentation format rules (session log structure, CHANGELOG entry format, PR body structure) were duplicated or inconsistently defined across multiple files:

- `CLAUDE.md` (workspace) — Claude Code-specific behavior
- `GEMINI.md` (workspace) — Antigravity/Gemini CLI-specific behavior
- `templates/*/CLAUDE.md` — project-level Claude Code behavior
- `templates/*/GEMINI.md` — project-level Antigravity behavior
- `docs/context.md` (per project) — shared project knowledge

This caused tool-dependent inconsistency: different AI tools (Claude App, Claude Code, Antigravity, Antigravity CLI) produced session logs and CHANGELOG entries with varying structure and quality, making cross-tool audits unreliable.

---

## Decision

**Workspace level**: All document format rules are defined once in `CONSTITUTION.md` (§2 Memory System, §3 PR Workflow). `CLAUDE.md` and `GEMINI.md` reference these sections rather than defining their own format rules.

**Project level**: Document format rules are embedded directly in `docs/context.md` under a `## Documentation Standards` section at project creation time (via template). Individual project `CLAUDE.md` and `GEMINI.md` reference `docs/context.md` for all format guidance.

**Template propagation**: `templates/common/` and all variant `docs/context.md` files contain the canonical `## Documentation Standards` section so new projects inherit the rules from day one.

---

## Consequences

**Positive:**
- Single edit in `CONSTITUTION.md` (workspace) or `docs/context.md` (project) propagates to all tools
- New projects created from templates include format rules from day one
- Auditable: `audit.sh` can verify `## Documentation Standards` section exists in `docs/context.md`

**Negative:**
- Existing projects (created before this ADR) must manually add `## Documentation Standards` to their `docs/context.md`
- Template changes do not retroactively update existing projects (by design — projects are independent after creation)

**Neutral:**
- `CLAUDE.md` and `GEMINI.md` become thinner files focused on tool-specific settings (hooks, model overrides, MCP servers) rather than behavioral rules
