/**
 * Unit tests for the SCHEMA_MERGE delivery policy (spec
 * docs/designs/2026-10-31-workspace-schema-merge-delivery-design.md): the
 * merge-aware delivery for docs/workspace-schema.json that unblocks the
 * co-price 0.22.1→0.25.0 and co-architect 0.23.0→0.25.0 upgrade halts.
 *
 * Covers the design's 8 validation fixtures (§5):
 *   1. co-price real shape — 131-entry designLint allowlist + tokenSources +
 *      allowlist_reason preserved, platform_surfaces/routeAudit land,
 *      version updates, TEMPLATE_DELTA names the withheld leaves.
 *   2. co-architect shape — 122-entry allowlist preserved, metadata updated.
 *   3. Template-adds-only — merged equals the new template.
 *   4. Project-adds-only — a project-only top-level block survives verbatim.
 *   5. Shared-block template-only key lands.
 *   6. Idempotency — double merge is a fixed point (deep + byte equality).
 *   7. Malformed JSON on either side — explicit error, no output.
 *   8. Serialization — stable key order, 2-space indent, trailing newline,
 *      valid JSON.
 *
 * Fixtures replicate the real conflict shape (evidence: /tmp/coprice-wss-conflict.diff,
 * 310 lines) synthetically so the suite stays hermetic — the real project copies
 * change on apply, and tests must not read Projects/.
 *
 * @version 1.0.0
 */
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect, afterAll } from 'bun:test';
import {
  SCHEMA_MERGE_FILE,
  SCHEMA_TEMPLATE_OWNED_KEYS,
  TEMPLATE_TREE_SYNC_PASS,
  DECISION_SEVERITY_CONTRACT,
  isDeliveryPolicy,
  mergeWorkspaceSchemaData,
  mergeWorkspaceSchemaJson,
  resolveClaim,
} from '../../scripts/lib/upgrade-policy.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

// ── Fixtures: the real conflict shape (co-price evidence diff) ────────────────

/** Synthetic 131-entry designLint allowlist (co-price carries exactly this count). */
const coPriceAllowlist = Array.from({ length: 131 }, (_, i) => `src/app/generated/token-${String(i).padStart(3, '0')}.css`);
/** Synthetic 122-entry designLint allowlist (co-architect's count). */
const coArchitectAllowlist = Array.from({ length: 122 }, (_, i) => `src/generated/pattern-${String(i).padStart(3, '0')}.ts`);

/** Template 0.25.0 copy (schema v1.7.0): adds routeAudit + platform_surfaces,
 *  reshapes designLint (playground scanRoot, empty allowlist) and models. */
const TEMPLATE_V170 = {
  $schema: './workspace-schema.schema.json',
  version: '1.7.0',
  description: 'Fleet workspace schema — registries, gates, and tripwires (template-managed)',
  workflow: { phases: ['explore', 'plan', 'build', 'sync'] },
  models: { pm: 'claude-opus-5-5', worker: 'claude-sonnet-5-5' },
  designLint: {
    enabled: true,
    scanRoots: ['templates/co-design/playground/src'],
    allowlist: [],
    description: 'Design-lint gate config (template seed — project copies evolve their allowlist)',
  },
  routeAudit: { protectedRoutes: ['docs/workspace-schema.json'], tripwires: [] },
  platform_surfaces: { claude: { mirror: '.claude', skills: true } },
};

/** co-price project copy (schema v1.6.0): the committed token-debt mitigation
 *  in designLint (scanRoots ["src"], tokenSources, 131-entry allowlist +
 *  allowlist_reason); no routeAudit, no platform_surfaces. */
const PROJECT_COPRICE_V160 = {
  $schema: './workspace-schema.schema.json',
  version: '1.6.0',
  description: 'Fleet workspace schema — registries, gates, and tripwires (project-local note)',
  workflow: { phases: ['explore', 'plan', 'build', 'sync'] },
  models: { pm: 'claude-opus-4-1', worker: 'claude-sonnet-4-5' },
  designLint: {
    enabled: true,
    scanRoots: ['src'],
    tokenSources: ['src/app/tokens.css'],
    allowlist: coPriceAllowlist,
    allowlist_reason: 'token-debt mitigation T-20261028-016 — generated token files lint-exempt',
    description: 'co-price design-lint config',
  },
};

/** co-architect project copy (v1.7.0-shaped): platform_surfaces already
 *  received, routeAudit absent, a 122-entry designLint allowlist. */
