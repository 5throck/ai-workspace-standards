#!/usr/bin/env bun
/**
 * compile-tokens.ts — Design Tokens Compiler (tokens.json → CSS & TypeScript)
 * @version 1.0.0
 *
 * Compiles visual design tokens (colors, typography, spacing, radii, shadows) from tokens.json
 * into CSS Custom Properties (:root { --color-primary: ... }) and strongly-typed TypeScript constant files (tokens.ts).
 *
 * Usage:
 *   bun scripts/compile-tokens.ts [options]
 *
 * Options:
 *   --input <file>, -i <file>       Path to input tokens.json file
 *   --output-css <file>, -c <file>   Path to output CSS custom properties file
 *   --output-ts <file>, -t <file>     Path to output TypeScript constants file
 *   --check                          Verify if generated files match source without writing
 *   --help, -h                       Display this help message
 *
 * @module compile-tokens
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

interface CliOptions {
  input?: string;
  outputCss?: string;
  outputTs?: string;
  check: boolean;
  help: boolean;
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
      options.input = args[++i];
    } else if (arg === "--output-css" || arg === "-c") {
      options.outputCss = args[++i];
    } else if (arg === "--output-ts" || arg === "-t") {
      options.outputTs = args[++i];
    }
  }

  return options;
}

/**
 * Display CLI usage documentation
 */
function printHelp(): void {
  console.log(`
Visual Design Tokens Compiler v1.0.0

Compiles tokens.json to CSS Custom Properties (:root { --color-primary: ... })
and strongly-typed TypeScript constant files (tokens.ts).

Usage:
  bun scripts/compile-tokens.ts [options]

Options:
  --input <file>, -i <file>       Path to input design tokens JSON file (default: tokens.json or templates/co-design/tokens.json)
  --output-css <file>, -c <file>   Path to output CSS custom properties file (default: tokens.css)
  --output-ts <file>, -t <file>     Path to output TypeScript constants file (default: tokens.ts)
  --check                          Verify if generated files match source without writing
  --help, -h                       Display this help message
`);
}

/**
 * Convert camelCase or PascalCase string to kebab-case
 */
function camelToKebab(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Interface representing extracted token item
 */
interface ExtractedToken {
  path: string[];
  cssVarName: string;
  value: string | number | boolean;
}

/**
 * Check if a object is a token leaf node (e.g. { value: "#fff" } or { $value: "#fff" })
 */
function isTokenLeaf(obj: unknown): obj is { value?: unknown; $value?: unknown } {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return "value" in record || "$value" in record;
}

/**
 * Recursively extract tokens and build structures
 */
function extractTokens(
  node: unknown,
  currentPath: string[] = []
): {
  tokens: ExtractedToken[];
  valueTree: Record<string, unknown>;
  cssVarTree: Record<string, unknown>;
} {
  const tokens: ExtractedToken[] = [];
  const valueTree: Record<string, unknown> = {};
  const cssVarTree: Record<string, unknown> = {};

  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return { tokens, valueTree, cssVarTree };
  }

  const record = node as Record<string, unknown>;

  for (const [key, val] of Object.entries(record)) {
    const newPath = [...currentPath, key];

    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
      const cssVarName = `--${newPath.map(camelToKebab).join("-")}`;
      tokens.push({ path: newPath, cssVarName, value: val });
      valueTree[key] = val;
      cssVarTree[key] = `var(${cssVarName})`;
    } else if (isTokenLeaf(val)) {
      const tokenValue = (val.$value ?? val.value) as string | number | boolean;
      const cssVarName = `--${newPath.map(camelToKebab).join("-")}`;
      tokens.push({ path: newPath, cssVarName, value: tokenValue });
      valueTree[key] = tokenValue;
      cssVarTree[key] = `var(${cssVarName})`;
    } else if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const sub = extractTokens(val, newPath);
      tokens.push(...sub.tokens);
      valueTree[key] = sub.valueTree;
      cssVarTree[key] = sub.cssVarTree;
    }
  }

  return { tokens, valueTree, cssVarTree };
}

/**
 * Generate CSS Custom Properties string
 */
function generateCss(tokens: ExtractedToken[], inputRelativePath: string): string {
  const lines: string[] = [
    "/**",
    " * Visual Design Tokens — CSS Custom Properties",
    " * Generated by compile-tokens.ts v1.0.0",
    ` * Source: ${inputRelativePath}`,
    " * Do not edit directly.",
    " */",
    "",
    ":root {",
  ];

  for (const token of tokens) {
    const formattedVal = typeof token.value === "string" ? token.value : String(token.value);
    lines.push(`  ${token.cssVarName}: ${formattedVal};`);
  }

  lines.push("}", "");
  return lines.join("\n");
}

