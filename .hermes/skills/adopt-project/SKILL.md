---
name: adopt-project
description: >
  Converts an existing external project (created with other tools) into a
  workspace-standard project in place, as if delivered by new-project.ts.
  Use when: adopting a legacy/external project into the workspace standard,
  re-homing an existing project under a variant, onboarding a project for
  upgrade-project maintenance.
status: active
scope: common
l2_propagate: false
version: 1.1.2
owner: scaffolding-expert
last_reviewed: 2026-10-31
relates_to:
  - skill: migrate-project
    type: composes_with
  - skill: upgrade-project
    type: composes_with
  - skill: project-to-variant
    type: follows
metadata:
  type: scaffolding
  triggers:
    - adopt external project
    - adopt project to standard
    - convert external project to workspace standard
    - onboard existing project
---

# Skill: adopt-project

## When to Use

- An existing project built outside this workspace should become a workspace-standard project (AGENTS.md, platform twins, docs/context.md, githooks, scripts).
- The project must keep its own content and git history (in place, no re-scaffold).
- After adoption, `upgrade-project.ts` maintains the project and `project-to-variant.ts` can later promote it to a template.

## Script

**Script**: `scripts/adopt-project.ts`

```bash
bun scripts/adopt-project.ts <project-path> --variant co-<x> [--platform all|claude|antigravity|codex] [--dry-run] [--yes]
```

## What It Does

1. Pre-flight: git repo + bun required; working tree must be fully committed; refusal-grade aborts (never bypassed by `--yes`) for tracked secret-shaped files, hook-manager conflicts (husky/simple-git-hooks/lefthook), and gitleaks findings in pre-existing content.
2. Scans the full effective delivered-path set (upgrade-policy SSOT), inventories collisions, retained foreign scripts, foreign skills, and workflow traces; presents the plan interactively (`--yes` accepts defaults: full roster, region-neutral country).
3. Preserves every colliding foreign file to a backup outside the project repo, then lets the `upgrade-project.ts` engine deliver the standard tree (subprocess, `--yes` forwarded; the tree stays clean so the engine stash never fires).
4. Restores collisions into `scripts/_legacy/` (de-executed, gate-exempt archive), registers retained foreign scripts in the project SCRIPTS.md, resolves pm.md extends-stubs, seeds memory/docs-README/CHANGELOG/context files, applies scoped placeholder substitution, merges package.json (project keys win), runs bun install + hooksPath re-assert + trail build (graft-era binaries: `graft build` — design 2026-10-31-graft-trail-migration), and reports.
5. No auto-commit: review with `git diff HEAD` and commit when satisfied.

## Directions (disambiguation)

| Intent | Tool |
|--------|------|
| External project → workspace-standard project (in place) | **adopt-project.ts** (this) |
| Keep an adopted/standard project current with its template | `upgrade-project.ts` |
| Standard project → variant TEMPLATE for reuse | `project-to-variant.ts` / `l3-to-variant-pipeline.ts` |
| Promote a beta variant template to stable | `promote-variant` skill |

## Requirements

- **A verified GitHub baseline** — run `migrate-project` (which performs this step via `ensure-github-repo.ts`) or the script directly; adopt-project warns when no GitHub remote exists.
- The project is a git repository with a fully committed working tree.
- `bun` is installed (all workspace scripts and the pre-commit hook require it).
- No competing hook managers (they must be removed/migrated first — the script refuses and explains).
- A target variant must exist under `templates/co-*`.

## Safety Model

- Refusal-grade findings cannot be bypassed by `--yes` (tracked secrets, hook managers, gitleaks hits).
- Colliding foreign files are archived byte-identical under `scripts/_legacy/` and to an external backup directory (path in the report); nothing is deleted.
- Foreign skills are protected from registry prunes via the variant.json skill_manifest seed.
- Adoption never commits; rollback guidance (HEAD SHA + backup path) is printed on failure.

## Adoption-only variants (consumption birth certificate)

Since adopt-project v1.8.0, when the target template's `variant.json` declares `consumption: "adoption-only"` (`co-utility` is the canonical target), the seeded project's `variant.json` is **stamped with the same `consumption` value** at adoption time — the field's "consumption birth certificate" (design `docs/designs/2026-11-21-co-utility-dedup-and-adoption-role-design.md` §5.6/§5.7). `variant.json` is PROJECT_STATE (ADR-0073) and is never wave-delivered, so adoption is the only moment a newly adopted project receives the field; a template that does not declare it leaves the key absent (scaffoldable default).

The same run also **registers the adopted `co-*` name as an exclusion row in `docs/fleet-membership.json`** (default ON): the fleet loops — the `resync-audit` scan and the `backport-diff` / `evidence-backport-scan` default sets — become blind to the project by name, without any change to those tools. Passing `--keep-in-fleet` declines the registration with a loud warning (the upgrade-project engine's adoption-only refusal, v1.115.0, remains the backstop in that case, but the project then shows up in loop scans). Explicitly naming an adoption project to any loop tool stays read-only-with-notice.

## References

- Design: `docs/designs/2026-09-23-adopt-project-conversion-design.md`
- Meeting: `memory/meeting-2026-09-23-adopt-project-plan-review.md`
- Manual predecessor: `docs/guides/variant-conversion-guide.md` §3 (Scenario B)
- E2E: `bun scripts/test-adopt-project.ts` (`ADOPT_E2E_FULL=1` for the real conversion run)
