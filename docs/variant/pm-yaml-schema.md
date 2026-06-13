# PM Agent YAML Frontmatter Schema

Defines the YAML frontmatter schema used in L1 variant `pm.md` files across the workspace.

## Purpose

Every `templates/<variant>/agents/pm.md` file carries a YAML frontmatter block that describes the PM
agent's identity, tier configuration, and lifecycle metadata. Two forms exist:

- **L1-common** (`templates/common/agents/pm.md`) — the live source with an `extends:` pointer.
- **L1-variant / L2-resolved** (`templates/<variant>/agents/pm.md`) — a resolved copy that replaces
  `extends:` with a `# @resolved-from:` comment and adds variant-specific fields.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `extends` | string | Relative path to the L0 source file being extended. Present **only** in L1-common; absent in resolved copies. |
| `name` | string | Agent identifier (always `pm`). |
| `model` | string | Model override or `inherit` to use the platform default. |
| `status` | string | Lifecycle state: `active`, `deprecated`, or `experimental`. |
| `tier` | object | Per-platform tier classification (see below). |

## Optional Fields (present in resolved copies)

| Field | Type | Description |
|-------|------|-------------|
| `formal_name` | string | Human-readable display name. |
| `role` | string | Functional role label, e.g. `orchestrator`. |
| `color` | string | UI hint for agent badge color. |
| `description` | string | Short description used in tool/skill registries. |
| `examples` | array | Illustrative user/assistant exchange pairs. |
| `variant` | string | The variant slug this resolved file belongs to (e.g. `co-develop`). |
| `lifecycle` | object | Audit timestamps and governance pointer (see below). |

## `tier` Object

```yaml
tier:
  claude: high        # Claude Code tier: low | medium | high
  gemini: high        # Gemini CLI tier
  antigravity: high   # Antigravity CLI tier
  gemini-cli: high    # Gemini CLI (standalone) tier
```

## `lifecycle` Object (resolved copies only)

```yaml
lifecycle:
  phase: production               # production | beta | experimental | deprecated
  created: 2026-05-29T00:00:00.000Z
  last_updated: 2026-06-08T00:00:00.000Z
  governance: docs/lifecycle/agents/pm.md
```

## Example: L1-Common Form (live `extends:`)

```yaml
---
extends: ../../../agents/pm.md
name: pm
formal_name: Project Manager (PM) Agent
status: active
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
model: inherit
color: yellow
description: 'Orchestrates multi-agent workflows. Enforces quality gates.'
examples:
  - user: "Start a new feature implementation"
    assistant: "I'll orchestrate Phase 0 (Team Assembly) and Phase 2 (Design approval)"
---
```

## Example: L1-Variant / L2-Resolved Form (`@resolved-from`)

```yaml
# @resolved-from: ../../common/agents/pm.md
---
name: pm
role: orchestrator
status: active
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
model: inherit
color: yellow
description: >-
  Orchestrates multi-agent workflows. Enforces quality gates.
examples:
  - user: Start a new feature implementation
    assistant: I'll orchestrate Phase 0 (Team Assembly) and Phase 2 (Design approval)
lifecycle:
  phase: production
  created: 2026-05-29T00:00:00.000Z
  last_updated: 2026-06-08T00:00:00.000Z
  governance: docs/lifecycle/agents/pm.md
formal_name: Project Manager (PM) Agent
variant: co-develop
---
```

## The `@resolved-from` Pattern

Resolved copies replace the `extends:` field with a comment header:

```
# @resolved-from: ../../common/agents/pm.md
```

This comment:
- Is placed **before** the opening `---` delimiter.
- Records the L1-common source path for traceability.
- Signals that this file was produced by the L2 resolution pipeline (`l2-to-variant-pipeline.ts`).
- Must never be removed manually; it is used by the audit script to verify inheritance lineage.

## References

- [ADR-0031 — L1/L2 Fork Model](../adr/0031-l1-l2-fork-model.md)
- [ADR-0039 — L0/L1/L2 Hierarchy and `extends:` Pattern](../adr/0039-l0-l1-l2-hierarchy-and-extends.md)
