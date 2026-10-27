#!/usr/bin/env bun
/**
 * compile-tokens.ts — Design Tokens Compiler (tokens.json → CSS & TypeScript)
 * @version 1.3.0
 *
 * v1.3.0 (2026-10-27, U-20261027-006 + U-20261027-005): every provenance banner
 *  (help header, CSS header, TS header) derives from the single VERSION constant
 *  — the v1.2.0 @version header, the v1.1.0 help banner, and the v1.1.0 TS
 *  banner used to disagree, so generated artifacts carried mismatched
 *  provenance. Default input precedence inverts: ./tokens.json (project-local)
 *  wins, templates/co-design/tokens.json is only the workspace-repo fallback —
 *  in an instantiated project the template copy no longer silently beats the
 *  project's own tokens.json. Theme invariance (U-20261027-005, DESIGN-R2):
 *  a theme preset overriding any top-level group other than color/shadow is a
 *  HARD compile error naming the preset and the offending key path (shared rule
 *  with design-lint via helpers/theme-token-policy.ts) — the SSOT must not
 *  compile rule violations.
 *
 * Canonical regeneration of the committed template artifacts (from the repo root):
 *   bun scripts/compile-tokens.ts --input templates/co-design/tokens.json \
 *     --output-css templates/co-design/playground/src/generated/tokens.css \
 *     --output-ts templates/co-design/playground/src/generated/tokens.ts
 *
 * Compiles visual design tokens (colors, typography, spacing, radii, shadows) from tokens.json
 * into CSS Custom Properties (:root { --color-primary: ... }) and strongly-typed TypeScript constant files (tokens.ts).
 *
 * Theme presets (v1.1.0): a reserved top-level "themes" object declares named presets
 * (e.g. "dark", "high-contrast") that override a subset of the default tokens. Each preset
 * compiles to a CSS block scoped as [data-theme="<name>"] { ... } AFTER the :root block —
 * consumers switch themes by setting the data-theme attribute; only overridden variables
 * are re-declared. The TypeScript output gains `export const themes`. A tokens.json without
 * a "themes" key compiles exactly as before (theme section omitted).
 *
 * Token layers (v1.2.0, ADR-0064 3-layer model): the reserved top-level keys
 * "primitive", "semantic", and "component" denote token layers. Their key names are
 * STRIPPED from CSS variable paths (--semantic-color-primary → --color-primary) so a
 * semantic token re-declares the same variable name it replaces, and primitives keep
 * theme-neutral names. Values are emitted to :root in layer order (primitive → semantic
 * → component → any unlayered groups), so semantic var() references to primitives
 * resolve. The TypeScript output preserves the layer grouping as top-level keys
 * (primitive / semantic / component). Tokens outside these reserved keys compile
 * exactly as in v1.1.0.
 *
 * Reduced motion (v1.2.0): after all theme blocks, the compiler emits a
 * @media (prefers-reduced-motion: reduce) block re-declaring every
 * --motion-duration-* variable to 0ms, so any token file with motion durations
 * ships an accessible reduced-motion default.
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
import { isThemeOverridableGroup } from "./helpers/theme-token-policy.ts";

/** Single source of truth for every version banner this compiler emits. */
const VERSION = "1.3.0";

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
Visual Design Tokens Compiler v${VERSION}

Compiles tokens.json to CSS Custom Properties (:root { --color-primary: ... })
and strongly-typed TypeScript constant files (tokens.ts). A reserved top-level
"themes" object compiles to [data-theme="<name>"] CSS blocks and a TS themes export.
Theme presets may override ONLY color and shadow tokens (DESIGN-R2 theme
invariance) — a preset overriding typography/spacing/borderRadius/target-size
is a hard compile error.

Usage:
  bun scripts/compile-tokens.ts [options]

Options:
  --input <file>, -i <file>       Path to input design tokens JSON file (default: ./tokens.json — project-local wins; templates/co-design/tokens.json is only the workspace-repo fallback)
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
 * Theme preset extraction result: per-theme override tokens + value tree
 */
interface ExtractedTheme {
  name: string;
  tokens: ExtractedToken[];
  valueTree: Record<string, unknown>;
}

/**
 * A DESIGN-R2 theme-invariance violation (U-20261027-005): a preset overrides
 * a top-level group outside the color/shadow allowlist.
 */
