# co-learning User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> Practical, task-oriented guide for using the co-learning agent team. For the team overview and roster, see [README.md](../README.md). For governance and dispatch rules, see [AGENTS.md](../AGENTS.md) (the shipped instruction file; `CLAUDE.md` / `GEMINI.md` arrive from `templates/common` at project creation).

---

## 1. Quick Start

co-learning is driven entirely through the **PM Gateway pattern**: you talk to PM, PM plans, PM dispatches specialists, and PM finalizes with `/sync`.

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

**Rule of thumb**: if you find yourself about to ask an agent file directly to do something, stop — route it through PM instead. The variant roster is three agents — `pm` (orchestration), `exam-bank-steward` (question-bank content and exam operations), `i18n-specialist` (locale documentation) — plus generic specialists PM dispatches per the §3.5 Deliverable-Type Gate; there is no generic dev pipeline.

---

## 2. What Kind of Dev Task Do You Have?

Use this table to anticipate which agent/skill PM will likely dispatch. You don't need to name the agent yourself — describing the task is enough — but knowing the mapping helps you write a clearer request.

| Your task | Likely agent | Likely skill | Notes |
|-----------|--------------|--------------|-------|
| New design, schema, ADR, directory/structure work | PM-dispatched design specialist (§3.5, High) | — | Design precedes implementation; PM presents the plan for your approval |
| Implementation against an approved plan | PM-dispatched implementation specialist (§3.5) | — | Surgical changes only; the plan gates scope |
| Documentation update / writing | PM-dispatched docs specialist (§3.5) | — | |
| Question-bank authoring/review, bias remediation, exam operations | `exam-bank-steward` | — | Every rewrite is human-reviewed via the remediation ledger (Phase Gate) |
| Locale documentation, translation zones, Korean plain-language output | `i18n-specialist` | — | Language-policy enforcement for co-learning content |
| Security review, secret scanning | PM | `security-scan` | Runs inside the QA gate |
| Architecture decision / trade-off evaluation | PM-dispatched design specialist (§3.5) | — | Produces an implementation plan and ADR before any code is written |
| Commit, push, open a PR | PM | `sync` | Always via `/sync "type(scope): message"` — never direct `git commit`/`git push` |
| Add a changelog entry mid-session | PM | `changelog` | `/changelog "..."` before the final `/sync` |
| Log a session note without a full sync | PM | `memlog` | `/memlog "summary"` |
| Full multi-agent project review | PM | `project-review` | Dispatches the roster per the §3.5 classification, produces a prioritized plan |

---

## 3. The Development Pipeline Walkthrough

There is no fixed named-agent pipeline. PM classifies every request through the **§3.5 Deliverable-Type Gate** (AGENTS.md) and dispatches accordingly — generic design/implementation/docs specialists for the dev slots, `exam-bank-steward` for question-bank content and exam operations, `i18n-specialist` for locale work.

### Step-by-step

1. **PM triage (§3.5)** — classifies the deliverable type and names the dispatch plan. Multi-agent work never starts without your approval of that plan.
2. **Design (Phase 1-2)** — a PM-dispatched design specialist produces the implementation plan and ADR. Nothing gets implemented before you approve the plan.
3. **Implementation (Phase 4)** — a PM-dispatched implementation specialist executes strictly from the approved plan — surgical changes only.
4. **Question-bank content (Phase 4-5)** — `exam-bank-steward` authors/reviews question-bank content and runs exam operations; every rewrite is human-reviewed via the remediation ledger.
5. **QA gate (Phase 4)** — PM runs `bun scripts/audit.ts` (documentation/lifecycle gate) plus the project's test command, then checks off each acceptance criterion individually. Maximum 3 QA iterations before escalating back to you.
6. **PM finalizes** — logs decisions to `memory/YYYY-MM-DD.md`, checks the lifecycle triggers (did an agent/skill/script change? did a variant status change?), and runs `/sync "type(scope): message"`.

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

co-learning uses the canonical linear, gated 7-phase model (see `AGENTS.md` §3.5, `docs/phase-definitions.md`, and `docs/co-learning.context.md`):

| Phase | Name | What Happens | Gate Criteria |
|-------|------|---------------|---------------|
| 0 | Team Assembly & Environment Baseline | PM assesses requirements, creates agents/skills if needed; project scaffolded and dev environment verified; security baseline scan | Project scaffolded, dev environment verified, CI pipeline configured |
| 1 | Analysis | PM classifies the request per §3.5; the design specialist analyzes requirements and acceptance criteria | — |
| 2 | Design Review & Approval | The design specialist produces the implementation plan + ADR; PM presents it for explicit user approval | Plan approved, scope confirmed |
| 3 | Content Production | `exam-bank-steward` authors/reviews question-bank content; `i18n-specialist` covers locale documentation when in scope | Content human-reviewed via the remediation ledger |
| 4 | Implementation & QA Gate | The implementation specialist executes the approved plan; PM verifies; loop up to 3x on failures | Code review passed, tests green, no critical lint errors |
| 5 | Security Review & Lifecycle Finalization | PM runs `security-scan` inside the QA gate; PM logs decisions and updates governance records | Security check clear for auth/secrets/infra changes, governance records updated |
| 6 | Quality Assurance & Finalization | PM runs the audit, `/sync`, opens PR; deployment verified; documentation updated | Deployment verified, documentation updated, retrospective completed |

**Tier ceiling rule**: an agent's tier can be downgraded for simple tasks but never upgraded above its defined baseline (`exam-bank-steward`: Medium, `i18n-specialist`: Medium; generic specialists take the §3.5 row's tier).

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
| Project/tech-stack configuration | `docs/co-learning.context.md` (the mutable customization layer over the immutable `docs/context.md`) |

There is no dedicated `deliverables/` directory in this variant — implementation code lands directly in the project's normal source tree per the approved architecture plan, and process artifacts (ADRs, specs, logs) land in `docs/` and `memory/` as listed above.
