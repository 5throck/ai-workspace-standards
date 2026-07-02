// @version 2.0.0
// scaffold-theme-style.ts
//
// Scaffold a new co-deck html-theme or style with the correct file layout,
// then regenerate themes-manifest.js so the new entry is immediately previewable.
//
// Usage:
//   bun scripts/co-deck/scaffold-theme-style.ts --theme <name>
//   bun scripts/co-deck/scaffold-theme-style.ts --theme <name> --from <source-theme>
//   bun scripts/co-deck/scaffold-theme-style.ts --style <name>
//   bun scripts/co-deck/scaffold-theme-style.ts --theme <name> --style <name>
//   bun scripts/co-deck/scaffold-theme-style.ts --help
//
// Behavior:
//   --theme <name>  creates themes/<name>/{template.html, theme.json, theme.css,
//                   pdf_layout_spec.json} with minimally valid content.
//   --from <theme>  (with --theme) derive from an existing theme: copy template.html
//                   and theme.css as starting point, set based_on + author in theme.json.
//   --style <name>  creates styles/<name>/{style.css, pdf_color_spec.json} as
//                   adapted copies of an existing style (default: classic).
//   Either or both flags may be supplied. Existing directories are NEVER
//   overwritten — the script errors out instead.
//
// After scaffolding, the manifest is regenerated automatically so the new
// theme/style appears in preview.html dropdowns. Open preview.html to view.
//
// Boundary: this script operates only on files under templates/co-deck/docs/html-themes/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { resolveWorkspaceRoot, getArg } from './lib/theme-utils.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`scaffold-theme-style.ts — create a new co-deck html-theme or style.

Usage:
  bun scripts/co-deck/scaffold-theme-style.ts --theme <name>
  bun scripts/co-deck/scaffold-theme-style.ts --theme <name> --from <source-theme>
  bun scripts/co-deck/scaffold-theme-style.ts --style <name>
  bun scripts/co-deck/scaffold-theme-style.ts --theme <name> --style <name>

Options:
  --from <theme>  Derive from an existing theme (copies template.html + theme.css,
                  sets based_on + author in theme.json). Must be used with --theme.

After scaffolding, the themes manifest is regenerated. Open:
  docs/html-themes/preview/preview.html?theme=<theme>
`);
  process.exit(0);
}

const workspaceRoot = resolveWorkspaceRoot(import.meta.path);
const themesRoot = join(workspaceRoot, 'docs/html-themes/themes');
const stylesRoot = join(workspaceRoot, 'docs/html-themes/styles');

const themeName = getArg(args, '--theme');
const styleName = getArg(args, '--style');
const fromTheme = getArg(args, '--from');

if (!themeName && !styleName) {
  console.error('ERROR: must supply at least one of --theme <name> or --style <name>. Use --help for usage.');
  process.exit(1);
}

if (fromTheme && !themeName) {
  console.error('ERROR: --from requires --theme. Use --help for usage.');
  process.exit(1);
}

// Validate name (safe identifier — used as a directory name).
const NAME_RE = /^[a-z][a-z0-9-]*$/;
function validateName(name: string, kind: string) {
  if (!NAME_RE.test(name)) {
    console.error(`ERROR: ${kind} name "${name}" must match ${NAME_RE} (lowercase, digits, hyphens; must start with a letter).`);
    process.exit(1);
  }
}

// ── Stub templates ─────────────────────────────────────────────────────────────

const THEME_JSON_STUB = (name: string, basedOn?: string) => `{
  "name": "${name}",
  "version": "0.1.0",
  "description": "TODO: describe the ${name} theme (rendering paradigm, navigation, layout intent).",
  "rendering": {
    "paradigm": "TODO",
    "slides_in_dom": "TODO",
    "navigation": "TODO",
    "progress_indicator": "TODO"
  },
  "content_rules": {
    "max_bullets_per_slide": 5,
    "max_title_chars": 30,
    "recommended_slide_count": "TODO",
    "notes": "TODO"
  },
  "compatible_styles": ["classic"],
  "partial_styles": [],
  "incompatible_styles": [],
  "recommended_structure": {
    "pattern": "TODO",
    "audience_fit": [],
    "notes": "TODO"
  },
  "requires_slideData": true,
  "toc_required": false,
  "slide_types": {
    "title": true,
    "divider": true,
    "punchline": false,
    "standard": true,
    "profile": false,
    "contact": false
  },
  "css_base": "docs/html-themes/styles/base.css",
  "css_theme": "docs/html-themes/themes/${name}/theme.css",
  "added": "${new Date().toISOString().slice(0, 10)}",
  "author": "${basedOn ? 'scaffold-derived' : 'co-deck'}"${basedOn ? `,\n  "based_on": "${basedOn}"` : ''}
}
`;

// Region skeleton — all null by default (matches layout_base.json Layer-0 shape).
// Per ADR-0045 Decision #2 deepMerge semantics: null stays null; populate as needed.
const PDF_LAYOUT_SPEC_STUB = (name: string) => `{
  "version": "1.2.0",
  "_comment": "${name} theme — region schema (ADR-0045 Decision #2). Populate region values and slide_types; leave unused regions null. Layer-0 defaults are inherited from themes/_shared/layout_base.json.",
  "page": {
    "width_mm": 338.7,
    "height_mm": 190.5,
    "margin_mm": 5.0,
    "aspect_ratio": "16:9"
  },
  "regions": {
    "header":  null,
    "title":   null,
    "content": null,
    "visual":  null,
    "meta":    null,
    "toc":     null
  },
  "slide_types": {},
  "slide_type_overrides": {},
  "fonts": {},
  "line_heights": {},
  "image_zones": {},
  "toc": null,
  "content_constraints": {},
  "print": {
    "bleed_mm": 0.0,
    "crop_marks": false,
    "page_numbers": true,
    "page_number_position": "bottom-right"
  }
}
`;

const THEME_CSS_STUB = (name: string) => `/**
 * theme.css — co-deck theme: ${name}
 *
 * TODO: describe this theme's visual intent and the CSS variables it overrides
 * on top of styles/base.css. Theme CSS sits at Layer 1 (per ADR-0045): it provides
 * layout/structure, while a style (Layer 2) provides color/typography personality.
 *
 * Loaded AFTER styles/base.css and BEFORE styles/<style>/style.css.
 */

