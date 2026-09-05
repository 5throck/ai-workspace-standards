import { EntityBase, EntityDirection } from './EntityBase';

export class WaterWave extends EntityBase {
  public lifetime: number = 2.0; // waves last 2 seconds
  public speed: number = 4.4; // 2x speed for 16px tile scale

  constructor(x: number, y: number, dir: EntityDirection) {
    super(x, y, 32, 24); // hitbox for 16px tile scale
    this.direction = dir;
    this.vx = dir * this.speed;
    this.vy = 0;
    this.gravityScale = 1.0;
  }

  public update(dt: number): void {
    const frameTime = (1 / 60) * dt;
    this.lifetime -= frameTime;
    if (this.lifetime <= 0) {
      this.active = false;
    }

    // Slide along platforms. If we hit a wall, reverse direction.
    if (Math.abs(this.vx) < 0.05 && this.isGrounded) {
      this.direction = (this.direction === 1 ? -1 : 1) as EntityDirection;
      this.vx = this.direction * this.speed;
    } else {
      this.vx = this.direction * this.speed;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();
    
    // Wave draw style
    ctx.fillStyle = 'rgba(30, 144, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + this.height);
    ctx.bezierCurveTo(
      this.x + this.width / 4, this.y,
      this.x + (3 * this.width) / 4, this.y,
      this.x + this.width, this.y + this.height
    );
    ctx.closePath();
    ctx.fill();

    // Wave crest highlights
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.x + (this.direction === 1 ? this.width - 8 : 4), this.y + 4, 4, 4);

    ctx.restore();
  }
}

export class FireFlame extends EntityBase {
  public lifetime: number = 3.0; // fires burn 3 seconds on the ground
  private flickerTimer: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 24, 24); // hitbox for 16px tile scale
    this.vx = 0;
    this.vy = 0;
    this.gravityScale = 0.6; // falls slower
  }

  public update(dt: number): void {
    const frameTime = (1 / 60) * dt;
    this.lifetime -= frameTime;
    if (this.lifetime <= 0) {
      this.active = false;
    }

    if (this.isGrounded) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();

    this.flickerTimer = (this.flickerTimer + 1) % 15;
    const isBig = this.flickerTimer < 8;

    // Draw procedural flame
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height;

    ctx.beginPath();
    ctx.moveTo(cx - 12, cy);
    ctx.quadraticCurveTo(cx - 10, cy - (isBig ? 24 : 18), cx, this.y);
    ctx.quadraticCurveTo(cx + 10, cy - (isBig ? 24 : 18), cx + 12, cy);
    ctx.closePath();
    ctx.fillStyle = '#ff3300';
    ctx.fill();

    // Inner yellow flame core
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy);
    ctx.quadraticCurveTo(cx - 4, cy - (isBig ? 16 : 12), cx, this.y + 8);
    ctx.quadraticCurveTo(cx + 4, cy - (isBig ? 16 : 12), cx + 6, cy);
    ctx.closePath();
    ctx.fillStyle = '#ffea00';
    ctx.fill();

    ctx.restore();
  }
}

export class LightningBolt extends EntityBase {
  public speed: number = 12.0; // 2x speed for 16px tile scale

  constructor(x: number, y: number, dir: EntityDirection) {
    super(x, y, 32, 12); // hitbox for 16px tile scale
    this.direction = dir;
    this.vx = dir * this.speed;
    this.vy = 0;
    this.gravityScale = 0; // lightning ignores gravity
  }

  public update(_dt: number): void {
    // If it stops (hits a solid wall boundary), immediately deactivate it
    if (Math.abs(this.vx) < 0.1) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();

    // Draw glowing neon zig-zag lightning bolt
    ctx.strokeStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 4;

    const midY = this.y + this.height / 2;
    ctx.beginPath();
    ctx.moveTo(this.x, midY);
    ctx.lineTo(this.x + this.width / 3, this.y);
    ctx.lineTo(this.x + (2 * this.width) / 3, this.y + this.height);
    ctx.lineTo(this.x + this.width, midY);
    ctx.stroke();

    ctx.restore();
  }
}

// Rock projectile thrown by Mighta enemies. Affected by gravity, kills a
// player on contact, and disappears when it hits the ground or a wall.
// Enemies are never harmed by their own rocks (GameEngine only checks players).
export class EnemyRock extends EntityBase {
  constructor(x: number, y: number, dir: EntityDirection) {
    super(x, y, 12, 12);
    this.direction = dir;
    this.vx = dir * 3.5;
    this.vy = -2.0; // small upward hop out of the Mighta's hand
  }

  public update(_dt: number): void {
    // Ground contact (isGrounded) or wall contact (vx zeroed by collision)
    // makes the rock crumble.
    if (this.isGrounded || Math.abs(this.vx) < 0.1) {
      this.active = false;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();

    const cx = this.centerX;
    const cy = this.centerY;
    ctx.fillStyle = '#8a7a66';
    ctx.beginPath();
    ctx.arc(cx, cy, this.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5c5044';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
  }
}
