#!/usr/bin/env bun
/**
 * Agent Lister CLI for Workspace Root
 * @version 1.0.0
 * Lists all agents in the agents/ directory with metadata
 *
 * Usage:
 *   bun scripts/agent-list.ts [--group <group>] [--verbose]
 *
 * @module agent-list
 */

import path from "node:path";
import { promises as fs } from "node:fs";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");
const agentsDir = path.join(projectRoot, "agents");

interface AgentMetadata {
  name: string;
  path: string;
  role?: string;
  group?: string;
  triggers?: string[];
  lastUpdated?: string;
}

/**
 * Extract metadata from agent file
 */
function extractMetadata(content: string, filename: string): AgentMetadata {
  const metadata: AgentMetadata = {
    name: filename.replace(".md", ""),
    path: path.join(agentsDir, filename)
  };

  // Extract role from first heading
  const roleMatch = content.match(/^# (.+)$/m);
  if (roleMatch) {
    metadata.role = roleMatch[1];
  }

  // Extract agent type
  const typeMatch = content.match(/\*\*Agent Type\*\*:\s*(.+)/);
  if (typeMatch) {
    metadata.group = typeMatch[1].trim();
  }

  // Extract last updated
  const dateMatch = content.match(/\*\*Last Updated\*\*:\s*(.+)/);
  if (dateMatch) {
    metadata.lastUpdated = dateMatch[1].trim();
  }

  // Extract triggers
  const triggerSection = content.match(/## Triggers\n([\s\S]+?)(?=\n##|$)/);
  if (triggerSection) {
    const triggers = triggerSection[1]
      .split("\n")
      .filter(line => line.trim().startsWith("-"))
      .map(line => line.replace(/^[-*]\s*/, "").trim());
    metadata.triggers = triggers;
  }

  return metadata;
}

/**
 * List all agents
 */
async function listAgents(groupFilter?: string, verbose: boolean = false): Promise<void> {
  try {
    const files = await fs.readdir(agentsDir);
    const agentFiles = files.filter(f => f.endsWith(".md") && f !== "handoff-spec.md");

    if (agentFiles.length === 0) {
      console.log("No agents found.");
      return;
    }

    const agents: AgentMetadata[] = [];

    for (const file of agentFiles) {
      const content = await fs.readFile(path.join(agentsDir, file), "utf-8");
      const metadata = extractMetadata(content, file);
      agents.push(metadata);
    }

    // Sort by name
    agents.sort((a, b) => a.name.localeCompare(b.name));

    // Filter by group if specified
    const filteredAgents = groupFilter
      ? agents.filter(a => a.group?.toLowerCase().includes(groupFilter.toLowerCase()))
      : agents;

    if (filteredAgents.length === 0) {
      console.log(`No agents found matching group: ${groupFilter}`);
      return;
    }

    // Group agents by group
    const grouped = new Map<string, AgentMetadata[]>();
    for (const agent of filteredAgents) {
      const group = agent.group || "Uncategorized";
      if (!grouped.has(group)) {
        grouped.set(group, []);
      }
      grouped.get(group)!.push(agent);
    }

    console.log(`\n📋 Workspace Agent Registry (${filteredAgents.length} agents)\n`);
    console.log(`━${"━".repeat(60)}`);

    for (const [group, groupAgents] of grouped) {
      console.log(`\n## ${group}`);
      console.log();

      for (const agent of groupAgents) {
        console.log(`  **${agent.name}** ${agent.role ? `(${agent.role})` : ""}`);
        if (verbose) {
          if (agent.lastUpdated) {
            console.log(`  Last Updated: ${agent.lastUpdated}`);
          }
          if (agent.triggers && agent.triggers.length > 0) {
            console.log(`  Triggers: ${agent.triggers.slice(0, 3).join(", ")}${agent.triggers.length > 3 ? "..." : ""}`);
          }
          console.log(`  Path: ${agent.path}`);
        }
        console.log();
      }
    }

    console.log(`━${"━".repeat(60)}`);
    console.log(`\nTotal: ${filteredAgents.length} agents\n`);
  } catch (error) {
    if ((error as any).code === "ENOENT") {
      console.error("Agents directory not found.");
    } else {
      console.error("Error:", error);
    }
    process.exit(1);
  }
}

/**
 * Parse CLI arguments
 */
function parseArgs(): { group?: string; verbose: boolean } {
  const args = process.argv.slice(2);
  const options: { group?: string; verbose: boolean } = { verbose: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--group":
        options.group = args[++i];
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--help":
      case "-h":
        console.log(`
Usage: bun scripts/agent-list.ts [options]

Options:
  --group <group>    Filter by agent group (e.g., Orchestration, Design, Execution)
  --verbose, -v      Show detailed information
  --help, -h         Show this help message

Examples:
  bun scripts/agent-list.ts
  bun scripts/agent-list.ts --group Orchestration
  bun scripts/agent-list.ts --verbose
`);
        process.exit(0);
    }
  }

  return options;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();
  await listAgents(options.group, options.verbose);
}

if (import.meta.main) {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}
