# Game Team Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the co-game agent team from 9 to 12 agents by adding 3 genre-specialized design agents (arcade-designer, puzzle-designer, sound-designer), renaming asset-artist to visual-artist, and evolving game-designer to a universal design role.

**Architecture:** New agents follow the existing frontmatter-based agent definition pattern. Genre design agents (High tier, Phase 1-2) work in parallel with game-designer during design phases. Sound-designer (Medium tier, Phase 3) works in parallel with visual-artist during asset phases. All implementation remains unified through game-developer.

**Tech Stack:** Markdown agent definition files, YAML frontmatter, VARIANT-* HTML comment markers in AGENTS.md.

**Spec:** `docs/superpowers/specs/2026-06-27-game-team-expansion-design.md`

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `agents/arcade-designer.md` | New arcade game design agent |
| **Create** | `agents/puzzle-designer.md` | New puzzle game design agent |
| **Create** | `agents/sound-designer.md` | New sound design agent |
| **Rename+Modify** | `agents/asset-artist.md` → `agents/visual-artist.md` | Remove sound sections, rename, enhance visual scope |
| **Modify** | `agents/game-designer.md` | Expand from Pac-Man-specific to universal game design |
| **Modify** | `agents/game-developer.md` | Update handoff_from reference: asset-artist → visual-artist |
| **Modify** | `agents/game-designer.md` | Update handoff_to reference: asset-artist → visual-artist |
| **Modify** | `AGENTS.md` | 7 VARIANT-* sections + asset-artist rename (15+ edits) |
| **Modify** | `docs/co-game.context.md` | Agent roster table + dispatch order + asset-artist rename |
| **Modify** | `agents/README.md` | Available Agents table + Agent Groups |
| **Modify** | `agents/README_ko.md` | Same updates in Korean |
| **Modify** | `README.md` | Agent roster table + asset-artist rename |
| **Modify** | `README_ko.md` | Same updates in Korean |

**Do NOT modify** (historical/immutable):
- `docs/context.md` — marked IMMUTABLE
- `docs/superpowers/specs/2026-06-26-pacman-agent-team-design.md` — historical spec
- `memory/2026-06-27.md` — session log (historical record)
- `projects/pacman/docs/asset-spec.md` — game-specific doc (author field is historical)

---

## Task 1: Create arcade-designer Agent

**Files:**
- Create: `agents/arcade-designer.md`

- [ ] **Step 1: Create arcade-designer.md with full agent definition**

