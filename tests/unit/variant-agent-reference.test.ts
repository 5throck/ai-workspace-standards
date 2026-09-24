/**
 * variant-agent-references detector unit test (spec:
 * docs/designs/2026-09-25-variant-hygiene-batch-design.md, R4 / AC-5).
 *
 * T-004 convention: pure decision core (classifyAgentReference) gets a
 * decision table; the extraction core (extractAgentReferenceCandidates) gets
 * path/backtick/line-number cases; an injected-phantom fixture in a temp
 * variant dir proves the positive (unresolved reference → finding naming
 * file:line) and the control (a root-resolvable reference stays silent).
 *
 * checkVariantAgentReferences itself is module-private (it owns the fleet
 * wiring into the per-variant loop); the fixture below replays its exact
 * scan+classify pipeline over the exported cores.
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  classifyAgentReference,
  extractAgentReferenceCandidates,
} from '../../scripts/validate-templates.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('classifyAgentReference — decision table', () => {
  const base = { name: 'some-agent', inVariantAgents: false, inCommonAgents: false, inRootAgents: false, exempt: false };
  test('resolves at the variant agents/ tree', () => {
    expect(classifyAgentReference({ ...base, inVariantAgents: true })).toBe('resolved');
  });
  test('resolves at templates/common/agents/', () => {
    expect(classifyAgentReference({ ...base, inCommonAgents: true })).toBe('resolved');
  });
  test('resolves at the workspace-root agents/ tree (L0)', () => {
    expect(classifyAgentReference({ ...base, inRootAgents: true })).toBe('resolved');
  });
  test('unresolved when no tree carries the name', () => {
    expect(classifyAgentReference({ ...base })).toBe('unresolved');
  });
  test('exempt unresolved names classify resolved (escape hatch)', () => {
    expect(classifyAgentReference({ ...base, exempt: true })).toBe('resolved');
  });
});

describe('extractAgentReferenceCandidates', () => {
  test('agents/<name>.md path references with line numbers', () => {
    const content = 'intro\nsee [agents/pm.md](agents/pm.md) and agents/stack-setup.md\n';
    expect(extractAgentReferenceCandidates(content)).toEqual([
      { name: 'pm', line: 2 },
      { name: 'stack-setup', line: 2 },
    ]);
  });
  test('backtick `<name>` agent mentions', () => {
    const content = 'route via the `stack-setup` agent today\nplural: the `pm` agents handle it\n';
    const got = extractAgentReferenceCandidates(content);
    expect(got).toContainEqual({ name: 'stack-setup', line: 1 });
    expect(got).toContainEqual({ name: 'pm', line: 2 });
  });
  test('deduplicates per (name, line) but keeps separate lines', () => {
    const content = 'agents/pm.md and `pm` agent on one line\nagents/pm.md again\n';
    expect(extractAgentReferenceCandidates(content)).toEqual([
      { name: 'pm', line: 1 },
      { name: 'pm', line: 2 },
    ]);
  });
  test('ignores underscore-leading internal fragments (agents/_COMMON.md)', () => {
    expect(extractAgentReferenceCandidates('agents/_COMMON.md is a fragment\n')).toEqual([]);
  });
  test('plain agent-shaped prose without backticks is not a reference', () => {
    expect(extractAgentReferenceCandidates('ask the PM agent to install tools\n')).toEqual([]);
  });
});

describe('injected-phantom fixture (temp variant dir)', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'variant-agent-ref-'));
  const variantName = 'co-fixture';
  // Variant tree with an AGENTS.md phantom + a script phantom; empty agents/ dir.
  mkdirSync(join(fixtureDir, variantName, 'agents'), { recursive: true });
  mkdirSync(join(fixtureDir, variantName, 'scripts', 'deep'), { recursive: true });
  writeFileSync(
    join(fixtureDir, variantName, 'AGENTS.md'),
    [
      '# Fixture',
      '',
      'delegate to a validated external tool via the `stack-setup` agent.',
      'roster: [agents/pm.md](agents/pm.md) resolves at the root tree.',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(fixtureDir, variantName, 'scripts', 'deep', 'setup.ts'),
    '// guidance\nconsole.log("Agent: agents/stack-setup.md");\n',
  );

  afterAll(() => rmSync(fixtureDir, { recursive: true, force: true }));

  test('positive: phantom references produce findings naming file:line; control resolves', () => {
    const findings: string[] = [];
    const variantAgentsDir = join(fixtureDir, variantName, 'agents');
    const commonAgentsDir = join(workspaceRoot, 'templates', 'common', 'agents');
    const rootAgentsDir = join(workspaceRoot, 'agents');

    // The same scan+classify pipeline checkVariantAgentReferences runs.
    const scanTargets: Array<{ rel: string; abs: string }> = [
      { rel: `templates/${variantName}/AGENTS.md`, abs: join(fixtureDir, variantName, 'AGENTS.md') },
      { rel: 'templates/co-fixture/scripts/deep/setup.ts', abs: join(fixtureDir, variantName, 'scripts', 'deep', 'setup.ts') },
    ];
    for (const file of scanTargets) {
      const content = readFileSync(file.abs, 'utf-8');
      for (const candidate of extractAgentReferenceCandidates(content)) {
        const verdict = classifyAgentReference({
          name: candidate.name,
          inVariantAgents: existsSync(join(variantAgentsDir, `${candidate.name}.md`)),
          inCommonAgents: existsSync(join(commonAgentsDir, `${candidate.name}.md`)),
          inRootAgents: existsSync(join(rootAgentsDir, `${candidate.name}.md`)),
          exempt: false,
        });
        if (verdict === 'unresolved') findings.push(`${file.rel}:${candidate.line} references agent "${candidate.name}"`);
      }
    }

    expect(findings.some(f => f.startsWith('templates/co-fixture/AGENTS.md:3') && f.includes('"stack-setup"'))).toBe(true);
    expect(findings.some(f => f.startsWith('templates/co-fixture/scripts/deep/setup.ts:2') && f.includes('"stack-setup"'))).toBe(true);
    // Control: `pm` resolves at the workspace root — no finding for it.
    expect(findings.some(f => f.includes('"pm"'))).toBe(false);
  });
});
