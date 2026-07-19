# Co-Work User Guide

> A practical, task-oriented guide to actually using this team day-to-day. For the team roster and mission overview, see [`README.md`](../README.md). For the full governance/agent specification, see [`AGENTS.md`](../AGENTS.md).

## 1. Quick Start

Every task starts the same way: **talk to the PM, never invoke a specialist agent directly.**

1. **Describe your task in plain language.** e.g. "I need a research summary on X and a client-ready report."
2. **PM classifies the request** against the Phase Determination table in `AGENTS.md` §3.5 and figures out which specialist(s) are needed and in what order.
3. **PM shows you an execution plan table** before doing anything multi-step (2+ files or 2+ sequential actions):

   | Task | Agent | Tier | Model | Platform |
   |------|-------|------|-------|----------|
   | Research topic X | analyst | Medium | sonnet | Claude Code |
   | Draft report | content-writer | Medium | sonnet | Claude Code |

4. **You approve (or adjust) the plan.** PM then dispatches the specialist(s) — serially for anything that writes files, in parallel only for read-only research/analysis work.
5. **PM verifies the output** against your original ask and runs the quality gate (`bun scripts/audit.ts`).
6. **You close out the work with `/sync "type: description"`** — this is the only supported path to committing and opening a PR. It runs, in order: memory log → CHANGELOG entry → audit → commit → push → PR. Direct `git commit`/`git push` calls are blocked by the pre-commit hook.

**Rule of thumb:** if you find yourself typing "hey analyst, can you..." — stop, and ask PM instead. PM is the single point of entry; specialists are dispatched, not chatted with directly.

## 2. What Kind of Task Do You Have?

Use this table to guess which specialist(s) PM will bring in — useful for describing your task efficiently, not for calling the agent yourself.

| Your scenario | Likely agent(s) | Skill(s) involved |
|----------------|------------------|--------------------|
| "I need to investigate/research a topic and synthesize findings" | **analyst** | research-analysis |
| "Turn this research into a polished document/report" | **content-writer** | documentation-writing |
| "Write technical documentation, a how-to guide, or reference material" | **technical-writer** | documentation-writing, api-documentation |
| "Document a REST/GraphQL API, SDK, or developer-facing spec" | **technical-writer** | api-documentation |
| "Track deliverables, coordinate a schedule, run a status update" | **project-coordinator** | — |
| "Facilitate a discussion between multiple specialists" | **project-coordinator** (via `/meeting`) | — |
| "Build a narrative, change story, or presentation structure" | **storyteller** | — |
| "Work with Word/Excel/PowerPoint/Teams/SharePoint/Outlook" | **ms365-expert** | — |
| "Commit my work and open a PR" | PM (pipeline only) | `/sync` |
| "Log today's session / add a changelog entry" | PM (direct, memory/CHANGELOG only) | `/memlog`, `/changelog` |

If your task spans multiple rows (e.g. research → draft → review), PM will sequence the specialists across phases automatically — you don't need to break the request apart yourself.

## 3. The Standard Multi-Stage Workflow

Most substantive work in Co-Work follows the same four-stage pipeline (see `AGENTS.md` §3.1.4 and §4.2 for the full phase model):

```
User Request
   │
   ▼
PM Triage             — PM classifies deliverable type (AGENTS.md §3.5), shows execution plan
   │
   ▼
Design Approval       — for new structures/schemas/conventions only (Phase 1-2 gate); skipped for routine docs work
   │
   ▼
Specialist Dispatch   — analyst → content-writer / technical-writer → project-coordinator / storyteller / ms365-expert as needed
   │
   ▼
QA Gate               — PM runs `bun scripts/audit.ts`; must pass before finalization
   │
   ▼
Finalization           — `/sync "type: description"` commits, pushes, and opens the PR
```

**Commands you'll actually type:**
- `/sync "feat: add onboarding guide"` — full pipeline: memlog → sync-md → changelog → audit → commit → PR.
- `/changelog "..."` — add a standalone `CHANGELOG.md [Unreleased]` entry without running the full pipeline.
- `/memlog "summary"` — append a session note to `memory/YYYY-MM-DD.md` without touching CHANGELOG or git.
- `/new-task "name"` — create a task-tracking block in today's memory log.
- `/meeting` — run a structured, inline multi-agent discussion (PM facilitates, transcript saved to `memory/meeting-YYYY-MM-DD-[slug].md`).

**Never** bypass this with direct `git commit`/`git push`/`--no-verify` — the pre-commit hook blocks non-`/sync` commits by design.

## 4. Engagement / Project Phase Structure

Co-Work tasks move through the same phase model defined in `AGENTS.md` (§3.5, §4.2):

| Phase | Owner | What happens |
|-------|-------|---------------|
| **Phase 0 — Project Initiation** | PM | PM assesses requirements, creates/adjusts agents or skills if needed, updates `AGENTS.md` |
| **Phase 1 — Research & Analysis** | analyst, storyteller | Read-only investigation, data synthesis, narrative framing — dispatched in parallel when independent |
| **Phase 2 — Design Validation** | PM + storyteller | New structures, schemas, or conventions get an explicit approval gate before implementation |
| **Phase 3 — Design Handoff / Drafting** | content-writer, technical-writer | Approved plan turned into actual documents/guides |
| **Phase 4 — Execution** | project-coordinator, ms365-expert | Delivery logistics, scheduling, MS365-specific work; specialists may hand off to each other directly for routine steps |
| **Phase 5 — Lifecycle Finalization** | PM | Governance records updated, decisions logged to `memory/YYYY-MM-DD.md` |
| **Phase 6 — QA & Finalization** | PM | `bun scripts/audit.ts` run (max 2 iterations before escalation), then `/sync` opens the PR |

Writes are always **serial** (one specialist at a time, to avoid file-lock conflicts); read-only research/analysis can be dispatched **in parallel**.

## 5. Where Your Output Goes

Co-Work organizes deliverables under `docs/`, not a generic `deliverables/` folder:

| Location | What goes there |
|----------|------------------|
| `docs/reports/` | Final, client-ready deliverables |
| `docs/drafts/` | Work-in-progress documents and drafts awaiting review |
| `docs/research/` | Research notes, source material, reference gathering |
| `memory/YYYY-MM-DD.md` | Session logs, meeting transcripts, decision records |
| `CHANGELOG.md` | User-facing summary of notable changes (`[Unreleased]` section, added via `/changelog` or `/sync`) |

**Domain rules to keep in mind:**
- All research findings must be logged to `memory/` with source citations.
- Stakeholder review comments must be tracked in the project coordination log.
- Publication artifacts must be version-controlled (committed via `/sync`) before distribution.