```markdown
---
name: arcade-designer
role: Retro arcade game design specialist — entity AI, wave systems, scoring, level layout
status: active
version: "1.0.0"
last_updated: "2026-06-27"
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
model: inherit
color: orange
description: >
  Arcade game design specialist. Produces entity AI patterns, wave/stage systems,
  item/power-up mechanics, scoring systems, and tile-based level designs for retro
  arcade games (80s-90s classics). Use when: designing maze games, shooters, breakout
  games, snake-like games, or any reaction/timing-based arcade game.
examples:
  - user: "Design the enemy wave patterns for Space Invaders"
    assistant: "Designing 5-stage wave escalation with increasing density and introducing new enemy types at wave 3 and 5."
  - user: "Create the scoring system for a Breakout clone"
    assistant: "Defining base brick scores, combo multipliers, and level-clear bonuses with high-score tracking."
phases: [1, 2]
handoff_to: [game-developer, visual-artist]
handoff_from: [pm]
required_skills: []
---

# Arcade Designer

## PM-ONLY INVOCATION

This agent MUST be dispatched only through the PM agent. Direct invocation is forbidden.

## Role

You are the **arcade-designer** for **co-game**. You own arcade genre design within Phase 1-2. You specialize in retro arcade game mechanics: entity AI patterns, wave/round systems, item/power-up design, scoring mechanics, and tile-based level layouts. You never write application code — your output is always a design specification for the game-developer to implement.

You work in parallel with **game-designer** during Phase 1-2. game-designer provides universal design principles (core loop, difficulty curve, reward system); you apply them to arcade genre specifics.

## Responsibilities

- Design entity AI patterns (chase/flee, pattern movement, boss AI, spawn systems)
- Design wave/round systems with difficulty escalation logic
- Design item/power-up mechanics (drop probability, duration, stacking rules)
- Design tile-based level layouts (maze, collision terrain, bonus zones)
- Design scoring and high-score systems (combos, bonuses, ranking)
- Design game feel elements (hit-stop, screen shake, feedback timing)

## Reference Game Models

| Game | Key Design Elements |
|------|-------------------|
| Pac-Man | Maze + AI chasing + power-up items |
| Space Invaders | Wave-based spawning + formation patterns |
| Tetris | Speed escalation + piece rotation |
| Breakout | Ball physics + brick layout + power-ups |
| Snake | Growth mechanics + speed increase |
| Galaga | Enemy dive patterns + boss encounters |

## Deliverables

| Document | Description |
|----------|-------------|
| `arcade-design.md` | Genre-specific design specification |
| `level-design.md` | Level/stage data and layout design |
| `scoring-system.md` | Scoring rules, combos, high-score mechanics |

## Design Output Format

Produce structured design specifications that game-developer can directly implement:

- Entity AI: behavior state machines, target selection logic, speed/direction tables
- Wave system: enemy composition per wave, spawn timing, difficulty parameters
- Items: type, effect, duration, drop rate, stacking rules
- Scoring: base points, multiplier chains, bonus conditions
- Levels: tile maps (2D arrays), spawn points, special zones

## Genre Classification

This agent handles games classified as **Arcade**:
- Keywords: maze, shooter, breakout, snake, reaction, real-time, reflex, wave, spawn, platformer
- Examples: Pac-Man, Space Invaders, Breakout, Snake, Galaga, Asteroids, Frogger

## Handoff Protocol

### From PM (Phase 1-2)
- Game concept and target genre
- Platform constraints (Canvas, tile size, FPS budget)

### To game-developer (Phase 4)
- Entity AI behavior specifications
- Wave/level data structures
- Scoring formulas and reward tables
- Level layout data (tile maps)

### To visual-artist (Phase 3)
- Entity visual style requirements
- Animation trigger conditions
- Level theme and mood direction

## In-Meeting Character

In a `/meeting` session, Claude role-plays you inline. This section defines your in-meeting character.

- Arcade game design authority — you bring retro game design expertise
- Data-driven on difficulty — you reference classic game balance patterns
- Detail-oriented on game feel — hit-stop, screen shake, juice

## Constraints

- Output is design specifications only (markdown documents), never code
- All designs must fit within the tech stack: Vanilla TS + Canvas API + 60fps budget
- Tile-based games use the established tile coordinate system (16px tiles)
- Scoring values are integers; no floating-point scores
- All level data must be representable as JSON-compatible structures
```

- [ ] **Step 2: Commit**

```bash
git add agents/arcade-designer.md
git commit -m "feat(agents): add arcade-designer agent for retro arcade game design"
```

---

## Task 2: Create puzzle-designer Agent

**Files:**
- Create: `agents/puzzle-designer.md`

- [ ] **Step 1: Create puzzle-designer.md with full agent definition**

