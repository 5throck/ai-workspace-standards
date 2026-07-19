# co-game User Guide

Practical, task-oriented guide for building HTML5 Canvas games (Vanilla TypeScript) with the co-game agent team. For a team overview see [README.md](../README.md); for the full agent/skill registry and governance rules see [AGENTS.md](../AGENTS.md).

---

## 1. Quick Start

co-game follows the workspace-wide **PM Gateway** pattern: you never invoke a specialist agent directly — you talk to PM, PM plans, PM dispatches.

1. **Describe your task in chat.** Example: "I want to build a match-3 puzzle game with a scoring combo system."
2. **PM classifies the request** (deliverable type + phase, see AGENTS.md §3.5) and produces an **execution plan table** before touching anything:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | Core loop, difficulty curve, reward system | `game-designer` | Medium | sonnet |
   | 2 | Match/link logic, difficulty generation | `puzzle-designer` | Medium | sonnet |
   | 3 | Board/tile visuals | `visual-artist` | Medium | sonnet |
   | 4 | SFX/BGM design | `sound-designer` | Medium | sonnet |
   | 5 | Canvas engine + gameplay implementation | `game-developer` | Medium | sonnet |
   | 6 | Bug analysis / fix verification | `game-debugger` | Medium | sonnet |
   | 7 | Test authoring + QA gate | `test-runner` | Medium | sonnet |
   | 8 | `/sync "feat(...): ..."` — lifecycle + audit + commit + push + PR | pm | Medium | sonnet |

3. **You approve the plan** (or ask for changes) before any specialist is dispatched.
4. **Specialists execute** in the order shown — design phases (1-2) always precede implementation (Phase 4).
5. **Finish with `/sync`**: this single command runs the memory log, `CHANGELOG.md` entry, `bun scripts/audit.ts` QA gate, commit, push, and PR creation. Never run `git commit`/`git push` directly — the pre-commit hook blocks it unless it runs through `/sync`.

**Note**: PM only writes to `memory/*.md` and `CHANGELOG.md` directly. All game design docs, code, art specs, and tests are written by the dispatched specialist, never by PM.

---

## 2. "What kind of game dev task do you have?"

Use this table to guess which agent(s) PM will dispatch — you don't need to name the agent yourself, just describe the task.

| Your task / scenario | Agent(s) | Skill(s) | Phase |
|---|---|---|---|
| "Design the core game loop / difficulty curve / reward system" | `game-designer` | — | 1-2 |
| "Design a maze/shooter/breakout/snake-like arcade game" (entity AI, waves, scoring) | `arcade-designer` | — | 1-2 |
| "Design a match-3 / logic puzzle / board / card game" (matching logic, turns, difficulty gen) | `puzzle-designer` | — | 1-2 |
| "Plan the technical architecture / write an ADR" | `architect` | — | 1-2 |
| "Design the UI/UX, wireframes, HUD, menus" | `designer` | — | 3 |
| "Spec sprite sheets, animation frames, board/tile visuals, backgrounds" | `visual-artist` | — | 3 |
| "Design SFX, BGM loops, Web Audio effect chains" | `sound-designer` | — | 3 |
| "Implement the Canvas engine, game loop, collision, entity systems" | `game-developer` | `test-driven-development` | 4 |
| "There's a gameplay/collision/AI bug" | `game-debugger` | — | 4 |
| "Run tests / verify acceptance criteria before PR" | `test-runner` | `test-driven-development` | 4 |
| "Review this PR / check code quality" | (specialist who wrote the code) | `code-review` | 4 |
| "Clean up duplication / improve structure without changing behavior" | (specialist who owns the file) | `refactoring` | 4 |
| "Scan for vulnerabilities / secrets before merge" | `security-monitor` | `security-scan` | 0, 5 |
| "Set up the dev environment / unrecognized tech stack" | `stack-setup` | — | 0-1 |
| "Facilitate a multi-agent design discussion" | (PM facilitates) | `meeting-facilitation` (`/meeting`) | any |
| "Add/update an agent or skill" | PM + affected specialist | `agent-lifecycle-manager` / `skill-lifecycle-manager` | 0 |
| "Full project review across all agents" | all specialists (parallel, read-only) | `project-review` | any |

**Genre routing rule**: if the task is reaction/timing-based (maze, shooter, breakout, snake) → `arcade-designer`. If it's turn-based or grid-based (match-3, logic puzzle, board/card) → `puzzle-designer`. Hybrid genres (tower defense, roguelike, idle) get both plus `game-designer` for the universal layer.

---

