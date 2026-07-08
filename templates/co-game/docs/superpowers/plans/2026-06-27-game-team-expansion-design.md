# Game Team Expansion — Genre-Specialized Design Agents & Asset Split

**Date**: 2026-06-27
**Status**: Draft
**Approach**: A — Genre-specific design agents (arcade + puzzle) + asset field split (visual + sound)

---

## 1. Project Overview

### 1.1 Purpose

Expand the co-game agent team from a Pac-Man-specific configuration to a **classic arcade + casual puzzle game** development team through:
1. **Genre-specialized design agents** (arcade-designer, puzzle-designer)
2. **Asset field split** (asset-artist → visual-artist + sound-designer)
3. **Evolution** of game-designer to universal design role

### 1.2 Goals

- Cover **retro arcade** and **casual puzzle/board** game genres
- **Specialize** design expertise by genre while keeping implementation unified
- **Separate** visual and audio asset expertise for higher quality in both
- Add **3 new agents**, rename **1 existing agent** (9 → 12 agents)
- **Evolve** existing game-designer from Pac-Man-specific to **universal game design**
- Maintain existing implementation team unchanged

### 1.3 Constraints

- No changes to tech stack (Vanilla TS + Canvas + Vite)
- No changes to project structure pattern (`projects/<game>/`)
- New agents are **design-only** (High tier, Phase 1-2 for genre designers; Medium tier, Phase 3 for sound-designer)
- Implementation remains centralized through game-developer

---

## 2. Updated Team Composition

### 2.1 Full Team Roster (12 Agents)

| # | Agent | File | Tier | Type | Phase | Role |
|---|-------|------|------|------|-------|------|
| 1 | **PM** | `agents/pm.md` | High | Existing | 0, 2, 5, 6 | Project orchestration, GATE management, lifecycle |
| 2 | **architect** | `agents/architect.md` | High | Existing | 1, 2 | Code architecture design (module structure, type system) |
| 3 | **game-designer** (modified) | `agents/game-designer.md` | High | Existing | 1, 2 | **Universal game design**: core loop, difficulty curve, reward/scoring, tutorial, fun factor analysis |
| 4 | **arcade-designer** (new) | `agents/arcade-designer.md` | High | New | 1, 2 | **Arcade specialist**: timing-based play, item/power-up spawn, wave systems, high-score ranking, level layout |
| 5 | **puzzle-designer** (new) | `agents/puzzle-designer.md` | High | New | 1, 2 | **Puzzle/board specialist**: matching logic, turn-based systems, difficulty generation, stage design, randomness control |
| 6 | **designer** | `agents/designer.md` | Medium | Existing | 3 | UI/UX — screens, HUD, menus |
| 7 | **visual-artist** (renamed from asset-artist) | `agents/visual-artist.md` | Medium | Renamed | 3 | **Visual asset specialist**: sprite design, animation frames, board/tile visuals, background, HUD visual elements |
| 8 | **sound-designer** (new) | `agents/sound-designer.md` | Medium | New | 3 | **Audio specialist**: procedural sound design, BGM loops, sound effects, effect chains, audio layering |
| 9 | **game-developer** | `agents/game-developer.md` | Low | Existing | 4 | Canvas rendering, game loop, entity implementation (all genres) |
| 10 | **game-debugger** | `agents/game-debugger.md` | Medium | Existing | 4 | Bug analysis, fix proposals |
| 11 | **test-runner** | `agents/test-runner.md` | Medium | Existing | 4 | Unit tests, integration tests, gameplay QA |
| 12 | **stack-setup** | `agents/stack-setup.md` | Low | Existing | 0, 1 | Environment setup |

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

Phase 3 Asset Layer:
            visual-artist          sound-designer
        (sprite, animation,       (procedural audio,
         board/tile, background)    BGM, SFX, effects)
                   │                       │
                   └──────────┬────────────┘
                              ▼
                    game-developer (shared implementation)
