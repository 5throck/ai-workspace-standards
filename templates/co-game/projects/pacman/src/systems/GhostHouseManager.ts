/**
 * Pac-Man - Ghost House Manager
 *
 * Manages the global scatter/chase cycle timer, ghost release timing,
 * and frightened mode overrides. All non-frightened, non-eaten ghosts
 * follow the global mode managed by this system.
 */
import { GhostMode, GhostName } from '../config/types';
import type { ScatterChaseCycle } from '../config/types';

export class GhostHouseManager {
  private cycleTimer: number = 0;
  private currentPhaseIndex: number = 0;
  private globalMode: GhostMode = GhostMode.SCATTER;
  private frightenedActive: boolean = false;
  private frightenedDuration: number = 0;
  private frightenedTimer: number = 0;
  private scatterChaseCycles: ScatterChaseCycle[] = [];
  private gameTime: number = 0;
  private dotsEaten: number = 0;

  /** Set the scatter/chase cycles for the current stage. */
  setScatterChaseCycles(cycles: ScatterChaseCycle[]): void {
    this.scatterChaseCycles = cycles;
  }

  /** Update the game time and dot count for release timing. */
  updateGameInfo(gameTime: number, dotsEaten: number): void {
    this.gameTime = gameTime;
    this.dotsEaten = dotsEaten;
  }

  /** Advance the cycle timer by dt milliseconds. Triggers mode changes. */
  update(dt: number): void {
    // Update frightened timer
    if (this.frightenedActive) {
      this.frightenedTimer += dt;
      if (this.frightenedTimer >= this.frightenedDuration) {
        this.endFrightened();
      }
      // Classic behavior: scatter/chase timer is paused during fright
      return;
    }

    // Advance scatter/chase cycle timer
    this.cycleTimer += dt;

    if (this.currentPhaseIndex < this.scatterChaseCycles.length) {
      const currentPhase = this.scatterChaseCycles[this.currentPhaseIndex];
      if (this.cycleTimer >= currentPhase.duration) {
        this.cycleTimer = 0;
        this.currentPhaseIndex++;

        // Determine next mode
        if (this.currentPhaseIndex < this.scatterChaseCycles.length) {
          const nextPhase = this.scatterChaseCycles[this.currentPhaseIndex];
          this.globalMode = nextPhase.mode;
        }
        // If we've gone past all phases, stay in CHASE (last phase is infinite)
      }
    }
  }

  /** Get the current global mode (SCATTER or CHASE). */
  getGlobalMode(): GhostMode {
    if (this.frightenedActive) {
      return GhostMode.FRIGHTENED;
    }
    return this.globalMode;
  }

  /**
   * Get the remaining frightened time.
   * Used to determine if ghosts should flash (last 2 seconds).
   */
  getFrightenedRemaining(): number {
    if (!this.frightenedActive) return 0;
    return Math.max(0, this.frightenedDuration - this.frightenedTimer);
  }

  /** Check if ghosts should flash (warning period in last 2 seconds). */
  isWarningFlash(): boolean {
    return this.frightenedActive && this.getFrightenedRemaining() <= 2000;
  }

  /** Start a frightened period, overriding the global mode. */
  startFrightened(duration: number): void {
    this.frightenedActive = true;
    this.frightenedDuration = duration;
    this.frightenedTimer = 0;
  }

  /** End the frightened period and restore the global mode. */
  endFrightened(): void {
    this.frightenedActive = false;
    this.frightenedTimer = 0;
  }

  /** Check if currently in frightened mode. */
  isFrightened(): boolean {
    return this.frightenedActive;
  }

  /**
   * Get the release timing for a specific ghost.
   * Returns { type: 'time'|'dots', value: number }.
   */
  getReleaseTiming(ghostName: GhostName): { type: 'time'; value: number } | { type: 'dots'; value: number } {
    switch (ghostName) {
      case GhostName.BLINKY:
        return { type: 'time', value: 0 }; // Immediate release
      case GhostName.PINKY:
        return { type: 'time', value: 2000 }; // 2 seconds
      case GhostName.INKY:
        return { type: 'dots', value: 30 }; // 30 dots eaten
      case GhostName.CLYDE:
        return { type: 'dots', value: 60 }; // 60 dots eaten
      default:
        return { type: 'time', value: 0 };
    }
  }

  /**
   * Check if a ghost should be released based on current game conditions.
   */
  shouldRelease(ghostName: GhostName): boolean {
    const timing = this.getReleaseTiming(ghostName);
    if (timing.type === 'time') {
      return this.gameTime >= timing.value;
    } else {
      return this.dotsEaten >= timing.value;
    }
  }

  /** Reset the manager for a new stage. */
  resetStage(): void {
    this.cycleTimer = 0;
    this.currentPhaseIndex = 0;
    this.globalMode = GhostMode.SCATTER;
    this.frightenedActive = false;
    this.frightenedTimer = 0;
    this.frightenedDuration = 0;
    this.gameTime = 0;
    this.dotsEaten = 0;
  }

  /** Full reset for a new game. */
  reset(): void {
    this.resetStage();
    this.scatterChaseCycles = [];
  }
}
