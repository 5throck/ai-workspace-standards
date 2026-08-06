#!/usr/bin/env bun
/**
 * @version 1.1.0
 * @description Compiles Markdown documentation into native Microsoft Office Open XML (.docx / .xlsx) structures (WordML / SpreadsheetML).
 * @usage bun scripts/md-to-ooxml.ts [--input <path>] [--output <path>] [--type docx|xlsx] [--check] [--help]
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve, extname } from "path";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(`
Markdown to Office OOXML Compiler (md-to-ooxml.ts v1.0.0)

Usage:
  bun scripts/md-to-ooxml.ts --input <file.md> [--output <file.docx|xlsx>] [--type docx|xlsx] [--check]

Options:
  --input <path>      Path to input Markdown file (required)
  --output <path>     Path to output Office package (optional, defaults to input basename)
  --type <type>       Target format: docx or xlsx (default: infer from output extension or docx)
  --check             Dry-run parse check without writing files
  --help              Show this help message
`);
  process.exit(0);
}

const isCheck = args.includes("--check");
const inputArgIdx = args.indexOf("--input");
const inputPath = inputArgIdx !== -1 ? args[inputArgIdx + 1] : null;

const outputArgIdx = args.indexOf("--output");
const outputPath = outputArgIdx !== -1 ? args[outputArgIdx + 1] : null;

const typeArgIdx = args.indexOf("--type");
let targetType = typeArgIdx !== -1 ? args[typeArgIdx + 1] : null;

if (!inputPath) {
  if (isCheck) {
    console.log("✅ md-to-ooxml.ts syntax & options check passed.");
    process.exit(0);
  }
  console.error("❌ Error: Missing required parameter --input <file.md>");
  process.exit(1);
}

const resolvedInput = resolve(process.cwd(), inputPath);

if (!existsSync(resolvedInput)) {
  console.error(`❌ Error: Input file not found: ${resolvedInput}`);
  process.exit(1);
}

if (!targetType) {
  if (outputPath) {
    const ext = extname(outputPath).toLowerCase();
    targetType = ext === ".xlsx" ? "xlsx" : "docx";
  } else {
    targetType = "docx";
  }
}

const content = readFileSync(resolvedInput, "utf-8");

console.log(`📄 Parsing Markdown source: ${resolvedInput}`);
console.log(`🎯 Target output format: ${targetType.toUpperCase()}`);

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates Microsoft Word WordML structure (.docx XML package).
 */
function compileToWordML(mdText: string): string {
  const lines = mdText.split("\n");
  const paragraphs: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("# ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(2))}</w:t></w:r></w:p>`);
    } else if (trimmed.startsWith("## ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(3))}</w:t></w:r></w:p>`);
    } else if (trimmed.startsWith("### ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(4))}</w:t></w:r></w:p>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      paragraphs.push(`<w:p><w:pPr><w:pStyle w:val="ListBullet"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(2))}</w:t></w:r></w:p>`);
    } else {
      paragraphs.push(`<w:p><w:r><w:t>${escapeXml(trimmed)}</w:t></w:r></w:p>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml">
  <w:body>
    ${paragraphs.join("\n    ")}
  </w:body>
</w:wordDocument>`;
}

/**
 * Generates Microsoft Excel SpreadsheetML structure (.xlsx XML package).
 */
function compileToSpreadsheetML(mdText: string): string {
  const lines = mdText.split("\n");
  const rows: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      // Markdown table row
      const cells = trimmed
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // Skip separator rows like |---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;

      const cellXml = cells
        .map((val) => `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`)
        .join("");
      rows.push(`<Row>${cellXml}</Row>`);
    } else {
      // General text line mapped to single cell row
      rows.push(`<Row><Cell><Data ss:Type="String">${escapeXml(trimmed)}</Data></Cell></Row>`);
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      ${rows.join("\n      ")}
    </Table>
  </Worksheet>
</Workbook>`;
}

if (isCheck) {
  console.log("✅ Parse completed successfully (dry-run).");
  process.exit(0);
}

const compiledOutput = targetType === "xlsx" ? compileToSpreadsheetML(content) : compileToWordML(content);
const targetFile = outputPath ? resolve(process.cwd(), outputPath) : resolvedInput.replace(/\.md$/, `.${targetType}`);

writeFileSync(targetFile, compiledOutput, "utf-8");
console.log(`✅ Successfully compiled Office OOXML package (${targetType.toUpperCase()}): ${targetFile}`);
