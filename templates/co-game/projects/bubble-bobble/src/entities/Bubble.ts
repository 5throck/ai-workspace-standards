import { EntityBase, EntityDirection } from './EntityBase';
import { Enemy } from './Enemy';
import { ProceduralSprites } from '../rendering/ProceduralSprites';

export type BubbleState = 'SHOOTING' | 'FLOATING' | 'ENEMY_TRAPPED' | 'POPPING';
export type BubbleType = 'STANDARD' | 'WATER' | 'FIRE' | 'LIGHTNING';

export class Bubble extends EntityBase {
  public state: BubbleState = 'SHOOTING';
  public type: BubbleType;
  public bubbleSpeed: number = 9.0; // Fired with higher initial velocity
  public shootingTimer: number = 0.25; // max horizontal travel time
  public floatTimer: number = 6.0; // floats for 6 seconds, then pops automatically
  public popTimer: number = 0.15; // popping animation takes 150ms
  
  public trappedEnemy: Enemy | null = null;
  public trapTimer: number = 0;
  public warningTimer: number = 2.0; // turns red/shakes in last 2 seconds of trap

  constructor(x: number, y: number, dir: EntityDirection, type: BubbleType = 'STANDARD') {
    super(x, y, 24, 24);
    this.direction = dir;
    this.type = type;
    this.vx = dir * this.bubbleSpeed;
    this.vy = 0;
    this.gravityScale = 0; // bubbles ignore gravity
  }

  public trap(enemy: Enemy): void {
    this.state = 'ENEMY_TRAPPED';
    this.trappedEnemy = enemy;
    this.trappedEnemy.active = false; // deactivate enemy from normal updates
    this.trapTimer = 5.0; // enemy trapped for 5 seconds
    this.vx = 0;
    this.vy = -0.6; // slowly float up
    this.width = 32; // grow slightly to encompass enemy
    this.height = 32;
  }

  public update(dt: number): void {
    if (!this.active) return;

    const frameTime = (1 / 60) * dt;

    if (this.state === 'SHOOTING') {
      // Damp horizontal speed rapidly to mimic arcade velocity decay
      this.vx *= Math.pow(0.82, dt);
      
      this.shootingTimer -= frameTime;
      if (this.shootingTimer <= 0 || Math.abs(this.vx) < 0.5) {
        this.state = 'FLOATING';
        this.vx = 0;
        this.vy = -0.6; // start floating up
      }
    } else if (this.state === 'FLOATING') {
      this.floatTimer -= frameTime;
      if (this.floatTimer <= 0) {
        this.pop();
      }
    } else if (this.state === 'ENEMY_TRAPPED') {
      this.trapTimer -= frameTime;
      if (this.trapTimer <= 0) {
        this.escapeEnemy();
      }
    } else if (this.state === 'POPPING') {
      this.popTimer -= frameTime;
      if (this.popTimer <= 0) {
        this.active = false;
      }
    }
  }

  public pop(): void {
    this.state = 'POPPING';
    this.vx = 0;
    this.vy = 0;
  }

  private escapeEnemy(): void {
    if (this.trappedEnemy) {
      this.trappedEnemy.x = this.x;
      this.trappedEnemy.y = this.y;
      this.trappedEnemy.active = true;
      this.trappedEnemy.setAngry(true); // escape angry!
    }
    this.trappedEnemy = null;
    this.pop();
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    
    let spriteKey = '';
    if (this.state === 'SHOOTING') {
      spriteKey = 'bubble_shoot';
    } else if (this.state === 'FLOATING') {
      spriteKey = 'bubble_float';
    } else if (this.state === 'ENEMY_TRAPPED') {
      if (this.trapTimer < this.warningTimer) {
        const pulse = Math.floor(Date.now() / 150) % 2;
        spriteKey = pulse ? 'bubble_trap_warn2' : 'bubble_trap_warn1';
      } else {
        spriteKey = 'bubble_trap_warn1';
      }
    } else if (this.state === 'POPPING') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + 12);
      ctx.lineTo(this.x + 24, this.y + 12);
      ctx.moveTo(this.x + 12, this.y);
      ctx.lineTo(this.x + 12, this.y + 24);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const sprite = ProceduralSprites.get(spriteKey);
    if (sprite) {
      ctx.drawImage(sprite, this.x, this.y, this.width, this.height);
    } else {
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 200, 255, 0.4)';
      ctx.fill();
    }

    // Draw special bubble visual elements inside standard bubble
    if (this.state === 'FLOATING' || this.state === 'SHOOTING') {
      if (this.type === 'WATER') {
        ctx.fillStyle = '#1e90ff';
        ctx.fillRect(this.x + 10, this.y + 10, 4, 4); // blue dot representing water
      } else if (this.type === 'FIRE') {
        ctx.fillStyle = '#ff3300';
        ctx.fillRect(this.x + 10, this.y + 10, 4, 4); // red dot representing fire
      } else if (this.type === 'LIGHTNING') {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(this.x + 10, this.y + 10, 4, 4); // yellow dot representing lightning
      }
    }

    // If enemy is trapped, draw their scaled sprite inside bubble
    if (this.state === 'ENEMY_TRAPPED' && this.trappedEnemy) {
      const walkFrame = Math.floor(Date.now() / 150) % 4;
      const frameStr = `patrol${walkFrame + 1}`;
      const enemyKey = this.trappedEnemy.type === 'ZEN_CHAN' ? `zenChan_${frameStr}` : `mighta_${frameStr}`;
      const enemySprite = ProceduralSprites.get(`${enemyKey}_right`);
      if (enemySprite) {
        ctx.drawImage(enemySprite, this.x + 2, this.y + 2, this.width - 4, this.height - 4);
      }
    }

    ctx.restore();
  }
}
