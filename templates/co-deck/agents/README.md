# co-deck Agent Roster

This folder contains the 8 specialized agents for the lecture/presentation material production workflow.

## Agent Index

| Agent | File | Phases | Handoff Chain |
|-------|------|--------|---------------|
| PM | `pm.md` | 0-6 (all) | → all agents |
| Version | `version.md` | 0-6 (cross-cutting) | ← all agents |
| Research | `research.md` | 1 | pm → research → storyline |
| Storyline | `storyline.md` | 2-3 | research → storyline → design |
| Design | `design.md` | 3 | storyline → design → html-build |
| Build | `html-build.md` | 4 | design → html-build → measure |
| Measure | `measure.md` | 4 | html-build → measure → pdf-export |
| Export | `pdf-export.md` | 4-5 | measure → pdf-export |

## Key Rules

- PM is the **only entry point** — users never talk directly to specialists
- Version Agent is **always called first** before any file modification
- Gates 2, 3, 5 require **explicit user approval** before advancing
- `project_state.json` is the **single source of truth** for lecture progress

See [`AGENTS.md`](../AGENTS.md) for the full workflow diagram and data flow.
