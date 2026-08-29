---
name: sync
description: Runs the full project sync pipeline — lifecycle update, audit, L0→L1 publish, commit, push, and PR creation.
version: 1.2.2
last_reviewed: 2026-08-25
status: active
scope: common
l2_propagate: true
owner: pm
prerequisites: Bun runtime
metadata:
  type: process
  triggers:
    - sync
    - /sync
    - commit and push
    - create PR
---

# Skill: sync

## Context

Runs the full project sync pipeline (`scripts/dev-sync.ts`). This is the single mandatory pathway for all workspace commits — it handles lifecycle finalization, audit gating, L0→L1 template propagation, git branch creation, commit, push, and PR creation in one orchestrated flow.

## When to Use

- After completing any set of file changes that should be committed, pushed, and PR'd
- When the user says "commit", "push", "create PR", "/sync", or "finish this branch"
- At the end of any execution plan row or multi-agent task
- As the final step in any workspace governance workflow (Phase 5/6 of the Harness Engineering Workflow)

## Output Format

- A git branch `pr/<timestamp>-<slug>` created (or reused) from `main`
- A commit with all staged changes and a conventional commit message
- An open GitHub PR with the agent-written body (Why / What Changed / Test Plan / Security Checklist / Notes)
- Console output listing each pipeline step and its result

## Execution Steps

1. **Write the PR body** (the agent writes it — never shell out to an LLM CLI):
   - Inspect the change: `git diff HEAD~1 --stat` and `git diff HEAD~1 --name-only` (first 30 files).
   - Write the body in English using EXACTLY this structure (keep all section headers, fill placeholders):

     ## Why
     [1-3 sentences: what problem does this solve and why now?]

     ## What Changed
     [concise bullet list of actual changes — be specific, not generic]

     ## Test Plan
     - [ ] `bun scripts/audit.ts` passes
     - [ ] [add relevant manual or automated test steps]

     ## Security Checklist
     - [ ] No secrets, credentials, or API keys committed
     - [ ] No `.env` files staged (use `.env.sample` for templates)
     - [ ] Dependencies unchanged or reviewed for new CVEs

     ## Notes
     [Breaking changes, deployment steps, or reviewer guidance. Write 'None' if not applicable.]

     ---

   - Save it to `<git-dir>/sync-pr-body.md`, where `<git-dir>` is `git rev-parse --git-dir` (e.g. `.git/sync-pr-body.md`) — outside the working tree so it is never committed.

2. Run the sync script with the provided arguments, passing the body file:
   ```bash
   bun scripts/dev-sync.ts --body-file "$(git rev-parse --git-dir)/sync-pr-body.md" "$ARGUMENTS"
   ```

3. The pipeline executes the following steps in order:

| Step | Name | Fatal? | Description |
|------|------|:------:|-------------|
| 0 | CWD Guard | **FATAL** | Verifies script runs from workspace root; exits if CWD mismatches `import.meta.dir/..` |
| 1 | Language Gate | **FATAL** | Commit message / PR title must be English (context.md S3); blocks non-English via `language-guard.ts` |
| 2 | Memory Session Entry | **FATAL** | Appends session summary (changes, decisions, open issues) to `memory/YYYY-MM-DD.md` |
| 2 | MEMORY.md Index Sync | **FATAL** | Updates `memory/MEMORY.md` index via `sync-md.ts` |
| 2.5 | scripts/README.md Generation | **FATAL** | Regenerates `scripts/README.md` via `generate-scripts-readme.ts` if the script exists |
| 3 | CHANGELOG.md Check | **FATAL** | Checks `CHANGELOG.md [Unreleased]` — **blocks and exits** if empty (agent must add entries first via `/changelog` or manual edit) |
| 3.6 | Deprecated Script Warnings | non-fatal | Scans `SCRIPTS.md` for deprecated scripts and prints warnings |
| 3.7 | L0/L1 Script Drift Check | non-fatal | Runs `verify-scripts.ts --check-drift` to detect drift between L0 and L1 script copies |
| 3.8 | Memory File Archival | non-fatal | Runs `archive-memory.ts` to archive old memory files |
| 3.9 | Spec Registry Check | **FATAL** (L0) | Runs `audit.ts --spec-check --lifecycle-only` — blocks on the spec-relevance Fail (code diff with no spec activity; ADR-0055 Stage 2) and any always-on audit Fail; stale/missing-spec stay WARN; escape hatch `--spec-exempt=E1-E5` (AGENTS.md §5.1.1); skipped when `docs/specs/registry.json` is absent |
| 3.95 | QA Pre-checks | non-fatal | Runs project tests (if `package.json` has `test` script) and warns if `README_ko.md` is missing |
| 3.97 | Governance Reflection Gate | **FATAL** (L0) | Runs `verify-adr-governance.ts --strict` — blocks sync when post-cutoff Accepted ADRs lack governance-doc references (ADR-0059 Stages 2+2b: unlinked-ADR and marker-drift findings block); skipped in scaffolded projects (L0-only validator) |
| 4.5 | L0 to L1 Publish | **FATAL** (L0) / non-fatal (L1) | Propagates scripts, skills, commands, docs via `propagate-to-templates.ts --apply`; fatal only in L0 context (context.md present) |
| 4.52 | Template Dependency Sync | **FATAL** (L0) | Runs `sync-template-deps.ts --apply` — aligns shared dependency versions from root `package.json` into `templates/common/package.json` and regenerates `bun.lock` (shared keys only; root-only deps never added, template-only deps never removed); workspace-root gated |
| 4.62 | Cascade Re-publish | **FATAL** (L0) / non-fatal (L1) | Re-runs propagate-to-templates.ts --apply after skill sync — heals template platform skill copies (templates/common/.claude/.gemini/.agents/skills) changed by step 4.6 within the same sync; same gating and fatality as step 4.5 |
| 4.6 | Skill Sync to Platforms | non-fatal | Runs `sync-skills.ts` to distribute skills to `.claude/skills/`, `.gemini/skills/`, `.agents/skills/`; warnings only |
| 4.7 | VERSION_MANIFEST.md Generation | **FATAL** | Generates `VERSION_MANIFEST.md` via `generate-version-manifest.ts` |
| 4.9 | AUDIT GATE | **FATAL** | Runs `audit.ts` — must exit 0 before proceeding |
| 5 | Branch Creation | **FATAL** | Creates `pr/<timestamp>-<slug>` branch if on main/master; reuses existing branch otherwise |
| 6 | Sensitive File Guard + Git Add/Commit/Push | **FATAL** | Guards against `.pem`, `.key`, `.env`, `credentials.json`, etc.; runs `git add -A`, `git commit`, `git push` |
| 7 | PR Creation | **FATAL** | If `--body-file` was passed, validates it (English) and opens the PR via `gh pr create --body-file`; otherwise falls back to `gen-pr-body.ts` template, `.github/pull_request_template.md`, then `gh pr create --fill`; idempotent — updates existing PR if one already exists for the branch |

4. If audit fails, fix the reported issue before re-running.

## Related Skills

- `scripts/dev-sync.ts` — Core sync pipeline implementation
- `skills/gateguard/SKILL.md` — Pre-edit quality gate (run before edits that lead to sync)
- `context.md §3` — PR workflow and branch rules

## PR Language Rule

All PR titles and bodies generated by this command **must be written in English**, regardless of the active session language. This applies to the agent-written body in step 1 and to any `gh pr create` / `gh pr edit` calls — `dev-sync.ts` blocks non-English bodies at the same `language-guard` gate used for commit messages.
