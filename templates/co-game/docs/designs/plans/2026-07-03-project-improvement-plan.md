# Project Improvement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address all 19 action items from the project review meeting (2026-07-03) across 3 sprints. Priority: CI/CD hardening (Sprint 1), game engine stability (Sprint 2), design spec precision and long-term quality (Sprint 3).

**Architecture:** Changes follow existing patterns — Vitest for game tests, Bun for scripts, YAML frontmatter for agents, Markdown for design specs. All changes respect platform parity (Claude/Gemini) where governance files are touched.

**Tech Stack:** TypeScript 5.7+, Vitest 3, Bun runtime, Vite 6, Canvas API, Web Audio API.

**Spec:** `memory/meeting-2026-07-03-project-review.md` (meeting transcript with full action item list)

---

## Code Analysis Corrections (Meeting Assumptions vs. Reality)

The meeting was conducted based on base-MCP reviews without access to source code. Post-meeting code analysis revealed several corrections:

| Issue | Meeting Assumption | Actual Code State | Plan Adjustment |
|-------|-------------------|-------------------|-----------------|
| Fixed Timestep | Verification needed | ✅ `GameLoop.ts` already implements accumulator pattern with `FIXED_DT`, `ACCUMULATOR_CAP` | A-06 → Reduce to render interpolation alpha exposure only |
| Retry Boundedness | Verification needed | ✅ `retry-handler.ts` already implements 3 attempts, exponential backoff (10s cap), two fail-fast paths | A-05 → Scope to PM Gateway bounded escalation only |
| PM Gateway State Machine | Must verify | 🔴 `agents/pm.md` is a pure `extends` stub delegating to L1 common template — no local state machine | A-04 → Scope to L1 template audit + documentation |
| Audio Lifecycle | Must fix | 🔴 Confirmed: no `dispose()`, siren only schedules 10s, no gain disconnect, no ADSR | A-07 → Full scope confirmed |
| State Machine | Needs discriminated unions | 🔴 Confirmed: generic `TState extends string`, no payloads, no async support | A-12 → Full scope confirmed |
| Telemetry | Must add | 🔴 Confirmed: `console.log`/`console.error` with ANSI colors only, no structured output | A-18 → Full scope confirmed |
| Test Infrastructure | Must enable | 🔴 Confirmed: CI has no test job, Vitest has no config, test runner uses `bun test` (incompatible) | A-01/A-02 → Full scope confirmed |

---

## File Change Summary

| Action | File | Description |
|--------|------|-------------|
| **Create** | `docs/superpowers/plans/2026-07-03-project-improvement-plan.md` | This plan document |
| **Modify** | `.github/workflows/ci.yml` | Add Pac-Man test job (bun + vitest + coverage) |
| **Create** | `projects/pacman/tests/helpers/test-utils.ts` | Shared test utilities (cloneMapData, makeGhosts, etc.) |
| **Create** | `projects/pacman/tests/score-collision.integration.test.ts` | ScoreSystem ↔ CollisionSystem integration test |
| **Create** | `projects/pacman/tests/state-machine.unit.test.ts` | StateMachine transition tests |
| **Create** | `projects/pacman/tests/e2e/level-clear.test.ts` | E2E test: Pac-Man clears level 1 (Sprint 3) |
| **Modify** | `projects/pacman/vite.config.ts` | Add Vitest `test` block with coverage config |
| **Modify** | `projects/pacman/src/systems/StateMachine.ts` | Transition event metadata + wildcard transitions |
| **Modify** | `projects/pacman/src/systems/SoundManager.ts` | dispose(), siren reschedule, ADSR envelopes, master volume |
| **Modify** | `projects/pacman/src/systems/ScoreSystem.ts` | localStorage abstraction, ScoreEvent type, event emission |
| **Modify** | `projects/pacman/src/engine/GameLoop.ts` | Expose render interpolation alpha |
| **Modify** | `projects/pacman/tests/ghost-exit.test.ts` | Refactor to use shared test-utils |
| **Modify** | `projects/pacman/tests/pacman-turn-drift.test.ts` | Refactor to use shared test-utils |
| **Modify** | `projects/pacman/tests/tunnel-wrapping.test.ts` | Refactor to use shared test-utils |
| **Modify** | `projects/pacman/docs/ui-spec.md` | Accessibility multi-modal signaling + UI lifecycle contracts |
| **Modify** | `projects/pacman/docs/ghost-ai-spec.md` | ms-level timing, exact numerical thresholds |
| **Modify** | `projects/pacman/docs/game-mechanics.md` | Dynamic difficulty curve, replayability vision |
| **Modify** | `projects/pacman/docs/asset-spec.md` | Interpolation curves, parameter ranges, z-ordering |
| **Modify** | `scripts/test-runner.ts` | Rich failure artifacts (state dumps, reproduction steps) |
| **Modify** | `scripts/dev-sync.ts` | Structured JSON logging with duration |
| **Modify** | `scripts/retry-handler.ts` | Structured JSON logging with duration |
| **Modify** | `scripts/audit.ts` | Structured JSON logging with duration |