:root {
  /* Theme-specific layout variables */
  --slide-layout: vertical;
  --slide-padding: 3rem;
  --title-font-size: 2rem;
  --bullet-font-size: 1rem;
  --section-font-size: 0.75rem;
}

/* Slide container base */
.slide {
  display: flex;
  flex-direction: column;
}

/* Title slide */
.slide[data-type="title"] {
  justify-content: center;
  align-items: center;
  text-align: center;
}

/* Standard content slide */
.slide[data-type="standard"] {
  padding: var(--slide-padding);
}

/* Divider slide */
.slide[data-type="divider"] {
  justify-content: center;
  align-items: center;
  text-align: center;
}
`;

const TEMPLATE_HTML_STUB = (name: string) => `<!DOCTYPE html>
<html lang="en" data-theme="${name}" data-style="classic">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><!-- INJECT:title --></title>
  <!-- INJECT:CSS -->
</head>
<body>
  <div class="${name}-root">
    <div id="presentation" class="presentation"></div>
  </div>
  <script>
    // <!-- INJECT:slideData -->
    <!-- INJECT:slides -->
  </script>
</body>
</html>
`;

// ── Scaffolder ─────────────────────────────────────────────────────────────────

function refuseIfExists(dir: string, label: string) {
  if (existsSync(dir)) {
    console.error(`ERROR: ${label} already exists — refusing to overwrite: ${dir}`);
    process.exit(1);
  }
}

function scaffoldTheme(name: string) {
  validateName(name, 'theme');
  const dir = join(themesRoot, name);
  refuseIfExists(dir, `theme "${name}"`);

  // If --from is specified, validate the source theme exists
  if (fromTheme) {
    validateName(fromTheme, 'source theme');
    const fromDir = join(themesRoot, fromTheme);
    if (!existsSync(fromDir)) {
      console.error(`ERROR: source theme "${fromTheme}" not found at ${fromDir}`);
      process.exit(1);
    }
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'theme.json'), THEME_JSON_STUB(name, fromTheme), 'utf-8');
  writeFileSync(join(dir, 'pdf_layout_spec.json'), PDF_LAYOUT_SPEC_STUB(name), 'utf-8');

  if (fromTheme) {
    // Derive from existing theme: copy template.html and theme.css as starting point
    const fromDir = join(themesRoot, fromTheme);
    const srcTemplate = join(fromDir, 'template.html');
    const srcCss = join(fromDir, 'theme.css');

    if (existsSync(srcTemplate)) {
      const templateContent = readFileSync(srcTemplate, 'utf-8');
      // Update theme references in the template
      const adaptedTemplate = templateContent
        .replace(new RegExp(`data-theme="${fromTheme}"`, 'g'), `data-theme="${name}"`)
        .replace(new RegExp(`${fromTheme}-root`, 'g'), `${name}-root`);
      writeFileSync(join(dir, 'template.html'), adaptedTemplate, 'utf-8');
    } else {
      writeFileSync(join(dir, 'template.html'), TEMPLATE_HTML_STUB(name), 'utf-8');
      console.warn(`  WARNING: source template.html not found in ${fromTheme}, using stub`);
    }

    if (existsSync(srcCss)) {
      const cssContent = readFileSync(srcCss, 'utf-8');
      // Update header comment to identify derived theme
      const adaptedCss = cssContent
        .replace(/co-deck theme: \w+/, `co-deck theme: ${name}`)
        .replace(/\/\*\*[\s\S]*?\*\//, `/**\n * theme.css — co-deck theme: ${name}\n * Derived from: ${fromTheme}\n * TODO: customize theme-specific CSS variables.\n */`);
      writeFileSync(join(dir, 'theme.css'), adaptedCss, 'utf-8');
    } else {
      writeFileSync(join(dir, 'theme.css'), THEME_CSS_STUB(name), 'utf-8');
      console.warn(`  WARNING: source theme.css not found in ${fromTheme}, using stub`);
    }

    console.log(`✓ scaffolded theme: themes/${name}/  (derived from ${fromTheme}: template.html, theme.css, theme.json, pdf_layout_spec.json)`);
  } else {
    writeFileSync(join(dir, 'theme.css'), THEME_CSS_STUB(name), 'utf-8');
    writeFileSync(join(dir, 'template.html'), TEMPLATE_HTML_STUB(name), 'utf-8');
    console.log(`✓ scaffolded theme: themes/${name}/  (theme.json, theme.css, template.html, pdf_layout_spec.json)`);
  }
}

function scaffoldStyle(name: string) {
  validateName(name, 'style');
  const dir = join(stylesRoot, name);
  refuseIfExists(dir, `style "${name}"`);
  // Copy from an existing style if available (default: classic); otherwise emit bare stubs.
  const sourceStyle = ['classic', 'minimal', 'academic'].find((s) => existsSync(join(stylesRoot, s, 'style.css')));
  mkdirSync(dir, { recursive: true });
  if (sourceStyle) {
    const srcCss = readFileSync(join(stylesRoot, sourceStyle, 'style.css'), 'utf-8');
    const srcSpec = readFileSync(join(stylesRoot, sourceStyle, 'pdf_color_spec.json'), 'utf-8');
    // Rewrite the header comment + name so the copy clearly identifies itself.
    const adaptedCss = srcCss.replace(/style: \w+/i, `style: ${name}`).replace(/co-deck style:.*$/m, `co-deck style: ${name} (adapted from ${sourceStyle})`);
    writeFileSync(join(dir, 'style.css'), `/**\n * style.css — co-deck style: ${name}\n * Adapted from ${sourceStyle}. TODO: tune colors/typography for this style.\n */\n` + adaptedCss.replace(/^\/\*\*[\s\S]*?\*\//, ''), 'utf-8');
    writeFileSync(join(dir, 'pdf_color_spec.json'), srcSpec, 'utf-8');
    console.log(`✓ scaffolded style: styles/${name}/  (adapted from ${sourceStyle}: style.css, pdf_color_spec.json)`);
  } else {
    writeFileSync(join(dir, 'style.css'), `/**\n * style.css — co-deck style: ${name}\n * TODO: declare CSS variables (colors, typography) consumed by themes.\n */\n:root {\n  /* TODO */\n}\n`, 'utf-8');
    writeFileSync(join(dir, 'pdf_color_spec.json'), `{\n  "version": "1.0.0",\n  "colors": {\n    \"background\": [17, 24, 39]\n  }\n}\n`, 'utf-8');
    console.log(`✓ scaffolded style: styles/${name}/  (bare stubs — no template style found to copy)`);
  }
}

