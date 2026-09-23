/**
 * Unit tests for scripts/helpers/resolve-pm-stub.ts.
 *
 * Covers the shared agents/pm.md normalization extracted verbatim from
 * new-project.ts §2.3b (ADR-0033 extends-stub resolution) and §2.5 (L1-B
 * metadata strip) — the adopt-project settling pass depends on the same
 * behavior for converted projects.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePmExtendsStub, stripL1BMetadata } from '../../scripts/helpers/resolve-pm-stub.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'resolve-pm-stub-test');

const CANONICAL_CO_WORK_STUB_BODY =
  'This co-work PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.';

const L1_PM_MD = `---
name: pm
role: Orchestrates the agent team and enforces quality gates
tier:
  claude: medium
lifecycle:
  phase: production
  created: 2026-01-01
  last_updated: 2026-01-01
  governance: docs/lifecycle/agents/pm.md
---

# PM Orchestrator

## Dispatch Protocol

Dispatch specialists through PM.

## Agent Roster

| Agent | Tier |
|-------|------|
| architect | High |
`;

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

function writeProjectPmMd(frontmatter: string, body: string): string {
  const pmPath = path.join(scratchRoot, `pm-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  fs.mkdirSync(scratchRoot, { recursive: true });
  fs.writeFileSync(pmPath, `---\n${frontmatter}\n---\n${body}`);
  return pmPath;
}

describe('resolvePmExtendsStub', () => {
  test('resolves a prose extends-stub into a self-contained pm.md (frontmatter merged, L1 body attached)', () => {
    const pmPath = writeProjectPmMd(
      `name: pm\nextends: ../../common/agents/pm.md\nvariant: co-work\ntier:\n  claude: medium`,
      CANONICAL_CO_WORK_STUB_BODY
    );
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const result = resolvePmExtendsStub(pmPath, l1Path, 'co-work');

    expect(result.resolved).toBe(true);
    expect(result.shape).toBe('prose');
    expect(result.nonCanonical).toBe(false);
    const content = fs.readFileSync(pmPath, 'utf8');
    expect(content).not.toContain('extends:');
    expect(content).toContain('Dispatch Protocol'); // L1 body inlined
    expect(content).toContain('role: Orchestrates'); // L1 frontmatter fields filled in
    expect(content.startsWith('---\n')).toBe(true);
  });

  test('flags a NON-canonical prose body (H12) and reports its length', () => {
    const pmPath = writeProjectPmMd(
      'name: pm\nextends: ../../common/agents/pm.md',
      'Real variant content about the co-legal jurisdiction workflow that must not be silently dropped.'
    );
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const result = resolvePmExtendsStub(pmPath, l1Path, 'co-legal');

    expect(result.resolved).toBe(true);
    expect(result.nonCanonical).toBe(true);
    expect(result.proseBodyLength).toBeGreaterThan(0);
  });

  test('resolves an empty extends-stub by attaching the L1 body verbatim after the stub body', () => {
    const pmPath = writeProjectPmMd('name: pm\nextends: ../../common/agents/pm.md', '');
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const result = resolvePmExtendsStub(pmPath, l1Path, 'co-work');

    expect(result.resolved).toBe(true);
    expect(result.shape).toBe('empty');
    expect(fs.readFileSync(pmPath, 'utf8')).toContain('Dispatch Protocol');
  });

  test('renders variant_overrides into appended sections and strips the raw keys', () => {
    const pmPath = writeProjectPmMd(
      [
        'name: pm',
        'extends: ../../common/agents/pm.md',
        'variant_overrides:',
        '  updated_role: |',
        '    <!-- VARIANT-SECTION: updated_role -->',
        '    Legal-review PM.',
        '    <!-- END VARIANT-SECTION -->',
      ].join('\n'),
      CANONICAL_CO_WORK_STUB_BODY
    );
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    resolvePmExtendsStub(pmPath, l1Path, 'co-work');

    const content = fs.readFileSync(pmPath, 'utf8');
    expect(content).toContain('Legal-review PM.');
    expect(content).not.toContain('variant_overrides:');
    expect(content).not.toContain('VARIANT-SECTION:');
  });

  test('no-ops on a self-contained pm.md and reports missingL1 when the common body is absent', () => {
    const selfContained = writeProjectPmMd('name: pm\nrole: already resolved', '# PM\nbody');
    expect(resolvePmExtendsStub(selfContained, path.join(scratchRoot, 'nope.md'), 'co-work').resolved).toBe(false);

    const stub = writeProjectPmMd('name: pm\nextends: ../../common/agents/pm.md', CANONICAL_CO_WORK_STUB_BODY);
    const result = resolvePmExtendsStub(stub, path.join(scratchRoot, 'still-nope.md'), 'co-work');
    expect(result.resolved).toBe(false);
    expect(result.missingL1).toBe(true);
    // The stub file is left untouched
    expect(fs.readFileSync(stub, 'utf8')).toContain('extends:');
  });
});

describe('stripL1BMetadata', () => {
  test('drops @resolved-from, formal_name, variant; regenerates lifecycle with project-local dates', () => {
    const pmPath = writeProjectPmMd(
      [
        'name: pm',
        '# @resolved-from: templates/co-work/agents/pm.md',
        'formal_name: Co-Work PM Agent',
        'variant: co-work',
        'lifecycle:',
        '  phase: beta',
        '  created: 2025-03-03',
        '  last_updated: 2025-04-04',
        '  governance: docs/lifecycle/agents/pm.md',
      ].join('\n'),
      '# PM body\n'
    );

    stripL1BMetadata(pmPath, '2026-09-23');

    const content = fs.readFileSync(pmPath, 'utf8');
    expect(content).not.toContain('@resolved-from');
    expect(content).not.toContain('formal_name');
    expect(content).not.toContain('variant: co-work');
    expect(content).toContain('phase: beta'); // inherited when present
    expect(content).toContain("created: '2026-09-23'"); // js-yaml quotes date-like strings
    expect(content).toContain("last_updated: '2026-09-23'");
    expect(content).toContain('governance: docs/lifecycle/agents/pm.md');
    expect(content).toContain('# PM body'); // body preserved
  });

  test('creates a default production lifecycle when none exists', () => {
    const pmPath = writeProjectPmMd('name: pm', '# PM body\n');
    stripL1BMetadata(pmPath, '2026-09-23');
    const content = fs.readFileSync(pmPath, 'utf8');
    expect(content).toContain('phase: production');
    expect(content).toContain("created: '2026-09-23'");
  });
});
