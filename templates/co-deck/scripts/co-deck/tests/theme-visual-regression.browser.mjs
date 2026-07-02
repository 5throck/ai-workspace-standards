// theme-visual-regression.browser.mjs — Playwright screenshot capture & comparison.
//
// Uses Node.js (not bun) because bun has issues with Playwright subprocess handling
// (chromium.launch() hangs indefinitely under bun on Windows).
//
// This file is invoked from theme-visual-regression.test.ts via a Node.js subprocess.
// Communication: JSON commands on stdin, JSON responses on stdout.
//
// Modes:
//   capture   — Take screenshots and save as baselines (or fresh captures)
//   compare   — Take screenshots, compare against baselines, report pass/fail
//
// Run directly (for debugging):
//   node scripts/co-deck/tests/theme-visual-regression.browser.mjs capture outline classic
//   node scripts/co-deck/tests/theme-visual-regression.browser.mjs compare outline classic

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');
const slideDataPath = join(__dirname, 'fixtures', 'theme-deck', 'slide-data.json');
const smokeProjectDir = join(root, 'presentations', '_smoke_test');
const baselinesRoot = join(root, 'docs/html-themes/baselines');

// Read fixture slide data
const SLIDE_DATA = JSON.parse(readFileSync(slideDataPath, 'utf-8'));

// ── Configuration ──────────────────────────────────────────────────────

const CANONICAL_VIEWPORT = { width: 1280, height: 720 };
const ANIMATION_DISABLE_CSS = `* { animation-duration: 0s !important; transition-duration: 0s !important; }`;
const SLIDES_TO_CAPTURE = [1, 2]; // slide indices (1-based)
const DEFAULT_THRESHOLD = 0.005; // 0.5% of total pixels

// ── CLI arguments ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args[0]; // 'capture' or 'compare'
const themeFilter = args[1] || null;   // specific theme (optional)
const styleFilter = args[2] || null;    // specific style (optional)

if (!mode || !['capture', 'compare'].includes(mode)) {
  console.error('Usage: node theme-visual-regression.browser.mjs <capture|compare> [theme] [style]');
  process.exit(1);
}

// ── Playwright availability ───────────────────────────────────────────

let chromium = null;
try {
  const pw = await import('playwright');
  chromium = pw.chromium;
} catch {
  console.log('%%RESULT_START%%');
  console.log(JSON.stringify({ status: 'skipped', reason: 'playwright-not-installed' }));
  console.log('%%RESULT_END%%');
  process.exit(0);
}

// ── Build helper (delegates to bun for .ts imports) ──────────────────

