import { EntityBase, EntityDirection } from './EntityBase';
import { ProceduralSprites } from '../rendering/ProceduralSprites';
import { AnimationController } from '../rendering/AnimationController';

export type EnemyType = 'ZEN_CHAN' | 'MIGHTA';
export type EnemyState = 'PATROL' | 'ANGRY';

export class Enemy extends EntityBase {
  public type: EnemyType;
  public enemyState: EnemyState = 'PATROL';

  public speed: number = 1.6;
  public jumpForce: number = -7.6;
  public isAngry: boolean = false;
  public angerSpeedMultiplier: number = 1.5;

  private jumpTimer: number = 0;
  private changeDirTimer: number = 0;
  private animController: AnimationController;

  constructor(x: number, y: number, type: EnemyType = 'ZEN_CHAN') {
    super(x, y, 24, 28); // hitbox for 16px tile scale
    this.type = type;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.vx = this.direction * this.speed;
    this.jumpTimer = Math.random() * 2 + 1; // jump randomly every 1 to 3 seconds

    const prefix = type === 'ZEN_CHAN' ? 'zenChan' : 'mighta';
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

    // AI Logic: periodic jumping
    this.jumpTimer -= frameTime;
    if (this.jumpTimer <= 0 && this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
      this.jumpTimer = Math.random() * 3 + 1.5; // schedule next jump
    }

    // AI Logic: direction changes on random intervals (only if on ground)
    this.changeDirTimer -= frameTime;
    if (this.changeDirTimer <= 0 && this.isGrounded) {
      if (Math.random() < 0.15) { // 15% chance to turn around randomly
        this.turnAround();
      }
      this.changeDirTimer = Math.random() * 2 + 1;
    }

    // Set horizontal speed based on direction and anger state
    const baseSpeed = this.speed * (this.isAngry ? this.angerSpeedMultiplier : 1.0);
    
    // If the physics system set vx to 0 (meaning hit a wall), immediately turn around!
    if (Math.abs(this.vx) < 0.05 && this.isGrounded) {
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
      ctx.drawImage(sprite, this.x - 4, this.y - 2, 32, 32);
    } else {
      ctx.fillStyle = this.type === 'ZEN_CHAN' ? '#aaaaaa' : '#4444ff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    ctx.restore();
  }
}
