#!/usr/bin/env bun
// @version 1.1.0
// v1.1.0 (2026-10-01): registers the ABSOLUTE bun path; ~/.claude.json written atomically (temp file + rename).
// v1.0.0 (2026-10-01, spec docs/designs/2026-10-01-upstream-request-mcp-design.md §11):
//          Idempotent installer that registers the global user-level MCP server.
//          Support --dry-run and --uninstall. NEVER RUN AUTOMATICALLY;
//          user approval required.

import { copyFileSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname, resolve, basename, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, platform } from 'node:os';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, '..');
const SERVER_PATH = join(WORKSPACE_ROOT, 'scripts', 'mcp-upstream-server.ts');
const SERVER_NAME = 'ai-workspace-upstream';

function findBun(): string {
  const base = basename(process.execPath).toLowerCase();
  if (base === 'bun' || base === 'bun.exe') return process.execPath;
  const found = Bun.which('bun');
  if (found && isAbsolute(found)) return found;
  throw new Error('bun not found: cannot determine an absolute path for the client config');
}

function getClaudeConfigPath(): string {
  if (platform() === 'win32') {
    return join(process.env.USERPROFILE || homedir(), '.claude.json');
  }
  return join(homedir(), '.claude.json');
}

function loadClaudeConfig(): Record<string, any> {
  const configPath = getClaudeConfigPath();
  if (!existsSync(configPath)) return { mcpServers: {} };
  // Never treat an unreadable config as empty: a real run would overwrite the user's settings.
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error(`✗ Cannot parse ${configPath}: ${(err as Error).message}`);
    console.error('  Refusing to continue. Fix or restore the file, then re-run.');
    process.exit(1);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.error(`✗ ${configPath} is not a JSON object. Refusing to continue.`);
    process.exit(1);
  }
  return parsed as Record<string, any>;
}

function saveClaudeConfig(config: Record<string, any>): void {
  const configPath = getClaudeConfigPath();
  const backupPath = `${configPath}.bak-${Date.now()}`;
  if (existsSync(configPath)) {
    copyFileSync(configPath, backupPath);
    console.log(`  Backed up existing config to: ${backupPath}`);
  }
  const tmpPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
  renameSync(tmpPath, configPath);
}

function normalizePathForJson(p: string): string {
  // On Windows, use forward slashes in JSON
  if (platform() === 'win32') return p.replace(/\\/g, '/');
  return p;
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const uninstall = args.includes('--uninstall');
  const force = args.includes('--force');

  console.log(`Upstream MCP Server Installer v1.1.0`);
  console.log(`  Workspace: ${WORKSPACE_ROOT}`);
  console.log(`  Config: ${getClaudeConfigPath()}`);
  console.log();

  const bunPath = findBun();
  const config = loadClaudeConfig();

  if (!config.mcpServers) config.mcpServers = {};

  if (uninstall) {
    if (!(SERVER_NAME in config.mcpServers)) {
      console.log(`✓ ${SERVER_NAME} is not registered.`);
      process.exit(0);
    }
    console.log(`Uninstalling ${SERVER_NAME}...`);
    if (!dryRun) {
      delete config.mcpServers[SERVER_NAME];
      saveClaudeConfig(config);
    }
    console.log(`✓ Removed ${SERVER_NAME} from user config.`);
    process.exit(0);
  }

  const newEntry = {
    type: 'stdio',
    command: normalizePathForJson(bunPath),
    args: [normalizePathForJson(SERVER_PATH)],
  };

  const existing = config.mcpServers[SERVER_NAME];

  if (existing && JSON.stringify(existing) === JSON.stringify(newEntry)) {
    console.log(`✓ ${SERVER_NAME} is already registered with the correct configuration.`);
    process.exit(0);
  }

  if (existing && !force) {
    console.log(`Found different registration for ${SERVER_NAME}:`);
    console.log(`  Current: ${JSON.stringify(existing)}`);
    console.log(`  New:     ${JSON.stringify(newEntry)}`);
    console.log(`Use --force to override.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would register ${SERVER_NAME}:`);
    console.log(JSON.stringify(newEntry, null, 2));
    console.log();
    console.log(`Run without --dry-run to apply. After installation, restart your Claude client and verify with 'claude mcp list'.`);
    process.exit(0);
  }

  console.log(`Registering ${SERVER_NAME}...`);
  config.mcpServers[SERVER_NAME] = newEntry;
  saveClaudeConfig(config);
  console.log(`✓ Registered ${SERVER_NAME} in user config.`);
  console.log();
  console.log(`Next steps:`);
  console.log(`  1. Restart your Claude client (close and reopen)`);
  console.log(`  2. Verify with: claude mcp list`);
}

main();