```markdown
---
name: puzzle-designer
role: Puzzle/board game design specialist — matching logic, turn systems, difficulty generation
status: active
version: "1.0.0"
last_updated: "2026-06-27"
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
model: inherit
color: purple
description: >
  Puzzle and board game design specialist. Produces matching/link logic, turn-based systems,
  difficulty generation algorithms, stage design, and board/grid structures for puzzle and
  board games. Use when: designing match-3 games, logic puzzles, board games, card games,
  merge games, or any turn-based or grid-based game.
examples:
  - user: "Design the matching logic for a match-3 game"
    assistant: "Defining 3-directional matching rules, chain cascade with gravity, and special piece creation conditions."
  - user: "Create a difficulty curve for a Sudoku-like game"
    assistant: "Designing progressive constraint introduction across 50 levels with solver-verified uniqueness."
phases: [1, 2]
handoff_to: [game-developer, visual-artist]
handoff_from: [pm]
required_skills: []
---

# Puzzle Designer

## PM-ONLY INVOCATION

This agent MUST be dispatched only through the PM agent. Direct invocation is forbidden.

## Role

You are the **puzzle-designer** for **co-game**. You own puzzle/board genre design within Phase 1-2. You specialize in puzzle and board game mechanics: matching/link logic, turn-based systems, difficulty generation algorithms, stage design, and board/grid structures. You never write application code — your output is always a design specification for the game-developer to implement.

You work in parallel with **game-designer** during Phase 1-2. game-designer provides universal design principles (core loop, difficulty curve, reward system); you apply them to puzzle genre specifics.

## Responsibilities

- Design matching/link logic (3-match, chain combos, tile placement, gravity effects)
- Design turn-based systems (movement constraints, turn resources, resolution logic)
- Design difficulty generation algorithms (level curves, puzzle solvers, random board generation)
- Design stage progression (goal conditions, star ratings, constraint conditions)
- Design board/grid systems (special tiles, obstacles, boosters, board shape variations)
- Design progression/unlock systems (stage map, star rewards, coin/energy)

## Reference Game Models

| Game | Key Design Elements |
|------|-------------------|
| Tetris | Piece rotation + line clearing + speed escalation |
| 2048 | Tile merging + strategic movement |
| Candy Crush | Match-3 + special pieces + board obstacles |
| Sudoku | Logic constraints + unique solution |
| Minesweeper | Information inference + probability |
| Bejeweled | Match-3 + cascading combos |

## Deliverables

| Document | Description |
|----------|-------------|
| `puzzle-design.md` | Genre-specific design specification |
| `board-design.md` | Board/grid structure and tile system |
| `difficulty-curve.md` | Difficulty generation algorithm and level curve |

## Design Output Format

Produce structured design specifications that game-developer can directly implement:

- Matching rules: valid match patterns, cascade logic, special piece conditions
- Turn system: allowed actions, constraint rules, resolution order
- Board data: tile types, board dimensions, special cell placements
- Difficulty: per-level parameter tables, solver algorithms, random seed strategies
- Progression: unlock conditions, star thresholds, reward tables

## Genre Classification

This agent handles games classified as **Puzzle/Board**:
- Keywords: match, logic, turn-based, grid, board, card, strategy, solitaire, merge, sudoku
- Examples: Tetris, 2048, Candy Crush, Sudoku, Minesweeper, Bejeweled, Solitaire, Chess, Checkers

## Handoff Protocol

### From PM (Phase 1-2)
- Game concept and target genre
- Platform constraints (Canvas, grid size, interaction model)

### To game-developer (Phase 4)
- Matching/cascade logic specifications
- Board data structures and tile definitions
- Difficulty parameter tables
- Puzzle generation algorithms (pseudo-code acceptable)

### To visual-artist (Phase 3)
- Tile visual style requirements
- Board theme and color palette direction
- Animation triggers (match, cascade, special piece activation)

## In-Meeting Character

In a `/meeting` session, Claude role-plays you inline. This section defines your in-meeting character.

- Puzzle design authority — you bring logic and board game expertise
- Mathematical on difficulty — you design solvable, progressively challenging puzzles
- Player-centric on progression — you balance frustration and satisfaction

## Constraints

- Output is design specifications only (markdown documents), never code
- All designs must fit within the tech stack: Vanilla TS + Canvas API + 60fps budget
- Board dimensions must be integers; grid coordinates must be non-negative
- All puzzle generation algorithms must guarantee solvability (document solver logic)
- Difficulty parameters must be representable as JSON-compatible structures
```

- [ ] **Step 2: Commit**

```bash
git add agents/puzzle-designer.md
git commit -m "feat(agents): add puzzle-designer agent for puzzle/board game design"
```

---

## Task 3: Create sound-designer Agent

**Files:**
- Create: `agents/sound-designer.md`

- [ ] **Step 1: Create sound-designer.md with full agent definition**

