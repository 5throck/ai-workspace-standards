import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bubble, BubbleType } from '../entities/Bubble';
import { Item, ItemType } from '../entities/Item';
import { WaterWave, FireFlame, LightningBolt, EnemyRock } from '../entities/SpecialProjectiles';
import { SkelMonsta } from '../entities/SkelMonsta';
import { TileMap, CollisionSystem } from '../systems/CollisionSystem';
import { PhysicsSystem, SCREEN_WIDTH, SCREEN_HEIGHT } from '../systems/PhysicsSystem';
import { InputHandler } from '../utils/InputHandler';
import { STAGE_FACTORIES } from '../maps/Stages';
import { STAGE_META } from '../maps/StageMeta';
import { EnemyType } from '../entities/Enemy';
import { audio } from '../audio/AudioSystem';
import { ProceduralSprites } from '../rendering/ProceduralSprites';
import { TileRenderer, TILE_THEMES } from '../rendering/TileRenderer';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { loadHighScore, saveHighScore } from '../systems/HighScore';

export type GameState = 'START_SCREEN' | 'PLAYING' | 'STAGE_CLEAR' | 'GAME_OVER';

interface PopTask {
  bubble: Bubble;
  delay: number;
  comboCount: number;
  owner: Player;
}

interface WindParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

const BUBBLE_POP_COLORS: { [key: string]: string } = {
  STANDARD: '#99ff99',
  WATER: '#66ccff',
  FIRE: '#ff6633',
  LIGHTNING: '#ffee00',
};

const LANDING_VY_THRESHOLD = 2.5;

// Pool of enemy spawn points/types, sliced per-stage by STAGE_META.enemyCount.
// INVADER (Blubbor) entries at the tail only appear in later stages (8+).
const ENEMY_SPAWN_POOL: Array<{ x: number; y: number; type: EnemyType }> = [
  { x: 240, y: 100, type: 'ZEN_CHAN' },
  { x: 160, y: 200, type: 'MIGHTA' },
  { x: 360, y: 240, type: 'ZEN_CHAN' },
  { x: 120, y: 200, type: 'MIGHTA' },
  { x: 400, y: 160, type: 'ZEN_CHAN' },
  { x: 280, y: 280, type: 'INVADER' },
  { x: 440, y: 120, type: 'INVADER' },
];

// Arcade layout count: the 20 stage layouts repeat across the 100 rounds.
const LAYOUT_COUNT = 20;
// Rounds 1-100, like the original arcade. After round 100 the game loops back
// to round 1 with retained difficulty (the arcade's "Super" loop).
const MAX_ROUND = 100;

// Difficulty escalation per completed 20-round cycle (capped).
const CYCLE_SPEED_MULTIPLIER = 1.08; // enemy speed +8% per completed cycle
const CYCLE_HURRY_UP_FACTOR = 0.9;   // hurry-up threshold 10% shorter per cycle
const CYCLE_CAP = 5;                 // effective cycle index cap (speed x~1.47)
const MIN_HURRY_UP_SECONDS = 10;

// "Hurry Up" enrage mechanic: after this many seconds without clearing the
// stage, remaining enemies turn angry (angry sprite variant + speed boost).
const HURRY_UP_THRESHOLD_SECONDS = 30;

// Skel-Monsta chase: spawns this many seconds after the hurry-up enrage if
// the stage is still not cleared. Only one exists at a time.
const SKEL_MONSTA_DELAY_SECONDS = 15;

// Dead players with remaining lives respawn after this delay.
const PLAYER_RESPAWN_SECONDS = 2;

// Arcade chain-scoring for simultaneous multi-pops (1986 Taito values).
const CHAIN_SCORES = [400, 800, 1600, 3200, 5000, 7000];

