// @version 1.1.0 — Markdown → DOCX/PDF consulting report generator.
//   Converts Markdown deliverables to professionally formatted Word and PDF reports
//   with cover page, TOC, headers/footers, and consulting-style design.
//
//   v1.1.0: DOCX-first PDF via LibreOffice — removes direct pdf-lib rendering,
//           adds LibreOffice CLI conversion for perfect Korean text/CJK support.
//   v1.0.0: Initial release — DOCX + PDF dual output, frontmatter metadata,
//           consulting theme (navy blue), Pretendard font, TOC generation.

import {
  Document as DocxDocument, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType, PageBreak,
  Header as DocxHeader, Footer as DocxFooter, PageNumber, NumberFormat,
  TableOfContents as DocxToc, BorderStyle, ShadingType,
  convertInchesToTwip, TabStopPosition, TabStopType,
} from 'docx';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { execSync } from 'child_process';
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
// LibreOffice PDF Converter
// ═══════════════════════════════════════════════════════════════════════════════

function findLibreOffice(): string | null {
  const { platform } = process;

  if (platform === 'win32') {
    const candidates = [
      'C:\Program Files\LibreOffice\program\soffice.exe',
      'C:\Program Files (x86)\LibreOffice\program\soffice.exe',
    ];
    for (const p of candidates) {
      if (existsSync(p)) return p;
    }
    try {
      const result = execSync('where soffice', { encoding: 'utf8', stdio: 'pipe' });
      return result.trim().split('\n')[0];
    } catch { /* not in PATH */ }
    return null;
  }

  if (platform === 'darwin') {
    const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if (existsSync(macPath)) return macPath;
    try {
      const result = execSync('which soffice', { encoding: 'utf8', stdio: 'pipe' });
      return result.trim().split('\n')[0];
    } catch { /* not in PATH */ }
    return null;
  }

  // Linux
  try {
    const result = execSync('which soffice', { encoding: 'utf8', stdio: 'pipe' });
    return result.trim().split('\n')[0];
  } catch { /* not in PATH */ }
  return null;
}

async function convertDocxToPdf(docxPath: string, outDir: string): Promise<string | null> {
  const soffice = findLibreOffice();
  if (!soffice) {
    console.warn('⚠️ LibreOffice not found — skipping PDF. Install LibreOffice to enable PDF conversion.');
    return null;
  }

  try {
    execSync(`"${soffice}" --headless --convert-to pdf --outdir "${outDir}" "${docxPath}"`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60_000,
    });

    const pdfPath = join(outDir, basename(docxPath, '.docx') + '.pdf');
    return existsSync(pdfPath) ? pdfPath : null;
  } catch (err: any) {
    console.warn(`⚠️ LibreOffice PDF conversion failed: ${err.message}`);
    return null;
  }
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

  console.log(`📄 md-to-report v1.1.0`);
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
      // DOCX is always rendered (required as source for PDF conversion)
      const docxPath = join(fileDir, `${baseName}.docx`);
      await renderDocx(ast, meta, docxPath, fontDir);
      if (format === 'docx' || format === 'both') {
        const docxSizeKb = Math.round(statSync(docxPath).size / 1024);
        console.log(`   ✅ DOCX -> ${docxPath} (${docxSizeKb}KB)`);
      }

      // Convert DOCX → PDF via LibreOffice if requested
      if (format === 'pdf' || format === 'both') {
        const pdfResult = await convertDocxToPdf(docxPath, fileDir);
        if (pdfResult) {
          const pdfSizeKb = Math.round(statSync(pdfResult).size / 1024);
          console.log(`   ✅ PDF  -> ${pdfResult} (${pdfSizeKb}KB)`);
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
