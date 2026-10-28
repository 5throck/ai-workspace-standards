/**
 * Tests for sync-agent-mirrors.ts — the agent-persona mirror generator and
 * blocking parity gate (spec docs/designs/2026-10-28-platform-agent-mirror-design.md,
 * DEC-20261028-06).
 *
 * Coverage (design §8 unit-test list):
 * - resolvePlatformModel against the REAL schema models block (high→opus,
 *   medium→sonnet, low→haiku) and id-format passthrough;
 * - frontmatter projection (name/description/model only) + body byte-preservation;
 * - extends-stub → resolved self-contained body (composer reuse);
 * - idempotent rerun (no writes);
 * - --check drift classes (missing / extra-managed / differing) each surfaced
 *   with the file named, and the CLI exiting 1;
 * - provenance-manifest adoption + never-remove-unknown + no/corrupt-manifest
 *   removes nothing;
 * - registry↔adapter coverage guard: row-without-adapter / adapter-without-row /
 *   supported:false-without-evidence each FAIL with a repair instruction;
 * - hard errors on SSOT files missing name / description / scalar tier;
 * - canonical-literal pin (script name, manifest, lock, registry key, composer
 *   import) — grep-level protection against identifier rot.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import {
  resolvePlatformModel,
  resolveTemplatesRoot,
  discoverTemplatesRoot,
  TEMPLATES_ROOT_MAX_ANCESTORS,
  assertRegistryAdapterCoverage,
  parseSsotAgent,
  listSsotAgents,
  readManagedManifest,
  syncAgentMirrors,
  loadWorkspaceSchema,
  PLATFORM_AGENT_ADAPTERS,
  type WorkspaceSchemaLike,
  type ModelRegistry,
} from '../../scripts/sync-agent-mirrors.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

const REPO_ROOT = path.resolve(import.meta.dir, '..', '..');
const SCRATCH = path.resolve(import.meta.dir, '..', '.temp', 'sync-agent-mirrors-test');
const GENERATOR_SRC = path.join(REPO_ROOT, 'scripts', 'sync-agent-mirrors.ts');

/** Minimal project fixture: real schema copy + variant.json + the given agents. */
function makeProject(agents: Record<string, string>, opts: { schema?: object; variant?: object } = {}): string {
  fs.mkdirSync(path.join(SCRATCH, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(SCRATCH, 'agents'), { recursive: true });
  const schemaSrc = opts.schema ?? JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8'));
  fs.writeFileSync(path.join(SCRATCH, 'docs', 'workspace-schema.json'), JSON.stringify(schemaSrc, null, 2), 'utf8');
  fs.writeFileSync(path.join(SCRATCH, 'variant.json'), JSON.stringify(opts.variant ?? { variant: 'co-test' }, null, 2), 'utf8');
  for (const [name, content] of Object.entries(agents)) {
    fs.writeFileSync(path.join(SCRATCH, 'agents', name), content, 'utf8');
  }
  return SCRATCH;
}

function mirrorDir(): string {
  return path.join(SCRATCH, '.claude', 'agents');
}

function readMirror(name: string): string {
  return fs.readFileSync(path.join(mirrorDir(), `${name}.md`), 'utf8');
}

const PM_SSOT = `---
name: pm
role: specialist
status: active
tier: medium
description: 'Project Manager orchestrating the gateway workflow'
lifecycle:
  phase: production
---

## Role

You are the PM agent. Dispatch specialists.
`;

const ARCHITECT_SSOT = `---
name: architect
tier: high
description: "Overall project structure design expert"
---

## Role

Design expert body.
`;

beforeEach(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));
afterEach(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));


