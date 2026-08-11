/**
 * Pac-Man - Pinky (Pink Ghost)
 *
 * Ambush AI. Targets 4 tiles ahead of Pac-Man in Pac-Man's current direction.
 * When Pac-Man faces UP, the target is 4 tiles UP and 4 tiles LEFT (classic bug).
 * Scatter target: top-left corner (2, -2).
 */
import { GhostName, GhostMode, Direction } from "../config/types";
import type { TileCoord, GhostTargetStrategy } from "../config/types";
import { PINKY_TARGET_OFFSET } from "../config/constants";
import { GhostBase } from "./GhostBase";
import { CollisionSystem } from "../engine/CollisionSystem";

/** Placeholder strategy - actual chase logic is in override getTarget. */
const PINKY_STRATEGY: GhostTargetStrategy = {
  getTarget(
    _ghost: TileCoord,
    pacman: TileCoord,
  ): TileCoord {
    return { col: pacman.col, row: pacman.row };
  },
};

export class Pinky extends GhostBase {
  constructor(collision: CollisionSystem) {
    super(GhostName.PINKY, PINKY_STRATEGY, collision);
  }

  /**
   * Override getTarget to implement ambush logic with the classic UP bug.
   * Chase target: 4 tiles ahead of Pac-Man in his current direction.
   * Scatter target: (2, -2).
   */
  getTarget(): TileCoord {
    if (this.getMode() === GhostMode.SCATTER) {
      return { col: 2, row: -2 };
    }

    if (this.getMode() === GhostMode.CHASE) {
      const offset = PINKY_TARGET_OFFSET;
      const dir = this.pacmanDirection;

      // If Pac-Man has no direction, target his current tile
      if (dir === Direction.NONE) {
        return { col: this.pacmanTile.col, row: this.pacmanTile.row };
      }

      let targetCol = this.pacmanTile.col;
      let targetRow = this.pacmanTile.row;

      switch (dir) {
        case Direction.UP:
          // Classic UP bug: 4 UP + 4 LEFT
          targetRow -= offset;
          targetCol -= offset;
          break;
        case Direction.DOWN:
          targetRow += offset;
          break;
        case Direction.LEFT:
          targetCol -= offset;
          break;
        case Direction.RIGHT:
          targetCol += offset;
          break;
        default:
          break;
      }

      return { col: targetCol, row: targetRow };
    }

    // FRIGHTENED, EATEN, IN_HOUSE, LEAVING_HOUSE - delegate to base
    return super.getTarget();
  }

  reset(start: TileCoord): void {
    super.reset(start);
  }
}
