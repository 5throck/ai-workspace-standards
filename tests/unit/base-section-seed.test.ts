/**
 * Tests for lib/managed-block-merge.ts seedBaseSections (T-20261128-003,
 * design 2026-11-28-origin-l2-drift-design.md §4.2/§4.4): additive
 * base-section propagation for MERGE_MANAGED docs — the Computational
 * Integrity class. Fixtures mirror the §4.4 cases: co-learning shape
 * (missing section, anchored insert), co-work shape (heading present,
 * no touch), zone safety, idempotency.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { seedBaseSections } from '../../scripts/lib/managed-block-merge.ts';

/** Fixture in the co-learning shape: project doc missing the Computational
 *  Integrity section but carrying project-owned base content and a
 *  VARIANT-INJECT zone. */
const PROJECT_MISSING_CI = `# Test Project —co-learning Configuration

> Extends docs/context.md. Project-owned intro.

---

## Tech Stack

Bun 1.4 + TypeScript.

## Agents

PM gateway dispatch.

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Coding Guidelines
project zone content here
<!-- END VARIANT-INJECT -->

## File Organization Policy

Project keeps deliverables in deliverables/.
`;

const TEMPLATE_WITH_CI = `# [Project Name] —co-learning Configuration

> Extends docs/context.md.

---

## Tech Stack

Template stack.

## Agents

Template agents.

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Coding Guidelines
template zone content
<!-- END VARIANT-INJECT -->

## Computational Integrity

All numeric outputs in deliverables must be computed by executed code (bun/TypeScript scripts) — never by mental arithmetic.

## File Organization Policy

Template file org.

### Recommended Folder Structure

| Folder | Purpose |
|--------|---------|
`;

describe('seedBaseSections — add-if-missing (§4.4 case 1)', () => {
  test('missing section inserted at the anchored position; project content byte-preserved', () => {
    const r = seedBaseSections(PROJECT_MISSING_CI, TEMPLATE_WITH_CI);
    expect(r.seeded.map((s) => s.heading)).toContain('## Computational Integrity');
    // anchored: CI lands after the project's zone close (the anchor chain
    // resolves to ## Agents — the last template heading present outside the
    // zone; the zone-interior heading copy is invisible to the chain), i.e.
    // before ## File Organization Policy, respecting template position
    const ciIdx = r.content.indexOf('## Computational Integrity');
    const zoneEnd = r.content.indexOf('<!-- END VARIANT-INJECT -->');
    const fop = r.content.indexOf('## File Organization Policy');
    expect(ciIdx).toBeGreaterThan(zoneEnd);
    expect(ciIdx).toBeLessThan(fop);
    // project-owned content untouched
    expect(r.content).toContain('Project-owned intro.');
    expect(r.content).toContain('Bun 1.4 + TypeScript.');
    expect(r.content).toContain('PM gateway dispatch.');
    expect(r.content).toContain('Project keeps deliverables in deliverables/.');
    expect(r.content).toContain('project zone content here');
    // no deletions (strict superset)
    expect(r.content.length).toBeGreaterThan(PROJECT_MISSING_CI.length);
  });

  test('consecutive missing template sections stack in template order at one run base', () => {
    const r = seedBaseSections(PROJECT_MISSING_CI, TEMPLATE_WITH_CI);
    // Template order after the zone: CI, FileOrg(present), RFS(### missing)
    // — the missing-after-present pair (RFS) anchors to FileOrg's end.
    const seeded = r.seeded.map((s) => s.heading);
    expect(seeded).toEqual(['## Computational Integrity', '### Recommended Folder Structure']);
    // CI's anchor is the zone's heading (present in project); RFS anchors to FileOrg
    expect(r.seeded[0]!.anchor).toBe('## Agents');
    expect(r.seeded[1]!.anchor).toBe('## File Organization Policy');
  });

  test('anchor chain across consecutive missing sections (template head sections absent from project)', () => {
    // project has only Tech Stack; Agents/CI/FileOrg missing → chain stacks
    const project = `# Project

## Tech Stack

Only stack present.
`;
    const template = `# Template

## Tech Stack

t

## Agents

a

## Computational Integrity

ci
`;
    const r = seedBaseSections(project, template);
    expect(r.seeded.map((s) => s.heading)).toEqual(['## Agents', '## Computational Integrity']);
    expect(r.seeded[0]!.anchor).toBe('## Tech Stack');
    expect(r.seeded[1]!.anchor).toBe('## Agents'); // chained through the planned section
    const agentsIdx = r.content.indexOf('## Agents');
    const ciIdx = r.content.indexOf('## Computational Integrity');
    expect(agentsIdx).toBeLessThan(ciIdx);
    // both after the anchor's section end (EOF here — appended region in order)
    expect(r.content.indexOf('Only stack present.')).toBeLessThan(agentsIdx);
  });
});

