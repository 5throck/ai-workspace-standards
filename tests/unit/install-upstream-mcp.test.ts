// @version 1.0.0
/**
 * Tests for scripts/install-upstream-mcp.ts. Every run is the REAL installer as a subprocess with
 * UPSTREAM_INSTALL_HOME pointing at a temp home (and a fake `codex` first on PATH), so the user's
 * real client configs are never read or written.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, chmodSync, realpathSync, statSync, lstatSync, symlinkSync } from 'node:fs';
import { tmpdir, platform } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { load, JSON_SCHEMA } from 'js-yaml';

const REPO_ROOT = resolve(import.meta.dir, '..', '..');
const installer = join(REPO_ROOT, 'scripts', 'install-upstream-mcp.ts');
const NAME = 'ai-workspace-upstream';
const IS_WIN = platform() === 'win32';

let home: string;
let binDir: string;

function desktopPath(): string {
  if (platform() === 'darwin') return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  if (IS_WIN) return join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
  return join(home, 'no-claude-desktop-on-this-platform');
}
const claudePath = () => join(home, '.claude.json');
const antigravityPath = () => join(home, '.gemini', 'config', 'mcp_config.json');
const geminiPath = () => join(home, '.gemini', 'settings.json');
const hermesPath = () => join(home, '.hermes', 'config.yaml');
const codexState = () => join(home, '.codex', 'fake-mcp.json');

function writeJson(p: string, v: unknown) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2));
}
const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf-8'));

/** A stand-in for the `codex` CLI that keeps one server in $CODEX_HOME/fake-mcp.json. */
function installFakeCodex() {
  const bin = join(binDir, 'codex');
  writeFileSync(bin, `#!${process.execPath}
const { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const a = process.argv.slice(2);
const dir = process.env.CODEX_HOME;
mkdirSync(dir, { recursive: true });
const f = join(dir, 'fake-mcp.json');
if (a[1] === 'get') {
  if (!existsSync(f)) { console.error("Error: No MCP server named '" + a[2] + "' found."); process.exit(1); }
  process.stdout.write(readFileSync(f, 'utf-8'));
} else if (a[1] === 'add') {
  const i = a.indexOf('--');
  writeFileSync(f, JSON.stringify({ name: a[2], transport: { type: 'stdio', command: a[i + 1], args: a.slice(i + 2) } }));
  console.log('Added');
} else if (a[1] === 'remove') {
  rmSync(f, { force: true }); console.log('Removed');
} else { process.exit(2); }
`);
  chmodSync(bin, 0o755);
}

