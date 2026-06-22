# Meeting Transcript
**Date**: 2026-06-22
**Topic**: Unresolved Items Follow-up — data-visualizer split/merge decision, accessibility-checker and localization-reviewer prioritization
**Participants**: research, storyline, design, image-curator, html-build, pdf-export
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Continuation of meeting-2026-06-22-diagram-agent.md. Two unresolved items from the prior session:
1. Separate `data-visualizer` agent vs. merge into `diagram-specialist`
2. `accessibility-checker` and `localization-reviewer` — priority and timing

---

## Transcript

### Round 1

**Design**: Argued for separation based on fundamentally different design thinking — diagrams encode relationships/structure (layout type selection), charts encode numbers/comparison (data encoding selection). Asked Storyline for empirical data on chart frequency.

**Storyline**: Reported approximate distribution: text 60%, photos 25%, concept diagrams 10%, data charts 5%. Noted that despite low frequency, chart slides are high-impact evidence slides. Proposed progressive integration — include bar/line/pie as 3 SVG chart types inside diagram-specialist initially, split into data-visualizer when demand grows.

**pdf-export**: Provided technical grounding — Chart.js/D3 require DOM/Canvas unavailable in pdf-lib. Static SVG charts (bar, line, pie) work perfectly in the PDF pipeline via resvg-js. Dynamic charts would be static snapshots anyway. Supported progressive integration.

**html-build**: Supported SVG-based chart integration (no external CDN dependency, better offline use). Proposed merging accessibility-checker and localization-reviewer INTO qa-reviewer as a multi-layer checklist executor rather than separate agents. Asked Research for empirical demand data.

**Research**: Reported that accessibility requirements appear explicitly in public institution / university contracts (Korean disability law, Ministry of Education e-learning guidelines) but rarely in corporate lectures. Language consistency is an implicit quality expectation in all engagements. Proposed 3-layer qa-reviewer structure: Layer 1 mandatory (structure), Layer 2 recommended (language + alt text + contrast), Layer 3 optional (full WCAG, activated via lecture-profile.md flag).

**Image-curator**: Supported progressive integration. Added that chart data sourcing requires a structured data table section in research_notes.md — without real number data, diagram-specialist cannot generate accurate charts. Also requested alt text verification in qa-reviewer Layer 2.

### Round 2

**Design**: Accepted progressive integration but insisted on internal module separation — DiagramRenderer + ChartRenderer as distinct modules within diagram-specialist, switchable by `type: diagram | chart`, to enable future clean extraction into data-visualizer. Added color contrast check (WCAG 4.5:1) to qa-reviewer Layer 2 as a baseline readability requirement for all projects.

**Storyline**: Formalized the visual_spec schema extension for charts:
```yaml
visual_spec:
  type: chart
  chart_type: bar | line | pie
  data:
    labels: ["2022", "2023", "2024"]
    series:
      - name: "Market Size (trillion KRW)"
        values: [12.3, 18.7, 29.4]
  source: "Source: Korea IDC, 2025"
```
Requested chapter balance check (slide distribution per chapter) be added to qa-reviewer Layer 1.

**pdf-export**: Confirmed visual_spec.data.source must auto-render as PDF caption via gen-slides-pdf.ts rule. Summarized final resolutions for both open issues.

**html-build**: Formalized diagram-specialist contract requirements for the agent file. Specified qa-reviewer dual execution timing — Layer 1+2 before Gate 2 (against storyline output), Layer 1+2+3 before Gate 5 (against HTML output).

---

## Resolutions

### Issue 1 — data-visualizer: INTEGRATED (progressive approach)
- Single `diagram-specialist` agent with internal `DiagramRenderer` (6 concept diagram types) + `ChartRenderer` (3 SVG chart types: bar, line, pie) modules
- Input for charts: `visual_spec.data` (labels, series[], source fields)
- `source` field auto-renders as PDF caption
- Agent file notes "extractable into data-visualizer when demand warrants"

### Issue 2 — accessibility-checker + localization-reviewer: MERGED INTO qa-reviewer
- 3-layer checklist structure
- Layer 1 (mandatory, Gate 2): bullet count, title length, missing images, chapter balance
- Layer 2 (recommended, Gate 2+5): language consistency, alt text presence, color contrast (WCAG 4.5:1)
- Layer 3 (optional, Gate 5): full WCAG — activated by `accessibility: true` in lecture-profile.md

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | pm | Medium | Create `agents/diagram-specialist.md` — DiagramRenderer(6 types)+ChartRenderer(3 types) internal module structure, visual_spec input contract, dual artifact output contract, assets/diagrams/ path | Both | Immediate |
| A-02 | storyline | Medium | Document visual_spec schema extension — type/diagram_type/elements/data(labels·series·source)/accent/caption fields; reflect in storyline agent file | Both | After A-01 |
| A-03 | pm | Medium | Create `agents/qa-reviewer.md` — 3-layer checklist, Gate 2·5 execution timing, lecture-profile.md accessibility flag integration | Both | Phase 2 |
| A-04 | research | Low | Add structured data table section to research_notes.md template — enables Storyline to reference chart data in visual_spec.data | Both | After A-02 |
| A-05 | pdf-export | Low | Add visual_spec.source → PDF caption auto-render rule to gen-slides-pdf.ts | Both | Phase 2 |
