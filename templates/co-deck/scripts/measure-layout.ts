// @version 1.0.0
// Measure HTML slide layout coordinates, fonts, and colors using Playwright.
// Outputs layout_spec.json and pdf_layout_spec.md for PDF generation calibration.
// Usage: bun scripts/measure-layout.ts <html_file> [output_dir]
// Requires: playwright (bun install playwright && bunx playwright install chromium)

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, basename, join } from 'path';
import { chromium } from 'playwright';

// ── CSS selector lists per slide type ────────────────────────────────────────

const ELEMENTS_STANDARD: [string, string][] = [
  ['.slide',                                        'slide_root'],
  ['.slide-card, .slide-content, [class*="card"]',  'card'],
  ['.slide-header, header',                         'header'],
  ['.section-label, .section',                      'section_label'],
  ['.slide-title, h1, h2',                          'slide_title'],
  ['.bullets-container, .bullets, ul',              'bullets_container'],
  ['.visual-panel, .right-panel, .visual',          'visual_panel'],
];

const ELEMENTS_TITLE: [string, string][] = [
  ['.slide',                          'slide_root'],
  ['.slide-card, .slide-content',     'card'],
  ['.slide-header',                   'header'],
  ['.slide-title, h1',                'title_main'],
  ['.subtitle, .sub-title, h2',       'subtitle'],
  ['.meta, .meta-info',               'meta'],
];

const ELEMENTS_DIVIDER: [string, string][] = [
  ['.slide',                          'slide_root'],
  ['.slide-card, .slide-content',     'card'],
  ['.slide-header',                   'header'],
  ['.part-number, .part-num',         'part_number'],
  ['.divider-title, h1, h2',          'divider_title'],
  ['.divider-desc, .desc, p',         'desc'],
  ['.visual-panel, .divider-image',   'image_panel'],
];

// ── JavaScript injected into page for measurement ────────────────────────────

const MEASURE_JS = `
(selectors) => {
  const results = {};
  const slideEl = document.querySelector('.slide') || document.body;
  const slideRect = slideEl.getBoundingClientRect();

  results._slide_size = { w: slideRect.width, h: slideRect.height };

  for (const [selector, label] of selectors) {
    const parts = selector.split(',').map(s => s.trim());
    let el = null;
    for (const part of parts) {
      try { el = document.querySelector(part); if (el) break; } catch(e) {}
    }

    if (!el) { results[label] = null; continue; }

    const rect  = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);

    results[label] = {
      x: rect.left - slideRect.left,
      y: rect.top  - slideRect.top,
      w: rect.width,
      h: rect.height,
      x_pct: (rect.left - slideRect.left) / slideRect.width,
      y_pct: (rect.top  - slideRect.top)  / slideRect.height,
      w_pct: rect.width  / slideRect.width,
      h_pct: rect.height / slideRect.height,
      font_size:    style.fontSize,
      font_family:  style.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
      font_weight:  style.fontWeight,
      color:        style.color,
      bg_color:     style.backgroundColor,
      selector_used: el.tagName + (el.className ? '.' + el.className.split(' ')[0] : ''),
    };
  }
  return results;
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function startLocalServer(directory: string, port: number): Promise<() => void> {
  return new Promise((res, rej) => {
    const handler = (req: IncomingMessage, resp: ServerResponse) => {
      const filePath = join(directory, decodeURIComponent(req.url ?? '/'));
      try {
        const data = readFileSync(filePath);
        const ext  = filePath.split('.').pop()?.toLowerCase() ?? '';
        const mime: Record<string, string> = {
          html: 'text/html', css: 'text/css', js: 'application/javascript',
          json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        };
        resp.writeHead(200, { 'Content-Type': mime[ext] ?? 'application/octet-stream' });
        resp.end(data);
      } catch {
        resp.writeHead(404); resp.end('Not found');
      }
    };
    const server = createServer(handler);
    server.listen(port, () => res(() => server.close()));
    server.on('error', rej);
  });
}

function rgbToHex(rgb: string): string {
  try {
    const parts = rgb.replace(/rgba?\(/, '').replace(')', '').split(',');
    const [r, g, b] = parts.map(p => parseInt(p.trim()));
    return `#${r.toString(16).padStart(2,'0').toUpperCase()}${g.toString(16).padStart(2,'0').toUpperCase()}${b.toString(16).padStart(2,'0').toUpperCase()}`;
  } catch { return rgb; }
}

