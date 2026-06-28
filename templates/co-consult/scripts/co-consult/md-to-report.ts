// @version 1.0.0 — Markdown → DOCX/PDF consulting report generator.
//   Converts Markdown deliverables to professionally formatted Word and PDF reports
//   with cover page, TOC, headers/footers, and consulting-style design.
//
//   v1.0.0: Initial release — DOCX + PDF dual output, frontmatter metadata,
//           consulting theme (navy blue), Pretendard font, TOC generation.

import {
  Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak,
  Header as DocxHeader, Footer as DocxFooter, PageNumber, NumberFormat,
  TableOfContents as DocxToc, BorderStyle, ShadingType,
  convertInchesToTwip, TabStopPosition, TabStopType,
} from 'docx';
import {
  PDFDocument, PDFFont, rgb, pushGraphicsState, popGraphicsState,
  StandardFonts,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'fs';
import { join, resolve, dirname, basename, extname } from 'path';
import { platform, homedir } from 'os';
import { parse as parseYaml } from 'yaml';

// ─── Types ───────────────────────────────────────────────────────────────────────

interface ReportMeta {
  title: string;
  date: string;
  author: string;
  client: string;
  confidential: boolean;
}

// ─── Theme ───────────────────────────────────────────────────────────────────────

const THEME = {
  primary:    '#003366',
  body:       '#333333',
  subtle:     '#666666',
  light:      '#f5f7fa',
  white:      '#FFFFFF',
  divider:    '#cccccc',
  codeBg:     '#f4f4f4',
  margin: {
    top:    convertInchesToTwip(1),
    bottom: convertInchesToTwip(1),
    left:   convertInchesToTwip(1),
    right:  convertInchesToTwip(1),
  },
} as const;

// ─── Frontmatter Parser ─────────────────────────────────────────────────────────

function parseFrontmatter(raw: string): { meta: Partial<ReportMeta>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
  const meta: Partial<ReportMeta> = {
    title:        typeof frontmatter.title === 'string' ? frontmatter.title : undefined,
    date:         typeof frontmatter.date === 'string' ? String(frontmatter.date) : undefined,
    author:       typeof frontmatter.author === 'string' ? frontmatter.author : undefined,
    client:       typeof frontmatter.client === 'string' ? frontmatter.client : undefined,
    confidential: frontmatter.confidential === true,
  };
  return { meta, body: match[2] };
}

// ─── Markdown Parser ────────────────────────────────────────────────────────────

interface HeadingNode { type: 'heading'; depth: number; children: Array<{ value: string }>; position?: { start: { line: number } } }
interface TextNode { type: 'text'; value: string }
interface ParagraphNode { type: 'paragraph'; children: Array<TextNode | InlineNode>; position?: { start: { line: number } } }
interface BlockquoteNode { type: 'blockquote'; children: Array<ParagraphNode> }
interface ListNode { type: 'list'; ordered: boolean; children: Array<{ children: Array<ParagraphNode> }> }
interface TableNode { type: 'table'; children: Array<{ type: 'tableRow'; children: Array<{ type: 'tableCell'; children: Array<TextNode> }> }> }
interface CodeNode { type: 'code'; lang?: string; value: string; meta?: string }
interface ThematicBreakNode { type: 'thematicBreak' }
interface InlineNode { type: 'strong' | 'emphasis' | 'inlineCode' | 'link'; value?: string; url?: string; children?: Array<TextNode | InlineNode> }

type MdastNode = HeadingNode | ParagraphNode | BlockquoteNode | ListNode | TableNode | CodeNode | ThematicBreakNode;

function extractText(node: TextNode | InlineNode | { children?: Array<TextNode | InlineNode> } | { value?: string } | undefined): string {
  if (!node) return '';
  if ('value' in node && typeof node.value === 'string') return node.value;
  if ('children' in node && Array.isArray(node.children)) return node.children.map(extractText).join('');
  return '';
}

function extractReportMeta(ast: { children: MdastNode[] }, filePath: string): ReportMeta {
  const firstH1 = ast.children.find((n): n is HeadingNode => n.type === 'heading' && n.depth === 1);
  const title = firstH1 ? extractText(firstH1) : basename(filePath, '.md');
  const stat = statSync(filePath);
  const dateStr = stat.mtime.toISOString().slice(0, 10);
  return { title, date: dateStr, author: '', client: '', confidential: false };
}

function mergeMeta(frontmatter: Partial<ReportMeta>, extracted: ReportMeta): ReportMeta {
  return {
    title:        frontmatter.title ?? extracted.title,
    date:         frontmatter.date ?? extracted.date,
    author:       frontmatter.author ?? extracted.author,
    client:       frontmatter.client ?? extracted.client,
    confidential: frontmatter.confidential ?? extracted.confidential,
  };
}

// ─── Font Resolution ─────────────────────────────────────────────────────────────

const FONT_FAMILIES: Array<[string, string]> = [
  ['Pretendard-Regular.ttf', 'Pretendard-Bold.ttf'],
  ['MaruBuri-Regular.ttf',   'MaruBuri-Bold.ttf'],
];

const sysFontDirs: string[] = (() => {
  const p = platform();
  const home = homedir();
  if (p === 'win32') return ['C:/Windows/Fonts'];
  if (p === 'darwin') return [join(home, 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
  return [join(home, '.local/share/fonts'), '/usr/share/fonts/truetype', '/usr/share/fonts'];
})();

function resolveFont(fontDir: string): { regular: string; bold: string } {
  let fontR = '', fontB = '';
  for (const [r, b] of FONT_FAMILIES) {
    for (const dir of [fontDir, ...sysFontDirs]) {
      const rp = join(dir, r), bp = join(dir, b);
      if (existsSync(rp) && existsSync(bp)) { fontR = rp; fontB = bp; break; }
    }
    if (fontR) break;
  }
  if (!fontR) {
    console.warn('⚠️  Pretendard/MaruBuri fonts not found — falling back to system defaults');
    return { regular: '', bold: '' };
  }
  return { regular: fontR, bold: fontB };
}

// ─── TOC Heading Collector ───────────────────────────────────────────────────────

interface TocEntry { text: string; depth: number; index: string }

function collectTocEntries(ast: { children: MdastNode[] }): TocEntry[] {
  const entries: TocEntry[] = [];
  const counters: number[] = [0, 0, 0];
  for (const node of ast.children) {
    if (node.type === 'heading' && node.depth >= 1 && node.depth <= 3) {
      const d = node.depth - 1;
      counters[d - 1] = (counters[d - 1] ?? 0) + 1;
      for (let i = d; i < counters.length; i++) counters[i] = 0;
      const index = counters.slice(0, d).join('.');
      entries.push({ text: extractText(node), depth: node.depth, index });
    }
  }
  return entries;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCX Renderer
// ═══════════════════════════════════════════════════════════════════════════════

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function colorOf(hex: string) { return hex; }

async function renderDocx(
  ast: { children: MdastNode[] },
  meta: ReportMeta,
  outPath: string,
  fontDir: string,
): Promise<void> {
  const themeRgb = {
    primary: hexToRgb(THEME.primary),
    subtle:  hexToRgb(THEME.subtle),
    body:    hexToRgb(THEME.body),
    light:   hexToRgb(THEME.light),
    divider: hexToRgb(THEME.divider),
  };

  // ── Sections ──
  const sections: Array<{
    properties: Record<string, unknown>;
    children: Paragraph[];
  }> = [];

  // ── Cover Page Section ──
  const coverChildren: Paragraph[] = [
    // Spacer
    new Paragraph({ spacing: { before: 4000 }, children: [] }),
    // Navy accent bar (simulated with a colored paragraph)
    new Paragraph({
      spacing: { after: 600 },
      children: [
        new TextRun({
          text: '████████████████████████████████████████████████████████',
          color: THEME.primary,
          size: 24,
          font: 'Consolas',
        }),
      ],
    }),
    // Title
    new Paragraph({
      spacing: { after: 300 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: meta.title,
          bold: true,
          size: 56,
          color: THEME.primary,
          font: 'Pretendard',
        }),
      ],
    }),
    // Spacer
    new Paragraph({ spacing: { before: 600 }, children: [] }),
    // Author
    ...(meta.author ? [new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: meta.author, size: 28, color: THEME.subtle, font: 'Pretendard' }),
      ],
    })] : []),
    // Date
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: meta.date, size: 28, color: THEME.subtle, font: 'Pretendard' }),
      ],
    }),
    // Client
    ...(meta.client ? [new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: `Client: ${meta.client}`, size: 24, color: THEME.subtle, font: 'Pretendard' }),
      ],
    })] : []),
  ];

  sections.push({
    properties: {
      page: {
        margin: THEME.margin,
        size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
      },
    },
    children: coverChildren,
  });

  // ── Body Section (with header/footer) ──
  const bodyChildren: Paragraph[] = [];

  // TOC
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'Table of Contents', bold: true, size: 40, color: THEME.primary, font: 'Pretendard' })],
    }),
  );
  bodyChildren.push(
    new DocxToc('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
      stylesWithLevels: [
        { styleName: 'Heading 1', level: 1 },
        { styleName: 'Heading 2', level: 2 },
        { styleName: 'Heading 3', level: 3 },
      ],
    }),
  );
  // Page break after TOC
  bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // Content — walk AST
  const skipFirstH1 = true;
  for (const node of ast.children) {
    const paras = renderDocxNode(node, skipFirstH1, ast.children.indexOf(node) === 0);
    bodyChildren.push(...paras);
  }

  const footerText = meta.confidential ? 'CONFIDENTIAL' : '';

  sections.push({
    properties: {
      page: {
        margin: THEME.margin,
        size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
      },
    },
    headers: {
      default: new DocxHeader({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: meta.title, size: 16, color: THEME.subtle, font: 'Pretendard' }),
              new TextRun({ text: '\t' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: THEME.primary, font: 'Pretendard' }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new DocxFooter({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: meta.date, size: 16, color: THEME.subtle, font: 'Pretendard' }),
              new TextRun({ text: footerText ? '\t' : '' }),
              ...(footerText ? [new TextRun({ text: footerText, size: 16, color: THEME.primary, font: 'Pretendard', bold: true })] : []),
            ],
          }),
        ],
      }),
    },
    children: bodyChildren,
  });

  const doc = new DocxDocument({
    styles: {
      default: {
        document: {
          run: { font: 'Pretendard', size: 22, color: THEME.body },
          paragraph: { spacing: { line: 360 } },
        },
        heading1: { run: { font: 'Pretendard', size: 44, color: THEME.primary, bold: true }, paragraph: { spacing: { before: 400, after: 200 } } },
        heading2: { run: { font: 'Pretendard', size: 32, color: THEME.primary, bold: true }, paragraph: { spacing: { before: 300, after: 150 } } },
        heading3: { run: { font: 'Pretendard', size: 26, color: THEME.primary, bold: true }, paragraph: { spacing: { before: 200, after: 100 } } },
      },
    },
    sections,
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(outPath, buffer);
}

function renderDocxNode(node: MdastNode, skipFirstH1: boolean, isFirstNode: boolean): Paragraph[] {
  const paras: Paragraph[] = [];

  if (node.type === 'heading') {
    if (node.depth === 1 && (skipFirstH1 || isFirstNode)) return paras; // skip first H1 (used for cover)

    const headingLevels: Record<number, typeof HeadingLevel.HEADING_1> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    };
    const level = headingLevels[node.depth] ?? HeadingLevel.HEADING_3;
    paras.push(new Paragraph({
      heading: level,
      children: [new TextRun({ text: extractText(node), bold: true, font: 'Pretendard', color: THEME.primary })],
    }));
  }

  else if (node.type === 'paragraph') {
    const runs = renderDocxInline(node.children);
    paras.push(new Paragraph({ children: runs }));
  }

  else if (node.type === 'blockquote') {
    for (const child of node.children) {
      if (child.type === 'paragraph') {
        paras.push(new Paragraph({
          indent: { left: convertInchesToTwip(0.3) },
          spacing: { before: 100, after: 100 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: THEME.primary, space: 8 },
          },
          children: [
            new TextRun({ text: extractText(child), italics: true, font: 'Pretendard', color: THEME.subtle, size: 22 }),
          ],
        }));
      }
    }
  }

  else if (node.type === 'list') {
    for (const item of node.children) {
      for (const para of item.children) {
        const bulletChar = node.ordered ? '' : '• ';
        const runs = renderDocxInline(para.children);
        // Prepend bullet/number
        if (node.ordered) {
          const idx = node.children.indexOf(item) + 1;
          runs.unshift(new TextRun({ text: `${idx}. `, font: 'Pretendard', color: THEME.body, size: 22 }));
        } else {
          runs.unshift(new TextRun({ text: bulletChar, font: 'Pretendard', color: THEME.primary, size: 22 }));
        }
        paras.push(new Paragraph({
          indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
          spacing: { before: 40, after: 40 },
          children: runs,
        }));
      }
    }
  }

  else if (node.type === 'table') {
    const rows = node.children;
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      const cells: TableCell[] = row.children.map(cell => {
        const isHeader = ri === 0;
        const isAlt = ri > 0 && ri % 2 === 0;
        return new TableCell({
          shading: isHeader
            ? { type: ShadingType.SOLID, color: THEME.primary, fill: THEME.primary }
            : isAlt
              ? { type: ShadingType.SOLID, color: THEME.light, fill: THEME.light }
              : undefined,
          width: { size: Math.floor(9000 / row.children.length), type: WidthType.DXA },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [
                new TextRun({
                  text: extractText(cell),
                  bold: isHeader,
                  color: isHeader ? THEME.white : THEME.body,
                  size: isHeader ? 20 : 20,
                  font: 'Pretendard',
                }),
              ],
            }),
          ],
        });
      });
      paras.push(new Paragraph({
        children: [new TextRun({ text: '', break: 1 })], // force paragraph before table
      })); // Table must be in its own paragraph wrapper
      paras.push(new Paragraph({ children: [] as unknown as TextRun[], table: new Table({ rows: [new TableRow({ children: cells })] }) as unknown as Paragraph }));
    }
  }

  else if (node.type === 'code') {
    paras.push(new Paragraph({
      spacing: { before: 100, after: 100 },
      shading: { type: ShadingType.SOLID, color: THEME.codeBg, fill: THEME.codeBg },
      children: [
        new TextRun({ text: node.value || '', font: 'Consolas', size: 18, color: THEME.body }),
      ],
    }));
  }

  else if (node.type === 'thematicBreak') {
    paras.push(new Paragraph({
      spacing: { before: 200, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: THEME.primary, space: 4 } },
      children: [],
    }));
  }

  return paras;
}

