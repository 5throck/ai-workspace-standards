#!/usr/bin/env bun
/**
 * Skill Status Synchronization Script
 * @version 1.0.0
 * Synchronizes skill status between SKILL.md and registry tables
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { execFileSync } from 'node:child_process';

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const ROOT = targetIdx !== -1 && args[targetIdx + 1] ? args[targetIdx + 1] : cwd();
const SKILL_DIRS = ['skills', '.claude/skills'];
const AGENTS_MD = join(ROOT, 'AGENTS.md');
const CONTEXT_MD = join(ROOT, 'docs', 'context.md');

console.log(`${colors.cyan}=== Skill Status Synchronization ===${colors.reset}\n`);

let changesMade = 0;

for (const dir of SKILL_DIRS) {
  const fullDir = join(ROOT, dir);
  if (!existsSync(fullDir)) continue;

  const skillDirs = readdirSync(fullDir, { withFileTypes: true })
    .filter(f => f.isDirectory() && f.name !== '_archive')
    .map(f => f.name);

  for (const skillName of skillDirs) {
    const skillFile = join(fullDir, skillName, 'SKILL.md');
    
    if (!existsSync(skillFile)) continue;
    
    const content = readFileSync(skillFile, 'utf-8');
    const statusMatch = content.match(/^status:\s*(\w+)/m);
    
    if (!statusMatch) {
      console.log(`${colors.yellow}⚠️  No status field found in ${skillFile}${colors.reset}`);
      continue;
    }
    
    const status = statusMatch[1];
    
    if (status === 'deprecated') {
      console.log(`${colors.cyan}🔍 Found deprecated skill: ${skillName}${colors.reset}`);
      
      const filesToUpdate = [AGENTS_MD, CONTEXT_MD].filter(f => existsSync(f));
      
      for (const file of filesToUpdate) {
        let mdContent = readFileSync(file, 'utf-8');
        const skillLineRegex = new RegExp(`^.*\\\`${skillName}\\\`.*$`, 'm');
        const match = mdContent.match(skillLineRegex);
        
        if (match) {
          const line = match[0];
          const currentStatusMatch = line.match(/status:\s*(\w+)/);
          
          if (currentStatusMatch && currentStatusMatch[1] !== 'deprecated') {
            const fileName = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
            console.log(`  📝 Updating ${fileName} Skills table for ${skillName}`);
            const newLine = line.replace(/status:\s*\w+/, 'status: deprecated');
            mdContent = mdContent.replace(line, newLine);
            writeFileSync(file, mdContent, 'utf-8');
            changesMade++;
            console.log(`${colors.green}  ✅ Updated ${fileName}${colors.reset}`);
          } else {
            const fileName = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
            console.log(`  ✓ ${fileName} already up-to-date`);
          }
        }
      }
      
      try {
        const stdout = execFileSync('git', ['log', '-1', '--format=%ct', skillFile], { encoding: 'utf-8' });
        const lastModified = parseInt(stdout.trim(), 10);
        if (!isNaN(lastModified)) {
          const daysSinceModified = (Math.floor(Date.now() / 1000) - lastModified) / 86400;
          if (daysSinceModified >= 30) {
            console.log(`${colors.yellow}  ⚠️  Skill ${skillName} has been deprecated for ${Math.floor(daysSinceModified)} days (≥30 days)${colors.reset}`);
            console.log(`     Consider moving to ${dir}/_archive/ (run manually)`);
          }
        }
      } catch (e) {}
    }
  }
}

console.log('');
if (changesMade > 0) {
  console.log(`${colors.green}✅ Synchronized ${changesMade} skill status(es)${colors.reset}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review changes: git diff AGENTS.md docs/context.md`);
  console.log(`  2. Commit: git add AGENTS.md docs/context.md; git commit -m 'chore: sync skill status'`);
  console.log(`  3. For skills deprecated ≥30 days: mv skills/DEPRECATED skills/_archive/`);
} else {
  console.log(`${colors.green}✅ All skill statuses already in sync${colors.reset}`);
}
