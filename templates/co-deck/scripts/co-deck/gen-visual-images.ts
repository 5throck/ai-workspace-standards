// @version 2.1.0
// Generate right-panel visual images via SVG rendering (no browser required).
// Design principle: CSS concept diagrams → save SVG to disk → convert to PNG → use PNG in both HTML and PDF.
// Uses @resvg/resvg-js + Malgun Gothic for Korean text on Windows.
//
// Usage:
//   bun scripts/co-deck/gen-visual-images.ts --project presentations/<project>

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const args   = process.argv.slice(2);
const getArg = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

const projectArg = getArg('--project');
if (!projectArg) {
  console.error('Usage: bun scripts/co-deck/gen-visual-images.ts --project presentations/<project>');
  process.exit(1);
}

const workspaceRoot = resolve(dirname(import.meta.path), '../..');
const projectDir    = resolve(workspaceRoot, projectArg);

if (!existsSync(projectDir)) {
  console.error(`Project folder not found: ${projectDir}`);
  process.exit(1);
}

const slidedataPath = join(projectDir, 'slidedata.json');
if (!existsSync(slidedataPath)) { console.error('slidedata.json not found.'); process.exit(1); }
const slidedata: Array<Record<string, any>> = JSON.parse(readFileSync(slidedataPath, 'utf-8'));

const imagesDir = join(projectDir, 'images');
if (!existsSync(imagesDir)) mkdirSync(imagesDir, { recursive: true });

// Locate Malgun Gothic for Korean rendering
const fontCandidates = [
  'C:/Windows/Fonts/malgun.ttf',
  'C:/Windows/Fonts/HANDotum.ttf',
  '/usr/share/fonts/truetype/nanum/NanumGothic.ttf',
];
const fontPath = fontCandidates.find(existsSync);

function svgToPng(svg: string): Buffer {
  const opts: Record<string, any> = { fitTo: { mode: 'original' } };
  if (fontPath) opts.font = { fontFiles: [fontPath], loadSystemFonts: false };
  const resvg = new Resvg(svg, opts);
  return Buffer.from(resvg.render().asPng());
}

// ── Design tokens (dark amber theme) ────────────────────────────────────────
const BG        = '#0F172A';
const ACCENT    = '#D97706';
const ACCENT_L  = '#FCD34D';     // lighter amber for number text
const TEXT      = '#F1F5F9';
const TEXT_M    = 'rgba(241,245,249,0.55)';
const BORDER    = 'rgba(255,255,255,0.14)';
const RED_BG    = 'rgba(248,113,113,0.10)';
const RED_BORD  = 'rgba(248,113,113,0.35)';
const RED_TEXT  = '#FCA5A5';
const AMBER_BG  = 'rgba(217,119,6,0.10)';
const AMBER_BOR = 'rgba(217,119,6,0.40)';
const CARD_BG   = 'rgba(255,255,255,0.035)';

// Canvas: 420 × 470 (matches visual region ~0.89 aspect ratio)
const W = 420, H = 470;

function svgWrap(inner: string, w = W, h = H): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <style>
    text { font-family: "Malgun Gothic", "HAN Dotum", "Nanum Gothic", sans-serif; }
  </style>
  ${inner}
</svg>`;
}

// ── SVG generators per diagram type ─────────────────────────────────────────

function genNestedLayers(): string {
  // Concentric rounded rectangles: 환경 ⊃ 하네스 ⊃ 모델
  const layers = [
    { label: '환경  Environment', fill: 'rgba(217,119,6,0.08)', stroke: ACCENT,   rx: 20, pad: 20 },
    { label: '하네스  Harness',   fill: 'rgba(217,119,6,0.13)', stroke: ACCENT,   rx: 14, pad: 60 },
    { label: '모델  Model',       fill: 'rgba(217,119,6,0.22)', stroke: ACCENT_L, rx: 10, pad: 110 },
  ];
  let rects = '';
  let labels = '';
  for (const l of layers) {
    const x = l.pad, y = l.pad, w = W - l.pad * 2, h = H - l.pad * 2;
    rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${l.rx}" fill="${l.fill}" stroke="${l.stroke}" stroke-width="1.5"/>`;
    // label at top-left inside
    labels += `<text x="${x + 12}" y="${y + 22}" fill="${l === layers[2] ? ACCENT_L : ACCENT}" font-size="14" font-weight="700">${l.label}</text>`;
  }
  return svgWrap(rects + labels);
}

