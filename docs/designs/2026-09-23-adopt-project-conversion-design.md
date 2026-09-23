# Adopt-Project Conversion — Design

- **Spec ID**: 2026-09-23-adopt-project-conversion
- **Date**: 2026-09-23
- **Status**: implemented (staged: PR 1 engine prerequisites → PR 2 feature)
- **Owner**: pm (design), automation-engineer (implementation), scaffolding-expert (domain)
- **Review**: PM-facilitated multi-agent meeting, 2 rounds (Architect, Scaffolding Expert, Automation Engineer, Security Expert, Auditor) — transcript at `memory/meeting-2026-09-23-adopt-project-plan-review.md`

## 1. Problem

Projects created with other tools have no automated path into the workspace standard. `docs/variant-conversion-guide.md` §3 ("Scenario B — Re-homing an Existing Project Under a Variant") documents the intent but is manual, and its sample provenance marker uses a format the engine cannot even parse (`variant: co-<name>` colon form vs the `^variant=(.*)$` equals form `upgrade-project.ts:494` reads). ADR-0020 (abap conversion) is the hand-done precedent.

Goal: convert an existing external project **in place** so its structure matches what `new-project.ts` produces (standard-adoption parity), preserving the project's content and git history. After conversion, `upgrade-project.ts` maintains the project and `project-to-variant.ts` can promote it to a template.

## 2. Non-Goals

- No template promotion (that is `project-to-variant.ts` / `l3-to-variant-pipeline.ts`).
- No auto-commit: conversion output is reviewed and committed by the operator.
- No rewrite of the delivery engine: `upgrade-project.ts` stays the single delivery SSOT.

## 3. Architecture (meeting-ratified)

Thin orchestrator `scripts/adopt-project.ts` shells out to `upgrade-project.ts` (subprocess boundary is the documented repo convention — `rollback-partial-project.ts` docstring). Success contract: exit 0 **AND** `.claude/last-upgrade-delivery.json` mtime from this run (upgrade-project has an exit-0 abort path at the missing-marker prompt). No stdout parsing. Consent (`--yes`) is collected by the orchestrator and forwarded unconditionally.

### 3.1 Round-1 P0 findings and resolutions

| # | Finding (round 1) | Resolution |
|---|-------------------|------------|
| P0-1 | Clean tree ⇒ `isLocallyModified()` false ⇒ every engine conflict branch dead ⇒ foreign files at delivered paths silently overwritten | **Pre-delivery relocation over the FULL delivered-path set** (derived from `upgrade-policy` `iterEffectiveTemplateFiles` + `resolveClaim`): foreign files at any delivered path move (copy-then-unlink, EXDEV-safe) to a backup dir OUTSIDE the project repo, keeping the tree porcelain-clean so the engine's `git stash push -u` never fires. Post-delivery they restore into `scripts/_legacy/` (chmod -x). |
| P0-2 | Registry-driven variant-scope skill prune deletes foreign skills (no manifest check; post-hoc restore disqualified by scrub + mirror-regen ordering) | **Engine patch**: variant-scope prune honors `projectManifestSkills` (v1.17.1 symmetry) + adopt seeds `variant.json` `skill_manifest.variant_specific` with foreign skills before delivery and deletes it after (parity). Backup restore stays as safety net. |
| P0-3 | `.claude/adopt-project-decisions.json` written pre-delivery is swept by `git stash -u` | Decisions/state JSON written post-delivery; relocation backup lives outside the repo; tree kept clean. |
| P0-4 | pm.md extends-stub delivered raw (dangling `extends:`; validate-agents fails) | **Shared helper** `helpers/resolve-pm-stub.ts` (extracted verbatim from new-project §2.3b/§2.5) runs in the adopt settling pass. |

### 3.2 Round-2 ratified additions

