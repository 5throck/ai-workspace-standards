# GEMINI.md

> **All project context, coding guidelines, and dev workflow → [`docs/context.md`](docs/context.md)**
> Workspace-level Gemini behaviors → [`../GEMINI.md`](../GEMINI.md)

## Context Loading

Load project files at session start using the `@` syntax:
```
@../CONSTITUTION.md      # workspace design standard
@docs/context.md         # project knowledge (includes Session Start Skills)
@memory/MEMORY.md        # recent changes (skip if file does not exist)
```

## Project-Specific Gemini Settings

### Session Start
<!-- Skills are loaded from docs/context.md ## Session Start Skills.          -->
<!-- Add entries here ONLY for Gemini-exclusive skills not in context.md.     -->

### Model Selection Override
<!-- Uncomment to override workspace defaults for this project only.          -->
<!-- - Default      : gemini-2.5-pro                                          -->
<!-- - Fast lookups : gemini-2.5-flash                                        -->
