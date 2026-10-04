# Design: `md-to-report.ts` — Markdown to DOCX Report Generator for co-consult

**Date**: 2026-06-28 (Updated: 2026-06-28)
**Status**: Approved (v1.2 — Korean default, DOCX only)
**Scope**: `templates/co-consult/scripts/co-consult/md-to-report.ts`

---

## 1. Problem

The co-consult template produces engagement deliverables exclusively as Markdown files in `deliverables/`. There is no mechanism to convert these into client-ready Word (.docx) documents. Consultants need professionally formatted reports with cover pages, headers/footers, tables of contents, and styled tables for client delivery.

## 2. Solution

A single TypeScript script `md-to-report.ts` that converts any Markdown file in `deliverables/` into a styled DOCX report. Consulting-style formatting follows McKinsey/BCG visual language.

### 2.1 Architecture

```
Input                         Script                          Output
───────────────────────────────────────────────────────────────────
deliverables/reports/         md-to-report.ts                   .docx
  report_ko.md   ──→  ┌────────────────────────┐  ──→         deliverables/reports/
                     │  1. Parse MD            │                 report_ko.docx
                     │  2. Build AST           │
                     │  3. Render DOCX         │
                     └────────────────────────┘

CLI: bun scripts/co-consult/md-to-report.ts <file.md>
```

> **PDF**: PDF conversion is out of scope for this script. Users can convert DOCX to PDF manually via Word or any office application.

### 2.2 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `docx` | ^9.0.0 | DOCX generation (npm) |
| `mdast-util-from-markdown` | latest | Markdown → MDAST parsing (unified ecosystem) |
| `yaml` | latest | Frontmatter parsing |

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

| Markdown Element | DOCX Output |
|-----------------|-------------|
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
| `[text](url)` | Hyperlink (blue underlined) |
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
# Default: DOCX
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis_ko.md

# Custom output directory
bun scripts/co-consult/md-to-report.ts deliverables/reports/analysis_ko.md --out deliverables/presentations/

# Batch: multiple files
bun scripts/co-consult/md-to-report.ts deliverables/reports/*.md

# Batch: entire directory
bun scripts/co-consult/md-to-report.ts deliverables/reports/
```

### 5.1 Output Naming

Input file `deliverables/reports/analysis_ko.md` produces:
- `deliverables/reports/analysis_ko.docx`

Same directory as input by default. `--out` overrides the output folder.

### 5.2 Error Handling

- Missing input file → error + exit 1
- Unresolvable font → warning + fallback to system font
- Unparseable Markdown → error with line number + exit 1
- Missing image reference → warning + skip image
- Write permission error → error + exit 1

## 6. Script Internal Structure

```
md-to-report.ts (~500-600 lines, v1.2)
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
└── main()
    ├── parseArgs(argv)
    ├── resolveInputFiles(pattern)
    └── for each file: parse → extract → render DOCX → log
```

## 7. Table of Contents Generation

### 7.1 Algorithm

1. Walk AST to collect all H1 and H2 headings with their text
2. Assign sequential numbering: `1.`, `1.1`, `2.`, `2.1`, etc.
3. Render as a two-column layout: `Heading text ............... p.N`
4. **DOCX**: Use `docx.TableOfContents` field code (auto-updates when opened in Word)

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

## 10. Language Convention (v1.2)

### 10.1 Default Language: Korean

co-consult deliverables are written in **Korean** by default (unless the client explicitly requests English or another language).

### 10.2 File Naming Convention

| Language | File Suffix | Example |
|----------|------------|---------|
| Korean (default) | `_ko.md` | `semiconductor-trends-2026_ko.md` |
| English | `.md` (no suffix) or `_en.md` | `semiconductor-trends-2026.md` |

**Rules:**
- When generating deliverables, agents MUST use `_ko.md` suffix for Korean-language content.
- English-language deliverables use `.md` without suffix (legacy) or `_en.md` (explicit).
- The md-to-report script derives the output filename from the input: `report_ko.md` → `report_ko.docx`.

## 11. Out of Scope

- PDF generation (users convert DOCX to PDF manually via Word or office application)
- PPTX generation (existing `executive-presentation` skill handles this via Markdown outline)
- Image/chart generation (images in Markdown are embedded as-is if the file exists)
- Template-per-client customization (deferred — single consulting style for all clients)
- Collaborative editing / revision tracking
- Automated report scheduling
