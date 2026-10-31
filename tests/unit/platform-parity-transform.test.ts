/**
 * Unit tests — transform-aware L0→L1 parity for platform instruction files.
 *
 * Spec: docs/designs/2026-10-31-platform-parity-transform-check-design.md
 *
 * Contract under test: scripts/test-platform-parity.ts v0.5.0 replaces the
 * existence-only L0→L1 check for CLAUDE/GEMINI/CODEX/HERMES.md with a
 * recomputation of the publisher's own applyGovernanceTransforms
 * (propagate-to-templates.ts --governance-l1) and a byte-compare of the L1
 * copy against it (volatile-marker tolerance: the `Last Updated: <date>`
 * stamp the pre-commit hook re-dates one-sidedly).
 *
 * All fixtures live in a temp dir — no repo file is mutated. The L0 fixture is
 * a copy of the workspace CLAUDE.md (the richest transform input: marker-pair
 * boundary replacement + PM-Gateway pointer retargets + constitution scrub);
 * the "expected" L1 fixture is always COMPUTED from it, so these tests stay
 * green regardless of live repo propagation state.
 *
 * @version 1.0.0
 */
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, test, expect, beforeAll } from 'bun:test';
import { applyGovernanceTransforms } from '../../scripts/propagate-to-templates.ts';
import {
  checkTransformParity,
  normalizeVolatileMarkers,
} from '../../scripts/test-platform-parity.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

let fixtureDir: string;
let l0Path: string;
let l1Path: string;
// Deterministic fixture pair: transform(copy-of-L0) as the "in sync" L1.
let transformedContent: string;

beforeAll(() => {
  fixtureDir = mkdtempSync(join(tmpdir(), 'platform-parity-transform-'));
  l0Path = join(fixtureDir, 'CLAUDE.md');
  l1Path = join(fixtureDir, 'templates', 'common', 'CLAUDE.md');
  mkdirSync(join(fixtureDir, 'templates', 'common'), { recursive: true });
  const l0 = readFileSync(join(workspaceRoot, 'CLAUDE.md'), 'utf-8');
  writeFileSync(l0Path, l0, 'utf-8');
  transformedContent = applyGovernanceTransforms(l0, 'CLAUDE.md', l1Path);
  writeFileSync(l1Path, transformedContent, 'utf-8');
});

