/**
 * Tests for SCRIPTS.md L0 row filtering at L2 scaffold time.
 *
 * Both new-project.ts (§6.5) and create-l2-scaffold.ts (copyCommonOverlay)
 * must strip L0-only registry rows from the project's SCRIPTS.md so that
 * verify-scripts.ts does not report ghost entry errors in L2 projects.
 *
 * This test validates the filtering logic by simulating the exact parsing
 * and row-removal steps used in both scaffolding scripts.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseScriptLayers } from '../../scripts/helpers/layer-filter.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'scripts-md-filtering-test');

/** Minimal SCRIPTS.md content with mixed L0 and L0+L1 entries */
const SAMPLE_SCRIPTS_MD = `# SCRIPTS.md —Script Lifecycle Registry

> This file is the Single Source of Truth (Tier 1 SSOT) for all scripts in \`scripts/\` (workspace root).
> Template \`templates/common/scripts/\` (Tier 2) is a snapshot published from here via \`bun run propagate:apply\`.
> Project \`scripts/\` (Tier 3) is a snapshot created from Tier 2 at \`new-project\` time.

---

## Registry

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
| \`audit.ts\` | L0 | 2.0.0 | active | —| —| L0+L1 | —|
| \`new-project.ts\` | L0 | 1.5.0 | active | —| —| L0 | —|
| \`create-l2-scaffold.ts\` | L0 | 1.7.0 | active | —| —| L0 | —|
| \`dev-sync.ts\` | L0 | 1.3.5 | active | —| —| L0+L1 | —|
| \`helpers/layer-filter.ts\` | L0 | 1.3.1 | active | —| —| L0 | —|
| \`helpers/extends-validator.ts\` | L0 | 1.0.1 | active | —| —| L0+L1 | —|
| \`hooks/pre-commit.ts\` | L0 | 1.5.9 | active | —| —| L0+L1 | —|
| \`verify-scripts.ts\` | L0 | 1.3.0 | active | —| —| L0+L1 | —|

---

## Guide

Some guide content here.

*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*
`;

/**
 * Simulates the SCRIPTS.md filtering logic used in both new-project.ts §6.5
 * and create-l2-scaffold.ts copyCommonOverlay(). Returns the filtered content
 * and count of removed rows.
 */
function filterScriptsMdForL2(mdContent: string): { content: string; removed: number } {
  const layers = parseScriptLayersFromContent(mdContent);
  const lines = mdContent.split('\n');
  const out: string[] = [];
  let inRegistry = false;
  let headerParsed = false;
  let removed = 0;

  for (const line of lines) {
    if (/^## Registry/.test(line)) { inRegistry = true; headerParsed = false; out.push(line); continue; }
    if (inRegistry && /^## /.test(line)) { inRegistry = false; out.push(line); continue; }
    if (inRegistry) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|-')) { out.push(line); continue; }
      if (!trimmed.startsWith('|')) { out.push(line); continue; }
      const cols = trimmed.split('|').slice(1, -1).map((c) => c.trim());
      if (cols.length < 6) { out.push(line); continue; }
      if (!headerParsed) { headerParsed = true; out.push(line); continue; }
      const scriptName = cols[0].replace(/`/g, '');
      const layer = layers.get(scriptName) ?? 'L0+L1';
      if (layer === 'L0') { removed++; continue; }
    }
    out.push(line);
  }

  const rewritten = out.join('\n')
    .replace(
      '> This file is the Single Source of Truth (Tier 1 SSOT) for all scripts in `scripts/` (workspace root).\n' +
      '> Template `templates/common/scripts/` (Tier 2) is a snapshot published from here via `bun run propagate:apply`.\n' +
      '> Project `scripts/` (Tier 3) is a snapshot created from Tier 2 at `new-project` time.',
      '> This file is a **project-level snapshot** (Tier 3) of the scripts that were scaffolded\n' +
      '> from the common template. L0-only entries have been stripped.\n' +
      '> For the authoritative registry, see the workspace root `scripts/SCRIPTS.md`.'
    )
    .replace(
      '*SCRIPTS.md maintained by: workspace maintainer (L0 SSOT)*',
      '*SCRIPTS.md — project snapshot (auto-generated at scaffold time)*'
    );

  return { content: rewritten, removed };
}

/**
 * Minimal inline parser — mirrors parseScriptLayers() but works on content
 * string instead of file path, for test isolation.
 */
function parseScriptLayersFromContent(mdContent: string): Map<string, string> {
  const lines = mdContent.split('\n');
  const layers = new Map<string, string>();
  let inRegistry = false;
  let headerParsed = false;

  for (const line of lines) {
    if (/^## Registry/.test(line)) { inRegistry = true; headerParsed = false; continue; }
    if (inRegistry && /^## /.test(line)) break;
    if (!inRegistry) continue;
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || trimmed.startsWith('|-')) continue;
    const cols = trimmed.split('|').slice(1, -1).map((c) => c.trim());
    if (!headerParsed) { headerParsed = true; continue; }
    if (cols.length < 6) continue;
    const scriptName = cols[0].replace(/`/g, '');
    const layer = cols[6] || 'L0+L1';
    layers.set(scriptName, layer);
  }

  return layers;
}

describe('SCRIPTS.md L2 row filtering', () => {
  beforeEach(() => {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
    fs.mkdirSync(scratchRoot, { recursive: true });
  });

  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('strips all L0-only rows from SCRIPTS.md', () => {
    const { content, removed } = filterScriptsMdForL2(SAMPLE_SCRIPTS_MD);

    // 3 L0-only entries: new-project.ts, create-l2-scaffold.ts, helpers/layer-filter.ts
    expect(removed).toBe(3);

    // L0-only scripts must NOT appear in the filtered content
    expect(content).not.toContain('new-project.ts');
    expect(content).not.toContain('create-l2-scaffold.ts');
    expect(content).not.toContain('helpers/layer-filter.ts');

    // L0+L1 scripts must still be present
    expect(content).toContain('audit.ts');
    expect(content).toContain('dev-sync.ts');
    expect(content).toContain('helpers/extends-validator.ts');
    expect(content).toContain('hooks/pre-commit.ts');
    expect(content).toContain('verify-scripts.ts');
  });

  test('rewrites header to project snapshot context', () => {
    const { content } = filterScriptsMdForL2(SAMPLE_SCRIPTS_MD);

    // Must NOT contain SSOT header
    expect(content).not.toContain('Single Source of Truth (Tier 1 SSOT)');
    expect(content).not.toContain('workspace maintainer (L0 SSOT)');

    // Must contain project snapshot header
    expect(content).toContain('project-level snapshot');
    expect(content).toContain('auto-generated at scaffold time');
  });

  test('preserves non-registry sections (Guide, comments)', () => {
    const { content } = filterScriptsMdForL2(SAMPLE_SCRIPTS_MD);

    expect(content).toContain('## Guide');
    expect(content).toContain('Some guide content here');
  });

  test('round-trip: parseScriptLayers returns correct layer values', () => {
    const mdPath = path.join(scratchRoot, 'SCRIPTS.md');
    fs.writeFileSync(mdPath, SAMPLE_SCRIPTS_MD, 'utf-8');

    const layers = parseScriptLayers(mdPath);

    expect(layers.get('audit.ts')).toBe('L0+L1');
    expect(layers.get('new-project.ts')).toBe('L0');
    expect(layers.get('create-l2-scaffold.ts')).toBe('L0');
    expect(layers.get('helpers/layer-filter.ts')).toBe('L0');
    expect(layers.get('verify-scripts.ts')).toBe('L0+L1');
  });
});
