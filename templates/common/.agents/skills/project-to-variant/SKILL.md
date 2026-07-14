---
name: project-to-variant
description: "Convert an existing standalone project into an official variant template. Use when: a proven project should become a reusable template for future projects."
version: "1.0.0"
status: active
scope: workspace
owner: scaffolding-expert
triggers:
  - convert project to variant
  - create variant from project
  - project to template
  - promote project to variant
---

# Project to Variant

Converts an existing standalone project into an official `co-*` variant template.

## When to Use

- An existing project has proven domain-specific patterns worth reusing
- 3+ custom agents or 2+ custom skills have been developed
- The project is expected to spawn 3+ future projects
- The project has been tested in 2+ engagements and is stable

## Script

**Script**: `scripts/project-to-variant.ts`
**Usage**: `bun scripts/project-to-variant.ts <project-path> [--name <variant-name>] [--type <variant-type>]`

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<project-path>` | Yes | Path to the existing project |
| `--name <name>` | No | Variant name (e.g., `co-analytics`) |
| `--type <type>` | No | Registered type: security, development, design, consulting, collaboration, lecture, game |

## What It Does

1. Diffs the project against `templates/common/`
2. Keeps only variant-unique files
3. Skips `.git/`, `node_modules/`, `memory/`
4. Generates `variant.json` if not present
5. Runs `validate-templates.ts` for verification
6. Outputs manual review checklist

## Step-by-Step Procedure

1. **Evaluate suitability**: ≥3 domain agents, ≥2 skills, ≥3 expected future projects
2. **Prepare**: Remove `node_modules/`, `.env`, `memory/`, `CHANGELOG.md`
3. **Run conversion**: `bun scripts/project-to-variant.ts <project-path> --name <name> --type <type>`
4. **Verify**: `bun scripts/validate-templates.ts`
5. **Review variant.json**: Check agents, skills, script_manifest

## Alternative: Full L2 Pipeline

For a more thorough conversion with normalization:

```bash
cp -r <project-path> Projects/<variant-name>/
cd Projects/<variant-name>/ && git init && git add -A && git commit -m "initial"
cd <workspace-root>
bun scripts/l2-to-variant-pipeline.ts
```

## See Also

- [Variant Creation Skill](skills/create-variant/SKILL.md)
- [Variant Promotion Skill](skills/promote-variant/SKILL.md)
- [Variant Conversion Guide](docs/variant-conversion-guide.md)
- [Variant Review Report (2026-07-14)](docs/variant-review-report-2026-07-14.md)