describe('resolvePlatformModel (real schema models.claude)', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8')) as WorkspaceSchemaLike;
  const models = schema.models as ModelRegistry;

  test('claude high → opus (registry ID claude-opus-5-5 → alias)', () => {
    expect(resolvePlatformModel('claude', 'high', models)).toBe('opus');
  });
  test('claude medium → sonnet (registry ID claude-sonnet-5-5 → alias)', () => {
    expect(resolvePlatformModel('claude', 'medium', models)).toBe('sonnet');
  });
  test('claude low → haiku (registry ID claude-haiku-5-5 → alias)', () => {
    expect(resolvePlatformModel('claude', 'low', models)).toBe('haiku');
  });
  test('id-format passthrough renders the literal registry ID', () => {
    expect(resolvePlatformModel('claude', 'high', models, 'id')).toBe('claude-opus-5-5');
    expect(resolvePlatformModel('claude', 'medium', models, 'id')).toBe('claude-sonnet-5-5');
  });
  test('unknown platform / tier throws with the repair pointer', () => {
    expect(() => resolvePlatformModel('nonexistent', 'high', models)).toThrow(/models registry/);
    expect(() => resolvePlatformModel('claude', 'bogus', models)).toThrow(/no entry for tier/);
  });
});

describe('projection: frontmatter + body byte-preservation', () => {
  test('mirror carries name/description/model only, GENERATED marker, byte-identical body', () => {
    makeProject({ 'pm.md': PM_SSOT });
    const res = syncAgentMirrors(SCRATCH);
    expect(res.ok).toBe(true);
    // relative() yields platform-native separators (backslashes on win32 CI);
    // normalize the received paths so the expectation is byte-form, not path-form.
    expect(res.written.map((w) => w.split('\\').join('/'))).toEqual(['.claude/agents/pm.md']);
    const mirror = readMirror('pm');
    const lines = mirror.split('\n');
    expect(lines[0]).toBe('---');
    expect(lines[1]).toBe('name: pm');
    expect(lines[2]).toBe('description: "Project Manager orchestrating the gateway workflow"');
    expect(lines[3]).toBe('model: sonnet'); // registry-resolved from tier: medium
    expect(lines[4]).toBe('---');
    expect(mirror).toContain('<!-- GENERATED from agents/pm.md by scripts/sync-agent-mirrors.ts — do not edit; rerun the script. -->');
    // Body byte-preservation: the mirror ends with the fixture file's ACTUAL body
    // bytes, derived from a read-back of what the generator consumed — never from
    // a hardcoded \n literal. Windows CI checks this source out with CRLF, so the
    // fixture (and therefore the preserved body) may carry \r\n; the delimiter
    // split below mirrors the generator's own FM_RE semantics.
    const fixtureOnDisk = fs.readFileSync(path.join(SCRATCH, 'agents', 'pm.md'), 'utf8');
    const fixtureFm = fixtureOnDisk.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    const fixtureBody = fixtureOnDisk.slice(fixtureFm ? fixtureFm[0].length : 0);
    expect(fixtureBody.length).toBeGreaterThan(0);
    expect(mirror.endsWith(fixtureBody)).toBe(true);
    // The projection never leaks SSOT-only frontmatter into the mirror.
    expect(mirror).not.toMatch(/^role:/m);
    expect(mirror).not.toMatch(/^lifecycle:/m);
  });

  test('CRLF fixture: body bytes preserved verbatim, frontmatter stays generator-built LF', () => {
    // Pins the Windows-checkout scenario end to end: the fixture on disk carries
    // \r\n (what a CRLF checkout produces), the mirror body must carry the SAME
    // \r\n bytes, and the generator-built frontmatter stays \n regardless.
    const crlf = PM_SSOT.replace(/\n/g, '\r\n');
    makeProject({ 'pm.md': crlf });
    const res = syncAgentMirrors(SCRATCH);
    expect(res.ok).toBe(true);
    const mirror = readMirror('pm');
    const fixtureOnDisk = fs.readFileSync(path.join(SCRATCH, 'agents', 'pm.md'), 'utf8');
    const fixtureFm = fixtureOnDisk.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/)![0];
    const fixtureBody = fixtureOnDisk.slice(fixtureFm.length);
    expect(fixtureBody).toContain('\r\n');
    expect(mirror.endsWith(fixtureBody)).toBe(true);
    const fmLines = mirror.slice(0, mirror.indexOf('-->')).split('\n');
    expect(fmLines[1]).toBe('name: pm');
    expect(fmLines[3]).toBe('model: sonnet');
    expect(fmLines.join('\n')).not.toContain('\r');
  });

  test('description with quotes/colons is safely double-quoted', () => {
    makeProject({ 'a.md': '---\nname: a\ntier: low\ndescription: "says \\"hi\\": twice"\n---\n\nBody.\n' });
    syncAgentMirrors(SCRATCH);
    expect(readMirror('a')).toContain('description: "says \\"hi\\": twice"');
  });
});