// Original caps concurrent bubbles per player (approximately 7–8 on screen).
const MAX_BUBBLES_ON_SCREEN = 8;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputHandler;

  public state: GameState = 'START_SCREEN';
  // Two-player co-op: players[0] is Bub (P1), players[1] is Bob (P2).
  public players: Player[];
  public enemies: Enemy[] = [];
  public bubbles: Bubble[] = [];
  public items: Item[] = [];

  // Special projectiles
  public waterWaves: WaterWave[] = [];
  public fireFlames: FireFlame[] = [];
  public lightningBolts: LightningBolt[] = [];
  public enemyRocks: EnemyRock[] = [];
  public skelMonsta: SkelMonsta | null = null;

  public currentStageMap: TileMap;
  // Global stage counter (0-based). Layout = counter % 20, round = (counter % 100) + 1.
  public currentStageIndex: number = 0;

  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1000 / 60; // 60fps fixed step (~16.67ms)

  private stageClearTimer: number = 0;

  // Hurry Up enrage mechanic state
  private stageElapsedTime: number = 0;
  private hurryUpTriggered: boolean = false;
  private skelMonstaTimer: number = 0;

  // Staggered pop cascade queue
  private popQueue: PopTask[] = [];

  // Wind Particles
  private windParticles: WindParticle[] = [];

  // Event-driven particle effects (bubble pop, enemy defeat, landings, pickups)
  private particles: ParticleSystem = new ParticleSystem();

  // Screen shake and hit-stop timers
  public shakeTimer: number = 0;
  public shakeIntensity: number = 0;
  public hitStopTimer: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.input = new InputHandler();
    this.players = [new Player(64, 360, 0), new Player(96, 360, 1)];
    this.currentStageMap = STAGE_FACTORIES[0]();

    // Initialize graphics sprites cache
    ProceduralSprites.init();
    TileRenderer.init(this.currentStageMap.tileSize);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        if (this.state === 'START_SCREEN' && (e.code === 'Enter' || e.code === 'Space')) {
          this.startGame();
        }
        if (this.state === 'GAME_OVER' && (e.code === 'Enter' || e.code === 'Space')) {
          this.state = 'START_SCREEN';
        }
      });
    }
  }

  // Backwards-compatible accessor: P1 (Bub).
  public get player(): Player {
    return this.players[0];
  }

  // Current round number, 1-100 (arcade progression).
  public get currentRound(): number {
    return (this.currentStageIndex % MAX_ROUND) + 1;
  }

  // Number of completed 20-round cycles (difficulty escalation), capped.
  public get difficultyCycle(): number {
    return Math.min(Math.floor(this.currentStageIndex / LAYOUT_COUNT), CYCLE_CAP);
  }

  // Hurry-up threshold shrinks 10% per completed cycle, with a floor.
  public get hurryUpThreshold(): number {
    return Math.max(
      MIN_HURRY_UP_SECONDS,
      HURRY_UP_THRESHOLD_SECONDS * Math.pow(CYCLE_HURRY_UP_FACTOR, this.difficultyCycle)
    );
  }

  private startGame(): void {
    this.state = 'PLAYING';
    this.players = [new Player(64, 360, 0), new Player(96, 360, 1)];
    this.currentStageIndex = 0;
    this.loadStage(this.currentStageIndex);
    audio.playBGM(STAGE_META[this.currentStageIndex % STAGE_META.length].themeIndex);
  }

  private loadStage(index: number): void {
    this.bubbles = [];
    this.items = [];
    this.waterWaves = [];
    this.fireFlames = [];
    this.lightningBolts = [];
    this.enemyRocks = [];
    this.skelMonsta = null;
    this.popQueue = [];
    this.windParticles = [];
    this.particles.clear();

    const layoutIndex = index % LAYOUT_COUNT;
    const meta = STAGE_META[layoutIndex];

    this.currentStageMap = STAGE_FACTORIES[layoutIndex]();

    // Per-cycle difficulty: +8% enemy speed per completed 20-round cycle.
    const cycleSpeed = Math.pow(CYCLE_SPEED_MULTIPLIER, this.difficultyCycle);
    this.enemies = ENEMY_SPAWN_POOL.slice(0, meta.enemyCount).map((spawn) => {
      const enemy = new Enemy(spawn.x, spawn.y, spawn.type);
      enemy.speed *= meta.enemySpeedMultiplier * cycleSpeed;
      enemy.vx = enemy.direction * enemy.speed;
      return enemy;
    });

    // Reset player positions; dead players with remaining lives come back.
    this.players.forEach((player, i) => {
      player.x = i === 0 ? 64 : 96;
      player.y = 360;
      player.vx = 0;
      player.vy = 0;
      player.isGrounded = false;
      player.invincibleTimer = 1.5; // 1.5s invincibility at start
      if (!this.isOutOfLives(player)) {
        player.dead = false;
        player.respawnTimer = 0;
      }
    });

    // Reset Hurry Up enrage timer for the new stage
    this.stageElapsedTime = 0;
    this.hurryUpTriggered = false;
    this.skelMonstaTimer = 0;
    audio.setHurryUp(false);
  }

  private isOutOfLives(player: Player): boolean {
    return player.lives <= 0;
  }

  // Nearest living player to a point, or null when everyone is out.
  private nearestLivingPlayer(x: number, y: number): Player | null {
    let nearest: Player | null = null;
    let bestDist = Infinity;
    this.players.forEach((player) => {
      if (player.dead || this.isOutOfLives(player)) return;
      const dx = player.centerX - x;
      const dy = player.centerY - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        nearest = player;
      }
    });
    return nearest;
  }

  private triggerHurryUp(): void {
    this.hurryUpTriggered = true;
    audio.playHurryUp();
    audio.setHurryUp(true);
    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        enemy.setAngry(true);
      }
    });
  }

  public run(time: number = 0): void {
    if (!this.lastTime) {
      this.lastTime = time;
    }

    let delta = time - this.lastTime;
    this.lastTime = time;

    if (delta > 250) {
      delta = 250;
    }

    this.accumulator += delta;

    while (this.accumulator >= this.fixedDt) {
      this.update(1.0); // Step with normalized dt = 1.0
      this.accumulator -= this.fixedDt;
    }

    this.draw();
    requestAnimationFrame((t) => this.run(t));
  }

  private triggerChainPop(startBubble: Bubble, owner: Player): void {
    const queue: Bubble[] = [startBubble];
    const visited = new Set<Bubble>([startBubble]);
    let index = 0;

    // Standard BFS scanning adjacent bubbles within 22 pixels range
    while (index < queue.length) {
      const current = queue[index];
      const depth = Math.floor(index / 2); // pop 2 bubbles per step (33.3ms delay increment)

      this.popQueue.push({
        bubble: current,
        delay: depth * 2,
        comboCount: index,
        owner
      });

      this.bubbles.forEach((other) => {
        if (
          other.active &&
          !visited.has(other) &&
          (other.state === 'FLOATING' || other.state === 'ENEMY_TRAPPED')
        ) {
          const dx = current.centerX - other.centerX;
          const dy = current.centerY - other.centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 22) {
            visited.add(other);
            queue.push(other);
          }
        }
      });

      index++;
    }
  }

  private spawnPopLoot(bubble: Bubble, comboCount: number, owner: Player): void {
    const popColor = BUBBLE_POP_COLORS[bubble.type] ?? BUBBLE_POP_COLORS.STANDARD;

    if (bubble.trappedEnemy) {
      // Score points & spawn food
      const fruits: ItemType[] = ['APPLE', 'BANANA', 'CHERRY', 'MELON'];
      const randomFruit = fruits[Math.floor(Math.random() * fruits.length)];
      this.items.push(new Item(bubble.x, bubble.y, randomFruit));

      // 8% chance each of spawning Sneakers or Candy if not already held
      const powerRoll = Math.random();
      if (powerRoll < 0.08 && !owner.hasSneakers) {
        this.items.push(new Item(bubble.x + 24, bubble.y, 'SNEAKERS'));
      } else if (powerRoll < 0.16 && !owner.hasCandy) {
        this.items.push(new Item(bubble.x + 24, bubble.y, 'CANDY'));
      }
      // Arcade chain values: 400 → 800 → 1600 → 3200 → 5000 → 7000 (cap).
      owner.score += CHAIN_SCORES[Math.min(comboCount, CHAIN_SCORES.length - 1)];
      bubble.trappedEnemy.active = false;

      // Trigger screen shake and hit-stop
      this.shakeTimer = 0.2;
      this.shakeIntensity = 3.0;
      this.hitStopTimer = 0.05;

      // Bigger colorful burst + floating score text for enemy defeats
      this.particles.spawnBurst(bubble.centerX, bubble.centerY, 16, popColor, { size: 2, life: 0.5 });
      this.particles.spawnText(bubble.centerX, bubble.centerY, '+1000', '#ffee00');
    } else {
      // Standard bubble pop: small burst in the bubble's own color
      this.particles.spawnBurst(bubble.centerX, bubble.centerY, 8, popColor, { size: 1.5, life: 0.35 });
    }

    // Trigger special bubble pop actions
    if (bubble.type === 'WATER') {
      // Release water wave moving along the bubble's direction (or default player direction)
      const dir = owner.direction;
      this.waterWaves.push(new WaterWave(bubble.x, bubble.y, dir));
    } else if (bubble.type === 'FIRE') {
      // Drops fire flame straight down
      this.fireFlames.push(new FireFlame(bubble.x, bubble.y));
    } else if (bubble.type === 'LIGHTNING') {
      // Fires horizontal lightning bolts in both directions
      this.lightningBolts.push(new LightningBolt(bubble.x, bubble.y, 1));
      this.lightningBolts.push(new LightningBolt(bubble.x, bubble.y, -1));
    }
  }

  private killPlayer(player: Player): void {
    player.lives--;
    audio.playDeath();
    // Reset power-up flags on death
    player.hasSneakers = false;
    player.hasCandy = false;
    if (this.isOutOfLives(player)) {
      // Out of the game for good.
      player.dead = true;
      player.respawnTimer = 0;
    } else {
      // Waits 2s, then respawns at the spawn point while the other keeps playing.
      player.dead = true;
      player.respawnTimer = PLAYER_RESPAWN_SECONDS;
      player.vx = 0;
      player.vy = 0;
    }

    // Game over only when both players are out of lives.
    if (this.players.every((p) => this.isOutOfLives(p))) {
      this.state = 'GAME_OVER';
      saveHighScore(Math.max(...this.players.map((p) => p.score)));
      audio.stopBGM();
      audio.playGameOver();
    }
  }

  private update(dt: number): void {
    if (this.state !== 'PLAYING') {
      if (this.state === 'STAGE_CLEAR') {
        this.stageClearTimer -= (1 / 60) * dt;
        if (this.stageClearTimer <= 0) {
          // Advance the global stage counter. Layout wraps every 20 layouts;
          // rounds run 1-100, then loop back to 1 with retained difficulty
          // (the arcade's Super-round behavior).
          this.currentStageIndex++;
          this.loadStage(this.currentStageIndex);
          audio.playBGM(STAGE_META[this.currentStageIndex % STAGE_META.length].themeIndex);
          this.state = 'PLAYING';
        }
      }
      return;
    }

    const frameTime = (1 / 60) * dt;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= frameTime;
      if (this.shakeTimer < 0) this.shakeTimer = 0;
    }

    const isHitStop = this.hitStopTimer > 0;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= frameTime;
      if (this.hitStopTimer < 0) this.hitStopTimer = 0;
    }

    // Hurry Up enrage mechanic: after the (cycle-scaled) threshold, enrage all
    // remaining enemies (angry sprite + speed multiplier via Enemy.setAngry).
    this.stageElapsedTime += frameTime;
    if (!this.hurryUpTriggered && this.stageElapsedTime >= this.hurryUpThreshold) {
      this.triggerHurryUp();
    }

    // Skel-Monsta chase: 15s after hurry-up with the stage still uncleared.
    if (this.hurryUpTriggered && !this.skelMonsta) {
      this.skelMonstaTimer += frameTime;
      if (this.skelMonstaTimer >= SKEL_MONSTA_DELAY_SECONDS) {
        this.skelMonsta = new SkelMonsta(SCREEN_WIDTH / 2, -20);
      }
    }

    // Update Staggered Pop Cascades
    this.popQueue.forEach((task) => {
      task.delay -= 1 * dt;
      if (task.delay <= 0 && task.bubble.active && task.bubble.state !== 'POPPING') {
        this.spawnPopLoot(task.bubble, task.comboCount, task.owner);
        task.bubble.pop();
        audio.playPop(task.comboCount);
      }
    });
    this.popQueue = this.popQueue.filter((t) => t.delay > 0);

    if (isHitStop) {
      this.particles.update(frameTime);
      return;
    }

    // Update Players (input, physics, respawn timers)
    this.players.forEach((player, playerIdx) => {
      if (this.isOutOfLives(player)) return;

      if (player.dead) {
        player.respawnTimer -= frameTime;
        if (player.respawnTimer <= 0) {
          player.dead = false;
          player.x = playerIdx === 0 ? 64 : 96;
          player.y = 360;
          player.vx = 0;
          player.vy = 0;
          player.invincibleTimer = 2.0;
        }
        return;
      }

      player.handleInput(this.input, () => {
        // Arcade bubble limit: no new bubble while 8 are already on screen.
        if (this.bubbles.length >= MAX_BUBBLES_ON_SCREEN) return;
        const bubbleX = player.direction === 1 ? player.right : player.left - 12;
        const bubbleY = player.y + 2;

        // The 1986 arcade had no randomly-spawned special bubbles; bubbles are
        // always STANDARD (WATER/FIRE/LIGHTNING remain as pop/kill logic).
        const type: BubbleType = 'STANDARD';

        const bubbleSpeed = 9.0 * (player.hasCandy ? 1.3 : 1.0);
        const bubble = new Bubble(bubbleX, bubbleY, player.direction, type);
        bubble.bubbleSpeed = bubbleSpeed;
        bubble.vx = player.direction * bubbleSpeed;
        this.bubbles.push(bubble);
        audio.playShoot();
      });
    });

    const updateEntityPhysics = (entity: any) => {
      const prevY = entity.y;
      PhysicsSystem.applyGravity(entity, dt);
      PhysicsSystem.updatePosition(entity, dt);
      CollisionSystem.resolveMapCollisions(entity, this.currentStageMap, prevY);
      PhysicsSystem.handleScreenWrap(entity);
    };

    this.players.forEach((player) => {
      if (player.dead || this.isOutOfLives(player)) return;
      const wasGrounded = player.isGrounded;
      const vyBeforeLanding = player.vy;
      updateEntityPhysics(player);
      player.update(dt);

      if (!wasGrounded && player.isGrounded && vyBeforeLanding > LANDING_VY_THRESHOLD) {
        this.particles.spawnBurst(player.centerX, player.bottom, 5, '#c9b78a', {
          size: 1.5,
          life: 0.3,
        });
        audio.playLand();
      }
    });

    // Update Enemies
    this.enemies.forEach((enemy) => {
      if (enemy.active) {
        updateEntityPhysics(enemy);
        enemy.update(dt);

        // Mighta rock-throwing: when the throw cadence fires and a living
        // player is roughly on the Mighta's level, hurl a rock at them.
        if (enemy.active && enemy.wantsToThrow) {
          const target = this.nearestLivingPlayer(enemy.centerX, enemy.centerY);
          if (target && Math.abs(target.centerY - enemy.centerY) < 24) {
            const dir = target.centerX >= enemy.centerX ? 1 : -1;
            this.enemyRocks.push(new EnemyRock(enemy.centerX + dir * 12, enemy.y + 4, dir as 1 | -1));
            enemy.wantsToThrow = false;
          }
        }
      }
    });

    // Update Enemy Rocks (affected by gravity via map collisions)
    this.enemyRocks.forEach((rock) => {
      if (rock.active) {
        updateEntityPhysics(rock);
        rock.update(dt);
      }
    });

    // Update Skel-Monsta (ignores walls, chases the nearest living player)
    if (this.skelMonsta) {
      const target = this.nearestLivingPlayer(this.skelMonsta.centerX, this.skelMonsta.centerY);
      if (target) {
        this.skelMonsta.update(dt, target.centerX, target.centerY);
      }
    }

    // Apply bubble-on-bubble horizontal repulsion to prevent overlap/merging at ceiling
    for (let i = 0; i < this.bubbles.length; i++) {
      const bA = this.bubbles[i];
      if (!bA.active || (bA.state !== 'FLOATING' && bA.state !== 'ENEMY_TRAPPED')) continue;
      for (let j = i + 1; j < this.bubbles.length; j++) {
        const bB = this.bubbles[j];
        if (!bB.active || (bB.state !== 'FLOATING' && bB.state !== 'ENEMY_TRAPPED')) continue;

        const dx = bB.centerX - bA.centerX;
        const dy = bB.centerY - bA.centerY;
        const distY = Math.abs(dy);
        if (distY < 12) {
          const distX = Math.abs(dx);
          if (distX < 14) {
            const force = (14 - distX) * 0.05;
            const dir = dx > 0 ? 1 : -1;
            bA.vx -= dir * force;
            bB.vx += dir * force;
          }
        }
      }
    }

    // Update Bubbles
    this.bubbles.forEach((bubble) => {
      if (bubble.active) {
        // Apply Wind currents vector forces to floating/trapped bubbles
        if (bubble.state === 'FLOATING' || bubble.state === 'ENEMY_TRAPPED') {
          // Central region blows strongly UP; sides blow outward horizontally
          if (bubble.x > 64 && bubble.x < 192) {
            bubble.vy = -0.45;
            bubble.vx = (bubble.vx * 0.9) + (0 * 0.1); // return to center vector
          } else if (bubble.x <= 64) {
            bubble.vx = (bubble.vx * 0.9) + (-0.35 * 0.1); // float leftward
            bubble.vy = -0.15;
          } else {
            bubble.vx = (bubble.vx * 0.9) + (0.35 * 0.1); // float rightward
            bubble.vy = -0.15;
          }
        }

        bubble.x += bubble.vx * dt;
        bubble.y += bubble.vy * dt;

        if (bubble.state === 'FLOATING' || bubble.state === 'ENEMY_TRAPPED') {
          const row = Math.floor(bubble.y / this.currentStageMap.tileSize);
          const col = Math.floor(bubble.x / this.currentStageMap.tileSize);
          if (this.currentStageMap.getTile(col, row) === 1) {
            bubble.vy = 0;
            bubble.vx = 0;
            bubble.y = (row + 1) * this.currentStageMap.tileSize;
          }
        }

        PhysicsSystem.handleScreenWrap(bubble);
        bubble.update(dt);
      }
    });

    // Update Special Projectiles
    this.waterWaves.forEach((wave) => {
      if (wave.active) {
        updateEntityPhysics(wave);
        wave.update(dt);
      }
    });
    this.fireFlames.forEach((flame) => {
      if (flame.active) {
        updateEntityPhysics(flame);
        flame.update(dt);
      }
    });
    this.lightningBolts.forEach((bolt) => {
      if (bolt.active) {
        bolt.x += bolt.vx * dt;
        bolt.update(dt);
      }
    });

    // Update items
    this.items.forEach((item) => {
      if (item.active) {
        const wasGrounded = item.isGrounded;
        const prevVy = item.vy;
        updateEntityPhysics(item);

        // Bouncing logic:
        if (item.isGrounded && !wasGrounded && prevVy > 0.5 && item.bounces < 2) {
          item.vy = -prevVy * 0.4;
          item.isGrounded = false;
          item.bounces++;
        }

        item.update(dt);
      }
    });

    // Spawn wind visual flow particles
    if (Math.random() < 0.08) {
      // Spawn at random coordinates with drift matching local current
      const x = Math.random() * SCREEN_WIDTH;
      const y = SCREEN_HEIGHT;
      let vx = 0;
      let vy = -0.5;
      if (x <= 64) {
        vx = -0.4;
        vy = -0.15;
      } else if (x >= 192) {
        vx = 0.4;
        vy = -0.15;
      }
      this.windParticles.push({ x, y, vx, vy, life: 1.5 + Math.random() });
    }

    // Update wind particles
    this.windParticles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= frameTime;
    });
    this.windParticles = this.windParticles.filter((p) => p.life > 0 && p.y > 0);

    // Update event-driven particle effects
    this.particles.update(frameTime);

    this.handleCollisions();

    // Cleanup inactive
    this.bubbles = this.bubbles.filter((b) => b.active);
    this.enemies = this.enemies.filter((e) => e.active || e.enemyState === 'PATROL');
    this.items = this.items.filter((i) => i.active);
    this.waterWaves = this.waterWaves.filter((w) => w.active);
    this.fireFlames = this.fireFlames.filter((f) => f.active);
    this.lightningBolts = this.lightningBolts.filter((l) => l.active);
    this.enemyRocks = this.enemyRocks.filter((r) => r.active);

    const activeEnemiesLeft = this.enemies.filter((e) => e.active).length;
    const trappedEnemiesLeft = this.bubbles.filter((b) => b.state === 'ENEMY_TRAPPED').length;
    if (activeEnemiesLeft === 0 && trappedEnemiesLeft === 0) {
      // Skel-Monsta despawns once the stage is cleared.
      this.skelMonsta = null;
      this.state = 'STAGE_CLEAR';
      this.stageClearTimer = 2.0;
      audio.stopBGM();
      audio.playStageClear();
    }
  }

  private handleCollisions(): void {
    // A. Bubble vs Enemy (Trapping)
    this.bubbles.forEach((bubble) => {
      if (bubble.state === 'SHOOTING' && bubble.active) {
        this.enemies.forEach((enemy) => {
          if (enemy.active && CollisionSystem.checkAABB(bubble, enemy)) {
            bubble.trap(enemy);
            audio.playCapture();
          }
        });
      }
    });

    // B. Player vs Bubble (Bounce / Popping / Staggered Cascade)
    this.bubbles.forEach((bubble) => {
      if (!bubble.active) return;
      this.players.forEach((player) => {
        if (player.dead || this.isOutOfLives(player)) return;
        if (!CollisionSystem.checkAABB(player, bubble)) return;

        if (bubble.state === 'ENEMY_TRAPPED' && bubble.trappedEnemy) {
          // Trigger chain pop cascade instead of popping immediately
          this.triggerChainPop(bubble, player);
        } else if (bubble.state === 'FLOATING') {
          // Jump-on-bubble: falling onto the top of a bubble bounces off
          // WITHOUT popping it (arcade jump-on-bubbles mechanic).
          if (player.vy > 0 && player.bottom < bubble.centerY) {
            player.vy = -6;
            player.isGrounded = false;
          } else {
            // Side/bottom contact pops the bubble with a small hop.
            player.vy = -3.2;
            player.isGrounded = false;
            this.particles.spawnBurst(bubble.centerX, bubble.centerY, 8, BUBBLE_POP_COLORS[bubble.type] ?? BUBBLE_POP_COLORS.STANDARD, {
              size: 1.5,
              life: 0.35,
            });
            bubble.pop();
            audio.playPop(0);
          }
        }
      });
    });

    // C. Special Projectiles vs Enemies
    // WaterWaves sweep enemies
    this.waterWaves.forEach((wave) => {
      if (wave.active) {
        this.enemies.forEach((enemy) => {
          if (enemy.active && CollisionSystem.checkAABB(wave, enemy)) {
            // Defeat enemy
            this.items.push(new Item(enemy.x, enemy.y, 'MELON'));
            this.awardScore(800);
            enemy.active = false;
            audio.playPop(2);
          }
        });
      }
    });

    // FireFlames burn enemies
    this.fireFlames.forEach((flame) => {
      if (flame.active) {
        this.enemies.forEach((enemy) => {
          if (enemy.active && CollisionSystem.checkAABB(flame, enemy)) {
            this.items.push(new Item(enemy.x, enemy.y, 'BANANA'));
            this.awardScore(600);
            enemy.active = false;
            audio.playPop(1);
          }
        });
      }
    });

    // LightningBolts shock enemies
    this.lightningBolts.forEach((bolt) => {
      if (bolt.active) {
        this.enemies.forEach((enemy) => {
          if (enemy.active && CollisionSystem.checkAABB(bolt, enemy)) {
            this.items.push(new Item(enemy.x, enemy.y, 'APPLE'));
            this.awardScore(1000);
            enemy.active = false;
            audio.playPop(3);
          }
        });
      }
    });

    // D. Player vs Item (Collecting score)
    this.items.forEach((item) => {
      if (!item.active) return;
      this.players.forEach((player) => {
        if (player.dead || this.isOutOfLives(player) || !item.active) return;
        if (CollisionSystem.checkAABB(player, item)) {
          player.score += item.scoreValue;
          this.particles.spawnBurst(item.centerX, item.centerY, 10, '#fff2a8', { size: 1.5, life: 0.4 });
          if (item.type === 'SNEAKERS') {
            player.hasSneakers = true;
            this.particles.spawnBurst(item.centerX, item.centerY, 12, '#ff33aa', { size: 2, life: 0.5 });
            audio.playPickup(2);
          } else if (item.type === 'CANDY') {
            player.hasCandy = true;
            this.particles.spawnBurst(item.centerX, item.centerY, 12, '#ff3366', { size: 2, life: 0.5 });
            audio.playPickup(2);
          } else {
            audio.playPickup(item.scoreValue >= 1000 ? 1 : 0);
          }
          item.active = false;
        }
      });
    });

    // E. Player vs Enemy / Rock / Skel-Monsta (Losing lives)
    this.players.forEach((player) => {
      if (player.dead || this.isOutOfLives(player) || player.invincibleTimer > 0) return;

      this.enemies.forEach((enemy) => {
        if (enemy.active && CollisionSystem.checkAABB(player, enemy)) {
          this.killPlayer(player);
        }
      });

      if (player.dead) return;

      this.enemyRocks.forEach((rock) => {
        if (rock.active && CollisionSystem.checkAABB(player, rock)) {
          rock.active = false;
          this.killPlayer(player);
        }
      });

      if (player.dead) return;

      if (this.skelMonsta && this.skelMonsta.active && CollisionSystem.checkAABB(player, this.skelMonsta)) {
        this.killPlayer(player);
      }
    });
  }

  // Award unattributed projectile-kill score to the nearest living player.
  private awardScore(points: number): void {
    const target = this.nearestLivingPlayer(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2) ?? this.players[0];
    target.score += points;
  }

  private draw(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    if (this.shakeTimer > 0) {
      const dx = (Math.random() * 2 - 1) * this.shakeIntensity;
      const dy = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.ctx.translate(dx, dy);
    }
    // Removed 2x scale scaling since canvas resolution is now natively 512x448.
    // Responsive scaling is handled via CSS.

    if (this.state === 'START_SCREEN') {
      this.drawStartScreen();
    } else if (this.state === 'GAME_OVER') {
      this.drawGameOverScreen();
    } else {
      this.drawGameplay();
    }

    this.ctx.restore();
  }

  private drawStartScreen(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Title
    this.ctx.fillStyle = '#00ffcc';
    this.ctx.font = 'bold 28px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('BUBBLE BOBBLE', SCREEN_WIDTH / 2, 140);

    this.ctx.fillStyle = '#ffff00';
    this.ctx.font = '14px monospace';
    this.ctx.fillText('PRESS ENTER OR SPACE TO START', SCREEN_WIDTH / 2, 220);

    this.ctx.fillStyle = '#aaaaaa';
    this.ctx.font = '11px monospace';
    this.ctx.fillText('P1 Move: WASD / Arrows  |  Jump: W / ArrowUp  |  Shoot: Space / J', SCREEN_WIDTH / 2, 280);
    this.ctx.fillText('P2 Move: F / H  |  Jump: T  |  Shoot: G', SCREEN_WIDTH / 2, 300);
  }

  private drawGameOverScreen(): void {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this.ctx.fillStyle = '#ff3333';
    this.ctx.font = 'bold 28px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('GAME OVER', SCREEN_WIDTH / 2, 200);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`P1 SCORE ${`${this.players[0].score}`.padStart(6, '0')}`, SCREEN_WIDTH / 2, 240);
    this.ctx.fillText('PRESS SPACE TO RESTART', SCREEN_WIDTH / 2, 270);
  }

  private drawPlayer(player: Player): void {
    if (player.dead || this.isOutOfLives(player)) return;
    if (player.invincibleTimer > 0) {
      if (Math.floor(Date.now() / 100) % 2 === 0) {
        player.draw(this.ctx);
      }
    } else {
      player.draw(this.ctx);
    }
  }

  private drawLives(player: Player, color: string, rightAligned: boolean): void {
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < player.lives; i++) {
      const lx = rightAligned ? SCREEN_WIDTH - 20 - i * 12 : 20 + i * 12;
      const ly = SCREEN_HEIGHT - 12;
      this.ctx.beginPath();
      this.ctx.arc(lx, ly, 4, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  private drawGameplay(): void {
    const stageMeta = STAGE_META[this.currentStageIndex % STAGE_META.length];
    const themeIndex = stageMeta.themeIndex % TILE_THEMES.length;
    const theme = TILE_THEMES[themeIndex];

    // 0. Draw themed background gradient (static, no scrolling parallax)
    const bgGradient = this.ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    bgGradient.addColorStop(0, theme.bgGradientTop);
    bgGradient.addColorStop(1, theme.bgGradientBottom);
    this.ctx.fillStyle = bgGradient;
    this.ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 1. Draw Map Tiles
    const ts = this.currentStageMap.tileSize;
    for (let r = 0; r < this.currentStageMap.height; r++) {
      for (let c = 0; c < this.currentStageMap.width; c++) {
        const tile = this.currentStageMap.getTile(c, r);
        if (tile === 1 || tile === 2) {
          TileRenderer.draw(
            this.ctx,
            c * ts,
            r * ts,
            ts,
            themeIndex,
            tile,
            c === 0 || c === this.currentStageMap.width - 1
          );
        }
      }
    }

    // 2. Draw Wind Current Visual Particles
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.windParticles.forEach((p) => {
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
      this.ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4); // wind trail
      this.ctx.stroke();
    });

    // 3. Draw Projectiles
    this.waterWaves.forEach((w) => w.draw(this.ctx));
    this.fireFlames.forEach((f) => f.draw(this.ctx));
    this.lightningBolts.forEach((l) => l.draw(this.ctx));
    this.enemyRocks.forEach((r) => r.draw(this.ctx));

    // 3.5 Draw Skel-Monsta (behind bubbles, above tiles)
    if (this.skelMonsta) {
      this.skelMonsta.draw(this.ctx);
    }

    // 4. Draw Bubbles
    this.bubbles.forEach((b) => b.draw(this.ctx));

    // 5. Draw Items
    this.items.forEach((i) => i.draw(this.ctx));

    // 6. Draw Enemies
    this.enemies.forEach((e) => e.draw(this.ctx));

    // 7. Draw Players (Bub P1 + Bob P2)
    this.players.forEach((player) => this.drawPlayer(player));

    // 7.5 Draw Event Particles (bubble pops, enemy defeats, landings, pickups)
    this.particles.draw(this.ctx);

    // 8. Draw HUD - Classic Bubble Bobble arcade style
    // Left: 1UP (P1) in green, score in white
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('1UP', 16, 14);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`${this.players[0].score}`.padStart(6, '0'), 16, 26);

    // Center: HIGH SCORE in red
    this.ctx.fillStyle = '#ff3333';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('HIGH SCORE', SCREEN_WIDTH / 2, 14);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    const topScore = Math.max(loadHighScore(), ...this.players.map((p) => p.score));
    this.ctx.fillText(`${topScore}`.padStart(6, '0'), SCREEN_WIDTH / 2, 26);

    // Right: 2UP (P2) in blue/cyan
    this.ctx.fillStyle = '#00ccff';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.textAlign = 'right';
    this.ctx.fillText('2UP', SCREEN_WIDTH - 16, 14);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`${this.players[1].score}`.padStart(6, '0'), SCREEN_WIDTH - 16, 26);

    // 8.5 Draw In-Game Round number 1-100 (top-left, green number)
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${this.currentRound}`, 24, 48);

    // 8.6 Draw Player Lives as bubble circles: P1 bottom-left (green),
    // P2 bottom-right (cyan)
    this.drawLives(this.players[0], '#33ff55', false);
    this.drawLives(this.players[1], '#00ccff', true);

    if (this.state === 'STAGE_CLEAR') {
      this.ctx.fillStyle = '#00ffcc';
      this.ctx.font = 'bold 20px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('STAGE CLEAR!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    }

    // Hurry Up warning flash
    if (this.hurryUpTriggered && this.state === 'PLAYING') {
      if (Math.floor(Date.now() / 250) % 2 === 0) {
        this.ctx.fillStyle = '#ff3333';
        this.ctx.font = 'bold 18px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HURRY UP!', SCREEN_WIDTH / 2, 60);
      }
    }
  }
}
