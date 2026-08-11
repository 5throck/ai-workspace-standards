/**
 * Pac-Man — Main Game Entry Point
 *
 * Wires together all modules: game loop, entities, systems, renderers,
 * and UI screens. Implements the game state machine with 6 states:
 *   MENU → PLAYING ⇄ PAUSED → DYING → GAME_OVER
 *                          → LEVEL_COMPLETE → PLAYING
 *
 * Rendering pipeline (per ui-spec.md):
 *   1. Clear canvas
 *   2. Draw maze (walls + dots + pellets)
 *   3. Draw fruit
 *   4. Draw ghosts
 *   5. Draw Pac-Man
 *   6. Draw HUD (score, high score, stage, lives)
 *   7. Draw overlay screens (menu, pause, game over, level complete)
 */
import {
  Direction,
  GameState,
  GhostMode,
  GhostName,
  TileType,
} from './config/types';
import type { MapData, TileCoord } from './config/types';
import {
  HUD_OFFSET_Y,
  TILE_SIZE,
  DOT_POINTS,
  POWER_PELLET_POINTS,
  INITIAL_LIVES,
  DEATH_ANIMATION_DURATION,
  MAZE_FLASH_DURATION,
  RESPAWN_PAUSE_DURATION,
  GHOST_HOUSE_PAUSE_DURATION,
  GHOST_HOUSE_EXIT_ROW,
  GHOST_HOUSE_ENTRY_COL,
  GHOST_HOUSE_ENTRY_ROW,
} from './config/constants';
import { level1Data } from './maps';
import { tileToPixel } from './utils/vector';

// Engine
import { GameLoop } from './engine/GameLoop';
import { Renderer } from './engine/Renderer';
import { InputManager } from './engine/InputManager';
import { CollisionSystem } from './engine/CollisionSystem';

// Entities
import { Pacman } from './entities/Pacman';
import { Blinky } from './entities/Blinky';
import { Pinky } from './entities/Pinky';
import { Inky } from './entities/Inky';
import { Clyde } from './entities/Clyde';
import { GhostBase } from './entities/GhostBase';
import { Fruit } from './entities/Fruit';

// Systems
import { StateMachine } from './systems/StateMachine';
import { ScoreSystem } from './systems/ScoreSystem';
import { StageManager } from './systems/StageManager';
import { GhostHouseManager } from './systems/GhostHouseManager';
import { SoundManager } from './systems/SoundManager';

// Renderers
import { PacmanRenderer } from './renderers/PacmanRenderer';
import { GhostRenderer } from './renderers/GhostRenderer';
import { MazeRenderer } from './renderers/MazeRenderer';
import { HUDRenderer } from './renderers/HUDRenderer';

// UI Screens
import { StartScreen } from './ui/StartScreen';
import { PauseScreen } from './ui/PauseScreen';
import { GameOverScreen } from './ui/GameOverScreen';

// === Ghost Color Map ===

const GHOST_COLORS: Record<GhostName, string> = {
  [GhostName.BLINKY]: '#FF0000',
  [GhostName.PINKY]: '#FFB8FF',
  [GhostName.INKY]: '#00FFFF',
  [GhostName.CLYDE]: '#FFB852',
};

// === Game Class ===

class PacmanGame {
  // Engine
  private loop: GameLoop;
  private renderer: Renderer;
  private input: InputManager;
  private collision: CollisionSystem;

  // Entities
  private pacman: Pacman;
  private ghosts: GhostBase[] = [];
  private fruit: Fruit | null = null;

  // Systems
  private stateMachine: StateMachine<GameState>;
  private scoreSystem: ScoreSystem;
  private stageManager: StageManager;
  private ghostHouse: GhostHouseManager;
  private sound: SoundManager;

  // Renderers
  private pacmanRenderer: PacmanRenderer;
  private ghostRenderer: GhostRenderer;
  private mazeRenderer: MazeRenderer;
  private hudRenderer: HUDRenderer;

