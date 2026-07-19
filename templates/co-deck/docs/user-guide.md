# co-deck User Guide

A practical, task-oriented guide to producing lecture decks and handbooks with the co-deck agent team. For the roster overview and marketing-style summary, see [README.md](../README.md). For governance and pipeline internals, see [AGENTS.md](../AGENTS.md).

## 1. Quick Start

co-deck follows the workspace's **PM Gateway** pattern: you never talk to a specialist agent directly — every request goes through the `pm` agent, which triages the request, builds an execution plan, and dispatches the right specialist(s).

1. **Start the engagement** by describing what you want in plain language (e.g. "make a lecture on climate finance for graduate students" or "make a companion handbook for this deck").
2. **PM classifies the request** and, for any multi-step task (2+ files or 2+ sequential steps), displays an **execution plan table** before dispatching anyone:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [task] | [specialist] | High/Medium/Low | [model] |
   | N | `/sync "type(scope): message"` | pm | Medium | [model] |

3. **PM dispatches specialists** via the `Agent` tool, one stage at a time (writes are serial; read-only research/analysis can run in parallel — e.g. `image-curator` and `diagram-specialist` at Stage 3.5).
4. **You approve at mandatory gates** (Gate 2 — content ready; Gate 5 — sample PDF ready). Optional gates (1.5, 3, 4) are reviewed and auto-advanced.
5. **Finish with `/sync`**: once the deliverable is ready, run `/sync "feat(deck): <what changed>"` — this is the *only* sanctioned way to commit. It runs memlog → CHANGELOG entry → audit → commit → push → PR. Direct `git commit`/`git push` and `--no-verify` are blocked by the pre-commit hook.

> Never invoke `research`, `storyline`, `design`, `html-build`, `image-curator`, `diagram-specialist`, `measure`, `pdf-export`, `version`, `handbook-writer`, or `handbook-reviewer` directly — always ask PM.

## 2. What kind of deck task do you have?

Use this lookup table to see which agent + skill PM will route your request to. Names below match the actual files in `agents/` and `skills/`.

| Your task / scenario | Agent | Skill | Notes |
|---|---|---|---|
| Gather sources, facts, and background on a topic | `research` | `research` | Loads `lecture-profile.md`; writes `research_notes.md`; Stage 1 |
| Check that cited URLs/sources are real and trustworthy | `source-verifier` | (no dedicated SKILL.md; agent-only) | Outputs `source-verification.md` + Trust Score; Stage 1.5, optional (`--skip-verify`) |
| Storyline / narrative structure, chapter flow, slide-by-slide outline | `storyline` | `storyline` | Produces `storyline.md` + `slide_deck.md` with `image_role`/`image_query` fields; Stages 2-3 |
| Theme/visual design — color palette, fonts, layout lock | `design` | `design` | Produces `design_spec.md`; Stage 4; can analyze reference URLs/images |
| Find and download slide images (Pixabay/Unsplash/Pexels) | `image-curator` | (no dedicated SKILL.md; agent-only) | Outputs `assets/images/` + `image-manifest.json`; Stage 3.5, optional, runs parallel with diagram-specialist |
| Generate SVG concept diagrams or data charts | `diagram-specialist` | (no dedicated SKILL.md; agent-only) | 6 diagram types (cycle/flow/matrix/pyramid/timeline/comparison) + 3 chart types (bar/line/pie); Stage 3.5, optional |
| Build/generate the actual HTML slide deck | `html-build` | `html-build` | Applies `data-theme`, injects images, speaker intro, contact slide; Stages 5-8 |
| Measure rendered layout for PDF export (legacy, Playwright) | `measure` | `measure` | **Deprecated** — superseded by `prep-pdf` |
| Prepare for PDF export without Playwright | `pdf-export` | `prep-pdf` | Resolves the 4-layer spec merge (base → theme → style → overrides); Stages 9-10 |
| Generate the sample or final print-ready PDF | `pdf-export` | `pdf-export` | Sample (5 slides) then full PDF via `pdf-lib`; Stage 11 |
| Handbook / documentation site / course site build | `handbook-writer`, `handbook-reviewer` | `handbook` | Independent H-Stage pipeline (H-0~H-7); see §3 below |
| Revert a file to a previous version, or snapshot before an edit | `version` | `version` | Cross-cutting; called automatically before every edit by any agent |
| Create a new visual theme or style variant | `design`, `html-build`, `storyline` (T-Stage) | `theme-authoring` | Entry point routes to the lightweight Style Workflow or the 5-step T-Stage Theme Workflow |

## 3. Handbook Pipeline Walkthrough (H-Stage)

