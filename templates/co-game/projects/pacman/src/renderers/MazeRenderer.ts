/**
 * Pac-Man - Maze Renderer
 *
 * Procedural Canvas 2D rendering for the maze: walls (blue outlines),
 * dots, power pellets (pulsing), and ghost house door.
 * Static wall geometry is cached to an offscreen canvas for performance.
 * See asset-spec.md Section 3 for exact specifications.
 */
import { TileType } from '../config/types';
import { TILE_SIZE } from '../config/constants';

export class MazeRenderer {
  private wallCache: HTMLCanvasElement | null = null;
  private cachedMapHash: string = '';

  /**
   * Draw the complete maze: walls, dots, and power pellets.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
    elapsed: number,
  ): void {
    this.drawWalls(ctx, tiles, offsetY);
    this.drawDots(ctx, tiles, offsetY);
    this.drawPowerPellets(ctx, tiles, offsetY, elapsed);
    this.drawGhostHouseDoor(ctx, tiles, offsetY);
  }

  /**
   * Draw walls only (no dots/pellets). Used for MENU and GAME_OVER screens.
   */
  drawWallsOnly(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
  ): void {
    this.drawWalls(ctx, tiles, offsetY);
  }

  /**
   * Draw walls with alternating blue/white flash effect (level complete).
   * Flashes every 250ms.
   */
  drawFlash(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
    elapsed: number,
  ): void {
    const isWhite = Math.floor(elapsed / 250) % 2 === 0;
    const color = isWhite ? '#FFFFFF' : '#2121DE';
    this.drawWallLines(ctx, tiles, offsetY, color);
  }

  /** Invalidate the wall cache (must be called when map changes). */
  invalidateCache(): void {
    this.wallCache = null;
    this.cachedMapHash = '';
  }

  // -- Private Methods --------------------------------------------------------

  /** Draw walls using cached offscreen canvas or render fresh. */
  private drawWalls(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
  ): void {
    const hash = this.computeMapHash(tiles);
    if (hash !== this.cachedMapHash || !this.wallCache) {
      this.rebuildWallCache(tiles, offsetY);
      this.cachedMapHash = hash;
    }
    if (this.wallCache) {
      ctx.drawImage(this.wallCache, 0, offsetY);
    }
  }

  /** Draw wall lines with a specific color. Used for flash effect. */
  private drawWallLines(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
    color: string,
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        if (tiles[row][col] !== TileType.WALL) continue;

        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE + offsetY;

        if (this.isPassable(tiles, row - 1, col)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + TILE_SIZE, y);
          ctx.stroke();
        }
        if (this.isPassable(tiles, row + 1, col)) {
          ctx.beginPath();
          ctx.moveTo(x, y + TILE_SIZE);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          ctx.stroke();
        }
        if (this.isPassable(tiles, row, col - 1)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + TILE_SIZE);
          ctx.stroke();
        }
        if (this.isPassable(tiles, row, col + 1)) {
          ctx.beginPath();
          ctx.moveTo(x + TILE_SIZE, y);
          ctx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          ctx.stroke();
        }
      }
    }
  }

  /** Draw all dot tiles as small white circles. */
  private drawDots(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
  ): void {
    ctx.fillStyle = '#FFFFFF';
    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        if (tiles[row][col] !== TileType.DOT) continue;
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2 + offsetY;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * Draw power pellets as pulsing white circles.
   * Radius oscillates between 5px and 7px with a 500ms cycle.
   */
  private drawPowerPellets(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
    elapsed: number,
  ): void {
    ctx.fillStyle = '#FFFFFF';
    const pulsePhase = (elapsed % 500) / 500;
    const radius = 5 + 2 * Math.sin(pulsePhase * Math.PI * 2);

    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        if (tiles[row][col] !== TileType.POWER_PELLET) continue;
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2 + offsetY;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Draw the ghost house door as a pink filled rectangle. */
  private drawGhostHouseDoor(
    ctx: CanvasRenderingContext2D,
    tiles: TileType[][],
    offsetY: number,
  ): void {
    ctx.fillStyle = '#FFB8FF';
    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        if (tiles[row][col] !== TileType.GHOST_HOUSE_DOOR) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE + offsetY;
        ctx.fillRect(x, y, TILE_SIZE, 2);
      }
    }
  }

  /** Check if a tile at (row, col) is passable for wall-edge detection. */
  private isPassable(tiles: TileType[][], row: number, col: number): boolean {
    if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) {
      return false;
    }
    const t = tiles[row][col];
    return t === TileType.EMPTY || t === TileType.DOT || t === TileType.POWER_PELLET ||
           t === TileType.TUNNEL || t === TileType.FRUIT_SPAWN;
  }

  /** Compute a simple hash of the tile array to detect changes. */
  private computeMapHash(tiles: TileType[][]): string {
    let count = 0;
    for (const row of tiles) {
      for (const tile of row) {
        if (tile !== TileType.WALL) count++;
      }
    }
    return String(count);
  }

  /** Rebuild the offscreen wall cache. */
  private rebuildWallCache(tiles: TileType[][], _offsetY: number): void {
    const width = tiles[0].length * TILE_SIZE;
    const height = tiles.length * TILE_SIZE;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    offCtx.strokeStyle = '#2121DE';
    offCtx.lineWidth = 2;

    for (let row = 0; row < tiles.length; row++) {
      for (let col = 0; col < tiles[row].length; col++) {
        if (tiles[row][col] !== TileType.WALL) continue;

        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        if (this.isPassable(tiles, row - 1, col)) {
          offCtx.beginPath();
          offCtx.moveTo(x, y);
          offCtx.lineTo(x + TILE_SIZE, y);
          offCtx.stroke();
        }
        if (this.isPassable(tiles, row + 1, col)) {
          offCtx.beginPath();
          offCtx.moveTo(x, y + TILE_SIZE);
          offCtx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          offCtx.stroke();
        }
        if (this.isPassable(tiles, row, col - 1)) {
          offCtx.beginPath();
          offCtx.moveTo(x, y);
          offCtx.lineTo(x, y + TILE_SIZE);
          offCtx.stroke();
        }
        if (this.isPassable(tiles, row, col + 1)) {
          offCtx.beginPath();
          offCtx.moveTo(x + TILE_SIZE, y);
          offCtx.lineTo(x + TILE_SIZE, y + TILE_SIZE);
          offCtx.stroke();
        }
      }
    }

    this.wallCache = offscreen;
  }
}
