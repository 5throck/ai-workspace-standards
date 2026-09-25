/**
 * Tests for lib/platforms.ts (spec: docs/designs/2026-09-24-platform-ssot-constant-design.md;
 * .hermes added by ADR-0088 W1).
 *
 * The platform-list constants are order-frozen SSOTs: these tests pin exact
 * values AND exact order so a future platform insertion is a reviewed,
 * single-file change. Pure constant assertions only — no fixtures, no I/O.
 */
import { describe, it, expect } from 'bun:test';
import { PLATFORM_SKILL_BASES, PLATFORM_MIRROR_DIRS } from '../../scripts/lib/platforms.ts';
// Back-compat path: the freshness module re-exports PLATFORM_MIRROR_DIRS
// (its two historical importers keep importing from there).
import { PLATFORM_MIRROR_DIRS as MIRROR_DIRS_VIA_FRESHNESS } from '../../scripts/lib/platform-mirror-freshness.ts';

describe('PLATFORM_SKILL_BASES', () => {
  it('deep-equals the exact 6-element list in exact order (skills/ SSOT first)', () => {
    expect(PLATFORM_SKILL_BASES).toEqual([
      'skills',
      '.claude/skills',
      '.gemini/skills',
      '.agents/skills',
      '.codex/skills',
      '.hermes/skills',
    ]);
  });

  it('has exactly 6 elements', () => {
    expect(PLATFORM_SKILL_BASES).toHaveLength(6);
  });
});

describe('PLATFORM_MIRROR_DIRS', () => {
  it('deep-equals the exact 5-element list in exact order', () => {
    expect(PLATFORM_MIRROR_DIRS).toEqual([
      '.claude/skills',
      '.gemini/skills',
      '.agents/skills',
      '.codex/skills',
      '.hermes/skills',
    ]);
  });

  it('has exactly 5 elements', () => {
    expect(PLATFORM_MIRROR_DIRS).toHaveLength(5);
  });
});

describe('cross-constant invariants', () => {
  it('PLATFORM_MIRROR_DIRS deep-equals PLATFORM_SKILL_BASES.slice(1)', () => {
    expect([...PLATFORM_MIRROR_DIRS]).toEqual([...PLATFORM_SKILL_BASES.slice(1)]);
  });

  it('freshness re-export is the SAME array instance as the platforms.ts constant', () => {
    expect(MIRROR_DIRS_VIA_FRESHNESS).toBe(PLATFORM_MIRROR_DIRS);
  });
});
