// @version 1.0.0
// Auto-calibration loop for PDF layout tuning.
// Generates a 5-slide sample PDF, converts to images, validates numerically,
// adjusts layout_overrides, and repeats up to N iterations.
// Usage: bun scripts/co-deck/auto-calibrate.ts --project presentations/<project> [--max-iterations 3] [--font-dir fonts/]
// Requires: pdf-to-png-converter (optional: bun add pdf-to-png-converter)
//
// When pdf-to-png-converter is NOT installed, the loop still runs numerical checks
// and adjusts layout_overrides — only the image conversion step is skipped.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname, homedir } from 'path';
import { platform } from 'os';

// ── Types ────────────────────────────────────────────────────────────────────

interface Region { x_pct: number; y_pct: number; w_pct: number; h_pct: number; fit?: string; }

interface LayoutSpec {
  page?: { width_mm?: number; height_mm?: number; margin_mm?: number };
  calibration?: { viewport_px?: number };
  fonts?: Record<string, number>;
  line_heights?: Record<string, number>;
  content_constraints?: Record<string, Record<string, number>>;
}

interface CalibrationIssue {
  type: string;
  key: string;
  message: string;
  severity: 'error' | 'warn';
  adjustment?: { key: string; old: number; new: number };
}

// ── Spec merge (same logic as gen-slides-pdf.ts) ─────────────────────────────

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
  const overrides = parseLayoutOverrides(fm);
  if (Object.keys(overrides).length > 0) {
    result.layout_overrides = overrides;
  }
  return result;
}

