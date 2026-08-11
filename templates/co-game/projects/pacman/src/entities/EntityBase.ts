/**
 * Pac-Man - Entity Base (Abstract)
 *
 * Base class for all game entities. Provides position, velocity, direction
 * management, tile coordinate calculation, grid-aligned movement, and
 * pre-turn buffering via nextDirection.
 */
import { Direction } from '../config/types';
import type { Position, Velocity, TileCoord } from '../config/types';
import { TILE_SIZE, HUD_OFFSET_Y } from '../config/constants';
import { tileToPixel, isAligned } from '../utils/vector';

export abstract class EntityBase {
  position: Position = { x: 0, y: 0 };
  velocity: Velocity = { dx: 0, dy: 0 };
  direction: Direction = Direction.NONE;
  nextDirection: Direction = Direction.NONE;

  /** Snap pixel position to the nearest tile center. */
  protected snapToGrid(): void {
    const col = Math.round((this.position.x - TILE_SIZE / 2) / TILE_SIZE);
    const row = Math.round((this.position.y - HUD_OFFSET_Y - TILE_SIZE / 2) / TILE_SIZE);
    this.position.x = col * TILE_SIZE + TILE_SIZE / 2;
    this.position.y = row * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y;
  }

  /** Get the tile coordinate of the entity's current position. */
  tileCoord(): TileCoord {
    return {
      col: Math.floor(this.position.x / TILE_SIZE),
      row: Math.floor((this.position.y - HUD_OFFSET_Y) / TILE_SIZE),
    };
  }

  /**
   * Check whether the entity is grid-aligned (within tolerance of tile center).
   */
  protected isGridAligned(): boolean {
    return isAligned(this.position);
  }

  /**
   * Set direction and update velocity accordingly.
   */
  protected setDirection(dir: Direction, speed: number): void {
    this.direction = dir;
    this.velocity = directionToVelocity(dir, speed);
  }

  /** Set nextDirection for pre-turn buffering. */
  setNextDirection(dir: Direction): void {
    this.nextDirection = dir;
  }

  /**
   * Apply pixel movement and handle tunnel wrapping.
   */
  protected applyMovement(mapWidth: number, _tunnelRow: number): void {
    this.position.x += this.velocity.dx;
    this.position.y += this.velocity.dy;

    // Tunnel wrapping: if x goes off the left or right edge of the map
    const mapPixelWidth = mapWidth * TILE_SIZE;
    if (this.position.x < 0) {
      this.position.x += mapPixelWidth;
    } else if (this.position.x >= mapPixelWidth) {
      this.position.x -= mapPixelWidth;
    }
  }

  /** Reset entity position to a tile coordinate's pixel center. */
  reset(start: TileCoord): void {
    this.position = tileToPixel(start);
    this.velocity = { dx: 0, dy: 0 };
    this.direction = Direction.NONE;
    this.nextDirection = Direction.NONE;
  }

  /** Must be implemented by subclasses for per-tick update logic. */
  abstract update(dt: number): void;
}


/**
 * Convert a Direction enum to a Velocity vector at the given speed.
 */
export function directionToVelocity(dir: Direction, speed: number): Velocity {
  switch (dir) {
    case Direction.UP:    return { dx: 0, dy: -speed };
    case Direction.DOWN:  return { dx: 0, dy: speed };
    case Direction.LEFT:  return { dx: -speed, dy: 0 };
    case Direction.RIGHT: return { dx: speed, dy: 0 };
    default:              return { dx: 0, dy: 0 };
  }
}

/**
 * Get the opposite direction (for U-turn detection).
 */
export function oppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case Direction.UP:    return Direction.DOWN;
    case Direction.DOWN:  return Direction.UP;
    case Direction.LEFT:  return Direction.RIGHT;
    case Direction.RIGHT: return Direction.LEFT;
    default:              return Direction.NONE;
  }
}