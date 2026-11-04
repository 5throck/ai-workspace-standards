#!/usr/bin/env bun
/**
 * Unit tests for scripts/helpers/agent-mechanical-date-bump.ts — the pure
 * decision core of dev-sync step 4.87 (U-20261104-003).
 *
 * Reproduction shape (co-newbiz commit 0b1a406c, 2026-10-28): a workspace-sync
 * pass mechanically collapsed the per-platform `tier:` frontmatter block into
 * the ADR-0102 scalar form across 34 agent files but never advanced the
 * files' top-level `last_updated:` (left at 2026-10-26), so
 * agent-lifecycle-audit emitted 34 identical "last_updated older than the
 * last git commit" warnings. The pinned fixtures replay exactly that
 * transform and the negative contracts the ticket demands: body edits and
 * no-op syncs must never be re-stamped.
 */

import { describe, test, expect } from 'bun:test';
import {
    splitFrontmatter,
    isAgentMdPath,
    isMechanicalFrontmatterRewrite,
    bumpMechanicalLastUpdated,
} from '../../scripts/helpers/agent-mechanical-date-bump';

const RUN_DATE = '2026-11-04';

const HEAD_TEXT = [
    '---',
    'extends: ../../../agents/pm.md',
    'name: compliance-officer',
    'version: "1.1.2"',
    'last_updated: "2026-10-26"',
    'tier:',
    '  claude: high',
    '  gemini: high',
    '  antigravity: high',
    '  gemini-cli: high',
    'model: inherit',
    '---',
    '',
    '# Compliance Officer',
    '',
    'Runs the rules the team writes.',
    '',
].join('\n');

const SYNC_REWRITTEN = HEAD_TEXT.replace(
    `tier:\n  claude: high\n  gemini: high\n  antigravity: high\n  gemini-cli: high`,
    'tier: high',
);

describe('splitFrontmatter', () => {
    test('splits fenced frontmatter from the body', () => {
        const split = splitFrontmatter(HEAD_TEXT);
        expect(split).not.toBeNull();
        expect(split!.frontmatter).toContain('name: compliance-officer');
        expect(split!.body).toContain('# Compliance Officer');
    });

    test('returns null without a frontmatter fence', () => {
        expect(splitFrontmatter('plain markdown')).toBeNull();
    });
});

describe('isAgentMdPath', () => {
    test('matches the top-level agents directory', () => {
        expect(isAgentMdPath('agents/compliance-officer.md')).toBe(true);
    });

    test('matches agents directories under templates/', () => {
        expect(isAgentMdPath('templates/common/agents/pm.md')).toBe(true);
        expect(isAgentMdPath('templates/co-newbiz/agents/docs-writer.md')).toBe(true);
    });

    test('rejects non-agent paths and non-markdown files', () => {
        expect(isAgentMdPath('docs/VERSION_MANIFEST.md')).toBe(false);
        // Nested agent partials (e.g. agents/_shared/) still count — they are
        // frontmatter-owned agent files too.
        expect(isAgentMdPath('agents/nested/deep/pm.md')).toBe(true);
        expect(isAgentMdPath('scripts/dev-sync.ts')).toBe(false);
        expect(isAgentMdPath('agents/pm.md.bak')).toBe(false);
        expect(isAgentMdPath('pm.md')).toBe(false);
    });
});

describe('isMechanicalFrontmatterRewrite', () => {
    test('frontmatter-only change (tier block to scalar) is mechanical', () => {
        expect(isMechanicalFrontmatterRewrite(HEAD_TEXT, SYNC_REWRITTEN)).toBe(true);
    });

    test('a body edit is NOT mechanical', () => {
        const bodyEdited = SYNC_REWRITTEN.replace(
            'Runs the rules the team writes.',
            'Runs the rules the team writes — with a new sentence.',
        );
        expect(isMechanicalFrontmatterRewrite(HEAD_TEXT, bodyEdited)).toBe(false);
    });

    test('identical content is NOT a rewrite (no-op syncs stay no-ops)', () => {
        expect(isMechanicalFrontmatterRewrite(HEAD_TEXT, HEAD_TEXT)).toBe(false);
    });

    test('new files (no HEAD version) are NOT rewrites', () => {
        expect(isMechanicalFrontmatterRewrite(null, SYNC_REWRITTEN)).toBe(false);
    });

    test('either side missing frontmatter is NOT a rewrite', () => {
        expect(isMechanicalFrontmatterRewrite('no frontmatter', SYNC_REWRITTEN)).toBe(false);
        expect(isMechanicalFrontmatterRewrite(HEAD_TEXT, 'no frontmatter')).toBe(false);
    });
});

describe('bumpMechanicalLastUpdated', () => {
    test('mechanical rewrite: last_updated advances to the run date', () => {
        const { text, bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, SYNC_REWRITTEN, RUN_DATE);
        expect(bumped).toBe(true);
        // bumpFrontmatterLastUpdated rewrites the value unquoted — the shared
        // primitive's established production convention.
        expect(text).toContain('last_updated: 2026-11-04');
        expect(text).toContain('tier: high');
        // Body byte-identical to the rewritten input.
        expect(splitFrontmatter(text)!.body).toBe(splitFrontmatter(SYNC_REWRITTEN)!.body);
    });

    test('negative: unchanged content is never bumped', () => {
        const { text, bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, HEAD_TEXT, RUN_DATE);
        expect(bumped).toBe(false);
        expect(text).toBe(HEAD_TEXT);
    });

    test('negative: body edits are never bumped', () => {
        const bodyEdited = SYNC_REWRITTEN.replace(
            'Runs the rules the team writes.',
            'Runs the rules the team writes — with a new sentence.',
        );
        const { text, bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, bodyEdited, RUN_DATE);
        expect(bumped).toBe(false);
        expect(text).toBe(bodyEdited);
    });

    test('negative: never injects a missing last_updated key', () => {
        const noDate = HEAD_TEXT
            .replace('last_updated: "2026-10-26"\n', '')
            .replace('tier:\n  claude: high\n  gemini: high\n  antigravity: high\n  gemini-cli: high', 'tier: high');
        const { text, bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, noDate, RUN_DATE);
        expect(bumped).toBe(false);
        expect(text).not.toContain('last_updated');
    });

    test('negative: already-current date stays untouched (idempotent)', () => {
        const current = HEAD_TEXT.replace('last_updated: "2026-10-26"', 'last_updated: 2026-11-04')
            .replace('tier:\n  claude: high\n  gemini: high\n  antigravity: high\n  gemini-cli: high', 'tier: high');
        const { text, bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, current, RUN_DATE);
        expect(bumped).toBe(false);
        expect(text).toBe(current);
    });

    test('malformed run date is rejected', () => {
        const { bumped } = bumpMechanicalLastUpdated(HEAD_TEXT, SYNC_REWRITTEN, 'not-a-date');
        expect(bumped).toBe(false);
    });
});
