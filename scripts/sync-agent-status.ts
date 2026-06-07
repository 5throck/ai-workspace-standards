#!/usr/bin/env bun
/**
 * Agent Status Synchronization Script
 * @version 1.0.0
 * Synchronizes agent status between agent files and AGENTS.md
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
const AGENTS_DIR = join(ROOT, 'agents');
const AGENTS_MD = join(ROOT, 'AGENTS.md');

console.log(`${colors.cyan}=== Agent Status Synchronization ===${colors.reset}\n`);

if (!existsSync(AGENTS_DIR)) {
  console.log(`${colors.yellow}No agents directory found.${colors.reset}`);
  process.exit(0);
}

let changesMade = 0;

const agentFiles = readdirSync(AGENTS_DIR, { withFileTypes: true })
  .filter(f => f.isFile() && f.name.endsWith('.md') && f.name !== 'README.md')
  .map(f => f.name);

for (const file of agentFiles) {
  const agentName = file.replace('.md', '');
  const agentPath = join(AGENTS_DIR, file);
  
  const content = readFileSync(agentPath, 'utf-8');
  const statusMatch = content.match(/^status:\s*(\w+)/m);
  
  if (!statusMatch) {
    console.log(`${colors.yellow}⚠️  No status field found in ${file}${colors.reset}`);
    continue;
  }
  
  const status = statusMatch[1];
  
  if (status === 'deprecated') {
    console.log(`${colors.cyan}🔍 Found deprecated agent: ${agentName}${colors.reset}`);
    
    if (existsSync(AGENTS_MD)) {
      let agentsMd = readFileSync(AGENTS_MD, 'utf-8');
      const agentLineRegex = new RegExp(`^.*\\\`${agentName}\\.md\\\`.*$`, 'm');
      const match = agentsMd.match(agentLineRegex);
      
      if (match) {
        const line = match[0];
        const currentStatusMatch = line.match(/status:\s*(\w+)/);
        
        if (currentStatusMatch && currentStatusMatch[1] !== 'deprecated') {
          console.log(`  📝 Updating AGENTS.md status for ${agentName}: ${currentStatusMatch[1]} → deprecated`);
          const newLine = line.replace(/status:\s*\w+/, 'status: deprecated');
          agentsMd = agentsMd.replace(line, newLine);
          writeFileSync(AGENTS_MD, agentsMd, 'utf-8');
          changesMade++;
          console.log(`${colors.green}  ✅ Updated AGENTS.md${colors.reset}`);
        } else {
          console.log(`  ✓ AGENTS.md already up-to-date`);
        }
      }
      
      try {
        const stdout = execFileSync('git', ['log', '-1', '--format=%ct', agentPath], { encoding: 'utf-8' });
        const lastModified = parseInt(stdout.trim(), 10);
        if (!isNaN(lastModified)) {
          const daysSinceModified = (Math.floor(Date.now() / 1000) - lastModified) / 86400;
          if (daysSinceModified >= 30) {
            console.log(`${colors.yellow}  ⚠️  Agent ${agentName} has been deprecated for ${Math.floor(daysSinceModified)} days (≥30 days)${colors.reset}`);
            console.log(`     Consider moving to agents/_archive/ (run manually)`);
          }
        }
      } catch (e) {}
    }
  }
}

console.log('');
if (changesMade > 0) {
  console.log(`${colors.green}✅ Synchronized ${changesMade} agent status(es)${colors.reset}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review changes: git diff AGENTS.md`);
  console.log(`  2. Commit: git add AGENTS.md; git commit -m 'chore: sync agent status'`);
  console.log(`  3. For agents deprecated ≥30 days: mv agents/DEPRECATED.md agents/_archive/`);
} else {
  console.log(`${colors.green}✅ All agent statuses already in sync${colors.reset}`);
}
