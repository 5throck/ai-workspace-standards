/**
 * Pac-Man - Collision System
 *
 * Tile-based wall collision, entity-entity collision, and dot collection.
 * Uses leading-edge tile checking and grid-alignment helpers.
 */
import { TileType, GhostMode } from '../config/types';
import type { Position, Velocity, TileCoord, MapData } from '../config/types';
import { TILE_SIZE, HALF_ENTITY_SIZE, HUD_OFFSET_Y } from '../config/constants';

/** Tiles that Pac-Man can walk on. */
const PACMAN_PASSABLE = new Set<number>([
  TileType.EMPTY,
  TileType.DOT,
  TileType.POWER_PELLET,
  TileType.TUNNEL,
  TileType.FRUIT_SPAWN,
]);

/** Tiles passable by all ghosts. */
const GHOST_ALWAYS_PASSABLE = new Set<number>([
  TileType.EMPTY,
  TileType.DOT,
  TileType.POWER_PELLET,
  TileType.TUNNEL,
  TileType.FRUIT_SPAWN,
]);

/** Tiles passable only by EATEN or LEAVING_HOUSE ghosts. */
const GHOST_HOUSE_PASSABLE = new Set<number>([
  TileType.GHOST_HOUSE_DOOR,
  TileType.GHOST_HOUSE,
]);

export class CollisionSystem {
  // -- Tile Helpers ---------------------------------------------------------

  /** Get the TileType at a pixel position within the map. */
  private getTileAtPixel(x: number, y: number, map: MapData): TileType {
    const colCount = map.tiles[0].length;
    const col = Math.floor(x / TILE_SIZE);
    const row = Math.floor((y - HUD_OFFSET_Y) / TILE_SIZE);
    if (row < 0 || row >= map.tiles.length) {
      return TileType.WALL;
    }
    const wrappedCol = ((col % colCount) + colCount) % colCount;
    return map.tiles[row][wrappedCol];
  }

  /** Get the TileType at a tile coordinate. */
  private getTileAtCoord(coord: TileCoord, map: MapData): TileType {
    if (coord.row < 0 || coord.row >= map.tiles.length) {
      return TileType.WALL;
    }
    const colCount = map.tiles[0].length;
    const wrappedCol = ((coord.col % colCount) + colCount) % colCount;
    return map.tiles[coord.row][wrappedCol];
  }

  /** Check if a tile type is passable for Pac-Man. */
  private isPacmanPassable(tile: TileType): boolean {
    return PACMAN_PASSABLE.has(tile);
  }

  /** Check if a tile type is passable for a ghost in a specific mode. */
  private isGhostPassable(tile: TileType, mode: GhostMode): boolean {
    if (GHOST_ALWAYS_PASSABLE.has(tile)) return true;
    if ((mode === GhostMode.EATEN || mode === GhostMode.LEAVING_HOUSE) &&
        GHOST_HOUSE_PASSABLE.has(tile)) {
      return true;
    }
    return false;
  }

  // -- Public API -----------------------------------------------------------

  /**
   * Check if Pac-Man can move in the given velocity direction.
   * Checks the leading-edge tile(s) of the bounding box.
   */
  canPacmanMove(pos: Position, vel: Velocity, map: MapData): boolean {
    const halfSize = HALF_ENTITY_SIZE;
    const nextX = pos.x + vel.dx;
    const nextY = pos.y + vel.dy;

    // Determine which edges to check based on velocity direction
    if (vel.dx > 0) {
      // Moving right - check right edge corners
      const tile1 = this.getTileAtPixel(nextX + halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY + halfSize, map);
      return this.isPacmanPassable(tile1) && this.isPacmanPassable(tile2);
    } else if (vel.dx < 0) {
      // Moving left - check left edge corners
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX - halfSize, nextY + halfSize, map);
      return this.isPacmanPassable(tile1) && this.isPacmanPassable(tile2);
    }

    if (vel.dy > 0) {
      // Moving down - check bottom edge corners
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY + halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY + halfSize, map);
      return this.isPacmanPassable(tile1) && this.isPacmanPassable(tile2);
    } else if (vel.dy < 0) {
      // Moving up - check top edge corners
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY - halfSize, map);
      return this.isPacmanPassable(tile1) && this.isPacmanPassable(tile2);
    }

    // No velocity - no movement needed
    return true;
  }

  /**
   * Check if a ghost can move in the given velocity direction.
   * Ghost house door and interior are only passable in EATEN/LEAVING_HOUSE modes.
   */
  canGhostMove(pos: Position, vel: Velocity, map: MapData, mode: GhostMode): boolean {
    const halfSize = HALF_ENTITY_SIZE;
    const nextX = pos.x + vel.dx;
    const nextY = pos.y + vel.dy;

    if (vel.dx > 0) {
      const tile1 = this.getTileAtPixel(nextX + halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY + halfSize, map);
      return this.isGhostPassable(tile1, mode) && this.isGhostPassable(tile2, mode);
    } else if (vel.dx < 0) {
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX - halfSize, nextY + halfSize, map);
      return this.isGhostPassable(tile1, mode) && this.isGhostPassable(tile2, mode);
    }

    if (vel.dy > 0) {
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY + halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY + halfSize, map);
      return this.isGhostPassable(tile1, mode) && this.isGhostPassable(tile2, mode);
    } else if (vel.dy < 0) {
      const tile1 = this.getTileAtPixel(nextX - halfSize, nextY - halfSize, map);
      const tile2 = this.getTileAtPixel(nextX + halfSize, nextY - halfSize, map);
      return this.isGhostPassable(tile1, mode) && this.isGhostPassable(tile2, mode);
    }

    return true;
  }

  /**
   * General canMove - checks if an entity can move based on velocity.
   * Used for tile-based checking from the engine perspective.
   */
  canMove(pos: Position, vel: Velocity, map: MapData): boolean {
    return this.canPacmanMove(pos, vel, map);
  }

  /**
   * Check whether two entities occupy the same tile.
   * Simple tile-coordinate equality check.
   */
  checkEntityCollision(posA: Position, posB: Position): boolean {
    const colA = Math.floor(posA.x / TILE_SIZE);
    const rowA = Math.floor((posA.y - HUD_OFFSET_Y) / TILE_SIZE);
    const colB = Math.floor(posB.x / TILE_SIZE);
    const rowB = Math.floor((posB.y - HUD_OFFSET_Y) / TILE_SIZE);
    return colA === colB && rowA === rowB;
  }

  /**
   * Check if Pac-Man is standing on a collectible tile.
   * Returns the tile coordinate if the tile is a DOT or POWER_PELLET,
   * or null if not.
   */
  checkDotCollection(pacmanPos: Position, map: MapData): TileCoord | null {
    const col = Math.floor(pacmanPos.x / TILE_SIZE);
    const row = Math.floor((pacmanPos.y - HUD_OFFSET_Y) / TILE_SIZE);
    const tile = this.getTileAtCoord({ col, row }, map);
    if (tile === TileType.DOT || tile === TileType.POWER_PELLET) {
      return { col, row };
    }
    return null;
  }
}