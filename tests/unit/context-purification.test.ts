// tests/unit/context-purification.test.ts
// @version 1.0.0
// Unit tests for scripts/helpers/context-sections.ts v1.1.0 — context purification
// (W1, promotion-time extraction) and commonization (W2, upgrade-time pruning).
// Spec: docs/designs/2026-09-10-context-purification-design.md (D1/D2/D6).
//
// Fixtures marked "REAL FLEET" are copied verbatim from the live fleet files the
// thresholds were tuned on (2026-09-10): the 6 identical `## Procedures` stubs
// (Projects/{co-abap,co-architect,co-consult,co-deck,co-price,co-safety}/docs/context.md)
// and co-develop's `## Computational Integrity` / `## File Organization Policy`.
// These pin the tuned threshold behavior — changing the tokenizer or thresholds
// must update them consciously.

import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyCommonizationSection,
  classifyProjectSection,
  computeLineOverlapSimilarity,
  computeTokenOverlapSimilarity,
  extractProjectOnlySections,
  splitContextFileSections,
  splitIntoSections,
  splitIntoTopLevelSections,
  splitOffVersionFooter,
  stripVersionFooter,
  W1_SUPERSEDED_THRESHOLD,
  W2_REMOVE_THRESHOLD,
  W2_REVIEW_FLOOR,
  type ContextSection,
} from '../../scripts/helpers/context-sections.ts';
import { ensureVariantInjectMarkers, purifyPromotedContextMd } from '../../scripts/helpers/generate-variant.ts';
import { findMissingPurifiedSections } from '../../scripts/l3-to-variant-pipeline.ts';

// ── REAL FLEET fixtures (verbatim) ─────────────────────────────────────────────

/** templates/common/docs/context.md — `### Procedure Graph` body (lines 427-429). */
const COMMON_PROCEDURE_GRAPH_BODY = `Each template layer owns structured procedures in \`procedures/<name>/schema.yaml\` (authoring skeleton: \`templates/common/procedures/_template/\`). Procedures are the canonical source for the workflow graph — validate with \`bun scripts/validate-procedures.ts --all\`, check coverage with \`bun scripts/procedure-coverage.ts\` (gaps become governance tickets via \`--tickets\`). Never hand-edit procedure-derived graph nodes. See \`docs/procedure-schema-spec.md\` and constitution §6.7.`;

/** Projects/co-abap/docs/context.md:301-303 — identical in all 6 fleet files. */
const FLEET_PROCEDURES_STUB = `## Procedures

Structured workflows live in \`procedures/<name>/schema.yaml\` (ADR-0063, canonical workflow source). Validate with \`bun scripts/validate-procedures.ts\`; the skill graph derives procedure/output_type nodes and step edges from them.`;

/** Projects/co-develop/docs/co-develop.context.md:143-148 — identical in co-game/co-security. */
const CO_DEVELOP_COMPUTATIONAL_INTEGRITY = `## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See \`docs/context.md\` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.`;

/** A genuinely project-unique section — nothing in the common template talks about it. */
const PROJECT_ONLY_SECTION = `## Domain Configuration Notes

Fixture-unique project-only content: the co-e2etest domain enables the \`e2e-fixture-mode\` runtime flag (declared in \`docs/e2e-config.json\`) and ships a bespoke \`fixtures/seeds/*.json\` corpus that exists nowhere in the common template.`;

const COMMON_TEMPLATE_EXCERPT = `# Common Context

## Project Overview

This project follows the workspace standards.

## Lifecycle Management

Lifecycle practices live here.

### Procedure Graph

${COMMON_PROCEDURE_GRAPH_BODY}

## Git / PR Workflow

<!-- intentional-duplicate: workspace standards §3 — maintained locally for AI context proximity; source: docs/constitution/03-pr-workflow.md; hash: e43638d6 -->

\`\`\`
/sync "feat: description"
  — 1. memory log (memlog)
  — 2. MEMORY.md index update (sync-md)
  — 3. CHANGELOG.md [Unreleased] auto-add
  — 4. audit.ts  (must exit 0)
  — 5. git checkout -b pr/<date>-<slug>
  — 6. git commit + push
  — 7. gh pr create
\`\`\`

> All PR titles, bodies, and review comments must be in **English**.

## Platform Hooks & Governance Enforcement

Hooks are enforced per platform.
`;

function sectionOf(md: string): ContextSection {
  const sections = splitIntoTopLevelSections(md);
  expect(sections.length).toBe(1);
  return sections[0];
}

