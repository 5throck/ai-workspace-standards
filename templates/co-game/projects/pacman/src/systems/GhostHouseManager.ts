/**
 * Pac-Man - Ghost House Manager
 *
 * Manages the global scatter/chase cycle timer, ghost release timing,
 * and frightened mode overrides. All non-frightened, non-eaten ghosts
 * follow the global mode managed by this system.
 */
import { GhostMode, GhostName } from '../config/types';
import { INKY_RELEASE_DOTS, CLYDE_RELEASE_DOTS, GLOBAL_RELEASE_DOTS } from '../config/constants';
import type { ScatterChaseCycle } from '../config/types';

export class GhostHouseManager {
  private cycleTimer: number = 0;
  private currentPhaseIndex: number = 0;
  private globalMode: GhostMode = GhostMode.SCATTER;
  private frightenedActive: boolean = false;
  private frightenedDuration: number = 0;
  private frightenedTimer: number = 0;
  private scatterChaseCycles: ScatterChaseCycle[] = [];
  private dotsEaten: number = 0;
  // Arcade ghost-house release: per-ghost personal dot counters, switching to
  // a global counter after a life is lost.
  private usingGlobalCounter = false;
  private dotsSinceDeath = 0;
  private releasedAt: Partial<Record<GhostName, number>> = {};

  /** Set the scatter/chase cycles for the current stage. */
  setScatterChaseCycles(cycles: ScatterChaseCycle[]): void {
    this.scatterChaseCycles = cycles;
  }

  /** Update the game time and dot count for release timing. */
  updateGameInfo(_gameTime: number, dotsEaten: number): void {
    this.dotsEaten = dotsEaten;
    if (this.usingGlobalCounter) this.dotsSinceDeath = dotsEaten;
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
    // After a life is lost the arcade switches to a global dot counter.
    if (this.usingGlobalCounter && ghostName !== GhostName.BLINKY) {
      return this.dotsSinceDeath >= GLOBAL_RELEASE_DOTS[ghostName];
    }
    // Personal counters: Pinky leaves immediately; Inky counts dots since
    // Pinky's release; Clyde counts dots since Inky's release.
    switch (ghostName) {
      case GhostName.BLINKY:
        return true;
      case GhostName.PINKY:
        return true;
      case GhostName.INKY: {
        const baseline = this.releasedAt[GhostName.PINKY] ?? 0;
        return this.dotsEaten - baseline >= INKY_RELEASE_DOTS;
      }
      case GhostName.CLYDE: {
        const baseline = this.releasedAt[GhostName.INKY] ?? this.releasedAt[GhostName.PINKY] ?? 0;
        return this.dotsEaten - baseline >= CLYDE_RELEASE_DOTS;
      }
      default:
        return true;
    }
  }

  /** Record that a ghost just left the house (starts the next ghost's counter). */
  markReleased(ghostName: GhostName): void {
    if (this.releasedAt[ghostName] === undefined) {
      this.releasedAt[ghostName] = this.dotsEaten;
    }
  }

  /** Arcade rule: after losing a life, releases use the global counter. */
  notifyLifeLost(): void {
    this.usingGlobalCounter = true;
    this.dotsSinceDeath = 0;
    this.releasedAt = {};
  }

  /** Reset the manager for a new stage. */
  resetStage(): void {
    this.cycleTimer = 0;
    this.currentPhaseIndex = 0;
    this.globalMode = GhostMode.SCATTER;
    this.frightenedActive = false;
    this.frightenedTimer = 0;
    this.frightenedDuration = 0;
    this.dotsEaten = 0;
    this.usingGlobalCounter = false;
    this.dotsSinceDeath = 0;
    this.releasedAt = {};
  }

  /** Full reset for a new game. */
  reset(): void {
    this.resetStage();
    this.scatterChaseCycles = [];
  }
}
