# Agents Directory

This directory contains agent definition files for the co-consult engagement workflow.

## Available Agents

| Agent | File | Role | Tier |
|-------|------|------|------|
| Engagement Leader | `pm.md` | Engagement orchestration, client interface, final decisions, QA | High |
| Change Management Partner | `change-management-partner.md` | Organizational transformation, culture strategy, stakeholder alignment | High |
| Strategy Analyst | `strategy-analyst.md` | Market analysis, competitive research, financial modeling | Medium |
| Industry Expert | `industry-expert.md` | Industry-specific insights, competitive dynamics, regulatory landscape | High |
| Subject Matter Expert | `sme.md` | Functional expertise (HR, Finance, Operations, Marketing) | Medium |
| Communications Lead | `communications-lead.md` | Client communications, presentations, strategic narratives | Medium |
| Solutions Architect | `solutions-architect.md` | Technical solution design, system architecture, implementation roadmaps | Medium |
| Workstream Lead | `workstream-lead.md` | Workstream management, team coordination, progress tracking | Medium |
| Delivery Manager | `delivery-manager.md` | Project delivery, operations coordination, resource allocation | Low |
| Technology Specialist | `technology-specialist.md` | Collaboration platforms, workflow automation, digital transformation | Low |
| Data Analyst | `data-analyst.md` | Statistical analysis, data modeling, visualization, Korean DART financial statement analysis | Low |

## Creating New Agents

```bash
bun run agent:create <name> --role "Display Name" --group <group>

# Examples:
bun run agent:create risk-analyst --role "Risk Analyst" --group Strategy
bun run agent:create legal-advisor --role "Legal Advisor" --group Expert
```

After creating: update `AGENTS.md` and `docs/co-consult.context.md § Agents`.

## Listing Agents

```bash
bun run agent:list
bun run agent:list --group Strategy
```

## Deleting Agents

```bash
bun run agent:delete <name>
```

See `AGENTS.md` for the full workflow and dispatch protocol.
