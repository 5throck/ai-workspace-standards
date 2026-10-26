/**
 * validate-model-registry.ts v2.0.0 tier-coverage tests
 * (ADR-0102 / T-20261026-018, design §9 matrix + §11 row 2 fixture set)
 *
 * Covers the tier-coverage classification and the full validation run
 * against /tmp fixtures so no tracked file is touched: scalar valid/invalid,
 * legacy uniform/mixed/unknown-platform blocks, missing tier at L0 vs
 * delivered contexts, CRLF scalars, the transition-period legacy model-id
 * comment check, and the report-shape contract (bare ✓ PASS suppressed while
 * coverage WARNs exist). agent_tiers is intentionally absent from every
 * fixture — the schema block was REMOVED (user ruling 2, 2026-10-26); the
 * former L0 parity row is retired.
 */

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyAgentTier,
  extractFrontmatter,
  printReport,
  runModelRegistryValidation,
  type ModelRegistryReport,
} from '../../scripts/validate-model-registry.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');

/** The real registry models block (7 platforms) — copied into every fixture. */
const MODELS = {
  claude: { high: 'claude-opus-5-5', medium: 'claude-sonnet-5-5', low: 'claude-haiku-5-5' },
  gemini: { high: 'gemini-3.1-pro', medium: 'gemini-3.8-flash', low: 'gemini-3.8-flash' },
  antigravity: { high: 'gemini-3.1-pro', medium: 'gemini-3.8-flash', low: 'gemini-3.8-flash' },
  'gemini-cli': { high: 'gemini-3.1-pro', medium: 'gemini-3.8-flash', low: 'gemini-3.8-flash' },
  codex: { high: 'gpt-5.6-sol', medium: 'gpt-5.6-terra', low: 'gpt-5.6-luna' },
  hermes: { high: 'claude-opus-5-5', medium: 'claude-sonnet-5-5', low: 'claude-haiku-5-5' },
  zai: { high: 'glm-5.3', medium: 'glm-5.3-flash', low: 'glm-5.3-flash' },
};
const KNOWN_PLATFORMS = Object.keys(MODELS);

function writeAgent(dir: string, name: string, body: string, crlf = false): void {
  writeFileSync(join(dir, 'agents', name), crlf ? body.replace(/\n/g, '\r\n') : body, 'utf-8');
}

/** Build a fixture workspace root. `l0` toggles the CONSTITUTION.md marker. */
function makeFixture(agentName: string, agentBody: string, opts?: { l0?: boolean; crlf?: boolean }): string {
  const root = mkdtempSync(join(tmpdir(), 'vmr-tier-'));
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'agents'), { recursive: true });
  writeFileSync(join(root, 'docs', 'workspace-schema.json'), JSON.stringify({ models: MODELS }), 'utf-8');
  writeAgent(root, agentName, agentBody, opts?.crlf);
  if (opts?.l0) writeFileSync(join(root, 'CONSTITUTION.md'), 'L0 marker\n', 'utf-8');
  return root;
}

// ── classifyAgentTier (pure) ──────────────────────────────────────────────────

describe('classifyAgentTier (ADR-0102 §9 matrix, pure)', () => {
  test('scalar valid', () => {
    const cls = classifyAgentTier('---\nname: x\ntier: medium\nmodel: inherit\n---\nbody\n', KNOWN_PLATFORMS);
    expect(cls).toEqual({ form: 'scalar', tier: 'medium', valid: true });
  });

  test('scalar with inline comment is tolerated', () => {
    const cls = classifyAgentTier('---\ntier: high  # expensive\n---\n', KNOWN_PLATFORMS);
    expect(cls).toEqual({ form: 'scalar', tier: 'high', valid: true });
  });

  test('scalar invalid value', () => {
    const cls = classifyAgentTier('---\ntier: extreme\n---\n', KNOWN_PLATFORMS);
    expect(cls).toEqual({ form: 'scalar', tier: 'extreme', valid: false });
  });

  test('legacy uniform block', () => {
    const cls = classifyAgentTier(
      '---\ntier:\n  claude: low\n  gemini: low\n  zai: low  # glm-5.3-flash\nmodel: inherit\n---\n',
      KNOWN_PLATFORMS,
    );
    expect(cls.form).toBe('legacy-uniform');
    expect(cls.tier).toBe('low');
  });

  test('legacy mixed block does not choose a value', () => {
    const cls = classifyAgentTier(
      '---\ntier:\n  claude: high\n  gemini: medium\n---\n',
      KNOWN_PLATFORMS,
    );
    expect(cls.form).toBe('legacy-mixed');
    expect(cls.tier).toBeUndefined();
    expect(cls.block).toEqual({ claude: 'high', gemini: 'medium' });
  });

  test('legacy block with an unknown platform key', () => {
    const cls = classifyAgentTier('---\ntier:\n  claude: low\n  warp: low\n---\n', KNOWN_PLATFORMS);
    expect(cls.form).toBe('legacy-unknown-platform');
    expect(cls.platform).toBe('warp');
  });

  test('missing tier declaration', () => {
    expect(classifyAgentTier('---\nname: x\nmodel: inherit\n---\n', KNOWN_PLATFORMS).form).toBe('missing');
    expect(classifyAgentTier('no frontmatter at all', KNOWN_PLATFORMS).form).toBe('missing');
  });

  test('CRLF scalar parses', () => {
    const cls = classifyAgentTier('---\r\nname: x\r\ntier: low\r\n---\r\nbody\r\n', KNOWN_PLATFORMS);
    expect(cls).toEqual({ form: 'scalar', tier: 'low', valid: true });
  });
});