interface ThemeInvarianceViolation {
  preset: string;
  key: string;
}

/**
 * Reserved top-level token-layer keys (ADR-0064 3-layer model). Their names are
 * stripped from CSS variable paths; extraction order below preserves layer order.
 */
const LAYER_KEYS = ["primitive", "semantic", "component"] as const;

/**
 * Split the reserved top-level "themes" key off the token tree and extract each preset.
 * Preset nodes reuse the same leaf logic, so an override at themes.dark.color.primary
 * emits the SAME css variable name as the default (--color-primary) — it is a re-declaration
 * under the [data-theme] scope, not a new variable.
 *
 * v1.2.0: reserved layer keys ("primitive"/"semantic"/"component") are ALSO split off —
 * their tokens join the default :root set with the layer key stripped from the variable
 * path, emitted in layer order so semantic var() references to primitives resolve.
 *
 * v1.3.0 (U-20261027-005, DESIGN-R2): each preset's TOP-LEVEL keys are checked
 * against the shared color/shadow allowlist (helpers/theme-token-policy.ts).
 * Any other group — typography, spacing, borderRadius, target-size, ... — is a
 * hard error: the violations are returned to main(), which exits 1 BEFORE any
 * output is written. Only color and shadow may vary per theme.
 */
function extractThemes(root: unknown): {
  defaultNode: Record<string, unknown>;
  themes: ExtractedTheme[];
  violations: ThemeInvarianceViolation[];
} {
  const themes: ExtractedTheme[] = [];
  const violations: ThemeInvarianceViolation[] = [];

  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { defaultNode: {}, themes, violations };
  }
  const record = root as Record<string, unknown>;
  const themesNode = record["themes"];

  if (themesNode === undefined) {
    return { defaultNode: record, themes, violations };
  }

  if (typeof themesNode !== "object" || themesNode === null || Array.isArray(themesNode)) {
    console.warn(`⚠️ Warning: top-level "themes" is not an object — ignoring theme presets.`);
    const { themes: _ignored, ...rest } = record;
    return { defaultNode: rest, themes, violations };
  }

  const { themes: _stripped, ...rest } = record;
  for (const [name, node] of Object.entries(themesNode as Record<string, unknown>)) {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      console.warn(`⚠️ Warning: theme "${name}" is not an object — skipping.`);
      continue;
    }
    // DESIGN-R2 theme invariance: every top-level key of a preset must name an
    // overridable group (color/shadow). A bare leaf directly under the preset
    // is equally a non-overridable group position and is reported too.
    for (const key of Object.keys(node as Record<string, unknown>)) {
      if (!isThemeOverridableGroup(key)) {
        violations.push({ preset: name, key });
      }
    }
    const sub = extractTokens(node, []);
    themes.push({ name, tokens: sub.tokens, valueTree: sub.valueTree });
  }

  return { defaultNode: rest, themes, violations };
}

/**
 * v1.2.0: extract the default :root token set with reserved layer keys split off.
 * Returns the ordered CSS tokens (primitive → semantic → component → unlayered)
 * plus a valueTree that PRESERVES the layer grouping for the TypeScript output.
 */
function extractDefaultWithLayers(root: unknown): {
  tokens: ExtractedToken[];
  valueTree: Record<string, unknown>;
  cssVarTree: Record<string, unknown>;
} {
  if (typeof root !== "object" || root === null || Array.isArray(root)) {
    return { tokens: [], valueTree: {}, cssVarTree: {} };
  }
  const record = root as Record<string, unknown>;

  const tokens: ExtractedToken[] = [];
  const valueTree: Record<string, unknown> = {};
  const cssVarTree: Record<string, unknown> = {};
  const unlayered: Record<string, unknown> = {};

  // Layer order first, then any remaining groups
  for (const layer of LAYER_KEYS) {
    const node = record[layer];
    if (node === undefined) continue;
    const sub = extractTokens(node);
    tokens.push(...sub.tokens);
    valueTree[layer] = sub.valueTree;
    cssVarTree[layer] = sub.cssVarTree;
  }
  for (const [key, val] of Object.entries(record)) {
    if ((LAYER_KEYS as readonly string[]).includes(key)) continue;
    unlayered[key] = val;
  }
  if (Object.keys(unlayered).length > 0) {
    const sub = extractTokens(unlayered);
    tokens.push(...sub.tokens);
    Object.assign(valueTree, sub.valueTree);
    Object.assign(cssVarTree, sub.cssVarTree);
  }

  return { tokens, valueTree, cssVarTree };
}

