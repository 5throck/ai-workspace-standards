/**
 * Tests for beta-lifecycle.ts — syncSummaryToVariantJson().
 * `.pipeline-state/beta-lifecycle/*.json` is git-ignored (holds per-engagement
 * client identifiers and bug descriptions, treated as local operational
 * data), but the aggregate counts that promotion decisions are based on must
 * still be durable across machines — mirrored into the already-tracked
 * `templates/<variantName>/variant.json` under `betaLifecycleSummary`.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { syncSummaryToVariantJson, type BetaLifecycleState } from '../../scripts/helpers/beta-lifecycle.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'beta-lifecycle-sync-test');

function makeState(overrides: Partial<BetaLifecycleState> = {}): BetaLifecycleState {
    return {
        variantName: 'co-fixture',
        variantType: 'lecture',
        status: 'beta',
        statusSince: '2026-07-01T00:00:00.000Z',
        betaCreatedAt: '2026-07-01T00:00:00.000Z',
        betaEngagements: 2,
        engagementLog: [{ timestamp: '2026-07-05T00:00:00.000Z', clientId: 'redacted-1', outcome: 'success' }],
        betaBugs: 1,
        bugLog: [{ timestamp: '2026-07-06T00:00:00.000Z', severity: 'low', status: 'resolved', description: 'redacted' }],
        betaAgeInMonths: 0.3,
        promotionEligible: false,
        missingCriteria: ['minBetaMonths'],
        completedChecks: [],
        ...overrides,
    };
}

describe('syncSummaryToVariantJson', () => {
    const variantDir = path.join(scratchRoot, 'templates', 'co-fixture');
    const variantJsonPath = path.join(variantDir, 'variant.json');

    beforeEach(() => {
        fs.rmSync(scratchRoot, { recursive: true, force: true });
        fs.mkdirSync(variantDir, { recursive: true });
        fs.writeFileSync(variantJsonPath, JSON.stringify({ name: 'co-fixture', status: 'beta' }, null, 2));
    });
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('writes aggregate summary fields into variant.json, without per-engagement detail', () => {
        syncSummaryToVariantJson(makeState(), scratchRoot);

        const written = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
        expect(written.betaLifecycleSummary).toMatchObject({
            betaEngagements: 2,
            betaBugs: 1,
            betaAgeInMonths: 0.3,
            promotionEligible: false,
            missingCriteria: ['minBetaMonths'],
        });
        expect(typeof written.betaLifecycleSummary.lastSynced).toBe('string');
        // No raw engagement/bug detail (client IDs, descriptions) leaks into the tracked file.
        expect(JSON.stringify(written)).not.toContain('redacted');
    });

    test('preserves existing variant.json fields untouched', () => {
        syncSummaryToVariantJson(makeState(), scratchRoot);
        const written = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
        expect(written.name).toBe('co-fixture');
        expect(written.status).toBe('beta');
    });

    test('does not throw when variant.json is missing (e.g. fixture-less variant)', () => {
        fs.rmSync(variantJsonPath);
        expect(() => syncSummaryToVariantJson(makeState({ variantName: 'co-does-not-exist' }), scratchRoot)).not.toThrow();
    });

    test('overwrites a stale summary on repeated sync', () => {
        syncSummaryToVariantJson(makeState({ betaEngagements: 2 }), scratchRoot);
        syncSummaryToVariantJson(makeState({ betaEngagements: 5, promotionEligible: true, missingCriteria: [] }), scratchRoot);

        const written = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
        expect(written.betaLifecycleSummary.betaEngagements).toBe(5);
        expect(written.betaLifecycleSummary.promotionEligible).toBe(true);
    });
});
