/**
 * Unit tests for scripts/team-builder.ts tier handling (v1.5.0, spec
 * 2026-10-26-model-registry-platform-coverage §7): agents declare ONE scalar
 * `tier: high|medium|low`; the platform→model mapping is resolved at
 * dispatch/validation time from docs/workspace-schema.json `models`.
 *
 * Covers resolveAgentTier (scalar read + legacy map-block fallback) and
 * generateAgentMd emission (scalar form, no per-platform lines, no model IDs).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { generateAgentMd, resolveAgentTier, type AgentToCreate } from '../../scripts/team-builder.ts';

function agent(tier: AgentToCreate['tier']): AgentToCreate {
  return {
    name: 'test-agent',
    formalName: 'Test Agent',
    tier,
    color: 'blue',
    description: 'A test agent',
    phases: ['4'],
    handoffTo: [],
    handoffFrom: ['pm'],
    requiredSkills: [],
    rationale: 'test',
  };
}

describe('resolveAgentTier (v1.5.0)', () => {
  test('reads the scalar form directly', () => {
    expect(resolveAgentTier('high')).toBe('high');
    expect(resolveAgentTier('medium')).toBe('medium');
    expect(resolveAgentTier('low')).toBe('low');
  });

  test('legacy map block falls back to the claude value (design D5)', () => {
    expect(resolveAgentTier({ claude: 'high', gemini: 'medium' })).toBe('high');
    expect(resolveAgentTier({ claude: 'low' })).toBe('low');
  });

  test('legacy map block without claude keeps the v1.4.x platform fallback chain', () => {
    expect(resolveAgentTier({ gemini: 'medium', antigravity: 'medium', 'gemini-cli': 'medium', codex: 'medium' })).toBe('medium');
  });
});

describe('generateAgentMd emission (v1.5.0)', () => {
  test('emits ONE scalar tier line for a scalar proposal tier', () => {
    const md = generateAgentMd(agent('medium'));
    expect(md).toContain('tier: medium\n');
    expect(md.match(/^tier:/gm)).toHaveLength(1);
    expect(md).toContain('**Tier**: medium');
  });

  test('emits ONE scalar tier line for a legacy map-block proposal tier', () => {
    const md = generateAgentMd(agent({ claude: 'high', gemini: 'high', antigravity: 'high', 'gemini-cli': 'high', codex: 'high' }));
    expect(md).toContain('tier: high\n');
    expect(md.match(/^tier:/gm)).toHaveLength(1);
    // no per-platform lines, no model ids — the registry owns those
    expect(md).not.toMatch(/^  claude:/m);
    expect(md).not.toMatch(/claude-|gemini-|gpt-5\./);
    expect(md).toContain('model: inherit');
    expect(md).toContain('**Tier**: high');
  });

  test('generated frontmatter stays parseable by the scalar-form consumers', () => {
    const md = generateAgentMd(agent('low'));
    expect(md.startsWith('---\n')).toBe(true);
    expect(md).toContain('status: active');
  });
});
