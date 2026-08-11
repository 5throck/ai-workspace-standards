/**
 * Pac-Man - Power Pellet
 *
 * Simple class representing a power pellet on a tile.
 * Power pellets are collectibles worth 50 points each
 * and activate frightened mode for all ghosts.
 */
import { TileType } from "../config/types";

export class PowerPellet {
  /** Check if a tile type represents a power pellet. */
  static isPowerPelletTile(tileType: TileType): boolean {
    return tileType === TileType.POWER_PELLET;
  }
}
