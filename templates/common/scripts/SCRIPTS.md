# SCRIPTS.md —Script Lifecycle Registry

> This file is the Single Source of Truth (Tier 1 SSOT) for all directly-invokable scripts in `scripts/` (workspace root) — i.e. scripts run via `bun scripts/<name>.ts` or `bun run <alias>`. Internal library/helper modules under `scripts/lib/` and `scripts/helpers/` that are imported by other scripts but never run standalone (e.g. `auth.ts`, `security-validator.ts`, `pipeline-state.ts`) are intentionally excluded — they have no independent CLI usage to register.
> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run propagate:apply`.
> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.
>
> **Machine parsing**: `verify-scripts.ts --verify` reads the `## Registry` section only.
> **Human reading**: see `## Guide` section below for purpose, usage, and deprecation notes.

---

## Architecture: TypeScript-Only Policy (ADR-0036)

> **Policy change (2026-06-11)**: All scripts are TypeScript executed via Bun. The former Tier 1 sh/ps1 bootstrap tier has been abolished. See [ADR-0036](../docs/adr/0036-script-ts-migration.md) for rationale.

## Error Handling Standard (ADR-0054)

> **Policy (2026-08-16)**: Error and exit paths in all scripts MUST use `scripts/lib/error-handling.ts` (`die()`, `fatalError()` + `logError()`, `withSyncErrorHandling()`). Migration is **incremental** — a script migrates when it is otherwise modified (no pure-consistency rewrites). When migrating an L0+L1 script, sync the change to `templates/common/scripts/` in the same commit. See [ADR-0054](../docs/adr/0054-error-handling-standardization.md) and `docs/context.md` §8.11.

All scripts in this workspace are written in TypeScript and executed via `bun`. There is no longer a distinction between "bootstrap" and "ops" tiers — Bun is a hard prerequisite for the workspace and is assumed to be installed before any script runs.

**Single rule**: every new script must be a `.ts` file. No `.sh` or `.ps1` files will be accepted.

**Invocation pattern**:
```bash
bun scripts/<name>.ts [args]       # direct
bun run <alias>                     # via package.json alias (preferred for CI)
```

### Ops & Automation Scripts (Bun/TypeScript)
*   **Purpose**: All scripting tasks — project scaffolding, pipeline, code generation, linting, syncing, lifecycle audits.
*   **Implementation**: Written in TypeScript (`.ts`), executed via the Bun runtime.
*   **Execution**: `bun scripts/<name>.ts` or via `package.json` alias.
*   **Examples**: `upgrade-project.ts`, `cleanup-completed-md.ts`, `audit.ts`, `dev-sync.ts`.

---

## Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->
<!-- Required columns: script | source | version | status | removal-date | security-advisory | layer | pair -->
<!-- status: active | deprecated | experimental -->
<!-- removal-date: YYYY-MM-DD (required when status=deprecated) or —-->
<!-- security-advisory: CVE-XXXX or —-->
<!-- Layer column values (ONLY 2 TYPES USED). L0/L1/L2/L3 here follow
     context.md's Terminology Definition (L1=templates/common, L2=templates/co-*,
     L3=Projects/*); these Layer values predate that document and use L2 to mean
     "reaches a scaffolded project," which context.md calls L3 — not renamed here
     since layer-filter.ts and verify-scripts.ts parse these literal strings:
  L0           = workspace root only; must NOT be copied to templates/common/ or L3 projects
  L0+L1        = exists in scripts/ AND templates/common/scripts/; scaffold-copies to L3 at new-project time
  L0+L1+L2     = reserved for future use (Fork Model architecture - not currently used)
-->
<!-- pair: reserved field (was used for sh/ps1 pair tracking — abolished per ADR-0036) -->
<!-- Check A (lifecycle-sync-audit.ts): verifies @version header == registry version (formal consistency only). Semantic content alignment —whether file content actually reflects version history —is NOT verified by tooling. Use git log to confirm content for Type-2 fixes. -->

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
| `agent-create.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `agent-delete.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `agent-lifecycle-audit.ts` | L0 | 1.1.5 | active | —| —| L0+L1 | —|
| `agent-list.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `agent-verify.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `analyze-git-history.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `archive-memory.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `audit.ts` | L0 | 2.25.0 | active | —| —| L0+L1 | —|
| `cleanup-completed-md.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `clear-pm-approval.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `compile-tokens.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `create-l3-scaffold.ts` | L0 | 1.12.1 | active | —| —| L0 | —|
| `dev-sync.ts` | L0 | 1.7.7 | active | —| —| L0+L1 | —|
| `dispatch-parallel.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `dispatch-serial.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `dispatch.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `fix-script-versions.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `gen-pr-body.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `generate-ide-rules.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `generate-l3-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-scripts-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-skill-graph.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `generate-version-manifest.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `dispatch-parallel.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `dispatch-serial.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `dispatch.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `fix-script-versions.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `gen-pr-body.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `generate-ide-rules.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `generate-l3-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-scripts-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-version-manifest.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/beta-lifecycle.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/generate-variant.ts` | L0 | 1.13.1 | active | —| —| L0 | —|
| `helpers/agent-promote.ts` | L0 | 0.1.1 | experimental | —| —| L0 | —|
| `helpers/agent-similarity-analyzer.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/golden-reference-loader.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/inject-skills.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `helpers/integration-helpers.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/layer-filter.ts` | L0 | 1.4.1 | active | —| —| L0 | —|
| `helpers/lifecycle-governance.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `helpers/upgrade-versions.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/merge-frontmatter.ts` | L0 | 1.8.6 | active | —| —| L0+L1 | —|
| `helpers/security-validator.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/context-sections.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `helpers/markers.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/pm-md-parser.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/variant-governance-rules.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/registries/variant-type-registry.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/capability-registry.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/promotion-policy.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/validation-policy.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/variant-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/game-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/security-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/development-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/design-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/consulting-plugin.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/plugins/collaboration-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/lecture-plugin.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/plugins/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/workspace-integration.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/reconcile-with-l0-l1.ts` | L0 | 1.3.0 | active | —| —| L0 | —|
| `helpers/normalize-agent-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/prune-country-scoped-assets.ts` | L0 | 0.2.0 | active | —| —| L0 | —|
| `helpers/scan-l3-project.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/substitute-placeholders.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/template-utils.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `helpers/rollback-partial-project.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/template-validation.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `helpers/update-variant-lifecycle.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-output.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-platform-parity.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/ticket-schema.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/ticket-store.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `validators/types.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/variant-json-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/extends-validator-wrapper.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/capability-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/schema-validator.ts` | L0 | 1.3.0 | active | —| —| L0 | —|
| `validators/orphan-reference-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/duplicate-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/platform-parity-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/write-scripts-snapshot.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `hooks/_test-consumer.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/_test-module.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/agent-model-gate.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `hooks/gateguard-fact-force.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `hooks/post-write-lifecycle-check.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `hooks/pre-commit.ts` | L0 | 1.5.10 | active | —| —| L0+L1 | —|
| `hooks/pre-push.ts` | L0 | 1.2.9 | active | —| —| L0+L1 | —|
| `ingest-external-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `ingest-security-frameworks.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `l3-to-variant-pipeline.ts` | L0 | 1.12.1 | active | —| —| L0 | —|
| `regenerate-agents-md.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `lib/agent-override-merge.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `lib/context-md-schema.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `lib/auth.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/encoding-utils.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `lib/error-handling.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `lib/language-guard.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/pipeline-state.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `lib/platform-context.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/propagation-map-schema.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `lib/ssrf.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `lifecycle-sync-audit.ts` | L0 | 1.4.9 | active | —| —| L0+L1 | —|
| `list-template-versions.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `md-to-ooxml.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `new-project.ts` | L0 | 1.8.0 | active | —| —| L0 | —|
| `remove-project.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `resolve-variants.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `project-to-variant.ts` | L0 | 1.2.0 | active | `--source`, `--target`, `--dry-run`, `--force`, `--design-doc`, `--threshold-files`, `--threshold-dirs` | —| L0 | —|
| `promote-context-section.ts` | L0 | 1.0.0 | active | `--heading`, `--variants`, `--source`, `--after-heading`, `--dry-run` | —| L0 | —|
| `propagate-to-templates.ts` | L0 | 2.5.1 | active | `--apply`, `--prune`, `--dry-run`, `--check-drift`, `--governance-l1`, `--docs`, `--include-disabled`, `--marker-rewrite` | —| L0 | —|
| `qa-gate.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `readme-lifecycle-audit.ts` | L0 | 1.0.4 | active | —| —| L0+L1 | —|
| `render-pdf-deck.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `retry-handler.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `setup-github-branch-protection.ts` | L0 | 1.0.1 | active | `--repo`, `--branch`, `--check` (repeatable), `--dry-run` | —| L0+L1 | —|
| `skill-dependency-analysis.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `spec-backfill.ts` | L0 | 1.0.0 | active | `--dry-run`, `--check` | —| L0 | —|
| `spec-register.ts` | L0 | 1.1.0 | active | `--file`, `--source`, `--update`, `--status`, `--list`, `--ref`, `--id` | —| L0 | —|
| `skill-lifecycle-audit.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `sync-agent-status.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `sync-md.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `sync-skill-status.ts` | L0 | 1.0.1 | active | — | — | L0+L1 | — |
| `sync-skills-to-l2.ts` | L0 | 1.0.1 | active | — | — | L0 | — |
| `sync-template-deps.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `sync-skills.ts` | L0 | 1.4.1 | active | `--dir <path>`, `--all-variants` | — | L0+L1 | — |
| `tag-template.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `team-builder.ts` | L0 | 1.2.1 | active | —| —| L0+L1 | —|
| `test-platform-parity.ts` | L0 | 0.2.4 | active | —| —| L0 | —|
| `test-new-project.ts` | L0 | 1.0.4 | active | —| —| L0 | —|
| `test-extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `test-l3-to-variant-promotion.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `test-runner.ts` | L0 | 1.1.0 | active | `--parallel`, `--sequential`, `--concurrency <n>`, `--timeout <ms>` | —| L0+L1 | —|
| `translate-readme.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `ticket.ts` | L0 | 1.1.0 | active | `create --not-before`, `list --kind`, `list --ready` | —| L0 | —|
| `upgrade-project.ts` | L0 | 1.10.1 | active | `--variant`, `--platform`, `--dry-run`, `--prune-removed`, `--rollback`, `--yes` | —| L0 | —|
| `variant-feature.ts` | L0 | 1.0.0 | active | `--variant`, `--feature`, `--type` | —| L0 | —|
| `validate-agents.ts` | L0 | 1.0.5 | active | —| —| L0+L1 | —|
| `validate-doc-folder.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-docs-links.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `validate-md-language.ts` | L0 | 1.8.0 | active | —| —| L0+L1 | —|
| `validate-model-registry.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-skills.ts` | L0 | 1.0.3 | active | —| —| L0+L1 | —|
| `validate-templates.ts` | L0 | 1.15.0 | active | —| —| L0 | —|
| `verify-country-prune.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `verify-adr-governance.ts` | L0 | 1.4.0 | active | —| —| L0 | —|
| `verify-agent-deliverables.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `verify-skill-graph.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `verify-memory.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `verify-new-project-tests.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `verify-platform-lifecycle.ts` | L0 | 1.1.2 | active | —| —| L0+L1 | —|
| `verify-readme-sync.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `verify-scripts.ts` | L0 | 1.4.1 | active | —| —| L0+L1 | —|
| `verify-skills.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `verify-template-integrity.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validate-pm-extends.ts` | L0 | 0.3.1 | active | —| —| L0+L1 | —|

---

## Layer Classification Framework

> **Two layer types are in use**: `L0` (workspace root only) and `L0+L1` (workspace + template snapshot). `L0+L1+L2` is reserved but unused.

| Layer | Description | Publish | Example |
|-------|-------------|---------|---------|
| L0 | Workspace infrastructure only | No | new-project.ts, remove-project.ts, propagate-to-templates.ts |
| L0+L1 | Workspace + Template snapshot | Yes, to templates/common/ | audit.ts, hooks/pre-commit.ts |
| L0+L1+L2 | Reserved for future use | Not used (Fork Model) | N/A |

**Note**: All scripts must have L0 as their source of truth (SSOT principle). L0+L1+L2 is reserved for future architectural needs but not currently implemented due to the Fork Model (L2 variants evolve independently after scaffolding).

---

## Ownership Layers

| Layer | Location | Owner | Update Policy |
|-------|----------|-------|---------------|
| **L0 —Workspace SSOT** | `scripts/` (workspace root) | workspace maintainer | Versioned via this file |
| **L1 —Template snapshot** | `templates/common/scripts/` | publish: `bun run propagate:apply` | Explicit publish from L0 via consolidated tool |
| **L2 —Variant template** | `templates/co-*/scripts/<variant>/` | variant maintainer | Variant-specific scripts, propagated from L0 |
| **L3 —Project** | `<project>/scripts/` | project team | Independent snapshot after creation, plus L1->L3 propagation via `propagate-to-templates.ts` |

**Propagation rule**: L0 is the development SSOT. Publish L0→L1 explicitly with `bun run propagate:apply`, which is a consolidated tool that also handles L1->L3 propagation. L3 projects snapshot L1 at creation time and receive subsequent updates via propagation. No automatic back-propagation from L3.

---

## Lifecycle States

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `active` | In production use | Changes require version bump in Registry |
| `deprecated` | Scheduled for removal | `removal-date` field required; L1/L2 warned on `dev-sync` |
| `experimental` | Not guaranteed stable | Not synced to L1/L2 automatically |

**Deprecation flow:**
1. Set `status: deprecated` and `removal-date: YYYY-MM-DD` (minimum 90 days notice)
2. `bun run dev-sync` warns L1/L2 consumers on every run
3. On `removal-date`, `verify-scripts.ts --verify` **hard blocks** pre-commit

**Security advisory flow:**
1. Set `security-advisory: CVE-XXXX` (status can remain `active` or become `deprecated`)
2. `bun run dev-sync` **hard blocks** in L1/L2 until the script is updated or removed
3. Unlike deprecation, security advisories take immediate effect with no grace period

---

## Guide

### Everyday Development Scripts (Tier 2 —`bun run <script>`)

#### `audit.ts`
**Purpose**: Documentation audit gate. Checks CHANGELOG.md, workspace standards, AGENTS.md,
agent frontmatter, skill health, template lifecycle validation, and variant context guidelines
section presence (VARIANT-INJECT: guidelines [REQUIRED] marker enforcement).
**Usage**: `bun run audit`
**Runs automatically**: pre-commit hook, pre-push hook, `bun run dev-sync`

#### `dev-sync.ts`
**Purpose**: Full sync pipeline — pre-flight markdown link validation gate (`bun scripts/validate-docs-links.ts`) — session log — MEMORY.md index — CHANGELOG auto-add — audit gate — sensitive file check — branch creation — commit — push — PR.
**Usage**: `bun run dev-sync "feat: description"`
**Claude Code / Gemini**: `/sync "feat: description"`
**v1.5.0**: Added pre-flight markdown link validation gate (`bun scripts/validate-docs-links.ts`) executed before git operations to ensure all documentation links resolve.

#### `test-runner.ts`
**Purpose**: Test suite execution framework supporting `unit`, `integration`, `scenarios`, and `scripts` suites. Features parallel test execution with worker pool concurrency, worker temp directory isolation (`TEST_TEMP_DIR`), automatic fallback to sequential execution on failure, and per-suite timeouts.
**Usage**:
- `bun scripts/test-runner.ts [suite] [flags]` (default suite: `integration`)
- Via `package.json` aliases: `bun run test`, `bun run test:unit`, `bun run test:e2e`, `bun run test:full`
**CLI Flags**:
- `--parallel`: Enable parallel execution across test files (default when > 1 test file)
- `--sequential`: Force sequential test file execution
- `--concurrency <n>`: Set worker pool concurrency level (default: CPU core count up to 4)
- `--timeout <ms>`: Set per-test execution timeout in milliseconds
**v1.1.0**: Documented parallel execution capabilities, worker pool temp directory isolation (`tests/.temp/worker-<id>`), automatic sequential fallback, and CLI flags (`--parallel`, `--sequential`, `--concurrency <n>`, `--timeout <ms>`).

#### `sync-md.ts`
**Purpose**: Updates `memory/MEMORY.md` index with today's session entry.
**Usage**: Called automatically by `bun run dev-sync`. Rarely invoked directly.

#### `gen-pr-body.ts`
**Purpose**: Generates a structured template PR body from commit message + file list — template fallback for `dev-sync.ts`. (AI-mode generation via `claude -p` was removed in 1.2.0; the agent writes the PR body itself per `skills/sync/SKILL.md`.)
**Usage**: Invoked automatically. Can be called standalone: `bun run gen-pr-body "msg"`

#### `generate-scripts-readme.ts`
**Purpose**: Auto-generates scripts/README.md from SCRIPTS.md registry.
**Usage**: `bun scripts/generate-scripts-readme.ts`
**Runs automatically**: `bun run dev-sync`

#### `compile-tokens.ts`
**Purpose**: Design token compiler for `co-design`. Reads `templates/co-design/tokens.json` and generates CSS custom properties (`:root { --color-primary: ... }`) and TypeScript constant types (`tokens.ts`) for design system consistency. v1.1.0: a reserved top-level `themes` object (e.g. `dark`, `high-contrast`) compiles to `[data-theme="<name>"]` CSS blocks after `:root` plus a `themes` export in the TS output; a tokens file without `themes` compiles unchanged.
**Usage**: `bun scripts/compile-tokens.ts [--input <path>] [--out-css <path>] [--out-ts <path>] [--watch] [--check]`

#### `generate-ide-rules.ts`
**Purpose**: IDE context rules generator for `.cursorrules` and `.clauderules`. Generates IDE-specific context rules dynamically based on workspace context and agent rosters.
**Usage**: `bun scripts/generate-ide-rules.ts [--check] [--force] [--dir <path>]`

#### `render-pdf-deck.ts`
**Purpose**: Playwright paged-media presentation PDF renderer. Converts HTML presentation decks into paginated PDF files respecting `@page` print rules using Playwright headless Chromium.
**Usage**: `bun scripts/render-pdf-deck.ts [--input <file>] [--output <file>] [--check]`

#### `md-to-ooxml.ts`
**Purpose**: Markdown to Microsoft Office OOXML (`.docx` / `.xlsx` / `.pptx`) compiler script for `co-work`. Compiles Markdown source files into native Microsoft Office Open XML structures. The `.pptx` writer maps each `# ` H1 heading to a slide (heading text → title placeholder) and the content up to the next H1 to the body placeholder: list items → bullet paragraphs (indentation depth → bullet level), `##`/`###` → bold lead-in bullets, paragraphs/tables/code blocks → plain-text lines (simplified).
**Usage**: `bun scripts/md-to-ooxml.ts --input <file.md> [--output <file>] [--type docx|xlsx|pptx] [--check]`

