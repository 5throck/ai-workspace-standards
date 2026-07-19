# co-develop User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> Practical, task-oriented guide for using the co-develop agent team. For the team overview and roster, see [README.md](../README.md). For governance and dispatch rules, see [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) / [GEMINI.md](../GEMINI.md).

---

## 1. Quick Start

co-develop is driven entirely through the **PM Gateway pattern**: you talk to PM, PM plans, PM dispatches specialists, and PM finalizes with `/sync`.

1. **Describe your task in plain language** — "add a login endpoint", "fix the flaky test in checkout", "review this PR". Do not try to invoke a specialist agent directly; specialists refuse direct user requests and redirect you to PM.
2. **PM classifies the task** (Phase Determination) and, for any multi-step task (2+ files or 2+ sequential steps), outputs an **execution plan table** before doing anything else:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [task description] | [specialist] | High/Medium/Low | [model] |
   | N | `/sync "type(scope): message"` | pm | Medium | [model] |

3. **You approve the plan** (or ask for changes). PM never proceeds to specialist dispatch without this step for multi-agent work.
4. **PM dispatches specialists** via the native `Agent` tool, one per row, respecting sequential vs. parallel execution order.
5. **PM runs the QA gate** (`bun scripts/audit.ts`) and verifies acceptance criteria.
6. **PM finalizes with `/sync "type(scope): message"`** — this single command runs the full pipeline: memory log → CHANGELOG entry → audit → commit → push → PR. You never run `git commit`/`git push` directly; the pre-commit hook blocks it outside `/sync`.

**Rule of thumb**: if you find yourself about to ask an agent file (`agents/code-writer.md` etc.) to do something directly, stop — route it through PM instead.

---

## 2. What Kind of Dev Task Do You Have?

Use this table to anticipate which agent/skill PM will likely dispatch. You don't need to name the agent yourself — describing the task is enough — but knowing the mapping helps you write a clearer request.

| Your task | Likely agent | Likely skill | Notes |
|-----------|--------------|--------------|-------|
| New feature / new endpoint | `architect` → `code-writer` → `test-runner` | `test-driven-development` | Architect produces the plan/ADR first; code-writer implements only after the plan is approved |
| Bug fix | `code-writer` → `test-runner` | `test-driven-development` | Write/confirm a failing test before the fix (red-green-refactor) |
| Code review / PR feedback | `security-monitor` or PM-directed reviewer | `code-review` | Focuses on correctness, maintainability, security, best practices |
| Refactor / tech-debt cleanup | `code-writer` | `refactoring` | Preserves behavior; pair with `test-runner` to confirm no regressions |
| New UI/UX or component design | `designer` | — | Produces wireframes, component specs, design tokens before implementation |
| Unrecognized tech stack / environment setup | `stack-setup` | — | Runs a research + security-review workflow; requires your explicit approval before executing any setup command |
| Test writing / QA gate / acceptance criteria check | `test-runner` | `test-driven-development` | Runs the test suite and audit script; reports pass/fail per acceptance criterion |
| Security review, secret scanning, dependency advisories | `security-monitor` | — | Runs at Phase 0 (baseline scan) and Phase 5 (pre-PR advisory check) |
| Architecture decision / trade-off evaluation | `architect` | — | Produces an implementation plan and ADR before any code is written |
| Commit, push, open a PR | PM | `sync` | Always via `/sync "type(scope): message"` — never direct `git commit`/`git push` |
| Add a changelog entry mid-session | PM | `changelog` | `/changelog "..."` before the final `/sync` |
| Log a session note without a full sync | PM | `memlog` | `/memlog "summary"` |
| Full multi-agent project review | PM | `project-review` | Auto-detects roster, dispatches all specialists in parallel, produces a prioritized Critical/High/Medium/Low plan |

---

## 3. The Development Pipeline Walkthrough

co-develop follows a fixed **pipeline order**: `architect → designer → stack-setup → code-writer → test-runner → security-monitor` (from `variant.json`). `designer` and `stack-setup` are optional and are skipped when there is no UI/UX component in scope, or when the project already has a configured stack, respectively.

### Step-by-step

