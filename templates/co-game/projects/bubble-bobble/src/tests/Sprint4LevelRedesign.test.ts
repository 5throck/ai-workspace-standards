import { describe, it, expect } from 'vitest';
import { parseStage } from '../maps/StageParser';
import {
  STAGE_1,
  STAGE_2,
  STAGE_3,
  STAGE_4,
  STAGE_5,
  STAGE_6,
  STAGE_7,
  STAGE_8,
  STAGE_9,
  STAGE_10,
  STAGE_11,
  STAGE_12,
  STAGE_13,
  STAGE_14,
  STAGE_15,
  STAGE_16,
  STAGE_17,
  STAGE_18,
  STAGE_19,
  STAGE_20,
} from '../maps/StageData';
import { STAGE_META } from '../maps/StageMeta';
import { STAGE_FACTORIES } from '../maps/Stages';

const ALL_STAGES: Array<[string, string[]]> = [
  ['STAGE_1', STAGE_1],
  ['STAGE_2', STAGE_2],
  ['STAGE_3', STAGE_3],
  ['STAGE_4', STAGE_4],
  ['STAGE_5', STAGE_5],
  ['STAGE_6', STAGE_6],
  ['STAGE_7', STAGE_7],
  ['STAGE_8', STAGE_8],
  ['STAGE_9', STAGE_9],
  ['STAGE_10', STAGE_10],
  ['STAGE_11', STAGE_11],
  ['STAGE_12', STAGE_12],
  ['STAGE_13', STAGE_13],
  ['STAGE_14', STAGE_14],
  ['STAGE_15', STAGE_15],
  ['STAGE_16', STAGE_16],
  ['STAGE_17', STAGE_17],
  ['STAGE_18', STAGE_18],
  ['STAGE_19', STAGE_19],
  ['STAGE_20', STAGE_20],
];

const VALID_CHARS = new Set(['#', '=', '.']);

describe('Sprint 4: 20-stage level redesign', () => {
  it('exposes exactly 20 stage arrays', () => {
    expect(ALL_STAGES.length).toBe(20);
  });

  it.each(ALL_STAGES)('%s is valid parseStage input (28 rows x 32 chars, only #/=/.)', (_name, rows) => {
    expect(rows.length).toBe(28);
    rows.forEach((row) => {
      expect(row.length).toBe(32);
      for (const ch of row) {
        expect(VALID_CHARS.has(ch)).toBe(true);
      }
    });

    // parseStage should not throw for any of the 20 stages.
    expect(() => parseStage(rows)).not.toThrow();
  });

  it('STAGE_FACTORIES has exactly 20 entries matching the stage data', () => {
    expect(STAGE_FACTORIES.length).toBe(20);
    STAGE_FACTORIES.forEach((factory) => {
      expect(() => factory()).not.toThrow();
    });
  });

  it('STAGE_META has exactly 20 entries', () => {
    expect(STAGE_META.length).toBe(20);
  });

  it('STAGE_META difficulty (enemyCount, enemySpeedMultiplier) is non-decreasing by stage index', () => {
    for (let i = 1; i < STAGE_META.length; i++) {
      expect(STAGE_META[i].enemyCount).toBeGreaterThanOrEqual(STAGE_META[i - 1].enemyCount);
      expect(STAGE_META[i].enemySpeedMultiplier).toBeGreaterThanOrEqual(STAGE_META[i - 1].enemySpeedMultiplier);
    }
  });

  it('each STAGE_META entry has a valid themeIndex and non-empty itemDropWeights', () => {
    STAGE_META.forEach((meta) => {
      expect(meta.themeIndex).toBeGreaterThanOrEqual(0);
      expect(Object.keys(meta.itemDropWeights).length).toBeGreaterThan(0);
    });
  });
});
