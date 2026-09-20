/**
 * Unit tests for lib/upgrade-policy.ts isDeliveredDiff (v1.10.0, rollout
 * hardening design): a diff fully covered by the recorded upgrade delivery ∪
 * pipeline artifacts qualifies for dev-sync step 3.9 auto-E5; any foreign or
 * hand-edited file, or an empty diff, does not.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { isDeliveredDiff, isPipelineArtifact } from '../../scripts/lib/upgrade-policy.ts';

const DELIVERED = [
  'skills/translate/SKILL.md',
  'scripts/skill-lifecycle-audit.ts',
  'skills/explain-me/references/BUILD_GUIDE.md',
];

describe('isDeliveredDiff', () => {
  test('diff fully inside the delivered set returns true', () => {
    expect(isDeliveredDiff(DELIVERED.slice(0, 2), DELIVERED)).toBe(true);
  });

  test('delivered files plus pipeline artifacts return true', () => {
    expect(isDeliveredDiff(
      ['skills/translate/SKILL.md', 'CHANGELOG.md', 'memory/2026-09-21.md', 'docs/VERSION_MANIFEST.md'],
      DELIVERED,
    )).toBe(true);
  });

  test('any hand-edited file outside the delivery returns false', () => {
    expect(isDeliveredDiff(['skills/translate/SKILL.md', 'agents/pm.md'], DELIVERED)).toBe(false);
  });

  test('empty diff returns false', () => {
    expect(isDeliveredDiff([], DELIVERED)).toBe(false);
  });

  test('pipeline artifacts alone (no delivery) return false', () => {
    expect(isDeliveredDiff(['CHANGELOG.md'], [])).toBe(false);
  });

  test('isPipelineArtifact covers memory/ tree and the known generated files', () => {
    expect(isPipelineArtifact('memory/skill-review/2026-09-21.md')).toBe(true);
    expect(isPipelineArtifact('docs/skill-graph.json')).toBe(true);
    expect(isPipelineArtifact('scripts/dev-sync.ts')).toBe(false);
  });
});