- `.gitattributes` leaves the blind LOCKED overwrite into `mergeGitattributes()` (mergeGitleaksToml pattern) — foreign attribute lines (GitLFS, custom merge drivers, the scaffold-added `docs/context.md merge=ours`) survive every future upgrade, not just adoption.
- `lib/pipeline-state.ts` generalized: injectable state file (`setStateFile`), string phase names, snapshot-backed undo (`addRollbackActionWithBackup`). Adopt persists `.claude/adopt-project-state.json`; state-file presence wins over the marker heuristic; resume beats restart.
- `verify-scripts.ts` `walkScripts` skips `scripts/_legacy/` (shipped via templates/common; existing projects receive it through normal SYNC_IF_NEWER version-based delivery).
- Parity claims are machine-checked: `test-adopt-project.ts` asserts the post-adopt tree ∩ delivered universe equals the new-project delivery derivation minus an explicit `ADOPT_PRESERVED` allowlist. The phrase "equivalent to new-project output" is only used in this testable sense.
- Refusal-grade pre-flight findings (never bypassable by `--yes`): secret-shaped tracked files, hook-manager conflicts (husky/simple-git-hooks/lefthook/.pre-commit-config.yaml), gitleaks findings in pre-existing content (report scan: working tree `--no-git` + history).
- Country is carried via `docs/countries/ACTIVE.md` (new-project §4 parity); the repair path must rewrite the marker's `country=` line because `country=none` in the marker defeats ACTIVE.md detection precedence.
- package.json settling merges `scripts` map + `dependencies`/`devDependencies` + `engines` + `overrides` (project keys win; hook-manager `prepare` scripts stripped); `workspace-scripts` marker never added to foreign files.

### 3.3 Ownership table

| Step | Owner |
|------|-------|
| template-version.txt, delivery manifest, gitattributes/gitleaks delivery, hooksPath fix, skill-graph + VERSION_MANIFEST regen, sync-skills | upgrade-project (engine) |
| Pre-flight (git/bun/clean-tree/refusals), collision scan + relocation backup, skill-manifest seed, interactive confirmations | adopt-project |
| `_legacy/` restore + chmod -x, foreign SCRIPTS.md registration, pm.md stub resolution + L1-B strip, `<variant>.context.md` generation + Provenance footer, memory/MEMORY.md + docs/README pair + CHANGELOG seeds, blankL0Refs sweep, scripts-snapshot.json, ACTIVE.md, scoped placeholder substitution, merge=ours append, package.json merge, platform profile (root twins + .codex only), variant.json deletion, bun install + hooksPath re-assert, graft build chain, gitleaks scan, audit smoke, decisions JSON, report | adopt-project settling |

## 4. Requirements

- R1: `bun scripts/adopt-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex] [--dry-run] [--yes]` converts in place.
- R2: No project-owned content is destroyed: every foreign collision is relocated with a recorded undo; PRESERVE/PROJECT_STATE files untouched.
- R3: Converted project passes its own `bun scripts/audit.ts --skip-memory` and `upgrade-project` recognizes it (auto-detect path).
- R4: Conversion is resumable after mid-run failure (state ledger) and idempotent on re-run.
- R5: Interactive confirmations are skippable with `--yes` (defaults documented) except the refusal-grade findings.

## 5. Acceptance Criteria

- E2E `scripts/test-adopt-project.ts` passes (fixture: foreign README/CLAUDE.md/package.json with husky prepare/colliding `scripts/audit.ts`/`tools/legacy.sh`); assertions cover preservation, `_legacy` relocation, skill non-deletion, pm.md self-containment, package.json merge, country handling, resume, second-run idempotency. Networked steps (bun install, audit smoke) gate behind `ADOPT_E2E_FULL=1` (120s scripts-suite ceiling).
- Full unit + integration suites pass; `validate-templates.ts` passes after template-copy changes.

## 6. Accessibility

Non-UI change (CLI + repo tooling). No WCAG surface is affected. CLI output follows existing console conventions (plain text, exit codes).

## 7. Preview Verification

Not applicable — no user-facing web/app UI is introduced (CLI tooling only).

## 8. Security Considerations

Secret-shaped files never enter stashes or backups outside the repo silently — refusal-grade abort with guidance. Hook-manager conflicts are neutralized only with explicit operator action. Relocated `_legacy` scripts are de-executed (`chmod -x`) and stay inside gitleaks scan scope. The engine's outside-Projects confirm is not laundered through `--yes`: adopt enforces its own target policy with a loud, separate check.

## References

- Meeting transcript: `memory/meeting-2026-09-23-adopt-project-plan-review.md`
- `docs/variant-conversion-guide.md` §3 (Scenario B — automated by this feature)
- ADR-0020 (hand-done abap conversion), ADR-0036 (TS scripts), ADR-0054 (error handling), ADR-0074 (design gate)
