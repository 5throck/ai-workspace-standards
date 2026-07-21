# Game Team Expansion — Genre-Specialized Design Agents

**Date**: 2026-06-27
**Status**: Draft
**Approach**: A — Genre-specific design agents (arcade + puzzle), existing game-developer handles all implementation

---

## 1. Project Overview

### 1.1 Purpose

Expand the co-game agent team from a Pac-Man-specific configuration to a **classic arcade + casual puzzle game** development team through genre-specialized design agents.

### 1.2 Goals

- Cover **retro arcade** and **casual puzzle/board** game genres
- **Specialize** design expertise by genre while keeping implementation unified
- Add **2 new design agents** (arcade-designer, puzzle-designer)
- **Evolve** existing game-designer from Pac-Man-specific to **universal game design**
- Maintain existing implementation team (game-developer, asset-artist, etc.) unchanged

### 1.3 Constraints

- No changes to tech stack (Vanilla TS + Canvas + Vite)
- No changes to project structure pattern (`projects/<game>/`)
- New agents are **design-only** (High tier, Phase 1-2)
- Implementation remains centralized through game-developer

---

## 2. Updated Team Composition

### 2.1 Full Team Roster (11 Agents)

| # | Agent | File | Tier | Type | Phase | Role |
|---|-------|------|------|------|-------|------|
| 1 | **PM** | `agents/pm.md` | High | Existing | 0, 2, 5, 6 | Project orchestration, GATE management, lifecycle |
| 2 | **architect** | `agents/architect.md` | High | Existing | 1, 2 | Code architecture design (module structure, type system) |
| 3 | **game-designer** (modified) | `agents/game-designer.md` | High | Existing | 1, 2 | **Universal game design**: core loop, difficulty curve, reward/scoring, tutorial, fun factor analysis |
| 4 | **arcade-designer** (new) | `agents/arcade-designer.md` | High | New | 1, 2 | **Arcade specialist**: timing-based play, item/power-up spawn, wave systems, high-score ranking, level layout |
| 5 | **puzzle-designer** (new) | `agents/puzzle-designer.md` | High | New | 1, 2 | **Puzzle/board specialist**: matching logic, turn-based systems, difficulty generation, stage design, randomness control |
| 6 | **designer** | `agents/designer.md` | Medium | Existing | 3 | UI/UX — screens, HUD, menus |
| 7 | **asset-artist** | `agents/asset-artist.md` | Medium | Existing | 3 | Sprite/animation/sound specifications |
| 8 | **game-developer** | `agents/game-developer.md` | Low | Existing | 4 | Canvas rendering, game loop, entity implementation (all genres) |
| 9 | **game-debugger** | `agents/game-debugger.md` | Medium | Existing | 4 | Bug analysis, fix proposals |
| 10 | **test-runner** | `agents/test-runner.md` | Medium | Existing | 4 | Unit tests, integration tests, gameplay QA |
| 11 | **stack-setup** | `agents/stack-setup.md` | Low | Existing | 0, 1 | Environment setup |

### 2.2 Design Agent Division of Labor

```
                    game-designer (universal foundation)
                   ┌──────────┴──────────┐
            arcade-designer          puzzle-designer
           (arcade specialist)     (puzzle specialist)
                   │                       │
           ┌───────┴───────┐     ┌─────────┴─────────┐
           │ Genre Knowledge │     │   Genre Knowledge  │
           │ · Wave system  │     │   · Match logic    │
           │ · Timing/reflex│     │   · Turn system   │
           │ · Item spawn   │     │   · Difficulty gen │
           │ · Entity AI    │     │   · Random control  │
           └───────┬───────┘     └─────────┬─────────┘
                   └──────────┬──────────┘
                              ▼
                    game-developer (shared implementation)
```

**Core principle**: Genre-specific **design** by specialists, **implementation** unified through game-developer.

### 2.3 Design Responsibility Matrix

| Design Area | game-designer | arcade-designer | puzzle-designer |
|------------|:---:|:---:|:---:|
| Core loop definition | ✅ | | |
| Difficulty curve principles | ✅ | applies | applies |
| Reward system | ✅ | applies | applies |
| Tutorial/onboarding | ✅ | | |
| Entity AI patterns | | ✅ | |
| Wave/stage systems | | ✅ | |
| Match/link logic | | | ✅ |
| Turn-based systems | | | ✅ |
| Difficulty generation algorithms | | | ✅ |
| Level/board layout | | ✅ | ✅ |

---

## 3. New Agent Definitions

### 3.1 arcade-designer (Tier: High, Phase: 1-2)

**Specialty**: Retro arcade game design (80s-90s classics)

