import { TileMap } from '../systems/CollisionSystem';
import { parseStage } from './StageParser';
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
} from './StageData';

// Stage layouts: 32 columns x 28 rows.
// 0 = Empty, 1 = Solid wall/block, 2 = One-Way platform

export function createStage1(): TileMap { return parseStage(STAGE_1); }
export function createStage2(): TileMap { return parseStage(STAGE_2); }
export function createStage3(): TileMap { return parseStage(STAGE_3); }
export function createStage4(): TileMap { return parseStage(STAGE_4); }
export function createStage5(): TileMap { return parseStage(STAGE_5); }
export function createStage6(): TileMap { return parseStage(STAGE_6); }
export function createStage7(): TileMap { return parseStage(STAGE_7); }
export function createStage8(): TileMap { return parseStage(STAGE_8); }
export function createStage9(): TileMap { return parseStage(STAGE_9); }
export function createStage10(): TileMap { return parseStage(STAGE_10); }
export function createStage11(): TileMap { return parseStage(STAGE_11); }
export function createStage12(): TileMap { return parseStage(STAGE_12); }
export function createStage13(): TileMap { return parseStage(STAGE_13); }
export function createStage14(): TileMap { return parseStage(STAGE_14); }
export function createStage15(): TileMap { return parseStage(STAGE_15); }
export function createStage16(): TileMap { return parseStage(STAGE_16); }
export function createStage17(): TileMap { return parseStage(STAGE_17); }
export function createStage18(): TileMap { return parseStage(STAGE_18); }
export function createStage19(): TileMap { return parseStage(STAGE_19); }
export function createStage20(): TileMap { return parseStage(STAGE_20); }

// Ordered list of all 20 stage factories for the full progression.
export const STAGE_FACTORIES: Array<() => TileMap> = [
  createStage1,
  createStage2,
  createStage3,
  createStage4,
  createStage5,
  createStage6,
  createStage7,
  createStage8,
  createStage9,
  createStage10,
  createStage11,
  createStage12,
  createStage13,
  createStage14,
  createStage15,
  createStage16,
  createStage17,
  createStage18,
  createStage19,
  createStage20,
];
