/**
 * Regression guard (U-20261112-006): a variant template's agents/*.md
 * `extends:` stub must resolve to the L1 body under templates/common/agents/,
 * never to the workspace-root agents/ body. The root body carries L0-only
 * operational text (e.g. the "Upstream Request Tickets" section linking the
 * retired docs/governance/agents/pm-gateway-workflow.md) that must not leak
 * into generated mirrors or delivered projects.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '../..');
const TEMPLATES = join(ROOT, 'templates');
const COMMON_AGENTS = join(TEMPLATES, 'common', 'agents');

function stubs(): { file: string; target: string }[] {
  const out: { file: string; target: string }[] = [];
  for (const variant of readdirSync(TEMPLATES)) {
    if (variant === 'common') continue;
    const dir = join(TEMPLATES, variant, 'agents');
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const file = join(dir, f);
      const fm = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
      const m = fm && /^extends:\s*(\S+)\s*$/m.exec(fm[1]);
      if (m) out.push({ file, target: resolve(dirname(file), m[1]) });
    }
  }
  return out;
}

describe('template extends stubs', () => {
  test('every stub resolves under templates/common/agents, not root agents/', () => {
    const bad = stubs().filter((s) => !s.target.startsWith(COMMON_AGENTS + '/'));
    expect(bad.map((s) => s.file.replace(ROOT + '/', ''))).toEqual([]);
  });

  test('the L1 PM body has no L0-only Upstream Request Tickets section or retired pm-gateway-workflow link', () => {
    const body = readFileSync(join(COMMON_AGENTS, 'pm.md'), 'utf8');
    expect(body).not.toContain('## Upstream Request Tickets');
    expect(body).not.toMatch(/\]\([^)]*pm-gateway-workflow\.md/);
  });
});
