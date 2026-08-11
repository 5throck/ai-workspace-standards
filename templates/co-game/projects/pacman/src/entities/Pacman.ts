/**
 * Pac-Man - Player Entity
 *
 * Extends EntityBase. Implements grid-aligned movement with pre-turn
 * buffering, continuous movement (never stops), and a simple state
 * machine (NORMAL -> DYING).
 */
import { PacmanState, Direction } from '../config/types';
import type { TileCoord, MapData } from '../config/types';
import { PACMAN_BASE_SPEED, MAP_COLS, MAP_ROWS } from '../config/constants';
import { EntityBase } from './EntityBase';
import { CollisionSystem } from '../engine/CollisionSystem';

export class Pacman extends EntityBase {
  private state: PacmanState = PacmanState.NORMAL;
  private speed: number;
  private collision: CollisionSystem;
  private map: MapData | null = null;

  constructor(collision: CollisionSystem) {
    super();
    this.speed = PACMAN_BASE_SPEED;
    this.collision = collision;
  }

  /** Provide the map data for collision checks. */
  setMap(map: MapData): void {
    this.map = map;
  }

  /** Get Pac-Man's current state. */
  getState(): PacmanState {
    return this.state;
  }

  /** Set speed based on stage difficulty (percentage of base speed). */
  setSpeed(percentage: number): void {
    // Base speed at 80% of max engine speed. Percentage normalizes around that.
    this.speed = PACMAN_BASE_SPEED * (percentage / 0.8);
  }

  /** Transition to DYING state. */
  die(): void {
    if (this.state === PacmanState.NORMAL) {
      this.state = PacmanState.DYING;
      this.velocity = { dx: 0, dy: 0 };
    }
  }

  /** Reset Pac-Man after death/respawn. */
  reset(start: TileCoord): void {
    super.reset(start);
    this.state = PacmanState.NORMAL;
    this.direction = Direction.LEFT; // Classic Pac-Man starts facing left
    this.velocity = { dx: -this.speed, dy: 0 };
  }

  /** Per-tick update: apply movement with wall collision and pre-turn. */
  override update(_dt: number): void {
    if (this.state === PacmanState.DYING) return;
    if (!this.map) return;

    // Process buffered input (pre-turn buffering)
    if (this.nextDirection !== Direction.NONE && this.isGridAligned()) {
      // Snap to grid BEFORE collision check so that leading-edge probes
      // hit the correct tiles (a small drift can shift probes into walls).
      this.snapToGrid();
      const testVel = {
        dx: this.nextDirection === Direction.LEFT ? -this.speed :
             this.nextDirection === Direction.RIGHT ? this.speed : 0,
        dy: this.nextDirection === Direction.UP ? -this.speed :
             this.nextDirection === Direction.DOWN ? this.speed : 0,
      };
      if (this.collision.canPacmanMove(this.position, testVel, this.map)) {
        this.setDirection(this.nextDirection, this.speed);
        this.nextDirection = Direction.NONE;
      }
    }

    // Check if current direction is blocked
    if (this.direction !== Direction.NONE &&
        !this.collision.canPacmanMove(this.position, this.velocity, this.map)) {
      if (this.isGridAligned()) {
        this.velocity = { dx: 0, dy: 0 };
      }
    }

    // Apply movement
    this.applyMovement(MAP_COLS, MAP_ROWS);
  }
}