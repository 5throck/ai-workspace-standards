// Pre-renders authentic 8-bit retro pixel art sprites onto offscreen canvases.
// Sprites are authored as 16x16 character maps, then procedurally upscaled to
// 32x32 at bake time with a dark silhouette outline and 3-tone (highlight /
// base / shadow) shading applied per sub-pixel — see renderPixelMap().

type ColorPalette = { [key: string]: string };

export class ProceduralSprites {
  private static cache: { [key: string]: HTMLCanvasElement } = {};

  // Standard Color Palettes — matched to classic Bubble Bobble arcade colors
  private static palettes: { [key: string]: ColorPalette } = {
    player: {
      '.': 'transparent',
      'G': '#33ff55', // Bub Classic Green
      'W': '#ffffff', // Eye White
      'B': '#000000', // Eye Black
      'Y': '#ffee00', // Spikes / Belly Yellow
      'P': '#ff88cc', // Cheek Pink
      'D': '#00b33c', // Dark Green Shadow
      'T': '#ff99dd', // Tail tip pink
      'O': '#ff6600', // Orange shoes
    },
    zenChan: {
      '.': 'transparent',
      'P': '#aaaaaa', // Zen-Chan classic GRAY body (robot)
      'W': '#ffffff', // Face White
      'B': '#000000', // Eye Black
      'Y': '#ffcc00', // Yellow windup key / rivets
      'R': '#ff3333', // Red cheeks/details
      'D': '#666666', // Dark Gray Shadow
      'K': '#884400', // Brown key handle
    },
    mighta: {
      '.': 'transparent',
      'C': '#44bb44', // Mighta Green body (classic color)
      'W': '#ffffff', // White face/belly
      'B': '#000000', // Eye Black
      'Y': '#ffcc00', // Yellow crown/details
      'R': '#ff0000', // Red horns
      'D': '#226622', // Dark Green Shadow
      'O': '#ff6600', // Orange fireball hands
    }
  };

