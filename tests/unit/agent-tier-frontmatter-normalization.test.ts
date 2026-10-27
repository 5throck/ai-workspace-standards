/**
 * Unit tests for lib/upgrade-policy.ts normalizeAgentTierFrontmatter
 * (T-20261027-005) and the agents/ pass tier-drift delivery semantics built on
 * it. The post-soak ADR-0102 recursive agent-quality check
 * (validate-model-registry, T-20261027-003) hard-FAILs project agents still
 * carrying legacy per-platform tier maps; the delivery passes normalize them
 * to the template's scalar tier.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  isExtendsStub,
  lifecyclelessText,
  normalizeAgentTierFrontmatter,
} from '../../scripts/lib/upgrade-policy.ts';

/** Fixture: project pm.md copy in the co-abap legacy shape (map-form tier). */
const LEGACY_PM = `---
name: pm
role: Project Manager
status: active
model: inherit
tier:
  claude: high
  gemini: high
  antigravity: high
  gemini-cli: high
description: 'Orchestrates multi-agent workflows.'
variant: co-design
version: "1.3.0"
last_updated: "2026-10-10"
---

## Role

Project body.
`;

/** Fixture: template-side pm.md with the ADR-0102 normalized scalar tier. */
const SCALAR_TEMPLATE = `---
extends: ../../../agents/pm.md
name: pm
status: active
tier: medium
model: inherit
version: "1.4.0"
---

<!-- WORKSPACE-MANAGED: PM agent body. -->
## Role

Template body.
`;

/** Fixture: project i18n-specialist.md in the fleet legacy shape. */
const LEGACY_I18N = `---
name: i18n-specialist
role: specialist
status: active
tier:
  claude: medium
  gemini: medium
  antigravity: medium
  gemini-cli: medium
  codex: medium
model: inherit
version: "1.0.0"
lifecycle:
  phase: production
  created: "2026-08-24"
  last_updated: "2026-08-24"
  governance: docs/lifecycle/agents/i18n-specialist.md
---

## Role

Body.
`;

const SCALAR_I18N_TEMPLATE = LEGACY_I18N
  .replace(/tier:\n(  .*\n)+/, 'tier: medium\n')
  .replace('version: "1.0.0"', 'version: "1.3.0"');

