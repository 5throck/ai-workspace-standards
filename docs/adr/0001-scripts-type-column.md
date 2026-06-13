# ADR-0001: Add `type` Column to SCRIPTS.md Registry

**Status**: Draft  
**Date**: 2026-06-04  
**Deciders**: architect, automation-engineer  
**Supersedes**: —  

## Context

`scripts/SCRIPTS.md` is the single source of truth for all `.ts` files in the workspace scripts layer. Currently, the registry table treats every registered file identically using the same columns: `script | source | version | status | removal-date | security-advisory | layer | pair`.

`lifecycle-sync-audit.ts` Check A enforces that every registered `.ts` file carries a `@version` header matching the version recorded in `SCRIPTS.md`. This requirement applies uniformly to all entries — including `helpers/*.ts` and `lib/*.ts` files that are pure library modules imported by other scripts and never invoked directly via `bun` or bash.

The semantic distinction between **runnable scripts** and **library modules** is meaningful:

- **Runnable scripts** (`scripts/*.ts`, `hooks/*.ts`) are invoked directly (`bun run <script>`, `bun scripts/foo.ts`). They represent discrete executable units with their own versioned contract; `@version` tagging is both meaningful and enforceable.
- **Library modules** (`helpers/*.ts`, `lib/*.ts`) are ESM imports consumed by other scripts. They do not have an independent invocation surface. Requiring the same `@version` header enforcement level conflates import-level code with executable artifacts and introduces friction without proportional benefit.

Without a `type` distinction in the registry, Check A cannot apply differentiated enforcement rules. Maintainers cannot tell at a glance whether a registry entry is an executable entry point or a helper module, and the audit script must treat both identically even when the appropriate policy differs.

## Decision

Add a `type` column to the `SCRIPTS.md` registry table. The column accepts exactly two values:

- `script` — the file is a runnable executable, invoked directly via `bun`/bash. `@version` header is **REQUIRED**; Check A blocks on missing or mismatched version.
- `library` — the file is an imported module, never directly executed. `@version` header is **RECOMMENDED**; Check A emits a warning on missing version but does **not** block.

The `type` column is inserted after the `script` (filename) column, making the new schema:

```
script | type | source | version | status | removal-date | security-advisory | layer | pair
```

All existing `helpers/*.ts` and `lib/*.ts` entries receive `library`. All other entries (top-level scripts, hooks) receive `script`. `lifecycle-sync-audit.ts` Check A is updated to read the `type` column and apply the appropriate enforcement level per row.

## Consequences

**Positive:**

- **Reduced false-positive audit failures**: Library modules that legitimately lack a `@version` header no longer block commits. This removes a known friction point in the daily development workflow.
- **Semantic clarity in the registry**: The `type` column makes the artifact classification explicit and machine-readable, enabling smarter tooling decisions beyond just Check A (e.g., future dependency graph analysis, publish filtering).
- **Correct enforcement per artifact kind**: Runnable scripts retain strict version enforcement. The audit remains a meaningful gate for the artifacts that actually need it.
- **Easier onboarding**: New contributors can distinguish executable entry points from helper libraries directly from the registry table without reading file content.

**Negative / Trade-offs:**

- **Schema migration required**: All existing registry rows must be updated to add the `type` value. This is a one-time mechanical change but affects every row (~130+ entries).
- **Tooling update surface**: `lifecycle-sync-audit.ts`, `verify-scripts.ts`, and any future parser that reads `SCRIPTS.md` must be updated to handle the new column — increasing the coordination cost of this schema change.
- **Precedent for column creep**: Introducing a new column sets a pattern; future contributors may propose additional classification columns. The column documentation comment in `SCRIPTS.md` should explicitly discourage premature expansion.

**Implementation required:**

- [ ] Add `type` column to SCRIPTS.md registry table (all existing rows need `script` or `library` value)
- [ ] Update `lifecycle-sync-audit.ts` Check A to read `type` column from registry and apply different enforcement
- [ ] Update `verify-scripts.ts` parser to validate `type` column values
- [ ] Update SCRIPTS.md column documentation comment
- [ ] Publish updated SCRIPTS.md and lifecycle-sync-audit.ts to L1 via `bun run propagate:apply`

## Classification of Existing helpers/

| File pattern | Proposed type |
|---|---|
| `helpers/inject-*.ts` | library |
| `helpers/merge-*.ts` | library |
| `helpers/validate-*.ts` | library |
| `helpers/generate-*.ts` | library |
| `helpers/update-*.ts` | library |
| `helpers/write-*.ts` | library |
| `helpers/scan-*.ts` | library |
| `helpers/reconcile-*.ts` | library |
| `helpers/variant-*.ts` | library |
| `helpers/beta-*.ts` | library |
| `helpers/integration-*.ts` | library |
| `lib/*.ts` | library |
| All other `scripts/*.ts` | script |

### Specific existing entries by file

Based on the current registry (SCRIPTS.md lines 85–114):

| File | Proposed type |
|---|---|
| `helpers/lifecycle-governance.ts` | library |
| `helpers/template-validation.ts` | library |
| `helpers/inject-global-plugins.ts` | library |
| `helpers/inject-skills.ts` | library |
| `helpers/merge-frontmatter.ts` | library |
| `helpers/merge-package-scripts.ts` | library |
| `helpers/substitute-placeholders.ts` | library |
| `helpers/update-variant-lifecycle.ts` | library |
| `helpers/validate-output.ts` | library |
| `helpers/write-scripts-snapshot.ts` | library |
| `helpers/beta-lifecycle.ts` | library |
| `helpers/generate-variant.ts` | library |
| `helpers/validate-platform-parity.ts` | library |
| `helpers/integration-helpers.ts` | library |
| `helpers/scan-l2-project.ts` | library |
| `helpers/reconcile-with-l0-l1.ts` | library |
| `helpers/variant-governance-rules.ts` | library |
| `lib/platform-context.ts` | library |
| `lib/encoding-utils.ts` | library |
| `lib/error-handling.ts` | library |
| `lib/pipeline-state.ts` | library |
| `hooks/pre-commit.ts` | script |
| `hooks/pre-push.ts` | script |
| `hooks/post-write-lifecycle-check.ts` | script |

## Amendment: Check A Formal Consistency Policy (2026-06-04)

**Related decision recorded here for traceability.**

`lifecycle-sync-audit.ts` Check A verifies that the `@version` header in each `.ts` file matches the registered version in `scripts/SCRIPTS.md`. This is **formal consistency only** — Check A does NOT verify that file content semantically reflects the version history (i.e., that the code was actually updated to match the declared version).

**Rationale**: Semantic content verification would require git-history analysis (~100 git log calls per commit), adding 3–5 seconds to pre-commit. The cost exceeds the benefit given that code review provides semantic verification.

**Mitigation**: 
- `fix-script-versions.ts` now prints `git log --oneline -- scripts/<file>` after each version update, prompting developers to manually verify content history.
- `lifecycle-sync-audit.ts` Check A pass message includes `(formal version consistency only — semantic content not verified)`.
- `scripts/SCRIPTS.md` Registry section includes a comment documenting this limitation.
