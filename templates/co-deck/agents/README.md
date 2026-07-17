# co-deck Agent Roster

This folder contains the 13 specialized agents (PM + 12 specialists) for the lecture/presentation material production workflow and handbook document production.

## Agent Index

| Agent | File | Phases | Handoff Chain |
|-------|------|--------|---------------|
| PM | `pm.md` | 0-11, H-0~H-7 (all) | → all agents |
| Version | `version.md` | cross-cutting | ← all agents |
| Research | `research.md` | 1, H-1 | pm → research → source-verifier |
| Source Verifier | `source-verifier.md` | 1.5 | research → source-verifier → storyline (optional) |
| Storyline | `storyline.md` | 2-3 | source-verifier → storyline → design |
| Design | `design.md` | 4 | storyline → design → image-curator ‖ diagram-specialist |
| Image Curator | `image-curator.md` | 3.5 | design → image-curator → html-build (optional, parallel with diagram-specialist) |
| Diagram Specialist | `diagram-specialist.md` | 3.5 | design → diagram-specialist → html-build (optional, parallel with image-curator) |
| Build | `html-build.md` | 5-8 | design → html-build → measure |
| Measure | `measure.md` | 9-10 | html-build → measure → pdf-export |
| Export | `pdf-export.md` | 11 | measure → pdf-export |
| Handbook Writer | `handbook-writer.md` | H-2~H-4 | pm → handbook-writer → handbook-reviewer |
| Handbook Reviewer | `handbook-reviewer.md` | H-5 | handbook-writer → handbook-reviewer → pm |

## H-Stage Pipeline (Handbook — Document Production)

Independent from the 11-Stage slide pipeline. Triggered by user requests for handbook, course site, or companion handbook.

```
H-0: PM — Confirm: topic, language, output dir, companion mode
H-1: research — Web research [Companion: skip, reuse cached outputs]
H-2: handbook-writer — Propose section types + chapter structure
H-3: handbook-writer — Write chapter content (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer — Generate Course Overview + Instructor Guide
H-5: handbook-reviewer — handbook-doctor.ts + check-authoring.ts → fix
H-6: PM/automation — Apply Theme → CSS → Search index → Meta
H-7: PM — Secret scan + deploy + verify
```

**H-Stage Rules**:
- Companion mode skips H-1 — reuses cached research, images, diagrams, references, versions
- Dark mode is auto (3-layer CSS) — no user preference prompt at H-0
- Theme is a domain step at H-6 (not just an asset)
- `examples/` serve as CI regression fixtures for `check-authoring.ts`

## Key Rules

- PM is the **only entry point** — users never talk directly to specialists
- Version Agent is **always called first** before any file modification
- `source-verifier` is **optional** — skip with `--skip-verify` for draft iterations
- `image-curator` is **optional** — skip if all slides use `image_role: none`
- `diagram-specialist` is **optional** — skip if no `visual_spec` fields exist in slide_deck.md
- `image-curator` and `diagram-specialist` run **in parallel** at Stage 3.5
- Gates **1.5** (source trust), **2**, **5** require approval; Gates 3, 4 are optional (Gate 1 retired)
- `project_state.json` is the **single source of truth** for lecture progress
- `handbook-writer` and `handbook-reviewer` are **only dispatched in H-Stage** — never in 11-Stage pipeline

See [`AGENTS.md`](../AGENTS.md) for the full workflow diagram and data flow.
