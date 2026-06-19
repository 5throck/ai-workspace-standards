# Skills Index — co-deck

This directory contains variant-specific skills for the `co-deck` template.

## Available Skills

| Skill | Directory | Purpose |
|-------|-----------|---------|
| Version | `version/` | Manage version snapshots before every file modification |
| Research | `research/` | Web research and source collection for lecture topics |
| Storyline | `storyline/` | Storyline design and slide deck composition |
| Design | `design/` | Visual style locking — layout, color palette, fonts |
| HTML Build | `html-build/` | HTML slide generation from slide_deck.md + design_spec.md |
| Measure | `measure/` | Playwright layout measurement and font download |
| PDF Export | `pdf-export/` | PDF generation from measured layout spec |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each `SKILL.md` file.

See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: co-deck variant team*
