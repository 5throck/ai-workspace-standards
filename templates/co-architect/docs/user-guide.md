# Co-Architect User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> This guide explains how to *use* a co-architect project — how to hand architecture
> work to the firm's agent teams, what the six named workflows cover, and where output
> lands. For installation and first-time setup, see
> [`guides/first-time-user-guide.md`](guides/first-time-user-guide.md); for the full
> roster and repository layout, see [`../README.md`](../README.md); for governance
> rules, see [`../AGENTS.md`](../AGENTS.md).

## 1. Quick Start

1. Bring the engagement to the **PM** — it is the single entry point. Describe it in
   plain language: *"Renovation proposal for a 84㎡ apartment in Pangyo — market
   research, design exploration, and a permit-compliance check."*
2. For any multi-agent task, the PM shows an **execution plan table** (task | agent |
   tier | model | platform) and waits for your approval before dispatching specialists.
3. Work rides one of the **six named workflows**: `market-research`,
   `design-exploration`, `project-acquisition`, `design-delivery`,
   `permit-compliance`, `interior-execution`.
4. Engineering deliverables (SketchUp models, ZWCAD drawings) route through the
   **engineering team** lead (`sketchup-modeler`) and its CAD drafters.
5. Close with `/sync` — only after the PM's quality gates pass.

> **Rule of thumb**: regulatory statements (building code, zoning) always come from
> `bylaw-expert` against the KR profile — never from a drafting agent's memory.

## 2. What Kind of Task Do You Have?

| Your scenario | Likely agent(s) | Notes |
|---------------|-----------------|-------|
| Site/market research, competitor briefs | analyst, content-writer | research team |
| Concept design, mood boards, UX flows | design-lead, ux-researcher, visual-designer, prototype-engineer | design team |
| Service blueprint, customer journey | service-designer | design team |
| Typography, visual storytelling, rendering | typography-expert, design-storyteller, visualization-expert | design team |
| Scheduling, RFP/proposal acquisition | project-coordinator, ms365-expert | project team |
| Documentation, technical writing | technical-writer | project team |
| 3D modeling (SketchUp) | sketchup-modeler (lead) | engineering team |
| 2D CAD drawings (ZWCAD) | zwcad-drafter, drafting-architect | engineering team |
| Structural / MEP review | structural-engineer, mep-engineer | engineering team |
| Building code & zoning compliance | bylaw-expert | research team |
| Interior space planning & finishes | interior-designer | design team |

## 3. The Five Teams

```
                       User
                        │
                     PM (gateway)
        ┌───────────┬───┴───────┬─────────────┐
     Design       Research     Project     Engineering
   (design-lead)  (analyst)  (project-    (sketchup-
        │             │      coordinator)    modeler)
   8 members     3 members    2 members    4 members
                                          + platform-engineering
                                            (architect lead,
                                             automation-engineer)
```

24 specialist agents across 5 teams. The `platform-engineering` team maintains the
workspace's own scripts and skills (ADR-0036: TypeScript automation scripts).

## 4. MCP Servers (CAD stack)

| Server | Purpose |
|--------|---------|
| `zwcad-mcp` | 2D/3D ZWCAD file automation and drawing generation (56 tools) |
| `building_skill` | Korean Building Act and zoning regulation analysis |
| `base-map` | Local LLM inference for code review, embeddings, ensemble consultation |

Configure these in `.env` and your platform's `settings.local.json` (gitignored).
See [`co-architect.context.md`](co-architect.context.md) for the full tool stack.

## 5. CAD Intelligence Platform

The workspace carries a frozen-vconstitution CAD intelligence layer
(`src/cad_intelligence/`) for Korean apartment floor-plan reading: room/door/window
recognition scored against Korean-labeled ground truths, interior elevation
generation, and a machine-readable architectural-term glossary. The country profile
(`docs/countries/KR.md` + `src/cad_intelligence/ontology/profiles/KR.yaml`) is
selected by the `CAD_COUNTRY` variable; KR is the default.

Status labels on recognition output are advisory knowledge — verify against current
statutes before relying on any statement (see the profile's own warning).

## 6. Where Output Lands

| Deliverable | Location |
|-------------|----------|
| Design docs / ADRs | `docs/designs/`, `docs/adr/` |
| Drawings and rendering exports | `artifacts/` |
| Meeting transcripts, session logs | `memory/` |
| ZWCAD/SketchUp working files | project root or `artifacts/` (never commit binaries without PM approval) |

## 7. Beta Notice

This template is **beta (v0.1.0)**. Capabilities were promoted from the proven
`Projects/co-architect` workspace; engagement feedback is being collected. Design-domain
skills (accessibility audit, UI/UX intelligence, service design, token usage, design
tokens) are consumed from the **co-design hub** via the `hub.consumes` declaration in
`variant.json` — upgrade flows arrive through hub promotion waves, not local edits.
