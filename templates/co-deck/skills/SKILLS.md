# Skills Index — co-deck

This directory contains variant-specific skills for the `co-deck` template.

## Available Skills

| Skill | Directory | Purpose |
|-------|-----------|---------|
| Lecture PM | `lecture-pm/` | Orchestrate the 11-stage lecture production pipeline |
| Lecture Version | `lecture-version/` | Manage version snapshots before every file modification |
| Lecture Research | `lecture-research/` | Web research and source collection for lecture topics |
| Lecture Storyline | `lecture-storyline/` | Storyline design and slide deck composition |
| Lecture Design | `lecture-design/` | Visual style locking — layout, color palette, fonts |
| Lecture HTML Build | `lecture-html-build/` | HTML slide generation from slide_deck.md + design_spec.md |
| Lecture Measure | `lecture-measure/` | Playwright layout measurement and font download |
| Lecture PDF Export | `lecture-pdf-export/` | PDF generation from measured layout spec |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each `SKILL.md` file.

See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: co-deck variant team*
