# Pac-Man — UI/UX Specification

**Date**: 2026-06-27
**Author**: designer
**Phase**: 3

---

## 1. Screen Specifications

### 1.1 Start Screen (GameState.MENU)

- Full canvas showing classic maze outline (walls only, no dots), "PAC-MAN" title at top center
- "PRESS ENTER TO START" blinking text below maze (500ms on / 500ms off)
- "1UP" with score at bottom-left, "HIGH SCORE" at bottom-right

| Element | x | y | Color | Font |
|---------|---|---|-------|------|
| "PAC-MAN" title | centered (~144) | 96 | #FFFF00 | 16px 'Press Start 2P' |
| Maze outline (walls only) | 0 | 16 | #2121DE | MazeRenderer |
| "1UP" label | 8 | 484 | #FFFFFF | 8px monospace |
| Score value | 32 | 484 | #FFFFFF | 8px monospace |
| "HIGH SCORE" | 200 | 484 | #FFFFFF | 8px monospace |
| High score value | 320 | 484 | #FFFFFF | 8px monospace |
| "PRESS ENTER TO START" | centered (~96) | 460 | #FFFFFF | 10px, blinking |

### 1.2 Playing Screen (GameState.PLAYING)

| Element | x | y | Color | Font |
|---------|---|---|-------|------|
| HUD bar background | 0 | 0 | #000000 | 448×16 rect |
| "1UP" | 4 | 2 | #FFFFFF | 8px monospace |
| Score value (6-digit padded) | 28 | 2 | #FFFFFF | 8px monospace |
| "HIGH SCORE" | 148 | 2 | #FFFFFF | 8px monospace |
| High score value | 220 | 2 | #FFFFFF | 8px monospace |
| "STAGE" | 392 | 2 | #FFFFFF | 8px monospace |
| Stage number | 428 | 2 | #FFFFFF | 8px monospace |
| Maze area origin | 0 | 16 | — | Full 448×464 |
| Lives icon 1 (extra life) | 9 | 489 | #FFFF00 | 10px circle |
| Lives icon 2 | 25 | 489 | #FFFF00 | 10px circle |
| Lives icon 3 | 41 | 489 | #FFFF00 | 10px circle |

Lives icons represent EXTRA lives. Display count = max(0, lives - 1). Max 5 displayed.

### 1.3 Pause Overlay (GameState.PAUSED)

- Semi-transparent overlay: rgba(0,0,0,0.7) over frozen frame
- "PAUSED" at (160, 230), 12px white monospace, centered
- "PRESS P TO RESUME" at (104, 256), 8px white monospace, centered

### 1.4 Death Sequence (GameState.DYING)

- Duration: 1500ms
- Animation: Pac-Man arc shrinks clockwise (mouth opens 30° → 240° over 8 frames at ~187ms each)
- All ghosts freeze. Maze and HUD remain visible.
- Post-animation: 2000ms pause if lives > 0 (respawn), 500ms if lives = 0 (game over)

```typescript
const progress = elapsed / 1500;
const mouthAngle = progress * Math.PI * 2;
const startAngle = mouthAngle;
const endAngle = Math.PI * 2 - mouthAngle;
```

### 1.5 Game Over Screen (GameState.GAME_OVER)

- Maze walls only (no dots/pellets/entities)
- "GAME OVER" at arcade position: y = 16 + 17×16 = 288, centered, #FF0000, 16px
- Final score below at y = 308, white 8px
- "PRESS ENTER TO RESTART" appears 3000ms after entry, blinking, at y = 336

### 1.6 Level Complete (GameState.LEVEL_COMPLETE)

