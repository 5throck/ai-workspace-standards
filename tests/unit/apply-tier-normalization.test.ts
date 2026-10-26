/**
 * Unit tests for tests/apply-tier-normalization.ts — the one-shot applier for
 * spec 2026-10-26-model-registry-platform-coverage §8.1 (scalar `tier:`
 * declaration in agent frontmatter).
 *
 * Pure-content fixtures only — the real tree is never touched (the applier
 * runs against it exclusively behind --dry-run per the design's sequencing,
 * §8.3).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import {
  collectTargets,
  parseTierDeclaration,
  resolveTierFromContent,
  transformAgentContent,
} from '../../tests/apply-tier-normalization.ts';

const TODAY = '2026-10-26';

/** Root-agent-shaped fixture: uniform 7-platform block with model comments. */
const ROOT_UNIFORM = [
  '---',
  'last_updated: 2026-10-23',
  'name: pm',
  'role: orchestrator',
  'status: active',
  'tier:',
  '  claude: medium',
  '  gemini: medium',
  '  antigravity: medium',
  '  gemini-cli: medium',
  '  codex: medium',
  '  hermes: medium  # claude-sonnet-5-5',
  '  zai: medium  # glm-5.3-flash',
  'model: inherit',
  'tier_semantics: floor',
  'version: 1.2.2',
  'lifecycle:',
  '  phase: production',
  '  created: 2026-05-29',
  '  last_updated: 2026-08-15',
  '  governance: docs/lifecycle/agents/pm.md',
  '---',
  '',
  '# PM',
  '',
  'Body.',
].join('\n');

/** co-price-shaped fixture (§8.2 cost-asset-mgmt): mixed 4-platform block. */
const TEMPLATE_MIXED = [
  '---',
  'name: cost-asset-mgmt',
  'phases: [3, 4]',
  'status: active',
  'version: "1.0.0"',
  'last_updated: "2026-08-25"',
  'tier:',
  '  claude: high',
  '  gemini: medium',
  '  antigravity: medium',
  '  gemini-cli: high',
  'model: inherit',
  '---',
  '',
  'Body.',
].join('\n');

/** co-hr-shaped extends-stub: no tier declaration at all. */
const STUB_NO_TIER = [
  '---',
  'extends: ../../common/agents/pm.md',
  'name: pm',
  "description: 'Orchestrates multi-agent workflows.'",
  'variant: co-hr',
  'version: "0.1.0"',
  'last_updated: "2026-08-24"',
  'status: active',
  'owner: architect',
  '---',
  '',
  'Stub body.',
].join('\n');

describe('apply-tier-normalization — uniform map block (root agent)', () => {
  const result = transformAgentContent('agents/pm.md', ROOT_UNIFORM, { today: TODAY });

  test('collapses the 7-platform block to one scalar line', () => {
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.content).toContain('\ntier: medium\n');
    expect(result.content.match(/^tier:/gm)).toHaveLength(1);
  });

  test('removes every platform line and model-id comment', () => {
    if (result.status !== 'applied') return;
    for (const platform of ['claude', 'gemini', 'antigravity', 'gemini-cli', 'codex', 'hermes', 'zai']) {
      expect(result.content).not.toMatch(new RegExp(`^  ${platform}:`, 'm'));
    }
    expect(result.content).not.toContain('# claude-sonnet-5-5');
    expect(result.content).not.toContain('# glm-5.3-flash');
  });

  test('preserves every other frontmatter key and the lifecycle block byte-for-byte', () => {
    if (result.status !== 'applied') return;
    expect(result.content).toContain('name: pm');
    expect(result.content).toContain('model: inherit');
    expect(result.content).toContain('tier_semantics: floor');
    expect(result.content).toContain('lifecycle:');
    expect(result.content).toContain('  phase: production');
    // the lifecycle block's own last_updated is NEVER touched
    expect(result.content).toContain('  last_updated: 2026-08-15');
    expect(result.content).toContain('Body.');
  });

  test('root agents get last_updated ONLY — no version bump (not delivered)', () => {
    if (result.status !== 'applied') return;
    expect(result.content).toContain('last_updated: 2026-10-26\n');
    expect(result.content).toContain('version: 1.2.2'); // unchanged
    expect(result.content).not.toContain('version: 1.2.3');
  });

  test('is idempotent — the transformed file reports SKIP (scalar)', () => {
    if (result.status !== 'applied') return;
    const second = transformAgentContent('agents/pm.md', result.content, { today: TODAY });
    expect(second.status).toBe('scalar');
  });
});

