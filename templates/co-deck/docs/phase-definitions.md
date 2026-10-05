# Phase Definitions — co-deck

co-deck uses **two numbering systems at the same time**. Both are real; neither replaces the other:

1. **Delivery phases 0–6** — used in agent frontmatter `phases:` fields and in `variant.json` `skill_manifest`. These numbers are the skill/agent contract and are **never renumbered**.
2. **Pipeline stages 1–11** — the 11-stage slide pipeline used everywhere in prose (`agents/README.md`, `docs/user-guide.md` §4, `process/stages.yaml`, `decisions/gates.yaml`), including the fractional checkpoints **Stage 1.5** (Source Verification) and **Stage 3.5** (Image Curation + Diagram Generation). **Stage 0** is the PM intake that precedes Stage 1.

This file is the authority that maps the two systems so PM dispatches the right agent at the right stage. The mapping below is derived from `agents/README.md` (stage ownership and handoff chain), `docs/user-guide.md` §4 (engagement phase table and gate authority), and `variant.json` `skill_manifest`.

## Delivery Phase (0–6) ↔ Pipeline Stage (1–11) Mapping

| Phase | Name | Pipeline Stage(s) | Owning Agent(s) | Key Outputs |
|-------|------|-------------------|-----------------|-------------|
| 0 | Project Initiation | Stage 0 (PM intake) | pm, version | `lecture-profile.md` copied into the project; `project_state.json` initialized |
| 1 | Research | Stage 1 | research | `research_notes.md` |
| 1.5 | Source Verification | Stage 1.5 | source-verifier | `source-verification.md` + Trust Score (optional — `--skip-verify` for drafts) |
| 2 | Storyline | Stage 2 | storyline | `storyline.md` |
| 3 | Slide Deck + Design | Stages 3–4 | storyline, design | `slide_deck.md` (Stage 3); `design_spec.md` (Stage 4, Gate 3 lock) |
| 3.5 | Image Curation + Diagram Generation | Stage 3.5 | image-curator, diagram-specialist | `assets/images/` + `image-manifest.json`; `assets/diagrams/*.svg` (parallel, both optional) |
| 4 | HTML Build + PDF Prep | Stages 5–10 | html-build, measure | `lecture_<name>_vN.html` + `slidedata.json` (Stages 5–8); `layout_summary.md` + `pdf_layout_spec.json` (Stages 9–10) |
| 5 | PDF Export + Publish | Stage 11 | pdf-export, version | sample PDF (Gate 5) → final `lecture_<name>_vN.pdf`; version record |
| 6 | Retrospective | post-pipeline closeout | pm, version | lifecycle notes, version retrospective control |

Reconciliation notes (why frontmatter and stage numbers differ):

- **Phase 3 covers two stages**: Stage 3 (storyline writes `slide_deck.md`) and Stage 4 (design locks `design_spec.md`). This is why `agents/design.md` carries frontmatter `phases: [3]` while its body says "pipeline Stage 4" — both statements are correct.
- **Phase 4 covers six stages**: html-build owns Stages 5–8 (HTML Slide Generation, Image Binding, Balance Check, Special Pages); measure owns Stages 9–10 (Layout Measure, PDF Prep — the Playwright-free `prep-pdf` flow). `pdf-export` also participates in phase 4 through the `prep-pdf` skill (`skill_manifest`: prep-pdf is used by measure and pdf-export at phases [4]).
- **Phase 5 is Stage 11**: pdf-export generates the sample PDF for Gate 5 approval and then the full print-ready PDF; version binds the artifacts to the source revision.
- **Phase 6 has no numbered stage**: retrospective/closeout happens after Stage 11 (version-retrospective-control) with PM closeout.

### Per-agent stage ownership (pipeline stages 1–11)

