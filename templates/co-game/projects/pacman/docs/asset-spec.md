# Pac-Man — Asset Specification

**Date**: 2026-06-27
**Author**: asset-artist
**Phase**: 3

---

## 1. Pac-Man Sprite Specification

### 1.1 Directional Frames

| Frame | Direction | Mouth Angle | Description |
|-------|-----------|:---:|-------------|
| 0 | RIGHT | 30° | arc: -PI/6 to PI/6 |
| 1 | RIGHT | 0° | Full circle |
| 0 | LEFT | 30° | arc: 5PI/6 to 7PI/6 |
| 1 | LEFT | 0° | Full circle |
| 0 | UP | 30° | arc: PI/3 to 2PI/3 |
| 1 | UP | 0° | Full circle |
| 0 | DOWN | 30° | arc: 4PI/3 to 5PI/3 |
| 1 | DOWN | 0° | Full circle |

Mouth animation: 2 frames alternate at 100ms per frame (200ms cycle).

### 1.2 Death Animation (8 frames, ~187ms each = 1500ms total)

| Frame | Mouth Opening | Start Angle | End Angle |
|:-----:|:---:|:---:|:---:|
| 0 | 30° | -30° | 30° |
| 1 | 60° | -60° | 60° |
| 2 | 90° | -90° | 90° |
| 3 | 120° | -120° | 120° |
| 4 | 150° | -150° | 150° |
| 5 | 180° | -180° | 180° |
| 6 | 210° | -210° | 210° |
| 7 | 240° | -240° | 240° |

Rendering:
```typescript
const progress = elapsed / 1500;
const mouthHalf = (30 + frame * 30) * (Math.PI / 180);
ctx.arc(x, y, radius, -mouthHalf, mouthHalf, false);
ctx.lineTo(x, y);
```

### 1.3 Procedural Rendering

```typescript
function drawPacman(ctx, x, y, direction, frame, size = 16): void {
  const radius = size / 2;
  ctx.fillStyle = '#FFFF00';
  ctx.beginPath();
  if (frame === 0) {
    // Open mouth based on direction
    switch(direction) {
      case RIGHT: ctx.arc(x, y, radius, -Math.PI/6, Math.PI/6, false); break;
      case LEFT:  ctx.arc(x, y, radius, 5*Math.PI/6, 7*Math.PI/6, false); break;
      case UP:    ctx.arc(x, y, radius, Math.PI/3, 2*Math.PI/3, false); break;
      case DOWN:  ctx.arc(x, y, radius, 4*Math.PI/3, 5*Math.PI/3, false); break;
    }
    ctx.lineTo(x, y);
  } else {
    ctx.arc(x, y, radius, 0, Math.PI * 2, false);
  }
  ctx.closePath();
  ctx.fill();
}
```

---

## 2. Ghost Sprite Specification

### 2.1 Body Shape

- Dome (top semicircle, radius=7px) + rectangular body + wavy bottom (3 waves, depth=3px)
- Overall: 14×14px within 16px tile (1px margin each side)
- Dome center offset: y - 2

### 2.2 Procedural Rendering

```typescript
function drawGhostBody(ctx, x, y, color, size = 16, frame = 0): void {
  const radius = size / 2 - 1; // 7px
  const domeY = y - 2;
  const bodyBottom = y + radius;
  const waveDepth = 3;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, domeY, radius, Math.PI, 0, false); // dome
  ctx.lineTo(x + radius, bodyBottom); // right side
  // 3 waves from right to left
  const waveWidth = (radius * 2) / 3;
  for (let i = 0; i < 3; i++) {
    const start = x + radius - i * waveWidth;
    const end = x + radius - (i + 1) * waveWidth;
    const mid = (start + end) / 2;
    ctx.quadraticCurveTo(mid, bodyBottom - waveDepth, end, bodyBottom);
  }
  ctx.closePath();
  ctx.fill();
}
```

### 2.3 Eyes

- White oval: width=6px, height=8px per eye
- Pupil: circle, radius=2px, color=#2121DE
- Pupil direction offset: (±2, ±2) based on movement direction

