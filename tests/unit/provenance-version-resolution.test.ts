/**
 * Tests for the new-project scaffold provenance resolution order
 * (T-20260916-002, residual of M11/T-20260915-011).
 *
 * scripts/new-project.ts previously resolved provenance as
 *   --version <tag> || templates/VERSION || silent "unknown"
 * while create-l3-scaffold.ts v1.15.0 already failed loud on a missing or
 * unparseable templates/VERSION. The decision now lives in the shared
 * helper resolveProvenanceVersion() (scripts/helpers/template-version.ts)
 * so both scaffolders consume one implementation:
 *
 *   1. an explicit --version value wins AS-IS (it is a git tag lookup
 *      string, allowlisted by the caller — semver validation is
 *      deliberately NOT applied to it),
 *   2. otherwise the templates/VERSION SSOT is read fail-loud — a missing
 *      or unparseable file throws; "unknown" is never produced.
 *
 * new-project.ts itself is a top-level imperative script exercised via
 * subprocess (scripts/test-new-project.ts); a missing-SSOT run cannot be
 * simulated against the real workspace, so the decision path is pinned
 * through the helper (same pattern as the M11 block in
 * tests/unit/scaffold-delivery-parity.test.ts).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    resolveProvenanceVersion,
    TEMPLATE_VERSION_RELPATH,
} from '../../scripts/helpers/template-version.ts';

function scratchRoot(label: string): string {
    return mkdtempSync(join(tmpdir(), `prov-resolve-${label}-`));
}

describe('resolveProvenanceVersion (T-20260916-002)', () => {
    test('explicit --version value wins as-is — even without a templates/VERSION file', () => {
        const root = scratchRoot('flag');
        try {
            // No templates/ dir at all: the flag path must not gain an SSOT
            // dependency it never had.
            expect(resolveProvenanceVersion('1.2.3', root)).toBe('1.2.3');
            // Tag suffixes are not necessarily bare semver — the caller's
            // allowlist (letters/digits/dots/hyphens/underscores) is the
            // only constraint, so no semver validation is applied here.
            expect(resolveProvenanceVersion('1.2.3-beta.1', root)).toBe('1.2.3-beta.1');
            expect(resolveProvenanceVersion('2026_09_16-rc', root)).toBe('2026_09_16-rc');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('no flag: reads the templates/VERSION SSOT (trimmed)', () => {
        const root = scratchRoot('ssot');
        try {
            mkdirSync(join(root, 'templates'), { recursive: true });
            writeFileSync(join(root, 'templates', 'VERSION'), '9.9.9\n');
            expect(resolveProvenanceVersion('', root)).toBe('9.9.9');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('no flag + missing templates/VERSION fails loud (never "unknown")', () => {
        const root = scratchRoot('missing');
        try {
            expect(() => resolveProvenanceVersion('', root)).toThrow(
                /templates\/VERSION not found .* cannot record scaffold provenance/,
            );
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('no flag + unparseable templates/VERSION fails loud', () => {
        const root = scratchRoot('garbage');
        try {
            mkdirSync(join(root, 'templates'), { recursive: true });
            writeFileSync(join(root, 'templates', 'VERSION'), 'unknown\n');
            expect(() => resolveProvenanceVersion('', root)).toThrow(/valid x\.y\.z version/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('declared SSOT path stays templates/VERSION', () => {
        expect(TEMPLATE_VERSION_RELPATH).toBe('templates/VERSION');
    });
});
