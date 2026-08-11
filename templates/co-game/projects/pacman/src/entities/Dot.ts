/**
 * Pac-Man - Dot
 *
 * Simple class representing a dot on a tile.
 * Dots are collectibles worth 10 points each.
 */
import { TileType } from "../config/types";

export class Dot {
  /** Check if a tile type represents a dot. */
  static isDotTile(tileType: TileType): boolean {
    return tileType === TileType.DOT;
  }
}