type SlideMetric = {
  x: number; y: number; w: number; h: number;
  x_pct: number; y_pct: number; w_pct: number; h_pct: number;
  font_size: string; font_family: string; font_weight: string;
  color: string; bg_color: string; selector_used: string;
} | null;

type LayoutSpec = {
  _slide_size?: { w: number; h: number };
  _slide_index?: number;
  _slide_type?: string;
  [key: string]: SlideMetric | number | string | { w: number; h: number } | undefined;
};

function generateMd(spec: Record<string, LayoutSpec>, htmlFile: string): string {
  const lines: string[] = [
    '# PDF 레이아웃 스펙', '',
    `> 기준 파일: \`${basename(htmlFile)}\`  `,
    `> 자동 측정: \`scripts/measure-layout.ts\``,
    '', '---', '',
  ];

  const slideSize = (spec['standard'] ?? spec['title'] ?? {})._slide_size ?? { w: 0, h: 0 };
  const { w: sw, h: sh } = slideSize;

  lines.push(
    '## 슬라이드 크기 (브라우저 px)',
    '| 항목 | 값 |', '|------|-----|',
    `| 너비 | ${Math.round(sw)}px |`,
    `| 높이 | ${Math.round(sh)}px |`,
    `| 비율 | ${sh > 0 ? (sw / sh).toFixed(3) : '—'} (${Math.round(sw)}:${Math.round(sh)}) |`,
    '', '---', '',
  );

  for (const [slideType, label] of [['title', '타이틀 슬라이드'], ['divider', '간지 슬라이드'], ['standard', '일반 슬라이드']] as const) {
    const data = spec[slideType];
    if (!data) continue;
    lines.push(`## ${label}`, '');

    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith('_') || val === null || typeof val !== 'object' || !('x' in val)) continue;
      const v = val as NonNullable<SlideMetric>;
      lines.push(
        `### \`${key}\``,
        '| 항목 | 값 |', '|------|-----|',
        `| 위치 X | ${v.x.toFixed(1)}px (${(v.x_pct * 100).toFixed(2)}%) |`,
        `| 위치 Y | ${v.y.toFixed(1)}px (${(v.y_pct * 100).toFixed(2)}%) |`,
        `| 너비 W | ${v.w.toFixed(1)}px (${(v.w_pct * 100).toFixed(2)}%) |`,
        `| 높이 H | ${v.h.toFixed(1)}px (${(v.h_pct * 100).toFixed(2)}%) |`,
        `| 폰트 | ${v.font_family} ${v.font_size} (weight: ${v.font_weight}) |`,
        `| 텍스트 색상 | ${rgbToHex(v.color)} (\`${v.color}\`) |`,
        `| 배경 색상 | ${rgbToHex(v.bg_color)} (\`${v.bg_color}\`) |`,
        '',
      );
    }
    lines.push('---', '');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('사용법: bun scripts/measure-layout.ts <html_file> [output_dir]');
    process.exit(1);
  }

  const htmlPath = resolve(args[0]);
  if (!existsSync(htmlPath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${htmlPath}`); process.exit(1);
  }

  const outputDir       = resolve(args[1] ?? dirname(htmlPath));
  const screenshotsDir  = join(outputDir, 'screenshots');
  mkdirSync(screenshotsDir, { recursive: true });

  const htmlDir  = dirname(htmlPath);
  const htmlName = basename(htmlPath);
  const port     = 18080;

  console.log(`\n🔍 레이아웃 측정 시작`);
  console.log(`   HTML: ${htmlPath}`);
  console.log(`   출력: ${outputDir}\n`);

  const stopServer = await startLocalServer(htmlDir, port);
  console.log(`✅ 로컬 서버 시작 (http://localhost:${port})`);

  const spec: Record<string, LayoutSpec> = {};

  try {
    const browser = await chromium.launch({ headless: true });
    const page    = await browser.newPage({ viewport: { width: 1280, height: 720 } });

    const url = `http://localhost:${port}/${htmlName}`;
    console.log(`📄 페이지 로드: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1500);

    // Discover slide type indices from page's slideData global
    const indices = await page.evaluate(`
      (() => {
        const data = window.slideData || [];
        const r = { title: -1, divider: -1, normal: -1 };
        for (let i = 0; i < data.length; i++) {
          const s = data[i];
          if (s.isTitleSlide   && r.title   < 0) r.title   = i;
          else if (s.isDividerSlide && r.divider < 0) r.divider = i;
          else if (!s.isTitleSlide && !s.isDividerSlide && r.normal < 0) r.normal = i;
        }
        return r;
      })()
    `) as { title: number; divider: number; normal: number };

    console.log(`\n   슬라이드 인덱스: 표지=${indices.title}, 간지=${indices.divider}, 일반=${indices.normal}`);

    const tasks: [string, number, [string, string][], string][] = [
      ['title',    indices.title,   ELEMENTS_TITLE,    '표지'],
      ['divider',  indices.divider, ELEMENTS_DIVIDER,  '간지'],
      ['standard', indices.normal,  ELEMENTS_STANDARD, '일반'],
    ];

    for (const [slideType, idx, elements, label] of tasks) {
      if (idx < 0) { console.log(`⚠️  ${label} 슬라이드 없음, 스킵`); continue; }

      console.log(`\n📐 ${label} 슬라이드 측정 (인덱스: ${idx})`);

      // Navigate to the slide
      await page.evaluate(`
        (() => {
          if (typeof renderSlide === 'function' && window.slideData) {
            renderSlide(window.slideData[${idx}]); return;
          }
          const keys = ['currentIndex', 'slideIndex', 'currentSlide'];
          for (const k of keys) {
            if (typeof window[k] !== 'undefined') {
              window[k] = ${idx};
              const renders = ['render', 'renderSlide', 'showSlide', 'update'];
              for (const r of renders) { if (typeof window[r] === 'function') { window[r](); break; } }
              return;
            }
          }
        })()
      `);
      await page.waitForTimeout(800);

      const result = await page.evaluate(MEASURE_JS, elements) as LayoutSpec;
      result._slide_index = idx;
      result._slide_type  = slideType;
      spec[slideType] = result;

      const ssPath = join(screenshotsDir, `${slideType}_slide.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      console.log(`   📸 스크린샷: screenshots/${slideType}_slide.png`);

      for (const [key, val] of Object.entries(result)) {
        if (key.startsWith('_') || val === null || typeof val !== 'object' || !('x' in val)) continue;
        const v = val as NonNullable<SlideMetric>;
        console.log(`   [${key}] x=${Math.round(v.x)}px (${(v.x_pct*100).toFixed(1)}%) y=${Math.round(v.y)}px (${(v.y_pct*100).toFixed(1)}%) w=${Math.round(v.w)}px h=${Math.round(v.h)}px font=${v.font_size}`);
      }
    }

    await browser.close();
  } finally {
    stopServer();
  }

  const jsonPath = join(outputDir, 'layout_spec.json');
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf-8');
  console.log(`\n💾 layout_spec.json 저장: ${jsonPath}`);

  const mdPath = join(outputDir, 'pdf_layout_spec.md');
  writeFileSync(mdPath, generateMd(spec, htmlPath), 'utf-8');
  console.log(`📄 pdf_layout_spec.md 저장: ${mdPath}`);

  console.log(`\n✅ 측정 완료!`);
  console.log(`   다음 단계: bun scripts/gen-slides-pdf.ts --project <project-folder>`);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