describe('apply-tier-normalization — mixed map block (co-price D5 collapse)', () => {
  const result = transformAgentContent(
    'templates/co-price/agents/cost-asset-mgmt.md',
    TEMPLATE_MIXED,
    { today: TODAY },
  );

  test('collapses to the claude value (high), not the gemini value', () => {
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.content).toContain('tier: high\n');
    expect(result.content).not.toContain('tier: medium');
    expect(result.detail).toContain('MIXED map');
    expect(result.detail).toContain('claude: high');
    expect(result.detail).toContain('design D5 collapse');
  });

  test('templates/ path gets version patch-bump + last_updated refresh (§8.4 re-delivery)', () => {
    if (result.status !== 'applied') return;
    expect(result.content).toContain('version: "1.0.1"');
    expect(result.content).toContain('last_updated: "2026-10-26"');
    expect(result.detail).toContain('SYNC_IF_NEWER');
  });
});

describe('apply-tier-normalization — block-less extends-stub (co-hr/co-news shape)', () => {
  const result = transformAgentContent('templates/co-hr/agents/pm.md', STUB_NO_TIER, {
    l1Tier: 'medium',
    today: TODAY,
  });

  test('inserts tier: medium directly after the extends: line', () => {
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.content).toContain(
      'extends: ../../common/agents/pm.md\ntier: medium\nname: pm\n',
    );
    expect(result.detail).toContain('extends-stub');
    expect(result.detail).toContain('templates/common/agents/pm.md declares medium');
  });

  test('stub under templates/ still gets the version bump', () => {
    if (result.status !== 'applied') return;
    expect(result.content).toContain('version: "0.1.1"');
  });

  test('without a resolvable L1 tier the stub is left for manual review', () => {
    const r = transformAgentContent('templates/co-hr/agents/pm.md', STUB_NO_TIER, {
      l1Tier: null,
      today: TODAY,
    });
    expect(r.status).toBe('no-stub-tier');
    expect(r).not.toHaveProperty('content');
  });
});

describe('apply-tier-normalization — already scalar (idempotency)', () => {
  const scalarFile = ROOT_UNIFORM.replace(
    /tier:\n(?:  .*\n)+/,
    'tier: medium\n',
  );

  test('byte-for-byte unchanged', () => {
    const result = transformAgentContent('agents/pm.md', scalarFile, { today: TODAY });
    expect(result.status).toBe('scalar');
    // 'scalar' results carry no content — nothing may be written back.
    expect(result).not.toHaveProperty('content');
  });
});

describe('apply-tier-normalization — CRLF preservation', () => {
  const crlfFile = TEMPLATE_MIXED.replace(/\n/g, '\r\n');

  test('a CRLF file stays CRLF with the scalar line emitted in CRLF', () => {
    const result = transformAgentContent(
      'templates/co-price/agents/cost-asset-mgmt.md',
      crlfFile,
      { today: TODAY },
    );
    expect(result.status).toBe('applied');
    if (result.status !== 'applied') return;
    expect(result.content.includes('\r\n')).toBe(true);
    expect(result.content).toContain('tier: high\r\n');
    // no mixed endings introduced
    expect(result.content.replace(/\r\n/g, '')).not.toContain('\n');
    expect(result.content).toContain('version: "1.0.1"\r\n');
  });
});

describe('apply-tier-normalization — version bump scope (templates/ vs root)', () => {
  test('identical content under templates/ bumps version; under agents/ does not', () => {
    const asTemplate = transformAgentContent(
      'templates/co-design/agents/x.md',
      ROOT_UNIFORM,
      { today: TODAY },
    );
    const asRoot = transformAgentContent('agents/x.md', ROOT_UNIFORM, { today: TODAY });
    expect(asTemplate.status).toBe('applied');
    expect(asRoot.status).toBe('applied');
    if (asTemplate.status === 'applied') expect(asTemplate.content).toContain('version: 1.2.3');
    if (asRoot.status === 'applied') expect(asRoot.content).toContain('version: 1.2.2');
  });
});

