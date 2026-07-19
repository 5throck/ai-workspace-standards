#!/usr/bin/env bun
/**
 * Financial Validation Orchestrator
 * Spawns python/validate.py to run accounting equation checks and anomaly detection.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/financial-validate.ts <dart-json-path> [--output <output-path>]
 * @module financial-validate
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

function usage(): never {
  console.error("Usage: bun scripts/financial-validate.ts <dart-json-path> [--output <output-path>]");
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  const dartPath = resolve(args[0]);
  const outputFlagIdx = args.indexOf("--output");
  const outputPath = outputFlagIdx >= 0 && args[outputFlagIdx + 1]
    ? resolve(args[outputFlagIdx + 1])
    : null;

  if (!existsSync(dartPath)) {
    console.error(`Error: DART file not found: ${dartPath}`);
    process.exit(1);
  }

  const scriptDir = dirname(process.argv[1]);
  const scriptPath = resolve(scriptDir, "..", "..", "python", "validate.py");
  const pythonBin = process.platform === "win32" ? "python" : "python3";

  const proc = spawn(pythonBin, [scriptPath, dartPath], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    shell: process.platform === "win32",
  });

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
  proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

  proc.on("close", (code) => {
    if (code !== 0) {
      console.error(`python/validate.py exited with code ${code}`);
      if (stderr) console.error(stderr);
      process.exit(code ?? 1);
    }

    if (outputPath) {
      const dir = dirname(outputPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(outputPath, stdout, "utf-8");
      console.log(`Validation report saved to: ${outputPath}`);
    } else {
      console.log(stdout);
    }
  });
}

main();