- Maze walls flash blue (#2121DE) / white (#FFFFFF) every 250ms for 1000ms total
- "STAGE CLEAR!" appears at 500ms mark, centered, white 12px
- No entities rendered during flash

---

## 2. Font and Typography

- Primary: `'Press Start 2P', monospace` (Google Fonts, loaded via <link>)
- Fallback: `'Courier New', monospace` → `monospace`
- Font loading: `document.fonts.ready` with 3s timeout fallback
- Sizes: Title 16px, HUD 8px, Overlay 12px, Blink 10px, Score popup 8px
- Alignment: `ctx.textAlign = 'left'`, centered via manual calculation
- Score format: 6-digit zero-padded

---

## 3. Color Palette

| Element | Hex |
|---------|-----|
| Background | #000000 |
| Pac-Man body | #FFFF00 |
| Maze walls | #2121DE |
| Dots / Pellets | #FFFFFF |
| Blinky | #FF0000 |
| Pinky | #FFB8FF |
| Inky | #00FFFF |
| Clyde | #FFB852 |
| Frightened ghost | #2121DE |
| Fright flash | #FFFFFF |
| Ghost eyes white | #FFFFFF |
| Ghost pupils | #2121DE |
| HUD text | #FFFFFF |
| "GAME OVER" text | #FF0000 |
| Score popup | #00FFFF |
| Ghost house door | #FFB8FF |
| Pause overlay | rgba(0,0,0,0.7) |

---

## 4. Rendering Pipeline (Draw Order, back to front)

1. Clear canvas (black)
2. HUD bar background (y: 0-16)
3. HUD text (scores, stage)
4. Maze walls (blue outlines)
5. Dots (white circles, r=2px)
6. Power pellets (white circles, r=5-7px, pulsing)
7. Fruit (at spawn point)
8. Ghosts (Blinky, Pinky, Inky, Clyde)
9. Pac-Man
10. Lives icons (bottom bar)
11. Score popups (floating text)

State-specific modifications:
- MENU: Steps 1-2 + walls-only + title + blink text
- PAUSED: All steps + overlay + text
- DYING: Steps 1-3,5,6,7 + death animation (ghosts frozen but rendered)
- GAME_OVER: Steps 1-2 + walls-only + text
- LEVEL_COMPLETE: Steps 1-2 + flashing walls + "STAGE CLEAR!"

---

## 5. Screen Transitions

| From | Trigger | To | Duration |
|------|---------|----|----|
| MENU | Enter | PLAYING | Instant |
| PLAYING | P/Escape | PAUSED | Instant |
| PAUSED | P/Escape | PLAYING | Instant |
| PLAYING | Ghost hit | DYING | 1500ms anim |
| DYING | Lives > 0 | PLAYING | 2000ms pause |
| DYING | Lives = 0 | GAME_OVER | 500ms pause |
| PLAYING | All dots eaten | LEVEL_COMPLETE | 1000ms flash |
| LEVEL_COMPLETE | Done | PLAYING | Instant (new stage) |
| GAME_OVER | Enter (after 3s) | MENU | Instant |

---

## 6. Accessibility — Multi-Modal Signaling

Critical game states must be communicated through at least 2 modalities to ensure
players with disabilities (color blindness, hearing impairment, cognitive differences)
can perceive all state changes. This section defines the required signaling for each
critical game state across Visual (non-color), Auditory, and Haptic (future) channels.

### 6.1 Core Principles

- **No color-only signaling**: No game state may be communicated by color alone
- **Redundant cues**: Every critical state requires ≥2 modalities
- **WCAG AA minimum**: All text contrast ratios ≥ 4.5:1 (already met per §3 Color Palette)
- **No rapid strobing**: Max flash rate 500ms on/off = 1Hz (PSE-safe)
- **Keyboard-only navigation**: Arrow/WASD, Enter, P/Escape

### 6.2 Multi-Modal Signaling Table

| Game State | Visual (Non-Color) | Auditory | Haptic (Future) |
|-----------|-------------------|----------|-----------------|
| **Ghost Chase Mode** | Ghosts actively pursue Pac-Man (movement pattern visible) | Siren sound (sawtooth 80-120 Hz, continuous) | — |
| **Frightened Mode — Active** | Ghost shape changes (squiggly mouth outline), reduced movement speed | Frightened mode ambient tone (if implemented), existing waka sounds continue | — |
| **Frightened Mode — Warning** (last 2s) | Ghost body flashes blue↔white (shape-preserving, not just color) | Flash sound: tone pitch rises/falls alternating each 200ms | Vibration pulse (200ms interval) |
| **Power Pellet Active** | HUD indicator: "POWER" text appears near score, flashing white | Power-up sound (sine sweep 200→800 Hz, 300ms) | Single haptic pulse on activation |
| **Ghost Eaten** | Ghost becomes eyes-only (no body rendered), eyes move quickly toward ghost house | Ghost-eat sound (sine sweep 800→1200 Hz, 400ms) | — |
| **Extra Life Awarded** | HUD flash: life counter increments with brief white flash overlay, +1UP text popup | Extra life jingle (ascending arpeggio, ~500ms) | Haptic burst pattern |
| **Game Over** | Screen darkens (semi-transparent overlay), "GAME OVER" text appears (red, 16px), maze walls remain visible | Game over sound (descending G-E-C, 2000ms) | Long vibration (500ms) |
| **Death** | Pac-Man death animation (arc shrinks clockwise, all ghosts freeze) | Death sound (descending square sweep 500→100 Hz, 1500ms) | — |
| **Level Complete** | Maze walls flash blue/white (250ms interval, 1000ms total), "STAGE CLEAR!" text | Level-up sound (ascending C-E-G-C arpeggio, 800ms) | Haptic pattern (3 short pulses) |
| **Pause** | Semi-transparent black overlay (rgba(0,0,0,0.7)), "PAUSED" text centered | No sound (intentional silence signals pause) | — |

### 6.3 Ghost Differentiation (Color-Independent)

Ghosts must be distinguishable without relying on color perception:

| Ghost | Non-Color Identifier | Position Bias | Behavior Pattern |
|-------|---------------------|---------------|-----------------|
| Blinky | Most aggressive (closest to Pac-Man) | Outside ghost house at start | Direct chase |
| Pinky | Ambush position (4 tiles ahead) | Center of ghost house | Targets ahead of Pac-Man |
| Inky | Flanking pattern (uses Blinky as pivot) | Left side of ghost house | Unpredictable flanking |
| Clyde | Shy behavior (retreats when close) | Right side of ghost house | Alternates chase/scatter |

### 6.4 Future Enhancements

- **Haptic feedback**: Vibration API for mobile/touch devices (pattern definitions in table above)
- **Screen reader announcements**: ARIA live regions for score changes, game state transitions
- **High-contrast mode**: Toggle that increases outline thickness and adds text shadows

---

## 8. UI Screen Lifecycle Contracts

Each UI screen has a formal lifecycle contract defining its entry/exit conditions,
input handling rules, and relationship to the game loop. These contracts ensure
consistent behavior across implementation and prevent state-transition bugs.

### 8.1 StartScreen (GameState.MENU)

| Phase | Behavior |
|-------|----------|
| **ENTRY** | Game initialization complete; canvas allocated; AudioContext created (or deferred to first user interaction) |
| **ACTIVE** | Renders static maze outline (walls only), "PAC-MAN" title, "PRESS ENTER TO START" blinking text, "1UP" with score, "HIGH SCORE" |
| **EXIT** | Enter key pressed → transition to PLAYING state; all input buffers cleared |
| **Input Handling** | **Enter / Space** only — all other keys ignored (including arrow keys and P/Escape) |
| **Game Loop** | **Paused** — no entity updates, no collision checks, no timer advancement. Renderer draws static frame only. |
| **Audio** | No siren. Optional intro jingle on entry. |

### 8.2 PauseOverlay (GameState.PAUSED)

| Phase | Behavior |
|-------|----------|
| **ENTRY** | P or Escape pressed during PLAYING state; all input buffers cleared; game loop frozen at current tick |
| **ACTIVE** | Renders frozen last frame with semi-transparent overlay (rgba(0,0,0,0.7)); "PAUSED" text centered at (160, 230), 12px white; "PRESS P TO RESUME" at (104, 256), 8px white |
| **EXIT** | P or Escape pressed → transition back to PLAYING state; game loop resumes from frozen tick (no time skip) |
| **Input Handling** | **P / Escape** only — all other keys ignored. Arrow keys buffered on resume. |
| **Game Loop** | **Frozen** — no entity updates, no collision checks, accumulator preserved. `requestAnimationFrame` continues for render (keeps overlay visible). |
| **Audio** | Siren paused (not stopped — resumes from current position on unpause). |

### 8.3 DeathSequence (GameState.DYING)

| Phase | Behavior |
|-------|----------|
| **ENTRY** | Ghost collision in SCATTER/CHASE mode; game loop continues but entities (except Pac-Man) freeze; lives decremented immediately |
| **ACTIVE** | Pac-Man death animation plays (8 frames, ~1500ms total); maze and HUD remain visible; ghosts frozen in place |
| **EXIT** | Animation timer expires → if `lives > 0`: brief pause (2000ms) then transition to PLAYING (respawn); if `lives === 0`: brief pause (500ms) then transition to GAME_OVER |
| **Input Handling** | **None accepted** — all input ignored during animation and pause |
| **Game Loop** | **Partial** — game loop runs for animation timing only. No entity updates (ghosts frozen), no collision checks, no score changes. Accumulator capped. |
| **Audio** | Death sound plays (1500ms). Siren stopped on entry. |

### 8.4 GameOverScreen (GameState.GAME_OVER)

| Phase | Behavior |
|-------|----------|
| **ENTRY** | Death animation completes with `lives === 0`; high score saved if applicable |
| **ACTIVE** | Maze walls only (no dots/pellets/entities); "GAME OVER" at arcade position (centered, red, 16px); final score below (white, 8px); "PRESS ENTER TO RESTART" appears **3000ms after entry**, blinking |
| **EXIT** | Enter key pressed (only after 3000ms cooldown) → full game reset → MENU state |
| **Input Handling** | **Enter / Space** only — ignored for first 3000ms (cooldown period). All other keys always ignored. |
| **Game Loop** | **Stopped** — no entity updates, no collision checks, no timer advancement. Renderer draws static frame. |
| **Audio** | Game over sound plays (2000ms). No siren. No ambient audio. |

### 8.5 LevelCompleteOverlay (GameState.LEVEL_COMPLETE)

| Phase | Behavior |
|-------|----------|
| **ENTRY** | Last dot/pellet collected; game loop continues for animation timing |
| **ACTIVE** | Maze walls flash blue↔white (250ms interval, 1000ms total); "STAGE CLEAR!" appears at 500ms mark, centered, white 12px; no entities rendered during flash |
| **EXIT** | Flash timer expires → transition to PLAYING with next stage (StageManager increments stage, entities reset) |
| **Input Handling** | **None accepted** — all input ignored |
| **Game Loop** | **Partial** — game loop runs for animation timing. No entity updates, no collision checks. Flash animation driven by elapsed time, not tick count. |
| **Audio** | Level-up sound plays (800ms). Siren stopped on entry. |

### 8.6 State Transition Summary

```
MENU ──[Enter]──→ PLAYING          (all buffers cleared)
PLAYING ──[P/Esc]──→ PAUSED         (frozen loop, siren paused)
PAUSED ──[P/Esc]──→ PLAYING         (resumed loop, siren resumed)
PLAYING ──[ghost hit]──→ DYING       (freeze entities, death anim)
DYING ──[lives>0]──→ PLAYING        (2000ms pause, respawn)
DYING ──[lives=0]──→ GAME_OVER      (500ms pause)
PLAYING ──[all dots]──→ LEVEL_COMPLETE (flash animation)
LEVEL_COMPLETE ──[done]──→ PLAYING   (next stage)
GAME_OVER ──[Enter, 3s cooldown]──→ MENU  (full reset)
```

**Invariant**: At most one UI screen is active at any time. No nested overlays.

---

## 7. Acceptance Criteria

- [ ] All screens have exact pixel coordinates
- [ ] HUD layout matches classic arcade
- [ ] Color palette consistent across all specs
- [ ] All screen transitions specified with durations
- [ ] Font fallback chain defined
- [ ] Blink animation 500ms on/off
- [ ] Death animation algorithm with timing
- [ ] Level complete flash 250ms cycle, 1s total
- [ ] Score formatting: 6-digit zero-padded
- [ ] Rendering pipeline draw order correct
