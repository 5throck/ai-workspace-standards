# Migrate-Project — End-to-End Adoption Skill Design

- **Spec ID**: 2026-09-23-migrate-project-design
- **Date**: 2026-09-23
- **Status**: implemented
- **Owner**: pm (design), scaffolding-expert (domain), automation-engineer (implementation)
- **Supersedes**: the `ensure-github-repo` SKILL (skill only — the script `scripts/ensure-github-repo.ts` is retained as the step-1 utility of this flow). Spec 2026-09-23-pre-adoption-github-repo-design remains valid for that script.

## 1. Problem

The adoption flow was fragmented across three skills/scripts with hand-offs in prose: `ensure-github-repo.ts` (GitHub baseline), `adopt-project.ts` (conversion), and manual post-checks. The user's requirement: ONE skill that (1) checks/creates the GitHub baseline, (2) actually RUNS `bun scripts/adopt-project.ts`, and (3) VERIFIES the migration landed correctly — perform and inspect, not advise.

## 2. Decision

New skill **`migrate-project`** + orchestrator script **`scripts/migrate-project.ts`**:

```
bun scripts/migrate-project.ts <project-path> --variant co-<x> [--platform ...] [--org <org>] [--public] [--skip-github] [--dry-run] [--yes]
```

| Phase | Action | Performed by |
|-------|--------|--------------|
| 1. GitHub baseline | spawn `scripts/ensure-github-repo.ts` (check → create → push → verify; exit 0 = verified baseline). `--skip-github` escape hatch prints a loud warning | ensure-github-repo subprocess |
| 2. Plan preview | always run `adopt-project --dry-run` first and show the plan | adopt-project subprocess |
| 3. Execution | run real `adopt-project` (stdio inherited so interactive confirmations work; `--yes` forwarded) | adopt-project subprocess |
| 4. Verification | machine checklist (below) + project audit smoke + hooksPath + marker parse; every check reported pass/fail; exit 1 if a hard check fails | migrate-project |
| 5. Report | adoption summary + next steps (git diff → commit → push) | migrate-project |

### Verification checklist (phase 4)

- Required artifacts: AGENTS.md, docs/context.md, docs/`<variant>`.context.md, .githooks/pre-commit, .gitattributes, scripts/audit.ts, scripts/SCRIPTS.md, memory/MEMORY.md, CHANGELOG.md, .claude/template-version.txt, .claude/last-upgrade-delivery.json
- Platform twins per profile (all: CLAUDE+GEMINI+CODEX; claude: CLAUDE, no GEMINI; antigravity: GEMINI, no CLAUDE; codex: all three) — mirrors new-project §2.7 actual behavior
- Provenance: `.claude/template-version.txt` carries `variant=<requested>`
- .gitattributes carries `docs/context.md merge=ours`
- git `core.hooksPath` == `.githooks`
- GitHub remote present (github.com)
- Project audit smoke: `bun scripts/audit.ts --skip-memory` exit 0 (report; non-fatal for pre-existing foreign content, fatal-failure clearly labeled)

Hard vs soft: artifact/marker/hooksPath checks are HARD (exit 1 — the migration is incomplete); audit smoke failure is SOFT (labeled likely-pre-existing, reported loudly).

## 3. Skill registry changes

- **Delete** `skills/ensure-github-repo/` (+ mirrors, SKILLS.md row) — its scope was too narrow; its script stays and is registered in SCRIPTS.md as a standalone utility.
- **Add** `skills/migrate-project/` (scope: common, `l2_propagate: false`; triggers: "migrate project", "adopt and verify migration", "run project migration").
- `adopt-project` SKILL.md `relates_to` updated: ensure-github-repo → migrate-project.

## 4. Requirements

- R1: One command runs baseline → adoption → verification end to end.
- R2: Every phase's failure aborts with phase attribution (which step failed and why).
- R3: Verification is machine-checked against the checklist above; results are itemized in the final report.
- R4: `--dry-run` runs only the baseline check + adoption dry-run + planned verification list (no writes).
- R5: Verification-plan helpers (expected artifacts per variant/platform) are pure and unit-tested.

## 5. Acceptance Criteria

- Unit tests: platform-twin expectations per profile, verification-plan composition (including variant-named context file and marker line).
- Live: dry-run mode exits 0 on a clean external-style fixture; hard-check failure path produces exit 1 with itemized failures (covered by the real adopt E2E which asserts the same end state).

## 6. Accessibility

Non-UI change (CLI + repo tooling). No WCAG surface is affected.

## 7. Preview Verification

Not applicable — CLI tooling only.

## 8. Security Considerations

No new external surface: the script composes existing audited subprocesses (ensure-github-repo, adopt-project) and read-only git/gh queries. Repo creation stays private-by-default inside ensure-github-repo.

## References

- `docs/designs/2026-09-23-adopt-project-conversion-design.md` — the conversion being orchestrated
- `docs/designs/2026-09-23-pre-adoption-github-repo-design.md` — the retained baseline script
- `memory/meeting-2026-09-23-adopt-project-plan-review.md` — flow safety decisions
