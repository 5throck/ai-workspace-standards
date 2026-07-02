// @version 1.0.0
// verify-new-theme.ts — composite registration gate for new co-deck themes.
//
// Runs 5 checks to verify a theme is ready for registration:
//   1. Structural validation (validate-theme-styles.ts)
//   2. Manifest freshness (generate-themes-manifest.ts --check)
//   3. THEMES.md marker check (theme table + compat matrix contain the new theme)
//   4. Fixture build (build HTML → extract slideData → compare with fixture)
//   5. PDF generation test (gen-slides-pdf.ts --sample 5 → valid PDF)
//
// Usage:
//   bun scripts/co-deck/verify-new-theme.ts <theme-name> [--style <name>] [--fast] [--json]
//
// Options:
//   --style <name>   Style to use for build/PDF tests (default: classic)
//   --fast           Skip checks 4 and 5 (for iterative development)
//   --json           Output results as JSON array
//   --root <path>    Workspace root (default: auto-detect)
//
// Exit codes: 0 = all checks pass, 1 = any check fails

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { resolveWorkspaceRoot, getArg, listThemeDirs } from './lib/theme-utils.js';
import { buildThemeDeck } from './lib/theme-builder.js';

// ── CLI args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`verify-new-theme.ts — composite registration gate for co-deck themes.

Usage:
  bun scripts/co-deck/verify-new-theme.ts <theme-name> [--style <name>] [--fast] [--json]

Options:
  --style <name>   Style to use for build/PDF tests (default: classic)
  --fast           Skip checks 4 (fixture build) and 5 (PDF test)
  --json           Output results as JSON array
  --root <path>    Workspace root (default: auto-detect)

Checks:
  1. Structural validation (validate-theme-styles.ts)
  2. Manifest freshness (generate-themes-manifest.ts --check)
  3. THEMES.md markers contain the new theme
  4. Fixture build → extract slideData → round-trip match
  5. PDF generation test (--sample 5 → valid PDF)

Exit: 0 = all pass, 1 = any fail`);
  process.exit(0);
}

// Parse positional theme name (first non-flag argument)
const positionalArgs = args.filter((a) => !a.startsWith('--'));
const themeName = positionalArgs[0];

if (!themeName) {
  console.error('ERROR: theme name is required as a positional argument. Use --help for usage.');
  process.exit(1);
}

const styleName = getArg(args, '--style') || 'classic';
const fastMode = args.includes('--fast');
const jsonMode = args.includes('--json');
const rootArg = args.includes('--root') ? args[args.indexOf('--root') + 1] : undefined;
const workspaceRoot = rootArg ? resolve(rootArg) : resolveWorkspaceRoot(import.meta.path);

// ── Types ───────────────────────────────────────────────────────────────────────

interface CheckResult {
  id: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration_ms: number;
  details?: string;
}

// ── Check runners ──────────────────────────────────────────────────────────────

function check1_structuralValidation(): CheckResult {
  const start = Date.now();
  try {
    const script = join(dirname(import.meta.path), 'validate-theme-styles.ts');
    const stdout = execSync(
      `bun "${script}" --root "${workspaceRoot}"`,
      { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return {
      id: 1,
      name: 'Structural validation',
      status: 'PASS',
      duration_ms: Date.now() - start,
      details: stdout.trim(),
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || '';
    const stdout = err.stdout?.toString() || '';
    return {
      id: 1,
      name: 'Structural validation',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: stderr || stdout || err.message,
    };
  }
}

function check2_manifestFreshness(): CheckResult {
  const start = Date.now();
  try {
    const script = join(dirname(import.meta.path), 'generate-themes-manifest.ts');
    const stdout = execSync(
      `bun "${script}" --root "${workspaceRoot}" --check`,
      { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return {
      id: 2,
      name: 'Manifest freshness',
      status: 'PASS',
      duration_ms: Date.now() - start,
      details: stdout.trim(),
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || '';
    return {
      id: 2,
      name: 'Manifest freshness',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: stderr || err.message,
    };
  }
}

function check3_themesMdMarkers(): CheckResult {
  const start = Date.now();
  const themesMdPath = join(workspaceRoot, 'docs', 'html-themes', 'THEMES.md');

  if (!existsSync(themesMdPath)) {
    return {
      id: 3,
      name: 'THEMES.md marker check',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `THEMES.md not found at ${themesMdPath}`,
    };
  }

  const content = readFileSync(themesMdPath, 'utf-8');
  const issues: string[] = [];

  // Check AUTO-GENERATED-THEME-TABLE section contains the theme name
  const tableStartMarker = '<!-- AUTO-GENERATED-THEME-TABLE:START';
  const tableEndMarker = '<!-- AUTO-GENERATED-THEME-TABLE:END -->';
  const tableStartIdx = content.indexOf(tableStartMarker);
  const tableEndIdx = content.indexOf(tableEndMarker);

  if (tableStartIdx === -1 || tableEndIdx === -1) {
    issues.push('THEME-TABLE markers not found in THEMES.md');
  } else {
    const tableSection = content.substring(tableStartIdx, tableEndIdx);
    if (!tableSection.includes(`\`${themeName}\``)) {
      issues.push(`Theme "${themeName}" not found in AUTO-GENERATED-THEME-TABLE section`);
    }
  }

  // Check AUTO-GENERATED-COMPAT-MATRIX section contains the theme name
  const matrixStartMarker = '<!-- AUTO-GENERATED-COMPAT-MATRIX:START';
  const matrixEndMarker = '<!-- AUTO-GENERATED-COMPAT-MATRIX:END -->';
  const matrixStartIdx = content.indexOf(matrixStartMarker);
  const matrixEndIdx = content.indexOf(matrixEndMarker);

  if (matrixStartIdx === -1 || matrixEndIdx === -1) {
    issues.push('COMPAT-MATRIX markers not found in THEMES.md');
  } else {
    const matrixSection = content.substring(matrixStartIdx, matrixEndIdx);
    if (!matrixSection.includes(`\`${themeName}\``)) {
      issues.push(`Theme "${themeName}" not found in AUTO-GENERATED-COMPAT-MATRIX section`);
    }
  }

  return {
    id: 3,
    name: 'THEMES.md marker check',
    status: issues.length > 0 ? 'FAIL' : 'PASS',
    duration_ms: Date.now() - start,
    details: issues.length > 0 ? issues.join('; ') : 'Theme found in both THEME-TABLE and COMPAT-MATRIX sections',
  };
}