1. **Architect (Phase 1-2)** — produces an implementation plan and ADR. Nothing gets implemented before this plan is approved by you.
2. **Designer (Phase 3, optional)** — if the task touches UI/UX, produces wireframes/component specs/design tokens. Skipped for pure backend/logic changes.
3. **Stack-setup (Phase 0-1, optional)** — only triggers when the project's tech stack is unrecognized. It identifies the stack, researches the *official* setup docs, runs a mandatory security review on every command (flagging `curl | sh`-style pipe-to-shell patterns as HIGH risk), and will not execute anything until you type an explicit approval keyword (`APPROVE`, or `CONFIRM HIGH RISK` for flagged steps).
4. **Code-writer (Phase 4)** — implements strictly from the approved plan. Does not design, does not decide scope — surgical changes only.
5. **Test-runner (Phase 4)** — runs `bun scripts/audit.ts` (documentation/lifecycle gate) plus the project's test command, then checks off each acceptance criterion individually. Reports a `READY FOR PR` or `BLOCKED` verdict. Maximum 2 QA iterations before escalating back to PM.
6. **Security-monitor (Phase 0, Phase 5)** — runs a baseline scan early and a pre-PR advisory check late, particularly for anything touching auth, secrets, or infrastructure.
7. **PM finalizes** — logs decisions to `memory/YYYY-MM-DD.md`, checks the Phase 5 lifecycle triggers (did an agent/skill/script change? did a variant status change?), and runs `/sync "type(scope): message"`.

### Key commands

```
bun scripts/audit.ts              # QA / documentation gate (must exit 0)
/changelog "..."                  # add a CHANGELOG.md [Unreleased] entry
/memlog "summary"                 # append a session log entry only
/new-task "name"                  # create an in-session task tracking block
/sync "feat: description"         # full pipeline: memlog -> sync-md -> changelog -> audit -> commit -> PR
```

`/sync` internally performs, in order: audit.ts (abort on failure) → memory log entry (4-section format) → MEMORY.md index update → `git add -A` + commit → branch creation (`pr/<date>-<slug>` if on `main`) → push → `gh pr create`. Direct `git commit`/`git push` calls, and `--no-verify`, are blocked by the pre-commit hook outside this pipeline.

---

## 4. Engagement / Project Phase Structure

co-develop uses a linear, gated phase model (see `AGENTS.md` §3.5 and `docs/co-develop.context.md`):

| Phase | Name | What Happens | Gate Criteria |
|-------|------|---------------|---------------|
| 0 | Team Assembly / Initiation | PM assesses requirements, creates agents/skills if needed; project scaffolded and dev environment verified | Project scaffolded, dev environment verified, CI pipeline configured |
| 1 | Triage | PM classifies the request; dispatches read-only agents in parallel for research/analysis | — |
| 2 | Analysis / Planning | PM synthesizes findings into requirements + acceptance criteria; architecture and tech stack confirmed | Architecture review approved, tech stack confirmed, sprint plan defined |
| 3 | Design | Architect produces implementation plan + ADR; Designer produces UI/UX specs if in scope | — |
| 4 | Implementation / Execution | Code Writer implements; Test Runner verifies; loop up to 3x on failures | Code review passed, tests green, no critical lint errors |
| 5 | Finalization | PM logs decisions, runs `/sync`, opens PR; deployment verified; documentation updated | Deployment verified, documentation updated, retrospective completed |

**Tier ceiling rule**: an agent's tier can be downgraded for simple tasks but never upgraded above its defined baseline (architect: High, designer/security-monitor/test-runner: Medium, code-writer/stack-setup: Low).

---

## 5. Where Outputs Land

| Artifact | Location |
|----------|----------|
| Architecture Decision Records | `docs/adr/` |
| Technical specifications | `docs/specs/` |
| API documentation | `docs/api/` |
| Session logs, meeting transcripts | `memory/YYYY-MM-DD.md` |
| Memory index | `memory/MEMORY.md` |
| Changelog entries | `CHANGELOG.md` (`[Unreleased]` section, moved on release) |
| Agent-to-agent handoff payloads | In-session JSON per `docs/handoff-spec.md` (not persisted to disk by default) |
| Pull requests | Branch `pr/<date>-<slug>`, opened via `gh pr create` at the end of `/sync` |
| Project/tech-stack configuration | `docs/co-develop.context.md` (the mutable customization layer over the immutable `docs/context.md`) |

There is no dedicated `deliverables/` directory in this variant — implementation code lands directly in the project's normal source tree per the approved architecture plan, and process artifacts (ADRs, specs, logs) land in `docs/` and `memory/` as listed above.
