/**
 * Pac-Man - Inky (Cyan Ghost)
 *
 * Flanking AI. Uses Blinky's position as a pivot for target calculation.
 * Chase target: 2 * blinky_pos - (pacman_pos + direction * 2).
 * Scatter target: bottom-right corner (27, 34).
 */
import { GhostName, GhostMode, Direction } from "../config/types";
import type { TileCoord, GhostTargetStrategy } from "../config/types";
import { INKY_PIVOT_OFFSET } from "../config/constants";
import { GhostBase } from "./GhostBase";
import { CollisionSystem } from "../engine/CollisionSystem";

/** Placeholder strategy - actual chase logic is in override getTarget. */
const INKY_STRATEGY: GhostTargetStrategy = {
  getTarget(
    _ghost: TileCoord,
    pacman: TileCoord,
  ): TileCoord {
    return { col: pacman.col, row: pacman.row };
  },
};

export class Inky extends GhostBase {
  constructor(collision: CollisionSystem) {
    super(GhostName.INKY, INKY_STRATEGY, collision);
  }

  /**
   * Override getTarget to implement flanking logic using Blinky as pivot.
   * pivot = pacman_tile + (pacman_direction * 2)
   * target = 2 * blinky_position - pivot
   */
  getTarget(): TileCoord {
    if (this.getMode() === GhostMode.SCATTER) {
      return { col: 27, row: 34 };
    }

    if (this.getMode() === GhostMode.CHASE) {
      const dir = this.pacmanDirection;

      // If Pac-Man has no direction, target his current tile (same as Blinky)
      if (dir === Direction.NONE) {
        return { col: this.pacmanTile.col, row: this.pacmanTile.row };
      }

      const pivot = { col: this.pacmanTile.col, row: this.pacmanTile.row };

      // Calculate pivot point: 2 tiles ahead of Pac-Man
      switch (dir) {
        case Direction.UP:    pivot.row -= INKY_PIVOT_OFFSET; break;
        case Direction.DOWN:  pivot.row += INKY_PIVOT_OFFSET; break;
        case Direction.LEFT:  pivot.col -= INKY_PIVOT_OFFSET; break;
        case Direction.RIGHT: pivot.col += INKY_PIVOT_OFFSET; break;
        default: break;
      }

      // Get Blinky's current position
      const blinky = this.ghostPositions[GhostName.BLINKY];

      // target = 2 * blinky - pivot (vector reflection of pivot through Blinky)
      const targetCol = 2 * blinky.col - pivot.col;
      const targetRow = 2 * blinky.row - pivot.row;

      return { col: targetCol, row: targetRow };
    }

    // FRIGHTENED, EATEN, IN_HOUSE, LEAVING_HOUSE - delegate to base
    return super.getTarget();
  }

  reset(start: TileCoord): void {
    super.reset(start);
  }
}
