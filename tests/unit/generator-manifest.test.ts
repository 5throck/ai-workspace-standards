#!/usr/bin/env bun
// @version 1.0.0
// generator-manifest.test.ts — loader/runner pins for the variant generator
// manifest convention (U-20261029-004 — spec
// docs/designs/2026-10-31-variant-generators-design.md §8).
//
// Covers: pure parse accept/reject classes (valid manifest; `{}` empty
// no-op; malformed JSON; non-array / wrong-argv0 command; absolute and `..`
// path rejection; duplicate names; size caps; outputs/sources shape),
// absent-manifest no-op, fs-bound containment (missing script, symlink
// escape), execution + output staging against a real temp git repo, loud
// failure on generator error (FAIL row names the generator, secret-scrubbed
// output, no partial staging, later generators never run), and the
// `--check`-stays-drift-gate rule (a generator that exits 0 but writes
// nothing still leaves the drift gate in control — staging integrity /
// output-missing FAIL here, drift FAIL at the audit).

import { describe, test, expect, afterAll } from 'bun:test';
import {
  parseGeneratorManifest,
  pathContainmentError,
  loadGeneratorManifests,
  validateManifestAgainstRoot,
  runDeclaredGenerators,
  scrubSecretLines,
  failureOutputDetail,
  MAX_GENERATORS,
  MAX_OUTPUTS,
  type GeneratorManifest,
} from '../../scripts/lib/generator-manifest.ts';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// Temp project scaffolding
// ---------------------------------------------------------------------------

const tempRoots: string[] = [];

function makeProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'gen-manifest-test-'));
  tempRoots.push(root);
  return root;
}

afterAll(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

function writeManifest(root: string, dirName: string, content: string): string {
  const dir = join(root, 'scripts', dirName);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, 'generators.json');
  writeFileSync(p, content, 'utf-8');
  return p;
}

function writeScript(root: string, rel: string, body: string): string {
  const abs = join(root, rel);
  mkdirSync(join(abs, '..'), { recursive: true });
  writeFileSync(abs, body, 'utf-8');
  return abs;
}

function gitInit(root: string): void {
  const res = spawnSync('git', ['init', '-q'], { cwd: root });
  if (res.status !== 0) throw new Error(`git init failed in ${root}`);
  // A generator output staged by runDeclaredGenerators needs a commit-able repo;
  // user identity is irrelevant for `git add` but set it for safety.
  spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  spawnSync('git', ['config', 'user.name', 'test'], { cwd: root });
}

const VALID_MANIFEST = JSON.stringify({
  version: 1,
  generators: [
    {
      name: 'glossary-data',
      command: ['bun', 'scripts/co-x/generate-glossary.ts'],
      outputs: ['lib/glossary-data.generated.ts'],
      sources: ['glossary/business.yaml'],
    },
  ],
});

// ---------------------------------------------------------------------------
// Pure parse — accept cases
// ---------------------------------------------------------------------------

