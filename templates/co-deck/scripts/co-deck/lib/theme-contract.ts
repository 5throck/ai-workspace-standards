// theme-contract.ts — typed interfaces and validation functions for theme packages.
//
// Defines the contract that every theme package must satisfy:
//   - 4 required files: template.html, theme.json, theme.css, pdf_layout_spec.json
//   - 4 required INJECT markers in template.html (each exactly once)
//   - theme.json schema validation (version, slide_types, style compatibility, CSS paths)
//   - Cross-check slide_types against pdf_layout_spec.json

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  listThemeDirs,
  listStyleDirs,
  normalizeStyleEntry,
  readJson,
  SLIDE_TYPE_HTML_TO_JSON,
  REQUIRED_THEME_FILES,
  REQUIRED_INJECT_MARKERS,
  resolveWorkspaceRoot,
} from './theme-utils.js';

// Re-export SLIDE_TYPE_HTML_TO_JSON for consumers of this module.
export { SLIDE_TYPE_HTML_TO_JSON };

// --- Type definitions ---

export interface ThemeMetadata {
  name: string;
  version: string;
  description?: string;
  rendering: {
    paradigm: string;
    slides_in_dom: string;
    navigation?: string;
    progress_indicator?: string;
  };
  content_rules: {
    max_bullets_per_slide?: number;
    max_title_chars?: number;
    recommended_slide_count?: string;
    notes?: string;
  };
  compatible_styles: (string | { name: string; reason?: string })[];
  partial_styles?: (string | { name: string; reason?: string })[];
  incompatible_styles?: (string | { name: string; reason?: string })[];
  recommended_structure?: any;
  requires_slideData?: boolean;
  toc_required?: boolean;
  slide_types: Record<string, boolean>;
  css_base?: string;
  css_ppt_engine?: string;
  css_theme?: string;
  based_on?: string;
  added?: string;
  author?: string;
  [key: string]: any; // allow version_num or other fields
}

export interface ThemePackage {
  name: string;
  root: string;
  dir: string;
  metadata: ThemeMetadata;
  files: {
    templateHtml: string;
    themeJson: string;
    themeCss: string;
    pdfLayoutSpec: string;
  };
  injectMarkers: string[]; // markers found in template.html
}

