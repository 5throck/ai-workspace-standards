// theme-browser-smoke.browser.mjs — Playwright browser smoke tests for theme×style compatibility matrix.
//
// Uses Node.js (not bun) because bun has issues with Playwright subprocess handling
// (chromium.launch() hangs indefinitely under bun on Windows).
//
// Run via:
//   node scripts/co-deck/tests/theme-browser-smoke.browser.mjs
// Or via:
//   bun run test:smoke
//
// Tests each compatible/partial theme×style pair:
//   1. Build an HTML deck via buildThemeDeck()
//   2. Open in Chromium via Playwright
//   3. Assert: zero uncaught JS errors, zero console errors, no 404 resources,
//      4 slides rendered, nav controls, TOC, fullscreen controls exist

import { existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import assert from 'assert/strict';

// ── Paths ─────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../../..');
const slideDataPath = join(__dirname, 'fixtures', 'theme-deck', 'slide-data.json');
const smokeProjectDir = join(root, 'presentations', '_smoke_test');

// Read fixture slide data
const SLIDE_DATA = JSON.parse(readFileSync(slideDataPath, 'utf-8'));
const EXPECTED_SLIDE_COUNT = SLIDE_DATA.length; // 4

// ── Playwright availability ───────────────────────────────────────────

let chromium = null;
try {
  const pw = await import('playwright');
  chromium = pw.chromium;
} catch {
  console.log('⚠️  Playwright not installed. Skipping browser smoke tests.');
  console.log('   Install with: bun add -d playwright && bunx playwright install chromium');
  process.exit(0);
}

// ── Dynamic import of theme modules (transpile .ts via bun) ──────────
//
// Since this file runs under Node.js, we can't directly import .ts files.
// We use a small helper to invoke bun and get the buildThemeDeck output.

function buildViaBun(options) {
  const optsStr = JSON.stringify(options).replace(/'/g, "'\\''");
  const script = `
    import { buildThemeDeck } from '${join(root, 'scripts/co-deck/lib/theme-builder.ts').replace(/\\/g, '/')}';
    const opts = ${JSON.stringify(options)};
    const result = buildThemeDeck(opts);
    console.log('%%BUILD_START%%');
    console.log(JSON.stringify({ outputPath: result.outputPath, html: result.html, warnings: result.warnings, errors: result.errors }));
    console.log('%%BUILD_END%%');
  `;
  const tmpScript = join(smokeProjectDir, '_build_helper.mjs');
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

// ── Compatibility matrix discovery (via bun) ─────────────────────────

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
  const tmpScript = join(smokeProjectDir, '_matrix_helper.mjs');
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

// ── Test runner ──────────────────────────────────────────────────────

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log('✅');
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.log(`❌\n    ${err.message}`);
  }
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Browser Smoke Tests — Theme × Style Matrix            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Ensure smoke project dir exists
  if (!existsSync(smokeProjectDir)) {
    mkdirSync(smokeProjectDir, { recursive: true });
  }

  // Discover matrix
  const matrix = discoverMatrix();
  const compatibleAndPartial = matrix.filter(
    (e) => e.status === 'compatible' || e.status === 'partial',
  );

  console.log(`Found ${matrix.length} pairs: ${compatibleAndPartial.length} to browser-test\n`);

  // Launch browser once
  let browser;
  try {
    console.log('Launching Chromium...');
    browser = await chromium.launch({ headless: true });
    console.log('Chromium launched.\n');
  } catch (err) {
    console.error(`Failed to launch Chromium: ${err.message}`);
    console.error('Aborting browser smoke tests.');
    process.exit(1);
  }

  try {
    // ── Incompatible pairs: verify build rejection ────────────────────
    console.log('── Incompatible pairs (build rejection) ──');
    const incompatible = matrix.filter((e) => e.status === 'incompatible');
    for (const entry of incompatible) {
      await runTest(`reject ${entry.theme} + ${entry.style}`, async () => {
        const result = buildViaBun({
          root,
          projectPath: smokeProjectDir,
          theme: entry.theme,
          style: entry.style,
          title: `Smoke ${entry.theme} ${entry.style}`,
          slideData: SLIDE_DATA,
        });
        assert.ok(result.errors.length > 0, `Expected errors but got none`);
        assert.ok(
          result.errors.some((e) => e.includes('incompatible')),
          `Expected "incompatible" in errors but got: ${result.errors.join(', ')}`,
        );
        assert.ok(result.html === '', 'Expected empty HTML for incompatible pair');
      });
    }

    // ── Compatible/partial pairs: browser smoke tests ────────────────
    console.log('\n── Compatible/partial pairs (browser smoke) ──');
    for (const entry of compatibleAndPartial) {
      const statusLabel = entry.status === 'partial' ? ' [PARTIAL]' : '';
      const testName = `${entry.theme} + ${entry.style}${statusLabel}`;

      await runTest(testName, async () => {
        // 1. Build HTML deck
        const outputFileName = `smoke_${entry.theme}_${entry.style}.html`;
        const outputPath = join(smokeProjectDir, outputFileName);

        const result = buildViaBun({
          root,
          projectPath: smokeProjectDir,
          theme: entry.theme,
          style: entry.style,
          title: `Smoke ${entry.theme} ${entry.style}`,
          slideData: SLIDE_DATA,
          outputPath,
        });

        assert.ok(result.errors.length === 0, `Build errors: ${result.errors.join(', ')}`);
        assert.ok(result.html !== '', 'Expected non-empty HTML output');

        // Write HTML to disk
        writeFileSync(outputPath, result.html, 'utf-8');
        const fileUrl = `file:///${outputPath.replace(/\\/g, '/')}`;

        // 2. Open in Chromium
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          ignoreHTTPSErrors: true,
        });
        const page = await context.newPage();

        // Collect errors
        const pageErrors = [];
        const consoleErrors = [];
        const failedResources = [];

        page.on('pageerror', (err) => pageErrors.push(err.message));
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('requestfailed', (request) => {
          failedResources.push(
            `${request.method()} ${request.url()}: ${request.failure()?.errorText || 'unknown'}`,
          );
        });

        // 3. Navigate
        try {
          await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (navError) {
          await context.close();
          throw new Error(`Navigation failed: ${navError.message}`);
        }

        // 4. Wait for runtime initialization
        await page.waitForTimeout(2500);

        // 5. Zero uncaught JS errors
        assert.ok(pageErrors.length === 0, `Uncaught JS errors: ${pageErrors.join('; ')}`);

        // 6. Zero console errors
        assert.ok(consoleErrors.length === 0, `Console errors: ${consoleErrors.join('; ')}`);

        // 7. No failed resources
        assert.ok(failedResources.length === 0, `Failed resources: ${failedResources.join('; ')}`);

        // 8. Slide count
        const slideCount = await page.$$eval('.slide', (slides) => slides.length);
        assert.strictEqual(slideCount, EXPECTED_SLIDE_COUNT,
          `Expected ${EXPECTED_SLIDE_COUNT} slides but found ${slideCount}`);

        // 9. Navigation controls
        const hasNavBtns = await page.$$eval('.nav-btn', (btns) => btns.length >= 2);
        assert.ok(hasNavBtns, 'Expected at least 2 .nav-btn elements');

        // 10. Slide counter
        const hasSlideCounter = await page.$('#slide-counter');
        assert.ok(hasSlideCounter, 'Expected #slide-counter element');

        // 11. TOC drawer
        const hasTocDrawer = await page.$('#toc-drawer');
        assert.ok(hasTocDrawer, 'Expected #toc-drawer element');

        // 12. Fullscreen button
        const hasFullscreenBtn = await page.$('#fullscreen-btn');
        assert.ok(hasFullscreenBtn, 'Expected #fullscreen-btn element');

        // 13. No gross overflow (except vertical-scroll theme)
        const themePkg = buildViaBun({ root, projectPath: smokeProjectDir, theme: entry.theme, style: entry.style, title: 'probe', slideData: [] });
        // We infer paradigm from the matrix — vertical theme uses vertical-scroll paradigm
        const isVerticalScroll = entry.theme === 'vertical';

        if (!isVerticalScroll) {
          const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
          assert.ok(scrollHeight < 720 * 2,
            `Excessive scrollHeight ${scrollHeight}px at 1280×720 (expected < ${720 * 2})`);
        }

        // Clean up context
        await context.close();
      });
    }
  } finally {
    // Close browser
    await browser.close();
    console.log('\nChromium closed.');
  }

  // Clean up generated HTML files
  try {
    const entries = readdirSync(smokeProjectDir);
    for (const entry of entries) {
      if (entry.startsWith('smoke_') && entry.endsWith('.html')) {
        rmSync(join(smokeProjectDir, entry));
      }
      if (entry.startsWith('_') && entry.endsWith('.mjs')) {
        rmSync(join(smokeProjectDir, entry));
      }
    }
  } catch {
    // best-effort
  }

  // ── Summary ──────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Results Summary                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Total:  ${String(totalTests).padEnd(4)}  Passed: ${String(passedTests).padEnd(4)}  Failed: ${String(failedTests).padEnd(4)}             ║`);
  if (failures.length > 0) {
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║  Failures:                                                    ║');
    for (const f of failures) {
      console.log(`║    ❌ ${f.name.padEnd(52)} ║`);
      console.log(`║       ${f.message.substring(0, 52).padEnd(52)} ║`);
    }
  }
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
