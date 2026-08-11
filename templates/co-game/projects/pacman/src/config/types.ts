/**
 * Pac-Man — Core Type Definitions
 * All enums and interfaces used throughout the game.
 */

// === Enums ===

export enum Direction {
  UP = 'UP',
  DOWN = 'DOWN',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  NONE = 'NONE',
}

export enum TileType {
  EMPTY = 0,
  WALL = 1,
  DOT = 2,
  POWER_PELLET = 3,
  GHOST_HOUSE_DOOR = 4,
  GHOST_HOUSE = 5,
  TUNNEL = 6,
  FRUIT_SPAWN = 7,
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  DYING = 'DYING',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
}

export enum PacmanState {
  NORMAL = 'NORMAL',
  DYING = 'DYING',
  RESPAWNING = 'RESPAWNING',
}

export enum GhostMode {
  SCATTER = 'SCATTER',
  CHASE = 'CHASE',
  FRIGHTENED = 'FRIGHTENED',
  EATEN = 'EATEN',
  IN_HOUSE = 'IN_HOUSE',
  LEAVING_HOUSE = 'LEAVING_HOUSE',
}

export enum GhostName {
  BLINKY = 'BLINKY',
  PINKY = 'PINKY',
  INKY = 'INKY',
  CLYDE = 'CLYDE',
}

export enum FruitType {
  CHERRY = 'CHERRY',
  STRAWBERRY = 'STRAWBERRY',
  ORANGE = 'ORANGE',
  APPLE = 'APPLE',
  MELON = 'MELON',
  GALAXIAN = 'GALAXIAN',
  BELL = 'BELL',
  KEY = 'KEY',
}

// === Interfaces ===

export interface Position {
  x: number; // pixel position
  y: number;
}

export interface Velocity {
  dx: number; // pixels per update
  dy: number;
}

export interface TileCoord {
  col: number; // tile column (0-27)
  row: number; // tile row (0-30)
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapData {
  tiles: TileType[][];
  pacmanStart: TileCoord;
  ghostStarts: Record<GhostName, TileCoord>;
  fruitSpawn: TileCoord;
  tunnelRow: number;
  totalDots: number;
}

export interface Entity {
  position: Position;
  velocity: Velocity;
  direction: Direction;
  nextDirection: Direction; // buffered input
  tileCoord(): TileCoord;
  update(deltaTime: number): void;
  reset(start: TileCoord): void;
}

export interface AnimationFrame {
  direction: Direction;
  frame: number;      // frame index within animation cycle
  totalFrames: number; // total frames in this animation cycle
}

export interface GhostTargetStrategy {
  getTarget(
    ghost: TileCoord,
    pacman: TileCoord,
    ghosts: Record<GhostName, TileCoord>,
  ): TileCoord;
}

export interface ScatterChaseCycle {
  mode: GhostMode.SCATTER | GhostMode.CHASE;
  duration: number; // milliseconds
}

export interface ScoreEvent {
  type: 'dot' | 'power_pellet' | 'ghost' | 'fruit';
  points: number;
  position: TileCoord;
}

export interface ScatterTarget {
  col: number;
  row: number;
}