// ── Fence-aware splitting ──────────────────────────────────────────────────────

describe('splitIntoSections (fence-aware)', () => {
  it('does NOT treat ## headings inside ``` fences as section boundaries', () => {
    const content = [
      '## Documentation Standards',
      '',
      'Every session log MUST include:',
      '',
      '```markdown',
      '## Session Summary',
      '<!-- one paragraph -->',
      '## Changes',
      '- file — created: reason',
      '```',
      '',
      'Back to prose.',
    ].join('\n');
    const sections = splitIntoSections(content);
    expect(sections.length).toBe(1);
    expect(sections[0].heading).toBe('documentation standards');
    expect(sections[0].body).toContain('## Session Summary');
  });

  it('handles ~~~ fences as well as ``` fences', () => {
    const content = ['## Real', '', '~~~', '### not a heading', '~~~', '', 'prose'].join('\n');
    const sections = splitIntoSections(content);
    expect(sections.length).toBe(1);
    expect(sections[0].heading).toBe('real');
  });

  it('still splits on real ##/### headings outside fences (backward compat)', () => {
    const content = '## Alpha\n\nalpha body\n\n### Beta\n\nbeta body\n\n## Gamma\n\ngamma body';
    const headings = splitIntoSections(content).map(s => s.heading);
    expect(headings).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('reproduces the real common template shape: no phantom Session Summary section', () => {
    // The common template embeds ## Session Summary / ## Changes / ## Decisions /
    // ## Open Issues / ## [Unreleased] inside fences — pre-v1.1.0 these became
    // phantom sections. Fixture mirrors that construct.
    const content = [
      '### Session Log Format (`memory/YYYY-MM-DD.md`)',
      '',
      '```markdown',
      '## Session Summary',
      '## Changes',
      '## Decisions',
      '## Open Issues',
      '```',
      '',
      '### CHANGELOG Entry Format (`CHANGELOG.md`)',
      '',
      '```markdown',
      '## [Unreleased]',
      '### Added',
      '```',
    ].join('\n');
    const headings = splitIntoSections(content).map(s => s.heading);
    expect(headings).toEqual(['session log format (`memory/yyyy-mm-dd.md`)', 'changelog entry format (`changelog.md`)']);
  });
});

describe('splitIntoTopLevelSections', () => {
  it('keeps ### subsections inside their ## parent body', () => {
    const sections = splitIntoTopLevelSections(COMMON_TEMPLATE_EXCERPT);
    expect(sections.map(s => s.heading)).toEqual(['project overview', 'lifecycle management', 'git / pr workflow', 'platform hooks & governance enforcement']);
    const lifecycle = sections[1];
    expect(lifecycle.body).toContain('### Procedure Graph');
    expect(lifecycle.body).toContain(COMMON_PROCEDURE_GRAPH_BODY);
  });
});

// ── Version footer handling ────────────────────────────────────────────────────

describe('version footer', () => {
  it('splits off a common-template style footer', () => {
    const content = `## Scripts\n\n| Script |\n|--------|\n\n---\n\n*context.md version: 2.5 — promoted "Scripts" section*`;
    const { body, footer } = splitOffVersionFooter(content);
    expect(body).not.toContain('context.md version');
    expect(footer).toContain('*context.md version: 2.5');
    expect(stripVersionFooter(content)).toBe(body);
  });

  it('splits off a variant-context style footer', () => {
    const content = `## Agents\n\nRoster here.\n\n---\n\n*co-develop.context.md version: 1.2 — Per-Role Deliverable Artifacts chain*`;
    const { body, footer } = splitOffVersionFooter(content);
    // body keeps the blank line preceding the --- separator (pure split, no mutation)
    expect(body.trimEnd()).toBe('## Agents\n\nRoster here.');
    expect(footer).toContain('*co-develop.context.md version: 1.2');
  });

  it('returns footer=\'\' when no footer is present', () => {
    const { body, footer } = splitOffVersionFooter('## Alpha\n\nbody');
    expect(body).toBe('## Alpha\n\nbody');
    expect(footer).toBe('');
  });

  it('keeps a mid-file version-like line intact (EOF-anchored match only)', () => {
    const content = '*context.md version: 2.5*\n\n## Alpha\n\nbody';
    expect(stripVersionFooter(content)).toBe(content);
  });
});

// ── Managed zones ──────────────────────────────────────────────────────────────

describe('splitContextFileSections (managed zones)', () => {
  it('flags sections whose heading sits inside a COMMON-* zone', () => {
    const content = [
      '## Alpha',
      '',
      'alpha body',
      '',
      '<!-- COMMON-CONTEXT:START -->',
      '## Engine Owned',
      'engine content',
      '<!-- COMMON-CONTEXT:END -->',
      '',
      '## Beta',
      '',
      'beta body',
    ].join('\n');
    const sections = splitContextFileSections(content);
    const free = sections.filter(s => !s.headingInManagedZone).map(s => s.section.heading);
    const flagged = sections.filter(s => s.headingInManagedZone).map(s => s.section.heading);
    expect(free).toEqual(['alpha', 'beta']);
    expect(flagged).toEqual(['engine owned']);
  });

  it('strips COMMON-* zone content from a surviving section body', () => {
    const content = [
      '## Domain Rules',
      '',
      '1. Project rule one.',
      '',
      '<!-- COMMON-CONTEXT:START -->',
      'All operational scripts must be TypeScript.',
      '<!-- COMMON-CONTEXT:END -->',
      '',
      '2. Project rule two.',
    ].join('\n');
    const [domain] = splitContextFileSections(content);
    expect(domain.section.heading).toBe('domain rules');
    expect(domain.bodyContainedManagedZone).toBe(true);
    expect(domain.section.body).toContain('1. Project rule one.');
    expect(domain.section.body).toContain('2. Project rule two.');
    expect(domain.section.body).not.toContain('All operational scripts must be TypeScript.');
  });

  it('excludes VARIANT-INJECT blocks when includeVariantInject is set', () => {
    const content = [
      '## Alpha',
      '',
      'before',
      '',
      '<!-- VARIANT-INJECT: guidelines [REQUIRED] -->',
      '## Injected Guidelines',
      'guideline content',
      '<!-- END VARIANT-INJECT -->',
      '',
      'after',
    ].join('\n');
    const withInject = splitContextFileSections(content, { includeVariantInject: true });
    expect(withInject.filter(s => !s.headingInManagedZone).map(s => s.section.heading)).toEqual(['alpha']);
    expect(withInject.filter(s => s.headingInManagedZone).map(s => s.section.heading)).toEqual(['injected guidelines']);
    // Without the flag, VARIANT-INJECT content stays unflagged (and in the body).
    const withoutInject = splitContextFileSections(content);
    expect(withoutInject.filter(s => s.headingInManagedZone)).toHaveLength(0);
    expect(withoutInject.map(s => s.section.heading)).toContain('injected guidelines');
  });

  it('reports original line ranges for splicing', () => {
    const content = '## Alpha\n\na1\n\n## Beta\n\nb1\nb2';
    const sections = splitContextFileSections(content);
    expect(sections[0].startLine).toBe(0);
    expect(sections[0].endLineExclusive).toBe(4);
    expect(sections[1].startLine).toBe(4);
    expect(sections[1].endLineExclusive).toBe(8);
  });
});

// ── Similarity primitives ──────────────────────────────────────────────────────

describe('computeTokenOverlapSimilarity (tuning pins)', () => {
  it('scores the REAL FLEET Procedures stub 0.600 against the common Procedure Graph', () => {
    const stub = sectionOf(FLEET_PROCEDURES_STUB);
    const graph = sectionOf(`## Procedure Graph\n\n${COMMON_PROCEDURE_GRAPH_BODY}`);
    expect(computeTokenOverlapSimilarity(stub.body, graph.body)).toBeCloseTo(0.600, 3);
  });

  it('scores line-exact overlap of the same pair 0.000 — the stub is a paraphrase', () => {
    const stub = sectionOf(FLEET_PROCEDURES_STUB);
    const graph = sectionOf(`## Procedure Graph\n\n${COMMON_PROCEDURE_GRAPH_BODY}`);
    expect(computeLineOverlapSimilarity(stub.body, graph.body)).toBe(0);
  });

  it('scores identical bodies 1 and disjoint bodies 0', () => {
    expect(computeTokenOverlapSimilarity('alpha beta gamma', 'alpha beta gamma')).toBe(1);
    expect(computeTokenOverlapSimilarity('alpha beta gamma', 'delta epsilon zeta')).toBe(0);
    expect(computeTokenOverlapSimilarity('', 'alpha')).toBe(0);
  });
});

// ── W1 classification ──────────────────────────────────────────────────────────

describe('classifyProjectSection (W1)', () => {
  const commonSections = splitIntoSections(COMMON_TEMPLATE_EXCERPT);

  it('classifies the REAL FLEET Procedures stub as superseded at the tuned threshold', () => {
    const classification = classifyProjectSection(sectionOf(FLEET_PROCEDURES_STUB), commonSections);
    expect(classification.verdict).toBe('superseded');
    expect(classification.maxSimilarity).toBeCloseTo(0.600, 3);
    expect(classification.matchedCommonHeading).toBe('procedure graph');
  });

  it('classifies a genuinely unique section as projectOnly', () => {
    const classification = classifyProjectSection(sectionOf(PROJECT_ONLY_SECTION), commonSections);
    expect(classification.verdict).toBe('projectOnly');
    expect(classification.maxSimilarity).toBeLessThan(W1_SUPERSEDED_THRESHOLD);
  });

  it('short-circuits to shared when the heading exists in common', () => {
    const classification = classifyProjectSection(sectionOf('## Project Overview\n\ncompletely different words'), commonSections);
    expect(classification.verdict).toBe('shared');
  });

  it('respects a custom superseded threshold', () => {
    const stub = sectionOf(FLEET_PROCEDURES_STUB);
    expect(classifyProjectSection(stub, commonSections, { supersededThreshold: 0.7 }).verdict).toBe('projectOnly');
  });
});

describe('extractProjectOnlySections (W1)', () => {
  it('routes stub → superseded and unique section → projectOnly, ignoring shared sections', () => {
    const projectContextMd = [
      '# Project Context',
      '',
      'Intro prose is discarded (pre-first-heading).',
      '',
      '## Project Overview',
      '',
      'Shared boilerplate — same heading as common.',
      '',
      FLEET_PROCEDURES_STUB,
      '',
      PROJECT_ONLY_SECTION,
      '',
      '---',
      '',
      '*context.md version: 2.5 — promoted "Scripts" section*',
    ].join('\n');

    const { projectOnly, superseded } = extractProjectOnlySections(projectContextMd, COMMON_TEMPLATE_EXCERPT);
    expect(superseded.map(s => s.heading)).toEqual(['procedures']);
    expect(projectOnly.map(s => s.heading)).toEqual(['domain configuration notes']);
    expect(projectOnly[0].body).toContain('e2e-fixture-mode');
    // footer text must not leak into any extracted body
    for (const section of [...projectOnly, ...superseded]) {
      expect(section.body).not.toContain('context.md version');
    }
  });

  it('returns empty lists for a project file identical to the common heading set', () => {
    const projectContextMd = '## Project Overview\n\nboilerplate\n\n## Lifecycle Management\n\nlifecycle';
    const { projectOnly, superseded } = extractProjectOnlySections(projectContextMd, COMMON_TEMPLATE_EXCERPT);
    expect(projectOnly).toHaveLength(0);
    expect(superseded).toHaveLength(0);
  });

  it('skips sections whose heading sits inside a managed zone', () => {
    const projectContextMd = [
      '## Alpha',
      '',
      'unique alpha content with e2e-fixture-mode',
      '',
      '<!-- COMMON-CONSTITUTION:START -->',
      '## Zone Owned',
      'zone unique content qqq',
      '<!-- COMMON-CONSTITUTION:END -->',
    ].join('\n');
    const { projectOnly } = extractProjectOnlySections(projectContextMd, COMMON_TEMPLATE_EXCERPT);
    expect(projectOnly.map(s => s.heading)).toEqual(['alpha']);
  });
});

// ── W2 classification ──────────────────────────────────────────────────────────

describe('classifyCommonizationSection (W2, tuning pins)', () => {
  const commonSections = splitIntoSections(COMMON_TEMPLATE_EXCERPT);

  it('classifies co-develop Computational Integrity as REMOVE (0.667 vs common standards section)', () => {
    // Stand-in for the common template's ## Computational Integrity Standards intro:
    // same paragraph the tuning measured against (verbatim from templates/common/docs/context.md).
    const commonStandards = splitIntoSections(
      '## Computational Integrity Standards\n\nFor domains requiring high-precision or safety-critical numerical computation, **AI must NOT perform calculations directly**. Delegate to validated external tools instead. This applies to ALL reported numbers: aggregations, statistics, percentages, and metrics in any deliverable must be computed by executed code (bun/TypeScript scripts), never by the AI performing arithmetic directly.',
    );
    const mergedCommon = [...commonSections, ...commonStandards];
    const classification = classifyCommonizationSection(sectionOf(CO_DEVELOP_COMPUTATIONAL_INTEGRITY), mergedCommon);
    expect(classification.verdict).toBe('remove');
    expect(classification.maxSimilarity).toBeCloseTo(0.667, 3);
    expect(classification.matchedCommonHeading).toBe('computational integrity standards');
  });

  it('classifies a project-specific File Organization Policy table as KEEP (must NOT be auto-removed)', () => {
    const fop = sectionOf([
      '## File Organization Policy',
      '',
      '### Recommended Folder Structure (co-develop)',
      '| Folder | Purpose |',
      '|--------|---------|',
      '| `docs/adr/` | Architecture Decision Records |',
      '| `docs/specs/` | Technical specifications |',
      '| `docs/api/` | API documentation |',
      '| `memory/` | Session logs, meeting transcripts, QA records |',
    ].join('\n'));
    const classification = classifyCommonizationSection(fop, commonSections);
    expect(classification.verdict).toBe('keep');
    expect(classification.maxSimilarity).toBeLessThan(W2_REVIEW_FLOOR);
  });

  it('classifies partial overlap as REVIEW and never as remove', () => {
    const mixed = sectionOf([
      '## Development Workflow',
      '',
      'All PR titles, bodies, and review comments must be in **English**.',
      'Project-specific: run the fixture harness before every dispatch.',
    ].join('\n'));
    const classification = classifyCommonizationSection(mixed, commonSections);
    expect(classification.verdict).toBe('review');
    expect(classification.maxSimilarity).toBeGreaterThanOrEqual(W2_REVIEW_FLOOR);
    expect(classification.maxSimilarity).toBeLessThan(W2_REMOVE_THRESHOLD);
  });

  it('honors custom thresholds', () => {
    const section = sectionOf(CO_DEVELOP_COMPUTATIONAL_INTEGRITY);
    const standards = splitIntoSections(
      '## Computational Integrity Standards\n\nFor domains requiring high-precision or safety-critical numerical computation, **AI must NOT perform calculations directly**. Delegate to validated external tools instead. This applies to ALL reported numbers: aggregations, statistics, percentages, and metrics in any deliverable must be computed by executed code (bun/TypeScript scripts), never by the AI performing arithmetic directly.',
    );
    expect(
      classifyCommonizationSection(section, [...commonSections, ...standards], { removeThreshold: 0.8 }).verdict,
    ).toBe('review');
  });

  it('exports the tuned threshold values', () => {
    expect(W1_SUPERSEDED_THRESHOLD).toBe(0.55);
    expect(W2_REMOVE_THRESHOLD).toBe(0.65);
    expect(W2_REVIEW_FLOOR).toBe(0.3);
  });
});

// ── W1 seam integration (generate-variant.ts) ──────────────────────────────────

describe('purifyPromotedContextMd (generate-variant seam integration)', () => {
  it('merges project-only sections before the footer, drops the superseded stub, keeps inject markers', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctx-purify-'));
    try {
      // L3 source layout: <l3>/docs/co-e2etest.context.md next to <l3>/docs/context.md
      const l3DocsDir = join(tempDir, 'l3', 'docs');
      mkdirSync(l3DocsDir, { recursive: true });
      const sourceVariantCtx = join(l3DocsDir, 'co-e2etest.context.md');
      writeFileSync(sourceVariantCtx, '# co-e2etest Context\n\n> scaffold stub\n', 'utf8');
      writeFileSync(
        join(l3DocsDir, 'context.md'),
        [
          '# Project Context',
          '',
          '## Project Overview',
          '',
          'Shared boilerplate.',
          '',
          FLEET_PROCEDURES_STUB,
          '',
          PROJECT_ONLY_SECTION,
          '',
          '---',
          '',
          '*context.md version: 2.5 — promoted "Scripts" section*',
        ].join('\n'),
        'utf8',
      );

      // Promoted target: generated skeleton with VARIANT-INJECT slot + version footer
      const outDocsDir = join(tempDir, 'out', 'docs');
      const targetCtx = join(outDocsDir, 'co-e2etest.context.md');
      mkdirSync(outDocsDir, { recursive: true });
      const skeleton = [
        '# co-e2etest Context',
        '',
        '<!-- VARIANT-INJECT: guidelines [REQUIRED] -->',
        '## Guidelines',
        '',
        'skeleton guideline content',
        '<!-- END VARIANT-INJECT -->',
        '',
        '---',
        '',
        '*co-e2etest.context.md version: 1.0 — scaffold*',
      ].join('\n');
      writeFileSync(targetCtx, skeleton, 'utf8');

      // The exact seam sequence from generate-variant.ts's copy loop:
      writeFileSync(targetCtx, ensureVariantInjectMarkers(readFileSync(targetCtx, 'utf8')), 'utf8');
      const ledger = purifyPromotedContextMd(sourceVariantCtx, targetCtx, 'co-e2etest');

      expect(ledger.merged).toEqual(['domain configuration notes']);
      expect(ledger.dropped).toEqual(['procedures']);

      const merged = readFileSync(targetCtx, 'utf8');
      expect(merged).toContain('## Domain Configuration Notes');
      expect(merged).toContain('e2e-fixture-mode');
      expect(merged).not.toContain('the skill graph derives procedure/output_type nodes');
      // marker safety preserved: the VARIANT-INJECT slot survives the merge untouched
      expect(merged).toContain('<!-- VARIANT-INJECT: guidelines [REQUIRED] -->');
      expect(merged).toContain('<!-- END VARIANT-INJECT -->');
      // ordering: merged section sits BEFORE the version footer, footer still at EOF
      const mergedIdx = merged.indexOf('## Domain Configuration Notes');
      const footerIdx = merged.indexOf('*co-e2etest.context.md version: 1.0 — scaffold*');
      expect(mergedIdx).toBeGreaterThan(-1);
      expect(footerIdx).toBeGreaterThan(mergedIdx);
      expect(merged.trimEnd().endsWith('*co-e2etest.context.md version: 1.0 — scaffold*')).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns an empty ledger and leaves the target untouched when the L3 has no docs/context.md', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'ctx-purify-'));
    try {
      const sourceVariantCtx = join(tempDir, 'l3', 'docs', 'co-e2etest.context.md');
      const targetCtx = join(tempDir, 'out', 'docs', 'co-e2etest.context.md');
      mkdirSync(join(tempDir, 'out', 'docs'), { recursive: true });
      writeFileSync(targetCtx, '# co-e2etest Context\n\n---\n\n*co-e2etest.context.md version: 1.0 — scaffold*', 'utf8');
      const ledger = purifyPromotedContextMd(sourceVariantCtx, targetCtx, 'co-e2etest');
      expect(ledger.merged).toHaveLength(0);
      expect(ledger.dropped).toHaveLength(0);
      expect(readFileSync(targetCtx, 'utf8')).toBe('# co-e2etest Context\n\n---\n\n*co-e2etest.context.md version: 1.0 — scaffold*');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

// ── Phase 4.7 gate core (pipeline) ─────────────────────────────────────────────

describe('findMissingPurifiedSections (Phase 4.7 fail-closed gate core)', () => {
  const finalContent = [
    '# co-e2etest Context',
    '',
    '<!-- VARIANT-INJECT: guidelines [REQUIRED] -->',
    '## Guidelines',
    '<!-- END VARIANT-INJECT -->',
    '',
    '## Domain Configuration Notes',
    '',
    'project-only content with e2e-fixture-mode',
    '',
    '---',
    '',
    '*co-e2etest.context.md version: 1.0 — scaffold*',
  ].join('\n');

  it('returns [] when every merged section is present by normalized heading', () => {
    expect(findMissingPurifiedSections(finalContent, ['domain configuration notes'])).toEqual([]);
  });

  it('reports missing section names (Phase 4.7 BLOCKING input)', () => {
    expect(findMissingPurifiedSections(finalContent, ['domain configuration notes', 'extra project rules'])).toEqual(['extra project rules']);
  });

  it('is position-independent (merged section before the version footer is found)', () => {
    // the section sits mid-file, before the footer — presence, not position, decides
    expect(findMissingPurifiedSections(finalContent, ['domain configuration notes'])).toEqual([]);
    expect(findMissingPurifiedSections(finalContent, ['guidelines'])).toEqual([]);
  });

  it('matches case-insensitively via normalized headings', () => {
    expect(findMissingPurifiedSections(finalContent, ['Domain Configuration Notes'])).toEqual([]);
  });

  it('returns [] for an empty ledger', () => {
    expect(findMissingPurifiedSections(finalContent, [])).toEqual([]);
  });
});
