// @version 2.0.0
// Validate html-themes structure for the unified region-based layout model
// (ADR-0045 — Decision #1 shared pool, Decision #2 region model, Decision #3 preview+scaffold).
//
// Checks:
//   1. Excludes themes/_shared/ from the theme scan (it is the shared base, not a theme).
//   2. Shared-pool integrity: each styles/<name>/ dir must contain style.css + pdf_color_spec.json.
//   3. theme.json consistency: every compatible_styles + partial_styles entry exists as a
//      styles/<name>/ dir; partial_styles entries should also be in compatible_styles (WARN if not).
//      incompatible_styles entries must carry a `reason` and validate the {name, reason} shape
//      but need not exist as a style directory.
//   4. Region schema (per pdf_layout_spec.json):
//        - each region value is null OR { x_pct, y_pct, w_pct, h_pct, fit? } with all *_pct ∈ [0,1];
//          fit ∈ {"contain","cover","fill"} when present.
//        - slide_types maps type → { regions: [...] } (array of region names).
//        - slide_type↔region cross-check (ERROR): every region name referenced by
//          slide_types[type].regions must resolve — either in top-level regions.* OR in
//          slide_type_overrides[type] (a per-type region-value override object).
//   5. Layer-0 check: themes/_shared/layout_base.json exists and has the region skeleton keys
//      (header,title,content,visual,meta,toc) + page + print.
//   6. deepMerge null semantics: region values that are null in the theme spec stay null
//      (informational only — this validator does not perform the merge; it asserts the skeleton
//      is null in layout_base.json so that base never accidentally fills a region the theme
//      intends to leave null).
//
// Usage:
//   bun scripts/co-deck/validate-theme-styles.ts [--root <path>]
//   --root  workspace root (default: two levels above this script)
// Exit codes: 0 = pass, 1 = validation errors found (warnings never fail).

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';

const args = process.argv.slice(2);
const get = (flag: string) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};

const rootArg = get('--root');
const workspaceRoot = rootArg ? resolve(rootArg) : resolve(dirname(import.meta.path), '../..');
const themesRoot = join(workspaceRoot, 'docs/html-themes/themes');
const stylesRoot = join(workspaceRoot, 'docs/html-themes/styles');
const sharedDir = join(themesRoot, '_shared');
const sharedLayout = join(sharedDir, 'layout_base.json');

let errors = 0;
let warnings = 0;

const err = (msg: string) => { console.error(`  ERROR: ${msg}`); errors++; };
const warn = (msg: string) => { console.warn(`  WARN:  ${msg}`); warnings++; };

const REGION_KEYS = ['header', 'title', 'content', 'visual', 'meta', 'toc'] as const;
const FIT_VALUES = new Set(['contain', 'cover', 'fill']);

function readJson(path: string, label: string): any | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (e: any) {
    err(`Failed to parse ${label}: ${e.message}`);
    return null;
  }
}

