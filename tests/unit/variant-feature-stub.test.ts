/**
 * Unit tests for scripts/variant-feature.ts agent-stub emission (v1.1.0, spec
 * 2026-10-26-model-registry-platform-coverage §7): NEW agent stubs declare ONE
 * scalar `tier: medium` — no per-platform lines, no model IDs (the
 * platform→model mapping lives in docs/workspace-schema.json `models`).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { agentStubContent } from '../../scripts/variant-feature.ts';

describe('agentStubContent (v1.1.0 — scalar tier stub)', () => {
  const stub = agentStubContent('co-test', 'slide-export', '2026-10-26');

  test('declares ONE scalar tier: medium line', () => {
    expect(stub).toContain('\ntier: medium\n');
    expect(stub.match(/^tier:/gm)).toHaveLength(1);
    expect(stub).not.toMatch(/^  claude:/m);
    expect(stub).not.toMatch(/^  gemini:/m);
  });

  test('carries no model-ID literals (Check MM genus)', () => {
    expect(stub).not.toMatch(/claude-|gemini-[\d.]+|gpt-5\.|glm-5\./);
  });

  test('substitutes feature, variant, and today placeholders', () => {
    expect(stub).toContain('name: slide-export');
    expect(stub).toContain('the **slide-export** specialist for the **co-test** variant');
    expect(stub).toContain('last_reviewed: "2026-10-26"');
  });

  test('keeps the Dispatch Protocol tier line in sync', () => {
    expect(stub).toContain('**Tier**: medium');
  });
});