if (themeName) scaffoldTheme(themeName);
if (styleName) scaffoldStyle(styleName);

// ── Regenerate the manifest so the new entry is previewable ───────────────────
// Re-exec the generator in-process is awkward; shell out to it instead so logic
// stays single-source.
import { spawnSync } from 'child_process';
const genScript = join(dirname(import.meta.path), 'generate-themes-manifest.ts');
const genResult = spawnSync(process.execPath, [genScript], { encoding: 'utf-8' });
if (genResult.error || genResult.status !== 0) {
  console.error('WARNING: manifest regeneration failed — preview.html dropdowns may be stale.');
  console.error(genResult.stderr || genResult.stdout);
} else {
  console.log(genResult.stdout.trim());
}

// ── Next steps ─────────────────────────────────────────────────────────────────
console.log('\nNext steps:');
if (themeName && fromTheme) console.log(`  • Customize themes/${themeName}/template.html and theme.css (derived from ${fromTheme})`);
if (themeName) console.log(`  • Edit themes/${themeName}/theme.json (description, compatible_styles)`);
if (themeName) console.log(`  • Populate themes/${themeName}/pdf_layout_spec.json regions + slide_types`);
if (themeName) console.log(`  • Run: bun scripts/co-deck/verify-new-theme.ts ${themeName} --fast`);
if (styleName) console.log(`  • Tune styles/${styleName}/style.css (colors, typography)`);
console.log('  • Open: docs/html-themes/preview/preview.html' + (themeName ? `?theme=${themeName}` : ''));
