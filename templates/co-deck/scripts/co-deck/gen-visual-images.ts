// @version 3.0.1 — backport from co-deck2 instance: target filter now honours an absent `visual` field — when `visualImage` is present but `visual` is undefined, an `images/`-prefixed visualImage still counts as a diagram target (previously such slides were silently dropped). Previous 3.0.0: infrastructure-only dispatcher.
// Generate right-panel visual images via SVG rendering (no browser required).
// Project-specific diagram generators live in presentations/<project>/diagram-defs.ts.
// Shared utilities (svgWrap, svgToPng, palettes) live in diagram-helpers.ts.
//
// Usage:
//   bun scripts/co-deck/gen-visual-images.ts --project presentations/<project>

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { svgToPng, fontPath } from './diagram-helpers.ts';

const args    = process.argv.slice(2);
const getArg  = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

const projectArg = getArg('--project');
if (!projectArg) {
  console.error('Usage: bun scripts/co-deck/gen-visual-images.ts --project presentations/<project>');
  process.exit(1);
}

const workspaceRoot = resolve(dirname(import.meta.path), '../..');
const projectDir    = resolve(workspaceRoot, projectArg);

if (!existsSync(projectDir)) {
  console.error(`Project folder not found: ${projectDir}`);
  process.exit(1);
}

// Load project-specific diagram generators
const defsPath = join(projectDir, 'diagram-defs.ts');
if (!existsSync(defsPath)) {
  console.log(`No diagram-defs.ts found in ${projectDir} — nothing to generate.`);
  process.exit(0);
}

const { GENERATORS } = await import(defsPath) as { GENERATORS: Record<string, () => string> };

// Read slidedata.json to discover which slides need diagrams
const slidedataPath = join(projectDir, 'slidedata.json');
if (!existsSync(slidedataPath)) {
  console.error('slidedata.json not found — run extract_slidedata.mjs first.');
  process.exit(1);
}
const slidedata: Array<Record<string, any>> = JSON.parse(readFileSync(slidedataPath, 'utf-8'));

const imagesDir = join(projectDir, 'images');
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

console.log(`\n🎨 Visual image generation (SVG → PNG, no browser)`);
console.log(`   Project: ${projectArg}`);
if (fontPath) console.log(`   Font   : ${fontPath}`);
else          console.log(`   Font   : system default (Korean may not render)`);

const targets = slidedata
  .map((s, i) => ({ slide: i + 1, data: s }))
  .filter(({ data }) => {
    if (!data.visualImage) return false;
    // If visual field exists, honour its value; otherwise treat images/ prefix as a diagram target
    if (data.visual !== undefined) return data.visual.toLowerCase() !== 'none';
    return (data.visualImage as string).startsWith('images/');
  });

console.log(`   Targets: ${targets.length} slides\n`);

let success = 0, skipped = 0;
for (const { slide, data } of targets) {
  const imgPath  = data.visualImage as string;
  const stem     = imgPath.replace(/^images\//, '').replace(/\.png$/, '');
  const destPath = join(projectDir, imgPath);

  const gen = GENERATORS[stem];
  if (!gen) {
    console.log(`   ⚠️  Slide ${slide}: no generator for "${stem}", skipping`);
    skipped++;
    continue;
  }

  try {
    const svg     = gen();
    const svgPath = destPath.replace(/\.png$/, '.svg');
    writeFileSync(svgPath, svg, 'utf-8');
    const png = svgToPng(svg);
    writeFileSync(destPath, png);
    console.log(`   ✅  Slide ${slide} → ${imgPath} (${Math.round(png.length / 1024)}KB) + .svg`);
    success++;
  } catch (e) {
    console.error(`   ❌  Slide ${slide}: ${(e as Error).message}`);
  }
}

console.log(`\n✅ Done: ${success} generated, ${skipped} skipped`);
console.log(`   Re-run PDF: bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg}\n`);
