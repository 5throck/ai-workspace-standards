// @version 0.1.0
// build-theme-preview.ts — generates preview HTML decks for all theme×style combinations.
//
// Reads preview-data.json and themes-manifest.js data, calls buildThemeDeck() for each
// compatible theme×style pair, and writes the resulting HTML to:
//   docs/html-themes/preview/decks/<theme>_<style>.html
//
// Usage:
//   bun scripts/co-deck/build-theme-preview.ts [--root <path>] [--theme <name>] [--style <name>]
//   --root       workspace root (default: two levels above this script)
//   --theme      build only this theme (default: all themes)
//   --style      build only this style (default: all compatible styles)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { buildThemeDeck, type BuildOptions } from './lib/theme-builder.js';
import { listThemeDirs, listStyleDirs, resolveWorkspaceRoot, normalizeStyleEntry, readJson } from './lib/theme-utils.js';

// --- CLI args ---
const args = process.argv.slice(2);
const rootArg = args.includes('--root') ? args[args.indexOf('--root') + 1] : undefined;
const workspaceRoot = rootArg ? resolve(rootArg) : resolveWorkspaceRoot(import.meta.path);
const filterTheme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : undefined;
const filterStyle = args.includes('--style') ? args[args.indexOf('--style') + 1] : undefined;

const previewDir = join(workspaceRoot, 'docs/html-themes/preview');
const decksDir = join(previewDir, 'decks');
const previewDataPath = join(previewDir, 'preview-data.json');

// --- Load preview slide data ---
const previewData = readJson<any[]>(previewDataPath);
if (!previewData) {
  console.error(`Error: preview-data.json not found or invalid at ${previewDataPath}`);
  process.exit(1);
}

// --- Read theme.json for each theme to get compatibility info ---
interface ThemeInfo {
  name: string;
  compatible_styles: string[];
  partial_styles: string[];
  incompatible_styles: string[];
}

function loadThemeInfo(themeName: string): ThemeInfo {
  const themeJsonPath = join(workspaceRoot, 'docs/html-themes/themes', themeName, 'theme.json');
  if (!existsSync(themeJsonPath)) {
    return { name: themeName, compatible_styles: [], partial_styles: [], incompatible_styles: [] };
  }
  const tj = readJson<any>(themeJsonPath);
  if (!tj) {
    return { name: themeName, compatible_styles: [], partial_styles: [], incompatible_styles: [] };
  }
  return {
    name: themeName,
    compatible_styles: (Array.isArray(tj.compatible_styles) ? tj.compatible_styles : [])
      .map(normalizeStyleEntry)
      .filter((s): s is string => s !== null),
    partial_styles: (Array.isArray(tj.partial_styles) ? tj.partial_styles : [])
      .map(normalizeStyleEntry)
      .filter((s): s is string => s !== null),
    incompatible_styles: (Array.isArray(tj.incompatible_styles) ? tj.incompatible_styles : [])
      .map(normalizeStyleEntry)
      .filter((s): s is string => s !== null),
  };
}

// --- Ensure decks directory exists ---
mkdirSync(decksDir, { recursive: true });

// --- Build decks ---
const themeDirs = listThemeDirs(workspaceRoot).sort();
let built = 0;
let errors = 0;

for (const theme of themeDirs) {
  if (filterTheme && theme !== filterTheme) continue;

  const info = loadThemeInfo(theme);

  // Build for each compatible style (includes partial styles)
  const stylesToBuild = info.compatible_styles.sort();
  for (const style of stylesToBuild) {
    if (filterStyle && style !== filterStyle) continue;

    const fileName = `${theme}_${style}.html`;
    const outputPath = join(decksDir, fileName);

    // cssRoot: from decks/<file>.html, the path to docs/html-themes/ is ../..
    const cssRoot = '../..';

    const opts: BuildOptions = {
      root: workspaceRoot,
      projectPath: decksDir,
      theme,
      style,
      title: `Preview — ${theme} × ${style}`,
      slideData: previewData,
      outputPath,
      cssRoot,
    };

    const result = buildThemeDeck(opts);

    if (result.errors.length > 0) {
      console.error(`  ✗ ${fileName}: ${result.errors.join('; ')}`);
      errors++;
      // Write a minimal error page instead so the iframe doesn't break
      const errorHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Error: ${theme}/${style}</title></head>
<body style="background:#1a1a2e;color:#ff6b6b;padding:40px;font-family:monospace">
<h1>Build Error: ${theme} × ${style}</h1>
<pre>${result.errors.map(e => e.replace(/</g, '&lt;')).join('\n')}</pre>
</body></html>`;
      writeFileSync(outputPath, errorHtml, 'utf-8');
    } else {
      writeFileSync(outputPath, result.html, 'utf-8');
      built++;
      const warningStr = result.warnings.length > 0 ? ` (${result.warnings.length} warning(s))` : '';
      console.log(`  ✓ ${fileName}${warningStr}`);
    }
  }
}

console.log(`\nDone: ${built} deck(s) built, ${errors} error(s).`);
console.log(`Output: ${decksDir}`);
