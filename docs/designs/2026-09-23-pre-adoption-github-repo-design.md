# Pre-Adoption GitHub Repo Readiness — Design

- **Spec ID**: 2026-09-23-pre-adoption-github-repo-design
- **Date**: 2026-09-23
- **Status**: implemented
- **Owner**: pm (design), automation-engineer (implementation)
- **Related spec**: 2026-09-23-adopt-project-conversion (the migration this prepares)

## 1. Problem

`adopt-project.ts` preserves the project's git history, but if the machine (or the disk) is lost before the adopted project is pushed, the migration cannot be recovered. An external project entering the workspace standard must therefore start from a GitHub-backed baseline. Today nothing checks for a GitHub remote before adoption, and nothing helps an operator create one.

## 2. Decision

A pre-adoption readiness skill + script pair:

- **Script**: `scripts/ensure-github-repo.ts <project-path> [--org <org>] [--public] [--remote <name>] [--dry-run]`
- **Skill**: `skills/ensure-github-repo/` (scope: common, `l2_propagate: false` — like adopt-project; it targets external projects, never scaffolded ones)

Flow: readiness checks (git repo, ≥1 commit, clean tree, gh auth) → GitHub remote detection → create + push when absent → print the recommended `adopt-project` command as the next step. The skill documents the same flow and composes with `adopt-project` (which gains a pre-flight warning when no GitHub remote exists, pointing at this script).

## 3. Requirements

- R1: With a GitHub remote present and reachable, the script changes nothing, VERIFIES the remote actually carries the local history (HEAD sha present on the remote branch), and exits 0 with the adoption recommendation.
- R2: Without a GitHub remote: verify `gh` auth, create the repo (private by default, `--public` opt-in, optional `--org`), add it as `origin`, push the current branch (full history) — then VERIFY, not assume: `gh repo view` confirms existence + visibility, and `git ls-remote` confirms the local HEAD sha landed on the remote branch.
- R3: Without a git repo / without commits: abort with the exact remediation commands (adoption would refuse anyway).
- R4: `--dry-run` prints the planned create/push without writing.
- R5: Pure helpers (remote parsing, owner/repo extraction, slug, arg building, ls-remote result parsing) are exported and unit-tested; subprocess edges are thin.
- R6: The verification phase is mandatory on every path (pre-existing remote, freshly created, or pushed) — the script's exit code reflects verification, so callers can trust exit 0 as "GitHub baseline is in place". The skill built on it performs the work and the inspection, not guidance only.

## 4. Acceptance Criteria

- Unit tests cover remote parsing (https/ssh forms), owner/repo extraction, slugification, and create-arg building, including the org/visibility/push variations.
- On a project with a GitHub remote, a dry-run run exits 0 with "ready" output and no subprocess writes (covered by unit-level arg tests + manual verification; real `gh repo create` is not exercised in CI — it requires auth and mutates external state).

## 5. Accessibility

Non-UI change (CLI + repo tooling). No WCAG surface is affected.

## 6. Preview Verification

Not applicable — no user-facing web/app UI is introduced (CLI tooling only).

## 7. Security Considerations

- The script never reads or prints tokens; it relies on `gh`'s authenticated state.
- Repo creation defaults to **private**; public requires the explicit `--public` flag.
- Push transmits the project's committed history only; uncommitted files are never pushed (the clean-tree check warns first anyway).

## References

- `docs/designs/2026-09-23-adopt-project-conversion-design.md` — the migration this prepares
- `docs/variant-conversion-guide.md` §3 — Scenario B (adoption)