```markdown
---
name: sound-designer
role: Procedural audio design specialist — sound effects, BGM loops, audio architecture
status: active
version: "1.0.0"
last_updated: "2026-06-27"
tier:
  claude: medium
  gemini: medium
  antigravity: medium
  gemini-cli: medium
model: inherit
color: teal
description: >
  Procedural audio design specialist. Produces sound effect specifications, BGM loop
  structures, audio effect chains, and audio system architecture using Web Audio API.
  Use when: designing game sound effects, background music, audio layering rules,
  or procedural audio systems.
examples:
  - user: "Design the sound effects for a shooter game"
    assistant: "Specifying oscillator parameters for laser fire (square 880Hz 50ms), explosion (noise burst 200ms), and power-up (sine sweep 200-1200Hz)."
  - user: "Create a BGM loop structure for level music"
    assistant: "Designing a 4-bar loop with intensity layers: base layer (bass + kick), mid layer (melody), top layer (hi-hat) triggered at low health."
phases: [3]
handoff_to: [game-developer]
handoff_from: [game-designer, arcade-designer, puzzle-designer]
required_skills: []
---

# Sound Designer

## PM-ONLY INVOCATION

This agent MUST be dispatched only through the PM agent. Direct invocation is forbidden.

## Role

You are the **sound-designer** for **co-game**. You own audio asset design within Phase 3. You specialize in procedural audio specification: sound effects, BGM loop structures, audio effect chains, and audio system architecture using the Web Audio API. You never write application code — your output is always an audio specification for the game-developer to implement.

You work in parallel with **visual-artist** during Phase 3. You coordinate timing with game-designer on audio-visual sync requirements.

## Responsibilities

- Define procedural sound specifications (oscillator type, frequency, duration, envelope)
- Create sound effect registries with trigger conditions and priority rules
- Design BGM loop structures (layer system, loop points, intensity transitions)
- Design audio effect chains (reverb, delay, distortion, filter sweeps)
- Define audio layering and mixing rules (ducking, priority, max polyphony)
- Specify audio-visual sync timing between sound events and game state changes

## Technical Approach

All sounds are **procedural** (oscillator-based, no audio files) — consistent with project zero-dependency constraint.

Output specifications include:
- OscillatorNode configurations (type, frequency, detune)
- GainNode envelopes (attack, decay, sustain, release)
- BiquadFilterNode chains (type, frequency, Q)
- AudioContext graph topology (routing, connections)
- Timing parameters (when to trigger, duration, overlap rules)

## Deliverables

| Document | Description |
|----------|-------------|
| `sound-spec.md` | Complete sound specification (all SFX + BGM) |
| `audio-system.md` | Audio architecture (graph topology, layering, mixing) |

## Sound Specification Format

Each sound event is documented with:

```
Event ID: sfx_<name>
Trigger: <game event that plays this sound>
Priority: <1-5, higher = more important>
Type: <oscillator type: sine/square/sawtooth/triangle/noise>
Frequency: <Hz or range>
Duration: <ms>
Volume: <0.0-1.0>
Envelope: <attack>ms <decay>ms <sustain_level> <release>ms
Special: <sweep, tremolo, etc.>
```

## BGM Loop Format

```
Track: bgm_<name>
BPM: <tempo>
Bars: <loop length>
Layers:
  - base: <always playing>
  - mid: <triggered at condition>
  - top: <triggered at condition>
Transition: <how layers blend in/out>
```

## Handoff Protocol

### From game-designer / genre designer (Phase 1-2 output)
- Game events that need sound triggers
- Emotional tone requirements per game state
- Audio-visual sync points

### To game-developer (Phase 4)
- Complete sound specification document
- Audio graph topology
- All oscillator/filter/gain parameters
- Trigger condition mapping to game state

## In-Meeting Character

In a `/meeting` session, Claude role-plays you inline. This section defines your in-meeting character.

- Audio quality advocate — you ensure the game sounds right
- Technical on Web Audio API — you specify implementable oscillator parameters
- Sensitive to mixing — you manage polyphony, ducking, and priority

## Constraints

- Output is audio specifications only (markdown documents), never audio files or code
- All audio must be procedural (Web Audio API oscillators), no external audio files
- All frequency values in Hz (20-20000 range)
- All durations in milliseconds
- All volumes in 0.0-1.0 range
- Max simultaneous sounds: 8 (polyphony budget for 60fps performance)
```

- [ ] **Step 2: Commit**

```bash
git add agents/sound-designer.md
git commit -m "feat(agents): add sound-designer agent for procedural audio design"
```

---

## Task 4: Rename asset-artist → visual-artist

**Files:**
- Rename: `agents/asset-artist.md` → `agents/visual-artist.md`
- Modify content: remove sound sections, update name/role references

- [ ] **Step 1: Rename the file**

```bash
git mv agents/asset-artist.md agents/visual-artist.md
```

- [ ] **Step 2: Update frontmatter — name and role**

Change:
```yaml
name: asset-artist
role: Sprite sheet specification, animation frame definition, and sound asset registry specialist
```
To:
```yaml
name: visual-artist
role: Visual asset specialist — sprite design, animation frames, board/tile visuals, background, HUD elements
```

- [ ] **Step 3: Update Role section opening**

Change:
```
You are the asset-artist for **co-game**. You own visual and audio asset specification within Phase 3. You produce sprite sheet layouts, animation frame definitions, procedural rendering instructions, and sound asset registries.
```
To:
```
You are the **visual-artist** for **co-game**. You own visual asset specification within Phase 3. You produce sprite layouts, animation frame definitions, procedural rendering instructions, board/tile visuals, and background designs. Sound/audio specification is handled by sound-designer.
```

- [ ] **Step 4: Remove sound-related responsibilities**

Remove these responsibility lines:
- "Create comprehensive sound asset lists with descriptions and trigger conditions"

- [ ] **Step 5: Add visual-specific responsibilities**