export interface ValidationError {
  file?: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

// --- Helper: extract INJECT markers from template.html content ---

function extractInjectMarkers(htmlContent: string): string[] {
  const pattern = /INJECT:\w+/g;
  const matches = htmlContent.match(pattern);
  return matches ? [...new Set(matches)] : [];
}

// --- Load a theme package from disk ---

export function loadThemePackage(
  root: string,
  name: string,
): { pkg: ThemePackage | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const themesRoot = join(root, 'docs/html-themes/themes');

  // Verify the theme directory exists among the known theme dirs.
  const knownThemes = listThemeDirs(root);
  if (!knownThemes.includes(name)) {
    // It might still exist on disk; don't fatal here — check existence directly.
  }

  const dir = join(themesRoot, name);
  if (!existsSync(dir)) {
    errors.push({ message: `theme directory not found: ${dir}`, severity: 'error' });
    return { pkg: null, errors };
  }

  // Check all 4 required files exist.
  const fileMap: Record<string, string> = {};
  for (const fname of REQUIRED_THEME_FILES) {
    const fpath = join(dir, fname);
    if (!existsSync(fpath)) {
      errors.push({ file: fname, message: `required file missing: ${fname}`, severity: 'error' });
    } else {
      fileMap[fname] = fpath;
    }
  }

  // If any required file is missing, we cannot build a full package.
  if (Object.keys(fileMap).length < REQUIRED_THEME_FILES.length) {
    return { pkg: null, errors };
  }

  // Parse theme.json.
  const metadata = readJson<ThemeMetadata>(fileMap['theme.json']);
  if (!metadata) {
    errors.push({
      file: 'theme.json',
      message: 'failed to parse theme.json',
      severity: 'error',
    });
    return { pkg: null, errors };
  }

  // Extract INJECT markers from template.html.
  const templateHtml = readFileSync(fileMap['template.html'], 'utf-8');
  const injectMarkers = extractInjectMarkers(templateHtml);

  const pkg: ThemePackage = {
    name,
    root,
    dir,
    metadata,
    files: {
      templateHtml: fileMap['template.html'],
      themeJson: fileMap['theme.json'],
      themeCss: fileMap['theme.css'],
      pdfLayoutSpec: fileMap['pdf_layout_spec.json'],
    },
    injectMarkers,
  };

  return { pkg, errors };
}

// --- Validate a loaded theme package ---

export function validateThemePackage(pkg: ThemePackage): ValidationError[] {
  const errors: ValidationError[] = [];
  const { metadata } = pkg;
  const name = pkg.name;

  // 1. All 4 required files exist (already guaranteed by loadThemePackage,
  //    but double-check for defensive validation).
  for (const fname of REQUIRED_THEME_FILES) {
    const key = fname === 'template.html' ? 'templateHtml'
      : fname === 'theme.json' ? 'themeJson'
      : fname === 'theme.css' ? 'themeCss'
      : 'pdfLayoutSpec';
    if (!pkg.files[key as keyof typeof pkg.files]) {
      errors.push({ file: fname, message: `required file missing: ${fname}`, severity: 'error' });
    }
  }

  // 2. All 4 required INJECT markers exist in template.html (exactly once).
  for (const marker of REQUIRED_INJECT_MARKERS) {
    if (!pkg.injectMarkers.includes(marker)) {
      errors.push({
        file: 'template.html',
        message: `required INJECT marker missing: ${marker}`,
        severity: 'error',
      });
    }
  }
  // Check for duplicates (markers that appear more than once).
  const templateHtml = readFileSync(pkg.files.templateHtml, 'utf-8');
  for (const marker of REQUIRED_INJECT_MARKERS) {
    const count = (templateHtml.match(new RegExp(marker.replace(':', ':'), 'g')) || []).length;
    if (count > 1) {
      errors.push({
        file: 'template.html',
        message: `INJECT marker "${marker}" appears ${count} times (expected exactly 1)`,
        severity: 'warning',
      });
    }
  }

  // 3. No style is simultaneously in compatible_styles AND incompatible_styles.
  const compatibleNames = new Set<string>();
  if (Array.isArray(metadata.compatible_styles)) {
    for (const entry of metadata.compatible_styles) {
      const n = normalizeStyleEntry(entry);
      if (n) compatibleNames.add(n);
    }
  }
  const incompatibleNames = new Set<string>();
  if (Array.isArray(metadata.incompatible_styles)) {
    for (const entry of metadata.incompatible_styles) {
      const n = normalizeStyleEntry(entry);
      if (n) incompatibleNames.add(n);
    }
  }
  for (const style of compatibleNames) {
    if (incompatibleNames.has(style)) {
      errors.push({
        field: 'compatible_styles/incompatible_styles',
        message: `style "${style}" appears simultaneously in compatible_styles and incompatible_styles`,
        severity: 'error',
      });
    }
  }

  // 4. partial_styles is optional (undefined = no partials). No error needed.
  //    But warn if it exists and is not an array.
  if (metadata.partial_styles !== undefined && !Array.isArray(metadata.partial_styles)) {
    errors.push({
      field: 'partial_styles',
      message: 'partial_styles must be an array or undefined',
      severity: 'error',
    });
  }

  // 5. All declared CSS paths start with "docs/html-themes/".
  const cssFields = ['css_base', 'css_ppt_engine', 'css_theme'] as const;
  for (const field of cssFields) {
    const val = metadata[field];
    if (val !== undefined && typeof val === 'string') {
      if (!val.startsWith('docs/html-themes/')) {
        errors.push({
          field,
          message: `${field} path "${val}" does not start with "docs/html-themes/"`,
          severity: 'error',
        });
      }
    }
  }

  // 6. version field exists (canonical; version_num ignored if present).
  if (!metadata.version || typeof metadata.version !== 'string') {
    errors.push({
      field: 'version',
      message: 'theme must have a "version" string field',
      severity: 'error',
    });
  }

  // 7. slide_types keys match expected set.
  const expectedSlideTypes = ['title', 'divider', 'profile', 'standard', 'contact', 'punchline'];
  const declaredTypes = metadata.slide_types ? Object.keys(metadata.slide_types) : [];
  for (const t of expectedSlideTypes) {
    if (!declaredTypes.includes(t)) {
      errors.push({
        field: 'slide_types',
        message: `expected slide_type "${t}" missing from theme.json`,
        severity: 'warning',
      });
    }
  }
  for (const t of declaredTypes) {
    if (!expectedSlideTypes.includes(t)) {
      errors.push({
        field: 'slide_types',
        message: `unexpected slide_type "${t}" in theme.json`,
        severity: 'warning',
      });
    }
  }

  // 8. Cross-check slide_types against pdf_layout_spec.json.slide_types.
  const spec = readJson<any>(pkg.files.pdfLayoutSpec);
  if (spec && spec.slide_types) {
    const specTypes = Object.keys(spec.slide_types);
    // Apply SLIDE_TYPE_HTML_TO_JSON mapping: theme.json uses JSON names already.
    for (const htmlType of Object.keys(SLIDE_TYPE_HTML_TO_JSON)) {
      const jsonType = SLIDE_TYPE_HTML_TO_JSON[htmlType as keyof typeof SLIDE_TYPE_HTML_TO_JSON];
      if (declaredTypes.includes(htmlType) && !declaredTypes.includes(jsonType)) {
        errors.push({
          field: 'slide_types',
          message: `theme.json uses HTML type "${htmlType}" instead of JSON type "${jsonType}"`,
          severity: 'warning',
        });
      }
    }
    // Warn about types in theme.json not in pdf_layout_spec.
    for (const t of declaredTypes) {
      if (!specTypes.includes(t)) {
        errors.push({
          field: 'slide_types',
          message: `slide_type "${t}" declared in theme.json but missing from pdf_layout_spec.json`,
          severity: 'warning',
        });
      }
    }
    // Warn about types in pdf_layout_spec not in theme.json.
    for (const t of specTypes) {
      if (!declaredTypes.includes(t)) {
        errors.push({
          field: 'slide_types',
          message: `slide_type "${t}" in pdf_layout_spec.json but missing from theme.json`,
          severity: 'warning',
        });
      }
    }
  }

  return errors;
}
