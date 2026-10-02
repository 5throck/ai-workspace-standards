/**
 * @version 1.0.0
 * Regression test for PR #1338: verifies that the common CI template pins
 * bun-version to 1.4.x or newer across all setup-bun steps (never `latest`
 * or 1.3.x, which resolve to a Bun version that cannot parse lockfileVersion 2).
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Pure extraction function: extracts bun-version values (quoted or unquoted).
function extractBunVersions(yaml: string): string[] {
  const versions: string[] = [];
  const re = /bun-version:\s*["']?([^"'\s#]+)["']?/g;
  let match;
  while ((match = re.exec(yaml)) !== null) {
    versions.push(match[1]);
  }
  return versions;
}

// Pure validation function: checks if a version string is properly pinned.
function isPinnedVersion(version: string): boolean {
  const pinnedRe = /^1\.[4-9]\.x$|^1\.[4-9]\.\d+$|^[2-9]\./;
  return pinnedRe.test(version);
}

describe('CI template bun-version pinning (PR #1338)', () => {
  const templatePath = resolve(import.meta.dir, '..', '..', 'templates', 'common', '.github', 'workflows', 'ci.yml');
  const template = readFileSync(templatePath, 'utf8');
  const versions = extractBunVersions(template);

  test('every bun-version line (quoted or unquoted) is pinned to 1.4.x or newer', () => {
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(isPinnedVersion(version)).toBe(true);
    }
  });

  test('number of extracted values equals number of bun-version: occurrences', () => {
    const lineCount = (template.match(/bun-version:/g) || []).length;
    expect(versions.length).toBe(lineCount);
  });

  test('rejects unquoted latest and quoted 1.3.x strings', () => {
    expect(isPinnedVersion('latest')).toBe(false);
    expect(isPinnedVersion('1.3.x')).toBe(false);
  });
});