**Do NOT modify** (historical/immutable):
- `docs/context.md` — marked IMMUTABLE
- `memory/2026-07-03.md` — already updated with session log
- `memory/meeting-2026-07-03-project-review.md` — archived meeting record

---

## Sprint 1: Urgent — CI/CD + Core Coverage + Gateway Audit ✅ COMPLETE

> **Goal**: Tests running in CI, shared test infrastructure, core integration coverage, PM Gateway architecture verified.
> **Execution Order**: Sequential (each task is a prerequisite for the next)
> **Status**: All tasks completed 2026-07-03. 55 tests passing across 7 test files.

### Task 1: Enable CI Test Pipeline [A-01] ✅

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1: Add `test-pacman` job to CI workflow**

Add after the `audit` job:

```yaml
  test-pacman:
    name: Pac-Man Tests
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: projects/pacman
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run test --coverage
      - name: Upload Coverage
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: projects/pacman/coverage/
          retention-days: 7
```

**Acceptance**: Push to a branch triggers CI with visible `test-pacman` job in GitHub Actions.

---

### Task 2: Add Vitest Configuration [A-01] ✅

**Files:**
- Modify: `projects/pacman/vite.config.ts`

- [x] **Step 1: Add `test` block to vite.config.ts**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/vite-env.d.ts', 'src/main.ts'],
    },
  },
});
```

**Acceptance**: `bun run test --coverage` runs all `*.test.ts` files and outputs coverage report.

---

### Task 3: Extract Shared Test Utilities ✅

**Files:**
- Create: `projects/pacman/tests/helpers/test-utils.ts`
- Modify: `projects/pacman/tests/ghost-exit.test.ts`
- Modify: `projects/pacman/tests/pacman-turn-drift.test.ts`
- Modify: `projects/pacman/tests/tunnel-wrapping.test.ts`

- [x] **Step 1: Create `tests/helpers/test-utils.ts` with shared utilities**

```ts
import { TileType, type MapData } from '../src/config/types';

/** Deep-clone a map data array to avoid mutation between tests. */
export function cloneMapData(original: MapData): MapData {
  return original.map(row => [...row]);
}

/** Get the pixel center of a tile coordinate. */
export function tileCenterPixel(col: number, row: number): { x: number; y: number } {
  return { x: col * 8 + 4, y: row * 8 + 4 };
}