  // 16x16 Pixel Art Matrices
  private static spriteMaps: { [key: string]: string[] } = {
    // --- Player Sprites ---
    player_idle: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . . G G G G G G G G G G T . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_idle2: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . G W W W G G G G G G G T . .',
      '. . . G G G G G G G G G Y . . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_walk1: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . . G G G G G G G G G G T . .',
      '. . . . G G G G G G G G . . . .',
      '. . O O O O . . . O O O . . . .',
      '. . O O O O . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_walk2: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . G W W W G G G G G G G T . .',
      '. . . G G G G G G G G G Y . . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . . . . . . . O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_shoot: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. W W W W B B W W G G Y . . . .',
      '. . . . W W W W G G G Y Y . . .',
      '. G G G G P P G G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . . G G G G G G G G G G T . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_shoot2: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. W W W W B B W W G G Y . . . .',
      '. . . . W W W W G G G Y Y . . .',
      '. G G G G P P G G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . G W W W G G G G G G G T . .',
      '. . . G G G G G G G G G Y . . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_walk3: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . . G G G G G G G G G G T . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . O O O O . . . .',
      '. . . . . . . . O O O O . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_walk4: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . G W W W G G G G G G G T . .',
      '. . . G G G G G G G G G Y . . .',
      '. . . . G G G G G G G G . . . .',
      '. . . O O O . . . O O O . . . .',
      '. . . O O O . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_jump: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . Y .',
      '. . G G W W W W G G . . . . T .',
      '. G G W W B B W W G G Y . . G .',
      '. G G G W W W W G G G Y Y . G .',
      '. G G G G G P P G G G Y G G G .',
      '. G G G G G G G G G G G G G . .',
      '. G G G G G G G G G G G G . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G . . . . .',
      '. . . G G G G G G G . . . . . .',
      '. . . . G G G G G . . . . . . .',
      '. . . . O O . . O O . . . . . .',
      '. . . O O . . . O O . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    player_fall: [
      '. . . . G G G G . . . . . . . .',
      '. . . G G G G G G . . . . . . .',
      '. . G G W W W W G G . . . . . .',
      '. G G W W B B W W G G Y . . . .',
      '. G G G W W W W G G G Y Y . . .',
      '. G G G G G P P G G G Y . . . .',
      '. G G G G G G G G G G G . . . .',
      '. G G G G G G G G G G G . . . .',
      '. . G W W W G G G G G G . . . .',
      '. . G W W W G G G G G G G . . .',
      '. . G W W W G G G G G G G Y . .',
      '. . . G G G G G G G G G G T . .',
      '. . . . G G G G G G G G G . . .',
      '. . . . . O O . O O . . . . . .',
      '. . . . O O . . . O O . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],

    // --- Zen-Chan (Windup Toy Monster) ---
    zenChan_patrol1: [
      '. . . P P P P P . . . . Y . . .',
      '. . P P D P P P P . . Y Y Y . .',
      '. P P P D W B P P P . . Y . . .',
      '. P P P W W W P P P . . B . . .',
      '. P P P P P P P P P P B B B . .',
      '. P R R R R P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      '. P P P P P P P P P . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . . P P . . P P . . . . . . .',
      '. . Y Y . . . . Y Y . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    zenChan_patrol2: [
      '. . . P P P P P . . . . Y . . .',
      '. . P P D P P P P . . Y Y Y . .',
      '. P P P D W B P P P . . Y . . .',
      '. P P P W W W P P P . . B . . .',
      '. P P P P P P P P P P B B B . .',
      '. P R R R R P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      '. P P P P P P P P P . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . . P P P P P . . . . . . . .',
      '. . . Y Y . . P P . . . . . . .',
      '. . . . . . Y Y . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],

    zenChan_patrol3: [
      '. . . P P P P P . . . . Y . . .',
      '. . P P D P P P P . . Y Y Y . .',
      '. P P P D W B P P P . . Y . . .',
      '. P P P W W W P P P . . B . . .',
      '. P P P P P P P P P P B B B . .',
      '. P R R R R P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      '. P P P P P P P P P . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . . . Y Y Y Y . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    zenChan_patrol4: [
      '. . . P P P P P . . . . Y . . .',
      '. . P P D P P P P . . Y Y Y . .',
      '. P P P D W B P P P . . Y . . .',
      '. P P P W W W P P P . . B . . .',
      '. P P P P P P P P P P B B B . .',
      '. P R R R R P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      'P P P P P P P P P P P . . . . .',
      '. P P P P P P P P P . . . . . .',
      '. . P P P P P P P . . . . . . .',
      '. . . P P P P P . . . . . . . .',
      '. . Y Y . . . . Y Y . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],

    // --- Mighta (Wizard Monster) ---
    mighta_patrol1: [
      '. . . . C C C . . . . . . . . .',
      '. . . C C C C C . . . . . . . .',
      '. . C C R B C C C . . . . . . .',
      '. C C C R R C C C C . . . . . .',
      '. C C W W W W C C C . . . . . .',
      'C C C W W W W C C C C . . . . .',
      'C C C C C C C C C C C . . . Y .',
      'C C C C C C C C C C C . . Y Y Y',
      'C C C C C C C C C C C C . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . . C C . . C C . . . . . . .',
      '. . Y Y . . . . Y Y . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    mighta_patrol2: [
      '. . . . C C C . . . . . . . . .',
      '. . . C C C C C . . . . . . . .',
      '. . C C R B C C C . . . . . . .',
      '. C C C R R C C C C . . . . . .',
      '. C C W W W W C C C . . . . . .',
      'C C C W W W W C C C C . . . . .',
      'C C C C C C C C C C C . . . Y .',
      'C C C C C C C C C C C . . Y Y Y',
      'C C C C C C C C C C C C . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . . C C C C C C . . . . . . .',
      '. . . Y Y . . C C . . . . . . .',
      '. . . . . . Y Y . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    mighta_patrol3: [
      '. . . . C C C . . . . . . . . .',
      '. . . C C C C C . . . . . . . .',
      '. . C C R B C C C . . . . . . .',
      '. C C C R R C C C C . . . . . .',
      '. C C W W W W C C C . . . . . .',
      'C C C W W W W C C C C . . . . .',
      'C C C C C C C C C C C . . . Y .',
      'C C C C C C C C C C C . . Y Y Y',
      'C C C C C C C C C C C C . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . . . Y Y Y Y . . . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ],
    mighta_patrol4: [
      '. . . . C C C . . . . . . . . .',
      '. . . C C C C C . . . . . . . .',
      '. . C C R B C C C . . . . . . .',
      '. C C C R R C C C C . . . . . .',
      '. C C W W W W C C C . . . . . .',
      'C C C W W W W C C C C . . . . .',
      'C C C C C C C C C C C . . . Y .',
      'C C C C C C C C C C C . . Y Y Y',
      'C C C C C C C C C C C C . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. C C C C C C C C C C . . . Y .',
      '. . C C C C C C C C . . . . Y .',
      '. . . C C C C C C . . . . . . .',
      '. . Y Y . . . . Y Y . . . . . .',
      '. . . . . . . . . . . . . . . .',
      '. . . . . . . . . . . . . . . .'
    ]
  };

  public static get(key: string): HTMLCanvasElement | null {
    return this.cache[key] || null;
  }

  public static init(): void {
    if (typeof window === 'undefined') return;

    // Compile dynamic orientation versions of sprites
    Object.keys(this.spriteMaps).forEach((mapKey) => {
      const map = this.spriteMaps[mapKey];
      let paletteKey = 'player';
      if (mapKey.startsWith('zenChan')) paletteKey = 'zenChan';
      if (mapKey.startsWith('mighta')) paletteKey = 'mighta';

      const palette = this.palettes[paletteKey];

      // Draw Right-facing frame
      this.cache[`${mapKey}_right`] = this.renderPixelMap(map, palette, -1);
      // Draw Left-facing frame (flipped horizontally)
      this.cache[`${mapKey}_left`] = this.renderPixelMap(map, palette, 1);
    });

    // Angry pallet shifts for ZenChan and Mighta (Shift purple/blue to bright red/orange)
    this.createAngryPaletteVariants();

    // --- Bubble Sprites ---
    this.createBubbleCache('bubble_shoot', 'rgba(100, 200, 255, 0.4)', '#66ccff');
    this.createBubbleCache('bubble_float', 'rgba(150, 255, 150, 0.3)', '#99ff99');
    this.createBubbleCache('bubble_trap_warn1', 'rgba(255, 200, 0, 0.5)', '#ffcc00');
    this.createBubbleCache('bubble_trap_warn2', 'rgba(255, 50, 50, 0.5)', '#ff3333');

    // --- Fruit Items ---
    this.createFruitCache('fruit_apple', '#ff3300');
    this.createFruitCache('fruit_banana', '#ffe600');
    this.createFruitCache('fruit_cherry', '#ff0033');
    this.createFruitCache('fruit_melon', '#33cc33');

    // --- Power-Up Items ---
    this.createSneakersCache('powerup_sneakers');
    this.createCandyCache('powerup_candy');
  }

  // Source character maps are authored at 16x16; every sprite is baked out at
  // this resolution (2x nearest-neighbor upscale) so the finer pixel grid can
  // carry an outline + 3-tone shading pass. Destination draw calls must pass
  // an explicit width/height (see Player.ts / Enemy.ts) to keep on-screen
  // footprint unchanged.
  public static readonly BAKED_SIZE = 32;
  private static readonly SRC_SIZE = 16;
  private static readonly UPSCALE = 2;

  private static clampByte(v: number): number {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  private static shadeColor(hex: string, amount: number): string {
    // amount in [-1, 1]; positive lightens, negative darkens.
    const num = parseInt(hex.replace('#', ''), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    const delta = amount >= 0 ? (255 - Math.max(r, g, b)) * amount : Math.max(r, g, b) * amount;
    const nr = this.clampByte(r + delta);
    const ng = this.clampByte(g + delta);
    const nb = this.clampByte(b + delta);
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
  }

  private static renderPixelMap(map: string[], palette: ColorPalette, scaleX: number): HTMLCanvasElement {
    const size = this.SRC_SIZE * this.UPSCALE;
    const scale = this.UPSCALE;

    const opaque: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    const fill: (string | null)[][] = Array.from({ length: size }, () => new Array<string | null>(size).fill(null));

    for (let r = 0; r < this.SRC_SIZE; r++) {
      const pixels = map[r].split(' ');
      for (let c = 0; c < this.SRC_SIZE; c++) {
        const char = pixels[c];
        const color = palette[char];
        if (!color || color === 'transparent') continue;

        for (let sr = 0; sr < scale; sr++) {
          for (let sc = 0; sc < scale; sc++) {
            const ty = r * scale + sr;
            const tx = c * scale + sc;
            opaque[ty][tx] = true;
            // 3-tone shading: top-left sub-pixel is highlight, bottom-right
            // is shadow, remaining sub-pixels keep the base tone.
            let shade = color;
            if (sr === 0 && sc === 0) shade = this.shadeColor(color, 0.28);
            else if (sr === scale - 1 && sc === scale - 1) shade = this.shadeColor(color, -0.22);
            fill[ty][tx] = shade;
          }
        }
      }
    }

    // Silhouette outline: any transparent cell adjacent to an opaque cell.
    const outline: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (opaque[y][x]) continue;
        for (const [dy, dx] of neighbors) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < size && nx >= 0 && nx < size && opaque[ny][nx]) {
            outline[y][x] = true;
            break;
          }
        }
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    if (scaleX === -1) {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.fillStyle = '#0d0d0d';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (outline[y][x]) ctx.fillRect(x, y, 1, 1);
      }
    }

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const color = fill[y][x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    ctx.restore();
    return canvas;
  }

  private static createAngryPaletteVariants(): void {
    const angryZenPalette: ColorPalette = {
      ...this.palettes.zenChan,
      'P': '#ef4444', // Hot Red Body
      'D': '#b91c1c', // Dark Crimson Shadow
      'R': '#fbbf24', // Yellow highlight spikes
    };
    const angryMightaPalette: ColorPalette = {
      ...this.palettes.mighta,
      'C': '#f97316', // Hot Orange Robe
      'D': '#c2410c', // Dark Terracotta Shadow
      'R': '#ffeb3b', // Yellow glowing eyes
    };

    // Render angry variants
    ['zenChan_patrol1', 'zenChan_patrol2', 'zenChan_patrol3', 'zenChan_patrol4'].forEach((key) => {
      const map = this.spriteMaps[key];
      this.cache[`${key}_angry_right`] = this.renderPixelMap(map, angryZenPalette, -1);
      this.cache[`${key}_angry_left`] = this.renderPixelMap(map, angryZenPalette, 1);
    });

    ['mighta_patrol1', 'mighta_patrol2', 'mighta_patrol3', 'mighta_patrol4'].forEach((key) => {
      const map = this.spriteMaps[key];
      this.cache[`${key}_angry_right`] = this.renderPixelMap(map, angryMightaPalette, -1);
      this.cache[`${key}_angry_left`] = this.renderPixelMap(map, angryMightaPalette, 1);
    });
  }

  private static createBubbleCache(key: string, fill: string, stroke: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // Shiny radial gradient bubble — classic BB translucent sphere
    const grad = ctx.createRadialGradient(9, 9, 3, 12, 12, 12);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.15, fill);
    grad.addColorStop(1, fill);

    ctx.beginPath();
    ctx.arc(12, 12, 11, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Shine reflection spot (upper-left)
    ctx.beginPath();
    ctx.arc(7, 7, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.fill();

    // Secondary highlight arc along the upper rim
    ctx.beginPath();
    ctx.arc(12, 12, 8, Math.PI * 1.05, Math.PI * 1.65);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    this.cache[key] = canvas;
  }

  private static createFruitCache(key: string, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    // Circle main fruit body
    ctx.beginPath();
    ctx.arc(12, 14, 7, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Shine highlight
    ctx.beginPath();
    ctx.arc(9, 11, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    // Stem
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.quadraticCurveTo(15, 3, 18, 2);
    ctx.strokeStyle = '#663300';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Green leaf
    ctx.beginPath();
    ctx.ellipse(13, 6, 3, 1.5, Math.PI / 4, 0, Math.PI * 2);
    ctx.fillStyle = '#33cc33';
    ctx.fill();

    this.cache[key] = canvas;
  }

  private static createSneakersCache(key: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    // Sole
    ctx.fillStyle = '#996633';
    ctx.fillRect(4, 16, 16, 3);
    // Body
    ctx.beginPath();
    ctx.moveTo(4, 16);
    ctx.lineTo(20, 16);
    ctx.lineTo(20, 10);
    ctx.lineTo(12, 10);
    ctx.lineTo(8, 6);
    ctx.lineTo(4, 10);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Stripes
    ctx.beginPath();
    ctx.moveTo(12, 10);
    ctx.lineTo(15, 16);
    ctx.strokeStyle = '#ff33aa';
    ctx.lineWidth = 2;
    ctx.stroke();
    this.cache[key] = canvas;
  }

  private static createCandyCache(key: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    // Stick
    ctx.beginPath();
    ctx.moveTo(12, 12);
    ctx.lineTo(5, 19);
    ctx.strokeStyle = '#ffeedd';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Candy body
    ctx.beginPath();
    ctx.arc(14, 10, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ff3366';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Swirl
    ctx.beginPath();
    ctx.arc(14, 10, 3, 0, Math.PI * 1.5);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    this.cache[key] = canvas;
  }
}
