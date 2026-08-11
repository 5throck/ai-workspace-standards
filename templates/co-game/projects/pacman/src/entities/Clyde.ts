/**
 * Pac-Man - Clyde (Orange Ghost)
 *
 * Shy AI. Chases Pac-Man when far (>8 tiles), retreats to scatter
 * corner when close (<=8 tiles).
 * Scatter target: bottom-left corner (0, 34).
 */
import { GhostName, GhostMode } from "../config/types";
import type { TileCoord, GhostTargetStrategy } from "../config/types";
import { CLYDE_CHASE_THRESHOLD } from "../config/constants";
import { GhostBase } from "./GhostBase";
import { CollisionSystem } from "../engine/CollisionSystem";

/** Placeholder strategy - actual chase logic is in override getTarget. */
const CLYDE_STRATEGY: GhostTargetStrategy = {
  getTarget(
    _ghost: TileCoord,
    pacman: TileCoord,
  ): TileCoord {
    return { col: pacman.col, row: pacman.row };
  },
};

export class Clyde extends GhostBase {
  constructor(collision: CollisionSystem) {
    super(GhostName.CLYDE, CLYDE_STRATEGY, collision);
  }

  /**
   * Override getTarget to implement shy behavior.
   * If distance to Pac-Man > 8 tiles: target = pacman tile.
   * If distance <= 8 tiles: target = scatter corner (0, 34).
   */
  getTarget(): TileCoord {
    if (this.getMode() === GhostMode.SCATTER) {
      return { col: 0, row: 34 };
    }

    if (this.getMode() === GhostMode.CHASE) {
      const ghostTile = this.tileCoord();
      const dx = ghostTile.col - this.pacmanTile.col;
      const dy = ghostTile.row - this.pacmanTile.row;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > CLYDE_CHASE_THRESHOLD) {
        return { col: this.pacmanTile.col, row: this.pacmanTile.row };
      } else {
        // Too close - retreat to scatter corner
        return { col: 0, row: 34 };
      }
    }

    // FRIGHTENED, EATEN, IN_HOUSE, LEAVING_HOUSE - delegate to base
    return super.getTarget();
  }

  reset(start: TileCoord): void {
    super.reset(start);
  }
}
