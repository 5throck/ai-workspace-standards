# Design: `md-to-report.ts` — Markdown to DOCX/PDF Report Generator for co-consult

**Date**: 2026-06-28
**Status**: Approved
**Scope**: `templates/co-consult/scripts/co-consult/md-to-report.ts`

---

## 1. Problem

The co-consult template produces engagement deliverables exclusively as Markdown files in `deliverables/`. There is no mechanism to convert these into client-ready Word (.docx) or PDF documents. Consultants need professionally formatted reports with cover pages, headers/footers, tables of contents, and styled tables for client delivery.

## 2. Solution

A single TypeScript script `md-to-report.ts` that converts any Markdown file in `deliverables/` into a styled DOCX and/or PDF report using consulting-style formatting (McKinsey/BCG visual language).

### 2.1 Architecture

```
Input                    Script                        Output
─────────────────────────────────────────────────────────────
deliverables/reports/    md-to-report.ts                .docx / .pdf
  report.md      ──→  ┌──────────────────┐  ──→       deliverables/reports/
                     │  1. Parse MD      │              report.docx
                     │  2. Build AST     │              report.pdf
                     │  3. Render DOCX   │
                     │  4. Render PDF    │
                     └──────────────────┘

CLI: bun scripts/co-consult/md-to-report.ts <file.md> [--format docx|pdf|both]
```

### 2.2 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `docx` | ^9.0.0 | DOCX generation (npm) |
| `pdf-lib` | ^1.17.1 | PDF generation (co-deck proven) |
| `@pdf-lib/fontkit` | ^1.1.1 | Font embedding (Korean support) |
| `mdast-util-from-markdown` | latest | Markdown → MDAST parsing (unified ecosystem) |
| `yaml` | latest | Frontmatter parsing |
| `fflate` | ^0.8.2 (optional) | Compression |

### 2.3 File Location

```
templates/co-consult/scripts/co-consult/md-to-report.ts
```

Follows the co-deck pattern: `scripts/<variant>/<script>.ts`.

## 3. Report Design

### 3.1 Page Layout

**Cover Page:**
- Navy accent bar at top (`#003366`, ~80px height)
- Report title: Pretendard Bold, 28pt
- Author / Date: Pretendard Regular, 14pt
- Client name (if metadata): Pretendard Regular, 12pt
- White background, no header/footer on cover page

**Body Pages:**
- Header: navy bar with report title (left) + page number (right)
- Body: 1in margins all sides
- Footer: gray bar with date (left) + "CONFIDENTIAL" or "Confidential" (right, if `confidential: true`)

### 3.2 Typography

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Cover title | Pretendard | 28pt | Bold | `#003366` |
| Cover subtitle (author) | Pretendard | 14pt | Regular | `#666666` |
| H1 | Pretendard | 22pt | Bold | `#003366` |
| H2 | Pretendard | 16pt | Bold | `#003366` |
| H3 | Pretendard | 13pt | Bold | `#003366` |
| Body text | Pretendard | 11pt | Regular | `#333333` |
| Bullet text | Pretendard | 11pt | Regular | `#333333` |
| Blockquote | Pretendard | 11pt | Italic | `#555555` |
| Table header | Pretendard | 10pt | Bold | `#FFFFFF` (on `#003366` bg) |
| Table body | Pretendard | 10pt | Regular | `#333333` |
| Table alt row | — | — | — | `#f5f7fa` |
| Code block | Consolas/Monaco | 9pt | Regular | `#333333` on `#f4f4f4` bg |
| Page number | Pretendard | 9pt | Regular | `#FFFFFF` (in navy bar) |

### 3.3 Markdown → Report Element Mapping

