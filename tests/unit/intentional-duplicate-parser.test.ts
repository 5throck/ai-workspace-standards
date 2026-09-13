/**
 * Tests for helpers/markers.ts parseIntentionalDuplicateLine() — the
 * grammar-complete one-line parser behind Check D's intentional-duplicate
 * registry (T-20260912-029, design 2026-09-12-validator-hardening-drift-marker-design).
 *
 * Pins:
 * 1. The real marker line parses to the full field object.
 * 2. Prose that merely MENTIONS the marker syntax (the four lines that
 *    produced Check D's phantom registry entries) returns null.
 * 3. An unterminated comment returns null (complete-comment anchor).
 * 4. CRLF line endings parse identically.
 * 5. Scanner parity: scanIntentionalDuplicateMarkers() over the repo's
 *    templates/ tree finds exactly the 2 known real markers (pins the
 *    no-behavior-change refactor of the scanner onto the parser).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { join } from 'node:path';
import {
  parseIntentionalDuplicateLine,
  scanIntentionalDuplicateMarkers,
} from '../../scripts/helpers/markers.ts';

const REAL_MARKER_LINE =
  '<!-- intentional-duplicate: workspace standards §3 — maintained locally for AI context proximity; source: docs/constitution/03-pr-workflow.md; hash: 18ad2842 -->';

// Verbatim contiguous slices of the four real prose lines that fed Check D's
// phantom registry before T-20260912-029 (sources cited per fixture).
const PROSE_CHANGELOG_332 =
  'e slice; for every `<!-- intentional-duplicate: <name>; source: <path>; hash: <sha256-8> -->` marker: replaces the section content with the current source slice AND refreshes the hash. Logs EVERY overwritten zone/marker to stdout before writing (file, marker name, +/- line counts); zones/markers left byte-identical → log "in sync". Preser'; // CHANGELOG.md:332
const PROSE_CHANGELOG_341 =
  '-23]**: feat(scripts): **intentional-duplicate marker hashes — Stage 1b of ADR-0059, making constitution→template duplication drift-detectable (`verify-adr-governance.ts` 1.0.0 → 1.1.0).** The 9 `<!-- intentional-duplicate: workspace standards §N -->` markers (common context.md §3 Git/PR Workflow; co-abap/co-design/co-develop/co-game/co-s'; // CHANGELOG.md:341
const PROSE_DESIGN_0910_13 =
  'templates.ts` maintains "intentional-duplicate" markers (`<!-- intentional-duplicate: workspace standards §N — maintained locally ...; source: docs/constitution/XX.md; hash: xxxxxxxx -->`) scanned from `templates/**/*.md` by `scanIntentionalDuplicateMarkers` (`scripts/helpers/markers.ts:254-302`). On a stale hash it splices the region fro'; // docs/designs/2026-09-10-marker-engine-remediation-design.md:13
const PROSE_ADR0059_40 =
  'The 9 `<!-- intentional-duplicate: workspace standards ... -->` markers in template **context.md** files (common §3 Git/PR Workflow; co-abap/co-design/co-develop/co-game/co-security/co-work §8 Coding Guidelines; `variant.context.template.md` ×2) mark sections maintained locally as duplicates of constitution sections — but carry no hash, s'; // docs/adr/0059-governance-reflection-validators.md:40

describe('parseIntentionalDuplicateLine', () => {
  test('real marker parses to the full field object', () => {
    expect(parseIntentionalDuplicateLine(REAL_MARKER_LINE)).toEqual({
      name: 'workspace standards §3',
      reason: 'maintained locally for AI context proximity',
      section: '3',
      source: 'docs/constitution/03-pr-workflow.md',
      hash: '18ad2842',
    });
  });

  test('prose mentioning the marker syntax returns null (the 4 phantom lines)', () => {
    // <name>/<path>/<sha256-8> placeholders contain '>' → incomplete anchor;
    // and no §<digits> grammar either.
    expect(parseIntentionalDuplicateLine(PROSE_CHANGELOG_332)).toBeNull();
    // literal §N placeholder → section grammar fails.
    expect(parseIntentionalDuplicateLine(PROSE_CHANGELOG_341)).toBeNull();
    // literal §N placeholder inside a quoted grammar example.
    expect(parseIntentionalDuplicateLine(PROSE_DESIGN_0910_13)).toBeNull();
    // no §<digits> at all ("workspace standards ...").
    expect(parseIntentionalDuplicateLine(PROSE_ADR0059_40)).toBeNull();
  });

  test('missing closing --> returns null (complete-comment anchor)', () => {
    expect(
      parseIntentionalDuplicateLine(
        '<!-- intentional-duplicate: workspace standards §3 — reason; source: p; hash: 18ad2842'
      )
    ).toBeNull();
  });

  test('line that merely opens a comment returns null', () => {
    expect(
      parseIntentionalDuplicateLine(
        '<!-- intentional-duplicate: workspace standards §3 — reason; source: p; hash: 18ad2842 and the comment continues'
      )
    ).toBeNull();
  });

  test('CRLF-tolerant: trailing \\r after --> parses identically', () => {
    const line = REAL_MARKER_LINE + '\r';
    expect(parseIntentionalDuplicateLine(line)).toEqual({
      name: 'workspace standards §3',
      reason: 'maintained locally for AI context proximity',
      section: '3',
      source: 'docs/constitution/03-pr-workflow.md',
      hash: '18ad2842',
    });
  });

  test('no em-dash: name is the whole pre-; segment, reason null (scanner leniency)', () => {
    expect(
      parseIntentionalDuplicateLine(
        '<!-- intentional-duplicate: workspace standards §8; source: docs/constitution/08-coding-guidelines.md; hash: bbbbbbbb -->'
      )
    ).toEqual({
      name: 'workspace standards §8',
      reason: null,
      section: '8',
      source: 'docs/constitution/08-coding-guidelines.md',
      hash: 'bbbbbbbb',
    });
  });

  test('non-marker line returns null', () => {
    expect(parseIntentionalDuplicateLine('just some prose')).toBeNull();
    expect(parseIntentionalDuplicateLine('')).toBeNull();
  });
});

describe('scanIntentionalDuplicateMarkers — parser parity (T-20260912-029 refactor)', () => {
  test('finds exactly the 2 real markers at the known file:line locations', () => {
    const markers = scanIntentionalDuplicateMarkers();
    const normalized = markers
      .map((m) => ({ file: m.file.replaceAll('\\', '/'), line: m.line, section: m.section }))
      .sort((a, b) => (a.file + ':' + a.line).localeCompare(b.file + ':' + b.line));

    expect(normalized).toEqual([
      {
        file: expect.stringContaining('templates/common/docs/context.md'),
        line: 403,
        section: '3',
      },
      {
        file: expect.stringContaining('templates/common/docs/variant.context.template.md'),
        line: 151,
        section: '3',
      },
    ]);

    // Field fidelity through the refactor: source/hash still parsed identically.
    for (const m of markers) {
      expect(m.source).toBe('docs/constitution/03-pr-workflow.md');
      expect(m.hash).toBe('18ad2842');
      expect(m.text).toContain('workspace standards §3');
    }
  });

  test('scanner results agree with the per-line parser (every scanned marker parses)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const markers = scanIntentionalDuplicateMarkers();
    expect(markers.length).toBe(2);
    for (const m of markers) {
      const line = readFileSync(m.file, 'utf-8').split('\n')[m.line - 1];
      const parsed = parseIntentionalDuplicateLine(line);
      expect(parsed).not.toBeNull();
      expect(parsed!.section).toBe(m.section);
      expect(parsed!.source).toBe(m.source);
      expect(parsed!.hash).toBe(m.hash);
    }
  });

  // Guard against the templates tree moving: the parity expectations above pin
  // templates/common/docs/context.md:403 — resolve it relative to the repo root
  // so a future relocation fails loudly here rather than silently drifting.
  test('known real-marker locations still exist on disk', () => {
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    const root = join(import.meta.dir, '..', '..');
    expect(existsSync(join(root, 'templates', 'common', 'docs', 'context.md'))).toBe(true);
    expect(
      existsSync(join(root, 'templates', 'common', 'docs', 'variant.context.template.md'))
    ).toBe(true);
  });
});
