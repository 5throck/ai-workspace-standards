/**
 * Tests for the list-valued --platform / platform= semantics used by
 * upgrade-project.ts (eight-platform design §3.5).
 *
 * upgrade-project.ts is a top-level imperative script, so its MERGE_FILES and
 * COMMANDS_DIRS derivation is expressed through lib/platforms.ts helpers and
 * pinned here: a list yields the union, and legacy `both` is still accepted.
 */
import { describe, test, expect } from 'bun:test';
import { parsePlatformList, instructionFilesForProfiles } from '../../scripts/lib/platforms.ts';

describe('upgrade-project platform list semantics', () => {
  test('a list-valued platform produces a union of MERGE_FILES', () => {
    const { profiles } = parsePlatformList('claude,codex');
    expect(instructionFilesForProfiles(profiles)).toEqual(['CLAUDE.md', 'CODEX.md']);
  });

  test('a list including hermes merges HERMES.md', () => {
    const { profiles } = parsePlatformList('antigravity,hermes');
    expect(instructionFilesForProfiles(profiles)).toEqual(['GEMINI.md', 'HERMES.md']);
  });

  test('legacy platform=both is accepted and means all', () => {
    const r = parsePlatformList('both');
    expect(r.canonical).toBe('all');
    expect(instructionFilesForProfiles(r.profiles)).toEqual(['CLAUDE.md', 'GEMINI.md', 'CODEX.md', 'HERMES.md']);
  });

  test('a canonical marker value round-trips through the parser', () => {
    expect(parsePlatformList('claude,codex').canonical).toBe('claude,codex');
    expect(parsePlatformList('all').canonical).toBe('all');
  });

  test('an unknown platform= token is rejected by the strict parser', () => {
    expect(() => parsePlatformList('claude,openai')).toThrow();
  });
});
