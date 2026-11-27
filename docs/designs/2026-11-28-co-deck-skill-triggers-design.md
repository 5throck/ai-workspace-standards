# co-deck Skill Triggers — 2026-11-28 (T-20261127-011)

- **Status**: implemented
- **Date**: 2026-11-28
- **Source ticket**: T-20261127-011 (service ticket, audit; template-side fix prescribed)
- **Executor**: automation-engineer

## Defect

`generate-version-manifest.ts` prints one aggregate drift line at scaffold
time ("9 drift issues detected") and records 9 `[WARNING]` rows in the
scaffolded project's `docs/VERSION_MANIFEST.md` Drift Detection section:
skills `design`, `html-build`, `pdf-export`, `prep-pdf`, `research`,
`slide-layout-gate`, `storyline`, `theme-authoring`, `version` have no
triggers defined. All nine are `templates/co-deck/skills/*/SKILL.md` template
content copied verbatim into scaffolds (co-develop: 0 rows; co-work: none).
`metadata.triggers` drives the fleet skill-graph routing — root skills all
carry triggers; every fresh co-deck scaffold starts with 9 drift warnings.

## Fix

Added a `metadata:` block (`type: process` + `triggers:` list) to the nine
`templates/co-deck/skills/*/SKILL.md` files — the house shape (181 template
skills use `metadata.triggers`; one uses top-level `triggers`), matching
presenter-mode (the sibling co-deck skill that already has triggers). Trigger
phrases are derived from each skill's own description "Responds to" phrases
plus the skill name — no invented keywords. Each skill: patch version bump +
`last_reviewed: "2026-11-28"`.

| skill | version | triggers added |
|-------|---------|----------------|
| design | 1.2.3 → 1.2.4 | design, lock design, pick colors, make design spec |
| html-build | 1.8.1 → 1.8.2 | html-build, make html, generate slides, add images, speaker intro |
| pdf-export | 2.2.1 → 2.2.2 | pdf-export, make pdf, export pdf, convert to pdf |
| prep-pdf | 2.0.2 → 2.0.3 | prep-pdf, prep for pdf, estimate layout, check pdf layout |
| research | 1.2.3 → 1.2.4 | research, research topic, collect sources, research notes |
| slide-layout-gate | 1.0.3 → 1.0.4 | slide-layout-gate, layout gate, lint slides, check slide bounds, slide content conformance |
| storyline | 1.7.0 → 1.7.1 | storyline, make storyline, compose slide deck, structure chapters |
| theme-authoring | 1.0.1 → 1.0.2 | theme-authoring, create a new theme, add a new style, dark theme |
| version | 1.3.2 → 1.3.3 | version, version snapshot, previous version, restore version, show version list |

Registry reconciliation: `templates/co-deck/skills/SKILLS.md` (9 rows) and
root `skills/SKILLS.md` (8 rows — the root registry has no `pdf-export` skill
row at all, a pre-existing gap left untouched) updated to the new versions +
last_reviewed. No lifecycle records exist for these skills
(`docs/lifecycle/skills/` carries none of the nine) — nothing to bump there.

## Acceptance

- `bun scripts/validate-skills.ts`: 0 errors / 0 warnings.
- A fresh co-deck scaffold's `generate-version-manifest.ts` run reports no
  trigger drift rows (verified via scaffold smoke check before ticket close).
