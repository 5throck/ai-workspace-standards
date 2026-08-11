/**
 * Pac-Man - Ghost Base (Abstract)
 *
 * Abstract base for all ghost entities. Implements target-based pathfinding
 * at intersections with the no-U-turn rule, mode management, and speed
 * variation by mode (normal, frightened, eaten, tunnel).
 */
import {
  Direction,
  GhostMode,
  GhostName,
  TileType,
} from "../config/types";
import type {
  TileCoord,
  MapData,
  GhostTargetStrategy,
} from "../config/types";
import {
  GHOST_BASE_SPEED,
  GHOST_FRIGHTENED_SPEED,
  GHOST_EATEN_SPEED,
  GHOST_IN_HOUSE_SPEED,
  GHOST_TUNNEL_SPEED,
  TILE_SIZE,
  MAP_COLS,
  HUD_OFFSET_Y,
  GHOST_HOUSE_CENTER_COL,
  GHOST_HOUSE_EXIT_ROW,
  GHOST_HOUSE_ENTRY_COL,
  GHOST_HOUSE_ENTRY_ROW,
  TUNNEL_SPEED_ZONE_LEFT,
  TUNNEL_SPEED_ZONE_RIGHT,
} from "../config/constants";
import { EntityBase, oppositeDirection } from "./EntityBase";
import { CollisionSystem } from "../engine/CollisionSystem";
import { snapToward, isNear } from "../utils/vector";

export abstract class GhostBase extends EntityBase {
  mode: GhostMode = GhostMode.SCATTER;
  readonly name: GhostName;
  protected targetStrategy: GhostTargetStrategy;
  protected collision: CollisionSystem;
  protected map: MapData | null = null;

  // Current target tile for pathfinding
  protected currentTarget: TileCoord = { col: 0, row: 0 };

  // Pac-Man reference for target calculations
  protected pacmanTile: TileCoord = { col: 14, row: 23 };
  protected pacmanDirection: Direction = Direction.NONE;

  // References to other ghosts (needed for Inky)
  protected ghostPositions: Record<GhostName, TileCoord> = {
    [GhostName.BLINKY]: { col: GHOST_HOUSE_CENTER_COL, row: GHOST_HOUSE_EXIT_ROW },
    [GhostName.PINKY]:  { col: 13, row: 14 },
    [GhostName.INKY]:   { col: 11, row: 14 },
    [GhostName.CLYDE]:  { col: 15, row: 14 },
  };

  constructor(
    name: GhostName,
    strategy: GhostTargetStrategy,
    collision: CollisionSystem,
  ) {
    super();
    this.name = name;
    this.targetStrategy = strategy;
    this.collision = collision;
  }

  /** Provide the map data for collision checks. */
  setMap(map: MapData): void {
    this.map = map;
  }

  /** Update Pac-Man tile and direction (called each tick by the game). */
  updatePacmanInfo(tile: TileCoord, dir: Direction): void {
    this.pacmanTile = tile;
    this.pacmanDirection = dir;
  }

  /** Update all ghost positions (needed for Inky target calculation). */
  updateGhostPositions(positions: Record<GhostName, TileCoord>): void {
    this.ghostPositions = positions;
  }

  /**
   * Set ghost mode. Reverses direction per REVERSAL_TABLE, keyed on the
   * (prevMode, newMode) pair. See REVERSAL_TABLE below for the full rule set
   * (locked in by tests/ghost-mode-reversal.test.ts).
   */
  setMode(newMode: GhostMode): void {
    const prevMode = this.mode;
    this.mode = newMode;

    if (shouldReverseOnTransition(prevMode, newMode)) {
      this.reverseDirection();
    }
  }

  /** Get the ghost current mode. */
  getMode(): GhostMode {
    return this.mode;
  }

  /** Calculate the current target tile based on mode and strategy. */
  getTarget(): TileCoord {
    switch (this.mode) {
      case GhostMode.SCATTER:
      case GhostMode.CHASE:
        return this.targetStrategy.getTarget(
          this.tileCoord(),
          this.pacmanTile,
          this.ghostPositions,
        );
      case GhostMode.FRIGHTENED:
        return { col: 0, row: 0 };
      case GhostMode.EATEN:
        return { col: GHOST_HOUSE_ENTRY_COL, row: GHOST_HOUSE_ENTRY_ROW };
      case GhostMode.IN_HOUSE:
        return { col: GHOST_HOUSE_ENTRY_COL, row: GHOST_HOUSE_ENTRY_ROW };
      case GhostMode.LEAVING_HOUSE:
        return { col: GHOST_HOUSE_CENTER_COL, row: GHOST_HOUSE_EXIT_ROW };
      default:
        return { col: 0, row: 0 };
    }
  }

