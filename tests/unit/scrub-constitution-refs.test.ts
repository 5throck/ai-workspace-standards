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

// Rule A-8 (T-20260912-006): bare `docs/constitution/` directory mentions — no
// part-file name, so A-7 misses them. Found leaking through the constitution-context
// marker zone (CONSTITUTION.md's validate-md-language scan-path list) into
// templates/common/docs/context.md.
describe('scrubConstitutionRefs rule A-8 (bare docs/constitution/ directory mentions)', () => {
  test('drops a backticked list item with its trailing delimiter', () => {
    expect(
      scrubConstitutionRefs('paths (`agents/`, `skills/`, `docs/constitution/`, `docs/governance/`).')
    ).toBe('paths (`agents/`, `skills/`, `docs/governance/`).');
  });

  test('drops a backticked list item at a wrapped-line start', () => {
    expect(
      scrubConstitutionRefs('under\nthe same official paths (`agents/`, `skills/`, `templates/`,\n`docs/constitution/`, `docs/governance/`, `docs/designs/`).')
    ).toBe('under\nthe same official paths (`agents/`, `skills/`, `templates/`,\n`docs/governance/`, `docs/designs/`).');
  });

  test('drops a backticked list item at the end of a list', () => {
    expect(
      scrubConstitutionRefs('(`docs/governance/`, `docs/constitution/`)')
    ).toBe('(`docs/governance/`)');
  });

  test('projects a standalone backticked mention to `docs/`', () => {
    expect(scrubConstitutionRefs('lives under `docs/constitution/` rules')).toBe('lives under `docs/` rules');
  });

  test('projects a plain-text bare mention to docs/ (nested paths untouched)', () => {
    expect(scrubConstitutionRefs('under docs/constitution/ anywhere')).toBe('under docs/ anywhere');
    // A path nested under another directory is not a top-level docs/constitution/
    // reference — the plain-text rule does not fire behind a "/" separator.
    expect(scrubConstitutionRefs('x/docs/constitution/ stays')).toBe('x/docs/constitution/ stays');
  });

  test('A-7 still wins for part-file mentions (not consumed as bare-directory items)', () => {
    expect(
      scrubConstitutionRefs('see `docs/constitution/06-skill-lifecycle.md` §6')
    ).toBe('see `docs/context.md` §6');
  });
});

// T-20260912-005: JSON files are functional data. Every CONSTITUTION.md
// occurrence in a .json file is a field value some reader depends on (found the
// hard way: propagation-map.json's constitution-context "source_file" was
// scrubbed to "context.md", corrupting the L1 mirror).
describe('scrubConstitutionRefs JSON guard (T-20260912-005)', () => {
  const JSON_FIXTURE = JSON.stringify({
    mode: 'marker-inject',
    source_file: 'CONSTITUTION.md',
    note: 'Scrub transform removes docs/constitution/ links',
  }, null, 2);

  test('.json content is returned byte-identical regardless of target', () => {
    expect(scrubConstitutionRefs(JSON_FIXTURE, '/x/scripts/propagation-map.json')).toBe(JSON_FIXTURE);
    expect(scrubConstitutionRefs(JSON_FIXTURE, '/x/scripts/propagation-map.json', '/x/templates/common/scripts/propagation-map.json')).toBe(JSON_FIXTURE);
  });

  test('extension check is case-insensitive', () => {
    expect(scrubConstitutionRefs(JSON_FIXTURE, '/x/data.JSON')).toBe(JSON_FIXTURE);
  });

  test('without a filePath the prose rules still apply (governance path passes .md content)', () => {
    expect(scrubConstitutionRefs('a CONSTITUTION.md mention')).toBe('a context.md mention');
  });
});

// T-20260912-005: policy self-description HTML comments document the
// Non-Propagation rule itself. Scrubbing them produced self-referentially false
// statements ("must NOT reference context.md") in the L1 governance mirrors.
describe('scrubConstitutionRefs policy self-description comment guard (T-20260912-005)', () => {
  const SELF_DESCRIPTION =
    '<!-- L0-ONLY: This instruction targets the workspace root (L0). L1/L2 projects must NOT reference CONSTITUTION.md — see CONSTITUTION.md §7.5 CONSTITUTION.md Non-Propagation. merge-frontmatter.ts strips CONSTITUTION.md lines from L2 output. -->';

  test('a comment mentioning both CONSTITUTION.md and Non-Propagation is untouched', () => {
    const doc = `# Title\n\n${SELF_DESCRIPTION}\n`;
    expect(scrubConstitutionRefs(doc)).toBe(doc);
    expect(scrubConstitutionRefs(doc, '/x/CLAUDE.md', '/x/templates/common/CLAUDE.md')).toBe(doc);
  });

  test('the "must NOT reference CONSTITUTION.md" phrase alone is sufficient protection', () => {
    const doc = '<!-- L1/L2 projects must NOT reference CONSTITUTION.md -->\n';
    expect(scrubConstitutionRefs(doc)).toBe(doc);
  });

  test('prose outside the protected comment is still scrubbed', () => {
    const doc = `See CONSTITUTION.md first.\n\n${SELF_DESCRIPTION}\n`;
    const expected = `See context.md first.\n\n${SELF_DESCRIPTION}\n`;
    expect(scrubConstitutionRefs(doc)).toBe(expected);
  });

  test('multi-line protected comments survive intact', () => {
    const multi = '<!-- L0-ONLY: documentation of the rule.\n  L1/L2 projects must NOT reference CONSTITUTION.md — see Non-Propagation. -->';
    const doc = `Header mentions CONSTITUTION.md.\n${multi}\n`;
    const expected = `Header mentions context.md.\n${multi}\n`;
    expect(scrubConstitutionRefs(doc)).toBe(expected);
  });

  test('an HTML comment WITHOUT the self-description markers is still scrubbed', () => {
    const doc = '<!-- see CONSTITUTION.md for details -->\n';
    expect(scrubConstitutionRefs(doc)).toBe('<!-- see context.md for details -->\n');
  });
});
