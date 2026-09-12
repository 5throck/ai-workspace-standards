/**
 * Unit tests for findProjectOnlySections() (helpers/context-sections.ts v1.3.0) —
 * the upgrade-time ownership detection behind docs/context.md's CONTEXT PRESERVE gate
 * (T-20260912-001): which top-level sections would a template overwrite destroy?
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  findProjectOnlySections,
  splitOffVersionFooter,
} from '../../scripts/helpers/context-sections.ts';

const FOOTER = '\n---\n\n*context.md version: 2.6 — test footer*';

const TEMPLATE_BODY = [
  '# [Project Name] — Project Context',
  '',
  '## Shared Section A',
  'shared body A',
  '',
  '## Shared Section B',
  'shared body B',
].join('\n');

const TEMPLATE = TEMPLATE_BODY + FOOTER;

function projectWith(extraSections: string[], opts?: { footer?: string }): string {
  const body = TEMPLATE_BODY + '\n\n' + extraSections.join('\n\n');
  return body + (opts?.footer === undefined ? FOOTER : opts.footer);
}

describe('findProjectOnlySections', () => {
  test('detects a project-only section (heading absent from template)', () => {
    const project = projectWith(['## Project Specific Workflow', 'do the co-newbiz thing']);
    const { sections, wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('project specific workflow');
    expect(sections[0].body).toContain('co-newbiz thing');
  });

  test('template-only sections are ignored (not project-only)', () => {
    // Project copy missing a section the template has — absence is not ownership.
    const project = TEMPLATE_BODY + FOOTER;
    const templateWithExtra = TEMPLATE_BODY + '\n\n## Newly Added By Template\nfresh\n' + FOOTER;
    const { sections, wholeFileOwned } = findProjectOnlySections(project, templateWithExtra);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(0);
  });

  test('identical files yield no project-only sections', () => {
    const { sections, wholeFileOwned } = findProjectOnlySections(TEMPLATE, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(0);
  });

  test('sections wrapping managed COMMON-* zones are excluded (bodyContainedManagedZone)', () => {
    const project = projectWith([
      '## Wrapped Zone',
      'some intro line',
      '<!-- COMMON-CONTEXT: START -->',
      'engine-managed content',
      '<!-- COMMON-CONTEXT: END -->',
    ]);
    const { sections } = findProjectOnlySections(project, TEMPLATE);
    expect(sections).toHaveLength(0);
  });

  test('headings inside managed zones are excluded (headingInManagedZone)', () => {
    const project = [
      TEMPLATE_BODY,
      '',
      '<!-- COMMON-FOO: START -->',
      '## Inside Zone',
      'managed body',
      '<!-- COMMON-FOO: END -->',
      FOOTER,
    ].join('\n');
    const { sections } = findProjectOnlySections(project, TEMPLATE);
    expect(sections).toHaveLength(0);
  });

  test('wholeFileOwned when the project copy has no version footer', () => {
    const project = TEMPLATE_BODY + '\n\n## Extra Section\nmine\n'; // no footer at all
    const { sections, wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(true);
    expect(sections.map(s => s.heading)).toContain('extra section');
  });

  test('a foreign footer variant still counts as a footer (not wholeFileOwned)', () => {
    const project = projectWith([], { footer: '\n---\n\n*co-newbiz.context.md version: 9.9 — forked*' });
    const { wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
  });

  test('footer version differences alone are not project-only content', () => {
    const project = TEMPLATE_BODY + '\n---\n\n*context.md version: 2.5 — older*';
    const { sections, wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(0);
  });

  test('heading comparison normalizes case and surrounding whitespace', () => {
    // "##  Shared Section A  " (edge whitespace, upper case) == "## Shared Section A".
    // normalizeHeading's contract (shared with W1/W2) is strip-#s + edge-trim + lowercase;
    // internal spacing is deliberately left to exact comparison.
    const project = TEMPLATE_BODY.replace(
      '## Shared Section A',
      '##  Shared Section A ',
    ).replace(
      'shared body A',
      'shared body A (reworded)', // body drift inside a shared section is not ownership
    ) + FOOTER;
    const { sections } = findProjectOnlySections(project, TEMPLATE);
    expect(sections).toHaveLength(0);
  });

  test('empty-body project-only headings are skipped (nothing to preserve)', () => {
    const project = projectWith(['## Empty Stub']);
    const { sections } = findProjectOnlySections(project, TEMPLATE);
    expect(sections).toHaveLength(0);
  });

  test('fence-aware: ## lines inside code fences do not split sections', () => {
    const project = projectWith([
      '## Format Example',
      '```markdown',
      '## Not A Heading',
      '```',
    ]);
    const { sections } = findProjectOnlySections(project, TEMPLATE);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('format example');
    expect(sections[0].body).toContain('## Not A Heading');
  });

  test('splitOffVersionFooter still behaves (footer split drives wholeFileOwned)', () => {
    const { body, footer } = splitOffVersionFooter(TEMPLATE);
    expect(footer).toContain('version: 2.6');
    expect(body).toBe(TEMPLATE_BODY);
  });
});
