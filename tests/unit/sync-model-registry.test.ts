/**
 * sync-model-registry.ts pure-part tests (T-20261011-015)
 * @version 1.0.0
 *
 * Covers the pure surfaces behind the model-migration skill's sweep tool:
 * surface-list completeness against the actual repo files, schema parsing,
 * migration-validation refusals, content sweeps, and the Check MM skills-tree
 * scan — against /tmp fixtures so no tracked file is touched.
 */

import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SURFACES,
  VARIANT_AGENTS_GLOB,
  resolveSurfaces,
  parseSchemaModels,
  validateMigration,
  sweepContent,
  scanSkillsTreesForModelLiterals,
} from '../../scripts/sync-model-registry.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');

describe('SURFACES completeness against the actual repo', () => {
  test('every resolved surface exists on disk', () => {
    const missing = resolveSurfaces(REPO_ROOT).filter((rel) => !existsSync(join(REPO_ROOT, rel)));
    expect(missing).toEqual([]);
  });

  test('the variant glob covers every templates/<variant>/AGENTS.md on disk', () => {
    const templatesDir = join(REPO_ROOT, 'templates');
    const onDisk = readdirSync(templatesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith('co-'))
      .map((e) => join('templates', e.name, 'AGENTS.md').replace(/\\/g, '/'));
    const resolved = resolveSurfaces(REPO_ROOT);
    for (const rel of onDisk) {
      expect(resolved).toContain(rel);
    }
    // Sanity: the workspace currently ships 14 variants.
    expect(onDisk.length).toBe(14);
    expect(VARIANT_AGENTS_GLOB).toBe('templates/*/AGENTS.md');
  });

  test('every literal-bearing sanctioned prose file is a resolved surface', () => {
    // Files that may keep literals outside the sweep: the registry itself,
    // historical records, scripts' own code and registry history columns
    // (root + L1 mirror), skills trees (Check MM's jurisdiction), test
    // fixtures, generated handbooks, and the orchestrator-owned dirs. Tests
    // are exempt as a class — the only test that is a sweep target is listed
    // in SURFACES (tests/unit/managed-block-parity.test.ts) and its presence
    // is asserted by the existence test above. docs/decisions/ holds
    // historical decision records — same provenance class as docs/adr/ and
    // docs/designs/ (they quote source material verbatim). docs/skill-graph
    // .json/.md are generated projections regenerated from SSOTs — renames
    // propagate via regeneration, not sweeping.
    const EXEMPT_PREFIXES = [
      'skills/',
      '.claude/', '.gemini/', '.agents/', '.codex/', '.hermes/',
      'scripts/',
      'templates/common/scripts/',
      'templates/common/docs/workspace-schema.json',
      'docs/adr/', 'docs/designs/', 'docs/decisions/', 'docs/archive/', 'docs/lifecycle/', 'docs/specs/', 'docs/_examples/',
      'CHANGELOG.md',
      'docs/workspace-schema.json',
      // Generated projections — regenerated from SSOTs; renames propagate via regeneration, not sweeping.
      'docs/skill-graph.json',
      'docs/skill-graph.md',
      // Generated projection (generate-version-manifest.ts): since the agent-mirror
      // sweep (spec 2026-10-28-platform-agent-mirror, DEC-20261028-06) the Agents
      // table Model column renders registry-resolved IDs, so the manifest bears
      // model literals by generation — never hand-managed prose.
      'docs/VERSION_MANIFEST.md',
      'tests/',
      'Handbooks/',
      'Projects/', 'services/', 'memory/', 'tickets/', 'node_modules/',
    ];
    const PATTERN = /\b(?:claude-(?:opus|sonnet|haiku)-\d+-\d+|gemini-[\d.]+-(?:pro|flash)|gpt-5\.\d-(?:sol|terra|luna))\b/i;
    const TEXT_EXT = /\.(md|markdown|txt|json|jsonc|yaml|yml|html|htm|ts|js|mjs|cjs|css|svg)$/i;
    const literalFiles: string[] = [];
    const walk = (dir: string, rel: string, depth: number): void => {
      if (depth > 8) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isSymbolicLink() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (EXEMPT_PREFIXES.some((p) => childRel === p.replace(/\/$/, '') || childRel.startsWith(p))) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full, childRel, depth + 1);
        } else if (TEXT_EXT.test(entry.name) && PATTERN.test(readContent(full))) {
          literalFiles.push(childRel);
        }
      }
    };
    walk(REPO_ROOT, '', 0);
    const resolved = new Set(resolveSurfaces(REPO_ROOT));
    const uncovered = literalFiles.filter((rel) => !resolved.has(rel));
    expect(uncovered).toEqual([]);
  });

  test('SURFACES has no duplicates', () => {
    expect(new Set(SURFACES).size).toBe(SURFACES.length);
  });
});