**Core Responsibilities**:
- **Entity AI pattern design**: Chase/flee, pattern movement, boss AI, spawn systems
- **Wave/round system design**: Difficulty escalation logic, entity composition changes, speed/density scaling
- **Item/power-up design**: Drop probability, duration, effect stacking rules
- **Tile-based level design**: Maze layouts, collision terrain, bonus zones
- **Scoring & high-score**: Combo systems, bonus points, ranking mechanics
- **Game feel (FEEL) design**: Hit-stop, screen shake, particle timing, feedback intensity

**Reference Game Models** (internal knowledge base):
- Pac-Man (maze + AI + items), Space Invaders (wave + spawn), Tetris (speed/difficulty), Breakout (physics + items), Snake (growth + speed), Galaga (pattern AI)

**Deliverables**:
- `projects/<game>/docs/arcade-design.md` — Genre design specification
- `projects/<game>/docs/level-design.md` — Level/stage data design
- `projects/<game>/docs/scoring-system.md` — Scoring/reward system

**Interaction**: Works in parallel with `game-designer` during Phase 1-2. `game-designer` provides universal principles (core loop, difficulty curve); `arcade-designer` applies them to arcade genre specifics. Produces JSON/text design contracts for `game-developer` (Phase 4).

---

### 3.2 puzzle-designer (Tier: High, Phase: 1-2)

**Specialty**: Puzzle, board, card, and match game design

**Core Responsibilities**:
- **Matching/link logic design**: 3-match, chain combos, tile placement rules, gravity/physics effects
- **Turn-based system design**: Movement constraints, turn resources, simultaneous resolution logic
- **Difficulty generation**: Level difficulty curves, puzzle solver (validity verification), random board generation algorithms
- **Stage design**: Goal conditions, star rating/evaluation, constraint conditions (move limits, time limits)
- **Board/grid system**: Special tiles (obstacles, boosters, static tiles), board shape variations
- **Progression/unlock system**: Stage map, star rewards, coin/energy

**Reference Game Models** (internal knowledge base):
- Tetris (puzzle + speed), 2048 (merge logic), Candy Crush (match + board), Sudoku (logic puzzle), Minesweeper (information inference), Bejeweled (match-3)

**Deliverables**:
- `projects/<game>/docs/puzzle-design.md` — Genre design specification
- `projects/<game>/docs/board-design.md` — Board/grid structure design
- `projects/<game>/docs/difficulty-curve.md` — Difficulty generation algorithm

**Interaction**: Works in parallel with `game-designer` during Phase 1-2. `game-designer` provides universal principles; `puzzle-designer` applies them to puzzle genre specifics. Produces JSON/text design contracts for `game-developer` (Phase 4).

---

### 3.3 game-designer (Existing → Role Modification)

**Before**: Pac-Man-centered game mechanics design
**After**: **Universal game design foundation** — genre-agnostic design principles

**Maintained Responsibilities**:
- Core game loop (action → feedback → progression)
- Universal difficulty curve principles (flow theory, MDA framework)
- Reward/motivation systems (score, ranking, achievements)
- Tutorial/onboarding design
- User fun analysis (CSAT, session length, return rate metrics)

**Removed/Delegated** (Pac-Man-specific content):
- Ghost AI patterns → `projects/pacman/docs/ghost-ai-spec.md` (already exists)
- Maze level design specifics → `projects/pacman/docs/level-design.md` (already exists)
- Entity-specific behavior → delegated to arcade-designer

**Updated agent file**: Pac-Man-specific language replaced with universal game design principles. Genre-specific work is delegated to arcade-designer or puzzle-designer.

---

## 4. Dispatch Rules & Workflow

### 4.1 Genre-Based Dispatch Routing

PM classifies the genre when receiving a new game project and routes to appropriate design agents.

```
User Request: "Build a Tetris clone"
     │
     ▼
PM Triage → Genre Classification
     │
     ├─▶ Arcade (action, shooter, maze, breakout, snake)
     │   └─▶ game-designer(universal) + arcade-designer(genre) → parallel Phase 1-2
     │
     ├─▶ Puzzle/Board (match, logic, turn-based, card, strategy)
     │   └─▶ game-designer(universal) + puzzle-designer(genre) → parallel Phase 1-2
     │
     └─▶ Hybrid genre
         └─▶ game-designer + arcade-designer + puzzle-designer → 3-way parallel
```

### 4.2 Genre Classification Guide

PM uses these criteria for genre classification:

| Category | Keywords | Specialist Agent |
|----------|----------|-----------------|
| **Arcade** | maze, shooter, breakout, snake, reaction, real-time, reflex, wave, spawn, platformer | `arcade-designer` |
| **Puzzle/Board** | match, logic, turn-based, grid, board, card, strategy, solitaire, merge, sudoku | `puzzle-designer` |
| **Hybrid** | puzzle-action, tower defense, idle, roguelike, puzzle-platformer | Both + `game-designer` |

