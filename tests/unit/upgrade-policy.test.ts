/**
 * Unit tests for scripts/lib/upgrade-policy.ts (2026-09-11-upgrade-policy-coverage-design.md):
 * claim resolution per policy, settings JSON merge semantics, and the drift guard that keeps
 * the lib's mirrored pass inventories in lockstep with scripts/upgrade-project.ts literals
 * (the script is a top-level executable and cannot be imported).
 *
 * v1.1.0 (2026-09-24, platform-parity P1 bug 4 — spec
 *         2026-09-24-platform-parity-p1-bugfixes-design.md D4/D8): CODEX.md
 *         joins MERGE_MANAGED_FILES — resolveClaim('CODEX.md') must return
 *         { policy: 'MERGE_MANAGED', pass: 'MERGE' } so the TEMPLATE TREE SYNC
 *         pass never wholesale-overwrites a project CODEX.md again (the MERGE
 *         pass, which already lists CODEX.md, becomes the sole delivery channel).
 *
 * v1.2.0 (2026-09-25, T-20260924-011 — spec
 *         2026-09-25-codex-merge-claim-routing-design.md D4 row 3): pins the
 *         claim contract the VARIANT ASSET DIRS pass filter relies on —
 *         procedures/** resolves ADD_IF_MISSING/PROCEDURES (the dedicated
 *         pass owns it), generic asset dirs resolve SYNC/VARIANT ASSET DIRS,
 *         and the exported VARIANT_ASSET_DIRS_PASS constant matches the
 *         resolveClaim pass id (TEMPLATE_TREE_SYNC_PASS precedent).
 *
 * v1.3.0 (2026-09-25, T-20260924-003 — spec
 *         docs/designs/2026-09-25-inventory-decisions-batch-design.md R2.4):
 *         pins isExtendsStub — true on the 13 variant i18n-specialist.md stubs
 *         and the 13 pm.md stubs (real template files), false on full bodies,
 *         frontmatter without extends:, and prose mentions outside frontmatter.
 *
 * @version 1.3.0
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, test, expect } from 'bun:test';
import {
  TEMPLATE_TREE_SYNC_PASS,
  VARIANT_ASSET_DIRS_PASS,
  GOVERNANCE_FILES,
  PLACEHOLDER_ALLOWLIST,
  SCAFFOLD_COMMON_OWNED_FILES,
  isExtendsStub,
  mergeSettingsData,
  mergeSettingsJson,
  resolveClaim,
} from '../../scripts/lib/upgrade-policy.ts';
import { readFileSync } from 'node:fs';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const VARIANT = 'co-develop';

describe('upgrade-policy resolveClaim — dedicated passes keep their paths', () => {
  test('LOCKED', () => {
    for (const rel of ['.githooks/pre-commit', '.gitattributes', '.gitleaks.toml']) {
      expect(resolveClaim(rel, VARIANT)).toEqual({ policy: 'LOCKED', pass: 'LOCKED' });
    }
  });

  test('MERGE_MANAGED (platform + gitignore + pm.md + AGENTS.md)', () => {
    for (const rel of ['CLAUDE.md', 'GEMINI.md', 'CODEX.md', '.gitignore', 'AGENTS.md', 'agents/pm.md']) {
      expect(resolveClaim(rel, VARIANT).policy).toBe('MERGE_MANAGED');
    }
  });

  test('CODEX.md claim is MERGE_MANAGED/MERGE (P1 bug 4 — tree-sync overwrite path is dead)', () => {
    // Design D4: resolveClaim('CODEX.md') must hit the MERGE_MANAGED_FILES set
    // (pass 'MERGE') — NOT the blanket root-file SYNC fallback that made the
    // TEMPLATE TREE SYNC pass destroy every project edit to CODEX.md.
    expect(resolveClaim('CODEX.md', 'co-design')).toEqual({ policy: 'MERGE_MANAGED', pass: 'MERGE' });
    expect(resolveClaim('CODEX.md', VARIANT)).toEqual({ policy: 'MERGE_MANAGED', pass: 'MERGE' });
  });

  test('variant context file is DOCS_MERGE, parameterized by variant', () => {
    expect(resolveClaim(`docs/${VARIANT}.context.md`, VARIANT))
      .toEqual({ policy: 'MERGE_MANAGED', pass: 'DOCS_MERGE' });
    expect(resolveClaim('docs/co-news.context.md', VARIANT).pass).toBe(TEMPLATE_TREE_SYNC_PASS);
  });

  test('OVERWRITE (phase-definitions, security)', () => {
    expect(resolveClaim('docs/phase-definitions.md', VARIANT).policy).toBe('OVERWRITE');
    expect(resolveClaim('docs/security.md', VARIANT).policy).toBe('OVERWRITE');
  });

  test('former VARIANT_DOCS_SYNC inventory falls through to the default SYNC policy (folded v1.22.0)', () => {
    for (const rel of [
      'docs/context.md',
      'docs/engagement-orchestration.md',
      'docs/team-configuration-guide.md',
      'docs/privacy-design-checklist.md',
      'docs/privacy-design-checklist_ko.md',
    ]) {
      expect(resolveClaim(rel, VARIANT)).toEqual({ policy: 'SYNC', pass: TEMPLATE_TREE_SYNC_PASS });
    }
  });

  test('HASH_SYNC for platform commands', () => {
    expect(resolveClaim('.claude/commands/sync.md', VARIANT)).toEqual({ policy: 'HASH_SYNC', pass: 'COMMANDS_SYNC' });

    // ADR-0077 W4: codex platform mirrors must be claimed BEFORE the blanket
    // .codex/** ADD_IF_MISSING rule — otherwise fleet mirrors never receive updates.
    // Since T-20260921-009 (ADR-0085 D2) they ride the sync-skills mirror pass like
    // .claude/.gemini/.agents so l2_propagate:false skills are not re-delivered.
    expect(resolveClaim('.codex/skills/demo-skill/SKILL.md', VARIANT)).toEqual({ policy: 'SYNC', pass: 'sync-skills.ts (platform mirror)' });
    expect(resolveClaim('.codex/prompts/sync.md', VARIANT)).toEqual({ policy: 'SYNC', pass: 'sync-skills.ts (platform mirror)' });
    // per-project Codex config stays seed-only
    expect(resolveClaim('.codex/config.toml', VARIANT)).toEqual({ policy: 'ADD_IF_MISSING', pass: TEMPLATE_TREE_SYNC_PASS });
    expect(resolveClaim('.gemini/commands/memlog.md', VARIANT)).toEqual({ policy: 'HASH_SYNC', pass: 'COMMANDS_SYNC' });
  });

  test('ADD_IF_MISSING: governance files and procedures', () => {
    for (const rel of GOVERNANCE_FILES) {
      expect(resolveClaim(rel, VARIANT)).toEqual({ policy: 'ADD_IF_MISSING', pass: 'GOVERNANCE FILES' });
    }
    expect(resolveClaim('procedures/some-flow/PROBLEM.md', VARIANT)).toEqual({ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' });
  });

  test('REGENERATED files are generated in-project', () => {
    for (const rel of ['docs/skill-graph.json', '.claude/template-version.txt', 'docs/VERSION_MANIFEST.md']) {
      expect(resolveClaim(rel, VARIANT).policy).toBe('REGENERATED');
    }
  });

  test('agents/skills/scripts stay with the SYNC_IF_NEWER passes', () => {
    expect(resolveClaim('agents/architect.md', VARIANT).pass).toBe('SYNC_IF_NEWER: agents/');
    expect(resolveClaim('skills/whatever/SKILL.md', VARIANT).pass).toBe('SYNC_IF_NEWER: skills/');
    expect(resolveClaim('scripts/tooling.ts', VARIANT).pass).toBe('SYNC_IF_NEWER: scripts/');
  });

  test('platform skill mirrors belong to the post-upgrade sync-skills run', () => {
    expect(resolveClaim('.claude/skills/sync/SKILL.md', VARIANT).pass).toBe('sync-skills.ts (platform mirror)');
    expect(resolveClaim('.agents/skills/meeting-facilitation/SKILL.md', VARIANT).pass).toBe('sync-skills.ts (platform mirror)');
  });

  test('other top-level variant dirs stay with VARIANT ASSET DIRS', () => {
    expect(resolveClaim('workflows/ehs/x.yaml', VARIANT)).toEqual({ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' });
  });
});

// ── T-20260924-011 claim-contract pins (spec 2026-09-25-codex-merge-claim-routing-design D4 row 3) ──
// These pass on the unmodified claim table by design: they pin the contract the
// VARIANT ASSET DIRS pass filter (upgrade-project.ts) relies on, not a regression.
describe('upgrade-policy resolveClaim — VARIANT ASSET DIRS pass contract (T-20260924-011 pins)', () => {
  test('procedures/** (nested) resolves to the dedicated PROCEDURES pass — ADD_IF_MISSING', () => {
    expect(resolveClaim('procedures/x/y.md', VARIANT)).toEqual({ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' });
    expect(resolveClaim('procedures/architecture-design/schema.yaml', VARIANT))
      .toEqual({ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' });
    expect(resolveClaim('procedures/_output-types.yaml', VARIANT))
      .toEqual({ policy: 'ADD_IF_MISSING', pass: 'PROCEDURES' });
  });

  test('generic asset dirs resolve to the VARIANT ASSET DIRS pass — SYNC', () => {
    expect(resolveClaim('workflows/a.yaml', VARIANT)).toEqual({ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' });
    expect(resolveClaim('decisions/gates.yaml', 'co-design')).toEqual({ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' });
    expect(resolveClaim('regulations/x.yaml', 'co-safety')).toEqual({ policy: 'SYNC', pass: 'VARIANT ASSET DIRS' });
  });

  test('CODEX.md claim is unchanged: MERGE_MANAGED on the MERGE pass (AC6)', () => {
    expect(resolveClaim('CODEX.md', VARIANT)).toEqual({ policy: 'MERGE_MANAGED', pass: 'MERGE' });
  });

  test('exported VARIANT_ASSET_DIRS_PASS constant matches the resolveClaim pass id', () => {
    // v1.14.0 (design D2/D3): the pass filter must compare identities, not a
    // second hard-coded literal — TEMPLATE_TREE_SYNC_PASS precedent.
    expect(VARIANT_ASSET_DIRS_PASS).toBe('VARIANT ASSET DIRS');
    expect(resolveClaim('workflows/a.yaml', VARIANT).pass).toBe(VARIANT_ASSET_DIRS_PASS);
  });
});

describe('upgrade-policy resolveClaim — PRESERVE / PROJECT_STATE / TEMPLATE_ONLY', () => {
  test('project-owned files are never touched', () => {
    for (const rel of ['README.md', 'README_ko.md', 'CHANGELOG.md', 'docs/README.md', 'docs/README_ko.md']) {
      expect(resolveClaim(rel, VARIANT).policy).toBe('PRESERVE');
    }
  });

  test('.env.sample has a dedicated country-aware pass (ENV_SAMPLE SYNC, v1.23.0)', () => {
    expect(resolveClaim('.env.sample', VARIANT)).toEqual({ policy: 'SYNC', pass: 'ENV_SAMPLE SYNC' });
  });

  test('runtime / generated state never delivered', () => {
    for (const rel of ['package.json', 'bun.lock', 'variant.json', 'scripts-snapshot.json', 'memory/2026-01-01.md', 'docs/countries/ACTIVE.md']) {
      expect(resolveClaim(rel, VARIANT).policy).toBe('PROJECT_STATE');
    }
  });

  test('scaffold-removed staging zones are TEMPLATE_ONLY', () => {
    for (const rel of [
      'docs/adr/0001-x.md', 'docs/variants/z.md',
      'docs/_templates/t.md', 'docs/_examples/e.md', 'docs/_common/security.md',
      'docs/variant.context.template.md', 'agents/_COMMON.md', 'agents/lifecycle-manager.md',
      'scripts/propagation-map.json', 'run.cmd',
    ]) {
      expect(resolveClaim(rel, VARIANT).policy).toBe('TEMPLATE_ONLY');
    }
  });

  test('docs/specs left the scaffold-removed zones — registry seed rides WORKSPACE semantics (ADR-0074)', () => {
    // ADR-0073 Amendment 2 (via ADR-0074): docs/specs is no longer a scaffold-deleted zone;
    // it is a WORKSPACE doc dir (add-if-missing seed, never overwrite/prune project entries).
    // The seed MUST ride TEMPLATE TREE SYNC — a named pass with no delivery code is silently
    // never delivered (the 2026-09-12 DESIGN GATE SEED incident).
    expect(resolveClaim('docs/specs/registry.json', VARIANT)).toEqual({
      policy: 'WORKSPACE',
      pass: 'TEMPLATE TREE SYNC',
    });
    expect(resolveClaim('docs/specs/y.md', VARIANT)).toEqual({
      policy: 'WORKSPACE',
      pass: 'TEMPLATE TREE SYNC',
    });
  });
});

describe('upgrade-policy resolveClaim — default-policy inversion (the gap fix)', () => {
  test('variant docs gaps land on TEMPLATE TREE SYNC', () => {
    for (const rel of [
      'docs/user-guide.md', 'docs/user-guide_ko.md', 'docs/handoff-spec.md',
      'docs/skill-graph.overrides.json',
      'docs/countries/KR.md', 'docs/wire-format.md', 'docs/benchmark-fixtures/ISSUE-001.md',
    ]) {
      const claim = resolveClaim(rel, VARIANT);
      expect(claim.policy).toBe('SYNC');
      expect(claim.pass).toBe(TEMPLATE_TREE_SYNC_PASS);
    }
  });

  test('common docs extras land on TEMPLATE TREE SYNC', () => {
    for (const rel of [
      'docs/country-profiles.md', 'docs/design-foundation.md', 'docs/procedure-schema-spec.md',
      'docs/workspace-schema.json', 'docs/design-tokens.template.css', 'docs/screen-patterns.template.md',
      'docs/README.template.md',
    ]) {
      expect(resolveClaim(rel, VARIANT).pass).toBe(TEMPLATE_TREE_SYNC_PASS);
    }
  });

  test('root-level stragglers land on TEMPLATE TREE SYNC', () => {
    for (const rel of ['.editorconfig', '.claude/skills.json', '.gemini/skills.json', '.agents/skills.json']) {
      expect(resolveClaim(rel, VARIANT).pass).toBe(TEMPLATE_TREE_SYNC_PASS);
    }
  });

  test('.github/ lands on TEMPLATE TREE SYNC (previously claimed by nobody)', () => {
    expect(resolveClaim('.github/CODEOWNERS', VARIANT).pass).toBe(TEMPLATE_TREE_SYNC_PASS);
    expect(resolveClaim('.github/workflows/ci.yml', VARIANT).pass).toBe(TEMPLATE_TREE_SYNC_PASS);
  });

  test('platform settings are JSON_MERGE via TEMPLATE TREE SYNC', () => {
    expect(resolveClaim('.claude/settings.json', VARIANT)).toEqual({ policy: 'JSON_MERGE', pass: TEMPLATE_TREE_SYNC_PASS });
    expect(resolveClaim('.gemini/settings.json', VARIANT)).toEqual({ policy: 'JSON_MERGE', pass: TEMPLATE_TREE_SYNC_PASS });
  });

  test('docs workspaces are WORKSPACE seeds (add-if-missing only)', () => {
    for (const rel of ['docs/designs/a.md', 'docs/drafts/b.md', 'docs/lifecycle/agents/pm.md', 'docs/threat-models/tm.md']) {
      expect(resolveClaim(rel, VARIANT)).toEqual({ policy: 'WORKSPACE', pass: TEMPLATE_TREE_SYNC_PASS });
    }
  });
});

describe('upgrade-policy drift guard vs scripts/upgrade-project.ts literals', () => {
  const src = require('node:fs').readFileSync(join(workspaceRoot, 'scripts', 'upgrade-project.ts'), 'utf8');

  test('VARIANT_DOCS_SYNC literal stays folded out of the script (no re-duplication)', () => {
    expect(src).not.toMatch(/const VARIANT_DOCS_SYNC\s*:\s*string\[\]/);
    expect(src).not.toContain("docs/privacy-design-checklist.md',");
  });

  test('GOVERNANCE_FILES literal matches the lib inventory', () => {
    const m = src.match(/const GOVERNANCE_FILES = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const literal = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1]);
    expect(literal).toEqual([...GOVERNANCE_FILES]);
  });
});

describe('upgrade-policy mergeSettingsData (settings JSON merge, design D4)', () => {
  test('objects recurse with template winning conflicts, project-only keys preserved', () => {
    const result = mergeSettingsData(
      { env: { A: 'tpl' }, hooks: { a: 1 } },
      { env: { A: 'proj', B: 'projOnly' }, hooks: { a: 9 }, projectCustom: true },
    );
    expect(result.merged).toEqual({ env: { A: 'tpl', B: 'projOnly' }, hooks: { a: 1 }, projectCustom: true });
    expect(result.preserved).toEqual(['env.B', 'projectCustom']);
  });

  test('arrays are unioned with project-only entries kept', () => {
    const result = mergeSettingsData(
      { permissions: { allow: ['Bash(bun scripts/audit.ts *)'], deny: ['Bash(rm -rf *)'] } },
      { permissions: { allow: ['Bash(bun scripts/audit.ts *)', 'Bash(my-project-tool *)'] } },
    );
    expect(result.merged).toEqual({
      permissions: {
        allow: ['Bash(bun scripts/audit.ts *)', 'Bash(my-project-tool *)'],
        deny: ['Bash(rm -rf *)'],
      },
    });
    expect(result.preserved).toContain('permissions.allow[]');
  });

  test('scalar conflict: template wins', () => {
    expect(mergeSettingsData('auto', 'manual').merged).toBe('auto');
  });
});

describe('upgrade-policy mergeSettingsJson (file-level)', () => {
  test('merges template over project, preserving project-only entries; idempotent on second run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'settings-merge-'));
    try {
      const tpl = join(dir, 'template.json');
      const proj = join(dir, 'project.json');
      writeFileSync(tpl, JSON.stringify({
        permissions: { allow: ['Bash(bun scripts/audit.ts *)'] },
        hooks: { SessionStart: [{ matcher: '', type: 'command' }] },
      }, null, 2) + '\n');
      writeFileSync(proj, JSON.stringify({
        permissions: { allow: ['Bash(project-only *)'] },
        projectFlag: true,
      }, null, 2) + '\n');

      const first = mergeSettingsJson(proj, tpl);
      expect(first.changed).toBe(true);
      const merged = JSON.parse(first.merged);
      expect(merged.permissions.allow).toEqual(['Bash(bun scripts/audit.ts *)', 'Bash(project-only *)']);
      expect(merged.projectFlag).toBe(true);
      expect(merged.hooks.SessionStart).toHaveLength(1);

      writeFileSync(proj, first.merged);
      const second = mergeSettingsJson(proj, tpl);
      expect(second.changed).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('upgrade-policy placeholder allowlist (design D8)', () => {
  test('unrendered README templates are allowlisted', () => {
    expect(PLACEHOLDER_ALLOWLIST.has('docs/README.template.md')).toBe(true);
    expect(PLACEHOLDER_ALLOWLIST.has('docs/README_ko.template.md')).toBe(true);
    expect(PLACEHOLDER_ALLOWLIST.has('docs/user-guide.md')).toBe(false);
  });
});

describe('SCAFFOLD_COMMON_OWNED_FILES (T-20260917-009)', () => {
  test('contains docs/context.md', () => {
    expect(SCAFFOLD_COMMON_OWNED_FILES.size).toBeGreaterThan(0);
    expect(SCAFFOLD_COMMON_OWNED_FILES.has('docs/context.md')).toBe(true);
  });

  test('new-project derives the variant overlay skip from the classification (no hand list)', () => {
    const src = readFileSync(resolve(import.meta.dir, '..', '..', 'scripts', 'new-project.ts'), 'utf-8');
    expect(src).toContain('SCAFFOLD_COMMON_OWNED_FILES');
    expect(src).not.toMatch(/VARIANT_OVERLAY_SKIP\s*=\s*new Set/);
  });

  test('validate-templates WS-07 derives its forbidden list from the same classification', () => {
    const src = readFileSync(resolve(import.meta.dir, '..', '..', 'scripts', 'validate-templates.ts'), 'utf-8');
    expect(src).toMatch(/SCAFFOLD_COMMON_OWNED_FILES/);
    expect(src).not.toMatch(/const variantContextMd = join\(TEMPLATES_DIR, variant, 'docs', 'context.md'\)/);
  });
});

describe('isExtendsStub (T-20260924-003 R2.4)', () => {
  const templatesDir = resolve(import.meta.dir, '..', '..', 'templates');
  const STUB_VARIANTS = [
    'co-abap', 'co-consult', 'co-deck', 'co-design', 'co-develop', 'co-export',
    'co-game', 'co-hr', 'co-news', 'co-price', 'co-safety', 'co-security', 'co-work',
  ];

  test('true on all 13 variant i18n-specialist stubs (real template files)', () => {
    for (const variant of STUB_VARIANTS) {
      const content = readFileSync(join(templatesDir, variant, 'agents', 'i18n-specialist.md'), 'utf-8');
      if (!isExtendsStub(content)) {
        throw new Error(`${variant}/agents/i18n-specialist.md is not an extends-stub`);
      }
    }
    expect(STUB_VARIANTS.length).toBe(13);
  });

  test('true on all 13 variant pm.md stubs (real template files)', () => {
    for (const variant of STUB_VARIANTS) {
      const content = readFileSync(join(templatesDir, variant, 'agents', 'pm.md'), 'utf-8');
      expect(isExtendsStub(content)).toBe(true);
    }
  });

  test('false on full agent bodies (common i18n-specialist, root automation-engineer)', () => {
    const commonI18n = readFileSync(join(templatesDir, 'common', 'agents', 'i18n-specialist.md'), 'utf-8');
    expect(isExtendsStub(commonI18n)).toBe(false);
    const rootAgent = readFileSync(
      resolve(import.meta.dir, '..', '..', 'agents', 'automation-engineer.md'),
      'utf-8',
    );
    expect(isExtendsStub(rootAgent)).toBe(false);
  });

  test('false on no-frontmatter content and on frontmatter without extends:', () => {
    expect(isExtendsStub('# Just a body\n')).toBe(false);
    expect(isExtendsStub('---\nname: pm\n---\nbody')).toBe(false);
    // A resolved project file never carries the extends: pointer.
    expect(isExtendsStub('---\nname: pm\nrole: resolved\n---\n# PM\n')).toBe(false);
    // Prose mentions of "extends:" outside frontmatter do not count.
    expect(isExtendsStub('---\nname: pm\n---\nThe pattern extends: something.\n')).toBe(false);
  });
});