describe('apply-tier-normalization — safety skips', () => {
  test('unknown platform key -> skipped for manual review', () => {
    const weird = TEMPLATE_MIXED.replace('  gemini-cli: high', '  gemini-cli: high\n  warp: high');
    const result = transformAgentContent('templates/co-x/agents/a.md', weird, { today: TODAY });
    expect(result.status).toBe('unknown-platform');
    expect(result.detail).toContain('warp');
  });

  test('no tier and no extends -> skipped (validator v2 FAILs at L0, not the applier)', () => {
    const plain = '---\nname: x\nstatus: active\n---\n\nBody.\n';
    const result = transformAgentContent('templates/co-x/agents/a.md', plain, { today: TODAY });
    expect(result.status).toBe('no-tier');
  });
});

describe('apply-tier-normalization — parseTierDeclaration / resolveTierFromContent', () => {
  test('parses the scalar form', () => {
    const decl = parseTierDeclaration('---\nname: x\ntier: high\n---\n');
    expect(decl.form).toBe('scalar');
    expect(decl.value).toBe('high');
  });

  test('parses a map block with comments and reports its line range', () => {
    const decl = parseTierDeclaration('---\nname: x\ntier:\n  claude: low  # c\n  zai: low\nmodel: m\n---\n');
    expect(decl.form).toBe('map');
    expect(decl.platforms).toEqual({ claude: 'low', zai: 'low' });
    expect(decl.startLine).toBe(2);
    expect(decl.endLine).toBe(5); // exclusive: 'model: m' stops the block
  });

  test('reports none for a file without tier', () => {
    expect(parseTierDeclaration('---\nname: x\n---\n').form).toBe('none');
    expect(parseTierDeclaration('no frontmatter at all').form).toBe('none');
  });

  test('resolveTierFromContent: scalar / uniform map / mixed map (claude) / none', () => {
    expect(resolveTierFromContent('---\ntier: high\n---\n')).toBe('high');
    expect(resolveTierFromContent('---\ntier:\n  claude: low\n  zai: low  # c\n---\n')).toBe('low');
    expect(resolveTierFromContent('---\ntier:\n  claude: high\n  gemini: medium\n---\n')).toBe('high');
    expect(resolveTierFromContent('---\nname: x\n---\n')).toBeNull();
  });
});

describe('apply-tier-normalization — collectTargets (real tree shape)', () => {
  const REPO_ROOT = new URL('../..', import.meta.url).pathname;

  test('default scope is root + L1 + variants (README/_partials excluded)', () => {
    const { all, rootCount, l1Count, variantCount, projectCount } = collectTargets(REPO_ROOT);
    expect(rootCount).toBe(9);
    expect(l1Count).toBe(2); // pm.md + i18n-specialist.md; _COMMON.md excluded
    expect(variantCount).toBe(148);
    expect(projectCount).toBe(0);
    expect(all).toContain('agents/pm.md');
    expect(all).toContain('templates/common/agents/pm.md');
    expect(all.every((rel) => !rel.includes('README'))).toBe(true);
    expect(all.every((rel) => !rel.endsWith('_COMMON.md'))).toBe(true);
  });

  test('--projects adds the Projects/co-* agent files', () => {
    const { projectCount, all } = collectTargets(REPO_ROOT, { projects: true });
    expect(projectCount).toBeGreaterThan(0);
    expect(all.some((rel) => rel.startsWith('Projects/co-'))).toBe(true);
  });

  test('--only narrows by directory prefix', () => {
    const { all } = collectTargets(REPO_ROOT, { only: 'templates/co-price' });
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((rel) => rel.startsWith('templates/co-price/'))).toBe(true);
  });

  test('--only accepts a glob', () => {
    const { all } = collectTargets(REPO_ROOT, { only: 'templates/co-*/agents/pm.md' });
    expect(all.length).toBe(14); // one pm.md per living variant
    expect(all.every((rel) => rel.endsWith('/agents/pm.md'))).toBe(true);
  });
});
