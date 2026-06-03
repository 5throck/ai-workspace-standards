#!/usr/bin/env bun
/**
 * Skill Dependency Analysis Script (SC-02)
 * @version 1.0.0
 * Analyzes /skill invocation references within SKILL.md files to detect:
 *   - Circular dependencies (A → B → A)
 *   - Orphaned references (skill calls a non-existent or archived skill)
 *   - Deprecated skill usage (active skill calls a deprecated skill)
 *
 * Usage:
 *   bun scripts/skill-dependency-analysis.ts
 *   bun scripts/skill-dependency-analysis.ts --report   # full health report
 *   bun scripts/skill-dependency-analysis.ts --json     # machine-readable output
 *   bun scripts/skill-dependency-analysis.ts --skill <name>  # single skill
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

const ROOT = cwd();
const SKILLS_DIR = join(ROOT, 'skills');
const CLAUDE_SKILLS_DIR = join(ROOT, '.claude', 'skills');

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const REPORT_MODE = args.includes('--report');
const SINGLE_SKILL = args.includes('--skill') ? args[args.indexOf('--skill') + 1] : null;

const c = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

interface SkillMeta {
  name: string;
  path: string;
  status: string; // active | deprecated | archived
  dependencies: string[]; // skill names referenced via /skill or Skill tool
}

interface AnalysisIssue {
  level: 'error' | 'warning';
  skill: string;
  type: 'circular' | 'orphaned' | 'deprecated-dep' | 'self-ref';
  message: string;
  chain?: string[];
}

function normalizeContent(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseStatus(content: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return 'unknown';
  const line = match[1].split('\n').find(l => l.trim().startsWith('status:'));
  if (!line) return 'unknown';
  return line.split(':')[1]?.trim().replace(/['"]/g, '') ?? 'unknown';
}

function parseName(content: string, fallback: string): string {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return fallback;
  const line = match[1].split('\n').find(l => l.trim().startsWith('name:'));
  if (!line) return fallback;
  return line.split(':')[1]?.trim().replace(/['"]/g, '') ?? fallback;
}

/**
 * Extract /skill <name> and Skill tool invocations from skill body content.
 * Patterns matched:
 *   - `/skill foo-bar`         (slash command form)
 *   - `Skill("foo-bar")`       (tool form, double quotes)
 *   - `Skill('foo-bar')`       (tool form, single quotes)
 *   - `skill: "foo-bar"`       (YAML-style reference in examples)
 */
