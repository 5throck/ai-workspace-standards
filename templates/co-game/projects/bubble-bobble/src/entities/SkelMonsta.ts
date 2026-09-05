import { EntityBase } from './EntityBase';

// Skel-Monsta: the whale-shaped ghost that chases players after the Hurry Up
// enrage has been active for a while. It ignores walls entirely, moving
// straight toward the nearest living player at a moderate speed.
export class SkelMonsta extends EntityBase {
  public speed: number = 1.3;

  constructor(x: number, y: number) {
    super(x, y, 28, 24);
    this.gravityScale = 0; // ignores physics/gravity entirely
  }

  public update(dt: number, targetX?: number, targetY?: number): void {
    const tx = targetX ?? this.centerX;
    const ty = targetY ?? this.centerY;
    const dx = tx - this.centerX;
    const dy = ty - this.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0.001) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }
    // Straight-line movement: no wall collision is applied by GameEngine.
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;
    ctx.save();

    const cx = this.centerX;
    const cy = this.centerY;

    // White ghost/skeleton-face blob body
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.arc(cx, cy, this.width / 2, Math.PI, 0); // top half circle
    ctx.lineTo(this.x + this.width, this.y + this.height - 4);
    // wavy bottom edge
    ctx.quadraticCurveTo(cx + this.width / 4, this.y + this.height, cx, this.y + this.height - 4);
    ctx.quadraticCurveTo(cx - this.width / 4, this.y + this.height - 8, this.x, this.y + this.height - 4);
    ctx.closePath();
    ctx.fill();

    // Skeleton face: dark eye sockets and jagged mouth
    ctx.fillStyle = '#111111';
    const eyeOffset = this.direction === 1 ? 4 : -4;
    ctx.beginPath();
    ctx.arc(cx - 5 + eyeOffset, cy - 3, 3, 0, Math.PI * 2);
    ctx.arc(cx + 5 + eyeOffset, cy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 6 + eyeOffset, cy + 4, 12, 2);

    ctx.restore();
  }
}