describe('extends-stub projects as a self-contained resolved persona', () => {
  test('stub body resolves to the templates/common body, extends dropped', () => {
    makeProject({
      'docs-writer.md': '---\nname: docs-writer\ntier: low\ndescription: Stub docs writer\nextends: ../../common/agents/docs-writer.md\n---\n',
    });
    fs.mkdirSync(path.join(SCRATCH, 'templates', 'common', 'agents'), { recursive: true });
    fs.writeFileSync(
      path.join(SCRATCH, 'templates', 'common', 'agents', 'docs-writer.md'),
      '---\nname: docs-writer\ntier: low\ndescription: Common docs writer\n---\n\n## L1 Body\n\nCommon content.\n',
      'utf8',
    );
    const res = syncAgentMirrors(SCRATCH);
    expect(res.ok).toBe(true);
    const mirror = readMirror('docs-writer');
    expect(mirror).not.toMatch(/^extends:/m);
    expect(mirror).toContain('## L1 Body');
    expect(mirror).toContain('Common content.');
    expect(mirror).toContain('model: haiku');
  });

  test('stub with no L1 body available is a HARD error naming the file', () => {
    makeProject({
      'pm.md': '---\nname: pm\ntier: medium\ndescription: x\nextends: ../../common/agents/pm.md\n---\n',
    });
    // Deterministic missing-body fixture: an EMPTY templates override. (Plain
    // discovery would legitimately find the real workspace templates from a
    // scratch root inside the checkout — the co-newbiz canary fix — so the
    // not-found case is pinned through the validated explicit flag instead.)
    fs.mkdirSync(path.join(SCRATCH, 'templates', 'common', 'agents'), { recursive: true });
    expect(() => syncAgentMirrors(SCRATCH, { templatesRoot: path.join(SCRATCH, 'templates') }))
      .toThrow(/pm\.md.*L1 body is unavailable/);
  });

  test('the generator consumes the SAME composer upgrade-project uses (import identity)', () => {
    // Import-safety verification (design §4.2 stub rule): composeResolvedAgentContent
    // already lives in scripts/helpers/resolve-pm-stub.ts as a pure, read-only
    // function — no extraction needed; the generator's import is the same binding
    // upgrade-project.ts and adopt-project.ts consume.
    expect(typeof composeResolvedAgentContent).toBe('function');
    expect(PLATFORM_AGENT_ADAPTERS.claude).toBeDefined();
  });
});

describe('idempotency', () => {
  test('second write run changes nothing (no writes, mtimes stable)', () => {
    makeProject({ 'pm.md': PM_SSOT, 'architect.md': ARCHITECT_SSOT });
    syncAgentMirrors(SCRATCH);
    const before = fs.statSync(path.join(mirrorDir(), 'pm.md')).mtimeMs;
    const res2 = syncAgentMirrors(SCRATCH);
    expect(res2.written).toEqual([]);
    expect(res2.removed).toEqual([]);
    expect(res2.unchanged).toBe(2);
    expect(fs.statSync(path.join(mirrorDir(), 'pm.md')).mtimeMs).toBe(before);
  });
});


