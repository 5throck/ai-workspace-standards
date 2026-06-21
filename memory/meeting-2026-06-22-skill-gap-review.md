# Meeting Transcript
**Date**: 2026-06-22
**Topic**: Skill gap review — diagram-specialist addition and 4 themes/visual_spec/SVG-PNG pipeline reflection
**Participants**: research, storyline, design, image-curator, html-build, pdf-export, diagram-specialist
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**Research**: Identified critical gap in research skill — no structured data collection procedure for quantitative data (market size figures, statistics) that visual_spec.data.labels/series/source requires. Proposed adding `## Data Tables` section to research_notes.md template so Storyline can directly copy chart data into visual_spec.data fields.

**Storyline**: Confirmed the data gap. Additionally flagged that `skills/storyline/SKILL.md` has not been updated with the visual_spec schema added to the agent file. The skill still only covers image_role/image_query/image_license — no visual_spec authoring guidance. Proposed two fixes: (1) research Data Tables section, (2) storyline skill visual_spec authoring guide with per-diagram-type examples.

**Design**: Noted that theme-specific visual_spec constraints are not documented anywhere — notebook theme has no right panel so SVG conflicts with ruled-paper layout; pitch theme has floating card width constraints. Also flagged that design skill does not require a CSS variable hex map in design_spec.md, which diagram-specialist needs for PNG generation.

**Image-curator**: Flagged that image-curator skill has no slide filtering rule for the Stage 3.5 parallel execution scenario. Currently skill description implies it processes all slides; no rule for skipping image_role:diagram or image_role:chart slides. Also noted html-build skill references only image-manifest.json, not diagram-manifest.json. Proposed explicit skip rule in image-curator skill.

**Html-build**: Confirmed image-curator's point about Stage 6 binding. Current skill's Stage 6 only reads image-manifest.json. Missing: diagram-manifest.json lookup, role-based routing logic, SVG inline embed requirement (file reference breaks CSS variable scope), and per-theme SVG placement constraints (notebook gutter 64px, pitch card border-radius).

**Pdf-export**: Flagged two issues: (1) diagram PNG files are in assets/diagrams/ but pdf-export skill only references assets/images/ path; (2) visual_spec.source → PDF caption rendering decision from prior meeting is not implemented in gen-slides-pdf.ts or the pdf-export skill. Proposed including source and caption fields in diagram-manifest.json entries.

**Diagram-specialist**: Self-identified as missing a skill file entirely — agents/diagram-specialist.md exists but skills/diagram-specialist/SKILL.md does not. Outlined required skill content: SVG generation guide per type, chart SVG coordinate calculation, CSS variable → hex resolution procedure, @resvg/resvg-js PNG conversion pattern, diagram-manifest.json update procedure. Asked html-build about SSOT for diagram artifacts.

### Round 2

**Research**: Identified systemic pattern — agent files updated but skill files left behind (storyline agent has visual_spec, skill doesn't; image-curator agent needs skip rule, skill doesn't). Proposed adding agent-skill sync check to audit.ts or skill-lifecycle-manager skill.

**Storyline**: Agreed on sync pattern issue. Focused on visual_spec authoring guide priority items for storyline skill: (1) element count constraints per diagram_type (cycle: 3-6, matrix: fixed 4), (2) image_query empty string rule for diagram/chart roles. Asked pdf-export whether visual_spec.source should be in diagram-manifest.

**Design**: Clarified that agent-skill version parity is not the right enforcement model — roles are different. Proposed rule: "when agent file adds new input contract, corresponding skill prerequisites or execution steps must be updated." Answered html-build's CSS variable question: design skill must require a hex map section in design_spec.md listing --accent-color, --accent-secondary, --text-primary, --text-secondary, --text-muted, --card-bg, --card-dark, --card-border, --font-title, --font-body with hex values.

**Image-curator**: Formalized role-based filtering rule:
- image_role: background | illustrative | portrait → image-curator
- image_role: diagram | chart → diagram-specialist (image-curator skips)
- image_role: none → both skip

**Html-build**: Answered diagram-specialist's SSOT question: diagram-manifest.json is SSOT for artifact paths and metadata; slide_deck.md holds intent only. html-build and pdf-export must read manifest. Proposed Stage 6 rewrite as "Image + Diagram Binding" with role-based routing, SVG inline embed requirement, manifest fallback.

**Pdf-export**: Confirmed diagram-manifest as SSOT. Proposed manifest entry structure to include source and caption fields for PDF caption rendering. Flagged that gen-slides-pdf.ts has no diagram PNG embed code at all — this is an unimplemented feature requiring a script-level task.

**Diagram-specialist**: Proposed CSS variable hex map as markdown table in design_spec.md for easy parsing. Prioritized own skill file content: (1) SVG generation guide most urgent, (2) CSS variable usage rules, (3) PNG conversion procedure. Proposed adding "new agent must have matching skill file" rule to agents/README.md or audit.ts.

---

## Points of Agreement

1. `skills/diagram-specialist/SKILL.md` is missing — must be created; rule to enforce agent+skill pairing needed
2. `skills/storyline/SKILL.md` needs visual_spec authoring guide
3. `skills/image-curator/SKILL.md` needs slide filtering/skip rule for diagram/chart roles
4. `skills/html-build/SKILL.md` Stage 6 needs expansion to "Image + Diagram Binding"
5. `skills/design/SKILL.md` needs CSS variable hex map requirement for design_spec.md
6. `skills/research/SKILL.md` needs `## Data Tables` section in research_notes.md template
7. `skills/pdf-export/SKILL.md` + `gen-slides-pdf.ts` need diagram-manifest reference and source→caption rendering
8. `diagram-manifest.json` confirmed as SSOT for diagram/chart artifacts (not slide_deck.md)

## Open Questions

- Agent-skill sync enforcement: audit.ts version check vs file existence check — which is more practical?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| S-01 | pm | Medium | Create `skills/diagram-specialist/SKILL.md` — SVG generation guide (6 diagram + 3 chart types), CSS variable usage, PNG conversion via @resvg/resvg-js, manifest update procedure | Both | Immediate |
| S-02 | storyline | Medium | Update `skills/storyline/SKILL.md` — visual_spec authoring guide: diagram_type element constraints, chart data format, image_query empty-string rule | Both | Immediate |
| S-03 | image-curator | Medium | Update `skills/image-curator/SKILL.md` — slide filtering skip rule for image_role: diagram/chart | Both | Immediate |
| S-04 | html-build | Medium | Update `skills/html-build/SKILL.md` Stage 6 → "Image + Diagram Binding" — role-based routing, SVG inline embed requirement, diagram-manifest fallback, per-theme SVG placement constraints | Both | Immediate |
| S-05 | design | Medium | Update `skills/design/SKILL.md` — require CSS variable hex map section in design_spec.md output | Both | Immediate |
| S-06 | research | Medium | Update `skills/research/SKILL.md` — add `## Data Tables` section to research_notes.md template | Both | After S-02 |
| S-07 | pdf-export | Low | Update `skills/pdf-export/SKILL.md` + `gen-slides-pdf.ts` — diagram-manifest reference, assets/diagrams/ path, source→PDF caption render rule | Both | Phase 2 |
| S-08 | pm | Low | Add audit/README rule: new agent without matching skill file = warning | Both | Phase 2 |