| Markdown Element | DOCX/PDF Output |
|-----------------|------------------|
| `# H1` (first occurrence) | Cover page title |
| `# H1` (subsequent) | Section heading (22pt, navy) |
| `## H2` | Subsection heading (16pt, navy) |
| `### H3` | Sub-subsection heading (13pt, navy) |
| Plain text | Body paragraph (11pt, 1.5 spacing) |
| `> blockquote` | Left navy border (4px) + italic + padding-left |
| `\| Table \| ... \|` | Styled table with navy header, alternating rows |
| `- bullet` | Bullet list (•, 0.5in indent) |
| `1. ordered` | Numbered list |
| `**bold**` | Bold |
| `*italic*` | Italic |
| `---` (horizontal rule) | Navy line divider (2px) |
| `[text](url)` | Hyperlink (DOCX) / Blue underlined text (PDF) |
| `` `code` `` | Inline code (monospace, gray bg pill) |
| Code block (```) | Gray background box, monospace, no wrapping |
| `![alt](src)` | Inline image (if file exists, else skip) |

## 4. Frontmatter Metadata

### 4.1 Supported Fields

```yaml
---
title: "Semiconductor Industry Trends Report"
date: 2026-06-26
author: "Industry Expert · Strategy Analyst"
client: "Acme Corp"
confidential: true
---
```

| Field | Required | Default | Source |
|-------|----------|---------|--------|
| `title` | No | First `# H1` text | Frontmatter → AST fallback |
| `date` | No | File modification time | Frontmatter → `statSync().mtime` |
| `author` | No | `""` | Frontmatter only |
| `client` | No | Not displayed | Frontmatter only |
| `confidential` | No | `false` | Frontmatter only |

### 4.2 Backward Compatibility

If no frontmatter exists, the script extracts title from the first `H1` heading and date from the file's `mtime`. Existing reports without frontmatter work without modification.

## 5. CLI Interface

```bash
# Default: DOCX only
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis.md

# PDF only
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis.md --format pdf

# Both formats
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis.md --format both

# Custom output directory
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis.md --out deliverables/presentations/

# Batch: multiple files
bun scripts/co-consult/md-to-report.ts deliverables/reports/*.md

# Batch: entire directory
bun scripts/co-consult/md-to-report.ts deliverables/reports/ --format both
```

### 5.1 Output Naming

Input file `deliverables/reports/analysis.md` produces:
- `deliverables/reports/analysis.docx`
- `deliverables/reports/analysis.pdf`

Same directory as input by default. `--out` overrides the output folder.

### 5.2 Error Handling

- Missing input file → error + exit 1
- Unresolvable font → warning + fallback to system font
- Unparseable Markdown → error with line number + exit 1
- Missing image reference → warning + skip image
- Write permission error → error + exit 1

## 6. Script Internal Structure

```
md-to-report.ts (~800-1000 lines)
│
├── parseFrontmatter(raw: string)
│   → { metadata: ReportMeta, body: string }
│
├── parseMarkdown(md: string)
│   → mdast.Root (MDAST tree via unified)
│
├── extractReportMeta(ast: mdast.Root, filePath: string)
│   → ReportMeta { title, date, author, client, confidential }
│
├── renderDocx(ast: mdast.Root, meta: ReportMeta, outPath: string)
│   ├── addCoverPage(doc, meta)
│   ├── addToc(doc, ast)
│   ├── addContent(doc, ast)        ← recursive AST walker
│   └── addHeaderFooter(doc, meta)
│
├── renderPdf(ast: mdast.Root, meta: ReportMeta, outPath: string)
│   ├── addCoverPage(pdf, meta)
│   ├── addToc(pdf, ast)
│   ├── addContent(pdf, ast)        ← recursive AST walker
│   └── addHeaderFooter(pdf, meta)
│
└── main()
    ├── parseArgs(argv)
    ├── resolveInputFiles(pattern)
    └── for each file: parse → extract → render → log
```

## 7. Table of Contents Generation

### 7.1 Algorithm

1. Walk AST to collect all H1 and H2 headings with their text
2. Assign sequential numbering: `1.`, `1.1`, `2.`, `2.1`, etc.
3. Render as a two-column layout: `Heading text ............... p.N`
4. **DOCX**: Use `docx.TableOfContents` field code (auto-updates when opened in Word)
5. **PDF**: Render as static text with right-aligned page numbers (manual calculation)

### 7.2 TOC Page Styling

- Heading: "Table of Contents" — Pretendard Bold, 20pt, navy
- Entries: 12pt regular, 0.3in left indent per level
- Dotted leaders between heading and page number

## 8. Consulting Style Tokens (Design System)

```typescript
const THEME = {
  primary:    '#003366',  // navy blue
  body:       '#333333',  // dark gray
  subtle:     '#666666',  // medium gray
  light:      '#f5f7fa',  // table alt row
  white:      '#FFFFFF',
  divider:    '#cccccc',  // table borders, hr
  codeBg:     '#f4f4f4',  // code block background
  font: {
    primary: 'Pretendard',
    mono:    'Consolas',
  },
  size: {
    coverTitle: 28,
    coverSub:   14,
    h1:          22,
    h2:          16,
    h3:          13,
    body:        11,
    small:       10,
    page:         9,
    code:         9,
  },
  margin: {
    top:    '1in',
    bottom: '1in',
    left:   '1in',
    right:  '1in',
  },
} as const;
```

## 9. Font Resolution

The script resolves fonts in this order:

1. **Pretendard** from `fonts/` directory (if bundled with the project)
2. **Pretendard** from system font path (`C:\Users\<user>\AppData\Local\Microsoft\Windows\Fonts\` on Windows)
3. **Fallback**: Arial (Windows) / Noto Sans (Linux) / Helvetica (macOS)

Font files are NOT bundled in the template. The script logs a warning if using a fallback font.

## 10. Out of Scope

- PPTX generation (existing `executive-presentation` skill handles this via Markdown outline)
- Image/chart generation (images in Markdown are embedded as-is if the file exists)
- Template-per-client customization (deferred — single consulting style for all clients)
- Collaborative editing / revision tracking
- Automated report scheduling