// Read styles/<name>/ dir only if it is a directory (skip stray files like base.css).
function listStyleDirs(): string[] {
  if (!existsSync(stylesRoot)) return [];
  return readdirSync(stylesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

// Read themes/ subdirectories, EXCLUDING _shared (the shared base is not a theme).
function listThemeDirs(): string[] {
  if (!existsSync(themesRoot)) return [];
  return readdirSync(themesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => d.name);
}

// Normalize a `*_styles` entry that may be a plain string ("classic") or a
// { name, reason? } object. Returns { name, reason, raw } or null if malformed.
function normalizeStyleEntry(entry: any, listName: string, theme: string): { name: string; reason?: string } | null {
  if (typeof entry === 'string') return { name: entry };
  if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
    return { name: entry.name, reason: entry.reason };
  }
  err(`theme "${theme}" ${listName} entry is not a string or {name, reason} object: ${JSON.stringify(entry)}`);
  return null;
}

// Validate a single region value: null OR {x_pct,y_pct,w_pct,h_pct,fit?}.
function validateRegionValue(value: any, label: string): void {
  if (value === null) return;
  if (typeof value !== 'object' || Array.isArray(value)) {
    err(`${label} must be null or a region object, got ${typeof value}`);
    return;
  }
  for (const k of ['x_pct', 'y_pct', 'w_pct', 'h_pct'] as const) {
    const v = value[k];
    if (typeof v !== 'number' || Number.isNaN(v)) {
      err(`${label}.${k} must be a number, got ${JSON.stringify(v)}`);
    } else if (v < 0 || v > 1) {
      err(`${label}.${k}=${v} out of [0,1] range`);
    }
  }
  if (value.fit !== undefined && !FIT_VALUES.has(value.fit)) {
    err(`${label}.fit="${value.fit}" must be one of contain|cover|fill`);
  }
}

// ── 0. Sanity: directories must exist ──────────────────────────────────────────

if (!existsSync(stylesRoot)) {
  err(`styles/ directory not found: ${stylesRoot}`);
}
if (!existsSync(themesRoot)) {
  err(`themes/ directory not found: ${themesRoot}`);
}
if (errors > 0) {
  console.error('\nvalidate-theme-styles FAILED (missing roots)');
  process.exit(1);
}

// ── 1. Shared-pool integrity: each styles/<name>/ has style.css + pdf_color_spec.json ──

const styleDirs = listStyleDirs();
for (const s of styleDirs) {
  const sDir = join(stylesRoot, s);
  const styleCss = join(sDir, 'style.css');
  const colorSpec = join(sDir, 'pdf_color_spec.json');
  if (!existsSync(styleCss)) err(`styles/${s}/style.css missing (required by shared-pool contract)`);
  if (!existsSync(colorSpec)) warn(`styles/${s}/pdf_color_spec.json missing (color spec incomplete)`);
}

// ── 2. Layer-0 check: themes/_shared/layout_base.json ──────────────────────────

if (!existsSync(sharedLayout)) {
  err(`themes/_shared/layout_base.json not found — Layer-0 shared base missing`);
} else {
  const base = readJson(sharedLayout, 'themes/_shared/layout_base.json');
  if (base) {
    if (typeof base.page !== 'object' || base.page === null) {
      err('themes/_shared/layout_base.json: "page" object missing');
    }
    if (typeof base.print !== 'object' || base.print === null) {
      err('themes/_shared/layout_base.json: "print" object missing');
    }
    if (typeof base.regions !== 'object' || base.regions === null) {
      err('themes/_shared/layout_base.json: "regions" object missing');
    } else {
      // Per spec §6 (deepMerge null semantics): base skeleton regions MUST be null so that
      // a theme leaving a region null stays null (base never fills it).
      for (const k of REGION_KEYS) {
        const v = base.regions[k];
        if (v === undefined) {
          err(`themes/_shared/layout_base.json: regions.${k} key missing from skeleton`);
        } else if (v !== null) {
          err(`themes/_shared/layout_base.json: regions.${k} must be null in Layer-0 (got ${JSON.stringify(v)}) — base must not pre-populate region values`);
        }
      }
    }
  }
}

// ── 3. Per-theme checks: theme.json + pdf_layout_spec.json ─────────────────────

const themeDirs = listThemeDirs();
const allReferencedStyles = new Set<string>();

for (const theme of themeDirs) {
  const themeDir = join(themesRoot, theme);
  const themeJsonPath = join(themeDir, 'theme.json');
  const specPath = join(themeDir, 'pdf_layout_spec.json');

  // 3a. theme.json exists + parses
  if (!existsSync(themeJsonPath)) {
    err(`themes/${theme}/theme.json missing`);
    continue;
  }
  const themeJson = readJson(themeJsonPath, `themes/${theme}/theme.json`);
  if (!themeJson) continue;

  // 3b. compatible_styles (string[])
  const compatibleRaw = themeJson.compatible_styles;
  if (!Array.isArray(compatibleRaw)) {
    err(`theme "${theme}": compatible_styles must be an array`);
  } else {
    for (const entry of compatibleRaw) {
      if (typeof entry !== 'string') {
        err(`theme "${theme}": compatible_styles entry must be a string, got ${JSON.stringify(entry)}`);
        continue;
      }
      allReferencedStyles.add(entry);
      if (!styleDirs.includes(entry)) {
        err(`theme "${theme}": compatible_styles lists "${entry}" but styles/${entry}/ does not exist`);
      }
    }
  }
  const compatibleSet = new Set<string>(Array.isArray(compatibleRaw) ? compatibleRaw.filter((x) => typeof x === 'string') : []);

  // 3c. partial_styles: each must exist as a style dir + ideally also be in compatible_styles (WARN)
  const partialRaw = themeJson.partial_styles ?? [];
  if (!Array.isArray(partialRaw)) {
    err(`theme "${theme}": partial_styles must be an array`);
  } else {
    for (const entry of partialRaw) {
      const norm = normalizeStyleEntry(entry, 'partial_styles', theme);
      if (!norm) continue;
      allReferencedStyles.add(norm.name);
      if (!styleDirs.includes(norm.name)) {
        err(`theme "${theme}": partial_styles lists "${norm.name}" but styles/${norm.name}/ does not exist`);
      }
      if (!compatibleSet.has(norm.name)) {
        warn(`theme "${theme}": partial_styles entry "${norm.name}" is not also in compatible_styles (usually partial implies compatible)`);
      }
      // reason recommended for partial_styles (informational — warn only)
      if (!norm.reason) {
        warn(`theme "${theme}": partial_styles entry "${norm.name}" has no "reason" field (recommended to document partial-ness)`);
      }
    }
  }

  // 3d. incompatible_styles: must document WHY ({name, reason}); existence as a style dir optional
  const incompatibleRaw = themeJson.incompatible_styles ?? [];
  if (!Array.isArray(incompatibleRaw)) {
    err(`theme "${theme}": incompatible_styles must be an array`);
  } else {
    for (const entry of incompatibleRaw) {
      // incompatible_styles entries MUST be {name, reason} objects — a bare string provides no WHY.
      if (typeof entry === 'string') {
        err(`theme "${theme}": incompatible_styles entry "${entry}" must be {name, reason} — bare strings omit the required WHY`);
        continue;
      }
      const norm = normalizeStyleEntry(entry, 'incompatible_styles', theme);
      if (!norm) continue;
      if (!norm.reason || typeof norm.reason !== 'string' || norm.reason.trim().length === 0) {
        err(`theme "${theme}": incompatible_styles entry "${norm.name}" must document WHY (non-empty "reason" field)`);
      }
      // Per task spec: incompatible_styles entries need NOT exist as styles — no existence check.
    }
  }

  // 3e. pdf_layout_spec.json exists + region schema
  if (!existsSync(specPath)) {
    err(`themes/${theme}/pdf_layout_spec.json missing`);
    continue;
  }
  const spec = readJson(specPath, `themes/${theme}/pdf_layout_spec.json`);
  if (!spec) continue;

  // regions: object with region keys, each value null or region object
  const regions = spec.regions;
  if (typeof regions !== 'object' || regions === null || Array.isArray(regions)) {
    err(`theme "${theme}": spec.regions must be an object`);
  } else {
    for (const [k, v] of Object.entries(regions as Record<string, any>)) {
      validateRegionValue(v, `theme "${theme}" regions.${k}`);
    }
  }

  // slide_types: object mapping type → { regions: [...] }
  const slideTypes = spec.slide_types;
  if (typeof slideTypes !== 'object' || slideTypes === null || Array.isArray(slideTypes)) {
    err(`theme "${theme}": spec.slide_types must be an object`);
  } else {
    const overrides = (typeof spec.slide_type_overrides === 'object' && spec.slide_type_overrides !== null)
      ? spec.slide_type_overrides as Record<string, any>
      : {};
    const regionKeys = (regions && typeof regions === 'object') ? new Set(Object.keys(regions)) : new Set<string>();

    for (const [type, typeDef] of Object.entries(slideTypes as Record<string, any>)) {
      if (typeof typeDef !== 'object' || typeDef === null || Array.isArray(typeDef)) {
        err(`theme "${theme}": slide_types.${type} must be an object`);
        continue;
      }
      const typeRegions = typeDef.regions;
      if (!Array.isArray(typeRegions)) {
        err(`theme "${theme}": slide_types.${type}.regions must be an array of region names`);
        continue;
      }
      // Cross-check: every referenced region name must resolve in regions.* OR slide_type_overrides[type]
      const typeOverride = overrides[type] && typeof overrides[type] === 'object' ? overrides[type] as Record<string, any> : {};
      for (const r of typeRegions) {
        if (typeof r !== 'string') {
          err(`theme "${theme}": slide_types.${type}.regions entry must be a string, got ${JSON.stringify(r)}`);
          continue;
        }
        const inRegions = regionKeys.has(r);
        const inOverride = r in typeOverride;
        if (!inRegions && !inOverride) {
          err(`theme "${theme}": slide_types.${type}.regions references "${r}" which is not in top-level regions.* nor slide_type_overrides.${type}`);
        }
      }
      // Validate override region values too (they are region objects)
      for (const [r, v] of Object.entries(typeOverride)) {
        validateRegionValue(v, `theme "${theme}" slide_type_overrides.${type}.${r}`);
      }
    }
  }
}

// ── 4. Orphan styles: not referenced by any theme ─────────────────────────────

for (const s of styleDirs) {
  if (!allReferencedStyles.has(s)) {
    warn(`styles/${s}/ exists but is not referenced by any theme's compatible_styles or partial_styles`);
  }
}

// ── 5. Report ─────────────────────────────────────────────────────────────────

console.log(`\nvalidate-theme-styles: themes=${themeDirs.length} styles=${styleDirs.length} (excluding _shared base)`);
if (errors > 0 || warnings > 0) {
  console.log(`  ${errors} error(s), ${warnings} warning(s)`);
}
if (errors > 0) {
  console.error('\nvalidate-theme-styles FAILED');
  process.exit(1);
}
console.log('validate-theme-styles PASSED');
