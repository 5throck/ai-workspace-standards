/**
 * Tests for helpers/l0-ref-policy.ts — the shared L0-reference policy used by
 * new-project.ts's scaffold sanitizer (blankL0Refs) and audit.ts's L0 Leakage
 * check (findL0LeakLines).
 *
 * T-20260912-006 regression pins:
 *  - The sanitizer BLANKS the matched text instead of dropping the line, so a
 *    docs/context.md version footer that merely cites an L0 rule survives as a
 *    footer (VERSION_FOOTER_RE must still match) — the old line-drop deleted the
 *    footer and permanently silenced upgrade-project's version-sync.
 *  - The audit scan is occurrence-scoped: an intentional-duplicate marker exempts
 *    only the line carrying it, so a real leak is still flagged in a file that
 *    also carries a marker elsewhere.
 *  - The real templates/common/docs/context.md carries no non-marker L0 leak
 *    (guards the footer reword and the scrubbed COMMON-CONSTITUTION zone against
 *    propagation regressions).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { blankL0Refs, findL0LeakLines, L0_REF_PATTERN } from '../../scripts/helpers/l0-ref-policy.ts';
import { splitOffVersionFooter } from '../../scripts/helpers/context-sections.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

/** True when `content` ends with a `*…version:…*` footer line (via the public helper). */
function hasVersionFooter(content: string): boolean {
  return splitOffVersionFooter(content).footer !== '';
}

// ── blankL0Refs (scaffold sanitizer) ─────────────────────────────────────────

describe('blankL0Refs', () => {
  test('preserves a version footer line that merely cites an L0 rule (line survives, reference blanked)', () => {
    const footer = '*context.md version: 2.6 — Schema Governance zone added (DB schema changes require an ADR before merge; CONSTITUTION.md §8.15)*';
    const content = `## Guidelines\n\nSome body text.\n\n---\n\n${footer}\n`;
    const cleaned = blankL0Refs(content);

    // The footer LINE survives (old behavior dropped it entirely)…
    expect(cleaned.split('\n').length).toBe(content.split('\n').length);
    // …still matches the version-footer shape upgrade-project relies on…
    expect(hasVersionFooter(cleaned)).toBe(true);
    // …and only the L0 reference text was blanked.
    expect(cleaned).not.toContain('CONSTITUTION.md');
    expect(cleaned).toContain('Schema Governance zone added');
    expect(cleaned).toContain('§8.15');
  });

  test('blanks docs/constitution/ path references while preserving the line', () => {
    const content = 'See the rules in docs/constitution/03-pr-workflow.md before merging.\n';
    const cleaned = blankL0Refs(content);
    // Only the MATCHED text (the docs/constitution/ path segment) is blanked;
    // the remainder of the line is preserved verbatim.
    expect(cleaned).not.toMatch(L0_REF_PATTERN);
    expect(cleaned).toBe('See the rules in 03-pr-workflow.md before merging.\n');
    expect(cleaned.split('\n').length).toBe(content.split('\n').length);
  });

  test('leaves content without L0 references untouched', () => {
    const content = '# Clean\n\nNo references here, see docs/context.md instead.\n';
    expect(blankL0Refs(content)).toBe(content);
  });

  test('keeps the previous blank-run compaction (3+ newlines → 2)', () => {
    const content = 'a\n\n\n\nb\n';
    expect(blankL0Refs(content)).toBe('a\n\nb\n');
  });
});

// ── findL0LeakLines (audit L0 Leakage scan) ──────────────────────────────────

describe('findL0LeakLines', () => {
  test('flags a real leak in a file that ALSO carries an intentional-duplicate marker elsewhere', () => {
    const content = [
      '<!-- intentional-duplicate: workspace standards §3 — source: docs/constitution/03-pr-workflow.md; hash: deadbeef -->',
      '## Git / PR Workflow',
      'Run `/sync` to open a PR.',
      'This footer leaks: *context.md version: 2.6 — (see CONSTITUTION.md §8.15)*',
    ].join('\n');
    const leaks = findL0LeakLines(content);
    expect(leaks.length).toBe(1);
    expect(leaks[0].lineNo).toBe(4);
    expect(leaks[0].line).toContain('CONSTITUTION.md');
  });

  test('does not flag the intentional-duplicate marker line itself', () => {
    const marker = '<!-- intentional-duplicate: workspace standards §3 — source: docs/constitution/03-pr-workflow.md; hash: 18ad2842 -->';
    expect(findL0LeakLines(marker).length).toBe(0);
  });

  test('returns every non-marker leak with correct line numbers', () => {
    const content = [
      'clean',
      'leak one: docs/constitution/x.md',
      'clean',
      'leak two: CONSTITUTION.md §8',
      'clean',
    ].join('\n');
    const leaks = findL0LeakLines(content);
    expect(leaks.map(l => l.lineNo)).toEqual([2, 4]);
  });

  test('clean content yields no leaks', () => {
    expect(findL0LeakLines('# Title\n\nSee docs/context.md and docs/governance/.\n').length).toBe(0);
  });
});

// ── Real-template regression pins (L0 workspace only) ────────────────────────

describe('real L1 templates carry no non-marker L0 leaks', () => {
  test('templates/common/docs/context.md: footer reworded, COMMON-CONSTITUTION zone scrubbed', () => {
    const content = readFileSync(join(workspaceRoot, 'templates', 'common', 'docs', 'context.md'), 'utf-8');
    const leaks = findL0LeakLines(content);
    expect(leaks).toEqual([]);
    // The version footer survives and matches the footer shape.
    expect(hasVersionFooter(content)).toBe(true);
    expect(content).not.toContain('CONSTITUTION.md §8.15');
  });

  test('templates/common/docs/variant.context.template.md: only its marker line references docs/constitution/', () => {
    const content = readFileSync(join(workspaceRoot, 'templates', 'common', 'docs', 'variant.context.template.md'), 'utf-8');
    expect(findL0LeakLines(content)).toEqual([]);
  });
});
