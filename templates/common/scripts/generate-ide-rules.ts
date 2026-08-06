#!/usr/bin/env bun
/**
 * IDE Rules Generator for Cursor and Claude Code
 * @version 1.0.0
 *
 * Generates `.cursorrules` and `.clauderules` files dynamically based on workspace context and agent rosters.
 *
 * Usage:
 *   bun scripts/generate-ide-rules.ts [options]
 *
 * Options:
 *   --check       Dry-run check to verify if .cursorrules and .clauderules are in sync
 *   --force       Overwrite existing .cursorrules and .clauderules files
 *   --dir <path>  Target directory (defaults to current working directory)
 *   --help, -h    Display usage information
 *
 * @module generate-ide-rules
 */

import path from "node:path";
import { promises as fs, existsSync } from "node:fs";

interface CliOptions {
  check: boolean;
  force: boolean;
  dir: string;
  help: boolean;
}

interface AgentInfo {
  name: string;
  role: string;
  source: string;
}

interface WorkspaceContext {
  projectName: string;
  description: string;
  runtime: string;
  hasZodGate: boolean;
  variantName?: string;
}

/**
 * Parse CLI command line arguments
 */
function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    check: false,
    force: false,
    dir: process.cwd(),
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--check") {
      options.check = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dir" && i + 1 < args.length) {
      options.dir = path.resolve(args[++i]);
    }
  }

  return options;
}

/**
 * Print help usage string
 */
function printHelp(): void {
  console.log(`IDE Rules Generator v1.0.0

Generates .cursorrules and .clauderules dynamically based on workspace context and agent rosters.

Usage:
  bun scripts/generate-ide-rules.ts [options]

Options:
  --check       Dry-run check to verify if .cursorrules and .clauderules are in sync
  --force       Overwrite existing .cursorrules and .clauderules files
  --dir <path>  Target directory to generate/check rules in (defaults to cwd)
  --help, -h    Display this help message
`);
}

/**
 * Discover active agent roster from AGENTS.md or agents/ directory
 */
