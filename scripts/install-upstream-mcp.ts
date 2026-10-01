#!/usr/bin/env bun
// @version 2.0.1
// v2.0.1 (2026-10-01): with UPSTREAM_INSTALL_HOME set, %APPDATA% no longer leaks the real Windows profile into the Claude Desktop path.
// v2.0.0 (2026-10-01): registers the server for every supported surface (Claude Code, Claude Desktop App,
//          Antigravity IDE/CLI, Gemini CLI, Codex CLI/Desktop, Hermes Agent/CLI) with one target per config file
//          (--target claude|claude-desktop|antigravity|gemini|codex|hermes|all; default all, undetected clients are skipped).
//          Codex goes through `codex mcp add|get|remove`; Hermes is edited as text (never through
//          the `hermes` CLI, which self-updates on launch). Exit code 1 if any target conflicts or fails.
// v1.1.0 (2026-10-01): registers the ABSOLUTE bun path; ~/.claude.json written atomically (temp file + rename).
// v1.0.0 (2026-10-01, spec docs/designs/2026-10-01-upstream-request-mcp-design.md §11):
//          Idempotent installer that registers the global user-level MCP server.
//          Support --dry-run and --uninstall. NEVER RUN AUTOMATICALLY;
//          user approval required.
//
// Test seam: UPSTREAM_INSTALL_HOME replaces the home directory for every target (and CODEX_HOME for
// the codex child process), so tests never touch the real user configs.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, platform } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  readHermesMcpEntry,
  setHermesMcpEntry,
  removeHermesMcpEntry,
  type McpStdioEntry,
} from './helpers/mcp-config-edit.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');
const SERVER_PATH = join(WORKSPACE_ROOT, 'scripts', 'mcp-upstream-server.ts');
const SERVER_NAME = 'ai-workspace-upstream';

// One target per config file, so a target covers every client that reads that file:
//   claude         Claude Code CLI + Claude Code tab of the Claude Desktop App  (~/.claude.json)
//   claude-desktop Claude Desktop App chat/cowork                              (claude_desktop_config.json)
//   antigravity    Antigravity IDE + Antigravity CLI                           (~/.gemini/config/mcp_config.json)
//   gemini         Gemini CLI                                                  (~/.gemini/settings.json)
//   codex          Codex CLI + Codex Desktop App                               (~/.codex/config.toml, via `codex mcp`)
//   hermes         Hermes Agent + Hermes CLI                                   (~/.hermes/config.yaml)
type TargetId = 'claude' | 'claude-desktop' | 'antigravity' | 'gemini' | 'codex' | 'hermes';
const ALL_TARGETS: TargetId[] = ['claude', 'claude-desktop', 'antigravity', 'gemini', 'codex', 'hermes'];

function findBun(): string {
  const base = basename(process.execPath).toLowerCase();
  if (base === 'bun' || base === 'bun.exe') return process.execPath;
  const found = Bun.which('bun');
  if (found && isAbsolute(found)) return found;
  throw new Error('bun not found: cannot determine an absolute path for the client config');
}

function home(): string {
  if (process.env.UPSTREAM_INSTALL_HOME) return process.env.UPSTREAM_INSTALL_HOME;
  if (platform() === 'win32') return process.env.USERPROFILE || homedir();
  return homedir();
}

function normalizePath(p: string): string {
  // On Windows, use forward slashes in client configs
  return platform() === 'win32' ? p.replace(/\\/g, '/') : p;
}

function sameEntry(a: McpStdioEntry, b: McpStdioEntry): boolean {
  return a.command === b.command && JSON.stringify(a.args) === JSON.stringify(b.args);
}

function fail(message: string): never {
  throw new Error(message);
}

function backupAndWrite(path: string, content: string): void {
  if (existsSync(path)) {
    const backupPath = `${path}.bak-${Date.now()}`;
    copyFileSync(path, backupPath);
    console.log(`  Backed up existing config to: ${backupPath}`);
  } else {
    mkdirSync(dirname(path), { recursive: true });
  }
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, path);
}

// ---------- adapters ----------

