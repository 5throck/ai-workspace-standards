# Variant Conversion Guide

**Version**: 1.0.0
**Last Updated**: 2026-07-14
**Scope**: Converting existing standalone projects into the co-* variant template system

---

## §1: Overview

This guide covers two distinct conversion scenarios:

| Scenario | Description | Tool |
|----------|------------|------|
| **A. Project → Variant Template** | Convert an existing standalone project into an official `co-*` variant template in `templates/` | `project-to-variant.ts` |
| **B. Existing Project → Variant-Based Project** | Re-home an existing project under a variant template for future upgrades | Manual + `upgrade-project.ts` |

---

## §2: Scenario A — Converting a Project to a Variant Template

### When to Use

You have an existing standalone project with:
- Custom agents, skills, or workflows
- Proven domain-specific patterns
- A desire to reuse it as a template for future projects

### Prerequisites

- The project must be a git repository
- The project should have a clean, well-organized structure
- You should understand the [3-Layer Architecture](constitution/07-new-project.md)

### Tool

```bash
bun scripts/project-to-variant.ts <project-path> [--name <variant-name>] [--type <variant-type>]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-path>` | Yes | Path to the existing project |
| `--name <name>` | No | Variant name (e.g., `co-analytics`). Defaults to project directory name |
| `--type <type>` | No | Variant type (must be registered: security, development, design, consulting, collaboration, lecture, game) |

### Step-by-Step Procedure

#### Step 1: Evaluate Suitability

Not every project should become a variant. Ask:

| Criterion | Threshold |
|-----------|-----------|
| Number of domain-specific agents | ≥ 3 |
| Number of domain-specific skills | ≥ 2 |
| Expected future reuse | ≥ 3 projects |
| Maturity level | Stable, tested in ≥ 2 engagements |

#### Step 2: Prepare the Project

```bash
# Ensure clean state
cd <project-path>
git status  # Should be clean

# Remove project-specific artifacts
rm -rf node_modules/ .env memory/ CHANGELOG.md

# Ensure consistent structure
# agents/  — domain-specific agent definitions
# skills/  — domain-specific skills (optional)
# scripts/ — variant-specific scripts (optional)
```

#### Step 3: Run Conversion

```bash
# From workspace root
bun scripts/project-to-variant.ts <project-path> --name <variant-name> --type <variant-type>
```

The tool will:
1. Diff the project against `templates/common/`
2. Keep only variant-unique files (files different from common)
3. Skip `.git/`, `node_modules/`, `memory/`
4. Generate `variant.json` if not present
5. Run `validate-templates.ts` for verification

#### Step 4: Post-Conversion Verification

```bash
# Verify the variant was created
ls templates/<variant-name>/

# Run validation
bun scripts/validate-templates.ts

# Verify variant.json
cat templates/<variant-name>/variant.json
```

#### Step 5: Complement with L2 Pipeline (Optional)

For a more thorough conversion with reconciliation and normalization:

```bash
# Alternative: Use the full L3-to-variant pipeline
# First, copy project to Projects/ as Phase A prototype
cp -r <project-path> Projects/<variant-name>/
cd Projects/<variant-name>/
git init && git add -A && git commit -m "initial"

# Then run the pipeline
cd <workspace-root>
bun scripts/l3-to-variant-pipeline.ts
```

This runs additional checks:
- Agent/skill normalization
- pm.md pre-flight (200-line limit, extends pattern)
- L0/L1 reconciliation (prunes files identical to common)
- Dependency validation
- Golden reference check

---

## §3: Scenario B — Adopting an Existing Project Into the Workspace Standard (automated)

### When to Use

You have an existing project that was created independently (not from a variant template), and you want to:
1. Align it with the workspace standard in place — AGENTS.md, the platform twins (CLAUDE.md/GEMINI.md/CODEX.md), docs/context.md, githooks, scripts — as if it had been created by `new-project.ts`
2. Keep the project's own content and git history (adoption never deletes or auto-commits)
3. Enable `upgrade-project.ts` for ongoing maintenance (and `project-to-variant.ts` for later template promotion)

### Script

```bash
# Preview the full plan without writing anything
bun scripts/adopt-project.ts <project-path> --variant co-<name> --dry-run

# Adopt for real (interactive confirmations; --yes accepts defaults)
bun scripts/adopt-project.ts <project-path> --variant co-<name> [--platform all|claude|antigravity|codex] [--yes]
```

### What the tool guarantees

