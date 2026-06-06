# ADR-0033: Variant-Specific Skills & Scripts Blueprint

## Status
Proposed

## Context
As the workspace expands into multiple variants (`co-develop`, `co-design`, `co-security`, etc.), variants need their own specialized skills and scripts. Currently, most skills and scripts reside at the workspace root (`L0`) and are copied to `templates/common/` (`L1`). We need a structured way to:
1. Isolate variant-specific skills and scripts within `templates/co-*/`.
2. Support the static ingestion of external scripts and skills (e.g., `agency-agents`, `awesome-design-md`, `agent-skills`, and security reference lists) without mixing them with custom logic.
3. Allow automated QA gates and ingestion scripts to parse `variant.json` to know exactly what external assets to fetch and validate.

## Decision

### 1. Directory Blueprint
Variant-specific skills and scripts will be isolated into dedicated directories inside each `templates/co-*/` variant. To cleanly separate authored tools from ingested external tools, we introduce an `external/` subdirectory.

```text
templates/co-<variant>/
??? skills/
?   ??? local/              # Custom skills specific to this variant
?   ?   ??? <skill-name>/
?   ?       ??? SKILL.md
?   ??? external/           # Statically ingested external skills (read-only)
?       ??? <skill-name>/
?           ??? SKILL.md
??? scripts/
?   ??? local/              # Custom scripts specific to this variant
?   ?   ??? <script-name>.ts
?   ??? external/           # Statically ingested external scripts (read-only)
?       ??? <script-name>.ts
```

*Note: The `external/` directory acts as a cache/mirror for external references. Developers should not manually edit files in `external/` as they will be overwritten by ingestion scripts.*

### 2. `variant.json` Metadata Schema Extension
The `variant.json` schema will be extended to explicitly declare both `local` and `external` dependencies under `skill_manifest` and `script_manifest`.

#### New Schema Structure:
```json
{
  "skill_manifest": {
    "local": [
      {
        "name": "code-review",
        "description": "Local skill for code review",
        "path": "skills/local/code-review/SKILL.md",
        "used_by_agents": ["code-writer"],
        "phases": [4]
      }
    ],
    "external": [
      {
        "name": "awesome-design-md",
        "source_url": "https://raw.githubusercontent.com/user/awesome-design-md/main/SKILL.md",
        "ingest_path": "skills/external/awesome-design-md/SKILL.md",
        "version_tag": "v1.2.0"
      }
    ]
  },
  "script_manifest": {
    "local": [
      {
        "name": "variant-build",
        "path": "scripts/local/variant-build.ts"
      }
    ],
    "external": [
      {
        "name": "agency-agents-generator",
        "source_url": "https://raw.githubusercontent.com/user/agency-agents/main/generator.ts",
        "ingest_path": "scripts/external/agency-agents-generator.ts",
        "version_tag": "latest"
      }
    ]
  }
}
```

### 3. Ingestion Workflow
We will create ingestion scripts (`ingest-external-skills.ts`, `ingest-security-frameworks.ts`) that:
1. Read `variant.json` for all variants.
2. Iterate through the `external` arrays in `skill_manifest` and `script_manifest`.
3. Fetch the content from `source_url`.
4. Write the content to the designated `ingest_path` within the variant directory.
5. Create a lockfile or checksum to verify the integrity during QA gates (`qa-gate.ts`).

## Consequences

**Positive:**
- Clear boundary between local variant logic and external tools.
- Easy to bulk-update external tools by running the ingestion script.
- QA gates can assert that all external tools match their remote versions.
- `variant.json` acts as a deterministic bill of materials (BOM) for external dependencies.

**Negative:**
- Adds complexity to the template structure.
- Ingestion scripts must handle network failures gracefully.

## Next Steps for Automation Engineer
1. Implement `scripts/ingest-external-skills.ts`.
2. Implement `scripts/ingest-security-frameworks.ts`.
3. Update `publish-to-template.ts` to respect the new `skills/` and `scripts/` isolation patterns so they are not accidentally wiped or overwritten by common workspace tools.
4. Update `scripts/qa-gate.ts` to validate the `variant.json` schema.