  /** Per-tick update: target-based pathfinding, mode-based speed. */
  override update(_dt: number): void {
    if (!this.map) return;

    if (this.mode === GhostMode.IN_HOUSE || this.mode === GhostMode.LEAVING_HOUSE) {
      this.updateHouseMovement();
      return;
    }

    const speed = this.getCurrentSpeed();
    this.currentTarget = this.getTarget();

    if (this.isGridAligned()) {
      this.chooseDirection(speed);
    }

    this.applyMovement(MAP_COLS, this.map.tunnelRow);
  }

  // -- Protected Helpers ----------------------------------------------------

  /** Get speed based on current mode and tunnel position. */
  protected getCurrentSpeed(): number {
    if (this.map) {
      const tile = this.tileCoord();
      if (tile.row === this.map.tunnelRow &&
          (tile.col <= TUNNEL_SPEED_ZONE_LEFT || tile.col >= TUNNEL_SPEED_ZONE_RIGHT)) {
        return GHOST_TUNNEL_SPEED;
      }
    }

    switch (this.mode) {
      case GhostMode.SCATTER:
      case GhostMode.CHASE:
        return GHOST_BASE_SPEED;
      case GhostMode.FRIGHTENED:
        return GHOST_FRIGHTENED_SPEED;
      case GhostMode.EATEN:
        return GHOST_EATEN_SPEED;
      case GhostMode.IN_HOUSE:
        return GHOST_IN_HOUSE_SPEED;
      case GhostMode.LEAVING_HOUSE:
        return GHOST_IN_HOUSE_SPEED;
      default:
        return GHOST_BASE_SPEED;
    }
  }

  /**
   * Choose direction at an intersection using target-based pathfinding.
   * Evaluates all valid directions (not reverse, not wall), picks the
   * one minimizing Euclidean distance to target.
   * Tie-breaking priority: UP > LEFT > DOWN > RIGHT.
   * In FRIGHTENED mode, choose randomly among valid directions.
   */
  protected chooseDirection(speed: number): void {
    if (!this.map) return;

    const tile = this.tileCoord();
    const directions = this.getValidDirections(tile);

    if (directions.length === 0) return;

    if (directions.length === 1) {
      this.setDirection(directions[0], speed);
      return;
    }

    if (this.mode === GhostMode.FRIGHTENED) {
      // Exclude reverse direction (no-U-turn rule applies even when frightened)
      const reverse = this.direction !== Direction.NONE
        ? oppositeDirection(this.direction) : Direction.NONE;
      const validDirs = directions.filter(d => d !== reverse);
      if (validDirs.length > 0) {
        const idx = Math.floor(Math.random() * validDirs.length);
        this.setDirection(validDirs[idx], speed);
      } else if (directions.length > 0) {
        // Dead end — must reverse
        const idx = Math.floor(Math.random() * directions.length);
        this.setDirection(directions[idx], speed);
      }
      return;
    }

    const reverse = this.direction !== Direction.NONE
      ? oppositeDirection(this.direction) : Direction.NONE;

    let bestDir = directions[0];
    let bestDist = Infinity;

    for (const dir of directions) {
      if (dir === reverse) continue;

      const nextTile = this.getNextTileInDirection(tile, dir);
      const dist = euclideanDist(nextTile, this.currentTarget);

      if (dist < bestDist ||
          (dist === bestDist && directionPriority(dir) < directionPriority(bestDir))) {
        bestDist = dist;
        bestDir = dir;
      }
    }

    this.setDirection(bestDir, speed);
  }

  /**
   * Get all valid (non-wall) directions from a tile.
   */
  protected getValidDirections(tile: TileCoord): Direction[] {
    if (!this.map) return [];

    const dirs: Direction[] = [];
    const candidates: Direction[] = [
      Direction.UP,
      Direction.LEFT,
      Direction.DOWN,
      Direction.RIGHT,
    ];

    for (const dir of candidates) {
      const nextTile = this.getNextTileInDirection(tile, dir);
      const tileType = this.getTileTypeAt(nextTile);
      if (this.isPassableForMode(tileType)) {
        dirs.push(dir);
      }
    }

    return dirs;
  }

  /** Get the tile one step in the given direction from a source tile. */
  protected getNextTileInDirection(tile: TileCoord, dir: Direction): TileCoord {
    switch (dir) {
      case Direction.UP:    return { col: tile.col, row: tile.row - 1 };
      case Direction.DOWN:  return { col: tile.col, row: tile.row + 1 };
      case Direction.LEFT:  return { col: tile.col - 1, row: tile.row };
      case Direction.RIGHT: return { col: tile.col + 1, row: tile.row };
      default:              return { ...tile };
    }
  }

