/**
 * Pure in-process pin for the agent-model-gate tier -> alias derivation
 * (design docs/designs/2026-11-12-sync-ownership-and-common-automation-engineer-design.md
 * D6, AE-1).
 *
 * scripts/hooks/agent-model-gate.ts is a stdin hook that exits from main() at import
 * time, so it cannot be imported or spawned cheaply. This test pins the contract it
 * implements, using the live data it reads: the scalar `tier:` of agents/*.md and
 * docs/workspace-schema.json models.claude (alias = second dash-segment of the registry
 * ID). It also asserts the hook source still derives the alias that way, so a change to
 * the derivation fails here. No process is spawned.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..', '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf-8');

function scalarTier(content: string): string | null {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  const m = fm?.[1].match(/^tier\s*:\s*([\w-]+)\s*(?:#.*)?$/m);
  return m ? m[1].trim().toLowerCase() : null;
}

const claudeModels = (JSON.parse(read('docs/workspace-schema.json')) as {
  models: { claude: Record<string, string> };
}).models.claude;

const aliasFor = (tier: string): string | undefined => claudeModels[tier]?.split('-')[1];

describe('agent-model-gate tier -> alias derivation', () => {
  test('tier map resolves to the three Claude Code aliases', () => {
    expect(aliasFor('high')).toBe('opus');
    expect(aliasFor('medium')).toBe('sonnet');
    expect(aliasFor('low')).toBe('haiku');
  });

  test('automation-engineer declares tier medium, so the gate requires sonnet', () => {
    const tier = scalarTier(read('agents/automation-engineer.md'));
    expect(tier).toBe('medium');
    expect(aliasFor(tier as string)).toBe('sonnet');
  });

  test('fixture frontmatter: scalar tier wins, trailing comment ignored, missing tier is null', () => {
    expect(scalarTier('---\nname: x\ntier: medium # note\n---\nbody')).toBe('medium');
    expect(scalarTier('---\nname: x\n---\nbody')).toBeNull();
  });

  test('the hook source still derives the alias from models.claude and the live agents dir', () => {
    const src = read('scripts/hooks/agent-model-gate.ts');
    expect(src).toContain('schema.models?.claude');
    expect(src).toContain('registryId?.split("-")[1]');
    expect(src).toContain('readdirSync(AGENTS_DIR)');
  });
});