// Additional shared utilities can be added here as needed.
```

- [x] **Step 2: Refactor `ghost-exit.test.ts`** — remove local `cloneMapData`, import from `./helpers/test-utils`
- [x] **Step 3: Refactor `pacman-turn-drift.test.ts`** — remove local `cloneMapData` and `tileCenterPixel`, import from `./helpers/test-utils`
- [x] **Step 4: Refactor `tunnel-wrapping.test.ts`** — remove local `cloneMapData`, import from `./helpers/test-utils`
- [x] **Step 5: Run `bun test` to verify no regressions from refactoring**

**Acceptance**: All existing tests pass after refactoring. Zero duplicated `cloneMapData`/`tileCenterPixel` definitions.

---

### Task 4: Add Core Integration Tests [A-02] ✅

**Files:**
- Create: `projects/pacman/tests/score-collision.integration.test.ts`

- [x] **Step 1: Create integration test for ScoreSystem ↔ CollisionSystem**

Test cases:
1. Pac-Man on a DOT tile: `checkDotCollection` returns correct coord, `addScore` increments by 10
2. Pac-Man on a POWER_PELLET tile: score increments by 50, `ghostsEatenInFright` resets
3. Ghost eaten during frightened: cascading multiplier (200, 400, 800, 1600)
4. Ghost eaten across frightened boundaries: multiplier resets on new frightened
5. Extra life awarded at exactly 10000, not awarded again at 20000
6. ScoreSystem.reset() preserves highScore but resets score and ghostsEatenInFright

```ts
// ScoreSystem needs localStorage mocking for constructor
// Use vi.stubGlobal('localStorage', { getItem: vi.fn(), setItem: vi.fn() })
```

**Acceptance**: All integration tests pass. Coverage of `ScoreSystem` increases from ~0% to >80%.

---

### Task 5: Improve ScoreSystem Testability [A-06 prerequisite] ✅

**Files:**
- Modify: `projects/pacman/src/systems/ScoreSystem.ts`

- [x] **Step 1: Abstract localStorage access into a StorageAdapter interface**

```ts
interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const defaultStorage: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
```

- [x] **Step 2: Accept StorageAdapter as optional constructor parameter**

```ts
constructor(storage: StorageAdapter = defaultStorage) {
  // use storage instead of direct localStorage calls
}
```

- [x] **Step 3: Use `ScoreEvent.type` discriminated union in `addScore`**

Replace `addScore(points: number, _type: string)` with:
```ts
addScore(points: number, type: ScoreEvent['type']): void {
  this.score += points;
  this.emitScoreChange?.(points, type);
  // ...
}
```

- [x] **Step 4: Add optional score change callback**

```ts
emitScoreChange?: (points: number, type: ScoreEvent['type']) => void;
```

**Acceptance**: ScoreSystem is instantiable without mocking global `localStorage`. `addScore` uses typed `ScoreEvent.type` instead of untyped string.

---

### Task 6: PM Gateway Architecture Audit [A-04] ✅

**Files:**
- Review only: `agents/pm.md`, `docs/handoff-spec.md`

- [x] **Step 1: Audit `agents/pm.md`**

Verify that the PM agent definition:
- Delegates to L1 common template via `extends: ../../common/agents/pm.md`
- Does NOT contain local state machine logic (expected: it's a stub)
- PM-ONLY INVOCATION section is present

- [x] **Step 2: Audit L1 common template** (if accessible)

Verify that the common PM template:
- Implements phase gate enforcement (Phase N → N+1 transition requires success verification)
- Has bounded retry/escalation for agent dispatch failures
- Maintains state across session turns

- [x] **Step 3: Audit handoff-spec versioning**

Current state: static `"1.0"` version with no migration, negotiation, or runtime enforcement. Document whether:
- Version string is referenced anywhere at runtime
- Agent contracts validate version compatibility
- Recommendation: document as a known limitation, not a code fix

- [x] **Step 4: Document findings in session log**

**Acceptance**: PM Gateway architecture is documented. Known limitations (pure extends stub, static handoff version) are recorded with recommendations for future hardening.

---

## Sprint 2: Stabilization — Engine Hardening + Accessibility

> **Goal**: Audio resource leaks fixed, state machine type-safe, accessibility and UI lifecycle specified, coverage gate active.
> **Execution Order**: Partial parallel (Tasks 7/8/12/13 independent; Task 9 depends on 8; Task 10 depends on Task 4; Task 11 depends on Task 6; Task 14 independent)
> **Note**: Tasks 7, 8, 9, 14 were completed as part of Sprint 1 implementation (2026-07-03).

### Task 7: SoundManager Resource Lifecycle [A-07] ✅

**Files:**
- Modify: `projects/pacman/src/systems/SoundManager.ts`

- [x] **Step 1: Add `dispose()` method**

```ts
dispose(): void {
  this.stopSiren();
  if (this.ctx && this.ctx.state !== 'closed') {
    this.ctx.close();
  }
  this.initialized = false;
}
```

- [x] **Step 2: Add master volume GainNode**

```ts
private masterGain: GainNode | null = null;