function genPillars(): string {
  const items = [
    { num: '①', name: '컨텍스트·메모리' },
    { num: '②', name: '도구·인터페이스' },
    { num: '③', name: '가드레일·거버넌스' },
    { num: '④', name: '오케스트레이션' },
  ];
  const gap = 12, margin = 24;
  const pw = (W - margin * 2 - gap * (items.length - 1)) / items.length;
  const ph = H - 80;
  let out = '';
  items.forEach((it, i) => {
    const x = margin + i * (pw + gap);
    const y = 40;
    out += `<rect x="${x}" y="${y}" width="${pw}" height="${ph}" rx="10" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>`;
    out += `<rect x="${x}" y="${y}" width="${pw}" height="4" rx="2" fill="${ACCENT}"/>`;
    out += `<text x="${x + pw / 2}" y="${y + 40}" fill="${ACCENT_L}" font-size="22" font-weight="700" text-anchor="middle">${it.num}</text>`;
    // word-wrap name at width ~pw-10
    const words = it.name.split('·');
    if (words.length === 1) {
      out += `<text x="${x + pw / 2}" y="${y + 75}" fill="${TEXT}" font-size="12" text-anchor="middle">${it.name}</text>`;
    } else {
      out += `<text x="${x + pw / 2}" y="${y + 68}" fill="${TEXT}" font-size="12" text-anchor="middle">${words[0]}·</text>`;
      out += `<text x="${x + pw / 2}" y="${y + 86}" fill="${TEXT}" font-size="12" text-anchor="middle">${words[1]}</text>`;
    }
  });
  return svgWrap(out);
}

function genOrgChart(): string {
  const boxW = 240, boxH = 44;
  const pmX = (W - boxW) / 2, pmY = 40;
  const chips = ['research', 'code', 'review', 'test', 'audit'];
  const chipW = 64, chipH = 32, chipGap = 8;
  const totalChipW = chips.length * chipW + (chips.length - 1) * chipGap;
  const chipStartX = (W - totalChipW) / 2;
  const chipY = pmY + boxH + 70;
  const noteY = chipY + chipH + 50;

  let out = '';
  // PM box
  out += `<rect x="${pmX}" y="${pmY}" width="${boxW}" height="${boxH}" rx="10" fill="${AMBER_BG}" stroke="${ACCENT}" stroke-width="1.5"/>`;
  out += `<text x="${W / 2}" y="${pmY + 27}" fill="${ACCENT_L}" font-size="14" font-weight="700" text-anchor="middle">PM / 오케스트레이터</text>`;

  // connector line
  out += `<line x1="${W / 2}" y1="${pmY + boxH}" x2="${W / 2}" y2="${chipY - 16}" stroke="${BORDER}" stroke-width="1.5"/>`;
  out += `<line x1="${chipStartX + chipW / 2}" y1="${chipY - 16}" x2="${chipStartX + totalChipW - chipW / 2}" y2="${chipY - 16}" stroke="${BORDER}" stroke-width="1.5"/>`;
  chips.forEach((_, i) => {
    const cx = chipStartX + i * (chipW + chipGap) + chipW / 2;
    out += `<line x1="${cx}" y1="${chipY - 16}" x2="${cx}" y2="${chipY}" stroke="${BORDER}" stroke-width="1.5"/>`;
  });

  // Chip boxes
  chips.forEach((c, i) => {
    const x = chipStartX + i * (chipW + chipGap);
    out += `<rect x="${x}" y="${chipY}" width="${chipW}" height="${chipH}" rx="8" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>`;
    out += `<text x="${x + chipW / 2}" y="${chipY + 20}" fill="${TEXT}" font-size="11" text-anchor="middle">${c}</text>`;
  });

  // Note
  out += `<text x="${W / 2}" y="${noteY}" fill="${TEXT_M}" font-size="11" text-anchor="middle">하위 에이전트(병렬·격리) · 게이트웨이(거버넌스)</text>`;
  return svgWrap(out);
}