function parseLayoutOverrides(frontmatterContent: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = frontmatterContent.split('\n');
  let inBlock = false;
  let baseIndent = -1;
  for (const line of lines) {
    if (/^\s*layout_overrides:\s*$/.test(line)) { inBlock = true; continue; }
    if (inBlock && /^\s{2}[a-z]/.test(line)) break;
    if (!inBlock) continue;
    if (baseIndent < 0 && line.trim().length > 0) {
      const match = line.match(/^(\s+)/);
      if (match) baseIndent = match[1].length;
    }
    if (baseIndent < 0) continue;
    const trimmed = line.slice(baseIndent);
    if (!trimmed.trim()) continue;
    const parts = trimmed.split(':').map(s => s.trim());
    if (parts.length >= 2) {
      const key = parts[0];
      const rawVal = parts.slice(1).join(':').trim();
      const val = parseScalar(rawVal);
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

// ── Numerical validation ─────────────────────────────────────────────────────

function validateSpec(spec: LayoutSpec): CalibrationIssue[] {
  const issues: CalibrationIssue[] = [];
  const fonts = spec.fonts ?? {};
  const lineHeights = spec.line_heights ?? {};
  const VP = spec.calibration?.viewport_px ?? 720;
  const PH = spec.page?.height_mm ?? 190.5;
  const MM_TO_PT = 2.835;

  // Check 1: line_mm > font_mm for all font/line_height pairs
  const fontLinePairs: Array<[string, string]> = [
    ['title_pt', 'title_px'],
    ['bullet_pt', 'bullet_px'],
    ['div_title_pt', 'div_title_px'],
    ['div_desc_pt', 'div_desc_px'],
  ];

  for (const [fontKey, lineKey] of fontLinePairs) {
    if (fonts[fontKey] !== undefined && lineHeights[lineKey] !== undefined) {
      const fontMm = (fonts[fontKey] as number) / MM_TO_PT;
      const lineMm = ((lineHeights[lineKey] as number) / VP) * PH;
      if (lineMm <= fontMm) {
        issues.push({
          type: 'line_too_short',
          key: `${fontKey}/${lineKey}`,
          message: `line_mm (${lineMm.toFixed(2)}) <= font_mm (${fontMm.toFixed(2)}) — text will overlap`,
          severity: 'error',
        });
      } else if (lineMm < fontMm * 1.2) {
        issues.push({
          type: 'line_tight',
          key: `${fontKey}/${lineKey}`,
          message: `line_mm (${lineMm.toFixed(2)}) is tight vs font_mm (${fontMm.toFixed(2)}), < 1.2× margin`,
          severity: 'warn',
        });
      }
    }
  }

  // Check 2: Font sizes within reasonable bounds
  for (const [key, val] of Object.entries(fonts)) {
    if (key.endsWith('_pt') && (val as number) < 8) {
      issues.push({
        type: 'font_too_small',
        key,
        message: `${key}=${val}pt is below minimum readable size (8pt)`,
        severity: 'error',
      });
    }
    if (key.endsWith('_pt') && (val as number) > 60) {
      issues.push({
        type: 'font_too_large',
        key,
        message: `${key}=${val}pt is excessively large (>60pt)`,
        severity: 'warn',
      });
    }
  }

  return issues;
}

// ── Adjustment logic ─────────────────────────────────────────────────────────

function computeAdjustments(spec: LayoutSpec, issues: CalibrationIssue[]): Partial<LayoutSpec> {
  const adjusted: Partial<LayoutSpec> = { fonts: { ...spec.fonts }, line_heights: { ...spec.line_heights } };

  for (const issue of issues) {
    if (issue.type === 'line_too_short') {
      const [fontKey, lineKey] = issue.key.split('/');
      const fontVal = spec.fonts?.[fontKey] as number;
      const lineVal = spec.line_heights?.[lineKey] as number;
      if (fontVal && lineVal) {
        // Increase line_height by 15%, decrease font by 5%
        (adjusted.line_heights as Record<string, number>)[lineKey] = Math.round(lineVal * 1.15 * 100) / 100;
        (adjusted.fonts as Record<string, number>)[fontKey] = Math.round(fontVal * 0.95 * 10) / 10;
        issue.adjustment = {
          key: `${fontKey} → ${fontVal}→${adjusted.fonts![fontKey]}`,
          old: fontVal,
          new: adjusted.fonts![fontKey] as number,
        };
      }
    } else if (issue.type === 'font_too_small') {
      const val = spec.fonts?.[issue.key] as number;
      if (val) {
        (adjusted.fonts as Record<string, number>)[issue.key] = 10.0;
        issue.adjustment = { key: issue.key, old: val, new: 10.0 };
      }
    }
  }

  // Clamp font sizes: no less than 8pt
  for (const [key, val] of Object.entries(adjusted.fonts ?? {})) {
    if (key.endsWith('_pt') && val < 8) {
      (adjusted.fonts as Record<string, number>)[key] = 8.0;
    }
  }

  return adjusted;
}

// ── Image conversion (optional — requires pdf-to-png-converter) ───────────────

async function convertPdfToImages(pdfPath: string, outputDir: string, maxPages: number): Promise<boolean> {
  try {
    const { pdfToPNG } = await import('pdf-to-png-converter');
    const pdfBuffer = readFileSync(pdfPath);
    const pageNumbers = Array.from({ length: Math.min(maxPages, 10) }, (_, i) => i + 1);

    const pages = await pdfToPNG(pdfBuffer, {
      viewportScale: 2.0,  // 2x for readability
      pageNumbers,
    });

    mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < pages.length; i++) {
      const outPath = join(outputDir, `page_${i + 1}.png`);
      writeFileSync(outPath, pages[i]);
      console.log(`   📸 ${outPath}`);
    }

    return true;
  } catch {
    console.log('   ⚠️  pdf-to-png-converter not available — skipping image conversion');
    console.log('   Install with: bun add pdf-to-png-converter');
    return false;
  }
}

// ── Report generation ────────────────────────────────────────────────────────

function generateReport(
  iterations: Array<{
    iteration: number;
    issues: CalibrationIssue[];
    adjustments: Record<string, { old: number; new: number }>;
  }>,
): string {
  const lines: string[] = [
    '# Auto-Calibration Report', '',
    `> Iterations: ${iterations.length}`, '',
    '---', '',
  ];

  for (const iter of iterations) {
    lines.push(`## Iteration ${iter.iteration}`, '');
    if (iter.issues.length === 0) {
      lines.push('✅ No issues detected.', '');
    } else {
      lines.push('| Type | Key | Message | Severity |', '|------|-----|---------|----------|');
      for (const issue of iter.issues) {
        lines.push(`| ${issue.type} | ${issue.key} | ${issue.message} | ${issue.severity} |`);
      }
      lines.push('');
    }
    if (Object.keys(iter.adjustments).length > 0) {
      lines.push('**Adjustments:**', '');
      lines.push('| Key | Before | After |', '|-----|--------|-------|');
      for (const [key, adj] of Object.entries(iter.adjustments)) {
        lines.push(`| ${key} | ${adj.old} | ${adj.new} |`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const has = (flag: string) => args.includes(flag);

  const projectArg = get('--project');
  if (!projectArg) {
    console.error('Usage: bun scripts/co-deck/auto-calibrate.ts --project presentations/<project> [--max-iterations 3] [--font-dir fonts/]');
    process.exit(1);
  }

  const maxIterations = parseInt(get('--max-iterations') ?? '3', 10);
  const fontDirArg = get('--font-dir');

  const workspaceRoot = resolve(dirname(import.meta.path), '../..');
  const projectDir = resolve(workspaceRoot, projectArg);

  if (!existsSync(projectDir)) {
    console.error(`❌ Project folder not found: ${projectDir}`);
    process.exit(1);
  }

  const profilePath = join(projectDir, 'lecture-profile.md');
  if (!existsSync(profilePath)) {
    console.error(`❌ lecture-profile.md not found: ${profilePath}`);
    process.exit(1);
  }

  console.log(`\n🔄 Auto-Calibration`);
  console.log(`   Project: ${projectArg}`);
  console.log(`   Max iterations: ${maxIterations}`);
  console.log('');

  const calibDir = join(projectDir, 'calibration');
  mkdirSync(calibDir, { recursive: true });

  const iterations: Array<{
    iteration: number;
    issues: CalibrationIssue[];
    adjustments: Record<string, { old: number; new: number }>;
  }> = [];

  const MM_TO_PT = 2.835;
  let currentOverrides: Record<string, any> | null = null;

  for (let iter = 1; iter <= maxIterations; iter++) {
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  Iteration ${iter}/${maxIterations}`);
    console.log(`${'═'.repeat(50)}\n`);

    // ── Step 1: Load spec with current overrides ──────────────────────────
    const profileContent = readFileSync(profilePath, 'utf-8');
    const profile = parseFrontmatter(profileContent);
    const theme = profile.theme ?? 'scroll';
    const style = profile.style ?? 'premium-dark';

    const basePath = resolve(workspaceRoot, 'docs/html-themes/themes/_shared/layout_base.json');
    const themePath = resolve(workspaceRoot, `docs/html-themes/themes/${theme}/pdf_layout_spec.json`);
    const stylePath = resolve(workspaceRoot, `docs/html-themes/styles/${style}/pdf_color_spec.json`);

    let spec: LayoutSpec = deepMerge(
      JSON.parse(readFileSync(basePath, 'utf-8')),
      JSON.parse(readFileSync(themePath, 'utf-8')),
    );
    if (existsSync(stylePath)) {
      const styleSpec: any = JSON.parse(readFileSync(stylePath, 'utf-8'));
      if (styleSpec.colors) spec = deepMerge(spec, { colors: styleSpec.colors }) as LayoutSpec;
    }
    if (currentOverrides) {
      spec = deepMerge(spec, currentOverrides) as LayoutSpec;
    } else if (profile.layout_overrides) {
      spec = deepMerge(spec, profile.layout_overrides) as LayoutSpec;
    }

    // ── Step 2: Generate 5-slide sample PDF ─────────────────────────────
    console.log(`📄 Generating 5-slide sample PDF...`);
    const { execSync } = await import('child_process');
    try {
      execSync(`bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg} --sample 5`, {
        cwd: workspaceRoot,
        stdio: 'pipe',
      });
    } catch (e: any) {
      console.error(`❌ PDF generation failed: ${e.stderr?.toString() || e.message}`);
      process.exit(1);
    }

    // Find the generated sample PDF
    const projectName = projectDir.split(/[/\\]/).pop() ?? 'project';
    const samplePdfPath = join(projectDir, `${projectName}_sample5.pdf`);
    if (!existsSync(samplePdfPath)) {
      console.error(`❌ Sample PDF not found: ${samplePdfPath}`);
      process.exit(1);
    }

    // ── Step 3: Convert to images (optional) ────────────────────────────
    console.log(`\n🖼️  Converting to images...`);
    const imagesGenerated = await convertPdfToImages(samplePdfPath, calibDir, 5);

    // ── Step 4: Numerical validation ────────────────────────────────────
    console.log(`\n🔍 Validating spec...`);
    const issues = validateSpec(spec);
    const errors = issues.filter(i => i.severity === 'error');
    const warns = issues.filter(i => i.severity === 'warn');

    console.log(`   Issues found: ${errors.length} error(s), ${warns.length} warning(s)`);
    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${icon} [${issue.type}] ${issue.key}: ${issue.message}`);
    }

    const adjustments: Record<string, { old: number; new: number }> = {};

    if (errors.length === 0) {
      console.log(`\n   ✅ No errors detected — calibration converged at iteration ${iter}`);
      iterations.push({ iteration: iter, issues, adjustments });
      break;
    }

    if (iter < maxIterations) {
      // ── Step 5: Compute adjustments ────────────────────────────────
      console.log(`\n🔧 Computing adjustments...`);
      const adjusted = computeAdjustments(spec, issues);

      // Track adjustments for report
      for (const issue of issues) {
        if (issue.adjustment) {
          adjustments[issue.adjustment.key] = { old: issue.adjustment.old, new: issue.adjustment.new };
        }
      }

      currentOverrides = {
        fonts: adjusted.fonts,
        line_heights: adjusted.line_heights,
      };

      console.log(`   Adjustments for next iteration:`);
      for (const [key, adj] of Object.entries(adjustments)) {
        console.log(`     ${key}: ${adj.old} → ${adj.new}`);
      }

      iterations.push({ iteration: iter, issues, adjustments });
    } else {
      console.log(`\n   ⚠️  Max iterations reached (${maxIterations}).`);
      iterations.push({ iteration: iter, issues, adjustments });
    }
  }

  // ── Final report ────────────────────────────────────────────────────────
  const report = generateReport(iterations);
  const reportPath = join(calibDir, 'report.md');
  writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n💾 Calibration report: ${reportPath}`);

  // ── Summary ──────────────────────────────────────────────────────────────
  const lastIter = iterations[iterations.length - 1];
  const lastErrors = lastIter.issues.filter(i => i.severity === 'error');

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  Calibration Complete`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`   Iterations: ${iterations.length}/${maxIterations}`);
  console.log(`   Remaining errors: ${lastErrors.length}`);

  if (lastErrors.length === 0) {
    console.log(`   ✅ Calibration converged successfully.`);
    if (currentOverrides) {
      console.log(`\n   💡 Suggested layout_overrides for lecture-profile.md:`);
      console.log(`   ──────────────────────────────────────────────`);
      console.log(`   layout_overrides:`);
      if (currentOverrides.fonts) {
        console.log(`     fonts:`);
        for (const [key, val] of Object.entries(currentOverrides.fonts as Record<string, number>)) {
          console.log(`       ${key}: ${val}`);
        }
      }
      if (currentOverrides.line_heights) {
        console.log(`     line_heights:`);
        for (const [key, val] of Object.entries(currentOverrides.line_heights as Record<string, number>)) {
          console.log(`       ${key}: ${val}`);
        }
      }
    }
  } else {
    console.log(`   ⚠️  Calibration did not fully converge. Review images in:`);
    console.log(`      ${calibDir}/`);
    console.log(`   And manually adjust layout_overrides in:`);
    console.log(`      ${profilePath}`);
  }

  if (imagesGenerated) {
    console.log(`\n   📸 Review images: ${calibDir}/page_1.png through page_5.png`);
  }
}

main().catch(err => { console.error('❌', err); process.exit(1); });