```

**Core principles**:
- Genre-specific **design** by specialists, **implementation** unified through game-developer
- **Visual** and **audio** asset expertise separated for focused quality

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

### 2.4 Asset Responsibility Matrix

| Asset Area | visual-artist | sound-designer |
|-----------|:---:|:---:|
| Entity sprites & animation frames | ✅ | |
| Board/tile visual design | ✅ | |
| Background & environment visuals | ✅ | |
| HUD visual elements | ✅ | |
| Procedural sound design (oscillator specs) | | ✅ |
| Sound effect registry (trigger, frequency, duration) | | ✅ |
| BGM loop structure & composition | | ✅ |
| Audio effect chains (reverb, delay, layering) | | ✅ |
| Audio-visual sync timing | consults | ✅ |

---

## 3. New & Modified Agent Definitions

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

### 3.3 sound-designer (Tier: Medium, Phase: 3)

**Specialty**: Procedural audio design and sound system architecture

**Core Responsibilities**:
- **Procedural sound specification**: Define oscillator parameters (waveform, frequency, duration, envelope) for each game event
- **Sound effect registry**: Catalog all SFX with trigger conditions, priority, and mixing rules
- **BGM loop design**: Background music structure, layer system (e.g., intensity layers for danger/boss phases), loop points
- **Audio effect chains**: Reverb, delay, distortion, filter sweeps for Web Audio API graph construction
- **Audio layering rules**: How simultaneous sounds mix (ducking, priority, max polyphony)
- **Audio-visual sync**: Timing specifications linking sound events to game state changes

**Technical Approach** (Web Audio API):
- All sounds are **procedural** (oscillator-based, no audio files) — consistent with project zero-dependency constraint
- Output is a **sound specification document** for `game-developer` to implement (not audio files)
- Specifications include: OscillatorNode configurations, GainNode envelopes, BiquadFilterNode chains, AudioContext graph topology

**Deliverables**:
- `projects/<game>/docs/sound-spec.md` — Complete sound specification
- `projects/<game>/docs/audio-system.md` — Audio architecture (graph, layering, mixing rules)
- Sound event table with trigger conditions, parameters, and priority

**Interaction**: Works in parallel with `visual-artist` during Phase 3. Coordinates timing with `game-designer` on audio-visual sync. Produces specification for `game-developer` (Phase 4).

---

### 3.4 visual-artist (Renamed from asset-artist, Tier: Medium, Phase: 3)

**Changes from asset-artist**:
- **Removed**: All sound/audio responsibility (moved to `sound-designer`)
- **Renamed**: `asset-artist` → `visual-artist` for clarity
- **Enhanced**: Board/tile design, background/environment, HUD visual elements explicitly scoped

**Core Responsibilities**:
- **Entity sprite design**: Frame definitions, directional variants, animation cycles, palette
- **Board/tile visual design**: Tile sprites, special tile indicators, grid overlay, board frame
- **Background & environment**: Static backgrounds, parallax layers, environmental decorations
- **HUD visual elements**: Score display, life indicators, status icons, progress bars
- **Procedural rendering instructions**: Canvas drawing commands (arcs, rects, gradients) for each visual element
- **Animation timing**: Frame rates, transition durations, easing functions for UI elements

**Deliverables**:
- `projects/<game>/docs/visual-spec.md` — Complete visual specification
- `projects/<game>/docs/sprite-spec.md` — Sprite sheet layouts and animation frames
- `projects/<game>/docs/asset-spec.md` — Visual asset registry (combined sprite + tile + background)

**Interaction**: Works in parallel with `sound-designer` during Phase 3. Coordinates visual timing with `game-designer` on feedback/animation sync. Produces specification for `game-developer` (Phase 4).

---

### 3.5 game-designer (Existing → Role Modification)

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
- Sound effect mapping → delegated to sound-designer

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
| **3** | designer + visual-artist + sound-designer | UI/UX + visual assets + audio assets → **PM GATE** |
| **4** | game-developer + test-runner + game-debugger | Implementation, testing, debugging → **PM GATE** |
| **5-6** | PM | Lifecycle finalization, QA |

### 4.4 AGENTS.md Registration Updates

| Section | Changes |
|---------|---------|
| §1 Agent Roster | Add `arcade-designer`, `puzzle-designer`, `sound-designer`; rename `asset-artist` → `visual-artist` |
| §2 Agent Details | 3 new agent definition sections; modify `game-designer`, rename `asset-artist` → `visual-artist` |
| §3.1.5 Dispatch Triggers | `arcade-designer`: "arcade design task needed", `puzzle-designer`: "puzzle design task needed", `sound-designer`: "sound design task needed" |
| §3.5 Phase Gate | Add arcade/puzzle/hybrid genre rows; update visual-artist reference |
| §4.1 Subagent Roster | 3 rows added (parallel: ⚠️ sequential preferred, write: orchestrates only); visual-artist renamed |
| §4.3 Role Boundary Matrix | Arcade, puzzle, sound scenarios |

---

## 5. Implementation Roadmap

### 5.1 Steps

| Step | Task | Deliverable | Verification |
|------|------|-------------|---------------|
| **Step 1** | Create genre design agents | `agents/arcade-designer.md`, `agents/puzzle-designer.md` | `bun scripts/agent-verify.ts` |
| **Step 2** | Create sound-designer agent | `agents/sound-designer.md` | `bun scripts/agent-verify.ts` |
| **Step 3** | Rename asset-artist → visual-artist + remove sound | `agents/visual-artist.md` (rename + content update) | `bun scripts/agent-verify.ts` |
| **Step 4** | Modify game-designer role | `agents/game-designer.md` (Pac-Man-specific → universal) | `bun scripts/agent-verify.ts` |
| **Step 5** | Update AGENTS.md | Roster, Details, Dispatch, Phase Gate, Subagent, Role Boundary | Manual review + `bun scripts/audit.ts` |
| **Step 6** | Update docs | `docs/co-game.context.md` genre routing + agent list; `docs/context.md` agent list | Manual review |
| **Step 7** | Update agents/README.md | Agent list, groups | Manual review |
| **Step 8** | Validate with game | Test genre routing with a new game project | New game Phase 1-2 execution |

### 5.2 game-designer Migration Plan

Existing `game-designer.md` contains Pac-Man-specific content:
- Pac-Man-specific ghost AI patterns → already documented in `projects/pacman/docs/ghost-ai-spec.md`
- Maze level design specifics → already documented in `projects/pacman/docs/level-design.md`
- **Remove Pac-Man-specific language** → replace with universal game design principles

### 5.3 asset-artist → visual-artist Migration Plan

1. Rename file: `agents/asset-artist.md` → `agents/visual-artist.md`
2. Remove all sound/audio sections (Sound Asset Registry, audio specs)
3. Add explicit board/tile and background/environment sections
4. Update frontmatter role description
5. Update all references in other agent files and AGENTS.md

### 5.4 Validation Game Candidates

Test the new agents with a new game project:

| Game | Genre | Tests Agent | Difficulty |
|------|-------|-------------|:----------:|
| **Tetris clone** | Puzzle (arcade hybrid) | `puzzle-designer` + `game-designer` | ⭐⭐ |
| **Space Invaders clone** | Arcade (shooter) | `arcade-designer` + `game-designer` | ⭐ |
| **2048 clone** | Puzzle (merge) | `puzzle-designer` | ⭐ |
| **Breakout clone** | Arcade (breakout) | `arcade-designer` | ⭐ |

### 5.5 Non-Change Scope

| Item | Reason |
|------|--------|
| `game-developer` | All genres share Canvas API-based implementation |
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
| Asset split | visual-artist (visual) + sound-designer (audio) | Visual and audio require different expertise; separating enables focused quality in both; character/background NOT split because classic games share the same pixel art design language |
| sound-designer tier | Medium (Phase 3, not Phase 1-2) | Sound design depends on game mechanics and feel design from Phase 1-2; follows same pattern as visual-artist |
| Tier for genre designers | High for both new design agents | Design quality is critical — poor game design cannot be fixed by good implementation |
| game-designer evolution | Expand to universal, not replace | Universal design principles (core loop, difficulty, reward) apply across all genres |
| Agent count increase | 9 → 12 (3 new + 1 rename) | Controlled expansion for maximal genre coverage + asset quality; avoids agent proliferation |

---

## 7. Trade-offs Acknowledged

- **2 design agents may overlap**: arcade and puzzle boundaries are not always clear (e.g., Tetris is both). The hybrid dispatch path mitigates this by involving both agents.
- **No genre-specific implementation**: All implementation goes through game-developer. If a genre requires fundamentally different rendering (e.g., text-based adventure), the current Canvas-focused game-developer may need a partner agent. This is deferred — Canvas-based games are the current scope.
- **Agent knowledge coverage**: The new agents rely on AI model knowledge of classic game design. Specific game rules and mechanics must be explicitly documented in project docs rather than assumed from agent knowledge.
- **sound-designer as Medium tier**: Sound design quality matters, but it operates in Phase 3 (after design). If sound design proves to require High-tier reasoning for complex BGM composition, the tier can be upgraded later.