function renderDocxInline(children: Array<TextNode | InlineNode>): TextRun[] {
  const runs: TextRun[] = [];
  for (const child of children) {
    if ('value' in child && typeof child.value === 'string') {
      runs.push(new TextRun({ text: child.value, font: 'Pretendard', color: THEME.body, size: 22 }));
    } else if ('children' in child && Array.isArray(child.children)) {
      if (child.type === 'strong') {
        const text = extractText(child);
        runs.push(new TextRun({ text, bold: true, font: 'Pretendard', color: THEME.body, size: 22 }));
      } else if (child.type === 'emphasis') {
        const text = extractText(child);
        runs.push(new TextRun({ text, italics: true, font: 'Pretendard', color: THEME.body, size: 22 }));
      } else if (child.type === 'inlineCode') {
        const text = extractText(child);
        runs.push(new TextRun({ text, font: 'Consolas', size: 20, color: THEME.body, shading: { type: ShadingType.SOLID, color: THEME.codeBg, fill: THEME.codeBg } }));
      } else {
        runs.push(...renderDocxInline(child.children));
      }
    }
  }
  return runs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PDF Renderer
// ═══════════════════════════════════════════════════════════════════════════════

async function renderPdf(
  ast: { children: MdastNode[] },
  meta: ReportMeta,
  outPath: string,
  fontDir: string,
): Promise<void> {
  const fonts = resolveFont(fontDir);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Embed fonts
  let regularFont: PDFFont, boldFont: PDFFont;
  if (fonts.regular) {
    regularFont = await pdfDoc.embedFont(readFileSync(fonts.regular));
    boldFont = await pdfDoc.embedFont(readFileSync(fonts.bold));
  } else {
    regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    console.warn('⚠️  Using Helvetica fallback (no Pretendard found)');
  }

  const primaryRgb = hexToRgb(THEME.primary);
  const bodyRgb = hexToRgb(THEME.body);
  const subtleRgb = hexToRgb(THEME.subtle);
  const lightRgb = hexToRgb(THEME.light);
  const dividerRgb = hexToRgb(THEME.divider);
  const codeBgRgb = hexToRgb(THEME.codeBg);

  const PAGE_W = 612;  // 8.5in × 72
  const PAGE_H = 792;  // 11in × 72
  const M = 72;        // 1in margins
  const CW = PAGE_W - M * 2;  // content width

  // ── Cover Page ──
  const cover = pdfDoc.addPage([PAGE_W, PAGE_H]);
  // Navy accent bar
  cover.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: rgb(primaryRgb.r / 255, primaryRgb.g / 255, primaryRgb.b / 255) });

  let y = PAGE_H - 200;
  // Title
  regularFont.fontSize = 28;
  const titleLines = wrapText(meta.title, regularFont, CW);
  for (const line of titleLines) {
    cover.drawText(line, { x: M, y, size: 28, font: boldFont, color: rgb(primaryRgb.r / 255, primaryRgb.g / 255, primaryRgb.b / 255) });
    y -= 36;
  }

  y -= 40;
  // Author
  if (meta.author) {
    cover.drawText(meta.author, { x: M, y, size: 14, font: regularFont, color: rgb(subtleRgb.r / 255, subtleRgb.g / 255, subtleRgb.b / 255) });
    y -= 24;
  }
  // Date
  cover.drawText(meta.date, { x: M, y, size: 14, font: regularFont, color: rgb(subtleRgb.r / 255, subtleRgb.g / 255, subtleRgb.b / 255) });
  y -= 24;
  // Client
  if (meta.client) {
    cover.drawText(`Client: ${meta.client}`, { x: M, y, size: 12, font: regularFont, color: rgb(subtleRgb.r / 255, subtleRgb.g / 255, subtleRgb.b / 255) });
  }

  // ── TOC Page ──
  const tocEntries = collectTocEntries(ast);
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let pageNum = 2; // cover is page 1, TOC is page 2

  // TOC header
  y = PAGE_H - M;
  page.drawText('Table of Contents', { x: M, y, size: 22, font: boldFont, color: rgb(primaryRgb.r / 255, primaryRgb.g / 255, primaryRgb.b / 255) });
  y -= 40;

  for (const entry of tocEntries) {
    if (y < M + 40) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); pageNum++; y = PAGE_H - M; }
    const indent = (entry.depth - 1) * 20;
    const text = `${entry.index}  ${entry.text}`;
    const textW = boldFont.widthOfTextAtSize(text, 12);
    page.drawText(text, { x: M + indent, y, size: 12, font: regularFont, color: rgb(bodyRgb.r / 255, bodyRgb.g / 255, bodyRgb.b / 255) });

    // Dotted leader
    const dotStart = M + indent + textW + 5;
    const dotEnd = PAGE_W - M - 40;
    if (dotEnd > dotStart) {
      let dx = dotStart;
      while (dx < dotEnd) {
        page.drawText('.', { x: dx, y, size: 12, font: regularFont, color: rgb(dividerRgb.r / 255, dividerRgb.g / 255, dividerRgb.b / 255) });
        dx += regularFont.widthOfTextAtSize('.', 12) + 2;
      }
    }
  }

  y -= 30;
  // Page break after TOC
  page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pageNum++;
  y = PAGE_H - M;

  // ── Body Pages ──
  let isFirstH1 = true;
  for (const node of ast.children) {
    if (node.type === 'heading' && node.depth === 1 && isFirstH1) {
      isFirstH1 = false;
      continue; // skip first H1 (cover title)
    }

    const result = renderPdfNode(node, page, pdfDoc, regularFont, boldFont, M, CW, y, {
      primaryRgb, bodyRgb, subtleRgb, lightRgb, dividerRgb, codeBgRgb,
    });

    if ('newPage' in result && result.newPage) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - M;
      const rerender = renderPdfNode(node, page, pdfDoc, regularFont, boldFont, M, CW, y, {
        primaryRgb, bodyRgb, subtleRgb, lightRgb, dividerRgb, codeBgRgb,
      });
      y = ('y' in rerender ? rerender.y : y) - 10;
    } else {
      y = ('y' in result ? result.y : y) - 10;
    }

    // Check if we need a new page
    if (y < M + 40) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      pageNum++;
      y = PAGE_H - M;
    }
  }

  // ── Add headers/footers to all body pages (skip cover) ──
  const totalPages = pdfDoc.getPageCount();
  for (let i = 1; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    const { height } = p.getSize();

    // Header
    p.drawRectangle({ x: 0, y: height - 30, width: PAGE_W, height: 30, color: rgb(primaryRgb.r / 255, primaryRgb.g / 255, primaryRgb.b / 255) });
    const titleW = boldFont.widthOfTextAtSize(meta.title, 9);
    p.drawText(meta.title.slice(0, 60), { x: M, y: height - 22, size: 9, font: regularFont, color: rgb(1, 1, 1) });
    p.drawText(String(i + 1), { x: PAGE_W - M - 20, y: height - 22, size: 9, font: regularFont, color: rgb(1, 1, 1) });

    // Footer
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 25, color: rgb(dividerRgb.r / 255, dividerRgb.g / 255, dividerRgb.b / 255) });
    p.drawText(meta.date, { x: M, y: 8, size: 8, font: regularFont, color: rgb(subtleRgb.r / 255, subtleRgb.g / 255, subtleRgb.b / 255) });
    if (meta.confidential) {
      const confW = boldFont.widthOfTextAtSize('CONFIDENTIAL', 9);
      p.drawText('CONFIDENTIAL', { x: PAGE_W - M - confW, y: 8, size: 9, font: boldFont, color: rgb(primaryRgb.r / 255, primaryRgb.g / 255, primaryRgb.b / 255) });
    }
  }

  const pdfBytes = await pdfDoc.save();
  writeFileSync(outPath, pdfBytes);
  const sizeKb = Math.round(pdfBytes.length / 1024);
  console.log(`   Saved -> ${outPath} (${sizeKb}KB)`);
}

