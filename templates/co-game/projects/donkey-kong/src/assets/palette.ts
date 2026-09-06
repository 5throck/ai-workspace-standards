/**
 * Arcade-fidelity palette approximating the Donkey Kong (Nintendo, 1981)
 * cabinet look: black backdrop, blue girders on 25m, red beams, yellow
 * ladders, and the classic skin/suit colors for Jumpman, DK, and Pauline.
 */
export const PALETTE = {
  black: '#000000',
  girderRed: '#f80000',
  girderPink: '#fc7460',
  ladderYellow: '#fcc838',
  bgBlue: '#0000a8',
  bgLightBlue: '#3b3bff',
  jumpmanRed: '#f83800',
  jumpmanBlue: '#0058f8',
  jumpmanSkin: '#fcc4a0',
  dkBrown: '#c85a28',
  dkLight: '#e8a058',
  barrelOrange: '#e45c10',
  barrelLight: '#fc9838',
  paulinePink: '#f878b8',
  paulineRed: '#f83800',
  hammerWhite: '#fcfcfc',
  fireBlue: '#3bfcfc',
  fireWhite: '#fcfcfc',
  oilGray: '#8c8c8c',
  uiWhite: '#fcfcfc',
  uiYellow: '#fcc838',
} as const;

export type PaletteKey = keyof typeof PALETTE;