| Concern | Behavior |
|---------|----------|
| Variant choice | Required; menu on omission; non-stable variants warn and confirm |
| Foreign content | Nothing deleted: every foreign file at a delivered path is backed up outside the repo and archived under `scripts/_legacy/` (de-executed) after delivery |
| Foreign skills | Protected from registry-driven prunes via a variant.json skill_manifest seed (removed post-delivery) |
| Foreign scripts | Retained `scripts/*.ts` are registered in the project SCRIPTS.md (with a `@version 0.0.1` stamp when missing) so the project audit passes |
| package.json | Created from the template when absent; merged (project keys win, workspace script surface + deps added) when present |
| Platform twins | Delivered per `--platform`; existing foreign twin prose is preserved via managed-block merge |
| Refusals (`--yes` cannot bypass) | Tracked secret-shaped files, hook-manager conflicts (husky/simple-git-hooks/lefthook), gitleaks findings in pre-existing content |
| Failure | Guided recovery (recorded HEAD SHA + backup path); resumable state ledger |

### Prerequisites

- The project is a git repository with a fully committed working tree
- `bun` is installed (workspace scripts and the pre-commit hook require it)
- No competing hook managers (remove or migrate them first — the tool refuses and explains)
- Identify the closest variant (table below)

### Variant Selection Guide

| Project Type | Closest Variant |
|-------------|----------------|
| UI/UX design, prototyping | co-design |
| Software development | co-develop |
| Security assessment | co-security |
| Consulting engagement | co-consult |
| Presentation/deck creation | co-deck |
| General work/documentation | co-work |
| Game development | co-game |

### After Adoption

```bash
cd <project-path>
git diff HEAD          # Review the delivered change set (adoption never commits)
bun scripts/audit.ts --skip-memory   # Already run by the tool; rerun any time
```

Future maintenance uses the standard upgrade path:

```bash
bun scripts/upgrade-project.ts <project-path> --variant co-<name>
```

### Migration Note (historical)

Before `adopt-project.ts` (2026-09-23), this scenario was manual: hand-create `.claude/template-version.txt`, run `upgrade-project.ts --dry-run`, and copy agents/skills by hand. That manual procedure is retired — the marker format it documented (`variant: co-<name>`, colon form) was never parseable by the engine, which reads `^variant=(.*)$` (equals form). Do not hand-create markers; adopt-project mints correct provenance.

---

## §4: Tool Disambiguation and Migration Decision Matrix

### Which tool for which direction?

| Intent | Tool |
|--------|------|
| External project → workspace-standard project, in place | **`adopt-project.ts`** (Scenario B) |
| Keep an adopted/standard project current with its template | `upgrade-project.ts` |
| Standard project → variant TEMPLATE for reuse | `project-to-variant.ts` / `l3-to-variant-pipeline.ts` (Scenario A) |
| Promote a beta variant template to stable | `promote-variant` skill |
| New project, starting fresh | `new-project.ts` (no conversion needed) |

### Decision matrix

| Current State | Recommended Path |
|--------------|-----------------|
| Mature project, ≥ 3 custom agents, want to reuse as template | Adopt first (`adopt-project.ts`), then Scenario A promotion once proven |
| Active project, want workspace governance + upgrade capability | Scenario B (`adopt-project.ts`) |
| New project, starting fresh | Use `new-project.ts` directly (no conversion needed) |
| Experiment/prototype, uncertain about variant fit | Keep standalone; adopt later if mature |

---

## §5: Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| No automated detection of closest variant | User must identify the right variant | Use the mapping table in §3 |
| Conversion is one-way | No automated "un-variant" process | Manual file cleanup |
| Adoption requires a fully committed working tree and bun | Dirty trees or bun-less environments abort pre-flight | Commit/stash first; install bun (`https://bun.sh`) |
| Conversion copies files as-is — it never authors a user guide | `validate-templates` WS-11 fails until the pair exists | Author `docs/user-guide.md` + `docs/user-guide_ko.md` per the User-Guide Standard ([variant-contract.md](governance/variant-contract.md)); also add the variant to all 6 index READMEs (WS-12) |

---

## §6: Related Documentation

- [Project Upgrade Guide](project-upgrade-guide.md) — Upgrading variant-based projects
- [Creating a Variant Guide](creating-a-variant.md) — Creating new variants from scratch
- [Project-to-Variant Skill](../skills/project-to-variant/SKILL.md) — Guided workflow for the Scenario A conversion path (invocable as the `project-to-variant` skill)
- [Fork Model (ADR-0031)](adr/0031-l1-l2-fork-model.md) — L1/L2 propagation philosophy
- [New Project Scaffolding](constitution/07-new-project.md) — L3 project creation
- [Variant Review Report (2026-07-14)](variant-review-report-2026-07-14.md) — Infrastructure audit results
