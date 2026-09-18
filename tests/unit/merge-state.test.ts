/**
 * Tests for scripts/helpers/merge-state.ts — the import-safe shared-file
 * taxonomy and conflict-state parsing behind dev-sync's pre-flight main-drift
 * detection and --conclude-merge mode (ADR-0081 / T-20260918-002, design
 * docs/designs/2026-09-18-delivery-pipeline-hardening-design.md §3.2).
 *
 * The dev-sync pipeline itself is not import-safe (top-level side effects),
 * so tests target this module directly.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
    SHARED_PIPELINE_FILES,
    sharedPipelineFilesChanged,
    parseUnresolvedConflicts,
} from '../../scripts/helpers/merge-state.ts';

describe('SHARED_PIPELINE_FILES (CONSTITUTION §3.3)', () => {
    test('contains the five shared pipeline files', () => {
        expect([...SHARED_PIPELINE_FILES]).toEqual([
            'CHANGELOG.md',
            'memory/MEMORY.md',
            'docs/VERSION_MANIFEST.md',
            'scripts/README.md',
            'templates/common/scripts/README.md',
        ]);
    });
});

describe('sharedPipelineFilesChanged (pre-flight main-drift warning)', () => {
    test('returns only the shared files from a changed-on-main list', () => {
        const changed = [
            'CHANGELOG.md',
            'scripts/dev-sync.ts',
            'docs/VERSION_MANIFEST.md',
            'docs/adr/0081-delivery-pipeline-hardening.md',
            'memory/MEMORY.md',
        ];
        expect(sharedPipelineFilesChanged(changed)).toEqual([
            'CHANGELOG.md',
            'memory/MEMORY.md',
            'docs/VERSION_MANIFEST.md',
        ]);
    });

    test('normalizes Windows separators before matching', () => {
        const changed = ['scripts\\README.md', 'templates\\common\\scripts\\README.md'];
        expect(sharedPipelineFilesChanged(changed)).toEqual([
            'scripts/README.md',
            'templates/common/scripts/README.md',
        ]);
    });

    test('returns empty for unrelated-only changes (lower conflict risk)', () => {
        expect(sharedPipelineFilesChanged(['agents/pm.md', 'skills/sync/SKILL.md'])).toEqual([]);
    });

    test('returns empty for an empty change list', () => {
        expect(sharedPipelineFilesChanged([])).toEqual([]);
    });
});

describe('parseUnresolvedConflicts (--conclude-merge pre-commit check)', () => {
    test('parses `git diff --name-only --diff-filter=U` output, dropping empties', () => {
        const output = 'CHANGELOG.md\n\ndocs/VERSION_MANIFEST.md\n  agents/pm.md  \n';
        expect(parseUnresolvedConflicts(output)).toEqual([
            'CHANGELOG.md',
            'docs/VERSION_MANIFEST.md',
            'agents/pm.md',
        ]);
    });

    test('empty output (fully resolved tree) yields an empty list', () => {
        expect(parseUnresolvedConflicts('')).toEqual([]);
        expect(parseUnresolvedConflicts('\n\n')).toEqual([]);
    });
});
