> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §7 New Project Initialization
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 7. New Project Initialization {#new-project-initialization}

#### 7.1 Project Scaffolding Commands

**Every new project starts with a project scaffolding command:**

- **Claude Code**: `/new-project` (slash command in `.claude/commands/`)
- **CLI (cross-platform)**: `bun scripts/new-project.ts "<project-name>"`

> **Note**: `new-project.ts` is an L0-only script — it exists only in `scripts/` at the workspace root and is not propagated to `templates/common/scripts/` (L1). This is intentional: project scaffolding must run from the workspace, not from inside a generated project.

The script copies [`templates/`](templates/) directly into the new project directory,
substitutes the `[Project Name]` placeholder in all text files, removes `_examples/`,
and initializes git with hooks active.

#### 7.2 What Gets Generated

The [`templates/`](templates/) folder mirrors the exact structure of a new project -
browse it directly to see what every file should look like. All scaffold templates
live there as **real, editable files** (not embedded strings).

| Generated file | Purpose | Action needed |
|----------------|---------|---------------|
| `docs/context.md` | Single source of truth - 10 required sections | Fill in `[...]` placeholders |
| `AGENTS.md` | Canonical agent index | Ready to use |
| `agents/pm.md` + 4 others | Role definitions (pm, architect, designer, code-writer, test-runner) | `[Project Name]` already substituted |
| `CLAUDE.md` / `GEMINI.md` | Platform-specific overrides | Add project-specific settings if needed |
| `.claude/settings.json` | Hooks config (disabled by default - `{}`) | Enable PostToolUse if needed |
| `.gemini/settings.json` | Gemini project settings | Ready to use (add settings as needed) |
| `scripts/` | audit, dev-sync, sync-md (.ts) | Ready to use |
| `.githooks/` | pre-commit (audit gate) + pre-push (block main) | Ready to use |
| `CHANGELOG.md` | User-visible change history | Ready to use |
| `README.md` | GitHub landing page | Fill in project description |
| `.env.sample` | Environment variable template | Add required env keys |
| `.gitignore` | Standard ignore rules | Ready to use |
| `memory/MEMORY.md` | Session log index | Ready to use |

> **Extension templates** - ADR, analyst agent, skill, and daily log formats are **not**
> generated at project init. Find ready-to-copy examples in [`templates/_examples/`](templates/_examples/).

#### 7.3 Post-Scaffold Checklist

```
□ docs/context.md
    □ [Project Name] on line 1 replaced with actual project name
    □ ## Tech Stack filled in
    □ ## Architecture src/ map filled in
    □ [KEY_NAME] env vars filled in (or "N/A - no env vars required")
    □ All 10 sections present:
        macOS/Linux : grep "^## " docs/context.md
        Windows     : Select-String -Path docs/context.md -Pattern "^## "

□ agents/ - [Project Name] substituted in all 5 ## Role sections
    □ agents/pm.md          □ agents/architect.md   □ agents/designer.md
    □ agents/code-writer.md □ agents/test-runner.md

□ README.md - project description filled in

□ Final validation
    □ bun scripts/audit.ts    → must exit 0
    □ git config core.hooksPath .githooks    (already set by script - verify it stuck)

---

## Variant Context Template (SSOT)

The canonical template for all variant `<variant>.context.md` files is:

```
templates/common/docs/variant.context.template.md
```

### VARIANT-INJECT Governance

Variant-specific sections are marked with inject markers:

```
<!-- VARIANT-INJECT: <key> [REQUIRED|OPTIONAL] -->
...content...
<!-- END VARIANT-INJECT -->
```

| Classification | Meaning | Enforcement |
|----------------|---------|-------------|
| `REQUIRED` | Every variant must implement this section | `audit.ts` flags absence |
| `OPTIONAL` | Variant may include between standard sections | No enforcement |

**Required inject blocks** (every variant must have):
- `guidelines [REQUIRED]` — domain-specific rules section (Coding / Consulting / Security / Design / Writing)

**Generation**: `new-project.ts` and `generate-variant.ts` both call `applyContextTemplate()` from `scripts/helpers/template-utils.ts` to render `<variant>.context.md` from this template.

> **Conditional generation (Wave 1, fix C-03)**: `new-project.ts` creates `<variant>.context.md` only
> if the file is absent. An existing file is never overwritten. To force regeneration:
> `rm docs/<variant>.context.md && bun scripts/new-project.ts <name> <variant>`
>
> **Variant naming convention**: All variant names must follow the `co-` prefix convention enforced
> by `l2-to-variant-pipeline.ts` (regex: `^co-[a-z][a-z0-9-]{1,30}$`). See `docs/creating-a-variant.md`.
```

#### 7.3.5 Variant Scaffolding — File Overlay Mechanics

When `new-project.ts` creates a project from a variant template, it applies files in a specific order. Understanding this order is critical for variant template authors.

**Scaffolding pipeline order**:

```
Step 1: Copy templates/common/ → <project>/        (L1 common files land first)
Step 2: Delete WORKSPACE_ONLY_FILES from <project>/ (remove workspace-only files)
Step 3: Copy templates/co-<variant>/ → <project>/  (variant overlay — replaces/adds files)
Step 4: merge-package-scripts.ts                    (inject audit/dev-sync/sync-md into package.json)
Step 5: write-scripts-snapshot.ts                   (create scripts-snapshot.json)
```

**`WORKSPACE_ONLY_FILES`** — files deleted in Step 2 (cannot exist in a generated project):
```
package.json, package-lock.json, bun.lock, bun.lockb,
propagation-map.json, variant.json
```
These are workspace-management files that have no meaning inside a generated project.

**Variant `package.json` survival mechanism**:

The L1 `templates/common/package.json` is deleted in Step 2 as part of `WORKSPACE_ONLY_FILES`. The variant's `templates/co-<variant>/package.json` (if present) is then copied in Step 3. This is the project's root `package.json`, containing variant-specific `dependencies` (e.g., `pdf-lib`, `playwright`).

Step 4 (`merge-package-scripts.ts`) then **injects** three npm script entries into that package.json:
- `"audit"` → `bun scripts/audit.ts`
- `"dev-sync"` → `bun scripts/dev-sync.ts`
- `"sync-md"` → `bun scripts/sync-md.ts`

This ensures every scaffolded project has the standard lifecycle scripts regardless of what the variant's `package.json` declares.

**`scripts/SCRIPTS.md` preservation**: The L1 `templates/common/scripts/SCRIPTS.md` (30+ entries) lands in Step 1. A variant MUST NOT include `scripts/SCRIPTS.md` in its overlay (Step 3), or it will overwrite the L1 registry. Variant script registries belong at `scripts/<variant>/SCRIPTS.md`. See [§6.5 Variant-Specific Scripts](06.5-script-lifecycle.md#variant-specific-scripts-l2-layer).

---

#### 7.4 Layer × Stage Reference Matrix

Two independent dimensions govern the workspace lifecycle:

- **Layer**: Physical file location — L0 (workspace root) / L1 (templates/) / L2 (generated projects)
- **Stage**: Development phase — Phase A (Scaffold) / Phase B (Refinement & Reconcile) / Phase C (Template Promotion)

| | Phase A — Scaffold | Phase B — Refinement | Phase C — Promotion |
|---|---|---|---|
| **L0** (workspace root) | `create-l2-scaffold.ts` (new L1 variant) <br> `new-project.ts` (new L2 project) | No L0 changes | `bun run propagate:apply` syncs L0→L1 |
| **L1 common** (`templates/common/`) | `propagate:apply` installs scripts | `propagate:docs` injects COMMON markers | — |
| **L1 variant** (`templates/co-*/`) | Scaffold output created by `create-l2-scaffold.ts` | Manual reconcile — insert variant-specific content | — |
| **L2** (generated project) | `new-project.ts` output | Developer customization | `l2-to-variant-pipeline.ts` promotes to L1 |

> **Key script roles**:
> - `new-project.ts` — creates a new L2 project from a variant template
> - `create-l2-scaffold.ts` — creates a new L1 variant scaffold from scratch
> - `l2-to-variant-pipeline.ts` — promotes an existing L2 project to an L1 variant template
> - `propagate:apply` — syncs L0→L1(common); `propagate:docs` — syncs L1(common)→L1(variants)