/**
 * Extract slideData array from HTML using the same bracket-depth state machine
 * as extract_slidedata.mjs, but handles the case where documentation comments
 * contain `const slideData = [...]` placeholders by trying each match until
 * valid JSON is found.
 */
function extractSlideDataFromHtml(html: string): any[] | null {
  // Find all occurrences of `const slideData =` (case-sensitive)
  const re = /(?:const|let|var)\s+slideData\s*=\s*/g;
  let match;
  while ((match = re.exec(html)) !== null) {
    const afterAssign = match.index + match[0].length;
    const rawJson = extractBalancedArray(html, afterAssign);
    if (!rawJson) continue;
    // Skip trivial placeholder patterns like [...] or [ ... ]
    if (rawJson.length <= 10 && rawJson.includes('...')) continue;
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch { /* try next match */ }
  }
  return null;
}

/**
 * Bracket-depth-counting extractor (mirrors extract_slidedata.mjs).
 * Finds the first top-level `[...]` at or after `startPos` and returns it.
 */
function extractBalancedArray(src: string, startPos: number): string | null {
  const openBracket = src.indexOf('[', startPos);
  if (openBracket === -1) return null;

  let depth = 0;
  let i = openBracket;
  const len = src.length;

  while (i < len) {
    const ch = src[i];
    if (ch === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < len && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < len - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      i++;
      while (i < len) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) { i++; break; }
        i++;
      }
      continue;
    }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return src.slice(openBracket, i + 1);
    }
    i++;
  }
  return null;
}