async function discoverAgents(targetDir: string): Promise<AgentInfo[]> {
  const agents: Map<string, AgentInfo> = new Map();

  // 1. Parse AGENTS.md table if present
  const agentsMdPath = path.join(targetDir, "AGENTS.md");
  if (existsSync(agentsMdPath)) {
    try {
      const content = await fs.readFile(agentsMdPath, "utf-8");
      const tableRowRegex = /\|\s*\*\*([a-zA-Z0-9_-]+)\*\*\s*\|\s*\[?`?([^`\]]+)`?\]?\s*\|\s*([^|]+)\|\s*([^|]+)\|/g;
      let match: RegExpExecArray | null;
      while ((match = tableRowRegex.exec(content)) !== null) {
        const name = match[1].trim();
        const role = match[4].trim();
        if (name && name.toLowerCase() !== "agent" && !agents.has(name)) {
          agents.set(name, { name, role, source: "AGENTS.md" });
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  // 2. Scan agents/ directory
  const agentsDir = path.join(targetDir, "agents");
  if (existsSync(agentsDir)) {
    try {
      const files = await fs.readdir(agentsDir);
      for (const file of files) {
        if (file.endsWith(".md") && !file.startsWith("_") && file !== "README.md") {
          const agentName = file.replace(".md", "");
          if (!agents.has(agentName)) {
            const filePath = path.join(agentsDir, file);
            const content = await fs.readFile(filePath, "utf-8");
            let role = "Specialist Agent";
            const roleMatch = content.match(/\*\*Role\*\*:\s*(.+)/i) || content.match(/^# (.+)$/m);
            if (roleMatch) {
              role = roleMatch[1].trim();
            }
            agents.set(agentName, { name: agentName, role, source: `agents/${file}` });
          }
        }
      }
    } catch {
      // Ignore readdir errors
    }
  }

  // Fallback defaults if no roster discovered
  if (agents.size === 0) {
    const defaults: AgentInfo[] = [
      { name: "pm", role: "Project Manager - orchestrates workflow and team assembly", source: "default" },
      { name: "architect", role: "Design agent - produces implementation plans and technical specs", source: "default" },
      { name: "code-writer", role: "Implementation agent - writes source code from approved plans", source: "default" },
      { name: "designer", role: "UI/UX design agent - produces components and design tokens", source: "default" },
      { name: "security-monitor", role: "Security monitor - scans vulnerabilities and security gates", source: "default" },
      { name: "stack-setup", role: "Stack setup specialist - manages environment and IDE integration", source: "default" },
      { name: "test-runner", role: "QA and verification agent - executes tests and validates criteria", source: "default" },
    ];
    for (const d of defaults) {
      agents.set(d.name, d);
    }
  }

  return Array.from(agents.values());
}

/**
 * Discover project context from package.json and docs/
 */
async function discoverWorkspaceContext(targetDir: string): Promise<WorkspaceContext> {
  let projectName = path.basename(targetDir);
  let description = "TypeScript Multi-Agent Development Environment";
  let variantName: string | undefined = undefined;

  const pkgPath = path.join(targetDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
      if (pkg.name) projectName = pkg.name;
      if (pkg.description) description = pkg.description;
    } catch {
      // Ignore JSON parse errors
    }
  }

  const docsDir = path.join(targetDir, "docs");
  if (existsSync(docsDir)) {
    try {
      const files = await fs.readdir(docsDir);
      const contextFile = files.find((f) => f.endsWith(".context.md") || f === "context.md");
      if (contextFile) {
        const vName = contextFile.replace(".context.md", "");
        if (vName !== "context") {
          variantName = vName;
        }
      }
    } catch {
      // Ignore readdir errors
    }
  }

  const hasZodGate =
    existsSync(path.join(targetDir, "skills", "zod-contract-gate", "SKILL.md")) ||
    existsSync(path.join(targetDir, ".claude", "skills", "zod-contract-gate", "SKILL.md")) ||
    existsSync(path.join(targetDir, "templates", "common", "skills", "zod-contract-gate", "SKILL.md"));

  return {
    projectName,
    description,
    runtime: "Bun (TypeScript-first per ADR-0036)",
    hasZodGate,
    variantName,
  };
}

/**
 * Synthesize content for .cursorrules
 */
function generateCursorRules(context: WorkspaceContext, agents: AgentInfo[]): string {
  const agentList = agents.map((a) => `- **${a.name}**: ${a.role}`).join("\n");

  return `# Cursor Rules — Project AI Context & Agent Guidance
# Generated dynamically by bun scripts/generate-ide-rules.ts (v1.0.0)

## 1. Project Context
- **Project**: ${context.projectName}${context.variantName ? ` (${context.variantName})` : ""}
- **Description**: ${context.description}
- **Runtime**: ${context.runtime}
- **Contract Gate**: ${context.hasZodGate ? "Zod Runtime Contract Safety Gate (skills/zod-contract-gate)" : "Standard Runtime Validation"}

## 2. Active Agent Roster
${agentList}

## 3. Core Development Rules
- **TypeScript-First**: All scripts in \`scripts/\` are TypeScript (\`.ts\`) executed via Bun (\`bun scripts/<name>.ts\`). No shell scripts (\`.sh\`/\`.ps1\`) per ADR-0036.
- **Runtime Contract Validation**: Enforce Zod schema validation for all API inputs, inter-agent IPC payloads, and configuration files.
- **Idempotency & Quality Gates**: All file modifications must be idempotent. Run test runner and audit checks (\`bun scripts/audit.ts\`) before claiming task completion.
- **Cross-Platform & UTF-8**: Ensure code and script logging format outputs clean UTF-8 text compatible across Windows, Linux, and macOS.
`;
}

/**
 * Synthesize content for .clauderules
 */