## 3. The Game Dev Pipeline Walkthrough

co-game has a fixed **agent dispatch order** for any new mechanic or game (see `docs/co-game.context.md § Development Workflow`):

```
PM → game-designer         (universal: core loop + difficulty + reward)
   → arcade-designer OR puzzle-designer   (genre-specific, based on keywords)
   → visual-artist         (sprite/animation + board/tile + background)
   → sound-designer        (SFX + BGM + audio system)
   → game-developer        (engine + entities + systems + rendering)
   → game-debugger         (bug analysis + fix proposals)
   → test-runner           (QA gate)
   → security-monitor      (review)
```

This maps onto the Phase 4 execution loop for every implementation task:

1. **game-developer** implements per the approved design spec.
2. **game-debugger** validates behavior against the spec, root-causes any failures.
3. **test-runner** verifies acceptance criteria (Vitest 3 test suite).
4. **audit script** (`bun scripts/audit.ts`) validates workspace/lifecycle compliance.

Loop and correct — **maximum 3 iterations** before escalating to the user.

### Key commands

| Command | What it does |
|---|---|
| `bun --version` | Verify the Bun runtime is available (required for all scripts) |
| `npm install` | Install dependencies (run in workspace root **and** in `projects/<game>/`) |
| `bun scripts/audit.ts` | Run the QA gate manually (also runs automatically via PostToolUse hook on CLI) |
| `/sync "feat(scope): message"` | Full pipeline: memlog → sync-md → changelog → audit → commit → push → PR |
| `/changelog "..."` | Add a standalone `CHANGELOG.md [Unreleased]` entry |
| `/memlog "summary"` | Append a session entry to `memory/YYYY-MM-DD.md` without a full sync |
| `/new-task "name"` | Create an in-session task-tracking block in today's memory log |

### Tech stack reminders that shape the pipeline

- **Fixed timestep**: game loop uses `FIXED_DT = 1000/60 ms` with an accumulator (100ms cap) — never variable timestep for gameplay logic.
- **60fps budget**: all per-frame logic must fit in ~16ms; profile before merging new systems.
- **No external game dependencies**: rendering is pure Canvas API — no sprite images, no frameworks, no asset files.
- **Every gameplay change needs a test** — `game-developer` and `test-runner` both gate on this.

---

## 4. Engagement / Project Phase Structure

co-game reuses the workspace's 6-phase model (see [AGENTS.md §4.2](../AGENTS.md#§42-harness-engineering-workflow)), specialized for game development in `docs/co-game.context.md`:

| Phase | Name | What happens |
|---|---|---|
| **0** | Team Assembly | PM assesses requirements; creates specialized agents/skills if a gap exists |
| **1** | Triage | PM classifies the request + genre; dispatches read-only agents in parallel |
| **2** | Analysis / Design Validation | PM synthesizes findings into requirements + acceptance criteria; **user approval gate** |
| **3** | Design Handoff | `game-designer` produces the universal spec; genre designer produces the genre spec; `visual-artist` + `sound-designer` produce asset specs |
| **4** | Implementation | `game-developer` → `test-runner` → `game-debugger` execution loop (max 3 iterations on failure) |
| **5** | Finalization | PM logs decisions to `memory/YYYY-MM-DD.md`; runs `/sync`; opens PR |

**Beta variant status**: co-game is currently a **beta** variant (v0.1.0) — it requires 3 client engagements and 3 months of beta duration before promotion to stable. See `scripts/helpers/variant-governance-rules.ts` for the exact promotion criteria.

---

## 5. Output / Deliverable Locations

| What | Where |
|---|---|
| Game source code | `projects/<game-name>/src/` |
| Game tests (Vitest) | `projects/<game-name>/tests/` |
| Game design specs (mechanics, AI, levels, assets) | `projects/<game-name>/docs/` |
| Architecture Decision Records | `docs/adr/` |
| Technical specifications | `docs/specs/` |
| Final reports / deliverables | `docs/` |
| Session logs, meeting transcripts | `memory/YYYY-MM-DD.md`, `memory/meeting-YYYY-MM-DD-<slug>.md` |
| Changelog entries | `CHANGELOG.md` under `[Unreleased]` |
| Agent handoff payloads (JSON, in-flight only) | see `docs/handoff-spec.md` for the schema — not persisted to disk by default |

Build tooling: **Vite 6** for bundling, **Vitest 3** for tests, **npm** as package manager, zero runtime dependencies (procedural Canvas + Web Audio only, no sprite/asset files).

---

*User guide version: 1.0 — 2026-07-19*