/**
 * Generate TypeScript constants string
 */
function generateTs(
  valueTree: Record<string, unknown>,
  cssVarTree: Record<string, unknown>,
  inputRelativePath: string
): string {
  const jsonValues = JSON.stringify(valueTree, null, 2);
  const jsonCssVars = JSON.stringify(cssVarTree, null, 2);

  const lines: string[] = [
    "/**",
    " * Visual Design Tokens — TypeScript Constants",
    " * Generated by compile-tokens.ts v1.0.0",
    ` * Source: ${inputRelativePath}`,
    " * Do not edit directly.",
    " */",
    "",
    `export const tokens = ${jsonValues} as const;`,
    "",
    "export type Tokens = typeof tokens;",
    "",
    `export const CSS_VARS = ${jsonCssVars} as const;`,
    "",
    "export type CssVars = typeof CSS_VARS;",
    "",
    "export default tokens;",
    "",
  ];

  return lines.join("\n");
}

/**
 * Main execution function
 */
export async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  let inputPath = options.input;

  if (!inputPath) {
    if (existsSync("templates/co-design/tokens.json")) {
      inputPath = "templates/co-design/tokens.json";
    } else if (existsSync("tokens.json")) {
      inputPath = "tokens.json";
    } else {
      inputPath = "tokens.json";
    }
  }

  const resolvedInputPath = resolve(inputPath);

  if (!existsSync(resolvedInputPath)) {
    console.error(`❌ Error: Input tokens file not found at "${inputPath}".`);
    process.exit(1);
  }

  let rawJson: string;
  let parsedJson: unknown;

  try {
    rawJson = readFileSync(resolvedInputPath, "utf8");
    parsedJson = JSON.parse(rawJson);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Error: Failed to parse JSON from "${inputPath}": ${msg}`);
    process.exit(1);
  }

  const { tokens, valueTree, cssVarTree } = extractTokens(parsedJson);

  if (tokens.length === 0) {
    console.warn(`⚠️ Warning: No valid design tokens extracted from "${inputPath}".`);
  }

  const generatedCss = generateCss(tokens, inputPath.replace(/\\/g, "/"));
  const generatedTs = generateTs(valueTree, cssVarTree, inputPath.replace(/\\/g, "/"));

  const outputCssPath = options.outputCss ?? "tokens.css";
  const outputTsPath = options.outputTs ?? "tokens.ts";

  if (options.check) {
    let cssMatch = true;
    let tsMatch = true;

    if (options.outputCss || (!options.outputTs && !options.outputCss)) {
      if (!existsSync(resolve(outputCssPath))) {
        cssMatch = false;
      } else {
        const existingCss = readFileSync(resolve(outputCssPath), "utf8").replace(/\r\n/g, "\n");
        if (existingCss !== generatedCss.replace(/\r\n/g, "\n")) {
          cssMatch = false;
        }
      }
    }

    if (options.outputTs || (!options.outputTs && !options.outputCss)) {
      if (!existsSync(resolve(outputTsPath))) {
        tsMatch = false;
      } else {
        const existingTs = readFileSync(resolve(outputTsPath), "utf8").replace(/\r\n/g, "\n");
        if (existingTs !== generatedTs.replace(/\r\n/g, "\n")) {
          tsMatch = false;
        }
      }
    }

    if (!cssMatch || !tsMatch) {
      console.error(`❌ Design tokens output files (${outputCssPath}, ${outputTsPath}) are out of sync with "${inputPath}".`);
      process.exit(1);
    }

    console.log(`✅ Design tokens output files are up-to-date with "${inputPath}".`);
    process.exit(0);
  }

  // Write output files
  if (options.outputCss || (!options.outputTs && !options.outputCss)) {
    const cssResolved = resolve(outputCssPath);
    mkdirSync(dirname(cssResolved), { recursive: true });
    writeFileSync(cssResolved, generatedCss, "utf8");
    console.log(`🎨 Compiled CSS custom properties → ${outputCssPath}`);
  }

  if (options.outputTs || (!options.outputTs && !options.outputCss)) {
    const tsResolved = resolve(outputTsPath);
    mkdirSync(dirname(tsResolved), { recursive: true });
    writeFileSync(tsResolved, generatedTs, "utf8");
    console.log(`⚡ Compiled TypeScript constants → ${outputTsPath}`);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("❌ Fatal compiler error:", err);
    process.exit(1);
  });
}
