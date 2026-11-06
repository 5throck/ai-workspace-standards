// @version 1.0.0 — shared layout_overrides / frontmatter parsing (U-20261105-003).
//
// Single implementation of the lecture-profile.md frontmatter dialect used by
// BOTH estimate-layout.ts (layout gate) and gen-slides-pdf.ts (PDF renderer).
// Before this module the two scripts carried divergent private parsers:
// estimate-layout accepted flat + DOTTED keys (`fonts.title_px: 40`) but not
// nested blocks; gen-slides-pdf accepted nested + flat keys but SILENTLY
// dropped dotted keys — a dotted override passed the lint gate and then never
// reached the renderer (U-20261105-003).
//
// This module accepts the UNION dialect:
//   1. flat:            `title_px: 40`
//   2. dotted:          `fonts.title_px: 40`, `colors.card_dark: [R, G, B]`
//   3. nested-indented: `fonts:` + 2-space-indented `title_px: 40`
// so the gate and the renderer always see the same merged spec.
//
// Usage: import { parseFrontmatter, parseLayoutOverrides, parseScalar, deepMerge }
// from '../lib/layout-overrides';

/**
 * Recursively merge `override` onto `base` (objects merge, scalars/arrays
 * replace, explicit null clears the slot). Shared so both consumers merge
 * spec layers identically.
 */
export function deepMerge(base: any, override: any): any {
  if (!override) return base;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (override[key] === null) {
      result[key] = null;
    } else if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
      result[key] = deepMerge(base[key] ?? {}, override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/** Parse a YAML-ish scalar: [R,G,B] array, number, boolean, or string. */
export function parseScalar(raw: string): any {
  const arrMatch = raw.match(/^\[(\d+),\s*(\d+),\s*(\d+)\]$/);
  if (arrMatch) return [Number(arrMatch[1]), Number(arrMatch[2]), Number(arrMatch[3])];
  if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.replace(/^["']|["']$/g, '');
}

/** Assign a possibly-dotted key (`fonts.title_px`) as a nested object path.
 * Plain-object leaves merge (a dotted `fonts.title_px` line followed by a
 * nested `fonts:` block must combine, not clobber — the mixed-form profiles
 * documented in U-20261105-003 rely on this). */
function assignDotted(target: Record<string, any>, dottedKey: string, val: any): void {
  const keys = dottedKey.split('.');
  let node = target;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (typeof node[k] !== 'object' || node[k] === null || Array.isArray(node[k])) {
      node[k] = {};
    }
    node = node[k];
  }
  const leaf = keys[keys.length - 1];
  const isPlainObj = (v: any) => typeof v === 'object' && v !== null && !Array.isArray(v);
  if (isPlainObj(node[leaf]) && isPlainObj(val)) {
    node[leaf] = { ...node[leaf], ...val };
  } else {
    node[leaf] = val;
  }
}

/**
 * Parse the indented `layout_overrides:` block from frontmatter content.
 * Accepts nested blocks AND dotted keys on the same lines (union dialect).
 */
export function parseLayoutOverrides(frontmatterContent: string): Record<string, any> {
  const lines = frontmatterContent.split('\n');

  // Find the layout_overrides: line (uncommented)
  let startIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === 'layout_overrides:' && !lines[i].trimStart().startsWith('#')) {
      startIdx = i;
      break;
    }
  }
  if (startIdx === -1) return {};

  // Collect subsequent indented uncommented lines; the block ends at the
  // first non-blank line dedented to column 0 (a top-level frontmatter key).
  const block: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // skip blank/comment
    if (line.length > 0 && line[0] !== ' ') break;
    block.push(line);
  }
  if (block.length === 0) return {};

  const result: Record<string, any> = {};
  const baseIndent = block.reduce((min, l) => {
    const ind = l.search(/\S/);
    return ind >= 0 ? Math.min(min, ind) : min;
  }, Infinity);
  parseOverrideLines(block, 0, baseIndent, result);
  return result;
}

/**
 * Walk block lines starting at `start`, reading entries at `indent` (the
 * minimum indent of the block). Deeper-indented lines following a key with no
 * value form a nested block; keys containing '.' are expanded to object paths
 * (U-20261105-003 — previously silently dropped by gen-slides-pdf).
 */
function parseOverrideLines(
  lines: string[],
  start: number,
  indent: number,
  result: Record<string, any>,
): number {
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const lineIndent = line.search(/\S/);
    if (lineIndent < 0) { i++; continue; }   // blank
    if (lineIndent < indent) break;          // dedent — parent scope resumes
    if (lineIndent > indent) { i++; continue; } // unexpected deeper line, skip

    const trimmed = line.trim();
    if (trimmed.startsWith('#')) { i++; continue; }

    const match = trimmed.match(/^([\w_-]+(?:\.[\w_-]+)*):\s*(.*)/);
    if (!match) { i++; continue; }

    const key = match[1];
    const rawVal = match[2].trim();

    if (!rawVal) {
      // No inline value — either a nested indented block or a dangling key.
      // Detect the actual indent of the next non-blank line.
      let next = i + 1;
      while (next < lines.length && lines[next].search(/\S/) < 0) next++;
      const nextIndent = next < lines.length ? lines[next].search(/\S/) : -1;
      if (nextIndent > indent) {
        const child: Record<string, any> = {};
        const consumed = parseOverrideLines(lines, next, nextIndent, child);
        // Dotted parent (`fonts.` prefix) merges with nested children.
        assignDotted(result, key, child);
        i = next + consumed;
      } else {
        assignDotted(result, key, {});
        i++;
      }
      continue;
    }

    assignDotted(result, key, parseScalar(rawVal));
    i++;
  }
  return i - start;
}

/**
 * Parse the `--- ... ---` frontmatter of lecture-profile.md: theme/style pair
 * plus the layout_overrides block. CRLF/CR normalized (Windows-saved profiles).
 */
export function parseFrontmatter(content: string): Record<string, any> {
  const normalized = content.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fm = match[1];
  const lines = fm.split('\n');
  const result: Record<string, any> = {};
  for (const line of lines) {
    const themeMatch = line.match(/^\s{2}theme:\s*(\S+)/);
    const styleMatch = line.match(/^\s{2}style:\s*(\S+)/);
    if (themeMatch) result.theme = themeMatch[1];
    if (styleMatch) result.style = styleMatch[1];
  }
  const overrides = parseLayoutOverrides(fm);
  if (Object.keys(overrides).length > 0) {
    result.layout_overrides = overrides;
  }
  return result;
}
