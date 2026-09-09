/**
 * Tests for scrubConstitutionRefs() target-aware rule A-6 in
 * scripts/propagate-to-templates.ts.
 *
 * Pins the backward-compatibility contract: no targetPath → output
 * byte-identical to the pre-A-6 (legacy) behavior; a targetPath ending in
 * docs/context.md rewrites ](docs/context.md) links to relative ](context.md);
 * any other targetPath is a no-op.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { scrubConstitutionRefs } from '../../scripts/propagate-to-templates.ts';

// Fixture exercising rules A-2 (link text mentions CONSTITUTION.md) and
// A-5 (docs/constitution/ part-file link whose text does not), plus an
// already-canonical docs/context.md link that rule A-6 targets.
const FIXTURE = [
  'See [CONSTITUTION.md](CONSTITUTION.md) for the SSOT.',
  'See [docs/constitution/06-skill-lifecycle.md](docs/constitution/06-skill-lifecycle.md) for the skill lifecycle.',
  'A plain CONSTITUTION.md mention.',
  'Already canonical: [docs/context.md](docs/context.md).',
].join('\n');

// Legacy output (rules A-2/A-4/A-5 applied, no A-6) — hardcoded to pin the
// byte-identity contract rather than re-deriving it from the implementation.
const LEGACY_OUTPUT = [
  'See [docs/context.md](docs/context.md) for the SSOT.',
  'See [docs/context.md](docs/context.md) for the skill lifecycle.',
  'A plain context.md mention.',
  'Already canonical: [docs/context.md](docs/context.md).',
].join('\n');

describe('scrubConstitutionRefs target-aware rule A-6', () => {
  test('(a) no targetPath → byte-identical to legacy behavior', () => {
    expect(scrubConstitutionRefs(FIXTURE)).toBe(LEGACY_OUTPUT);
  });

  test('(b) targetPath ending in docs/context.md → ](docs/context.md) rewritten to ](context.md)', () => {
    const expected = LEGACY_OUTPUT.replace(/\]\(docs\/context\.md\)/g, '](context.md)');
    expect(scrubConstitutionRefs(FIXTURE, undefined, '/x/docs/context.md')).toBe(expected);
    // path.sep handling: Windows-style separators resolve to the same rule
    expect(scrubConstitutionRefs(FIXTURE, undefined, 'C:\\x\\docs\\context.md')).toBe(expected);
  });

  test('(c) other targetPath → unchanged vs no-targetPath output', () => {
    expect(scrubConstitutionRefs(FIXTURE, undefined, '/x/docs/other.md')).toBe(
      scrubConstitutionRefs(FIXTURE)
    );
  });
});
