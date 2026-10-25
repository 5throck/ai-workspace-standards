// T-20261026-001: the agent-body-completeness stub detector (validate-agents.ts
// v1.4.0) — 39 of co-newbiz's 41 agent definitions sat as 8-line stubs for a
// month through every gate. The detector fails bodies under 40 non-empty lines
// or under 4 '## ' sections, skipping extends stubs and resolved annotations.
import { describe, expect, test } from 'bun:test';
import {
  agentBodyCompletenessFinding,
  MIN_AGENT_BODY_LINES,
  MIN_AGENT_SECTIONS,
} from '../../scripts/validate-agents.ts';

const FM = '---\nname: x\nrole: Builder\n---\n';

const CANONICAL = `${FM}# Builder

## Role
Does the work.

## Responsibilities
Owns the outcome.

## Protocols
Follows the workflow.

## Constraints
Stays in scope.

## Required Tools
Read, Bash.
${Array.from({ length: 30 }, () => 'Body text.').join('\n')}
`;

const STUB = `${FM}# Builder
## Role
Copied first sentence of the description.

## Scope
One shared boilerplate line.
`;

describe('agentBodyCompletenessFinding (U-20261026-001)', () => {
  test('canonical full body passes (null finding)', () => {
    expect(agentBodyCompletenessFinding(CANONICAL)).toBeNull();
  });

  test('the co-newbiz stub shape (8-line body, 2 headings) fails', () => {
    const finding = agentBodyCompletenessFinding(STUB);
    expect(finding).toContain('stub-quality definition');
    expect(finding).toContain('minimum 40 lines / 4 sections');
  });

  test('thresholds are exported and documented', () => {
    expect(MIN_AGENT_BODY_LINES).toBe(40);
    expect(MIN_AGENT_SECTIONS).toBe(4);
  });

  test('resolved-from annotations skip (hydrated at scaffold)', () => {
    const resolved = `${FM}# @resolved-from: templates/common/agents/x.md\n${'Body. '.repeat(30)}`;
    expect(agentBodyCompletenessFinding(resolved)).toBeNull();
  });

  test('enough lines but too few sections still fails (and vice versa)', () => {
    const longFlat = `${FM}# Builder\n${Array.from({ length: 60 }, () => 'Body text.').join('\n')}`;
    expect(agentBodyCompletenessFinding(longFlat)).toContain('section(s)');
    const shortSectioned = `${FM}# Builder\n## Role\n## Responsibilities\n## Protocols\n## Constraints\n${Array.from({ length: 20 }, () => 'Body text.').join('\n')}`;
    const finding = agentBodyCompletenessFinding(shortSectioned);
    expect(finding).toContain('section(s)'); // lines >= 40 but sections < 4
  });
});
