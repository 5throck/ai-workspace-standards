import { PALETTE, type PaletteKey } from './palette';

/**
 * Pixel-grid sprites redrawn from the Donkey Kong (1981) arcade look.
 * Each grid is an array of strings; every character maps to a palette key,
 * '.' is transparent. Kept tiny and hand-tuned rather than ROM-extracted.
 */
export interface Sprite {
  rows: string[];
  /** Colors used by this sprite's character map. */
  colors: Record<string, PaletteKey>;
}

const J = { r: 'jumpmanRed', b: 'jumpmanBlue', s: 'jumpmanSkin' } as const satisfies Record<string, PaletteKey>;
const D = { d: 'dkBrown', l: 'dkLight', s: 'jumpmanSkin' } as const satisfies Record<string, PaletteKey>;

export const SPRITES = {
  jumpmanIdle: {
    rows: [
      '..rrrr..',
      '.rrrrrr.',
      '.ssbbss.',
      '.sbbbbs.',
      '..bbbb..',
      '.bbbbbb.',
      'sb.bb.bs',
      'sb.bb.bs',
    ],
    colors: J,
  },
  jumpmanRun1: {
    rows: [
      '..rrrr..',
      '.rrrrrr.',
      '.ssbbss.',
      '.sbbbbs.',
      '..bbbb..',
      '.bbbbb..',
      '.bb.bb..',
      '.b...b..',
    ],
    colors: J,
  },
  jumpmanRun2: {
    rows: [
      '..rrrr..',
      '.rrrrrr.',
      '.ssbbss.',
      '.sbbbbs.',
      '..bbbb..',
      '..bbbbb.',
      '..bb.bb.',
      '..b...b.',
    ],
    colors: J,
  },
  jumpmanClimb: {
    rows: [
      '..rrrr..',
      '.rrrrrr.',
      '.ssbbss.',
      '.sbbbbs.',
      '.sbbbb.s',
      '.bb..bb.',
      '.b....b.',
      '.b....b.',
    ],
    colors: J,
  },
  barrel: {
    rows: [
      '..oooo..',
      '.ollolo.',
      'ollllllo',
      'oloooolo',
      'ollllllo',
      '.ollool.',
      '..oooo..',
    ],
    colors: { o: 'barrelOrange', l: 'barrelLight' },
  },
  fireball: {
    rows: [
      '..ff..',
      '.fwff.',
      'ffwwff',
      'ffwwff',
      '.fwff.',
      '..ff..',
    ],
    colors: { f: 'fireBlue', w: 'fireWhite' },
  },
  pauline: {
    rows: [
      '..rr..',
      '.rrrr.',
      '.ssss.',
      '.s..s.',
      '.pppp.',
      '.pppp.',
      '.s..s.',
      '.s..s.',
    ],
    colors: { r: 'paulineRed', s: 'jumpmanSkin', p: 'paulinePink' },
  },
  hammer: {
    rows: [
      'wwww..',
      'wwww..',
      'wwww..',
      '..l...',
      '..l...',
    ],
    colors: { w: 'hammerWhite', l: 'ladderYellow' },
  },
} satisfies Record<string, Sprite>;

/** 3-frame DK set: idle, chest-beat, holding barrel overhead. */
export const DK_SPRITES = {
  idle: {
    rows: [
      '.....dddddddd.....',
      '....dddddddddd....',
      '...ddllddlllddd...',
      '...dlssdlsssddd...',
      '...dddddddddddd...',
      '..dddddddddddddd..',
      '.dlddllddddllddld.',
      '.dlllddllllddllld.',
      '..dd..dddddd..dd..',
      '..dd..dddddd..dd..',
      '.ldd..dddddd..ddl.',
      '.dd....dddd....dd.',
    ],
    colors: D,
  },
  beat: {
    rows: [
      '.....dddddddd.....',
      '....dddddddddd....',
      '...ddllddlllddd...',
      '...dlssdlsssddd...',
      'll.dddddddddd.ll..',
      'llddddddddddd.dll.',
      '.ddlldddddddllld..',
      '.dlllddllllddllld.',
      '..dd..dddddd..dd..',
      '..dd..dddddd..dd..',
      '.ldd..dddddd..ddl.',
      '.dd....dddd....dd.',
    ],
    colors: D,
  },
  throw: {
    rows: [
      '..oo..........oo..',
      '.oooo........oooo.',
      '..oo.dddddddd.oo..',
      '....dddddddddd....',
      '...ddllddlllddd...',
      '...dlssdlsssddd...',
      '...dddddddddddd...',
      '..dddddddddddddd..',
      '.dlllddddddlllld..',
      '..dd..dddddd..dd..',
      '.ldd..dddddd..ddl.',
      '.dd....dddd....dd.',
    ],
    colors: { ...D, o: 'barrelOrange' },
  },
} satisfies Record<string, Sprite>;

/** Renders a pixel sprite onto a 2D context at (x, y) with integer scaling. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  y: number,
  scale = 1,
  flip = false,
): void {
  const w = sprite.rows[0].length;
  for (let row = 0; row < sprite.rows.length; row++) {
    const line = sprite.rows[row];
    for (let col = 0; col < w; col++) {
      const ch = line[col];
      if (ch === '.' || ch === undefined) continue;
      const key = sprite.colors[ch];
      if (!key) continue;
      ctx.fillStyle = PALETTE[key];
      const dx = flip ? x + (w - 1 - col) * scale : x + col * scale;
      ctx.fillRect(dx, y + row * scale, scale, scale);
    }
  }
}

export function spriteWidth(sprite: Sprite): number {
  return sprite.rows[0].length;
}

export function spriteHeight(sprite: Sprite): number {
  return sprite.rows.length;
}