function genVerificationFlow(): string {
  // Horizontal flow: 산출물 → 회의×3~5 반박 → 투표·합의 → 승인/기각
  // Use vertical layout since canvas is portrait
  const steps = [
    { label: '산출물',       sub: '',              bg: CARD_BG,   stroke: BORDER  },
    { label: '회의 ×3~5',    sub: '반박 시도',      bg: AMBER_BG,  stroke: ACCENT  },
    { label: '투표·합의',    sub: '',              bg: CARD_BG,   stroke: BORDER  },
    { label: '승인  /  기각·재작업', sub: '',      bg: CARD_BG,   stroke: BORDER  },
  ];
  const bw = W - 80, bh = 58;
  const gap = 28;
  const totalH = steps.length * bh + (steps.length - 1) * gap;
  const startY = (H - totalH) / 2;

  let out = '';
  steps.forEach((s, i) => {
    const y = startY + i * (bh + gap);
    const x = 40;
    out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${s.bg}" stroke="${s.stroke}" stroke-width="1.5"/>`;
    const textY = s.sub ? y + bh / 2 - 6 : y + bh / 2 + 5;
    out += `<text x="${W / 2}" y="${textY}" fill="${i === 1 ? ACCENT_L : TEXT}" font-size="15" font-weight="700" text-anchor="middle">${s.label}</text>`;
    if (s.sub) out += `<text x="${W / 2}" y="${y + bh / 2 + 14}" fill="${TEXT_M}" font-size="11" text-anchor="middle">${s.sub}</text>`;
    // Arrow
    if (i < steps.length - 1) {
      const ay = y + bh + 4;
      out += `<line x1="${W / 2}" y1="${ay}" x2="${W / 2}" y2="${ay + gap - 8}" stroke="${ACCENT}" stroke-width="2"/>`;
      out += `<polygon points="${W / 2 - 5},${ay + gap - 10} ${W / 2 + 5},${ay + gap - 10} ${W / 2},${ay + gap - 2}" fill="${ACCENT}"/>`;
    }
  });
  // Color the last box differently for verdict
  // Patch last box to show green/red verdict
  const ly = startY + 3 * (bh + gap);
  out += `<rect x="40" y="${ly}" width="${(bw - 16) / 2}" height="${bh}" rx="10" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.5)" stroke-width="1.5"/>`;
  out += `<text x="${40 + (bw - 16) / 4}" y="${ly + bh / 2 + 5}" fill="#86EFAC" font-size="14" font-weight="700" text-anchor="middle">승인</text>`;
  out += `<rect x="${40 + (bw - 16) / 2 + 16}" y="${ly}" width="${(bw - 16) / 2}" height="${bh}" rx="10" fill="${RED_BG}" stroke="${RED_BORD}" stroke-width="1.5"/>`;
  out += `<text x="${40 + (bw - 16) / 2 + 16 + (bw - 16) / 4}" y="${ly + bh / 2 + 5}" fill="${RED_TEXT}" font-size="14" font-weight="700" text-anchor="middle">기각·재작업</text>`;
  // Remove the generic last box (drawn before, now overridden visually)
  return svgWrap(out);
}

