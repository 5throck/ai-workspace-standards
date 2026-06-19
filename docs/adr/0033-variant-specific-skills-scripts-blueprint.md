---
status: "Accepted"
---

# ADR-0033: Variant-Specific Skills & Scripts Blueprint

## Status
Accepted

## Context
As the workspace expands into multiple variants (`co-develop`, `co-design`, `co-security`, etc.), variants need their own specialized skills and scripts. Currently, most skills and scripts reside at the workspace root (`L0`) and are copied to `templates/common/` (`L1`). We need a structured way to:
1. Isolate variant-specific skills and scripts within `templates/co-*/`.
2. Support the static ingestion of external scripts and skills (e.g., `agency-agents`, `awesome-design-md`, `agent-skills`, and security reference lists) without mixing them with custom logic. *(Phase 2 — not yet implemented)*
3. Allow automated QA gates and ingestion scripts to parse `variant.json` to know exactly what external assets to fetch and validate. *(Phase 2 — not yet implemented)*

## Decision

### 1. Directory Blueprint
Variant-specific scripts are placed in a `scripts/<variant>/` subdirectory inside the scaffolded project. This naming convention makes the variant origin explicit and avoids naming collisions across variants.

```text
templates/co-<variant>/
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
└── scripts/
    ├── <variant>/          # Variant-specific .ts scripts (canonical location)
    │   ├── SCRIPTS.md      # Variant script registry (does NOT overwrite L1 SCRIPTS.md)
    │   └── *.ts
    └── extract_slidedata.mjs   # (example of non-TypeScript helpers, if any)
```

> **Why `scripts/<variant>/` and NOT `scripts/` top-level?**
>
> The L1 `audit.ts` function `verifyScriptRegistryConsistency()` uses a non-recursive
> `readdirSync(scriptsDir)` call. Only `.ts` files at the **top level** of `scripts/` are
> checked against `scripts/SCRIPTS.md`. Placing variant scripts in `scripts/<variant>/`
> means they are excluded from this check — intentionally, because they are not registered
> in the shared L1 `scripts/SCRIPTS.md`. This is a **deliberate design constraint**, not
> an oversight. Do not change `readdirSync` to recursive without updating this pattern.
>
> **Also**: a variant MUST NOT place a `scripts/SCRIPTS.md` at the top-level `scripts/`
> path, as it would overwrite the L1 common SCRIPTS.md during scaffolding.

#### Phase 2 (deferred): External scripts support
When external script ingestion is implemented, add an `external/` subdirectory:

```text
scripts/
└── <variant>/
    ├── local/      # (optional further subdivision if needed)
    └── external/   # Statically ingested external scripts (read-only, Phase 2)
```

*The `external/` directory acts as a cache/mirror for external references. Do not manually edit files in `external/` as they will be overwritten by ingestion scripts.*

### 2. `variant.json` Metadata Schema — `script_manifest`

Each variant with custom scripts MUST declare them in `variant.json` under `script_manifest.local`. This declaration is validated by `bun scripts/validate-templates.ts` (path existence check).

#### Minimal Schema (current — Phase 1):
```json
{
  "script_manifest": {
    "variant_scripts_dir": "scripts/<variant>",
    "local": [
      {
        "name": "my-script",
        "path": "scripts/<variant>/my-script.ts"
      }
    ],
    "external": []
  }
}
```

#### Full Schema (Phase 2 — not yet enforced):
```json
{
  "script_manifest": {
    "variant_scripts_dir": "scripts/<variant>",
    "local": [
      {
        "name": "my-script",
        "path": "scripts/<variant>/my-script.ts"
      }
    ],
    "external": [
      {
        "name": "agency-agents-generator",
        "source_url": "https://raw.githubusercontent.com/user/agency-agents/main/generator.ts",
        "ingest_path": "scripts/<variant>/external/agency-agents-generator.ts",
        "version_tag": "latest"
      }
    ]
  }
}
```

### 3. Validation

`bun scripts/validate-templates.ts` checks `script_manifest.local[].path` for file existence.
If a declared path does not exist, validation fails with an actionable error.

> **Principle**: A declaration must always be introduced together with validation.
> A declaration without validation is technical debt.

### 4. Ingestion Workflow (Phase 2 — deferred)

When implemented, ingestion scripts (`ingest-external-skills.ts`, `ingest-security-frameworks.ts`) will:
1. Read `variant.json` for all variants.
2. Iterate through `external` arrays in `skill_manifest` and `script_manifest`.
3. Fetch content from `source_url` and write to `ingest_path`.
4. Verify integrity via checksum during QA gates.

## Implementation Reference

**First variant implementing this pattern**: `co-deck` (PR #279, 2026-06-19)
- Scripts at: `templates/co-deck/scripts/co-deck/`
- Registry: `templates/co-deck/scripts/co-deck/SCRIPTS.md`
- Declaration: `templates/co-deck/variant.json` → `script_manifest`
- Validation: `scripts/validate-templates.ts` check B-03

## Consequences

**Positive:**
- Explicit variant origin from directory name (`scripts/co-deck/` vs ambiguous `scripts/local/`)
- L1 audit compatibility — non-recursive scan does not flag unregistered variant scripts
- L1 `scripts/SCRIPTS.md` preserved intact in scaffolded projects
- `validate-templates.ts` enforces declaration-path consistency
- Clear Phase 2 scope boundary for external ingestion

**Negative:**
- Script invocation path changes per variant (`bun scripts/co-deck/snapshot.ts`)
- Variant `scripts/<variant>/SCRIPTS.md` is a separate registry from the L1 one — two registries exist in scaffolded projects
- `external/` support requires Phase 2 implementation before external assets can be managed

## Related
- [ADR-0036: TypeScript-only scripts policy](0036-script-ts-migration.md)
- [ADR-0031: L1-L2 Fork Model](0031-l1-l2-fork-model.md)
- [docs/constitution/06.5-script-lifecycle.md §Variant-Specific Scripts](../constitution/06.5-script-lifecycle.md)