function readContent(path: string): string {
  try {
    return require('node:fs').readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

describe('parseSchemaModels', () => {
  test('flattens models.* values and dedupes shared IDs', () => {
    const schema = JSON.stringify({
      models: {
        claude: { high: 'claude-opus-5-5', medium: 'claude-sonnet-5-5', low: 'claude-haiku-5-5' },
        gemini: { high: 'gemini-3.1-pro', medium: 'gemini-3.8-flash', low: 'gemini-3.8-flash' },
      },
    });
    expect(parseSchemaModels(schema)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'gemini-3.1-pro', 'gemini-3.8-flash']);
  });

  test('a schema without models yields an empty list', () => {
    expect(parseSchemaModels('{}')).toEqual([]);
  });
});

describe('validateMigration refusals', () => {
  const registry = ['claude-opus-5-5', 'claude-sonnet-5-5', 'gemini-3.8-flash'];

  test('refuses when --to is not registered in the schema', () => {
    expect(validateMigration('gemini-3.8-flash', 'gemini-9.9-pro', registry)).toContain('not registered');
  });

  test('refuses an identical --from/--to pair', () => {
    expect(validateMigration('gemini-3.8-flash', 'gemini-3.8-flash', registry)).toContain('identical');
  });

  test('refuses an unregistered --from (stale sweep or typo)', () => {
    expect(validateMigration('gemini-2.5-flash', 'claude-sonnet-5-5', registry)).toContain('stale sweep');
  });

  test('refuses missing arguments', () => {
    expect(validateMigration('', 'claude-opus-5-5', registry)).toContain('required');
  });

  test('accepts a well-formed migration', () => {
    expect(validateMigration('gemini-3.8-flash', 'claude-opus-5-5', registry)).toBeNull();
  });
});

describe('sweepContent', () => {
  test('replaces every occurrence and reports the count', () => {
    const out = sweepContent('a gemini-3.8-flash b gemini-3.8-flash c', 'gemini-3.8-flash', 'gemini-4.0-flash');
    expect(out.count).toBe(2);
    expect(out.content).toBe('a gemini-4.0-flash b gemini-4.0-flash c');
  });

  test('a file without the old ID is untouched with count 0', () => {
    const out = sweepContent('no models here', 'gemini-3.8-flash', 'gemini-4.0-flash');
    expect(out).toEqual({ content: 'no models here', count: 0 });
  });
});

describe('scanSkillsTreesForModelLiterals', () => {
  test('reports a literal planted in a fixture skills tree (/tmp)', () => {
    const root = mkdtempSync(join(tmpdir(), 'sync-model-registry-'));
    try {
      mkdirSync(join(root, 'skills', 'some-skill', 'references'), { recursive: true });
      writeFileSync(join(root, 'skills', 'some-skill', 'SKILL.md'), 'clean alias `opus`\n');
      writeFileSync(join(root, 'skills', 'some-skill', 'references', 'bad.md'), 'claude-opus-5-5\n');
      mkdirSync(join(root, 'templates', 'co-fixture', 'skills', 'v-skill'), { recursive: true });
      writeFileSync(join(root, 'templates', 'co-fixture', 'skills', 'v-skill', 'SKILL.md'), 'gemini-3.8-flash\n');
      mkdirSync(join(root, 'docs'), { recursive: true });

      const hits = scanSkillsTreesForModelLiterals(root);
      expect(hits.length).toBe(2);
      const literalSets = hits.map((h) => h.literals).sort();
      expect(literalSets).toEqual([['claude-opus-5-5'], ['gemini-3.8-flash']].map((l) => l.sort()));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('the real workspace skills trees are clean', () => {
    expect(scanSkillsTreesForModelLiterals(REPO_ROOT)).toEqual([]);
  });
});
