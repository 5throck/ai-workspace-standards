// @version 1.1.0 — Generate PDF from self-contained HTML slide deck using Puppeteer.
// Uses system Chrome/Edge (WebSocket transport, more reliable than Playwright pipe in VMs).
// Captures each <section> as a full-page PDF with correct centering and large layout.
// Usage:
//   bun scripts/co-deck/html-to-pdf.ts --html presentations/<project>/lecture_vN.html [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5] [--pages N]
//   --pages N: only render first N sections (useful for sample/preview PDF)

import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { platform } from 'os';

// ── Parse CLI args ─────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = 'true';
        i += 1;
      }
    } else {
      i++;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const htmlPath = args['html'];
if (!htmlPath) {
  console.error('Usage: bun scripts/co-deck/html-to-pdf.ts --html <path> [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5]');
  process.exit(1);
}

const resolvedHtml = resolve(htmlPath);
if (!existsSync(resolvedHtml)) {
  console.error(`HTML file not found: ${resolvedHtml}`);
  process.exit(1);
}

const htmlDir = dirname(resolvedHtml);
const outPath = args['out']
  ? resolve(args['out'])
  : resolve(htmlDir, resolvedHtml.replace(/\.html$/i, '.pdf').split(/[\\/]/).pop() || 'output.pdf');

const viewWidth = parseInt(args['width'] || '1920', 10);
const viewHeight = parseInt(args['height'] || '1080', 10);
const printScale = parseFloat(args['scale'] || '1.5');
const pageLimit = args['pages'] ? parseInt(args['pages'], 10) : 0; // 0 = all sections

console.log(`📄 HTML: ${resolvedHtml}`);
console.log(`📐 Viewport: ${viewWidth}x${viewHeight}`);
console.log(`🔍 Print scale: ${printScale}x`);
if (pageLimit > 0) console.log(`📑 Page limit: first ${pageLimit} sections only`);
console.log(`📤 Output: ${outPath}`);

// ── Find browser executable ───────────────────────────────────────────────────

function findChrome(): string | undefined {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return undefined;
}

// ── MIME type helper ────────────────────────────────────────────────────────────

function getMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript',
    json: 'application/json',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    svg: 'image/svg+xml', gif: 'image/gif',
    ico: 'image/x-icon',
    woff2: 'font/woff2', woff: 'font/woff',
    ttf: 'font/ttf', otf: 'font/otf',
  };
  return map[ext || ''] || 'application/octet-stream';
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;

  try {
    const execPath = findChrome();
    if (!execPath) {
      console.error('❌ No Chrome/Edge found on this system. Install Chrome or Edge to continue.');
      process.exit(1);
    }
    console.log(`🌐 Browser: ${execPath}`);

    // 1. Start local HTTP server (serves HTML dir — fixes file:// image loading in Chrome)
    const serveDir = htmlDir;
    server = Bun.serve({
      port: 0, // random available port
      fetch(req) {
        const urlObj = new URL(req.url);
        let relativePath = decodeURIComponent(urlObj.pathname);
        // Windows: strip leading slash, normalize separators
        relativePath = relativePath.replace(/^\//, '').replace(/\//g, '/');
        const fullPath = join(serveDir, relativePath);

        if (!fullPath.startsWith(serveDir)) {
          return new Response('Forbidden', { status: 403 });
        }
        if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
          return new Response('Not Found', { status: 404 });
        }

        const mime = getMime(fullPath);
        const body = readFileSync(fullPath);
        return new Response(body, {
          headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache' },
        });
      },
    });
    const baseUrl = `http://localhost:${server.port}`;
    const htmlRelativePath = resolvedHtml.slice(serveDir.length).replace(/\\/g, '/').replace(/^\//, '');
    const pageUrl = `${baseUrl}/${htmlRelativePath}`;
    console.log(`🌐 Local server: ${baseUrl} (serving ${serveDir})`);
    console.log(`📄 Page URL: ${pageUrl}`);

    // 2. Launch browser via Puppeteer
    browser = await puppeteer.launch({
      executablePath: execPath,
      headless: true,
      defaultViewport: null,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        `--window-size=${viewWidth},${viewHeight}`,
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: viewWidth, height: viewHeight, deviceScaleFactor: 2 });

    // Listen for resource load failures
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('.jpg') || url.includes('.png') || url.includes('.webp') || url.includes('.svg')) {
        console.warn(`⚠️ Image failed: ${url}`);
      }
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Remove loading="lazy" from all images so Chrome actually loads them in headless/PDF mode
    await page.evaluate(() => {
      document.querySelectorAll('img[loading="lazy"]').forEach(img => {
        img.setAttribute('loading', 'eager');
      });
    });

    // 3. Inject print/PDF CSS overrides for centering and full-bleed layout
    await page.addStyleTag({
      content: `
        /* ── Print/PDF overrides ─────────────────────────────── */
        @page {
          size: ${viewWidth * printScale / 96}in ${viewHeight * printScale / 96}in;
          margin: 0;
        }

        html, body {
          overflow: visible !important;
          height: auto !important;
          width: ${viewWidth}px !important;
        }

        /* Remove scroll-snap and overflow constraints */
        .wrap {
          display: block !important;
          overflow: visible !important;
          scroll-snap-type: none !important;
          width: ${viewWidth}px !important;
        }

        /* Each section becomes a standalone page */
        section {
          width: ${viewWidth}px !important;
          min-width: ${viewWidth}px !important;
          height: ${viewHeight}px !important;
          max-height: ${viewHeight}px !important;
          flex: none !important;
          scroll-snap-align: none !important;
          overflow: visible !important;
          page-break-after: always;
          page-break-inside: avoid;
          break-after: page;
          break-inside: avoid;

          /* Flex column: vertically centered (matching HTML source) */
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 50px 6vw !important;
          position: relative !important;
          box-sizing: border-box !important;
          border-right: none !important;
          text-align: left !important;
        }

        /* Centered sections (cover, divider, closing): center horizontally */
        section.center, section.act-cover {
          align-items: center !important;
          text-align: center !important;
        }
        section.center > .num {
          align-self: center !important;
          text-align: center !important;
        }
        /* All children inside .center sections inherit center alignment */
        section.center > * {
          text-align: center !important;
        }

        /* ── .num label: keep absolute position matching HTML source ── */
        .num {
          position: absolute !important;
          top: 30px !important;
          left: 6vw !important;
          width: auto !important;
          max-width: 100% !important;
          text-align: left !important;
          margin-bottom: 0 !important;
        }

        /* ── Container elements that should stretch to full section width ── */
        section > .grid, section > .split, section > .card,
        section > table, section > .chart-wrap, section > .tp,
        section > .svg-wrap, section > .two-col,
        section > .cols {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* legend-row and src-note: stretch width but keep original alignment */
        section > .legend-row, section > .src-note {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* icon-row: left-align in normal sections */
        section > .icon-row {
          width: 100% !important;
          max-width: 100% !important;
          justify-content: flex-start !important;
        }
        /* icon-row: center in .center sections */
        section.center > .icon-row {
          justify-content: center !important;
        }

        /* ── Inline-level elements that should NOT stretch ── */
        section > .badge,
        section > .tag,
        section > .act-label,
        section > .divider,
        section > .stat-big,
        section > .stat-row {
          width: auto !important;
          max-width: ${Math.floor(viewWidth * 0.88)}px !important;
        }

        /* ── Grid containers: constrain to content width ── */
        .grid {
          width: 88% !important;
          max-width: ${Math.floor(viewWidth * 0.88)}px !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
        }

        /* ── Text/block elements: left-aligned, constrained width ── */
        section > h1, section > h2, section > h3, section > p:not(.src-note),
        section > .lead, section > .echo, section > .disclaim,
        section > .kicker, section > .blockquote,
        section > ul, section > ol,
        section > .final-tag, section > .ref,
        section > *[class*="slide"], section > *[class*="content"] {
          max-width: ${Math.floor(viewWidth * 0.88)}px !important;
          width: auto !important;
          text-align: left !important;
        }
        /* .src-note: do not force alignment — respect inline style when present */
        /* .quote respects center alignment in .center sections */
        section.center > .quote,
        section.center > p,
        section.center > .lead {
          text-align: center !important;
        }

        /* ── Nested text blocks also constrained ── */
        .lead, .quote, .echo, .disclaim,
        .kicker, .stat-big, .stat-row,
        .final-tag, .ref, .blockquote {
          max-width: ${Math.floor(viewWidth * 0.88)}px !important;
        }

        /* ── Tables should fill grid container ── */
        table {
          width: 100% !important;
        }

        /* ── SVG: respect inline width/height, only cap at section width ── */
        svg {
          max-width: 100% !important;
          height: auto !important;
        }
        /* SVGs with width="100%": constrain to content width so they don't stretch full page */
        svg[width="100%"] {
          max-width: 88% !important;
        }
        /* Small header SVGs (120px height): cap to prevent oversized */
        svg[width="100%"][height="120"] {
          max-height: 100px !important;
        }
        /* SVGs with explicit pixel width attr: cap height to prevent overflow */
        svg[width]:not([width="100%"]) {
          max-height: ${Math.floor(viewHeight * 0.45)}px !important;
        }

        /* ── Figure container: clip overflow so images never push other elements ── */
        .fig {
          overflow: hidden !important;
        }

        /* ── Figure images: let HTML source rules handle sizing (width:100%; height:320px; object-fit:cover) ── */
        /* ── Only add overflow hidden as safety net ── */

        /* ── Non-figure images: cap at section width ── */
        img {
          max-width: 100% !important;
        }

        /* ── Hide UI controls in PDF ── */
        .footer-bar,
        .progress-track,
        .progress-fill,
        .toc,
        .toc-backdrop,
        .toc-toggle,
        .note-panel {
          display: none !important;
        }

        /* ── Remove last section trailing break ── */
        section:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      `,
    });

    // 4. Count sections
    const sectionCount = await page.$$eval('section', (sections) => sections.length);
    console.log(`📊 Total sections: ${sectionCount}`);

    // 4b. If page limit is set, hide sections beyond the limit
    if (pageLimit > 0 && pageLimit < sectionCount) {
      const hidden = await page.evaluate((limit) => {
        const sections = Array.from(document.querySelectorAll('section'));
        let count = 0;
        for (const s of sections) {
          count++;
          if (count > limit) {
            s.style.display = 'none';
          }
        }
        return sections.length - limit;
      }, pageLimit);
      console.log(`✂️  Hidden ${hidden} sections (keeping first ${pageLimit})`);
    }

    // 5. Wait for web fonts to load
    await new Promise(r => setTimeout(r, 3000));
    // Additional wait for fonts like Pretendard that load via @font-face
    await page.evaluate(() => document.fonts.ready);

    // 6. Generate PDF — each section = one page
    const pdfBuffer = await page.pdf({
      path: outPath,
      width: viewWidth,
      height: viewHeight,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: printScale,
      preferCSSPageSize: false,
    });

    console.log(`\n✅ PDF generated: ${outPath}`);
    console.log(`   Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    const renderedPages = (pageLimit > 0 && pageLimit < sectionCount) ? pageLimit : sectionCount;
    console.log(`   Pages: ${renderedPages} (total sections: ${sectionCount})`);

  } catch (err) {
    console.error('❌ Error generating PDF:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.stop();
    }
  }
}

main();
