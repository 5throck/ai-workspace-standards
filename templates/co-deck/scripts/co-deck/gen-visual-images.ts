// @version 3.2.0 — visualImage in slidedata.json now references SVG path (HTML primary delivery format); PNG still generated alongside for PDF use. Previous 3.1.0: unified output to shared pool.
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

const imagesDir = join(workspaceRoot, 'presentations', 'assets', 'diagrams');
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

console.log(`\n🎨 Visual image generation (SVG → PNG, no browser)`);
console.log(`   Project: ${projectArg}`);
if (fontPath) console.log(`   Font   : ${fontPath}`);
else          console.log(`   Font   : system default (Korean may not render)`);

const targets = slidedata
  .map((s, i) => ({ slide: i + 1, data: s }))
  .filter(({ data }) => {
    if (!data.visualImage) return false;
    // Accept both legacy per-project paths (images/...) and new shared pool paths (../assets/diagrams/...)
    const path = data.visualImage as string;
    return path.startsWith('images/') || path.startsWith('../assets/diagrams/');
  });

console.log(`   Targets: ${targets.length} slides\n`);

let success = 0, skipped = 0;
let slidedataDirty = false;

for (const { slide: slideIdx, data } of targets) {
  const imgPath  = data.visualImage as string;
  const stem     = imgPath.replace(/^images\//, '').replace(/^(\.\.\/assets\/diagrams\/)/, '').replace(/\.(png|svg)$/, '');
  const svgPath  = join(imagesDir, stem + '.svg');
  const pngPath  = join(imagesDir, stem + '.png');

  const gen = GENERATORS[stem];
  if (!gen) {
    console.log(`   ⚠️  Slide ${slideIdx}: no generator for "${stem}", skipping`);
    skipped++;
    continue;
  }

  try {
    const svg = gen();
    writeFileSync(svgPath, svg, 'utf-8');
    const png = svgToPng(svg);
    writeFileSync(pngPath, png);

    // Update slidedata visualImage path to shared pool SVG reference (HTML primary delivery format)
    const svgPoolPath = '../assets/diagrams/' + stem + '.svg';
    if (data.visualImage !== svgPoolPath) {
      data.visualImage = svgPoolPath;
      slidedataDirty = true;
    }

    console.log(`   ✅  Slide ${slideIdx} → ${svgPoolPath} + .png (PDF: ${Math.round(png.length / 1024)}KB)`);
    success++;
  } catch (e) {
    console.error(`   ❌  Slide ${slideIdx}: ${(e as Error).message}`);
  }
}

// Write updated slidedata.json if paths were rewritten
if (slidedataDirty) {
  writeFileSync(slidedataPath, JSON.stringify(slidedata, null, 2), 'utf-8');
  console.log(`   Updated slidedata.json visualImage paths → ../assets/diagrams/ (SVG — HTML primary)`);
}

console.log(`\n✅ Done: ${success} generated, ${skipped} skipped`);
console.log(`   Output: ${imagesDir}`);
console.log(`   Re-run PDF: bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg}\n`);
