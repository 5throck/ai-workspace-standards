---
status: Accepted
date: 2026-06-04
author: architect, automation-engineer
---

# ADR-0025: Workspace Root Protection — rootAllowlist Whitelist

## Context

The workspace root was not adequately protected against stray files. `audit.ts` used four hardcoded regex patterns (`/^Test-.*/i`, `/^out.*\.txt$/i`, and similar) that only caught specific known file shapes. This approach was too narrow: new test and debug scripts (`fix-hooks.sh`, `fix-npx.sh`) were created at the root level during incident remediation work and were not flagged by the audit because they did not match any of the four patterns.

Two structural gaps drove the failure:

1. **Pattern-based allowance is inherently incomplete.** Each new class of stray artifact requires a new regex, and the pattern set diverges from reality over time.
2. **No canonical record of what belongs at root.** There was no single source of truth declaring the complete list of permitted root-level files and directories, making it impossible to enforce a "default deny" policy.

The `tests/` directory existed in the workspace but was not structurally enforced as the required location for test artifacts; contributors could place scripts at root without any tooling objection.

## Decision

1. **Introduce a `rootAllowlist` section in `docs/workspace-schema.json`** declaring the complete whitelist of permitted files (`rootAllowlist.files`) and directories (`rootAllowlist.dirs`) at workspace root. This file is the single source of truth (SSOT) for what is allowed at root.

2. **Replace the pattern-based stray check in `audit.ts` with a whitelist-based "default deny" check.** At runtime, `audit.ts` reads `rootAllowlist` from `docs/workspace-schema.json` and fails with a blocking audit error for any root item not present in `rootAllowlist.files` or `rootAllowlist.dirs`.

3. **All test, debug, and temporary scripts MUST be created under the `tests/` directory**, which is listed in `rootAllowlist.dirs`. Creating such files at root is an immediate audit failure.

4. **Adding a new legitimate root-level file or directory requires an explicit update to `docs/workspace-schema.json`** before the change is committed. This is a deliberate friction point that forces a conscious decision rather than silent accumulation.

## Consequences

**Positive:**
- "Default deny" catches any new stray file type automatically, regardless of naming convention — no further pattern maintenance required.
- `docs/workspace-schema.json` is the single config file that controls what is permitted at root; reviewers have one place to look.
- `tests/` is now structurally enforced as the home for test artifacts.
- The audit gate runs on every `Write`/`Edit` via the `PostToolUse` hook and again at pre-commit, providing two enforcement checkpoints per change.

**Negative / Trade-offs:**
- Adding a legitimate new root-level file or directory requires a conscious `workspace-schema.json` update — contributors who forget this step will see an audit failure before understanding why.
- The initial allowlist was derived from the current repository state and may need tuning if edge cases (generated lock files, IDE metadata directories) surface in CI on other machines.

**Enforcement:**
- `audit.ts` reads `docs/workspace-schema.json § rootAllowlist` at runtime and emits a blocking failure for any unlisted root item.
- The pre-commit hook blocks commits with stray root files by running `audit.ts` as part of the standard QA gate — no bypass via `--no-verify` is permitted (see `CLAUDE.md §11`).
- Changes to `rootAllowlist` in `docs/workspace-schema.json` must be reviewed alongside the stray file they are intended to permit; approval implicitly endorses the new root item.
