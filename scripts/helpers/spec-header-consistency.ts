#!/usr/bin/env bun
// @version 1.0.0
// v1.0.0 (2026-10-29, T-20261029-002 — spec
//          docs/designs/2026-10-29-retro-records-registration-design.md §6):
//          registry-vs-design-header status consistency. spec-register.ts flips
//          the REGISTRY status, but nothing verified the design doc's own
//          Status header moved with it — four docs sat draft/proposed while the
//          registry said implemented (T-20261029-002's header-fix half, repaired
//          in commit d8d55f8a0). This pure helper owns the doc-side parse both
//          for audit.ts's spec-check Check 6 and for unit tests.

/** Legal spec statuses — mirrors audit.ts spec-check Check 4's vocabulary. */
export const SPEC_STATUS_VOCABULARY: readonly string[] = [
  'draft', 'proposed', 'approved', 'planned', 'implemented', 'superseded', 'drifted', 'archived',
];

/** A design doc's Status header line: a list item whose label is exactly
 *  "Status" (house style: `- **Status**: implemented (...)`). Returns the
 *  value part, or null when the doc carries no Status header line. */
export function extractStatusHeaderValue(text: string): string | null {
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]\s*\*\*Status\*\*\s*:\s*(.*)$/);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * Parse the status token out of a Status header value.
 *
 * Rule: the FIRST status-vocabulary word occurring in the value wins (word-
 * bounded, case-insensitive, earliest position). This keeps annotated values
 * correct — "implemented (registry SSOT; retro-marked from draft per ...)"
 * parses as implemented, not draft — and tolerates leading qualifiers.
 * Returns null when no vocabulary word occurs (unparseable → the caller warns,
 * never fails: legacy trees predate the header convention).
 */
export function parseStatusHeaderValue(value: string): string | null {
  let best: { word: string; pos: number } | null = null;
  for (const word of SPEC_STATUS_VOCABULARY) {
    const m = value.match(new RegExp(`\\b${word}\\b`, 'i'));
    if (m && (best === null || m.index! < best.pos)) {
      best = { word, pos: m.index! };
    }
  }
  return best ? best.word : null;
}

/** Convenience composition: the status a design doc text declares, or null. */
export function parseDocStatus(text: string): string | null {
  const value = extractStatusHeaderValue(text);
  return value === null ? null : parseStatusHeaderValue(value);
}

/**
 * Classify one registry entry against its design doc text (pure; the caller
 * reads the file and handles absence). Exported so tests pin the verdicts.
 */
export type HeaderConsistencyVerdict =
  | { verdict: 'match'; status: string }
  | { verdict: 'mismatch'; registryStatus: string; docStatus: string }
  | { verdict: 'unparseable' };

export function classifySpecHeader(
  registryStatus: string,
  docText: string | null,
): HeaderConsistencyVerdict {
  if (docText === null) return { verdict: 'unparseable' };
  const docStatus = parseDocStatus(docText);
  if (docStatus === null) return { verdict: 'unparseable' };
  if (docStatus === registryStatus) return { verdict: 'match', status: docStatus };
  return { verdict: 'mismatch', registryStatus, docStatus };
}