function buildViaBun(options) {
  const script = `
    import { buildThemeDeck } from '${join(root, 'scripts/co-deck/lib/theme-builder.ts').replace(/\\/g, '/')}';
    const opts = ${JSON.stringify(options)};
    const result = buildThemeDeck(opts);
    console.log('%%BUILD_START%%');
    console.log(JSON.stringify({ outputPath: result.outputPath, html: result.html, warnings: result.warnings, errors: result.errors }));
    console.log('%%BUILD_END%%');
  `;
  const tmpScript = join(smokeProjectDir, '_vr_build_helper.mjs');
  writeFileSync(tmpScript, script, 'utf-8');

  try {
    const output = execSync(`bun run "${tmpScript}"`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const start = output.indexOf('%%BUILD_START%%');
    const end = output.indexOf('%%BUILD_END%%');
    if (start === -1 || end === -1) {
      return { outputPath: '', html: '', warnings: [], errors: ['Failed to parse build output'] };
    }
    const json = output.substring(start + '%%BUILD_START%%'.length, end).trim();
    return JSON.parse(json);
  } catch (err) {
    return { outputPath: '', html: '', warnings: [], errors: [`Build subprocess failed: ${err.message}`] };
  }
}

// ── Matrix discovery ──────────────────────────────────────────────────

function discoverMatrix() {
  const script = `
    import { loadThemePackage } from '${join(root, 'scripts/co-deck/lib/theme-contract.ts').replace(/\\/g, '/')}';
    import { listThemeDirs, listStyleDirs } from '${join(root, 'scripts/co-deck/lib/theme-utils.ts').replace(/\\/g, '/')}';
    const root = '${root.replace(/\\/g, '/')}';
    const themes = listThemeDirs(root).sort();
    const styles = listStyleDirs(root).sort();
    const matrix = [];
    for (const theme of themes) {
      const { pkg } = loadThemePackage(root, theme);
      if (!pkg) continue;
      const meta = pkg.metadata;
      for (const style of styles) {
        let status = 'compatible';
        let reason;
        if (Array.isArray(meta.incompatible_styles)) {
          const match = meta.incompatible_styles.find(e => (typeof e === 'string' ? e : e.name) === style);
          if (match) { status = 'incompatible'; reason = typeof match === 'object' && match.reason ? match.reason : undefined; }
        }
        if (status === 'compatible' && Array.isArray(meta.partial_styles)) {
          const match = meta.partial_styles.find(e => (typeof e === 'string' ? e : e.name) === style);
          if (match) { status = 'partial'; reason = typeof match === 'object' && match.reason ? match.reason : undefined; }
        }
        matrix.push({ theme, style, status, reason });
      }
    }
    console.log(JSON.stringify(matrix));
  `;
  const tmpScript = join(smokeProjectDir, '_vr_matrix_helper.mjs');
  writeFileSync(tmpScript, script, 'utf-8');

  try {
    const output = execSync(`bun run "${tmpScript}"`, {
      cwd: root,
      encoding: 'utf-8',
      timeout: 15000,
    });
    return JSON.parse(output.trim());
  } catch (err) {
    console.error('Failed to discover matrix:', err.message);
    return [];
  }
}

// ── Pixel comparison (simple byte comparison + hash) ──────────────────

function compareScreenshots(actualPath, baselinePath) {
  const actual = readFileSync(actualPath);
  const baseline = readFileSync(baselinePath);

  // Exact byte match
  if (Buffer.compare(actual, baseline) === 0) {
    return { identical: true, diffRatio: 0, hash: createHash('sha256').update(actual).digest('hex').substring(0, 16) };
  }

  // Different size = definitely different
  if (actual.length !== baseline.length) {
    return {
      identical: false,
      diffRatio: 1, // conservative: treat size mismatch as 100% diff
      actualSize: actual.length,
      baselineSize: baseline.length,
      hash: createHash('sha256').update(actual).digest('hex').substring(0, 16),
    };
  }

  // Same size but different bytes: compute actual pixel diff
  // PNG files: parse pixel data for a more accurate comparison
  let diffPixels = 0;
  const len = actual.length;

  // Quick byte diff (not pixel-level, but a reasonable approximation)
  for (let i = 0; i < len; i++) {
    if (actual[i] !== baseline[i]) {
      diffPixels++;
    }
  }

  const diffRatio = diffPixels / len;
  return {
    identical: false,
    diffRatio,
    diffBytes: diffPixels,
    totalBytes: len,
    hash: createHash('sha256').update(actual).digest('hex').substring(0, 16),
  };
}

// ── Screenshot capture ────────────────────────────────────────────────

async function captureScreenshots(browser, theme, style, outputDir) {
  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Build HTML deck
  const outputFileName = `vr_${theme}_${style}.html`;
  const outputPath = join(smokeProjectDir, outputFileName);

  const result = buildViaBun({
    root,
    projectPath: smokeProjectDir,
    theme,
    style,
    title: `Visual Regression — ${theme} × ${style}`,
    slideData: SLIDE_DATA,
    outputPath,
  });

  if (result.errors.length > 0) {
    return { errors: result.errors, screenshots: {} };
  }

  // Write HTML to disk
  writeFileSync(outputPath, result.html, 'utf-8');
  const fileUrl = `file:///${outputPath.replace(/\\/g, '/')}`;

  const context = await browser.newContext({
    viewport: { ...CANONICAL_VIEWPORT },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  try {
    // Navigate
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Disable animations
    await page.addStyleTag({ content: ANIMATION_DISABLE_CSS });

    // Wait for rendering to settle: rAF + 500ms
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 500))));

    // Navigate to slide 1 (cover)
    await page.evaluate(() => {
      // Try to activate slide 1 (index 0)
      const slides = document.querySelectorAll('.slide');
      if (slides.length > 0) {
        slides.forEach(s => s.classList.remove('active'));
        slides[0].classList.add('active');
      }
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 500))));
    const slide1Path = join(outputDir, 'slide-1.png');
    await page.screenshot({ path: slide1Path, fullPage: false });

    // Navigate to slide 2 (content)
    await page.evaluate(() => {
      const slides = document.querySelectorAll('.slide');
      if (slides.length > 1) {
        slides.forEach(s => s.classList.remove('active'));
        slides[1].classList.add('active');
        // Try triggering navigation event if available
        if (window.goToSlide) window.goToSlide(2);
      }
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 500))));
    const slide2Path = join(outputDir, 'slide-2.png');
    await page.screenshot({ path: slide2Path, fullPage: false });

    return {
      errors: [],
      screenshots: {
        1: slide1Path,
        2: slide2Path,
      },
    };
  } finally {
    await context.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  // Ensure smoke project dir exists
  mkdirSync(smokeProjectDir, { recursive: true });

  // Discover matrix
  const matrix = discoverMatrix();
  const compatiblePairs = matrix.filter(e => e.status === 'compatible');

  // Apply filters
  const pairs = compatiblePairs.filter(pair => {
    if (themeFilter && pair.theme !== themeFilter) return false;
    if (styleFilter && pair.style !== styleFilter) return false;
    return true;
  });

  console.log(`Found ${pairs.length} fully compatible theme×style pairs to process\n`);

  // Launch browser
  let browser;
  try {
    console.log('Launching Chromium...');
    browser = await chromium.launch({ headless: true });
    console.log('Chromium launched.\n');
  } catch (err) {
    console.error(`Failed to launch Chromium: ${err.message}`);
    process.exit(1);
  }

  const results = [];

  try {
    for (const pair of pairs) {
      const baselineDir = join(baselinesRoot, pair.theme, pair.style);
      const freshDir = join(smokeProjectDir, 'vr_fresh', pair.theme, pair.style);
      console.log(`  Processing: ${pair.theme} × ${pair.style} ...`);

      // Capture fresh screenshots
      const captureResult = await captureScreenshots(browser, pair.theme, pair.style, freshDir);
      if (captureResult.errors.length > 0) {
        console.log(`    ❌ Build errors: ${captureResult.errors.join('; ')}`);
        results.push({ theme: pair.theme, style: pair.style, status: 'error', errors: captureResult.errors });
        continue;
      }

      if (mode === 'capture') {
        // Save as baselines
        mkdirSync(baselineDir, { recursive: true });
        for (const [slideNum, path] of Object.entries(captureResult.screenshots)) {
          const baselinePath = join(baselineDir, `slide-${slideNum}.png`);
          writeFileSync(baselinePath, readFileSync(path));
        }
        console.log(`    ✓ Baselines saved to ${baselineDir}`);
        results.push({ theme: pair.theme, style: pair.style, status: 'captured', dir: baselineDir });
      } else if (mode === 'compare') {
        // Compare against baselines
        const slideResults = [];
        let allPassed = true;

        for (const [slideNum, freshPath] of Object.entries(captureResult.screenshots)) {
          const baselinePath = join(baselineDir, `slide-${slideNum}.png`);

          if (!existsSync(baselinePath)) {
            console.log(`    ⚠️  slide-${slideNum}: no baseline — creating`);
            mkdirSync(baselineDir, { recursive: true });
            writeFileSync(baselinePath, readFileSync(freshPath));
            slideResults.push({ slide: Number(slideNum), status: 'created', path: baselinePath });
            allPassed = false;
            continue;
          }

          const comparison = compareScreenshots(freshPath, baselinePath);

          if (comparison.identical) {
            console.log(`    ✓ slide-${slideNum}: identical`);
            slideResults.push({ slide: Number(slideNum), status: 'pass', identical: true });
          } else if (comparison.diffRatio <= DEFAULT_THRESHOLD) {
            console.log(`    ✓ slide-${slideNum}: within threshold (${(comparison.diffRatio * 100).toFixed(3)}%)`);
            slideResults.push({ slide: Number(slideNum), status: 'pass', identical: false, diffRatio: comparison.diffRatio });
          } else {
            console.log(`    ❌ slide-${slideNum}: EXCEEDS threshold (${(comparison.diffRatio * 100).toFixed(3)}% > ${(DEFAULT_THRESHOLD * 100).toFixed(1)}%)`);

            // Save diff screenshot (just the fresh capture for now)
            const diffPath = join(baselineDir, `diff-slide-${slideNum}.png`);
            writeFileSync(diffPath, readFileSync(freshPath));
            slideResults.push({
              slide: Number(slideNum),
              status: 'fail',
              diffRatio: comparison.diffRatio,
              diffPath,
              details: comparison,
            });
            allPassed = false;
          }
        }

        results.push({
          theme: pair.theme,
          style: pair.style,
          status: allPassed ? 'pass' : 'fail',
          slides: slideResults,
        });
      }
    }
  } finally {
    await browser.close();
    console.log('\nChromium closed.');
  }

  // Clean up temp files
  try {
    const tmpDir = join(smokeProjectDir, 'vr_fresh');
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    const entries = readdirSync(smokeProjectDir);
    for (const entry of entries) {
      if (entry.startsWith('vr_') && entry.endsWith('.html')) {
        rmSync(join(smokeProjectDir, entry));
      }
      if (entry.startsWith('_vr_') && entry.endsWith('.mjs')) {
        rmSync(join(smokeProjectDir, entry));
      }
    }
  } catch {
    // best-effort cleanup
  }

  // Output machine-readable result
  console.log('\n%%RESULT_START%%');
  console.log(JSON.stringify({
    mode,
    total: results.length,
    passed: results.filter(r => r.status === 'pass' || r.status === 'captured').length,
    failed: results.filter(r => r.status === 'fail' || r.status === 'error').length,
    results,
  }));
  console.log('%%RESULT_END%%');

  // Summary
  const failed = results.filter(r => r.status === 'fail' || r.status === 'error').length;
  const passed = results.length - failed;

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║              Visual Regression Results Summary               ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Mode:   ${mode.padEnd(54)}║`);
  console.log(`║  Total:  ${String(results.length).padEnd(4)}  Passed: ${String(passed).padEnd(4)}  Failed: ${String(failed).padEnd(4)}             ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