When you ask for **"make handbook"**, **"create handbook"**, **"build course site"**, or **"companion handbook"**, PM switches out of the 11-Stage slide pipeline and into the **H-Stage pipeline** — a separate, self-contained flow for producing a searchable, themed handbook as a static site (standalone, a companion to an existing lecture deck, or a full multi-lecture course site).

```
H-0: PM            — Confirm topic, language, output dir, companion mode (dark mode is automatic)
H-1: research       — Web research (standalone mode only; companion mode reuses cached research)
H-2: handbook-writer — Propose section types + chapter structure
H-3: handbook-writer — Write chapter content (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer — Generate Course Overview + Instructor Guide
H-5: handbook-reviewer — Run handbook-doctor.ts + check-authoring.ts, apply fixes
H-6: PM/automation  — Apply theme, generate CSS, build search index, meta tags
H-7: PM             — Secret scan, deploy, verify
```

**Companion mode** (`companion: true`) skips H-1 and reuses cached artifacts from an existing lecture project instead of re-researching:
- `research_notes.md` (Research Package)
- `assets/images/` from `image-manifest.json` (Image cache)
- `assets/diagrams/*.svg` (Diagram cache)
- References from `source-verification.md` (Reference cache)
- `_versions/` snapshots (Version cache)

Full pipeline spec: `skills/handbook/SKILL.md`.

## 4. Engagement / Production Phase Structure

co-deck maps every deliverable to a phase, per `AGENTS.md` §3.5 and §4.1.5:

| Phase | Name | PM Role | Specialist Agent(s) |
|---|---|---|---|
| 0 | Project Initiation | Owner — reads `lecture-profile.md`, initializes `project_state.json` | — |
| 1 | Research | Direct handoff | `research` |
| 1.5 | Source Verification | Gate 1.5 reviewer — checks Trust Score | `source-verifier` (optional) |
| 2-3 | Storyline | Gate 2 approver (mandatory) | `storyline` |
| 3.5 | Image Curation + Diagram Generation | Observer | `image-curator` ‖ `diagram-specialist` (both optional, run in parallel) |
| 4 | Design | Gate 3 reviewer (optional) | `design` |
| 5-8 | HTML Build | Gate 4 reviewer (optional) | `html-build` |
| 9-10 | Layout Measure / PDF Prep | Observer | `measure` (deprecated) or `prep-pdf` |
| 11 | PDF Export | Gate 5 approver (mandatory) | `pdf-export` |

**Mandatory gates**: Gate 2 (content/storyline approval) and Gate 5 (sample PDF approval) require your explicit sign-off before PM proceeds. Gates 1.5, 3, and 4 are optional — PM reviews the output and auto-advances unless something looks wrong (e.g. Trust Score below 70%).

The H-Stage handbook pipeline (§3 above) runs independently of this table when a handbook, rather than a slide deck, is the deliverable.

There is also a lightweight **T-Stage pipeline** for authoring new themes/styles (see `theme-authoring` in the lookup table above) — it is not part of the main 11-stage production flow.

## 5. Output / Deliverable Locations

Every lecture project lives under `presentations/<project-name>/`, created from Stage 0:

```
presentations/<project-name>/
  lecture-profile.md          # project-local copy of docs/lecture-profile.md
  project_state.json          # per-step status/approval tracking
  research_notes.md           # Stage 1 output
  source-verification.md      # Stage 1.5 output (Trust Score)
  storyline.md                # Stage 2 output
  slide_deck.md                # Stage 2-3 output (per-slide content + image_role/image_query)
  design_spec.md               # Stage 4 output (colors/fonts/layout)
  assets/images/                # Stage 3.5 output (image-curator)
  image-manifest.json           # Stage 3.5 output
  assets/diagrams/*.svg (+.png)  # Stage 3.5 output (diagram-specialist)
  diagram-manifest.json          # Stage 3.5 output
  lecture_vN.html                # Stage 5-8 output (html-build)
  pdf_layout_spec.md / layout summary  # Stage 9-10 output
  sample_5slides.pdf             # Stage 11 sample output (Gate 5)
  <project-name>.pdf              # Stage 11 final print-ready output
  _versions/                      # version-agent snapshots (cross-cutting)
```

Shared, project-independent assets live under `docs/`:

- `docs/lecture-profile.md` — master profile template copied into each new project
- `docs/html-themes/` — theme/style registry (`THEMES.md`), shared `styles/`, `themes/`, and `preview/preview.html`
- `docs/co-deck.context.md`, `docs/designs/` — variant context and design notes

Handbook deliverables (H-Stage) are written to the output directory you confirm at H-0 (standalone handbook, lecture companion, or full course site) and deployed as a static site per H-6/H-7.

Automation scripts backing all of the above live in `scripts/co-deck/` (see `scripts/co-deck/SCRIPTS.md` for the full manifest) — you generally don't call these directly; the dispatched specialist agents run them for you.
