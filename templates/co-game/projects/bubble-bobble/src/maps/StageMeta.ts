// Per-stage difficulty/theme metadata for the 20-stage progression.

export interface StageMeta {
  name: string;
  themeIndex: number; // index into TILE_THEMES (rendering/TileRenderer.ts)
  enemyCount: number;
  enemySpeedMultiplier: number;
  itemDropWeights: { [itemType: string]: number };
}

export const STAGE_META: StageMeta[] = [
  // Stage 1-4: Yellow/orange tiles (Classic)
  { name: 'Cave Entrance',   themeIndex: 0, enemyCount: 3, enemySpeedMultiplier: 1.0,  itemDropWeights: { APPLE: 5, BANANA: 3, CHERRY: 2, MELON: 0 } },
  { name: 'Cave Depths',     themeIndex: 0, enemyCount: 3, enemySpeedMultiplier: 1.05, itemDropWeights: { APPLE: 4, BANANA: 3, CHERRY: 3, MELON: 0 } },
  { name: 'Ruined Halls',    themeIndex: 0, enemyCount: 4, enemySpeedMultiplier: 1.1,  itemDropWeights: { APPLE: 4, BANANA: 3, CHERRY: 3, MELON: 0 } },
  { name: 'Ruined Vaults',   themeIndex: 0, enemyCount: 4, enemySpeedMultiplier: 1.15, itemDropWeights: { APPLE: 3, BANANA: 3, CHERRY: 3, MELON: 1 } },
  // Stage 5-8: Blue/cyan tiles
  { name: 'Sky Bridges',     themeIndex: 1, enemyCount: 5, enemySpeedMultiplier: 1.2,  itemDropWeights: { APPLE: 3, BANANA: 3, CHERRY: 3, MELON: 1 } },
  { name: 'Sky Chokepoints', themeIndex: 1, enemyCount: 5, enemySpeedMultiplier: 1.25, itemDropWeights: { APPLE: 3, BANANA: 3, CHERRY: 3, MELON: 1 } },
  { name: 'Upper Cave',      themeIndex: 1, enemyCount: 6, enemySpeedMultiplier: 1.3,  itemDropWeights: { APPLE: 2, BANANA: 3, CHERRY: 3, MELON: 2 } },
  { name: 'Twisted Ruins',   themeIndex: 1, enemyCount: 6, enemySpeedMultiplier: 1.35, itemDropWeights: { APPLE: 2, BANANA: 3, CHERRY: 2, MELON: 3 } },
  // Stage 9-12: Green tiles
  { name: 'High Spires',     themeIndex: 2, enemyCount: 7, enemySpeedMultiplier: 1.38, itemDropWeights: { APPLE: 2, BANANA: 2, CHERRY: 2, MELON: 4 } },
  { name: 'Final Ascent',    themeIndex: 2, enemyCount: 7, enemySpeedMultiplier: 1.4,  itemDropWeights: { APPLE: 2, BANANA: 2, CHERRY: 2, MELON: 4 } },
  { name: 'Green Labyrinth', themeIndex: 2, enemyCount: 7, enemySpeedMultiplier: 1.42, itemDropWeights: { APPLE: 1, BANANA: 2, CHERRY: 2, MELON: 5 } },
  { name: 'Serpent Path',    themeIndex: 2, enemyCount: 7, enemySpeedMultiplier: 1.45, itemDropWeights: { APPLE: 1, BANANA: 2, CHERRY: 2, MELON: 5 } },
  // Stage 13-16: Red/crimson tiles
  { name: 'Inferno Gate',    themeIndex: 3, enemyCount: 7, enemySpeedMultiplier: 1.5,  itemDropWeights: { APPLE: 1, BANANA: 1, CHERRY: 2, MELON: 6 } },
  { name: 'Fire Temple',     themeIndex: 3, enemyCount: 7, enemySpeedMultiplier: 1.55, itemDropWeights: { APPLE: 1, BANANA: 1, CHERRY: 2, MELON: 6 } },
  { name: 'Crimson Hall',    themeIndex: 3, enemyCount: 7, enemySpeedMultiplier: 1.6,  itemDropWeights: { APPLE: 1, BANANA: 1, CHERRY: 1, MELON: 7 } },
  { name: 'Scorched Vault',  themeIndex: 3, enemyCount: 7, enemySpeedMultiplier: 1.65, itemDropWeights: { APPLE: 0, BANANA: 1, CHERRY: 1, MELON: 8 } },
  // Stage 17-20: Purple tiles
  { name: 'Shadow Domain',   themeIndex: 4, enemyCount: 7, enemySpeedMultiplier: 1.7,  itemDropWeights: { APPLE: 0, BANANA: 1, CHERRY: 1, MELON: 8 } },
  { name: 'Chaos Spire',     themeIndex: 4, enemyCount: 7, enemySpeedMultiplier: 1.75, itemDropWeights: { APPLE: 0, BANANA: 0, CHERRY: 1, MELON: 9 } },
  { name: 'Abyss Crossing',  themeIndex: 4, enemyCount: 7, enemySpeedMultiplier: 1.8,  itemDropWeights: { APPLE: 0, BANANA: 0, CHERRY: 1, MELON: 9 } },
  { name: 'The Final Boss',  themeIndex: 4, enemyCount: 7, enemySpeedMultiplier: 2.0,  itemDropWeights: { APPLE: 0, BANANA: 0, CHERRY: 0, MELON: 10 } },
];
