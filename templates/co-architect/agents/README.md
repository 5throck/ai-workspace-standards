# Agents Directory

This directory contains agent definition files for the co-architect multi-agent workspace.

## Available Agents

### Orchestration

| Agent | File | Role |
|-------|------|------|
| Co-Architect PM | `pm.md` | Cross-team orchestrator; routes to Design / Research / Project / Engineering team leads at Phase 0 |

### Design Team (Lead: design-lead)

| Agent | File | Role |
|-------|------|------|
| Design Lead | `design-lead.md` | Team lead; design system architecture and visual direction |
| UX Researcher | `ux-researcher.md` | User research, usability analysis, insight synthesis |
| Visual Designer | `visual-designer.md` | Visual designs, design tokens, component specifications |
| Prototype Engineer | `prototype-engineer.md` | Interactive prototypes and handoff artifacts |
| Service Designer | `service-designer.md` | End-to-end service experience and journey mapping |
| Typography Expert | `typography-expert.md` | Font selection, type hierarchy, readability |
| Design Storyteller | `design-storyteller.md` | Design philosophy, brand narrative, meaning coherence |
| Visualization Expert | `visualization-expert.md` | Photorealistic 3D rendering and bird's-eye view visualization |
| Interior Designer | `interior-designer.md` | Interior space planning, furniture layout, material finishes |

### Research Team (Lead: analyst)

| Agent | File | Role |
|-------|------|------|
| Analyst | `analyst.md` | Team lead; systematic research, data synthesis, evidence gathering |
| Content Writer | `content-writer.md` | Transforms research into documentation and communications |
| Storyteller | `storyteller.md` | Organizational culture, change narratives, historical context |
| Bylaw Expert | `bylaw-expert.md` | Building code, zoning regulations (BCR/FAR), municipal bylaws |

### Project Team (Lead: project-coordinator)

| Agent | File | Role |
|-------|------|------|
| Project Coordinator | `project-coordinator.md` | Team lead; schedule, stakeholder communication, delivery, RFP tracking, proposal coordination |
| Technical Writer | `technical-writer.md` | Technical documentation, API references, architecture guides |
| MS365 Expert | `ms365-expert.md` | Microsoft 365 platform, SharePoint, Teams integration |

### Engineering Team (Lead: sketchup-modeler)

| Agent | File | Role |
|-------|------|------|
| SketchUp Modeler | `sketchup-modeler.md` | Team lead; converts Design Team mockups into SketchUp 3D models |
| ZWCAD Drafter | `zwcad-drafter.md` | 2D technical drawing production (floor plans, elevations, sections) in ZWCAD |
| Drafting Architect | `drafting-architect.md` | Architectural drafting standards lead, section details, DWG set audit |
| Structural Engineer | `structural-engineer.md` | Structural feasibility, load path analysis, bearing wall classification |
| MEP Engineer | `mep-engineer.md` | Building services (HVAC/electrical/plumbing), shaft routing, RCP integration |

### Platform Engineering Team (Lead: architect)

| Agent | File | Role |
|-------|------|------|
| Architect | `architect.md` | Team lead; design docs and implementation plans for the MCP server / CAD-automation backend |
| Automation Engineer | `automation-engineer.md` | Implements approved plans — MCP tools, Python data models, COM handlers, unit tests |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create data-analyst --role "Data Analyst" --group Research
bun run agent:create ux-writer --role "UX Writer" --group Content
```

After creating: update `AGENTS.md` and `docs/co-architect.context.md § Agents`.

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
