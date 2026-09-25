/**
 * Tests for validate-templates.ts exists→declared manifest reconciliation
 * (Checks B-03r / B-03a, T-20260912-014).
 *
 * Pins both the pure helpers and the real-tree state after the manifest fixes:
 * every previously-undeclared instance (co-game validate-asset-manifest.ts,
 * co-deck watch-deck.ts, pm in the five beta rosters) must now reconcile clean.
 *
 * v1.1.0 (2026-09-25, inventory decisions batch — spec
 *         docs/designs/2026-09-25-inventory-decisions-batch-design.md, R1.3-R1.5):
 *         pins the C-CM-04 platform-skills sweep helpers — exclusion acceptance,
 *         stale-exclusion failure, codex_source platform mapping, and the
 *         variant_scoped_skills VALUES-based exemption — plus the real-tree
 *         full-inventory state (zero unlisted platform skill dirs, all 22
 *         contract entries carry a codex_source).
 *
 * v1.2.0 (2026-09-25, registry & platform-policy completeness batch — spec
 *         docs/designs/2026-09-25-registry-policy-completeness-design.md, R3):
 *         pins VA-07 collectMirrorVersionMismatches — real-tree zero findings
 *         across all 13 variants (day-one green), induced mirror version
 *         mismatch (exactly one finding listing both versions), missing
 *         version, mirror-parity: skip suppression, registry-row disagreement,
 *         and mirror-only adapted copies without a registry row.
 *
 * @version 1.2.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import { existsSync, readFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  findUndeclaredAgents,
  findUndeclaredScripts,
  collectSchemaExemptSkills,
  declaredPlatformTrees,
  stalePlatformSkillExclusions,
  unlistedPlatformSkillDirs,
  collectMirrorVersionMismatches,
} from '../../scripts/validate-templates.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const templatesDir = join(workspaceRoot, 'templates');

function variantJson(variant: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(templatesDir, variant, 'variant.json'), 'utf-8'));
}

describe('findUndeclaredScripts (B-03r)', () => {
  test('co-game validate-asset-manifest.ts is now declared (real instance from T-20260912-014)', () => {
    const raw = variantJson('co-game');
    const local = (raw.script_manifest as { local: Array<{ path: string }> }).local.map(e => e.path);
    expect(findUndeclaredScripts(join(templatesDir, 'co-game'), local)).toEqual([]);
  });

  test('co-deck watch-deck.ts is now declared', () => {
    const raw = variantJson('co-deck');
    const local = (raw.script_manifest as { local: Array<{ path: string }> }).local.map(e => e.path);
    expect(findUndeclaredScripts(join(templatesDir, 'co-deck'), local)).toEqual([]);
  });

  test('an undeclared top-level script is reported with its variant-relative path', () => {
    // Declare everything EXCEPT bundle-html.ts and watch for exactly that gap.
    const local = ['scripts/co-game/validate-asset-manifest.ts'];
    expect(findUndeclaredScripts(join(templatesDir, 'co-game'), local)).toEqual([
      'scripts/co-game/bundle-html.ts',
    ]);
  });

  test('lib/ and tests/ support trees and SCRIPTS.md are out of scope', () => {
    // co-deck declares no lib/ or tests/ files — the helper must not flag them.
    const local = (variantJson('co-deck').script_manifest as { local: Array<{ path: string }> })
      .local.map(e => e.path);
    const undeclared = findUndeclaredScripts(join(templatesDir, 'co-deck'), local);
    expect(undeclared.every(p => !p.includes('/lib/') && !p.includes('/tests/'))).toBe(true);
    expect(undeclared).toEqual([]);
  });
});

describe('findUndeclaredAgents (B-03a)', () => {
  test('every variant with a top-level pm.md declares it (incl. the five fixed beta variants)', () => {
    for (const variant of ['co-safety', 'co-export', 'co-hr', 'co-news', 'co-price']) {
      const agents = variantJson(variant).agents as Array<{ name: string }>;
      expect(agents.map(a => a.name)).toContain('pm');
      expect(findUndeclaredAgents(join(templatesDir, variant), agents)).toEqual([]);
    }
  });

  test('undeclared top-level agent files are reported; README files never are', () => {
    const agents = variantJson('co-safety').agents as Array<{ name: string }>;
    // Remove safety-workflow-manager from the declared set → exactly that gap.
    const partial = agents.filter(a => a.name !== 'safety-workflow-manager');
    expect(findUndeclaredAgents(join(templatesDir, 'co-safety'), partial)).toEqual([
      'agents/safety-workflow-manager.md',
    ]);
  });

  test('nested agents/domains/ and agents/_shared/ trees are out of scope', () => {
    // co-safety holds 12 files under _shared/ and a domains/ tree; declaring only
    // the top-level roster must produce no findings for the nested trees.
    const agents = variantJson('co-safety').agents as Array<{ name: string }>;
    const undeclared = findUndeclaredAgents(join(templatesDir, 'co-safety'), agents);
    expect(undeclared.filter(p => p.includes('_shared') || p.includes('domains'))).toEqual([]);
  });
});

describe('VA-07 collectMirrorVersionMismatches (registry completeness R3)', () => {
  const scratchRoots: string[] = [];

  afterEach(() => {
    while (scratchRoots.length) rmSync(scratchRoots.pop()!, { recursive: true, force: true });
  });

  function makeVariantDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'va07-'));
    scratchRoots.push(dir);
    return dir;
  }

  function writeSkill(variantDir: string, mirror: string, skill: string, frontmatter: string): void {
    const dir = join(variantDir, mirror, 'skills', skill);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\nBody.\n`, 'utf-8');
  }

  function writeRegistryRow(variantDir: string, skill: string, version: string): void {
    const dir = join(variantDir, 'skills');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILLS.md'),
      [
        '# SKILLS.md — Skill Lifecycle Registry',
        '',
        '## Registry',
        '',
        '| skill | version | status | owner | last_reviewed | removal-date | notes |',
        '|-------|---------|--------|-------|---------------|--------------|-------|',
        `\| \`${skill}\` | ${version} | active | pm | — | — | test row |`,
        '',
      ].join('\n'),
      'utf-8',
    );
  }

  test('day-one green: zero findings across all 13 real variants', () => {
    const variants = readdirSync(templatesDir)
      .filter(d => d.startsWith('co-') && existsSync(join(templatesDir, d, 'variant.json')))
      .sort();
    expect(variants.length).toBe(13);
    for (const variant of variants) {
      const findings = collectMirrorVersionMismatches(join(templatesDir, variant), variant);
      expect(findings).toEqual([]);
    }
  });

  test('induced version mismatch: exactly one finding listing both versions', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'widget-maker', 'version: 1.0.0');
    writeSkill(variantDir, '.agents', 'widget-maker', 'version: 1.0.2');

    const findings = collectMirrorVersionMismatches(variantDir, 'co-test');
    expect(findings.length).toBe(1);
    expect(findings[0]!.skill).toBe('widget-maker');
    expect(findings[0]!.message).toContain('1.0.0');
    expect(findings[0]!.message).toContain('1.0.2');
    expect(findings[0]!.message).toContain('.claude');
    expect(findings[0]!.message).toContain('.agents');
  });

  test('a mirror with no parseable version yields a finding', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'widget-maker', 'version: 1.0.0');
    writeSkill(variantDir, '.codex', 'widget-maker', 'name: widget-maker'); // no version

    const findings = collectMirrorVersionMismatches(variantDir, 'co-test');
    expect(findings.length).toBe(1);
    expect(findings[0]!.message).toContain('no parseable frontmatter version');
  });

  test('mirror-parity: skip suppresses the skill; legacy gemini-parity: skip also suppresses', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'widget-maker', 'version: 1.0.0\nmirror-parity: skip');
    writeSkill(variantDir, '.agents', 'widget-maker', 'version: 9.9.9');
    expect(collectMirrorVersionMismatches(variantDir, 'co-test')).toEqual([]);

    const variantDir2 = makeVariantDir();
    writeSkill(variantDir2, '.gemini', 'widget-maker', 'version: 1.0.0\ngemini-parity: skip');
    writeSkill(variantDir2, '.codex', 'widget-maker', 'version: 9.9.9');
    expect(collectMirrorVersionMismatches(variantDir2, 'co-test')).toEqual([]);
  });

  test('registry-row disagreement yields a finding when versions are mirror-consistent', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'widget-maker', 'version: 1.0.0');
    writeSkill(variantDir, '.gemini', 'widget-maker', 'version: 1.0.0');
    writeRegistryRow(variantDir, 'widget-maker', '1.1.0');

    const findings = collectMirrorVersionMismatches(variantDir, 'co-test');
    expect(findings.length).toBe(2); // one per present mirror
    for (const f of findings) {
      expect(f.message).toContain('registry row version 1.1.0');
    }
  });

  test('registry-row agreement yields no finding; mirror-only skills without rows are ignored', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'listed-skill', 'version: 1.0.0');
    writeSkill(variantDir, '.agents', 'listed-skill', 'version: 1.0.0');
    writeSkill(variantDir, '.claude', 'mirror-only-skill', 'version: 1.0.1'); // WS-05a shape
    writeSkill(variantDir, '.codex', 'mirror-only-skill', 'version: 1.0.1');
    writeRegistryRow(variantDir, 'listed-skill', '1.0.0'); // no row for mirror-only-skill

    expect(collectMirrorVersionMismatches(variantDir, 'co-test')).toEqual([]);
  });

  test('single-mirror skills are out of scope (VA-03 owns presence)', () => {
    const variantDir = makeVariantDir();
    writeSkill(variantDir, '.claude', 'lonely-skill', 'version: 1.0.0');
    expect(collectMirrorVersionMismatches(variantDir, 'co-test')).toEqual([]);
  });
});

describe('C-CM-04 platform-skills sweep helpers (T-20260924-002 R1.3-R1.5)', () => {
  const contract = JSON.parse(
    readFileSync(join(workspaceRoot, 'docs', 'templates', 'common-contract.json'), 'utf-8'),
  ) as Record<string, any>;
  const schema = JSON.parse(
    readFileSync(join(workspaceRoot, 'docs', 'workspace-schema.json'), 'utf-8'),
  ) as Record<string, any>;
  const MIRROR_TREES = ['.claude/skills', '.gemini/skills', '.agents/skills', '.codex/skills'];

  test('exclusion acceptance: a listed, exempt, or excluded dir never comes back unlisted', () => {
    const dirs = ['upgrade-project', 'sound-synth', 'graft', 'meeting-facilitation', 'handbook'];
    const unlisted = unlistedPlatformSkillDirs(
      dirs,
      new Set(Object.keys(contract.common_platform_skills)),
      new Set(['sound-synth']), // variant-scoped value
      new Set(Object.keys(contract.common_platform_skill_exclusions)), // graft etc.
    );
    expect(unlisted).toEqual([]);
  });

  test('exclusion rejection: a dir covered by nothing is reported', () => {
    const unlisted = unlistedPlatformSkillDirs(
      ['mystery-skill'],
      new Set(['listed-skill']),
      new Set(),
      new Set(),
    );
    expect(unlisted).toEqual(['mystery-skill']);
  });

  test('stale-exclusion anti-drift: an exclusion whose dir vanished from every tree fails', () => {
    expect(stalePlatformSkillExclusions(['graft', 'sound-synth'], ['sound-synth'])).toEqual(['graft']);
    expect(stalePlatformSkillExclusions(['create-variant'], ['create-variant', 'graft'])).toEqual([]);
  });

  test('real contract exclusions are live: every excluded dir exists in some mirror tree', () => {
    const exclusions = Object.keys(contract.common_platform_skill_exclusions as Record<string, unknown>);
    expect(exclusions.sort()).toEqual(
      ['create-variant', 'graft', 'promote-variant', 'simulate-pipeline', 'sound-synth'].sort(),
    );
    const existing = new Set<string>();
    for (const tree of MIRROR_TREES) {
      const dir = join(templatesDir, 'common', tree);
      if (!existsSync(dir)) continue;
      for (const e of readdirSync(dir)) {
        if (existsSync(join(dir, e, 'SKILL.md'))) existing.add(e);
      }
    }
    expect(stalePlatformSkillExclusions(exclusions, existing)).toEqual([]);
  });

  test('declaredPlatformTrees maps codex_source (R1.4) and all four trees for full entries', () => {
    expect(declaredPlatformTrees({ claude_source: '.claude/skills/x/SKILL.md' })).toEqual(['.claude']);
    expect(
      declaredPlatformTrees({
        claude_source: '.claude/skills/x/SKILL.md',
        gemini_source: '.gemini/skills/x/SKILL.md',
        agents_source: '.agents/skills/x/SKILL.md',
        codex_source: '.codex/skills/x/SKILL.md',
      }),
    ).toEqual(['.claude', '.gemini', '.agents', '.codex']);
  });

  test('all 22 contract platform entries declare a codex_source (verified .codex copies)', () => {
    const entries = Object.entries(contract.common_platform_skills as Record<string, Record<string, unknown>>);
    expect(entries.length).toBe(22);
    for (const [name, entry] of entries) {
      expect(entry.codex_source).toBe(`.codex/skills/${name}/SKILL.md`);
    }
  });

  test('exemptSkills values fix: variant_scoped_skills VALUES (skill names) are exempt, not variant keys', () => {
    const exempt = collectSchemaExemptSkills(schema);
    // Values: sound-synth (co-game), mece-logic-auditor (co-consult), presenter-mode
    // (co-deck), sarif-exporter/stride-threat-matrix (co-security), swe-solve (co-develop).
    for (const name of ['sound-synth', 'mece-logic-auditor', 'presenter-mode', 'sarif-exporter', 'swe-solve']) {
      expect(exempt.has(name)).toBe(true);
    }
    // The pre-fix bug: variant NAMES (co-game, co-deck, …) must NOT be exempt skill names.
    for (const variantName of ['co-game', 'co-deck', 'co-consult']) {
      expect(exempt.has(variantName)).toBe(false);
    }
    // Country-scoped keys stay exempt.
    expect(exempt.has('k-law')).toBe(true);
  });

  test('full-inventory: zero unlisted platform skill dirs in every mirror tree (real tree)', () => {
    const listed = new Set([
      ...Object.keys(contract.common_skills as Record<string, unknown>),
      ...Object.keys(contract.common_platform_skills as Record<string, unknown>),
    ]);
    const exempt = collectSchemaExemptSkills(schema);
    const excluded = new Set(Object.keys(contract.common_platform_skill_exclusions as Record<string, unknown>));
    for (const tree of MIRROR_TREES) {
      const dir = join(templatesDir, 'common', tree);
      const dirs = readdirSync(dir).filter(e => existsSync(join(dir, e, 'SKILL.md')));
      expect(unlistedPlatformSkillDirs(dirs, listed, exempt, excluded)).toEqual([]);
    }
  });
});