function genAscendingBars(): string {
  const bars = [
    { h: 0.28, label: '' },
    { h: 0.48, label: '' },
    { h: 0.70, label: '' },
    { h: 1.00, label: '' },
  ];
  const margin = 40, gap = 18;
  const maxBarH = H - 100;
  const barW = (W - margin * 2 - gap * (bars.length - 1)) / bars.length;
  const baseY = H - 50;

  let out = '';
  bars.forEach((b, i) => {
    const bh = Math.round(b.h * maxBarH);
    const x = margin + i * (barW + gap);
    const y = baseY - bh;
    // gradient-like: lighter for taller bars
    const opacity = 0.4 + b.h * 0.6;
    out += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="6" fill="${ACCENT}" opacity="${opacity.toFixed(2)}"/>`;
  });
  // Trend arrow
  const startX = margin + barW / 2;
  const endX   = margin + 3 * (barW + gap) + barW / 2;
  const startY2 = baseY - bars[0].h * maxBarH - 10;
  const endY2   = baseY - bars[3].h * maxBarH - 10;
  out += `<line x1="${startX}" y1="${startY2}" x2="${endX}" y2="${endY2}" stroke="${ACCENT_L}" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/>`;
  return svgWrap(out);
}

function genUsecaseTable(): string {
  const rows = [
    { k: '코드',   v: '구현·리팩터·마이그레이션·테스트' },
    { k: '리서치', v: '다중소스 조사 + 인용 + 교차검증' },
    { k: '문서',   v: 'API·체인지로그·온보딩 동기화' },
    { k: '감사',   v: '전수 감사·보안 리뷰·컴플라이언스' },
    { k: '운영',   v: '반복 워크플로 자동화(dev-sync 등)' },
  ];
  const margin = 24, headH = 34, rowH = 60;
  const totalH = headH + rows.length * rowH + 4;
  const startY = (H - totalH) / 2;
  const keyW = 90, valW = W - margin * 2 - keyW - 8;

  let out = '';
  // Header row
  out += `<rect x="${margin}" y="${startY}" width="${W - margin * 2}" height="${headH}" rx="6" fill="${AMBER_BG}" stroke="${ACCENT}" stroke-width="1"/>`;
  out += `<text x="${margin + 12}" y="${startY + 22}" fill="${ACCENT_L}" font-size="12" font-weight="700">영역</text>`;
  out += `<text x="${margin + keyW + 20}" y="${startY + 22}" fill="${ACCENT_L}" font-size="12" font-weight="700">에이전트 팀이 하는 일</text>`;

  rows.forEach((r, i) => {
    const y = startY + headH + 4 + i * rowH;
    const rowBg = i % 2 === 0 ? CARD_BG : 'rgba(255,255,255,0.015)';
    out += `<rect x="${margin}" y="${y}" width="${W - margin * 2}" height="${rowH - 4}" rx="6" fill="${rowBg}" stroke="${BORDER}" stroke-width="1"/>`;
    // Key
    out += `<rect x="${margin}" y="${y}" width="${keyW}" height="${rowH - 4}" rx="6" fill="${AMBER_BG}" stroke="${ACCENT}" stroke-width="1"/>`;
    out += `<text x="${margin + keyW / 2}" y="${y + (rowH - 4) / 2 + 5}" fill="${ACCENT_L}" font-size="13" font-weight="700" text-anchor="middle">${r.k}</text>`;
    // Value - simple word wrap at ~26 chars
    const parts = r.v.length > 22 ? [r.v.slice(0, r.v.lastIndexOf('·', 22) + 1), r.v.slice(r.v.lastIndexOf('·', 22) + 1)] : [r.v];
    if (parts.length === 1 || parts[1] === '') {
      out += `<text x="${margin + keyW + 12}" y="${y + (rowH - 4) / 2 + 5}" fill="${TEXT}" font-size="11">${parts[0]}</text>`;
    } else {
      out += `<text x="${margin + keyW + 12}" y="${y + (rowH - 4) / 2 - 4}" fill="${TEXT}" font-size="11">${parts[0]}</text>`;
      out += `<text x="${margin + keyW + 12}" y="${y + (rowH - 4) / 2 + 12}" fill="${TEXT}" font-size="11">${parts[1]}</text>`;
    }
  });
  return svgWrap(out);
}

function genRoadmap(): string {
  const stages = [
    { num: '①', name: 'Pilot',      desc: '1~2팀 · 베이스라인 측정' },
    { num: '②', name: 'Scale',      desc: '역할·게이트 코드화' },
    { num: '③', name: 'Enterprise', desc: '전사 통제·자가개선' },
  ];
  const margin = 24, arrowW = 30;
  const stageW = (W - margin * 2 - arrowW * (stages.length - 1)) / stages.length;
  const stageH = H - 100;
  const startY = 50;

  let out = '';
  stages.forEach((s, i) => {
    const x = margin + i * (stageW + arrowW);
    const y = startY;
    out += `<rect x="${x}" y="${y}" width="${stageW}" height="${stageH}" rx="10" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>`;
    out += `<rect x="${x}" y="${y}" width="${stageW}" height="4" rx="2" fill="${ACCENT}"/>`;
    out += `<text x="${x + stageW / 2}" y="${y + 40}" fill="${ACCENT_L}" font-size="20" font-weight="700" text-anchor="middle">${s.num}</text>`;
    out += `<text x="${x + stageW / 2}" y="${y + 70}" fill="${TEXT}" font-size="14" font-weight="700" text-anchor="middle">${s.name}</text>`;
    // desc wrap
    const words = s.desc.split('·');
    if (words.length <= 1) {
      out += `<text x="${x + stageW / 2}" y="${y + 95}" fill="${TEXT_M}" font-size="11" text-anchor="middle">${s.desc}</text>`;
    } else {
      out += `<text x="${x + stageW / 2}" y="${y + 92}" fill="${TEXT_M}" font-size="11" text-anchor="middle">${words[0]}·</text>`;
      out += `<text x="${x + stageW / 2}" y="${y + 108}" fill="${TEXT_M}" font-size="11" text-anchor="middle">${words.slice(1).join('·')}</text>`;
    }
    // Arrow
    if (i < stages.length - 1) {
      const ax = x + stageW + 4, ay = startY + stageH / 2;
      out += `<line x1="${ax}" y1="${ay}" x2="${ax + arrowW - 10}" y2="${ay}" stroke="${ACCENT}" stroke-width="2"/>`;
      out += `<polygon points="${ax + arrowW - 12},${ay - 5} ${ax + arrowW - 2},${ay} ${ax + arrowW - 12},${ay + 5}" fill="${ACCENT}"/>`;
    }
  });
  return svgWrap(out);
}

function genRiskTable(): string {
  const rows = [
    { risk: '비용',         guard: '3-티어 모델 · 예산 상한' },
    { risk: '보안',         guard: '샌드박스 · 권한 · 시크릿 스캔' },
    { risk: '품질·거버넌스', guard: '검증 루프 · 승인 게이트 · 감사' },
  ];
  const margin = 24, rowH = 72, gap = 14;
  const totalH = rows.length * rowH + (rows.length - 1) * gap;
  const startY = (H - totalH) / 2;
  const riskW = 110, arrowW = 32;
  const guardW = W - margin * 2 - riskW - arrowW;

  let out = '';
  rows.forEach((r, i) => {
    const y = startY + i * (rowH + gap);
    // Risk cell
    out += `<rect x="${margin}" y="${y}" width="${riskW}" height="${rowH}" rx="8" fill="${RED_BG}" stroke="${RED_BORD}" stroke-width="1.5"/>`;
    out += `<text x="${margin + riskW / 2}" y="${y + rowH / 2 + 5}" fill="${RED_TEXT}" font-size="14" font-weight="700" text-anchor="middle">${r.risk}</text>`;
    // Arrow
    const ax = margin + riskW + 4, ay = y + rowH / 2;
    out += `<line x1="${ax}" y1="${ay}" x2="${ax + arrowW - 8}" y2="${ay}" stroke="${ACCENT}" stroke-width="2"/>`;
    out += `<polygon points="${ax + arrowW - 10},${ay - 4} ${ax + arrowW},${ay} ${ax + arrowW - 10},${ay + 4}" fill="${ACCENT}"/>`;
    // Guard cell
    const gx = margin + riskW + arrowW;
    out += `<rect x="${gx}" y="${y}" width="${guardW}" height="${rowH}" rx="8" fill="${AMBER_BG}" stroke="${AMBER_BOR}" stroke-width="1.5"/>`;
    // wrap guard text
    const words = r.guard.split('·');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + '·' + w : w;
      if (next.length > 14 && cur) { lines.push(cur + '·'); cur = w; }
      else cur = next;
    }
    if (cur) lines.push(cur);
    const lineH = 16;
    const totalLH = lines.length * lineH;
    lines.forEach((l, li) => {
      const ty = y + rowH / 2 - totalLH / 2 + li * lineH + 12;
      out += `<text x="${gx + guardW / 2}" y="${ty}" fill="${TEXT}" font-size="12" text-anchor="middle">${l}</text>`;
    });
  });
  return svgWrap(out);
}

function genCards3(): string {
  // 3 horizontal cards (landscape-ish layout but in portrait canvas)
  const cards = [
    { num: '①', text: '레버리지는 모델이 아니라 하네스에 있다' },
    { num: '②', text: '에이전트 하나가 아니라 팀이다 — 역할 + 검증' },
    { num: '③', text: '작게 시작하되, 하네스부터 세팅하라' },
  ];
  const margin = 20, gap = 14;
  const cardW = (W - margin * 2 - gap * (cards.length - 1)) / cards.length;
  const cardH = H - 80;
  const startY = 40;

  let out = '';
  cards.forEach((c, i) => {
    const x = margin + i * (cardW + gap);
    out += `<rect x="${x}" y="${startY}" width="${cardW}" height="${cardH}" rx="10" fill="${CARD_BG}" stroke="${BORDER}" stroke-width="1"/>`;
    out += `<rect x="${x}" y="${startY}" width="3" height="${cardH}" rx="2" fill="${ACCENT}"/>`;
    out += `<text x="${x + cardW / 2}" y="${startY + 44}" fill="${ACCENT_L}" font-size="24" font-weight="700" text-anchor="middle">${c.num}</text>`;
    // Word-wrap text to ~cardW-12 width (approximately 10 chars per line at font-size 11)
    const charsPerLine = Math.floor((cardW - 16) / 8);
    const words = c.text.split('');
    const lines: string[] = [];
    let cur = '';
    for (const ch of words) {
      if (cur.length >= charsPerLine && ch === ' ') { lines.push(cur); cur = ''; }
      else cur += ch;
    }
    // Better: split at known break points
    const textLines = wrapText(c.text, charsPerLine);
    textLines.forEach((l, li) => {
      out += `<text x="${x + cardW / 2}" y="${startY + 72 + li * 18}" fill="${TEXT}" font-size="11.5" text-anchor="middle">${l}</text>`;
    });
  });
  return svgWrap(out);
}

function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  // Try to break at — or spaces
  const breakPoints = [' — ', ' ', '—', '·'];
  for (const bp of breakPoints) {
    const idx = text.indexOf(bp, Math.floor(maxChars * 0.4));
    if (idx > 0 && idx <= maxChars + bp.length) {
      const first = text.slice(0, idx + (bp === ' ' ? 0 : bp.length));
      const rest  = text.slice(idx + (bp === ' ' ? 1 : bp.length));
      return [first.trim(), ...wrapText(rest.trim(), maxChars)];
    }
  }
  // Hard split
  return [text.slice(0, maxChars), ...wrapText(text.slice(maxChars), maxChars)];
}

// ── Diagram registry ─────────────────────────────────────────────────────────

type GenFn = () => string;

// Maps visualImage filename stem → generator
const GENERATORS: Record<string, GenFn> = {
  'slide-03-nested-layers': genNestedLayers,
  'slide-05-4pillars':      genPillars,
  'slide-08-org-chart':     genOrgChart,
  'slide-09-verification-flow': genVerificationFlow,
  'slide-11-ascending-bars':    genAscendingBars,
  'slide-13-usecase-table':     genUsecaseTable,
  'slide-15-roadmap':           genRoadmap,
  'slide-17-risk-table':        genRiskTable,
  'slide-19-3cards':            genCards3,
};

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🎨 Visual image generation (SVG → PNG, no browser)`);
if (fontPath) console.log(`   Font   : ${fontPath}`);
else          console.log(`   Font   : system default (Korean may not render)`);

const targets = slidedata
  .map((s, i) => ({ slide: i + 1, data: s }))
  .filter(({ data }) => data.visualImage && data.visual && data.visual.toLowerCase() !== 'none');

console.log(`   Targets: ${targets.length} slides\n`);

let success = 0, skipped = 0;
for (const { slide, data } of targets) {
  const imgPath  = data.visualImage as string;           // e.g. "images/slide-03-nested-layers.png"
  const stem     = imgPath.replace(/^images\//, '').replace(/\.png$/, '');
  const destPath = join(projectDir, imgPath);

  const gen = GENERATORS[stem];
  if (!gen) {
    console.log(`   ⚠️  Slide ${slide}: no generator for "${stem}", skipping`);
    skipped++;
    continue;
  }

  try {
    const svg = gen();
    const svgPath = destPath.replace(/\.png$/, '.svg');
    writeFileSync(svgPath, svg, 'utf-8');  // save SVG source artifact
    const png = svgToPng(svg);
    writeFileSync(destPath, png);
    console.log(`   ✅  Slide ${slide} → ${imgPath} (${Math.round(png.length / 1024)}KB) + .svg`);
    success++;
  } catch (e) {
    console.error(`   ❌  Slide ${slide}: ${(e as Error).message}`);
  }
}

console.log(`\n✅ Done: ${success} generated, ${skipped} skipped`);
console.log(`   Re-run PDF: bun scripts/co-deck/gen-slides-pdf.ts --project ${projectArg}\n`);
