# ADR-0041: Skill Resolution Priority

Date: 2026-05-31
Status: Accepted
Deciders: architect, lifecycle-manager, docs-writer

## Context and Problem Statement

When multiple skills overlap in intent or trigger phrases (e.g., a local `meeting-facilitation` skill versus a global `brainstorming` skill), the system needs a deterministic way to choose which skill to trigger. Without a defined priority, agents might invoke the wrong skill, leading to unexpected behaviors or bypassing project-specific configurations.

## Decision

We enforce a strict 3-tier priority system for skill resolution across all sessions and platforms:

1. **Priority 1 (Highest): Local project skills**
	   - Location: `skills/<name>/SKILL.md` in the current working directory.
2. **Priority 2: Platform config skills**
	   - Location: `.gemini/skills/` or `.claude/skills/` in the project root.
3. **Priority 3 (Lowest): Global plugin skills**
	   - Location: e.g., global plugin repositories or extension marketplaces.

**Rule**: If a local skill's `metadata.triggers` matches the user request, it must be used. Fallthrough to a global plugin with overlapping intent is prohibited.

When a request is ambiguous, agents must prefer the local skill and confirm intent with the user.

## Consequences

- **Positive:** Predictable, deterministic skill execution based on proximity to the project.
- **Positive:** Project-specific overrides (Priority 1) naturally take precedence over generic behaviors (Priority 3).
- **Neutral:** Requires maintenance of `CLAUDE.md` and `GEMINI.md` to document this policy across all templates (Platform Documentation Parity).
- **Negative:** Users or agents must use explicit invocation (e.g., `/meeting`) if natural language triggers remain ambiguous.