interface Adapter {
  id: TargetId;
  label: string;
  nextSteps: string[];
  /** null when the client is present; otherwise the reason it is skipped. */
  detect(): string | null;
  /** The registered stdio entry, or null. Throws when the config cannot be read safely. */
  read(): McpStdioEntry | null;
  write(entry: McpStdioEntry): void;
  remove(): void;
  describe(entry: McpStdioEntry): string;
}

function jsonAdapter(opts: {
  id: TargetId;
  label: string;
  path: () => string;
  detect: () => string | null;
  buildEntry: (e: McpStdioEntry) => Record<string, unknown>;
  nextSteps: string[];
}): Adapter {
  const load = (): Record<string, any> => {
    const p = opts.path();
    if (!existsSync(p)) return {};
    // Never treat an unreadable config as empty: a real run would overwrite the user's settings.
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(p, 'utf-8'));
    } catch (err) {
      fail(`Cannot parse ${p}: ${(err as Error).message}. Fix or restore the file, then re-run.`);
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail(`${p} is not a JSON object. Refusing to continue.`);
    }
    return parsed as Record<string, any>;
  };
  return {
    id: opts.id,
    label: opts.label,
    nextSteps: opts.nextSteps,
    detect: opts.detect,
    read() {
      const e = load().mcpServers?.[SERVER_NAME];
      if (e === undefined || e === null) return null;
      return { command: String(e.command ?? ''), args: Array.isArray(e.args) ? e.args.map(String) : [] };
    },
    write(entry) {
      const cfg = load();
      if (!cfg.mcpServers) cfg.mcpServers = {};
      cfg.mcpServers[SERVER_NAME] = opts.buildEntry(entry);
      backupAndWrite(opts.path(), JSON.stringify(cfg, null, 2));
    },
    remove() {
      const cfg = load();
      if (cfg.mcpServers) delete cfg.mcpServers[SERVER_NAME];
      backupAndWrite(opts.path(), JSON.stringify(cfg, null, 2));
    },
    describe: (e) => JSON.stringify(opts.buildEntry(e)),
  };
}

const claude = jsonAdapter({
  id: 'claude',
  label: 'Claude Code',
  path: () => join(home(), '.claude.json'),
  detect: () => null, // always applies; the file is created when missing (v1 behaviour)
  buildEntry: (e) => ({ type: 'stdio', command: e.command, args: e.args }),
  nextSteps: ['Restart your Claude client (close and reopen)', 'Verify with: claude mcp list'],
});

