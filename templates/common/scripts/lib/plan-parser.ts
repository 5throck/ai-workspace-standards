#!/usr/bin/env bun
/**
 * Plan Parser for Markdown Format
 * @version 1.0.0
 *
 * Parses ExitPlanMode generated plan files and extracts structured data.
 */

import { readFileSync } from 'fs';
import { load } from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export interface PlanMetadata {
  title: string;
  version?: string;
  phases: number;
  context?: string;
  created?: string;
}

export interface PlanTask {
  id: number;
  task: string;
  agent: string;
  tier: string;
  model: string;
  platform: string;
  isLifecycleUpdate?: boolean;
  isQAAudit?: boolean;
}

export interface ParsedPlan {
  metadata: PlanMetadata;
  tasks: PlanTask[];
}

// ============================================================================
// PARSING FUNCTIONS
// ============================================================================

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; content: string } {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content: content.trim() };
  }

  try {
    const frontmatter = load(match[1]) as Record<string, any>;
    return {
      frontmatter,
      content: match[2] ? match[2].trim() : '',
    };
  } catch (error) {
    console.error('Failed to parse YAML frontmatter:', error);
    return { frontmatter: {}, content: content };
  }
}

/**
 * Parse execution plan table from markdown content
 */
function parseExecutionPlanTable(content: string): PlanTask[] {
  const tasks: PlanTask[] = [];

  // Find the execution plan table section
  const lines = content.split('\n');
  let inTable = false;
  let headerParsed = false;
  const colIndices: Record<string, number> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we're at the table header
    if (line.includes('|') && line.includes('#') && line.includes('Task')) {
      inTable = true;
      const columns = line.split('|').map(c => c.trim()).filter(c => c);
      columns.forEach((col, idx) => {
        if (col === '#') colIndices.id = idx;
        if (col === 'Task') colIndices.task = idx;
        if (col === 'Agent') colIndices.agent = idx;
        if (col === 'Tier') colIndices.tier = idx;
        if (col === 'Model') colIndices.model = idx;
        if (col === 'Platform') colIndices.platform = idx;
      });
      continue;
    }

    // Skip separator line
    if (inTable && !headerParsed && line.match(/^\|[-:\s|]+\|$/)) {
      headerParsed = true;
      continue;
    }

    // Parse table rows
    if (inTable && headerParsed && line.startsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c !== '');
      if (cells.length >= 6) {
        const task: PlanTask = {
          id: parseInt(cells[colIndices.id] || '0', 10),
          task: cells[colIndices.task] || '',
          agent: cells[colIndices.agent] || '',
          tier: cells[colIndices.tier] || '',
          model: cells[colIndices.model] || '',
          platform: cells[colIndices.platform] || '',
        };

        // Detect special tasks
        task.isLifecycleUpdate = task.task.toLowerCase().includes('lifecycle update');
        task.isQAAudit = task.task.toLowerCase().includes('qa audit');

        tasks.push(task);
      }
    }

    // Exit table when we hit a non-table line
    if (inTable && headerParsed && !line.startsWith('|')) {
      break;
    }
  }

  return tasks;
}

/**
 * Extract metadata from frontmatter
 */
function extractMetadata(frontmatter: Record<string, any>): PlanMetadata {
  return {
    title: frontmatter.title || 'Untitled Plan',
    version: frontmatter.version,
    phases: frontmatter.phases || 0,
    context: frontmatter.context,
    created: frontmatter.created,
  };
}

// ============================================================================
// MAIN PARSER FUNCTION
// ============================================================================

/**
 * Parse a Markdown plan file
 * @param filePath - Path to the plan file
 * @returns Parsed plan structure
 */
export function parsePlanFile(filePath: string): ParsedPlan {
  const content = readFileSync(filePath, 'utf-8');
  const { frontmatter } = parseFrontmatter(content);

  const metadata = extractMetadata(frontmatter);
  const tasks = parseExecutionPlanTable(content);

  return {
    metadata,
    tasks,
  };
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (import.meta.main) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: plan-parser.ts <plan-file>');
    console.error('  plan-file: Path to the markdown plan file');
    process.exit(1);
  }

  const planPath = args[0];
  const plan = parsePlanFile(planPath);

  console.log(`\n=== Plan: ${plan.metadata.title} ===`);
  console.log(`Version: ${plan.metadata.version || 'N/A'}`);
  console.log(`Phases: ${plan.metadata.phases}`);
  console.log(`Context: ${plan.metadata.context || 'N/A'}`);
  console.log(`Created: ${plan.metadata.created || 'N/A'}`);
  console.log(`\nTotal Tasks: ${plan.tasks.length}\n`);

  for (const task of plan.tasks) {
    let flags = '';
    if (task.isLifecycleUpdate) flags += ' [Lifecycle Update]';
    if (task.isQAAudit) flags += ' [QA Audit]';

    console.log(`${task.id}. ${task.task}${flags}`);
    console.log(`   Agent: ${task.agent} | Tier: ${task.tier} | Model: ${task.model} | Platform: ${task.platform}`);
  }

  console.log('\n✅ Parsing complete');
}
