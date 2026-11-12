---
agent: automation-engineer
state: active
phase: production
created: 2026-06-02
last_updated: 2026-11-12
runtime: agents/automation-engineer.md (delivered from the common template since 2026-11-12)
---

# automation-engineer — Governance Record

Scope: Implements approved plans; MCP tools, Python data models, COM handlers, unit tests.

## Phase History

| Date       | Phase      | Note                          |
|------------|------------|-------------------------------|
| 2026-06-02 | created    | Agent definition created      |
| 2026-06-02 | production | Active                        |
| 2026-11-12 | production | Folded into the common `automation-engineer` 1.1.0 (CA-2+AE-2): the variant file and its `tier_ceiling_exempt` are removed; the CAD-specific bindings live in `docs/co-architect.context.md` ("Agent bindings — automation-engineer") |

## Acceptance Criteria

- Runtime definition `agents/automation-engineer.md` carries complete lifecycle frontmatter.
- Registered in the AGENTS.md roster. The `variant.json` agents[] entry is removed from the template (the file is delivered from the common layer); a gate-active co-architect project registers it in its own `variant.json` before an upgrade.
