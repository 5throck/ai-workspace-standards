// @version 1.1.0 — OS-aware font search paths (Windows, macOS, Linux).
// Playwright-free PDF layout preparation — replaces measure-layout.ts.
// Reads lecture-profile.md, resolves the 4-layer spec merge, validates fonts,
// and outputs a summary for review. Optionally triggers a sample PDF.
// Usage: bun scripts/co-deck/estimate-layout.ts --project presentations/<project> [--sample] [--font-dir fonts/]
// No Playwright dependency required.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname, homedir } from 'path';
import { platform } from 'os';

// ── Types ────────────────────────────────────────────────────────────────────

interface Region { x_pct: number; y_pct: number; w_pct: number; h_pct: number; fit?: string; }

interface LayoutSpec {
  version?: string;
  page?: { width_mm?: number; height_mm?: number; margin_mm?: number; aspect_ratio?: string };
  calibration?: { viewport_px?: number };
  regions?: Record<string, Region | null>;
  slide_types?: Record<string, { regions: string[] }>;
  slide_type_overrides?: Record<string, Record<string, Region | null>>;
  fonts?: Record<string, number>;
  line_heights?: Record<string, number>;
  colors?: Record<string, number[]>;
  image_zones?: Record<string, Region>;
  content_constraints?: Record<string, Record<string, number>>;
  print?: Record<string, any>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deepMerge(base: any, override: any): any {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] === null) {
      result[key] = null;
    } else if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] ?? {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = match[1];
  const lines = fm.split('\n');
  const result: Record<string, any> = {};
  for (const line of lines) {
    const themeMatch = line.match(/^\s{2}theme:\s*(\S+)/);
    const styleMatch = line.match(/^\s{2}style:\s*(\S+)/);
    if (themeMatch) result.theme = themeMatch[1];
    if (styleMatch) result.style = styleMatch[1];
  }
  // Extract layout_overrides using a simple indented-block parser
  const overrides = parseLayoutOverrides(fm);
  if (Object.keys(overrides).length > 0) {
    result.layout_overrides = overrides;
  }
  return result;
}

function parseLayoutOverrides(frontmatterContent: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = frontmatterContent.split('\n');

  // Detect the base indentation of the layout_overrides block
  let inBlock = false;
  let baseIndent = -1;

  for (const line of lines) {
    if (/^\s*layout_overrides:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^\s{2}[a-z]/.test(line)) {
      // Next top-level key encountered — end of layout_overrides block
      break;
    }
    if (!inBlock) continue;

    if (baseIndent < 0 && line.trim().length > 0) {
      const match = line.match(/^(\s+)/);
      if (match) baseIndent = match[1].length;
    }
    if (baseIndent < 0) continue;

    const trimmed = line.slice(baseIndent);
    if (!trimmed.trim()) continue;

    // Parse nested key: value
    const parts = trimmed.split(':').map(s => s.trim());
    if (parts.length >= 2) {
      const key = parts[0];
      const rawVal = parts.slice(1).join(':').trim();
      const val = parseScalar(rawVal);
      // Handle nesting (e.g., "fonts.title_pt" → nested object)
      const keys = key.split('.');
      let target = result;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      target[keys[keys.length - 1]] = val;
    }
  }

  return result;
}

