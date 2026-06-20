#!/usr/bin/env bun
/**
 * Agent Deleter CLI for Workspace Root
 * @version 1.0.0
 * Deletes agent definition files from the agents/ directory
 *
 * Usage:
 *   bun scripts/agent-delete.ts <name> [--force]
 *
 * @module agent-delete
 */

import path from "node:path";
import { promises as fs } from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");
const agentsDir = path.join(projectRoot, "agents");

/**
 * Delete agent file
 */
async function deleteAgent(name: string, force: boolean = false): Promise<void> {
  const agentPath = path.join(agentsDir, `${name}.md`);

  // Check if agent exists
  try {
    await fs.access(agentPath);
  } catch {
    console.error(`❌ Agent not found: ${name}`);
    process.exit(1);
  }

  // Show agent info before deletion
  const content = await fs.readFile(agentPath, "utf-8");
  const roleMatch = content.match(/^# (.+)$/m);
  const role = roleMatch ? roleMatch[1] : name;

  console.log(`\n📋 Agent to delete: ${role} (${name})`);
  console.log(`Path: ${agentPath}`);

  if (!force) {
    console.log("\n⚠️  This will permanently delete the agent file.");
    console.log("Use --force to skip this confirmation.");

    // In a real CLI, you'd use readline for confirmation
    console.log("\nTo delete, re-run with: --force");
    process.exit(1);
  }

  // Delete the file
  await fs.unlink(agentPath);
  console.log(`\n✅ Agent deleted: ${name}`);

  // Reminder to update AGENTS.md
  console.log(`\n⚠️  Remember to:`);
  console.log(`  1. Remove the agent from AGENTS.md Agent Roster table`);
  console.log(`  2. Remove the agent from Subagent Roster table in AGENTS.md`);
  console.log(`  3. Update CONSTITUTION.md §5.2 Role Groups if needed`);
}

/**
 * Parse CLI arguments
 */
function parseArgs(): { name: string; force: boolean } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`
Usage: bun scripts/agent-delete.ts <name> [options]

Arguments:
  name                Agent name (without .md extension)

Options:
  --force             Skip confirmation and delete immediately

Examples:
  bun scripts/agent-delete.ts old-agent
  bun scripts/agent-delete.ts old-agent --force
`);
    process.exit(1);
  }

  return {
    name: args[0],
    force: args.includes("--force")
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();
  await deleteAgent(options.name, options.force);
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}
