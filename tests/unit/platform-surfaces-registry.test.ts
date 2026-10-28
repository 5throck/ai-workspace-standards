/**
 * Registry consistency tests for the platform_surfaces block in
 * docs/workspace-schema.json (spec docs/designs/2026-10-28-platform-agent-mirror-design.md
 * §4.1, DEC-20261028-06). Pins:
 * - the platform set to validate-model-registry.ts PLATFORMS (one vocabulary);
 * - every platform row covers agents/skills/commands/hooks with boolean supported;
 * - every supported:false row carries a non-empty evidence string;
 * - the claude.agents row's exact contract shape;
 * - registry ↔ scripts/lib/platforms.ts skills-dir consistency (§4.1(d)) — the
 *   registry owns capabilities, platforms.ts owns dir names; the pin prevents a
 *   second SSOT from forming;
 * - the L0/L1 schema pair carries a byte-identical platform_surfaces block and
 *   the same version (rootAllowlist divergence stays sanctioned by DEC-20261028-05).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PLATFORMS } from '../../scripts/validate-model-registry.ts';
import { PLATFORM_SKILL_BASES } from '../../scripts/lib/platforms.ts';
import { assertRegistryAdapterCoverage } from '../../scripts/sync-agent-mirrors.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');
const ROOT_SCHEMA = path.join(REPO_ROOT, 'docs', 'workspace-schema.json');
const L1_SCHEMA = path.join(REPO_ROOT, 'templates', 'common', 'docs', 'workspace-schema.json');

interface SurfaceCap { supported: boolean; evidence?: string; mirror_dir?: string; allowed_fields?: string[]; model_format?: string; model_source?: string }
interface PlatformRow { agents: SurfaceCap; skills: SurfaceCap; commands: SurfaceCap; hooks: SurfaceCap }
interface SchemaShape { version?: string; platform_surfaces?: { platforms?: Record<string, PlatformRow> }; models?: Record<string, Record<string, string>> }

function loadSchema(p: string): SchemaShape {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as SchemaShape;
}

const root = loadSchema(ROOT_SCHEMA);
const l1 = loadSchema(L1_SCHEMA);
const registry = root.platform_surfaces!;
const l1Registry = l1.platform_surfaces!;

describe('platform_surfaces registry (design §4.1)', () => {
  test('block is present in both schema copies with the same minor-bumped version', () => {
    expect(registry).toBeDefined();
    expect(l1Registry).toBeDefined();
    expect(root.version).toBe('1.7.0');
    expect(l1.version).toBe('1.7.0');
  });

  test('the platform set is exactly validate-model-registry.ts PLATFORMS', () => {
    expect(Object.keys(registry.platforms!).sort()).toEqual([...PLATFORMS].sort());
  });

  test('every platform row covers agents/skills/commands/hooks with boolean supported', () => {
    for (const [platform, row] of Object.entries(registry.platforms!)) {
      for (const surface of ['agents', 'skills', 'commands', 'hooks'] as const) {
        expect(row[surface], `${platform}.${surface}`).toBeDefined();
        expect(typeof row[surface].supported, `${platform}.${surface}.supported`).toBe('boolean');
      }
    }
  });

  test('every supported:false row carries a non-empty evidence string', () => {
    for (const [platform, row] of Object.entries(registry.platforms!)) {
      for (const surface of ['agents', 'skills', 'commands', 'hooks'] as const) {
        const cap = row[surface];
        if (!cap.supported) {
          expect(typeof cap.evidence, `${platform}.${surface} evidence`).toBe('string');
          expect((cap.evidence ?? '').trim().length, `${platform}.${surface} evidence non-empty`).toBeGreaterThan(0);
        }
      }
    }
  });

  test('the claude.agents row carries the exact contract shape', () => {
    const agents = registry.platforms!.claude.agents;
    expect(agents.supported).toBe(true);
    expect(agents.mirror_dir).toBe('.claude/agents');
    expect(agents.allowed_fields).toEqual(['name', 'description', 'model']);
    expect(agents.model_format).toBe('alias');
    expect(agents.model_source).toBe('models.claude');
  });

  test('supported agents rows resolve their model_source against the models registry', () => {
    for (const [platform, row] of Object.entries(registry.platforms!)) {
      if (row.agents.supported) {
        expect(row.agents.model_source).toBe(`models.${platform}`);
        expect(root.models?.[platform]).toBeDefined();
      }
    }
  });
});

describe('registry ↔ platforms.ts consistency (§4.1(d))', () => {
  // The registry owns capabilities; scripts/lib/platforms.ts owns directory
  // names. This pin is the "no second SSOT" guard: a skills.supported row
  // without its PLATFORM_SKILL_BASES dir (or an unsupported platform with a
  // phantom dir) means the two facts diverged.
  const PLATFORM_SKILL_DIR: Record<string, string> = {
    claude: '.claude/skills',
    gemini: '.gemini/skills',
    'gemini-cli': '.gemini/skills',
    antigravity: '.agents/skills',
    codex: '.codex/skills',
    hermes: '.hermes/skills',
    zai: '',
  };

  test('every skills.supported:true platform has its skill base in PLATFORM_SKILL_BASES', () => {
    for (const [platform, row] of Object.entries(registry.platforms!)) {
      const dir = PLATFORM_SKILL_DIR[platform] ?? '';
      if (row.skills.supported) {
        expect(dir, `${platform} expects a skill dir`).not.toBe('');
        expect(PLATFORM_SKILL_BASES).toContain(dir);
      } else {
        if (dir !== '') {
          expect(PLATFORM_SKILL_BASES).toContain(dir); // dir may exist for other purposes
        }
        expect(PLATFORM_SKILL_BASES).not.toContain(`.${platform}/skills`);
      }
    }
  });

  test('no phantom .zai skill base exists for the unsupported zai row', () => {
    expect(PLATFORM_SKILL_BASES).not.toContain('.zai/skills');
  });
});

describe('L0/L1 schema pair parity (platform_surfaces block)', () => {
  test('the block is identical on both sides (deep equality)', () => {
    expect(l1Registry).toEqual(registry);
  });
});

describe('coverage guard accepts the real registry', () => {
  test('assertRegistryAdapterCoverage passes on the real schema', () => {
    expect(() => assertRegistryAdapterCoverage(root)).not.toThrow();
  });
});
