// CI coverage for validate-templates v1.76.0's `graft-mcp-surfaces` check
// (spec docs/designs/2026-11-08-graft-mcp-corrective-pass-design.md R2): the
// mcpServers flip (#1927) emptied graft-era registrations from every template
// MCP surface — this test pins that state so a template re-introducing a
// graft registration fails the suite instead of silently shipping to
// scaffolds and JSON_MERGE deliveries. Renaming-documentation prose
// (CODEX.md, design docs) is deliberately not scanned.
import { describe, test, expect } from 'bun:test';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const TEMPLATES_DIR = join(ROOT, 'templates');
const SURFACES = ['.gemini/settings.json', '.codex/config.toml', 'opencode.json', '.mcp.json', '.claude/settings.json'];
const GRAFT_PATTERNS = [
  /"graft"\s*:/,
  /\[mcp_servers\.graft\]/,
  /"command"\s*:\s*"graft"/,
  /@nanonets\/graft/,
];

function templateDirs(): Array<{ label: string; dir: string }> {
  const dirs = [{ label: 'common', dir: join(TEMPLATES_DIR, 'common') }];
  if (existsSync(TEMPLATES_DIR)) {
    for (const entry of readdirSync(TEMPLATES_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('co-')) dirs.push({ label: entry.name, dir: join(TEMPLATES_DIR, entry.name) });
    }
  }
  return dirs;
}

describe('graft→trail: template MCP surfaces carry zero graft-era registrations', () => {
  for (const { label, dir } of templateDirs()) {
    for (const surf of SURFACES) {
      const abs = join(dir, surf);
      if (!existsSync(abs)) continue;
      test(`${label}/${surf} has no graft-era registration`, () => {
        const text = readFileSync(abs, 'utf-8');
        const hit = GRAFT_PATTERNS.find((re) => re.test(text));
        expect(hit ? `${abs} matched ${hit}` : null).toBeNull();
      });
    }
  }

  test('at least one template MCP surface exists (scan is not vacuous)', () => {
    const scanned = templateDirs().reduce((n, { dir }) => n + SURFACES.filter((s) => existsSync(join(dir, s))).length, 0);
    expect(scanned).toBeGreaterThan(0);
  });
});