  /** Get the tile type at a given coordinate. Wraps columns for tunnel. */
  protected getTileTypeAt(coord: TileCoord): TileType {
    if (!this.map) return TileType.WALL;
    const col = coord.col;
    const row = coord.row;
    if (row < 0 || row >= this.map.tiles.length) {
      return TileType.WALL;
    }
    // Wrap column for tunnel pathfinding
    const wrappedCol = ((col % this.map.tiles[0].length) + this.map.tiles[0].length) % this.map.tiles[0].length;
    return this.map.tiles[row][wrappedCol];
  }

  /** Check if a tile is passable for the ghost current mode. */
  protected isPassableForMode(tile: TileType): boolean {
    if (tile === TileType.EMPTY || tile === TileType.DOT ||
        tile === TileType.POWER_PELLET || tile === TileType.TUNNEL ||
        tile === TileType.FRUIT_SPAWN) {
      return true;
    }
    if ((this.mode === GhostMode.EATEN || this.mode === GhostMode.LEAVING_HOUSE) &&
        (tile === TileType.GHOST_HOUSE_DOOR || tile === TileType.GHOST_HOUSE)) {
      return true;
    }
    return false;
  }

  /** Reverse current direction (U-turn on mode change). */
  protected reverseDirection(): void {
    if (this.direction === Direction.NONE) return;
    const speed = this.getCurrentSpeed();
    this.setDirection(oppositeDirection(this.direction), speed);
  }

  /**
   * Handle movement inside or leaving the ghost house.
   * Uses pixel-position target tracking for robust state transitions.
   *
   * IN_HOUSE: Ghost bobs horizontally toward col 14 center.
   * LEAVING_HOUSE: Ghost centers on col 14, then moves up through
   * the door tile. When it passes row 11, it snaps to the exact
   * tile center above the door — main.ts then detects this and
   * switches the ghost to SCATTER/CHASE.
   */
  private updateHouseMovement(): void {
    if (!this.map) return;

    const speed = GHOST_IN_HOUSE_SPEED;
    const centerX = GHOST_HOUSE_CENTER_COL * TILE_SIZE + TILE_SIZE / 2;

    if (this.mode === GhostMode.IN_HOUSE) {
      // Bob toward center column, snapping once within tolerance.
      this.position.x = snapToward(this.position.x, centerX, speed);
    } else if (this.mode === GhostMode.LEAVING_HOUSE) {
      // Phase 1: center on col 14 before moving up.
      if (!isNear(this.position.x, centerX)) {
        this.position.x = snapToward(this.position.x, centerX, speed);
        return;
      }
      this.position.x = centerX;

      // Phase 2: move upward
      this.position.y -= speed;

      // When passing row 11 boundary, snap to exact tile center (14, 11).
      // This ensures tileCoord() returns row 11 so main.ts detects exit.
      const exitY = GHOST_HOUSE_EXIT_ROW * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y;
      if (this.position.y <= exitY) {
        this.position.x = centerX;
        this.position.y = exitY;
      }
    }
  }
}


// -- Utility Functions ------------------------------------------------------

/**
 * Explicit reversal table keyed by previous mode: lists which new modes
 * trigger a direction reversal when transitioning FROM that previous mode.
 * FRIGHTENED is intentionally absent as a key — leaving FRIGHTENED never
 * reverses, regardless of the new mode (highest-precedence rule, checked
 * first in shouldReverseOnTransition). Locked in by
 * tests/ghost-mode-reversal.test.ts.
 */
const REVERSAL_TABLE: Partial<Record<GhostMode, GhostMode[]>> = {
  [GhostMode.SCATTER]: [GhostMode.SCATTER, GhostMode.CHASE, GhostMode.FRIGHTENED, GhostMode.EATEN],
  [GhostMode.CHASE]: [GhostMode.SCATTER, GhostMode.CHASE, GhostMode.FRIGHTENED, GhostMode.EATEN],
  [GhostMode.IN_HOUSE]: [GhostMode.EATEN],
  [GhostMode.LEAVING_HOUSE]: [GhostMode.EATEN],
  [GhostMode.EATEN]: [GhostMode.EATEN],
};

/** Whether a mode transition should trigger a direction reversal. */
function shouldReverseOnTransition(prevMode: GhostMode, newMode: GhostMode): boolean {
  if (prevMode === GhostMode.FRIGHTENED) return false;
  return REVERSAL_TABLE[prevMode]?.includes(newMode) ?? false;
}

/** Euclidean distance between two tile coordinates. */
function euclideanDist(a: TileCoord, b: TileCoord): number {
  const dx = a.col - b.col;
  const dy = a.row - b.row;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Direction priority for tie-breaking: UP=0, LEFT=1, DOWN=2, RIGHT=3. */
function directionPriority(dir: Direction): number {
  switch (dir) {
    case Direction.UP:    return 0;
    case Direction.LEFT:  return 1;
    case Direction.DOWN:  return 2;
    case Direction.RIGHT: return 3;
    default:              return 4;
  }
}
