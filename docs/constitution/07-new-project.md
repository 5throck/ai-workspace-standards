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
| `.agents/skills.json` | Customizations config registering skills/ | Ready to use (enables skill loading) |
| `scripts/` | audit.ts, dev-sync.ts, sync-md.ts, validate-*.ts, verify-*.ts, etc. | Workspace-management scripts excluded (scope `L0` in SCRIPTS.md) |
| `.githooks/` | pre-commit (audit gate) + pre-push (block main) | Ready to use |
| `CHANGELOG.md` | User-visible change history | Ready to use |
| `README.md` | GitHub landing page | Fill in project description |
| `.env.sample` | Environment variable template | Add required env keys |
| `.gitignore` | Standard ignore rules | Ready to use |
| `memory/MEMORY.md` | Session log index | Ready to use |

> **Extension templates** - ADR, analyst agent, skill, and daily log formats are **not**
> generated at project init. Find ready-to-copy examples in [`templates/_examples/`](templates/_examples/).

#### 7.3 L3 Exclusion Rules

Workspace-management artifacts are excluded **at the L0→L1 propagation stage** by `propagate-to-templates.ts`, so `templates/common/` only contains artifacts that belong in generated projects. `new-project.ts` applies a secondary safety-net check after copying, in case any artifact was added directly to `templates/common/` without going through the propagation pipeline.

| Artifact type | Exclusion mechanism | How to add new exclusions |
|---------------|---------------------|--------------------------|
| **Skills** | `l2_propagate: false` in `SKILL.md` frontmatter | Add `l2_propagate: false` to the skill's SKILL.md in `skills/` (root only — `propagate-to-templates.ts` will exclude it from `templates/common/` automatically) |
| **Scripts** | Scope `L0` in SCRIPTS.md | Set scope to `L0` in SCRIPTS.md (`propagate-to-templates.ts` will exclude it from `templates/common/` automatically) |

The filtering is automatic — `propagate-to-templates.ts` enforces it at publish time, and `new-project.ts` re-checks as a safety net. No hardcoded exclusion lists are maintained.

**Excluded skills** (workspace-management): `audit-workspace`, `create-variant`, `promote-variant`

**Excluded scripts** (workspace-management): `upgrade-project.ts`

#### 7.4 Post-Scaffold Checklist

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

> **Shared immutable context (`docs/context.md`) — Single Source of Truth**: The immutable
> project context lives ONLY at `templates/common/docs/context.md` (L1) and is copied verbatim
> into every new project's `docs/context.md`. **Variant templates MUST NOT carry their own
> `docs/context.md`** — the variant overlay runs after the common copy, so a variant-level copy
> would clobber common's canonical file (and then be locked with `merge=ours`). Variant-specific
> content (tech stack, agents, skills, workflow) MUST live in `docs/<variant>.context.md`, which
> *extends* `context.md`. Enforced by `validate-templates.ts` Check **WS-07** and the
> L3→variant (L2) promotion pipeline (`generate-variant.ts` excludes `docs/context.md`).

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

#### 7.4.5 Variant Scaffolding — File Overlay Mechanics

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

#### 7.5 Layer × Stage Reference Matrix

Two independent dimensions govern the workspace lifecycle:

- **Layer**: Physical file location — L0 (workspace root) / L1 (`templates/common/`) / L2 (`templates/co-*/`) / L3 (`Projects/*/`)
- **Stage**: Development phase — Phase A (Scaffold) / Phase B (Refinement & Reconcile) / Phase C (Template Promotion)

This table tracks the **variant-authoring** lifecycle specifically (creating a brand-new `co-<name>` variant). Day-to-day project creation from an *existing* L2 variant template (`new-project.ts`) is a separate, simpler L2→L3 copy that does not go through Phase A/B/C.

| | Phase A — Scaffold | Phase B — Refinement | Phase C — Promotion |
|---|---|---|---|
| **L0** (workspace root) | — | No L0 changes | `bun run propagate:apply` syncs L0→L1 |
| **L1** (`templates/common/`) | `propagate:apply` installs scripts | `propagate:docs` injects COMMON markers | — |
| **L2** (`templates/co-*/`) | — (does not exist yet) | — | `l2-to-variant-pipeline.ts` writes the promoted template here |
| **L3** (`Projects/<name>/`) | `create-l2-scaffold.ts` creates a new variant **draft** here | Developer refines the draft in place | Draft is consumed by promotion to L2 |

> **Key script roles**:
> - `create-l2-scaffold.ts` — creates a new variant **draft** at `Projects/<name>/` (L3), despite the "l2" in its own name and header comment (`"Phase A scaffold creation for new workspace variants (L2 / Projects/)"`) — the name follows ADR-0031's original terminology, which called this draft "L2" before this document's L3 layer existed
> - `l2-to-variant-pipeline.ts` — promotes that L3 draft into an official L2 variant template at `templates/co-<name>/` (same naming-predates-L3 caveat; its helpers `helpers/scan-l3-project.ts` and `helpers/reconcile-with-l0-l1.ts` now use L3-correct identifiers internally, matching this document's terminology)
> - `new-project.ts` — separately, creates an ordinary L3 project at `Projects/<name>/` from an *existing* L2 variant template — this is the everyday project-creation path, not variant authoring
> - `propagate:apply` — syncs L0→L1(common); `propagate:docs` — syncs L1(common)→L2(variants)
