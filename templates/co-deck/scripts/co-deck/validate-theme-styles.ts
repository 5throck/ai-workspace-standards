// @version 1.0.0
// Validate html-themes structure: theme.json compatible_styles ↔ styles/ directory cross-check.
// Usage:
//   bun scripts/co-deck/validate-theme-styles.ts [--root <path>]
//   --root  workspace root (default: two levels above this script)
// Exit codes: 0 = pass, 1 = validation errors found

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';

const args = process.argv.slice(2);
const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

const workspaceRoot = resolve(dirname(import.meta.path), '../..');
const themesDir  = join(workspaceRoot, 'docs/html-themes/themes');
const stylesDir  = join(workspaceRoot, 'docs/html-themes/styles');

let errors = 0;
let warnings = 0;

function err(msg: string)  { console.error(`  ERROR: ${msg}`); errors++; }
function warn(msg: string) { console.warn(`  WARN:  ${msg}`);  warnings++; }

// ── 1. Collect all style directories in styles/ (excluding base.css) ──────────

if (!existsSync(stylesDir)) {
  err(`styles/ directory not found: ${stylesDir}`);
  process.exit(1);
}

const styleDirs = readdirSync(stylesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

// ── 2. Read every theme.json and collect compatible_styles ────────────────────

if (!existsSync(themesDir)) {
  err(`themes/ directory not found: ${themesDir}`);
  process.exit(1);
}

const themeFolders = readdirSync(themesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const allCompatible = new Set<string>();

for (const theme of themeFolders) {
  const themeJsonPath = join(themesDir, theme, 'theme.json');
  if (!existsSync(themeJsonPath)) {
    warn(`theme.json missing for theme "${theme}": ${themeJsonPath}`);
    continue;
  }

  let themeJson: any;
  try {
    themeJson = JSON.parse(readFileSync(themeJsonPath, 'utf-8'));
  } catch (e: any) {
    err(`Failed to parse theme.json for "${theme}": ${e.message}`);
    continue;
  }

  const compatible: string[] = themeJson.compatible_styles ?? [];
  for (const style of compatible) {
    allCompatible.add(style);
    // Check that the style directory exists
    const styleDir = join(stylesDir, style);
    if (!existsSync(styleDir)) {
      err(`theme "${theme}" lists compatible_style "${style}" but styles/${style}/ does not exist`);
    } else {
      // Check that style.css exists inside the directory
      const styleCss = join(styleDir, 'style.css');
      if (!existsSync(styleCss)) {
        err(`styles/${style}/style.css missing (required by theme "${theme}" compatible_styles)`);
      }
      // Check that pdf_color_spec.json exists
      const colorSpec = join(styleDir, 'pdf_color_spec.json');
      if (!existsSync(colorSpec)) {
        warn(`styles/${style}/pdf_color_spec.json missing (referenced by theme "${theme}")`);
      }
    }
  }
}

// ── 3. Flag orphaned style directories (not in any theme's compatible_styles) ──

for (const styleDir of styleDirs) {
  if (!allCompatible.has(styleDir)) {
    warn(`styles/${styleDir}/ exists but is not listed in any theme's compatible_styles`);
  }
}

// ── 4. Verify styles/base.css exists ──────────────────────────────────────────

const baseCss = join(stylesDir, 'base.css');
if (!existsSync(baseCss)) {
  err(`styles/base.css not found — shared CSS foundation is missing`);
}

// ── 5. Report ─────────────────────────────────────────────────────────────────

console.log(`\nvalidate-theme-styles: themes=${themeFolders.length} styles=${styleDirs.length}`);
if (errors > 0 || warnings > 0) {
  console.log(`  ${errors} error(s), ${warnings} warning(s)`);
}

if (errors > 0) {
  console.error('\nvalidate-theme-styles FAILED');
  process.exit(1);
}

console.log('validate-theme-styles PASSED');
