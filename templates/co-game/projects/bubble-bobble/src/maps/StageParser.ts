import { TileMap } from '../systems/CollisionSystem';

const STAGE_COLS = 32;
const STAGE_ROWS = 28;

const TILE_CHAR_MAP: Record<string, number> = {
  '#': 1, // Solid
  '=': 2, // One-way platform
  '.': 0, // Empty
};

/**
 * Parses an ASCII stage layout (28 rows x 32 chars each) into a TileMap.
 * Character mapping: '#' = solid (1), '=' = one-way platform (2), '.' = empty (0).
 */
export function parseStage(rows: string[]): TileMap {
  if (rows.length !== STAGE_ROWS) {
    throw new Error(
      `parseStage: expected ${STAGE_ROWS} rows, got ${rows.length}`
    );
  }

  const grid = new Array(STAGE_COLS * STAGE_ROWS).fill(0);

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row.length !== STAGE_COLS) {
      throw new Error(
        `parseStage: row ${r} has length ${row.length}, expected ${STAGE_COLS}`
      );
    }

    for (let c = 0; c < STAGE_COLS; c++) {
      const ch = row[c];
      const tile = TILE_CHAR_MAP[ch];
      if (tile === undefined) {
        throw new Error(
          `parseStage: row ${r}, col ${c} has invalid character '${ch}'`
        );
      }
      grid[r * STAGE_COLS + c] = tile;
    }
  }

  return new TileMap(grid);
}
