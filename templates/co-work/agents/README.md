# Agents Directory

This directory contains agent definition files for the co-work collaboration workflow.

## Available Agents

| Agent | File | Role |
|-------|------|------|
| Collaboration PM | `pm.md` | Owns research workflow, documentation strategy, stakeholder alignment |
| Analyst | `analyst.md` | Research synthesis, data analysis, evidence gathering |
| Content Writer | `content-writer.md` | Drafts reports, articles, and structured content |
| MS365 Expert | `ms365-expert.md` | Microsoft 365 tools, SharePoint, Teams integrations |
| Project Coordinator | `project-coordinator.md` | Task tracking, timeline management, meeting facilitation |
| Storyteller | `storyteller.md` | Narrative structure, audience-appropriate communication |
| Technical Writer | `technical-writer.md` | Technical documentation, API docs, process guides |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create data-analyst --role "Data Analyst" --group Research
bun run agent:create ux-writer --role "UX Writer" --group Content
```

After creating: update `AGENTS.md` and `docs/co-work.context.md § Agents`.

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Research
```

## Deleting Agents

```bash
bun run agent:delete <name>
```

See `AGENTS.md` for the full workflow and dispatch protocol.