function run(args: string[], opts: { noCodex?: boolean; apply?: boolean } = {}) {
  const path = opts.noCodex ? '/usr/bin:/bin' : `${binDir}${IS_WIN ? ';' : ':'}/usr/bin:/bin`;
  // T-20261002-006: writes require --apply — tests that intend a real write get the
  // flag appended automatically; pass apply:false to exercise the bare/dry behavior.
  const argv = opts.apply === false || args.includes('--apply') ? args : [...args, '--apply'];
  const r = spawnSync(process.execPath, [installer, ...argv], {
    encoding: 'utf-8',
    env: { ...process.env, UPSTREAM_INSTALL_HOME: home, PATH: path, CODEX_HOME: '', HERMES_HOME: '' },
  });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  home = realpathSync(mkdtempSync(join(tmpdir(), 'upstream-install-')));
  binDir = join(home, 'fakebin');
  mkdirSync(binDir, { recursive: true });
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

describe('claude target (Claude Code + Desktop Code tab)', () => {
  test('creates ~/.claude.json with a stdio entry and keeps other keys', () => {
    writeJson(claudePath(), { theme: 'dark', mcpServers: { keep: { command: 'x' } } });
    const r = run(['--target', 'claude']);
    expect(r.code).toBe(0);
    const cfg = readJson(claudePath());
    expect(cfg.theme).toBe('dark');
    expect(cfg.mcpServers.keep).toEqual({ command: 'x' });
    expect(cfg.mcpServers[NAME].type).toBe('stdio');
    expect(cfg.mcpServers[NAME].args[0].endsWith('scripts/mcp-upstream-server.ts')).toBe(true);
    expect(readdirSync(home).some((f) => f.startsWith('.claude.json.bak-'))).toBe(true);
  });

  test('is idempotent', () => {
    run(['--target', 'claude']);
    const before = readFileSync(claudePath(), 'utf-8');
    const r = run(['--target', 'claude']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('already registered');
    expect(readFileSync(claudePath(), 'utf-8')).toBe(before);
  });

  test('a different existing entry needs --force', () => {
    writeJson(claudePath(), { mcpServers: { [NAME]: { type: 'stdio', command: '/old', args: ['/old.ts'] } } });
    const refused = run(['--target', 'claude']);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('--force');
    expect(readJson(claudePath()).mcpServers[NAME].command).toBe('/old');
    expect(run(['--target', 'claude', '--force']).code).toBe(0);
    expect(readJson(claudePath()).mcpServers[NAME].command).not.toBe('/old');
  });

  test('refuses a corrupt config instead of overwriting it', () => {
    writeFileSync(claudePath(), '{ not json');
    const r = run(['--target', 'claude']);
    expect(r.code).toBe(1);
    expect(readFileSync(claudePath(), 'utf-8')).toBe('{ not json');
  });

  test('--dry-run writes nothing and --uninstall removes only this key', () => {
    writeJson(claudePath(), { mcpServers: { keep: { command: 'x' } } });
    expect(run(['--target', 'claude', '--dry-run']).code).toBe(0);
    expect(readJson(claudePath()).mcpServers[NAME]).toBeUndefined();
    run(['--target', 'claude']);
    expect(run(['--target', 'claude', '--uninstall']).code).toBe(0);
    const cfg = readJson(claudePath());
    expect(cfg.mcpServers[NAME]).toBeUndefined();
    expect(cfg.mcpServers.keep).toEqual({ command: 'x' });
  });
});

describe('machine-global JSON clients (only when the client already wrote its file)', () => {
  test.skipIf(platform() !== 'darwin' && !IS_WIN)('claude-desktop and antigravity are skipped when absent, registered when present', () => {
    const skipped = run(['--target', 'claude-desktop,antigravity']);
    // explicit target + absent file = failure, and nothing is created
    expect(skipped.code).toBe(1);
    expect(existsSync(desktopPath())).toBe(false);
    expect(existsSync(antigravityPath())).toBe(false);

    writeJson(desktopPath(), { mcpServers: { graft: { command: 'graft', args: ['mcp'] } } });
    writeJson(antigravityPath(), { mcpServers: { graft: { command: 'graft', args: ['mcp'] } } });
    const r = run(['--target', 'claude-desktop,antigravity']);
    expect(r.code).toBe(0);
    for (const p of [desktopPath(), antigravityPath()]) {
      const cfg = readJson(p);
      expect(cfg.mcpServers.graft).toEqual({ command: 'graft', args: ['mcp'] });
      expect(cfg.mcpServers[NAME].command.length).toBeGreaterThan(0);
      expect(cfg.mcpServers[NAME].type).toBeUndefined();
    }
  });

  test('gemini needs settings.json or the gemini binary', () => {
    expect(run(['--target', 'gemini'], { noCodex: true }).code).toBe(1);
    writeJson(geminiPath(), { theme: 'x' });
    expect(run(['--target', 'gemini']).code).toBe(0);
    expect(readJson(geminiPath()).theme).toBe('x');
    expect(readJson(geminiPath()).mcpServers[NAME]).toBeDefined();
  });
});

describe.skipIf(IS_WIN)('codex target (Codex CLI + Desktop App) via `codex mcp`', () => {
  test('add, idempotent re-run, conflict, force, uninstall', () => {
    installFakeCodex();
    expect(run(['--target', 'codex']).code).toBe(0);
    const added = readJson(codexState());
    expect(added.name).toBe(NAME);
    expect(added.transport.args[0].endsWith('scripts/mcp-upstream-server.ts')).toBe(true);

    expect(run(['--target', 'codex']).out).toContain('already registered');

    writeFileSync(codexState(), JSON.stringify({ name: NAME, transport: { type: 'stdio', command: '/old', args: ['/old.ts'] } }));
    const refused = run(['--target', 'codex']);
    expect(refused.code).toBe(1);
    expect(readJson(codexState()).transport.command).toBe('/old');
    expect(run(['--target', 'codex', '--force']).code).toBe(0);
    expect(readJson(codexState()).transport.command).not.toBe('/old');

    expect(run(['--target', 'codex', '--uninstall']).code).toBe(0);
    expect(existsSync(codexState())).toBe(false);
  });

  test('skipped under --target all when codex is not installed; failure when asked for explicitly', () => {
    const all = run(['--target', 'codex', '--dry-run'], { noCodex: true });
    expect(all.code).toBe(1);
    expect(all.out).toContain('not found on PATH');
    const implicit = run(['--dry-run'], { noCodex: true });
    expect(implicit.out).toContain('Skipped');
  });
});

describe('hermes target (Hermes Agent + Hermes CLI) via config.yaml', () => {
  const BASE = `# my comment\nmodel:\n  default: x\nmcp_servers:\n  governance:\n    command: bun\n    args:\n      - /ws/g.ts\n    enabled: true\ncontext_file_max_chars: 100000\n`;

  test('inserts the entry, keeps everything else, and round-trips on uninstall', () => {
    mkdirSync(dirname(hermesPath()), { recursive: true });
    writeFileSync(hermesPath(), BASE);
    expect(run(['--target', 'hermes']).code).toBe(0);
    const text = readFileSync(hermesPath(), 'utf-8');
    const doc = load(text, { schema: JSON_SCHEMA }) as any;
    expect(doc.mcp_servers[NAME].enabled).toBe(true);
    expect(doc.mcp_servers.governance.command).toBe('bun');
    expect(text).toContain('# my comment');

    expect(run(['--target', 'hermes']).out).toContain('already registered');
    expect(run(['--target', 'hermes', '--uninstall']).code).toBe(0);
    expect(readFileSync(hermesPath(), 'utf-8')).toBe(BASE);
  });

  test('never creates a Hermes config that does not exist', () => {
    expect(run(['--target', 'hermes']).code).toBe(1);
    expect(existsSync(hermesPath())).toBe(false);
  });

  test('refuses an unparseable config', () => {
    mkdirSync(dirname(hermesPath()), { recursive: true });
    writeFileSync(hermesPath(), 'model: [unclosed\n');
    expect(run(['--target', 'hermes']).code).toBe(1);
    expect(readFileSync(hermesPath(), 'utf-8')).toBe('model: [unclosed\n');
  });
});

describe('target selection', () => {
  test('rejects an unknown target with exit code 2', () => {
    const r = run(['--target', 'vscode']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('Unknown --target');
  });

  test('default (all) registers what is present and skips the rest', () => {
    writeJson(antigravityPath(), { mcpServers: {} });
    mkdirSync(dirname(hermesPath()), { recursive: true });
    writeFileSync(hermesPath(), 'model:\n  default: x\n');
    if (!IS_WIN) installFakeCodex();
    const r = run([]);
    expect(r.code).toBe(0);
    expect(readJson(claudePath()).mcpServers[NAME]).toBeDefined();
    expect(readJson(antigravityPath()).mcpServers[NAME]).toBeDefined();
    expect(readFileSync(hermesPath(), 'utf-8')).toContain(NAME);
    expect(r.out).toContain('Skipped');
    expect(existsSync(desktopPath())).toBe(false);
  });
});

describe('write gating and file hygiene (T-20261002-006, H5+M4)', () => {
  test('a BARE run is read-only and exits 2 — no config is written', () => {
    writeJson(claudePath(), { mcpServers: { keep: { command: 'x' } } });
    const before = readFileSync(claudePath(), 'utf-8');
    const r = run(['--target', 'claude'], { apply: false });
    expect(r.code).toBe(2);
    expect(r.out).toContain('--apply');
    expect(readFileSync(claudePath(), 'utf-8')).toBe(before);
  });

  test('an explicit --dry-run is an intentional no-op exiting 0', () => {
    writeJson(claudePath(), { mcpServers: {} });
    expect(run(['--target', 'claude', '--dry-run'], { apply: false }).code).toBe(0);
  });

  test('an unknown flag (--dryrun typo) is a hard error, not a silent all-targets write', () => {
    const r = run(['--dryrun'], { apply: false });
    expect(r.code).toBe(2);
    expect(r.out).toContain('Unknown flag');
  });

  test('a valueless trailing --target is a hard error', () => {
    const r = run(['--target'], { apply: false });
    expect(r.code).toBe(2);
    expect(r.out).toContain('--target requires a value');
  });

  test('backupAndWrite preserves the original file mode and writes 0600 backups', () => {
    writeJson(claudePath(), { mcpServers: { keep: { command: 'x' } } });
    chmodSync(claudePath(), 0o640);
    const r = run(['--target', 'claude']);
    expect(r.code).toBe(0);
    const backup = readdirSync(home).find((f) => f.startsWith('.claude.json.bak-'));
    expect(backup).toBeDefined();
    if (!IS_WIN) {
      // Windows ignores POSIX modes — the preservation assertions are POSIX-only.
      expect((statSync(claudePath()).mode & 0o777).toString(8)).toBe('640'); // mode preserved (H5)
      expect((statSync(join(home, backup!)).mode & 0o777).toString(8)).toBe('600'); // backup 0600 (H5)
    }
  });

  test('a symlinked config is updated at its real file, not replaced by a regular file (H5)', () => {
    const realConfig = join(home, 'real-claude.json');
    writeJson(realConfig, { mcpServers: { keep: { command: 'x' } } });
    symlinkSync(realConfig, claudePath());
    const r = run(['--target', 'claude']);
    expect(r.code).toBe(0);
    const lstatBefore = lstatSync(claudePath());
    expect(lstatBefore.isSymbolicLink()).toBe(true); // the link survives
    expect(readJson(realConfig).mcpServers[NAME]).toBeDefined(); // the real file was updated
  });

  test('backups are pruned to the newest 5 per config (H5)', () => {
    writeJson(claudePath(), { mcpServers: {} });
    for (let i = 0; i < 7; i++) writeFileSync(join(home, `.claude.json.bak-${1000000000000 + i}`), 'old');
    expect(run(['--target', 'claude']).code).toBe(0);
    const backups = readdirSync(home).filter((f) => f.startsWith('.claude.json.bak-'));
    expect(backups.length).toBeLessThanOrEqual(5);
  });
});