describe('--check drift classes', () => {
  beforeEach(() => {
    makeProject({ 'pm.md': PM_SSOT, 'architect.md': ARCHITECT_SSOT });
    syncAgentMirrors(SCRATCH);
  });

  test('differing: hand-edited mirror is reported with the file named', () => {
    fs.appendFileSync(path.join(mirrorDir(), 'pm.md'), 'tampered\n', 'utf8');
    const res = syncAgentMirrors(SCRATCH, { check: true });
    expect(res.ok).toBe(false);
    expect(res.drifts.map((d) => d.kind)).toContain('differing');
    const d = res.drifts.find((x) => x.kind === 'differing')!;
    expect(d.file).toContain(path.join('.claude', 'agents', 'pm.md'));
    expect(d.detail).toMatch(/differs/);
  });

  test('missing: deleted mirror is reported with the file named', () => {
    fs.rmSync(path.join(mirrorDir(), 'architect.md'));
    const res = syncAgentMirrors(SCRATCH, { check: true });
    expect(res.ok).toBe(false);
    const d = res.drifts.find((x) => x.kind === 'missing')!;
    expect(d.file).toContain(path.join('.claude', 'agents', 'architect.md'));
    expect(d.detail).toMatch(/has no mirror/);
  });

  test('extra-managed: recorded mirror whose SSOT counterpart is gone', () => {
    fs.rmSync(path.join(SCRATCH, 'agents', 'pm.md'));
    const res = syncAgentMirrors(SCRATCH, { check: true });
    expect(res.ok).toBe(false);
    const d = res.drifts.find((x) => x.kind === 'extra-managed')!;
    expect(d.file).toContain(path.join('.claude', 'agents', 'pm.md'));
    expect(d.detail).toMatch(/SSOT counterpart is gone/);
  });

  test('CLI --check exits 1 on drift and names the file (blocking-gate contract)', () => {
    fs.appendFileSync(path.join(mirrorDir(), 'pm.md'), 'tampered\n', 'utf8');
    const r = spawnSync(process.execPath, [GENERATOR_SRC, '--check', '--dir', SCRATCH], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    expect(out).toContain('pm.md');
    expect(out).toMatch(/Repair/);
  });
});

describe('provenance manifest', () => {
  test('adoption: first run over an existing same-name tree records and rewrites; unknown files never removed', () => {
    makeProject({ 'pm.md': PM_SSOT });
    fs.mkdirSync(mirrorDir(), { recursive: true });
    // Pre-existing: one stale same-name mirror (adopted by rewrite) and one
    // user-owned file with no SSOT counterpart (never removed).
    fs.writeFileSync(path.join(mirrorDir(), 'pm.md'), 'stale pre-mirror\n', 'utf8');
    fs.writeFileSync(path.join(mirrorDir(), 'my-custom-agent.md'), 'user content\n', 'utf8');
    const res = syncAgentMirrors(SCRATCH);
    expect(res.ok).toBe(true);
    expect(res.written).toHaveLength(1);
    expect(readMirror('pm')).toContain('model: sonnet');
    expect(fs.existsSync(path.join(mirrorDir(), 'my-custom-agent.md'))).toBe(true);
    expect(res.userFiles.join(' ')).toContain('my-custom-agent.md');
    const manifest = readManagedManifest(mirrorDir())!;
    expect(manifest.generated).toContain('pm');
    expect(manifest.generated).not.toContain('my-custom-agent');
  });

  test('removal: manifest-recorded mirror whose SSOT is gone is removed', () => {
    makeProject({ 'pm.md': PM_SSOT });
    syncAgentMirrors(SCRATCH); // records pm
    fs.rmSync(path.join(SCRATCH, 'agents', 'pm.md'));
    const res = syncAgentMirrors(SCRATCH);
    expect(res.removed.join(' ')).toContain('pm.md');
    expect(fs.existsSync(path.join(mirrorDir(), 'pm.md'))).toBe(false);
    expect(readManagedManifest(mirrorDir())!.generated).toEqual([]);
  });

  test('corrupt manifest: removes nothing', () => {
    makeProject({ 'pm.md': PM_SSOT });
    syncAgentMirrors(SCRATCH);
    fs.rmSync(path.join(SCRATCH, 'agents', 'pm.md'));
    fs.writeFileSync(path.join(mirrorDir(), '.sync-agent-mirrors-managed.json'), 'not json{', 'utf8');
    const res = syncAgentMirrors(SCRATCH);
    expect(res.removed).toEqual([]);
    expect(fs.existsSync(path.join(mirrorDir(), 'pm.md'))).toBe(true);
  });

  test('missing manifest: removals disabled; mirrors with generated names adopted by rewrite', () => {
    makeProject({ 'pm.md': PM_SSOT });
    syncAgentMirrors(SCRATCH);
    fs.rmSync(path.join(mirrorDir(), '.sync-agent-mirrors-managed.json'));
    fs.rmSync(path.join(SCRATCH, 'agents', 'pm.md'));
    const res = syncAgentMirrors(SCRATCH);
    expect(res.removed).toEqual([]);
    expect(fs.existsSync(path.join(mirrorDir(), 'pm.md'))).toBe(true);
  });
});


describe('registry-adapter coverage guard (B-PGW pattern)', () => {
  const baseRow = () => ({
    agents: { supported: false, evidence: 'none' },
    skills: { supported: true },
    commands: { supported: false, evidence: 'none' },
    hooks: { supported: false, evidence: 'none' },
  });

  test('FAIL: agents.supported:true row without an adapter', () => {
    const schema: WorkspaceSchemaLike = {
      platform_surfaces: {
        platforms: {
          gemini: {
            ...baseRow(),
            agents: { supported: true, mirror_dir: '.gemini/agents' },
          },
        },
      },
    };
    expect(() => assertRegistryAdapterCoverage(schema)).toThrow(/no 'gemini' adapter/);
    expect(() => assertRegistryAdapterCoverage(schema)).toThrow(/coverage guard FAILED/);
  });

  test('FAIL: adapter naming no supported row', () => {
    const schema: WorkspaceSchemaLike = {
      platform_surfaces: { platforms: { claude: { ...baseRow(), agents: { supported: false, evidence: 'flipped off' } } } },
    };
    expect(() => assertRegistryAdapterCoverage(schema)).toThrow(/names no agents\.supported:true registry row/);
  });

  test('FAIL: supported:false row without evidence', () => {
    const schema: WorkspaceSchemaLike = {
      platform_surfaces: {
        platforms: {
          claude: { ...baseRow(), agents: { supported: false } },
          zed: { agents: { supported: false }, skills: { supported: false }, commands: { supported: false }, hooks: { supported: false } },
        },
      },
    };
    expect(() => assertRegistryAdapterCoverage(schema)).toThrow(/without an "evidence" string/);
  });

  test('FAIL: missing block', () => {
    expect(() => assertRegistryAdapterCoverage({})).toThrow(/platform_surfaces block missing/);
  });

  test('FAIL: adapter emitting a field outside allowed_fields', () => {
    const schema: WorkspaceSchemaLike = {
      platform_surfaces: {
        platforms: {
          claude: {
            ...baseRow(),
            agents: { supported: true, mirror_dir: '.claude/agents', allowed_fields: ['name', 'description'] },
          },
        },
      },
    };
    expect(() => assertRegistryAdapterCoverage(schema)).toThrow(/outside platforms\.claude\.agents\.allowed_fields/);
  });

  test('PASS: the real schema + real adapters are in lockstep', () => {
    const schema = loadWorkspaceSchema(REPO_ROOT);
    expect(() => assertRegistryAdapterCoverage(schema)).not.toThrow();
  });
});

describe('SSOT hard errors (never a silent skip)', () => {
  test('missing name', () => {
    makeProject({ 'bad.md': '---\ntier: low\ndescription: x\n---\n\nBody.\n' });
    expect(() => syncAgentMirrors(SCRATCH)).toThrow(/bad\.md.*"name:"/);
  });
  test('missing description', () => {
    makeProject({ 'bad.md': '---\nname: bad\ntier: low\n---\n\nBody.\n' });
    expect(() => syncAgentMirrors(SCRATCH)).toThrow(/bad\.md.*"description:"/);
  });
  test('missing scalar tier (legacy map form hard-errors)', () => {
    makeProject({ 'bad.md': '---\nname: bad\ndescription: x\ntier:\n  claude: low\n---\n\nBody.\n' });
    expect(() => syncAgentMirrors(SCRATCH)).toThrow(/bad\.md.*tier: high\|medium\|low/);
  });
  test('parseSsotAgent warns and ignores a model: field in the SSOT input', () => {
    makeProject({ 'm.md': '---\nname: m\ntier: low\ndescription: x\nmodel: inherit\n---\n\nBody.\n' });
    const warnings: string[] = [];
    const agent = parseSsotAgent(path.join(SCRATCH, 'agents', 'm.md'), SCRATCH, warnings);
    expect(agent.tier).toBe('low');
    expect(warnings.some((w) => w.includes('m.md') && w.includes('model:'))).toBe(true);
    syncAgentMirrors(SCRATCH);
    expect(readMirror('m')).toContain('model: haiku'); // resolved, not "inherit"
  });
});

describe('root scoping', () => {
  test('a non-project root (no variant.json) is a green skipped no-op that creates nothing', () => {
    fs.mkdirSync(path.join(SCRATCH, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(SCRATCH, 'agents', 'pm.md'), PM_SSOT, 'utf8');
    fs.mkdirSync(path.join(SCRATCH, 'docs'), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), path.join(SCRATCH, 'docs', 'workspace-schema.json'));
    const res = syncAgentMirrors(SCRATCH);
    expect(res.skipped).toBe(true);
    expect(res.ok).toBe(true);
    expect(fs.existsSync(path.join(SCRATCH, '.claude'))).toBe(false);
  });

  test('README-class and _COMMON.md SSOT files are excluded from the roster', () => {
    makeProject({ 'pm.md': PM_SSOT, 'README.md': '# docs\n', 'README_ko.md': '# docs\n', '_COMMON.md': 'x\n' });
    expect(listSsotAgents(SCRATCH).map((p) => path.basename(p))).toEqual(['pm.md']);
  });
});

describe('templates-root discovery for stub resolution (canary finding)', () => {
  const L1_BODY_A = '---\nname: docs-writer\ntier: low\ndescription: Common docs writer\n---\n\n## L1 Body\n\nDiscovered ancestor body.\n';
  const L1_BODY_B = '---\nname: docs-writer\ntier: low\ndescription: Common docs writer\n---\n\n## L1 Body\n\nExplicit override body.\n';

  function seedTemplates(dir: string, body: string): void {
    fs.mkdirSync(path.join(dir, 'common', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'common', 'agents', 'docs-writer.md'), body, 'utf8');
  }

  function seedStandaloneProject(projectRoot: string, stubTarget: string): void {
    fs.mkdirSync(path.join(projectRoot, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, 'docs', 'workspace-schema.json'),
      fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8'),
      'utf8',
    );
    fs.writeFileSync(path.join(projectRoot, 'variant.json'), JSON.stringify({ variant: 'co-test' }), 'utf8');
    fs.writeFileSync(
      path.join(projectRoot, 'agents', 'docs-writer.md'),
      `---\nname: docs-writer\ntier: low\ndescription: Stub docs writer\nextends: ${stubTarget}\n---\n`,
      'utf8',
    );
  }

  test('project-context stub resolves via ancestor discovery (no flag)', () => {
    // Fixture mirrors the real fleet layout: the project sits NESTED under a
    // fleet root; templates/common lives at the fleet (workspace) root, an
    // ANCESTOR of the target root — never inside the project.
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../common/agents/docs-writer.md');
    const res = syncAgentMirrors(projectRoot);
    expect(res.ok).toBe(true);
    expect(res.written.map((w) => w.split('\\').join('/'))).toEqual(['.claude/agents/docs-writer.md']);
    const mirror = fs.readFileSync(path.join(projectRoot, '.claude', 'agents', 'docs-writer.md'), 'utf8');
    expect(mirror).toContain('Discovered ancestor body.');
    expect(mirror).not.toMatch(/^extends:/m);
    expect(mirror).toContain('model: haiku');
  });

  test('explicit --templates-root override takes precedence over discovery', () => {
    // BOTH bodies exist: discovery would find the fleet root copy, but the flag
    // names a different templates dir — the flag must win.
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    seedTemplates(path.join(SCRATCH, 'fleet', 'templates'), L1_BODY_B);
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../common/agents/docs-writer.md');
    const res = syncAgentMirrors(projectRoot, { templatesRoot: path.join(SCRATCH, 'fleet', 'templates') });
    expect(res.ok).toBe(true);
    const mirror = fs.readFileSync(path.join(projectRoot, '.claude', 'agents', 'docs-writer.md'), 'utf8');
    expect(mirror).toContain('Explicit override body.');
    expect(mirror).not.toContain('Discovered ancestor body.');
  });

  test('canary-shaped stub resolves via its OWN extends pointer (L0-roster style)', () => {
    // Mirrors Projects/co-newbiz: the stub extends a shared roster body N levels
    // outside the project — a path no templates convention could supply. No
    // templates/ tree exists anywhere in this fixture.
    const sharedBody = '---\nname: docs-writer\ntier: low\ndescription: Shared roster body\n---\n\n## Shared body\n\nRoster content.\n';
    fs.mkdirSync(path.join(SCRATCH, 'shared', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(SCRATCH, 'shared', 'agents', 'docs-writer.md'), sharedBody, 'utf8');
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../../../shared/agents/docs-writer.md');
    const res = syncAgentMirrors(projectRoot); // no flag, no templates tree anywhere
    expect(res.ok).toBe(true);
    const mirror = fs.readFileSync(path.join(projectRoot, '.claude', 'agents', 'docs-writer.md'), 'utf8');
    expect(mirror).toContain('Roster content.');
    expect(mirror).toContain('Stub docs writer'); // stub FM wins for name/description
    expect(mirror).toContain('model: haiku');
  });

  test('dangling extends AND incomplete convention: hard error names BOTH paths', () => {
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../nowhere/docs-writer.md'); // dangling pointer
    // Convention dir exists but lacks THIS agent's body -> the combined error
    // names the extends target and the convention path.
    fs.rmSync(path.join(SCRATCH, 'templates', 'common', 'agents', 'docs-writer.md'));
    let message = '';
    try {
      syncAgentMirrors(projectRoot, { templatesRoot: path.join(SCRATCH, 'templates') });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/L1 body is unavailable/);
    expect(message).toContain('nowhere');
    expect(message).toContain(path.join(SCRATCH, 'templates', 'common', 'agents', 'docs-writer.md'));
  });

  test('CLI --templates-root flag reaches the generator (spawn-level precedence)', () => {
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    seedTemplates(path.join(SCRATCH, 'fleet', 'templates'), L1_BODY_B);
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../common/agents/docs-writer.md');
    const r = spawnSync(process.execPath, [
      GENERATOR_SRC, '--dir', projectRoot, '--templates-root', path.join(SCRATCH, 'fleet', 'templates'),
    ], { encoding: 'utf8' });
    expect(r.status).toBe(0);
    const mirror = fs.readFileSync(path.join(projectRoot, '.claude', 'agents', 'docs-writer.md'), 'utf8');
    expect(mirror).toContain('Explicit override body.');
  });

  test('not-found discovery is a HARD error naming the searched ancestors', () => {
    // Standalone root OUTSIDE any workspace checkout (os.tmpdir chain), so the
    // bounded walk genuinely finds nothing.
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-tpl-notfound-'));
    try {
      const projectRoot = path.join(outside, 'Projects', 'co-x');
      seedStandaloneProject(projectRoot, '../../common/agents/docs-writer.md');
      let message = '';
      try {
        syncAgentMirrors(projectRoot);
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/templates\/common\/agents not found walking up/);
      expect(message).toContain(projectRoot);
      expect(message).toContain('searched:');
      expect(message).toContain('--templates-root');
      expect(fs.existsSync(path.join(projectRoot, '.claude'))).toBe(false);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  test('explicit override that lacks common/agents is a hard error naming the path', () => {
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    const projectRoot = path.join(SCRATCH, 'fleet', 'Projects', 'co-x');
    seedStandaloneProject(projectRoot, '../../common/agents/docs-writer.md');
    const bogus = path.join(SCRATCH, 'not-templates');
    fs.mkdirSync(bogus, { recursive: true });
    expect(() => syncAgentMirrors(projectRoot, { templatesRoot: bogus }))
      .toThrow(/does not contain common\/agents/);
  });

  test('resolveTemplatesRoot stops at the FIRST ancestor carrying templates/common/agents', () => {
    seedTemplates(path.join(SCRATCH, 'templates'), L1_BODY_A);
    expect(resolveTemplatesRoot(path.join(SCRATCH, 'fleet', 'Projects', 'co-x'))).toBe(path.join(SCRATCH, 'templates'));
    // Target root itself carrying the tree wins immediately (L0-style layout).
    expect(resolveTemplatesRoot(SCRATCH)).toBe(path.join(SCRATCH, 'templates'));
  });

  test('the ancestor walk is bounded', () => {
    expect(TEMPLATES_ROOT_MAX_ANCESTORS).toBeGreaterThan(2);
    expect(TEMPLATES_ROOT_MAX_ANCESTORS).toBeLessThan(32);
  });
});


describe('out-of-root CHECK degrade (T-20261029-008)', () => {
  // A real standalone checkout: os.tmpdir() guarantees no ancestor carries
  // templates/common/agents (the CI-runner condition).
  function seedIsolatedProject(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sam-out-of-root-'));
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'workspace-schema.json'),
      fs.readFileSync(path.join(REPO_ROOT, 'docs', 'workspace-schema.json'), 'utf8'), 'utf8');
    fs.writeFileSync(path.join(root, 'variant.json'), JSON.stringify({ variant: 'co-test' }), 'utf8');
    fs.writeFileSync(
      path.join(root, 'agents', 'docs-writer.md'),
      `---\nname: docs-writer\ntier: low\ndescription: Stub docs writer\nextends: ../../common/agents/docs-writer.md\n---\n`,
      'utf8',
    );
    return root;
  }

  test('discoverTemplatesRoot returns null searched out-of-root and the root under a workspace', () => {
    const root = seedIsolatedProject();
    try {
      expect(discoverTemplatesRoot(root).root).toBeNull();
      expect(discoverTemplatesRoot(REPO_ROOT).root).toBe(path.join(REPO_ROOT, 'templates'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('CHECK mode degrades to a green WARN when mirrors exist but no root is discoverable', () => {
    const root = seedIsolatedProject();
    try {
      const mirrorDirPath = path.join(root, '.claude', 'agents');
      fs.mkdirSync(mirrorDirPath, { recursive: true });
      fs.writeFileSync(path.join(mirrorDirPath, 'docs-writer.md'), 'generated out-of-root earlier\n', 'utf8');
      const res = syncAgentMirrors(root, { check: true });
      expect(res.ok).toBe(true);
      expect(res.skipped).toBe(true);
      expect(res.warnings.join(' ')).toMatch(/T-20261029-008/);
      expect(res.warnings.join(' ')).toMatch(/cannot be verified out-of-root/);
      expect(res.notes[0]).toMatch(/^WARN:/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('CLI --check exits 0 with the WARN on stdout (gate-lifting contract)', () => {
    const root = seedIsolatedProject();
    try {
      const mirrorDirPath = path.join(root, '.claude', 'agents');
      fs.mkdirSync(mirrorDirPath, { recursive: true });
      fs.writeFileSync(path.join(mirrorDirPath, 'docs-writer.md'), 'generated out-of-root earlier\n', 'utf8');
      const r = spawnSync(process.execPath, [GENERATOR_SRC, '--check', '--dir', root], { encoding: 'utf8' });
      expect(r.status).toBe(0);
      expect(r.stdout ?? '').toContain('WARN:');
      expect(r.stdout ?? '').toContain('T-20261029-008');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('CHECK mode still hard-fails with no root and no mirrors (unverifiable is not green)', () => {
    const root = seedIsolatedProject();
    try {
      expect(() => syncAgentMirrors(root, { check: true })).toThrow(/templates\/common\/agents not found/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('WRITE mode keeps the hard error even when mirrors exist (deliberate write, never auto-repair)', () => {
    const root = seedIsolatedProject();
    try {
      const mirrorDirPath = path.join(root, '.claude', 'agents');
      fs.mkdirSync(mirrorDirPath, { recursive: true });
      fs.writeFileSync(path.join(mirrorDirPath, 'docs-writer.md'), 'generated out-of-root earlier\n', 'utf8');
      expect(() => syncAgentMirrors(root, {})).toThrow(/templates\/common\/agents not found/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('canonical-literal pin (identifier-rot protection)', () => {
  const src = fs.readFileSync(GENERATOR_SRC, 'utf8');
  test('the generator names the design-canonical files and keys byte-exactly', () => {
    expect(src).toContain("const SCRIPT_NAME = 'sync-agent-mirrors.ts';");
    expect(src).toContain("const MIRROR_MANIFEST_NAME = '.sync-agent-mirrors-managed.json';");
    expect(src).toContain("const LOCK_NAME = '.sync-agent-mirrors.lock';");
    expect(src).toContain("const REGISTRY_BLOCK = 'platform_surfaces';");
    expect(src).toContain("from './helpers/resolve-pm-stub.ts'");
    expect(src).toContain('composeResolvedAgentContent');
    expect(src).toContain("'--check'");
    expect(src).toContain("'--dir'");
  });
});