const PROJECT_COARCHITECT = {
  $schema: './workspace-schema.schema.json',
  version: '1.7.0',
  description: 'Fleet workspace schema — registries, gates, and tripwires (template-managed)',
  workflow: { phases: ['explore', 'plan', 'build', 'sync'] },
  models: { pm: 'claude-opus-5-5', worker: 'claude-sonnet-5-5' },
  designLint: {
    enabled: true,
    scanRoots: ['src'],
    allowlist: coArchitectAllowlist,
    description: 'co-architect design-lint config',
  },
  platform_surfaces: { claude: { mirror: '.claude', skills: true } },
};

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ── Fixture 0: the claim contract (design acceptance criterion 1) ─────────────

describe('SCHEMA_MERGE claim', () => {
  test('docs/workspace-schema.json resolves to SCHEMA_MERGE via TEMPLATE TREE SYNC', () => {
    expect(resolveClaim(SCHEMA_MERGE_FILE)).toEqual({ policy: 'SCHEMA_MERGE', pass: TEMPLATE_TREE_SYNC_PASS });
  });

  test('SCHEMA_MERGE is a delivery policy; it claims exactly one file', () => {
    expect(isDeliveryPolicy('SCHEMA_MERGE')).toBe(true);
    expect(SCHEMA_MERGE_FILE).toBe('docs/workspace-schema.json');
  });

  test('TEMPLATE_DELTA joins the severity contract at INFO default (WARN via override)', () => {
    expect(DECISION_SEVERITY_CONTRACT.TEMPLATE_DELTA).toBe('INFO');
  });

  test('metadata scalars are the template-owned key set', () => {
    expect([...SCHEMA_TEMPLATE_OWNED_KEYS]).toEqual(['$schema', 'version', 'description']);
  });
});

// ── Fixture 1: co-price real shape ─────────────────────────────────────────────

describe('fixture 1 — co-price 131-entry allowlist shape', () => {
  const result = mergeWorkspaceSchemaData(deepClone(TEMPLATE_V170), deepClone(PROJECT_COPRICE_V160));

  test('schema version updates to the template value', () => {
    expect((result.merged as Record<string, unknown>).version).toBe('1.7.0');
  });

  test('template-ADDED blocks (platform_surfaces, routeAudit) land deep-equal to the template', () => {
    expect(result.landed).toContain('platform_surfaces');
    expect(result.landed).toContain('routeAudit');
    expect(result.merged.platform_surfaces).toEqual(TEMPLATE_V170.platform_surfaces);
    expect(result.merged.routeAudit).toEqual(TEMPLATE_V170.routeAudit);
  });

  test('designLint is preserved byte-value-identical (all 6 project keys, arrays atomic)', () => {
    expect(result.merged.designLint).toEqual(PROJECT_COPRICE_V160.designLint);
    expect(result.merged.designLint).not.toEqual(TEMPLATE_V170.designLint);
    // Atomic arrays: the template's playground scanRoot must NOT be appended/unioned.
    expect((result.merged.designLint as Record<string, unknown>).scanRoots).toEqual(['src']);
    expect((result.merged.designLint as Record<string, unknown>).tokenSources).toEqual(['src/app/tokens.css']);
    expect(((result.merged.designLint as Record<string, unknown>).allowlist as string[])).toHaveLength(131);
  });

  test('no project-only top-level keys exist (nothing preserved at the top level)', () => {
    expect(result.preserved).toEqual([]);
  });

  test('TEMPLATE_DELTA names designLint.scanRoots, designLint.allowlist, designLint.description at WARN', () => {
    const byPath = new Map(result.templateDeltas.map((d) => [d.path, d]));
    for (const p of ['designLint.scanRoots', 'designLint.allowlist', 'designLint.description']) {
      expect(byPath.has(p)).toBe(true);
      expect(byPath.get(p)!.severity).toBe('WARN');
    }
    // The withheld values name both sides (truncated summary, deterministic JSON).
    expect(byPath.get('designLint.scanRoots')!.project).toBe('["src"]');
    expect(byPath.get('designLint.allowlist')!.template).toBe('[]');
    // Reshaped scalars (models) are withheld too — project-wins everywhere.
    expect(byPath.has('models.pm')).toBe(true);
    // Leaves that LAND (metadata scalars, template-added blocks) never produce deltas.
    expect(byPath.has('version')).toBe(false);
    expect(byPath.has('description')).toBe(false);
  });
});

// ── Fixture 2: co-architect shape ─────────────────────────────────────────────

