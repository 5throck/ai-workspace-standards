// Per-stage tile theming: bakes classic Bubble Bobble arcade-style tiles to
// offscreen canvases once (no per-frame allocation).
// Supports Stage 1 (green bricks), Stage 2 (blue bricks), Stage 3 (yellow blocks with pink diamonds)
// and classic side-wall vine rendering.

export interface TileTheme {
  wallBase: string;
  wallLight: string;
  wallDark: string;
  wallAccent: string;   // diamond cross-hatch color
  platformBase: string;
  platformHighlight: string;
  platformShadow: string;
  bgGradientTop: string;
  bgGradientBottom: string;
  isDiamond: boolean;    // True if theme uses diamond pattern, false if normal bricks
}

// Classic Bubble Bobble arcade themes: brick styles or diamond styles
export const TILE_THEMES: TileTheme[] = [
  // Stage 1-4: Classic green bricks (Stage 1 style)
  {
    wallBase: '#00aa00',
    wallLight: '#33ff33',
    wallDark: '#005500',
    wallAccent: 'transparent',
    platformBase: '#00bb00',
    platformHighlight: '#55ff55',
    platformShadow: '#005500',
    bgGradientTop: '#000000',
    bgGradientBottom: '#000000',
    isDiamond: false,
  },
  // Stage 5-8: Blue bricks (Stage 2 style)
  {
    wallBase: '#0055cc',
    wallLight: '#33aaff',
    wallDark: '#001a66',
    wallAccent: 'transparent',
    platformBase: '#0066dd',
    platformHighlight: '#55ccff',
    platformShadow: '#001a66',
    bgGradientTop: '#000000',
    bgGradientBottom: '#000000',
    isDiamond: false,
  },
  // Stage 9-12: Yellow/orange blocks with pink diamonds (Stage 3 style - matches reference image)
  {
    wallBase: '#e8a000',
    wallLight: '#ffcc33',
    wallDark: '#994400',
    wallAccent: '#ff44aa',
    platformBase: '#ffaa00',
    platformHighlight: '#ffdd55',
    platformShadow: '#994400',
    bgGradientTop: '#000000',
    bgGradientBottom: '#000000',
    isDiamond: true,
  },
  // Stage 13-16: Red/orange bricks
  {
    wallBase: '#cc2200',
    wallLight: '#ff6644',
    wallDark: '#660000',
    wallAccent: 'transparent',
    platformBase: '#dd3300',
    platformHighlight: '#ff8866',
    platformShadow: '#660000',
    bgGradientTop: '#000000',
    bgGradientBottom: '#000000',
    isDiamond: false,
  },
  // Stage 17-20: Purple blocks with yellow diamonds
  {
    wallBase: '#6600aa',
    wallLight: '#cc44ff',
    wallDark: '#330055',
    wallAccent: '#ffee00',
    platformBase: '#8800cc',
    platformHighlight: '#dd66ff',
    platformShadow: '#330055',
    bgGradientTop: '#000000',
    bgGradientBottom: '#000000',
    isDiamond: true,
  },
];

export class TileRenderer {
  private static cache: { [key: string]: HTMLCanvasElement } = {};

  public static init(tileSize: number): void {
    if (typeof window === 'undefined') return;

    // Bake all stage themes
    TILE_THEMES.forEach((theme, idx) => {
      if (theme.isDiamond) {
        this.cache[`solid_${idx}`] = this.bakeSolidDiamond(theme, tileSize);
        this.cache[`platform_${idx}`] = this.bakePlatformDiamond(theme, tileSize);
      } else {
        this.cache[`solid_${idx}`] = this.bakeSolidBrick(theme, tileSize);
        this.cache[`platform_${idx}`] = this.bakePlatformBrick(theme, tileSize);
      }
    });

    // Bake classic side-wall vine columns
    this.cache['vine'] = this.bakeVine(tileSize);
  }