/**
 * Generate CSS Custom Properties string
 */
function generateCss(
  tokens: ExtractedToken[],
  themes: ExtractedTheme[],
  inputRelativePath: string
): string {
  const lines: string[] = [
    "/**",
    " * Visual Design Tokens — CSS Custom Properties",
    ` * Generated by compile-tokens.ts v${VERSION}`,
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

  for (const theme of themes) {
    lines.push(`[data-theme="${theme.name}"] {`);
    for (const token of theme.tokens) {
      const formattedVal = typeof token.value === "string" ? token.value : String(token.value);
      lines.push(`  ${token.cssVarName}: ${formattedVal};`);
    }
    lines.push("}", "");
  }

  // Reduced-motion accessibility default (v1.2.0): zero out every motion duration
  for (const media of prefersReducedMotionTokens(tokens)) {
    lines.push(...media);
  }

  return lines.join("\n");
}

/**
 * Build the @media (prefers-reduced-motion: reduce) block re-declaring every
 * --motion-duration-* token to 0ms. Returns an empty array when the token set
 * declares no motion durations.
 */
function prefersReducedMotionTokens(tokens: ExtractedToken[]): string[][] {
  const durationVars = tokens
    .map((t) => t.cssVarName)
    .filter((name) => name.startsWith("--motion-duration"));
  if (durationVars.length === 0) return [];
  const block = ["@media (prefers-reduced-motion: reduce) {", "  :root {"];
  for (const name of durationVars) {
    block.push(`    ${name}: 0ms;`);
  }
  block.push("  }", "}");
  return [block];
}

/**
 * Generate TypeScript constants string
 */
function generateTs(
  valueTree: Record<string, unknown>,
  cssVarTree: Record<string, unknown>,
  themes: ExtractedTheme[],
  inputRelativePath: string
): string {
  const jsonValues = JSON.stringify(valueTree, null, 2);
  const jsonCssVars = JSON.stringify(cssVarTree, null, 2);

  const themeLines: string[] = [];
  if (themes.length > 0) {
    const jsonThemes = JSON.stringify(
      Object.fromEntries(themes.map((t) => [t.name, t.valueTree])),
      null,
      2
    );
    themeLines.push(
      `export const themes = ${jsonThemes} as const;`,
      "",
      "export type Themes = typeof themes;",
      ""
    );
  }

  const lines: string[] = [
    "/**",
    " * Visual Design Tokens — TypeScript Constants",
    ` * Generated by compile-tokens.ts v${VERSION}`,
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
    ...themeLines,
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

  // U-20261027-006: project-local tokens.json wins; the template copy is only
  // the workspace-repo fallback. The old order (template first) silently beat
  // a project's own tokens.json in an instantiated project — the precedence
  // class that produced the reversion incidents (upstream U-20261026-005).
  if (!inputPath) {
    if (existsSync("tokens.json")) {
      inputPath = "tokens.json";
    } else if (existsSync("templates/co-design/tokens.json")) {
      inputPath = "templates/co-design/tokens.json";
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

  const { defaultNode, themes, violations } = extractThemes(parsedJson);

  // U-20261027-005 (DESIGN-R2): theme-invariance violations are a hard compile
  // error — the SSOT must not compile rule violations. Fails BEFORE any output
  // is written.
  if (violations.length > 0) {
    console.error(`❌ Theme invariance violation(s) (DESIGN-R2) in "${inputPath}":`);
    for (const v of violations) {
      console.error(
        `  - theme "${v.preset}" overrides non-theme-invariant group "${v.key}" (themes.${v.preset}.${v.key}) — theme presets may override ONLY color and shadow tokens; typography/spacing/borderRadius/target-size are theme-invariant`,
      );
    }
    process.exit(1);
  }

  const { tokens, valueTree, cssVarTree } = extractDefaultWithLayers(defaultNode);

  if (tokens.length === 0) {
    console.warn(`⚠️ Warning: No valid design tokens extracted from "${inputPath}".`);
  }

  const generatedCss = generateCss(tokens, themes, inputPath.replace(/\\/g, "/"));
  const generatedTs = generateTs(valueTree, cssVarTree, themes, inputPath.replace(/\\/g, "/"));

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
