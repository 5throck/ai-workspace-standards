#!/usr/bin/env bun
/**
 * sync-skills.ts
 * Distributes skills from the SSOT (skills/) to .claude/skills/ and .gemini/skills/
 * @version 1.0.0

import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');

const ssotSkills   = path.join(workspaceRoot, 'skills');
const claudeSkills = path.join(workspaceRoot, '.claude', 'skills');
const geminiSkills = path.join(workspaceRoot, '.gemini', 'skills');

// Create target directories if they don't exist
fs.mkdirSync(claudeSkills, { recursive: true });
fs.mkdirSync(geminiSkills, { recursive: true });

console.log(`Syncing skills from SSOT (${ssotSkills})...`);

if (!fs.existsSync(ssotSkills)) {
  console.log('No skills directory found — nothing to sync.');
  process.exit(0);
}

for (const item of fs.readdirSync(ssotSkills)) {
  const itemPath = path.join(ssotSkills, item);
  const stat = fs.statSync(itemPath);
  if (!stat.isDirectory()) continue;

  // Copy to .claude/skills/
  const claudeTarget = path.join(claudeSkills, item);
  if (fs.existsSync(claudeTarget)) fs.rmSync(claudeTarget, { recursive: true, force: true });
  fs.cpSync(itemPath, claudeTarget, { recursive: true });
  console.log(`  -> Synced ${item} to .claude/skills/`);

  // Copy to .gemini/skills/
  const geminiTarget = path.join(geminiSkills, item);
  if (fs.existsSync(geminiTarget)) fs.rmSync(geminiTarget, { recursive: true, force: true });
  fs.cpSync(itemPath, geminiTarget, { recursive: true });
  console.log(`  -> Synced ${item} to .gemini/skills/`);

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
}

console.log('Skill synchronization complete!');
