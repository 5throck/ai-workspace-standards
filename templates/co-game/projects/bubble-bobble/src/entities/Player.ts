import { EntityBase } from './EntityBase';
import { InputHandler } from '../utils/InputHandler';
import { ProceduralSprites } from '../rendering/ProceduralSprites';
import { AnimationController } from '../rendering/AnimationController';

// Key bindings per player. P1 keeps the original bindings; P2 uses F/H for
// left/right, T for jump and G for shoot (no overlap with P1 or pause keys).
interface PlayerBindings {
  left: string[];
  right: string[];
  jump: string[];
  shoot: string[];
}

const P1_BINDINGS: PlayerBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  jump: ['ArrowUp', 'KeyW'],
  shoot: ['Space', 'KeyJ'],
};

const P2_BINDINGS: PlayerBindings = {
  left: ['KeyF'],
  right: ['KeyH'],
  jump: ['KeyT'],
  shoot: ['KeyG'],
};

const WALL_SLIDE_MAX_FALL = 1.0; // slow slide speed while clinging to a wall
const WALL_JUMP_PUSHBACK = 4.5; // horizontal push away from the wall on wall jump

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

  // Co-op: 0 = Bub (P1), 1 = Bob (P2, palette-swapped)
  public playerIndex: number;

  // Per-player death/respawn state. A dead player with lives remaining
  // respawns after 2s; lives <= 0 means out of the game.
  public dead: boolean = false;
  public respawnTimer: number = 0;
  public invincibleTimer: number = 0;

  private bindings: PlayerBindings;
  private animController = new AnimationController({
    idle: { frames: ['player_idle', 'player_idle2'], fps: 2, loop: true },
    walk: { frames: ['player_walk1', 'player_walk2', 'player_walk3', 'player_walk4'], fps: 10, loop: true },
    jump: { frames: ['player_jump'], fps: 1, loop: false },
    fall: { frames: ['player_fall'], fps: 1, loop: false },
    shoot: { frames: ['player_shoot', 'player_shoot2'], fps: 8, loop: true },
  }, 'idle');

  constructor(x: number, y: number, playerIndex: number = 0) {
    super(x, y, 24, 28); // hitbox for 16px tile scale
    this.playerIndex = playerIndex;
    this.bindings = playerIndex === 0 ? P1_BINDINGS : P2_BINDINGS;
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
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= (1 / 60) * dt;
    }
  }

  public handleInput(input: InputHandler, onShoot: () => void): void {
    if (this.dead) return;

    const anyPressed = (codes: string[]) => codes.some((code) => input.isPressed(code));

    // Horizontal Movement
    let moveX = 0;
    if (anyPressed(this.bindings.left)) {
      moveX = -1;
      this.direction = -1;
    } else if (anyPressed(this.bindings.right)) {
      moveX = 1;
      this.direction = 1;
    }
    this.vx = moveX * this.speed * (this.hasSneakers ? 1.3 : 1.0);

    const jumpPressed = anyPressed(this.bindings.jump);

    // Wall cling: airborne, falling, and pressing toward the wall we touch.
    // Cap fall speed to a slow slide.
    const wallClinging =
      !this.isGrounded &&
      this.vy > 0 &&
      this.touchingWall !== 0 &&
      moveX === this.touchingWall;
    if (wallClinging && this.vy > WALL_SLIDE_MAX_FALL) {
      this.vy = WALL_SLIDE_MAX_FALL;
    }

    // Jumping (from ground, or wall jump pushing away from the wall)
    if (jumpPressed && this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
    } else if (jumpPressed && !this.isGrounded && this.touchingWall !== 0) {
      // Wall jump: pushes away from the wall
      this.vy = this.jumpForce * 0.85;
      this.vx = -this.touchingWall * WALL_JUMP_PUSHBACK;
      this.direction = (-this.touchingWall) as -1 | 1;
      this.isGrounded = false;
    }

    // Variable jump height: cut vertical rising velocity short if jump key is released early
    if (!jumpPressed && this.vy < -3.0) {
      this.vy = -3.0;
    }

    // Shooting Bubbles
    if (anyPressed(this.bindings.shoot) && this.shootCooldown <= 0) {
      this.isShooting = true;
      this.shootingTimer = 0.25; // mouth open for 250ms
      this.shootCooldown = 0.35; // shoot every 350ms
      onShoot();

      // Retro recoil pushback
      this.vx = -this.direction * 1.5;
    }
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;
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
      // P2 (Bob) is a palette swap of Bub via hue rotation
      if (this.playerIndex === 1) {
        ctx.filter = 'hue-rotate(120deg) saturate(1.2)';
      }
      ctx.drawImage(sprite, this.x - 4, this.y - 2, 32, 32);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = this.playerIndex === 0 ? '#33aaff' : '#33dd55';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    ctx.restore();
  }
}
