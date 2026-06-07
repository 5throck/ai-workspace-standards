// @version 1.0.0
import { execSync } from 'child_process';

const NUM_COMMITS = parseInt(process.argv[2], 10) || 50;

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return '';
  }
}

function analyze() {
  const hashes = run(`git log -n ${NUM_COMMITS} --format="%H"`).split('\n').filter(Boolean);
  let violations = 0;

  for (const hash of hashes) {
    const subject = run(`git log -1 --format="%s" ${hash}`);
    const files = run(`git diff-tree --no-commit-id --name-only -r ${hash}`).split('\n').filter(Boolean);

    const hasScripts = files.some(f => f.startsWith('scripts/') && f.endsWith('.ts') && f !== 'scripts/SCRIPTS.md' && !f.endsWith('analyze-git-history.ts'));
    const hasScriptsMd = files.some(f => f === 'scripts/SCRIPTS.md');

    const hasAgents = files.some(f => f.startsWith('agents/') && f.endsWith('.md'));
    const hasSkills = files.some(f => (f.startsWith('skills/') || f.startsWith('.claude/skills/')) && f.endsWith('SKILL.md'));
    const hasAgentsMd = files.some(f => f === 'AGENTS.md');

    const hasClaudeMd = files.some(f => f === 'CLAUDE.md');
    const hasGeminiMd = files.some(f => f === 'GEMINI.md');

    const hasTemplateScripts = files.some(f => f.startsWith('templates/common/scripts/') && f.endsWith('.ts'));

    const commitViolations: string[] = [];

    // Rule 1: Script modified -> SCRIPTS.md must be updated
    if (hasScripts && !hasScriptsMd) {
      commitViolations.push('Rule 1 Violation: scripts/*.ts modified but scripts/SCRIPTS.md not updated.');
    }

    // Rule 2: Agent modified -> AGENTS.md must be updated
    if (hasAgents && !hasAgentsMd) {
      commitViolations.push('Rule 2 Violation: agents/*.md modified but AGENTS.md not updated.');
    }

    // Rule 3: Skill modified -> AGENTS.md must be updated
    if (hasSkills && !hasAgentsMd) {
      commitViolations.push('Rule 3 Violation: skills/*/SKILL.md modified but AGENTS.md not updated.');
    }

    // Rule 4: Platform Parity (CLAUDE.md / GEMINI.md)
    if (hasClaudeMd && !hasGeminiMd) {
      commitViolations.push('Rule 4 Violation: CLAUDE.md modified without GEMINI.md.');
    }
    if (hasGeminiMd && !hasClaudeMd) {
      commitViolations.push('Rule 4 Violation: GEMINI.md modified without CLAUDE.md.');
    }

    // Rule 5: Template Script Sync
    if (hasScripts && !hasTemplateScripts) {
      commitViolations.push('Rule 5 Violation: scripts/*.ts modified but templates/common/scripts/ not updated.');
    }

    if (commitViolations.length > 0) {
      console.log(`Commit: ${hash.substring(0, 7)} - ${subject}`);
      for (const v of commitViolations) {
        console.log(`  - ${v}`);
      }
      console.log('');
      violations++;
    }
  }

  console.log(`\nAnalysis complete. Found ${violations} commits with lifecycle violations in the last ${NUM_COMMITS} commits.`);
  if (violations > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

analyze();
