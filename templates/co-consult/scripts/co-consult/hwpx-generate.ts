#!/usr/bin/env bun
/**
 * HWPX Generation Orchestrator
 * Spawns python/generate_hwpx.py to convert a Markdown deliverable into a
 * schema-valid HWPX (.hwpx) document using the pure-Python python-hwpx
 * library — headings, paragraphs, and pipe tables are mapped onto the
 * HWPX OWPML document model without requiring the 한글(Hancom) program
 * installed.
 *
 * @version 1.0.0
 * Usage:
 *   bun scripts/co-consult/hwpx-generate.ts <input.md> <output.hwpx>
 * @module hwpx-generate
 */

import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

function usage(): never {
  console.error("Usage: bun scripts/co-consult/hwpx-generate.ts <input.md> <output.hwpx>");
  process.exit(1);
}

/**
 * Quote a path argument for safe interpolation into the Windows shell.
 * Used because spawn() is invoked with `shell: true` on win32 (see comment
 * in financial-pipeline.ts) — that shell resolution otherwise passes
 * user-derived path arguments to cmd.exe without escaping, which is a
 * shell-injection-shaped risk if a path contains shell metacharacters.
 * No-op on non-Windows platforms where shell:false is used.
 */
function winQuote(path: string): string {
  return process.platform === "win32" ? `"${path.replace(/"/g, '\\"')}"` : path;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) usage();

  const mdPath = resolve(args[0]);
  const outputPath = resolve(args[1]);

  if (!existsSync(mdPath)) {
    console.error(`Error: input Markdown file not found: ${mdPath}`);
    process.exit(1);
  }

  const outputDir = dirname(outputPath);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const scriptDir = dirname(process.argv[1]);
  const scriptPath = resolve(scriptDir, "..", "..", "python", "generate_hwpx.py");
  const pythonBin = process.platform === "win32" ? "python" : "python3";

  const proc = spawn(
    pythonBin,
    [scriptPath, winQuote(mdPath), winQuote(outputPath)],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
      shell: process.platform === "win32",
    }
  );

  let stdout = "";
  let stderr = "";

  proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
  proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

  proc.on("close", (code) => {
    if (stdout) console.log(stdout.trimEnd());
    if (code !== 0) {
      console.error(`python/generate_hwpx.py exited with code ${code}`);
      if (stderr) console.error(stderr);
      process.exit(code ?? 1);
    }
    if (stderr) console.error(stderr);
  });
}

main();
