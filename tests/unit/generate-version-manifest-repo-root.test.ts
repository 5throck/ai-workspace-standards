import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 2026-10-01 project review H1 regression: every git spawn in the manifest
// generator runs against the resolved repo root (`git rev-parse --show-toplevel`
// from the script's own directory), not the process cwd. Spawning the collector
// logic from a subdirectory must yield the same tracked set as from the root —
// previously the subdirectory invocation silently narrowed `git ls-files` to
// that subtree and corrupted the drift gate.

// fileURLToPath: .pathname yields "/D:/a/..." on Windows, which bun cannot resolve.
const SCRIPT = (() => {
  const { fileURLToPath } = require('node:url') as typeof import('node:url');
  return fileURLToPath(new URL('../../scripts/generate-version-manifest.ts', import.meta.url));
})();

function runCollectorFrom(cwd: string): { root: string; tracked: string[] | null } {
    const code = [
        `const m = await import(${JSON.stringify(SCRIPT)});`,
        'const root = m.resolveRepoRoot();',
        'const tracked = m.getTrackedFiles();',
        'console.log(JSON.stringify({ root, tracked: tracked ? [...tracked] : null }));',
    ].join('\n');
    const proc = Bun.spawnSync(['bun', '-e', code], { cwd, stdout: 'pipe', stderr: 'pipe' });
    if (proc.exitCode !== 0) {
        throw new Error(`collector subprocess failed: ${proc.stderr.toString()}`);
    }
    const out = (proc.stdout.toString().trim().split('\n').pop() ?? '').trim();
    return JSON.parse(out);
}

function initGitRepo(dir: string): string {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'placeholder.txt'), 'x');
    mkdirSync(join(dir, 'inner', 'deep'), { recursive: true });
    writeFileSync(join(dir, 'inner', 'deep', 'y.txt'), 'y');
    Bun.spawnSync(['git', 'init', '-q'], { cwd: dir });
    Bun.spawnSync(['git', '-C', dir, 'config', 'user.email', 'test@example.com']);
    Bun.spawnSync(['git', '-C', dir, 'config', 'user.name', 'Test']);
    Bun.spawnSync(['git', '-C', dir, 'add', '.']);
    const c = Bun.spawnSync(['git', '-C', dir, 'commit', '-q', '-m', 'fixture']);
    return c.exitCode === 0 ? dir : dir;
}

function normalize(p: string): string {
    // `git rev-parse --show-toplevel` prints a resolved path; macOS /tmp is a
    // symlink to /private/tmp, so resolve before comparing.
    return require('node:fs').realpathSync(p);
}

test('collector spawned from a subdirectory sees the same repo root and tracked set as from the root', () => {
    mkdirSync(join(process.cwd(), 'tests', '.temp'), { recursive: true });
    const fixtureRoot = mkdtempSync(join(process.cwd(), 'tests', '.temp', 'repo-root-'));
    try {
        initGitRepo(fixtureRoot);
        const inner = join(fixtureRoot, 'inner', 'deep');
        const fromRoot = runCollectorFrom(fixtureRoot);
        const fromSub = runCollectorFrom(inner);
        expect(fromSub.root).toBe(normalize(fromRoot.root));
        expect(normalize(fromSub.root)).toBe(normalize(fixtureRoot));
        expect(fromSub.tracked).toEqual(fromRoot.tracked);
        expect(fromRoot.tracked).toContain('scripts/placeholder.txt');
        expect(fromRoot.tracked).toContain('inner/deep/y.txt');
    } finally {
        rmSync(fixtureRoot, { recursive: true, force: true });
    }
});

test('getTrackedFiles is fail-open (null) outside a git repository; resolveRepoRoot falls back to process.cwd()', () => {
    const nonRepo = mkdtempSync(join(tmpdir(), 'nonrepo-'));
    try {
        const r = runCollectorFrom(nonRepo);
        expect(normalize(r.root)).toBe(normalize(nonRepo));
        expect(r.tracked).toBeNull();
    } finally {
        rmSync(nonRepo, { recursive: true, force: true });
    }
});
