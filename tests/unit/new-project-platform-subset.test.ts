/**
 * Tests for the --platform subset pruning (eight-platform design §3.3 / §3.6).
 *
 * new-project.ts is a top-level imperative script (no import guard), so the
 * union pruning rule lives in lib/platform-prune.ts and is exercised here
 * against scratch project dirs. The table pins the §3.3 back-compat matrix,
 * including the single-`codex` behavior fix.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pruneUnselectedProfiles } from '../../scripts/lib/platform-prune.ts';
import { parsePlatformList, type PlatformProfile } from '../../scripts/lib/platforms.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'new-project-platform-subset-test');
const FULL_TREE = ['CLAUDE.md', 'GEMINI.md', 'CODEX.md', '.codex/config.toml', 'HERMES.md', '.hermes/skills/x.md', 'AGENTS.md', '.agents/skills/x.md'];

function scaffold(dir: string): void {
  for (const rel of FULL_TREE) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, 'x\n');
  }
}
function survivors(dir: string): string[] {
  return FULL_TREE.filter(rel => fs.existsSync(path.join(dir, rel))).sort();
}
function prune(value: string): string[] {
  const dir = path.join(scratchRoot, value.replace(/[^a-z0-9]+/gi, '_'));
  fs.mkdirSync(dir, { recursive: true });
  scaffold(dir);
  const { profiles } = parsePlatformList(value);
  pruneUnselectedProfiles(dir, profiles as PlatformProfile[]);
  return survivors(dir);
}

describe('pruneUnselectedProfiles: single values match design §3.3', () => {
  beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('all keeps every platform file', () => {
    expect(prune('all')).toEqual([...FULL_TREE].sort());
  });

  test('claude removes GEMINI, CODEX, .codex, HERMES, .hermes', () => {
    expect(prune('claude')).toEqual(['AGENTS.md', '.agents/skills/x.md', 'CLAUDE.md'].sort());
  });

  test('antigravity removes CLAUDE, CODEX, .codex, HERMES, .hermes', () => {
    expect(prune('antigravity')).toEqual(['AGENTS.md', '.agents/skills/x.md', 'GEMINI.md'].sort());
  });

  test('codex keeps CODEX.md and .codex/ and drops the CLAUDE/GEMINI twins (behavior fix)', () => {
    expect(prune('codex')).toEqual(['AGENTS.md', '.agents/skills/x.md', 'CODEX.md', '.codex/config.toml'].sort());
  });

  test('hermes keeps HERMES.md and .hermes/ and drops the legacy twins', () => {
    expect(prune('hermes')).toEqual(['AGENTS.md', '.agents/skills/x.md', 'HERMES.md', '.hermes/skills/x.md'].sort());
  });
});

describe('pruneUnselectedProfiles: list values use the union', () => {
  beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('claude,codex keeps CLAUDE.md, CODEX.md, .codex/ and removes GEMINI, HERMES', () => {
    expect(prune('claude,codex')).toEqual(['AGENTS.md', '.agents/skills/x.md', 'CLAUDE.md', 'CODEX.md', '.codex/config.toml'].sort());
  });

  test('returns the removed relative paths', () => {
    const dir = path.join(scratchRoot, 'removed-list');
    fs.mkdirSync(dir, { recursive: true });
    scaffold(dir);
    const removed = pruneUnselectedProfiles(dir, ['claude', 'codex']);
    expect(removed.sort()).toEqual(['GEMINI.md', 'HERMES.md', '.hermes'].sort());
  });

  test('is idempotent: a second run removes nothing', () => {
    const dir = path.join(scratchRoot, 'idempotent');
    fs.mkdirSync(dir, { recursive: true });
    scaffold(dir);
    pruneUnselectedProfiles(dir, ['claude']);
    expect(pruneUnselectedProfiles(dir, ['claude'])).toEqual([]);
  });
});