  // UI Screens
  private startScreen: StartScreen;
  private pauseScreen: PauseScreen;
  private gameOverScreen: GameOverScreen;

  // Game state
  private map = this.cloneMapData(level1Data);
  private lives: number = INITIAL_LIVES;
  private dotsRemaining: number = 0;
  private dotsEaten: number = 0;
  private gameTime: number = 0;
  private stateStartTime: number = 0;
  private fruitSpawned: boolean = false;
  private fruitThresholdTriggered: number = 0; // tracks which threshold was last triggered
  private ghostHousePauseTimer: number = 0;

  // Used for fruit spawn timing (dots eaten thresholds)
  private readonly FRUIT_DOTS_THRESHOLD_1 = 70;
  private readonly FRUIT_DOTS_THRESHOLD_2 = 170;

  constructor(canvas: HTMLCanvasElement) {
    // Engine
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();
    this.collision = new CollisionSystem();
    this.loop = new GameLoop();

    // Entities
    this.pacman = new Pacman(this.collision);
    this.ghosts = [
      new Blinky(this.collision),
      new Pinky(this.collision),
      new Inky(this.collision),
      new Clyde(this.collision),
    ];

    // Systems
    this.stateMachine = new StateMachine<GameState>(GameState.MENU);
    this.scoreSystem = new ScoreSystem();
    this.stageManager = new StageManager();
    this.ghostHouse = new GhostHouseManager();
    this.sound = new SoundManager();

    // Renderers
    this.pacmanRenderer = new PacmanRenderer();
    this.ghostRenderer = new GhostRenderer();
    this.mazeRenderer = new MazeRenderer();
    this.hudRenderer = new HUDRenderer();

    // UI Screens
    this.startScreen = new StartScreen();
    this.pauseScreen = new PauseScreen();
    this.gameOverScreen = new GameOverScreen();

    // Set up map on all entities
    this.pacman.setMap(this.map);
    for (const ghost of this.ghosts) {
      ghost.setMap(this.map);
    }

    // Configure game loop callbacks
    this.loop.onUpdate = (dt) => this.update(dt);
    this.loop.onRender = (_alpha) => this.render();

    // Register state transitions
    this.registerTransitions();

    // Start in MENU state
    this.enterMenu();
  }

  // === State Machine Setup ===

  private registerTransitions(): void {
    const sm = this.stateMachine;
    sm.addTransition(GameState.MENU, GameState.PLAYING);
    sm.addTransition(GameState.PLAYING, GameState.PAUSED);
    sm.addTransition(GameState.PLAYING, GameState.DYING);
    sm.addTransition(GameState.PLAYING, GameState.LEVEL_COMPLETE);
    sm.addTransition(GameState.PAUSED, GameState.PLAYING);
    sm.addTransition(GameState.DYING, GameState.PLAYING);
    sm.addTransition(GameState.DYING, GameState.GAME_OVER);
    sm.addTransition(GameState.LEVEL_COMPLETE, GameState.PLAYING);
    sm.addTransition(GameState.GAME_OVER, GameState.MENU);
  }

  // === State Enter Methods ===

  private enterMenu(): void {
    this.stateMachine.reset(GameState.MENU);
    this.stateStartTime = performance.now();
    this.loop.start();
  }

  private startNewGame(): void {
    this.lives = INITIAL_LIVES;
    this.scoreSystem.reset();
    this.stageManager.reset();
    this.gameTime = 0;
    this.dotsEaten = 0;
    this.fruitSpawned = false;
    this.fruitThresholdTriggered = 0;
    this.fruit = null;
    this.ghostHousePauseTimer = 0;
    this.loadStage();
    this.sound.init();
    this.sound.playIntro();
    this.stateStartTime = performance.now();
  }

