/**
 * Pac-Man — Vector Math Utilities
 * Helper functions for position, tile coordinate, and alignment calculations.
 */

import type { Position, TileCoord } from '../config/types';
import { TILE_SIZE, ALIGNMENT_TOLERANCE, HUD_OFFSET_Y } from '../config/constants';

/**
 * Calculate the Euclidean distance between two positions.
 */
export function distance(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Convert a tile coordinate to the center pixel position.
 * Applies the HUD vertical offset so maze pixel coordinates
 * are relative to the canvas (maze starts below HUD).
 */
export function tileToPixel(coord: TileCoord, offsetY: number = HUD_OFFSET_Y): Position {
  return {
    x: coord.col * TILE_SIZE + TILE_SIZE / 2,
    y: coord.row * TILE_SIZE + TILE_SIZE / 2 + offsetY,
  };
}

/**
 * Convert a pixel position to the nearest tile coordinate.
 * Accounts for the HUD vertical offset.
 */
export function pixelToTile(pos: Position, offsetY: number = HUD_OFFSET_Y): TileCoord {
  return {
    col: Math.floor(pos.x / TILE_SIZE),
    row: Math.floor((pos.y - offsetY) / TILE_SIZE),
  };
}

/**
 * Check whether a pixel position is aligned to the tile grid center
 * within the given tolerance (in pixels).
 * Both x and y must be within tolerance of their respective tile center.
 */
export function isAligned(pos: Position, tolerance: number = ALIGNMENT_TOLERANCE): boolean {
  // Use safe modulo to handle negative positions (e.g., during tunnel wrapping)
  const offsetX = ((pos.x % TILE_SIZE) + TILE_SIZE) % TILE_SIZE - TILE_SIZE / 2;
  const offsetY = (((pos.y - HUD_OFFSET_Y) % TILE_SIZE) + TILE_SIZE) % TILE_SIZE - TILE_SIZE / 2;
  return Math.abs(offsetX) <= tolerance && Math.abs(offsetY) <= tolerance;
}

/**
 * Clamp a numeric value between a minimum and maximum.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Move a value toward a target by at most `step`, clamped so it never
 * overshoots. Used for tile-snapped movement (e.g. ghost house exit).
 */
export function snapToward(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return target;
}

/**
 * Check whether two pixel values are within tolerance of each other.
 * Shares ALIGNMENT_TOLERANCE with isAligned() so "close enough to snap"
 * means the same thing everywhere in the codebase.
 */
export function isNear(a: number, b: number, tolerance: number = ALIGNMENT_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}
