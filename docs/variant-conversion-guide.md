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
- You should understand the [3-Layer Architecture](docs/constitution/07-new-project.md)

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
# Alternative: Use the full L2-to-variant pipeline
# First, copy project to Projects/ as Phase A prototype
cp -r <project-path> Projects/<variant-name>/
cd Projects/<variant-name>/
git init && git add -A && git commit -m "initial"

# Then run the pipeline
cd <workspace-root>
bun scripts/l2-to-variant-pipeline.ts
```

This runs additional checks:
- Agent/skill normalization
- pm.md pre-flight (200-line limit, extends pattern)
- L0/L1 reconciliation (prunes files identical to common)
- Dependency validation
- Golden reference check

---

## §3: Scenario B — Re-homing an Existing Project Under a Variant

### When to Use

You have an existing project that was created independently (not from a variant template), and you want to:
1. Align it with the variant template system for future upgrades
2. Adopt variant governance (agents, skills, hooks)
3. Enable `upgrade-project.ts` for ongoing maintenance

### Prerequisites

- Identify the closest matching variant (co-design, co-develop, etc.)
- The project should be under active development

### Step-by-Step Procedure

#### Step 1: Identify the Closest Variant

| Project Type | Closest Variant |
|-------------|----------------|
| UI/UX design, prototyping | co-design |
| Software development | co-develop |
| Security assessment | co-security |
| Consulting engagement | co-consult |
| Presentation/deck creation | co-deck |
| General work/documentation | co-work |
| Game development | co-game |

#### Step 2: Create a Template Version Marker

Create `.claude/template-version.txt` in your project:

```
variant: co-<name>
version: 0.5.3
platform: both
date: 2026-07-14
```

This enables `upgrade-project.ts` to detect and upgrade the project.

#### Step 3: Adopt Variant Infrastructure

Copy the variant's infrastructure files into your project:

```bash
# From workspace root, run upgrade with dry-run first
bun scripts/upgrade-project.ts <project-path> --variant co-<name> --dry-run

# Review output, then run for real
bun scripts/upgrade-project.ts <project-path> --variant co-<name>
```

This will:
- Set up git hooks (LOCKED files)
- Sync common scripts, agents, and skills
- Configure security bootstrap

#### Step 4: Adopt Variant Agents

Review the variant's agent roster and adopt relevant agents:

```bash
# List variant agents
ls templates/co-<name>/agents/

# Copy relevant agent definitions
cp templates/co-<name>/agents/<agent>.md <project>/agents/<agent>.md
```

Customize each agent definition for your project context.

#### Step 5: Adopt Variant Skills

```bash
# List variant skills
ls templates/co-<name>/.claude/skills/

# Skills are synced automatically by upgrade-project.ts
# For first-time setup, run upgrade or copy manually
```

#### Step 6: Verify Alignment

```bash
cd <project-path>
bun scripts/audit.ts           # Run workspace audit
bun scripts/validate-skills.ts  # Verify skills
```

---

## §4: Migration Decision Matrix

| Current State | Recommended Path |
|--------------|-----------------|
| Mature project, ≥ 3 custom agents, want to reuse as template | Scenario A (→ variant template) |
| Active project, want variant governance + upgrade capability | Scenario B (→ variant-based project) |
| New project, starting fresh | Use `new-project.ts` directly (no conversion needed) |
| Experiment/prototype, uncertain about variant fit | Keep standalone; convert later if mature |

---

## §5: Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|-----------|
| `project-to-variant.ts` has no SKILL.md | PM has no guided workflow | Follow this guide manually |
| No automated detection of closest variant | User must identify the right variant | Use the mapping table in §3 Step 1 |
| Conversion is one-way | No automated "un-variant" process | Manual file cleanup |
| Variant infrastructure adoption (Scenario B) is manual | Requires careful file-by-file adoption | Use upgrade-project.ts for automation where possible |

---

## §6: Related Documentation

- [Project Upgrade Guide](docs/project-upgrade-guide.md) — Upgrading variant-based projects
- [Variant Creation Skill](skills/create-variant/SKILL.md) — Phase A: New variant scaffolding
- [Variant Promotion Skill](skills/promote-variant/SKILL.md) — Phase B: Promoting prototypes
- [Fork Model (ADR-0031)](docs/adr/0031-l1-l2-fork-model.md) — L1/L2 propagation philosophy
- [New Project Scaffolding](docs/constitution/07-new-project.md) — L3 project creation
- [Variant Review Report (2026-07-14)](docs/variant-review-report-2026-07-14.md) — Infrastructure audit results
