/**
 * Unit tests for helpers/upgrade-versions.ts bumpFrontmatterLastUpdated
 * (U-20261026-009) and the upgrade-policy lifecyclelessText tolerance that
 * pairs with it: the post-delivery re-stamp advances only the TOP-LEVEL
 * frontmatter `last_updated`, and the agents/ drift compare must ignore
 * bump-only date differences so the re-stamp never manufactures DRIFT on the
 * next upgrade (same tolerance agent-lifecycle-audit's isMetadataOnlyChange
 * implements).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { bumpFrontmatterLastUpdated } from '../../scripts/helpers/upgrade-versions.ts';
import { lifecyclelessText } from '../../scripts/lib/upgrade-policy.ts';

const AGENT_MD = `---
name: Auditor
last_updated: 2026-09-01
tier: medium
lifecycle:
  phase: production
  created: 2026-05-29
  last_updated: 2026-08-15
  governance: docs/lifecycle/agents/auditor.md
---

## Role

Body text.
`;

describe('bumpFrontmatterLastUpdated (U-20261026-009)', () => {
  test('bumps a stale top-level date to the delivery date', () => {
    const res = bumpFrontmatterLastUpdated(AGENT_MD, '2026-10-27');
    expect(res.bumped).toBe(true);
    expect(res.text).toContain('last_updated: 2026-10-27');
    // The lifecycle-block date must stay untouched (no overreach).
    expect(res.text).toContain('  last_updated: 2026-08-15');
  });

  test('is idempotent when the date already equals the delivery date', () => {
    const once = bumpFrontmatterLastUpdated(AGENT_MD, '2026-10-27').text;
    const twice = bumpFrontmatterLastUpdated(once, '2026-10-27');
    expect(twice.bumped).toBe(false);
    expect(twice.text).toBe(once);
  });

  test('returns unchanged when there is no top-level last_updated key', () => {
    const noKey = '---\nname: X\nversion: 1.0.0\n---\n\nBody.\n';
    const res = bumpFrontmatterLastUpdated(noKey, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(noKey);
  });

  test('returns unchanged without a frontmatter block', () => {
    const plain = '# Just a heading\n\nNo frontmatter.\n';
    const res = bumpFrontmatterLastUpdated(plain, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(plain);
  });

  test('never touches a nested lifecycle-block date (no top-level key present)', () => {
    const onlyLifecycle = '---\nname: Y\nlifecycle:\n  last_updated: 2026-08-15\n---\n\nBody.\n';
    const res = bumpFrontmatterLastUpdated(onlyLifecycle, '2026-10-27');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(onlyLifecycle);
  });

  test('rejects a malformed date argument', () => {
    const res = bumpFrontmatterLastUpdated(AGENT_MD, 'not-a-date');
    expect(res.bumped).toBe(false);
    expect(res.text).toBe(AGENT_MD);
  });
});

describe('lifecyclelessText tolerance for re-stamped dates (U-20261026-009)', () => {
  test('a bump-only date difference does not read as content drift', () => {
    const restamped = AGENT_MD.replace('last_updated: 2026-09-01', 'last_updated: 2026-10-27');
    expect(lifecyclelessText(AGENT_MD)).toBe(lifecyclelessText(restamped));
  });

  test('real content differences still count as drift', () => {
    const changedBody = AGENT_MD.replace('Body text.', 'New delivered body.');
    expect(lifecyclelessText(AGENT_MD)).not.toBe(lifecyclelessText(changedBody));
  });

  test('the lifecycle block is still stripped as before', () => {
    const stripped = lifecyclelessText(AGENT_MD);
    expect(stripped).not.toContain('lifecycle:');
    expect(stripped).not.toContain('governance: docs/lifecycle');
    expect(stripped).toContain('## Role');
  });
});