describe('platform-parity transform check (v0.5.0)', () => {
  test('(b) transformed-equal fixture: L1 differing from raw L0 in variant-scrubbed regions only → PASS', () => {
    // The fixture L1 equals transform(L0) — i.e. it differs from the raw L0 in
    // exactly the variant-scrubbed regions (boundary policy replacement,
    // pointer retargets, CONSTITUTION.md → docs/context.md). The old
    // existence-only check passed any file; the old section-rules approach
    // would need a rule per scrub; the transform check passes it by
    // construction while still verifying every non-scrubbed byte.
    expect(transformedContent).not.toBe(readFileSync(l0Path, 'utf-8'));
    expect(transformedContent).toContain('Project Boundary Policy');
    const result = checkTransformParity(l0Path, l1Path, 'CLAUDE.md');
    expect(result.status).toBe('pass');
    expect(result.discrepancies).toHaveLength(0);
    expect(result.file).toBe('CLAUDE.md');
    expect(result.tier).toBe('L0→L1');
  });

  test('(a) tampered L1 copy: checker FAILs naming the file, with a concise summary', () => {
    // Mid-file tamper on a token the transform output provably contains.
    expect(transformedContent).toContain('Project Boundary Policy');
    const tamperedDir = mkdtempSync(join(tmpdir(), 'platform-parity-tamper-'));
    mkdirSync(join(tamperedDir, 'templates', 'common'), { recursive: true });
    const tamperL0 = join(tamperedDir, 'CLAUDE.md');
    const tamperL1 = join(tamperedDir, 'templates', 'common', 'CLAUDE.md');
    writeFileSync(tamperL0, readFileSync(l0Path, 'utf-8'), 'utf-8');
    writeFileSync(
      tamperL1,
      transformedContent.replace('Project Boundary Policy', 'Project Boundary Policy (edited)'),
      'utf-8'
    );
    const result = checkTransformParity(tamperL0, tamperL1, 'CLAUDE.md');
    expect(result.status).toBe('fail');
    expect(result.discrepancies).toHaveLength(1);
    const disc = result.discrepancies[0];
    expect(disc.severity).toBe('error');
    expect(disc.rule).toBe('governance-transform');
    // The finding names the file and locates the divergence…
    expect(result.file).toBe('CLAUDE.md');
    expect(disc.line).toBeGreaterThan(0);
    // …with a concise summary (first divergent line + lengths), NOT the full diff.
    expect(disc.expected).toMatch(/transform\(L0\) \[\d+ chars\] line \d+:/);
    expect(disc.actual).toMatch(/L1 copy \[\d+ chars\] line \d+:/);
    expect(disc.expected.length).toBeLessThan(220);
    expect(disc.actual.length).toBeLessThan(220);
    expect(disc.actual).toContain('Project Boundary Policy (edited)');
    expect(disc.actual).not.toContain('\n'); // single-line excerpt, no diff dump
  });

  test('(symmetric) stale L0: an L0 edit the publisher has not propagated FAILs too', () => {
    const staleDir = mkdtempSync(join(tmpdir(), 'platform-parity-stale-'));
    mkdirSync(join(staleDir, 'templates', 'common'), { recursive: true });
    const staleL0 = join(staleDir, 'CLAUDE.md');
    const staleL1 = join(staleDir, 'templates', 'common', 'CLAUDE.md');
    writeFileSync(staleL0, readFileSync(l0Path, 'utf-8') + '\nNew L0-only paragraph.\n', 'utf-8');
    writeFileSync(staleL1, transformedContent, 'utf-8');
    const result = checkTransformParity(staleL0, staleL1, 'CLAUDE.md');
    expect(result.status).toBe('fail');
    expect(result.discrepancies[0].rule).toBe('governance-transform');
    // The un-propagated L0 addition shows on the expected (transform) side.
    expect(result.discrepancies[0].expected).toContain('New L0-only paragraph.');
  });

  test('(c) missing L1 file still FAILs', () => {
    const missingPath = join(fixtureDir, 'templates', 'common', 'MISSING.md');
    expect(existsSync(missingPath)).toBe(false);
    const result = checkTransformParity(l0Path, missingPath, 'CLAUDE.md');
    expect(result.status).toBe('fail');
    expect(result.discrepancies[0].rule).toBe('file-exists');
    expect(result.discrepancies[0].section).toBe('target');
  });

  test('(d) volatile-marker tolerance: a stamp-date-only difference PASSes', () => {
    expect(transformedContent).toMatch(/Last Updated: \d{4}-\d{2}-\d{2}/);
    const stampDir = mkdtempSync(join(tmpdir(), 'platform-parity-stamp-'));
    mkdirSync(join(stampDir, 'templates', 'common'), { recursive: true });
    const stampL0 = join(stampDir, 'CLAUDE.md');
    const stampL1 = join(stampDir, 'templates', 'common', 'CLAUDE.md');
    writeFileSync(stampL0, readFileSync(l0Path, 'utf-8'), 'utf-8');
    // Simulate the pre-commit hook re-dating the L1 copy one-sidedly (the
    // observed 2026-10-31 HEAD state on GEMINI.md): date moves, text stays.
    writeFileSync(
      stampL1,
      transformedContent.replace(/Last Updated: \d{4}-\d{2}-\d{2}/, 'Last Updated: 1999-12-31'),
      'utf-8'
    );
    const result = checkTransformParity(stampL0, stampL1, 'CLAUDE.md');
    expect(result.status).toBe('pass');
  });

  test('(d2) stamp TEXT is still enforced: changed annotation fails despite date tolerance', () => {
    const textDir = mkdtempSync(join(tmpdir(), 'platform-parity-stamptext-'));
    mkdirSync(join(textDir, 'templates', 'common'), { recursive: true });
    const textL0 = join(textDir, 'CLAUDE.md');
    const textL1 = join(textDir, 'templates', 'common', 'CLAUDE.md');
    writeFileSync(textL0, readFileSync(l0Path, 'utf-8'), 'utf-8');
    writeFileSync(
      textL1,
      transformedContent.replace(/(Last Updated: \d{4}-\d{2}-\d{2})/, '$1 — drifted annotation'),
      'utf-8'
    );
    const result = checkTransformParity(textL0, textL1, 'CLAUDE.md');
    expect(result.status).toBe('fail');
    expect(result.discrepancies[0].rule).toBe('governance-transform');
  });

  test('normalizeVolatileMarkers normalizes the date token on both sides, nothing else', () => {
    const a = 'x\n*Last Updated: 2026-10-26 — note one*\ny';
    const b = 'x\n*Last Updated: 2026-10-31 — note one*\ny';
    expect(normalizeVolatileMarkers(a)).toBe(normalizeVolatileMarkers(b));
    expect(normalizeVolatileMarkers(a)).toContain('note one');
    // Annotation text differences survive normalization (they stay enforced).
    expect(normalizeVolatileMarkers(a)).not.toBe(
      normalizeVolatileMarkers('x\n*Last Updated: 2026-10-26 — note two*\ny')
    );
    // Only `Last Updated:`-prefixed dates are touched.
    expect(normalizeVolatileMarkers('Due: 2026-10-26')).toBe('Due: 2026-10-26');
  });
});
