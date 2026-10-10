/**
 * Tests for lib/platforms.ts (spec: docs/designs/2026-09-24-platform-ssot-constant-design.md;
 * .hermes added by ADR-0088 W1).
 *
 * The platform-list constants are order-frozen SSOTs: these tests pin exact
 * values AND exact order so a future platform insertion is a reviewed,
 * single-file change. Pure constant assertions only — no fixtures, no I/O.
 */
import { describe, it, expect } from 'bun:test';
import {
  PLATFORM_SKILL_BASES, PLATFORM_MIRROR_DIRS, PLATFORM_PROFILES, PROFILE_OWNED_PATHS,
  parsePlatformList, ownedPathsForProfiles, instructionFilesForProfiles,
} from '../../scripts/lib/platforms.ts';
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

describe('PROFILE_OWNED_PATHS (eight-platform design §2)', () => {
  it('pins the four profiles, canonical order, and their owned paths', () => {
    expect([...PLATFORM_PROFILES]).toEqual(['claude', 'antigravity', 'codex', 'hermes']);
    expect(PROFILE_OWNED_PATHS).toEqual({
      claude: ['CLAUDE.md'],
      antigravity: ['GEMINI.md'],
      codex: ['CODEX.md', '.codex'],
      hermes: ['HERMES.md', '.hermes'],
    });
  });
});

describe('parsePlatformList', () => {
  it('parses a single value', () => {
    expect(parsePlatformList('claude')).toEqual({ profiles: ['claude'], canonical: 'claude', warnings: [] });
  });

  it('parses a list and canonicalizes order', () => {
    const r = parsePlatformList('codex,claude');
    expect(r.profiles).toEqual(['claude', 'codex']);
    expect(r.canonical).toBe('claude,codex');
    expect(r.warnings).toEqual([]);
  });

  it('trims whitespace, lowercases, drops empty tokens', () => {
    expect(parsePlatformList(' Claude , ,CODEX ,').canonical).toBe('claude,codex');
  });

  it('removes duplicates silently', () => {
    const r = parsePlatformList('claude,claude');
    expect(r.canonical).toBe('claude');
    expect(r.warnings).toEqual([]);
  });

  it('normalizes 4-of-4 to all', () => {
    expect(parsePlatformList('hermes,codex,antigravity,claude').canonical).toBe('all');
  });

  it('all alone is all with no warning', () => {
    const r = parsePlatformList('all');
    expect(r.canonical).toBe('all');
    expect(r.profiles).toHaveLength(4);
    expect(r.warnings).toEqual([]);
  });

  it('all mixed with other tokens normalizes to all and warns', () => {
    const r = parsePlatformList('all,codex');
    expect(r.canonical).toBe('all');
    expect(r.warnings.length).toBe(1);
  });

  it('accepts legacy both as all with a warning', () => {
    const r = parsePlatformList('both');
    expect(r.canonical).toBe('all');
    expect(r.warnings.length).toBe(1);
  });

  it('throws on an unknown token, naming it and the valid set', () => {
    expect(() => parsePlatformList('claude,gemini')).toThrow(/unknown platform 'gemini'.*claude, antigravity, codex, hermes, all/);
  });

  it('throws on an empty list', () => {
    expect(() => parsePlatformList(' , ')).toThrow(/empty/);
  });
});

describe('ownedPathsForProfiles / instructionFilesForProfiles', () => {
  it('returns the union in canonical order', () => {
    expect(ownedPathsForProfiles(['claude', 'codex'])).toEqual(['CLAUDE.md', 'CODEX.md', '.codex']);
  });

  it('instruction files are the root *.md files of the selected profiles', () => {
    expect(instructionFilesForProfiles(['codex'])).toEqual(['CODEX.md']);
    expect(instructionFilesForProfiles(['claude', 'antigravity', 'codex', 'hermes'])).toEqual(['CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md']);
  });
});
