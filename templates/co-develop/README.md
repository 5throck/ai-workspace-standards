---
content_hash: PLACEHOLDER
sync_version: 1
---

# co-develop

**Language**: **English** · [한국어](README_ko.md)

> **Status**: Stable (v1.0.0)

---

Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, and Security Monitor.

## Quick Start

This variant inherits from `templates/common` and provides a 6-phase linear governance pipeline for software development.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini Code users:

See `GEMINI.md` for detailed instructions.

## Variant Type

**Type**: development

This variant focuses on software development workflows, feature implementation, and integration testing.

## Agent Roster

| Agent | Role | Tier |
|-------|------|------|
| architect | System design and architecture planning | High |
| code-writer | Feature implementation | Low |
| designer | UI/UX and component design | Medium |
| security-monitor | Security review and compliance | Medium |
| stack-setup | Unknown stack identification and secure setup procedure | Low |
| test-runner | Testing and QA validation | Medium |

## Skills

Variant-specific skills (defined in `templates/co-develop/skills/`):

| Skill | Purpose |
|-------|---------|
| `code-review` | Thorough code review for correctness, maintainability, security, and best practices |
| `refactoring` | Systematic code restructuring while preserving behavior |
| `test-driven-development` | Red-green-refactor TDD workflow for new features and bug fixes |

All other skills are inherited from `templates/common/skills/`.

---

**Promoted to Stable**: 2026-06-13
**Template Version**: 1.0.0

*Last Updated: 2026-07-19*