function parseScalar(raw: string): any {
  const arrMatch = raw.match(/^\[(\d+),\s*(\d+),\s*(\d+)\]$/);
  if (arrMatch) return [Number(arrMatch[1]), Number(arrMatch[2]), Number(arrMatch[3])];
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.replace(/^["']|["']$/g, '');
}

// ── Font validation ──────────────────────────────────────────────────────────

interface FontStatus { name: string; regular: boolean; bold: boolean; path: string; }

/** OS-aware system font directories for PDF font discovery */
function getSystemFontDirs(): string[] {
  const p = platform();
  const home = homedir();
  if (p === 'win32') {
    return ['C:/Windows/Fonts'];
  } else if (p === 'darwin') {
    return [
      join(home, 'Library/Fonts'),
      '/Library/Fonts',
      '/System/Library/Fonts',
    ];
  } else {
    return [
      join(home, '.local/share/fonts'),
      '/usr/share/fonts/truetype',
      '/usr/share/fonts/opentype',
      '/usr/share/fonts',
    ];
  }
}

function findFontFile(prefix: string, suffix: string, searchDirs: string[]): string | null {
  // Search in project font dir first, then system dirs
  const filename = `${prefix}${suffix}`;
  for (const dir of searchDirs) {
    const path = join(dir, filename);
    if (existsSync(path)) return path;
  }
  return null;
}

function checkFonts(fontDir: string): FontStatus[] {
  const fonts = [
    { name: 'Pretendard', prefix: 'Pretendard' },
    { name: 'MaruBuri', prefix: 'MaruBuri' },
  ];

  // Build search path list: project dir → system dirs
  const searchDirs = [fontDir, ...getSystemFontDirs()];

  return fonts.map(f => ({
    name: f.name,
    regular: findFontFile(f.prefix, '-Regular.ttf', searchDirs) !== null,
    bold: findFontFile(f.prefix, '-Bold.ttf', searchDirs) !== null,
    path: findFontFile(f.prefix, '-Regular.ttf', searchDirs) ?? fontDir,
  }));
}

// ── Summary generator ───────────────────────────────────────────────────────

function generateSummary(
  theme: string,
  style: string,
  merged: LayoutSpec,
  hasOverrides: boolean,
  fontDir: string,
  fontStatus: FontStatus[],
): string {
  const lines: string[] = [
    '# PDF Layout Summary',
    '',
    `> Theme: **${theme}** | Style: **${style}**`,
    hasOverrides ? '> ⚠️ Project-level `layout_overrides` detected — overrides are active.' : '',
    '',
    '---',
    '',
  ];

  // Page info
  const page = merged.page ?? {};
  lines.push('## Page Dimensions', '');
  lines.push('| Property | Value |', '|----------|-------|');
  lines.push(`| Width | ${page.width_mm ?? 338.7} mm |`);
  lines.push(`| Height | ${page.height_mm ?? 190.5} mm |`);
  lines.push(`| Margin | ${page.margin_mm ?? 0} mm |`);
  lines.push(`| Aspect | ${page.aspect_ratio ?? '16:9'} |`);
  lines.push('');

  // Calibration
  const vp = merged.calibration?.viewport_px;
  if (vp) {
    lines.push(`**Viewport calibration**: ${vp}px height`);
    lines.push(`- px→mm: \`(px / ${vp}) × ${(page.height_mm ?? 190.5).toFixed(1)}\``);
    lines.push(`- px→pt: \`(px / ${vp}) × ${(page.height_mm ?? 190.5).toFixed(1)} × 2.835\``);
    lines.push('');
  }

  // Regions
  const regions = merged.regions ?? {};
  const typeOverrides = merged.slide_type_overrides ?? {};
  const slideTypes = merged.slide_types ?? {};

  lines.push('## Regions', '');
  lines.push('### Default Regions', '');
  lines.push('| Region | X% | Y% | W% | H% | Fit |', '|--------|-----|-----|-----|-----|-----|');
  for (const [name, r] of Object.entries(regions)) {
    if (r === null) { lines.push(`| ${name} | — | — | — | — | — |`); continue; }
    lines.push(`| ${name} | ${(r.x_pct * 100).toFixed(1)} | ${(r.y_pct * 100).toFixed(1)} | ${(r.w_pct * 100).toFixed(1)} | ${(r.h_pct * 100).toFixed(1)} | ${r.fit ?? '—'} |`);
  }
  lines.push('');

  // Per-slide-type overrides
  if (Object.keys(typeOverrides).length > 0) {
    lines.push('### Slide Type Overrides', '');
    for (const [type, overrides] of Object.entries(typeOverrides)) {
      const typeRegions = slideTypes[type]?.regions ?? [];
      lines.push(`**${type}** (uses: ${typeRegions.join(', ')}):`, '');
      lines.push('| Region | X% | Y% | W% | H% | Fit |', '|--------|-----|-----|-----|-----|-----|');
      for (const [name, r] of Object.entries(overrides)) {
        if (r === null) continue;
        lines.push(`| ${name} | ${(r.x_pct * 100).toFixed(1)} | ${(r.y_pct * 100).toFixed(1)} | ${(r.w_pct * 100).toFixed(1)} | ${(r.h_pct * 100).toFixed(1)} | ${r.fit ?? '—'} |`);
      }
      lines.push('');
    }
  }

  // Slide types
  lines.push('## Slide Types', '');
  lines.push('| Type | Regions Used |', '|------|--------------|');
  for (const [type, info] of Object.entries(slideTypes)) {
    lines.push(`| ${type} | ${info.regions.join(', ')} |`);
  }
  lines.push('');

  // Fonts
  const fonts = merged.fonts ?? {};
  if (Object.keys(fonts).length > 0) {
    lines.push('## Font Sizes', '');
    lines.push('| Key | Value |', '|-----|-------|');
    for (const [key, val] of Object.entries(fonts)) {
      const unit = key.endsWith('_pt') ? 'pt' : key.endsWith('_px') ? 'px' : '';
      lines.push(`| ${key} | ${val}${unit} |`);
    }
    lines.push('');
  }

  // Line heights
  const lineHeights = merged.line_heights ?? {};
  if (Object.keys(lineHeights).length > 0) {
    lines.push('## Line Heights', '');
    lines.push('| Key | Value (px) | Value (mm) |', '|-----|------------|------------|');
    for (const [key, val] of Object.entries(lineHeights)) {
      const mmVal = vp ? ((val / vp) * (page.height_mm ?? 190.5)).toFixed(2) : '—';
      lines.push(`| ${key} | ${val} | ${mmVal} |`);
    }
    lines.push('');
  }

  // Content constraints
  const constraints = merged.content_constraints ?? {};
  if (Object.keys(constraints).length > 0) {
    lines.push('## Content Constraints', '');
    for (const [type, rules] of Object.entries(constraints)) {
      lines.push(`**${type}**: ${Object.entries(rules as Record<string, number>).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
    lines.push('');
  }

  // Font availability
  lines.push('## Font Availability', '');
  lines.push(`Font directory: \`${fontDir}\``, '');
  lines.push('| Font | Regular | Bold |', '|------|---------|-----|');
  for (const fs of fontStatus) {
    const regIcon = fs.regular ? '✅' : '❌';
    const boldIcon = fs.bold ? '✅' : '❌';
    lines.push(`| ${fs.name} | ${regIcon} | ${boldIcon} |`);
  }
  lines.push('');

  const preferred = fontStatus.find(f => f.regular && f.bold);
  if (preferred) {
    lines.push(`**Active font**: ${preferred.name} (first found with Regular+Bold)`);
  } else {
    lines.push('⚠️ **No complete font pair found.** Run `bun scripts/co-deck/download-font.ts pretendard` to download.');
  }
  lines.push('');

  // Layer provenance
  lines.push('## Layer Provenance', '');
  lines.push('This summary reflects the merged result of:', '');
  lines.push('1. **Layer 0**: `themes/_shared/layout_base.json` (page dimensions, null regions)');
  lines.push(`2. **Layer 1**: \`themes/${theme}/pdf_layout_spec.json\` (regions, fonts, line heights)`);
  lines.push(`3. **Layer 2**: \`styles/${style}/pdf_color_spec.json\` (color palette)`);
  lines.push('4. **Layer 3**: `lecture-profile.md` → `layout_overrides` (per-project overrides)');
  if (hasOverrides) {
    lines.push('', '> ⚠️ Layer 3 overrides are active. Values above may differ from theme defaults.');
  }
  lines.push('');

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const has = (flag: string) => args.includes(flag);

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/co-deck/estimate-layout.ts --project presentations/<project> [--sample] [--font-dir fonts/]');
    console.error('');
    console.error('Options:');
    console.error('  --project    Project folder (relative to workspace root)');
    console.error('  --sample     Generate a 5-slide sample PDF after estimation');
    console.error('  --font-dir   Custom font directory (default: fonts/)');
    process.exit(1);
  }

  const wantSample = has('--sample');
  const fontDirArg = get('--font-dir');

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir = resolve(workspaceRoot, projectArg);

  if (!existsSync(projectDir)) {
    console.error(`❌ Project folder not found: ${projectDir}`);
    process.exit(1);
  }

  // ── Read lecture-profile.md ────────────────────────────────────────────────
  const lectureProfilePath = join(projectDir, 'lecture-profile.md');
  if (!existsSync(lectureProfilePath)) {
    console.error(`❌ lecture-profile.md not found: ${lectureProfilePath}`);
    console.error('   Create a lecture-profile.md in the project folder first.');
    process.exit(1);
  }

  const profileContent = readFileSync(lectureProfilePath, 'utf-8');
  const profile = parseFrontmatter(profileContent);

  const theme = profile.theme ?? 'scroll';
  const style = profile.style ?? 'premium-dark';
  const hasOverrides = !!profile.layout_overrides && Object.keys(profile.layout_overrides).length > 0;

  console.log(`\n📐 PDF Layout Estimation`);
  console.log(`   Project: ${projectArg}`);
  console.log(`   Theme:   ${theme}`);
  console.log(`   Style:   ${style}`);
  if (hasOverrides) console.log(`   ⚠️  layout_overrides detected in lecture-profile.md`);
  console.log('');

  // ── Load 4-layer spec files ────────────────────────────────────────────────
  const basePath = resolve(workspaceRoot, 'docs/html-themes/themes/_shared/layout_base.json');
  const themePath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
  const stylePath = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

  // Validate existence
  for (const [label, p] of [['layout_base.json', basePath], [`${theme}/pdf_layout_spec.json`, themePath]] as const) {
    if (!existsSync(p)) {
      console.error(`❌ Required spec not found: ${label}`);
      console.error(`   Expected: ${p}`);
      process.exit(1);
    }
  }

  const baseSpec: LayoutSpec = JSON.parse(readFileSync(basePath, 'utf-8'));
  const themeSpec: LayoutSpec = JSON.parse(readFileSync(themePath, 'utf-8'));

  // 4-layer merge
  let merged: LayoutSpec = deepMerge(baseSpec, themeSpec);

  if (existsSync(stylePath)) {
    const styleSpec: any = JSON.parse(readFileSync(stylePath, 'utf-8'));
    if (styleSpec.colors) {
      merged = deepMerge(merged, { colors: styleSpec.colors }) as LayoutSpec;
    }
    console.log(`   ✅ Style spec loaded: ${style}`);
  } else {
    console.log(`   ⚠️  Style spec not found: ${stylePath} — using theme color defaults`);
  }

  if (hasOverrides) {
    merged = deepMerge(merged, profile.layout_overrides) as LayoutSpec;
    console.log(`   ✅ Project overrides applied`);
  }

  console.log(`   ✅ Spec merge complete`);

  // ── Validate spec has usable data ─────────────────────────────────────────
  if (!merged.regions || Object.keys(merged.regions).length === 0) {
    console.error(`❌ Merged spec has no "regions" block (theme=${theme}).`);
    process.exit(1);
  }
  if (!merged.slide_types || Object.keys(merged.slide_types).length === 0) {
    console.error(`❌ Merged spec has no "slide_types" block (theme=${theme}).`);
    process.exit(1);
  }

  // ── Check fonts ───────────────────────────────────────────────────────────
  const fontDir = resolve(workspaceRoot, fontDirArg ?? 'fonts');
  const fontStatus = checkFonts(fontDir);
  const preferred = fontStatus.find(f => f.regular && f.bold);

  console.log(`\n🔤 Font check (${fontDir}):`);
  for (const fs of fontStatus) {
    const status = fs.regular && fs.bold ? '✅' : fs.regular || fs.bold ? '⚠️' : '❌';
    console.log(`   ${status} ${fs.name}: Regular=${fs.regular}, Bold=${fs.bold}`);
  }
  if (!preferred) {
    console.log(`   ⚠️  No complete font pair. Run: bun scripts/co-deck/download-font.ts pretendard`);
  } else {
    console.log(`   ✅ Active font: ${preferred.name}`);
  }

  // ── Write summary ────────────────────────────────────────────────────────
  const summary = generateSummary(theme, style, merged, hasOverrides, fontDir, fontStatus);
  const summaryPath = join(projectDir, 'layout_summary.md');
  writeFileSync(summaryPath, summary, 'utf-8');
  console.log(`\n💾 Layout summary saved: ${summaryPath}`);

  // Print condensed version to stdout
  const vp = merged.calibration?.viewport_px;
  const pageH = merged.page?.height_mm ?? 190.5;
  const fonts = merged.fonts ?? {};
  const lineHeights = merged.line_heights ?? {};

  console.log(`\n📋 Quick Reference:`);
  console.log(`   Page: ${merged.page?.width_mm ?? 338.7}×${pageH}mm (${merged.page?.aspect_ratio ?? '16:9'})`);
  if (vp) console.log(`   Viewport: ${vp}px (px→mm = px/${vp}×${pageH})`);
  if (Object.keys(fonts).length > 0) {
    console.log(`   Fonts: ${Object.entries(fonts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  if (Object.keys(lineHeights).length > 0) {
    console.log(`   Line heights: ${Object.entries(lineHeights).map(([k, v]) => `${k}=${v}px`).join(', ')}`);
  }
  const typeCount = Object.keys(merged.slide_types ?? {}).length;
  const regionCount = Object.entries(merged.regions ?? {}).filter(([, v]) => v !== null).length;
  console.log(`   Slide types: ${typeCount} (${Object.keys(merged.slide_types ?? {}).join(', ')})`);
  console.log(`   Active regions: ${regionCount}`);

  // ── Optional sample PDF ──────────────────────────────────────────────────
  if (wantSample) {
    if (!preferred) {
      console.log(`\n❌ Cannot generate sample PDF — no complete font pair found.`);
      console.log(`   Run: bun scripts/co-deck/download-font.ts pretendard`);
      process.exit(1);
    }

    // Check slidedata.json exists
    const slidedataPath = join(projectDir, 'slidedata.json');
    if (!existsSync(slidedataPath)) {
      // Try extracting from HTML
      const htmlFiles = ['lecture_v1.html', 'lecture.html', 'lecture_slide.html'];
      const htmlFile = htmlFiles.find(f => existsSync(join(projectDir, f)));
      if (htmlFile) {
        console.log(`\n📊 Extracting slide data from ${htmlFile}...`);
        const { execSync } = await import('child_process');
        try {
          execSync(`bun scripts/co-deck/extract_slidedata.mjs "${join(projectDir, htmlFile)}"`, {
            cwd: workspaceRoot,
            stdio: 'inherit',
          });
        } catch (e) {
          console.error(`❌ extract_slidedata.mjs failed: ${(e as Error).message}`);
          process.exit(1);
        }
      } else {
        console.error(`\n❌ slidedata.json not found and no HTML file detected for extraction.`);
        process.exit(1);
      }
    }

    console.log(`\n📄 Generating 5-slide sample PDF...`);
    const { execSync } = await import('child_process');
    try {
      execSync(`bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg} --sample 5`, {
        cwd: workspaceRoot,
        stdio: 'inherit',
      });
    } catch (e) {
      console.error(`❌ gen-slides-pdf.ts failed: ${(e as Error).message}`);
      process.exit(1);
    }

    console.log(`\n✅ Sample PDF generated. Review the 5-slide sample for layout approval.`);
  } else {
    console.log(`\n💡 Next step: generate a 5-slide sample with:`);
    console.log(`   bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg} --sample 5`);
    console.log(`   Or re-run with --sample flag:`);
    console.log(`   bun scripts/co-deck/estimate-layout.ts --project ${projectArg} --sample`);
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
