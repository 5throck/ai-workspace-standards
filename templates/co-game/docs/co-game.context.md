# co-game — Game Development Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              — immutable project identity (architecture, standards)
>   2. docs/co-game.context.md      — THIS FILE — tech stack, agents, skills, workflow

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5.7+ |
| **Framework** | None (Vanilla TypeScript) |
| **Rendering** | HTML5 Canvas API |
| **Audio** | Web Audio API (procedural sound generation) |
| **Build Tool** | Vite 6 |
| **Testing** | Vitest 3 |
| **Package Manager** | npm |
| **Runtime Dependencies** | None (zero-dependency game) |

---

## Agents

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | Workflow management, dispatch, quality gates | active |
| Architect | `agents/architect.md` | Code architecture design, ADR production | active |
| Game Designer | `agents/game-designer.md` | Universal game design: core loop, difficulty curve, reward system, tutorial | active |
| Arcade Designer | `agents/arcade-designer.md` | Retro arcade game design: entity AI, wave systems, scoring, level layout | active |
| Puzzle Designer | `agents/puzzle-designer.md` | Puzzle/board game design: matching logic, turn systems, difficulty generation | active |
| Game Developer | `agents/game-developer.md` | Canvas engine, entity systems, gameplay implementation | active |
| Visual Artist | `agents/visual-artist.md` | Sprite/animation specs, board/tile visuals, background, HUD elements | active |
| Sound Designer | `agents/sound-designer.md` | Procedural audio design: SFX, BGM loops, audio effects, Web Audio API | active |
| Game Debugger | `agents/game-debugger.md` | Bug analysis, fix proposals, bug pattern documentation | active |
| Security Monitor | `agents/security-monitor.md` | Security review, dependency vulnerability scan | active |
| Test Runner | `agents/test-runner.md` | Test authoring and execution, QA gate | active |
| Stack Setup | `agents/stack-setup.md` | Environment setup, build configuration | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

> **Lifecycle procedures**: See `templates/common/docs/context.md § Lifecycle Management`

---

## Scripts

<!-- Source Layer: L0 = templates/common (SSOT) | L1 = workspace root | L2 = project-local -->
<!-- Status: active | deprecated | experimental -->

| Script | Type | Entrypoint | Source Layer | Status |
|--------|------|------------|-------------|--------|
| `audit` | Tier 2 | `package.json` (`bun run audit`) | L0 | active |
| `dev-sync` | Tier 2 | `package.json` (`bun run dev-sync`) | L0 | active |
| `sync-md` | Tier 2 | `package.json` (`bun run sync-md`) | L0 | active |

> See SCRIPTS.md in templates/common/scripts/ for full lifecycle registry.

### Hybrid Scripting
All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

---

## Environment Setup

- Copy `.env.sample` → `.env` and fill in all required values.
- **Node.js**: `npm install` (in both root and `projects/pacman/` directories)
- Required env keys (see `.env.sample`): *(fill in after project creation)*

---

## Development Workflow

```
Edit code
  →
/sync "feat: description"
  →
1. audit.ts — abort on failure
2. memory/YYYY-MM-DD.md — session log (4-section format)
3. MEMORY.md index update
4. git add -A → commit
5. pr/<date>-<slug> branch created (if on main)
6. git push + gh pr create
```

### Agent Dispatch Order (co-game standard)

```
PM → Game Designer (universal: core loop + difficulty + reward)
   → Genre Designer (arcade-designer OR puzzle-designer — based on genre)
   → Visual Artist (sprite/animation + board/tile + background)
   → Sound Designer (SFX + BGM + audio system)
   → Game Developer (engine + entities + systems + rendering)
   → Game Debugger (bug analysis + fix proposals)
   → Test Runner (QA gate)
   → Security Monitor (review)
```

### Genre-Based Dispatch

| Genre | Keywords | Design Agent |
|-------|----------|-------------|
| Arcade | maze, shooter, breakout, snake, reaction, real-time, reflex | `arcade-designer` |
| Puzzle/Board | match, logic, turn-based, grid, board, card, strategy | `puzzle-designer` |
| Hybrid | puzzle-action, tower defense, idle, roguelike | Both + `game-designer` |

### Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | PM creates specialized agents/skills if required |
| 1 | Triage | PM classifies request + genre; dispatches read-only agents in parallel |
| 2 | Analysis | PM synthesizes findings into requirements + acceptance criteria |
| 3 | Design | Game Designer produces universal spec; Genre Designer produces genre spec; Visual Artist + Sound Designer produce asset specs |
| 4 | Implementation | Game Developer → Test Runner → Game Debugger (loop up to 3× on failures) |
| 5 | Finalization | PM logs decisions; runs `/sync`; opens PR |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Coding Guidelines
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; update when source changes -->

### Core Rules

1. **Think before coding** — state assumptions; if uncertain, ask.
2. **Simplicity first** — minimum code that solves the problem.
3. **Surgical changes** — touch only what is necessary.
4. **No hardcoded secrets** — always use env vars / `.env.sample`.
5. **PR required** — all changes via `/sync`; never direct push to main.

### Game Development Specific Rules

1. **60fps frame budget** — All per-frame logic must complete within ~16ms. Profile when adding new systems.
2. **Tile-based collision** — Movement and collision use the 28×31 tile grid (16px tiles). Use `HALF_ENTITY_SIZE = 7` for leading-edge checks.
3. **Fixed timestep** — Game loop uses `FIXED_DT = 1000/60 ms` with accumulator pattern (100ms cap). Never use variable timestep for gameplay logic.
4. **Grid alignment** — Entities must snap to grid before direction changes. Use `ALIGNMENT_TOLERANCE = 2` for drift compensation.
5. **Classic Pac-Man fidelity** — Ghost AI, maze layout, scoring, and timings must match the original arcade game. Use ROM-accurate references as the authoritative source.
6. **No external game dependencies** — All rendering is procedural Canvas API. No sprite images, no game frameworks, no asset files.
7. **Entity-component clarity** — Use the established inheritance hierarchy: `EntityBase` → `Pacman` / `GhostBase` → ghost subclasses. Don't flatten or redesign without architect approval.

### Plan Mode

Enter plan mode when: new game mechanic, entity behavior change, or change touches more than 2 files.

### Subagent Pattern

Each implementation task follows the Phase 4 execution loop:
1. **game-developer** implements
2. **game-debugger** validates behavior against spec
3. **test-runner** verifies acceptance criteria
4. **audit script** validates compliance
Maximum 3 iterations before escalating to user.

### Hybrid Scripting
All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).

### Package Policy

Prefer OSI-approved licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC.
Avoid: GPL-3.0, AGPL-3.0, SSPL, BSL unless explicitly justified.

<!-- END VARIANT-INJECT -->

---

## Git / PR Workflow
<!-- intentional-duplicate: workspace standards §3 — maintained locally for AI context proximity; update when source changes -->

```
/sync "feat: description"
  → 1. memory log (memlog)
  → 2. MEMORY.md index update (sync-md)
  → 3. CHANGELOG.md [Unreleased] auto-add
  → 4. audit.ts  (must exit 0)
  → 5. git checkout -b pr/<date>-<slug>
  → 6. git commit + push
  → 7. gh pr create
```

> All PR titles, bodies, and review comments must be in **English**.

---

## File Organization Policy

### Recommended Folder Structure (co-game)
| Folder | Purpose |
|--------|---------|
| `projects/pacman/docs/` | Game design specifications (mechanics, AI, levels, assets) |
| `docs/adr/` | Architecture Decision Records |
| `docs/specs/` | Technical specifications |
| `memory/` | Session logs, meeting transcripts |
| `projects/pacman/` | Game sub-project root |
| `projects/pacman/src/` | Game source code |
| `projects/pacman/tests/` | Game test files |

---

## Domain Rules

1. All gameplay implementation must have a corresponding test.
2. Ghost AI behavior changes require Game Designer specification update before implementation.
3. Maze layout changes must be validated against ROM-accurate reference data.
4. Performance-sensitive code (rendering, collision) requires profiling data before optimization.
5. Security Monitor must review before any PR targeting auth, secrets, or infra.

---

*co-game.context.md version: 2.0 — updated for game development project*

## Template Provenance

- **Template-Version**: 0.5.3
- **Template-Variant**: co-develop → co-game (forked and specialized for game development)
