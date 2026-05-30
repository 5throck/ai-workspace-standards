---
name: agent-lifecycle-manager
description: >
  Guides the PM through creating, modifying, validating, and deprecating agents in the
  co-work variant. Ensures agents follow the required frontmatter schema and are
  registered in AGENTS.md and docs/co-work.context.md.
version: 1.0.0
status: active
owner: pm
prerequisites: none
---

# 🔄 Skill: agent-lifecycle-manager

## Context

Use when adding a new specialist agent (e.g., a cloud-pentester or OSINT-analyst) or
deprecating an existing one. Ensures the roster stays consistent.

## Execution Steps

### Creating an Agent

1. Create `agents/<name>.md` with required frontmatter:
   ```yaml
   ---
   name: <name>
   formal_name: <Display Name>
   tier:
     claude: high | medium | low
     gemini-cli: high | medium | low
   model: inherit
   color: <color>
   description: '<one-line description>'
   ---
   ```
2. Add `## Role`, `## Responsibilities`, `## Constraints`, `## Dispatch Protocol`, `## Meeting Participation` sections.
3. Update `AGENTS.md` — add row to Agent Roster table.
4. Update `docs/co-work.context.md § Agents` — add row to Agents table with `status: active`.
5. Update `agents/README.md` — add row to Available Agents table.

### Deprecating an Agent

1. In `docs/co-work.context.md § Agents`, change agent `status` to `deprecated`.
2. In `AGENTS.md`, move agent row to a `### Deprecated` subsection.
3. Do NOT delete the `agents/<name>.md` file — retain for reference.

### Validation

After any change, verify:
- [ ] `AGENTS.md` roster matches files in `agents/`
- [ ] `docs/co-work.context.md § Agents` matches `AGENTS.md`
- [ ] `agents/README.md` is up to date