describe('fixture 2 — co-architect 122-entry allowlist shape', () => {
  const result = mergeWorkspaceSchemaData(deepClone(TEMPLATE_V170), deepClone(PROJECT_COARCHITECT));

  test('metadata stays at the template value (already v1.7.0)', () => {
    expect((result.merged as Record<string, unknown>).version).toBe('1.7.0');
  });

  test('routeAudit (the only template-added block) lands', () => {
    expect(result.landed).toEqual(['routeAudit']);
    expect(result.merged.routeAudit).toEqual(TEMPLATE_V170.routeAudit);
  });

  test('122-entry allowlist preserved; shared platform_surfaces block untouched', () => {
    expect(((result.merged.designLint as Record<string, unknown>).allowlist as string[])).toHaveLength(122);
    expect(result.merged.platform_surfaces).toEqual(PROJECT_COARCHITECT.platform_surfaces);
  });

  test('TEMPLATE_DELTA covers the withheld designLint reshapes', () => {
    const paths = result.templateDeltas.map((d) => d.path);
    expect(paths).toContain('designLint.scanRoots');
    expect(paths).toContain('designLint.allowlist');
    expect(paths).toContain('designLint.description');
  });
});

// ── Fixture 3: template-adds-only ─────────────────────────────────────────────

describe('fixture 3 — template-adds-only lands the whole template', () => {
  const priorTemplate = {
    $schema: './workspace-schema.schema.json',
    version: '1.6.0',
    description: 'prior',
    shared: { a: 1, b: [1, 2] },
    keep: true,
  };
  const newTemplate = {
    ...deepClone(priorTemplate),
    version: '1.7.0',
    added: { fresh: 'block', nested: { x: [9] } },
  };
  const result = mergeWorkspaceSchemaData(deepClone(newTemplate), deepClone(priorTemplate));

  test('merged equals the new template (no TEMPLATE_DELTA, nothing preserved)', () => {
    expect(result.merged).toEqual(newTemplate);
    expect(result.templateDeltas).toEqual([]);
    expect(result.preserved).toEqual([]);
  });

  test('the added block is reported as landed', () => {
    expect(result.landed).toEqual(['added']);
  });
});

// ── Fixture 4: project-adds-only ──────────────────────────────────────────────

describe('fixture 4 — project-only top-level block survives verbatim', () => {
  const project = {
    ...deepClone(TEMPLATE_V170),
    experimental: { probes: [1, 2, 3], note: 'co-price experiment' },
  };
  const result = mergeWorkspaceSchemaData(deepClone(TEMPLATE_V170), deepClone(project));

  test('the project-only block is preserved untouched and reported', () => {
    expect(result.merged.experimental).toEqual(project.experimental);
    expect(result.preserved).toEqual(['experimental']);
    expect(result.templateDeltas).toEqual([]);
    expect(result.landed).toEqual([]);
  });
});

// ── Fixture 5: shared-block template-only key lands ──────────────────────────

describe('fixture 5 — template-only key inside a shared block lands', () => {
  const template = {
    version: '1.7.0',
    block: { existing: 'project-value', newKey: 'template-addition', nested: { a: 1, deeper: { k: 'v' } } },
  };
  const project = {
    version: '1.6.0',
    block: { existing: 'project-value', nested: { a: 1 } },
  };
  const result = mergeWorkspaceSchemaData(deepClone(template), deepClone(project));

  test('the template-only leaf and nested subtree reach the merged output', () => {
    expect(result.merged.block).toEqual({
      existing: 'project-value',
      newKey: 'template-addition',
      nested: { a: 1, deeper: { k: 'v' } },
    });
  });

  test('existing leaves stay project-won; landing keys never delta', () => {
    // `version` is template-owned metadata (lands), `newKey`/`nested.deeper` are
    // template-only (land), `existing` is equal — nothing is withheld.
    expect(result.templateDeltas).toEqual([]);
    expect(result.landed).toEqual([]);
  });
});

// ── Fixture 6: idempotency — double merge is a fixed point ───────────────────

describe('fixture 6 — idempotency (design §4 fixed point)', () => {
  const first = mergeWorkspaceSchemaData(deepClone(TEMPLATE_V170), deepClone(PROJECT_COPRICE_V160));
  const second = mergeWorkspaceSchemaData(deepClone(TEMPLATE_V170), deepClone(first.merged));

  test('merge(merge(T, P), T) deep-equals merge(T, P)', () => {
    expect(second.merged).toEqual(first.merged);
  });

  test('the fixed point holds byte-for-byte (key order stable)', () => {
    expect(JSON.stringify(second.merged)).toBe(JSON.stringify(first.merged));
  });

  test('delta reporting is stable across the second merge', () => {
    expect(second.templateDeltas).toEqual(first.templateDeltas);
    expect(second.landed).toEqual([]);
    expect(second.preserved).toEqual([]);
  });
});

// ── Fixture 7: malformed JSON hard-fails ──────────────────────────────────────