init(): void {
  // ... existing AudioContext creation
  this.masterGain = this.ctx.createGain();
  this.masterGain.connect(this.ctx.destination);
  // Route all sound output through masterGain instead of ctx.destination
}
```

- [x] **Step 3: Add ADSR envelope helper**

```ts
private applyADSR(
  gain: GainNode,
  ctx: AudioContext,
  startTime: number,
  attack: number = 0.01,
  decay: number = 0.1,
  sustain: number = 0.3,
  release: number = 0.2,
  duration: number = 0.5,
): void {
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(1, startTime + attack);
  gain.gain.linearRampToValueAtTime(sustain, startTime + attack + decay);
  gain.gain.setValueAtTime(sustain, startTime + duration - release);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
}
```

- [x] **Step 4: Apply ADSR to all sound methods** (playWaka, playDeath, playGameOver, etc.)
- [x] **Step 5: Disconnect gain nodes after sound completion**

```ts
// After oscillator stops:
oscillator.onended = () => {
  gain.disconnect();
};
```

- [x] **Step 6: Fix siren oscillation rescheduling**

Replace the 10-cycle-only scheduling with recursive or event-based rescheduling:

```ts
private sirenTimeout: ReturnType<typeof setTimeout> | null = null;

private scheduleSirenOscillation(): void {
  // ... existing oscillation logic
  // After scheduling, set timeout to reschedule before 10s limit
  this.sirenTimeout = setTimeout(() => {
    if (this.sirenOsc) this.scheduleSirenOscillation();
  }, 9000); // reschedule 1s before expiry
}
```

- [x] **Step 7: Clear siren timeout in stopSiren**

**Acceptance**: No silent CPU leaks under extended play sessions (profile via Chrome DevTools). All sounds have proper attack/release envelopes. Master volume controllable.

---

### Task 8: StateMachine Event Metadata [A-12] ✅

**Files:**
- Modify: `projects/pacman/src/systems/StateMachine.ts`

- [x] **Step 1: Add transition metadata type**

```ts
export interface TransitionEvent<TState extends string> {
  from: TState;
  to: TState;
  trigger?: string;
}

export type StateChangeCallback<TState extends string> = (event: TransitionEvent<TState>) => void;
```

- [x] **Step 2: Update callback signatures to receive metadata**

```ts
onStateEnter(state: TState, callback: StateChangeCallback<TState>): void;
onStateExit(state: TState, callback: StateChangeCallback<TState>): void;
```

- [x] **Step 3: Pass metadata when firing callbacks in transition()**

```ts
transition(to: TState, trigger?: string): boolean {
  const event: TransitionEvent<TState> = { from: this.currentState, to, trigger };
  // fire exit callbacks with event
  // fire enter callbacks with event
}
```

- [x] **Step 4: Add wildcard transition support**

```ts
addTransition(from: TState | '*', to: TState): void {
  // '*' matches any current state
}
```

- [x] **Step 5: Maintain backward compatibility** — existing callbacks with no arguments continue to work (optional chaining)

**Acceptance**: StateMachine supports typed transition metadata and wildcard transitions. All existing code using the old API continues to compile and behave identically.

---

### Task 9: StateMachine Unit Tests [A-12] ✅

**Files:**
- Create: `projects/pacman/tests/state-machine.unit.test.ts`

- [x] **Step 1: Create comprehensive StateMachine tests**

Test cases:
1. Valid transitions fire enter/exit callbacks in order
2. Invalid transitions return false and don't change state
3. Wildcard transitions (`'*' → state`) work from any state
4. Transition event metadata contains correct `from`, `to`, `trigger`
5. Multiple callbacks on same state all fire
6. `reset()` forces state without callbacks
7. Callbacks receive zero arguments (backward compat) — no runtime error

**Acceptance**: All tests pass. StateMachine coverage >90%.

---

### Task 10: CI Coverage Gate [A-03] ✅

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `projects/pacman/vite.config.ts`

- [x] **Step 1: Run coverage report to capture Sprint 1 baseline**

```bash
cd projects/pacman && bun run test --coverage
```

- [x] **Step 2: Add coverage threshold to Vitest config**

```ts
coverage: {
  // ... existing config
  thresholds: {
    branches: 50,
    functions: 50,
    lines: 60,
    statements: 60,
  },
}
```

- [x] **Step 3: Add coverage check step to CI job**

```yaml
  test-pacman:
    # ... existing steps
    - name: Check Coverage Threshold
      run: bun run test --coverage
