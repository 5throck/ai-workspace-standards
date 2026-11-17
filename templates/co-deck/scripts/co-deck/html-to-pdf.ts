// @version 1.3.1 — Generate PDF from self-contained HTML slide deck using Puppeteer.
// v1.3.1 (design 2026-11-17-co-deck-pdf-followups PR-4, T-20261117-002/-003):
//   (T-002) the chrome-hide block's legacy selectors (.footer-bar/.note-panel/
//   .toc — matching none of the audited theme chrome, so the TOC drawer became
//   page 1 and the speaker-notes panel a trailing page) are EXTENDED with the
//   audited theme-chrome denylist: `#toc-drawer`, `#toc-overlay`, `#script-panel`
//   (5/6 themes; outlook has no script-panel), `footer`/`.ppt-footer` (all 6),
//   `.progress-bar-wrap`. Legacy selectors kept — harmless, and the preview
//   fixtures still use some. No `body > :not(…)` structural chain (rejected by
//   design §1.2 — wrappers differ per theme). Result: PDF page count ==
//   slide count.
//   (T-003) `--pages` now works on div.slide decks: the filter ADDS the class
//   `cdk-page-hidden` to filtered slides (inline display:none kept for any
//   screen-context re-render) and the print block honors it with a `0,2,0`
//   specificity rule (`section.cdk-page-hidden, .slide.cdk-page-hidden`) that
//   beats the `0,1,0` section/.slide twin order-independently — the v1.2.0-era
//   inline `display:none` (no !important) was silently overridden by the twin's
//   stylesheet `!important`. Class-based per design §2.2 (one source of truth;
//   inline-!important rejected). "Pages:" log stays computed — truthful once
//   the §1 page-count invariant holds.
// v1.3.0 (design 2026-11-16-co-deck-pdf-html-backport PR-2, U-008 item 1):
//   dual-selector slide discovery — every current theme renders slides
//   client-side as `div.slide` (ppt-engine runtime), while this script only
//   counted `<section>` (legacy static decks) and silently produced a 0-page
//   exit-0 PDF on modern decks. Both selectors are now counted after the
//   fonts wait; exactly ONE non-empty set renders (`.slide` wins when
//   present, else `section` — never both, so hand-edited mixed decks cannot
//   double-count, design R-A2). The section print-CSS block gains `.slide`
//   twins (same rules; centered-page rules map to
//   `[data-type="cover"|"divider"|"closing"]`). A zero-slide input is a loud
//   failure: both selector counts printed, exit 1 after cleanup, NO PDF
//   written (owner decision O-4 — the old exit-0 blank PDF was the reported
//   failure mode). Legacy `<section>` decks render unchanged.
// v1.2.0 (design 2026-11-14-html-to-pdf-pool-asset-serving): pool-asset
//   intercept-fallback — `/assets/…` requests that miss deck-locally re-resolve
//   against the shared pool dir beside the deck (containment-guarded; `🔀 pool:`
//   info log on pool hits), and every content 404 logs `⚠️ 404 (missing)` plus
//   a final missing-asset summary (favicon.ico excluded — browser artifact) —
//   loud but non-fatal, exit code unchanged.
// Uses system Chrome/Edge (WebSocket transport, more reliable than Playwright pipe in VMs).
// Captures each slide — `div.slide` (PPT-engine runtime-rendered decks) or
// legacy `<section>` (static decks) — as a full-page PDF with correct centering
// and large layout. Zero-slide input fails loudly with exit 1 (no PDF written).
// Usage:
//   bun scripts/co-deck/html-to-pdf.ts --html deliverables/<project>/lecture_vN.html [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5] [--pages N]
//   --pages N: only render first N slides/sections (useful for sample/preview PDF)