| Agent | Frontmatter `phases` (contract) | Pipeline Stage(s) | Skills (skill_manifest phases) |
|-------|--------------------------------|-------------------|-------------------------------|
| pm | orchestrator | Stage 0 intake; gate reviews at 1.5, 2, 3, 4, 5 | theme-authoring (T-Stage, no phases) |
| research | [1] | Stage 1 | research [1] |
| source-verifier | [1.5] | Stage 1.5 | (agent-only; no dedicated SKILL.md) |
| storyline | [2, 3] | Stages 2–3 | storyline [2, 3] |
| image-curator | [3.5] | Stage 3.5 | (agent-only) |
| diagram-specialist | [3.5] | Stage 3.5 | (agent-only) |
| design | [3] | Stage 4 | design [3] |
| html-build | [4] | Stages 5–8 | html-build [4]; presenter-mode [4] |
| measure | [4] | Stages 9–10 | prep-pdf [4] |
| pdf-export | [4, 5] | Stages 9–11 (prep-pdf prerequisite; export owns Stage 11) | prep-pdf [4]; pdf-export [4, 5]; slide-layout-gate [4] |
| version | [0–6] | cross-cutting (snapshot before every edit, all stages) | version [0–6] |

## H-Stage Pipeline (Handbook) — No Phase Mapping

The handbook pipeline (H-0 through H-7) is **independent** of both delivery phases 0–6 and pipeline stages 1–11. It is triggered by handbook/course-site requests and does not participate in the slide pipeline:

| H-Phase | Agent | Work |
|---------|-------|------|
| H-0 | pm | Confirm topic, language, output dir, companion mode (dark mode is automatic) |
| H-1 | research | Web research (standalone only; companion mode reuses cached research) |
| H-2 | handbook-writer | Propose section types + chapter structure |
| H-3 | handbook-writer | Write chapter content (SECTION_TYPES + AUTHORING_GUIDELINES) |
| H-4 | handbook-writer | Generate Course Overview + Instructor Guide |
| H-5 | handbook-reviewer | handbook-doctor.ts + check-authoring.ts → fix |
| H-6 | pm | Apply theme → CSS → search index → meta |
| H-7 | pm | Secret scan + deploy + verify |

`handbook-writer` and `handbook-reviewer` are dispatched **only** in H-Stage — never in the 11-stage slide pipeline.

## Cross-Cutting Agents

- **version** — snapshots files before every edit and restores prior states on demand; active at every phase/stage (`phases: [0–6]`).
- **i18n-specialist** — locale documentation and language-policy enforcement (translation zones, Korean plain-language output); a cross-cutting common `extends:` stub, not a pipeline stage owner.

## Required Gates

Gate authority is `docs/user-guide.md` §4: **Gates 2 and 5 are mandatory**; Gates 1.5, 3, and 4 are optional (reviewed, then auto-advanced unless something looks wrong). Gate 1 is retired.

| Gate | Name | Stage | Decider / Reviewer | Mode |
|------|------|-------|--------------------|------|
| Gate 1.5 | Source Verification (Trust Score) | Stage 1.5 | source-verifier | Optional (`--skip-verify`; below-threshold Trust Score returns to research) |
| Gate 2 | Content / Storyline Approval | Stage 3 | storyline produces; user approves via pm | **Mandatory** |
| Gate 3.5 | Image Manifest Validation | Stage 3.5 | image-curator output; validated before html-build | Mandatory when images are used (0 duplicate `content_hash`) |
| Gate 3 | Design Lock | Stage 4 | design | Optional (review-then-proceed) |
| Gate 4 | Build / Layout Review | Stage 8 → 9 handoff | html-build; slide-layout-gate checks run before export | Optional |
| Gate 5 | Sample PDF Approval | Stage 11 | pdf-export produces; user approves via pm | **Mandatory** |

The machine-readable decision records for the procedure-derived checks live in `decisions/gates.yaml` (DG-DECK-01..05), bound to stages S3, S5, S8, S9, and S10 respectively. The H-Stage handbook pipeline has no numbered gates — H-5 (handbook-reviewer validation) and H-7 (PM secret scan + verify) serve that role.
