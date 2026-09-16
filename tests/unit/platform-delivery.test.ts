/**
 * Tests for scripts/lib/platform-delivery.ts (T-20260916-011): the
 * platform-delivery-aware prose-target partitioning behind
 * validate-model-registry.ts's codex skip guard.
 *
 * Defect shape: projects scaffolded without the codex platform carry neither
 * CODEX.md nor .codex/ (new-project.ts §2.7 strips both), and the
 * unconditional CODEX.md read failed their audit with
 * "could not read CODEX.md". The guard self-skips the codex target with a
 * visible reason instead.
 *
 * Pins:
 * 1. isCodexPlatformDelivered: either signal suffices, none fails.
 * 2. partitionProseTargetsByDelivery: codex target skipped exactly when both
 *    signals are absent; other targets skip only when their own file is
 *    absent; a full L0/L1-style context keeps everything active.
 * 3. Real-tree invariant: the workspace root itself delivers every target
 *    (partitioning the real validate-model-registry target list against the
 *    real files yields zero skips).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { resolve } from 'node:path';
import {
  isCodexPlatformDelivered,
  partitionProseTargetsByDelivery,
  type ProseTargetRef,
} from '../../scripts/lib/platform-delivery.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('isCodexPlatformDelivered', () => {
  test('either signal suffices', () => {
    expect(isCodexPlatformDelivered(true, false)).toBe(true);
    expect(isCodexPlatformDelivered(false, true)).toBe(true);
    expect(isCodexPlatformDelivered(true, true)).toBe(true);
  });

  test('no CODEX.md and no .codex/ means not delivered', () => {
    expect(isCodexPlatformDelivered(false, false)).toBe(false);
  });
});

describe('partitionProseTargetsByDelivery', () => {
  const targets: ProseTargetRef[] = [
    { file: 'AGENTS.md', label: '§3.6 tier-model-mapping' },
    { file: 'CLAUDE.md', label: '3-Tier mapping' },
    { file: 'GEMINI.md', label: '3-Tier mapping' },
    { file: 'CODEX.md', label: '3-Tier mapping' },
  ];

  test('codex-opt-out project (neither CODEX.md nor .codex/): only the codex target skips', () => {
    const present = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
    const { active, skipped } = partitionProseTargetsByDelivery(targets, (rel) => present.has(rel));
    expect(active.map((t) => t.file)).toEqual(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
    expect(skipped).toEqual([
      { file: 'CODEX.md', label: '3-Tier mapping', reason: 'codex platform not delivered' },
    ]);
  });

  test('a bare .codex/ directory (no CODEX.md) keeps the codex target active', () => {
    const present = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.codex']);
    const { active, skipped } = partitionProseTargetsByDelivery(targets, (rel) => present.has(rel));
    expect(active).toHaveLength(4);
    expect(skipped).toEqual([]);
  });

  test('missing non-codex files skip with their own reason', () => {
    const present = new Set(['CODEX.md']);
    const { active, skipped } = partitionProseTargetsByDelivery(targets, (rel) => present.has(rel));
    expect(active.map((t) => t.file)).toEqual(['CODEX.md']);
    expect(skipped.map((s) => s.file)).toEqual(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']);
    for (const s of skipped) expect(s.reason).toBe('file not present in this context');
  });

  test('a full L0/L1 context keeps everything active (behavior unchanged)', () => {
    const present = new Set(['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CODEX.md', '.codex']);
    const { active, skipped } = partitionProseTargetsByDelivery(targets, (rel) => present.has(rel));
    expect(active).toHaveLength(4);
    expect(skipped).toEqual([]);
  });
});

describe('real-tree invariant: the workspace root delivers every target', () => {
  test('partitioning the real target list against the real root yields zero skips', () => {
    const targets: ProseTargetRef[] = [
      { file: 'AGENTS.md', label: '§3.6 tier-model-mapping' },
      { file: 'CLAUDE.md', label: '3-Tier mapping' },
      { file: 'GEMINI.md', label: '3-Tier mapping' },
      { file: 'CODEX.md', label: '3-Tier mapping' },
    ];
    const { skipped } = partitionProseTargetsByDelivery(
      targets,
      (rel) => existsSync(join(workspaceRoot, rel)),
    );
    expect(skipped).toEqual([]);
  });
});
