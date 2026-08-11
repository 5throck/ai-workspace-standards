import { describe, it, expect } from 'vitest';
import { parseStage } from '../maps/StageParser';
import { STAGE_1 } from '../maps/StageData';

function makeRows(rowCount: number, rowLength: number): string[] {
  return new Array(rowCount).fill('.'.repeat(rowLength));
}

describe('parseStage', () => {
  it('throws when the row count is not 28', () => {
    expect(() => parseStage(makeRows(27, 32))).toThrow();
    expect(() => parseStage(makeRows(29, 32))).toThrow();
  });

  it('throws when a row length is not 32', () => {
    const rows = makeRows(28, 32);
    rows[5] = '.'.repeat(31); // too short
    expect(() => parseStage(rows)).toThrow();

    const rows2 = makeRows(28, 32);
    rows2[10] = '.'.repeat(33); // too long
    expect(() => parseStage(rows2)).toThrow();
  });

  it('throws on an invalid character', () => {
    const rows = makeRows(28, 32);
    rows[3] = '.'.repeat(31) + 'X';
    expect(() => parseStage(rows)).toThrow();
  });

  it('parses STAGE_1 into a TileMap with correct tile values at known coordinates', () => {
    const map = parseStage(STAGE_1);

    // Corners: top-left and top-right are solid wall (row 0).
    expect(map.getTile(0, 0)).toBe(1);
    expect(map.getTile(31, 0)).toBe(1);

    // Bottom-left and bottom-right corners are solid wall (row 27).
    expect(map.getTile(0, 27)).toBe(1);
    expect(map.getTile(31, 27)).toBe(1);

    // Ceiling wrap hole (row 0, col 15) is empty.
    expect(map.getTile(15, 0)).toBe(0);

    // Floor wrap hole (row 27, col 15) is empty.
    expect(map.getTile(15, 27)).toBe(0);

    // Left/right outer walls at an arbitrary middle row are solid.
    expect(map.getTile(0, 14)).toBe(1);
    expect(map.getTile(31, 14)).toBe(1);

    // Lower platform one-way tile (row 21, col 5).
    expect(map.getTile(5, 21)).toBe(2);

    // Middle platform one-way tile (row 15, col 10).
    expect(map.getTile(10, 15)).toBe(2);

    // Upper platform one-way tile (row 9, col 5).
    expect(map.getTile(5, 9)).toBe(2);

    // Solid block structure (row 26, col 4).
    expect(map.getTile(4, 26)).toBe(1);

    // Open floor area (row 10, col 15) is empty.
    expect(map.getTile(15, 10)).toBe(0);
  });
});