describe('parseGeneratorManifest — accept', () => {
  test('valid manifest parses with all fields preserved', () => {
    const r = parseGeneratorManifest(VALID_MANIFEST);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.version).toBe(1);
    expect(r.manifest.generators).toHaveLength(1);
    expect(r.manifest.generators[0].name).toBe('glossary-data');
    expect(r.manifest.generators[0].command).toEqual(['bun', 'scripts/co-x/generate-glossary.ts']);
    expect(r.manifest.generators[0].outputs).toEqual(['lib/glossary-data.generated.ts']);
    expect(r.manifest.generators[0].sources).toEqual(['glossary/business.yaml']);
  });

  test('empty object {} is the canonical empty manifest (documented no-op)', () => {
    const r = parseGeneratorManifest('{}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.generators).toHaveLength(0);
  });

  test('generators: [] is a valid empty manifest', () => {
    const r = parseGeneratorManifest(JSON.stringify({ version: 1, generators: [] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.generators).toHaveLength(0);
  });

  test('empty sources array is valid (sources advisory)', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['out.txt'], sources: [] }],
    }));
    expect(r.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Pure parse — reject cases (design §8)
// ---------------------------------------------------------------------------

describe('parseGeneratorManifest — reject', () => {
  test('malformed JSON is rejected naming the parse error', () => {
    const r = parseGeneratorManifest('{"version": 1, "generators": [');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('malformed JSON');
  });

  test('non-object manifest (array) is rejected', () => {
    const r = parseGeneratorManifest('[]');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('must be a JSON object');
  });

  test('unsupported manifest version is rejected', () => {
    const r = parseGeneratorManifest(JSON.stringify({ version: 2, generators: [] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('unsupported manifest version');
  });

  test('generators missing or non-array is rejected', () => {
    expect(parseGeneratorManifest(JSON.stringify({ version: 1 })).ok).toBe(false);
    const r = parseGeneratorManifest(JSON.stringify({ version: 1, generators: 'x' }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('generators must be an array');
  });

  test('non-array command is rejected', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: 'bun scripts/x.ts', outputs: ['o.txt'], sources: [] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('command must be a non-empty argv array');
  });

  test('command argv[0] other than bun is rejected (sh -c class)', () => {
    for (const argv0 of ['sh', 'bash', '/usr/bin/bun', 'bun.exe', 'node']) {
      const r = parseGeneratorManifest(JSON.stringify({
        version: 1,
        generators: [{ name: 'a', command: [argv0, 'scripts/x.ts'], outputs: ['o.txt'], sources: [] }],
      }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain('argv[0] must be "bun"');
    }
  });

  test('absolute output path is rejected', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['/etc/passwd'], sources: [] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('absolute path rejected');
  });

  test('.. traversal in outputs, sources, and command is rejected', () => {
    for (const [field, value] of [
      ['outputs', ['../escape.txt']],
      ['sources', ['../../secrets.yaml']],
      ['command', ['bun', '../../outside.ts']],
    ] as const) {
      const entry: Record<string, unknown> = {
        name: 'a',
        command: field === 'command' ? value : ['bun', 'scripts/co-x/a.ts'],
        outputs: field === 'outputs' ? value : ['out.txt'],
        sources: field === 'sources' ? value : [],
      };
      const r = parseGeneratorManifest(JSON.stringify({ version: 1, generators: [entry] }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("path traversal ('..') rejected");
    }
  });

  test('duplicate generator names within one manifest are rejected', () => {
    const gen = { name: 'dup', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['o.txt'], sources: [] };
    const r = parseGeneratorManifest(JSON.stringify({ version: 1, generators: [gen, gen] }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('duplicate generator name: dup');
  });

  test('size caps: > 16 generators rejected', () => {
    const gens = Array.from({ length: MAX_GENERATORS + 1 }, (_, i) => ({
      name: `g${i}`,
      command: ['bun', 'scripts/co-x/a.ts'],
      outputs: ['o.txt'],
      sources: [],
    }));
    const r = parseGeneratorManifest(JSON.stringify({ version: 1, generators: gens }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain(`too many generators: ${MAX_GENERATORS + 1}`);
  });

  test('size caps: > 8 outputs rejected (validation error, not truncation)', () => {
    const outs = Array.from({ length: MAX_OUTPUTS + 1 }, (_, i) => `out${i}.txt`);
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: outs, sources: [] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain(`too many outputs: ${MAX_OUTPUTS + 1}`);
  });

  test('invalid generator name charset is rejected (name labels log rows)', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'bad name;', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['o.txt'], sources: [] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('.name must match');
  });

  test('outputs: [] (no declared outputs) is rejected', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: [], sources: [] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('outputs must be a non-empty array');
  });

  test('missing sources key is rejected (declared shape is { name, command, outputs, sources })', () => {
    const r = parseGeneratorManifest(JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['o.txt'] }],
    }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain('.sources is required');
  });
});

// ---------------------------------------------------------------------------
// Lexical containment helper
// ---------------------------------------------------------------------------

describe('pathContainmentError', () => {
  test('project-relative paths pass', () => {
    expect(pathContainmentError('/proj', 'lib/out.generated.ts')).toBeNull();
    expect(pathContainmentError('/proj', 'scripts/co-x/gen.ts')).toBeNull();
  });

  test('empty path rejected', () => {
    expect(pathContainmentError('/proj', '')).toContain('empty');
  });

  test('path resolving to the root itself rejected', () => {
    expect(pathContainmentError('/proj', '.')).toContain('project root itself');
  });
});

// ---------------------------------------------------------------------------
// Loader (fs-bound)
// ---------------------------------------------------------------------------

describe('loadGeneratorManifests', () => {
  test('absent manifest → empty no-op result (zero errors)', () => {
    const root = makeProject();
    mkdirSync(join(root, 'scripts'), { recursive: true });
    const r = loadGeneratorManifests(root);
    expect(r.manifests).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  test('no scripts/ dir at all → empty no-op result', () => {
    const root = makeProject();
    const r = loadGeneratorManifests(root);
    expect(r.manifests).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  test('discovers scripts/<variant>/generators.json and resolves script existence', () => {
    const root = makeProject();
    writeScript(root, 'scripts/co-x/generate-glossary.ts', 'console.log("hi");\n');
    writeManifest(root, 'co-x', VALID_MANIFEST);
    const r = loadGeneratorManifests(root);
    expect(r.errors).toHaveLength(0);
    expect(r.manifests).toHaveLength(1);
    expect(r.manifests[0].dirName).toBe('co-x');
    expect(r.manifests[0].manifest.generators[0].name).toBe('glossary-data');
  });

  test('declared command script that does not exist is a loud load error', () => {
    const root = makeProject();
    writeManifest(root, 'co-x', VALID_MANIFEST); // script never written
    const r = loadGeneratorManifests(root);
    expect(r.manifests).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('command script does not exist');
  });

  test('symlink-escaped script path is rejected at declaration-load time (design §7.2)', () => {
    const root = makeProject();
    const outside = mkdtempSync(join(tmpdir(), 'gen-manifest-outside-'));
    tempRoots.push(outside);
    const outsideScript = join(outside, 'evil.ts');
    writeFileSync(outsideScript, 'console.log("pwned");\n', 'utf-8');
    mkdirSync(join(root, 'scripts', 'co-x'), { recursive: true });
    symlinkSync(outsideScript, join(root, 'scripts', 'co-x', 'generate-glossary.ts'));
    writeManifest(root, 'co-x', VALID_MANIFEST);
    const r = loadGeneratorManifests(root);
    expect(r.manifests).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain('symlink');
  });

  test('duplicate names across two manifests are rejected globally', () => {
    const root = makeProject();
    writeScript(root, 'scripts/co-x/a.ts', 'process.exit(0);\n');
    writeScript(root, 'scripts/co-y/a.ts', 'process.exit(0);\n');
    const manifest = {
      version: 1,
      generators: [{ name: 'same-name', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['o.txt'], sources: [] }],
    };
    writeManifest(root, 'co-x', JSON.stringify(manifest));
    writeManifest(root, 'co-y', JSON.stringify({ ...manifest, generators: [{ ...manifest.generators[0], command: ['bun', 'scripts/co-y/a.ts'] }] }));
    const r = loadGeneratorManifests(root);
    expect(r.errors.some((e) => e.message.includes('duplicate generator name "same-name" across manifests'))).toBe(true);
  });

  test('validateManifestAgainstRoot flags an existing symlinked output', () => {
    const root = makeProject();
    const outside = mkdtempSync(join(tmpdir(), 'gen-manifest-outside2-'));
    tempRoots.push(outside);
    writeFileSync(join(outside, 'out.ts'), 'x', 'utf-8');
    mkdirSync(join(root, 'lib'), { recursive: true });
    symlinkSync(join(outside, 'out.ts'), join(root, 'lib', 'out.generated.ts'));
    const manifest: GeneratorManifest = {
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['lib/out.generated.ts'], sources: [] }],
    };
    writeScript(root, 'scripts/co-x/a.ts', 'process.exit(0);\n');
    const errs = validateManifestAgainstRoot(root, manifest);
    expect(errs.some((e) => e.includes('output escapes the project root through a symlink'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Secret scrubbing (design §7.5)
// ---------------------------------------------------------------------------

describe('scrubSecretLines / failureOutputDetail', () => {
  test('secret value assignments are elided regardless of key style', () => {
    const { lines, redacted } = scrubSecretLines([
      'API_KEY=abc123',
      'password: hunter2',
      'export TOKEN="ghp_xxx"',
      'my credential = super-secret',
      'ERROR: missing config file',
      'secret note without assignment',
    ].join('\n'));
    expect(lines).toEqual(['ERROR: missing config file', 'secret note without assignment']);
    expect(redacted).toBe(4);
  });

  test('failureOutputDetail keeps only the last 20 scrubbed lines', () => {
    const raw = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n') + '\nTOKEN=leak';
    const { detail, redacted } = failureOutputDetail(raw);
    expect(redacted).toBe(1);
    const detailLines = detail.split('\n');
    expect(detailLines).toHaveLength(20);
    expect(detailLines[0]).toBe('line 10');
    expect(detail).not.toContain('TOKEN');
  });
});

// ---------------------------------------------------------------------------
// Runner — execution, staging, loud failures (design §4/§5/§8)
// ---------------------------------------------------------------------------

describe('runDeclaredGenerators', () => {
  test('absent manifest → clean no-op, ran 0, ok', () => {
    const root = makeProject();
    mkdirSync(join(root, 'scripts'), { recursive: true });
    const logs: string[] = [];
    const r = runDeclaredGenerators({ projectRoot: root, log: (l) => logs.push(l) });
    expect(r.ok).toBe(true);
    expect(r.ran).toBe(0);
    expect(r.staged).toHaveLength(0);
    expect(r.failures).toHaveLength(0);
    expect(logs).toHaveLength(0); // byte-silent no-op
  });

  test('empty manifest ({} / generators: []) → clean no-op', () => {
    const root = makeProject();
    writeManifest(root, 'co-x', '{}');
    const r = runDeclaredGenerators({ projectRoot: root });
    expect(r.ok).toBe(true);
    expect(r.ran).toBe(0);
  });

  test('fixture generator runs, writes its output, and the output is staged (real spawn + real git add)', () => {
    const root = makeProject();
    gitInit(root);
    writeScript(root, 'scripts/co-x/generate-glossary.ts', [
      `import { writeFileSync, mkdirSync } from 'node:fs';`,
      `import { join } from 'node:path';`,
      `mkdirSync(join(import.meta.dir, '..', '..', 'lib'), { recursive: true });`,
      `writeFileSync(join(import.meta.dir, '..', '..', 'lib', 'glossary-data.generated.ts'), '// generated\\n', 'utf-8');`,
      `console.log('generated ok');`,
    ].join('\n'));
    writeManifest(root, 'co-x', VALID_MANIFEST);
    const r = runDeclaredGenerators({ projectRoot: root });
    expect(r.ok).toBe(true);
    expect(r.ran).toBe(1);
    expect(r.staged).toEqual(['lib/glossary-data.generated.ts']);
    expect(existsSync(join(root, 'lib', 'glossary-data.generated.ts'))).toBe(true);
    // Staged as pipeline-generated files (matching the regeneration family convention).
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root });
    expect(staged.stdout.toString().trim()).toBe('lib/glossary-data.generated.ts');
  });

  test('failing generator → loud [generator:<name>] FAIL, scrubbed output, non-ok, later generators never run', () => {
    const root = makeProject();
    gitInit(root);
    writeScript(root, 'scripts/co-x/a-fail.ts', [
      `console.log('API_KEY=super-secret-value');`,
      `console.error('password=hunter2');`,
      `console.error('boom: generator crashed');`,
      `process.exit(3);`,
    ].join('\n'));
    writeScript(root, 'scripts/co-x/b-ok.ts', `console.log('should never run');\n`);
    writeManifest(root, 'co-x', JSON.stringify({
      version: 1,
      generators: [
        { name: 'a-fail', command: ['bun', 'scripts/co-x/a-fail.ts'], outputs: ['lib/a.generated.ts'], sources: [] },
        { name: 'b-ok', command: ['bun', 'scripts/co-x/b-ok.ts'], outputs: ['lib/b.generated.ts'], sources: [] },
      ],
    }));
    const logs: string[] = [];
    const r = runDeclaredGenerators({ projectRoot: root, log: (l) => logs.push(l) });
    expect(r.ok).toBe(false);
    expect(r.ran).toBe(1); // a-fail ran; b-ok never did
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0].generator).toBe('a-fail');
    expect(r.failures[0].reason).toBe('exit');
    const failRows = logs.filter((l) => l.includes('[generator:a-fail] FAIL'));
    expect(failRows).toHaveLength(1);
    const allOutput = logs.join('\n');
    expect(allOutput).toContain('boom: generator crashed'); // non-secret detail preserved
    expect(allOutput).not.toContain('super-secret-value'); // scrubbed
    expect(allOutput).not.toContain('hunter2'); // scrubbed
    expect(allOutput).toContain('redacted'); // redaction surfaced
    expect(allOutput).not.toContain('[generator:b-ok]'); // aborted before the next generator
    expect(r.staged).toHaveLength(0); // no partial staging from the failed generator
  });

  test('generator exits 0 but writes nothing → output-missing FAIL (staging integrity; the audit drift gate stays in control)', () => {
    const root = makeProject();
    gitInit(root);
    writeScript(root, 'scripts/co-x/liar.ts', `console.log('did nothing');\n`);
    writeManifest(root, 'co-x', JSON.stringify({
      version: 1,
      generators: [{ name: 'liar', command: ['bun', 'scripts/co-x/liar.ts'], outputs: ['lib/liar.generated.ts'], sources: [] }],
    }));
    const logs: string[] = [];
    const r = runDeclaredGenerators({ projectRoot: root, log: (l) => logs.push(l) });
    expect(r.ok).toBe(false);
    expect(r.ran).toBe(1);
    expect(r.failures[0].reason).toBe('output-missing');
    expect(logs.join('\n')).toContain('declared output missing after exit 0');
    expect(r.staged).toHaveLength(0);
    // The declared output is still absent → the project's own --check drift gate
    // would fail at the audit; the step never papers over a lying generator.
    expect(existsSync(join(root, 'lib', 'liar.generated.ts'))).toBe(false);
  });

  test('manifest validation error → loud manifest FAIL, nothing executes', () => {
    const root = makeProject();
    writeManifest(root, 'co-x', '{"version": 1, "generators": ['); // malformed JSON
    const logs: string[] = [];
    const r = runDeclaredGenerators({ projectRoot: root, log: (l) => logs.push(l) });
    expect(r.ok).toBe(false);
    expect(r.ran).toBe(0);
    expect(r.failures[0].reason).toBe('manifest');
    expect(logs.join('\n')).toContain('malformed JSON');
  });

  test('stage failure → loud FAIL naming the generator, no ok', () => {
    const root = makeProject();
    writeScript(root, 'scripts/co-x/a.ts', `console.log('ok');\n`);
    writeManifest(root, 'co-x', JSON.stringify({
      version: 1,
      generators: [{ name: 'a', command: ['bun', 'scripts/co-x/a.ts'], outputs: ['lib/a.generated.ts'], sources: [] }],
    }));
    // The generator itself must create the output for the run to reach the stage call.
    // Reuse the injected spawn to write it on demand: simplest is a real generator body.
    writeFileSync(join(root, 'scripts/co-x/a.ts'), [
      `import { writeFileSync, mkdirSync } from 'node:fs';`,
      `import { join } from 'node:path';`,
      `mkdirSync(join(import.meta.dir, '..', '..', 'lib'), { recursive: true });`,
      `writeFileSync(join(import.meta.dir, '..', '..', 'lib', 'a.generated.ts'), 'x', 'utf-8');`,
    ].join('\n'), 'utf-8');
    const logs: string[] = [];
    const r = runDeclaredGenerators({
      projectRoot: root,
      log: (l) => logs.push(l),
      stage: () => ({ exitCode: 128, stderr: 'fatal: not a git repository' }),
    });
    expect(r.ok).toBe(false);
    expect(r.failures[0].reason).toBe('stage');
    expect(r.failures[0].generator).toBe('a');
    expect(logs.join('\n')).toContain('git add failed');
  });
});

// ---------------------------------------------------------------------------
// `--check` interplay (brief deliverable 6): drift still fails the audit when
// outputs are stale without a generator run — the loader never touches the
// audit path, so the pin is that the loaded manifest carries sources for the
// audit's drift surface and the runner stages regenerated bytes (git sees them).
// ---------------------------------------------------------------------------

describe('--check-stays-drift-gate contract', () => {
  test('re-running the runner stages NEW bytes (git sees the regenerated projection, the audit gate judges it)', () => {
    const root = makeProject();
    gitInit(root);
    const genBody = (stamp: string) => [
      `import { writeFileSync, mkdirSync } from 'node:fs';`,
      `import { join } from 'node:path';`,
      `mkdirSync(join(import.meta.dir, '..', '..', 'lib'), { recursive: true });`,
      `writeFileSync(join(import.meta.dir, '..', '..', 'lib', 'g.generated.ts'), '// stamp ${stamp}\\n', 'utf-8');`,
    ].join('\n');
    writeScript(root, 'scripts/co-x/generate.ts', genBody('1'));
    writeManifest(root, 'co-x', JSON.stringify({
      version: 1,
      generators: [{ name: 'g', command: ['bun', 'scripts/co-x/generate.ts'], outputs: ['lib/g.generated.ts'], sources: ['glossary/business.yaml'] }],
    }));
    const first = runDeclaredGenerators({ projectRoot: root });
    expect(first.ok).toBe(true);
    spawnSync('git', ['add', '-A'], { cwd: root });
    spawnSync('git', ['commit', '-qm', 'baseline'], { cwd: root });
    // Source "changes" → generator rewritten → runner regenerates and re-stages.
    writeScript(root, 'scripts/co-x/generate.ts', genBody('2'));
    const second = runDeclaredGenerators({ projectRoot: root });
    expect(second.ok).toBe(true);
    const diff = spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: root });
    expect(diff.stdout.toString().trim()).toBe('lib/g.generated.ts');
    expect(readFileSync(join(root, 'lib', 'g.generated.ts'), 'utf-8')).toContain('stamp 2');
  });
});
