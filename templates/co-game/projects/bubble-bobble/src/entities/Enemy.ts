import { EntityBase, EntityDirection } from './EntityBase';
import { ProceduralSprites } from '../rendering/ProceduralSprites';
import { AnimationController } from '../rendering/AnimationController';

export type EnemyType = 'ZEN_CHAN' | 'MIGHTA' | 'INVADER';
export type EnemyState = 'PATROL' | 'ANGRY';

// How often a Mighta attempts a rock throw (arcade: roughly every 3 seconds).
const MIGHTA_THROW_INTERVAL = 3.0;

export class Enemy extends EntityBase {
  public type: EnemyType;
  public enemyState: EnemyState = 'PATROL';

  public speed: number = 1.6;
  public jumpForce: number = -7.6;
  public isAngry: boolean = false;
  public angerSpeedMultiplier: number = 1.5;

  // Mighta rock-throwing: the enemy raises the flag on its throw cadence and
  // GameEngine consumes it (spawning a rock) when a player is on its level.
  public wantsToThrow: boolean = false;
  private throwTimer: number = MIGHTA_THROW_INTERVAL;

  // INVADER (Blubbor) floating behavior: sine-wave drift instead of walking.
  private readonly isFloating: boolean;
  private floatPhase: number = Math.random() * Math.PI * 2;
  private readonly floatAmplitude: number = 1.2;
  private readonly floatFrequency: number = 3.0;

  private jumpTimer: number = 0;
  private changeDirTimer: number = 0;
  private animController: AnimationController;

  constructor(x: number, y: number, type: EnemyType = 'ZEN_CHAN') {
    super(x, y, 24, 28); // hitbox for 16px tile scale
    this.type = type;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.vx = this.direction * this.speed;
    this.jumpTimer = Math.random() * 2 + 1; // jump randomly every 1 to 3 seconds
    this.isFloating = type === 'INVADER';
    if (this.isFloating) {
      this.gravityScale = 0; // Blubbors float, they never fall
    }

    // INVADER reuses the Zen-Chan sheet (palette fallback in draw()).
    const prefix = type === 'MIGHTA' ? 'mighta' : 'zenChan';
    this.animController = new AnimationController({
      walk: {
        frames: [`${prefix}_patrol1`, `${prefix}_patrol2`, `${prefix}_patrol3`, `${prefix}_patrol4`],
        fps: 1000 / 150,
        loop: true,
      },
    }, 'walk');
  }

  public setAngry(angry: boolean): void {
    this.isAngry = angry;
    this.enemyState = angry ? 'ANGRY' : 'PATROL';
    const currentSpeed = this.speed;
    // Apply speed multiplier
    this.vx = this.direction * currentSpeed * (angry ? this.angerSpeedMultiplier : 1.0);
  }

  public update(dt: number): void {
    if (!this.active) return;

    const frameTime = (1 / 60) * dt;

    // Mighta rock-throwing cadence (consumed by GameEngine).
    if (this.type === 'MIGHTA') {
      this.throwTimer -= frameTime;
      if (this.throwTimer <= 0) {
        this.throwTimer = MIGHTA_THROW_INTERVAL;
        this.wantsToThrow = true;
      }
    }

    if (this.isFloating) {
      // Blubbor: erratic floating arcs — sine-wave vertical drift on top of
      // the horizontal patrol. No jumping, no gravity.
      this.floatPhase += frameTime * this.floatFrequency;
      this.vy = Math.sin(this.floatPhase) * this.floatAmplitude;
    } else {
      // AI Logic: periodic jumping
      this.jumpTimer -= frameTime;
      if (this.jumpTimer <= 0 && this.isGrounded) {
        this.vy = this.jumpForce;
        this.isGrounded = false;
        this.jumpTimer = Math.random() * 3 + 1.5; // schedule next jump
      }
    }

    // AI Logic: direction changes on random intervals (only if on ground;
    // floaters turn mid-air too since they never touch the ground)
    this.changeDirTimer -= frameTime;
    if (this.changeDirTimer <= 0 && (this.isGrounded || this.isFloating)) {
      if (Math.random() < 0.15) { // 15% chance to turn around randomly
        this.turnAround();
      }
      this.changeDirTimer = Math.random() * 2 + 1;
    }

    // Set horizontal speed based on direction and anger state
    const baseSpeed = this.speed * (this.isAngry ? this.angerSpeedMultiplier : 1.0);

    // If the physics system set vx to 0 (meaning hit a wall), immediately turn around!
    if (Math.abs(this.vx) < 0.05 && (this.isGrounded || this.isFloating)) {
      this.turnAround();
    } else {
      this.vx = this.direction * baseSpeed;
    }
  }

  private turnAround(): void {
    this.direction = (this.direction === 1 ? -1 : 1) as EntityDirection;
    const baseSpeed = this.speed * (this.isAngry ? this.angerSpeedMultiplier : 1.0);
    this.vx = this.direction * baseSpeed;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();

    this.animController.setState('walk');
    let spriteKey = this.animController.getFrameKey();

    if (this.isAngry) {
      spriteKey += '_angry';
    }

    const dirStr = this.direction === 1 ? 'right' : 'left';
    const sprite = ProceduralSprites.get(`${spriteKey}_${dirStr}`);

    if (sprite) {
      if (this.type === 'INVADER') {
        // Blubbor palette swap via hue rotation
        ctx.filter = 'hue-rotate(170deg) saturate(1.4)';
      }
      ctx.drawImage(sprite, this.x - 4, this.y - 2, 32, 32);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle =
        this.type === 'ZEN_CHAN' ? '#aaaaaa' :
        this.type === 'INVADER' ? '#22ccaa' : '#4444ff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    ctx.restore();
  }
}
