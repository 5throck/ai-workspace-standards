import { EntityBase } from './EntityBase';
import { ProceduralSprites } from '../rendering/ProceduralSprites';

export type ItemType = 'APPLE' | 'BANANA' | 'CHERRY' | 'MELON' | 'SNEAKERS' | 'CANDY';

export class Item extends EntityBase {
  public type: ItemType;
  public scoreValue: number = 500;
  public bounces: number = 0;
  
  constructor(x: number, y: number, type: ItemType = 'APPLE') {
    super(x, y, 20, 20); // hitbox for 16px tile scale
    this.type = type;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.gravityScale = 0.5; // items fall slower
    
    switch (type) {
      case 'APPLE':
        this.scoreValue = 400;
        break;
      case 'BANANA':
        this.scoreValue = 200;
        break;
      case 'CHERRY':
        this.scoreValue = 100;
        break;
      case 'MELON':
        this.scoreValue = 700;
        break;
      case 'SNEAKERS':
        this.scoreValue = 100;
        break;
      case 'CANDY':
        this.scoreValue = 100;
        break;
    }
  }

  public update(_dt: number): void {
    // Falls via gravity in PhysicsSystem, no special horizontal logic
    if (this.isGrounded) {
      this.vx = 0;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    
    let spriteKey = '';
    switch (this.type) {
      case 'APPLE':
        spriteKey = 'fruit_apple';
        break;
      case 'BANANA':
        spriteKey = 'fruit_banana';
        break;
      case 'CHERRY':
        spriteKey = 'fruit_cherry';
        break;
      case 'MELON':
        spriteKey = 'fruit_melon';
        break;
      case 'SNEAKERS':
        spriteKey = 'powerup_sneakers';
        break;
      case 'CANDY':
        spriteKey = 'powerup_candy';
        break;
    }

    const sprite = ProceduralSprites.get(spriteKey);
    if (sprite) {
      ctx.drawImage(sprite, this.x - 2, this.y - 2);
    } else {
      ctx.beginPath();
      ctx.arc(this.x + 10, this.y + 10, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#ff3300';
      ctx.fill();
    }

    ctx.restore();
  }
}