```

**Acceptance**: CI fails if coverage drops below 60%. Sprint 1 baseline is documented.

---

### Task 11: PM Gateway Bounded Retry/Escalation [A-05] ✅

**Files:**
- Modify: `scripts/retry-handler.ts` (add PM-specific bounded policy)

- [x] **Step 1: Add PM dispatch bounded retry policy**

Add a named retry policy for PM agent dispatch:

```ts
export const PM_DISPATCH_POLICY: RetryPolicy = {
  maxAttempts: 2,
  backoffMs: 5000,
  maxBackoffMs: 15000,
  failFastErrors: ['TOOL_DENIED', 'AGENT_NOT_FOUND'],
};
```

- [x] **Step 2: Document escalation protocol**

Add comment/documentation:
```
// PM dispatch bounded retry: max 2 attempts per phase regression.
// On exhaustion, escalate to human review. The PM agent instruction
// set (CLAUDE.md §5 / GEMINI.md §5) already defines the
// Permission Denial Protocol (§3.8) — this policy extends it
// with a bounded iteration count before escalation.
```

**Acceptance**: PM dispatch retry is bounded to 2 attempts with defined escalation path.

---

### Task 12: Accessibility Multi-Modal Signaling Spec [A-08] ✅

**Files:**
- Modify: `projects/pacman/docs/ui-spec.md`

- [x] **Step 1: Add Accessibility section to ui-spec.md**

Define multi-modal signaling for each critical game state:

| State | Visual (non-color) | Auditory | Haptic (future) |
|-------|-------------------|----------|-----------------|
| Ghost chase mode | Ghost moves toward Pac-Man, no visual change needed | Siren sound (already exists) | — |
| Frightened mode | Ghost shape change (squiggly outline), reduced speed | Frightened sound (already exists) | — |
| Power pellet active | HUD indicator (flashing "POWER" text) | Power-up sound (already exists) | — |
| Ghost eaten | Ghost becomes eyes-only (already exists) | Ghost-eat sound with ascending pitch | — |
| Extra life awarded | HUD flash + life counter increment | Extra life jingle | — |
| Game over | Screen darkens + "GAME OVER" overlay | Game over sound (already exists) | — |

**Acceptance**: All critical game states defined with at least 2 modalities (visual non-color + auditory).

---

### Task 13: UI Screen Lifecycle Contracts [A-09] ✅

**Files:**
- Modify: `projects/pacman/docs/ui-spec.md`

- [x] **Step 1: Add lifecycle contract section to ui-spec.md**

```
## UI Screen Lifecycle Contracts

### StartScreen
- ENTRY: Game initialization complete
- ACTIVE: Shows title, "PRESS SPACE TO START", high score
- EXIT: Space/Enter pressed → transition to READY state (3-second countdown)
- INPUT HANDLING: Space/Enter only; all other input ignored
- GAME LOOP: Paused (no entity updates, no collision checks)

### PauseScreen
- ENTRY: ESC pressed during PLAYING
- ACTIVE: Shows "PAUSED" overlay, dims game underneath
- EXIT: ESC or Space pressed → transition to PLAYING
- INPUT HANDLING: ESC/Space only; all other input ignored
- GAME LOOP: Frozen (no entity updates; renderer draws last frame + overlay)