function generateClaudeRules(context: WorkspaceContext, agents: AgentInfo[]): string {
  const agentList = agents.map((a) => `- **${a.name}**: ${a.role}`).join("\n");

  return `# Claude Rules — Workspace Context & Agent Ecosystem Guidance
# Generated dynamically by bun scripts/generate-ide-rules.ts (v1.0.0)

## 1. Workspace Context
- **Workspace Project**: ${context.projectName}${context.variantName ? ` [Variant: ${context.variantName}]` : ""}
- **Description**: ${context.description}
- **Development Runtime**: ${context.runtime}
- **Contract Safety Standard**: Zod runtime schema validation gate enabled

## 2. Agent Ecosystem Roster
${agentList}

## 3. Execution & Workflow Guidelines
- **TypeScript Operational Scripts**: Execute automation via \`bun scripts/<script>.ts\`. Do not invoke obsolete shell scripts.
- **Contract Boundaries**: Use Zod schemas (\`skills/zod-contract-gate\`) to validate inter-agent payload contracts, configuration parsing, and public function interfaces.
- **Specialist Agent Delegation**: Respect single-responsibility specialist agent roles (\`pm\`, \`architect\`, \`code-writer\`, \`designer\`, \`security-monitor\`, \`stack-setup\`, \`test-runner\`).
- **Empirical Verification**: Always verify changes via build, lint, and test runner outputs before finalizing work.
`;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const targetDir = options.dir;
  if (!existsSync(targetDir)) {
    console.error(`[ERROR] Target directory does not exist: ${targetDir}`);
    process.exit(1);
  }

  const agents = await discoverAgents(targetDir);
  const context = await discoverWorkspaceContext(targetDir);

  const expectedCursorRules = generateCursorRules(context, agents);
  const expectedClaudeRules = generateClaudeRules(context, agents);

  const cursorPath = path.join(targetDir, ".cursorrules");
  const claudePath = path.join(targetDir, ".clauderules");

  if (options.check) {
    let inSync = true;

    if (!existsSync(cursorPath)) {
      console.log(`[FAIL] .cursorrules is missing in ${targetDir}`);
      inSync = false;
    } else {
      const currentCursor = await fs.readFile(cursorPath, "utf-8");
      if (currentCursor.trim() !== expectedCursorRules.trim()) {
        console.log(`[FAIL] .cursorrules is out of sync in ${targetDir}`);
        inSync = false;
      }
    }

    if (!existsSync(claudePath)) {
      console.log(`[FAIL] .clauderules is missing in ${targetDir}`);
      inSync = false;
    } else {
      const currentClaude = await fs.readFile(claudePath, "utf-8");
      if (currentClaude.trim() !== expectedClaudeRules.trim()) {
        console.log(`[FAIL] .clauderules is out of sync in ${targetDir}`);
        inSync = false;
      }
    }

    if (inSync) {
      console.log(`[PASS] IDE rules (.cursorrules, .clauderules) are up to date in ${targetDir}`);
      process.exit(0);
    } else {
      process.exit(1);
    }
  }

  // Normal generation / write mode
  const cursorExists = existsSync(cursorPath);
  const claudeExists = existsSync(claudePath);

  if ((cursorExists || claudeExists) && !options.force && !options.check) {
    // If files exist, overwrite them and log notice
    console.log(`[INFO] Updating existing IDE rules (.cursorrules / .clauderules) in ${targetDir}`);
  }

  await fs.writeFile(cursorPath, expectedCursorRules, "utf-8");
  await fs.writeFile(claudePath, expectedClaudeRules, "utf-8");

  console.log(`[SUCCESS] Successfully generated IDE rules in ${targetDir}`);
  console.log(`  - .cursorrules (${expectedCursorRules.length} bytes)`);
  console.log(`  - .clauderules (${expectedClaudeRules.length} bytes)`);
}

main().catch((err) => {
  console.error(`[FATAL] generate-ide-rules failed:`, err);
  process.exit(1);
});
