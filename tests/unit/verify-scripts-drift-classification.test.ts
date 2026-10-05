/**
 * T-20261004-022 — equal-version L0/L1 content drift gate.
 *
 * classifyL0L1Pair() canonicalizes the L0 side with the SAME sanctioned scrub
 * the propagator applies (scripts/lib/constitution-scrub.ts) and compares
 * against the RAW L1 bytes:
 *   - "in-sync": canonical(L0) === L1 byte-for-byte (comments may differ by
 *     the sanctioned CONSTITUTION.md→context.md scrub; functional string
 *     literals must match)
 *   - "equal-version-divergence": matching @version headers with diverging
 *     canonical bytes — the mixed-marker corruption class; BLOCKING
 *   - "pending-publish": version skew with content difference; warn-only
 *
 * The file also pins the constitution-scrub.ts code-branch state-machine fix:
 * a `/*`-shaped glob inside a // line and an overlapping slash-star glob in a
 * template string must NOT wedge the machine into block-comment mode and
 * blanket-scrub functional string literals (the audit.ts:925 / dev-sync.ts
 * divergence class this ticket shipped to fix).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  classifyL0L1Pair,
  shortContentHash,
} from '../../scripts/verify-scripts.ts';
import { scrubConstitutionRefs } from '../../scripts/lib/constitution-scrub.ts';

const L0_PATH = 'scripts/fixture.ts';
const L1_PATH = 'templates/common/scripts/fixture.ts';

// L0 copy: a comment marker mention + a FUNCTIONAL existsSync literal.
const L0_SRC = [
  '// @version 2.0.0',
  '// Guard: see CONSTITUTION.md §6 for the marker policy.',
  'if (fs.existsSync("CONSTITUTION.md")) { runGuard(); }',
  '',
].join('\n');

// Sanctioned canonical form: comment scrubbed, functional literal preserved.
const L1_CANONICAL = [
  '// @version 2.0.0',
  '// Guard: see context.md §6 for the marker policy.',
  'if (fs.existsSync("CONSTITUTION.md")) { runGuard(); }',
  '',
].join('\n');

// The corruption class: the blanket substitution reached the functional
// literal too (templates/common/scripts/audit.ts:925 as found by the ticket).
const L1_LITERAL_SCRUBBED = [
  '// @version 2.0.0',
  '// Guard: see context.md §6 for the marker policy.',
  'if (fs.existsSync("context.md")) { runGuard(); }',
  '',
].join('\n');

describe('classifyL0L1Pair (T-20261004-022)', () => {
  test('identical mention-free content + identical version → in-sync', () => {
    const src = [
      '// @version 2.0.0',
      '// Pure helper — no layer-specific markers.',
      'export const answer = 42;',
      '',
    ].join('\n');
    const result = classifyL0L1Pair(src, src, L0_PATH, L1_PATH);
    expect(result.classification).toBe('in-sync');
    expect(result.l0Version).toBe('2.0.0');
    expect(result.l1Version).toBe('2.0.0');
  });

  test('byte-identical copy that still carries un-scrubbed comment mentions → equal-version-divergence', () => {
    // L1 must be the SCRUBBED canonical form; a verbatim L0 clone is not
    // canonical even though the bytes match (a publish would scrub it).
    const result = classifyL0L1Pair(L0_SRC, L0_SRC, L0_PATH, L1_PATH);
    expect(result.classification).toBe('equal-version-divergence');
  });

  test('comment-only difference produced by the sanctioned scrub → in-sync', () => {
    // The canonical form claim must hold against the REAL scrub implementation.
    expect(scrubConstitutionRefs(L0_SRC, L0_PATH, L1_PATH)).toBe(L1_CANONICAL);
    const result = classifyL0L1Pair(L0_SRC, L1_CANONICAL, L0_PATH, L1_PATH);
    expect(result.classification).toBe('in-sync');
  });

  test('equal @version + scrubbed functional literal → equal-version-divergence', () => {
    const result = classifyL0L1Pair(L0_SRC, L1_LITERAL_SCRUBBED, L0_PATH, L1_PATH);
    expect(result.classification).toBe('equal-version-divergence');
  });

  test('version skew + content difference → pending-publish (warn-only class)', () => {
    const l1 = L1_LITERAL_SCRUBBED.replace('@version 2.0.0', '@version 1.9.0');
    const result = classifyL0L1Pair(L0_SRC, l1, L0_PATH, L1_PATH);
    expect(result.classification).toBe('pending-publish');
    expect(result.l1Version).toBe('1.9.0');
  });

  test('version skew alone (header-only difference) → pending-publish', () => {
    const l1 = L1_CANONICAL.replace('@version 2.0.0', '@version 1.9.0');
    const result = classifyL0L1Pair(L0_SRC, l1, L0_PATH, L1_PATH);
    expect(result.classification).toBe('pending-publish');
  });
});

describe('shortContentHash', () => {
  test('deterministic and content-sensitive', () => {
    expect(shortContentHash('abc')).toBe(shortContentHash('abc'));
    expect(shortContentHash('abc')).not.toBe(shortContentHash('abd'));
    expect(shortContentHash('abc')).toHaveLength(12);
  });
});

describe('constitution-scrub state machine regressions (T-20261004-022)', () => {
  test('a /*-shaped glob inside a // line must not wedge block-comment mode', () => {
    // Before the fix, `docs/**` inside the // line flipped the machine into
    // block-comment mode and the functional literal below was blanket-scrubbed.
    const src = [
      '// Scans docs/** recursively for markers.',
      'const root = fs.existsSync("CONSTITUTION.md");',
    ].join('\n');
    const out = scrubConstitutionRefs(src, L0_PATH, L1_PATH);
    expect(out).toContain('fs.existsSync("CONSTITUTION.md")');
    expect(out).toContain('// Scans docs/** recursively for markers.');
  });

  test('an overlapping slash-star glob in a template string must not wedge block-comment mode', () => {
    // `templates/*/skills/` inside a message string: the closer probe must
    // treat the overlapping sequence as balanced (dev-sync.ts:645 class).
    const src = [
      'console.log(`fix markers under templates/*/skills/ then re-run`);',
      'const ok = fs.existsSync("CONSTITUTION.md");',
    ].join('\n');
    const out = scrubConstitutionRefs(src, L0_PATH, L1_PATH);
    expect(out).toContain('fs.existsSync("CONSTITUTION.md")');
  });

  test('real block comments are still scrubbed inside', () => {
    const src = [
      '/* intro',
      ' * See CONSTITUTION.md for the policy.',
      ' */',
      'const ok = fs.existsSync("CONSTITUTION.md");',
    ].join('\n');
    const out = scrubConstitutionRefs(src, L0_PATH, L1_PATH);
    expect(out).toContain(' * See context.md for the policy.');
    expect(out).toContain('fs.existsSync("CONSTITUTION.md")');
  });

  test('a // line AFTER a real block comment closes is scrubbed as a comment', () => {
    const src = [
      '/* block */',
      '// Mentions CONSTITUTION.md in prose.',
      'const ok = 1;',
    ].join('\n');
    const out = scrubConstitutionRefs(src, L0_PATH, L1_PATH);
    expect(out).toContain('// Mentions context.md in prose.');
  });
});