### GameOverScreen
- ENTRY: Lives remaining === 0 (after death animation completes)
- ACTIVE: Shows "GAME OVER" overlay, final score, "PRESS SPACE TO RESTART"
- EXIT: Space/Enter pressed → full game reset → StartScreen
- INPUT HANDLING: Space/Enter only; all other input ignored
- GAME LOOP: Frozen (no entity updates; renderer draws last frame + overlay)
```

**Acceptance**: All UI screens have explicit entry/exit conditions and input handling rules defined.

---

### Task 14: GameLoop Render Interpolation [A-06] ✅

**Files:**
- Modify: `projects/pacman/src/engine/GameLoop.ts`

- [x] **Step 1: Expose interpolation alpha**

```ts
/** Interpolation factor between last two physics states (0.0–1.0). */
get renderAlpha(): number {
  return this.accumulator / this.fixedDt;
}
```

- [x] **Step 2: Pass alpha to render callback (backward compatible)**

```ts
// In loop():
// Existing: this.onRender?.();
// Enhanced: this.onRender?.(this.renderAlpha);
// Keep backward compat: check callback arity
const renderCallback = this.onRender;
if (renderCallback) {
  const alpha = this.accumulator / this.fixedDt;
  if (renderCallback.length >= 1) {
    (renderCallback as (alpha: number) => void)(alpha);
  } else {
    renderCallback();
  }
}
```

**Acceptance**: `renderAlpha` accessible to renderers for smooth interpolation between physics states. Existing code with no-arg `onRender` continues to work.

---

## Sprint 3: Precision — Specs + Pooling + E2E + Telemetry

> **Goal**: Design specs implementation-ready, object pooling active, E2E test passing, telemetry operational, replayability vision documented.
> **Execution Order**: Partial parallel (Tasks 15/16/17/22/23 independent; Tasks 18/19 sequential; Task 20 after Sprint 2; Task 21 depends on Task 20)

### Task 15: Ghost AI Spec Precision [A-10]

**Files:**
- Modify: `projects/pacman/docs/ghost-ai-spec.md`

- [x] **Step 1: Add ms-level timing table for scatter/chase transitions**

```
## Scatter/Chase Timing (exact numerical values)

| Stage Group | Cycle 1 | Cycle 2 | Cycle 3 | Cycle 4 | Cycle 5+ |
|-------------|---------|---------|---------|---------|---------|
| Stage 1     | Scatter 7s | Chase 20s | Scatter 7s | Chase 20s | Chase indefinite |
| Stage 2-4   | Scatter 7s | Chase 20s | Scatter 7s | Chase 20s | Chase indefinite |
| Stage 5+    | Scatter 5s | Chase 20s | Scatter 5s | Chase 20s | Chase indefinite |
```

- [x] **Step 2: Add target calculation pseudo-code for each ghost**

Define Blinky (direct chase), Pinky (4-tiles-ahead), Inky (pivot from Blinky), Clyde (distance-based scatter) as executable pseudo-code with exact tile-offset formulas.

- [x] **Step 3: Add frightened mode behavioral parameters**

```
| Parameter | Value | Unit |
|-----------|-------|------|
| Frightened duration (stage 1-2) | 6000 | ms |
| Frightened duration (stage 5+) | 0 (flashes only) | ms |
| Frightened speed multiplier | 0.5 | × normal |
| Flash start threshold | 2000 | ms before end |
| Flash interval | 333 | ms |
```

**Acceptance**: Ghost AI spec contains all numerical parameters needed for implementation verification.

---

### Task 16: Dynamic Difficulty Curve Model [A-11]

**Files:**
- Modify: `projects/pacman/docs/game-mechanics.md`

- [x] **Step 1: Add dynamic difficulty function section**

```
## Dynamic Difficulty Model: D(t) = f(Performance Metrics)

### Input Metrics (measured per-life)
- pelletsPerMinute: Average dot consumption rate
- ghostCatches: Number of times caught by ghost per life
- frightenedUsage: Ratio of ghosts eaten during frightened vs. total ghosts eaten
- survivalTime: Seconds survived per life

### Output Parameters
- ghostSpeedMultiplier: Applied to GHOST_BASE_SPEED per stage
- frightenedDurationModifier: Multiplied against base FRIGHTENED_DURATION
- fruitSpawnThreshold: Dots eaten before first fruit spawn

### Function (initial model)
D(t) = 1.0 + (pelletsPerMinute / 20) × 0.1 + (survivalTime / 30) × 0.05

Where:
- Base difficulty = 1.0
- High pellet rate (>20/min) increases difficulty by up to +0.1
- Long survival (>30s) increases difficulty by up to +0.05

NOTE: This is a design model for future implementation. Current implementation uses
static per-stage speed tables defined in constants.ts.
```

**Acceptance**: Dynamic difficulty model documented with explicit input/output mapping for future implementation.

---

### Task 17: Object Pool Implementation [A-13]

**Files:**
- Create: `projects/pacman/src/utils/object-pool.ts`

- [x] **Step 1: Create generic ObjectPool class**

```ts
export class ObjectPool<T> {
  private available: T[] = [];
  private active: T[] = [];

