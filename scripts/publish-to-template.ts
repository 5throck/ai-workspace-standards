#!/usr/bin/env bun
// publish-to-template.ts — Publishes L0 scripts and skills (workspace) to L1 template snapshot
// Usage: bun run scripts/publish-to-template.ts [--dry-run]

import * as fs from 'node:fs';
import * as path from 'node:path';

// Helper to safely copy a file, managing read-only locks
function safeCopyFile(src: string, dst: string) {
  if (fs.existsSync(dst)) {
    fs.chmodSync(dst, 0o644);
  }
  fs.copyFileSync(src, dst);
  const stat = fs.statSync(src);
  fs.chmodSync(dst, stat.mode & ~0o222);
}

// Helper to safely copy a directory, managing read-only locks
function safeCopyDir(srcDir: string, dstDir: string) {
  if (fs.existsSync(dstDir)) {
    const walkLift = (dir: string) => {
      for (const item of fs.readdirSync(dir)) {
        const itemPath = path.join(dir, item);
        if (fs.statSync(itemPath).isDirectory()) walkLift(itemPath);
        else fs.chmodSync(itemPath, 0o644);
      }
    };
    walkLift(dstDir);
    fs.rmSync(dstDir, { recursive: true, force: true });
  }
  fs.cpSync(srcDir, dstDir, { recursive: true });
  const walkLock = (dir: string) => {
    for (const item of fs.readdirSync(dir)) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) walkLock(itemPath);
      else fs.chmodSync(itemPath, stat.mode & ~0o222);
    }
  };
  walkLock(dstDir);
}

const GREEN    = '\x1b[32m';
const DARKGRAY = '\x1b[90m';
const RED      = '\x1b[31m';
const RESET    = '\x1b[0m';

const dryRun = process.argv.includes('--dry-run');

// Resolve paths relative to this script's directory
const scriptDir     = path.resolve(import.meta.dir);
const workspaceRoot = path.resolve(scriptDir, '..');
const l0Dir         = scriptDir;
const l1Dir         = path.resolve(scriptDir, '..', 'templates', 'common', 'scripts');

const scriptsMdPath = path.join(l0Dir, 'SCRIPTS.md');
if (!fs.existsSync(scriptsMdPath)) {
  console.log(`${RED}❌ SCRIPTS.md not found at ${l0Dir}${RESET}`);
  process.exit(1);
}

console.log('L0 → L1 publish: scripts/ → templates/common/scripts/');
if (dryRun) console.log('(dry-run mode)');
console.log('');

let count = 0;

// Parse SCRIPTS.md — lines matching `| \`scriptname\` |`
const scriptsMd = fs.readFileSync(scriptsMdPath, 'utf-8');
const registryLines = scriptsMd
  .split('\n')
  .filter(line => /^\| `[^`]+`/.test(line));

for (const line of registryLines) {
  const cols = line.split('|');
  if (cols.length < 4) continue;
  const script = cols[1].trim().replace(/`/g, '');
  const source = cols[2].trim();
  const drift  = cols.length >= 8 ? cols[7].trim() : '—';
  if (source !== 'L0') continue;
  if (drift === 'intentional') continue;
  if (!script) continue;
  const src = path.join(l0Dir, script);
  const dst = path.join(l1Dir, script);
  if (!fs.existsSync(src)) continue;
  if (dryRun) {
    console.log(`  [dry-run] ${script}`);
  } else {
    safeCopyFile(src, dst);
    console.log(`  ✅ ${script}`);
    count++;
  }
}

if (!dryRun) {
  safeCopyFile(scriptsMdPath, path.join(l1Dir, 'SCRIPTS.md'));
  console.log(`  ✅ SCRIPTS.md`);
  count++;
  console.log('');
  console.log(`${GREEN}✅ Published ${count} files  L0 (scripts/) → L1 (templates/common/scripts/)${RESET}`);
}

// ── Skills: L0 (skills/) → L1 (templates/common/skills/) ───────────────────
const l0Skills = path.join(workspaceRoot, 'skills');
const l1Skills = path.join(workspaceRoot, 'templates', 'common', 'skills');

console.log('');
console.log('L0 → L1 publish: skills/ → templates/common/skills/');

let skillCount = 0;

if (fs.existsSync(l0Skills)) {
  for (const item of fs.readdirSync(l0Skills)) {
    // Skip workspace-only skills from being published to templates
    if (item === 'simulate-project-creation') continue;
    
    const itemPath = path.join(l0Skills, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      if (dryRun) {
        console.log(`  [dry-run] ${item}/`);
      } else {
        const dst = path.join(l1Skills, item);
        safeCopyDir(itemPath, dst);
        console.log(`  ✅ ${item}/`);
        skillCount++;
      }
    } else if (stat.isFile()) {
      if (dryRun) {
        console.log(`  [dry-run] ${item}`);
      } else {
        safeCopyFile(itemPath, path.join(l1Skills, item));
        console.log(`  ✅ ${item}`);
        skillCount++;
      }
    }
  }
}

if (!dryRun) {
  console.log('');
  console.log(`${GREEN}✅ Published ${skillCount} items  L0 (skills/) → L1 (templates/common/skills/)${RESET}`);
}

// ── Compiled Commands: L0 (.claude/commands, .gemini/commands) → L1 ───────
console.log('');
console.log('L0 → L1 publish: .claude/commands/ & .gemini/commands/ → templates/common/...');

const platforms = ['.claude', '.gemini'];
let cmdCount = 0;

for (const platform of platforms) {
  const srcDir = path.join(workspaceRoot, platform, 'commands');
  const dstDir = path.join(workspaceRoot, 'templates', 'common', platform, 'commands');

  if (fs.existsSync(srcDir)) {
    if (!fs.existsSync(dstDir) && !dryRun) {
      fs.mkdirSync(dstDir, { recursive: true });
    }
    
    for (const item of fs.readdirSync(srcDir)) {
      if (!item.endsWith('.md')) continue; // only copy markdown commands
      
      const itemPath = path.join(srcDir, item);
      if (fs.statSync(itemPath).isFile()) {
        if (dryRun) {
          console.log(`  [dry-run] ${platform}/commands/${item}`);
        } else {
          safeCopyFile(itemPath, path.join(dstDir, item));
          console.log(`  ✅ ${platform}/commands/${item}`);
          cmdCount++;
        }
      }
    }
  }
}

if (!dryRun) {
  console.log('');
  console.log(`${GREEN}✅ Published ${cmdCount} command files to L1 (templates/common/)${RESET}`);
} else {
  console.log('');
  console.log(`${DARKGRAY}(dry-run complete — no files written)${RESET}`);
}
