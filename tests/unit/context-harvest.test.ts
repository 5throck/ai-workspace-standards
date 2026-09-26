/**
 * Unit tests for harvestVariantOnlyLines (W2 HARVEST, T-20260926-021): the
 * variant-only lines inside a section the commonization pass removes — set
 * difference vs the single best-match common section. Extracted from
 * upgrade-project.ts v1.42.0's inline block (which had zero coverage) into
 * helpers/context-sections.ts v1.8.0.
 *
 * @version 1.0.0
 */
import { describe, expect, it } from 'bun:test';
import { getContentLines, harvestVariantOnlyLines, type ContextSection } from '../../scripts/helpers/context-sections.ts';

function section(heading: string, body: string): ContextSection {
  return { headingLine: `## ${heading}`, heading, body };
}

const COMMON_DEPLOY = section('deploy', [
  'Run the build first.',
  'Then deploy to staging.',
  'Smoke-test the endpoints.',
].join('\n'));

const COMMON_SECURITY = section('security', [
  'Rotate keys quarterly.',
  'Enable audit logging.',
].join('\n'));

const commonSections = [COMMON_DEPLOY, COMMON_SECURITY];

describe('harvestVariantOnlyLines — set difference vs best-match common', () => {
  it('reports lines unique to the variant section as backport candidates', () => {
    const variant = section('deploy', [
      'Run the build first.',
      'Deploy via the blue-green pipeline.',   // variant-only
      'Then deploy to staging.',
      'Notify the release channel.',           // variant-only
    ].join('\n'));
    const h = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    expect(h.matched).toBe('deploy');
    expect(h.lines).toEqual(['Deploy via the blue-green pipeline.', 'Notify the release channel.']);
  });

  it('returns empty when the variant section is a pure subset', () => {
    const variant = section('deploy', 'Run the build first.\nThen deploy to staging.');
    const h = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    expect(h.lines).toEqual([]);
  });

  it('when matched heading is null, every content line is variant-only', () => {
    const variant = section('deploy', 'Run the build first.\nThen deploy to staging.');
    const h = harvestVariantOnlyLines(variant.body, null, commonSections);
    expect(h.matched).toBeNull();
    expect(h.lines).toEqual([...getContentLines(variant.body)]);
  });

  it('a line that moved to a DIFFERENT common section still reports as variant-only (conservative)', () => {
    const variant = section('deploy', 'Rotate keys quarterly.'); // lives under security in common
    const h = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    expect(h.lines).toEqual(['Rotate keys quarterly.']);
  });

  it('blank lines and trailing whitespace do not count as content', () => {
    const variant = section('deploy', 'Run the build first.  \n\n   \nThen deploy to staging.');
    const h = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    expect(h.lines).toEqual([]);
  });

  it('is deterministic across repeated runs', () => {
    const variant = section('deploy', 'Run the build first.\nExtra step.');
    const a = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    const b = harvestVariantOnlyLines(variant.body, 'deploy', commonSections);
    expect(a).toEqual(b);
  });
});