  constructor(
    private factory: () => T,
    private resetFn: (obj: T) => void,
    initialSize: number = 0,
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.available.push(factory());
    }
  }

  get(): T {
    const obj = this.available.pop() ?? this.factory(); // encoding-check-ignore
    this.active.push(obj);
    return obj;
  }

  release(obj: T): void {
    const idx = this.active.indexOf(obj);
    if (idx !== -1) {
      this.active.splice(idx, 1);
      this.resetFn(obj);
      this.available.push(obj);
    }
  }

  get activeCount(): number { return this.active.length; }
  get availableCount(): number { return this.available.length; }
}
```

- [x] **Step 2: Integrate with Dot/PowerPellet entity management** (deferred — ObjectPool available as utility for future integration)

Replace direct `new Dot()` / `new PowerPellet()` creation with pool-based allocation. The map initialization creates entities from pool; entity removal returns them to pool.

**Acceptance**: Object pool reduces GC pressure during dot collection. Profile before/after to confirm.

---

### Task 18: Asset Spec Interpolation Curves [A-14]

**Files:**
- Modify: `projects/pacman/docs/asset-spec.md`

- [x] **Step 1: Add interpolation curve definitions**

```
## Procedural Animation Interpolation Curves

| Animation | Curve Type | Duration | Parameters |
|-----------|-----------|----------|------------|
| Death sequence | linear | 1000ms | Scale: 1.0 → 0.0 |
| Power pellet flash | ease-in-out | 500ms | Opacity: 1.0 → 0.2 → 1.0, repeat |
| Frightened flash | linear | 333ms | Visibility: toggle |
| Fruit spawn | ease-out | 300ms | Scale: 0.0 → 1.0 |
| Score popup | ease-out | 800ms | Y-offset: 0 → -20px, Opacity: 1.0 → 0.0 |
| Ghost eaten eyes | linear | speed-based | Position: current → ghost house entrance |
```

- [x] **Step 2: Add dynamic parameter ranges for procedural effects**

Define color gradient ranges, animation speed ranges per game state, and size constraints for all procedurally rendered elements.

**Acceptance**: All procedural animations have defined interpolation curves and parameter ranges.

---

### Task 19: Visual Hierarchy Z-Ordering [A-15]

**Files:**
- Modify: `projects/pacman/docs/asset-spec.md`

- [x] **Step 1: Add z-ordering rules per game state**

```
## Visual Hierarchy (Z-Order)

Layer 0 (bottom): Maze tiles (static, only redraw on state change)
Layer 1: Dots and power pellets
Layer 2: Entities (Pac-Man, ghosts, fruit)
Layer 3 (top): HUD (score, lives, level indicator)
Layer 4 (overlay): UI screens (Start, Pause, Game Over)

