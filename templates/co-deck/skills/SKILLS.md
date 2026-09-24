# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-deck variant-exclusive skills (T-20260924-009). One row per variant-exclusive skill directory; values come from each skill's SKILL.md frontmatter.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `design` | 1.2.1 | active | design | 2026-08-24 | — | co-deck only — visual style locking — layout, palette, fonts |
| `html-build` | 1.5.0 | active | html-build | 2026-06-24 | — | co-deck only — HTML slide generation from slide_deck.md + design_spec.md |
| `pdf-export` | 2.1.1 | active | pdf-export | 2026-08-25 | — | co-deck only — PDF generation from the measured layout spec |
| `prep-pdf` | 2.0.0 | active | pdf-export | 2026-06-23 | — | co-deck only — PDF layout preparation with estimate-layout.ts calibration |
| `presenter-mode` | 1.0.1 | active | html-build | 2026-08-16 | — | co-deck only — dual-window presenter state sync (BroadcastChannel) |
| `research` | 1.2.1 | active | research | 2026-08-23 | — | co-deck only — web research and source collection for lecture topics |
| `slide-layout-gate` | 1.0.0 | active | pdf-export | 2026-08-26 | — | co-deck only — slide-content conformance gate (estimate-layout.ts --lint) |
| `storyline` | 1.2.0 | active | storyline | 2026-06-19 | — | co-deck only — lecture storyline and slide deck composition |
| `theme-authoring` | 1.0.1 | active | pm | 2026-06-21 | — | co-deck only — theme/style authoring pipeline (template.html + theme.json) |
| `version` | 1.3.0 | active | version | 2026-06-20 | — | co-deck only — version snapshots before every file modification |

> `handbook` and `handbook-sync-audit` were promoted to the common template (`templates/common/skills/`, 2026-08-30) — they are available to all variants and resolve via `inherits_common`; they intentionally carry no variant row.

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each `SKILL.md` file.

See [`agents/README.md`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: co-deck variant team*
