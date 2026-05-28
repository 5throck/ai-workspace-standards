# Agents Directory

This directory contains agent definition files for the co-design workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Design PM | `pm.md` | Owns design workflow; dispatches design specialist agents |
| Design Lead | `design-lead.md` | Design system authority, visual consistency, component standards |
| Prototype Engineer | `prototype-engineer.md` | Interactive prototypes, component implementation |
| Service Designer | `service-designer.md` | End-to-end service blueprints, journey maps |
| Storyteller | `storyteller.md` | Design narrative, presentation strategy, stakeholder alignment |
| Typography Expert | `typography-expert.md` | Type systems, font pairing, readability standards |
| UX Researcher | `ux-researcher.md` | User research, usability testing, insight synthesis |
| Visual Designer | `visual-designer.md` | Visual identity, color systems, layout composition |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create motion-designer --role "Motion Designer" --group Design
bun run agent:create accessibility-expert --role "Accessibility Expert" --group Design
```

After creating: update `AGENTS.md` and `docs/co-design.context.md § Agents`.

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Design
```

## Deleting Agents

```bash
bun run agent:delete <name>
```

See `AGENTS.md` for the full workflow and dispatch protocol.