describe('normalizeAgentTierFrontmatter (T-20261027-005 a)', () => {
  test('legacy map-form project + scalar template → tier block replaced with the template scalar', () => {
    const res = normalizeAgentTierFrontmatter(LEGACY_PM, SCALAR_TEMPLATE);
    expect(res.changed).toBe(true);
    expect(res.conflict).toBe(false);
    expect(res.legacy).toBe(true);
    expect(res.templateTier).toBe('medium');
    expect(res.content).toContain('tier: medium\n');
    expect(res.content).not.toContain('claude: high');
    expect(res.content).not.toContain('gemini-cli: high');
  });

  test('normalization touches ONLY the tier block — every other frontmatter key and the body are byte-preserved', () => {
    const res = normalizeAgentTierFrontmatter(LEGACY_PM, SCALAR_TEMPLATE);
    const stripTier = (s: string): string => s.replace(/^tier:\n(  .*\n)+/m, '').replace(/^tier: medium\n/m, '');
    expect(stripTier(res.content)).toBe(stripTier(LEGACY_PM));
    expect(res.content).toContain('## Role\n\nProject body.');
    expect(res.content).toContain('version: "1.3.0"');
  });

  test('idempotent — a second pass over the normalized content is a no-op', () => {
    const once = normalizeAgentTierFrontmatter(LEGACY_PM, SCALAR_TEMPLATE);
    const twice = normalizeAgentTierFrontmatter(once.content, SCALAR_TEMPLATE);
    expect(twice.changed).toBe(false);
    expect(twice.conflict).toBe(false);
    expect(twice.content).toBe(once.content);
  });

  test('scalar project tier differing from the template scalar → conflict, untouched (deliberate divergence)', () => {
    const deliberate = LEGACY_PM.replace(/tier:\n(  .*\n)+/, 'tier: high\n');
    const res = normalizeAgentTierFrontmatter(deliberate, SCALAR_TEMPLATE);
    expect(res.changed).toBe(false);
    expect(res.conflict).toBe(true);
    expect(res.projectTier).toBe('high');
    expect(res.templateTier).toBe('medium');
    expect(res.content).toBe(deliberate);
  });

  test('scalar project tier equal to the template scalar → no-op (idempotent)', () => {
    const already = LEGACY_PM.replace(/tier:\n(  .*\n)+/, 'tier: medium\n');
    const res = normalizeAgentTierFrontmatter(already, SCALAR_TEMPLATE);
    expect(res.changed).toBe(false);
    expect(res.conflict).toBe(false);
    expect(res.content).toBe(already);
  });

  test('stale model-ID comment on a scalar tier line is ignored for the comparison (v1.57.0 migration precedent)', () => {
    const commented = LEGACY_PM.replace(/tier:\n(  .*\n)+/, 'tier: medium # was claude:sonnet/gemini:flash\n');
    const res = normalizeAgentTierFrontmatter(commented, SCALAR_TEMPLATE);
    expect(res.changed).toBe(false);
    expect(res.conflict).toBe(false);
  });

  test('template side map-form or absent → never normalize (nothing to normalize TO)', () => {
    const mapTemplate = SCALAR_TEMPLATE.replace('tier: medium\n', 'tier:\n  claude: medium\n  gemini: medium\n');
    expect(normalizeAgentTierFrontmatter(LEGACY_PM, mapTemplate).changed).toBe(false);
    const noTierTemplate = SCALAR_TEMPLATE.replace('tier: medium\n', '');
    expect(normalizeAgentTierFrontmatter(LEGACY_PM, noTierTemplate).changed).toBe(false);
    expect(normalizeAgentTierFrontmatter(LEGACY_PM, 'no frontmatter here\n').changed).toBe(false);
  });

  test('project without a tier key → no-op (normalization never adds frontmatter)', () => {
    const noTier = LEGACY_PM.replace(/tier:\n(  .*\n)+/, '');
    const res = normalizeAgentTierFrontmatter(noTier, SCALAR_TEMPLATE);
    expect(res.changed).toBe(false);
    expect(res.conflict).toBe(false);
    expect(res.content).toBe(noTier);
  });

  test('CRLF project content keeps CRLF line endings and normalizes the tier block', () => {
    const crlf = LEGACY_PM.replace(/\n/g, '\r\n');
    const res = normalizeAgentTierFrontmatter(crlf, SCALAR_TEMPLATE);
    expect(res.changed).toBe(true);
    expect(res.content).toContain('tier: medium\r\n');
    expect(res.content).not.toContain('claude: high');
  });

  test('fleet i18n-specialist shape (codex key in the map) normalizes and drops the whole block', () => {
    const res = normalizeAgentTierFrontmatter(LEGACY_I18N, SCALAR_I18N_TEMPLATE);
    expect(res.changed).toBe(true);
    expect(res.templateTier).toBe('medium');
    expect(res.content).toContain('tier: medium\n');
    expect(res.content).not.toContain('codex: medium');
    // The project lifecycle block is untouched (preserved by design).
    expect(res.content).toContain('governance: docs/lifecycle/agents/i18n-specialist.md');
  });
});

describe('agents/ pass tier-drift delivery (T-20261027-005 b)', () => {
  test('same-version copy whose only diff is the legacy tier block → focused tier-drift comparison matches after normalization', () => {
    // Same version 1.3.0, only difference = legacy map tier (fixture 2 shape).
    const sameVersionLegacy = SCALAR_I18N_TEMPLATE.replace('tier: medium\n', 'tier:\n  claude: medium\n  gemini: medium\n  antigravity: medium\n  gemini-cli: medium\n  codex: medium\n');
    const norm = normalizeAgentTierFrontmatter(sameVersionLegacy, SCALAR_I18N_TEMPLATE);
    expect(norm.legacy).toBe(true);
    // The focused comparison the drift branch uses: after normalization the
    // lifecycle-stripped contents are identical → tier-only drift → deliver.
    expect(lifecyclelessText(norm.content)).toBe(lifecyclelessText(SCALAR_I18N_TEMPLATE));
  });

  test('same-version copy with genuine content drift does NOT read as tier-only drift', () => {
    const drifted = SCALAR_I18N_TEMPLATE.replace('## Role\n\nBody.', '## Role\n\nCustom project body.');
    const norm = normalizeAgentTierFrontmatter(drifted, SCALAR_I18N_TEMPLATE);
    expect(norm.legacy).toBe(false);
    expect(lifecyclelessText(norm.content)).not.toBe(lifecyclelessText(SCALAR_I18N_TEMPLATE));
  });

  test('variant extends-stubs still shape-guard: the stub never delivers, its extends target does', () => {
    const stub = `---
extends: ../../common/agents/i18n-specialist.md
name: i18n-specialist
description: 'Owns locale configuration.'
variant: co-design
version: "1.1.0"
status: active
tier: medium
model: inherit
---
`;
    expect(isExtendsStub(stub)).toBe(true);
    expect(isExtendsStub(LEGACY_I18N)).toBe(false);
  });
});
