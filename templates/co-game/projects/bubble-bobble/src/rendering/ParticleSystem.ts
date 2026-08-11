// Lightweight pooled-array particle emitter used for one-shot visual feedback
// events (bubble pops, enemy defeats, player landings, item pickups). Kept
// separate from the pre-existing ad-hoc hazard-effect arrays in GameEngine
// (windParticles / waterWaves / fireFlames / lightningBolts).

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: boolean;
  text?: string;
}

export interface SpawnOptions {
  vx?: number;
  vy?: number;
  life?: number;
  color?: string;
  size?: number;
  gravity?: boolean;
  text?: string;
}

export class ParticleSystem {
  private static readonly MAX_PARTICLES = 150;
  private static readonly PARTICLE_GRAVITY = 0.12;

  private particles: Particle[] = [];

  public spawn(x: number, y: number, options: SpawnOptions = {}): void {
    if (this.particles.length >= ParticleSystem.MAX_PARTICLES) {
      // Drop the oldest particle to make room rather than growing unbounded.
      this.particles.shift();
    }

    const life = options.life ?? 0.5;
    this.particles.push({
      x,
      y,
      vx: options.vx ?? 0,
      vy: options.vy ?? 0,
      life,
      maxLife: life,
      color: options.color ?? '#ffffff',
      size: options.size ?? 2,
      gravity: options.gravity ?? false,
      text: options.text,
    });
  }

  /** Spawns a radial burst of small colored particles around (x, y). */
  public spawnBurst(x: number, y: number, count: number, color: string, options: Partial<SpawnOptions> = {}): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      this.spawn(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: options.life ?? (0.3 + Math.random() * 0.3),
        color,
        size: options.size ?? (1 + Math.random() * 1.5),
        gravity: options.gravity ?? false,
      });
    }
  }

  /** Spawns a small floating text particle (e.g. "+1000") that drifts upward. */
  public spawnText(x: number, y: number, text: string, color: string = '#ffee00'): void {
    this.spawn(x, y, {
      vx: 0,
      vy: -0.5,
      life: 0.9,
      color,
      size: 8,
      gravity: false,
      text,
    });
  }

  public clear(): void {
    this.particles = [];
  }

  public update(frameTime: number): void {
    this.particles.forEach((p) => {
      if (p.gravity) {
        p.vy += ParticleSystem.PARTICLE_GRAVITY * frameTime * 60 * (1 / 60);
      }
      p.x += p.vx;
      p.y += p.vy;
      p.life -= frameTime;
    });
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  public draw(ctx: CanvasRenderingContext2D): void {
    this.particles.forEach((p) => {
      const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.text) {
        ctx.fillStyle = p.color;
        ctx.font = `${p.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    });
  }
}
