/**
 * @version 1.0.1
 * Scripts to spawn local MCP servers via stdio
 *
 * The `mcp/` directory is a scaffold-time extension point (see
 * docs/co-safety.context.md → File Organization Policy): the template ships no
 * MCP server implementations, so this launcher starts nothing until a project
 * adds its own servers to the list below.
 */
import { spawn } from "child_process";
import path from "path";

const servers: string[] = [
  // e.g. mcp/kr-safety-regs/index.ts — add project-local MCP server entry points here
];

console.log("Starting local MCP servers...");

if (servers.length === 0) {
  console.log("No MCP servers configured — add entries to the `servers` list in scripts/co-safety/start-mcp.ts.");
}

for (const server of servers) {
  const fullPath = path.resolve(process.cwd(), server);

  // Using bun to run the typescript files
  const child = spawn("bun", ["run", "--env-file", ".env", fullPath], {
    // MCP servers communicate over stdin/stdout, so we might want to map them appropriately
    // But for a simple start script that runs them together, we might just inherit or pipe.
    stdio: "inherit"
  });

  child.on("error", (err) => {
    console.error(`[${server}] Failed to start:`, err);
  });

  child.on("exit", (code) => {
    console.log(`[${server}] Exited with code ${code}`);
  });
}