  public static draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    themeIndex: number,
    tile: number,
    isOuterColumn: boolean = false
  ): void {
    if (isOuterColumn && tile === 1) {
      // Draw vine side walls
      const vineSprite = this.cache['vine'];
      if (vineSprite) {
        ctx.drawImage(vineSprite, x, y, size, size);
      }
      return;
    }

    const idx = themeIndex % TILE_THEMES.length;
    const key = tile === 1 ? `solid_${idx}` : `platform_${idx}`;
    const sprite = this.cache[key];
    if (sprite) {
      ctx.drawImage(sprite, x, y, size, size);
    }
  }

  // 1. Normal Solid Brick (Clean 8-bit split brick texture)
  private static bakeSolidBrick(theme: TileTheme, size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base fill
    ctx.fillStyle = theme.wallBase;
    ctx.fillRect(0, 0, size, size);

    // Brick mortar lines (split the block into 2 horizontal bricks)
    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(0, size / 2, size, 1.5); // horizontal split line
    ctx.fillRect(size / 2, 0, 1.5, size / 2); // top vertical split
    ctx.fillRect(0, size / 2, 1.5, size / 2); // bottom vertical split

    // 3D bevel highlights/shadows
    ctx.fillStyle = theme.wallLight;
    ctx.fillRect(0, 0, size, 1.5); // top edge
    ctx.fillRect(0, 0, 1.5, size); // left edge
    ctx.fillRect(0, size / 2 + 1, size, 1); // center top edge highlight

    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(0, size - 1.5, size, 1.5); // bottom
    ctx.fillRect(size - 1.5, 0, 1.5, size); // right
    ctx.fillRect(size / 2 - 1.5, 0, 1.5, size / 2); // top vertical shadow

    return canvas;
  }

  // 2. Normal Platform Brick
  private static bakePlatformBrick(theme: TileTheme, size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const barHeight = Math.max(4, Math.floor(size * 0.38));

    // Base fill
    ctx.fillStyle = theme.platformBase;
    ctx.fillRect(0, 0, size, barHeight);

    // Vertical brick lines
    ctx.fillStyle = theme.platformShadow;
    ctx.fillRect(size / 2, 0, 1.5, barHeight);

    // 3D highlights
    ctx.fillStyle = theme.platformHighlight;
    ctx.fillRect(0, 0, size, 1.5); // top highlight

    ctx.fillStyle = theme.platformShadow;
    ctx.fillRect(0, barHeight - 1.5, size, 1.5); // bottom shadow

    return canvas;
  }

  // 3. Diamond Solid Brick (Stage 3 Style)
  private static bakeSolidDiamond(theme: TileTheme, size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base fill
    ctx.fillStyle = theme.wallBase;
    ctx.fillRect(0, 0, size, size);

    // 4 rotated diamond dots inside (Stage 3 cross-hatch style)
    const step = size / 2;
    ctx.fillStyle = theme.wallAccent;
    for (let py = 0; py < size; py += step) {
      for (let px = 0; px < size; px += step) {
        const cx = px + step / 2;
        const cy = py + step / 2;
        const r = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.lineTo(cx + r, cy);
        ctx.lineTo(cx, cy + r);
        ctx.lineTo(cx - r, cy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 3D bevel
    ctx.fillStyle = theme.wallLight;
    ctx.fillRect(0, 0, size, 1.5);
    ctx.fillRect(0, 0, 1.5, size);

    ctx.fillStyle = theme.wallDark;
    ctx.fillRect(0, size - 1.5, size, 1.5);
    ctx.fillRect(size - 1.5, 0, 1.5, size);

    return canvas;
  }

  // 4. Diamond Platform Brick
  private static bakePlatformDiamond(theme: TileTheme, size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const barHeight = Math.max(4, Math.floor(size * 0.38));

    // Base fill
    ctx.fillStyle = theme.platformBase;
    ctx.fillRect(0, 0, size, barHeight);

    // 2 diamond dots
    ctx.fillStyle = theme.wallAccent;
    const points = [size / 4, (3 * size) / 4];
    for (const cx of points) {
      const cy = barHeight / 2;
      const r = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Bevel highlights
    ctx.fillStyle = theme.platformHighlight;
    ctx.fillRect(0, 0, size, 1.5);

    ctx.fillStyle = theme.platformShadow;
    ctx.fillRect(0, barHeight - 1.5, size, 1.5);

    return canvas;
  }

  // 5. Classic Side-Wall Vine Columns (with green leaves and red fruits on black background)
  private static bakeVine(size: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);

    // Vertical yellow/green border strip on the outer edges
    ctx.fillStyle = '#ffee00';
    ctx.fillRect(0, 0, 2, size);
    ctx.fillRect(size - 2, 0, 2, size);

    // Central green vine line
    ctx.strokeStyle = '#00cc00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();

    // Green leaves (diagonal segments)
    ctx.fillStyle = '#00aa00';
    ctx.beginPath();
    ctx.ellipse(size / 2 - 3, size / 3, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(size / 2 + 3, (2 * size) / 3, 3, 1.5, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    // Red fruit circle with white reflection (matching screenshot)
    ctx.fillStyle = '#ff2244';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(size / 2 - 1, size / 2 - 1, 1, 1); // shine spot

    return canvas;
  }
}