### 4.3 Updated Phase Execution Flow

| Phase | Agents | Description |
|-------|--------|-------------|
| **0** | PM + stack-setup | Project initialization, genre classification |
| **1-2** | game-designer + genre specialist + architect | Universal design + genre-specific design + architecture → **PM GATE** |
| **3** | designer + asset-artist | UI/UX + asset specs → **PM GATE** |
| **4** | game-developer + test-runner + game-debugger | Implementation, testing, debugging → **PM GATE** |
| **5-6** | PM | Lifecycle finalization, QA |

### 4.4 AGENTS.md Registration Updates

| Section | Changes |
|---------|---------|
| §1 Agent Roster | Add `arcade-designer`, `puzzle-designer` rows |
| §2 Agent Details | 2 new agent definition sections, `game-designer` modification |
| §3.1.5 Dispatch Triggers | `arcade-designer`: "arcade design task needed", `puzzle-designer`: "puzzle design task needed" |
| §3.5 Phase Gate | Add arcade/puzzle/hybrid genre rows |
| §4.1 Subagent Roster | 2 rows added (parallel: ⚠️ sequential preferred, write: orchestrates only) |
| §4.3 Role Boundary Matrix | Arcade scenario row, puzzle scenario row |

---

## 5. Implementation Roadmap

### 5.1 Steps

| Step | Task | Deliverable | Verification |
|------|------|-------------|---------------|
| **Step 1** | Create agent files | `agents/arcade-designer.md`, `agents/puzzle-designer.md` | `bun scripts/agent-verify.ts` |
| **Step 2** | Modify existing agent | `agents/game-designer.md` role expansion (Pac-Man-specific → universal) | `bun scripts/agent-verify.ts` |
| **Step 3** | Update AGENTS.md | Roster, Details, Dispatch, Phase Gate, Subagent, Role Boundary | Manual review + `bun scripts/audit.ts` |
| **Step 4** | Update docs | `docs/co-game.context.md` genre routing, `docs/context.md` agent list | Manual review |
| **Step 5** | Validate with game | Test genre routing with a new game project | New game Phase 1-2 execution |

### 5.2 game-designer Migration Plan

Existing `game-designer.md` contains Pac-Man-specific content:
- Pac-Man-specific ghost AI patterns → already documented in `projects/pacman/docs/ghost-ai-spec.md`
- Maze level design specifics → already documented in `projects/pacman/docs/level-design.md`
- **Remove Pac-Man-specific language** → replace with universal game design principles

### 5.3 Validation Game Candidates

Test the new agents with a new game project:

| Game | Genre | Tests Agent | Difficulty |
|------|-------|-------------|:----------:|
| **Tetris clone** | Puzzle (arcade hybrid) | `puzzle-designer` + `game-designer` | ⭐⭐ |
| **Space Invaders clone** | Arcade (shooter) | `arcade-designer` + `game-designer` | ⭐ |
| **2048 clone** | Puzzle (merge) | `puzzle-designer` | ⭐ |
| **Breakout clone** | Arcade (breakout) | `arcade-designer` | ⭐ |

### 5.4 Non-Change Scope

| Item | Reason |
|------|--------|
| `game-developer` | All genres share Canvas API-based implementation |
| `asset-artist` | Procedural rendering/sound specs are genre-agnostic |
| `designer` | UI/UX is genre-agnostic |
| `game-debugger` | Bug analysis is genre-agnostic |
| `test-runner` | QA is genre-agnostic |
| Tech stack | Vanilla TS + Canvas + Vite maintained |
| Project structure | `projects/<game>/` pattern maintained |

---

## 6. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Agent model | Design specialists only (no genre-specific developers) | game-developer handles Canvas implementation for all genres; splitting implementation creates unnecessary duplication |
| Tier | High for both new agents | Design quality is critical — poor game design cannot be fixed by good implementation |
| Phase | 1-2 (design only) | Design agents produce specs, not code; consistent with existing architect pattern |
| game-designer evolution | Expand to universal, not replace | Universal design principles (core loop, difficulty, reward) apply across all genres |
| Agent count increase | 9 → 11 (2 new) | Minimal increase for maximal genre coverage; avoids agent proliferation |

---

## 7. Trade-offs Acknowledged

- **2 design agents may overlap**: arcade and puzzle boundaries are not always clear (e.g., Tetris is both). The hybrid dispatch path mitigates this by involving both agents.
- **No genre-specific implementation**: All implementation goes through game-developer. If a genre requires fundamentally different rendering (e.g., text-based adventure), the current Canvas-focused game-developer may need a partner agent. This is deferred — Canvas-based games are the current scope.
- **Agent knowledge coverage**: The new agents rely on AI model knowledge of classic game design. Specific game rules and mechanics must be explicitly documented in project docs rather than assumed from agent knowledge.
