---
name: project-to-variant
description: "Convert an existing standalone project into an official variant template. Use when: a proven project should become a reusable template for future projects."
version: "1.3.0"
status: active
scope: workspace
owner: scaffolding-expert
last_reviewed: 2026-08-23
relates_to:
  - skill: promote-variant
    type: composes_with
metadata:
  type: scaffolding
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
**Usage**: `bun scripts/project-to-variant.ts --source <project-path> --target <variant-name> [--dry-run] [--force] [--design-doc <path>] [--threshold-files <n>] [--threshold-dirs <n>]`

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--source <path>` | Yes | Path to the existing project (e.g., `Projects/co-legal`) |
| `--target <name>` | Yes | Variant name, must match `^co-[a-z][a-z0-9-]{1,30}$` (e.g., `co-legal`) |
| `--dry-run` | No | Preview without writing files |
| `--force` | No | Proceed even if the complexity routing check recommends the Full L2 Pipeline instead |
| `--design-doc <path>` | No | Auto-register this spec via `spec-register.ts` (can't be auto-discovered) |
| `--threshold-files <n>` | No | Override the variant-unique-file-count routing threshold (default 40) |
| `--threshold-dirs <n>` | No | Override the large-domain-dir-count routing threshold (default 3) |

## What It Does

1. Diffs the project against `templates/common/`
2. Keeps only variant-unique files
3. Skips `.git/`, `node_modules/`, `memory/`
4. **Complexity routing check**: if the project diverges significantly from `templates/common/` (more than `--threshold-files` variant-unique files, or more than `--threshold-dirs` domain directories with >15 files each that don't exist in `templates/common/`), it prints a recommendation to use the Full L2 Pipeline instead and aborts unless `--force` is passed — this automates the judgment call that used to live only in this doc's prose (see Alternative below)
5. Generates `variant.json` if not present
6. Runs `validate-templates.ts` for verification
7. Regenerates `templates/<target>/AGENTS.md` via `regenerate-agents-md.ts` (mechanical — always run, not gated on judgment)
8. Registers the spec via `spec-register.ts` if `--design-doc` was passed
9. Outputs a manual review checklist for the remaining judgment-based items only (`pm.md` override review, `CLAUDE.md`/`GEMINI.md` narrative context, country-profile review items)

### Country Profiles and Country-Scoped Skills

When the source project carries country assets, the conversion handles them as follows:

- `docs/countries/ACTIVE.md` is **excluded** - it records this project's country selection (project state), not reusable template knowledge
- `docs/countries/<CODE>.md` profiles **are carried** into the template - they are durable jurisdiction knowledge (statutes, regulators, formats)
- The `country_config` key in `variant.json` is **preserved**, keeping `supported` in sync with the carried profiles
- Country-scoped skills (`k-law`, `k-dart`, `k-kosis` - see the `country_scoped_assets` registry in `docs/workspace-schema.json`) are **never copied** into the variant: they already live in `templates/common/skills/` and deploy only to matching-country projects at scaffold time

When reviewing the output, confirm `country_config.supported` matches exactly the profiles carried into `templates/<target>/docs/countries/`. The full L2 pipeline (`l3-to-variant-pipeline.ts`) applies the same rules. See ADR-0057 for the full mechanism.

## Step-by-Step Procedure

1. **Evaluate suitability**: ≥3 domain agents, ≥2 skills, ≥3 expected future projects
2. **Prepare**: Remove `node_modules/`, `.env`, `memory/`, `CHANGELOG.md`
3. **Run conversion**: `bun scripts/project-to-variant.ts --source <project-path> --target <variant-name> --design-doc <path-to-design-doc>`
4. **Verify**: `bun scripts/validate-templates.ts`
5. **Review variant.json**: Check agents, skills, script_manifest, and `country_config` (if country profiles were carried)
6. **Complete the printed manual checklist**: `pm.md` overrides and `CLAUDE.md`/`GEMINI.md` narrative context — everything else is now automated

## Alternative: Full L2 Pipeline

The script itself recommends this automatically when the complexity routing check trips (see step 4 above). For a more thorough conversion with ADR-referenced review, anti-swelling checks, and platform-parity enforcement:

```bash
cp -r <project-path> Projects/<variant-name>/
cd Projects/<variant-name>/ && git init && git add -A && git commit -m "initial"
cd <workspace-root>
bun scripts/l3-to-variant-pipeline.ts --auto-fix-agents-md --auto-fix-pm-md
```

Since `l3-to-variant-pipeline.ts` 1.11.0, `--auto-fix-agents-md` / `--auto-fix-pm-md` let the pipeline regenerate the variant `AGENTS.md` from the L3 roster, and `generate-variant.ts` ≥ 1.12.0 materializes domain skills into all three skill roots, preserves agent `lifecycle` frontmatter, and re-applies VARIANT-INJECT markers — the manual post-run fixes this path used to require are automated.

## See Also

- [Variant Creation Skill](skills/create-variant/SKILL.md)
- [Variant Promotion Skill](skills/promote-variant/SKILL.md)
- [Variant Conversion Guide](docs/variant-conversion-guide.md)
- [Variant Review Report (2026-07-14)](docs/variant-review-report-2026-07-14.md)