// Documented for macOS and Windows only (modelcontextprotocol.io/docs/develop/connect-local-servers);
// the Claude Desktop App has no Linux build, so Linux has no path.
function claudeDesktopConfigPath(): string | null {
  if (platform() === 'win32') {
    // With the test seam active, %APPDATA% must not leak the real user profile into a test run.
    const appData = process.env.UPSTREAM_INSTALL_HOME
      ? join(home(), 'AppData', 'Roaming')
      : process.env.APPDATA || join(home(), 'AppData', 'Roaming');
    return join(appData, 'Claude', 'claude_desktop_config.json');
  }
  if (platform() === 'darwin') {
    return join(home(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  return null;
}

const claudeDesktop = jsonAdapter({
  id: 'claude-desktop',
  label: 'Claude Desktop App (chat)',
  path: () => claudeDesktopConfigPath() ?? fail('Claude Desktop App has no config path on this platform'),
  // The file is machine-global and hand-written (docs/graft-platform-integration.md): edit it only when it exists.
  detect: () => {
    const p = claudeDesktopConfigPath();
    if (!p) return 'the Claude Desktop App is available for macOS and Windows only';
    return existsSync(p) ? null : `${p} not found`;
  },
  buildEntry: (e) => ({ command: e.command, args: e.args }),
  nextSteps: ['Quit and reopen the Claude Desktop App'],
});

const antigravity = jsonAdapter({
  id: 'antigravity',
  label: 'Antigravity IDE + CLI',
  path: () => join(home(), '.gemini', 'config', 'mcp_config.json'),
  // The registry path depends on the installed Antigravity version, so never create it
  // (docs/graft-platform-integration.md): use it only when Antigravity already wrote it.
  detect: () =>
    existsSync(join(home(), '.gemini', 'config', 'mcp_config.json'))
      ? null
      : 'no ~/.gemini/config/mcp_config.json (run `graft init --agents antigravity` once so Antigravity creates its registry)',
  buildEntry: (e) => ({ command: e.command, args: e.args }),
  nextSteps: ['Restart Antigravity (IDE and CLI)'],
});

const gemini = jsonAdapter({
  id: 'gemini',
  label: 'Gemini CLI',
  path: () => join(home(), '.gemini', 'settings.json'),
  detect: () =>
    existsSync(join(home(), '.gemini', 'settings.json')) || Bun.which('gemini')
      ? null
      : 'no ~/.gemini/settings.json and no `gemini` on PATH',
  buildEntry: (e) => ({ command: e.command, args: e.args }),
  nextSteps: ['Restart Gemini CLI', 'Verify with: gemini mcp list'],
});

function codexEnv(): NodeJS.ProcessEnv {
  if (!process.env.UPSTREAM_INSTALL_HOME) return process.env;
  // The real codex refuses a CODEX_HOME that does not exist yet.
  const codexHome = join(process.env.UPSTREAM_INSTALL_HOME, '.codex');
  mkdirSync(codexHome, { recursive: true });
  return { ...process.env, CODEX_HOME: codexHome };
}

function runCodex(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const bin = Bun.which('codex');
  if (!bin) fail('`codex` not found on PATH');
  const r = spawnSync(bin, args, { encoding: 'utf-8', env: codexEnv() });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const codex: Adapter = {
  id: 'codex',
  label: 'Codex',
  nextSteps: ['Restart Codex', 'Verify with: codex mcp list'],
  detect: () => (Bun.which('codex') ? null : '`codex` not found on PATH'),
  read() {
    const r = runCodex(['mcp', 'get', SERVER_NAME, '--json']);
    if (r.status !== 0) {
      if (/No MCP server named/i.test(`${r.stdout}${r.stderr}`)) return null;
      fail(`codex mcp get failed: ${(r.stderr || r.stdout).trim()}`);
    }
    const t = JSON.parse(r.stdout)?.transport;
    if (t?.type !== 'stdio') return { command: `<${t?.type ?? 'unknown'} transport>`, args: [] };
    return { command: String(t.command ?? ''), args: Array.isArray(t.args) ? t.args.map(String) : [] };
  },
  write(entry) {
    if (this.read() !== null) this.remove(); // replace (only reached with --force)
    const r = runCodex(['mcp', 'add', SERVER_NAME, '--', entry.command, ...entry.args]);
    if (r.status !== 0) fail(`codex mcp add failed: ${(r.stderr || r.stdout).trim()}`);
  },
  remove() {
    const r = runCodex(['mcp', 'remove', SERVER_NAME]);
    if (r.status !== 0) fail(`codex mcp remove failed: ${(r.stderr || r.stdout).trim()}`);
  },
  describe: (e) => `codex mcp add ${SERVER_NAME} -- ${[e.command, ...e.args].join(' ')}`,
};

function hermesConfigPath(): string {
  const base = process.env.UPSTREAM_INSTALL_HOME
    ? join(process.env.UPSTREAM_INSTALL_HOME, '.hermes')
    : process.env.HERMES_HOME || join(home(), '.hermes');
  return join(base, 'config.yaml');
}

const hermes: Adapter = {
  id: 'hermes',
  label: 'Hermes Agent',
  nextSteps: ['Restart Hermes (gateway and desktop app)', `Check that ${SERVER_NAME} appears under mcp_servers in config.yaml`],
  detect: () => (existsSync(hermesConfigPath()) ? null : `${hermesConfigPath()} not found`),
  read() {
    try {
      return readHermesMcpEntry(readFileSync(hermesConfigPath(), 'utf-8'), SERVER_NAME);
    } catch (err) {
      return fail(`Cannot read ${hermesConfigPath()}: ${(err as Error).message}`);
    }
  },
  write(entry) {
    const p = hermesConfigPath();
    backupAndWrite(p, setHermesMcpEntry(readFileSync(p, 'utf-8'), SERVER_NAME, entry));
  },
  remove() {
    const p = hermesConfigPath();
    backupAndWrite(p, removeHermesMcpEntry(readFileSync(p, 'utf-8'), SERVER_NAME));
  },
  describe: (e) => `mcp_servers.${SERVER_NAME}: command=${JSON.stringify(e.command)} args=${JSON.stringify(e.args)} enabled=true`,
};

const ADAPTERS: Record<TargetId, Adapter> = {
  claude,
  'claude-desktop': claudeDesktop,
  antigravity,
  gemini,
  codex,
  hermes,
};

// ---------- main ----------

function parseTargets(args: string[]): { targets: TargetId[]; explicit: boolean } {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) values.push(...args[++i].split(','));
    else if (args[i].startsWith('--target=')) values.push(...args[i].slice('--target='.length).split(','));
  }
  if (values.length === 0 || values.includes('all')) return { targets: ALL_TARGETS, explicit: values.length > 0 };
  const bad = values.filter((v) => !ALL_TARGETS.includes(v as TargetId));
  if (bad.length) {
    console.error(`✗ Unknown --target: ${bad.join(', ')} (use ${ALL_TARGETS.join(', ')} or all)`);
    process.exit(2);
  }
  return { targets: [...new Set(values)] as TargetId[], explicit: true };
}

type Outcome = 'ok' | 'skipped' | 'failed';

function runTarget(a: Adapter, entry: McpStdioEntry, flags: { dryRun: boolean; uninstall: boolean; force: boolean }, explicit: boolean): Outcome {
  console.log(`[${a.label}]`);
  const why = a.detect();
  if (why) {
    if (explicit) {
      console.log(`  ✗ Cannot use this target: ${why}`);
      return 'failed';
    }
    console.log(`  - Skipped: ${why}`);
    return 'skipped';
  }

  const existing = a.read();

  if (flags.uninstall) {
    if (existing === null) {
      console.log(`  ✓ ${SERVER_NAME} is not registered.`);
      return 'ok';
    }
    if (!flags.dryRun) a.remove();
    console.log(`  ✓ ${flags.dryRun ? '[DRY RUN] Would remove' : 'Removed'} ${SERVER_NAME}.`);
    return 'ok';
  }

  if (existing && sameEntry(existing, entry)) {
    console.log(`  ✓ ${SERVER_NAME} is already registered with the correct configuration.`);
    return 'ok';
  }
  if (existing && !flags.force) {
    console.log(`  Found different registration for ${SERVER_NAME}:`);
    console.log(`    Current: ${JSON.stringify(existing)}`);
    console.log(`    New:     ${JSON.stringify(entry)}`);
    console.log(`  Use --force to override.`);
    return 'failed';
  }
  if (flags.dryRun) {
    console.log(`  [DRY RUN] Would register ${SERVER_NAME}: ${a.describe(entry)}`);
    return 'ok';
  }
  a.write(entry);
  console.log(`  ✓ Registered ${SERVER_NAME}.`);
  return 'ok';
}

function main(): void {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run'),
    uninstall: args.includes('--uninstall'),
    force: args.includes('--force'),
  };
  const { targets, explicit } = parseTargets(args);

  console.log(`Upstream MCP Server Installer v2.0.1`);
  console.log(`  Workspace: ${WORKSPACE_ROOT}`);
  console.log(`  Targets:   ${targets.join(', ')}`);
  console.log();

  const entry: McpStdioEntry = { command: normalizePath(findBun()), args: [normalizePath(SERVER_PATH)] };

  const results = new Map<TargetId, Outcome>();
  for (const id of targets) {
    try {
      results.set(id, runTarget(ADAPTERS[id], entry, flags, explicit));
    } catch (err) {
      console.log(`  ✗ ${(err as Error).message}`);
      results.set(id, 'failed');
    }
    console.log();
  }

  const done = targets.filter((id) => results.get(id) === 'ok');
  if (!flags.uninstall && !flags.dryRun && done.length > 0) {
    console.log(`Next steps:`);
    for (const id of done) {
      console.log(`  ${ADAPTERS[id].label}: ${ADAPTERS[id].nextSteps.join('; ')}`);
    }
  }
  if (flags.dryRun) console.log(`Run without --dry-run to apply.`);

  process.exit([...results.values()].includes('failed') ? 1 : 0);
}

main();
