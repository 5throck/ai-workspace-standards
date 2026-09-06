import { EntityBase } from '../entities/EntityBase';

export class TileMap {
  public width: number = 32; // 32 columns
  public height: number = 28; // 28 rows
  public tileSize: number = 16; // 16px tiles -> 512x448 total resolution
  public grid: number[];

  constructor(grid?: number[]) {
    this.grid = grid || new Array(this.width * this.height).fill(0);
  }

  public getTile(col: number, row: number): number {
    if (col < 0 || col >= this.width) {
      return 1; // solid boundaries on left/right
    }
    if (row < 0 || row >= this.height) {
      return 0; // wrap zones at top/bottom are empty by default
    }
    return this.grid[row * this.width + col];
  }
}

export class CollisionSystem {
  /**
   * Simple AABB collision check between two dynamic entities.
   */
  public static checkAABB(e1: EntityBase, e2: EntityBase): boolean {
    return (
      e1.x < e2.x + e2.width &&
      e1.x + e1.width > e2.x &&
      e1.y < e2.y + e2.height &&
      e1.y + e1.height > e2.y
    );
  }

  /**
   * Checks entity collisions against the tilemap and resolves position.
   * Resolves Y axis first, then X axis (standard platformer implementation).
   */
  public static resolveMapCollisions(entity: EntityBase, map: TileMap, previousY: number): void {
    const ts = map.tileSize;

    // --- Y axis resolution ---
    entity.isGrounded = false;

    // Check bottom-left, bottom-center, bottom-right
    const checkBottom = (yVal: number) => {
      const row = Math.floor(yVal / ts);
      const startCol = Math.floor(entity.left / ts);
      const endCol = Math.floor((entity.right - 0.1) / ts);

      for (let col = startCol; col <= endCol; col++) {
        const tile = map.getTile(col, row);
        if (tile === 1) { // Solid
          return { row, tile };
        }
        if (tile === 2) { // OneWay platform
          // Only land if falling downwards and previous bottom was above platform top
          const prevBottom = previousY + entity.height;
          const platformTop = row * ts;
          if (entity.vy >= 0 && prevBottom <= platformTop + 1) {
            return { row, tile };
          }
        }
      }
      return null;
    };

    const checkTop = (yVal: number) => {
      const row = Math.floor(yVal / ts);
      const startCol = Math.floor(entity.left / ts);
      const endCol = Math.floor((entity.right - 0.1) / ts);

      for (let col = startCol; col <= endCol; col++) {
        const tile = map.getTile(col, row);
        if (tile === 1) { // Only solid blocks block head
          return { row, tile };
        }
      }
      return null;
    };

    if (entity.vy >= 0) {
      const hit = checkBottom(entity.bottom);
      if (hit) {
        entity.y = hit.row * ts - entity.height;
        entity.vy = 0;
        entity.isGrounded = true;
      }
    } else {
      const hit = checkTop(entity.top);
      if (hit) {
        entity.y = (hit.row + 1) * ts;
        entity.vy = 0;
      }
    }

    // --- X axis resolution ---
    // Check left/right collisions against solid walls (tile = 1)
    entity.touchingWall = 0;
    const checkHorizontal = (xVal: number) => {
      const col = Math.floor(xVal / ts);
      const startRow = Math.floor(entity.top / ts);
      const endRow = Math.floor((entity.bottom - 0.1) / ts);

      for (let row = startRow; row <= endRow; row++) {
        const tile = map.getTile(col, row);
        if (tile === 1) { // Only solid blocks stop horizontal movement
          return { col };
        }
      }
      return null;
    };

    if (entity.vx > 0) {
      const hit = checkHorizontal(entity.right);
      if (hit) {
        entity.x = hit.col * ts - entity.width;
        entity.vx = 0;
        entity.touchingWall = 1;
      }
    } else if (entity.vx < 0) {
      const hit = checkHorizontal(entity.left);
      if (hit) {
        entity.x = (hit.col + 1) * ts;
        entity.vx = 0;
        entity.touchingWall = -1;
      }
    }
  }
}
