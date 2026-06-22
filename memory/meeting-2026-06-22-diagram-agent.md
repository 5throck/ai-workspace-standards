# Meeting Transcript
**Date**: 2026-06-22
**Topic**: Diagram Specialist Agent Introduction and Additional Agent Needs Review
**Participants**: research, storyline, design, image-curator, html-build, pdf-export
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**Research**: Identified the core bottleneck — `visual_spec` in `slide_deck.md` carries only text descriptions of needed diagrams, with no clear owner for SVG/code implementation. `gen-visual-images.ts` is too uniform and limited in layout types. Proposed that a `diagram-specialist` agent receive structured diagram seed data from `research_notes.md`. Asked Storyline about current `visual_spec` schema.

**Storyline**: Confirmed the gap — `visual_spec` today is unstructured text (`type: diagram, concept: AI learning cycle, layout: circular`) with no downstream interpreter. Proposed `diagram-specialist` accepting `visual_spec` from `slide_deck.md` and outputting SVG/D3 diagrams embeddable by html-build. Suggested formalizing a `visual_spec` schema extension.

**Design**: Supported the proposal but added a critical constraint — `diagram-specialist` must consume `design_spec.md` to inherit CSS variables (`--accent-color`, `--text-primary`, etc.) for brand consistency. Proposed per-type visual grammar rules. Also raised the need for a separate `data-visualizer` agent, arguing that concept diagrams and data charts require fundamentally different design thinking.

**Image-curator**: Acknowledged the role conflict — currently handles both license-clear photos AND concept diagrams, doing neither well. Proposed clean role split: `photo` → image-curator, `diagram` → diagram-specialist, `chart` → data-visualizer. Asked html-build about preferred embed format (inline SVG vs file reference).

**html-build**: Strongly advocated for inline SVG embed — CSS variable inheritance, animation capability, and PDF text extraction all favor inline. Flagged that generating SVG diagrams inline is a role overload for html-build. Also identified a missing `translator/localizer` agent for language consistency across slide content.

**pdf-export**: Supported inline SVG, adding PDF-specific rationale — PNG at 72dpi degrades in print; SVG via `@resvg/resvg-js` preserves vector quality. Strongly advocated for a `qa-reviewer` agent to automatically check bullet count, title length, image presence, and slide balance between Gate 2 and Gate 5.

### Round 2

**Research**: Proposed adding a "diagram seed" structured section to `research_notes.md`. Argued against building a generic diagram engine — advocated for a **template library approach** covering 6-7 common lecture diagram types (flow, cycle, matrix, pyramid, timeline, comparison) for quality consistency.

**Storyline**: Proposed a concrete `visual_spec` schema extension:
```yaml
visual_spec:
  type: diagram | photo | chart | none
  diagram_type: cycle | flow | matrix | pyramid | timeline | comparison
  elements:
    - label: "Step Name"
      order: N
  accent: primary | secondary | neutral
  caption: "Caption text"
```
Also proposed a `content-reviewer` agent for pre-Gate-2 automatic review of narrative flow, chapter balance, bullet density, and title consistency.

**Design**: Formalized the dual-artifact output requirement for diagram-specialist: (1) CSS-variable-referencing SVG for HTML embed; (2) hex-resolved SVG → PNG for PDF export. Proposed `accessibility-checker` agent for WCAG AA compliance (contrast, alt text, minimum font size).

**Image-curator**: Affirmed the photo/diagram/chart role split. Noted a collaboration case with diagram-specialist (photo textures inside SVG compositions). Supported `localization-reviewer` agent for Korean/English language consistency.

**html-build**: Confirmed that Design's dual-artifact contract matches current needs with no build-logic changes required. Placed diagram-specialist at Stage 3.5 parallel to image-curator. Supported qa-reviewer. Noted version-diff summary capability gap in current `version` agent.

**pdf-export**: Synthesized the agreed diagram-specialist contract: input = `visual_spec` + `design_spec.md`; output = CSS-variable SVG (html-build) + hex-resolved PNG (pdf-export); position = Stage 3.5 parallel to image-curator. Prioritized additional agents: qa-reviewer (most urgent) → data-visualizer (second) → content-reviewer (third); accessibility-checker and localization-reviewer as Phase 3.

---

## Points of Agreement

1. `diagram-specialist` agent is needed — full consensus.
2. Template library approach (6 types: cycle, flow, matrix, pyramid, timeline, comparison) over generic engine.
3. Dual artifact output: CSS-variable SVG (HTML) + hex-resolved PNG (PDF).
4. Stage 3.5 placement, parallel to image-curator.
5. Role split by `visual_spec.type`: photo → image-curator, diagram → diagram-specialist, chart → data-visualizer (TBD).
6. `visual_spec` schema extension required in `slide_deck.md`.

## Open Questions

- Separate `data-visualizer` vs. merge into `diagram-specialist` — unresolved; depends on scope decision.
- `accessibility-checker` and `localization-reviewer` — deferred to Phase 3.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | pm | Medium | Create `agents/diagram-specialist.md` — role, I/O contract, 6-type template list, design_spec.md integration rules | Both | Immediate |
| A-02 | storyline | Medium | Document `visual_spec` schema extension (diagram_type, elements[], accent fields) in agent file | Both | After A-01 |
| A-03 | pm | Medium | Evaluate `qa-reviewer` agent — auto quality gate between Gate 2 and Gate 5 | Both | Phase 2 |
| A-04 | pm | Low | Decide data-visualizer separation/merge, then create agent if warranted | Both | Phase 2 |
| A-05 | design | Low | Document requirements for accessibility-checker and localization-reviewer; reprioritize | Both | Phase 3 |