```typescript
function drawGhostEyes(ctx, x, y, direction, pupilColor = '#2121DE'): void {
  const offsets = { UP: {dx:0,dy:-2}, DOWN: {dx:0,dy:2}, LEFT: {dx:-2,dy:0}, RIGHT: {dx:2,dy:0}, NONE: {dx:0,dy:0} };
  const off = offsets[direction];
  // Left eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(x-3, y-4, 3, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pupilColor;
  ctx.beginPath(); ctx.arc(x-3+off.dx, y-4+off.dy, 2, 0, Math.PI*2); ctx.fill();
  // Right eye
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(x+3, y-4, 3, 4, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = pupilColor;
  ctx.beginPath(); ctx.arc(x+3+off.dx, y-4+off.dy, 2, 0, Math.PI*2); ctx.fill();
}
```

### 2.4 Ghost Color Table

| Ghost | Normal | Frightened | Flash |
|-------|--------|:---:|:---:|
| Blinky | #FF0000 | #2121DE | #FFFFFF |
| Pinky | #FFB8FF | #2121DE | #FFFFFF |
| Inky | #00FFFF | #2121DE | #FFFFFF |
| Clyde | #FFB852 | #2121DE | #FFFFFF |

### 2.5 Frightened State

- Body: blue (#2121DE), same shape
- Eyes: small white dots (radius=2px), no pupils
- Mouth: wavy zigzag line across face
- Flash (last 2s): alternates blue↔white every 200ms

### 2.6 Eaten State (Eyes Only)

- Only eyes rendered, no body
- Pupils look toward ghost house entrance
- Moves at 2x speed (150%)

---

## 3. Maze Tile Rendering

### 3.1 Walls

- Outline-only style (classic arcade)
- Blue (#2121DE), lineWidth=2px
- Only draw edges adjacent to passable tiles
- Fully internal wall tiles render nothing
- **Performance**: Cache static maze to offscreen canvas

```typescript
function drawMazeWalls(ctx, tiles, tileSize = 16): void {
  ctx.strokeStyle = '#2121DE';
  ctx.lineWidth = 2;
  for (let row = 0; row < tiles.length; row++) {
    for (let col = 0; col < tiles[row].length; col++) {
      if (tiles[row][col] !== TileType.WALL) continue;
      const x = col * tileSize, y = row * tileSize;
      // Check 4 edges; draw blue line if neighbor is passable
      if (isPassable(tiles, row-1, col)) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+tileSize,y); ctx.stroke(); }
      if (isPassable(tiles, row+1, col)) { ctx.beginPath(); ctx.moveTo(x,y+tileSize); ctx.lineTo(x+tileSize,y+tileSize); ctx.stroke(); }
      if (isPassable(tiles, row, col-1)) { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+tileSize); ctx.stroke(); }
      if (isPassable(tiles, row, col+1)) { ctx.beginPath(); ctx.moveTo(x+tileSize,y); ctx.lineTo(x+tileSize,y+tileSize); ctx.stroke(); }
    }
  }
}
```

### 3.2 Dots

- White circle (#FFFFFF), radius=2px, centered on tile

### 3.3 Power Pellets

- White circle (#FFFFFF), radius oscillates 5px↔7px, 500ms cycle (250ms per frame)
- Locations: (1,2), (26,2), (1,19), (26,19)

### 3.4 Ghost House Door

- Filled rectangle, color=#FFB8FF, width=3 tiles (48px), height=2px
- Position: top edge of GHOST_HOUSE_DOOR tiles (row 13, cols 13-15)

### 3.5 Fruit Rendering (Procedural)

| Fruit | Shape | Colors | Size | Points |
|-------|-------|--------|:---:|:---:|
| Cherry | 2 circles + stem | Red + Green | 10px | 100 |
| Strawberry | Rounded triangle + seeds | Red + Green | 10px | 300 |
| Orange | Circle + leaf | Orange + Green | 10px | 500 |
| Apple | Circle + stem + leaf | Red + Green | 10px | 700 |
| Melon | Oval + stripes | Green + Dark Green | 12px | 1000 |
| Galaxian | Triangle/ship | Blue + White | 12px | 2000 |
| Bell | Trapezoid + clapper | Yellow + Brown | 10px | 3000 |
| Key | Circle head + shaft | Gold | 10px | 5000 |

Fruit disappears after 10 seconds if not collected.

---

## 4. Score Popup

- Color: #00FFFF (cyan), font: 8px monospace
- Animation: float upward 20px over 1 second, alpha fades 1.0 → 0.0
- Values: 200, 400, 800, 1600

---

## 5. Sound Asset Registry

All procedural (Web Audio API oscillators), no audio files.

### 5.1 Sound Effects Table

| ID | Trigger | Waveform | Frequency | Duration | ADSR (ms) |
|----|---------|----------|:---:|:---:|-----------|
| sfx_waka_1 | Odd dot eaten | Square | 262 Hz | 100ms | A:5 D:5 S:80% R:10 |
| sfx_waka_2 | Even dot eaten | Square | 330 Hz | 100ms | A:5 D:5 S:80% R:10 |
| sfx_power | Power pellet | Sine sweep | 200→800 Hz | 300ms | A:10 D:50 S:70% R:50 |
| sfx_ghost_eat | Ghost eaten | Sine sweep | 800→1200 Hz | 400ms | A:5 D:30 S:60% R:50 |
| sfx_death | Death | Square sweep | 500→100 Hz | 1500ms | A:20 D:100 S:50% R:200 |
| sfx_level_up | Stage clear | Square arp | C-E-G-C | 800ms | A:10 D:20 S:70% R:100 |
| sfx_game_over | Game over | Square | G-E-C | 2000ms | A:30 D:100 S:40% R:300 |
| sfx_intro | Game start | Square arp | C-E-G-B-C | 1000ms | A:10 D:30 S:70% R:100 |
| sfx_siren | Background | Sawtooth | 80-120 Hz | Loop | A:50 D:200 S:60% (fade on stop) |

### 5.2 ADSR Envelope Specification

All sounds use an Attack-Decay-Sustain-Release (ADSR) envelope applied via the master `GainNode`
to prevent audio clicks/pops on start/stop:

- **Attack** (`a` ms): Gain ramps from 0 → 1. Prevents click on oscillator start.
- **Decay** (`d` ms): Gain ramps from 1 → sustain level.
- **Sustain** (`s` %): Gain held at sustain level for remaining duration.
- **Release** (`r` ms): Gain ramps from current → 0. Prevents click on oscillator stop.

```
Gain:  1.0 ┤╲          ╱╲
            │  ╲________╱  ╲____
            │   ╱╲            ╲
       0.0 ┤──╱──╲────────────╲───
            0    A  D   Sustain  R
```

### 5.3 Audio Lifecycle

| Aspect | Detail |
|--------|--------|
| **Master volume** | `SoundManager.setVolume(0–1)` controls `masterGain.gain` |
| **Resource cleanup** | `SoundManager.dispose()` closes `AudioContext`, disconnects all nodes |
| **Node lifecycle** | Each sound creates its own `OscillatorNode` → `GainNode` → `masterGain`. On `onended`, the gain node is disconnected to prevent memory leaks. |
| **Siren reschedule** | Background siren uses `setTimeout` (9s before 10s cycle expiry) to reschedule, preventing drift. `stopSiren()` clears the timeout. |

---

## 6. Animation Timing

| Animation | Frames | Per Frame | Cycle | Trigger |
|-----------|:---:|:---:|:---:|---------|
| Pac-Man mouth | 2 | 100ms | 200ms | Movement |
| Pac-Man death | 8 | 187ms | 1500ms | Death event |
| Ghost normal | 2 | 150ms | 300ms | SCATTER/CHASE |
| Ghost frightened | 2 | 200ms | 400ms | FRIGHTENED |
| Ghost fright flash | 2 | 200ms | 400ms | Last 2s of fright |
| Power pellet pulse | 2 | 250ms | 500ms | Continuous |
| Score popup | 1 | 1000ms | 1000ms | Ghost eaten |
| Maze wall flash | 2 | 250ms | 500ms | Level complete |

---

## 8. Interpolation Curves

All procedural animations use defined easing functions to ensure consistent, predictable motion. Each animation specifies its curve type and total duration.

### 8.1 Curve Definitions

| Curve | Formula | Usage |
|-------|---------|-------|
| **Linear** | `progress = elapsed / duration` | Frightened flash, ghost eaten eyes |
| **Ease-In-Out** | `progress = t < 0.5 ? 2t² : -1+(4-2t)*t` | Death sequence, fruit spawn, score popup |
| **Ease-Out** | `progress = t * (2 - t)` | Power pellet pulse opacity |
| **Step** | `progress = floor(elapsed / interval) % 2` | Pac-Man mouth, ghost body |

### 8.2 Animation Interpolation Table

| Animation | Duration | Curve | Parameter Range |
|-----------|:--------:|:-----:|-----------------|
| Pac-Man death | 1500ms | Linear | mouthAngle: 30° → 240° |
| Power pellet pulse | 1000ms cycle | Ease-Out (radius), Linear (opacity) | radius: 5→7px, alpha: 0.6→1.0 |
| Frightened flash | 200ms per toggle | Step | bodyColor: `#2121DE` ↔ `#FFFFFF` |
| Fruit spawn | 300ms | Ease-In-Out | alpha: 0→1, scale: 0.5→1.0 |
| Score popup | 1000ms | Ease-Out | y-offset: 0→-20px, alpha: 1.0→0.0 |
| Ghost eaten eyes | speed-based | Linear | position: follows pathfinding target |
| Maze wall flash (level complete) | 250ms per toggle | Step | wallColor: `#2121DE` ↔ `#FFFFFF` |
| Pac-Man mouth animation | 200ms cycle | Step | mouthAngle: 0° ↔ 30° |
| Ghost body animation | 300ms cycle | Step | waveOffset: 0→2π |

### 8.3 Dynamic Parameter Ranges

Procedural effects use constrained ranges to maintain visual consistency:

| Parameter | Min | Max | Unit | Context |
|-----------|:---:|:---:|:----:|---------|
| Ghost dome radius | 6 | 8 | px | Entity size variation |
| Ghost wave depth | 2 | 4 | px | Wavy bottom animation |
| Ghost pupil offset | 1 | 3 | px | Eye direction indicator |
| Dot radius | 1.5 | 2.5 | px | Collection visibility |
| Power pellet radius | 4 | 8 | px | Pulsing animation |
| Score popup speed | 15 | 25 | px/s | Float-up speed |
| Fruit bob amplitude | 0 | 2 | px | Idle floating |

---

## 9. Visual Hierarchy Z-Ordering

Defines the rendering layer order and priority rules for all visual elements in every game state.

### 9.1 Layer Definitions

| Layer | Name | Elements | Render Priority |
|:-----:|------|----------|:---------------:|
| 0 | Background | Black fill, HUD bar | Always first |
| 1 | Maze | Wall outlines, ghost house door | Static (cached) |
| 2 | Collectibles | Dots, power pellets, fruit | Active gameplay |
| 3 | Entities | Pac-Man, ghosts (all modes) | Active gameplay |
| 4 | Effects | Score popups, flash overlays | On-top effects |
| 5 | HUD | Score text, lives, stage number | Always visible |
| 6 | UI Overlays | Pause overlay, game over text, start screen | Screen-level |

### 9.2 State-Specific Layer Rules

| Game State | Layers Rendered | Notes |
|-----------|:---------------:|-------|
| MENU | 0, 1, 5, 6 | Walls only (no dots/entities), title, scores |
| PLAYING | 0–5 | All layers in order |
| PAUSED | 0–5, 6 | All gameplay layers frozen + overlay on top |
| DYING | 0, 1, 2, 3 (frozen ghosts), 3 (death anim), 5 | Entities frozen, death animation, HUD |
| GAME_OVER | 0, 1, 5, 6 | Walls only, HUD, overlay text |
| LEVEL_COMPLETE | 0, 1, 5, 6 | Flashing walls, HUD, "STAGE CLEAR!" text |

### 9.3 Rendering Priority Rules

1. **Layer integrity**: Elements within a layer are rendered in definition order (never interleaved with other layers)
2. **Overlay transparency**: Layer 6 uses semi-transparent fills (rgba) — never opaque, always composites on top
3. **Dirty flag optimization**: Layers 0-1 can be cached to offscreen canvas (static). Only layers 2-6 need per-frame redraw.
4. **Entity sort order within Layer 3**: Pac-Man always drawn LAST (on top of ghosts) for visibility. Ghost order: Blinky, Pinky, Inky, Clyde.

---

## 7. Acceptance Criteria

- [ ] All Pac-Man directional frames have exact angle specs
- [ ] Death animation: 8 frames, ~1500ms total
- [ ] All 4 ghost types have colors for all visual states
- [ ] Maze wall rendering considers neighboring tiles
- [ ] Power pellet pulsing: 5px↔7px, 500ms cycle
- [ ] All 8 fruit types have procedural shape descriptions
- [ ] Score popup: float 20px, 1s, fade out
- [ ] All 9 sound effects defined (waveform, freq, duration)
- [ ] Animation timings consistent with game-mechanics.md
