#!/usr/bin/env bun
/**
 * Shared Marker Parser
 * @version 1.2.0
 *
 * Common marker parsing logic for:
 * - propagate-to-templates.ts (marker-rewrite engine)
 * - verify-adr-governance.ts (governance linkage gap detection)
 * - lifecycle-sync-audit.ts (Check D intentional-duplicate registry)
 *
 * Parses two marker types:
 * 1. Marker zones: <!-- COMMON-<DOMAIN>:START --> ... <!-- COMMON-<DOMAIN>:END -->
 * 2. Intentional-duplicate markers:
 *    <!-- intentional-duplicate: <name> — <reason>; source: <path>; hash: <sha256-8> -->
 *
 * Maintains ADR-0062 requirement: shared parser ensures rewrite engine and strict gate
 * agree on marker syntax and hash computation.
 *
 * v1.2.0: grammar-complete parseIntentionalDuplicateLine() (T-20260912-029) —
 *          a line parses only when it contains a COMPLETE one-line comment
 *          (<!-- ... -->) whose name carries the workspace standards §<digits>
 *          grammar; the name/reason split keys on the em-dash separator.
 *          scanIntentionalDuplicateMarkers() refactored onto it with no
 *          behavior change (complete-form + section-number were already its
 *          exact acceptance conditions).
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '../..');

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Represents a parsed marker zone (<!-- COMMON-<DOMAIN>:START/END -->)
 */
export interface MarkerZone {
  /** Marker name (e.g., "COMMON-AGENTS", "COMMON-CLAUDE") */
  marker: string;
  /** Start line number (1-indexed) */
  startLine: number;
  /** End line number (1-indexed) */
  endLine: number;
  /** Full content including markers */
  fullBlock: string;
  /** Content between markers (excluding the marker lines themselves) */
  innerContent: string;
}

/**
 * Represents an intentional-duplicate marker
 */
export interface IntentionalDuplicateMarker {
  /** File path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Section number (e.g., "3", "8") */
  section: string;
  /** Full marker text */
  text: string;
  /** Resolved source path (if present) */
  source: string | null;
  /** Hash value (if present) */
  hash: string | null;
}

/**
 * Result of marker zone extraction
 */
export interface ZoneExtractionResult {
  /** Marker name */
  marker: string;
  /** First heading found inside the block (for identification) */
  heading: string;
  /** Full block including markers */
  fullBlock: string;
}

// ============================================================================
// MARKER ZONE PARSING
// ============================================================================

/**
 * Extract all marker zones from content
 * @param content - File content to scan
 * @param marker - Marker name (e.g., "COMMON-AGENTS")
 * @returns Array of zone extraction results
 */
export function extractMarkerZones(content: string, marker: string): ZoneExtractionResult[] {
  const results: ZoneExtractionResult[] = [];
  const startTag = `<!-- ${marker}:START -->`;
  const endTag = `<!-- ${marker}:END -->`;

  let pos = 0;
  while (true) {
    const startIdx = content.indexOf(startTag, pos);
    if (startIdx === -1) break;
    const endIdx = content.indexOf(endTag, startIdx);
    if (endIdx === -1) break;

    const block = content.slice(startIdx, endIdx + endTag.length);
    // Use first heading found inside the block as the section identifier
    const headingMatch = block.match(/^#{1,4}\s+.+$/m);
    const heading = headingMatch ? headingMatch[0] : `section-${results.length}`;
    results.push({ heading, fullBlock: block, marker });
    pos = endIdx + endTag.length;
  }
  return results;
}

/**
 * Find all marker zones in a file
 * @param filePath - Absolute path to file
 * @returns Array of marker zones
 */
export function findMarkerZones(filePath: string): MarkerZone[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const zones: MarkerZone[] = [];

  // Pattern for both START and END markers
  const markerPattern = /<!--\s*(COMMON-[^:]+):(START|END)\s*-->/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(markerPattern);

    if (match && match[2] === 'START') {
      const marker = match[1];
      const startLine = i + 1; // 1-indexed

      // Find corresponding END marker
      let endLine = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const endMatch = lines[j].match(new RegExp(`<!--\\s*${marker}:END\\s*-->`));
        if (endMatch) {
          endLine = j + 1;
          break;
        }
      }

      if (endLine !== -1) {
        // Extract full block (including markers)
        const fullBlock = lines.slice(i, endLine).join('\n');
        // Extract inner content (excluding markers)
        const innerContent = lines.slice(i + 1, endLine - 1).join('\n');

        zones.push({
          marker,
          startLine,
          endLine,
          fullBlock,
          innerContent,
        });

        // Skip to end of this zone
        i = endLine - 1;
      }
    }
  }

  return zones;
}

// ============================================================================
// INTENTIONAL-DUPLICATE MARKER PARSING
// ============================================================================

