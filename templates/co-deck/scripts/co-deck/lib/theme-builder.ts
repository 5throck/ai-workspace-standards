// theme-builder.ts — deterministic HTML theme deck builder.
//
// Reads a theme package (template.html + theme.json), replaces INJECT markers
// with CSS links, slideData, and title, then inlines ppt-engine.js for
// PPT-engine themes. Produces byte-identical output for identical inputs.

import { existsSync, readFileSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { loadThemePackage, validateThemePackage } from './theme-contract.js';
import { readJson, normalizeStyleEntry } from './theme-utils.js';

// --- Public types ---

export interface BuildOptions {
  root: string;           // workspace root
  projectPath: string;    // path to presentations/<project>
  theme: string;          // theme name (e.g. "pitch-enhanced")
  style: string;          // style name (e.g. "premium-dark")
  title: string;          // slide deck title (replaces INJECT:title)
  slideData: any[];       // strict-JSON slide data array
  outputPath?: string;    // optional output path (defaults to <project>/lecture_v1.html)
  version?: string;       // version suffix for output filename
  cssRoot?: string;       // override CSS path prefix (default: "../../docs/html-themes")
}

export interface BuildResult {
  outputPath: string;
  html: string;
  warnings: string[];
  errors: string[];
}

// --- Marker definitions ---

const MARKERS = {
  title: '<!-- INJECT:title -->',
  css: '<!-- INJECT:CSS -->',
  slides: '<!-- INJECT:slides -->',
  slideData: '// <!-- INJECT:slideData -->',
} as const;

// Regex to find the ppt-engine.js placeholder comment block across PPT-engine themes.
// Matches from the "── ppt-engine.js inline" line through the "Each template includes..." line,
// including any blank lines between.
const PPT_ENGINE_PLACEHOLDER_RE =
  /\/\/\s*──\s*ppt-engine\.js inline[\s\S]*?(?:via <script> inclusion or inlined here\.|Each template includes the full ppt-engine\.js before theme-specific code\.)\s*\n*/;

// --- CSS link builder ---

function buildCssLinks({ theme, style, hasPptEngine, cssRoot }: {
  root: string;
  theme: string;
  style: string;
  hasPptEngine: boolean;
  cssRoot?: string;
}): string[] {
  const prefix = cssRoot || '../../docs/html-themes';
  const links: string[] = [];

  // 1. base.css (always first)
  links.push(`${prefix}/styles/base.css`);

  // 2. ppt-engine.css (only for PPT-engine themes)
  if (hasPptEngine) {
    links.push(`${prefix}/themes/_shared/ppt-engine.css`);
  }

  // 3. theme.css
  links.push(`${prefix}/themes/${theme}/theme.css`);

  // 4. style.css
  links.push(`${prefix}/styles/${style}/style.css`);

  return links;
}

function cssLinksToHtml(links: string[]): string {
  return links.map((href) => `  <link rel="stylesheet" href="${href}">`).join('\n');
}

// --- Compatibility check ---

function checkCompatibility(
  metadata: any,
  style: string,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check incompatible_styles
  if (Array.isArray(metadata.incompatible_styles)) {
    for (const entry of metadata.incompatible_styles) {
      const name = normalizeStyleEntry(entry);
      if (name === style) {
        const reason = typeof entry === 'object' && entry.reason ? ` (${entry.reason})` : '';
        errors.push(`style "${style}" is incompatible with theme "${metadata.name}"${reason}`);
      }
    }
  }

  // Check partial_styles (warning, not error)
  if (Array.isArray(metadata.partial_styles)) {
    for (const entry of metadata.partial_styles) {
      const name = normalizeStyleEntry(entry);
      if (name === style) {
        const reason = typeof entry === 'object' && entry.reason ? ` (${entry.reason})` : '';
        warnings.push(`style "${style}" has partial compatibility with theme "${metadata.name}"${reason}`);
      }
    }
  }

  // If not in compatible_styles and not mentioned anywhere, warn
  if (Array.isArray(metadata.compatible_styles)) {
    const compatibleNames = new Set(
      metadata.compatible_styles.map((e: any) => normalizeStyleEntry(e)),
    );
    if (!compatibleNames.has(style) && errors.length === 0 && warnings.length === 0) {
      warnings.push(
        `style "${style}" is not listed in compatible_styles for theme "${metadata.name}"`,
      );
    }
  }

  return { errors, warnings };
}

// --- Main builder function ---

export function buildThemeDeck(options: BuildOptions): BuildResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 1. Load theme package
  const { pkg, errors: loadErrors } = loadThemePackage(options.root, options.theme);
  for (const e of loadErrors) {
    if (e.severity === 'error') errors.push(`[${e.file || 'load'}] ${e.message}`);
    else warnings.push(`[${e.file || 'load'}] ${e.message}`);
  }
  if (!pkg || errors.length > 0) {
    return {
      outputPath: options.outputPath || join(options.projectPath, 'lecture_v1.html'),
      html: '',
      warnings,
      errors,
    };
  }

  // 2. Validate theme package
  const validationErrors = validateThemePackage(pkg);
  for (const e of validationErrors) {
    if (e.severity === 'error') errors.push(`[validate:${e.field || e.file || ''}] ${e.message}`);
    else warnings.push(`[validate:${e.field || e.file || ''}] ${e.message}`);
  }

  // 3. Check theme/style compatibility
  const compat = checkCompatibility(pkg.metadata, options.style);
  errors.push(...compat.errors);
  warnings.push(...compat.warnings);

  // Fail on incompatibility errors
  if (errors.length > 0) {
    return {
      outputPath: options.outputPath || join(options.projectPath, 'lecture_v1.html'),
      html: '',
      warnings,
      errors,
    };
  }

  // 4. Read template.html
  let html = readFileSync(pkg.files.templateHtml, 'utf-8');

  // 5. Determine if this is a PPT-engine theme (has css_ppt_engine in metadata)
  const hasPptEngine = !!pkg.metadata.css_ppt_engine;

  // 6. Replace <!-- INJECT:title -->
  html = html.replace(MARKERS.title, escapeHtml(options.title));

  // 7. Replace <!-- INJECT:CSS --> with CSS link tags in correct order
  const cssLinks = buildCssLinks({
    root: options.root,
    theme: options.theme,
    style: options.style,
    hasPptEngine,
    cssRoot: options.cssRoot,
  });
  const cssHtml = cssLinksToHtml(cssLinks);
  html = html.replace(MARKERS.css, cssHtml);

  // 8. Replace <!-- INJECT:slides --> with empty string (runtime rendering)
  html = html.replace(MARKERS.slides, '');

  // 9. Replace // <!-- INJECT:slideData --> with const slideData = JSON.stringify(...)
  const slideDataJson = JSON.stringify(options.slideData, null, 2);
  const slideDataStatement = `const slideData = ${slideDataJson};`;
  html = html.replace(MARKERS.slideData, slideDataStatement);

  // 10. For PPT-engine themes: inline ppt-engine.js at placeholder location
  if (hasPptEngine) {
    const pptEnginePath = join(
      options.root,
      'docs/html-themes/themes/_shared/ppt-engine.js',
    );
    if (existsSync(pptEnginePath)) {
      const pptEngineJs = readFileSync(pptEnginePath, 'utf-8');
      // Replace the placeholder comment block with the actual JS content
      html = html.replace(PPT_ENGINE_PLACEHOLDER_RE, pptEngineJs + '\n');
    } else {
      errors.push(
        `ppt-engine.js not found at ${pptEnginePath} (required for PPT-engine theme "${options.theme}")`,
      );
    }
  }

  // 11. Validate: each marker was replaced exactly once, no duplicates, no missing
  for (const [key, marker] of Object.entries(MARKERS)) {
    const count = (html.match(new RegExp(escapeRegExp(marker), 'g')) || []).length;
    if (count > 0) {
      errors.push(`INJECT marker "${key}" still present after replacement (${count} occurrence(s))`);
    }
  }

  // 12. Set <html> attributes: data-theme, data-style
  html = html.replace(
    /<html\s+([^>]*)>/,
    (_match, attrs: string) => {
      // Remove existing data-theme and data-style
      let cleanAttrs = attrs
        .replace(/\s*data-theme="[^"]*"/, '')
        .replace(/\s*data-style="[^"]*"/, '');
      // Add new data-theme and data-style
      cleanAttrs = `data-theme="${options.theme}" data-style="${options.style}" ${cleanAttrs}`.trim();
      return `<html ${cleanAttrs}>`;
    },
  );

  // 13. Determine output path
  const outputPath = options.outputPath || resolveDefaultOutputPath(options);

  return {
    outputPath,
    html,
    warnings,
    errors,
  };
}

// --- Helpers ---

function resolveDefaultOutputPath(options: BuildOptions): string {
  const version = options.version || 'v1';
  return join(options.projectPath, `lecture_${version}.html`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