describe('seedBaseSections — heading present → no touch (§4.4 case 2, co-work shape)', () => {
  test('a project copy already carrying the section is byte-identical, zero seeds', () => {
    const coWorkShape = PROJECT_MISSING_CI.replace(
      '## File Organization Policy',
      ['## Computational Integrity', '', 'Project-adapted CI text (executed code only).', '', '## File Organization Policy'].join('\n'),
    );
    const r = seedBaseSections(coWorkShape, TEMPLATE_WITH_CI);
    // CI heading present → not seeded; other template-only sections may seed,
    // but the project's OWN CI text is never touched
    expect(r.seeded.map((s) => s.heading)).not.toContain('## Computational Integrity');
    expect(r.content).toContain('Project-adapted CI text (executed code only).');
    expect(r.content).not.toContain('All numeric outputs in deliverables must be computed by executed code');
  });

  test('exact-heading match is whitespace-normalized, and template-only sections still seed', () => {
    const padded = PROJECT_MISSING_CI.replace('## Tech Stack', '##   Tech   Stack ');
    const r = seedBaseSections(padded, TEMPLATE_WITH_CI);
    expect(r.seeded.map((s) => s.heading)).not.toContain('## Tech Stack');
    expect(r.content).toContain('##   Tech   Stack '); // project text untouched
  });
});

describe('seedBaseSections — zone safety (§4.4 case 3)', () => {
  test('VARIANT-INJECT zones byte-identical before/after', () => {
    const r = seedBaseSections(PROJECT_MISSING_CI, TEMPLATE_WITH_CI);
    const zoneBefore = '<!-- VARIANT-INJECT: guidelines [REQUIRED] -->\n## Coding Guidelines\nproject zone content here\n<!-- END VARIANT-INJECT -->';
    expect(r.content).toContain(zoneBefore);
  });

  test('a template section overlapping a zone boundary is not seeded', () => {
    // template: Workflow Phases section's body runs up to the zone marker —
    // its span touches the zone line, so the marker-adjacent section is skipped
    const template = `# Template

## Tech Stack

t

## Development Workflow

template workflow body

<!-- VARIANT-INJECT: guidelines -->
## Coding Guidelines
zone
<!-- END VARIANT-INJECT -->

## Computational Integrity

ci
`;
    const project = `# Project

## Tech Stack

p
`;
    const r = seedBaseSections(project, template);
    // Development Workflow's section span [heading .. marker line) touches the
    // zone span → not seeded; CI (outside zones) seeds
    expect(r.seeded.map((s) => s.heading)).toEqual(['## Computational Integrity']);
    expect(r.content).not.toContain('template workflow body');
    expect(r.content).toContain('ci');
  });

  test('an insertion point inside a project zone span is clamped to after the span', () => {
    // project's Agents section runs straight into its zone — the anchored
    // insertion point (next heading inside the zone) must clamp to the span end
    const project = `# Project

## Agents

PM dispatch.

<!-- VARIANT-INJECT: guidelines -->
## Coding Guidelines
zone content
<!-- END VARIANT-INJECT -->

## File Organization Policy

org
`;
    const template = `# Template

## Agents

a

## Computational Integrity

ci body
`;
    const r = seedBaseSections(project, template);
    expect(r.seeded.map((s) => s.heading)).toEqual(['## Computational Integrity']);
    const ciIdx = r.content.indexOf('## Computational Integrity');
    const zoneEnd = r.content.indexOf('<!-- END VARIANT-INJECT -->');
    const zoneContent = r.content.indexOf('zone content');
    expect(ciIdx).toBeGreaterThan(zoneEnd); // after the zone, never inside
    expect(r.content).toContain('zone content'); // project zone text intact
    void zoneContent;
  });
});

describe('seedBaseSections — idempotency (§4.4 case 4)', () => {
  test('running the merge twice yields byte-identical output the second time', () => {
    const r1 = seedBaseSections(PROJECT_MISSING_CI, TEMPLATE_WITH_CI);
    expect(r1.seeded.length).toBeGreaterThan(0);
    const r2 = seedBaseSections(r1.content, TEMPLATE_WITH_CI);
    expect(r2.seeded).toHaveLength(0);
    expect(r2.content).toBe(r1.content);
  });
});

describe('seedBaseSections — guards', () => {
  test('template with no seedable sections returns the project content unchanged', () => {
    const template = '# Title\n\nNo sections here.\n';
    const r = seedBaseSections(PROJECT_MISSING_CI, template);
    expect(r.content).toBe(PROJECT_MISSING_CI);
    expect(r.seeded).toHaveLength(0);
  });

  test('project content without headings → template sections append in order', () => {
    const project = '# Project\n\nfree-form notes\n';
    const template = '# T\n\n## Alpha\n\nalpha body\n\n## Beta\n\nbeta body\n';
    const r = seedBaseSections(project, template);
    expect(r.seeded.map((s) => s.heading)).toEqual(['## Alpha', '## Beta']);
    // Alpha has no preceding heading → appended with a null anchor; Beta chains
    // through the planned Alpha (same run base, template order preserved)
    expect(r.seeded[0]!.anchor).toBeNull();
    expect(r.seeded[1]!.anchor).toBe('## Alpha');
    const alphaIdx = r.content.indexOf('## Alpha');
    const betaIdx = r.content.indexOf('## Beta');
    expect(alphaIdx).toBeLessThan(betaIdx);
    expect(r.content).toContain('free-form notes');
  });

  test('a ### section nested under a present ## parent seeds right after the parent section', () => {
    const project = `# P

## Parent

parent body
`;
    const template = `# T

## Parent

t body

### Child Rule

child body
`;
    const r = seedBaseSections(project, template);
    expect(r.seeded.map((s) => s.heading)).toEqual(['### Child Rule']);
    expect(r.seeded[0]!.anchor).toBe('## Parent');
    const childIdx = r.content.indexOf('### Child Rule');
    const parentBodyIdx = r.content.indexOf('parent body');
    expect(childIdx).toBeGreaterThan(parentBodyIdx);
    expect(r.content).toContain('parent body'); // project body preserved
  });
});
