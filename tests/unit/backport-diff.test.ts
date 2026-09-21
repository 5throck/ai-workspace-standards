/**
 * Pure-function tests for backport-diff.ts (project-resync Step 2 support):
 * 5-surface classification, counterpart resolution order, and divergence
 * direction from the (base, HEAD, counterpart) content snapshots.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  counterpartCandidates,
  directionFor,
  surfaceFor,
} from '../../scripts/backport-diff.ts';

describe('surfaceFor — 5-surface classification', () => {
  test('skills surface for project skills/', () => {
    expect(surfaceFor('skills/my-skill/SKILL.md')).toBe('skills');
  });

  test('platform skill mirrors (.claude/.gemini/.agents/.codex) count as skills', () => {
    expect(surfaceFor('.claude/skills/my-skill/SKILL.md')).toBe('skills');
    expect(surfaceFor('.codex/skills/my-skill/references/x.md')).toBe('skills');
  });

  test('helpers surface before scripts surface', () => {
    expect(surfaceFor('scripts/helpers/context-sections.ts')).toBe('helpers');
    expect(surfaceFor('scripts/audit.ts')).toBe('scripts');
  });

  test('context surface for context docs and CLAUDE.md', () => {
    expect(surfaceFor('docs/co-deck.context.md')).toBe('context');
    expect(surfaceFor('docs/context.md')).toBe('context');
    expect(surfaceFor('CLAUDE.md')).toBe('context');
  });

  test('agents surface for roster files', () => {
    expect(surfaceFor('agents/docs-writer.md')).toBe('agents');
  });

  test('engagement content is surface other', () => {
    expect(surfaceFor('deliverables/report.md')).toBe('other');
    expect(surfaceFor('.claude/last-upgrade-delivery.json')).toBe('other');
  });
});

describe('counterpartCandidates — nearest delivery source first', () => {
  test('variant → common → L0 for a plain file', () => {
    expect(counterpartCandidates('skills/foo/SKILL.md', 'co-deck')).toEqual([
      'templates/co-deck/skills/foo/SKILL.md',
      'templates/common/skills/foo/SKILL.md',
      'skills/foo/SKILL.md',
    ]);
  });

  test('docs/context.md maps to the variant context doc first', () => {
    expect(counterpartCandidates('docs/context.md', 'co-deck')).toEqual([
      'templates/co-deck/docs/co-deck.context.md',
      'templates/common/docs/co-deck.context.md',
      'docs/co-deck.context.md',
      'templates/co-deck/docs/context.md',
      'templates/common/docs/context.md',
      'docs/context.md',
    ]);
  });

  test('no variant → common → L0 only', () => {
    expect(counterpartCandidates('scripts/audit.ts', null)).toEqual([
      'templates/common/scripts/audit.ts',
      'scripts/audit.ts',
    ]);
  });
});

describe('directionFor — divergence direction', () => {
  test('head equals counterpart → in-sync (already promoted)', () => {
    expect(directionFor('base', 'head', 'head')).toBe('in-sync');
  });

  test('counterpart still equals base → project-ahead', () => {
    expect(directionFor('base', 'new-work', 'base')).toBe('project-ahead');
  });

  test('head equals base while counterpart moved → template-ahead', () => {
    expect(directionFor('base', 'base', 'newer-template')).toBe('template-ahead');
  });

  test('both sides moved → both-changed', () => {
    expect(directionFor('base', 'project-version', 'template-version')).toBe('both-changed');
  });

  test('no counterpart → project-only (prime backport candidate)', () => {
    expect(directionFor('base', 'head', null)).toBe('project-only');
  });

  test('deleted in range → project-ahead (with note upstream)', () => {
    expect(directionFor('base', null, 'template-content')).toBe('project-ahead');
  });
});
