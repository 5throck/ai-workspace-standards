#!/usr/bin/env bun
/**
 * Agent Creator CLI
 * Creates new agent definition files in the agents/ directory
 *
 * Usage:
 *   bun scripts/agent-create.ts <name> [--role <role>] [--group <group>]
 *
 * @module agent-create
 */

import path from "node:path";
import { promises as fs } from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");
const agentsDir = path.join(projectRoot, "agents");

interface AgentOptions {
  name: string;
  role?: string;
  group?: string;
  description?: string;
}

/**
 * Agent template for ABAP project
 */
function getAgentTemplate(options: AgentOptions): string {
  const { name, role, group, description } = options;

  const roleText = role || name.charAt(0).toUpperCase() + name.slice(1);
  const groupText = group || "Business";
  const descText = description || `Brief description of what this ${roleText} agent does`;

  return `# ${roleText}

> **Agent Type**: ${groupText}
> **Auto-Dispatch**: No (dispatch via PM or manual)
> **Last Updated**: ${new Date().toISOString().split('T')[0]}

---

## Role Description

${descText}.

---

## Key Responsibilities

- <!-- Responsibility 1 -->
- <!-- Responsibility 2 -->
- <!-- Responsibility 3 -->

---

## Key Tools

| Tool | Purpose |
|------|---------|
| <!-- tool-name --> | <!-- purpose -->

---

## When to Dispatch

### Triggers

- Trigger keyword 1
- Trigger keyword 2
- Trigger keyword 3

### Dispatch Conditions

Dispatch this agent when:
1. Condition 1
2. Condition 2

---

## Input Format

The agent expects the following input:

\`\`\`
<!-- Example input format -->
\`\`\`

---

## Output Format

The agent produces:

\`\`\`
<!-- Example output format -->
\`\`\`

---

## Handoff Rules

### Receives From

- <!-- Agent or role that hands off to this agent -->

### Hands Off To

- <!-- Agent or role that this agent hands off to -->

---

## Constraints & Boundaries

- <!-- Constraint 1 -->
- <!-- Constraint 2 -->

---
`;
}

/**
 * Create agent file
 */
async function createAgent(options: AgentOptions): Promise<void> {
  const agentPath = path.join(agentsDir, `${options.name}.md`);

  // Check if agent already exists
  try {
    await fs.access(agentPath);
    console.error(`❌ Agent already exists: ${agentPath}`);
    process.exit(1);
  } catch {
    // File doesn't exist, continue
  }

  // Create agent file
  const content = getAgentTemplate(options);
  await fs.writeFile(agentPath, content, "utf-8");

  console.log(`✅ Agent created: ${agentPath}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Edit the agent file to add role-specific content`);
  console.log(`  2. Add the agent to AGENTS.md (Agent Roster table)`);
  console.log(`  3. Add the agent to Subagent Roster table in AGENTS.md`);
  console.log(`  4. Update docs/context.md § Agents if needed`);
  console.log(`  5. Add dispatch triggers to PM or other agents`);
}

/**
 * Parse CLI arguments
 */
function parseArgs(): AgentOptions {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`
Usage: bun scripts/agent-create.ts <name> [options]

Arguments:
  name                  Agent name (without .md extension)

Options:
  --role <role>         Display name for the role (default: capitalized name)
  --group <group>       Agent group: Business, Technical, Orchestration
  --description <desc>  Brief description of the agent's purpose

Examples:
  bun scripts/agent-create.ts qm-analyst
  bun scripts/agent-create.ts qm-analyst --role "QM Analyst" --group Business
  bun scripts/agent-create.ts interface-expert --group Technical --description "Handles interface integrations"
`);
    process.exit(1);
  }

  const options: AgentOptions = {
    name: args[0]
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--role":
        options.role = args[++i];
        break;
      case "--group":
        options.group = args[++i];
        break;
      case "--description":
        options.description = args[++i];
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();
  await createAgent(options);
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}
