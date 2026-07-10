#!/usr/bin/env bun
/**
 * sync-skills.ts
 * Distributes skills from the SSOT (skills/) to .claude/skills/, .gemini/skills/, and .agents/skills/.
 * Also syncs shortcut skills (sync, meeting) from .agents/skills/ back to .claude and .gemini.
 *
 * Phase 1: Copy every skill directory (containing SKILL.md) to all three platform skill directories.
 * Phase 2: Back-sync shortcut skills that only exist in .agents/skills/ to .claude and .gemini.
 * Special: meeting-facilitation SKILL.md is also synced to .claude/commands/meeting.md and .gemini/commands/meeting.md.
 *
 * @version 1.1.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');

const ssotSkills   = path.join(workspaceRoot, 'skills');
const claudeSkills = path.join(workspaceRoot, '.claude', 'skills');
const geminiSkills = path.join(workspaceRoot, '.gemini', 'skills');
const agentsSkills = path.join(workspaceRoot, '.agents', 'skills');

// Create target directories if they don't exist
fs.mkdirSync(claudeSkills, { recursive: true });
fs.mkdirSync(geminiSkills, { recursive: true });
fs.mkdirSync(agentsSkills, { recursive: true });

console.log(`Syncing skills from SSOT (${ssotSkills})...`);

if (!fs.existsSync(ssotSkills)) {
  console.log('No skills directory found — nothing to sync.');
  process.exit(0);
}

// --- Phase 1: Distribute SSOT skills to all three platform directories ---
const errors: string[] = [];

for (const item of fs.readdirSync(ssotSkills)) {
  try {
    const itemPath = path.join(ssotSkills, item);
    const stat = fs.statSync(itemPath);
    if (!stat.isDirectory()) continue;
    // Skip non-skill files (README.md, SKILLS.md, etc.)
    if (!fs.existsSync(path.join(itemPath, 'SKILL.md'))) continue;

    for (const targetDir of [claudeSkills, geminiSkills, agentsSkills]) {
      const target = path.join(targetDir, item);
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
      fs.cpSync(itemPath, target, { recursive: true });
      console.log(`  -> Synced ${item} to ${path.relative(workspaceRoot, targetDir)}/`);
    }

    // Special logic for commands derived from skills
    if (item === 'meeting-facilitation') {
      const claudeCmdDir = path.join(workspaceRoot, '.claude', 'commands');
      const geminiCmdDir = path.join(workspaceRoot, '.gemini', 'commands');
      fs.mkdirSync(claudeCmdDir, { recursive: true });
      fs.mkdirSync(geminiCmdDir, { recursive: true });

      const skillMdPath = path.join(itemPath, 'SKILL.md');
      if (fs.existsSync(skillMdPath)) {
        fs.copyFileSync(skillMdPath, path.join(claudeCmdDir, 'meeting.md'));
        console.log(`  -> Synced SKILL.md to .claude/commands/meeting.md`);

        fs.copyFileSync(skillMdPath, path.join(geminiCmdDir, 'meeting.md'));
        console.log(`  -> Synced SKILL.md to .gemini/commands/meeting.md`);
      }
    }
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : String(err);
    errors.push(`Phase 1: ${item}: ${msg}`);
    console.error(`  ❌ Error syncing ${item}: ${msg}`);
  }
}

// --- Phase 2: Sync .agents/skills/ shortcut skills back to .claude and .gemini ---
// These are skills that only exist in .agents/skills/ (not in SSOT) but should be
// available on Claude Code and Gemini CLI as well.
const SHORTCUT_SKILLS = ['sync', 'meeting', 'source-command-commit-push-pr'];

for (const item of SHORTCUT_SKILLS) {
  try {
    const source = path.join(agentsSkills, item);
    if (!fs.existsSync(source) || !fs.existsSync(path.join(source, 'SKILL.md'))) continue;

    for (const targetDir of [claudeSkills, geminiSkills]) {
      const target = path.join(targetDir, item);
      fs.cpSync(source, target, { recursive: true, force: true });
      console.log(`  -> Synced shortcut ${item} to ${path.relative(workspaceRoot, targetDir)}/`);
    }
  } catch (err) {
    const msg = (err instanceof Error) ? err.message : String(err);
    errors.push(`Phase 2: ${item}: ${msg}`);
    console.error(`  ❌ Error syncing shortcut ${item}: ${msg}`);
  }
}

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} error(s) during skill synchronization:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exitCode = 1;
}

console.log('Skill synchronization complete!');