  private loadStage(): void {
    // Re-clone map tiles so dot state is fresh for each stage
    this.map = this.cloneMapData(level1Data);
    for (const ghost of this.ghosts) {
      ghost.setMap(this.map);
    }
    this.pacman.setMap(this.map);

    // Reset dot count
    this.dotsRemaining = this.countDots();
    this.dotsEaten = 0;
    this.fruitSpawned = false;
    this.fruitThresholdTriggered = 0;
    this.fruit = null;

    // Configure stage-dependent systems
    const stageConfig = this.stageManager.getStageConfig();
    this.ghostHouse.setScatterChaseCycles(stageConfig.scatterChaseCycles);
    this.ghostHouse.resetStage();

    // Apply speed settings
    this.pacman.setSpeed(stageConfig.pacmanSpeed);

    // Reset all entity positions
    this.pacman.reset(this.map.pacmanStart);

    for (const ghost of this.ghosts) {
      const start = this.map.ghostStarts[ghost.name];
      ghost.reset(start);
      // Ghosts in house start in IN_HOUSE mode (except Blinky)
      if (ghost.name === GhostName.BLINKY) {
        ghost.setMode(GhostMode.SCATTER);
      } else {
        ghost.setMode(GhostMode.IN_HOUSE);
      }
    }

    // Invalidate maze cache
    this.mazeRenderer.invalidateCache();

    this.stateStartTime = performance.now();
  }

  // === Update Logic (fixed timestep) ===

  private update(dt: number): void {
    const now = performance.now();
    const state = this.stateMachine.state;
    const stateElapsed = now - this.stateStartTime;

    switch (state) {
      case GameState.MENU:
        this.updateMenu(stateElapsed, now);
        break;
      case GameState.PLAYING:
        this.updatePlaying(dt, stateElapsed, now);
        break;
      case GameState.PAUSED:
        this.updatePaused(stateElapsed);
        break;
      case GameState.DYING:
        this.updateDying(dt, stateElapsed, now);
        break;
      case GameState.GAME_OVER:
        this.updateGameOver(stateElapsed, now);
        break;
      case GameState.LEVEL_COMPLETE:
        this.updateLevelComplete(dt, stateElapsed, now);
        break;
    }
  }

  private updateMenu(_stateElapsed: number, _now: number): void {
    // Check for Enter key to start
    if (this.input.isKeyPressed('Enter')) {
      this.startNewGame();
      this.stateMachine.transition(GameState.PLAYING);
      return;
    }
  }

