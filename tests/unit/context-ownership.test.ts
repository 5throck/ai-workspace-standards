/**
 * Unit tests for findProjectOnlySections() and spliceCommonContextBlock()
 * (helpers/context-sections.ts) — the upgrade-time ownership detection behind
 * docs/context.md's CONTEXT PRESERVE gate (T-20260912-001) and the
 * managed-zone splice that delivers policy content under PRESERVE
 * (ADR-0081 / T-20260919-003).
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import {
  findProjectOnlySections,
  splitOffVersionFooter,
  spliceCommonContextBlock,
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

// ── CRLF tolerance (v1.4.0, ADR-0081 fleet sweep / T-20260918-005) ──────────
// Windows working trees check out CRLF; the old bare-LF separator regex never
// matched there, so every CRLF project was wholeFileOwned → CONTEXT PRESERVE
// and template footer bumps never delivered. (No backslash escapes in this
// block on purpose — line endings are built from char codes.)

const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13) + LF;

describe('CRLF tolerance (v1.4.0)', () => {
  test('splitOffVersionFooter parses a CRLF footer and returns the LF body', () => {
    const crlfContent = (TEMPLATE_BODY + FOOTER).split(LF).join(CRLF);
    const { body, footer } = splitOffVersionFooter(crlfContent);
    expect(footer).toContain('version: 2.6');
    expect(body.split(CRLF).join(LF)).toBe(TEMPLATE_BODY);
  });

  test('CRLF project copy is not wholeFileOwned (footer recognized)', () => {
    const project = projectWith(['## Project Specific Workflow', 'do the co-newbiz thing']).split(LF).join(CRLF);
    const { sections, wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(1);
  });

  test('mixed line endings: CRLF project against LF template still evaluates', () => {
    const project = (TEMPLATE_BODY + FOOTER).split(LF).join(CRLF);
    const { sections, wholeFileOwned } = findProjectOnlySections(project, TEMPLATE);
    expect(wholeFileOwned).toBe(false);
    expect(sections).toHaveLength(0);
  });
});

// ── spliceCommonContextBlock (v1.5.0, ADR-0081 / T-20260919-003) ─────────────
// Managed-zone policy content must deliver even when the wholesale
// docs/context.md copy is skipped by CONTEXT PRESERVE (project-only sections).

const TMPL_CONTEXT = [
  '## Architecture',
  '',
  '<!-- COMMON-CONTEXT:START -->',
  '### PM Team-Management Authority (ADR-0080)',
  'authority text (new)',
  '<!-- COMMON-CONTEXT:END -->',
  '',
  '## Key Files',
].join('\n');

const PROJ_CONTEXT = [
  '## Architecture',
  '',
  '<!-- COMMON-CONTEXT:START -->',
  '### PM Team-Management Authority (ADR-0080)',
  'authority text (old)',
  '<!-- COMMON-CONTEXT:END -->',
  '',
  '## Procedures',
  'project-specific procedures',
].join('\n');

describe('spliceCommonContextBlock (v1.5.0)', () => {
  test('replaces the project COMMON-CONTEXT block with the template block; project-only sections survive', () => {
    const r = spliceCommonContextBlock(PROJ_CONTEXT, TMPL_CONTEXT);
    expect(r.changed).toBe(true);
    expect(r.content).toContain('authority text (new)');
    expect(r.content).not.toContain('authority text (old)');
    expect(r.content).toContain('## Procedures');
    expect(r.content).toContain('project-specific procedures');
  });

  test('changed=false when the project block already matches the template', () => {
    const r = spliceCommonContextBlock(TMPL_CONTEXT, TMPL_CONTEXT);
    expect(r.changed).toBe(false);
  });

  test('no-op when the template carries no COMMON-CONTEXT block', () => {
    const bare = '## Architecture\n\nplain content\n';
    const r = spliceCommonContextBlock(PROJ_CONTEXT, bare);
    expect(r.changed).toBe(false);
    expect(r.note).toContain('no COMMON-CONTEXT block');
  });

  test('no-op with a hint when the project copy has no block to splice into', () => {
    const r = spliceCommonContextBlock('## Architecture\n\nplain\n', TMPL_CONTEXT);
    expect(r.changed).toBe(false);
    expect(r.note).toContain('no COMMON-CONTEXT block');
  });

  test('CRLF project content splices correctly', () => {
    const projCrlf = PROJ_CONTEXT.split('\n').join('\r\n');
    const r = spliceCommonContextBlock(projCrlf, TMPL_CONTEXT);
    expect(r.changed).toBe(true);
    expect(r.content).toContain('authority text (new)');
    expect(r.content).toContain('## Procedures');
  });
});