/**
 * Parse section number from marker text (e.g., "workspace standards §8" -> "8")
 */
export function parseSectionNumber(markerText: string): string | null {
  const match = markerText.match(/workspace standards §(\d+)/);
  return match ? match[1] : null;
}

/**
 * Parse marker fields from comment text
 * Extracts section, source, and hash if present
 */
export function parseMarkerFields(markerText: string): {
  section: string | null;
  source: string | null;
  hash: string | null;
} {
  const sectionMatch = markerText.match(/workspace standards §(\d+)/);
  const section = sectionMatch ? sectionMatch[1] : null;

  const sourceMatch = markerText.match(/source:\s*([^\s;]+)/);
  const source = sourceMatch ? sourceMatch[1] : null;

  const hashMatch = markerText.match(/hash:\s*([0-9a-f]{8})/);
  const hash = hashMatch ? hashMatch[1] : null;

  return { section, source, hash };
}

/**
 * A grammar-complete parse of one intentional-duplicate marker line
 * (T-20260912-029). Returned only for lines carrying a COMPLETE one-line
 * comment whose name satisfies the workspace standards §<digits> grammar.
 */
export interface IntentionalDuplicateLine {
  /** Text before the " — " separator (or the whole pre-';' segment when no em-dash) */
  name: string | null;
  /** Text after " — " up to the first ';' (null when no em-dash separator) */
  reason: string | null;
  /** Constitution section digits — non-null whenever the object is returned */
  section: string;
  /** parseMarkerFields().source */
  source: string | null;
  /** parseMarkerFields().hash */
  hash: string | null;
}

/**
 * Parse one line as a grammar-complete intentional-duplicate marker.
 *
 * Acceptance conditions (both required, per ADR-0059/ADR-0062):
 * 1. Complete-comment anchor: the line must contain
 *    `<!-- intentional-duplicate: <body> -->` closing on the same line —
 *    prose that merely opens a comment or mentions a partial marker returns
 *    null. The body cannot contain '>' (capture stops at the first '>'), so
 *    placeholder text such as `<name>` also fails the anchor.
 * 2. Field grammar: parseSectionNumber() must return non-null
 *    (workspace standards §<digits>) or the result is null — this kills
 *    prose carrying the literal `§N` placeholder or no section at all.
 *
 * Name/reason split: the body up to the first ';' is split on the em-dash
 * separator " — " (U+2014 with single surrounding spaces). No em-dash →
 * name is the whole segment and reason is null. This leniency is deliberate
 * so the refactored scanner's behavior is unchanged (it previously accepted
 * section-bearing markers without an em-dash).
 *
 * CRLF-tolerant (a trailing \r after --> does not affect the match).
 * First match only (line.match, non-global).
 */
export function parseIntentionalDuplicateLine(line: string): IntentionalDuplicateLine | null {
  const anchorMatch = line.match(/<!--\s*intentional-duplicate:\s*([^>]+?)-->/);
  if (!anchorMatch) return null;

  const body = anchorMatch[1];
  const section = parseSectionNumber(body);
  if (!section) return null;

  const { source, hash } = parseMarkerFields(body);

  const head = body.split(';')[0];
  const dashIdx = head.indexOf(' — ');
  const name = dashIdx === -1 ? head.trim() : head.slice(0, dashIdx).trim();
  const reason = dashIdx === -1 ? null : head.slice(dashIdx + ' — '.length).trim();

  return { name, reason, section, source, hash };
}

/**
 * Resolve constitution source file for a section number
 * Maps §3 -> docs/constitution/03-pr-workflow.md, §8 -> docs/constitution/08-coding-guidelines.md
 */
export function resolveConstitutionSource(section: string): string | null {
  const CONSTITUTION_DIR = join(ROOT, 'docs', 'constitution');

  if (!existsSync(CONSTITUTION_DIR)) {
    return null;
  }

  // Zero-pad the section number (e.g., "3" -> "03", "8" -> "08")
  const paddedSection = section.padStart(2, '0');

  // Scan for files matching the pattern 0{section}-*.md
  const entries = require('node:fs').readdirSync(CONSTITUTION_DIR);
  const matching = entries.filter(
    (entry: string) => entry.startsWith(`${paddedSection}-`) && entry.endsWith('.md')
  );

  if (matching.length === 0) {
    return null; // Cannot resolve source
  }
  if (matching.length > 1) {
    return null; // Ambiguous - multiple matches
  }

  return join(CONSTITUTION_DIR, matching[0]);
}

/**
 * Compute sha256-8 hash of a file's SECTION body: content sliced from the
 * FIRST line matching /^###\s/ (inclusive) to EOF, CRLF normalized.
 * Constitution sources are one-section-per-file with a 2-line ">" preamble —
 * slicing excludes the preamble so hub-plumbing edits don't trip markers
 * (Stage 2b re-scoping; see ADR-0059 Amendment).
 * Falls back to whole-file hash if no ### heading exists.
 */