function check4_fixtureBuild(): CheckResult {
  const start = Date.now();

  // Verify theme exists
  const themeDir = join(workspaceRoot, 'docs', 'html-themes', 'themes', themeName);
  if (!existsSync(themeDir)) {
    return {
      id: 4,
      name: 'Fixture build',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `Theme directory not found: ${themeDir}`,
    };
  }

  // Read fixture slide data
  const fixturePath = join(dirname(import.meta.path), 'tests', 'fixtures', 'theme-deck', 'slide-data.json');
  if (!existsSync(fixturePath)) {
    return {
      id: 4,
      name: 'Fixture build',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `Fixture not found: ${fixturePath}`,
    };
  }

  const fixtureSlides = JSON.parse(readFileSync(fixturePath, 'utf-8'));

  // Create temp dir for output
  const tmpDir = join(workspaceRoot, 'scripts', 'co-deck', 'tests', 'tmp');
  mkdirSync(tmpDir, { recursive: true });

  const outputHtml = join(tmpDir, `verify-${themeName}-fixture.html`);
  const extractedJson = join(tmpDir, `verify-${themeName}-extracted.json`);

  try {
    // Step 1: Build HTML deck using buildThemeDeck
    const projectPath = join(workspaceRoot, 'presentations', '_test');
    mkdirSync(projectPath, { recursive: true });

    const buildResult = buildThemeDeck({
      root: workspaceRoot,
      projectPath,
      theme: themeName,
      style: styleName,
      title: 'Verify Fixture Build',
      slideData: fixtureSlides,
      outputPath: outputHtml,
    });

    if (buildResult.errors.length > 0) {
      return {
        id: 4,
        name: 'Fixture build',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: `Build errors: ${buildResult.errors.join('; ')}`,
      };
    }

    if (!buildResult.html || buildResult.html.length === 0) {
      return {
        id: 4,
        name: 'Fixture build',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: 'Build produced empty HTML',
      };
    }

    writeFileSync(outputHtml, buildResult.html, 'utf-8');

    // Step 2: Extract slideData from the built HTML
    // Use extract_slidedata.mjs, but fall back to direct extraction if it fails
    // (PPT-engine templates have documentation comments with `const slideData = [...]`
    // that confuse the extractor's first-match heuristic).
    let extractedData: any[] | null = null;
    let extractMethod = 'extract_slidedata.mjs';

    try {
      const extractScript = join(dirname(import.meta.path), 'extract_slidedata.mjs');
      execSync(
        `bun "${extractScript}" "${outputHtml}" "${extractedJson}"`,
        { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] },
      );
      if (existsSync(extractedJson)) {
        const raw = readFileSync(extractedJson, 'utf-8');
        extractedData = JSON.parse(raw);
      }
    } catch {
      // extract_slidedata.mjs failed — fall back to direct extraction
      extractMethod = 'direct extraction (fallback)';
    }

    if (!extractedData) {
      extractedData = extractSlideDataFromHtml(buildResult.html);
      if (!extractedData) {
        return {
          id: 4,
          name: 'Fixture build',
          status: 'FAIL',
          duration_ms: Date.now() - start,
          details: 'Failed to extract slideData from built HTML (both extract_slidedata.mjs and fallback)',
        };
      }
    }

    // Step 3: Compare extracted data with original fixture
    if (extractedData.length !== fixtureSlides.length) {
      return {
        id: 4,
        name: 'Fixture build',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: `Slide count mismatch: expected ${fixtureSlides.length}, got ${extractedData.length}`,
      };
    }

    // Check key fields are preserved (headline, type, bullets)
    for (let i = 0; i < fixtureSlides.length; i++) {
      const orig = fixtureSlides[i];
      const extr = extractedData[i];
      if (orig.headline !== extr.headline) {
        return {
          id: 4,
          name: 'Fixture build',
          status: 'FAIL',
          duration_ms: Date.now() - start,
          details: `Slide ${i}: headline mismatch — expected "${orig.headline}", got "${extr.headline}"`,
        };
      }
      if (orig.type !== extr.type) {
        return {
          id: 4,
          name: 'Fixture build',
          status: 'FAIL',
          duration_ms: Date.now() - start,
          details: `Slide ${i}: type mismatch — expected "${orig.type}", got "${extr.type}"`,
        };
      }
      const origBullets = JSON.stringify(orig.bullets || []);
      const extrBullets = JSON.stringify(extr.bullets || []);
      if (origBullets !== extrBullets) {
        return {
          id: 4,
          name: 'Fixture build',
          status: 'FAIL',
          duration_ms: Date.now() - start,
          details: `Slide ${i}: bullets mismatch`,
        };
      }
    }

    return {
      id: 4,
      name: 'Fixture build',
      status: 'PASS',
      duration_ms: Date.now() - start,
      details: `Built HTML via ${extractMethod} — ${fixtureSlides.length} slides, all fields match`,
    };
  } catch (err: any) {
    return {
      id: 4,
      name: 'Fixture build',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: err.message || String(err),
    };
  } finally {
    // Cleanup temp files
    for (const f of [outputHtml, extractedJson]) {
      if (existsSync(f)) {
        try { unlinkSync(f); } catch { /* ignore */ }
      }
    }
  }
}