describe('fixture 7 — malformed JSON on either side throws (no silent output)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wss-merge-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('malformed project JSON throws an explicit error', () => {
    const tpl = join(dir, 'tpl-ok.json');
    const proj = join(dir, 'proj-bad.json');
    writeFileSync(tpl, JSON.stringify(TEMPLATE_V170), 'utf8');
    writeFileSync(proj, '{ "version": "1.6.0", oops }', 'utf8');
    expect(() => mergeWorkspaceSchemaJson(proj, tpl)).toThrow(/workspace-schema|JSON|object/i);
  });

  test('malformed template JSON throws an explicit error', () => {
    const tpl = join(dir, 'tpl-bad.json');
    const proj = join(dir, 'proj-ok.json');
    writeFileSync(tpl, 'not json at all', 'utf8');
    writeFileSync(proj, JSON.stringify(PROJECT_COPRICE_V160), 'utf8');
    expect(() => mergeWorkspaceSchemaJson(proj, tpl)).toThrow();
  });

  test('non-object JSON on either side throws (SCHEMA_MERGE never guesses)', () => {
    expect(() => mergeWorkspaceSchemaData([1, 2], { version: '1.0.0' })).toThrow(/template/i);
    expect(() => mergeWorkspaceSchemaData({ version: '1.0.0' }, 'string')).toThrow(/project/i);
    expect(() => mergeWorkspaceSchemaData(null, { version: '1.0.0' })).toThrow(/template/i);
  });
});

// ── Fixture 8: serialization stability ────────────────────────────────────────

describe('fixture 8 — serialization: stable key order, 2-space indent, trailing newline', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wss-merge-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  test('file-level merge output is valid JSON with house serialization', () => {
    const tpl = join(dir, 'tpl.json');
    const proj = join(dir, 'proj.json');
    writeFileSync(tpl, JSON.stringify(TEMPLATE_V170), 'utf8');
    writeFileSync(proj, JSON.stringify(PROJECT_COPRICE_V160), 'utf8');
    const result = mergeWorkspaceSchemaJson(proj, tpl);

    expect(result.changed).toBe(true);
    expect(result.merged.endsWith('\n')).toBe(true);
    expect(result.merged.endsWith('\n\n')).toBe(false);
    const reparsed = JSON.parse(result.merged);
    expect(reparsed.version).toBe('1.7.0');
    expect(reparsed.designLint.allowlist).toHaveLength(131);
    // 2-space indent is visible in the body (a nested key line starts with two spaces).
    expect(result.merged.split('\n').some((l) => l.startsWith('  "'))).toBe(true);
  });

  test('key order follows the project copy; template-added keys append in template order', () => {
    const tpl = join(dir, 'tpl.json');
    const proj = join(dir, 'proj.json');
    writeFileSync(tpl, JSON.stringify(TEMPLATE_V170), 'utf8');
    writeFileSync(proj, JSON.stringify(PROJECT_COPRICE_V160), 'utf8');
    const { merged } = mergeWorkspaceSchemaJson(proj, tpl);
    const keys = Object.keys(JSON.parse(merged));
    expect(keys).toEqual([...Object.keys(PROJECT_COPRICE_V160), 'routeAudit', 'platform_surfaces']);
  });

  test('re-running the merge on the merged output is byte-identical (changed=false)', () => {
    const tpl = join(dir, 'tpl.json');
    const proj = join(dir, 'proj.json');
    const proj2 = join(dir, 'proj2.json');
    writeFileSync(tpl, JSON.stringify(TEMPLATE_V170), 'utf8');
    writeFileSync(proj, JSON.stringify(PROJECT_COPRICE_V160), 'utf8');
    const first = mergeWorkspaceSchemaJson(proj, tpl);
    writeFileSync(proj2, first.merged, 'utf8');
    const second = mergeWorkspaceSchemaJson(proj2, tpl);
    expect(second.changed).toBe(false);
    expect(second.merged).toBe(first.merged);
    expect(second.templateDeltas).toEqual(first.templateDeltas);
  });

  test('key-order-only differences between equal blocks are not false deltas', () => {
    const reordered = {
      designLint: { description: 'x', enabled: true, scanRoots: ['src'], allowlist: ['a'] },
      models: { pm: 'm1' },
      version: '1.6.0',
    };
    const template = {
      version: '1.7.0',
      models: { pm: 'm1' },
      designLint: { enabled: true, scanRoots: ['src'], allowlist: ['a'], description: 'x' },
    };
    const result = mergeWorkspaceSchemaData(deepClone(template), deepClone(reordered));
    // Only the metadata `version` divergence is reported (it lands, so actually zero deltas).
    expect(result.templateDeltas).toEqual([]);
  });
});
