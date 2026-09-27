---
name: new-project
description: >
  Scaffolds a fresh project from a workspace variant template (templates/<variant>)
  into a self-contained, platform-wired workspace. Use when: starting a new
  engagement or project from an existing co-* team, creating a tenant project,
  spinning up a workspace-standard project from a template. NOT for creating new
  variant templates (use create-variant) or converting external repositories
  (use adopt-project).
status: active
scope: common
l2_propagate: false
version: 1.0.0
owner: scaffolding-expert
last_reviewed: 2026-09-27
relates_to:
  - skill: upgrade-project
    type: follows
  - skill: adopt-project
    type: relates_to
metadata:
  type: process
  triggers:
    - new project
    - create project
    - scaffold project
    - project from template
    - start a new engagement
---

# Skill: new-project

## When to Use

Use this skill to create a new project INSTANCE from an existing variant template
(`templates/co-*`) — for example, a new strategy-consulting engagement from `co-consult`,
or a new development workspace from `co-develop`.

**Boundary** (pick the right skill):

| Situation | Skill |
|---|---|
| New project instance from an existing `templates/<variant>` | **this skill** |
| Author a NEW variant template (domain does not exist yet) | `create-variant` |
| Convert an existing external repository into a workspace-standard project | `adopt-project` |
| Refresh an existing project to a newer template release | `upgrade-project` |

**Prerequisites**:
- Workspace root access (a clone of `ai_workspace`); `bun` and `git` installed
- The target variant template exists and is `stable` (`templates/<variant>/variant.json` → `status`)

## Process

### Step 1: Pick the variant

- [ ] List available variants: `ls templates/ | grep '^co-'`
- [ ] Confirm the variant fits the engagement (read `templates/<variant>/variant.json` → `description`, `agents`, `country_config`)
- [ ] Confirm `status: stable` (non-stable variants require an interactive confirmation; avoid for tenants)

### Step 2: Decide name, platform, and identity

- [ ] Project name: unique in `Projects/` (bare name lands at `Projects/<name>`)
- [ ] Platform profile: `claude` | `antigravity` | `codex` | `hermes` | `all`
      (`hermes` delivers `.hermes/skills/` + AGENTS.md only; `all` delivers every platform surface)
- [ ] Optional: `--description "<one sentence>"` and `--type web|cli|api|mcp` fill `docs/project.md` identity
- [ ] Optional: `--country <CODE>` when the variant declares `country_config` and the engagement is jurisdiction-specific

### Step 3: Scaffold (non-interactive)

```sh
cd <workspace-root> && CI=true bun scripts/new-project.ts "<project-name>" \
  --variant <co-variant> \
  --platform hermes \
  --description "<one sentence>" \
  --type web \
  --yes
```

Notes:
- The engine runs pre-flight gates (variant readiness, template validation) and rolls back
  partial directories on failure — fix the reported cause and re-run.
- `--version X.Y.Z` pins the template snapshot to git tag `template-vX.Y.Z`. Currently
  unavailable: the pinned path is defective on main (T-20260927-019) — omit the flag until it
  is fixed.

### Step 4: Verify

- [ ] Project tree exists at `Projects/<project-name>` with `AGENTS.md`, `package.json`,
      `skills/`, and the platform directory matching the profile (`.hermes/skills/` for hermes)
- [ ] Smoke: `cd Projects/<project-name> && bun scripts/verify-scripts.ts --verify`
- [ ] Template provenance recorded: `.claude/template-version.txt` + `docs/<variant>.context.md`

### Step 5: Wire the runtime

- [ ] Hermes profile: trust the project so its skills load —
      `hermes skills trust <project-dir>` (or add the dir to `skills.trusted_project_dirs`)
- [ ] First session: open the platform CLI in the project directory; the PM agent is the entry
      point (AGENTS.md §3)
- [ ] Template upgrades later: `upgrade-project` skill (accepts relocated/absolute project paths)

## References

- Engine: `scripts/new-project.ts` (lifecycle record: `docs/lifecycle/scripts/new-project.md`)
- E2E harness: `scripts/test-new-project.ts`; pipeline smoke: `simulate-pipeline` skill (`--mode project-creation`)
- Template releases: `templates/VERSION` + `template-v*` tags (ADR-0089)
- Sibling skills: `adopt-project`, `upgrade-project`, `create-variant`