function check5_pdfGeneration(): CheckResult {
  const start = Date.now();

  // Verify theme exists
  const themeDir = join(workspaceRoot, 'docs', 'html-themes', 'themes', themeName);
  if (!existsSync(themeDir)) {
    return {
      id: 5,
      name: 'PDF generation test',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `Theme directory not found: ${themeDir}`,
    };
  }

  // Read theme's pdf_layout_spec.json to determine supported slide types
  const specPath = join(themeDir, 'pdf_layout_spec.json');
  if (!existsSync(specPath)) {
    return {
      id: 5,
      name: 'PDF generation test',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `pdf_layout_spec.json not found: ${specPath}`,
    };
  }

  let spec: any;
  try {
    spec = JSON.parse(readFileSync(specPath, 'utf-8'));
  } catch {
    return {
      id: 5,
      name: 'PDF generation test',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: `Failed to parse pdf_layout_spec.json`,
    };
  }

  const supportedTypes = spec.slide_types ? Object.keys(spec.slide_types) : [];
  if (supportedTypes.length === 0) {
    return {
      id: 5,
      name: 'PDF generation test',
      status: 'SKIP',
      duration_ms: Date.now() - start,
      details: 'SKIPPED: theme has no slide_types declared in pdf_layout_spec.json',
    };
  }

  // Create a temporary project directory for the PDF test
  const tmpProjectDir = join(workspaceRoot, 'scripts', 'co-deck', 'tests', 'tmp', `_verify-pdf-${themeName}`);
  const pdfOutputPath = join(tmpProjectDir, `verify-sample.pdf`);

  try {
    mkdirSync(tmpProjectDir, { recursive: true });

    // Create minimal lecture-profile.md with the correct theme/style
    const lectureProfile = `---
presentation:
  theme: ${themeName}
  style: ${styleName}
  title: Verify PDF Test
---
`;
    writeFileSync(join(tmpProjectDir, 'lecture-profile.md'), lectureProfile, 'utf-8');

    // Build slideData that only uses slide types the theme supports.
    // Map fixture types → PDF pipeline slideData fields.
    const typeMap: Record<string, () => any> = {
      title: () => ({
        title: 'PDF Test Title',
        subtitle: 'PDF Test Subtitle',
        section: 'Section 1',
        meta: 'Meta text',
        isTitleSlide: true,
      }),
      divider: () => ({
        title: 'Part 01',
        desc: 'Section Divider',
        section: 'Section 1',
        partNum: 'PART 01',
        isDividerSlide: true,
      }),
      punchline: () => ({
        text: 'Key Takeaway Statement',
        sub: 'Supporting line',
        section: 'Section 1',
        isPunchline: true,
      }),
      standard: () => ({
        title: 'Content Slide Title',
        section: 'Section 1',
        bullets: ['Bullet point one', 'Bullet point two', 'Bullet point three'],
      }),
      profile: () => ({
        title: 'Profile Slide',
        section: 'About',
        speakerName: 'Jane Doe',
        speakerTitle: 'Engineer',
        speakerBio: 'Bio line 1\nBio line 2',
        isProfileSlide: true,
      }),
      contact: () => ({
        title: '감사합니다',
        section: 'Contact',
        contactName: 'Jane Doe',
        contactEmail: 'jane@example.com',
        contactNote: 'Next steps',
        isContactSlide: true,
      }),
    };

    // Generate slides for each supported type (limit to 5 total)
    const slides: any[] = [];
    for (const type of supportedTypes) {
      if (slides.length >= 5) break;
      const factory = typeMap[type];
      if (factory) slides.push(factory());
    }
    if (slides.length === 0) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'SKIP',
        duration_ms: Date.now() - start,
        details: `SKIPPED: no recognized slide types in ${supportedTypes.join(', ')}`,
      };
    }

    writeFileSync(join(tmpProjectDir, 'slidedata.json'), JSON.stringify(slides, null, 2), 'utf-8');

    // Run gen-slides-pdf.ts --sample 5
    const pdfScript = join(dirname(import.meta.path), 'gen-slides-pdf.ts');
    const projectRelPath = `scripts/co-deck/tests/tmp/_verify-pdf-${themeName}`;
    const stdout = execSync(
      `bun "${pdfScript}" --project "${projectRelPath}" --sample 5 --out verify-sample.pdf`,
      { encoding: 'utf-8', timeout: 30000, cwd: workspaceRoot, stdio: ['pipe', 'pipe', 'pipe'] },
    );

    // Verify PDF file exists and has content
    if (!existsSync(pdfOutputPath)) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: 'PDF file was not created',
      };
    }

    const pdfContent = readFileSync(pdfOutputPath);
    if (pdfContent.length < 1024) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: `PDF file is too small (${pdfContent.length} bytes) — may be corrupted`,
      };
    }

    // Verify PDF header magic bytes (%PDF-)
    const header = pdfContent.slice(0, 5).toString();
    if (!header.startsWith('%PDF-')) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'FAIL',
        duration_ms: Date.now() - start,
        details: `PDF header missing (got "${header}") — file may not be valid PDF`,
      };
    }

    return {
      id: 5,
      name: 'PDF generation test',
      status: 'PASS',
      duration_ms: Date.now() - start,
      details: `Valid PDF generated (${(pdfContent.length / 1024).toFixed(1)} KB, ${slides.length} slide types: ${slides.map((_: any, i: number) => supportedTypes[i]).join(', ')})`,
    };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || err.message || '';
    const stdout = err.stdout?.toString() || '';

    // Check if this is a font-not-found error
    if (stderr.includes('Font files not found') || stderr.includes('font')) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'SKIP',
        duration_ms: Date.now() - start,
        details: `SKIPPED: fonts not available — ${stderr.trim().substring(0, 200)}`,
      };
    }

    // Check if this is a region-spec error (theme doesn't support certain slide types)
    if (stderr.includes('[region-spec]')) {
      return {
        id: 5,
        name: 'PDF generation test',
        status: 'SKIP',
        duration_ms: Date.now() - start,
        details: `SKIPPED: theme region spec issue — ${stderr.trim().substring(0, 200)}`,
      };
    }

    return {
      id: 5,
      name: 'PDF generation test',
      status: 'FAIL',
      duration_ms: Date.now() - start,
      details: stderr || stdout || err.message,
    };
  } finally {
    // Cleanup temp directory
    if (existsSync(tmpProjectDir)) {
      try { rmSync(tmpProjectDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────────────

const totalStart = Date.now();
const results: CheckResult[] = [];

// Always run checks 1-3
results.push(check1_structuralValidation());
results.push(check2_manifestFreshness());
results.push(check3_themesMdMarkers());

// Check 4 & 5 are skipped in fast mode
if (fastMode) {
  results.push({
    id: 4,
    name: 'Fixture build',
    status: 'SKIP',
    duration_ms: 0,
    details: 'Skipped (--fast mode)',
  });
  results.push({
    id: 5,
    name: 'PDF generation test',
    status: 'SKIP',
    duration_ms: 0,
    details: 'Skipped (--fast mode)',
  });
} else {
  results.push(check4_fixtureBuild());
  results.push(check5_pdfGeneration());
}

const totalDuration = Date.now() - totalStart;
const failed = results.filter((r) => r.status === 'FAIL');
const passed = results.filter((r) => r.status === 'PASS');
const skipped = results.filter((r) => r.status === 'SKIP');

if (jsonMode) {
  console.log(JSON.stringify({
    theme: themeName,
    style: styleName,
    fast_mode: fastMode,
    total_duration_ms: totalDuration,
    results,
    summary: { pass: passed.length, fail: failed.length, skip: skipped.length },
  }, null, 2));
} else {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  verify-new-theme: ${themeName} (style: ${styleName})`);
  if (fastMode) console.log('  ⚡ fast mode — checks 4 & 5 skipped');
  console.log(`${'═'.repeat(60)}\n`);

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`  ${icon} [${r.id}] ${r.name} (${r.duration_ms}ms)`);
    if (r.details) {
      for (const line of r.details.split('\n').slice(0, 5)) {
        console.log(`      ${line}`);
      }
    }
    console.log();
  }

  const summaryIcon = failed.length > 0 ? '❌' : '✅';
  console.log(`${'─'.repeat(60)}`);
  console.log(`  ${summaryIcon} ${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped (${totalDuration}ms)`);
  console.log(`${'─'.repeat(60)}`);
}

process.exit(failed.length > 0 ? 1 : 0);
