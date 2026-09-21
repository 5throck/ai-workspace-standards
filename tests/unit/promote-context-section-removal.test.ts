// tests/unit/promote-context-section-removal.test.ts
// @version 1.0.0
// Unit tests for the nesting-aware section span helpers (context-sections.ts v1.6.0)
// that power promote-context-section.ts v1.1.0's removal — the fix for the ADR-0050
// Part 3 nested-heading content-loss defect (2026-08-21 incident: promoting "Scripts"
// orphaned `### Hybrid Scripting` in 7 variant files; co-consult/co-export lost it).
//
// Pinned cases: nested `###` inside a promoted `##` is removed WITH the parent (not
// orphaned); fenced code blocks containing `#` lines never terminate a removal; a
// section running to EOF removes to the end; the canonical body extraction includes
// the nested children.

import { describe, expect, it } from 'bun:test';
import { findHeadingSpan, removeHeadingSpan } from '../../scripts/helpers/context-sections.ts';

const DOC_WITH_NESTED = `# Variant Context

## Intro

Intro body.

## Scripts

Script conventions live here.

### Hybrid Scripting

Hybrid content that was once lost in co-consult/co-export.

## Next Section

Next body.
`;

const DOC_WITH_FENCE = `## Scripts

Script conventions.

\`\`\`bash
## this line only looks like a heading
bun run build
\`\`\`

Still inside Scripts.

## After

After body.
`;

const DOC_ENDING_AT_EOF = `## Earlier

Earlier body.

## Scripts

Script body to the very end.
`;

describe('findHeadingSpan (nesting-aware extraction)', () => {
  it('includes nested ### subsections in a promoted ## section body', () => {
    const span = findHeadingSpan(DOC_WITH_NESTED, 'scripts');
    expect(span).not.toBeNull();
    expect(span!.level).toBe(2);
    expect(span!.body).toContain('Script conventions live here.');
    expect(span!.body).toContain('### Hybrid Scripting');
    expect(span!.body).toContain('Hybrid content that was once lost');
    // span ends at the NEXT ## sibling, not at the nested ###
    expect(span!.endLineExclusive).toBe(DOC_WITH_NESTED.split('\n').indexOf('## Next Section'));
  });

  it('does not treat ##-shaped lines inside fences as the span end', () => {
    const span = findHeadingSpan(DOC_WITH_FENCE, 'scripts');
    expect(span).not.toBeNull();
    expect(span!.body).toContain('## this line only looks like a heading');
    expect(span!.body).toContain('Still inside Scripts.');
    expect(span!.body).not.toContain('After body.');
  });

  it('extends to EOF when no same-or-higher heading follows', () => {
    const span = findHeadingSpan(DOC_ENDING_AT_EOF, 'scripts');
    expect(span).not.toBeNull();
    expect(span!.endLineExclusive).toBe(DOC_ENDING_AT_EOF.split('\n').length);
    expect(span!.body).toContain('Script body to the very end.');
  });

  it('promotes a ### heading directly with a level-3 span ending at the next ## or ###', () => {
    const span = findHeadingSpan(DOC_WITH_NESTED, 'hybrid scripting');
    expect(span).not.toBeNull();
    expect(span!.level).toBe(3);
    expect(span!.body).toContain('Hybrid content');
    expect(span!.body).not.toContain('Next body.');
  });

  it('returns null for an unknown heading', () => {
    expect(findHeadingSpan(DOC_WITH_NESTED, 'no such heading')).toBeNull();
  });
});

describe('removeHeadingSpan (nesting-aware removal)', () => {
  it('removes a nested ### subsection together with its promoted ## parent', () => {
    const updated = removeHeadingSpan(DOC_WITH_NESTED, 'scripts');
    expect(updated).not.toBeNull();
    expect(updated).toContain('## Intro');
    expect(updated).not.toContain('## Scripts');
    expect(updated).not.toContain('### Hybrid Scripting');
    expect(updated).not.toContain('Hybrid content that was once lost');
    expect(updated).toContain('## Next Section');
    // blank-line hygiene: exactly one blank line at the removal seam
    expect(updated).toContain('Intro body.\n\n## Next Section');
  });

  it('keeps removing through fenced blocks containing # lines', () => {
    const updated = removeHeadingSpan(DOC_WITH_FENCE, 'scripts');
    expect(updated).not.toBeNull();
    expect(updated).not.toContain('## this line only looks like a heading');
    expect(updated).not.toContain('Still inside Scripts.');
    expect(updated).toContain('## After');
  });

  it('removes to EOF without leaving the section behind', () => {
    const updated = removeHeadingSpan(DOC_ENDING_AT_EOF, 'scripts');
    expect(updated).not.toBeNull();
    expect(updated).not.toContain('## Scripts');
    expect(updated).not.toContain('Script body to the very end.');
    expect(updated).toContain('## Earlier');
  });

  it('returns null for an unknown heading (caller decides fatality)', () => {
    expect(removeHeadingSpan(DOC_WITH_NESTED, 'no such heading')).toBeNull();
  });
});