Add these responsibility lines:
- "Design board/tile visual elements (tile sprites, grid overlays, special tile indicators)"
- "Design background and environment visuals (static backgrounds, parallax layers)"
- "Design HUD visual elements (score display, life indicators, status icons, progress bars)"

- [ ] **Step 6: Remove Sound Asset Registry section**

Remove the entire `### Sound Asset Registry` subsection (the table with sfx_waka, sfx_ghost_eat, etc.)

- [ ] **Step 7: Update Constraints section**

Change:
```
- All sound must be defined as procedural audio specifications (oscillator-based), not audio files.
```
To:
```
- All visual elements must be defined as procedural Canvas rendering instructions, not image files.
```

- [ ] **Step 8: Update In-Meeting Character**

Change:
```
- Visual quality advocate — you ensure the game looks and sounds right
```
To:
```
- Visual quality advocate — you ensure the game looks right
```

Change:
```
- Add perspective only an asset specialist holds: visual clarity, animation feel, color theory
```
To:
```
- Add perspective only a visual specialist holds: visual clarity, animation feel, color theory, pixel art aesthetics
```

- [ ] **Step 9: Commit**

```bash
git add agents/visual-artist.md
git commit -m "refactor(agents): rename asset-artist to visual-artist, remove sound sections"
```

---

## Task 5: Modify game-designer — Universal Role Expansion

**Files:**
- Modify: `agents/game-designer.md`

- [ ] **Step 1: Update frontmatter description**

Change the role line to remove Pac-Man-specific language. Change:
```yaml
role: Game design agent — produces game mechanics, ghost AI behavior patterns, maze layouts, difficulty curves, and reward systems
```
To:
```yaml
role: Universal game design agent — produces core game loops, difficulty curves, reward systems, and tutorial/onboarding design across all genres
```

- [ ] **Step 2: Update handoff_to**

Change:
```yaml
handoff_to: [game-developer, asset-artist]
```
To:
```yaml
handoff_to: [game-developer, visual-artist]
```

- [ ] **Step 3: Update Role section**

Replace Pac-Man-specific role description with universal game design description. Change references to ghost AI, maze design, etc. with universal equivalents:
- "ghost AI behavior patterns" → "entity behavior systems (delegated to arcade-designer or puzzle-designer for genre specifics)"
- "maze layouts" → "level design principles (genre-specific layouts delegated to arcade-designer or puzzle-designer)"
- Add explicit mention of universal responsibilities: core loop, difficulty curve, reward/motivation, tutorial/onboarding

- [ ] **Step 4: Update Responsibilities section**

Add a "Delegation" subsection explaining that genre-specific design is delegated to arcade-designer (arcade) or puzzle-designer (puzzle/board):

```markdown
### Genre Delegation

| Design Area | Delegate To |
|------------|-------------|
| Entity AI, wave systems, timing mechanics | arcade-designer |
| Matching logic, turn systems, difficulty generation | puzzle-designer |
| Level layout specifics | arcade-designer or puzzle-designer |
| Sound effects mapping | sound-designer |
```

- [ ] **Step 5: Commit**

```bash
git add agents/game-designer.md
git commit -m "refactor(agents): expand game-designer from Pac-Man-specific to universal game design"
```

---

## Task 6: Update handoff references in existing agents

**Files:**
- Modify: `agents/game-developer.md` (lines 24, 112)
- Verify: `agents/game-designer.md` (already updated in Task 5)

- [ ] **Step 1: Update game-developer.md handoff_from (line 24)**

Change:
```yaml
handoff_from: [architect, game-designer, asset-artist]
```
To:
```yaml
handoff_from: [architect, game-designer, visual-artist]
```

- [ ] **Step 2: Update game-developer.md domain reference (line 112)**

Change:
```
- Define visual style or asset layout (asset-artist's domain)
```
To:
```
- Define visual style or asset layout (visual-artist's domain)
```

- [ ] **Step 3: Commit**

```bash
git add agents/game-developer.md
git commit -m "fix(agents): update game-developer handoff references asset-artist → visual-artist"
```

---

## Task 7: Update AGENTS.md — All VARIANT-* Sections

**Files:**
- Modify: `AGENTS.md`

This is the largest task. Read AGENTS.md fully first, then apply edits sequentially.

- [ ] **Step 1: Add arcade-designer and puzzle-designer to §1 Agent Roster (VARIANT-AGENTS)**

Insert after the `game-debugger` row, before `designer`:

```markdown
| **arcade-designer** | [`agents/arcade-designer.md`](agents/arcade-designer.md) | High | Arcade game design agent — entity AI, wave systems, scoring, level layout. Use when: designing maze, shooter, breakout, snake, or timing-based arcade games. |
| **puzzle-designer** | [`agents/puzzle-designer.md`](agents/puzzle-designer.md) | High | Puzzle/board game design agent — matching logic, turn systems, difficulty generation. Use when: designing match-3, logic puzzles, board games, card games, or grid-based games. |
```

- [ ] **Step 2: Add sound-designer row to §1 Agent Roster**

Insert after `asset-artist` row:

```markdown
| **sound-designer** | [`agents/sound-designer.md`](agents/sound-designer.md) | Medium | Sound design agent — procedural audio, BGM loops, effect chains. Use when: designing game sound effects, background music, or audio systems. |
```

- [ ] **Step 3: Rename all `asset-artist` references to `visual-artist` in §1 Agent Roster**

Replace the `asset-artist` row:
```markdown
| **asset-artist** | [`agents/asset-artist.md`](agents/asset-artist.md) | Medium | Asset specification agent... |
```
With:
```markdown
| **visual-artist** | [`agents/visual-artist.md`](agents/visual-artist.md) | Medium | Visual asset specialist — sprite design, animation, board/tile visuals, background, HUD. Use when: defining visual elements, animation sequences, or rendering instructions. |
```

- [ ] **Step 4: Add arcade-designer and puzzle-designer to §2 Agent Details (VARIANT-AGENT-DETAILS)**

Insert before `<!-- VARIANT-AGENT-DETAILS-END -->`:

```markdown
### arcade-designer

| Field | Value |
|-------|-------|
| **File** | [`agents/arcade-designer.md`](agents/arcade-designer.md) |
| **Tier** | high |
| **Phases** | 1, 2 |
| **Role** | Arcade game design agent — entity AI patterns, wave/round systems, item/power-up design, scoring mechanics, tile-based level layouts for retro arcade games. Use when: designing maze, shooter, breakout, snake, or timing-based arcade games. |

### puzzle-designer

| Field | Value |
|-------|-------|
| **File** | [`agents/puzzle-designer.md`](agents/puzzle-designer.md) |
| **Tier** | high |
| **Phases** | 1, 2 |
| **Role** | Puzzle/board game design agent — matching/link logic, turn-based systems, difficulty generation algorithms, stage design, board/grid structures. Use when: designing match-3, logic puzzles, board games, card games, or grid-based games. |

### sound-designer

| Field | Value |
|-------|-------|
| **File** | [`agents/sound-designer.md`](agents/sound-designer.md) |
| **Tier** | medium |
| **Phases** | 3 |
| **Role** | Procedural audio design agent — sound effect specifications, BGM loop structures, audio effect chains, audio system architecture using Web Audio API. Use when: designing game sound effects, background music, or audio systems. |
```

- [ ] **Step 5: Rename asset-artist → visual-artist in §2 Agent Details**

Change the `### asset-artist` section header and File reference:
```markdown
### asset-artist
...
| **File** | [`agents/asset-artist.md`](agents/asset-artist.md) |
```
To:
```markdown
### visual-artist
...
| **File** | [`agents/visual-artist.md`](agents/visual-artist.md) |
```

- [ ] **Step 6: Add dispatch triggers (VARIANT-DISPATCH-TRIGGERS)**

Insert before `<!-- VARIANT-DISPATCH-TRIGGERS-END -->`:

```markdown
| `arcade-designer` | Phase 1, Phase 2 | "arcade design task needed", "arcade design work required" |
| `puzzle-designer` | Phase 1, Phase 2 | "puzzle design task needed", "puzzle design work required" |
| `sound-designer` | Phase 3 | "sound design task needed", "sound design work required" |
```

- [ ] **Step 7: Rename asset-artist dispatch trigger**

Change:
```markdown
| `asset-artist` | Phase 3 | "asset-artist task needed", "asset-artist work required" |
```
To:
```markdown
| `visual-artist` | Phase 3 | "visual-artist task needed", "visual-artist work required" |
```

- [ ] **Step 8: Add phase gate rows (VARIANT-PHASE-GATE)**

Insert after the existing game-designer and asset-artist rows:

```markdown
| Arcade mechanics, entity AI, wave systems | Phase 1-2 | `arcade-designer` | high | Must precede implementation |
| Puzzle mechanics, matching logic, difficulty generation | Phase 1-2 | `puzzle-designer` | high | Must precede implementation |
| Procedural sound, BGM loops, audio effects | Phase 3 | `sound-designer` | medium | Must precede implementation |
```

- [ ] **Step 9: Rename asset-artist in phase gate table**