---

### Installation

> **Bun is a workspace prerequisite.** Install it once via the [official installer](https://bun.sh/docs/installation) before using any script. `install-bun.sh/ps1` have been deleted (ADR-0036).

---

### Agent Lifecycle Scripts (Bun / TypeScript)

#### `agent-create.ts`
**Purpose**: Creates a new agent file with proper frontmatter and required sections.
**Usage**: `bun scripts/agent-create.ts <name> --role "Display Name" --group <group>`

#### `agent-delete.ts`
**Purpose**: Removes an agent file and updates AGENTS.md.
**Usage**: `bun scripts/agent-delete.ts <name> [--force]`

#### `agent-list.ts`
**Purpose**: Lists all agents with their status, group, and tier.
**Usage**: `bun scripts/agent-list.ts [--group <group>] [--verbose]`

#### `agent-verify.ts`
**Purpose**: Verifies agent/AGENTS.md synchronization (files vs. registry).
**Usage**: `bun scripts/agent-verify.ts`

#### `agent-lifecycle-audit.ts`
**Purpose**: Full agent lifecycle audit —frontmatter validation, AGENTS.md consistency,
deprecated agent references, missing fields.
**Usage**: `bun scripts/agent-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `agents/*.md` files are staged.

#### `sync-agent-status.ts`
**Purpose**: Synchronizes agent status between agent files and AGENTS.md.
**Usage**: `bun scripts/sync-agent-status.ts`

---

### Skill Lifecycle Scripts (Bun / TypeScript)

#### `skill-lifecycle-audit.ts`
**Purpose**: Full skill lifecycle audit —owner validation, orphaned skills, deprecated
skills still being modified, dependency graph, circular dependencies, `scope` field validity.
**Usage**: `bun scripts/skill-lifecycle-audit.ts`
**Runs automatically**: pre-commit hook when `skills/**` files are staged.
**v1.2.0**: `scope` validation now accepts `workspace | common | variant | <current project's own directory name>` (was previously only the literal string `variant`, which incorrectly flagged legitimate variant-name scope values like `scope: co-consult`); `docs/_examples/skills/**` excluded from scanning (illustrative documentation, not real skills). Run once per location (workspace root + each `templates/co-*/` variant + `templates/common/`) since agent/scope resolution is relative to `cwd`.

#### `readme-lifecycle-audit.ts`
**Purpose**: Validates README.md / README_ko.md pairing in `templates/` directories.
**Usage**: `bun scripts/readme-lifecycle-audit.ts`

#### `verify-skills.ts`
**Purpose**: Cross-validates skills referenced in `docs/context.md` against actual
skill files on disk. Detects missing or orphaned skill references.
**Usage**: `bun scripts/verify-skills.ts`

#### `sync-skill-status.ts`
**Purpose**: Synchronizes skill status between SKILL.md and registry tables.
**Usage**: `bun scripts/sync-skill-status.ts`

#### `new-project.ts`
**Purpose**: Scaffolds a new project under the workspace root. Copies `templates/common/`
and an optional variant, substitutes `[Project Name]` placeholders, strips L1-B metadata
from `agents/pm.md`, flattens `docs/_common/`, and runs the post-scaffold audit.
**Usage**: `bun scripts/new-project.ts <name> <variant>`
**Breaking change from**: `bash scripts/new-project.sh` / `.\scripts\new-project.ps1` (removed 2026-06-11, ADR-0036)
**Note**: L0 script (workspace infrastructure only). Changes must be versioned in SCRIPTS.md.

#### `remove-project.ts`
**Purpose**: Safely deletes a project directory without requiring administrator privileges.
Detects running Claude Code / Antigravity processes with user confirmation before removal.
**Usage**: `bun scripts/remove-project.ts <project-name>`
**Breaking change from**: `.\scripts\remove-project.ps1` / `bash scripts/remove-project.sh` (removed 2026-06-11, ADR-0036)
**Note**: L0 script.

#### `sync-skills.ts`
**Purpose**: Distributes skills from a project's SSOT (`skills/`) to its runtime locations
(`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`). Run after any change to `skills/`
to ensure Claude Code, Antigravity, and Antigravity CLI pick up the update.
**Usage**:
- `bun run sync-skills` — workspace root only (default, unchanged from prior versions)
- `bun scripts/sync-skills.ts --dir templates/co-consult` — a single project root (variant or `templates/common`)
- `bun scripts/sync-skills.ts --all-variants` — every `templates/co-*/` variant plus `templates/common/`
**v1.4.0**: added `--dir`/`--all-variants` — the workspace-root-only default was silently leaving `.agents/skills/` (Antigravity CLI) far behind `.claude/skills/`/`.gemini/skills/` in every variant (discovered during a full skill-lifecycle audit, 2026-07-19). Run `--all-variants` after any variant-level skill change.

#### `sync-template-deps.ts`
**Purpose**: Automatic dependency version sync from root package.json to templates/common/package.json + bun.lock regeneration. Root package.json is the SSOT for shared dependency versions.
**Usage**: `bun scripts/sync-template-deps.ts [--check|--apply]`
**Runs automatically**: dev-sync step 4.52 (after propagate step 4.5, before audit step 4.9)
**Sync policy**:
- Shared deps (present in both root and template): aligned to root version
- Root-only deps: NOT auto-added to template (e.g., semver, @types/js-yaml)
- Template-only deps: NOT auto-removed (manual decision required)
- engines: aligned if shared fields differ

#### `sync-skills-to-l2.ts`
**Purpose**: Synchronizes explicitly requested skills or scripts from L1 (templates/common) to L2 variants.
**Usage**: `bun scripts/sync-skills-to-l2.ts`

#### `resolve-variants.ts`
**Purpose**: L1-B Phase script that pre-resolves `extends:` skeleton references in each `templates/co-*/` variant. Writes fully-merged files in-place so that audit can validate complete content before `new-project` runs. After resolution, `new-project.ts` only needs a simple file copy — no `merge-frontmatter` step required.
**Usage**: `bun scripts/resolve-variants.ts [--force] [--variant co-develop]`
**Idempotency**: files already marked `# @resolved-from:` are skipped unless `--force` is passed.
**Note**: L0 script (workspace infrastructure only). Not copied to `templates/common/scripts/`.

#### `verify-readme-sync.ts`
**Purpose**: Validates README.md / README_ko.md hash synchronization for workspace root and templates.
Audits user-guide.md / user-guide_ko.md translated_from_hash synchronization (FAIL stage per ADR-0055 playbook after WARN soak).
**Usage**: `bun scripts/verify-readme-sync.ts [--pre-commit] [--update-hashes]`
**v1.4.0**: Promoted user-guide translated_from_hash gate from WARN to FAIL (promoted 2026-08-24 after WARN soak through PR #647 with zero warnings observed); now returns failure count and affects exit code.
**v1.3.0**: Added user-guide translated_from_hash WARN-stage audit — detects missing/stale hashes in KO guides; --update-hashes now also seeds translated_from_hash in user-guide_ko.md frontmatter.

#### `verify-memory.ts`
**Purpose**: Validates `memory/*.md` session logs for mandatory 4-section format compliance
(`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) and detects
orphaned files not registered in `MEMORY.md` index.
**Usage**: `bun scripts/verify-memory.ts [--verify | --report]`
**Runs automatically**: pre-commit hook when `memory/*.md` files are staged.

#### `archive-memory.ts`
**Purpose**: Archives memory markdown files older than 7 days to keep the root memory directory clean and within context limits.
**Usage**: `bun scripts/archive-memory.ts`

---

### Multi-Agent Orchestration Scripts (Bun / TypeScript)

#### `dispatch.ts`
**Purpose**: Single-agent dispatch wrapper. Spawns one agent with a given prompt and
waits for completion.
**Usage**: `bun scripts/dispatch.ts --agent <name> --prompt "task"`

#### `dispatch-parallel.ts`
**Purpose**: Parallel multi-agent dispatch. Spawns multiple agents simultaneously and
collects results when all complete.
**Usage**: `bun scripts/dispatch-parallel.ts --agents agent1,agent2 --prompt "task"`

#### `dispatch-serial.ts`
**Purpose**: Serial multi-agent dispatch. Chains agents sequentially, passing each
agent's output as input to the next.
**Usage**: `bun scripts/dispatch-serial.ts --agents agent1,agent2 --prompt "task"`

#### `retry-handler.ts`
**Purpose**: Wraps any dispatch call with retry logic (configurable attempts, backoff).
**Usage**: `import { withRetry } from './retry-handler.ts'` (library module)

---

### Platform Parity Scripts (Bun / TypeScript)

#### `test-platform-parity.ts`
**Purpose**: Validates platform parity between L0 workspace files and their L1/L2 counterparts per ADR-0033.
Compares CLAUDE.md, GEMINI.md, and agents/pm.md across workspace root, templates/common/, and all L2 variants.
**Usage**: `bun scripts/test-platform-parity.ts [--verbose]`
**Runs automatically**: As part of audit.ts (non-lifecycle-only mode)
**Exit codes**: 0 (pass), 1 (errors), 2 (warnings)
**See also**: `docs/platform-parity-rules.md` for detailed parity rules

#### `validate-pm-extends.ts`
**Purpose**: Validates pm.md extends chains for correctness and compliance per ADR-0033.
Checks 6 validation rules: syntax, circular references, depth limits, file existence, override validity, and platform parity.
**Usage**: `bun scripts/validate-pm-extends.ts [options] [files...]`
**Options**:
  - `--fix` - Auto-fix simple issues (optional)
  - `--verbose` - Detailed output
  - `--json` - JSON output format
  - `--max-depth N` - Set custom max depth (default: 3)
**Exit codes**: 0 (all valid), 1 (errors found)
**Examples**:
  - `bun scripts/validate-pm-extends.ts` (validate all pm.md files)
  - `bun scripts/validate-pm-extends.ts agents/pm.md` (validate specific file)
  - `bun scripts/validate-pm-extends.ts --json` (CI/CD friendly output)

---

### Propagation Scripts (Bun / TypeScript)

#### `propagate-to-templates.ts`
**Purpose**: Publishes L0 workspace scripts and governance docs to L1 (`templates/common/`) and propagates L1 changes to L2 variant templates. This is the consolidated propagation tool invoked via `bun run propagate:apply`.
**Usage**: `bun scripts/propagate-to-templates.ts [flags]`
**Layer**: L0 (workspace infrastructure only — not copied to templates/common/, templates/co-*/, or L3 projects)
**Aliases**: `bun run propagate:apply` (--apply), `bun run propagate:dry-run` (--dry-run)

**Flag → Layer/Phase Mapping**:

| Flag | Layer Operation | Phase Context |
|------|----------------|---------------|
| `--apply` | L0 → L1(common) sync | Phase A: install scripts into common template |
| `--dry-run` | L0 → L1(common) diff | Any phase: preview changes before applying |
| `--governance-l1` | L0 governance → L1(common) | Phase A: deploy CLAUDE.md/GEMINI.md/AGENTS.md to L1 |
| `--docs` | L1(common) → L1(variants) COMMON marker injection | Phase B: prepare variant-specific governance docs |
| `--prune` | L1(common) cleanup | Maintenance: remove L0-only orphan files from L1 |
| `--check-drift` | L1 vs L2 drift report | Any phase: verify L2 variants not diverged from L1 |
| `--include-disabled` | Opt-in override | Include domains marked `disabled: true` (e.g. `docs`) in the dry-run report only — combining with `--apply` is a hard error (exit 1), not a silent write |

**Typical workflow**:
```bash
bun scripts/propagate-to-templates.ts --dry-run          # preview L0→L1 changes
bun scripts/propagate-to-templates.ts --apply            # publish scripts L0→L1
bun scripts/propagate-to-templates.ts --governance-l1    # publish governance docs L0→L1
bun scripts/propagate-to-templates.ts --docs             # inject COMMON markers into variants (Phase B)
bun scripts/propagate-to-templates.ts --prune            # remove orphan files from L1
bun scripts/propagate-to-templates.ts --check-drift      # report L1 vs L2 drift
bun scripts/propagate-to-templates.ts --domain docs --include-disabled --dry-run  # inspect a disabled domain
```

**Disabled domains**: a domain entry may carry `"disabled": true` in `propagation-map.json` to declare it *intentionally* inactive (as opposed to silently never having worked — see the `docs` domain's `note` field for the concrete incident this guards against). Default runs skip it and print why; `--include-disabled` is a read/inspect escape hatch, not a way to reactivate it — flip the flag in `propagation-map.json` itself once the underlying policy question is resolved.

### L3 Variant Tooling (Bun / TypeScript)

#### `generate-l3-readme.ts`
**Purpose**: Regenerates `README.md`/`README_ko.md` for a Phase A L3 project (`Projects/<name>/`) from the workspace README Standard template (`templates/common/docs/README.template.md`), reading the live agent roster and skills via `scanL3Project()`. This is the Phase A self-service complement to `l3-to-variant-pipeline.ts`'s Phase B README generation — both call the same rendering engine (`helpers/generate-variant.ts`'s `generateReadme`/`generateReadmeKo`), so Phase A and Phase B READMEs can never drift structurally. Phase A is self-service only (no CI gate, consistent with the L3 Design Gate exemption); Phase B's `templates/co-*/` README standard stays hard-enforced by `WS-08` in `validate-templates.ts`. `create-l3-scaffold.ts` also calls this renderer directly at scaffold time, so even a same-day scaffold ships the real 7-section structure instead of a stub.
**Usage**: `bun scripts/generate-l3-readme.ts [--l3-path <path>] [--dry-run] [--locale en|ko|both]`
**Layer**: L0 (workspace infrastructure — not copied to templates/common/ or L3 projects)

**Flags**:

| Flag | Behavior |
|------|----------|
| `--l3-path <path>` | Target L3 project (defaults to `process.cwd()` — works bare from inside the project) |
| `--dry-run` | Print planned output (agent/skill counts, files would-write) without writing |
| `--locale en\|ko\|both` | Which README(s) to regenerate (default: `both`) |

**Typical workflow**:
```bash
bun scripts/generate-l3-readme.ts --l3-path Projects/co-journalist --dry-run  # preview
bun scripts/generate-l3-readme.ts --l3-path Projects/co-journalist            # write both
cd Projects/co-journalist && bun scripts/generate-l3-readme.ts                # bare form (cwd)
```

---

## Version Bump Policy

When modifying a script:
1. Increment `version` in the Registry row (semver: patch for bugfix, minor for feature)
2. Update the Guide section if the interface or behavior changes
3. If the change is breaking, set `status: deprecated` on the old version entry and
   add a new row for the replacement

---

*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*
*Last updated: 2026-08-24 — Version bump for md-to-ooxml v1.2.0 (PR15: .pptx presentation writer per backlog §8 co-work row 4 — new `compileToPresentationML()` completes the Office trio by emitting the full OOXML presentation package in the same single-file form as the docx/xlsx writers (Flat OPC `pkg:package` embedding `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml` + rels, slideMaster1 + rels, slideLayout1 + rels, theme1, and per-slide `slideN.xml` + rels); markdown mapping: each `# ` H1 starts a slide (heading text → title placeholder), list items → bullets (indent depth → `lvl`), `##`/`###` → bold lead-ins, paragraphs/tables/code blocks → plain-text body lines; `--type pptx`, `.pptx` extension inference, `--check` parity, plus unsupported-type guard; new `tests/md-to-ooxml-pptx.test.ts`); previous: 2026-08-24 — Version bump for verify-readme-sync v1.4.0 (PR10: user-guide translated_from_hash gate promoted WARN → FAIL per ADR-0055 playbook after soak — runUserGuideHashAudit() returns the failure count and increments totalErrors; missing/stale hashes now exit 1; soak evidence: zero warnings from PR #646 seeding through #647; tests assert FAIL behavior); previous: 2026-08-24 — Version bump for verify-readme-sync v1.3.0 (PR8: user-guide translated_from_hash WARN-stage audit per ADR-0055 playbook — detects missing/stale hashes in KO guides; --update-hashes now also seeds translated_from_hash in user-guide_ko.md frontmatter; preserves CRLF/LF line endings and UTF-8-no-BOM; WARN does not affect exit code); previous: 2026-08-24 — Version bumps for validate-templates v1.13.0 (country-profile lifecycle enforcement per docs/country-profiles.md "Profile Freshness & Ownership": profile frontmatter `status` must be one of active/draft/stale — hard FAIL on anything else; auto-stale WARN when an `active` profile's `last_verified` passes the 12-month line, recommending `status: stale`; new cross-variant Check B-05 WARN when the same `<CC>.md` carries divergent `last_verified` dates across variants; renumbered the duplicate per-variant skill-lifecycle check ID B-05 → B-09), validate-md-language v1.6.1 (L0+L1: removed the hardcoded 15-locale fallback — the locale list now comes solely from docs/workspace-schema.json `i18n.locale_codes`, degrading to ko-only with a warning when the schema is absent), and create-l3-scaffold v1.12.1 (writes `.claude/template-version.txt` at scaffold time — variant/version/platform/country/created, mirroring new-project.ts §5.6 — so L3 drafts carry country provenance from day one); previous: 2026-08-24 — Version bumps for upgrade-project v1.10.1 (country-profile awareness on the upgrade path: registry-driven prune of country-scoped skills after all skill-copy passes with an isLocallyModified conflict guard for legacy forks + dry-run parity; preserves `country=` in .claude/template-version.txt instead of erasing it) and l3-to-variant-pipeline v1.12.1 (new Phase 2.5: country-scoped skill exclusion — drops country_scoped_assets.skills entries from keepInVariant and the variant.json skill manifest so a --country KR draft cannot fork k-* skills into templates/<variant>/skills/); previous: 2026-08-23 — Version bump for validate-templates v1.10.0 (new Checks WS-11: bilingual user-guide pair per variant — hard FAIL, not common-satisfiable; WS-12: variant index coverage across the 6 README index files — EN/KO FAIL, es/ja WARN); previous: 2026-08-15 — Renamed the 4 scripts whose `l2`-prefixed names/flags predated the L3 layer terminology: `create-l2-scaffold.ts`→`create-l3-scaffold.ts` (v1.9.2), `generate-l2-readme.ts`→`generate-l3-readme.ts` (v1.0.3, `--l2-path`→`--l3-path`), `l2-to-variant-pipeline.ts`→`l3-to-variant-pipeline.ts` (v1.10.5, `executeL2ToVariantPipeline()`→`executeL3ToVariantPipeline()`, `PipelineConfig.l2ProjectPath`→`l3ProjectPath`), `test-l2-promotion.ts`→`test-l3-to-variant-promotion.ts` (v1.0.2); also renamed the `simulate-l2-promotion` skill to `simulate-l3-to-variant-promotion`. Historical ADRs, dated design docs, and memory archives were left unchanged (they document what was true at the time); previous: Version bumps for generate-l2-readme (new v1.0.0: self-service Phase A README regeneration sharing the generate-variant.ts renderer), create-l2-scaffold v1.9.0 (render README.md/README_ko.md from the standard template instead of hardcoded heredocs; _ORIGIN.md checklist + printSummary now point at generate-l2-readme.ts), generate-variant v1.10.0 (export generateReadme/generateReadmeKo/buildReadmeSubstitutions; relocate extractAgentRoster/extractSkills/normalizeRelPath here from l2-to-variant-pipeline.ts), l2-to-variant-pipeline v1.10.2 (import the three relocated functions from generate-variant.ts instead of defining them locally); previous: Version bumps for validate-templates v1.5.17 (new Check WS-08: README standard conformance, policy-driven WARN via variantValidationPolicy.warningOnly), generate-variant v1.9.0 (render README.md/README_ko.md from templates/common/docs/README.template.md via applyTemplate; readmeNarrative? override; deleted Generated/MVP footer), template-utils v1.1.0 (extracted generic applyTemplate(); applyContextTemplate delegates to it), readme-lifecycle-audit v1.0.3 (ownership comment: WS-08 is sole templates/ README standard enforcer); previous: Version bumps for validate-templates v1.5.16 (new Check WS-07: variants must not carry local docs/context.md), generate-variant v1.8.1 (fix Windows path-separator so SKIP_IN_COPY actually excludes docs/context.md during promotion), new-project v1.5.3 (defense-in-depth: variant overlay skips docs/context.md); previous: Version bump for l2-to-variant-pipeline v1.10.1 (Issue Set A fixes: consolidated SKIP_AGENT_FILES, fixed missingOptionalSections JSON field, removed process.exit(1) from executeL2ToVariantPipeline, registry-driven canonicalExtensionSource for lecture type, deleted dead VariantPlugin.goldenReference()); previous: Version bumps for l2-to-variant-pipeline v1.10.0, generate-variant v1.8.0, pm-md-parser v1.1.0, create-l2-scaffold v1.8.0, reconcile-with-l0-l1 v1.2.2, golden-reference-loader v1.1.0, capability-registry v1.0.2, consulting-plugin v1.1.0, agent-verify v1.0.2 (feature + bugfix changes: scan L1-match classification, lean variant templates, ADR-0048 pm.md).*
