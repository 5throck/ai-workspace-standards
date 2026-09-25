/**
 * Unit tests for scripts/helpers/resolve-pm-stub.ts.
 *
 * Covers the shared agents/pm.md normalization extracted verbatim from
 * new-project.ts §2.3b (ADR-0033 extends-stub resolution) and §2.5 (L1-B
 * metadata strip) — the adopt-project settling pass depends on the same
 * behavior for converted projects.
 *
 * v1.1.0 (2026-09-25, inventory decisions batch — spec
 *         docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.2):
 *         covers the generic resolveAgentExtendsStub wrapper — i18n-specialist
 *         name resolution, the injected canonical-prose check (pm passes it,
 *         generic callers omit it), the missing-L1 branch, and the back-compat
 *         resolvePmExtendsStub delegation.
 *
 * v1.2.0 (2026-09-25, registry & platform-policy completeness batch — spec
 *         docs/designs/2026-09-25-registry-policy-completeness-design.md
 *         R2.1): covers the pure composeResolvedAgentContent — no-write purity
 *         (bytes + mtime unchanged), output parity with resolveAgentExtendsStub
 *         (the resolver consumes the compose path), and the prose/empty/missing-L1
 *         compose branches.
 *
 * @version 1.2.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  composeResolvedAgentContent,
  resolveAgentExtendsStub,
  resolvePmExtendsStub,
  stripL1BMetadata,
} from '../../scripts/helpers/resolve-pm-stub.ts';
import { isCanonicalPmStubBody } from '../../scripts/helpers/scaffold-markers.ts';

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

describe('resolveAgentExtendsStub (generic wrapper, T-20260924-003 R2.2)', () => {
  test('resolves a non-pm empty stub (i18n-specialist shape) without an injected body check', () => {
    const agentPath = writeProjectPmMd(
      [
        'extends: ../../common/agents/i18n-specialist.md',
        'name: i18n-specialist',
        "description: 'Owns locale configuration.'",
        'variant: co-consult',
        'version: "1.0.0"',
        'last_updated: "2026-09-25"',
      ].join('\n'),
      '',
    );
    const l1Path = path.join(scratchRoot, 'common-i18n.md');
    fs.writeFileSync(l1Path, L1_PM_MD.replace('name: pm', 'name: i18n-specialist'));

    const result = resolveAgentExtendsStub(agentPath, l1Path, 'co-consult');

    expect(result.resolved).toBe(true);
    expect(result.shape).toBe('empty');
    expect(result.nonCanonical).toBeUndefined(); // empty shape carries no H12 verdict
    const content = fs.readFileSync(agentPath, 'utf8');
    expect(content).not.toContain('extends:'); // pointer dropped — self-contained
    expect(content).toContain('Dispatch Protocol'); // L1 body inlined
    expect(content).toContain('name: i18n-specialist'); // stub frontmatter wins
    expect(content).toContain('lifecycle:'); // L1 frontmatter fields filled in
  });

  test('a prose stub WITHOUT an injected check resolves with nonCanonical: false (no canonical prose notion)', () => {
    const agentPath = writeProjectPmMd(
      'name: i18n-specialist\nextends: ../../common/agents/i18n-specialist.md',
      'Some prose stub body that has no canonical counterpart.',
    );
    const l1Path = path.join(scratchRoot, 'common-i18n.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const result = resolveAgentExtendsStub(agentPath, l1Path, 'co-deck');

    expect(result.resolved).toBe(true);
    expect(result.shape).toBe('prose');
    expect(result.nonCanonical).toBe(false);
    expect(fs.readFileSync(agentPath, 'utf8')).toContain('Dispatch Protocol');
  });

  test('back-compat: resolvePmExtendsStub still injects the canonical pm prose check (H12 fires)', () => {
    const agentPath = writeProjectPmMd(
      'name: pm\nextends: ../../common/agents/pm.md',
      'Real variant content about the co-legal jurisdiction workflow that must not be silently dropped.',
    );
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const viaWrapper = resolvePmExtendsStub(agentPath, l1Path, 'co-legal');
    // Injecting the same pm check through the generic option classifies the
    // same prose body identically — proving the wrapper is pure delegation.
    const equivalent = writeProjectPmMd(
      'name: pm\nextends: ../../common/agents/pm.md',
      'Real variant content about the co-legal jurisdiction workflow that must not be silently dropped.',
    );
    const viaGeneric = resolveAgentExtendsStub(equivalent, l1Path, 'co-legal', {
      isCanonicalStubBody: isCanonicalPmStubBody,
    });
    expect(viaWrapper.resolved).toBe(true);
    expect(viaWrapper.nonCanonical).toBe(true);
    expect(viaWrapper.proseBodyLength).toBeGreaterThan(0);
    expect(viaGeneric.resolved).toBe(true);
    expect(viaGeneric.nonCanonical).toBe(true);
  });

  test('missing-L1 branch: the generic wrapper leaves the stub untouched and reports missingL1', () => {
    const agentPath = writeProjectPmMd(
      'name: i18n-specialist\nextends: ../../common/agents/i18n-specialist.md',
      '',
    );
    const result = resolveAgentExtendsStub(agentPath, path.join(scratchRoot, 'absent.md'), 'co-work');
    expect(result.resolved).toBe(false);
    expect(result.missingL1).toBe(true);
    expect(fs.readFileSync(agentPath, 'utf8')).toContain('extends:');
  });

  test('no-ops on a self-contained non-pm agent (no extends: frontmatter)', () => {
    const agentPath = writeProjectPmMd('name: i18n-specialist\nrole: already resolved', '# Body\n');
    expect(
      resolveAgentExtendsStub(agentPath, path.join(scratchRoot, 'nope.md'), 'co-work').resolved,
    ).toBe(false);
  });
});

describe('composeResolvedAgentContent (pure compose, registry completeness R2.1)', () => {
  function writeAgentFile(frontmatter: string, body: string): string {
    const p = path.join(scratchRoot, `compose-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
    fs.mkdirSync(scratchRoot, { recursive: true });
    fs.writeFileSync(p, `---\n${frontmatter}\n---\n${body}`);
    return p;
  }

  function snapshot(p: string): { bytes: string; mtimeNs: bigint } {
    const st = fs.statSync(p, { bigint: true });
    return { bytes: fs.readFileSync(p, 'utf8'), mtimeNs: st.mtimeNs };
  }

  test('purity: composing an empty stub leaves the file byte- and mtime-identical', () => {
    const agentPath = writeAgentFile('name: i18n-specialist\nextends: ../../common/agents/i18n-specialist.md', '');
    const l1Path = path.join(scratchRoot, 'common-i18n.md');
    fs.writeFileSync(l1Path, L1_PM_MD.replace('name: pm', 'name: i18n-specialist'));

    const before = snapshot(agentPath);
    composeResolvedAgentContent(agentPath, l1Path, 'co-work');
    const after = snapshot(agentPath);

    expect(after.bytes).toBe(before.bytes);
    expect(after.mtimeNs).toBe(before.mtimeNs);
    expect(after.bytes).toContain('extends:'); // untouched — still a stub
  });

  test('purity: composing a prose stub leaves the file byte- and mtime-identical', () => {
    const agentPath = writeAgentFile('name: pm\nextends: ../../common/agents/pm.md', CANONICAL_CO_WORK_STUB_BODY);
    const l1Path = path.join(scratchRoot, 'common-pm.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const before = snapshot(agentPath);
    const composed = composeResolvedAgentContent(agentPath, l1Path, 'co-work', {
      isCanonicalStubBody: isCanonicalPmStubBody,
    });
    const after = snapshot(agentPath);

    expect(composed.composed).toBe(true);
    expect(composed.shape).toBe('prose');
    expect(after.bytes).toBe(before.bytes);
    expect(after.mtimeNs).toBe(before.mtimeNs);
  });

  test('parity: composed content equals exactly what resolveAgentExtendsStub writes (empty shape)', () => {
    fs.mkdirSync(scratchRoot, { recursive: true });
    const fm = 'name: i18n-specialist\nextends: ../../common/agents/i18n-specialist.md\nvariant: co-abap';
    const l1 = L1_PM_MD.replace('name: pm', 'name: i18n-specialist');
    const composeCommonPath = path.join(scratchRoot, 'compose-common.md');
    fs.writeFileSync(composeCommonPath, l1);

    const composePath = writeAgentFile(fm, '');
    const composed = composeResolvedAgentContent(composePath, composeCommonPath, 'co-abap');

    const writerPath = writeAgentFile(fm, '');
    const writerCommonPath = path.join(scratchRoot, 'writer-common.md');
    fs.writeFileSync(writerCommonPath, l1);
    resolveAgentExtendsStub(writerPath, writerCommonPath, 'co-abap');

    expect(composed.composed).toBe(true);
    expect(fs.readFileSync(writerPath, 'utf8')).toBe(composed.content);
  });

  test('parity: composed content equals exactly what resolveAgentExtendsStub writes (prose shape)', () => {
    fs.mkdirSync(scratchRoot, { recursive: true });
    const fm = 'name: pm\nextends: ../../common/agents/pm.md';
    const l1Path = path.join(scratchRoot, 'parity-pm-common.md');
    fs.writeFileSync(l1Path, L1_PM_MD);

    const composePath = writeAgentFile(fm, CANONICAL_CO_WORK_STUB_BODY);
    const composed = composeResolvedAgentContent(composePath, l1Path, 'co-work', {
      isCanonicalStubBody: isCanonicalPmStubBody,
    });

    const writerPath = writeAgentFile(fm, CANONICAL_CO_WORK_STUB_BODY);
    resolveAgentExtendsStub(writerPath, l1Path, 'co-work', { isCanonicalStubBody: isCanonicalPmStubBody });

    expect(composed.composed).toBe(true);
    expect(composed.shape).toBe('prose');
    expect(fs.readFileSync(writerPath, 'utf8')).toBe(composed.content);
  });

  test('missing-L1 branch: composed:false, missingL1:true, content is the raw stub', () => {
    const agentPath = writeAgentFile('name: i18n-specialist\nextends: ../../common/agents/i18n-specialist.md', '');
    const raw = fs.readFileSync(agentPath, 'utf8');

    const composed = composeResolvedAgentContent(agentPath, path.join(scratchRoot, 'absent.md'), 'co-work');

    expect(composed.composed).toBe(false);
    expect(composed.missingL1).toBe(true);
    expect(composed.content).toBe(raw);
  });

  test('no-extends file: composed:false, content is the raw file (full-copy passthrough)', () => {
    const agentPath = writeAgentFile('name: i18n-specialist\nrole: already resolved', '# Body\n');
    const raw = fs.readFileSync(agentPath, 'utf8');

    const composed = composeResolvedAgentContent(agentPath, path.join(scratchRoot, 'nope.md'), 'co-work');

    expect(composed.composed).toBe(false);
    expect(composed.missingL1).toBeUndefined();
    expect(composed.content).toBe(raw);
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