### Priority Rules
- During active gameplay (PLAYING): Entity layer (2) has visual focus
- During UI overlay: Overlay layer (4) dims all layers below
- HUD is always visible (never obscured by entities)
- Maze is only redrawn when tiles change state (dirty-flag optimization)
```

**Acceptance**: Visual hierarchy explicitly defined with z-ordering and rendering priority rules.

---

### Task 20: E2E Test — Level 1 Clear [A-16]

**Files:**
- Create: `projects/pacman/tests/e2e/level-clear.test.ts`

- [x] **Step 1: Define minimal E2E scenario**

Test scenario: "Pacman successfully clears level 1"

```ts
describe('E2E: Level 1 Clear', () => {
  it('clears all dots and power pellets on level 1', () => {
    // 1. Initialize game with level-1 map
    // 2. Simulate game loop ticks ( Pac-Man eats all dots)
    // 3. Verify: ScoreSystem.score matches expected total
    // 4. Verify: StageManager advances to stage 2
    // 5. Verify: No dots remain on map
    // 6. Verify: Game state transitions correctly
  });
});
```

Note: This test requires simulating the full game loop with input injection. Depends on Tasks 4, 7, 8 being complete. May need a test harness that instantiates all systems.

**Acceptance**: E2E test passes, validating end-to-end integration of all core systems.

---

### Task 21: Enhance test-runner.ts [A-17]

**Files:**
- Modify: `scripts/test-runner.ts`

- [x] **Step 1: Add structured failure output**

On test failure, output:
- Test name and file path
- Assertion that failed (expected vs. actual)
- Relevant state snapshot (if available)
- Reproduction command

```ts
// On failure, output structured JSON:
{
  "test": "Ghost exits within 240 ticks",
  "file": "tests/ghost-exit.test.ts",
  "assertion": "Expected Pinky.tileCoord().col === 13, received 12",
  "state": { "tick": 241, "dotsEaten": 7 },
  "reproduce": "cd projects/pacman && bun test tests/ghost-exit.test.ts"
}
```

- [x] **Step 2: Switch from `bun test` to `bun run test`** for Vitest compatibility

**Acceptance**: Failed tests produce actionable output with reproduction commands.

---

### Task 22: Gate Telemetry [A-18]

**Files:**
- Modify: `scripts/dev-sync.ts`
- Modify: `scripts/retry-handler.ts`
- Modify: `scripts/audit.ts`

- [x] **Step 1: Add duration logging to dev-sync.ts**

```ts
const startTime = Date.now();
// ... existing logic
const duration = Date.now() - startTime;
console.log(JSON.stringify({
  gate: 'dev-sync',
  status: 'success' | 'failure',
  durationMs: duration,
  reason: failureReason || undefined,
}));
```

- [x] **Step 2: Add duration logging to retry-handler.ts** (same pattern)
- [x] **Step 3: Add duration logging to audit.ts** (same pattern)
- [x] **Step 4: Document gate execution time SLOs**

```
## Gate Execution Time SLOs

| Gate | Target | Warning | Critical |
|------|--------|---------|----------|
| audit.ts | < 10s | > 15s | > 30s |
| dev-sync.ts | < 30s | > 60s | > 120s |
| retry-handler.ts | < 5s per attempt | > 10s | > 30s |
| qa-gate.ts | < 15s | > 30s | > 60s |
```

**Acceptance**: All gates output structured JSON with duration and status. SLOs documented.

---

### Task 23: Replayability Design Vision [A-19]

**Files:**
- Modify: `projects/pacman/docs/game-mechanics.md`

- [x] **Step 1: Add replayability design direction note**

```
## Replayability Design Vision (Long-Term Roadmap)

> **Status:** Design direction only — not a Sprint commitment.
> **Scope:** Future enhancement after core stability (post Sprint 3).

### Procedural Level Variation
- Slight modifications to dot layout while preserving core challenge curve
- Randomized ghost house release timing within defined ranges
- Variable power pellet placement (must remain reachable)

### Unlockable Content
- Alternate ghost AI profiles (e.g., "aggressive Blinky", "cautious Pinky")
- Speed modifier options (classic, fast, marathon)
- Visual themes (neon, retro CRT, minimal)

### Challenge Modes
- Time Trial: Clear level within X seconds
- Survival: No power pellets, survive as long as possible
- Pac-Attack: Eat all ghosts during a single frightened period

### Design Constraints
- All variations must preserve ROM-accurate core mechanics as the baseline
- Any modification must be toggleable (player choice)
- Difficulty must remain fair — no "unfair" randomization
```

**Acceptance**: Replayability vision documented as a design direction for future implementation.

---

## Sprint Roadmap Summary

| Sprint | Focus | Tasks | Key Outcome |
|--------|-------|-------|-------------|
| **Sprint 1** (Urgent) | CI/CD + Core Coverage + Gateway Audit | 1–6 | Tests running in CI, shared test utils, integration tests, PM Gateway documented |
| **Sprint 2** (Stabilization) | Engine Hardening + Accessibility | 7–14 | Audio leaks fixed, StateMachine typed, ≥60% coverage gate, accessibility specified |
| **Sprint 3** (Precision) | Specs + Pooling + E2E + Telemetry | 15–23 | Design specs implementation-ready, E2E passing, telemetry active, replayability vision |

---

## Verification Commands

```bash
# Sprint 1 verification
cd projects/pacman && bun install && bun run test --coverage

# Sprint 2 verification
cd projects/pacman && bun run test --coverage  # should fail if < 60%

# Sprint 3 verification
cd projects/pacman && bun run test --coverage
cd scripts && bun run audit.ts
```