function sanitizeText(text: string): string {
  return text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Replace common Unicode arrows/symbols with ASCII equivalents for PDF (WinAnsi limitation)
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    .replace(/…/g, '...')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≈/g, '~')
    .replace(/≠/g, '!=')
    .replace(/×/g, 'x')
    .replace(/°/g, ' deg')
    // Strip any remaining non-WinAnsi characters
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function wrapText(text: string, font: PDFFont, maxWidth: number): string[] {
  const words = sanitizeText(text).split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, 12) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function renderPdfNode(
  node: MdastNode,
  page: Awaited<ReturnType<typeof PDFDocument.prototype.addPage>>,
  pdfDoc: PDFDocument,
  regularFont: PDFFont,
  boldFont: PDFFont,
  margin: number,
  contentWidth: number,
  startY: number,
  colors: { primaryRgb: { r: number; g: number; b: number }; bodyRgb: { r: number; g: number; b: number }; subtleRgb: { r: number; g: number; b: number }; lightRgb: { r: number; g: number; b: number }; dividerRgb: { r: number; g: number; b: number }; codeBgRgb: { r: number; g: number; b: number } },
): { y: number; newPage?: boolean } {
  let y = startY;
  const pR = colors.primaryRgb, bR = colors.bodyRgb, sR = colors.subtleRgb, lR = colors.lightRgb, dR = colors.dividerRgb, cR = colors.codeBgRgb;

  if (node.type === 'heading') {
    const text = extractText(node);
    const sizes: Record<number, number> = { 1: 22, 2: 16, 3: 13 };
    const size = sizes[node.depth] ?? 13;
    const font = boldFont;
    const lines = wrapText(text, font, contentWidth);

    y -= (node.depth === 1 ? 20 : 12);
    for (const line of lines) {
      if (y < margin + 20) return { y, newPage: true };
      page.drawText(line, { x: margin, y, size, font, color: rgb(pR.r / 255, pR.g / 255, pR.b / 255) });
      y -= size + 4;
    }
    return { y };
  }

  if (node.type === 'paragraph') {
    const text = extractText(node);
    const lines = wrapText(text, regularFont, contentWidth);
    for (const line of lines) {
      if (y < margin + 20) return { y, newPage: true };
      page.drawText(line, { x: margin, y, size: 11, font: regularFont, color: rgb(bR.r / 255, bR.g / 255, bR.b / 255) });
      y -= 18;
    }
    return { y };
  }

  if (node.type === 'blockquote') {
    for (const child of node.children) {
      if (child.type === 'paragraph') {
        const text = extractText(child);
        const lines = wrapText(text, regularFont, contentWidth - 30);
        // Left border
        page.drawRectangle({ x: margin, y: y - 4, width: 3, height: lines.length * 18 + 8, color: rgb(pR.r / 255, pR.g / 255, pR.b / 255) });
        for (const line of lines) {
          if (y < margin + 20) return { y, newPage: true };
          page.drawText(line, { x: margin + 12, y, size: 11, font: regularFont, color: rgb(sR.r / 255, sR.g / 255, sR.b / 255) });
          y -= 18;
        }
      }
    }
    return { y };
  }

  if (node.type === 'list') {
    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i];
      for (const para of item.children) {
        const text = extractText(para);
        const bullet = node.ordered ? `${i + 1}. ` : '• ';
        const lines = wrapText(text, regularFont, contentWidth - 40);
        if (y < margin + 20) return { y, newPage: true };
        const drawFont = node.ordered ? regularFont : boldFont;
        page.drawText(bullet, { x: margin + 10, y, size: 11, font: drawFont, color: rgb(pR.r / 255, pR.g / 255, pR.b / 255) });
        const firstLine = lines[0] ?? '';
        page.drawText(firstLine, { x: margin + 35, y, size: 11, font: regularFont, color: rgb(bR.r / 255, bR.g / 255, bR.b / 255) });
        y -= 18;
        for (let li = 1; li < lines.length; li++) {
          if (y < margin + 20) return { y, newPage: true };
          page.drawText(lines[li], { x: margin + 35, y, size: 11, font: regularFont, color: rgb(bR.r / 255, bR.g / 255, bR.b / 255) });
          y -= 18;
        }
      }
    }
    return { y };
  }

  if (node.type === 'table') {
    const rows = node.children;
    // Calculate column widths (equal distribution)
    const colCount = rows[0]?.children.length ?? 1;
    const colW = contentWidth / colCount;

    for (let ri = 0; ri < rows.length; ri++) {
      if (y < margin + 30) return { y, newPage: true };
      const row = rows[ri];
      const isHeader = ri === 0;
      const isAlt = ri > 0 && ri % 2 === 0;

      // Row background
      const bgColor = isHeader ? pR : isAlt ? lR : null;
      if (bgColor) {
        page.drawRectangle({ x: margin, y: y - 16, width: contentWidth, height: 20, color: rgb(bgColor.r / 255, bgColor.g / 255, bgColor.b / 255) });
      }

      for (let ci = 0; ci < row.children.length; ci++) {
        const cell = row.children[ci];
        const text = extractText(cell).replace(/[\r\n]+/g, ' ').slice(0, 30); // flatten newlines, truncate long cells
        const font = isHeader ? boldFont : regularFont;
        const color = isHeader ? rgb(1, 1, 1) : rgb(bR.r / 255, bR.g / 255, bR.b / 255);
        page.drawText(text, { x: margin + ci * colW + 4, y: y - 4, size: 10, font, color });
      }
      y -= 20;
    }
    return { y: y - 10 };
  }

  if (node.type === 'code') {
    const lines = (node.value ?? '').split('\n');
    // Background box
    const boxH = lines.length * 14 + 10;
    page.drawRectangle({ x: margin, y: y - boxH + 14, width: contentWidth, height: boxH, color: rgb(cR.r / 255, cR.g / 255, cR.b / 255) });
    for (const line of lines) {
      page.drawText(line, { x: margin + 8, y, size: 9, font: regularFont, color: rgb(bR.r / 255, bR.g / 255, bR.b / 255) });
      y -= 14;
    }
    return { y };
  }

  if (node.type === 'thematicBreak') {
    if (y < margin + 20) return { y, newPage: true };
    page.drawRectangle({ x: margin, y: y - 2, width: contentWidth, height: 2, color: rgb(pR.r / 255, pR.g / 255, pR.b / 255) });
    return { y: y - 20 };
  }

  return { y };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════════════════════

