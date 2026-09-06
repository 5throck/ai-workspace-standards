/**
 * Pac-Man - Blinky (Red Ghost)
 *
 * Direct chase AI. Always targets Pac-Man's current tile.
 * Scatter target: top-right corner (25, -2).
 */
import { GhostName, GhostMode, Direction } from "../config/types";
import type { TileCoord, GhostTargetStrategy } from "../config/types";
import { SCATTER_TARGETS, GHOST_BASE_SPEED } from "../config/constants";

import { GhostBase } from "./GhostBase";
import { CollisionSystem } from "../engine/CollisionSystem";

/** Placeholder strategy - actual logic is in override getTarget. */
const BLINKY_STRATEGY: GhostTargetStrategy = {
  getTarget(
    _ghost: TileCoord,
    pacman: TileCoord,
  ): TileCoord {
    return { col: pacman.col, row: pacman.row };
  },
};

export class Blinky extends GhostBase {
  constructor(collision: CollisionSystem) {
    super(GhostName.BLINKY, BLINKY_STRATEGY, collision);
  }

  /**
   * Chase target: Pac-Man's current tile.
   * Scatter target: top-right corner (25, -2).
   */
  getTarget(): TileCoord {
    if (this.getMode() === GhostMode.SCATTER) {
      return { ...SCATTER_TARGETS[GhostName.BLINKY] };
    }

    if (this.getMode() === GhostMode.CHASE) {
      return { col: this.pacmanTile.col, row: this.pacmanTile.row };
    }

    // FRIGHTENED, EATEN, IN_HOUSE, LEAVING_HOUSE - delegate to base
    return super.getTarget();
  }

  /** Blinky starts outside the ghost house, already active in SCATTER. */
  reset(start: TileCoord): void {
    super.reset(start);
    this.setElroyLevel(0);
    this.setDirection(Direction.LEFT, GHOST_BASE_SPEED);
  }

  /** Blinky is the only ghost affected by Cruise Elroy. */
  protected isElroy(): boolean {
    return true;
  }
}