// ── Full run against fixtures (severity matrix per context) ──────────────────

describe('runModelRegistryValidation §9 severity matrix', () => {
  test('scalar valid → OK at L0 (parity row retired — no agent_tiers anywhere)', () => {
    const root = makeFixture('alpha.md', '---\nname: alpha\ntier: high\nmodel: inherit\n---\n', { l0: true });
    try {
      const report = runModelRegistryValidation(root);
      expect(report.isWorkspaceRoot).toBe(true);
      expect(report.coverageFails).toEqual([]);
      expect(report.coverageWarns).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('scalar valid → OK in a delivered context', () => {
    const root = makeFixture('alpha.md', '---\ntier: low\n---\n');
    try {
      const report = runModelRegistryValidation(root);
      expect(report.isWorkspaceRoot).toBe(false);
      expect(report.coverageFails).toEqual([]);
      expect(report.coverageWarns).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('scalar invalid → FAIL in both contexts', () => {
    for (const l0 of [true, false]) {
      const root = makeFixture('alpha.md', '---\ntier: extreme\n---\n', { l0 });
      try {
        const report = runModelRegistryValidation(root);
        expect(report.coverageFails).toHaveLength(1);
        expect(report.coverageFails[0].kind).toBe('invalid-scalar');
        expect(report.coverageFails[0].message).toContain("'extreme'");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test('legacy uniform block → loud WARN naming the exact fix; comment check kept', () => {
    const root = makeFixture(
      'alpha.md',
      '---\ntier:\n  claude: medium  # claude-sonnet-5-5\n  gemini: medium  # gemini-3.8-flash\n---\n',
      { l0: true },
    );
    try {
      const report = runModelRegistryValidation(root);
      expect(report.coverageFails).toEqual([]);
      expect(report.legacyBlockCount).toBe(1);
      expect(report.coverageWarns).toHaveLength(1);
      expect(report.coverageWarns[0].kind).toBe('legacy-block');
      expect(report.coverageWarns[0].message).toContain('legacy per-platform tier block');
      expect(report.coverageWarns[0].message).toContain("normalize to 'tier: medium'");
      // Transition-period comment check: matching comments are clean.
      expect(report.modelMismatches).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('legacy uniform block with a WRONG model comment still fails the comment check', () => {
    const root = makeFixture(
      'alpha.md',
      '---\ntier:\n  claude: medium  # claude-opus-5-5\n  gemini: medium  # gemini-3.8-flash\n---\n',
    );
    try {
      const report = runModelRegistryValidation(root);
      expect(report.modelMismatches).toHaveLength(1);
      expect(report.modelMismatches[0]).toMatchObject({
        file: 'agents/alpha.md',
        platform: 'claude',
        tier: 'medium',
        declaredModel: 'claude-opus-5-5',
        expectedModel: 'claude-sonnet-5-5',
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('legacy mixed block → WARN without the validator picking a value', () => {
    const root = makeFixture('alpha.md', '---\ntier:\n  claude: high\n  gemini: medium\n---\n');
    try {
      const report = runModelRegistryValidation(root);
      expect(report.coverageFails).toEqual([]);
      expect(report.legacyBlockCount).toBe(1);
      expect(report.coverageWarns[0].message).toContain('mixed values');
      expect(report.coverageWarns[0].message).toContain('does not pick a value');
      expect(report.coverageWarns[0].message).not.toMatch(/normalize to 'tier: (high|medium|low)'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('legacy block with an unknown platform key → FAIL in both contexts', () => {
    for (const l0 of [true, false]) {
      const root = makeFixture('alpha.md', '---\ntier:\n  claude: low\n  warp: low\n---\n', { l0 });
      try {
        const report = runModelRegistryValidation(root);
        expect(report.coverageFails).toHaveLength(1);
        expect(report.coverageFails[0].kind).toBe('unknown-platform');
        expect(report.coverageFails[0].message).toContain("'warp'");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test('missing tier → FAIL at L0, WARN in delivered contexts (transition)', () => {
    const l0Root = makeFixture('alpha.md', '---\nname: alpha\n---\n', { l0: true });
    try {
      const report = runModelRegistryValidation(l0Root);
      expect(report.coverageFails).toHaveLength(1);
      expect(report.coverageFails[0].kind).toBe('missing-tier-l0');
      expect(report.missingTierCount).toBe(1);
    } finally {
      rmSync(l0Root, { recursive: true, force: true });
    }

    const deliveredRoot = makeFixture('alpha.md', '---\nname: alpha\n---\n');
    try {
      const report = runModelRegistryValidation(deliveredRoot);
      expect(report.coverageFails).toEqual([]);
      expect(report.coverageWarns).toHaveLength(1);
      expect(report.coverageWarns[0].kind).toBe('missing-tier');
      expect(report.missingTierCount).toBe(1);
    } finally {
      rmSync(deliveredRoot, { recursive: true, force: true });
    }
  });

  test('CRLF scalar → clean run', () => {
    const root = makeFixture('alpha.md', '---\nname: alpha\ntier: medium\nmodel: inherit\n---\n', {
      crlf: true,
      l0: true,
    });
    try {
      const report = runModelRegistryValidation(root);
      expect(report.coverageFails).toEqual([]);
      expect(report.coverageWarns).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('README files are excluded from the roster', () => {
    const root = makeFixture('alpha.md', '---\ntier: low\n---\n', { l0: true });
    writeFileSync(join(root, 'agents', 'README.md'), '---\nnot: an agent\n---\n', 'utf-8');
    try {
      const report = runModelRegistryValidation(root);
      expect(report.agentFilesChecked).toBe(1);
      expect(report.coverageFails).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ── Report shape (§9): PASS line suppressed while coverage WARNs exist ───────

describe('printReport §9 report shape', () => {
  function capture(report: ModelRegistryReport): { logs: string[]; warns: string[]; errors: string[] } {
    const logs: string[] = [];
    const warns: string[] = [];
    const errors: string[] = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.warn = (...args: unknown[]) => warns.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args.join(' '));
    try {
      printReport(report);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
    return { logs, warns, errors };
  }

  test('clean pass prints the bare ✓ line', () => {
    const out = capture({
      isWorkspaceRoot: true,
      agentFilesChecked: 1,
      coverageWarns: [],
      coverageFails: [],
      legacyBlockCount: 0,
      missingTierCount: 0,
      modelMismatches: [],
      registryWarns: [],
      proseMismatches: [],
      skippedProseTargets: [],
    });
    expect(out.logs).toEqual(['✓ All agent model names + tier→model mapping prose match registry']);
  });

  test('coverage WARNs suppress the ✓ line and print the distinct summary', () => {
    const out = capture({
      isWorkspaceRoot: true,
      agentFilesChecked: 3,
      coverageWarns: [
        { relFile: 'agents/a.md', kind: 'legacy-block', message: 'WARN a' },
        { relFile: 'agents/b.md', kind: 'legacy-block', message: 'WARN b' },
        { relFile: 'agents/c.md', kind: 'missing-tier', message: 'WARN c' },
      ],
      coverageFails: [],
      legacyBlockCount: 2,
      missingTierCount: 1,
      modelMismatches: [],
      registryWarns: [],
      proseMismatches: [],
      skippedProseTargets: [],
    });
    expect(out.logs).toEqual([]); // bare ✓ PASS line suppressed
    const summary = out.warns.find((w) => w.includes('TIER COVERAGE WARN'));
    expect(summary).toBeDefined();
    expect(summary).toContain('2 agent file(s) with legacy tier blocks');
    expect(summary).toContain('1 agent file(s) missing a tier declaration');
    expect(summary).toContain('this is not a clean pass');
  });
});

// ── Live tree (current, still legacy): red-free transition invariant ─────────

describe('live workspace root (transition state)', () => {
  test('root run produces legacy WARNs, zero FAILs — exit stays 0 until normalization', () => {
    const report = runModelRegistryValidation(REPO_ROOT);
    expect(report.isWorkspaceRoot).toBe(true);
    // §8.3 red-free invariant: holds before AND after the root agents normalize.
    expect(report.coverageFails).toEqual([]);
    expect(report.modelMismatches).toEqual([]);
    expect(report.proseMismatches).toEqual([]);
    // Root 9 normalized (PR-1d); L1 (2) + variants (148) still legacy until PR-2.
    expect(report.legacyBlockCount).toBe(0);
    expect(report.missingTierCount).toBe(0);
  });
});