export function computeSectionHash(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const headingIdx = lines.findIndex((line) => /^###\s/.test(line));
    const slice = headingIdx >= 0 ? lines.slice(headingIdx).join('\n') : normalized;
    const hash = createHash('sha256').update(slice, 'utf-8').digest('hex');
    return hash.substring(0, 8);
  } catch {
    return null;
  }
}

/**
 * Scan templates/ for intentional-duplicate markers
 */
export function scanIntentionalDuplicateMarkers(): IntentionalDuplicateMarker[] {
  const TEMPLATES_DIR = join(ROOT, 'templates');
  const markers: IntentionalDuplicateMarker[] = [];

  if (!existsSync(TEMPLATES_DIR)) {
    return markers;
  }

  // Recursively scan all .md files under templates/
  const { readdirSync } = require('node:fs');
  const entries = readdirSync(TEMPLATES_DIR, {
    recursive: true,
    withFileTypes: true,
  }) as any[];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = join(entry.path, entry.name);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Grammar-complete acceptance (complete one-line comment + §<digits>)
      // lives in the shared parser — same conditions this loop previously
      // enforced inline (T-20260912-029). The retained body match only
      // reproduces the existing `text` field (capture up to the closing -->).
      const parsed = parseIntentionalDuplicateLine(line);

      if (parsed) {
        const markerMatch = line.match(/<!--\s*intentional-duplicate:\s*([^>]+)-->/);
        const markerText = markerMatch ? markerMatch[1] : '';

        markers.push({
          file: filePath,
          line: i + 1, // 1-indexed
          section: parsed.section,
          text: markerText,
          source: parsed.source,
          hash: parsed.hash,
        });
      }
    }
  }

  return markers;
}

/**
 * Extract content section from source file based on hash
 * Reads the section body (from first ### heading to EOF) for re-seeding markers
 */
export function extractSectionContent(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const headingIdx = lines.findIndex((line) => /^###\s/.test(line));

    if (headingIdx >= 0) {
      return lines.slice(headingIdx).join('\n');
    }
    return normalized;
  } catch {
    return null;
  }
}

// ============================================================================
// INTENTIONAL-DUPLICATE REWRITE APPLICATION
// ============================================================================

/**
 * Apply pre-computed stale-marker rewrites to one file's lines in a single
 * bottom-up splice pass.
 *
 * Contract:
 * - Pure: returns a NEW array; the input `lines` is never mutated.
 * - `rewrites` may be given in any order; they are internally applied in
 *   DESCENDING `lineIndex` order (bottom-up splice). Marker regions are
 *   disjoint and ordered by construction, so a rewrite that changes line
 *   counts can never shift the index of a not-yet-applied rewrite — this is
 *   the fix for the stale-index bug where per-marker ascending splices used
 *   scan-time indices after an earlier rewrite had shifted lines below them.
 * - Per rewrite, the replaced region starts at `lineIndex + 1` and extends to
 *   the line BEFORE the next intentional-duplicate marker (a line matching
 *   /<!--\s*intentional-duplicate:/ — same convention as
 *   `scanIntentionalDuplicateMarkers` and the engine loop this helper was
 *   extracted from) or to EOF, whichever comes first. The marker line itself
 *   keeps its position; only its `hash: [0-9a-f]{8}` field is replaced with
 *   `newHash` (same replacement as the engine).
 * - Out-of-range `lineIndex` rewrites are skipped (defensive; the engine never
 *   produces one — a rewrite landing on a shifted file would no-op instead of
 *   corrupting).
 */
export function applyIntentionalDuplicateRewrites(
  lines: string[],
  rewrites: Array<{ lineIndex: number; newSectionLines: string[]; newHash: string }>
): string[] {
  const result = [...lines];
  const ordered = [...rewrites].sort((a, b) => b.lineIndex - a.lineIndex);

  for (const rewrite of ordered) {
    const lineIndex = rewrite.lineIndex;
    if (lineIndex < 0 || lineIndex >= result.length) continue;

    // Section region: line after the marker down to (next marker - 1) or EOF —
    // identical bound rule to the engine's runMarkerRewrite loop.
    const regionStart = lineIndex + 1;
    let regionEnd = regionStart;
    for (let i = regionStart; i < result.length; i++) {
      if (result[i].match(/<!--\s*intentional-duplicate:/)) break;
      regionEnd = i;
    }
    result.splice(regionStart, regionEnd - regionStart + 1, ...rewrite.newSectionLines);

    // Update the marker line's hash in place; its position is unaffected
    // because the splice happens strictly below it (descending order).
    result[lineIndex] = result[lineIndex].replace(
      /hash:\s*[0-9a-f]{8}/,
      `hash: ${rewrite.newHash}`
    );
  }

  return result;
}