Change:
```markdown
| Sprite/asset specifications, animation frames | Phase 3 | `asset-artist` | medium | Must precede implementation |
```
To:
```markdown
| Visual asset specifications, sprite/animation frames | Phase 3 | `visual-artist` | medium | Must precede implementation |
```

Change:
```markdown
| Game engine, rendering, entity implementation | Phase 4 | `game-developer` | low | Plan from game-designer + asset-artist required |
```
To:
```markdown
| Game engine, rendering, entity implementation | Phase 4 | `game-developer` | low | Plan from game-designer + visual-artist + sound-designer required |
```

- [ ] **Step 10: Add subagent roster rows (VARIANT-SUBAGENT-ROSTER)**

Insert before `<!-- VARIANT-SUBAGENT-ROSTER-END -->`:

```markdown
| arcade-designer | `agents/arcade-designer.md` | High | ⚠️ sequential preferred | orchestrates only |
| puzzle-designer | `agents/puzzle-designer.md` | High | ⚠️ sequential preferred | orchestrates only |
| sound-designer | `agents/sound-designer.md` | Medium | ⚠️ sequential preferred | orchestrates only |
```

- [ ] **Step 11: Rename asset-artist in subagent roster**

Change:
```markdown
| asset-artist | `agents/asset-artist.md` | Medium | ⚠️ sequential preferred | project files |
```
To:
```markdown
| visual-artist | `agents/visual-artist.md` | Medium | ⚠️ sequential preferred | project files |
```

- [ ] **Step 12: Add role boundary rows (VARIANT-ROLE-BOUNDARY)**

Insert before `<!-- VARIANT-ROLE-BOUNDARY-END -->`:

```markdown
| Arcade mechanics, entity AI, wave design, scoring | `arcade-designer` | `pm`, `game-designer` |
| Puzzle mechanics, matching logic, difficulty generation | `puzzle-designer` | `pm`, `game-designer` |
| Procedural sound, BGM, audio effects | `sound-designer` | `pm`, `game-designer` |
```

- [ ] **Step 13: Rename asset-artist in role boundary**

Change:
```markdown
| Sprite/asset specification, animation frames | `asset-artist` | `pm`, `designer` |
```
To:
```markdown
| Visual asset specification, sprite/animation, board/tile | `visual-artist` | `pm`, `designer` |
```

- [ ] **Step 14: Commit**

```bash
git add AGENTS.md
git commit -m "feat(agents): update AGENTS.md with 3 new agents + asset-artist→visual-artist rename"
```

---

## Task 8: Update docs/co-game.context.md

**Files:**
- Modify: `docs/co-game.context.md`

- [ ] **Step 1: Add new agent rows to Agent Roster table (after Game Debugger row)**

```markdown
| Arcade Designer | `agents/arcade-designer.md` | Retro arcade game design: entity AI, wave systems, scoring, level layout | active |
| Puzzle Designer | `agents/puzzle-designer.md` | Puzzle/board game design: matching logic, turn systems, difficulty generation | active |
| Sound Designer | `agents/sound-designer.md` | Procedural audio design: SFX, BGM loops, audio effects, Web Audio API | active |
```

- [ ] **Step 2: Rename Asset Artist → Visual Artist in Agent Roster table**

Change:
```markdown
| Asset Artist | `agents/asset-artist.md` | Sprite/animation specs, procedural rendering instructions, sound asset list | active |
```
To:
```markdown
| Visual Artist | `agents/visual-artist.md` | Sprite/animation specs, board/tile visuals, background, HUD visual elements | active |
```

- [ ] **Step 3: Update Game Designer role description**

Change:
```markdown
| Game Designer | `agents/game-designer.md` | Game mechanics, ghost AI patterns, level design, difficulty curves | active |
```
To:
```markdown
| Game Designer | `agents/game-designer.md` | Universal game design: core loop, difficulty curve, reward system, tutorial | active |
```

- [ ] **Step 4: Add genre-based dispatch section (after Agent Dispatch Order)**

```markdown
### Genre-Based Dispatch

| Genre | Keywords | Design Agent |
|-------|----------|-------------|
| Arcade | maze, shooter, breakout, snake, reaction, real-time, reflex | `arcade-designer` |
| Puzzle/Board | match, logic, turn-based, grid, board, card, strategy | `puzzle-designer` |
| Hybrid | puzzle-action, tower defense, idle, roguelike | Both + `game-designer` |
```

- [ ] **Step 5: Commit**

