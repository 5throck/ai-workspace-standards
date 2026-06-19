# co-deck Agent Roster

This folder contains the 10 specialized agents (PM + 9 specialists) for the lecture/presentation material production workflow.

## Agent Index

| Agent | File | Phases | Handoff Chain |
|-------|------|--------|---------------|
| PM | `pm.md` | 0-11 (all) | → all agents |
| Version | `version.md` | cross-cutting | ← all agents |
| Research | `research.md` | 1 | pm → research → source-verifier |
| Source Verifier | `source-verifier.md` | 1.5 | research → source-verifier → storyline (optional) |
| Storyline | `storyline.md` | 2-3 | source-verifier → storyline → design |
| Design | `design.md` | 4 | storyline → design → image-curator |
| Image Curator | `image-curator.md` | 3.5 | design → image-curator → html-build (optional) |
| Build | `html-build.md` | 5-8 | design → html-build → measure |
| Measure | `measure.md` | 9-10 | html-build → measure → pdf-export |
| Export | `pdf-export.md` | 11 | measure → pdf-export |

## Key Rules

- PM is the **only entry point** — users never talk directly to specialists
- Version Agent is **always called first** before any file modification
- `source-verifier` is **optional** — skip with `--skip-verify` for draft iterations
- `image-curator` is **optional** — skip if all slides use `image_role: none`
- Gates **1.5** (source trust), **2**, **3**, **5** require approval; Gates 1, 4 are optional
- `project_state.json` is the **single source of truth** for lecture progress

See [`AGENTS.md`](../AGENTS.md) for the full workflow diagram and data flow.