  private updatePlaying(dt: number, _stateElapsed: number, now: number): void {
    this.gameTime += dt;

    // Check for pause toggle
    if (this.input.consumePauseToggle()) {
      this.stateMachine.transition(GameState.PAUSED);
      this.loop.pause();
      this.stateStartTime = performance.now();
      return;
    }

    // Process input direction
    const dir = this.input.consumeInput();
    if (dir !== Direction.NONE) {
      this.pacman.setNextDirection(dir);
    }

    // Update ghost house manager (scatter/chase cycling)
    this.ghostHouse.updateGameInfo(this.gameTime, this.dotsEaten);
    this.ghostHouse.update(dt);

    // Release ghosts based on timing/dots
    for (const ghost of this.ghosts) {
      if (ghost.getMode() === GhostMode.IN_HOUSE && this.ghostHouse.shouldRelease(ghost.name)) {
        ghost.setMode(GhostMode.LEAVING_HOUSE);
      }
    }

    // Update ghost house pause timer (when an eaten ghost returns)
    if (this.ghostHousePauseTimer > 0) {
      this.ghostHousePauseTimer -= dt;
      // While paused, skip ghost release and mode sync
      if (this.ghostHousePauseTimer > 0) {
        this.updateGhostsOnly(dt);
        this.checkDotCollection();
        this.checkGhostCollision();
        this.checkFruit(now);
        if (this.dotsRemaining <= 0) {
          this.stateMachine.transition(GameState.LEVEL_COMPLETE);
          this.sound.stopSiren();
          this.sound.playLevelUp();
          this.stateStartTime = performance.now();
          return;
        }
        return;
      }
    }

    // Sync ghost modes with global mode (reverse direction on scatter↔chase)
    const globalMode = this.ghostHouse.getGlobalMode();
    for (const ghost of this.ghosts) {
      const mode = ghost.getMode();
      if (mode === GhostMode.SCATTER || mode === GhostMode.CHASE) {
        if (mode !== globalMode) {
          ghost.setMode(globalMode); // reverses direction on scatter↔chase
        }
      }
      // Update Pac-Man info for AI targeting
      ghost.updatePacmanInfo(this.pacman.tileCoord(), this.pacman.direction);
    }

    // Update all ghost positions reference (for Inky)
    const ghostPositions: Record<GhostName, { col: number; row: number }> = {} as Record<GhostName, { col: number; row: number }>;
    for (const ghost of this.ghosts) {
      ghostPositions[ghost.name] = ghost.tileCoord();
    }
    for (const ghost of this.ghosts) {
      ghost.updateGhostPositions(ghostPositions);
    }

    // Update Pac-Man
    this.pacman.update(dt);

    // Update ghosts
    for (const ghost of this.ghosts) {
      ghost.update(dt);
    }

    // Check ghost house exit (LEAVING_HOUSE → SCATTER/CHASE)
    // Ghost must reach the tile center at (GHOST_HOUSE_CENTER_COL, GHOST_HOUSE_EXIT_ROW)
    // — i.e. y snapped to exitY. We check y <= exitY (not tileCoord().row <= exitRow)
    // because tileCoord() returns exitRow for any y in the row range, but the ghost is
    // only grid-aligned at the tile center. Exiting before snapping leaves the ghost
    // off-grid, unable to pathfind (chooseDirection requires grid alignment).
    const exitY = GHOST_HOUSE_EXIT_ROW * TILE_SIZE + TILE_SIZE / 2 + HUD_OFFSET_Y;
    for (const ghost of this.ghosts) {
      if (ghost.getMode() === GhostMode.LEAVING_HOUSE) {
        if (ghost.position.y <= exitY) {
          ghost.setMode(this.ghostHouse.getGlobalMode());
        }
      }
      // Check if eaten ghost has returned to house
      if (ghost.getMode() === GhostMode.EATEN) {
        const tile = ghost.tileCoord();
        if (tile.row === GHOST_HOUSE_ENTRY_ROW && tile.col === GHOST_HOUSE_ENTRY_COL) {
          ghost.setMode(GhostMode.IN_HOUSE);
          this.ghostHousePauseTimer = GHOST_HOUSE_PAUSE_DURATION;
        }
      }
    }

    // Check dot collection
    this.checkDotCollection();

    // Check ghost-Pacman collision
    this.checkGhostCollision();

    // Check fruit
    this.checkFruit(now);

    // Check win condition (all dots eaten)
    if (this.dotsRemaining <= 0) {
      this.stateMachine.transition(GameState.LEVEL_COMPLETE);
      this.sound.stopSiren();
      this.sound.playLevelUp();
      this.stateStartTime = performance.now();
      return;
    }
  }

  private updatePaused(_stateElapsed: number): void {
    // Check for pause toggle to resume
    if (this.input.consumePauseToggle()) {
      this.stateMachine.transition(GameState.PLAYING);
      this.loop.resume();
      this.stateStartTime = performance.now();
    }
  }

  private updateDying(_dt: number, stateElapsed: number, _now: number): void {
    // After death animation + respawn pause, check lives
    if (stateElapsed >= DEATH_ANIMATION_DURATION + RESPAWN_PAUSE_DURATION) {
      this.lives--;
      if (this.lives <= 0) {
        this.stateMachine.transition(GameState.GAME_OVER);
        this.sound.playGameOver();
        this.stateStartTime = performance.now();
      } else {
        // Respawn
        this.respawnEntities();
        this.stateMachine.transition(GameState.PLAYING);
        this.stateStartTime = performance.now();
      }
    }
  }

  private updateGameOver(stateElapsed: number, _now: number): void {
    // After delay, check for Enter to restart
    if (stateElapsed >= 3000 && this.input.isKeyPressed('Enter')) {
      this.stateMachine.transition(GameState.MENU);
      this.stateStartTime = performance.now();
    }
  }

