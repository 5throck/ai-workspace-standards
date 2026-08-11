import { EntityBase } from './EntityBase';
import { InputHandler } from '../utils/InputHandler';
import { ProceduralSprites } from '../rendering/ProceduralSprites';
import { AnimationController } from '../rendering/AnimationController';

export class Player extends EntityBase {
  public speed: number = 3.0;
  public jumpForce: number = -10.5; // Increased to clear 96px platform gaps comfortably (peaks at ~138px)
  public shootCooldown: number = 0;
  public isShooting: boolean = false;
  public shootingTimer: number = 0;
  public hasSneakers: boolean = false;
  public hasCandy: boolean = false;

  // Scoring & Lives
  public score: number = 0;
  public lives: number = 3;

  private animController = new AnimationController({
    idle: { frames: ['player_idle', 'player_idle2'], fps: 2, loop: true },
    walk: { frames: ['player_walk1', 'player_walk2', 'player_walk3', 'player_walk4'], fps: 10, loop: true },
    jump: { frames: ['player_jump'], fps: 1, loop: false },
    fall: { frames: ['player_fall'], fps: 1, loop: false },
    shoot: { frames: ['player_shoot', 'player_shoot2'], fps: 8, loop: true },
  }, 'idle');

  constructor(x: number, y: number) {
    super(x, y, 24, 28); // hitbox for 16px tile scale
  }

  public update(dt: number): void {
    // Cooldown management
    if (this.shootCooldown > 0) {
      this.shootCooldown -= (1 / 60) * dt;
    }
    if (this.isShooting) {
      this.shootingTimer -= (1 / 60) * dt;
      if (this.shootingTimer <= 0) {
        this.isShooting = false;
      }
    }
  }

  public handleInput(input: InputHandler, onShoot: () => void): void {
    // Horizontal Movement
    let moveX = 0;
    if (input.isPressed('ArrowLeft') || input.isPressed('KeyA')) {
      moveX = -1;
      this.direction = -1;
    } else if (input.isPressed('ArrowRight') || input.isPressed('KeyD')) {
      moveX = 1;
      this.direction = 1;
    }
    this.vx = moveX * this.speed * (this.hasSneakers ? 1.3 : 1.0);

    // Jumping (Only if on ground)
    const jumpPressed = input.isPressed('ArrowUp') || input.isPressed('KeyW') || input.isPressed('KeyK');
    if (jumpPressed && this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
    }

    // Variable jump height: cut vertical rising velocity short if jump key is released early
    if (!jumpPressed && this.vy < -3.0) {
      this.vy = -3.0;
    }

    // Shooting Bubbles
    if ((input.isPressed('Space') || input.isPressed('KeyJ')) && this.shootCooldown <= 0) {
      this.isShooting = true;
      this.shootingTimer = 0.25; // mouth open for 250ms
      this.shootCooldown = 0.35; // shoot every 350ms
      onShoot();

      // Retro recoil pushback
      this.vx = -this.direction * 1.5;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    let state = 'idle';
    if (this.isShooting) {
      state = 'shoot';
    } else if (!this.isGrounded && this.vy < -0.1) {
      state = 'jump';
    } else if (!this.isGrounded && this.vy > 0.1) {
      state = 'fall';
    } else if (Math.abs(this.vx) > 0.1) {
      state = 'walk';
    }
    this.animController.setState(state);
    const spriteKey = this.animController.getFrameKey();

    const dirStr = this.direction === 1 ? 'right' : 'left';
    const sprite = ProceduralSprites.get(`${spriteKey}_${dirStr}`);
    if (sprite) {
      ctx.drawImage(sprite, this.x - 4, this.y - 2, 32, 32);
    } else {
      ctx.fillStyle = '#33aaff';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    ctx.restore();
  }
}