type OutputFormat = 'docx' | 'pdf' | 'both';

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };

  const inputArg = args.find(a => !a.startsWith('--'));
  if (!inputArg) {
    console.error('Usage: bun scripts/co-consult/md-to-report.ts <file.md|dir> [--format docx|pdf|both] [--out <dir>] [--font-dir <dir>]');
    process.exit(1);
  }

  const format = (get('--format') as OutputFormat) ?? 'docx';
  const outDirArg = get('--out');
  const fontDir = resolve(dirname(import.meta.path), '..', '..', '..', '..', 'fonts');
  const validFormats: OutputFormat[] = ['docx', 'pdf', 'both'];
  if (!validFormats.includes(format)) {
    console.error(`Invalid format: ${format}. Use docx, pdf, or both.`);
    process.exit(1);
  }

  // Resolve input files
  const workspaceRoot = resolve(dirname(import.meta.path), '..', '..', '..');
  const inputPath = resolve(workspaceRoot, inputArg);
  let inputFiles: string[];

  if (existsSync(inputPath) && statSync(inputPath).isDirectory()) {
    inputFiles = readdirSync(inputPath).filter(f => f.endsWith('.md') && !f.startsWith('README')).map(f => join(inputPath, f));
  } else if (existsSync(inputPath) && statSync(inputPath).isFile() && inputPath.endsWith('.md')) {
    inputFiles = [inputPath];
  } else {
    console.error(`File not found: ${inputArg}`);
    process.exit(1);
  }

  console.log(`📄 md-to-report v1.0.0`);
  console.log(`   Format: ${format}`);
  console.log(`   Files: ${inputFiles.length}`);

  for (const filePath of inputFiles) {
    console.log(`\n── ${basename(filePath)} ──`);
    const raw = readFileSync(filePath, 'utf8');
    const { meta: fmMeta, body } = parseFrontmatter(raw);
    const ast = fromMarkdown(body);
    const extracted = extractReportMeta(ast, filePath);
    const meta = mergeMeta(fmMeta, extracted);

    console.log(`   Title: ${meta.title}`);
    console.log(`   Date:  ${meta.date}`);

    const baseName = basename(filePath, '.md');
    const fileDir = outDirArg ? resolve(workspaceRoot, outDirArg) : dirname(filePath);

    if (!existsSync(fileDir)) mkdirSync(fileDir, { recursive: true });

    try {
      if (format === 'docx' || format === 'both') {
        const docxPath = join(fileDir, `${baseName}.docx`);
        await renderDocx(ast, meta, docxPath, fontDir);
        const sizeKb = Math.round(statSync(docxPath).size / 1024);
        console.log(`   ✅ DOCX -> ${docxPath} (${sizeKb}KB)`);
      }
      if (format === 'pdf' || format === 'both') {
        const pdfPath = join(fileDir, `${baseName}.pdf`);
        await renderPdf(ast, meta, pdfPath, fontDir);
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