  private updateLevelComplete(_dt: number, stateElapsed: number, _now: number): void {
    // Maze flash for MAZE_FLASH_DURATION, then advance to next stage
    if (stateElapsed >= MAZE_FLASH_DURATION) {
      this.stageManager.nextStage();
      this.loadStage();
      this.stateMachine.transition(GameState.PLAYING);
    }
  }

  // === Collision Checks ===

  private checkDotCollection(): void {
    const coord = this.collision.checkDotCollection(this.pacman.position, this.map);
    if (!coord) return;

    const tile = this.map.tiles[coord.row][coord.col];

    if (tile === TileType.DOT) {
      // Clear the dot
      this.map.tiles[coord.row][coord.col] = TileType.EMPTY;
      this.dotsRemaining--;
      this.dotsEaten++;
      this.scoreSystem.addScore(DOT_POINTS, 'dot');
      this.sound.playWaka();

      // Check for extra life
      if (this.scoreSystem.checkExtraLife()) {
        this.lives++;
      }
    } else if (tile === TileType.POWER_PELLET) {
      // Clear the pellet
      this.map.tiles[coord.row][coord.col] = TileType.EMPTY;
      this.dotsRemaining--;
      this.dotsEaten++;
      this.scoreSystem.addScore(POWER_PELLET_POINTS, 'power_pellet');
      this.sound.playPower();

      // Activate frightened mode
      const stageConfig = this.stageManager.getStageConfig();
      this.ghostHouse.startFrightened(stageConfig.frightDuration);
      this.scoreSystem.resetGhostEatingCounter();

      // Set all active ghosts to frightened
      for (const ghost of this.ghosts) {
        const mode = ghost.getMode();
        if (mode === GhostMode.SCATTER || mode === GhostMode.CHASE) {
          ghost.setMode(GhostMode.FRIGHTENED);
        }
      }

      // Check for extra life
      if (this.scoreSystem.checkExtraLife()) {
        this.lives++;
      }
    }
  }

  private checkGhostCollision(): void {
    for (const ghost of this.ghosts) {
      const mode = ghost.getMode();
      // Only check collision with active ghosts (not in house or leaving)
      if (mode === GhostMode.IN_HOUSE || mode === GhostMode.LEAVING_HOUSE) continue;

      if (this.collision.checkEntityCollision(this.pacman.position, ghost.position)) {
        if (mode === GhostMode.FRIGHTENED) {
          // Eat the ghost
          this.scoreSystem.eatGhost();
          ghost.setMode(GhostMode.EATEN);
          this.sound.playGhostEat();
        } else if (mode === GhostMode.SCATTER || mode === GhostMode.CHASE) {
          // Pac-Man dies
          this.pacman.die();
          this.stateMachine.transition(GameState.DYING);
          this.sound.stopSiren();
          this.sound.playDeath();
          this.stateStartTime = performance.now();
          return;
        }
        // EATEN mode ghosts don't kill Pac-Man
      }
    }
  }

  private checkFruit(now: number): void {
    const stageConfig = this.stageManager.getStageConfig();

    // Spawn fruit at dot thresholds — each threshold triggers at most once per stage
    if (!this.fruitSpawned && !this.fruit) {
      if (this.fruitThresholdTriggered === 0 &&
          this.dotsEaten >= this.FRUIT_DOTS_THRESHOLD_1) {
        this.fruit = new Fruit(stageConfig.fruitType);
        const pos = tileToPixel(this.map.fruitSpawn);
        this.fruit.spawn(pos, now);
        this.fruitSpawned = true;
        this.fruitThresholdTriggered = 1;
      } else if (this.fruitThresholdTriggered === 1 &&
          this.dotsEaten >= this.FRUIT_DOTS_THRESHOLD_2) {
        this.fruit = new Fruit(stageConfig.fruitType);
        const pos = tileToPixel(this.map.fruitSpawn);
        this.fruit.spawn(pos, now);
        this.fruitSpawned = true;
        this.fruitThresholdTriggered = 2;
      }
    }

    // Check fruit expiry or collection
    if (this.fruit && this.fruit.active) {
      if (this.fruit.isExpired(now)) {
        this.fruit.collect();
        this.fruit = null;
        this.fruitSpawned = false;
      } else if (this.collision.checkEntityCollision(this.pacman.position, this.fruit.position)) {
        const points = this.fruit.getPoints();
        this.scoreSystem.addScore(points, 'fruit');
        this.fruit.collect();
        this.fruit = null;
        this.fruitSpawned = false;
      }
    }
  }