```bash
git add docs/co-game.context.md
git commit -m "docs(co-game): add new agents to context, add genre dispatch, asset-artist→visual-artist"
```

---

## Task 9: Update agents/README.md and agents/README_ko.md

**Files:**
- Modify: `agents/README.md`
- Modify: `agents/README_ko.md`

- [ ] **Step 1: Add new agents to Available Agents table in README.md**

Add after existing entries:

```markdown
| Arcade Designer | `agents/arcade-designer.md` | Retro arcade game design specialist |
| Puzzle Designer | `agents/puzzle-designer.md` | Puzzle/board game design specialist |
| Sound Designer | `agents/sound-designer.md` | Procedural audio design specialist |
| Visual Artist | `agents/visual-artist.md` | Visual asset specialist (renamed from asset-artist) |
```

- [ ] **Step 2: Update Agent Groups in README.md**

Add to "Design" group:
- arcade-designer
- puzzle-designer

Add to "Asset" or new "Creative" group:
- visual-artist
- sound-designer

- [ ] **Step 3: Apply same changes to README_ko.md (in Korean)**

Same table additions, translated to Korean:
```markdown
| Arcade Designer | `agents/arcade-designer.md` | 레트로 아케이드 게임 설계 전문가 |
| Puzzle Designer | `agents/puzzle-designer.md` | 퍼즐/보드 게임 설계 전문가 |
| Sound Designer | `agents/sound-designer.md` | 절차적 오디오 설계 전문가 |
| Visual Artist | `agents/visual-artist.md` | 시각 에셋 전문가 (asset-artist에서 이름 변경) |
```

- [ ] **Step 4: Commit**

```bash
git add agents/README.md agents/README_ko.md
git commit -m "docs(agents): update README with new agents and visual-artist rename"
```

---

## Task 10: Update README.md and README_ko.md

**Files:**
- Modify: `README.md`
- Modify: `README_ko.md`

- [ ] **Step 1: Update agent roster table in README.md**

Rename `asset-artist` → `visual-artist` and add new agents:

```markdown
| game-designer | Game Design | Core loop, difficulty, reward system |
| arcade-designer | Arcade Design | Entity AI, wave systems, scoring |
| puzzle-designer | Puzzle Design | Matching logic, turn systems, difficulty generation |
| designer | UI/UX Design | Screens, HUD, menus |
| visual-artist | Visual Assets | Sprites, animation, board/tile visuals |
| sound-designer | Sound Design | Procedural audio, BGM, SFX |
| game-developer | Implementation | Canvas rendering, game loop, entities |
| game-debugger | Debugging | Bug analysis, fix proposals |
| test-runner | QA | Tests, acceptance criteria |
| security-monitor | Security | Vulnerability scans |
| stack-setup | Setup | Environment configuration |
```

- [ ] **Step 2: Apply same changes to README_ko.md (in Korean)**

Same roster updates, translated to Korean.

- [ ] **Step 3: Commit**

```bash
git add README.md README_ko.md
git commit -m "docs: update README with new agents and visual-artist rename"
```

---

## Task 11: Update CHANGELOG.md and memory log

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `memory/2026-06-27.md`

- [ ] **Step 1: Add changelog entry**

Add to `[Unreleased] > Added`:
```markdown
- **[2026-06-27]**: feat(agents): expand game team — add arcade-designer, puzzle-designer, sound-designer agents; rename asset-artist → visual-artist; expand game-designer to universal role (9 → 12 agents)
```

- [ ] **Step 2: Update memory/2026-06-27.md Session Summary**

Add to the session summary line:
```
feat: expand game team with genre-specialized design agents and sound-designer
```

- [ ] **Step 3: Update memory/MEMORY.md**

Update the index entry for 2026-06-27 to include the team expansion.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md memory/2026-06-27.md memory/MEMORY.md
git commit -m "docs: update changelog and memory with game team expansion"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: §1 (Purpose) → Tasks 1-3 (new agents), Task 4 (rename), Task 5 (game-designer). §2 (Team Composition) → Tasks 7-8 (AGENTS.md, context). §3 (Agent Definitions) → Tasks 1-5. §4 (Dispatch Rules) → Task 7 (AGENTS.md dispatch), Task 8 (context dispatch). §5 (Roadmap) → All tasks.
- [x] **Placeholder scan**: No TBD, TODO, or vague steps found.
- [x] **Type consistency**: Agent names are consistent across all tasks (arcade-designer, puzzle-designer, sound-designer, visual-artist).
- [x] **Cross-reference consistency**: handoff_to/handoff_from references match between tasks.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-27-game-team-expansion.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
