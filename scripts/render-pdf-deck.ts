#!/usr/bin/env bun
/**
 * HTML Presentation Deck PDF Renderer
 * @version 1.0.0
 *
 * Converts HTML presentation decks into paginated PDF files respecting @page print rules
 * using Playwright headless Chromium.
 *
 * Usage:
 *   bun scripts/render-pdf-deck.ts [options]
 *
 * Options:
 *   --input, -i <file>    Path to input HTML presentation deck file
 *   --output, -o <file>   Path to output PDF file (defaults to replacing .html with .pdf)
 *   --check               Dry-run verification of input HTML and Playwright environment
 *   --help, -h            Display usage information
 *
 * @module render-pdf-deck
 */

import path from "node:path";
import { promises as fs, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

interface CliOptions {
  input?: string;
  output?: string;
  check: boolean;
  help: boolean;
}

interface DeckInspection {
  slideCount: number;
  hasPageRules: boolean;
  pageSizeRule?: string;
  title?: string;
}

/**
 * Parse CLI command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    check: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--check") {
      options.check = true;
    } else if (arg === "--input" || arg === "-i") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        options.input = args[++i];
      }
    } else if (arg.startsWith("--input=")) {
      options.input = arg.substring("--input=".length);
    } else if (arg === "--output" || arg === "-o") {
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        options.output = args[++i];
      }
    } else if (arg.startsWith("--output=")) {
      options.output = arg.substring("--output=".length);
    }
  }

  return options;
}

/**
 * Print CLI help usage string
 */
function printHelp(): void {
  console.log(`HTML Presentation Deck PDF Renderer v1.0.0

Converts HTML presentation decks into paginated PDF files respecting @page CSS print rules.

Usage:
  bun scripts/render-pdf-deck.ts [options]

Options:
  --input, -i <file>    Path to input HTML presentation deck file (required)
  --output, -o <file>   Path to output PDF file (defaults to replacing .html with .pdf)
  --check               Dry-run check to verify input file, @page CSS rules, and Playwright environment
  --help, -h            Display this help message
`);
}

/**
 * Resolve output PDF file path
 */
function resolveOutputPath(inputPath: string, customOutput?: string): string {
  if (customOutput) {
    return path.resolve(customOutput);
  }
  const ext = path.extname(inputPath);
  if (ext.toLowerCase() === ".html" || ext.toLowerCase() === ".htm") {
    return inputPath.substring(0, inputPath.length - ext.length) + ".pdf";
  }
  return inputPath + ".pdf";
}

/**
 * Inspect HTML content for slide structure and @page CSS rules
 */
function inspectHtmlDeck(htmlContent: string): DeckInspection {
  const slideMatch = htmlContent.match(/class=["'][^"']*\bslide\b/gi) || htmlContent.match(/<section\b/gi);
  const slideCount = slideMatch ? slideMatch.length : 0;

  const pageRuleMatch = htmlContent.match(/@page\s*\{([^}]+)\}/i);
  const hasPageRules = !!pageRuleMatch;
  let pageSizeRule: string | undefined = undefined;

  if (pageRuleMatch) {
    const sizeMatch = pageRuleMatch[1].match(/size:\s*([^;}]+)/i);
    if (sizeMatch) {
      pageSizeRule = sizeMatch[1].trim();
    }
  }

  const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  return {
    slideCount,
    hasPageRules,
    pageSizeRule,
    title,
  };
}

/**
 * Perform dry-run check mode
 */
async function runCheck(options: CliOptions): Promise<void> {
  console.log(`[CHECK] Running dry-run verification for render-pdf-deck (v1.0.0)`);

  let playwrightAvailable = false;
  try {
    const { chromium } = await import("playwright");
    if (chromium) playwrightAvailable = true;
  } catch {
    playwrightAvailable = false;
  }

  if (playwrightAvailable) {
    console.log(`[PASS] Playwright Chromium engine is available`);
  } else {
    console.log(`[WARN] Playwright is not installed or Chromium engine unavailable`);
  }

  if (!options.input) {
    console.log(`[PASS] Environment check completed. Specify --input <file> to check a specific deck file.`);
    process.exit(0);
  }

  const inputPath = path.resolve(options.input);
  if (!existsSync(inputPath)) {
    console.error(`[FAIL] Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const htmlContent = await fs.readFile(inputPath, "utf-8");
  const inspection = inspectHtmlDeck(htmlContent);
  const outputPath = resolveOutputPath(inputPath, options.output);

  console.log(`[PASS] Input HTML file: ${inputPath} (${htmlContent.length} bytes)`);
  console.log(`[INFO] Output target: ${outputPath}`);
  console.log(`[INFO] Deck title: ${inspection.title || "Untitled"}`);
  console.log(`[INFO] Slide elements detected: ${inspection.slideCount}`);
  console.log(`[INFO] @page CSS rules detected: ${inspection.hasPageRules ? inspection.pageSizeRule || "Yes" : "None (will use default page size)"}`);
  console.log(`[PASS] All dry-run verification checks passed cleanly`);
  process.exit(0);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  if (options.check) {
    await runCheck(options);
    return;
  }

  if (!options.input) {
    console.error(`[ERROR] Missing required option: --input <file>`);
    console.error(`Try 'bun scripts/render-pdf-deck.ts --help' for usage information.`);
    process.exit(1);
  }

  const inputPath = path.resolve(options.input);
  if (!existsSync(inputPath)) {
    console.error(`[ERROR] Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = resolveOutputPath(inputPath, options.output);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  let playwrightModule;
  try {
    playwrightModule = await import("playwright");
  } catch {
    console.error(`[ERROR] Playwright is required to render presentation PDFs.`);
    console.error(`  Please install it using: bun add playwright && bunx playwright install chromium`);
    process.exit(1);
  }

  const { chromium } = playwrightModule;
  console.log(`[INFO] Rendering presentation deck to PDF...`);
  console.log(`  - Input:  ${inputPath}`);
  console.log(`  - Output: ${outputPath}`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const fileUrl = pathToFileURL(inputPath).href;

    await page.goto(fileUrl, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    await page.evaluate(async () => {
      if (document.fonts) {
        await document.fonts.ready;
      }
    });

    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const stat = await fs.stat(outputPath);
    console.log(`[SUCCESS] PDF rendering complete (${stat.size} bytes written)`);
  } catch (err) {
    console.error(`[FATAL] Failed to render PDF deck:`, err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[FATAL] Unhandled error:`, err);
  process.exit(1);
});