  // === Entity Management ===

  private respawnEntities(): void {
    // Reset positions without starting a new game
    this.pacman.reset(this.map.pacmanStart);

    for (const ghost of this.ghosts) {
      const start = this.map.ghostStarts[ghost.name];
      ghost.reset(start);
      if (ghost.name === GhostName.BLINKY) {
        ghost.setMode(GhostMode.SCATTER);
      } else {
        ghost.setMode(GhostMode.IN_HOUSE);
      }
    }

    // Reset ghost house timing
    this.ghostHouse.resetStage();
    const stageConfig = this.stageManager.getStageConfig();
    this.ghostHouse.setScatterChaseCycles(stageConfig.scatterChaseCycles);
    this.ghostHousePauseTimer = 0;
    this.sound.resetDotCounter();
    this.sound.startSiren();
  }

  // === Render Logic ===

  private render(): void {
    const ctx = this.renderer.getContext();
    const now = performance.now();
    const state = this.stateMachine.state;
    const stateElapsed = now - this.stateStartTime;

    // 1. Clear canvas
    this.renderer.clear();

    switch (state) {
      case GameState.MENU:
        this.renderMenu(ctx, stateElapsed);
        break;
      case GameState.PLAYING:
      case GameState.PAUSED:
        this.renderGameplay(ctx, stateElapsed);
        if (state === GameState.PAUSED) {
          this.pauseScreen.render(ctx);
        }
        break;
      case GameState.DYING:
        this.renderGameplay(ctx, stateElapsed);
        break;
      case GameState.GAME_OVER:
        this.renderGameplay(ctx, stateElapsed);
        this.gameOverScreen.render(
          ctx,
          this.scoreSystem.score,
          this.scoreSystem.highScore,
          this.stageManager.currentStage,
          stateElapsed,
        );
        break;
      case GameState.LEVEL_COMPLETE:
        this.renderLevelComplete(ctx, stateElapsed);
        break;
    }
  }

  private renderMenu(ctx: CanvasRenderingContext2D, elapsed: number): void {
    this.startScreen.render(
      ctx,
      this.mazeRenderer,
      this.map.tiles,
      this.scoreSystem.highScore,
      elapsed,
    );
  }

