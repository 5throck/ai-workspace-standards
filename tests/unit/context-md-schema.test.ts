// tests/unit/context-md-schema.test.ts
// @version 1.0.0
// Unit tests for scripts/lib/context-md-schema.ts
// Validates WS-09 slot structure checking and exempt variant list.

import { describe, expect, it } from 'bun:test';
import { checkContextMdStructure, WS09_EXEMPT_VARIANTS } from '../../scripts/lib/context-md-schema.ts';

const VALID_HEADINGS = [
  '## Tool Stack',
  '## Agents',
  '## Skills',
  '## Development Workflow',
  '## Guidelines',
  '## File Organization Policy',
  '## Domain Rules',
];

function buildValidContext(): string {
  return ['# Context', '', ...VALID_HEADINGS.map(h => `${h}\n\nContent for ${h}`)].join('\n');
}

describe('checkContextMdStructure', () => {
  it('returns ok=true for a context.md with all required slots in order', () => {
    const result = checkContextMdStructure(buildValidContext());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('returns ok=false when one required slot is missing', () => {
    const content = ['# Context', '', ...VALID_HEADINGS.slice(1).map(h => `${h}\n\nContent`)].join('\n');
    const result = checkContextMdStructure(content);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].slot).toBe('Stack');
  });

  it('returns ok=false when multiple slots are missing', () => {
    const content = '# Context\n\n## Domain Rules\n\nOnly one slot present';
    const result = checkContextMdStructure(content);
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(1);
  });

  it('returns ok=false for empty content', () => {
    const result = checkContextMdStructure('');
    expect(result.ok).toBe(false);
    expect(result.issues.length).toBe(7);
  });

  it('matches slots with regex flexibility (Tech Stack also matches Stack)', () => {
    const content = [
      '# Context',
      '## Tech Stack',
      '## Agent',
      '## Skills',
      '## Engagement Workflow',
      '## Consulting Guidelines',
      '## File Organization Policy',
      '## Domain Rules',
    ].join('\n');
    const result = checkContextMdStructure(content);
    expect(result.ok).toBe(true);
  });

  it('each issue has slot, message, and fix fields', () => {
    const result = checkContextMdStructure('');
    for (const issue of result.issues) {
      expect(issue).toHaveProperty('slot');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('fix');
      expect(typeof issue.slot).toBe('string');
      expect(typeof issue.message).toBe('string');
      expect(typeof issue.fix).toBe('string');
    }
  });

  it('detects out-of-order slots (slot appearing before earlier slot)', () => {
    const content = [
      '# Context',
      '## Domain Rules',
      '## Tool Stack',
      '## Agents',
      '## Skills',
      '## Development Workflow',
      '## Guidelines',
      '## File Organization Policy',
    ].join('\n');
    const result = checkContextMdStructure(content);
    expect(result.ok).toBe(false);
  });

  it('Environment Setup is optional and does not cause failure when missing', () => {
    const content = [
      '# Context',
      '## Tool Stack',
      '## Agents',
      '## Skills',
      '## Development Workflow',
      '## Guidelines',
      '## File Organization Policy',
      '## Domain Rules',
    ].join('\n');
    const result = checkContextMdStructure(content);
    expect(result.ok).toBe(true);
  });
});

describe('WS09_EXEMPT_VARIANTS', () => {
  it('is a Set containing co-abap', () => {
    expect(WS09_EXEMPT_VARIANTS instanceof Set).toBe(true);
    expect(WS09_EXEMPT_VARIANTS.has('co-abap')).toBe(true);
  });
});
