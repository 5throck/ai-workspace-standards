#!/usr/bin/env bun
// @version 1.0.0
// nul-lint-invariant.test.ts — pins the marker-free nul-redirect lint invariant
//
// Spec: docs/designs/2026-11-09-delivered-scripts-strict-profile-design.md §4.1
// (U-20261108-001, DEC-20261109-01). The `'> nul'` redirect ban in scripts/audit.ts
// used to depend on a line-scoped trailing `// nul-lint-ignore` marker that had to
// stay on the same line as the Fail() diagnostic quoting the banned pattern — an
// invariant any formatter wrap breaks. The design DELETES the invariant: the
// diagnostic now renders NUL_REDIRECT_DISPLAY (constructed via ['>', 'nul'].join(' ')),
// so no source line contains a matchable literal and no marker is needed anywhere.
//
// These tests pin the replacement invariant against the LIVE source (the regex and
// the three construction/interpolation lines are extracted from scripts/audit.ts,
// never duplicated here), so a regression that reintroduces a matchable literal or
// a stray marker fails loudly. Runtime backstop: the audit's own scan covers
// scripts/audit.ts (LINT_ROOTS includes 'scripts').

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'bun:test';

const AUDIT_TS = join(import.meta.dir, '..', '..', 'scripts', 'audit.ts');
const source = readFileSync(AUDIT_TS, 'utf-8');
const lines = source.split('\n');

/** Extract the live NUL_REDIRECT regex body from its definition line. */
function extractNulRedirectRegex(): RegExp {
  const defLine = lines.find((l) => l.includes('const NUL_REDIRECT ='));
  expect(defLine).toBeDefined();
  const match = /const NUL_REDIRECT = \/(.+?)\/([a-z]*);/.exec(defLine as string);
  expect(match).not.toBeNull();
  return new RegExp((match as RegExpExecArray)[1], (match as RegExpExecArray)[2]);
}

/** Mirror of the audit's stripComment (audit.ts nul-redirect check). The three
 * pinned lines are non-comment code lines, so raw and stripped must agree. */
function stripComment(line: string): string {
  return line
    .replace(/\r$/, '')
    .replace(/^\s*(?:\/\/|#|<#|\*).*$/, '')
    .replace(/\s+(?:\/\/|#)\s.*$/, '');
}

/** The construction line, the Fail() diagnostic, and the Pass() summary — the three
 * lines the design §4.1 names. Fail/Pass are located by their NUL_REDIRECT_DISPLAY
 * interpolation so the pin survives formatter reflow. */
function pinnedLines(): string[] {
  const construction = lines.filter((l) => l.includes('NUL_REDIRECT_DISPLAY = '));
  const fail = lines.filter((l) => l.includes('NUL_REDIRECT_DISPLAY}') && l.includes('Banned'));
  const pass = lines.filter((l) => l.includes('NUL_REDIRECT_DISPLAY}') && l.includes('Pass('));
  expect(construction.length).toBe(1);
  expect(fail.length).toBe(1);
  expect(pass.length).toBe(1);
  return [construction[0], fail[0], pass[0]];
}

describe('nul-redirect lint invariant (design 2026-11-09-delivered-scripts-strict-profile §4.1)', () => {
  test('NUL_REDIRECT_DISPLAY constructs the banned pattern (display still renders it)', () => {
    // The constructed string IS the banned pattern — the diagnostic must keep
    // showing it at runtime even though no source line may contain it literally.
    const display = ['>', 'nul'].join(' ');
    expect(display).toBe('> nul'); // nul-lint-ignore (sanctioned escape hatch — this test must quote the banned pattern to pin its runtime display)
    expect(extractNulRedirectRegex().test(display)).toBe(true);
  });

  test('no pinned source line (construction / Fail / Pass) matches NUL_REDIRECT', () => {
    const re = extractNulRedirectRegex();
    for (const line of pinnedLines()) {
      const stripped = stripComment(line);
      expect(re.test(line)).toBe(false);
      expect(re.test(stripped)).toBe(false);
    }
  });

  test('no line of scripts/audit.ts matches NUL_REDIRECT after comment stripping', () => {
    // The file-level form of the invariant: the audit scans its own source
    // (LINT_ROOTS includes 'scripts'), so any matchable literal reintroduced
    // on a non-comment line fails the audit at runtime — this pins it in unit scope.
    const re = extractNulRedirectRegex();
    const offenders = lines
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => re.test(stripComment(line)));
    expect(offenders).toEqual([]);
  });

  test("scripts/audit.ts contains no 'nul-lint-ignore' marker outside the skip mechanism", () => {
    // The skip mechanism itself (line.includes('nul-lint-ignore')) stays as the
    // sanctioned escape hatch; this file must no longer DEPEND on it anywhere.
    const markerLines = lines
      .map((line, i) => ({ line, no: i + 1 }))
      .filter(({ line }) => line.includes('nul-lint-ignore'));
    expect(markerLines.length).toBe(1);
    expect(markerLines[0].line.trim()).toMatch(/^if \(line\.includes\(['"]nul-lint-ignore['"]\)\) return;$/);
  });

  test('the Fail diagnostic interpolates the constructed display (no quoted literal fallback)', () => {
    const [, failLine] = pinnedLines();
    // The message quotes the pattern ONLY via interpolation — a re-introduced
    // `'> nul'` literal inside the template string would break the line pin above,
    // and dropping the interpolation entirely would degrade the diagnostic.
    expect(failLine).toContain("${NUL_REDIRECT_DISPLAY}");
    expect(failLine).not.toContain('> nul'); // nul-lint-ignore (same sanctioned escape hatch — asserting the absence of the quoted literal)
  });
});