  private renderGameplay(ctx: CanvasRenderingContext2D, _elapsed: number): void {
    const state = this.stateMachine.state;
    const elapsed = performance.now() - this.stateStartTime;

    // 2. Draw maze
    this.mazeRenderer.draw(ctx, this.map.tiles, HUD_OFFSET_Y, elapsed);

    // 3. Draw fruit
    if (this.fruit && this.fruit.active) {
      this.renderFruit(ctx);
    }

    // 4. Draw ghosts
    const warningFlash = this.ghostHouse.isWarningFlash();
    for (const ghost of this.ghosts) {
      const mode = ghost.getMode();
      const x = ghost.position.x;
      const y = ghost.position.y;

      if (mode === GhostMode.IN_HOUSE || mode === GhostMode.LEAVING_HOUSE) {
        // Render ghosts inside/leaving house with their normal appearance
        const color = GHOST_COLORS[ghost.name];
        this.ghostRenderer.drawNormal(ctx, x, y, color, Direction.UP, elapsed);
      } else if (mode === GhostMode.FRIGHTENED) {
        this.ghostRenderer.drawFrightened(ctx, x, y, warningFlash, elapsed);
      } else if (mode === GhostMode.EATEN) {
        this.ghostRenderer.drawEaten(ctx, x, y, ghost.direction);
      } else {
        const color = GHOST_COLORS[ghost.name];
        this.ghostRenderer.drawNormal(ctx, x, y, color, ghost.direction, elapsed);
      }
    }

    // 5. Draw Pac-Man
    if (state === GameState.DYING) {
      // Death animation
      this.pacmanRenderer.drawDying(
        ctx,
        this.pacman.position.x,
        this.pacman.position.y,
        elapsed,
      );
    } else {
      // Normal rendering
      this.pacmanRenderer.drawNormal(
        ctx,
        this.pacman.position.x,
        this.pacman.position.y,
        this.pacman.direction,
        elapsed,
      );
    }

    // 6. Draw HUD
    this.hudRenderer.draw(
      ctx,
      this.scoreSystem.score,
      this.scoreSystem.highScore,
      this.stageManager.currentStage,
      this.lives,
    );
  }

  private renderLevelComplete(ctx: CanvasRenderingContext2D, elapsed: number): void {
    // Flash maze between white and blue
    this.mazeRenderer.drawFlash(ctx, this.map.tiles, HUD_OFFSET_Y, elapsed);

    // Still draw HUD
    this.hudRenderer.draw(
      ctx,
      this.scoreSystem.score,
      this.scoreSystem.highScore,
      this.stageManager.currentStage,
      this.lives,
    );
  }

  private renderFruit(ctx: CanvasRenderingContext2D): void {
    if (!this.fruit) return;

    // Simple fruit rendering: colored circle with type indicator
    const x = this.fruit.position.x;
    const y = this.fruit.position.y;
    const radius = 6;

    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Small stem
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + 2, y - radius - 3);
    ctx.stroke();
  }

  // === Utility ===

  private countDots(): number {
    let count = 0;
    for (const row of this.map.tiles) {
      for (const tile of row) {
        if (tile === TileType.DOT || tile === TileType.POWER_PELLET) {
          count++;
        }
      }
    }
    return count;
  }

  /** Deep-clone map tiles so mutations (dot removal) don't persist across stages. */
  private cloneMapData(source: MapData): MapData {
    return {
      tiles: source.tiles.map(row => [...row]),
      pacmanStart: { ...source.pacmanStart },
      ghostStarts: Object.fromEntries(
        Object.entries(source.ghostStarts).map(([k, v]) => [k, { ...v }])
      ) as Record<GhostName, TileCoord>,
      fruitSpawn: { ...source.fruitSpawn },
      tunnelRow: source.tunnelRow,
      totalDots: source.totalDots,
    };
  }

  /**
   * Minimal update loop during ghost house pause:
   * only moves ghosts and Pac-Man, no ghost release or mode changes.
   */
  private updateGhostsOnly(dt: number): void {
    // Update Pac-Man info for ghosts
    const ghostPositions: Record<GhostName, { col: number; row: number }> = {} as Record<GhostName, { col: number; row: number }>;
    for (const ghost of this.ghosts) {
      ghost.updatePacmanInfo(this.pacman.tileCoord(), this.pacman.direction);
      ghostPositions[ghost.name] = ghost.tileCoord();
    }
    for (const ghost of this.ghosts) {
      ghost.updateGhostPositions(ghostPositions);
    }
    // Update positions
    this.pacman.update(dt);
    for (const ghost of this.ghosts) {
      ghost.update(dt);
    }
  }

  // === Lifecycle ===

  /** Stop the game loop and clean up input listeners. */
  destroy(): void {
    this.loop.stop();
    this.input.destroy();
  }
}

// === Bootstrap ===

function bootstrap(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element #game-canvas not found.');
    return;
  }

  const game = new PacmanGame(canvas);

  // Expose for debugging
  (window as unknown as Record<string, unknown>).__pacman = game;
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
