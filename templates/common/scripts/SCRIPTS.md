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
*   **Examples**: `cleanup-completed-md.ts`, `audit.ts`, `dev-sync.ts`.

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
| `agent-lifecycle-audit.ts` | L0 | 1.3.1 | active | —| —| L0+L1 | —|
| `agent-list.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `agent-verify.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `analyze-git-history.ts` | L0 | 1.0.2 | active | —| —| L0+L1 | —|
| `archive-memory.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `audit.ts` | L0 | 2.39.0 | active | —| —| L0+L1 | —|
| `bootstrap-stages.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `check-upgrade-coverage.ts` | L0 | 1.0.0 | active | `--variant`, `--strict`, `--json` | —| L0 | —|
| `cleanup-completed-md.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `clear-pm-approval.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/local-date.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/managed-block-merge.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `compile-tokens.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `design-lint.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `create-l3-scaffold.ts` | L0 | 1.16.0 | active | Step 8.5 graft build: global `graft` first, bunx fallback (spec 2026-09-20-graft-scaffold-resilience) | —| L0 | —|
| `dev-sync.ts` | L0 | 1.16.0 | active | —| —| L0+L1 | —|
| `dispatch-parallel.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `dispatch-serial.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `dispatch.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `fix-script-versions.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `gen-pr-body.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `generate-ide-rules.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `generate-l3-readme.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `generate-scripts-readme.ts` | L0 | 1.0.4 | active | —| —| L0 | —|
| `generate-raci.ts` | L0 | 1.1.0 | active | RACI matrix generator per ADR-0083 P4, ADR-0084 §3.4; derives A/R from procedures, accepts explicit C/I; loads governance/_human-roles.yaml when present; emits actor_types map when registry exists; sets schema_version: "1.1" for registries | —| L0+L1 | —|
| `generate-skill-graph.ts` | L0 | 1.12.0 | active | DEG v1 per ADR-0083; ADR-0084 §3.4: human_role nodes from governance/_human-roles.yaml; actor_type edge attribute on RACI edges (accountable_for, consulted_on, informed_of, step_by_agent) | —| L0+L1 | —|
| `generate-version-manifest.ts` | L0 | 1.7.1 | active | scripts-table sort uses a full-path tiebreaker so basename ties stop depending on readdir order (macOS vs Linux drift) | —| L0+L1 | —|
| `evidence-backport-scan.ts` | L0 | 1.0.0 | active | Evidence Backporting scanner — read-only form detection (F1/F2/F3/F0/MIXED) + M1-M6 maturity bar over Projects/co-* evidence planes (ADR-0084 Decision 6, design §4); consumes graph-delta-log.ts output for M2/M4/M6b with git-log fallback; project-resync Step 2b | —| L0+L1 | —|
| `graph-delta-log.ts` | L0 | 1.0.0 | active | Graph Delta Log — compute and persist per-scope structural diffs between committed and derived skill graphs (ADR-0084 §5); two-layer delivery (workspace root + projects); consumed by evidence-backport-scan.ts maturity bar (M2, M4, M6b tests) | —| L0+L1 | —|
| `handbook/apply-handbook-theme.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/build-search-index.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-a11y.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-authoring.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `handbook/check-external-links.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `handbook/check-i18n-parity.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-labels.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-links.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-lint.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-search.ts` | L0 | 2.0.0 | active | — | — | common | — |
| `handbook/check-spell.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-structure.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-symmetry.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/check-tables.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/deploy-handbook.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `handbook/extract-copycode.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/handbook-doctor.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/handbook-sync-audit.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/nav-utils.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/scaffold-handbook.ts` | L0 | 1.2.0 | active | — | — | common | — |
| `handbook/update-footers.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `handbook/validate-handbook.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `handbook/validate-nav.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `helpers/beta-lifecycle.ts` | L0 | 1.2.1 | active | —| —| L0 | —|
| `helpers/generate-variant.ts` | L0 | 1.16.0 | active | —| —| L0+L1 | —|
| `helpers/agent-promote.ts` | L0 | 1.0.0 | active | `--json`, `--help` — ADR-0043 promotion-candidate ANALYSIS (read-only): ≥3-variant agent names, pairwise Role+Responsibilities Jaccard, ≥80% groups reported | —| L0 | —|
| `helpers/agent-similarity-analyzer.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/golden-reference-loader.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/skills-registry.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `helpers/inject-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/integration-helpers.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/layer-filter.ts` | L0 | 1.5.0 | active | —| —| L0+L1 | —|
| `helpers/lifecycle-governance.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `helpers/upgrade-versions.ts` | L0+L1 | 1.0.1 | active | —| —| L0+L1 | —|
| `helpers/merge-frontmatter.ts` | L0 | 1.8.6 | active | —| —| L0+L1 | —|
| `helpers/security-validator.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `helpers/l0-ref-policy.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/context-sections.ts` | L0 | 1.6.0 | active | CRLF-tolerant footer parsing (T-20260918-005); spliceCommonContextBlock delivers policy under PRESERVE (T-20260919-003); nesting-aware findHeadingSpan/removeHeadingSpan — promoted `##` sections carry their `###` children (2026-09-22) | —| L0+L1 | —|
| `helpers/markers.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `helpers/merge-state.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `helpers/scaffold-markers.ts` | L0 | 1.4.0 | active | Shared scaffold marker constants + (marker→source) mapping + delivery-tree derivations + transient test-fixture predicate (T-20260916-001); PlatformProfile 'both'→'all' rename | —| L0+L1 | —|
| `helpers/pm-md-parser.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/variant-governance-rules.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/registries/variant-type-registry.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/capability-registry.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `helpers/registries/promotion-policy.ts` | L0 | 1.2.1 | active | —| —| L0 | —|
| `helpers/registries/validation-policy.ts` | L0 | 1.2.1 | active | —| —| L0 | —|
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
| `helpers/reconcile-with-l0-l1.ts` | L0 | 1.3.1 | active | —| —| L0 | —|
| `helpers/normalize-agent-skills.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/prune-country-scoped-assets.ts` | L0 | 0.3.3 | active | —| —| L0 | —|
| `helpers/scan-l3-project.ts` | L0 | 1.4.0 | active | —| —| L0 | —|
| `helpers/substitute-placeholders.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/template-utils.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `helpers/rollback-partial-project.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `helpers/template-validation.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `helpers/update-variant-lifecycle.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-output.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `helpers/validate-platform-parity.ts` | L0 | 1.1.1 | active | —| —| L0 | —|
| `helpers/ticket-schema.ts` | L0 | 1.2.0 | active | —| —| L0 | —|
| `helpers/ticket-store.ts` | L0 | 1.2.1 | active | MoveOptions.result written to the ticket on done transitions (T-20260912-023); id allocation scans both tickets/ and tickets/governance/ so a create can never mint a same-day id that shadows or is shadowed across directories (T-20260912-025) | —| L0 | —|
| `tests/apply-handbook-theme.test.ts` | L0 | 1.0.1 | active | — | — | common | — |
| `tests/check-structure.test.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `tests/deploy-readme-patch.test.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `validators/types.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/variant-json-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/extends-validator-wrapper.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/capability-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/schema-validator.ts` | L0 | 1.4.0 | active | —| —| L0 | —|
| `validators/orphan-reference-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/duplicate-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/platform-parity-validator.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `validators/index.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `helpers/write-scripts-snapshot.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `hooks/_test-consumer.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/_test-module.ts` | L0 | 1.0.0 | active | —| —| L0-only | —|
| `hooks/agent-model-gate.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `hooks/gateguard-fact-force.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `hooks/post-write-lifecycle-check.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `hooks/pre-commit.ts` | L0 | 1.7.1 | active | —| —| L0+L1 | —|
| `hooks/pre-push.ts` | L0 | 1.4.1 | active | —| —| L0+L1 | —|
| `ingest-external-skills.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `ingest-security-frameworks.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `l3-to-variant-pipeline.ts` | L0 | 1.20.0 | active | `--overlay-variant` | —| L0 | —|
| `regenerate-agents-md.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `lib/agent-override-merge.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `lib/context-md-schema.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `lib/auth.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/encoding-utils.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `lib/error-handling.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `lib/language-guard.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/git-status.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/pipeline-state.ts` | L0 | 1.1.2 | active | —| —| L0+L1 | —|
| `lib/platform-context.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/propagation-map-schema.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `lib/managed-block-parity.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `lib/platform-delivery.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/ssrf.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `lib/constitution-scrub.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/upgrade-policy.ts` | L0 | 1.11.0 | active | exports `lifecyclelessText()` (equal-version agent drift) + `isDeliveredDiff()` (dev-sync 3.9 auto-E5); `.codex/skills + .codex/prompts` claims ride the sync-skills mirror pass, ordered before the blanket `.codex/**` rule (T-20260921-009/C-1, ADR-0085 D2) | —| L0+L1 | —|
| `lib/dependency-guard.ts` | L0 | 1.0.2 | active | DEPENDENCY GUARD — scans delivered scripts' bare-package imports vs project package.json, reports missing packages in the upgrade plan (T-20260920-001) | —| L0+L1 | —|
| `lib/variant-overlay-guard.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `lib/platform-mirror-freshness.ts` | L0 | 1.0.1 | active | Pure platform-skill-mirror vs skills/ SSOT version comparison for the platform-mirror-freshness check (T-20260916-008) | —| L0+L1 | —|
| `lifecycle-sync-audit.ts` | L0 | 1.15.0 | active | —| —| L0+L1 | —|
| `lint-instructions.ts` | L0 | 1.0.0 | active | `--dir`, `--strict` | —| L0+L1 | —|
| `list-template-versions.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `md-to-ooxml.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `migrate-quality-gates.ts` | L0 | 1.1.0 | active | Convert quality_gates prose entries to decision gates; automate classification (GATE vs INVARIANT vs MANUAL), YAML output, procedure schema updates, and _output-types.yaml enrichment (ADR-0083 P5); decider_agent derived from stage owner_agent, not procedure owner_agent | —| L0+L1 | —|
| `new-project.ts` | L0 | 1.24.0 | active | §7.7 graft build: global `graft` first, bunx fallback; `--platform both`→`all` rename, now covers claude+antigravity+codex | —| L0 | —|
| `remove-project.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `resolve-variants.ts` | L0 | 1.0.3 | active | —| —| L0+L1 | —|
| `project-to-variant.ts` | L0 | 1.4.0 | active | `--source`, `--target`, `--dry-run`, `--force`, `--overlay-variant`, `--design-doc`, `--threshold-files`, `--threshold-dirs` | —| L0 | —|
| `promote-context-section.ts` | L0 | 1.1.0 | active | `--heading`, `--variants`, `--source`, `--after-heading`, `--dry-run`; nesting-aware removal — promoted `##` sections remove their nested `###` subsections too (2026-09-22) | —| L0 | —|
| `propagate-to-templates.ts` | L0 | 2.16.0 | active | `--apply`, `--prune`, `--dry-run`, `--check-drift`, `--governance-l1`, `--docs`, `--include-disabled`, `--marker-rewrite` | —| L0 | —|
| `qa-gate.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `readme-lifecycle-audit.ts` | L0 | 1.0.4 | active | —| —| L0+L1 | —|
| `render-pdf-deck.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `retry-handler.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `setup-github-branch-protection.ts` | L0 | 1.0.1 | active | `--repo`, `--branch`, `--check` (repeatable), `--dry-run` | —| L0+L1 | —|
| `skill-dependency-analysis.ts` | L0 | 1.0.2 | active | —| —| L0 | —|
| `spec-backfill.ts` | L0 | 1.0.0 | active | `--dry-run`, `--check` | —| L0 | —|
| `spec-register.ts` | L0 | 1.3.0 | active | `--file`, `--source`, `--update`, `--status`, `--list`, `--ref`, `--id` | —| L0+L1 | —|
| `skill-lifecycle-audit.ts` | L0 | 1.5.1 | active | —| —| L0+L1 | —|
| `skill-session-review.ts` | L0 | 1.1.0 | active | `--date`, `--json`, `--dry-run` | —| L0+L1 | —|
| `sync-md.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `sync-skill-status.ts` | L0 | 1.0.1 | active | — | — | L0+L1 | — |
| `sync-skills-to-l2.ts` | L0 | 1.0.1 | active | — | — | L0 | — |
| `sync-template-deps.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `sync-skills.ts` | L0 | 1.8.0 | active | `--dir <path>`, `--all-variants` | — | L0+L1 | — |
| `tag-template.ts` | L0 | 1.1.0 | active | —| —| L0 | —|
| `team-builder.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `test-platform-parity.ts` | L0 | 0.2.4 | active | —| —| L0 | —|
| `test-new-project.ts` | L0 | 1.3.0 | active | Test 8 now covers `--platform codex` and asserts CODEX.md/.codex/ under `all` | —| L0 | —|
| `test-extends-validator.ts` | L0 | 1.0.1 | active | —| —| L0 | —|
| `test-l3-to-variant-promotion.ts` | L0 | 1.6.0 | active | —| —| L0 | —|
| `test-runner.ts` | L0 | 1.4.0 | active | `--parallel`, `--sequential`, `--concurrency <n>`, `--timeout <ms>` | —| L0+L1 | —|
| `translate-readme.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `ticket.ts` | L0 | 1.2.0 | active | `create --not-before`, `list --kind`, `list --ready`, `move done --result` (required, not bypassable by --force) | —| L0 | —|
| `typecheck.ts` | L0 | 1.1.1 | active | —| —| L0+L1 | —|
| `upgrade-project.ts` | L0 | 1.42.0 | active | `--variant`, `--platform` (claude/antigravity/codex/all — `all` renamed from `both`, now merges CODEX.md too), `--dry-run`, `--prune-removed`, `--rollback`, `--yes`, `--skip-context-commonization`, `--force-context-sync`; COMMON-CONTEXT splice under PRESERVE (T-20260919-003); skill sub-file sync — NEW/UPDATE deliver the whole skill dir, equal-version skills get additive CATCH-UP + DRIFT warnings (2026-09-21); W2 HARVEST — variant-only lines inside removed near-duplicate sections reported as backport candidates (2026-09-22) | —| L0+L1 | —|
| `variant-feature.ts` | L0 | 1.0.0 | active | `--variant`, `--feature`, `--type` | —| L0 | —|
| `validate-agents.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
| `validate-doc-folder.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-docs-links.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-md-language.ts` | L0 | 1.11.0 | active | scan scope widened to docs/adr/, docs/decisions/, docs/VERSION_MANIFEST.md + generated-region allowlist markers (T-20260912-015) | —| L0+L1 | —|
| `validate-model-registry.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `validate-process.ts` | L0 | 1.0.0 | active | Process/stages validation (ADR-0083 DEG-P-*), distinctness check (`--determinism` flag) | —| L0+L1 | —|
| `validate-raci.ts` | L0 | 1.2.0 | active | RACI validation per ADR-0083 DEG-R-01..05 + ADR-0084 DEG-R-06/07; DEG-R-06: human-accountable must match gate; DEG-R-07: actor_types key set must equal R/A/C/I union | —| L0+L1 | —|
| `validate-procedures.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `validate-skills.ts` | L0 | 1.5.1 | active | —| —| L0+L1 | —|
| `validate-decisions.ts` | L0 | 1.0.0 | active | —| —| L0+L1 | —|
| `validate-templates.ts` | L0 | 1.37.0 | active | roster-tier-consistency (T-20260921-020: roster tier vs extends-resolved frontmatter tier + L0 Tier Ceiling enforcement) —| —| L0+L1 | —|
| `validate-variant-readiness.ts` | L0 | 1.1.0 | active | —| —| L0+L1 | —|
| `verify-country-prune.ts` | L0 | 1.0.0 | active | —| —| L0 | —|
| `verify-adr-governance.ts` | L0 | 1.7.0 | active | Added bold-line fallback for `**Date**: YYYY-MM-DD` metadata to mirror `extractADRStatus()` pattern (ADR-0084 safety net); WARN on unparseable dates for Accepted/Proposed ADRs | —| L0 | —|
| `verify-agent-deliverables.ts` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| `verify-skill-graph.ts` | L0 | 1.6.0 | active | —| —| L0+L1 | —|
| `verify-memory.ts` | L0 | 1.2.0 | active | —| —| L0+L1 | —|
| `verify-new-project-tests.ts` | L0 | 1.0.3 | active | —| —| L0 | —|
| `verify-platform-lifecycle.ts` | L0 | 1.1.3 | active | —| —| L0+L1 | —|
| `verify-readme-sync.ts` | L0 | 1.4.0 | active | —| —| L0+L1 | —|
| `verify-scripts.ts` | L0 | 1.7.0 | active | —| —| L0+L1 | —|
| `verify-skills.ts` | L0 | 1.3.0 | active | —| —| L0+L1 | —|
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
*Last updated: 2026-09-16 — Pre-push ref-deletion skip (T-20260916-014, docs/designs/2026-09-16-pre-push-deletion-skip-design.md): hooks/pre-push.ts v1.3.0 → v1.4.0 (pure ref-deletion pushes — every pre-push stdin line carries an all-zero local OID, 40 or 64 zeros — now early-exit with a skip note before the gate battery: a deletion push transfers no commits, so gitleaks/audit/changed-path tests had nothing content-bearing to gate, and the unconditionally-run `audit.ts --lifecycle-only` blocked all 15 branch deletions during the 2026-09-16 fleet cleanup (co-* projects, failing project-side audits) forcing a GitHub-API fallback; isZeroOid (SHA-1 + SHA-256 null OIDs) replaces the hard-coded 40-zero constant across the gitleaks scope filter, changed-path collector, and branch-protection exemption — one deletion definition, no check weakened for commit pushes; mixed pushes keep the full gate; empty stdin and malformed lines are fail-closed (gate runs); main() now runs under import.meta.main so unit tests import the exported helpers (git still invokes the file as main — hook behavior unchanged); L1 mirror updated in lockstep with L0; tests/unit/pre-push-deletion-detection.test.ts v1.0.0); previous: Manifest gate shallow tolerance (T-20260916-013, docs/designs/2026-09-16-manifest-gate-shallow-tolerance-design.md): generate-version-manifest v1.5.0 → v1.6.0 (shallow-tolerant `--check`: shallow clone detected via `git rev-parse --is-shallow-repository` → diffManifests { ignoreDateColumns: true } masks the git-log-derived Last Modified cells on BOTH sides (header-derived column index), structural drift still caught, full-history behavior byte-identical; closes the permanent shallow-CI drift failure class exemplified by co-safety's Documentation Audit job; L0+L1 mirror updated in lockstep); previous: Managed-block merge fix (T-20260916-012, docs/designs/2026-09-16-managed-block-merge-fix-design.md): upgrade-project v1.30.0 → v1.31.0 (mergeWorkspaceManaged's unlabeled-blocks reconciliation counted ALL project pattern occurrences — keyed WORKSPACE-MANAGED/VARIANT-INJECT blocks included — against a template count of UNLABELED blocks only, so a project file whose only managed blocks were keyed hit the count-mismatch branch and the reconcile replaced the first-to-last span with an EMPTY join: the real 2026-09-16 co-develop upgrade deleted the project .gitignore WORKSPACE-MANAGED secrets block (.env/*.pem — caught only because the upgrade's own security bootstrap gate failed) and AGENTS.md's 43-line graft repo context graph block; the reconcile/positional offsets were also captured BEFORE the keyed replacements mutated the content, so even legitimate reconciles sliced stale positions; fix: merge core extracted to the new L0-only lib/managed-block-merge.ts v1.0.0 (pure mergeManagedBlocks(projectContent, templateContent, commonContent, rel, dryRun) → {content, merged, log}; findManagedBlocks/buildBlockKeyMap/findInsertionPosition moved with it, new buildMergedTemplateBlocks exposes the variant∪common union) — keyed and unlabeled project occurrences tracked separately, unlabeled reconcile/positional branches compare and slice ONLY unlabeled spans, and unlabeled occurrences are re-scanned AFTER the keyed phase for fresh offsets (zero-unlabeled-template reconciles still remove stale unlabeled project blocks by design but can never touch keyed blocks); all MERGED/INSERTED/APPENDED/RECONCILED/WARNING/INFO log lines preserved verbatim; COMMON-* zones byte-identical; upgrade-project.ts becomes a thin fs wrapper (read → merge → write when !dryRun → print log)), tests/unit/managed-block-merge.test.ts v1.0.0 (18 tests: keyed merge/insert, THE BUG keyed-only-blocks regression, fresh-offset reconcile + equal-count positional after a length-changing keyed merge, unlabeled append, unlabeled-only reconcile removal, COMMON-AGENTS START/END parity, per-key union variant∪common, dryRun purity); previous: New-project provenance fallback alignment (T-20260916-002, docs/designs/2026-09-16-new-project-provenance-alignment-design.md): new-project v1.19.0 → v1.20.0 (scaffold provenance resolution loses its silent "unknown" tail — without --version, templates/VERSION is read pre-flight via helpers/template-version.ts resolveProvenanceVersion() and a missing/unparseable SSOT aborts before any scaffolding work; explicit --version values still win as-is; downstream provenance output formats unchanged); previous: Upgrade-target realpath guard batch (T-20260916-006/-007, docs/designs/2026-09-16-upgrade-target-realpath-guard-design.md): upgrade-project v1.29.0 → v1.30.0 (H14: fs.realpathSync canonicalization of the upgrade target after the existsSync pre-check, workspaceRoot and Projects/ canonicalized once, root guard + containment compare canonical forms — a symlink resolving to the root now hard-fails; outside-Projects WARN promoted to a fail-closed confirm-prompt naming the canonical target, fires for dry-run, EOF/non-y answers abort with exit 1, --yes stays the single scripted consent token), tests/unit/project-target-guards.test.ts v1.0.0 → v1.1.0 (H14 negative coverage: symlink-to-root guard, outside-Projects EOF/n abort + y/--yes consent, inside-Projects never prompts, missing-target pre-canonicalization); previous: Variant-ization overlay guard batch (T-20260916-003/-004/-005, docs/designs/2026-09-16-variant-ization-overlay-guard-design.md): project-to-variant v1.3.0 → v1.4.0 (fail-closed exists-guard on templates/<target>/ — corrupt/foreign, stable, deprecated targets hard-refuse with no bypass; beta refuses unless --overlay-variant; exit-hook rollback: fresh rm / overlay snapshot-restore), l3-to-variant-pipeline v1.18.0 → v1.19.0 (PHASE 0.6 overlay guard before Phase 1; module failure-path rollback via failWithRollback — no process hooks, the E2E harness imports the execute function; --overlay-variant), new lib/variant-overlay-guard v1.0.0 (shared fail-closed classification, 'OVERLAY GUARD' message prefix), helpers/generate-variant v1.14.0 → v1.15.0 (guard at output resolution; explicit output outside templates/ exempt), helpers/rollback-partial-project v1.0.0 → v1.1.0 (overlay snapshot-rename trio: snapshotDirForOverlay/restoreOverlaySnapshot/discardOverlaySnapshot), test-l3-to-variant-promotion v1.3.0 → v1.4.0 (Test 6 second-run refusal + no stray .overlay-backup-*); generate-variant, rollback-partial-project, and variant-overlay-guard newly delivered to this mirror via layer L0+L1; previous: 2026-09-16 — Scaffold fresh-audit remediation batch (T-20260916-009/-010/-011, docs/designs/2026-09-16-scaffold-fresh-audit-remediation-design.md): validate-templates v1.31.0 → v1.32.0 (new PM-04 `managed-block-parity` — every WORKSPACE-MANAGED block in templates/common/AGENTS.md must exist, marker-wrapped with content parity, in every templates/co-* variant AGENTS.md (set-of-normalized-contents per key; duplicates legitimate); new `variant-version-manifest` — variant templates must NOT ship docs/VERSION_MANIFEST.md, retiring the 11-of-13 stub class), new lib/managed-block-parity v1.0.0 (keyed-block extraction + set-parity comparison, shared by the validator and the data fix), new lib/platform-delivery v1.0.0 (platform-delivery-aware prose-target partitioning), validate-model-registry v1.3.0 → v1.4.0 (the CODEX.md 3-Tier prose target self-skips with a visible note when the codex platform was not delivered — neither CODEX.md nor .codex/ exists — so codex-opt-out projects stop failing their own audit with "could not read CODEX.md"), new-project v1.18.0 → v1.19.0 (§7.8 generates the project's full docs/VERSION_MANIFEST.md post-delivery via the project's own scripts/generate-version-manifest.ts, cwd = projectDir, loud non-fatal — before the post-scaffold audit), upgrade-project v1.28.0 → v1.29.0 (post-upgrade manifest regeneration replaces any retired stub and refreshes the manifest after agents/skills/scripts changed), lib/upgrade-policy v1.5.0 → v1.6.0 (docs/VERSION_MANIFEST.md joins REGENERATED_FILES — never template-delivered, so the deny-list default can no longer deliver a template copy over a project's generated manifest), helpers/scaffold-markers v1.1.0 → v1.2.0 (VERSION_MANIFEST relpath constants + decideManifestGeneration invoke semantics), template data: all 13 templates/co-*/AGENTS.md now carry the current marker-wrapped tier-model-mapping blocks (§3.6 3-tier list + §5.3 Model-column note) replacing the stale 2-model prose (11 variants) or a fresh §3.6 section (co-abap/co-price), and the 11 stub docs/VERSION_MANIFEST.md files are deleted from templates/co-*/docs/; previous: 2026-09-16 — Wave 5 (T-20260915-008/-009/-012): lifecycle-sync-audit v1.14.0 (Check H script record version gate), helpers/template-utils v1.2.0 (DEFAULT_PM_ROLE_DESCRIPTIONS completed to all 13 variants), helpers/scaffold-markers v1.1.0 (NEW_PROJECT_L1_ONLY_AGENTS stale entries dropped); previous: 2026-09-12 — T-20260912-001: upgrade-project v1.24.0 → v1.25.0 (TEMPLATE TREE SYNC's SYNC branch now preserves project-only content in docs/context.md on template footer bumps: a findProjectOnlySections gate skips the copy with a loud CONTEXT PRESERVE log when the project copy carries top-level sections absent from the template (COMMON-*/VARIANT-INJECT managed-zone-aware) or no version footer at all (wholeFileOwned — fully restructured file); new --force-context-sync flag takes the template version anyway and logs the discarded section count; no project-only content keeps the exact UPDATE/CONFLICT behavior; dry-run verdict parity), helpers/context-sections v1.2.0 → v1.3.0 (new findProjectOnlySections() ownership-detection helper powering the gate; both SCRIPTS.md registry rows updated in lockstep — L1 upgrade-project row also reconciled 1.22.1 → 1.25.0); previous: 2026-09-12 — T-20260912-025: helpers/ticket-store v1.2.0 → v1.2.1 (nextSeqGuess now scans both tickets/ and tickets/governance/ — ids are one namespace across the two directories because move/list resolve governance/ first, so a service create could mint a same-day id that shadow-matched a governance ticket and move it instead; regression test added); previous: 2026-09-12 — T-20260912-015/023/024 final remediation batch (L0+L1 mirrors updated in lockstep): validate-md-language v1.10.0 → v1.11.0 (scan scope widened to docs/adr/, docs/decisions/, and docs/VERSION_MANIFEST.md — ADR-0072 declares lang: ko/proper-noun, DEC-20260825-02's Korean quote translated instead of excepted, generated manifest covered by named generated-region allowlist markers rather than a whole-file lang: ko so the rest stays validated; memory/ exclusion documented in-code as deliberate), ticket.ts v1.1.0 → v1.2.0 (`move <id> done` requires non-empty `--result`; --force does NOT bypass; no automation closes tickets), helpers/ticket-store.ts v1.1.0 → v1.2.0 (MoveOptions.result persisted on done); non-script: MEMORY.md archive links → link-free tombstones (memory/archive/ deliberately gitignored per CONSTITUTION §2.3), explain-me BUILD_GUIDE.md BSD-only sed replaced with portable sed -i.bak across SSOT + mirrors, edu-sync.yml claude_args gained the nightly `|| 'glm-5.3'` --model default; previous: 2026-09-12 — T-20260912-007/009/017/021 remediation batch (L0+L1 mirrors updated in lockstep): dev-sync v1.13.0 → v1.14.0 (fail-open → fail-closed: step 3.7 checks verify-scripts --check-drift's exit code and aborts on drift; step 5 branch creation exit-code-checks probe + checkouts and aborts BEFORE staging/commit), sync-skills v1.7.0 → v1.8.0 (.sync-skills.lock concurrency guard with PID-validated stale recovery; atomic temp-sibling+rename copies; Phase 2 back-sync limited to genuinely .agents-only dirs with a pre-flight SSOT-divergence WARN replacing the stale SHORTCUT_SKILLS list; --dir missing value is a hard error), qa-gate v1.2.0 → v1.3.0 (Step 4 parity deepened: recursive scripts-tree comparison, one-sided detection scoped to the propagation-map mirror contract via a compact SCRIPTS.md layer registry, full-directory skill comparison for common skills), lib/upgrade-policy v1.4.0 → v1.5.0 (PLACEHOLDER_ALLOWLIST admits explain-me report.html + BUILD_GUIDE.md — runtime-substituted tokens); previous: 2026-09-12 — T-20260912-005/010/014/016/019 batch (L0+L1 mirrors updated in lockstep): lifecycle-sync-audit v1.7.1 → v1.8.0 (Check C normalization through the shared scrub — real drift is FAILURE; new Check E lifecycle-record Version/Owner gate; import.meta.main dispatch), validate-templates v1.24.0 → v1.25.0 (B-03r/B-03a exists→declared manifest reconciliation WARNs; L0/L1 parity now covers .json; scrub imported from the new shared lib/constitution-scrub v1.0.0, fixing this mirror's dangling import of the L0-only propagate-to-templates; main() import-safe), and spec-register v1.1.0 → v1.2.0 (import-safe: dispatch under import.meta.main, REGISTRY_PATH resolved from import.meta.dir — CLI behavior byte-identical); previous: 2026-09-10 — Governance scripted-fix batch (validator hardening), L0+L1 mirrors updated in lockstep: hooks/pre-commit v1.6.0 → v1.7.0 (T-20260910-015 — new tracked-.env commit gate: `git ls-files` scan blocks any commit while a bare `.env` stays tracked, closing the gitleaks `.gitleaks.toml` path-allowlist blind spot), hooks/pre-push v1.2.10 → v1.3.0 (T-20260910-025 — pre-push scope-down: full audit replaced with `audit.ts --lifecycle-only` and the unconditional integration suite replaced by changed-path tests (`bun test` over the test files touched by the pushed commits; no test files changed → skip; full suite remains in CI test.yml), new typecheck v1.0.0 (T-20260910-012 infrastructure only — `tsc --noEmit` regression gate against scripts/helpers/typecheck-baseline.json, L0-only baseline file, wired into CI test.yml but NOT yet into the dev-sync battery pending error triage), and validate-md-language v1.9.0 → v1.10.0 (T-20260910-027 implementation half — `language: ko` accepted as a legacy alias for `lang: ko` with a WARN recommending migration so the declaration vocabulary converges); previous: 2026-09-10 — Registry-row version bumps for context purification W1/W2 (docs/designs/2026-09-10-context-purification-design.md): helpers/context-sections v1.0.0 → v1.1.0 (L0+L1 file copies updated identically) and upgrade-project v1.19.2 → v1.20.0 (L1 file snapshot refreshes via propagate-to-templates at /sync); previous: 2026-08-24 — Version bump for md-to-ooxml v1.2.0 (PR15: .pptx presentation writer per backlog §8 co-work row 4 — new `compileToPresentationML()` completes the Office trio by emitting the full OOXML presentation package in the same single-file form as the docx/xlsx writers (Flat OPC `pkg:package` embedding `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml` + rels, slideMaster1 + rels, slideLayout1 + rels, theme1, and per-slide `slideN.xml` + rels); markdown mapping: each `# ` H1 starts a slide (heading text → title placeholder), list items → bullets (indent depth → `lvl`), `##`/`###` → bold lead-ins, paragraphs/tables/code blocks → plain-text body lines; `--type pptx`, `.pptx` extension inference, `--check` parity, plus unsupported-type guard; new `tests/md-to-ooxml-pptx.test.ts`); previous: 2026-08-24 — Version bump for verify-readme-sync v1.4.0 (PR10: user-guide translated_from_hash gate promoted WARN → FAIL per ADR-0055 playbook after soak — runUserGuideHashAudit() returns the failure count and increments totalErrors; missing/stale hashes now exit 1; soak evidence: zero warnings from PR #646 seeding through #647; tests assert FAIL behavior); previous: 2026-08-24 — Version bump for verify-readme-sync v1.3.0 (PR8: user-guide translated_from_hash WARN-stage audit per ADR-0055 playbook — detects missing/stale hashes in KO guides; --update-hashes now also seeds translated_from_hash in user-guide_ko.md frontmatter; preserves CRLF/LF line endings and UTF-8-no-BOM; WARN does not affect exit code); previous: 2026-08-24 — Version bumps for validate-templates v1.13.0 (country-profile lifecycle enforcement per docs/country-profiles.md "Profile Freshness & Ownership": profile frontmatter `status` must be one of active/draft/stale — hard FAIL on anything else; auto-stale WARN when an `active` profile's `last_verified` passes the 12-month line, recommending `status: stale`; new cross-variant Check B-05 WARN when the same `<CC>.md` carries divergent `last_verified` dates across variants; renumbered the duplicate per-variant skill-lifecycle check ID B-05 → B-09), validate-md-language v1.6.1 (L0+L1: removed the hardcoded 15-locale fallback — the locale list now comes solely from docs/workspace-schema.json `i18n.locale_codes`, degrading to ko-only with a warning when the schema is absent), and create-l3-scaffold v1.12.1 (writes `.claude/template-version.txt` at scaffold time — variant/version/platform/country/created, mirroring new-project.ts §5.6 — so L3 drafts carry country provenance from day one); previous: 2026-08-24 — Version bumps for upgrade-project v1.10.1 (country-profile awareness on the upgrade path: registry-driven prune of country-scoped skills after all skill-copy passes with an isLocallyModified conflict guard for legacy forks + dry-run parity; preserves `country=` in .claude/template-version.txt instead of erasing it) and l3-to-variant-pipeline v1.12.1 (new Phase 2.5: country-scoped skill exclusion — drops country_scoped_assets.skills entries from keepInVariant and the variant.json skill manifest so a --country KR draft cannot fork k-* skills into templates/<variant>/skills/); previous: 2026-08-23 — Version bump for validate-templates v1.10.0 (new Checks WS-11: bilingual user-guide pair per variant — hard FAIL, not common-satisfiable; WS-12: variant index coverage across the 6 README index files — EN/KO FAIL, es/ja WARN); previous: 2026-08-15 — Renamed the 4 scripts whose `l2`-prefixed names/flags predated the L3 layer terminology: `create-l2-scaffold.ts`→`create-l3-scaffold.ts` (v1.9.2), `generate-l2-readme.ts`→`generate-l3-readme.ts` (v1.0.3, `--l2-path`→`--l3-path`), `l2-to-variant-pipeline.ts`→`l3-to-variant-pipeline.ts` (v1.10.5, `executeL2ToVariantPipeline()`→`executeL3ToVariantPipeline()`, `PipelineConfig.l2ProjectPath`→`l3ProjectPath`), `test-l2-promotion.ts`→`test-l3-to-variant-promotion.ts` (v1.0.2); also renamed the `simulate-l2-promotion` skill to `simulate-l3-to-variant-promotion`. Historical ADRs, dated design docs, and memory archives were left unchanged (they document what was true at the time); previous: Version bumps for generate-l2-readme (new v1.0.0: self-service Phase A README regeneration sharing the generate-variant.ts renderer), create-l2-scaffold v1.9.0 (render README.md/README_ko.md from the standard template instead of hardcoded heredocs; _ORIGIN.md checklist + printSummary now point at generate-l2-readme.ts), generate-variant v1.10.0 (export generateReadme/generateReadmeKo/buildReadmeSubstitutions; relocate extractAgentRoster/extractSkills/normalizeRelPath here from l2-to-variant-pipeline.ts), l2-to-variant-pipeline v1.10.2 (import the three relocated functions from generate-variant.ts instead of defining them locally); previous: Version bumps for validate-templates v1.5.17 (new Check WS-08: README standard conformance, policy-driven WARN via variantValidationPolicy.warningOnly), generate-variant v1.9.0 (render README.md/README_ko.md from templates/common/docs/README.template.md via applyTemplate; readmeNarrative? override; deleted Generated/MVP footer), template-utils v1.1.0 (extracted generic applyTemplate(); applyContextTemplate delegates to it), readme-lifecycle-audit v1.0.3 (ownership comment: WS-08 is sole templates/ README standard enforcer); previous: Version bumps for validate-templates v1.5.16 (new Check WS-07: variants must not carry local docs/context.md), generate-variant v1.8.1 (fix Windows path-separator so SKIP_IN_COPY actually excludes docs/context.md during promotion), new-project v1.5.3 (defense-in-depth: variant overlay skips docs/context.md); previous: Version bump for l2-to-variant-pipeline v1.10.1 (Issue Set A fixes: consolidated SKIP_AGENT_FILES, fixed missingOptionalSections JSON field, removed process.exit(1) from executeL2ToVariantPipeline, registry-driven canonicalExtensionSource for lecture type, deleted dead VariantPlugin.goldenReference()); previous: Version bumps for l2-to-variant-pipeline v1.10.0, generate-variant v1.8.0, pm-md-parser v1.1.0, create-l2-scaffold v1.8.0, reconcile-with-l0-l1 v1.2.2, golden-reference-loader v1.1.0, capability-registry v1.0.2, consulting-plugin v1.1.0, agent-verify v1.0.2 (feature + bugfix changes: scan L1-match classification, lean variant templates, ADR-0048 pm.md).*