function extractDependencies(content: string): string[] {
  const deps = new Set<string>();

  // Strip frontmatter
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // /skill <name> or `/skill <name>`
  for (const m of body.matchAll(/`?\/skill\s+([\w-]+)`?/gi)) {
    deps.add(m[1].toLowerCase());
  }

  // Skill("name") or Skill('name')
  for (const m of body.matchAll(/\bSkill\s*\(\s*["']([\w-]+)["']/g)) {
    deps.add(m[1].toLowerCase());
  }

  // skill: "name" in YAML blocks
  for (const m of body.matchAll(/\bskill:\s*["']([\w-]+)["']/gi)) {
    deps.add(m[1].toLowerCase());
  }

  return [...deps];
}

function loadSkills(): Map<string, SkillMeta> {
  const skills = new Map<string, SkillMeta>();

  const scanDir = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = join(dir, entry.name, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      const raw = readFileSync(skillFile, 'utf-8');
      const content = normalizeContent(raw);
      const name = parseName(content, entry.name).toLowerCase();
      const status = parseStatus(content);
      const dependencies = extractDependencies(content);

      // Use canonical name from frontmatter if available, else dir name
      const key = name !== 'unknown' ? name : entry.name.toLowerCase();
      if (!skills.has(key)) {
        skills.set(key, { name: key, path: skillFile, status, dependencies });
      }
    }
  };

  scanDir(SKILLS_DIR);
  scanDir(CLAUDE_SKILLS_DIR);

  return skills;
}

/** DFS cycle detection. Returns the cycle chain if found, null otherwise. */
function findCycle(
  start: string,
  skills: Map<string, SkillMeta>,
  path: string[] = []
): string[] | null {
  if (path.includes(start)) {
    return [...path.slice(path.indexOf(start)), start];
  }
  const skill = skills.get(start);
  if (!skill) return null;

  for (const dep of skill.dependencies) {
    const cycle = findCycle(dep, skills, [...path, start]);
    if (cycle) return cycle;
  }
  return null;
}

function analyze(skills: Map<string, SkillMeta>): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const checkedCycles = new Set<string>();

  const target = SINGLE_SKILL ? [SINGLE_SKILL.toLowerCase()] : [...skills.keys()];

  for (const skillName of target) {
    const skill = skills.get(skillName);
    if (!skill) {
      if (SINGLE_SKILL) {
        issues.push({
          level: 'error',
          skill: skillName,
          type: 'orphaned',
          message: `Skill "${skillName}" not found in skills/ or .claude/skills/`,
        });
      }
      continue;
    }

    for (const dep of skill.dependencies) {
      // Self-reference
      if (dep === skillName) {
        issues.push({
          level: 'error',
          skill: skillName,
          type: 'self-ref',
          message: `"${skillName}" references itself`,
        });
        continue;
      }

      // Orphaned reference
      if (!skills.has(dep)) {
        issues.push({
          level: 'error',
          skill: skillName,
          type: 'orphaned',
          message: `"${skillName}" references non-existent skill "${dep}"`,
        });
        continue;
      }

      // Deprecated dependency
      const depSkill = skills.get(dep)!;
      if (depSkill.status === 'deprecated' || depSkill.status === 'archived') {
        issues.push({
          level: 'warning',
          skill: skillName,
          type: 'deprecated-dep',
          message: `"${skillName}" references ${depSkill.status} skill "${dep}"`,
        });
      }
    }

    // Circular dependency check (run once per skill, skip already-checked)
    const cycleKey = skillName;
    if (!checkedCycles.has(cycleKey)) {
      checkedCycles.add(cycleKey);
      const cycle = findCycle(skillName, skills);
      if (cycle) {
        const chainKey = cycle.join('→');
        if (!checkedCycles.has(chainKey)) {
          checkedCycles.add(chainKey);
          issues.push({
            level: 'error',
            skill: skillName,
            type: 'circular',
            message: `Circular dependency detected: ${cycle.join(' → ')}`,
            chain: cycle,
          });
        }
      }
    }
  }

  return issues;
}

function printReport(skills: Map<string, SkillMeta>, issues: AnalysisIssue[]) {
  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  console.log(`${c.cyan}${c.bold}=== Skill Dependency Analysis ===${c.reset}`);
  console.log(`${c.dim}Root: ${ROOT}${c.reset}`);
  console.log(`${c.dim}Skills loaded: ${skills.size}${c.reset}\n`);

  if (REPORT_MODE) {
    console.log(`${c.cyan}── Dependency Graph ──${c.reset}`);
    for (const [name, skill] of [...skills.entries()].sort()) {
      const icon = skill.status === 'active' ? '🟢' : skill.status === 'deprecated' ? '🟡' : '⚫';
      const deps = skill.dependencies.length > 0 ? skill.dependencies.join(', ') : '(none)';
      console.log(`  ${icon} ${name} → ${deps}`);
    }
    console.log('');
  }

  if (issues.length === 0) {
    console.log(`${c.green}✅ No dependency issues found (${skills.size} skills analyzed)${c.reset}`);
    return;
  }

  if (errors.length > 0) {
    console.log(`${c.red}❌ Errors (${errors.length}):${c.reset}`);
    for (const e of errors) {
      console.log(`   ${c.red}[${e.type}]${c.reset} ${e.message}`);
      if (e.chain) console.log(`   ${c.dim}Chain: ${e.chain.join(' → ')}${c.reset}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`${c.yellow}⚠️  Warnings (${warnings.length}):${c.reset}`);
    for (const w of warnings) {
      console.log(`   ${c.yellow}[${w.type}]${c.reset} ${w.message}`);
    }
  }

  console.log(`\n${c.dim}${'─'.repeat(50)}${c.reset}`);
  console.log(`${errors.length > 0 ? c.red : c.green}Result: ${errors.length} error(s), ${warnings.length} warning(s)${c.reset}`);
}

function main() {
  const skills = loadSkills();
  const issues = analyze(skills);

  if (JSON_MODE) {
    console.log(JSON.stringify({
      skillsAnalyzed: skills.size,
      errors: issues.filter(i => i.level === 'error'),
      warnings: issues.filter(i => i.level === 'warning'),
      summary: `${issues.filter(i => i.level === 'error').length} error(s), ${issues.filter(i => i.level === 'warning').length} warning(s)`,
    }, null, 2));
  } else {
    printReport(skills, issues);
  }

  process.exit(issues.filter(i => i.level === 'error').length > 0 ? 1 : 0);
}

main();