import puppeteer, { type Browser, type Page } from 'puppeteer-core';
import { resolve, dirname, join, sep } from 'path';
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
  let hadError = false;
  // Zero-slide loud failure (v1.3.0, O-4): declared out here so the exit-1
  // decision after the finally cleanup can see it (same pattern as hadError).
  let zeroSlides = false;
  // Server-observed 404 count (v1.2.0). An HTTP 404 is a *successful* network
  // request, so the `requestfailed` listener below never sees it — count here.
  let missingRequests = 0;

  try {
    const execPath = findChrome();
    if (!execPath) {
      console.error('❌ No Chrome/Edge found on this system. Install Chrome or Edge to continue.');
      process.exit(1);
    }
    console.log(`🌐 Browser: ${execPath}`);

    // 1. Start local HTTP server (serves HTML dir — fixes file:// image loading in Chrome)
    const serveDir = htmlDir;
    // Shared asset pool beside the deck dir (v1.2.0): decks bind pool assets as
    // `../assets/…`; the browser resolves that before sending, so the wire path
    // is `/assets/…` — a deck-local miss once deck-local asset dirs are gone.
    const poolRoot = resolve(dirname(serveDir), 'assets');
    const isFile = (p: string): boolean => existsSync(p) && statSync(p).isFile();
    server = Bun.serve({
      port: 0, // random available port
      fetch(req) {
        const urlObj = new URL(req.url);
        let relativePath = decodeURIComponent(urlObj.pathname);
        // Windows: strip leading slash, normalize separators
        relativePath = relativePath.replace(/^\//, '').replace(/\//g, '/');
        const fullPath = join(serveDir, relativePath);

        // Traversal guard: require fullPath to be inside serveDir (a sibling
        // directory sharing the string prefix must NOT pass).
        const resolvedFull = resolve(fullPath);
        if (!resolvedFull.startsWith(serveDir + sep)) {
          return new Response('Forbidden', { status: 403 });
        }

        let servePath = fullPath;
        if (!isFile(fullPath)) {
          // Pool fallback: only for a first path segment of `assets/`, and only
          // when the re-resolved file stays inside the pool root — the same
          // startsWith(dir + sep) discipline as the guard above, so `..` never
          // survives resolve + check and nothing outside the pool is served.
          const poolFile = resolve(dirname(serveDir), relativePath);
          if (
            relativePath.startsWith('assets/') &&
            poolFile.startsWith(poolRoot + sep) &&
            isFile(poolFile)
          ) {
            console.log(`🔀 pool: ${relativePath}`);
            servePath = poolFile;
          } else {
            // favicon.ico: a browser artifact (requested by headless Chrome,
            // never referenced by the deck) — 404 it quietly or it would
            // pollute the missing-asset signal on every clean render.
            if (relativePath !== 'favicon.ico') {
              const reason = relativePath.startsWith('assets/')
                ? 'not in the deck dir or the shared pool'
                : 'not in the deck dir';
              console.warn(`⚠️ 404 (missing): ${relativePath} — ${reason}`);
              missingRequests++;
            }
            return new Response('Not Found', { status: 404 });
          }
        }

        const mime = getMime(servePath);
        const body = readFileSync(servePath);
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

        /* Each section / runtime slide becomes a standalone page.
           v1.3.0: the div.slide twin mirrors the section rules so ppt-engine
           runtime-rendered decks (div.slide, e.g. zen) print like the legacy
           static decks did; a section deck contains no .slide elements
           and vice versa, so the twins never interact. */
        section, .slide {
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

        /* ── --pages exclusion (v1.3.1, T-20261117-003): the class the filter
           adds beats the twin rule order-independently — 0,2,0 vs the twin's
           0,1,0 at equal importance. Break-after resets are belt-and-braces
           (a display:none box generates no pages or breaks; they keep the
           last-VISIBLE-slide trailing-break semantics identical to the
           full-deck case). */
        section.cdk-page-hidden, .slide.cdk-page-hidden {
          display: none !important;
          page-break-after: auto !important;
          break-after: auto !important;
        }

        /* Centered sections (cover, divider, closing): center horizontally.
           v1.3.0: zen marks slide kinds via dataset.type
           (zen/template.html renderSlide) — the .slide twins map the same
           three kinds. */
        section.center, section.act-cover,
        .slide[data-type="cover"], .slide[data-type="divider"], .slide[data-type="closing"] {
          align-items: center !important;
          text-align: center !important;
        }
        section.center > .num {
          align-self: center !important;
          text-align: center !important;
        }
        .slide[data-type="cover"] > .num,
        .slide[data-type="divider"] > .num,
        .slide[data-type="closing"] > .num {
          align-self: center !important;
          text-align: center !important;
        }
        /* All children inside .center sections inherit center alignment */
        section.center > * {
          text-align: center !important;
        }
        .slide[data-type="cover"] > *,
        .slide[data-type="divider"] > *,
        .slide[data-type="closing"] > * {
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
        section > .cols,
        .slide > .grid, .slide > .split, .slide > .card,
        .slide > table, .slide > .chart-wrap, .slide > .tp,
        .slide > .svg-wrap, .slide > .two-col,
        .slide > .cols {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* legend-row and src-note: stretch width but keep original alignment */
        section > .legend-row, section > .src-note,
        .slide > .legend-row, .slide > .src-note {
          width: 100% !important;
          max-width: 100% !important;
        }
        /* icon-row: left-align in normal sections */
        section > .icon-row,
        .slide > .icon-row {
          width: 100% !important;
          max-width: 100% !important;
          justify-content: flex-start !important;
        }
        /* icon-row: center in .center sections */
        section.center > .icon-row,
        .slide[data-type="cover"] > .icon-row,
        .slide[data-type="divider"] > .icon-row,
        .slide[data-type="closing"] > .icon-row {
          justify-content: center !important;
        }

        /* ── Inline-level elements that should NOT stretch ── */
        section > .badge,
        section > .tag,
        section > .act-label,
        section > .divider,
        section > .stat-big,
        section > .stat-row,
        .slide > .badge,
        .slide > .tag,
        .slide > .act-label,
        .slide > .divider,
        .slide > .stat-big,
        .slide > .stat-row {
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
        section > *[class*="slide"], section > *[class*="content"],
        .slide > h1, .slide > h2, .slide > h3, .slide > p:not(.src-note),
        .slide > .lead, .slide > .echo, .slide > .disclaim,
        .slide > .kicker, .slide > .blockquote,
        .slide > ul, .slide > ol,
        .slide > .final-tag, .slide > .ref,
        .slide > *[class*="slide"], .slide > *[class*="content"] {
          max-width: ${Math.floor(viewWidth * 0.88)}px !important;
          width: auto !important;
          text-align: left !important;
        }
        /* .src-note: do not force alignment — respect inline style when present */
        /* .quote respects center alignment in .center sections */
        section.center > .quote,
        section.center > p,
        section.center > .lead,
        .slide[data-type="cover"] > .quote,
        .slide[data-type="divider"] > .quote,
        .slide[data-type="closing"] > .quote,
        .slide[data-type="cover"] > p,
        .slide[data-type="divider"] > p,
        .slide[data-type="closing"] > p,
        .slide[data-type="cover"] > .lead,
        .slide[data-type="divider"] > .lead,
        .slide[data-type="closing"] > .lead {
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

        /* ── v1.3.1 (T-002): ppt-engine runtime deck wrappers — ppt-engine.css
           prints slides in block flow (its @media print block resets .slide to
           position:relative + transform:none) but NEVER resets the wrappers:
           .ppt-main keeps display:flex and .presentation-container keeps
           flex:1 + overflow:hidden from screen mode, so the stacked slide flow
           is clipped to a viewport-height box — pages ≠ slides even after the
           chrome denylist below (observed: a 3-slide zen fixture rendered 2
           pages, text of slides 2-3 clipped away). Unblock the flow for print;
           a legacy <section> deck has neither class and is unaffected. */
        .ppt-main, .presentation-container {
          display: block !important;
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
          flex: none !important;
          padding: 0 !important;
        }

        /* ── Hide UI controls in PDF ── */
        .footer-bar,
        .progress-track,
        .progress-fill,
        .toc,
        .toc-backdrop,
        .toc-toggle,
        .note-panel,
        /* v1.3.1 (T-20261117-002): the audited theme-chrome denylist — the
           legacy vocabulary above matched none of the six themes' actual
           chrome, so the TOC drawer entered the printed flow as page 1 and
           the speaker-notes panel as a trailing page. The bare "footer"
           element selector covers the footer.ppt-footer pair across all
           six themes; footer-internal counters/progress die with it. Ids are
           deliberate (design §1.4 R-A1'): not class-greedy, theme-safe —
           outlook has no #script-panel and needs only its drawer/footer
           hidden. No structural selector chains: wrappers differ per
           theme. These ids are RESERVED for theme chrome (design §6). */
        #toc-drawer,
        #toc-overlay,
        #script-panel,
        footer,
        .ppt-footer,
        .progress-bar-wrap {
          display: none !important;
        }

        /* ── Remove last section/slide trailing break ── */
        section:last-of-type,
        .slide:last-of-type {
          page-break-after: auto !important;
          break-after: auto !important;
        }
      `,
    });

    // 4. Slide counting moved after the fonts wait (step 6): ppt-engine
    //    runtime decks render their div.slide elements at DOMContentLoaded,
    //    and v1.3.0 must count them together with legacy sections in one
    //    dual-selector discovery pass.

    // 5. Wait for web fonts to load
    await new Promise(r => setTimeout(r, 3000));
    // Additional wait for fonts like Pretendard that load via @font-face
    await page.evaluate(() => document.fonts.ready);

    // 6. Dual-selector slide discovery (v1.3.0, after the fonts wait so
    // runtime-rendered decks have painted their slides): `.slide` (ppt-engine
    // runtime decks — every theme html-build produces today) wins when
    // present; `section` (legacy static decks) is the fallback. Exactly one
    // set renders — never both (design R-A2, no double-count on mixed decks).
    const slideCount = await page.$$eval('.slide', (els) => els.length);
    const sectionCount = await page.$$eval('section', (els) => els.length);
    const useSlideSelector = slideCount > 0;
    const slideSelector = useSlideSelector ? '.slide' : 'section';
    const totalSlides = useSlideSelector ? slideCount : sectionCount;
    console.log(`📊 Slides: ${totalSlides} (selector: '${slideSelector}' — .slide: ${slideCount}, section: ${sectionCount})`);

    // 6b. Loud zero-slide failure (owner decision O-4): the pre-v1.3.0
    // behavior produced an exit-0 PDF with 0 pages (the reported failure
    // mode). Both selector counts are 0 → name the input and both selectors,
    // skip PDF generation entirely (no output file), exit 1 after cleanup.
    zeroSlides = totalSlides === 0;
    if (zeroSlides) {
      console.error(`\n❌ Zero slides found — no PDF written.`);
      console.error(`   Input: ${resolvedHtml}`);
      console.error(`   Tried both selectors: '.slide' (ppt-engine runtime-rendered decks) and 'section' (legacy static decks) — 0 matches for each.`);
      console.error(`   This HTML is not a deck this renderer understands; rebuild it via build-theme-deck.ts before exporting to PDF.`);
    }

    // 6c. If page limit is set, hide slides beyond the limit (either selector)
    if (!zeroSlides && pageLimit > 0 && pageLimit < totalSlides) {
      const hidden = await page.evaluate(({ sel, limit }) => {
        const slides = Array.from(document.querySelectorAll(sel));
        for (let i = limit; i < slides.length; i++) {
          // v1.3.1 (T-20261117-003): class-based exclusion — a plain inline
          // display:none is silently overridden by the print block's
          // `section, .slide { display: flex !important }` twin (a stylesheet
          // !important beats a normal inline style). The print block honors
          // .cdk-page-hidden at 0,2,0 specificity. The inline style stays
          // (it makes the hide effective in any screen-context re-render).
          (slides[i] as HTMLElement).style.display = 'none';
          (slides[i] as HTMLElement).classList.add('cdk-page-hidden');
        }
        return slides.length - limit;
      }, { sel: slideSelector, limit: pageLimit });
      console.log(`✂️  Hidden ${hidden} slides (keeping first ${pageLimit})`);
    }

    // 7. Generate PDF — each slide/section = one page
    if (!zeroSlides) {
      const pdfBuffer = await page.pdf({
        path: outPath,
        width: viewWidth,
        height: viewHeight,
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        scale: printScale,
        preferCSSPageSize: false,
      });

      // Loud but non-fatal failure summary (v1.2.0): the render itself succeeds,
      // so exit code stays 0 — the operator decides what to do with the blanks.
      if (missingRequests > 0) {
        console.warn(`⚠️ ${missingRequests} asset request(s) missing — images/fonts may be blank in the PDF`);
      }

      console.log(`\n✅ PDF generated: ${outPath}`);
      console.log(`   Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
      const renderedPages = (pageLimit > 0 && pageLimit < totalSlides) ? pageLimit : totalSlides;
      console.log(`   Pages: ${renderedPages} (total ${useSlideSelector ? 'slides' : 'sections'}: ${totalSlides})`);
    }

  } catch (err) {
    console.error('❌ Error generating PDF:', err);
    // Flag the failure instead of process.exit(1): an in-catch exit would
    // bypass the finally block below and orphan the headless Chrome process
    // and the listening Bun server. Exit non-zero after cleanup.
    hadError = true;
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.stop();
    }
  }
  if (hadError || zeroSlides) {
    process.exit(1);
  }
}

main();
